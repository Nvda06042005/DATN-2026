/**
 * Hàm thuần của thế giới khối (21/11/2026), dùng chung cho cảnh 3D (game/world3d.ts) và màn React (WorldScreen.tsx):
 * ô chặn, tìm đường, ô đứng cạnh để thu thập / đặt vật, thủy triều theo giờ máy chủ, vị trí mục tiêu của bước đang làm.
 * Luật thật nằm ở máy chủ (backend/src/saga/world.ts); các hàm này chỉ giúp đi lại và chỉ đường, máy chủ vẫn kiểm tra lại mọi lệnh.
 */
export type Cell = [number, number];
export interface WorldZoneInfo { id: string; name: string; rect: [number, number, number, number]; kind: 'build' | 'goal' | 'enemy'; accepts: string[]; on: string; cap: number; tide: 'low' | 'high' | null }
export interface WorldMapInfo {
  title: string; w: number; h: number; rows: string[]; spawn: Cell; note: string;
  labels: Array<{ name: string; at: Cell }>;
  npcs: Array<{ id: string; name: string; role: string; at: Cell; fictional: boolean; look: { robe: string; hat: string; beard: boolean } }>;
  stations: Array<{ id: string; name: string; at: Cell }>;
  zones: WorldZoneInfo[];
}
export type TerrainInfo = Record<string, { name: string; walk: boolean; res: string | null }>;
export interface PlacedBlock { x: number; z: number; block: string; zone: string; mine?: boolean }

/** Bằng máy chủ: với tới được khi cách nhau tối đa 2 ô theo mọi hướng */
export const REACH = 2;
export const TIDE_PERIOD_MS = 80_000;
export const PLACEABLE = ['coc', 'rao', 'bao', 'thuyen'] as const;

export const cellAt = (m: Pick<WorldMapInfo, 'rows' | 'w' | 'h'>, x: number, z: number): string => (x >= 0 && z >= 0 && x < m.w && z < m.h ? m.rows[z][x] : '~');
export const inRect = (r: [number, number, number, number], x: number, z: number): boolean => x >= r[0] && z >= r[1] && x < r[0] + r[2] && z < r[1] + r[3];
export const chebyshev = (a: Cell, b: Cell): number => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
export const reachable = (a: Cell, b: Cell): boolean => chebyshev(a, b) <= REACH;
export const key = (x: number, z: number): string => `${x},${z}`;

/** Ô không đi được: địa hình chặn, ô có người / bàn chế tạo, ô đã có khối đặt */
export function blockedFn(m: WorldMapInfo, terrain: TerrainInfo, blocks: PlacedBlock[]): (x: number, z: number) => boolean {
  const solid = new Set<string>([...m.npcs.map((n) => key(n.at[0], n.at[1])), ...m.stations.map((s) => key(s.at[0], s.at[1])), ...blocks.map((b) => key(b.x, b.z))]);
  return (x, z) => x < 0 || z < 0 || x >= m.w || z >= m.h || !terrain[cellAt(m, x, z)]?.walk || solid.has(key(x, z));
}

const DIRS: Cell[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Đường đi ngắn nhất (4 hướng) từ `from` tới `to`; null khi không tới được. Không tính ô xuất phát. */
export function findPath(m: Pick<WorldMapInfo, 'w' | 'h'>, blocked: (x: number, z: number) => boolean, from: Cell, to: Cell, limit = 6000): Cell[] | null {
  if (from[0] === to[0] && from[1] === to[1]) return [];
  if (blocked(to[0], to[1])) return null;
  const prev = new Map<string, string | null>([[key(from[0], from[1]), null]]);
  const queue: Cell[] = [from];
  for (let i = 0; i < queue.length && i < limit; i++) {
    const [x, z] = queue[i];
    for (const [dx, dz] of DIRS) {
      const nx = x + dx, nz = z + dz, k = key(nx, nz);
      if (nx < 0 || nz < 0 || nx >= m.w || nz >= m.h || prev.has(k) || blocked(nx, nz)) continue;
      prev.set(k, key(x, z));
      if (nx === to[0] && nz === to[1]) {
        const path: Cell[] = [];
        for (let c: string | null = k; c && c !== key(from[0], from[1]); c = prev.get(c) ?? null) path.unshift(c.split(',').map(Number) as Cell);
        return path;
      }
      queue.push([nx, nz]);
    }
  }
  return null;
}

/** Ô đi được gần `target` nhất (trong tầm với) mà tới được từ `from`; dùng để bước tới cạnh cây, người, bàn chế tạo hay ô cần đặt vật */
export function standNear(m: Pick<WorldMapInfo, 'w' | 'h'>, blocked: (x: number, z: number) => boolean, target: Cell, from: Cell, range = 1): { cell: Cell; path: Cell[] } | null {
  if (chebyshev(from, target) <= range && !(from[0] === target[0] && from[1] === target[1] && blocked(target[0], target[1]))) return { cell: from, path: [] };
  const options: Cell[] = [];
  for (let dz = -range; dz <= range; dz++) for (let dx = -range; dx <= range; dx++) {
    if (!dx && !dz) continue;
    const c: Cell = [target[0] + dx, target[1] + dz];
    if (!blocked(c[0], c[1])) options.push(c);
  }
  if (!blocked(target[0], target[1])) options.unshift(target);
  let best: { cell: Cell; path: Cell[] } | null = null;
  for (const c of options.sort((a, b) => chebyshev(a, from) - chebyshev(b, from))) {
    const path = findPath(m, blocked, from, c);
    if (path && (!best || path.length < best.path.length)) best = { cell: c, path };
  }
  return best;
}

/** Con nước theo giờ máy chủ (bằng công thức của máy chủ): nửa đầu chu kỳ nước rút, nửa sau nước lên */
export function tideAt(nowMs: number, period = TIDE_PERIOD_MS): { state: 'low' | 'high'; leftMs: number; phase: number } {
  const p = ((nowMs % period) + period) % period;
  const half = period / 2;
  return p < half ? { state: 'low', leftMs: half - p, phase: p / period } : { state: 'high', leftMs: period - p, phase: p / period };
}

/** Các ô mục tiêu của bước đang làm (để vẽ mũi tên chỉ đường): người, bàn chế tạo, vùng hoặc ô tài nguyên gần em nhất */
export function markerCells(marker: string | null, m: WorldMapInfo, terrain: TerrainInfo, me: Cell, taken: (x: number, z: number) => boolean = () => false): Cell[] {
  if (!marker) return [];
  const [kind, id] = marker.split(':');
  if (kind === 'npc') { const n = m.npcs.find((x) => x.id === id); return n ? [n.at] : []; }
  if (kind === 'station') return [...m.stations].sort((a, b) => chebyshev(a.at, me) - chebyshev(b.at, me)).slice(0, 1).map((s) => s.at);
  if (kind === 'zone') {
    const z = m.zones.find((x) => x.id === id);
    return z ? [[z.rect[0] + Math.floor(z.rect[2] / 2), z.rect[1] + Math.floor(z.rect[3] / 2)]] : [];
  }
  if (kind === 'res') {
    let best: Cell | null = null;
    for (let z = 0; z < m.h; z++) for (let x = 0; x < m.w; x++) {
      if (terrain[cellAt(m, x, z)]?.res !== id || taken(x, z)) continue;
      if (!best || chebyshev([x, z], me) < chebyshev(best, me)) best = [x, z];
    }
    return best ? [best] : [];
  }
  return [];
}

/** Vùng xây dựng nhận vật `item` có chứa ô (x, z) và ô đó đúng loại ô được đặt */
export function buildZoneAt(m: WorldMapInfo, x: number, z: number, item: string): WorldZoneInfo | null {
  return m.zones.find((zn) => zn.kind === 'build' && zn.accepts.includes(item) && inRect(zn.rect, x, z) && zn.on.includes(cellAt(m, x, z))) ?? null;
}

/** Số khối của cả phòng trong từng vùng (cập nhật ngay khi bạn cùng lớp đặt, trước khi tải lại trạng thái phiên) */
export function zoneTotals(blocks: PlacedBlock[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of blocks) out[b.zone] = (out[b.zone] ?? 0) + 1;
  return out;
}

/** Áp một thay đổi khối từ kênh thời gian thực (đặt mới, dời khối cũ nhất) vào danh sách khối đang có */
export function applyBlockChange(blocks: PlacedBlock[], change: { placed: PlacedBlock & { by?: number }; removed: { x: number; z: number } | null }, me: number | null): PlacedBlock[] {
  const next = blocks.filter((b) => !(change.removed && b.x === change.removed.x && b.z === change.removed.z) && !(b.x === change.placed.x && b.z === change.placed.z));
  next.push({ x: change.placed.x, z: change.placed.z, block: change.placed.block, zone: change.placed.zone, mine: me !== null && change.placed.by === me });
  return next;
}
