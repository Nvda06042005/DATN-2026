/**
 * Trận đánh chiến thuật theo lượt, đội hình 3 đấu 3 (mở rộng được) của Hành trình Đông A. Hàm thuần: cùng trạng thái và cùng lệnh cho cùng kết quả,
 * nên máy chủ giữ trạng thái chuẩn, kiểm tra từng lệnh và trả danh sách sự kiện cho trình duyệt dựng hoạt ảnh.
 *
 *  - Mỗi vòng, các đơn vị còn sống ra lệnh theo tốc độ (cao trước). Người chơi chọn Tấn công / Phòng thủ / Kỹ năng và chọn mục tiêu cho từng đơn vị của mình.
 *  - Hai hàng: cận chiến chỉ đánh được hàng trước khi hàng trước còn người; cung thủ và thuyền bắn được hàng sau.
 *  - Khắc chế: bộ binh (giáo) thắng kỵ binh, kỵ binh thắng cung thủ, cung thủ thắng bộ binh và voi; voi lấn bộ binh và kỵ binh.
 *  - Tài nguyên là "quân lương": hồi mỗi vòng, kỹ năng tốn quân lương và có hồi chiêu. Đơn vị tiếp tế còn sống thì phe đó hồi thêm, nên đánh mục tiêu tiếp tế làm địch cạn tài nguyên.
 *  - Mưu kế của chặng dùng một lần: trả lời đúng câu hỏi kiến thức thì phát huy đủ, sai thì yếu đi. Kết quả vì vậy phụ thuộc cả kiến thức lẫn quyết định chiến thuật.
 *  - Đối thủ dùng luật xác định (không gọi mô hình ngôn ngữ): dùng kỹ năng khi đủ điều kiện, thủ khi sắp gục, ưu tiên mục tiêu hạ được, mục tiêu phải bảo vệ rồi tới mục tiêu chịu sát thương lớn nhất.
 * Các con số HP, sát thương, tốc độ là quy ước trò chơi, không phải số liệu lịch sử.
 */
import { BadRequestException } from '@nestjs/common';

export type Cls = 'bo' | 'cung' | 'ky' | 'voi' | 'thuyen' | 'tuong' | 'luong';
export const CLS_LABEL: Record<Cls, string> = { bo: 'Bộ binh', cung: 'Cung thủ', ky: 'Kỵ binh', voi: 'Tượng binh', thuyen: 'Chiến thuyền', tuong: 'Chỉ huy', luong: 'Tiếp tế' };
export type Row = 'front' | 'back';
export type Side = 'ally' | 'enemy';
export type Status = 'burn' | 'stun' | 'weak' | 'rally' | 'cover';

export interface SkillDef {
  id: string; name: string; text: string; cost: number; cooldown: number;
  kind: 'strike' | 'volley' | 'rally' | 'heal' | 'cover' | 'panic';
  power?: number; status?: 'burn' | 'stun' | 'weak'; turns?: number; value?: number; ranged?: boolean;
}
export interface UnitDef { id: string; name: string; cls: Cls; row: Row; hp: number; atk: number; def: number; spd: number; ranged?: boolean; skill?: SkillDef | null; tags?: string[]; sprite: string; note?: string }
export interface StratagemEffect { type: 'stun_all' | 'weaken_all' | 'rally_all' | 'cut_supply' | 'burn_tag' | 'heal_all'; turns?: number; value?: number; tag?: string }
export interface Stratagem { name: string; text: string; prompt: string; options: Array<{ id: string; text: string }>; correct: string; effect: StratagemEffect; explain: string }
export type Objective =
  | { type: 'eliminate' }
  | { type: 'survive'; rounds: number }
  | { type: 'destroy'; tag: string; need: number; rounds: number }
  | { type: 'kill'; unit: string };
export interface TacticsScenario {
  mode: 'tactics'; title: string; intro: string; allies: UnitDef[]; enemies: UnitDef[];
  supply: { ally: number; enemy: number; regen: number; enemy_regen: number; per_supply_unit: number };
  objective: Objective; objective_text: string;
  /** Đơn vị của ta phải còn sống; mất là thua */
  protect?: string | null;
  max_rounds: number;
  /** Địch mất máu mỗi vòng vì thiếu lương (kế "vườn không nhà trống") */
  hunger?: { from_round: number; dmg: number } | null;
  stratagem?: Stratagem | null;
  tips: string[]; win_text: string; lose_text: string;
}

export interface TUnit {
  id: string; side: Side; name: string; cls: Cls; row: Row; hp: number; maxHp: number; atk: number; def: number; spd: number; ranged: boolean;
  skill: SkillDef | null; tags: string[]; sprite: string; alive: boolean; guard: boolean; cd: number; fx: Partial<Record<Status, number>>; burn: number;
}
export interface TState {
  v: 1; round: number; queue: string[]; units: Record<string, TUnit>; order: string[]; supply: Record<Side, number>;
  status: 'active' | 'won' | 'lost'; reason: string | null; stratagem: 'none' | 'ready' | 'used'; cut: number; atkBonus: number;
  stats: { dealt: number; taken: number; lost: number; skills: number; guards: number; stratagem: 'unused' | 'strong' | 'weak' };
}
export type TAction =
  | { type: 'attack'; unit?: string; target: string }
  | { type: 'defend'; unit?: string }
  | { type: 'skill'; unit?: string; target?: string }
  | { type: 'stratagem'; answer: string };
export interface TEvent {
  t: 'round' | 'turn' | 'attack' | 'skill' | 'defend' | 'fx' | 'down' | 'supply' | 'stratagem' | 'skip' | 'end';
  unit?: string; target?: string; dmg?: number; hp?: number; adv?: boolean; guarded?: boolean; name?: string; text?: string; n?: number;
  side?: Side; value?: number; ok?: boolean; status?: string; reason?: string | null; hits?: Array<{ id: string; dmg: number; hp: number; status?: string; heal?: number }>;
}

const bad = (m: string): never => { throw new BadRequestException(m); };
const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const CLSES: Cls[] = ['bo', 'cung', 'ky', 'voi', 'thuyen', 'tuong', 'luong'];
const ADV: Partial<Record<Cls, Cls[]>> = { bo: ['ky'], ky: ['cung'], cung: ['bo', 'voi'], voi: ['bo', 'ky'] };
const ADV_MULT = 1.3, GUARD_CUT = 0.5, RALLY = 1.25, WEAK = 0.7, BURN_DMG = 3;

// ---------------------------------------------------------------------- kiểm tra kịch bản
const text = (v: unknown, label: string, max: number): string => {
  if (typeof v !== 'string' || !v.trim()) return bad(`${label} không được để trống`);
  return v.trim().length > max ? bad(`${label} tối đa ${max} ký tự`) : v.trim();
};
const int = (v: unknown, label: string, min: number, max: number): number => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : bad(`${label} phải là số nguyên từ ${min} đến ${max}`);
};

function unitDef(raw: any, label: string): UnitDef {
  if (!isObj(raw)) return bad(`${label} không hợp lệ`);
  const id = typeof raw.id === 'string' && /^[a-z0-9_]{1,16}$/.test(raw.id) ? raw.id : bad(`${label}: mã không hợp lệ`);
  const cls = CLSES.includes(raw.cls) ? (raw.cls as Cls) : bad(`${label}: binh chủng không hợp lệ`);
  let skill: SkillDef | null = null;
  if (raw.skill) {
    const k = raw.skill;
    if (!['strike', 'volley', 'rally', 'heal', 'cover', 'panic'].includes(k.kind)) bad(`${label}: loại kỹ năng không hợp lệ`);
    skill = {
      id: typeof k.id === 'string' ? k.id : 'skill', name: text(k.name, `${label}: tên kỹ năng`, 40), text: text(k.text, `${label}: mô tả kỹ năng`, 200), cost: int(k.cost, 'Quân lương', 0, 9), cooldown: int(k.cooldown, 'Hồi chiêu', 0, 6), kind: k.kind,
      ...(k.power !== undefined ? { power: Math.max(0.5, Math.min(3, Number(k.power))) } : {}), ...(['burn', 'stun', 'weak'].includes(k.status) ? { status: k.status } : {}),
      ...(k.turns !== undefined ? { turns: int(k.turns, 'Số vòng hiệu lực', 1, 4) } : {}), ...(k.value !== undefined ? { value: int(k.value, 'Giá trị', 1, 30) } : {}), ...(k.ranged ? { ranged: true } : {}),
    };
  }
  return {
    id, name: text(raw.name, `${label}: tên`, 40), cls, row: raw.row === 'back' ? 'back' : 'front', hp: int(raw.hp, `${label}: HP`, 1, 99), atk: int(raw.atk, `${label}: công`, 0, 30), def: int(raw.def, `${label}: thủ`, 0, 15), spd: int(raw.spd, `${label}: tốc độ`, 1, 20),
    ...(raw.ranged ? { ranged: true } : {}), skill, tags: Array.isArray(raw.tags) ? raw.tags.filter((t: unknown) => typeof t === 'string').slice(0, 4) : [], sprite: text(raw.sprite, `${label}: hình`, 20), ...(raw.note ? { note: text(raw.note, `${label}: ghi chú`, 160) } : {}),
  };
}

export function normalizeTactics(raw: unknown): TacticsScenario {
  if (!isObj(raw)) return bad('Kịch bản trận đánh không hợp lệ');
  const side = (list: unknown, label: string): UnitDef[] => (Array.isArray(list) && list.length >= 1 && list.length <= 5 ? list.map((u, i) => unitDef(u, `${label} ${i + 1}`)) : bad(`${label}: cần từ 1 đến 5 đơn vị`));
  const allies = side(raw.allies, 'Quân ta'), enemies = side(raw.enemies, 'Quân địch');
  const all = [...allies, ...enemies];
  if (new Set(all.map((u) => u.id)).size !== all.length) bad('Mã đơn vị bị trùng');
  const o = raw.objective;
  let objective: Objective;
  if (o?.type === 'survive') objective = { type: 'survive', rounds: int(o.rounds, 'Số vòng cần trụ', 2, 10) };
  else if (o?.type === 'destroy') {
    const tag = text(o.tag, 'Nhãn mục tiêu', 20);
    const have = enemies.filter((u) => (u.tags ?? []).includes(tag)).length;
    if (!have) bad('Không có đơn vị địch nào mang nhãn mục tiêu');
    objective = { type: 'destroy', tag, need: int(o.need, 'Số mục tiêu cần diệt', 1, have), rounds: int(o.rounds, 'Hạn vòng', 2, 12) };
  } else if (o?.type === 'kill') objective = { type: 'kill', unit: enemies.some((u) => u.id === o.unit) ? o.unit : bad('Mục tiêu cần hạ không có trong quân địch') };
  else objective = { type: 'eliminate' };
  const protect = raw.protect ? (allies.some((u) => u.id === raw.protect) ? String(raw.protect) : bad('Đơn vị cần bảo vệ không có trong quân ta')) : null;
  let stratagem: Stratagem | null = null;
  if (raw.stratagem) {
    const g = raw.stratagem;
    const options = (Array.isArray(g.options) && g.options.length >= 2 && g.options.length <= 4 ? g.options : bad('Mưu kế: cần 2–4 phương án')).map((x: any) => ({ id: String(x.id), text: text(x.text, 'Phương án', 200) }));
    if (!options.some((x: { id: string }) => x.id === g.correct)) bad('Mưu kế: đáp án đúng phải nằm trong các phương án');
    if (!['stun_all', 'weaken_all', 'rally_all', 'cut_supply', 'burn_tag', 'heal_all'].includes(g.effect?.type)) bad('Mưu kế: hiệu ứng không hợp lệ');
    stratagem = { name: text(g.name, 'Tên mưu kế', 40), text: text(g.text, 'Mô tả mưu kế', 240), prompt: text(g.prompt, 'Câu hỏi của mưu kế', 300), options, correct: String(g.correct), explain: text(g.explain, 'Giải thích', 400),
      effect: { type: g.effect.type, ...(g.effect.turns ? { turns: int(g.effect.turns, 'Số vòng', 1, 4) } : {}), ...(g.effect.value ? { value: int(g.effect.value, 'Giá trị', 1, 20) } : {}), ...(g.effect.tag ? { tag: String(g.effect.tag) } : {}) } };
  }
  const sp = isObj(raw.supply) ? raw.supply : {};
  return {
    mode: 'tactics', title: text(raw.title, 'Tên trận', 80), intro: text(raw.intro, 'Lời dẫn', 500), allies, enemies,
    supply: { ally: int(sp.ally ?? 3, 'Quân lương ta', 0, 10), enemy: int(sp.enemy ?? 3, 'Quân lương địch', 0, 10), regen: int(sp.regen ?? 2, 'Hồi quân lương', 0, 5), enemy_regen: int(sp.enemy_regen ?? 2, 'Hồi quân lương địch', 0, 5), per_supply_unit: int(sp.per_supply_unit ?? 1, 'Hồi thêm mỗi đơn vị tiếp tế', 0, 3) },
    objective, objective_text: text(raw.objective_text, 'Mục tiêu trận', 200), protect, max_rounds: int(raw.max_rounds ?? 10, 'Số vòng tối đa', 3, 14),
    hunger: raw.hunger ? { from_round: int(raw.hunger.from_round, 'Vòng bắt đầu thiếu lương', 1, 10), dmg: int(raw.hunger.dmg, 'Sát thương thiếu lương', 1, 5) } : null,
    stratagem, tips: (Array.isArray(raw.tips) ? raw.tips : []).slice(0, 5).map((t: unknown) => text(t, 'Mẹo', 220)), win_text: text(raw.win_text, 'Lời tổng kết khi thắng', 400), lose_text: text(raw.lose_text, 'Lời tổng kết khi thua', 400),
  };
}

// ---------------------------------------------------------------------- dựng trận
const SUPPLY_MAX = 10;
const mk = (d: UnitDef, side: Side): TUnit => ({
  id: d.id, side, name: d.name, cls: d.cls, row: d.row, hp: d.hp, maxHp: d.hp, atk: d.atk, def: d.def, spd: d.spd, ranged: Boolean(d.ranged) || d.cls === 'cung',
  skill: d.skill ?? null, tags: d.tags ?? [], sprite: d.sprite, alive: true, guard: false, cd: 0, fx: {}, burn: 0,
});

const sideOf = (s: TState, side: Side): TUnit[] => s.order.map((id) => s.units[id]).filter((u) => u.side === side && u.alive);
const queueOf = (s: TState): string[] =>
  s.order.map((id) => s.units[id]).filter((u) => u.alive).sort((a, b) => b.spd - a.spd || (a.side === b.side ? s.order.indexOf(a.id) - s.order.indexOf(b.id) : a.side === 'ally' ? -1 : 1)).map((u) => u.id);

/**
 * `knowledge` là phần trăm tốt nhất của phần luyện tập ở chặng này: từ 90% được thêm 2 quân lương và +10% sát thương, từ 70% được thêm 1 quân lương.
 * Trả về trạng thái đã chạy tới lượt đầu tiên của người chơi cùng các sự kiện mở màn.
 */
export function createTactics(scn: TacticsScenario, knowledge = 0): { state: TState; events: TEvent[] } {
  const units: Record<string, TUnit> = {};
  const order: string[] = [];
  for (const d of scn.allies) { units[d.id] = mk(d, 'ally'); order.push(d.id); }
  for (const d of scn.enemies) { units[d.id] = mk(d, 'enemy'); order.push(d.id); }
  const s: TState = {
    v: 1, round: 1, queue: [], units, order, supply: { ally: Math.min(SUPPLY_MAX, scn.supply.ally + (knowledge >= 90 ? 2 : knowledge >= 70 ? 1 : 0)), enemy: scn.supply.enemy },
    status: 'active', reason: null, stratagem: scn.stratagem ? 'ready' : 'none', cut: 0, atkBonus: knowledge >= 90 ? 0.1 : 0,
    stats: { dealt: 0, taken: 0, lost: 0, skills: 0, guards: 0, stratagem: 'unused' },
  };
  s.queue = queueOf(s);
  const events: TEvent[] = [{ t: 'round', n: 1 }];
  runEnemies(s, scn, events);
  return { state: s, events };
}

// ---------------------------------------------------------------------- luật đánh
/** Mục tiêu một đơn vị với tới được: bắn xa tới mọi hàng; cận chiến chỉ tới hàng trước khi hàng trước còn người */
export function reachable(s: TState, u: TUnit, ranged = u.ranged): TUnit[] {
  const foes = sideOf(s, u.side === 'ally' ? 'enemy' : 'ally');
  if (ranged) return foes;
  const front = foes.filter((f) => f.row === 'front');
  return front.length ? front : foes;
}

function damage(s: TState, from: TUnit, to: TUnit, power: number): { dmg: number; adv: boolean; guarded: boolean } {
  const adv = (ADV[from.cls] ?? []).includes(to.cls);
  let raw = from.atk * power * (adv ? ADV_MULT : 1) * (from.fx.rally ? RALLY : 1) * (from.fx.weak ? WEAK : 1) * (from.side === 'ally' ? 1 + s.atkBonus : 1);
  raw = Math.max(1, Math.round(raw) - to.def);
  const guarded = to.guard || Boolean(to.fx.cover);
  return { dmg: Math.max(1, Math.round(raw * (guarded ? GUARD_CUT : 1))), adv, guarded };
}

function hurt(s: TState, to: TUnit, dmg: number, events: TEvent[]): number {
  const real = Math.min(to.hp, dmg);
  to.hp -= real;
  if (to.side === 'enemy') s.stats.dealt += real; else s.stats.taken += real;
  if (to.hp <= 0 && to.alive) {
    to.alive = false;
    to.fx = {};
    to.burn = 0;
    s.queue = s.queue.filter((id) => id !== to.id);
    if (to.side === 'ally') s.stats.lost += 1;
    events.push({ t: 'down', unit: to.id });
  }
  return real;
}

function doAttack(s: TState, u: TUnit, target: TUnit, events: TEvent[]): void {
  const d = damage(s, u, target, 1);
  hurt(s, target, d.dmg, events);
  // sự kiện đòn đánh đứng trước sự kiện gục ngã để hoạt ảnh đúng thứ tự
  const down = events.at(-1)?.t === 'down' && events.at(-1)?.unit === target.id ? events.pop()! : null;
  events.push({ t: 'attack', unit: u.id, target: target.id, dmg: d.dmg, hp: target.hp, adv: d.adv, guarded: d.guarded });
  if (down) events.push(down);
}

function doSkill(s: TState, scn: TacticsScenario, u: TUnit, targetId: string | undefined, events: TEvent[]): void {
  const k = u.skill!;
  s.supply[u.side] -= k.cost;
  u.cd = k.cooldown + 1;
  if (u.side === 'ally') s.stats.skills += 1;
  const hits: NonNullable<TEvent['hits']> = [];
  const downs: TEvent[] = [];
  const strike = (t: TUnit, power: number): void => {
    const d = damage(s, u, t, power);
    hurt(s, t, d.dmg, downs);
    const entry: (typeof hits)[number] = { id: t.id, dmg: d.dmg, hp: t.hp };
    if (k.status && t.alive) {
      if (k.status === 'burn') t.burn = Math.max(t.burn, k.turns ?? 2); else t.fx[k.status] = Math.max(t.fx[k.status] ?? 0, k.turns ?? 1);
      entry.status = k.status;
    }
    hits.push(entry);
  };
  const foes = sideOf(s, u.side === 'ally' ? 'enemy' : 'ally');
  const friends = sideOf(s, u.side);
  if (k.kind === 'strike') strike(s.units[targetId!], k.power ?? 1.5);
  else if (k.kind === 'volley') { const row = s.units[targetId!].row; for (const t of foes.filter((f) => f.row === row)) strike(t, k.power ?? 0.8); }
  else if (k.kind === 'rally') for (const t of friends) { t.fx.rally = Math.max(t.fx.rally ?? 0, k.turns ?? 2); hits.push({ id: t.id, dmg: 0, hp: t.hp, status: 'rally' }); }
  else if (k.kind === 'heal') { const t = s.units[targetId!]; const heal = Math.min(t.maxHp - t.hp, k.value ?? 6); t.hp += heal; hits.push({ id: t.id, dmg: 0, hp: t.hp, heal }); }
  else if (k.kind === 'cover') { const t = s.units[targetId!]; t.fx.cover = 2; u.guard = true; hits.push({ id: t.id, dmg: 0, hp: t.hp, status: 'cover' }); } // che tới hết vòng sau: địch nhanh hơn vẫn bị giảm sát thương
  else {
    // "bắn mắt voi": voi hoảng loạn, choáng một lượt và giẫm vào một đơn vị cùng phe đứng cạnh
    const voi = s.units[targetId!];
    voi.fx.stun = Math.max(voi.fx.stun ?? 0, 1);
    hits.push({ id: voi.id, dmg: 0, hp: voi.hp, status: 'stun' });
    const victim = sideOf(s, voi.side).filter((x) => x.id !== voi.id && x.row === voi.row)[0] ?? sideOf(s, voi.side).filter((x) => x.id !== voi.id)[0];
    if (victim) { const dmg = Math.max(1, Math.round(voi.atk * 0.8) - victim.def); hurt(s, victim, dmg, downs); hits.push({ id: victim.id, dmg, hp: victim.hp }); }
  }
  events.push({ t: 'skill', unit: u.id, target: targetId, name: k.name, text: k.text, hits });
  events.push(...downs);
  events.push({ t: 'supply', side: u.side, value: s.supply[u.side] });
  void scn;
}

/** Kỹ năng dùng được ở lượt này không và các mục tiêu hợp lệ (rỗng = không cần chọn mục tiêu) */
export function skillTargets(s: TState, u: TUnit): { usable: boolean; why: string | null; targets: string[] } {
  const k = u.skill;
  if (!k) return { usable: false, why: 'Đơn vị này không có kỹ năng', targets: [] };
  if (u.cd > 0) return { usable: false, why: `Còn hồi chiêu ${u.cd} vòng`, targets: [] };
  if (s.supply[u.side] < k.cost) return { usable: false, why: `Cần ${k.cost} quân lương`, targets: [] };
  if (k.kind === 'rally') return { usable: true, why: null, targets: [] };
  if (k.kind === 'heal') { const t = sideOf(s, u.side).filter((x) => x.hp < x.maxHp); return { usable: t.length > 0, why: t.length ? null : 'Chưa ai bị thương', targets: t.map((x) => x.id) }; }
  if (k.kind === 'cover') { const t = sideOf(s, u.side).filter((x) => x.id !== u.id); return { usable: t.length > 0, why: t.length ? null : 'Không còn ai để che chắn', targets: t.map((x) => x.id) }; }
  if (k.kind === 'panic') { const t = sideOf(s, u.side === 'ally' ? 'enemy' : 'ally').filter((x) => x.cls === 'voi'); return { usable: t.length > 0, why: t.length ? null : 'Không có tượng binh để bắn', targets: t.map((x) => x.id) }; }
  const t = reachable(s, u, u.ranged || Boolean(k.ranged));
  return { usable: t.length > 0, why: t.length ? null : 'Không có mục tiêu trong tầm', targets: t.map((x) => x.id) };
}

// ---------------------------------------------------------------------- đối thủ (luật xác định)
function enemyAct(s: TState, scn: TacticsScenario, u: TUnit, events: TEvent[]): void {
  const foes = sideOf(s, 'ally');
  if (!foes.length) return;
  if (u.cls === 'luong' || u.atk === 0) { u.guard = true; events.push({ t: 'defend', unit: u.id }); return; }
  const sk = skillTargets(s, u);
  if (u.skill && sk.usable) {
    const k = u.skill;
    const friends = sideOf(s, 'enemy');
    if (k.kind === 'panic') return doSkill(s, scn, u, sk.targets[0], events);
    if (k.kind === 'rally' && friends.length >= 2 && !u.fx.rally) return doSkill(s, scn, u, undefined, events);
    if (k.kind === 'heal') { const low = friends.filter((f) => f.hp <= f.maxHp * 0.5).sort((a, b) => a.hp - b.hp)[0]; if (low) return doSkill(s, scn, u, low.id, events); }
    if (k.kind === 'volley') {
      const rows = (['front', 'back'] as Row[]).map((r) => sk.targets.map((id) => s.units[id]).filter((t) => t.row === r)).sort((a, b) => b.length - a.length);
      if (rows[0].length >= 2) return doSkill(s, scn, u, rows[0][0].id, events);
    }
    if (k.kind === 'strike') {
      const targets = sk.targets.map((id) => s.units[id]);
      const pick = targets.find((t) => t.id === scn.protect) ?? targets.filter((t) => !t.guard).sort((a, b) => b.hp - a.hp)[0];
      if (pick && pick.hp > u.atk) return doSkill(s, scn, u, pick.id, events);
    }
  }
  // sắp gục và còn đồng đội: thủ một lượt (không thủ hai lượt liền nhau)
  if (u.hp <= u.maxHp * 0.3 && !u.guard && sideOf(s, 'enemy').length > 1 && s.round % 2 === 0) { u.guard = true; events.push({ t: 'defend', unit: u.id }); return; }
  const targets = reachable(s, u);
  const scored = targets.map((t) => ({ t, d: damage(s, u, t, 1).dmg }));
  const kill = scored.filter((x) => x.d >= x.t.hp).sort((a, b) => a.t.hp - b.t.hp)[0];
  const vip = scored.find((x) => x.t.id === scn.protect);
  const best = kill ?? vip ?? scored.sort((a, b) => b.d - a.d || a.t.hp - b.t.hp)[0];
  u.guard = false;
  doAttack(s, u, best.t, events);
}

// ---------------------------------------------------------------------- vòng và kết thúc
function finish(s: TState, status: 'won' | 'lost', reason: string, events: TEvent[]): void {
  if (s.status !== 'active') return;
  s.status = status;
  s.reason = reason;
  s.queue = [];
  events.push({ t: 'end', status, reason });
}

function checkEnd(s: TState, scn: TacticsScenario, events: TEvent[]): void {
  if (s.status !== 'active') return;
  const allies = sideOf(s, 'ally'), enemies = sideOf(s, 'enemy');
  if (!allies.length) return finish(s, 'lost', 'wiped', events);
  if (scn.protect && !s.units[scn.protect].alive) return finish(s, 'lost', 'protect', events);
  const o = scn.objective;
  if (o.type === 'kill' && !s.units[o.unit].alive) return finish(s, 'won', 'objective', events);
  if (o.type === 'destroy' && scn.enemies.filter((d) => (d.tags ?? []).includes(o.tag) && !s.units[d.id].alive).length >= o.need) return finish(s, 'won', 'objective', events);
  if (!enemies.length) return finish(s, 'won', 'objective', events);
}

function endRound(s: TState, scn: TacticsScenario, events: TEvent[]): void {
  // lửa cháy và thiếu lương gây sát thương cuối vòng
  for (const u of s.order.map((id) => s.units[id])) {
    if (!u.alive) continue;
    if (u.burn > 0) { const dmg = hurt(s, u, BURN_DMG, events); const down = events.at(-1)?.t === 'down' ? events.pop()! : null; events.push({ t: 'fx', unit: u.id, status: 'burn', dmg, hp: u.hp }); if (down) events.push(down); u.burn -= 1; }
    if (u.alive && u.side === 'enemy' && scn.hunger && s.round >= scn.hunger.from_round) { const dmg = hurt(s, u, scn.hunger.dmg, events); const down = events.at(-1)?.t === 'down' ? events.pop()! : null; events.push({ t: 'fx', unit: u.id, status: 'hunger', dmg, hp: u.hp }); if (down) events.push(down); }
  }
  checkEnd(s, scn, events);
  if (s.status !== 'active') return;
  const o = scn.objective;
  if (o.type === 'survive' && s.round >= o.rounds) return finish(s, 'won', 'survived', events);
  if (o.type === 'destroy' && s.round >= o.rounds) return finish(s, 'lost', 'escaped', events);
  if (s.round >= scn.max_rounds) return finish(s, 'lost', 'timeout', events);
  s.round += 1;
  for (const u of s.order.map((id) => s.units[id])) {
    if (!u.alive) continue;
    if (u.cd > 0) u.cd -= 1;
    for (const k of ['weak', 'rally', 'cover'] as Status[]) if (u.fx[k]) { u.fx[k]! -= 1; if (u.fx[k]! <= 0) delete u.fx[k]; }
  }
  for (const side of ['ally', 'enemy'] as Side[]) {
    const carriers = sideOf(s, side).filter((u) => u.cls === 'luong' || u.tags.includes('supply')).length;
    let gain = (side === 'ally' ? scn.supply.regen : scn.supply.enemy_regen) + carriers * scn.supply.per_supply_unit;
    if (side === 'enemy' && s.cut > 0) gain = 0;
    s.supply[side] = Math.min(SUPPLY_MAX, s.supply[side] + gain);
    events.push({ t: 'supply', side, value: s.supply[side] });
  }
  if (s.cut > 0) s.cut -= 1;
  s.queue = queueOf(s);
  events.push({ t: 'round', n: s.round });
}

/** Chạy lượt của địch (và các lượt bị choáng) cho tới khi tới lượt một đơn vị của người chơi hoặc trận kết thúc */
function runEnemies(s: TState, scn: TacticsScenario, events: TEvent[]): void {
  let guard = 0;
  while (s.status === 'active' && guard++ < 400) {
    if (!s.queue.length) { endRound(s, scn, events); continue; }
    const u = s.units[s.queue[0]];
    if (!u.alive) { s.queue.shift(); continue; }
    if (u.fx.stun) { u.fx.stun -= 1; if (u.fx.stun <= 0) delete u.fx.stun; s.queue.shift(); events.push({ t: 'skip', unit: u.id, status: 'stun' }); continue; }
    if (u.side === 'ally') { u.guard = false; events.push({ t: 'turn', unit: u.id }); return; }
    s.queue.shift();
    enemyAct(s, scn, u, events);
    checkEnd(s, scn, events);
  }
}

function applyStratagem(s: TState, e: StratagemEffect, strong: boolean, events: TEvent[]): void {
  const turns = Math.max(1, Math.round((e.turns ?? 1) * (strong ? 1 : 0.5)));
  const value = Math.max(1, Math.round((e.value ?? 4) * (strong ? 1 : 0.5)));
  const enemies = sideOf(s, 'enemy'), allies = sideOf(s, 'ally');
  if (e.type === 'stun_all') for (const u of strong ? enemies : enemies.slice(0, 1)) u.fx.stun = Math.max(u.fx.stun ?? 0, 1);
  else if (e.type === 'weaken_all') for (const u of enemies) u.fx.weak = Math.max(u.fx.weak ?? 0, turns);
  else if (e.type === 'rally_all') for (const u of allies) u.fx.rally = Math.max(u.fx.rally ?? 0, turns);
  else if (e.type === 'cut_supply') { s.supply.enemy = strong ? 0 : Math.floor(s.supply.enemy / 2); s.cut = turns; events.push({ t: 'supply', side: 'enemy', value: s.supply.enemy }); }
  else if (e.type === 'burn_tag') for (const u of enemies.filter((x) => !e.tag || x.tags.includes(e.tag))) u.burn = Math.max(u.burn, turns);
  else for (const u of allies) u.hp = Math.min(u.maxHp, u.hp + value);
}

/** Lệnh của người chơi cho đơn vị đang tới lượt. Ném 400 khi lệnh không hợp lệ (sai lượt, sai mục tiêu, thiếu quân lương…). */
export function applyTactics(scn: TacticsScenario, s: TState, a: TAction): TEvent[] {
  if (s.status !== 'active') return bad('Trận đánh đã kết thúc');
  const u = s.units[s.queue[0]];
  if (!u || u.side !== 'ally') return bad('Chưa tới lượt của quân ta');
  const events: TEvent[] = [];
  if (a.type === 'stratagem') {
    if (s.stratagem !== 'ready' || !scn.stratagem) return bad('Mưu kế đã dùng hoặc trận này không có mưu kế');
    const ok = a.answer === scn.stratagem.correct;
    s.stratagem = 'used';
    s.stats.stratagem = ok ? 'strong' : 'weak';
    applyStratagem(s, scn.stratagem.effect, ok, events);
    events.unshift({ t: 'stratagem', ok, name: scn.stratagem.name, text: scn.stratagem.explain });
    checkEnd(s, scn, events);
    return events; // mưu kế không tốn lượt của đơn vị
  }
  if (a.unit && a.unit !== u.id) return bad(`Đang là lượt của ${u.name}`);
  if (a.type === 'attack') {
    if (u.atk <= 0) return bad(`${u.name} không tấn công được`);
    const target = reachable(s, u).find((t) => t.id === a.target) ?? bad('Mục tiêu này không với tới được: hãy đánh hàng trước, hoặc dùng đơn vị bắn xa');
    doAttack(s, u, target, events);
  } else if (a.type === 'defend') {
    u.guard = true;
    s.stats.guards += 1;
    s.supply.ally = Math.min(SUPPLY_MAX, s.supply.ally + 1);
    events.push({ t: 'defend', unit: u.id }, { t: 'supply', side: 'ally', value: s.supply.ally });
  } else if (a.type === 'skill') {
    const sk = skillTargets(s, u);
    if (!sk.usable) return bad(sk.why ?? 'Chưa dùng được kỹ năng');
    if (sk.targets.length && !sk.targets.includes(a.target ?? '')) return bad('Hãy chọn mục tiêu hợp lệ cho kỹ năng');
    doSkill(s, scn, u, sk.targets.length ? a.target : undefined, events);
  } else return bad('Lệnh không hợp lệ');
  s.queue.shift();
  checkEnd(s, scn, events);
  runEnemies(s, scn, events);
  return events;
}

/** Sao: 3 khi không mất đơn vị nào, 2 khi mất một, còn lại 1; thua thì 0. Điểm trận đánh tách khỏi mức hiểu kiến thức. */
export function tacticsResult(scn: TacticsScenario, s: TState): { won: boolean; stars: number; score: number; rounds: number; lost: number; compare: Array<{ label: string; mine: string; history: string; ok: boolean }> } {
  const won = s.status === 'won';
  const stars = !won ? 0 : s.stats.lost === 0 ? 3 : s.stats.lost === 1 ? 2 : 1;
  const hpLeft = sideOf(s, 'ally').reduce((n, u) => n + u.hp, 0), hpMax = scn.allies.reduce((n, u) => n + u.hp, 0);
  const score = won ? 300 + stars * 100 + Math.round((hpLeft / Math.max(1, hpMax)) * 200) + (s.stats.stratagem === 'strong' ? 100 : 0) : Math.min(250, s.stats.dealt * 5);
  // bảng so sánh của màn Sử quan (25/11/2026): mưu kế em dùng và kết quả trận, cạnh lời giải thích lịch sử của mưu kế và lời kết của kịch bản
  const compare: Array<{ label: string; mine: string; history: string; ok: boolean }> = [];
  if (scn.stratagem) compare.push({ label: `Mưu kế: ${scn.stratagem.name}`, mine: s.stats.stratagem === 'strong' ? 'Dùng đúng lúc, trả lời đúng' : s.stats.stratagem === 'weak' ? 'Có dùng nhưng trả lời chưa đúng' : 'Chưa dùng mưu kế', history: scn.stratagem.explain, ok: s.stats.stratagem === 'strong' });
  compare.push({ label: 'Kết quả', mine: won ? `Thắng sau ${s.round} vòng, mất ${s.stats.lost} đơn vị` : 'Chưa thắng', history: scn.win_text, ok: won });
  return { won, stars, score, rounds: s.round, lost: s.stats.lost, compare };
}

/** Trạng thái gửi cho trình duyệt: đủ để vẽ và để biết lệnh nào hợp lệ; đáp án của mưu kế không bao giờ nằm trong này */
export function publicTactics(scn: TacticsScenario, s: TState): Record<string, unknown> {
  const actor = s.status === 'active' ? s.units[s.queue[0]] : undefined;
  const sk = actor && actor.side === 'ally' ? skillTargets(s, actor) : null;
  return {
    mode: 'tactics', title: scn.title, intro: scn.intro, objective_text: scn.objective_text, tips: scn.tips, round: s.round, max_rounds: scn.max_rounds, status: s.status, reason: s.reason, supply: s.supply,
    objective: scn.objective, protect: scn.protect ?? null, queue: s.queue,
    units: s.order.map((id) => { const u = s.units[id]; return { id: u.id, side: u.side, name: u.name, cls: u.cls, cls_label: CLS_LABEL[u.cls], row: u.row, hp: u.hp, max_hp: u.maxHp, atk: u.atk, def: u.def, spd: u.spd, ranged: u.ranged, sprite: u.sprite, alive: u.alive, guard: u.guard, cd: u.cd, burn: u.burn, fx: Object.keys(u.fx), tags: u.tags, skill: u.skill ? { name: u.skill.name, text: u.skill.text, cost: u.skill.cost, cooldown: u.skill.cooldown, kind: u.skill.kind } : null }; }),
    actor: actor && actor.side === 'ally' ? { id: actor.id, attack_targets: actor.atk > 0 ? reachable(s, actor).map((t) => t.id) : [], skill: sk } : null,
    stratagem: scn.stratagem ? { state: s.stratagem, name: scn.stratagem.name, text: scn.stratagem.text, prompt: scn.stratagem.prompt, options: scn.stratagem.options } : null,
    result: s.status === 'active' ? null : { ...tacticsResult(scn, s), text: s.status === 'won' ? scn.win_text : scn.lose_text },
  };
}

/** Người chơi máy đơn giản để kiểm thử cân bằng: dùng mưu kế đúng, dùng kỹ năng khi được, còn lại đánh mục tiêu yếu nhất */
export function autoTactics(scn: TacticsScenario, s: TState): TAction {
  if (s.stratagem === 'ready' && scn.stratagem) return { type: 'stratagem', answer: scn.stratagem.correct };
  const u = s.units[s.queue[0]];
  const o = scn.objective;
  const goal = (list: TUnit[]): TUnit[] => (o.type === 'destroy' ? list.filter((t) => t.tags.includes(o.tag)) : o.type === 'kill' ? list.filter((t) => t.id === o.unit) : []);
  const sk = skillTargets(s, u);
  if (sk.usable) {
    if (!sk.targets.length) return { type: 'skill' };
    const pool = sk.targets.map((id) => s.units[id]);
    const aimed = goal(pool);
    const pick = u.skill!.kind === 'cover' ? pool.find((t) => t.id === scn.protect) ?? pool[0]
      : u.skill!.kind === 'heal' ? pool.sort((a, b) => a.hp - b.hp)[0]
      : aimed.length ? aimed.sort((a, b) => a.hp - b.hp)[0] : pool.sort((a, b) => b.hp - a.hp)[0];
    return { type: 'skill', target: pick.id };
  }
  if (u.atk <= 0) return { type: 'defend' };
  const targets = reachable(s, u);
  const wanted = goal(targets);
  const pick = (wanted.length ? wanted : targets).sort((a, b) => a.hp - b.hp)[0];
  return pick ? { type: 'attack', target: pick.id } : { type: 'defend' };
}
