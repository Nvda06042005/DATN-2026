/**
 * Động cơ đánh theo lượt bằng thẻ tướng (HK.HS.131–136, HK.SYS.022). Hàm thuần: cùng trạng thái, cùng hành động và cùng hạt giống cho cùng kết quả,
 * nên máy chủ giữ trạng thái, chấm từng lượt và có thể phát lại; trình duyệt chỉ gửi hành động và vẽ lại.
 *
 *  - Mỗi vòng, các đơn vị còn sống ra đòn theo tốc độ (cao trước). Tối đa `maxTurns` vòng (mặc định 15).
 *  - Đòn thường tăng nộ; chiêu chủ động tốn nộ và có hồi chiêu; tuyệt kỹ cần nộ đầy và một câu hỏi: đúng và kịp giờ thì phát huy đủ, ngược lại yếu đi.
 *  - Địa hình lịch sử: thủy triều (cọc ngầm Bạch Đằng), thủy binh mạnh trên sông, "vườn không nhà trống" làm địch mất máu vì thiếu lương.
 *  - Chỉ huy địch báo trước chiêu lớn một lượt (vạch đỏ trên mục tiêu); phòng thủ giảm một nửa sát thương của chiêu đó.
 */
export type Branch = 'bo' | 'thuy' | 'ky';
export type Slot = 'normal' | 'active' | 'ultimate' | 'passive';
export type Target = 'enemy_one' | 'enemy_all' | 'ally_one' | 'ally_all' | 'self';
export type EffectType = 'stun' | 'shield' | 'atk_up' | 'def_up' | 'atk_down' | 'heal' | 'drain' | 'burn' | 'hunger';

export interface Effect { type: EffectType; value?: number; turns?: number }
export interface MoveDef { slot: Slot; name: string; description?: string | null; anecdote?: string | null; target: Target; power: number; effect?: Effect | null; rage_cost: number; cooldown: number; anim?: string | null }
interface ActiveEffect { type: EffectType; value: number; turns: number }

export interface Unit {
  id: string; side: 'ally' | 'enemy'; name: string; card_id?: number; code?: string; branch: Branch | null; level: number; stars?: number;
  maxHp: number; hp: number; atk: number; def: number; spd: number; rage: number; commander?: boolean; haoKhi?: boolean;
  moves: MoveDef[]; fx: ActiveEffect[]; cd: Record<string, number>; alive: boolean; guard: boolean;
}

export interface TerrainDef {
  tide?: { cycle: number }; stakes?: { pct: number }; water_bonus?: Partial<Record<Branch, number>>; hunger?: { pct: number; from_turn?: number };
}
export interface EnemyDef { name: string; branch?: Branch | null; level?: number; hp: number; atk: number; def: number; spd: number; commander?: boolean; moves?: MoveDef[] }
export interface WaveDef { label?: string; units: EnemyDef[] }
export interface TacticDef { name: string; effect: 'atk_up' | 'def_up' | 'hunger' | 'stakes' | 'heal_all' | 'stun_enemy'; value?: number; turns?: number; text?: string }
interface Telegraph { unit: string; targets: string[]; turn: number }
export interface Pending { unit: string; slot: Slot; target: string | null }
export interface LogEntry { t: number; kind: 'info' | 'hit' | 'heal' | 'effect' | 'wave' | 'alert' | 'end' | 'question'; text: string; unit?: string; target?: string; value?: number }

export interface BattleState {
  turn: number; order: string[]; cursor: number; units: Record<string, Unit>; allyIds: string[]; enemyIds: string[]; wave: number; waves: WaveDef[]; terrain: TerrainDef;
  maxTurns: number; starTurns: number; tactic: TacticDef | null; tacticUsed: boolean; telegraph: Telegraph | null; pending: Pending | null;
  status: 'active' | 'won' | 'lost'; log: LogEntry[]; rng: number; seq: number; actor: string | null; awaiting: boolean;
  stats: { dealt: number; taken: number; allyDown: number; ultimates: number; ultimatesStrong: number; byUnit: Record<string, number> };
}

export type Action = { type: 'move'; slot: 'normal' | 'active' | 'ultimate'; target?: string } | { type: 'guard' } | { type: 'tactic' } | { type: 'auto' };

// ---------------------------------------------------------------------- hằng số cân bằng
const RAGE_HIT = 15, RAGE_ATTACK = 25, RAGE_FULL = 100;
const ULT_RIGHT = 1.6, ULT_WRONG = 0.6, TELEGRAPH_POWER = 1.8, GUARD_CUT = 0.5, HAO_KHI = 1.1;
export const ACTIVE_RAGE = 40;

/** Chỉ số theo cấp và số sao: mỗi cấp +10%, mỗi sao +20% so với cấp 1, 1 sao */
export function cardStats(base: Record<string, number>, level: number, stars: number): { atk: number; def: number; hp: number; spd: number } {
  const m = (1 + 0.1 * (level - 1)) * (1 + 0.2 * (stars - 1));
  return { atk: Math.round((base.atk ?? 100) * m), def: Math.round((base.def ?? 60) * m), hp: Math.round((base.hp ?? 800) * m), spd: Math.round(base.spd ?? 10) };
}
export const power = (s: { atk: number; def: number; hp: number; spd: number }): number => Math.round(s.atk * 2 + s.def * 1.5 + s.hp / 4 + s.spd * 3);

/** Số ngẫu nhiên có hạt giống (mulberry32); trạng thái nằm trong `BattleState.rng` nên lưu và phát lại được */
function rnd(s: BattleState): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const log = (s: BattleState, kind: LogEntry['kind'], text: string, extra: Partial<LogEntry> = {}): void => {
  s.log.push({ t: s.turn, kind, text, ...extra });
  if (s.log.length > 240) s.log.splice(0, s.log.length - 240);
};
const alive = (s: BattleState, ids: string[]): Unit[] => ids.map((id) => s.units[id]).filter((u) => u.alive);
const allies = (s: BattleState): Unit[] => alive(s, s.allyIds);
const enemies = (s: BattleState): Unit[] => alive(s, s.enemyIds);
const fxValue = (u: Unit, t: EffectType): number => u.fx.filter((e) => e.type === t).reduce((n, e) => n + e.value, 0);
const has = (u: Unit, t: EffectType): boolean => u.fx.some((e) => e.type === t);
const moveOf = (u: Unit, slot: Slot): MoveDef | undefined => u.moves.find((m) => m.slot === slot);

// ---------------------------------------------------------------------- dựng trận
export function makeEnemy(def: EnemyDef, id: string): Unit {
  const moves: MoveDef[] = def.moves ?? [{ slot: 'normal', name: 'Tấn công', target: 'enemy_one', power: 1, rage_cost: 0, cooldown: 0 }];
  if (def.commander && !moves.some((m) => m.slot === 'ultimate')) moves.push({ slot: 'ultimate', name: 'Tổng công kích', target: 'enemy_all', power: 1.2, rage_cost: RAGE_FULL, cooldown: 0 });
  return { id, side: 'enemy', name: def.name, branch: def.branch ?? null, level: def.level ?? 1, maxHp: def.hp, hp: def.hp, atk: def.atk, def: def.def, spd: def.spd, rage: 0, commander: Boolean(def.commander), moves, fx: [], cd: {}, alive: true, guard: false };
}

export interface AllyInput { id: string; name: string; card_id: number; code: string; branch: Branch | null; level: number; stars: number; stats: { atk: number; def: number; hp: number; spd: number }; moves: MoveDef[]; haoKhi?: boolean }

export function createBattle(opts: { allies: AllyInput[]; waves: WaveDef[]; terrain?: TerrainDef; maxTurns?: number; starTurns?: number; tactic?: TacticDef | null; seed: number }): BattleState {
  const s: BattleState = {
    turn: 0, order: [], cursor: 0, units: {}, allyIds: [], enemyIds: [], wave: 0, waves: opts.waves, terrain: opts.terrain ?? {}, maxTurns: opts.maxTurns ?? 15, starTurns: opts.starTurns ?? 10,
    tactic: opts.tactic ?? null, tacticUsed: false, telegraph: null, pending: null, status: 'active', log: [], rng: opts.seed >>> 0, seq: 0, actor: null, awaiting: false,
    stats: { dealt: 0, taken: 0, allyDown: 0, ultimates: 0, ultimatesStrong: 0, byUnit: {} },
  };
  for (const a of opts.allies) {
    const k = a.haoKhi ? HAO_KHI : 1;
    s.units[a.id] = { id: a.id, side: 'ally', name: a.name, card_id: a.card_id, code: a.code, branch: a.branch, level: a.level, stars: a.stars, maxHp: Math.round(a.stats.hp * k), hp: Math.round(a.stats.hp * k), atk: Math.round(a.stats.atk * k), def: Math.round(a.stats.def * k), spd: a.stats.spd, rage: 0, haoKhi: Boolean(a.haoKhi), moves: a.moves, fx: [], cd: {}, alive: true, guard: false };
    s.allyIds.push(a.id);
  }
  spawnWave(s);
  // nội tại: phát huy ngay từ đầu trận
  for (const u of allies(s)) {
    const p = moveOf(u, 'passive');
    if (!p) continue;
    const targets = p.target === 'ally_all' ? allies(s) : [u];
    for (const t of targets) if (p.effect) applyEffect(s, t, { ...p.effect, turns: 99 }, u);
    log(s, 'effect', `Nội tại “${p.name}” của ${u.name} có hiệu lực.`, { unit: u.id });
  }
  if (!s.tactic) s.tacticUsed = true;
  startRound(s);
  return s;
}

function spawnWave(s: BattleState): void {
  const w = s.waves[s.wave];
  w.units.forEach((def, i) => {
    const id = `e${s.wave + 1}-${i + 1}`;
    s.units[id] = makeEnemy(def, id);
    s.enemyIds.push(id);
  });
  log(s, 'wave', s.waves.length > 1 ? `Đợt quân ${s.wave + 1}/${s.waves.length}${w.label ? `: ${w.label}` : ''} xuất hiện.` : `${w.label ?? 'Quân địch'} xuất hiện.`);
}

// ---------------------------------------------------------------------- hiệu ứng, sát thương
function applyEffect(s: BattleState, target: Unit, e: Effect, caster: Unit): void {
  const turns = e.turns ?? 2;
  let value = e.value ?? 0;
  if (e.type === 'stun') target.fx.push({ type: 'stun', value: 0, turns });
  else if (e.type === 'shield') { value = Math.round(value * caster.atk); target.fx.push({ type: 'shield', value, turns }); }
  else if (e.type === 'heal') { const n = Math.round(value * target.maxHp); target.hp = Math.min(target.maxHp, target.hp + n); log(s, 'heal', `${target.name} hồi ${n} máu.`, { target: target.id, value: n }); return; }
  else if (e.type === 'drain') return; // hút máu tính ở nơi gây sát thương
  else target.fx.push({ type: e.type, value, turns });
  log(s, 'effect', `${target.name} chịu hiệu ứng ${effectText(e.type)} (${turns} lượt).`, { target: target.id });
}
const effectText = (t: EffectType): string => ({ stun: 'choáng', shield: 'khiên', atk_up: 'tăng công', def_up: 'tăng thủ', atk_down: 'giảm công', heal: 'trị liệu', drain: 'hút máu', burn: 'bỏng cháy', hunger: 'thiếu lương' }[t]);

function tideState(s: BattleState): 'high' | 'low' | null {
  const c = s.terrain.tide?.cycle;
  if (!c) return null;
  return ((s.turn - 1) % c) < c / 2 ? 'high' : 'low';
}

function hurt(s: BattleState, target: Unit, amount: number, by: Unit | null, kind: LogEntry['kind'] = 'hit', text?: string): number {
  let dmg = Math.max(1, Math.round(amount));
  const sh = target.fx.find((e) => e.type === 'shield' && e.value > 0);
  if (sh) { const used = Math.min(sh.value, dmg); sh.value -= used; dmg -= used; }
  target.hp = Math.max(0, target.hp - dmg);
  if (dmg > 0) log(s, kind, text ?? `${by ? `${by.name} → ` : ''}${target.name}: -${dmg}`, { unit: by?.id, target: target.id, value: dmg });
  if (by) { if (by.side === 'ally') { s.stats.dealt += dmg; s.stats.byUnit[by.id] = (s.stats.byUnit[by.id] ?? 0) + dmg; } else s.stats.taken += dmg; }
  if (target.side === 'ally') target.rage = Math.min(RAGE_FULL, target.rage + RAGE_HIT);
  if (target.hp <= 0 && target.alive) {
    target.alive = false;
    log(s, 'info', `${target.name} ngã xuống.`, { target: target.id });
    if (target.side === 'ally') s.stats.allyDown += 1;
    if (s.telegraph?.unit === target.id) { s.telegraph = null; log(s, 'alert', 'Chiêu lớn bị hủy vì chỉ huy địch đã gục.'); }
  }
  return dmg;
}

function damageOf(s: BattleState, from: Unit, to: Unit, powerMult: number): number {
  const atk = from.atk * (1 + fxValue(from, 'atk_up') - fxValue(from, 'atk_down'));
  const def = to.def * (1 + fxValue(to, 'def_up'));
  const water = from.branch ? 1 + (s.terrain.water_bonus?.[from.branch] ?? 0) : 1;
  const variation = 0.9 + rnd(s) * 0.2;
  let dmg = atk * powerMult * (100 / (100 + def)) * water * variation;
  if (to.guard) dmg *= GUARD_CUT;
  return dmg;
}

// ---------------------------------------------------------------------- vòng và lượt
function startRound(s: BattleState): void {
  s.turn += 1;
  if (s.turn > s.maxTurns) { s.status = 'lost'; log(s, 'end', 'Hết số lượt mà quân địch chưa bị đánh bại.'); return; }
  const tide = tideState(s);
  if (s.terrain.tide) log(s, 'info', `Vòng ${s.turn}: nước triều ${tide === 'high' ? 'lên' : 'rút'}.`);
  if (tide === 'low' && s.terrain.stakes) {
    for (const e of enemies(s)) if (e.branch === 'thuy') { hurt(s, e, e.maxHp * s.terrain.stakes.pct, null, 'hit', `Bãi cọc ngầm làm thuyền ${e.name} va vỡ: -${Math.round(e.maxHp * s.terrain.stakes.pct)}`); }
  }
  const h = s.terrain.hunger;
  if (h && s.turn >= (h.from_turn ?? 3)) {
    for (const e of enemies(s)) hurt(s, e, e.maxHp * h.pct, null, 'hit', `Thiếu lương, ${e.name} yếu đi: -${Math.round(e.maxHp * h.pct)}`);
  }
  checkEnd(s);
  if (s.status !== 'active') return;
  const live = [...allies(s), ...enemies(s)];
  live.sort((a, b) => b.spd - a.spd || (a.side === b.side ? a.id.localeCompare(b.id) : a.side === 'ally' ? -1 : 1));
  s.order = live.map((u) => u.id);
  s.cursor = 0;
}

function checkEnd(s: BattleState): void {
  if (s.status !== 'active') return;
  if (!allies(s).length) { s.status = 'lost'; log(s, 'end', 'Toàn bộ tướng sĩ đã ngã xuống.'); return; }
  if (!enemies(s).length) {
    if (s.wave + 1 < s.waves.length) { s.wave += 1; const before = new Set(s.enemyIds); spawnWave(s); s.order = [...s.order, ...s.enemyIds.filter((id) => !before.has(id))]; return; }
    s.status = 'won';
    log(s, 'end', 'Quân địch đã bị đánh bại!');
  }
}

/** Chọn người ra đòn kế tiếp; xử lý hiệu ứng đầu lượt (bỏng, thiếu lương, choáng). Trả null khi đang chờ người chơi hoặc trận đã kết thúc. */
function nextActor(s: BattleState): Unit | null {
  while (s.status === 'active') {
    if (s.cursor >= s.order.length) { startRound(s); continue; }
    const u = s.units[s.order[s.cursor]];
    s.cursor += 1;
    if (!u.alive) continue;
    // đầu lượt
    u.guard = false;
    for (const k of Object.keys(u.cd)) if (u.cd[k] > 0) u.cd[k] -= 1;
    for (const e of u.fx.filter((x) => x.type === 'burn' || x.type === 'hunger')) { hurt(s, u, u.maxHp * e.value, null, 'hit', `${u.name} chịu ${effectText(e.type)}: -${Math.round(u.maxHp * e.value)}`); }
    checkEnd(s);
    if (s.status !== 'active') return null;
    if (!u.alive) continue;
    if (has(u, 'stun')) { log(s, 'effect', `${u.name} đang choáng nên mất lượt.`, { unit: u.id }); endTurn(s, u); continue; }
    return u;
  }
  return null;
}

function endTurn(s: BattleState, u: Unit): void {
  for (const e of u.fx) e.turns -= 1;
  u.fx = u.fx.filter((e) => e.turns > 0 && !(e.type === 'shield' && e.value <= 0));
  s.actor = null; s.awaiting = false;
  checkEnd(s);
}

// ---------------------------------------------------------------------- ra đòn
function pickTargets(s: BattleState, caster: Unit, m: MoveDef, chosen?: string | null): Unit[] {
  const foes = caster.side === 'ally' ? enemies(s) : allies(s);
  const friends = caster.side === 'ally' ? allies(s) : enemies(s);
  switch (m.target) {
    case 'enemy_all': return foes;
    case 'ally_all': return friends;
    case 'self': return [caster];
    case 'ally_one': return [friends.find((u) => u.id === chosen) ?? [...friends].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]];
    default: return [foes.find((u) => u.id === chosen) ?? [...foes].sort((a, b) => a.hp - b.hp)[0]].filter(Boolean);
  }
}

function perform(s: BattleState, caster: Unit, m: MoveDef, chosen: string | null, mult: number): void {
  const targets = pickTargets(s, caster, m, chosen);
  if (m.slot !== 'normal') log(s, 'info', `${caster.name} tung ${m.slot === 'ultimate' ? 'tuyệt kỹ' : 'chiêu'} “${m.name}”.`, { unit: caster.id });
  const offensive = m.target === 'enemy_one' || m.target === 'enemy_all';
  for (const t of targets) {
    if (!t?.alive) continue;
    if (offensive && m.power > 0) {
      const dealt = hurt(s, t, damageOf(s, caster, t, m.power * mult), caster);
      if (m.effect?.type === 'drain') { const back = Math.round(dealt * (m.effect.value ?? 0.3)); caster.hp = Math.min(caster.maxHp, caster.hp + back); if (back) log(s, 'heal', `${caster.name} hút ${back} máu.`, { target: caster.id, value: back }); }
      if (m.effect && m.effect.type !== 'drain' && t.alive) applyEffect(s, t, m.effect, caster);
    } else if (!offensive) {
      if (m.power > 0 && !m.effect) { const n = Math.round(caster.atk * m.power * mult); t.hp = Math.min(t.maxHp, t.hp + n); log(s, 'heal', `${t.name} hồi ${n} máu.`, { target: t.id, value: n }); }
      if (m.effect) applyEffect(s, t, m.effect, caster);
    }
  }
  caster.rage = m.slot === 'ultimate' ? 0 : Math.min(RAGE_FULL, caster.rage + (m.slot === 'normal' ? RAGE_ATTACK : 10));
  if (m.slot === 'active') caster.rage = Math.max(0, caster.rage - (m.rage_cost || ACTIVE_RAGE));
  if (m.cooldown) caster.cd[m.slot] = m.cooldown;
}

function canUse(u: Unit, slot: 'normal' | 'active' | 'ultimate'): boolean {
  const m = moveOf(u, slot);
  if (!m) return false;
  if (slot === 'ultimate') return u.rage >= RAGE_FULL;
  if (slot === 'active') return u.rage >= (m.rage_cost || ACTIVE_RAGE) && !(u.cd.active > 0);
  return true;
}

export function available(u: Unit): Array<'normal' | 'active' | 'ultimate'> {
  return (['normal', 'active', 'ultimate'] as const).filter((slot) => canUse(u, slot));
}

function enemyAct(s: BattleState, u: Unit): void {
  // chiêu lớn đã báo trước: ra đòn ở lượt này
  if (s.telegraph?.unit === u.id) {
    const m = moveOf(u, 'ultimate')!;
    const targets = s.telegraph.targets.map((id) => s.units[id]).filter((t) => t?.alive);
    log(s, 'alert', `${u.name} tung chiêu lớn “${m.name}”!`, { unit: u.id });
    for (const t of targets) hurt(s, t, damageOf(s, u, t, Math.max(m.power, 1) * TELEGRAPH_POWER), u);
    u.rage = 0;
    s.telegraph = null;
    return;
  }
  const foes = allies(s);
  if (!foes.length) return;
  const ult = moveOf(u, 'ultimate');
  if (u.commander && ult && u.rage >= RAGE_FULL && !s.telegraph) {
    const targets = [...foes].sort((a, b) => a.def - b.def).slice(0, ult.target === 'enemy_all' ? foes.length : Math.min(2, foes.length));
    s.telegraph = { unit: u.id, targets: targets.map((t) => t.id), turn: s.turn };
    log(s, 'alert', `${u.name} chuẩn bị chiêu lớn “${ult.name}”, nhắm vào ${targets.map((t) => t.name).join(', ')}. Hãy phòng thủ hoặc trị liệu!`, { unit: u.id });
  }
  const act = moveOf(u, 'active');
  const useActive = act && u.rage >= (act.rage_cost || ACTIVE_RAGE) && !(u.cd.active > 0) && rnd(s) < 0.5;
  const m = useActive ? act! : moveOf(u, 'normal') ?? u.moves[0];
  perform(s, u, m, null, 1);
}

function allyAct(s: BattleState, u: Unit, a: Action): boolean {
  if (a.type === 'guard') { u.guard = true; u.rage = Math.min(RAGE_FULL, u.rage + 10); log(s, 'info', `${u.name} phòng thủ, giảm một nửa sát thương nhận vào.`, { unit: u.id }); return true; }
  if (a.type === 'auto') return allyAct(s, u, autoAction(s, u));
  if (a.type !== 'move') return false;
  if (!canUse(u, a.slot)) return false;
  const m = moveOf(u, a.slot)!;
  if (a.slot === 'ultimate') {
    s.pending = { unit: u.id, slot: 'ultimate', target: a.target ?? null };
    log(s, 'question', `${u.name} dồn sức cho tuyệt kỹ “${m.name}”: hãy trả lời câu hỏi để phát huy tối đa.`, { unit: u.id });
    return true;
  }
  perform(s, u, m, a.target ?? null, 1);
  return true;
}

/** Dùng thẻ chiến thuật một lần mỗi trận (không mất lượt) */
function useTactic(s: BattleState): boolean {
  const t = s.tactic;
  if (!t || s.tacticUsed || s.status !== 'active') return false;
  s.tacticUsed = true;
  log(s, 'info', `Thẻ chiến thuật “${t.name}”${t.text ? `: ${t.text}` : ''}`);
  const v = t.value ?? 0.2, turns = t.turns ?? 3;
  const caster = allies(s)[0];
  if (t.effect === 'atk_up') for (const u of allies(s)) u.fx.push({ type: 'atk_up', value: v, turns });
  else if (t.effect === 'def_up') for (const u of allies(s)) u.fx.push({ type: 'def_up', value: v, turns });
  else if (t.effect === 'heal_all') for (const u of allies(s)) applyEffect(s, u, { type: 'heal', value: v }, caster);
  else if (t.effect === 'hunger') for (const e of enemies(s)) e.fx.push({ type: 'hunger', value: v, turns });
  else if (t.effect === 'stun_enemy') for (const e of enemies(s)) e.fx.push({ type: 'stun', value: 0, turns: 1 });
  else if (t.effect === 'stakes') for (const e of enemies(s)) if (e.branch === 'thuy') hurt(s, e, e.maxHp * v, null, 'hit', `Cọc nhọn làm thuyền ${e.name} hư hại: -${Math.round(e.maxHp * v)}`);
  checkEnd(s);
  return true;
}

// ---------------------------------------------------------------------- điều khiển từ máy chủ
/** Chạy tới khi cần người chơi chọn (hoặc trả lời câu hỏi) hoặc trận kết thúc */
export function advance(s: BattleState, action: Action | null = null): { ok: boolean; reason?: string } {
  if (s.status !== 'active') return { ok: false, reason: 'Trận đánh đã kết thúc' };
  if (s.pending) return { ok: false, reason: 'Hãy trả lời câu hỏi tuyệt kỹ trước' };
  if (action?.type === 'tactic') return useTactic(s) ? { ok: true } : { ok: false, reason: 'Không dùng được thẻ chiến thuật' };
  let act = action;
  for (let guard = 0; guard < 400 && s.status === 'active' && !s.pending; guard += 1) {
    if (!s.awaiting) {
      const u = nextActor(s);
      if (!u) break;
      s.actor = u.id;
      if (u.side === 'enemy') { enemyAct(s, u); endTurn(s, u); continue; }
      s.awaiting = true;
    }
    if (!act) return { ok: true };
    const u = s.units[s.actor!];
    if (!allyAct(s, u, act)) return { ok: false, reason: 'Hành động không hợp lệ (chưa đủ nộ hoặc chiêu đang hồi)' };
    act = null;
    if (s.pending) return { ok: true };
    endTurn(s, u);
  }
  return { ok: true };
}

/** Kết quả trả lời câu hỏi tuyệt kỹ: đúng và kịp giờ thì ×1,6, ngược lại ×0,6 */
export function resolveUltimate(s: BattleState, outcome: { correct: boolean; inTime: boolean }): void {
  if (!s.pending) return;
  const u = s.units[s.pending.unit];
  const m = moveOf(u, 'ultimate')!;
  const strong = outcome.correct && outcome.inTime;
  s.stats.ultimates += 1;
  if (strong) s.stats.ultimatesStrong += 1;
  log(s, 'info', strong ? 'Trả lời chính xác, tuyệt kỹ phát huy tối đa!' : outcome.correct ? 'Trả lời đúng nhưng quá giờ, tuyệt kỹ yếu đi.' : 'Trả lời chưa đúng, tuyệt kỹ yếu đi.');
  const target = s.pending.target;
  s.pending = null;
  perform(s, u, m, target, strong ? ULT_RIGHT : ULT_WRONG);
  endTurn(s, u);
  checkEnd(s);
}

// ---------------------------------------------------------------------- tự động đánh
export function autoAction(s: BattleState, u: Unit): Action {
  const foes = enemies(s);
  const weakestFoe = [...foes].sort((a, b) => a.hp - b.hp)[0];
  const hurtAlly = [...allies(s)].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  if (canUse(u, 'ultimate') && moveOf(u, 'ultimate')!.target.startsWith('enemy')) return { type: 'move', slot: 'ultimate', target: weakestFoe?.id };
  if (canUse(u, 'active')) {
    const m = moveOf(u, 'active')!;
    if (m.target.startsWith('ally') || m.target === 'self') { if (hurtAlly && hurtAlly.hp / hurtAlly.maxHp < 0.6) return { type: 'move', slot: 'active', target: hurtAlly.id }; }
    else return { type: 'move', slot: 'active', target: weakestFoe?.id };
  }
  // chiêu lớn của địch sắp tới: phòng thủ nếu đang bị nhắm và còn ít máu
  if (s.telegraph?.targets.includes(u.id) && u.hp / u.maxHp < 0.5) return { type: 'guard' };
  return { type: 'move', slot: 'normal', target: weakestFoe?.id };
}

/** Máy tự đánh hết trận (cân bằng chỉ số, kiểm thử): tuyệt kỹ trả lời đúng với xác suất `answerRate` */
export function autoPlay(s: BattleState, answerRate = 0.7): BattleState {
  if (s.tactic && !s.tacticUsed) advance(s, { type: 'tactic' });
  for (let guard = 0; guard < 800 && s.status === 'active'; guard += 1) {
    if (s.pending) { resolveUltimate(s, { correct: rnd(s) < answerRate, inTime: true }); advance(s, null); continue; }
    const r = advance(s, { type: 'auto' });
    if (!r.ok) break;
  }
  return s;
}

export function starsOf(s: BattleState): number {
  if (s.status !== 'won') return 0;
  return 1 + (s.stats.allyDown === 0 ? 1 : 0) + (s.turn <= s.starTurns ? 1 : 0);
}

// ---------------------------------------------------------------------- dữ liệu gửi cho trình duyệt
export function publicView(s: BattleState): Record<string, unknown> {
  const unit = (u: Unit) => ({
    id: u.id, side: u.side, name: u.name, card_id: u.card_id ?? null, branch: u.branch, level: u.level, hp: u.hp, max_hp: u.maxHp, rage: u.rage, alive: u.alive, commander: Boolean(u.commander),
    hao_khi: Boolean(u.haoKhi), guard: u.guard, effects: u.fx.map((e) => ({ type: e.type, turns: e.turns })), atk: u.atk, def: u.def, spd: u.spd,
    moves: u.moves.map((m) => ({ slot: m.slot, name: m.name, description: m.description ?? null, target: m.target, rage_cost: m.slot === 'ultimate' ? RAGE_FULL : m.slot === 'active' ? (m.rage_cost || ACTIVE_RAGE) : 0, cooldown_left: u.cd[m.slot] ?? 0 })),
  });
  const actor = s.actor ? s.units[s.actor] : null;
  const next = s.order.slice(s.cursor).map((id) => s.units[id]).filter((u) => u.alive).slice(0, 10).map((u) => u.id);
  return {
    status: s.status, turn: Math.min(s.turn, s.maxTurns), max_turns: s.maxTurns, star_turns: s.starTurns, wave: s.wave + 1, waves: s.waves.length,
    units: Object.values(s.units).map(unit), order: s.actor && s.awaiting ? [s.actor, ...next.filter((id) => id !== s.actor)] : next,
    actor: actor && s.awaiting ? actor.id : null, available: actor && s.awaiting && actor.side === 'ally' ? available(actor) : [],
    tide: tideState(s), terrain: { tide: Boolean(s.terrain.tide), stakes: Boolean(s.terrain.stakes), hunger: Boolean(s.terrain.hunger), water_bonus: s.terrain.water_bonus ?? null },
    telegraph: s.telegraph ? { unit: s.telegraph.unit, targets: s.telegraph.targets } : null,
    tactic: s.tactic ? { name: s.tactic.name, text: s.tactic.text ?? null, used: s.tacticUsed } : null,
    pending: s.pending ? { unit: s.pending.unit } : null, log: s.log.slice(-60),
    stats: { dealt: s.stats.dealt, ally_down: s.stats.allyDown },
  };
}
