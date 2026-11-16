/**
 * Nhập vai khám phá và ghi nhớ (hàm thuần): một cảnh làng / doanh trại / bến sông có người, vật và vùng kích hoạt; nhiệm vụ là chuỗi bước.
 *   talk   – gặp một người, nghe lời dặn hoặc quân lệnh (có thể là manh mối cần nhớ)
 *   find   – tìm đúng người theo mô tả (hỏi nhầm người tính một lần sai)
 *   pickup – nhặt một vật
 *   give   – mang vật tới đúng người
 *   ask    – nhắc lại quân lệnh / kế hoạch đã nghe: chọn phương án, máy chủ kiểm tra
 *   zone   – đi tới một vùng
 *   battle – chạm vùng địch: mở trận đánh, thắng mới qua bước; sau trận quay về đúng cảnh và bước đang làm
 * Trình duyệt tự lo di chuyển và va chạm; máy chủ giữ bước hiện tại, túi đồ, số lần xem lại manh mối và số lần sai, và chỉ cho qua khi đủ điều kiện.
 * Người chơi và nhân vật phụ có thể là hư cấu (ghi rõ `fictional`); lời giải thích lịch sử lấy từ nội dung đã duyệt của chặng.
 */
import { BadRequestException } from '@nestjs/common';

export const SCENES = ['village', 'camp', 'riverside', 'palace', 'shipyard'] as const;
export type SceneKind = (typeof SCENES)[number];

export interface Npc { id: string; name: string; role: string; sprite: string; at: [number, number]; idle: string; fictional: boolean }
export interface Prop { id: string; name: string; sprite: string; at: [number, number] }
export interface Zone { id: string; name: string; rect: [number, number, number, number]; kind: 'enemy' | 'goal' | 'info' }
interface StepBase { id: string; goal: string; clue?: string }
export type ExploreStep =
  | (StepBase & { type: 'talk'; npc: string; lines: string[] })
  | (StepBase & { type: 'find'; npc: string; lines: string[]; wrong: string })
  | (StepBase & { type: 'pickup'; item: string })
  | (StepBase & { type: 'give'; npc: string; item: string; lines: string[] })
  | (StepBase & { type: 'ask'; npc: string; prompt: string; options: Array<{ id: string; text: string }>; correct: string; right: string; wrong: string })
  | (StepBase & { type: 'zone'; zone: string })
  | (StepBase & { type: 'battle'; zone: string });

export interface ExploreScript {
  scene: SceneKind; title: string; intro: string;
  /** Bản đồ ô vuông: mỗi dòng một chuỗi ký tự (xem bảng ký hiệu ở frontend/game) */
  grid: string[];
  spawn: [number, number];
  npcs: Npc[]; items: Prop[]; zones: Zone[]; steps: ExploreStep[];
}

export interface ExploreState { v: 1; step: number; inventory: string[]; hints: number; mistakes: number; asking: boolean; done: boolean }
export type ExploreAction = { type: 'interact'; target: string } | { type: 'answer'; choice: string } | { type: 'hint' };
export interface ExploreEvent { t: 'say' | 'got' | 'gave' | 'ask' | 'right' | 'wrong' | 'step' | 'battle' | 'clue' | 'done'; who?: string; lines?: string[]; item?: string; prompt?: string; options?: Array<{ id: string; text: string }>; text?: string }

const bad = (m: string): never => { throw new BadRequestException(m); };
const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const ID = /^[a-z0-9_]{1,24}$/;
const text = (v: unknown, label: string, max: number): string => {
  if (typeof v !== 'string' || !v.trim()) return bad(`${label} không được để trống`);
  return v.trim().length > max ? bad(`${label} tối đa ${max} ký tự`) : v.trim();
};
const lines = (v: unknown, label: string): string[] => (Array.isArray(v) && v.length >= 1 && v.length <= 6 ? v.map((x, i) => text(x, `${label} (câu ${i + 1})`, 320)) : bad(`${label}: cần 1–6 câu thoại`));

/** Ô đi được trên bản đồ ký tự: cỏ, đường, sàn, cát, cầu; còn lại (nước, cây, nhà, rào…) là vật cản */
export const WALKABLE = '.,=_:+';
export const GRID_W = 22;
export const GRID_H = 13;

/** Kiểm tra kịch bản khám phá: bản đồ đúng kích thước, người/vật/vùng nằm trong bản đồ, mọi bước trỏ tới đối tượng có thật và tới được */
export function normalizeExplore(raw: unknown): ExploreScript {
  if (!isObj(raw)) return bad('Kịch bản khám phá không hợp lệ');
  const scene = (SCENES as readonly string[]).includes(raw.scene) ? (raw.scene as SceneKind) : bad('Loại cảnh không hợp lệ');
  if (!Array.isArray(raw.grid) || raw.grid.length !== GRID_H || raw.grid.some((r) => typeof r !== 'string' || r.length !== GRID_W)) return bad(`Bản đồ cảnh phải gồm ${GRID_H} dòng, mỗi dòng ${GRID_W} ký tự`);
  const grid = raw.grid as string[];
  const inside = (p: unknown, label: string): [number, number] => {
    if (!Array.isArray(p) || p.length !== 2 || !Number.isInteger(p[0]) || !Number.isInteger(p[1]) || p[0] < 0 || p[0] >= GRID_W || p[1] < 0 || p[1] >= GRID_H) return bad(`${label}: vị trí ngoài bản đồ`);
    return [p[0], p[1]];
  };
  const walk = (p: [number, number]): boolean => WALKABLE.includes(grid[p[1]][p[0]]);
  const spawn = inside(raw.spawn, 'Điểm xuất phát');
  if (!walk(spawn)) bad('Điểm xuất phát phải là ô đi được');
  const seen = new Set<string>();
  const uid = (v: unknown, label: string): string => {
    if (typeof v !== 'string' || !ID.test(v)) return bad(`${label}: mã không hợp lệ`);
    if (seen.has(v)) return bad(`${label}: mã "${v}" bị trùng`);
    seen.add(v);
    return v;
  };
  const npcs: Npc[] = (Array.isArray(raw.npcs) ? raw.npcs : bad('Thiếu danh sách nhân vật')).map((n: any) => ({
    id: uid(n.id, 'Nhân vật'), name: text(n.name, 'Tên nhân vật', 40), role: text(n.role, 'Vai trò', 60), sprite: text(n.sprite, 'Hình nhân vật', 20), at: inside(n.at, `Nhân vật ${n.id}`), idle: text(n.idle, 'Câu chào', 200), fictional: n.fictional !== false,
  }));
  const items: Prop[] = (Array.isArray(raw.items) ? raw.items : []).map((n: any) => ({ id: uid(n.id, 'Vật phẩm'), name: text(n.name, 'Tên vật phẩm', 40), sprite: text(n.sprite, 'Hình vật phẩm', 20), at: inside(n.at, `Vật phẩm ${n.id}`) }));
  const zones: Zone[] = (Array.isArray(raw.zones) ? raw.zones : []).map((z: any) => {
    const r = z.rect;
    if (!Array.isArray(r) || r.length !== 4 || r.some((n: unknown) => !Number.isInteger(n)) || r[0] < 0 || r[1] < 0 || r[2] < 1 || r[3] < 1 || r[0] + r[2] > GRID_W || r[1] + r[3] > GRID_H) bad(`Vùng ${z.id}: phạm vi ngoài bản đồ`);
    return { id: uid(z.id, 'Vùng'), name: text(z.name, 'Tên vùng', 40), rect: r as [number, number, number, number], kind: ['enemy', 'goal', 'info'].includes(z.kind) ? z.kind : 'info' };
  });
  // người và vật đứng trên ô nào thì ô đó thành vật cản; phải có ít nhất một ô đi được ngay cạnh để tương tác
  const near = (p: [number, number]): boolean => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => { const x = p[0] + dx, y = p[1] + dy; return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H && WALKABLE.includes(grid[y][x]); });
  for (const o of [...npcs, ...items]) if (!near(o.at)) bad(`"${o.name}" bị bao kín, người chơi không tới được`);
  const steps: ExploreStep[] = (Array.isArray(raw.steps) && raw.steps.length >= 2 && raw.steps.length <= 12 ? raw.steps : bad('Nhiệm vụ cần từ 2 đến 12 bước')).map((s: any, i: number): ExploreStep => {
    const base = { id: typeof s.id === 'string' && ID.test(s.id) ? s.id : `s${i + 1}`, goal: text(s.goal, `Bước ${i + 1}: mục tiêu`, 200), ...(s.clue ? { clue: text(s.clue, `Bước ${i + 1}: manh mối`, 320) } : {}) };
    const npc = (): string => (npcs.some((n) => n.id === s.npc) ? s.npc : bad(`Bước ${i + 1}: không có nhân vật "${s.npc}"`));
    const item = (): string => (items.some((n) => n.id === s.item) ? s.item : bad(`Bước ${i + 1}: không có vật phẩm "${s.item}"`));
    const zone = (): string => (zones.some((n) => n.id === s.zone) ? s.zone : bad(`Bước ${i + 1}: không có vùng "${s.zone}"`));
    switch (s.type) {
      case 'talk': return { ...base, type: 'talk', npc: npc(), lines: lines(s.lines, `Bước ${i + 1}`) };
      case 'find': return { ...base, type: 'find', npc: npc(), lines: lines(s.lines, `Bước ${i + 1}`), wrong: text(s.wrong, `Bước ${i + 1}: lời đáp khi nhầm người`, 200) };
      case 'pickup': return { ...base, type: 'pickup', item: item() };
      case 'give': return { ...base, type: 'give', npc: npc(), item: item(), lines: lines(s.lines, `Bước ${i + 1}`) };
      case 'ask': {
        const options = (Array.isArray(s.options) && s.options.length >= 2 && s.options.length <= 4 ? s.options : bad(`Bước ${i + 1}: cần 2–4 phương án`)).map((o: any) => ({ id: String(o.id), text: text(o.text, 'Phương án', 200) }));
        if (!options.some((o: { id: string }) => o.id === s.correct)) bad(`Bước ${i + 1}: đáp án đúng phải nằm trong các phương án`);
        return { ...base, type: 'ask', npc: npc(), prompt: text(s.prompt, `Bước ${i + 1}: câu hỏi`, 300), options, correct: String(s.correct), right: text(s.right, 'Lời đáp khi đúng', 320), wrong: text(s.wrong, 'Lời đáp khi sai', 320) };
      }
      case 'zone': return { ...base, type: 'zone', zone: zone() };
      case 'battle': return { ...base, type: 'battle', zone: zone() };
      default: return bad(`Bước ${i + 1}: loại bước không hợp lệ`);
    }
  });
  if (steps.filter((s) => s.type === 'battle').length > 1) bad('Mỗi cảnh chỉ có tối đa một trận đánh');
  for (const [i, s] of steps.entries()) if (s.type === 'give' && !steps.slice(0, i).some((p) => p.type === 'pickup' && p.item === s.item)) bad(`Bước ${i + 1}: phải nhặt "${s.item}" ở một bước trước`);
  return { scene, title: text(raw.title, 'Tên cảnh', 80), intro: text(raw.intro, 'Lời dẫn', 400), grid, spawn, npcs, items, zones, steps };
}

export const newExplore = (): ExploreState => ({ v: 1, step: 0, inventory: [], hints: 0, mistakes: 0, asking: false, done: false });

/** Đối tượng người chơi cần tới ở bước hiện tại (để vẽ dấu chỉ đường); nhiệm vụ "tìm đúng người" không chỉ sẵn */
export function markerOf(step: ExploreStep | undefined): string | null {
  if (!step) return null;
  switch (step.type) {
    case 'talk': case 'give': case 'ask': return `npc:${step.npc}`;
    case 'pickup': return `item:${step.item}`;
    case 'zone': case 'battle': return `zone:${step.zone}`;
    default: return null;
  }
}

/** Phần gửi cho trình duyệt: cảnh, người, vật, vùng và mục tiêu của bước đang làm; không có đáp án và không lộ các bước sau */
export function publicExplore(script: ExploreScript, s: ExploreState): Record<string, unknown> {
  const step = script.steps[s.step];
  const taken = new Set(script.steps.slice(0, s.step).filter((p): p is Extract<ExploreStep, { type: 'pickup' }> => p.type === 'pickup').map((p) => p.item));
  return {
    scene: script.scene, title: script.title, intro: script.intro, grid: script.grid, spawn: script.spawn,
    npcs: script.npcs.map((n) => ({ id: n.id, name: n.name, role: n.role, sprite: n.sprite, at: n.at, fictional: n.fictional })),
    items: script.items.filter((i) => !taken.has(i.id)).map((i) => ({ id: i.id, name: i.name, sprite: i.sprite, at: i.at })),
    zones: script.zones,
    progress: { step: s.step, total: script.steps.length, done: s.done, hints: s.hints, mistakes: s.mistakes, inventory: s.inventory.map((id) => ({ id, name: script.items.find((i) => i.id === id)?.name ?? id })) },
    current: step ? { id: step.id, type: step.type, goal: step.goal, marker: markerOf(step), has_clue: Boolean(clueOf(script, s.step)), asking: s.asking && step.type === 'ask' ? { prompt: step.prompt, options: step.options } : null } : null,
  };
}

/** Manh mối xem lại của một bước: lời của chính bước đó, hoặc quân lệnh nghe ở bước trò chuyện gần nhất phía trước */
function clueOf(script: ExploreScript, index: number): string | null {
  const step = script.steps[index];
  if (!step) return null;
  if (step.clue) return step.clue;
  for (let i = index - 1; i >= 0; i--) {
    const p = script.steps[i];
    if (p.clue) return p.clue;
    if (p.type === 'talk' || p.type === 'find') return p.lines.join(' ');
  }
  return null;
}

function advance(script: ExploreScript, s: ExploreState, events: ExploreEvent[]): void {
  s.step += 1;
  s.asking = false;
  if (s.step >= script.steps.length) { s.done = true; events.push({ t: 'done' }); }
  else events.push({ t: 'step', text: script.steps[s.step].goal });
}

/**
 * Xử lý một hành động của người chơi. `battleWon` cho biết trận đánh của chặng đã thắng kể từ khi bắt đầu cảnh (bước `battle` chỉ qua khi đã thắng).
 * Trả về các sự kiện để trình duyệt dựng lời thoại; trạng thái `s` được cập nhật tại chỗ.
 */
export function applyExplore(script: ExploreScript, s: ExploreState, action: ExploreAction, battleWon: boolean): ExploreEvent[] {
  if (s.done) return bad('Nhiệm vụ ở cảnh này đã hoàn thành');
  const step = script.steps[s.step];
  const events: ExploreEvent[] = [];
  if (action.type === 'hint') {
    const clue = clueOf(script, s.step);
    if (!clue) return bad('Bước này chưa có manh mối để xem lại');
    s.hints += 1;
    return [{ t: 'clue', text: clue }];
  }
  if (action.type === 'answer') {
    if (step.type !== 'ask' || !s.asking) return bad('Chưa có câu hỏi nào đang chờ trả lời');
    const npc = script.npcs.find((n) => n.id === step.npc)!;
    if (action.choice === step.correct) {
      events.push({ t: 'right', who: npc.name, lines: [step.right] });
      advance(script, s, events);
    } else {
      s.mistakes += 1;
      events.push({ t: 'wrong', who: npc.name, lines: [step.wrong] });
    }
    return events;
  }
  const [kind, id] = String(action.target ?? '').split(':');
  if (kind === 'npc') {
    const npc = script.npcs.find((n) => n.id === id) ?? bad('Không có nhân vật này trong cảnh');
    const expected = 'npc' in step && step.npc === id;
    if (!expected) {
      // hỏi nhầm người khi đang phải tìm / giao đúng người: tính một lần sai
      if (step.type === 'find' || step.type === 'give') { s.mistakes += 1; return [{ t: 'wrong', who: npc.name, lines: [step.type === 'find' ? step.wrong : npc.idle] }]; }
      return [{ t: 'say', who: npc.name, lines: [npc.idle] }];
    }
    if (step.type === 'talk' || step.type === 'find') { events.push({ t: 'say', who: npc.name, lines: step.lines }); advance(script, s, events); return events; }
    if (step.type === 'give') {
      if (!s.inventory.includes(step.item)) return [{ t: 'say', who: npc.name, lines: ['Em chưa mang theo thứ ta đang chờ.'] }];
      s.inventory = s.inventory.filter((x) => x !== step.item);
      events.push({ t: 'gave', who: npc.name, item: step.item, lines: step.lines });
      advance(script, s, events);
      return events;
    }
    if (step.type === 'ask') { s.asking = true; return [{ t: 'ask', who: npc.name, prompt: step.prompt, options: step.options }]; }
    return [{ t: 'say', who: npc.name, lines: [npc.idle] }];
  }
  if (kind === 'item') {
    const item = script.items.find((n) => n.id === id) ?? bad('Không có vật này trong cảnh');
    if (step.type !== 'pickup' || step.item !== id) return [{ t: 'say', lines: [s.inventory.includes(id) ? 'Em đang mang vật này rồi.' : 'Chưa cần tới vật này lúc này.'] }];
    s.inventory.push(id);
    events.push({ t: 'got', item: id, text: item.name });
    advance(script, s, events);
    return events;
  }
  if (kind === 'zone') {
    if (!script.zones.some((z) => z.id === id)) return bad('Không có vùng này trong cảnh');
    if ((step.type !== 'zone' && step.type !== 'battle') || step.zone !== id) return [];
    if (step.type === 'battle' && !battleWon) return [{ t: 'battle' }];
    advance(script, s, events);
    return events;
  }
  return bad('Hành động không hợp lệ');
}
