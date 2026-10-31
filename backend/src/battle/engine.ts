/**
 * Engine mô phỏng trận đánh và mini-game (HK.HS.028, 051–060, HK.AD.046–047): kiểm tra cấu trúc kịch bản/tham số do quản trị soạn, dựng dạng hiển thị cho học sinh
 * (không có đáp án), chấm từng bước, tổng kết lượt và xếp ô chữ. Hàm thuần, không truy cập cơ sở dữ liệu; mọi lỗi dữ liệu là BadRequest tiếng Việt chỉ rõ vị trí.
 */
import { BadRequestException } from '@nestjs/common';
import { MAP_BOUNDS, distanceKm, seededShuffle } from '../content/questions';
import { searchText } from '../database/database.service';

export interface Link { ref_type: string; ref_id: number }
export interface DecisionOption { id: string; text: string; score: number; feedback: string; consequence: string | null }
export interface Piece { id: string; label: string }
export interface Zone { id: string; label: string; lat: number; lng: number; radius_km: number }
export interface DecisionStep { id: string; type: 'decision'; title: string; situation: string; options: DecisionOption[]; links: Link[] }
export interface PlacementStep {
  id: string; type: 'placement'; title: string; situation: string; pieces: Piece[]; zones: Zone[]; accept: Record<string, string[]>; score: number;
  feedback_ok: string; feedback_bad: string; links: Link[];
}
export type Step = DecisionStep | PlacementStep;
export interface Unit { id: string; side: 'tran' | 'dich'; label: string; lat: number; lng: number }
export interface Frame { label: string; text: string | null; units: Unit[] }
export interface Scenario {
  intro: { situation: string; forces: string | null; objective: string };
  map: { center: [number, number]; zoom: number };
  steps: Step[];
  animation: { title: string | null; frames: Frame[] } | null;
  pass_percent: number;
  bonus_points: number;
}

const bad = (msg: string): never => { throw new BadRequestException(msg); };
const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const ID = /^[a-z0-9_-]{1,24}$/;

function text(v: unknown, label: string, max: number, required = true): string {
  const s = typeof v === 'string' ? v.trim().replace(/[ \t]+/g, ' ') : '';
  if (!s && required) bad(`${label}: không được để trống`);
  if (s.length > max) bad(`${label}: tối đa ${max} ký tự`);
  return s;
}
function int(v: unknown, label: string, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) bad(`${label}: số nguyên từ ${min} đến ${max}`);
  return n;
}
function coord(lat: unknown, lng: unknown, label: string): [number, number] {
  const a = Number(lat), b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < MAP_BOUNDS.south || a > MAP_BOUNDS.north || b < MAP_BOUNDS.west || b > MAP_BOUNDS.east) {
    bad(`${label}: tọa độ phải nằm trong khung bản đồ Việt Nam (vĩ độ ${MAP_BOUNDS.south}–${MAP_BOUNDS.north}, kinh độ ${MAP_BOUNDS.west}–${MAP_BOUNDS.east})`);
  }
  return [Math.round(a * 1e5) / 1e5, Math.round(b * 1e5) / 1e5];
}
function ids(list: Array<{ id: string }>, label: string): void {
  if (new Set(list.map((x) => x.id)).size !== list.length) bad(`${label}: mã không được trùng nhau`);
}
function links(raw: unknown, label: string): Link[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > 6) bad(`${label}: tối đa 6 liên kết lịch sử`);
  return (raw as unknown[]).map((l, i) => {
    if (!isObj(l) || !['campaign', 'figure', 'event', 'place', 'battle', 'source'].includes(l.ref_type) || !Number.isInteger(Number(l.ref_id))) bad(`${label}: liên kết ${i + 1} không hợp lệ`);
    return { ref_type: String((l as Record<string, unknown>).ref_type), ref_id: Number((l as Record<string, unknown>).ref_id) };
  });
}

// ------------------------------------------------------------------ kịch bản trận đánh (HK.AD.046)
export function normalizeScenario(raw: unknown): Scenario {
  if (!isObj(raw)) return bad('Kịch bản phải là một đối tượng JSON');
  const intro = isObj(raw.intro) ? raw.intro : bad('Thiếu phần giới thiệu (intro)');
  const map = isObj(raw.map) ? raw.map : bad('Thiếu thông tin bản đồ (map)');
  const center = Array.isArray(map.center) && map.center.length === 2 ? coord(map.center[0], map.center[1], 'Tâm bản đồ') : bad('Tâm bản đồ: cần [vĩ độ, kinh độ]');
  const stepsRaw = Array.isArray(raw.steps) ? raw.steps : bad('Thiếu danh sách bước (steps)');
  if (stepsRaw.length < 2 || stepsRaw.length > 10) bad('Kịch bản cần từ 2 đến 10 bước');
  const steps: Step[] = stepsRaw.map((s: unknown, i: number): Step => {
    const where = `Bước ${i + 1}`;
    if (!isObj(s)) return bad(`${where}: không hợp lệ`);
    const id = typeof s.id === 'string' && ID.test(s.id) ? s.id : bad(`${where}: mã bước gồm chữ thường, số, gạch (tối đa 24 ký tự)`);
    const common = { id, title: text(s.title, `${where} – tiêu đề`, 120), situation: text(s.situation, `${where} – tình huống`, 1200), links: links(s.links, where) };
    if (s.type === 'decision') {
      const optsRaw = Array.isArray(s.options) ? s.options : bad(`${where}: thiếu lựa chọn`);
      if (optsRaw.length < 2 || optsRaw.length > 5) bad(`${where}: cần từ 2 đến 5 lựa chọn`);
      const options = optsRaw.map((o: unknown, j: number): DecisionOption => {
        if (!isObj(o) || typeof o.id !== 'string' || !ID.test(o.id)) return bad(`${where}, lựa chọn ${j + 1}: mã không hợp lệ`);
        return {
          id: o.id, text: text(o.text, `${where}, lựa chọn ${j + 1} – nội dung`, 300), score: int(o.score, `${where}, lựa chọn ${j + 1} – điểm`, 0, 100),
          feedback: text(o.feedback, `${where}, lựa chọn ${j + 1} – phản hồi lịch sử`, 800), consequence: text(o.consequence, `${where}, lựa chọn ${j + 1} – hệ quả`, 400, false) || null,
        };
      });
      ids(options, `${where} – lựa chọn`);
      if (Math.max(...options.map((o) => o.score)) <= 0) bad(`${where}: phải có ít nhất một lựa chọn được điểm`);
      return { ...common, type: 'decision', options };
    }
    if (s.type === 'placement') {
      const piecesRaw = Array.isArray(s.pieces) ? s.pieces : bad(`${where}: thiếu lực lượng cần bố trí (pieces)`);
      const zonesRaw = Array.isArray(s.zones) ? s.zones : bad(`${where}: thiếu khu vực (zones)`);
      if (piecesRaw.length < 1 || piecesRaw.length > 6) bad(`${where}: cần từ 1 đến 6 lực lượng`);
      if (zonesRaw.length < 2 || zonesRaw.length > 8) bad(`${where}: cần từ 2 đến 8 khu vực`);
      const pieces = piecesRaw.map((p: unknown, j: number): Piece => {
        if (!isObj(p) || typeof p.id !== 'string' || !ID.test(p.id)) return bad(`${where}, lực lượng ${j + 1}: mã không hợp lệ`);
        return { id: p.id, label: text(p.label, `${where}, lực lượng ${j + 1} – tên`, 60) };
      });
      const zones = zonesRaw.map((z: unknown, j: number): Zone => {
        if (!isObj(z) || typeof z.id !== 'string' || !ID.test(z.id)) return bad(`${where}, khu vực ${j + 1}: mã không hợp lệ`);
        const [lat, lng] = coord(z.lat, z.lng, `${where}, khu vực ${j + 1}`);
        const radius = Number(z.radius_km);
        if (!Number.isFinite(radius) || radius < 1 || radius > 100) bad(`${where}, khu vực ${j + 1}: bán kính từ 1 đến 100 km`);
        return { id: z.id, label: text(z.label, `${where}, khu vực ${j + 1} – tên`, 60), lat, lng, radius_km: radius };
      });
      ids(pieces, `${where} – lực lượng`);
      ids(zones, `${where} – khu vực`);
      const acceptRaw = isObj(s.accept) ? s.accept : bad(`${where}: thiếu bảng khu vực chấp nhận (accept)`);
      const accept: Record<string, string[]> = {};
      for (const p of pieces) {
        const list = acceptRaw[p.id];
        if (!Array.isArray(list) || !list.length || !list.every((z) => zones.some((zone) => zone.id === z))) bad(`${where}: lực lượng "${p.label}" cần danh sách khu vực chấp nhận hợp lệ`);
        accept[p.id] = [...new Set(list as string[])];
      }
      return {
        ...common, type: 'placement', pieces, zones, accept, score: int(s.score, `${where} – điểm`, 1, 100),
        feedback_ok: text(s.feedback_ok, `${where} – phản hồi khi đúng`, 800), feedback_bad: text(s.feedback_bad, `${where} – phản hồi khi chưa đúng`, 800),
      };
    }
    return bad(`${where}: loại bước phải là "decision" hoặc "placement"`);
  });
  ids(steps, 'Các bước');

  let animation: Scenario['animation'] = null;
  if (raw.animation !== undefined && raw.animation !== null) {
    const a = isObj(raw.animation) ? raw.animation : bad('Hoạt ảnh (animation) không hợp lệ');
    const framesRaw = Array.isArray(a.frames) ? a.frames : bad('Hoạt ảnh cần danh sách khung (frames)');
    if (framesRaw.length < 2 || framesRaw.length > 12) bad('Hoạt ảnh cần từ 2 đến 12 khung');
    animation = {
      title: text(a.title, 'Hoạt ảnh – tiêu đề', 120, false) || null,
      frames: framesRaw.map((f: unknown, i: number): Frame => {
        if (!isObj(f) || !Array.isArray(f.units) || f.units.length < 1 || f.units.length > 8) return bad(`Khung ${i + 1}: cần từ 1 đến 8 đơn vị`);
        const units = f.units.map((u: unknown, j: number): Unit => {
          if (!isObj(u) || typeof u.id !== 'string' || !ID.test(u.id) || (u.side !== 'tran' && u.side !== 'dich')) return bad(`Khung ${i + 1}, đơn vị ${j + 1}: cần mã và phe "tran" hoặc "dich"`);
          const [lat, lng] = coord(u.lat, u.lng, `Khung ${i + 1}, đơn vị ${j + 1}`);
          return { id: u.id, side: u.side, label: text(u.label, `Khung ${i + 1}, đơn vị ${j + 1} – tên`, 60), lat, lng };
        });
        ids(units, `Khung ${i + 1} – đơn vị`);
        return { label: text(f.label, `Khung ${i + 1} – nhãn`, 120), text: text(f.text, `Khung ${i + 1} – mô tả`, 300, false) || null, units };
      }),
    };
  }
  return {
    intro: { situation: text(intro.situation, 'Giới thiệu – tình hình', 1500), forces: text(intro.forces, 'Giới thiệu – lực lượng', 800, false) || null, objective: text(intro.objective, 'Giới thiệu – nhiệm vụ', 400) },
    map: { center, zoom: map.zoom === undefined ? 9 : int(map.zoom, 'Mức thu phóng bản đồ', 5, 13) },
    steps, animation,
    pass_percent: raw.pass_percent === undefined ? 60 : int(raw.pass_percent, 'Điều kiện thắng (% điểm)', 1, 100),
    bonus_points: raw.bonus_points === undefined ? 150 : int(raw.bonus_points, 'Điểm thưởng toàn thắng', 0, 1000),
  };
}

export const stepMax = (s: Step): number => (s.type === 'decision' ? Math.max(...s.options.map((o) => o.score)) : s.score);
export const scenarioMax = (sc: Scenario): number => sc.steps.reduce((n, s) => n + stepMax(s), 0);

/** Dạng bước cho học sinh: không có điểm, phản hồi hay khu vực chấp nhận; lựa chọn được xáo theo hạt giống của lượt chơi */
export function publicStep(s: Step, index: number, total: number, seed: number): Record<string, unknown> {
  const base = { id: s.id, type: s.type, title: s.title, situation: s.situation, index, total };
  if (s.type === 'decision') return { ...base, options: seededShuffle(s.options.map((o) => ({ id: o.id, text: o.text })), seed + index * 31) };
  return { ...base, pieces: s.pieces, zones: s.zones.map((z) => ({ id: z.id, label: z.label, lat: z.lat, lng: z.lng, radius_km: z.radius_km })) };
}

export interface StepOutcome {
  step_id: string; title: string; correct: boolean; score: number; max: number; answer: unknown; feedback: string; consequence: string | null; links: Link[]; best: string | null;
  pieces?: Array<{ id: string; label: string; ok: boolean }>;
}

/** Chấm một bước; trả lỗi 400 nếu câu trả lời sai cấu trúc */
export function evaluateStep(s: Step, answer: unknown): StepOutcome {
  if (s.type === 'decision') {
    const choice = isObj(answer) ? answer.choice : undefined;
    const option = s.options.find((o) => o.id === choice);
    if (!option) return bad('Hãy chọn một trong các phương án');
    const max = stepMax(s);
    const best = s.options.filter((o) => o.score === max).map((o) => o.text).join(' / ');
    return { step_id: s.id, title: s.title, correct: option.score === max, score: option.score, max, answer: { choice: option.id }, feedback: option.feedback, consequence: option.consequence, links: s.links, best };
  }
  const placements = isObj(answer) && isObj(answer.placements) ? answer.placements : bad('Hãy đặt lực lượng lên bản đồ');
  const results = s.pieces.map((p) => {
    const at = placements[p.id];
    const lat = isObj(at) ? Number(at.lat) : NaN, lng = isObj(at) ? Number(at.lng) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return bad(`Hãy đặt "${p.label}" lên bản đồ`);
    const ok = s.accept[p.id].some((zid) => {
      const z = s.zones.find((zone) => zone.id === zid)!;
      return distanceKm({ lat, lng }, z) <= z.radius_km;
    });
    return { id: p.id, label: p.label, ok };
  });
  const okCount = results.filter((r) => r.ok).length;
  const correct = okCount === results.length;
  const best = s.pieces.map((p) => `${p.label}: ${s.accept[p.id].map((zid) => s.zones.find((z) => z.id === zid)!.label).join(' hoặc ')}`).join('; ');
  return {
    step_id: s.id, title: s.title, correct, score: Math.round((s.score * okCount) / results.length), max: s.score, pieces: results,
    answer: { placements: Object.fromEntries(s.pieces.map((p) => [p.id, { lat: Number(placements[p.id].lat), lng: Number(placements[p.id].lng) }])) },
    feedback: correct ? s.feedback_ok : s.feedback_bad, consequence: null, links: s.links, best,
  };
}

export interface Tally { score: number; max: number; bonus: number; percent: number; stars: number; passed: boolean; full: boolean }

/** Tổng kết lượt (HK.HS.056): thắng khi đủ % điểm; toàn thắng (đúng mọi bước) được điểm thưởng; sao 1 / 2 (từ 80%) / 3 (toàn thắng) */
export function tally(sc: Scenario, outcomes: StepOutcome[]): Tally {
  const score = outcomes.reduce((n, o) => n + o.score, 0);
  const max = scenarioMax(sc);
  const percent = max ? Math.round((score / max) * 100) : 0;
  const passed = percent >= sc.pass_percent;
  const full = passed && outcomes.length === sc.steps.length && outcomes.every((o) => o.correct);
  return { score, max, bonus: full ? sc.bonus_points : 0, percent, stars: !passed ? 0 : full ? 3 : percent >= 80 ? 2 : 1, passed, full };
}

// ------------------------------------------------------------------ mini-game (HK.AD.047)
export type MiniKind = 'match' | 'timeline' | 'crossword';
export const MINI_LABEL: Record<MiniKind, string> = { match: 'Ghép thẻ', timeline: 'Sắp xếp dòng thời gian', crossword: 'Ô chữ lịch sử' };
export const MINI_PASS_PERCENT = 60;

export interface MatchParams { left_label: string; right_label: string; pairs: Array<{ id: string; left: string; right: string }> }
export interface TimelineParams { items: Array<{ id: string; text: string; key: number; when: string }> }
export interface CrosswordWord { id: string; answer: string; clue: string }
export interface Placed { id: string; row: number; col: number; dir: 'across' | 'down'; length: number; number: number }
export interface CrosswordParams { words: CrosswordWord[]; layout: { rows: number; cols: number; words: Placed[] } }

/** Chữ cái để so khớp ô chữ: bỏ dấu, chỉ giữ A–Z và 0–9 */
export const crosswordLetters = (s: string): string => searchText(s).replace(/[^a-z0-9]/g, '').toUpperCase();

export function normalizeMinigame(kind: MiniKind, raw: unknown): MatchParams | TimelineParams | CrosswordParams {
  if (!isObj(raw)) return bad('Tham số mini-game phải là một đối tượng');
  if (kind === 'match') {
    const pairsRaw = Array.isArray(raw.pairs) ? raw.pairs : bad('Thiếu danh sách cặp (pairs)');
    if (pairsRaw.length < 3 || pairsRaw.length > 10) bad('Ghép thẻ cần từ 3 đến 10 cặp');
    const pairs = pairsRaw.map((p: unknown, i: number) => {
      if (!isObj(p)) return bad(`Cặp ${i + 1}: không hợp lệ`);
      return { id: typeof p.id === 'string' && ID.test(p.id) ? p.id : `p${i + 1}`, left: text(p.left, `Cặp ${i + 1} – thẻ bên trái`, 80), right: text(p.right, `Cặp ${i + 1} – thẻ bên phải`, 80) };
    });
    ids(pairs, 'Các cặp');
    if (new Set(pairs.map((p) => p.left.toLowerCase())).size !== pairs.length || new Set(pairs.map((p) => p.right.toLowerCase())).size !== pairs.length) bad('Mỗi thẻ chỉ được xuất hiện trong một cặp');
    return { left_label: text(raw.left_label, 'Tên nhóm thẻ trái', 40, false) || 'Nhân vật', right_label: text(raw.right_label, 'Tên nhóm thẻ phải', 40, false) || 'Sự kiện', pairs };
  }
  if (kind === 'timeline') {
    const itemsRaw = Array.isArray(raw.items) ? raw.items : bad('Thiếu danh sách sự kiện (items)');
    if (itemsRaw.length < 3 || itemsRaw.length > 10) bad('Dòng thời gian cần từ 3 đến 10 sự kiện');
    const items = itemsRaw.map((it: unknown, i: number) => {
      if (!isObj(it)) return bad(`Sự kiện ${i + 1}: không hợp lệ`);
      const key = Number(it.key);
      if (!Number.isFinite(key)) bad(`Sự kiện ${i + 1}: thiếu mốc sắp xếp (key, ví dụ 12580128 cho 28/1/1258)`);
      return { id: typeof it.id === 'string' && ID.test(it.id) ? it.id : `e${i + 1}`, text: text(it.text, `Sự kiện ${i + 1} – nội dung`, 120), key, when: text(it.when, `Sự kiện ${i + 1} – thời gian hiển thị sau khi trả lời`, 40, false) };
    });
    ids(items, 'Các sự kiện');
    if (new Set(items.map((x) => x.key)).size !== items.length) bad('Các mốc thời gian (key) không được trùng nhau để thứ tự đúng là duy nhất');
    return { items };
  }
  const wordsRaw = Array.isArray(raw.words) ? raw.words : bad('Thiếu danh sách từ (words)');
  if (wordsRaw.length < 3 || wordsRaw.length > 8) bad('Ô chữ cần từ 3 đến 8 từ');
  const words: CrosswordWord[] = wordsRaw.map((w: unknown, i: number) => {
    if (!isObj(w)) return bad(`Từ ${i + 1}: không hợp lệ`);
    const answer = text(w.answer, `Từ ${i + 1} – đáp án`, 40);
    const letters = crosswordLetters(answer);
    if (letters.length < 3 || letters.length > 14) bad(`Từ ${i + 1}: đáp án cần 3–14 chữ cái (không tính dấu và khoảng trắng)`);
    return { id: typeof w.id === 'string' && ID.test(w.id) ? w.id : `w${i + 1}`, answer, clue: text(w.clue, `Từ ${i + 1} – gợi ý`, 200) };
  });
  ids(words, 'Các từ');
  return { words, layout: layoutCrossword(words) };
}

/** Xếp các từ giao nhau (bỏ dấu): từ dài nhất nằm ngang trước, từ sau bắt chéo qua chữ cái chung, không chạm cạnh nhau ngoài chỗ giao */
export function layoutCrossword(words: CrosswordWord[]): CrosswordParams['layout'] {
  const items = words.map((w) => ({ id: w.id, letters: crosswordLetters(w.answer) })).sort((a, b) => b.letters.length - a.letters.length);
  const cells = new Map<string, string>();
  const key = (r: number, c: number) => `${r},${c}`;
  const placed: Array<{ id: string; row: number; col: number; dir: 'across' | 'down'; length: number }> = [];
  const fits = (letters: string, row: number, col: number, dir: 'across' | 'down'): boolean => {
    const dr = dir === 'down' ? 1 : 0, dc = dir === 'across' ? 1 : 0;
    if (cells.has(key(row - dr, col - dc)) || cells.has(key(row + dr * letters.length, col + dc * letters.length))) return false;
    let crossings = 0;
    for (let i = 0; i < letters.length; i++) {
      const r = row + dr * i, c = col + dc * i;
      const have = cells.get(key(r, c));
      if (have !== undefined) { if (have !== letters[i]) return false; crossings += 1; continue; }
      // ô mới không được nằm sát một từ khác theo chiều vuông góc
      if (cells.has(key(r + dc, c + dr)) || cells.has(key(r - dc, c - dr))) return false;
    }
    return placed.length === 0 || crossings > 0;
  };
  const put = (it: { id: string; letters: string }, row: number, col: number, dir: 'across' | 'down') => {
    for (let i = 0; i < it.letters.length; i++) cells.set(key(row + (dir === 'down' ? i : 0), col + (dir === 'across' ? i : 0)), it.letters[i]);
    placed.push({ id: it.id, row, col, dir, length: it.letters.length });
  };
  for (const it of items) {
    if (!placed.length) { put(it, 0, 0, 'across'); continue; }
    let best: { row: number; col: number; dir: 'across' | 'down'; area: number } | null = null;
    for (const p of placed) {
      const dir: 'across' | 'down' = p.dir === 'across' ? 'down' : 'across';
      for (let i = 0; i < p.length; i++) {
        const r0 = p.row + (p.dir === 'down' ? i : 0), c0 = p.col + (p.dir === 'across' ? i : 0);
        const ch = cells.get(key(r0, c0))!;
        for (let j = 0; j < it.letters.length; j++) {
          if (it.letters[j] !== ch) continue;
          const row = dir === 'down' ? r0 - j : r0, col = dir === 'across' ? c0 - j : c0;
          if (!fits(it.letters, row, col, dir)) continue;
          const all = [...cells.keys()].map((k) => k.split(',').map(Number));
          const rs = [...all.map((a) => a[0]), row, row + (dir === 'down' ? it.letters.length - 1 : 0)];
          const cs = [...all.map((a) => a[1]), col, col + (dir === 'across' ? it.letters.length - 1 : 0)];
          const area = (Math.max(...rs) - Math.min(...rs) + 1) * (Math.max(...cs) - Math.min(...cs) + 1);
          if (!best || area < best.area) best = { row, col, dir, area };
        }
      }
    }
    if (!best) bad(`Không xếp được từ "${words.find((w) => w.id === it.id)!.answer}" vào ô chữ: hãy đổi từ có chữ cái chung với các từ khác`);
    put(it, best!.row, best!.col, best!.dir);
  }
  const minR = Math.min(...placed.map((p) => p.row)), minC = Math.min(...placed.map((p) => p.col));
  const shifted = placed.map((p) => ({ ...p, row: p.row - minR, col: p.col - minC }));
  const rows = Math.max(...shifted.map((p) => p.row + (p.dir === 'down' ? p.length : 1)));
  const cols = Math.max(...shifted.map((p) => p.col + (p.dir === 'across' ? p.length : 1)));
  // Đánh số theo thứ tự đọc (hàng rồi cột) ở ô bắt đầu; hai từ cùng ô bắt đầu dùng chung một số
  const starts = [...new Set(shifted.map((p) => `${p.row},${p.col}`))].sort((a, b) => { const [r1, c1] = a.split(',').map(Number), [r2, c2] = b.split(',').map(Number); return r1 - r2 || c1 - c2; });
  return { rows, cols, words: shifted.map((p) => ({ ...p, number: starts.indexOf(`${p.row},${p.col}`) + 1 })).sort((a, b) => a.number - b.number || (a.dir === 'across' ? -1 : 1)) };
}

export interface MiniTally { score: number; max: number; percent: number; stars: number; passed: boolean }
export function miniTally(points: number, units: number, total: number, penalty = 0): MiniTally {
  const max = points;
  const score = Math.max(0, Math.round((points * units) / Math.max(1, total)) - penalty);
  const percent = max ? Math.min(100, Math.round((score / max) * 100)) : 0;
  const passed = percent >= MINI_PASS_PERCENT;
  return { score, max, percent, passed, stars: !passed ? 0 : percent >= 100 ? 3 : percent >= 80 ? 2 : 1 };
}
