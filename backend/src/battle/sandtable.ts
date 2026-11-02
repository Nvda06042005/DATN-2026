/**
 * Sa bàn 3D của trận đánh (HK.HS.137, HK.GV.084): kiểm tra và chuẩn hóa dữ liệu cảnh do quản trị tổng soạn.
 * Cảnh chỉ là sơ đồ minh họa (địa hình, sông, vị trí hai bên và các bước tiến – rút), không phải bản đồ thật; trình duyệt dựng 3D từ dữ liệu này,
 * nên máy chủ giới hạn kích thước và kiểm tra tham chiếu (mỗi bước chỉ nhắc tới quân đã khai báo) để cảnh luôn hiển thị được.
 */
import { BadRequestException } from '@nestjs/common';

export type Pt = [number, number];
export interface Sandtable {
  note: string | null; size: Pt;
  hills: Array<{ x: number; y: number; r: number; h: number; name?: string }>;
  rivers: Array<{ name?: string; points: Pt[]; width: number }>;
  sea: Array<{ x: number; y: number; w: number; h: number }>;
  markers: Array<{ id: string; kind: 'city' | 'camp' | 'stakes' | 'fort' | 'dock'; label: string; x: number; y: number }>;
  armies: Array<{ id: string; side: 'tran' | 'nguyen'; label: string; kind: 'foot' | 'cavalry' | 'fleet'; start: Pt }>;
  steps: Array<{ label: string; text: string; moves: Array<{ army: string; to: Pt; mode: 'advance' | 'retreat' | 'hold' }> }>;
}

const bad = (msg: string): never => { throw new BadRequestException(`Sa bàn: ${msg}`); };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const list = (v: unknown, max: number, label: string): unknown[] => {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > max) return bad(`${label} tối đa ${max} mục`);
  return v;
};
const str = (v: unknown, max: number, label: string, required = false): string => {
  const s = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  if (required && !s) return bad(`${label} không được để trống`);
  if (s.length > max) return bad(`${label} tối đa ${max} ký tự`);
  return s;
};
const num = (v: unknown, min: number, max: number, label: string): number => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return bad(`${label} phải từ ${min} đến ${max}`);
  return Math.round(n * 100) / 100;
};
const point = (v: unknown, w: number, h: number, label: string): Pt => {
  if (!Array.isArray(v) || v.length !== 2) return bad(`${label} cần dạng [x, y]`);
  return [num(v[0], 0, w, `${label} (x)`), num(v[1], 0, h, `${label} (y)`)];
};
const oneOf = <T extends string>(v: unknown, values: readonly T[], label: string): T => ((values as readonly string[]).includes(String(v)) ? (v as T) : bad(`${label} là một trong: ${values.join(', ')}`));

/** Trả về cảnh đã chuẩn hóa, hoặc null khi để trống; ném BadRequest tiếng Việt khi sai cấu trúc */
export function cleanSandtable(raw: unknown): Sandtable | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (!isObj(raw)) return bad('dữ liệu phải là một đối tượng JSON');
  const size: Pt = Array.isArray(raw.size) ? [num(raw.size[0], 40, 200, 'Chiều ngang'), num(raw.size[1], 30, 200, 'Chiều sâu')] : [100, 60];
  const [w, h] = size;
  const hills = list(raw.hills, 20, 'Đồi núi').map((x, i) => {
    const o = isObj(x) ? x : bad(`đồi ${i + 1} không hợp lệ`);
    return { x: num(o.x, 0, w, `Đồi ${i + 1} (x)`), y: num(o.y, 0, h, `Đồi ${i + 1} (y)`), r: num(o.r, 2, 40, `Đồi ${i + 1} (bán kính)`), h: num(o.h, 0.5, 12, `Đồi ${i + 1} (độ cao)`), ...(str(o.name, 60, `Tên đồi ${i + 1}`) ? { name: str(o.name, 60, 'Tên đồi') } : {}) };
  });
  const rivers = list(raw.rivers, 6, 'Sông').map((x, i) => {
    const o = isObj(x) ? x : bad(`sông ${i + 1} không hợp lệ`);
    const pts = list(o.points, 16, `Điểm của sông ${i + 1}`);
    if (pts.length < 2) bad(`sông ${i + 1} cần ít nhất 2 điểm`);
    return { ...(str(o.name, 60, `Tên sông ${i + 1}`) ? { name: str(o.name, 60, 'Tên sông') } : {}), points: pts.map((p, j) => point(p, w, h, `Sông ${i + 1}, điểm ${j + 1}`)), width: num(o.width ?? 8, 2, 20, `Sông ${i + 1} (bề rộng)`) };
  });
  const sea = list(raw.sea, 4, 'Biển').map((x, i) => {
    const o = isObj(x) ? x : bad(`vùng biển ${i + 1} không hợp lệ`);
    return { x: num(o.x, 0, w, `Biển ${i + 1} (x)`), y: num(o.y, 0, h, `Biển ${i + 1} (y)`), w: num(o.w, 1, w, `Biển ${i + 1} (rộng)`), h: num(o.h, 1, h, `Biển ${i + 1} (sâu)`) };
  });
  const markers = list(raw.markers, 20, 'Địa điểm').map((x, i) => {
    const o = isObj(x) ? x : bad(`địa điểm ${i + 1} không hợp lệ`);
    return { id: str(o.id, 30, `Mã địa điểm ${i + 1}`, true), kind: oneOf(o.kind, ['city', 'camp', 'stakes', 'fort', 'dock'] as const, `Loại địa điểm ${i + 1}`), label: str(o.label, 60, `Tên địa điểm ${i + 1}`, true), x: num(o.x, 0, w, `Địa điểm ${i + 1} (x)`), y: num(o.y, 0, h, `Địa điểm ${i + 1} (y)`) };
  });
  const armiesRaw = list(raw.armies, 8, 'Đội quân');
  if (!armiesRaw.length) bad('cần ít nhất 1 đội quân');
  const ids = new Set<string>();
  const armies = armiesRaw.map((x, i) => {
    const o = isObj(x) ? x : bad(`đội quân ${i + 1} không hợp lệ`);
    const id = str(o.id, 20, `Mã đội quân ${i + 1}`, true);
    if (!/^[a-z0-9_-]+$/.test(id) || ids.has(id)) bad(`mã đội quân "${id}" không hợp lệ hoặc bị trùng`);
    ids.add(id);
    return { id, side: oneOf(o.side, ['tran', 'nguyen'] as const, `Phe của đội ${i + 1}`), label: str(o.label, 60, `Tên đội quân ${i + 1}`, true), kind: oneOf(o.kind ?? 'foot', ['foot', 'cavalry', 'fleet'] as const, `Loại đội quân ${i + 1}`), start: point(o.start, w, h, `Vị trí xuất phát của đội ${i + 1}`) };
  });
  const stepsRaw = list(raw.steps, 12, 'Bước diễn biến');
  if (!stepsRaw.length) bad('cần ít nhất 1 bước diễn biến');
  const steps = stepsRaw.map((x, i) => {
    const o = isObj(x) ? x : bad(`bước ${i + 1} không hợp lệ`);
    const moves = list(o.moves, 8, `Di chuyển ở bước ${i + 1}`).map((m, j) => {
      const mo = isObj(m) ? m : bad(`di chuyển ${j + 1} của bước ${i + 1} không hợp lệ`);
      const army = String(mo.army ?? '');
      if (!ids.has(army)) bad(`bước ${i + 1} nhắc tới đội quân "${army}" chưa khai báo`);
      return { army, to: point(mo.to, w, h, `Đích của di chuyển ${j + 1}, bước ${i + 1}`), mode: oneOf(mo.mode ?? 'advance', ['advance', 'retreat', 'hold'] as const, `Kiểu di chuyển ${j + 1}, bước ${i + 1}`) };
    });
    return { label: str(o.label, 80, `Tên bước ${i + 1}`, true), text: str(o.text, 400, `Lời dẫn bước ${i + 1}`), moves };
  });
  return { note: str(raw.note, 300, 'Ghi chú') || null, size, hills, rivers, sea, markers, armies, steps };
}
