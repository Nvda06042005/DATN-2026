/**
 * Câu hỏi nhiều dạng (HK.GV.032, HK.HS.044–045): kiểm tra cấu trúc, tạo dạng hiển thị cho học sinh (không lộ đáp án), chấm điểm và tính thưởng.
 * Thuần hàm, không đụng cơ sở dữ liệu: máy chủ chấm mọi câu trả lời, trình duyệt chỉ hiển thị.
 */
import { BadRequestException } from '@nestjs/common';

export const QTYPES = ['single', 'multiple', 'truefalse', 'fill', 'order', 'map'] as const;
export type QType = (typeof QTYPES)[number];
export const QTYPE_LABEL: Record<QType, string> = {
  single: 'Một đáp án', multiple: 'Nhiều đáp án', truefalse: 'Đúng / sai', fill: 'Điền khuyết', order: 'Sắp xếp thứ tự', map: 'Kéo thả lên bản đồ',
};

export interface Option { id: string; text: string }
export interface MapTarget { id: string; label: string; lat: number; lng: number; radius_km: number }
export type QData =
  | { options: Option[]; correct: string }
  | { options: Option[]; correct: string[] }
  | { correct: boolean }
  | { blanks: Array<{ accept: string[] }> }
  | { items: Option[] }
  | { targets: MapTarget[] };

export interface QuestionCore { id: number; qtype: QType; prompt: string; image_url: string | null; video_url?: string | null; explanation: string | null; difficulty: number; data: Record<string, unknown> }

/** Khung bản đồ cho dạng kéo thả: lãnh thổ Việt Nam; địa danh ngoài khung bị từ chối để bản đồ luôn hiển thị được */
export const MAP_BOUNDS = { south: 8, north: 24, west: 102, east: 110 };
export const GRACE_MS = 3000;
export const DEFAULT_SECONDS = 20;
export const MAX_BONUS_RATIO = 0.5;

const bad = (message: string): never => {
  throw new BadRequestException(message);
};
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const clean = (v: unknown, max: number, label: string): string => {
  if (typeof v !== 'string') return bad(`${label} không hợp lệ`);
  const s = v.trim().replace(/\s+/g, ' ');
  if (!s) return bad(`${label} không được để trống`);
  if (s.length > max) return bad(`${label} tối đa ${max} ký tự`);
  return s;
};

const ID_RE = /^[a-z0-9_]{1,12}$/;
const letter = (i: number): string => String.fromCharCode(97 + i);

function options(raw: unknown, min: number, max: number, label: string): Option[] {
  if (!Array.isArray(raw)) return bad(`${label}: cần danh sách lựa chọn`);
  if (raw.length < min || raw.length > max) return bad(`${label}: cần từ ${min} đến ${max} lựa chọn`);
  const seen = new Set<string>();
  const texts = new Set<string>();
  return raw.map((o, i) => {
    const item: Record<string, unknown> = isObj(o) ? o : { text: o };
    const id = typeof item.id === 'string' && item.id ? item.id : letter(i);
    if (!ID_RE.test(id)) return bad(`${label}: mã lựa chọn ${i + 1} không hợp lệ`);
    if (seen.has(id)) return bad(`${label}: mã lựa chọn bị trùng`);
    seen.add(id);
    const text = clean(item.text, 200, `${label}: nội dung lựa chọn ${i + 1}`);
    if (texts.has(text.toLowerCase())) return bad(`${label}: hai lựa chọn trùng nội dung`);
    texts.add(text.toLowerCase());
    return { id, text };
  });
}

/** Kiểm tra và chuẩn hóa phần `data` theo dạng câu hỏi; ném BadRequest với thông báo tiếng Việt khi sai cấu trúc */
export function normalizeData(qtype: QType, raw: unknown, prompt: string): QData {
  if (!isObj(raw)) return bad('Nội dung câu hỏi không hợp lệ');
  if (qtype === 'single') {
    const opts = options(raw.options, 2, 6, 'Câu một đáp án');
    if (typeof raw.correct !== 'string' || !opts.some((o) => o.id === raw.correct)) return bad('Hãy chọn đúng một đáp án đúng trong các lựa chọn');
    return { options: opts, correct: raw.correct };
  }
  if (qtype === 'multiple') {
    const opts = options(raw.options, 3, 8, 'Câu nhiều đáp án');
    const correct = Array.isArray(raw.correct) ? [...new Set(raw.correct.filter((c): c is string => typeof c === 'string'))] : [];
    if (correct.length < 2) return bad('Câu nhiều đáp án cần ít nhất 2 đáp án đúng');
    if (correct.length >= opts.length) return bad('Không thể chọn tất cả lựa chọn là đáp án đúng');
    if (!correct.every((c) => opts.some((o) => o.id === c))) return bad('Đáp án đúng phải nằm trong các lựa chọn');
    return { options: opts, correct };
  }
  if (qtype === 'truefalse') {
    if (typeof raw.correct !== 'boolean') return bad('Hãy chọn đáp án đúng là "Đúng" hoặc "Sai"');
    return { correct: raw.correct };
  }
  if (qtype === 'fill') {
    if (!Array.isArray(raw.blanks) || raw.blanks.length < 1 || raw.blanks.length > 5) return bad('Câu điền khuyết cần từ 1 đến 5 chỗ trống');
    const markers = prompt.match(/_{3,}/g)?.length ?? 0;
    if (markers !== raw.blanks.length) return bad(`Câu hỏi có ${markers} chỗ trống "____" nhưng khai báo ${raw.blanks.length} đáp án`);
    const blanks = raw.blanks.map((b, i) => {
      const accept = isObj(b) && Array.isArray(b.accept) ? b.accept : Array.isArray(b) ? b : [b];
      const list = [...new Set(accept.map((a) => clean(a, 100, `Đáp án chỗ trống ${i + 1}`)))];
      if (!list.length || list.length > 6) return bad(`Chỗ trống ${i + 1} cần từ 1 đến 6 cách viết được chấp nhận`);
      return { accept: list };
    });
    return { blanks };
  }
  if (qtype === 'order') {
    // Danh sách được nhập theo đúng thứ tự; học sinh nhận bản đã xáo trộn
    const items = options(raw.items, 3, 8, 'Câu sắp xếp');
    return { items };
  }
  if (!Array.isArray(raw.targets) || raw.targets.length < 1 || raw.targets.length > 5) return bad('Câu kéo thả bản đồ cần từ 1 đến 5 địa danh');
  const ids = new Set<string>();
  const targets = raw.targets.map((t, i): MapTarget => {
    if (!isObj(t)) return bad(`Địa danh ${i + 1} không hợp lệ`);
    const id = typeof t.id === 'string' && t.id ? t.id : letter(i);
    if (!ID_RE.test(id) || ids.has(id)) return bad(`Mã địa danh ${i + 1} không hợp lệ hoặc bị trùng`);
    ids.add(id);
    const lat = Number(t.lat);
    const lng = Number(t.lng);
    const radius = t.radius_km === undefined || t.radius_km === null || t.radius_km === '' ? 40 : Number(t.radius_km);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < MAP_BOUNDS.south || lat > MAP_BOUNDS.north || lng < MAP_BOUNDS.west || lng > MAP_BOUNDS.east) {
      return bad(`Vị trí địa danh ${i + 1} phải nằm trong khung bản đồ Việt Nam`);
    }
    if (!Number.isFinite(radius) || radius < 5 || radius > 300) return bad(`Bán kính chấp nhận của địa danh ${i + 1} phải từ 5 đến 300 km`);
    return { id, label: clean(t.label, 80, `Tên địa danh ${i + 1}`), lat: Math.round(lat * 10000) / 10000, lng: Math.round(lng * 10000) / 10000, radius_km: radius };
  });
  return { targets };
}

/** Chuỗi để tìm kiếm: đề bài + nội dung các lựa chọn */
export function dataText(data: Record<string, unknown>): string {
  const d = data as Record<string, unknown>;
  const parts: string[] = [];
  if (Array.isArray(d.options)) parts.push(...(d.options as Option[]).map((o) => o.text));
  if (Array.isArray(d.items)) parts.push(...(d.items as Option[]).map((o) => o.text));
  if (Array.isArray(d.targets)) parts.push(...(d.targets as MapTarget[]).map((t) => t.label));
  if (Array.isArray(d.blanks)) parts.push(...(d.blanks as Array<{ accept: string[] }>).flatMap((b) => b.accept));
  return parts.join(' ');
}

// ------------------------------------------------------------------ xáo trộn có hạt giống (cùng lượt làm bài luôn thấy cùng thứ tự)
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(list: T[], seed: number): T[] {
  const rnd = mulberry32(seed);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Xáo trộn nhưng không bao giờ trùng thứ tự gốc (dùng cho dạng sắp xếp) */
function shuffleDifferent<T>(list: T[], seed: number): T[] {
  for (let k = 0; k < 8; k++) {
    const out = seededShuffle(list, seed + k * 7919);
    if (out.some((v, i) => v !== list[i])) return out;
  }
  return [...list.slice(1), list[0]];
}

/** Dạng hiển thị cho học sinh: có đề, lựa chọn (đã xáo nếu bộ đề yêu cầu) nhưng không có đáp án đúng */
export function publicView(q: QuestionCore, seed: number, shuffleOptions: boolean): Record<string, unknown> {
  const base = { id: q.id, qtype: q.qtype, prompt: q.prompt, image_url: q.image_url, video_url: q.video_url ?? null, difficulty: q.difficulty };
  const d = q.data as Record<string, any>;
  if (q.qtype === 'single' || q.qtype === 'multiple') {
    const opts = (d.options as Option[]).map((o) => ({ id: o.id, text: o.text }));
    // `shape` là vị trí của đáp án trên màn chiếu (▲ ◆ ● ■); giữ nguyên khi thiết bị học sinh xáo lại thứ tự hiển thị
    return { ...base, options: (shuffleOptions ? seededShuffle(opts, seed) : opts).map((o, shape) => ({ ...o, shape })) };
  }
  if (q.qtype === 'truefalse') return base;
  if (q.qtype === 'fill') return { ...base, blanks: (d.blanks as unknown[]).length };
  if (q.qtype === 'order') return { ...base, items: shuffleDifferent((d.items as Option[]).map((o) => ({ id: o.id, text: o.text })), seed) };
  return { ...base, targets: (d.targets as MapTarget[]).map((t) => ({ id: t.id, label: t.label })), bounds: MAP_BOUNDS };
}

// ------------------------------------------------------------------ chấm điểm
/** So sánh chữ điền khuyết: bỏ khoảng trắng thừa, không phân biệt hoa thường và dấu câu cuối; vẫn giữ dấu tiếng Việt vì dấu làm đổi nghĩa */
export const normalizeAnswer = (s: string): string =>
  s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim().replace(/^[\s"'“”‘’(]+|[\s"'“”‘’).,;:!?]+$/g, '');

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface GradeResult { correct: boolean; detail?: unknown }

/** Chấm một câu trả lời. Dữ liệu sai cấu trúc coi là sai, không báo lỗi để không lộ thông tin về đáp án. */
export function grade(q: Pick<QuestionCore, 'qtype' | 'data'>, answer: unknown): GradeResult {
  const d = q.data as Record<string, any>;
  const a = isObj(answer) ? answer : {};
  if (q.qtype === 'single') return { correct: typeof a.choice === 'string' && a.choice === d.correct };
  if (q.qtype === 'multiple') {
    const picked = Array.isArray(a.choices) ? [...new Set(a.choices.filter((c): c is string => typeof c === 'string'))] : [];
    const want = d.correct as string[];
    return { correct: picked.length === want.length && want.every((c) => picked.includes(c)) };
  }
  if (q.qtype === 'truefalse') return { correct: typeof a.value === 'boolean' && a.value === d.correct };
  if (q.qtype === 'fill') {
    const given = Array.isArray(a.blanks) ? a.blanks : [];
    const blanks = d.blanks as Array<{ accept: string[] }>;
    const each = blanks.map((b, i) => typeof given[i] === 'string' && b.accept.some((x) => normalizeAnswer(x) === normalizeAnswer(given[i] as string)));
    return { correct: each.every(Boolean), detail: each };
  }
  if (q.qtype === 'order') {
    const want = (d.items as Option[]).map((o) => o.id);
    const got = Array.isArray(a.order) ? a.order : [];
    return { correct: got.length === want.length && want.every((id, i) => got[i] === id) };
  }
  const placements = isObj(a.placements) ? a.placements : {};
  const detail = (d.targets as MapTarget[]).map((t) => {
    const p = placements[t.id];
    const lat = isObj(p) ? Number(p.lat) : NaN;
    const lng = isObj(p) ? Number(p.lng) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { id: t.id, ok: false, distance_km: null as number | null };
    const km = distanceKm({ lat, lng }, t);
    return { id: t.id, ok: km <= t.radius_km, distance_km: Math.round(km) };
  });
  return { correct: detail.every((x) => x.ok), detail };
}

// ------------------------------------------------------------------ điểm thưởng tốc độ và sao
/** Trả lời đúng càng sớm càng được thưởng, tối đa bằng một nửa điểm gốc của câu (HK.HS.045) */
export function bonusPoints(base: number, limitSeconds: number, elapsedMs: number, ratio: number = MAX_BONUS_RATIO): number {
  const limit = limitSeconds * 1000;
  const left = Math.max(0, limit - Math.max(0, elapsedMs));
  return Math.round(base * ratio * (left / limit));
}

/**
 * Sao ở nút (HK.HS.022): chưa đạt 0; đạt ngưỡng 1; đúng từ 80% thì 2; 3 sao khi đúng tuyệt đối,
 * hoặc đúng từ 90% và dùng không quá 70% tổng thời gian cho phép.
 */
export function starsFor(percent: number, passPercent: number, timeRatio: number): number {
  if (percent < passPercent) return 0;
  if (percent >= 100 || (percent >= 90 && timeRatio <= 0.7)) return 3;
  return percent >= 80 ? 2 : 1;
}
