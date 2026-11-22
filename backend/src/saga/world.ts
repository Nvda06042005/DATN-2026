/**
 * Thế giới khối vuông của bước Nhập vai (21/11/2026, người dùng chọn: 3D nhìn chéo, chỉ thay bước Nhập vai, làm trọn bản đồ phần 3 trước, bạn cùng lớp chơi chung).
 * Hàm thuần, không đụng cơ sở dữ liệu:
 *  - Bản đồ khối của một cuộc kháng chiến (cột hk_saga_maps.world): lưới ô ký tự (địa hình, cây, tre, ruộng lúa, nhà, lều…), người, bàn chế tạo,
 *    vùng (xây dựng / đích / quân địch), công thức chế tạo và tài nguyên. Trình duyệt dựng khối 3D từ đúng dữ liệu này.
 *  - Nhiệm vụ của một chặng (hk_saga_stages.content.world): chuỗi bước
 *      talk    – gặp một người, nghe lời dặn          ask     – trả lời câu hỏi của một người (máy chủ chấm)
 *      zone    – đi tới / quan sát một vùng (có thể cần đúng con nước)
 *      gather  – thu thập đủ một loại tài nguyên       craft   – chế tạo đủ một vật ở bàn chế tạo
 *      place   – đặt vật vào vùng xây dựng: em đặt ít nhất `count`, cả lớp (cùng phòng) có ít nhất `team` trong vùng
 *      battle  – tới vùng quân địch: mở trận đánh sẵn có của chặng, thắng mới qua bước
 * Máy chủ giữ túi đồ, bước hiện tại, số lần xem lại / sai; khối đặt trong vùng là của cả phòng (lớp) và do dịch vụ ghi vào hk_world_blocks.
 * Thủy triều tính theo đồng hồ máy chủ nên mọi người trong phòng thấy cùng một con nước. Nhân vật phụ, lời thoại, công thức, số lượng là phần sáng tạo
 * của trò chơi; dữ kiện lịch sử nằm ở thẻ kiến thức và trang sử (tổng kết) của chặng.
 */
import { BadRequestException } from '@nestjs/common';

// ---------------------------------------------------------------------- bản đồ khối
/** Ký hiệu ô: địa hình đi được, vật cản, tài nguyên. Trình duyệt dùng đúng bảng này để dựng khối. */
export const TERRAIN: Record<string, { name: string; walk: boolean; res?: ResKey }> = {
  '.': { name: 'cỏ', walk: true }, ':': { name: 'bãi cát', walk: true }, '=': { name: 'đường đất', walk: true }, ',': { name: 'bãi bồi (ngập khi nước lên)', walk: true },
  'D': { name: 'cầu tàu', walk: true }, 'P': { name: 'sân lát gạch', walk: true }, 'r': { name: 'ruộng lúa', walk: true, res: 'lua' },
  '~': { name: 'nước sâu', walk: false }, 'T': { name: 'cây gỗ', walk: false, res: 'go' }, 'B': { name: 'bụi tre', walk: false, res: 'tre' },
  'M': { name: 'núi đá', walk: false }, 'H': { name: 'nhà', walk: false }, 'C': { name: 'lều trại', walk: false }, 'W': { name: 'tường gỗ', walk: false }, 'K': { name: 'cung điện', walk: false },
};
export const RES = ['go', 'tre', 'lua'] as const;
export type ResKey = (typeof RES)[number];
export const ITEMS = ['go', 'tre', 'lua', 'coc', 'be', 'bao', 'rao', 'thuyen', 'van', 'leu', 'co'] as const;
export type ItemKey = (typeof ITEMS)[number];
export const ITEM_NAME: Record<ItemKey, string> = {
  go: 'Gỗ', tre: 'Tre', lua: 'Lúa', coc: 'Cọc nhọn', be: 'Bè chở cọc', bao: 'Bao lương', rao: 'Rào chắn', thuyen: 'Thuyền nhẹ', van: 'Ván che tên', leu: 'Lều trú tạm', co: 'Cờ hiệu',
};
/** Danh hiệu nhận trong thế giới khối (21/11/2026, theo bảng phần thưởng người dùng gửi); trang bị như danh hiệu từ hòm báu */
export const WORLD_TITLES: ReadonlyArray<{ code: string; name: string; rarity: 'rare' | 'epic'; need: string }> = [
  { code: 'nguoi-giu-lang', name: 'Người giữ làng', rarity: 'rare', need: 'Đưa dân và lương thực tới nơi an toàn (Phần 1 · Vườn không nhà trống)' },
  { code: 'dong-long-giu-nuoc', name: 'Đồng lòng giữ nước', rarity: 'epic', need: 'Luyện đội hình không lệch hàng lần nào (Phần 2 · Diên Hồng)' },
];
/** Có danh hiệu "Người giữ làng": dân làng góp sức, mỗi lần thu thập được thêm 1 */
export const VILLAGE_BONUS = 1;
/** Mỗi lần thu được bao nhiêu; ô tài nguyên mọc lại sau `REGROW_MS` (cả phòng dùng chung) */
export const YIELD: Record<ResKey, number> = { go: 2, tre: 2, lua: 2 };
export const REGROW_MS = 45_000;
/** Công thức ở bàn chế tạo (quy ước của trò chơi, không phải kỹ thuật thật) */
export const RECIPES: Record<string, { item: ItemKey; makes: number; needs: Partial<Record<ItemKey, number>> }> = {
  coc: { item: 'coc', makes: 1, needs: { go: 1 } },
  be: { item: 'be', makes: 1, needs: { tre: 2 } },
  bao: { item: 'bao', makes: 1, needs: { lua: 2 } },
  rao: { item: 'rao', makes: 1, needs: { go: 1, tre: 1 } },
  thuyen: { item: 'thuyen', makes: 1, needs: { go: 2, tre: 1 } },
  van: { item: 'van', makes: 1, needs: { go: 1 } },
  leu: { item: 'leu', makes: 1, needs: { tre: 2 } },
  co: { item: 'co', makes: 1, needs: { tre: 1 } },
};
export const MAX_STACK = 99;
/** Một chu kỳ con nước: nửa đầu nước rút, nửa sau nước lên (theo đồng hồ máy chủ) */
export const TIDE_PERIOD_MS = 80_000;
export type Tide = 'low' | 'high';
export function tideAt(nowMs: number): { state: Tide; until: number; period: number } {
  const phase = ((nowMs % TIDE_PERIOD_MS) + TIDE_PERIOD_MS) % TIDE_PERIOD_MS;
  const half = TIDE_PERIOD_MS / 2;
  return phase < half ? { state: 'low', until: nowMs - phase + half, period: TIDE_PERIOD_MS } : { state: 'high', until: nowMs - phase + TIDE_PERIOD_MS, period: TIDE_PERIOD_MS };
}

export interface WorldNpc { id: string; name: string; role: string; at: [number, number]; idle: string; fictional: boolean; look: { robe: string; hat: 'none' | 'non' | 'khan' | 'mu' | 'helmet' | 'crown'; beard: boolean } }
export interface WorldStation { id: string; name: string; at: [number, number] }
export interface WorldZone { id: string; name: string; rect: [number, number, number, number]; kind: 'build' | 'goal' | 'enemy'; accepts: ItemKey[]; on: string; cap: number; tide: Tide | null }
/** Tuyến vận chuyển: mở bằng phần thưởng `route:<id>`; đứng ở một đầu bến thì đi thuyền sang đầu kia */
export interface WorldRoute { id: string; name: string; a: [number, number]; b: [number, number] }
/** Dấu ấn của em trên bản đồ: xong bước nhập vai của chặng `stage` thì các vật / người này xuất hiện (chỉ trang trí) */
export const CHANGE_KINDS = ['villager', 'granary', 'boat', 'flag', 'tent', 'fire'] as const;
export interface WorldChange { stage: string; text: string; props: Array<{ kind: (typeof CHANGE_KINDS)[number]; at: [number, number] }> }
/** Trang Sổ sử Đông A của cuộc kháng chiến: các sự kiện theo đúng thứ tự (máy chủ xáo trước khi gửi) */
export interface WorldBook { title: string; events: Array<{ id: string; text: string }> }
export interface WorldMap {
  v: 1; title: string; w: number; h: number; rows: string[]; spawn: [number, number]; npcs: WorldNpc[]; stations: WorldStation[]; zones: WorldZone[];
  labels: Array<{ name: string; at: [number, number] }>; note: string; routes: WorldRoute[]; changes: WorldChange[]; book: WorldBook | null;
}

const bad = (m: string): never => { throw new BadRequestException(m); };
const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const ID = /^[a-z0-9_]{1,24}$/;
const COLOR = /^#[0-9a-f]{6}$/;
const text = (v: unknown, label: string, max: number): string => {
  if (typeof v !== 'string' || !v.trim()) return bad(`${label} không được để trống`);
  return v.trim().length > max ? bad(`${label} tối đa ${max} ký tự`) : v.trim();
};
const lines = (v: unknown, label: string): string[] => (Array.isArray(v) && v.length >= 1 && v.length <= 6 ? v.map((x, i) => text(x, `${label} (câu ${i + 1})`, 360)) : bad(`${label}: cần 1–6 câu thoại`));
const int = (v: unknown, label: string, min: number, max: number): number => (Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : bad(`${label}: cần số nguyên từ ${min} đến ${max}`));

export const cellAt = (m: Pick<WorldMap, 'rows' | 'w' | 'h'>, x: number, z: number): string => (x >= 0 && z >= 0 && x < m.w && z < m.h ? m.rows[z][x] : '~');
export const walkable = (m: Pick<WorldMap, 'rows' | 'w' | 'h'>, x: number, z: number): boolean => Boolean(TERRAIN[cellAt(m, x, z)]?.walk);
export const inRect = (r: [number, number, number, number], x: number, z: number): boolean => x >= r[0] && z >= r[1] && x < r[0] + r[2] && z < r[1] + r[3];

/** Kiểm tra bản đồ khối: kích thước, ký hiệu, người / bàn chế tạo tới được, vùng nằm trong bản đồ */
export function normalizeWorldMap(raw: unknown): WorldMap {
  if (!isObj(raw)) return bad('Bản đồ khối không hợp lệ');
  const w = int(raw.w, 'Bề ngang bản đồ khối', 16, 120), h = int(raw.h, 'Chiều dài bản đồ khối', 16, 120);
  if (!Array.isArray(raw.rows) || raw.rows.length !== h || raw.rows.some((r) => typeof r !== 'string' || r.length !== w)) return bad(`Bản đồ khối phải gồm ${h} dòng, mỗi dòng ${w} ký tự`);
  const rows = raw.rows as string[];
  for (const [z, row] of rows.entries()) for (const [x, ch] of [...row].entries()) if (!TERRAIN[ch]) bad(`Ký hiệu "${ch}" ở ô (${x}, ${z}) không có trong bảng địa hình`);
  const m = { rows, w, h };
  const inside = (p: unknown, label: string): [number, number] => {
    if (!Array.isArray(p) || p.length !== 2 || !Number.isInteger(p[0]) || !Number.isInteger(p[1]) || p[0] < 0 || p[0] >= w || p[1] < 0 || p[1] >= h) return bad(`${label}: vị trí ngoài bản đồ`);
    return [p[0], p[1]];
  };
  const spawn = inside(raw.spawn, 'Điểm xuất phát');
  if (!walkable(m, spawn[0], spawn[1])) bad('Điểm xuất phát phải là ô đi được');
  const seen = new Set<string>();
  const uid = (v: unknown, label: string): string => {
    if (typeof v !== 'string' || !ID.test(v)) return bad(`${label}: mã không hợp lệ`);
    if (seen.has(v)) return bad(`${label}: mã "${v}" bị trùng`);
    seen.add(v);
    return v;
  };
  const near = (p: [number, number]): boolean => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dz]) => walkable(m, p[0] + dx, p[1] + dz));
  const HATS = ['none', 'non', 'khan', 'mu', 'helmet', 'crown'];
  const npcs: WorldNpc[] = (Array.isArray(raw.npcs) ? raw.npcs : bad('Thiếu danh sách nhân vật')).map((n: any) => {
    const at = inside(n.at, `Nhân vật ${n.id}`);
    if (!walkable(m, at[0], at[1])) bad(`Nhân vật ${n.id} phải đứng trên ô đi được`);
    const look = isObj(n.look) ? n.look : {};
    return { id: uid(n.id, 'Nhân vật'), name: text(n.name, 'Tên nhân vật', 40), role: text(n.role, 'Vai trò', 60), at, idle: text(n.idle, 'Câu chào', 240), fictional: n.fictional !== false,
      look: { robe: COLOR.test(String(look.robe)) ? String(look.robe) : '#7a5a3a', hat: (HATS.includes(look.hat) ? look.hat : 'none') as WorldNpc['look']['hat'], beard: Boolean(look.beard) } };
  });
  const stations: WorldStation[] = (Array.isArray(raw.stations) && raw.stations.length ? raw.stations : bad('Cần ít nhất một bàn chế tạo')).map((s: any) => {
    const at = inside(s.at, `Bàn chế tạo ${s.id}`);
    if (!walkable(m, at[0], at[1]) || !near(at)) bad(`Bàn chế tạo ${s.id} phải đặt trên ô đi được, có ô trống bên cạnh`);
    return { id: uid(s.id, 'Bàn chế tạo'), name: text(s.name, 'Tên bàn chế tạo', 40), at };
  });
  const zones: WorldZone[] = (Array.isArray(raw.zones) ? raw.zones : []).map((z: any) => {
    const r = z.rect;
    if (!Array.isArray(r) || r.length !== 4 || r.some((n: unknown) => !Number.isInteger(n)) || r[0] < 0 || r[1] < 0 || r[2] < 1 || r[3] < 1 || r[0] + r[2] > w || r[1] + r[3] > h) bad(`Vùng ${z.id}: phạm vi ngoài bản đồ`);
    const kind = ['build', 'goal', 'enemy'].includes(z.kind) ? z.kind : bad(`Vùng ${z.id}: loại vùng không hợp lệ`);
    const accepts = (Array.isArray(z.accepts) ? z.accepts : []).map((a: unknown) => ((ITEMS as readonly string[]).includes(String(a)) ? (a as ItemKey) : bad(`Vùng ${z.id}: vật "${a}" không có`)));
    if (kind === 'build' && !accepts.length) bad(`Vùng xây dựng ${z.id} phải nhận ít nhất một loại vật`);
    const on = typeof z.on === 'string' && z.on.length && [...z.on].every((ch) => TERRAIN[ch]?.walk) ? z.on : kind === 'build' ? bad(`Vùng ${z.id}: cần ghi loại ô được đặt (on)`) : '';
    const rect = r as [number, number, number, number];
    let free = 0;
    for (let x = rect[0]; x < rect[0] + rect[2]; x++) for (let zz = rect[1]; zz < rect[1] + rect[3]; zz++) if (on.includes(cellAt(m, x, zz))) free += 1;
    if (kind === 'build' && free < 4) bad(`Vùng ${z.id}: cần ít nhất 4 ô đặt được`);
    // sức chứa nhỏ hơn số ô đặt được: vùng đầy thì khối cũ nhất dời sang ô còn trống, nên bạn đến sau vẫn luôn đặt được phần của mình
    const cap = kind === 'build' ? (z.cap ? int(z.cap, `Vùng ${z.id}: sức chứa (phải nhỏ hơn ${free} ô đặt được)`, 2, free - 1) : Math.max(2, free - 2)) : 0;
    return { id: uid(z.id, 'Vùng'), name: text(z.name, 'Tên vùng', 50), rect, kind, accepts, on, cap, tide: z.tide === 'low' || z.tide === 'high' ? z.tide : null };
  });
  const labels = (Array.isArray(raw.labels) ? raw.labels : []).slice(0, 20).map((l: any) => ({ name: text(l.name, 'Tên địa danh', 40), at: inside(l.at, `Địa danh ${l.name}`) }));
  const routes: WorldRoute[] = (Array.isArray(raw.routes) ? raw.routes : []).map((r: any) => {
    const a = inside(r.a, `Tuyến ${r.id}: bến đầu`), b = inside(r.b, `Tuyến ${r.id}: bến cuối`);
    if (!walkable(m, a[0], a[1]) || !walkable(m, b[0], b[1])) bad(`Tuyến ${r.id}: hai bến phải là ô đi được`);
    // mã tuyến dùng trong phần thưởng `route:<mã>` (chữ thường, số, gạch nối – như ràng buộc của bảng hk_world_awards)
    const id = typeof r.id === 'string' && /^[a-z0-9-]{2,40}$/.test(r.id) && !seen.has(r.id) ? r.id : bad(`Tuyến vận chuyển: mã "${r.id}" không hợp lệ hoặc bị trùng`);
    seen.add(id);
    return { id, name: text(r.name, 'Tên tuyến', 60), a, b };
  });
  const changes: WorldChange[] = (Array.isArray(raw.changes) ? raw.changes : []).map((c: any, i: number) => ({
    stage: typeof c.stage === 'string' && /^[a-z0-9-]{3,40}$/.test(c.stage) ? c.stage : bad(`Dấu ấn ${i + 1}: mã chặng không hợp lệ`),
    text: text(c.text, `Dấu ấn ${i + 1}: lời kể`, 200),
    props: (Array.isArray(c.props) && c.props.length && c.props.length <= 12 ? c.props : bad(`Dấu ấn ${i + 1}: cần 1–12 vật`)).map((pp: any) => {
      const at = inside(pp.at, `Dấu ấn ${i + 1}: vị trí`);
      if (!walkable(m, at[0], at[1])) bad(`Dấu ấn ${i + 1}: vật phải đặt trên ô đi được`);
      return { kind: (CHANGE_KINDS as readonly string[]).includes(pp.kind) ? pp.kind : bad(`Dấu ấn ${i + 1}: loại vật không hợp lệ`), at };
    }),
  }));
  let book: WorldBook | null = null;
  if (raw.book !== undefined && raw.book !== null) {
    const bk = isObj(raw.book) ? raw.book : bad('Sổ sử không hợp lệ');
    const ids = new Set<string>();
    const events = (Array.isArray(bk.events) && bk.events.length >= 4 && bk.events.length <= 8 ? bk.events : bad('Sổ sử: cần 4–8 sự kiện')).map((e: any, i: number) => {
      const id = typeof e.id === 'string' && ID.test(e.id) && !ids.has(e.id) ? e.id : bad(`Sổ sử: mã sự kiện ${i + 1} không hợp lệ hoặc bị trùng`);
      ids.add(id);
      return { id, text: text(e.text, `Sổ sử: sự kiện ${i + 1}`, 200) };
    });
    book = { title: text(bk.title, 'Sổ sử: tiêu đề', 80), events };
  }
  return { v: 1, title: text(raw.title, 'Tên bản đồ khối', 80), w, h, rows, spawn, npcs, stations, zones, labels, note: text(raw.note, 'Ghi chú phần sáng tạo của bản đồ', 400), routes, changes, book };
}

// ---------------------------------------------------------------------- nhiệm vụ của chặng
/** `award`: phần thưởng khi qua bước – `title:<mã danh hiệu>` hoặc `route:<mã tuyến>` (bước luyện đội hình chỉ thưởng khi không lệch hàng lần nào) */
interface StepBase { id: string; goal: string; clue?: string; award?: string }
export type WorldStep =
  | (StepBase & { type: 'talk'; npc: string; lines: string[] })
  | (StepBase & { type: 'ask'; npc: string; prompt: string; options: Array<{ id: string; text: string }>; correct: string; right: string; wrong: string })
  | (StepBase & { type: 'zone'; zone: string; lines: string[] | null; tide: Tide | null })
  | (StepBase & { type: 'gather'; res: ResKey; count: number })
  | (StepBase & { type: 'craft'; item: ItemKey; count: number })
  | (StepBase & { type: 'place'; item: ItemKey; zone: string; count: number; team: number })
  | (StepBase & { type: 'battle'; zone: string })
  | (StepBase & { type: 'give'; npc: string; item: ItemKey; count: number; lines: string[] })
  | (StepBase & { type: 'pick'; zones: string[]; correct: string; right: string; wrong: string })
  | (StepBase & { type: 'drill'; zones: string[]; commands: string[] });
export interface WorldQuest { title: string; intro: string; steps: WorldStep[] }

/** Kiểm tra nhiệm vụ: mọi bước trỏ tới người / vùng / vật có thật trên bản đồ khối, đặt vật thì vùng phải nhận vật đó */
export function normalizeWorldQuest(raw: unknown, map: WorldMap): WorldQuest {
  if (!isObj(raw)) return bad('Nhiệm vụ thế giới khối không hợp lệ');
  const steps: WorldStep[] = (Array.isArray(raw.steps) && raw.steps.length >= 3 && raw.steps.length <= 14 ? raw.steps : bad('Nhiệm vụ cần từ 3 đến 14 bước')).map((s: any, i: number): WorldStep => {
    const at = `Bước ${i + 1}`;
    const award = s.award === undefined ? undefined : typeof s.award === 'string' && (s.award.startsWith('title:') ? WORLD_TITLES.some((t) => `title:${t.code}` === s.award) : s.award.startsWith('route:') && map.routes.some((r) => `route:${r.id}` === s.award))
      ? s.award : bad(`${at}: phần thưởng "${s.award}" không có (danh hiệu / tuyến phải có trong danh mục, bản đồ)`);
    const base = { id: typeof s.id === 'string' && ID.test(s.id) ? s.id : `w${i + 1}`, goal: text(s.goal, `${at}: mục tiêu`, 200), ...(s.clue ? { clue: text(s.clue, `${at}: manh mối`, 360) } : {}), ...(award ? { award } : {}) };
    const npc = (): string => (map.npcs.some((n) => n.id === s.npc) ? s.npc : bad(`${at}: không có nhân vật "${s.npc}" trên bản đồ`));
    const zone = (kinds: Array<WorldZone['kind']>): WorldZone => map.zones.find((z) => z.id === s.zone && kinds.includes(z.kind)) ?? bad(`${at}: không có vùng "${s.zone}" phù hợp`);
    const item = (): ItemKey => ((ITEMS as readonly string[]).includes(s.item) ? s.item : bad(`${at}: vật "${s.item}" không có`));
    switch (s.type) {
      case 'talk': return { ...base, type: 'talk', npc: npc(), lines: lines(s.lines, at) };
      case 'ask': {
        const options = (Array.isArray(s.options) && s.options.length >= 2 && s.options.length <= 4 ? s.options : bad(`${at}: cần 2–4 phương án`)).map((o: any) => ({ id: String(o.id), text: text(o.text, 'Phương án', 220) }));
        if (!options.some((o: { id: string }) => o.id === String(s.correct))) bad(`${at}: đáp án đúng phải nằm trong các phương án`);
        return { ...base, type: 'ask', npc: npc(), prompt: text(s.prompt, `${at}: câu hỏi`, 300), options, correct: String(s.correct), right: text(s.right, 'Lời đáp khi đúng', 400), wrong: text(s.wrong, 'Lời đáp khi sai', 360) };
      }
      case 'zone': return { ...base, type: 'zone', zone: zone(['goal', 'build']).id, lines: s.lines ? lines(s.lines, at) : null, tide: s.tide === 'low' || s.tide === 'high' ? s.tide : null };
      case 'gather': return { ...base, type: 'gather', res: (RES as readonly string[]).includes(s.res) ? s.res : bad(`${at}: tài nguyên "${s.res}" không có`), count: int(s.count, `${at}: số lượng`, 1, 40) };
      case 'craft': {
        const it = item();
        if (!RECIPES[it]) bad(`${at}: "${ITEM_NAME[it]}" không chế tạo được`);
        return { ...base, type: 'craft', item: it, count: int(s.count, `${at}: số lượng`, 1, 20) };
      }
      case 'place': {
        const it = item();
        const z = zone(['build']);
        if (!z.accepts.includes(it)) bad(`${at}: vùng "${z.name}" không nhận ${ITEM_NAME[it]}`);
        const count = int(s.count, `${at}: số em cần đặt`, 1, 20);
        const team = int(s.team ?? count, `${at}: số cả lớp cần đặt`, count, z.cap);
        return { ...base, type: 'place', item: it, zone: z.id, count, team };
      }
      case 'battle': return { ...base, type: 'battle', zone: zone(['enemy']).id };
      case 'give': return { ...base, type: 'give', npc: npc(), item: item(), count: int(s.count, `${at}: số lượng`, 1, 20), lines: lines(s.lines, at) };
      case 'pick': {
        const zs = (Array.isArray(s.zones) && s.zones.length >= 2 && s.zones.length <= 4 ? s.zones : bad(`${at}: cần 2–4 vùng để chọn`)).map((z: unknown) => (map.zones.some((x) => x.id === z && x.kind === 'goal') ? String(z) : bad(`${at}: không có vùng "${z}"`)));
        if (!zs.includes(String(s.correct))) bad(`${at}: vùng đúng phải nằm trong các vùng để chọn`);
        return { ...base, type: 'pick', zones: zs, correct: String(s.correct), right: text(s.right, 'Lời khi chọn đúng', 360), wrong: text(s.wrong, 'Lời khi chọn sai', 300) };
      }
      case 'drill': {
        const zs = (Array.isArray(s.zones) && s.zones.length >= 3 && s.zones.length <= 8 ? s.zones : bad(`${at}: cần 3–8 vị trí đội hình`)).map((z: unknown) => (map.zones.some((x) => x.id === z && x.kind === 'goal') ? String(z) : bad(`${at}: không có vùng "${z}"`)));
        if (new Set(zs).size !== zs.length) bad(`${at}: các vị trí đội hình không được trùng`);
        const commands = Array.isArray(s.commands) && s.commands.length === zs.length ? s.commands.map((c: unknown, k: number) => text(c, `${at}: hiệu lệnh ${k + 1}`, 160)) : bad(`${at}: mỗi vị trí cần một hiệu lệnh`);
        return { ...base, type: 'drill', zones: zs, commands };
      }
      default: return bad(`${at}: loại bước không hợp lệ`);
    }
  });
  if (steps.filter((s) => s.type === 'battle').length > 1) bad('Mỗi nhiệm vụ chỉ có tối đa một trận đánh');
  return { title: text(raw.title, 'Tên nhiệm vụ', 80), intro: text(raw.intro, 'Lời dẫn nhiệm vụ', 500), steps };
}

// ---------------------------------------------------------------------- trạng thái và lệnh
export interface WorldState {
  v: 2; room: number; step: number; inventory: Partial<Record<ItemKey, number>>; placed: Record<string, number>;
  hints: number; mistakes: number; asking: boolean; done: boolean;
  /** luyện đội hình: đang ở hiệu lệnh thứ mấy, đã lệch hàng mấy lần ở bước này */
  drill?: number; drill_miss?: number;
  /** đặt đủ phần của em lúc nào (dân binh tới giúp nếu cả lớp chưa đủ sau một lúc) */
  own_done_at?: number | null;
}
export type WorldAction =
  | { type: 'interact'; target: string } | { type: 'answer'; choice: string } | { type: 'hint' } | { type: 'zone'; zone: string }
  | { type: 'gather'; at: [number, number]; from: [number, number] } | { type: 'craft'; recipe: string; station: string; times?: number }
  | { type: 'place'; at: [number, number]; from: [number, number]; item: string };
export interface WorldEvent { t: 'say' | 'got' | 'made' | 'placed' | 'gave' | 'ask' | 'right' | 'wrong' | 'step' | 'battle' | 'clue' | 'done' | 'wait' | 'award' | 'help'; who?: string; lines?: string[]; prompt?: string; options?: Array<{ id: string; text: string }>; text?: string; item?: ItemKey; n?: number; code?: string }
/** Thay đổi của thế giới chung mà dịch vụ phải ghi / phát cho cả phòng */
export type WorldEffect = { kind: 'take'; x: number; z: number; res: ResKey } | { kind: 'place'; x: number; z: number; block: ItemKey; zone: string } | { kind: 'award'; code: string };
/** Thông tin của phòng do dịch vụ cung cấp (đọc từ cơ sở dữ liệu / bộ nhớ trước khi gọi) */
export interface WorldCtx { battleWon: boolean; tide: Tide; nodeReady: (x: number, z: number) => boolean; occupied: (x: number, z: number) => boolean; zoneTotal: (zone: string) => number; bonusYield?: number }

export const newWorld = (room: number): WorldState => ({ v: 2, room, step: 0, inventory: {}, placed: {}, hints: 0, mistakes: 0, asking: false, done: false, drill: 0, drill_miss: 0, own_done_at: null });
export const isWorldState = (s: unknown): s is WorldState => isObj(s) && s.v === 2;

const count = (s: WorldState, it: ItemKey): number => s.inventory[it] ?? 0;
const add = (s: WorldState, it: ItemKey, n: number): void => { s.inventory[it] = Math.max(0, Math.min(MAX_STACK, count(s, it) + n)); if (!s.inventory[it]) delete s.inventory[it]; };
const reach = (a: [number, number], b: [number, number]): boolean => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) <= 2;
const pos = (v: unknown, label: string, m: WorldMap): [number, number] => (Array.isArray(v) && v.length === 2 && Number.isInteger(v[0]) && Number.isInteger(v[1]) && v[0] >= 0 && v[1] >= 0 && v[0] < m.w && v[1] < m.h ? [v[0], v[1]] : bad(`${label}: vị trí không hợp lệ`));

export function markerOf(_map: WorldMap, step: WorldStep | undefined): string | null {
  if (!step) return null;
  switch (step.type) {
    case 'talk': case 'ask': case 'give': return `npc:${step.npc}`;
    case 'drill': return null; // vị trí kế tiếp do giao diện chỉ theo `need.next`
    case 'pick': return null; // phải tự tìm đúng nơi
    case 'zone': case 'place': case 'battle': return `zone:${step.zone}`;
    case 'gather': return `res:${step.res}`;
    case 'craft': return 'station:*'; // bàn chế tạo nào cũng được (giao diện chỉ tới bàn gần nhất)
    default: return null;
  }
}

function clueOf(q: WorldQuest, index: number): string | null {
  const step = q.steps[index];
  if (!step) return null;
  if (step.clue) return step.clue;
  for (let i = index - 1; i >= 0; i--) {
    const p = q.steps[i];
    if (p.clue) return p.clue;
    if (p.type === 'talk') return p.lines.join(' ');
  }
  return null;
}

/** Bước hiện tại đã đủ điều kiện (thu thập / chế tạo / đặt vật) thì qua; lặp cho tới bước cần hành động khác */
export function settleWorld(q: WorldQuest, s: WorldState, ctx: WorldCtx, events: WorldEvent[], effects: WorldEffect[]): void {
  while (!s.done) {
    const step = q.steps[s.step];
    const met = step.type === 'gather' ? count(s, step.res) >= step.count
      : step.type === 'craft' ? count(s, step.item) >= step.count
      : step.type === 'place' ? (s.placed[step.zone] ?? 0) >= step.count && ctx.zoneTotal(step.zone) >= step.team
      : false;
    if (!met) return;
    advance(q, s, events, effects);
  }
}

function advance(q: WorldQuest, s: WorldState, events: WorldEvent[], effects: WorldEffect[]): void {
  const done = q.steps[s.step];
  if (done?.award && !(done.type === 'drill' && (s.drill_miss ?? 0) > 0)) { effects.push({ kind: 'award', code: done.award }); events.push({ t: 'award', code: done.award }); }
  s.step += 1;
  s.asking = false;
  s.drill = 0;
  s.drill_miss = 0;
  s.own_done_at = null;
  if (s.step >= q.steps.length) { s.done = true; events.push({ t: 'done' }); } else events.push({ t: 'step', text: q.steps[s.step].goal });
}

/**
 * Xử lý một lệnh; trả về sự kiện cho giao diện và các thay đổi của thế giới chung. `s` được cập nhật tại chỗ.
 * Sau mọi lệnh (kể cả lệnh không liên quan), bước thu thập / chế tạo / đặt vật đã đủ điều kiện thì qua – ví dụ bạn cùng lớp vừa đặt đủ phần "cả lớp".
 */
export function applyWorld(q: WorldQuest, map: WorldMap, s: WorldState, action: WorldAction, ctx: WorldCtx): { events: WorldEvent[]; effects: WorldEffect[] } {
  const r = applyOne(q, map, s, action, ctx);
  const added = new Map<string, number>();
  for (const e of r.effects) if (e.kind === 'place') added.set(e.zone, (added.get(e.zone) ?? 0) + 1);
  settleWorld(q, s, { ...ctx, zoneTotal: (z) => ctx.zoneTotal(z) + (added.get(z) ?? 0) }, r.events, r.effects);
  return r;
}

function applyOne(q: WorldQuest, map: WorldMap, s: WorldState, action: WorldAction, ctx: WorldCtx): { events: WorldEvent[]; effects: WorldEffect[] } {
  const events: WorldEvent[] = [];
  const effects: WorldEffect[] = [];
  const step = s.done ? undefined : q.steps[s.step];
  switch (action.type) {
    case 'hint': {
      if (!step) return bad('Nhiệm vụ đã hoàn thành');
      const clue = clueOf(q, s.step) ?? bad('Bước này chưa có manh mối để xem lại');
      s.hints += 1;
      return { events: [{ t: 'clue', text: clue }], effects };
    }
    case 'answer': {
      if (!step || step.type !== 'ask' || !s.asking) return bad('Chưa có câu hỏi nào đang chờ trả lời');
      const npc = map.npcs.find((n) => n.id === step.npc)!;
      if (String(action.choice) === step.correct) { events.push({ t: 'right', who: npc.name, lines: [step.right] }); advance(q, s, events, effects); }
      else { s.mistakes += 1; events.push({ t: 'wrong', who: npc.name, lines: [step.wrong] }); }
      return { events, effects };
    }
    case 'interact': {
      const [kind, id] = String(action.target ?? '').split(':');
      if (kind !== 'npc') return bad('Hành động không hợp lệ');
      const npc = map.npcs.find((n) => n.id === id) ?? bad('Không có nhân vật này trên bản đồ');
      if (!step || !('npc' in step) || step.npc !== id) return { events: [{ t: 'say', who: npc.name, lines: [npc.idle] }], effects };
      if (step.type === 'talk') { events.push({ t: 'say', who: npc.name, lines: step.lines }); advance(q, s, events, effects); return { events, effects }; }
      if (step.type === 'give') {
        if (count(s, step.item) < step.count) return { events: [{ t: 'say', who: npc.name, lines: [`Em mang tới cho ta ${step.count} ${ITEM_NAME[step.item].toLowerCase()} nhé (em đang có ${count(s, step.item)}).`] }], effects };
        add(s, step.item, -step.count);
        events.push({ t: 'gave', who: npc.name, item: step.item, n: step.count, lines: step.lines });
        advance(q, s, events, effects);
        return { events, effects };
      }
      s.asking = true;
      return { events: [{ t: 'ask', who: npc.name, prompt: step.prompt, options: step.options }], effects };
    }
    case 'zone': {
      const zone = map.zones.find((z) => z.id === action.zone) ?? bad('Không có vùng này trên bản đồ');
      if (step?.type === 'pick' && step.zones.includes(zone.id)) {
        if (zone.id === step.correct) { events.push({ t: 'right', who: zone.name, lines: [step.right] }); advance(q, s, events, effects); }
        else { s.mistakes += 1; events.push({ t: 'wrong', who: zone.name, lines: [step.wrong] }); }
        return { events, effects };
      }
      if (step?.type === 'drill' && step.zones.includes(zone.id)) {
        const at = s.drill ?? 0;
        if (zone.id === step.zones[at]) {
          s.drill = at + 1;
          if (s.drill >= step.zones.length) {
            events.push({ t: 'right', who: 'Hiệu lệnh', lines: [(s.drill_miss ?? 0) ? 'Đội hình đã vào hàng, nhưng còn lệch vài lần. Lần sau giữ chắc hàng ngũ hơn nhé.' : 'Cả đội giữ vững hàng ngũ, không lệch một bước!'] });
            advance(q, s, events, effects);
          } else events.push({ t: 'say', who: 'Hiệu lệnh', lines: [step.commands[s.drill]] });
        } else if (at === 0 || zone.id !== step.zones[at - 1]) {
          s.drill = 0;
          s.drill_miss = (s.drill_miss ?? 0) + 1;
          s.mistakes += 1;
          events.push({ t: 'wrong', who: 'Hiệu lệnh', lines: [`Lệch đội hình! Về lại vị trí đầu: ${step.commands[0]}`] });
        }
        return { events, effects };
      }
      if (!step || (step.type !== 'zone' && step.type !== 'battle') || step.zone !== zone.id) return { events, effects };
      if (step.type === 'battle') {
        if (!ctx.battleWon) return { events: [{ t: 'battle' }], effects };
        advance(q, s, events, effects);
        return { events, effects };
      }
      if (step.tide && step.tide !== ctx.tide) return { events: [{ t: 'wait', text: step.tide === 'high' ? 'Nước đang rút. Chờ nước triều lên rồi mới làm bước này.' : 'Nước đang lên. Chờ nước triều rút rồi mới làm bước này.' }], effects };
      if (step.lines) events.push({ t: 'say', who: zone.name, lines: step.lines });
      advance(q, s, events, effects);
      return { events, effects };
    }
    case 'gather': {
      const at = pos(action.at, 'Ô tài nguyên', map), from = pos(action.from, 'Vị trí của em', map);
      if (!walkable(map, from[0], from[1]) || !reach(at, from)) return bad('Em cần đứng gần hơn để thu thập');
      const res = TERRAIN[cellAt(map, at[0], at[1])]?.res ?? bad('Ô này không có tài nguyên để thu thập');
      if (!ctx.nodeReady(at[0], at[1])) return { events: [{ t: 'wait', text: `${TERRAIN[cellAt(map, at[0], at[1])].name[0].toUpperCase()}${TERRAIN[cellAt(map, at[0], at[1])].name.slice(1)} ở đây vừa được thu hoạch. Tìm chỗ khác hoặc chờ một lát.` }], effects };
      if (count(s, res) >= MAX_STACK) return { events: [{ t: 'wait', text: `Túi đã đầy ${ITEM_NAME[res].toLowerCase()}.` }], effects };
      const got = YIELD[res] + (ctx.bonusYield ?? 0);
      add(s, res, got);
      effects.push({ kind: 'take', x: at[0], z: at[1], res });
      events.push({ t: 'got', item: res, n: got, text: `+${got} ${ITEM_NAME[res].toLowerCase()}${ctx.bonusYield ? ' (dân làng góp sức)' : ''}` });
      return { events, effects };
    }
    case 'craft': {
      const recipe = RECIPES[String(action.recipe)] ?? bad('Không có công thức này');
      if (!map.stations.some((st) => st.id === action.station)) bad('Cần tới bàn chế tạo');
      const times = Number.isInteger(action.times) && action.times! >= 1 && action.times! <= 10 ? action.times! : 1;
      for (const [it, n] of Object.entries(recipe.needs) as Array<[ItemKey, number]>) if (count(s, it) < n * times) return { events: [{ t: 'wait', text: `Chưa đủ nguyên liệu: cần ${n * times} ${ITEM_NAME[it].toLowerCase()}, em đang có ${count(s, it)}.` }], effects };
      if (count(s, recipe.item) + recipe.makes * times > MAX_STACK) return { events: [{ t: 'wait', text: 'Túi đã đầy vật này.' }], effects };
      for (const [it, n] of Object.entries(recipe.needs) as Array<[ItemKey, number]>) add(s, it, -n * times);
      add(s, recipe.item, recipe.makes * times);
      events.push({ t: 'made', item: recipe.item, n: recipe.makes * times, text: `Đã làm ${recipe.makes * times} ${ITEM_NAME[recipe.item].toLowerCase()}` });
      return { events, effects };
    }
    case 'place': {
      const at = pos(action.at, 'Ô đặt vật', map), from = pos(action.from, 'Vị trí của em', map);
      const it = (ITEMS as readonly string[]).includes(String(action.item)) ? (action.item as ItemKey) : bad('Vật không hợp lệ');
      if (!walkable(map, from[0], from[1]) || !reach(at, from)) return bad('Em cần đứng gần hơn để đặt vật');
      const zone = map.zones.find((z) => z.kind === 'build' && inRect(z.rect, at[0], at[1]) && z.accepts.includes(it));
      if (!zone || !zone.on.includes(cellAt(map, at[0], at[1]))) return { events: [{ t: 'wait', text: `Không đặt ${ITEM_NAME[it].toLowerCase()} ở đây được. Hãy đặt trong vùng được đánh dấu.` }], effects };
      if (zone.tide && zone.tide !== ctx.tide) return { events: [{ t: 'wait', text: zone.tide === 'low' ? 'Nước đang lên, lòng sông ngập sâu. Chờ nước triều rút rồi mới đóng cọc.' : 'Chờ nước triều lên rồi mới đặt được.' }], effects };
      if (ctx.occupied(at[0], at[1])) return { events: [{ t: 'wait', text: 'Ô này đã có vật rồi.' }], effects };
      if (count(s, it) < 1) return { events: [{ t: 'wait', text: `Em chưa có ${ITEM_NAME[it].toLowerCase()} trong túi.` }], effects };
      add(s, it, -1);
      s.placed[zone.id] = (s.placed[zone.id] ?? 0) + 1;
      effects.push({ kind: 'place', x: at[0], z: at[1], block: it, zone: zone.id });
      events.push({ t: 'placed', item: it, text: `Đã đặt ${ITEM_NAME[it].toLowerCase()} ở ${zone.name}` });
      return { events, effects };
    }
    default: return bad('Hành động không hợp lệ');
  }
}

/** Phần gửi cho trình duyệt: bản đồ khối, mục tiêu bước đang làm, túi đồ; không có đáp án và không lộ các bước sau */
export function publicWorld(q: WorldQuest, map: WorldMap, s: WorldState, extra: { zoneTotal: (zone: string) => number }): Record<string, unknown> {
  const step = s.done ? undefined : q.steps[s.step];
  const need = !step ? null
    : step.type === 'gather' ? { item: step.res, count: step.count, have: count(s, step.res) }
    : step.type === 'craft' ? { item: step.item, count: step.count, have: count(s, step.item) }
    : step.type === 'place' ? { item: step.item, zone: step.zone, count: step.count, own: s.placed[step.zone] ?? 0, team: step.team, total: extra.zoneTotal(step.zone) }
    : step.type === 'zone' && step.tide ? { tide: step.tide }
    : step.type === 'give' ? { item: step.item, count: step.count, have: count(s, step.item) }
    : step.type === 'pick' ? { zones: step.zones }
    : step.type === 'drill' ? { zones: step.zones, next: step.zones[s.drill ?? 0], command: step.commands[s.drill ?? 0], index: s.drill ?? 0, total: step.zones.length }
    : null;
  return {
    world: true, title: q.title, intro: q.intro,
    map: { title: map.title, w: map.w, h: map.h, rows: map.rows, spawn: map.spawn, labels: map.labels, note: map.note,
      npcs: map.npcs.map((n) => ({ id: n.id, name: n.name, role: n.role, at: n.at, fictional: n.fictional, look: n.look })), stations: map.stations, zones: map.zones, routes: map.routes },
    terrain: Object.fromEntries(Object.entries(TERRAIN).map(([k, v]) => [k, { name: v.name, walk: v.walk, res: v.res ?? null }])),
    items: ITEM_NAME, recipes: RECIPES, yield: YIELD, regrow_ms: REGROW_MS,
    progress: { step: s.step, total: q.steps.length, done: s.done, hints: s.hints, mistakes: s.mistakes, inventory: s.inventory, placed: s.placed },
    current: step ? { id: step.id, type: step.type, goal: step.goal, marker: markerOf(map, step), has_clue: Boolean(clueOf(q, s.step)), need,
      asking: s.asking && step.type === 'ask' ? { prompt: step.prompt, options: step.options } : null } : null,
  };
}
