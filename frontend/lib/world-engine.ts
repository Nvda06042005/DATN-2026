/** Luật của Hành Trình Đông A: lưới ô đi được, tìm đường, nhiệm vụ, vật hiện/ẩn, cây trồng, khôi phục bản lưu */
import { CROPS, QUEST_BY_ID, STRUCTURE_SIZE, TILE_INFO, WORLD_MAPS, WORLD_MAP_BY_ID, WORLD_QUESTS } from '@/constants/world';
import type { CropId, WorldDir, WorldMapDef, WorldMapId, WorldObjectDef, WorldQuestDef, WorldQuestStep, WorldState } from '@/types/game';

export const DIRS: Record<WorldDir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

const DIR_IDS = Object.keys(DIRS) as WorldDir[];

export const MAP_ORDER: WorldMapId[] = WORLD_MAPS.map((m) => m.id);

export interface PlotSpot {
  id: string;
  x: number;
  y: number;
  n: number;
}

export interface MapGrid {
  def: WorldMapDef;
  cols: number;
  rows: number;
  /** 1 = địa hình hoặc công trình chặn đường */
  solid: Uint8Array;
  plots: PlotSpot[];
}

const grids = new Map<WorldMapId, MapGrid>();

/** Lưới ô của một vùng (tính một lần) */
export const mapGrid = (id: WorldMapId): MapGrid => {
  const cached = grids.get(id);
  if (cached) return cached;
  const def = WORLD_MAP_BY_ID[id];
  const rows = def.rows.length;
  const cols = def.rows[0].length;
  const solid = new Uint8Array(cols * rows);
  const plots: PlotSpot[] = [];
  def.rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (!TILE_INFO[ch]?.walk) solid[y * cols + x] = 1;
      if (ch === 'p') plots.push({ id: `${id}:${x},${y}`, x, y, n: plots.length + 1 });
    }),
  );
  for (const s of def.structures) {
    const [w, h] = STRUCTURE_SIZE[s.kind];
    for (let y = s.y; y < s.y + h; y++) for (let x = s.x; x < s.x + w; x++) if (x >= 0 && y >= 0 && x < cols && y < rows) solid[y * cols + x] = 1;
  }
  const grid = { def, cols, rows, solid, plots };
  grids.set(id, grid);
  return grid;
};

export const tileAt = (grid: MapGrid, x: number, y: number) => grid.def.rows[y]?.[x] ?? '';

export const inside = (grid: MapGrid, x: number, y: number) => x >= 0 && y >= 0 && x < grid.cols && y < grid.rows;

export const solidAt = (grid: MapGrid, x: number, y: number) => !inside(grid, x, y) || grid.solid[y * grid.cols + x] === 1;

// ---------------------------------------------------------------------- nhiệm vụ
export const questProgress = (w: WorldState, q: WorldQuestDef) => Math.max(0, Math.min(q.steps.length, w.quests[q.id] ?? 0));

export const questDone = (w: WorldState, q: WorldQuestDef) => questProgress(w, q) >= q.steps.length;

/** Nhiệm vụ chính đang làm: nhiệm vụ đầu tiên chưa xong theo thứ tự 3 vùng; null khi đã đi hết hành trình */
export const activeQuest = (w: WorldState): WorldQuestDef | null => WORLD_QUESTS.find((q) => !questDone(w, q)) ?? null;

export const journeyDone = (w: WorldState) => activeQuest(w) === null;

/** Vùng đã mở: vùng đầu luôn mở, vùng sau mở khi xong nhiệm vụ chính của vùng trước */
export const mapUnlocked = (w: WorldState, id: WorldMapId) => {
  const i = MAP_ORDER.indexOf(id);
  return i <= 0 || questDone(w, WORLD_QUESTS[i - 1]);
};

const matches = (target: string, obj: { id: string }) => target === obj.id || (target === 'plot' && obj.id.includes(':'));

/** Bước nhiệm vụ chính đang chờ ở vật/luống đất này */
export const stepFor = (w: WorldState, mapId: WorldMapId, obj: { id: string }): { quest: WorldQuestDef; index: number; step: WorldQuestStep } | null => {
  const quest = activeQuest(w);
  if (!quest || quest.map !== mapId) return null;
  const index = questProgress(w, quest);
  const step = quest.steps[index];
  return step && matches(step.target, obj) ? { quest, index, step } : null;
};

const TARGET_STEP = new Map<string, { quest: WorldQuestDef; index: number }>();
for (const quest of WORLD_QUESTS) quest.steps.forEach((s, index) => TARGET_STEP.set(s.target, { quest, index }));

/** Thám báo, đội thuyền, cuộn sử biến mất khi đã xong; vật có `showAt` chỉ hiện từ bước đó */
export const objectVisible = (w: WorldState, obj: WorldObjectDef) => {
  if (obj.showAt) {
    const q = QUEST_BY_ID[obj.showAt[0]];
    if (!q || questProgress(w, q) < obj.showAt[1]) return false;
  }
  if (obj.kind === 'scroll' || obj.kind === 'scout' || obj.kind === 'boss') {
    if (w.done.includes(obj.id)) return false;
    const t = TARGET_STEP.get(obj.id);
    if (t && questProgress(w, t.quest) > t.index) return false;
  }
  return true;
};

/** Cọc Bạch Đằng đã đóng chưa (bước nhiệm vụ của cọc đã xong) */
export const stakePlanted = (w: WorldState, id: string) => {
  const t = TARGET_STEP.get(id);
  return !!t && questProgress(w, t.quest) > t.index;
};

/** Việc phụ (có `lesson` riêng) đã làm chưa */
export const sideDone = (w: WorldState, obj: WorldObjectDef) => w.done.includes(obj.id);

export const portalOpen = (w: WorldState, obj: WorldObjectDef) => !obj.needs || (QUEST_BY_ID[obj.needs] ? questDone(w, QUEST_BY_ID[obj.needs]) : true);

/** Vật có chặn đường không: cuộn sử và cổng đang mở thì đi qua được */
export const objectSolid = (w: WorldState, obj: WorldObjectDef) => !(obj.kind === 'scroll' || (obj.kind === 'portal' && portalOpen(w, obj)));

export const objectCovers = (obj: WorldObjectDef, x: number, y: number) => x >= obj.x && y >= obj.y && x < obj.x + (obj.w ?? 1) && y < obj.y + (obj.h ?? 1);

// ---------------------------------------------------------------------- tìm đường
export type Blocked = (x: number, y: number) => boolean;

/** Tìm đường ngắn nhất (BFS) từ `from` tới một trong các ô `goals`; trả về các ô phải đi qua (không gồm ô xuất phát) */
export const findPath = (grid: MapGrid, blocked: Blocked, from: [number, number], goals: Array<[number, number]>): Array<[number, number]> | null => {
  const key = (x: number, y: number) => y * grid.cols + x;
  const goalSet = new Set(goals.filter(([x, y]) => inside(grid, x, y)).map(([x, y]) => key(x, y)));
  if (!goalSet.size) return null;
  const start = key(from[0], from[1]);
  if (goalSet.has(start)) return [];
  const prev = new Int32Array(grid.cols * grid.rows).fill(-1);
  prev[start] = start;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const cx = cur % grid.cols;
    const cy = Math.floor(cur / grid.cols);
    for (const d of DIR_IDS) {
      const nx = cx + DIRS[d][0];
      const ny = cy + DIRS[d][1];
      if (!inside(grid, nx, ny)) continue;
      const k = key(nx, ny);
      if (prev[k] !== -1 || blocked(nx, ny)) continue;
      prev[k] = cur;
      if (goalSet.has(k)) {
        const path: Array<[number, number]> = [];
        for (let p = k; p !== start; p = prev[p]) path.push([p % grid.cols, Math.floor(p / grid.cols)]);
        return path.reverse();
      }
      queue.push(k);
    }
  }
  return null;
};

/** Các ô kề một vật (để đứng nói chuyện) */
export const besideTiles = (obj: { x: number; y: number; w?: number; h?: number }): Array<[number, number]> => {
  const w = obj.w ?? 1;
  const h = obj.h ?? 1;
  const out: Array<[number, number]> = [];
  for (let x = obj.x; x < obj.x + w; x++) out.push([x, obj.y + h], [x, obj.y - 1]);
  for (let y = obj.y; y < obj.y + h; y++) out.push([obj.x - 1, y], [obj.x + w, y]);
  return out;
};

/** Hướng quay mặt từ ô người chơi tới vật */
export const faceToward = (x: number, y: number, obj: { x: number; y: number; w?: number; h?: number }): WorldDir => {
  const w = obj.w ?? 1;
  const h = obj.h ?? 1;
  if (y >= obj.y + h) return 'up';
  if (y < obj.y) return 'down';
  if (x < obj.x) return 'right';
  return x >= obj.x + w ? 'left' : 'down';
};

// ---------------------------------------------------------------------- cây trồng
/** Giai đoạn cây: 0 hạt, 1 nảy mầm, 2 đang lớn, 3 chín (chín rồi thì chờ, không hỏng) */
export const cropState = (plot: { crop: CropId; at: number; boost: boolean }, now: number) => {
  const total = CROPS[plot.crop].minutes * 60_000;
  const elapsed = Math.max(0, now - plot.at);
  const ready = plot.boost || elapsed >= total;
  return { ready, stage: ready ? 3 : elapsed < total / 3 ? 0 : elapsed < (2 * total) / 3 ? 1 : 2, left: ready ? 0 : total - elapsed, total };
};

// ---------------------------------------------------------------------- bản lưu
export const newWorld = (): WorldState => {
  const s = WORLD_MAPS[0].spawn;
  return { map: WORLD_MAPS[0].id, x: s.x, y: s.y, dir: s.dir, quests: {}, done: [], plots: {}, intro: false };
};

const KNOWN_DONE = new Set([...WORLD_MAPS.flatMap((m) => m.objects.map((o) => o.id)), ...WORLD_MAPS.map((m) => `map:${m.id}`)]);

const PLOT_IDS = new Set(WORLD_MAPS.flatMap((m) => mapGrid(m.id).plots.map((p) => p.id)));

/** Đọc phần Hành Trình trong bản lưu: bỏ dữ liệu lạ, đưa người chơi về chỗ hợp lệ */
export const restoreWorld = (raw: unknown): WorldState => {
  const base = newWorld();
  if (!raw || typeof raw !== 'object') return base;
  const s = raw as Partial<WorldState>;
  const quests: Record<string, number> = {};
  for (const q of WORLD_QUESTS) {
    const n = s.quests?.[q.id];
    if (typeof n === 'number' && Number.isFinite(n)) quests[q.id] = Math.max(0, Math.min(q.steps.length, Math.round(n)));
  }
  const done = Array.isArray(s.done) ? [...new Set(s.done.filter((d): d is string => typeof d === 'string' && KNOWN_DONE.has(d)))] : [];
  const plots: WorldState['plots'] = {};
  for (const [id, p] of Object.entries(s.plots ?? {})) {
    if (PLOT_IDS.has(id) && p && typeof p === 'object' && p.crop in CROPS && typeof p.at === 'number' && Number.isFinite(p.at)) plots[id] = { crop: p.crop, at: p.at, boost: Boolean(p.boost) };
  }
  const world: WorldState = { ...base, quests, done, plots, intro: Boolean(s.intro) };
  const map = typeof s.map === 'string' && s.map in WORLD_MAP_BY_ID ? (s.map as WorldMapId) : base.map;
  if (!mapUnlocked(world, map)) return world;
  const grid = mapGrid(map);
  const x = typeof s.x === 'number' ? Math.round(s.x) : -1;
  const y = typeof s.y === 'number' ? Math.round(s.y) : -1;
  const spawn = grid.def.spawn;
  const ok = !solidAt(grid, x, y) && !grid.def.objects.some((o) => o.kind !== 'scroll' && o.kind !== 'portal' && objectCovers(o, x, y));
  return { ...world, map, x: ok ? x : spawn.x, y: ok ? y : spawn.y, dir: typeof s.dir === 'string' && s.dir in DIRS ? s.dir : spawn.dir };
};
