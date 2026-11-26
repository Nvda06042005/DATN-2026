/**
 * Minigame luyện tập của Hành trình Đông A (hàm thuần, không đụng cơ sở dữ liệu): năm mẫu dùng lại cho mọi chặng.
 *   quiz     – trắc nghiệm ngắn có giải thích
 *   tactic   – quyết định chiến thuật theo tình huống (mỗi phương án có phản hồi và mức điểm)
 *   sequence – xếp trình tự diễn biến (bấm chọn hoặc kéo thả)
 *   pairs    – lật thẻ ghép hai nội dung liên quan (nhân vật – vai trò, sự kiện – địa điểm)
 *   locate   – chọn địa điểm trên bản đồ của cuộc kháng chiến
 * Máy chủ chấm mọi câu: dạng gửi cho học sinh (`publicItem`) không chứa đáp án; thẻ ghép cặp mang mã ngẫu nhiên theo phiên nên không suy ra được cặp đúng.
 */
import { BadRequestException } from '@nestjs/common';
import { seededShuffle } from '../content/questions';

export const ITEM_KINDS = ['quiz', 'pairs', 'sequence', 'locate', 'tactic'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];
export const KIND_LABEL: Record<ItemKind, string> = { quiz: 'Trắc nghiệm', pairs: 'Lật thẻ ghép cặp', sequence: 'Xếp trình tự', locate: 'Chọn địa điểm', tactic: 'Quyết định chiến thuật' };

export interface Opt { id: string; text: string }
export interface QuizData { options: Opt[]; correct: string }
export interface TacticData { situation: string; options: Array<Opt & { feedback: string; score: 0 | 1 | 2 }> }
export interface SequenceData { items: Array<Opt & { when?: string }> }
export interface PairsData { left_label: string; right_label: string; pairs: Array<{ id: string; left: string; right: string }> }
export interface LocateData { campaign_no: number; spots: Array<{ id: string; label: string; x: number; y: number }>; correct: string }
export type ItemData = QuizData | TacticData | SequenceData | PairsData | LocateData;

export interface ItemRow { id: number; kind: ItemKind; prompt: string; data: Record<string, any>; explanation: string; objective: string; source: string }

const bad = (m: string): never => { throw new BadRequestException(m); };
const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const ID = /^[a-z0-9_]{1,12}$/;
const str = (v: unknown, label: string, max: number): string => {
  if (typeof v !== 'string' || !v.trim()) return bad(`${label} không được để trống`);
  const s = v.trim().replace(/\s+/g, ' ');
  return s.length > max ? bad(`${label} tối đa ${max} ký tự`) : s;
};
function ids<T extends { id: string }>(list: T[], label: string): T[] {
  const seen = new Set<string>();
  for (const o of list) {
    if (!ID.test(o.id)) bad(`${label}: mã "${o.id}" không hợp lệ`);
    if (seen.has(o.id)) bad(`${label}: mã "${o.id}" bị trùng`);
    seen.add(o.id);
  }
  return list;
}
const arr = (v: unknown, label: string, min: number, max: number): any[] =>
  Array.isArray(v) && v.length >= min && v.length <= max ? v : bad(`${label}: cần từ ${min} đến ${max} mục`);

/** Kiểm tra và chuẩn hóa dữ liệu của một câu luyện tập trước khi lưu (quản trị nhập hoặc nội dung khởi tạo) */
export function normalizeItem(kind: ItemKind, raw: unknown): ItemData {
  if (!isObj(raw)) return bad('Dữ liệu câu luyện tập không hợp lệ');
  if (kind === 'quiz') {
    const options = ids(arr(raw.options, 'Trắc nghiệm', 2, 4).map((o) => ({ id: String(o.id), text: str(o.text, 'Lựa chọn', 160) })), 'Trắc nghiệm');
    if (!options.some((o) => o.id === raw.correct)) return bad('Trắc nghiệm: đáp án đúng phải nằm trong các lựa chọn');
    return { options, correct: String(raw.correct) };
  }
  if (kind === 'tactic') {
    const options = ids(arr(raw.options, 'Quyết định', 2, 4).map((o) => ({ id: String(o.id), text: str(o.text, 'Phương án', 200), feedback: str(o.feedback, 'Phản hồi', 320), score: ([0, 1, 2].includes(Number(o.score)) ? Number(o.score) : bad('Điểm phương án phải là 0, 1 hoặc 2')) as 0 | 1 | 2 })), 'Quyết định');
    if (options.filter((o) => o.score === 2).length !== 1) return bad('Quyết định: cần đúng một phương án tốt nhất (2 điểm)');
    return { situation: str(raw.situation, 'Tình huống', 500), options };
  }
  if (kind === 'sequence') {
    return { items: ids(arr(raw.items, 'Xếp trình tự', 3, 6).map((o) => ({ id: String(o.id), text: str(o.text, 'Mốc', 160), ...(o.when ? { when: str(o.when, 'Thời điểm', 40) } : {}) })), 'Xếp trình tự') };
  }
  if (kind === 'pairs') {
    const pairs = ids(arr(raw.pairs, 'Ghép cặp', 3, 6).map((p) => ({ id: String(p.id), left: str(p.left, 'Vế trái', 60), right: str(p.right, 'Vế phải', 90) })), 'Ghép cặp');
    return { left_label: str(raw.left_label, 'Nhãn vế trái', 30), right_label: str(raw.right_label, 'Nhãn vế phải', 30), pairs };
  }
  const spots = ids(arr(raw.spots, 'Chọn địa điểm', 3, 5).map((s) => {
    const x = Number(s.x), y = Number(s.y);
    if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) bad('Chọn địa điểm: tọa độ phải là tỉ lệ 0–1 trên ảnh bản đồ');
    return { id: String(s.id), label: str(s.label, 'Tên địa điểm', 40), x, y };
  }), 'Chọn địa điểm');
  if (![1, 2, 3].includes(Number(raw.campaign_no))) return bad('Chọn địa điểm: bản đồ phải thuộc lần kháng chiến 1, 2 hoặc 3');
  if (!spots.some((s) => s.id === raw.correct)) return bad('Chọn địa điểm: đáp án đúng phải là một trong các điểm');
  return { campaign_no: Number(raw.campaign_no), spots, correct: String(raw.correct) };
}

/** Trạng thái của một câu trong phiên luyện tập (lưu ở máy chủ) */
export interface SlotState {
  item_id: number; kind: ItemKind; seed: number; done: boolean; score: number;
  /** Ghép cặp: mã thẻ -> mã cặp (chỉ máy chủ biết), các cặp đã ghép và số lần ghép sai */
  tokens?: Record<string, string>; matched?: string[]; misses?: number;
  /** "Gợi ý chiến thuật" (vật phẩm mua ở Chợ phiên, 25/11/2026): một phương án sai đã được gạch bỏ */
  hint?: string;
}

/** Các dạng câu dùng được "Gợi ý chiến thuật": có từ 3 lựa chọn trở lên để gạch bỏ một lựa chọn sai mà vẫn còn phải suy nghĩ */
export const HINT_KINDS: ItemKind[] = ['quiz', 'tactic', 'locate'];

/** Phương án sai bị gạch bỏ khi dùng gợi ý: cố định theo phiên (phương án sai kém nhất đứng đầu theo thứ tự xáo của câu); null khi không dùng được */
export function hintFor(item: ItemRow, slot: SlotState): string | null {
  if (slot.done || slot.hint || !HINT_KINDS.includes(item.kind)) return null;
  const d = item.data as Record<string, any>;
  if (item.kind === 'quiz') {
    const opts = seededShuffle((d as QuizData).options, slot.seed);
    return opts.length >= 3 ? opts.find((o) => o.id !== (d as QuizData).correct)?.id ?? null : null;
  }
  if (item.kind === 'tactic') {
    const opts = seededShuffle((d as TacticData).options, slot.seed);
    if (opts.length < 3) return null;
    const low = Math.min(...opts.map((o) => o.score));
    return opts.find((o) => o.score === low && o.score < 2)?.id ?? null;
  }
  const spots = seededShuffle((d as LocateData).spots, slot.seed);
  return spots.length >= 3 ? spots.find((s) => s.id !== (d as LocateData).correct)?.id ?? null : null;
}

export function newSlot(item: ItemRow, seed: number): SlotState {
  const slot: SlotState = { item_id: item.id, kind: item.kind, seed, done: false, score: 0 };
  if (item.kind === 'pairs') {
    const d = item.data as PairsData;
    const order = seededShuffle(d.pairs.map((p) => p.id), seed);
    slot.tokens = {};
    order.forEach((pid, i) => { slot.tokens![`l${i + 1}`] = pid; });
    seededShuffle(d.pairs.map((p) => p.id), seed + 7919).forEach((pid, i) => { slot.tokens![`r${i + 1}`] = pid; });
    slot.matched = [];
    slot.misses = 0;
  }
  return slot;
}

/** Dạng hiển thị cho học sinh: không có đáp án đúng, không có phản hồi của từng phương án */
export function publicItem(item: ItemRow, slot: SlotState): Record<string, unknown> {
  const base = { id: item.id, kind: item.kind, kind_label: KIND_LABEL[item.kind], prompt: item.prompt, objective: item.objective, done: slot.done, removed: slot.hint ? [slot.hint] : [], hintable: hintFor(item, slot) !== null };
  const d = item.data as Record<string, any>;
  if (item.kind === 'quiz') return { ...base, options: seededShuffle((d as QuizData).options, slot.seed).map((o) => ({ id: o.id, text: o.text })) };
  if (item.kind === 'tactic') return { ...base, situation: d.situation, options: seededShuffle((d as TacticData).options, slot.seed).map((o) => ({ id: o.id, text: o.text })) };
  if (item.kind === 'sequence') {
    const items = (d as SequenceData).items.map((o) => ({ id: o.id, text: o.text }));
    let shuffled = seededShuffle(items, slot.seed);
    if (shuffled.every((o, i) => o.id === items[i].id)) shuffled = [...items.slice(1), items[0]];
    return { ...base, items: shuffled };
  }
  if (item.kind === 'pairs') {
    const p = d as PairsData;
    const text = (side: 'left' | 'right', pid: string): string => p.pairs.find((x) => x.id === pid)![side];
    const cards = Object.entries(slot.tokens ?? {}).map(([token, pid]) => ({ token, side: token.startsWith('l') ? 'left' : 'right', text: text(token.startsWith('l') ? 'left' : 'right', pid), matched: (slot.matched ?? []).includes(pid) }));
    return { ...base, left_label: p.left_label, right_label: p.right_label, cards: seededShuffle(cards, slot.seed + 104729), pairs_total: p.pairs.length, misses: slot.misses ?? 0 };
  }
  const l = d as LocateData;
  return { ...base, campaign_no: l.campaign_no, spots: seededShuffle(l.spots, slot.seed).map((s, i) => ({ id: s.id, letter: String.fromCharCode(65 + i), x: s.x, y: s.y })) };
}

export interface AnswerOutcome {
  /** Câu đã xong chưa (ghép cặp cần nhiều lượt) */
  done: boolean;
  correct: boolean;
  /** Điểm của câu trong khoảng 0–1 (chỉ có nghĩa khi done) */
  score: number;
  detail: Record<string, unknown>;
}

/** Số lần ghép sai được bỏ qua: lật thẻ luôn có vài lần đoán */
const PAIR_FREE_MISSES = 2;
const PAIR_HALF_MISSES = 5;

/** Chấm một câu trả lời và cập nhật trạng thái câu. Dữ liệu sai cấu trúc tính là sai, không báo lỗi để không lộ đáp án. */
export function gradeItem(item: ItemRow, slot: SlotState, answer: unknown): AnswerOutcome {
  if (slot.done) return bad('Câu này đã được trả lời rồi');
  const a = isObj(answer) ? answer : {};
  const d = item.data as Record<string, any>;
  const finish = (score: number, detail: Record<string, unknown>): AnswerOutcome => {
    slot.done = true;
    slot.score = score;
    return { done: true, correct: score >= 1, score, detail };
  };
  if (item.kind === 'quiz') {
    const q = d as QuizData;
    return finish(a.choice === q.correct ? 1 : 0, { correct_id: q.correct, chosen: typeof a.choice === 'string' ? a.choice : null });
  }
  if (item.kind === 'tactic') {
    const t = d as TacticData;
    const chosen = t.options.find((o) => o.id === a.choice);
    const best = t.options.find((o) => o.score === 2)!;
    return finish(chosen ? chosen.score / 2 : 0, { correct_id: best.id, chosen: chosen?.id ?? null, feedback: chosen?.feedback ?? null, best_feedback: best.feedback });
  }
  if (item.kind === 'sequence') {
    const want = (d as SequenceData).items;
    const got: unknown[] = Array.isArray(a.order) ? a.order : [];
    const right = want.map((o, i) => got[i] === o.id);
    return finish(right.every(Boolean) && got.length === want.length ? 1 : 0, { right, order: want.map((o) => ({ id: o.id, text: o.text, when: o.when ?? null })) });
  }
  if (item.kind === 'locate') {
    const l = d as LocateData;
    return finish(a.choice === l.correct ? 1 : 0, { correct_id: l.correct, chosen: typeof a.choice === 'string' ? a.choice : null, labels: l.spots.map((s) => ({ id: s.id, label: s.label })) });
  }
  // Ghép cặp: mỗi lượt lật hai thẻ (một thẻ mỗi vế)
  const tokens = slot.tokens ?? {};
  const left = typeof a.left === 'string' && a.left.startsWith('l') ? a.left : null;
  const right = typeof a.right === 'string' && a.right.startsWith('r') ? a.right : null;
  if (!left || !right || !tokens[left] || !tokens[right]) return bad('Hãy lật một thẻ ở mỗi vế');
  const pid = tokens[left];
  if (slot.matched!.includes(pid) || slot.matched!.includes(tokens[right])) return bad('Thẻ này đã được ghép rồi');
  const match = pid === tokens[right];
  if (match) slot.matched!.push(pid); else slot.misses = (slot.misses ?? 0) + 1;
  const total = (d as PairsData).pairs.length;
  if (slot.matched!.length < total) return { done: false, correct: match, score: 0, detail: { match, left, right, matched: slot.matched!.length, pairs_total: total, misses: slot.misses } };
  const misses = slot.misses ?? 0;
  const out = finish(misses <= PAIR_FREE_MISSES ? 1 : misses <= PAIR_HALF_MISSES ? 0.5 : 0, { match, left, right, matched: total, pairs_total: total, misses, pairs: (d as PairsData).pairs });
  return { ...out, correct: match };
}

/** Tổng kết lượt luyện tập: phần trăm (làm tròn), đạt hay chưa theo ngưỡng của chặng và số sao kiến thức */
export function tally(slots: SlotState[], passPercent: number): { percent: number; passed: boolean; stars: number; right: number; total: number } {
  const total = slots.length;
  const sum = slots.reduce((n, s) => n + (s.done ? s.score : 0), 0);
  const percent = total ? Math.round((sum / total) * 100) : 0;
  const passed = percent >= passPercent;
  return { percent, passed, stars: !passed ? 0 : percent >= 95 ? 3 : percent >= 85 ? 2 : 1, right: slots.filter((s) => s.done && s.score >= 1).length, total };
}
