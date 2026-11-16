/**
 * Màn mẫu Bạch Đằng 1288: mô hình giảng dạy được đơn giản hóa, chơi theo lượt trên một khúc sông chia ô (hàm thuần, máy chủ giữ trạng thái chuẩn).
 *
 *  Giai đoạn 1 – Chuẩn bị: con nước đổi theo chu kỳ đã công bố. Khi nước cao mặt sông trông như nhau; nước ròng mới lộ bãi cạn và lạch sâu (đọc địa hình).
 *      Chỉ đóng được cọc lúc nước thấp, trên bãi cạn; lạch sâu không đóng được. Cọc chắn cửa sông nhánh sẽ khóa đường ra của thủy quân mai phục.
 *  Giai đoạn 2 – Nhử địch: nước cao che bãi cọc. Thuyền nhẹ khiêu chiến rồi lui; thuyền địch đã bị khiêu chiến bám theo đúng vệt nước thuyền nhẹ
 *      đã đi qua, mỗi lượt 2 ô; thuyền chưa bị khiêu chiến theo lạch sâu ra biển. Để thuyền địch áp sát thì bị đánh.
 *  Giai đoạn 3 – Phản công: nước rút. Thuyền địch đang nằm trên ô có cọc bị vướng cọc (đứng yên, hư hại, dễ bị đánh), nằm trên bãi cạn thì mắc cạn (đi chậm),
 *      ở lạch sâu thì chạy ra biển. Thủy quân mai phục đổ ra từ cửa sông nhánh, bè lửa chỉ trúng thuyền đã mất cơ động, cung thủ hai bờ bắn thuyền vướng cọc.
 *      Nước lên lại mà chưa diệt xong thì địch thoát.
 *
 *  Thua khi đặt trận địa sai (không thuyền nào vướng cọc, thuyền chỉ huy chạy thoát), nhử không đúng vùng, hoặc mất lực lượng chủ chốt.
 *  Mọi con số (HP, sát thương, số lượt, số cụm cọc) là quy ước trò chơi, không phải số liệu lịch sử; kết quả lượt chơi không đổi kết quả lịch sử.
 */
import { BadRequestException } from '@nestjs/common';

export const BD_W = 12;
export const BD_H = 5;
type XY = [number, number];
export type BdPhase = 'prepare' | 'lure' | 'counter' | 'done';
export type BdUnitState = 'wait' | 'free' | 'slow' | 'stuck' | 'sunk' | 'escaped' | 'blocked';

export interface BdScenario {
  mode: 'bachdang'; title: string; intro: string;
  /** BD_H dòng × BD_W ký tự: d lạch sâu, s bãi cạn, m cửa sông nhánh (bãi cạn), r ghềnh đá, b bờ */
  grid: string[];
  /** Các cột của vùng phục kích (gợi ý trên bản đồ) */
  zone: [number, number];
  stakes: { total: number; per_turn: number };
  /** Mức nước từng lượt của mỗi giai đoạn: 0 thấp, 1 lưng chừng, 2 cao */
  tide: { prepare: number[]; lure: number[]; counter: number[] };
  bait: { id: string; name: string; at: XY; hp: number; atk: number; speed: number; range: number; sprite: string };
  fleets: Array<{ id: string; name: string; mouth: XY; hp: number; atk: number; speed: number; fire: number; key?: boolean; sprite: string }>;
  enemies: Array<{ id: string; name: string; at: XY; hp: number; atk: number; flagship?: boolean; sprite: string }>;
  strand_damage: number; archers: number;
  rules: string[]; briefing: { prepare: string; lure: string; counter: string };
  win_text: string; lose_text: string;
}

export interface BdUnit {
  id: string; side: 'ally' | 'enemy'; role: 'bait' | 'fleet' | 'ship'; name: string; x: number; y: number; hp: number; maxHp: number; atk: number; speed: number;
  state: BdUnitState; chasing: boolean; flagship: boolean; key: boolean; fire: number; burn: number; acted: boolean; sprite: string;
}
export interface BdState {
  v: 1; phase: BdPhase; turn: number; stakes: string[]; placed: number; revealed: boolean; units: Record<string, BdUnit>; order: string[];
  /** Vệt nước: các ô thuyền nhẹ đã đi qua kể từ lúc khiêu chiến; thuyền địch đuổi theo đúng vệt này */
  trail: string[];
  status: 'active' | 'won' | 'lost'; reason: string | null;
  flags: { provoked: boolean; stranded: string[]; slowed: string[]; blocked: string[]; hits: number; fire_missed: boolean; dealt: number };
}
export type BdAction =
  | { type: 'stake'; at: XY } | { type: 'unstake'; at: XY } | { type: 'wait' } | { type: 'ready' }
  | { type: 'provoke' } | { type: 'move'; to: XY }
  | { type: 'order'; unit: string; to?: XY; attack?: string; fire?: string } | { type: 'end_turn' };
export interface BdEvent {
  t: 'tide' | 'reveal' | 'stake' | 'unstake' | 'phase' | 'spawn' | 'blocked' | 'provoke' | 'move' | 'attack' | 'stuck' | 'slow' | 'refloat' | 'fire' | 'burn' | 'arrows' | 'sunk' | 'escape' | 'warn' | 'end';
  unit?: string; target?: string; at?: XY; path?: XY[]; units?: string[]; dmg?: number; hp?: number; ok?: boolean; level?: number; label?: string; phase?: BdPhase; text?: string; status?: string; reason?: string | null;
}

const bad = (m: string): never => { throw new BadRequestException(m); };
const key = (x: number, y: number): string => `${x},${y}`;
const xy = (k: string): XY => k.split(',').map(Number) as XY;
const cheb = (ax: number, ay: number, bx: number, by: number): number => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const manh = (ax: number, ay: number, bx: number, by: number): number => Math.abs(ax - bx) + Math.abs(ay - by);
const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < BD_W && y < BD_H;
const onBoard = (u: BdUnit): boolean => u.state === 'free' || u.state === 'slow' || u.state === 'stuck';
/** Thứ tự xét hướng đi: dọc sông trước (về phía biển, rồi ngược dòng), sau đó mới áp mạn */
const DIRS: XY[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// ---------------------------------------------------------------------- kiểm tra kịch bản
const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, label: string, max: number): string => {
  if (typeof v !== 'string' || !v.trim()) return bad(`${label} không được để trống`);
  return v.trim().length > max ? bad(`${label} tối đa ${max} ký tự`) : v.trim();
};
const int = (v: unknown, label: string, min: number, max: number): number => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : bad(`${label} phải là số nguyên từ ${min} đến ${max}`);
};
const cell = (v: unknown, label: string): XY => (Array.isArray(v) && v.length === 2 && Number.isInteger(v[0]) && Number.isInteger(v[1]) && inside(v[0], v[1]) ? [v[0], v[1]] : bad(`${label}: vị trí ngoài khúc sông`));
const levels = (v: unknown, label: string, min: number, max: number): number[] =>
  Array.isArray(v) && v.length >= min && v.length <= max && v.every((n) => [0, 1, 2].includes(n)) ? (v as number[]) : bad(`${label}: cần ${min}–${max} lượt, mỗi lượt là mức nước 0, 1 hoặc 2`);
const uid = (v: unknown, label: string): string => (typeof v === 'string' && /^[a-z0-9_]{1,16}$/.test(v) ? v : bad(`${label}: mã không hợp lệ`));

export function normalizeBachDang(raw: unknown): BdScenario {
  if (!isObj(raw)) return bad('Kịch bản Bạch Đằng không hợp lệ');
  if (!Array.isArray(raw.grid) || raw.grid.length !== BD_H || raw.grid.some((r) => typeof r !== 'string' || r.length !== BD_W || /[^dsmrb]/.test(r))) return bad(`Khúc sông phải gồm ${BD_H} dòng, mỗi dòng ${BD_W} ký tự thuộc d, s, m, r, b`);
  const grid = raw.grid as string[];
  const at = (p: XY): string => grid[p[1]][p[0]];
  const tide = isObj(raw.tide) ? raw.tide : bad('Thiếu chu kỳ thủy triều');
  const prepare = levels(tide.prepare, 'Chuẩn bị', 2, 8), lure = levels(tide.lure, 'Nhử địch', 2, 6), counter = levels(tide.counter, 'Phản công', 3, 8);
  if (!prepare.includes(0)) bad('Giai đoạn chuẩn bị phải có ít nhất một lượt nước thấp để đóng cọc');
  if (lure.some((n) => n !== 2)) bad('Giai đoạn nhử địch diễn ra lúc nước cao (mọi lượt ở mức 2)');
  if (counter[0] === 2) bad('Giai đoạn phản công phải bắt đầu khi nước rút');
  const b = isObj(raw.bait) ? raw.bait : bad('Thiếu thuyền nhẹ khiêu chiến');
  const bait = { id: uid(b.id, 'Thuyền nhẹ'), name: text(b.name, 'Tên thuyền nhẹ', 50), at: cell(b.at, 'Thuyền nhẹ'), hp: int(b.hp, 'HP thuyền nhẹ', 1, 30), atk: int(b.atk, 'Công thuyền nhẹ', 1, 10), speed: int(b.speed, 'Tốc độ thuyền nhẹ', 1, 4), range: int(b.range, 'Tầm khiêu chiến', 2, 8), sprite: text(b.sprite, 'Hình', 20) };
  if (!'ds'.includes(at(bait.at))) bad('Thuyền nhẹ phải xuất phát trên mặt nước');
  const fleets = (Array.isArray(raw.fleets) && raw.fleets.length >= 1 && raw.fleets.length <= 3 ? raw.fleets : bad('Cần 1–3 cánh thủy quân mai phục')).map((f: any) => {
    const mouth = cell(f.mouth, 'Cửa sông nhánh');
    if (at(mouth) !== 'm') bad('Cánh quân mai phục phải xuất phát từ một ô cửa sông nhánh (m)');
    return { id: uid(f.id, 'Cánh quân'), name: text(f.name, 'Tên cánh quân', 60), mouth, hp: int(f.hp, 'HP', 1, 40), atk: int(f.atk, 'Công', 1, 12), speed: int(f.speed, 'Tốc độ', 1, 4), fire: int(f.fire ?? 0, 'Số bè lửa', 0, 3), key: Boolean(f.key), sprite: text(f.sprite, 'Hình', 20) };
  });
  const enemies = (Array.isArray(raw.enemies) && raw.enemies.length >= 1 && raw.enemies.length <= 4 ? raw.enemies : bad('Cần 1–4 đoàn thuyền địch')).map((e: any) => {
    const p = cell(e.at, 'Thuyền địch');
    if (at(p) !== 'd') bad('Thuyền địch tiến vào theo lạch sâu');
    return { id: uid(e.id, 'Thuyền địch'), name: text(e.name, 'Tên đoàn thuyền địch', 60), at: p, hp: int(e.hp, 'HP', 1, 60), atk: int(e.atk, 'Công', 1, 12), flagship: Boolean(e.flagship), sprite: text(e.sprite, 'Hình', 20) };
  });
  if (enemies.filter((e: { flagship: boolean }) => e.flagship).length !== 1) bad('Cần đúng một thuyền chỉ huy của địch');
  const all = [bait.id, ...fleets.map((f: { id: string }) => f.id), ...enemies.map((e: { id: string }) => e.id)];
  if (new Set(all).size !== all.length) bad('Mã đơn vị bị trùng');
  const spots = [key(...bait.at), ...enemies.map((e: { at: XY }) => key(...e.at))];
  if (new Set(spots).size !== spots.length) bad('Hai đơn vị không thể xuất phát cùng một ô');
  const zone = Array.isArray(raw.zone) && raw.zone.length === 2 ? [int(raw.zone[0], 'Vùng phục kích', 0, BD_W - 1), int(raw.zone[1], 'Vùng phục kích', 0, BD_W - 1)] as [number, number] : bad('Thiếu vùng phục kích');
  const st = isObj(raw.stakes) ? raw.stakes : {};
  const br = isObj(raw.briefing) ? raw.briefing : bad('Thiếu lời dặn từng giai đoạn');
  return {
    mode: 'bachdang', title: text(raw.title, 'Tên trận', 80), intro: text(raw.intro, 'Lời dẫn', 600), grid, zone, stakes: { total: int(st.total ?? 6, 'Số cụm cọc', 3, 10), per_turn: int(st.per_turn ?? 3, 'Số cụm cọc mỗi con nước', 1, 5) },
    tide: { prepare, lure, counter }, bait, fleets, enemies, strand_damage: int(raw.strand_damage ?? 3, 'Hư hại khi vướng cọc', 0, 10), archers: int(raw.archers ?? 1, 'Sát thương cung thủ', 0, 5),
    rules: (Array.isArray(raw.rules) ? raw.rules : bad('Thiếu luật chơi công bố')).slice(0, 10).map((r: unknown) => text(r, 'Luật', 260)),
    briefing: { prepare: text(br.prepare, 'Lời dặn chuẩn bị', 500), lure: text(br.lure, 'Lời dặn nhử địch', 500), counter: text(br.counter, 'Lời dặn phản công', 500) },
    win_text: text(raw.win_text, 'Lời tổng kết khi thắng', 500), lose_text: text(raw.lose_text, 'Lời tổng kết khi thua', 500),
  };
}

// ---------------------------------------------------------------------- thủy triều
interface Tick { phase: 'prepare' | 'lure' | 'counter'; turn: number; level: number }
function timeline(scn: BdScenario): Tick[] {
  return (['prepare', 'lure', 'counter'] as const).flatMap((phase) => scn.tide[phase].map((level, turn) => ({ phase, turn, level })));
}
/** Tên con nước: mức lưng chừng là "đang rút" khi lượt trước cao hơn, "đang lên" khi lượt trước thấp hơn */
function tideLabel(line: Tick[], i: number): string {
  const level = line[i]?.level ?? 2;
  if (level === 2) return 'Cao';
  if (level === 0) return 'Thấp';
  return (line[i - 1]?.level ?? 2) > 1 ? 'Đang rút' : 'Đang lên';
}
function cursor(scn: BdScenario, s: BdState): number {
  const line = timeline(scn);
  const i = line.findIndex((t) => t.phase === s.phase && t.turn === s.turn);
  return i < 0 ? line.length - 1 : i;
}
export function tideOf(scn: BdScenario, s: BdState): { level: number; label: string } {
  const line = timeline(scn), i = cursor(scn, s);
  return { level: line[i].level, label: tideLabel(line, i) };
}

// ---------------------------------------------------------------------- di chuyển
const occupant = (s: BdState, x: number, y: number): BdUnit | undefined => s.order.map((id) => s.units[id]).find((u) => onBoard(u) && u.x === x && u.y === y);
const terrain = (scn: BdScenario, x: number, y: number): string => scn.grid[y][x];
const water = (scn: BdScenario, x: number, y: number): boolean => inside(x, y) && 'dsm'.includes(terrain(scn, x, y));

/** Loang theo chiều rộng từ một ô: `can` quyết định ô nào đi vào được (ô xuất phát luôn tính) */
function flood(from: XY, maxSteps: number, can: (x: number, y: number) => boolean): Map<string, { d: number; prev: string | null }> {
  const seen = new Map<string, { d: number; prev: string | null }>([[key(...from), { d: 0, prev: null }]]);
  let frontier: XY[] = [from];
  for (let d = 1; d <= maxSteps && frontier.length; d++) {
    const next: XY[] = [];
    for (const [cx, cy] of frontier) for (const [dx, dy] of DIRS) {
      const x = cx + dx, y = cy + dy, k = key(x, y);
      if (!inside(x, y) || seen.has(k) || !can(x, y)) continue;
      seen.set(k, { d, prev: key(cx, cy) });
      next.push([x, y]);
    }
    frontier = next;
  }
  return seen;
}
function pathTo(seen: Map<string, { d: number; prev: string | null }>, target: string): XY[] {
  const out: XY[] = [];
  for (let k: string | null = target; k && seen.get(k)?.prev !== null; k = seen.get(k)!.prev) out.unshift(xy(k));
  return out;
}

/** Ô thuyền ta đi vào được: không phải bờ / ghềnh, không có thuyền khác, và không có cọc khi nước đã rút (thuyền nhẹ cũng không lách qua bãi cọc đã lộ) */
function allyCan(scn: BdScenario, s: BdState, level: number): (x: number, y: number) => boolean {
  return (x, y) => water(scn, x, y) && !occupant(s, x, y) && (level === 2 || !s.stakes.includes(key(x, y)));
}
function allyMoves(scn: BdScenario, s: BdState, u: BdUnit): Map<string, { d: number; prev: string | null }> {
  return flood([u.x, u.y], u.speed, allyCan(scn, s, tideOf(scn, s).level));
}

/** Các ô thuyền nhẹ tới được trong lượt này (dùng cho kiểm thử và mô phỏng cân bằng) */
export function baitMoves(scn: BdScenario, s: BdState): XY[] {
  const bait = s.order.map((id) => s.units[id]).find((u) => u.role === 'bait')!;
  return [...allyMoves(scn, s, bait).keys()].filter((k) => k !== key(bait.x, bait.y)).map(xy);
}

// ---------------------------------------------------------------------- dựng trận
export function createBachDang(scn: BdScenario): { state: BdState; events: BdEvent[] } {
  const units: Record<string, BdUnit> = {};
  const order: string[] = [];
  const add = (u: BdUnit): void => { units[u.id] = u; order.push(u.id); };
  add({ id: scn.bait.id, side: 'ally', role: 'bait', name: scn.bait.name, x: scn.bait.at[0], y: scn.bait.at[1], hp: scn.bait.hp, maxHp: scn.bait.hp, atk: scn.bait.atk, speed: scn.bait.speed, state: 'free', chasing: false, flagship: false, key: true, fire: 0, burn: 0, acted: false, sprite: scn.bait.sprite });
  for (const f of scn.fleets) add({ id: f.id, side: 'ally', role: 'fleet', name: f.name, x: f.mouth[0], y: f.mouth[1], hp: f.hp, maxHp: f.hp, atk: f.atk, speed: f.speed, state: 'wait', chasing: false, flagship: false, key: Boolean(f.key), fire: f.fire, burn: 0, acted: false, sprite: f.sprite });
  for (const e of scn.enemies) add({ id: e.id, side: 'enemy', role: 'ship', name: e.name, x: e.at[0], y: e.at[1], hp: e.hp, maxHp: e.hp, atk: e.atk, speed: 2, state: 'wait', chasing: false, flagship: Boolean(e.flagship), key: false, fire: 0, burn: 0, acted: false, sprite: e.sprite });
  const state: BdState = { v: 1, phase: 'prepare', turn: 0, stakes: [], placed: 0, revealed: scn.tide.prepare[0] < 2, units, order, trail: [], status: 'active', reason: null, flags: { provoked: false, stranded: [], slowed: [], blocked: [], hits: 0, fire_missed: false, dealt: 0 } };
  const t = tideOf(scn, state);
  return { state, events: [{ t: 'phase', phase: 'prepare' }, { t: 'tide', level: t.level, label: t.label }] };
}

const enemiesOf = (s: BdState): BdUnit[] => s.order.map((id) => s.units[id]).filter((u) => u.side === 'enemy');
const alliesOf = (s: BdState): BdUnit[] => s.order.map((id) => s.units[id]).filter((u) => u.side === 'ally');

function finish(s: BdState, status: 'won' | 'lost', reason: string, events: BdEvent[]): void {
  if (s.status !== 'active') return;
  s.status = status;
  s.reason = reason;
  s.phase = 'done';
  events.push({ t: 'end', status, reason });
}

function checkEnd(s: BdState, events: BdEvent[]): void {
  if (s.status !== 'active') return;
  // lực lượng chủ chốt: đội thuyền nhẹ trong lúc nhử địch, cánh thủy quân chủ lực trong lúc phản công
  const lostKey = alliesOf(s).find((u) => u.key && u.state === 'sunk' && (u.role !== 'bait' || s.phase === 'lure'));
  if (lostKey) return finish(s, 'lost', lostKey.role === 'bait' ? 'bait_lost' : 'key_lost', events);
  const enemies = enemiesOf(s);
  const escaped = enemies.filter((e) => e.state === 'escaped');
  if (escaped.some((e) => e.flagship)) return finish(s, 'lost', 'flagship_escaped', events);
  if (escaped.length >= 2) return finish(s, 'lost', 'escaped', events);
  if (s.phase !== 'prepare' && !enemies.some(onBoard)) return finish(s, 'won', 'destroyed', events);
}

function hit(s: BdState, from: BdUnit, to: BdUnit, dmg: number, events: BdEvent[]): void {
  const real = Math.min(to.hp, dmg);
  to.hp -= real;
  if (to.side === 'enemy') s.flags.dealt += real;
  events.push({ t: 'attack', unit: from.id, target: to.id, dmg: real, hp: to.hp });
  if (to.hp <= 0) { to.state = 'sunk'; to.burn = 0; events.push({ t: 'sunk', unit: to.id }); }
}

// ---------------------------------------------------------------------- lượt của địch
/** Thuyền địch còn cơ động chạy ra biển theo lạch sâu; tới mép khúc sông thì lượt sau thoát hẳn. Bị chặn hết đường thì đánh thuyền đang chặn. */
function flee(scn: BdScenario, s: BdState, e: BdUnit, events: BdEvent[], attackBlocker: boolean): void {
  if (e.x === BD_W - 1) { e.state = 'escaped'; events.push({ t: 'escape', unit: e.id }); return; }
  const seen = flood([e.x, e.y], 99, (x, y) => inside(x, y) && terrain(scn, x, y) === 'd' && !occupant(s, x, y));
  let target: string | null = null, best = Infinity;
  for (const [k, v] of seen) if (xy(k)[0] === BD_W - 1 && v.d < best) { best = v.d; target = k; }
  if (target) {
    const path = pathTo(seen, target).slice(0, e.speed);
    if (path.length) { [e.x, e.y] = path[path.length - 1]; events.push({ t: 'move', unit: e.id, path }); }
    return;
  }
  if (attackBlocker) strike(s, e, e.atk, events);
}

/** Đánh thuyền ta đứng sát (kể cả chéo), ưu tiên thuyền yếu nhất */
function strike(s: BdState, e: BdUnit, dmg: number, events: BdEvent[]): boolean {
  const near = alliesOf(s).filter((a) => onBoard(a) && cheb(a.x, a.y, e.x, e.y) <= 1).sort((a, b) => a.hp - b.hp)[0];
  if (!near) return false;
  hit(s, e, near, dmg, events);
  if (near.role === 'bait') s.flags.hits += 1;
  return true;
}

/**
 * Một bước đuổi của thuyền địch đã bị khiêu chiến: đang ở trên vệt nước thì đi tới ô kế tiếp của vệt; chưa vào vệt thì theo đường ngắn nhất tới ô vệt gần nhất.
 * Đã áp sát thuyền nhẹ, hoặc ô phía trước có thuyền khác (đi nối đuôi nhau), thì dừng.
 */
function chaseStep(scn: BdScenario, s: BdState, e: BdUnit, bait: BdUnit): XY | null {
  if (cheb(e.x, e.y, bait.x, bait.y) <= 1 || !s.trail.length) return null;
  const at = s.trail.lastIndexOf(key(e.x, e.y));
  if (at >= 0) {
    const next = s.trail[at + 1];
    if (!next) return null;
    const [x, y] = xy(next);
    return occupant(s, x, y) ? null : [x, y];
  }
  // chưa vào vệt: tìm đường tới ô vệt gần nhất; ô thuyền nhẹ đang đứng vẫn tính là đích để thuyền địch áp sát ngay sau khi bị khiêu chiến
  const seen = flood([e.x, e.y], 99, (x, y) => water(scn, x, y) && (!occupant(s, x, y) || (x === bait.x && y === bait.y)));
  let target: string | null = null, best = Infinity, index = -1;
  s.trail.forEach((k, i) => { const d = seen.get(k)?.d; if (d !== undefined && d > 0 && (d < best || (d === best && i > index))) { best = d; target = k; index = i; } });
  return target ? pathTo(seen, target)[0] : null;
}

function enemyLureTurn(scn: BdScenario, s: BdState, events: BdEvent[]): void {
  const bait = alliesOf(s).find((u) => u.role === 'bait')!;
  for (const e of enemiesOf(s)) {
    if (!onBoard(e) || s.status !== 'active') continue;
    if (onBoard(bait) && cheb(e.x, e.y, bait.x, bait.y) <= 1) { strike(s, e, e.atk, events); checkEnd(s, events); continue; }
    if (!e.chasing) { flee(scn, s, e, events, false); checkEnd(s, events); continue; }
    const path: XY[] = [];
    for (let i = 0; i < e.speed; i++) { const p = chaseStep(scn, s, e, bait); if (!p) break; [e.x, e.y] = p; path.push(p); }
    if (path.length) events.push({ t: 'move', unit: e.id, path });
  }
}

function enemyCounterTurn(scn: BdScenario, s: BdState, events: BdEvent[]): void {
  for (const e of enemiesOf(s)) {
    if (!onBoard(e) || s.status !== 'active') continue;
    if (e.state === 'stuck') strike(s, e, 1, events); // thuyền vướng cọc nghiêng lệch, chỉ còn chống trả yếu ớt
    else if (e.state === 'slow') {
      // mắc cạn: lê từng ô về lạch sâu gần nhất; ra tới lạch sâu thì cơ động trở lại
      const seen = flood([e.x, e.y], 99, (x, y) => water(scn, x, y) && !occupant(s, x, y) && !s.stakes.includes(key(x, y)));
      let target: string | null = null, best = Infinity;
      for (const [k, v] of seen) { const [x, y] = xy(k); if (terrain(scn, x, y) === 'd' && v.d > 0 && v.d < best) { best = v.d; target = k; } }
      if (target) { const step = pathTo(seen, target)[0]; [e.x, e.y] = step; events.push({ t: 'move', unit: e.id, path: [step] }); if (terrain(scn, e.x, e.y) === 'd') { e.state = 'free'; events.push({ t: 'refloat', unit: e.id }); } }
      strike(s, e, Math.max(1, e.atk - 1), events);
    } else flee(scn, s, e, events, true);
    checkEnd(s, events);
  }
  if (s.status !== 'active') return;
  for (const e of enemiesOf(s)) {
    if (!onBoard(e)) continue;
    if (e.state === 'stuck' && scn.archers > 0) { const dmg = Math.min(e.hp, scn.archers); e.hp -= dmg; s.flags.dealt += dmg; events.push({ t: 'arrows', target: e.id, dmg, hp: e.hp }); }
    if (e.hp > 0 && e.burn > 0) { const dmg = Math.min(e.hp, 2); e.hp -= dmg; e.burn -= 1; s.flags.dealt += dmg; events.push({ t: 'burn', unit: e.id, dmg, hp: e.hp }); }
    if (e.hp <= 0) { e.state = 'sunk'; e.burn = 0; events.push({ t: 'sunk', unit: e.id }); }
  }
  checkEnd(s, events);
}

// ---------------------------------------------------------------------- chuyển giai đoạn
function startLure(scn: BdScenario, s: BdState, events: BdEvent[]): void {
  s.phase = 'lure';
  s.turn = 0;
  s.revealed = true;
  events.push({ t: 'phase', phase: 'lure' });
  const t = tideOf(scn, s);
  events.push({ t: 'tide', level: t.level, label: t.label });
  for (const e of enemiesOf(s)) { e.state = 'free'; events.push({ t: 'spawn', unit: e.id, at: [e.x, e.y] }); }
}

/** Nước rút: xác định thuyền địch nào vướng cọc, mắc cạn hay còn cơ động; thủy quân mai phục đổ ra từ cửa sông nhánh chưa bị cọc chắn */
function startCounter(scn: BdScenario, s: BdState, events: BdEvent[]): void {
  s.phase = 'counter';
  s.turn = 0;
  events.push({ t: 'phase', phase: 'counter' });
  const t = tideOf(scn, s);
  events.push({ t: 'tide', level: t.level, label: t.label });
  for (const e of enemiesOf(s)) {
    if (!onBoard(e)) continue;
    if (s.stakes.includes(key(e.x, e.y))) {
      const dmg = Math.min(e.hp, scn.strand_damage);
      e.hp -= dmg;
      e.state = 'stuck';
      s.flags.stranded.push(e.id);
      s.flags.dealt += dmg;
      events.push({ t: 'stuck', unit: e.id, dmg, hp: e.hp });
      if (e.hp <= 0) { e.state = 'sunk'; events.push({ t: 'sunk', unit: e.id }); }
    } else if (terrain(scn, e.x, e.y) !== 'd') { e.state = 'slow'; s.flags.slowed.push(e.id); events.push({ t: 'slow', unit: e.id }); }
  }
  for (const f of alliesOf(s).filter((u) => u.role === 'fleet')) {
    if (s.stakes.includes(key(f.x, f.y))) { f.state = 'blocked'; s.flags.blocked.push(f.id); events.push({ t: 'blocked', unit: f.id, text: `Cọc chắn cửa sông nên ${f.name} không ra trận được.` }); continue; }
    // cửa sông đang có thuyền khác thì ra ô trống gần nhất
    const seen = flood([f.x, f.y], 3, (x, y) => water(scn, x, y) && !s.stakes.includes(key(x, y)));
    const free = [...seen.entries()].filter(([k]) => !occupant(s, ...xy(k))).sort((a, b) => a[1].d - b[1].d)[0];
    if (!free) { f.state = 'blocked'; s.flags.blocked.push(f.id); events.push({ t: 'blocked', unit: f.id, text: `${f.name} bị kẹt trong cửa sông.` }); continue; }
    [f.x, f.y] = xy(free[0]);
    f.state = 'free';
    events.push({ t: 'spawn', unit: f.id, at: [f.x, f.y] });
  }
  for (const a of alliesOf(s)) a.acted = false;
  checkEnd(s, events);
}

function nextTurn(scn: BdScenario, s: BdState, events: BdEvent[]): void {
  if (s.status !== 'active') return;
  const phase = s.phase as 'prepare' | 'lure' | 'counter';
  if (s.turn + 1 >= scn.tide[phase].length) {
    if (phase === 'prepare') return startLure(scn, s, events);
    if (phase === 'lure') return startCounter(scn, s, events);
    return finish(s, 'lost', 'tide', events); // nước lên lại: thuyền địch thoát khỏi bãi cọc
  }
  s.turn += 1;
  s.placed = 0;
  const t = tideOf(scn, s);
  events.push({ t: 'tide', level: t.level, label: t.label });
  if (phase === 'prepare' && t.level < 2 && !s.revealed) { s.revealed = true; events.push({ t: 'reveal', text: 'Nước rút, bãi cạn và lạch sâu lộ rõ.' }); }
  if (phase === 'counter') for (const a of alliesOf(s)) a.acted = false;
}

// ---------------------------------------------------------------------- lệnh của người chơi
export function applyBachDang(scn: BdScenario, s: BdState, a: BdAction): BdEvent[] {
  if (s.status !== 'active') return bad('Trận đánh đã kết thúc');
  const events: BdEvent[] = [];
  const tide = tideOf(scn, s);
  if (s.phase === 'prepare') {
    if (a.type === 'wait') { nextTurn(scn, s, events); return events; }
    if (a.type === 'ready') {
      if (!s.stakes.length) return bad('Chưa có cụm cọc nào. Hãy chờ nước thấp rồi đóng cọc trên bãi cạn trước khi báo sẵn sàng.');
      startLure(scn, s, events);
      return events;
    }
    if (a.type !== 'stake' && a.type !== 'unstake') return bad('Giai đoạn chuẩn bị chỉ có: đóng cọc, nhổ cọc, chờ con nước, sẵn sàng');
    const [x, y] = cell(a.at, 'Ô đóng cọc');
    const k = key(x, y);
    if (tide.level !== 0) return bad(`Nước đang ở mức “${tide.label}”, chưa đóng hay nhổ cọc được. Hãy chờ nước thấp.`);
    if (a.type === 'unstake') {
      if (!s.stakes.includes(k)) return bad('Ô này chưa có cọc');
      s.stakes = s.stakes.filter((v) => v !== k);
      s.placed = Math.max(0, s.placed - 1);
      events.push({ t: 'unstake', at: [x, y] });
      return events;
    }
    const tr = terrain(scn, x, y);
    if (tr === 'b') return bad('Đây là bờ sông, không phải lòng sông.');
    if (tr === 'r') return bad('Ghềnh đá ngầm đã là vật cản tự nhiên, không đóng cọc ở đây.');
    if (tr === 'd') return bad('Lạch ở đây quá sâu, cọc không cắm tới đáy. Hãy chọn bãi cạn hai bên.');
    if (s.stakes.includes(k)) return bad('Ô này đã có cọc');
    if (occupant(s, x, y)) return bad('Thuyền ta đang đậu ở ô này');
    if (s.stakes.length >= scn.stakes.total) return bad(`Đã dùng hết ${scn.stakes.total} cụm cọc. Nhổ một cụm nếu muốn đổi chỗ.`);
    if (s.placed >= scn.stakes.per_turn) return bad(`Mỗi con nước thấp chỉ kịp đóng ${scn.stakes.per_turn} cụm cọc. Hãy chờ con nước sau.`);
    s.stakes.push(k);
    s.placed += 1;
    events.push({ t: 'stake', at: [x, y] });
    if (tr === 'm') events.push({ t: 'warn', at: [x, y], text: 'Đây là cửa sông nhánh nơi thủy quân mai phục sẽ đổ ra. Cọc ở đây sẽ chắn đường của chính quân ta.' });
    return events;
  }
  const bait = alliesOf(s).find((u) => u.role === 'bait')!;
  if (s.phase === 'lure') {
    if (a.type === 'provoke') {
      const near = enemiesOf(s).filter((e) => onBoard(e) && !e.chasing && manh(e.x, e.y, bait.x, bait.y) <= scn.bait.range);
      if (!near.length) return bad(enemiesOf(s).some((e) => onBoard(e) && !e.chasing) ? 'Thuyền địch còn ngoài tầm khiêu chiến. Hãy tới gần hơn.' : 'Cả đoàn thuyền địch đã đuổi theo rồi.');
      for (const e of near) e.chasing = true;
      s.flags.provoked = true;
      if (!s.trail.length) s.trail.push(key(bait.x, bait.y));
      events.push({ t: 'provoke', unit: bait.id, units: near.map((e) => e.id) });
    } else if (a.type === 'move') {
      const [x, y] = cell(a.to, 'Ô đến');
      const seen = allyMoves(scn, s, bait);
      if (!seen.has(key(x, y)) || (x === bait.x && y === bait.y)) return bad('Thuyền nhẹ không tới được ô này trong một lượt');
      const path = pathTo(seen, key(x, y));
      [bait.x, bait.y] = [x, y];
      if (s.trail.length) s.trail.push(...path.map((p) => key(...p)));
      events.push({ t: 'move', unit: bait.id, path });
    } else if (a.type !== 'wait') return bad('Giai đoạn nhử địch chỉ có: khiêu chiến, lui thuyền, chờ');
    enemyLureTurn(scn, s, events);
    checkEnd(s, events);
    nextTurn(scn, s, events);
    return events;
  }
  // phản công
  if (a.type === 'end_turn') { enemyCounterTurn(scn, s, events); nextTurn(scn, s, events); return events; }
  if (a.type !== 'order') return bad('Giai đoạn phản công: ra lệnh cho từng cánh quân hoặc kết thúc lượt');
  const u = s.units[a.unit];
  if (!u || u.side !== 'ally') return bad('Không có cánh quân này');
  if (!onBoard(u)) return bad(u.state === 'blocked' ? `${u.name} bị cọc chắn trong cửa sông, không ra trận được.` : `${u.name} không còn trên sông.`);
  if (u.acted) return bad(`${u.name} đã ra lệnh trong lượt này`);
  if (a.attack && a.fire) return bad('Mỗi lượt một cánh quân chỉ đánh hoặc thả bè lửa');
  if (a.to) {
    const [x, y] = cell(a.to, 'Ô đến');
    if (x !== u.x || y !== u.y) {
      const seen = allyMoves(scn, s, u);
      if (!seen.has(key(x, y))) return bad(`${u.name} không tới được ô này: thuyền không đi qua bãi cọc đã lộ, ghềnh đá hay thuyền khác.`);
      const path = pathTo(seen, key(x, y));
      [u.x, u.y] = [x, y];
      events.push({ t: 'move', unit: u.id, path });
    }
  }
  if (a.attack) {
    const e = s.units[a.attack];
    if (!e || e.side !== 'enemy' || !onBoard(e)) return bad('Mục tiêu không còn trên sông');
    if (cheb(u.x, u.y, e.x, e.y) > 1) return bad('Phải áp sát thuyền địch mới đánh được');
    hit(s, u, e, Math.round(u.atk * (e.state === 'stuck' ? 1.5 : 1)), events);
  } else if (a.fire) {
    const e = s.units[a.fire];
    if (u.fire <= 0) return bad(`${u.name} không còn bè lửa`);
    if (!e || e.side !== 'enemy' || !onBoard(e)) return bad('Mục tiêu không còn trên sông');
    if (manh(u.x, u.y, e.x, e.y) > 4) return bad('Thuyền địch ở quá xa, bè lửa không trôi tới');
    u.fire -= 1;
    if (e.state === 'free') { s.flags.fire_missed = true; events.push({ t: 'fire', unit: u.id, target: e.id, ok: false, text: 'Thuyền địch còn cơ động nên né được bè lửa.' }); }
    else {
      const dmg = Math.min(e.hp, 4);
      e.hp -= dmg;
      e.burn = 2;
      s.flags.dealt += dmg;
      events.push({ t: 'fire', unit: u.id, target: e.id, ok: true, dmg, hp: e.hp });
      if (e.hp <= 0) { e.state = 'sunk'; e.burn = 0; events.push({ t: 'sunk', unit: e.id }); }
    }
  }
  u.acted = true;
  checkEnd(s, events);
  if (s.status === 'active' && alliesOf(s).filter(onBoard).every((x) => x.acted)) { enemyCounterTurn(scn, s, events); nextTurn(scn, s, events); }
  return events;
}

// ---------------------------------------------------------------------- kết quả và lời giải thích
export interface BdResult { won: boolean; stars: number; score: number; stranded: number; escaped: number; mistakes: Array<{ code: string; text: string }>; good: string[] }

export function bachDangResult(_scn: BdScenario, s: BdState): BdResult {
  const won = s.status === 'won';
  const enemies = enemiesOf(s), allies = alliesOf(s);
  const escaped = enemies.filter((e) => e.state === 'escaped').length;
  const sunk = allies.filter((a) => a.state === 'sunk').length;
  const stranded = s.flags.stranded.length;
  const mistakes: BdResult['mistakes'] = [];
  const name = (id: string): string => s.units[id]?.name ?? id;
  if (s.stakes.length < 3) mistakes.push({ code: 'few_stakes', text: `Bãi cọc quá thưa (${s.stakes.length} cụm): nên tận dụng cả hai con nước thấp để đóng đủ cọc trên bãi cạn.` });
  if (s.flags.blocked.length) mistakes.push({ code: 'mouth_blocked', text: `Cọc chắn cửa sông nhánh nên ${s.flags.blocked.map(name).join(', ')} không ra trận được. Trận địa phải chừa đường cơ động cho thuyền ta.` });
  if (s.phase !== 'prepare' && !s.flags.provoked) mistakes.push({ code: 'not_provoked', text: 'Chưa khiêu chiến nên thuyền địch không đuổi theo mà cứ theo lạch sâu ra biển.' });
  if (s.reason !== 'bait_lost' && (s.phase === 'counter' || s.phase === 'done') && s.flags.provoked && stranded === 0) mistakes.push({ code: 'no_strand', text: 'Khi nước rút không thuyền địch nào nằm trên bãi cọc: thuyền địch bám theo vệt nước của thuyền nhẹ, nên phải dẫn chúng đi qua đúng bãi cọc và có mặt ở đó đúng lúc nước rút (chưa tới hoặc đã vượt qua đều hỏng).' });
  const flag = enemies.find((e) => e.flagship);
  if (flag && flag.state === 'escaped') mistakes.push({ code: 'flagship_escaped', text: `${flag.name} còn ở lạch sâu lúc nước rút nên chạy thoát ra biển. Muốn giữ chân phải kéo được thuyền chỉ huy lên bãi cạn có cọc.` });
  else if (escaped > 0) mistakes.push({ code: 'escaped', text: `${escaped} đoàn thuyền địch chạy thoát theo lạch sâu vì không vướng cọc.` });
  if (s.flags.hits >= 2) mistakes.push({ code: 'bait_hit', text: `Thuyền nhẹ đứng sát thuyền địch nên bị đánh ${s.flags.hits} lần. Nhử địch là vừa đánh vừa lui, luôn giữ khoảng cách.` });
  if (s.flags.fire_missed) mistakes.push({ code: 'fire_missed', text: 'Bè lửa thả vào thuyền còn cơ động nên bị né. Hỏa công chỉ hiệu quả khi thuyền địch đã vướng cọc hoặc mắc cạn.' });
  if (s.reason === 'tide') mistakes.push({ code: 'tide', text: 'Nước lên lại trước khi diệt xong nên thuyền địch thoát khỏi bãi cọc. Phản công phải dứt điểm trong lúc nước ròng.' });
  if (s.reason === 'bait_lost') mistakes.push({ code: 'bait_lost', text: 'Mất đội thuyền nhẹ khiêu chiến, lực lượng chủ chốt của kế nhử địch.' });
  if (s.reason === 'key_lost') mistakes.push({ code: 'key_lost', text: 'Mất cánh thủy quân chủ lực nên trận phản công tan vỡ.' });
  const good: string[] = [];
  if (stranded >= enemies.length) good.push('Cả đoàn thuyền địch vướng cọc đúng lúc nước rút.');
  else if (stranded > 0) good.push(`${stranded} đoàn thuyền địch vướng cọc khi nước rút.`);
  if (won && !s.flags.blocked.length) good.push('Các cửa sông nhánh thông suốt nên thủy quân mai phục kịp đổ ra.');
  if (won && s.flags.hits === 0) good.push('Thuyền nhẹ nhử địch mà không trúng đòn nào.');
  // ba sao khi cả đoàn thuyền địch vướng cọc đúng lúc nước rút, không để thoát thuyền nào và giữ được lực lượng
  const stars = !won ? 0 : Math.max(1, 3 - (escaped > 0 || stranded < enemies.length ? 1 : 0) - (sunk > 0 || s.flags.hits >= 2 ? 1 : 0));
  const hp = allies.filter(onBoard).reduce((n, a) => n + a.hp, 0), hpMax = allies.reduce((n, a) => n + a.maxHp, 0);
  const score = won ? 400 + stars * 100 + stranded * 50 + Math.round((hp / Math.max(1, hpMax)) * 100) : Math.min(250, stranded * 40 + s.flags.dealt * 3);
  return { won, stars, score, stranded, escaped, mistakes, good };
}

// ---------------------------------------------------------------------- phần gửi cho trình duyệt
function clone(s: BdState): BdState { return JSON.parse(JSON.stringify(s)) as BdState; }

/** Xem trước lượt đuổi của địch nếu thuyền nhẹ làm một việc: dùng để vẽ bóng mờ vị trí thuyền địch, không lộ gì ngoài luật đã công bố */
function previewLure(scn: BdScenario, s: BdState, act: BdAction): { enemies: Array<{ id: string; x: number; y: number; state: BdUnitState }>; hit: boolean } {
  const c = clone(s);
  const bait = alliesOf(c).find((u) => u.role === 'bait')!;
  if (act.type === 'provoke') { for (const e of enemiesOf(c)) if (onBoard(e) && manh(e.x, e.y, bait.x, bait.y) <= scn.bait.range) e.chasing = true; if (!c.trail.length) c.trail.push(key(bait.x, bait.y)); }
  if (act.type === 'move') { const path = pathTo(allyMoves(scn, c, bait), key(...act.to)); [bait.x, bait.y] = act.to; if (c.trail.length) c.trail.push(...path.map((p) => key(...p))); }
  const hits = c.flags.hits;
  enemyLureTurn(scn, c, []);
  return { enemies: enemiesOf(c).filter((e) => e.state !== 'wait' && e.state !== 'sunk').map((e) => ({ id: e.id, x: e.x, y: e.y, state: e.state })), hit: c.flags.hits > hits };
}

export function publicBachDang(scn: BdScenario, s: BdState): Record<string, unknown> {
  const line = timeline(scn), i = cursor(scn, s), tide = tideOf(scn, s);
  const active = s.status === 'active';
  // khi nước còn cao và chưa từng thấy nước ròng, bãi cạn và lạch sâu trông như nhau
  const cells = scn.grid.map((row) => (s.revealed ? row : row.replace(/[ds]/g, 'w')));
  const bait = alliesOf(s).find((u) => u.role === 'bait')!;
  let options: Record<string, unknown> | null = null;
  if (active && s.phase === 'prepare') {
    const can = tide.level === 0 && s.stakes.length < scn.stakes.total && s.placed < scn.stakes.per_turn;
    const stakeable: XY[] = [];
    if (can) for (let y = 0; y < BD_H; y++) for (let x = 0; x < BD_W; x++) if ('sm'.includes(terrain(scn, x, y)) && !s.stakes.includes(key(x, y)) && !occupant(s, x, y)) stakeable.push([x, y]);
    options = { can_stake: tide.level === 0, stakeable, removable: tide.level === 0 ? s.stakes.map(xy) : [], turns_left: scn.tide.prepare.length - 1 - s.turn };
  } else if (active && s.phase === 'lure') {
    const seen = allyMoves(scn, s, bait);
    const moves = [...seen.keys()].filter((k) => k !== key(bait.x, bait.y)).map((k) => ({ to: xy(k), ...previewLure(scn, s, { type: 'move', to: xy(k) }) }));
    const inRange = enemiesOf(s).filter((e) => onBoard(e) && !e.chasing && manh(e.x, e.y, bait.x, bait.y) <= scn.bait.range).map((e) => e.id);
    options = { moves, wait: previewLure(scn, s, { type: 'wait' }), provoke: inRange.length ? { units: inRange, ...previewLure(scn, s, { type: 'provoke' }) } : null, turns_left: scn.tide.lure.length - s.turn };
  } else if (active && s.phase === 'counter') {
    const foes = enemiesOf(s).filter(onBoard);
    options = {
      allies: alliesOf(s).filter((u) => onBoard(u) && !u.acted).map((u) => {
        const seen = allyMoves(scn, s, u);
        return { unit: u.id, moves: [...seen.keys()].map((k) => { const [x, y] = xy(k); return { to: [x, y], attack: foes.filter((e) => cheb(x, y, e.x, e.y) <= 1).map((e) => e.id), fire: u.fire > 0 ? foes.filter((e) => manh(x, y, e.x, e.y) <= 4).map((e) => e.id) : [] }; }) };
      }),
      turns_left: scn.tide.counter.length - s.turn,
    };
  }
  return {
    mode: 'bachdang', title: scn.title, intro: scn.intro, phase: s.phase, turn: s.turn, status: s.status, reason: s.reason, rules: scn.rules, trail: s.trail.map(xy),
    briefing: s.phase === 'done' ? null : scn.briefing[s.phase as 'prepare' | 'lure' | 'counter'],
    tide: { level: tide.level, label: tide.label, forecast: line.slice(i, i + 7).map((t, n) => ({ level: t.level, label: tideLabel(line, i + n), phase: t.phase })) },
    grid: { w: BD_W, h: BD_H, cells, revealed: s.revealed }, zone: scn.zone, stakes: s.stakes.map(xy), stakes_left: scn.stakes.total - s.stakes.length, stakes_turn_left: Math.max(0, scn.stakes.per_turn - s.placed),
    units: s.order.map((id) => s.units[id]).map((u) => ({ id: u.id, side: u.side, role: u.role, name: u.name, x: u.x, y: u.y, hp: u.hp, max_hp: u.maxHp, atk: u.atk, speed: u.speed, state: u.state, chasing: u.chasing, flagship: u.flagship, key: u.key, fire: u.fire, burn: u.burn, acted: u.acted, sprite: u.sprite })),
    options,
    result: s.status === 'active' ? null : { ...bachDangResult(scn, s), text: s.status === 'won' ? scn.win_text : scn.lose_text },
  };
}
