/**
 * Nội dung học tập: ngân hàng câu hỏi của game (ai/data/game_content.json), kho tri thức (knowledge_base.json)
 * và Q-matrix. Server giữ đáp án và tự chấm: khi gửi cho học sinh, đáp án được lược bỏ và lựa chọn bị xáo thứ tự,
 * mỗi lựa chọn mang một `key` cố định để chấm. Câu do AI sinh được giữ tạm 3 giờ để chấm theo cùng cách.
 *
 * Dạng câu: mcq (trắc nghiệm), tf (đúng/sai), order (sắp xếp), match (nối cặp), map (chọn địa danh trên lược đồ).
 */
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from '../config';

export type QuestionType = 'mcq' | 'tf' | 'order' | 'match' | 'map';
export interface BankQuestion {
  id: string;
  unit_id: string;
  type: QuestionType;
  prompt: string;
  explanation: string;
  level?: string;
  source?: string | null;
  hint?: string | null;
  options?: string[];
  answer?: number | boolean | string;
  items?: string[];
  left?: string[];
  right?: string[];
  keep_order?: boolean;
  ai?: boolean;
}
export interface UnitMeta {
  topic: string;
  category: string;
  [key: string]: unknown;
}
/** Một dòng app_question_bank: câu quản trị chỉnh sửa/ẩn/tạo, chồng lên ngân hàng gốc trong file */
export interface BankOverlay {
  id: string;
  origin: 'file' | 'admin';
  status: 'draft' | 'published' | 'hidden';
  payload: BankQuestion;
}
type Key = number | string | boolean;
export interface ServedQuestion {
  id: string;
  unit_id: string;
  type: QuestionType;
  prompt: string;
  level: string;
  topic: string;
  source: string | null;
  hint: string | null;
  options: Array<{ key: Key; text: string }> | null;
  items: Array<{ key: number; text: string }> | null;
  left: Array<{ key: number; text: string }> | null;
  right: Array<{ key: number; text: string }> | null;
}

const TYPES = new Set(['mcq', 'tf', 'order', 'match', 'map']);
const LEVELS = new Set(['NHAN_BIET', 'THONG_HIEU', 'VAN_DUNG']);
const AI_TTL_MS = 3 * 3_600_000;
const AI_CACHE_LIMIT = 3000;
const SKIP_CATEGORIES = new Set(['CONVERSATIONAL_INTENT', 'CROSS_ERA_SAFEGUARD', 'OUT_OF_DOMAIN']);
const KB_SOURCE = 'SGK Lịch sử và Địa lí 7 & Đại Việt sử ký toàn thư (kho tri thức Đông A)';

export function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const unique = (list: unknown[]): boolean => new Set(list).size === list.length;

function validate(q: BankQuestion, places: Record<string, string>): void {
  const id = q.id;
  if (typeof id !== 'string' || !id) throw new Error('Câu hỏi thiếu id');
  if (!TYPES.has(q.type)) throw new Error(`${id}: dạng câu hỏi không hợp lệ (${q.type})`);
  for (const field of ['unit_id', 'prompt', 'explanation'] as const) {
    if (typeof q[field] !== 'string' || !q[field].trim()) throw new Error(`${id}: thiếu ${field}`);
  }
  if (!LEVELS.has(q.level ?? 'THONG_HIEU')) throw new Error(`${id}: mức độ không hợp lệ`);
  if (q.type === 'mcq') {
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 5 || !unique(q.options)) throw new Error(`${id}: cần 2–5 lựa chọn khác nhau`);
    if (!Number.isInteger(q.answer) || (q.answer as number) < 0 || (q.answer as number) >= q.options.length) throw new Error(`${id}: đáp án nằm ngoài danh sách lựa chọn`);
  } else if (q.type === 'tf') {
    if (typeof q.answer !== 'boolean') throw new Error(`${id}: đáp án đúng/sai phải là true/false`);
  } else if (q.type === 'order') {
    if (!Array.isArray(q.items) || q.items.length < 3 || q.items.length > 6 || !unique(q.items)) throw new Error(`${id}: cần 3–6 mục khác nhau để sắp xếp`);
  } else if (q.type === 'match') {
    const { left, right } = q;
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || left.length < 3 || left.length > 5) throw new Error(`${id}: cần 3–5 cặp nối`);
    if (!unique(left) || !unique(right)) throw new Error(`${id}: các vế nối phải khác nhau`);
  } else if (q.type === 'map') {
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 5 || q.options.some((o) => !(o in places))) throw new Error(`${id}: địa danh không có trong lược đồ`);
    if (!q.options.includes(q.answer as string)) throw new Error(`${id}: đáp án không nằm trong các địa danh`);
  }
}

const readJson = (file: string) => JSON.parse(readFileSync(join(config.contentDir, file), 'utf8'));

@Injectable()
export class ContentService {
  private readonly logger = new Logger('Content');
  /** Câu đang phục vụ học sinh (gốc + lớp chỉnh sửa đã xuất bản); đổi nội dung tại chỗ trong applyOverlay */
  readonly questions = new Map<string, BankQuestion>();
  readonly byUnit = new Map<string, string[]>();
  /** Ngân hàng gốc đọc từ ai/data/game_content.json, không bao giờ bị sửa */
  private readonly base = new Map<string, BankQuestion>();
  readonly places: Record<string, string>;
  /** Q-matrix của chatbot + cụm tri thức bổ sung của game (chủ đề, nhóm) */
  readonly units: Record<string, UnitMeta>;
  /** Thẻ Sử Ký: kho tri thức của chatbot + thẻ bổ sung của game */
  readonly codex: Array<Record<string, unknown>>;
  private readonly aiCache = new Map<string, { expires: number; q: BankQuestion }>();

  constructor() {
    const game = readJson('game_content.json');
    this.places = game.places ?? {};
    for (const q of game.questions as BankQuestion[]) {
      validate(q, this.places);
      if (this.base.has(q.id)) throw new Error(`Trùng mã câu hỏi ${q.id}`);
      this.base.set(q.id, q);
    }
    this.applyOverlay([]);
    let qMatrix: Record<string, UnitMeta> = {};
    let kb: Record<string, Record<string, unknown>> = {};
    try {
      qMatrix = readJson('q_matrix.json');
      kb = readJson('knowledge_base.json');
    } catch {
      this.logger.warn('Không đọc được q_matrix.json / knowledge_base.json – chỉ dùng chủ đề của game');
    }
    this.units = { ...game.units, ...qMatrix };
    const gameCodex = new Map<string, Record<string, unknown>>((game.codex ?? []).map((e: Record<string, unknown>) => [String(e.unit_id), e]));
    this.codex = Object.entries(kb)
      .filter(([, u]) => !SKIP_CATEGORIES.has(String(u.category)))
      .map(([uid, u]) => ({
        unit_id: uid,
        category: u.category ?? '',
        topic: u.topic ?? uid,
        entity: u.entity ?? '',
        event: u.event ?? '',
        badge: u.badge ?? null,
        // Chủ đề bổ sung cùng game đã có trong kho tri thức: giữ nhãn và nguồn trích dẫn riêng của thẻ game
        label: gameCodex.get(uid)?.label ?? 'chinh_su',
        fact_chunk: u.fact_chunk ?? '',
        answer: u.answer ?? '',
        source: gameCodex.get(uid)?.source ?? KB_SOURCE,
      }));
    const known = new Set(this.codex.map((e) => e.unit_id));
    for (const [uid, e] of gameCodex) if (!known.has(uid)) this.codex.push({ ...e });
    this.logger.log(`Ngân hàng câu hỏi: ${this.questions.size} câu, ${this.byUnit.size} cụm tri thức`);
  }

  /**
   * Dựng lại ngân hàng đang phục vụ: câu gốc, trừ câu bị ẩn, thay bằng bản đã xuất bản của quản trị, cộng câu quản trị tạo.
   * Dòng nháp không ảnh hưởng học sinh; dòng sai định dạng bị bỏ qua để một dòng lỗi không làm hỏng cả ngân hàng.
   */
  applyOverlay(rows: BankOverlay[]): number {
    const next = new Map(this.base);
    let applied = 0;
    for (const row of rows) {
      if (row.origin === 'file' && row.status === 'hidden') {
        next.delete(row.id);
        applied += 1;
      } else if (row.status === 'published') {
        try {
          validate(row.payload, this.places);
          next.set(row.id, row.payload);
          applied += 1;
        } catch (exc) {
          this.logger.warn(`Bỏ qua câu ${row.id}: ${(exc as Error).message}`);
        }
      }
    }
    this.questions.clear();
    this.byUnit.clear();
    for (const [id, q] of next) {
      this.questions.set(id, q);
      this.byUnit.set(q.unit_id, [...(this.byUnit.get(q.unit_id) ?? []), id]);
    }
    return applied;
  }

  /** Câu gốc trong file (để quản trị so sánh, ẩn hoặc chỉnh sửa) */
  baseQuestions(): BankQuestion[] {
    return [...this.base.values()];
  }

  /** Kiểm tra một câu quản trị gửi lên: đúng định dạng từng dạng câu và thuộc một cụm tri thức học tập có thật */
  check(q: BankQuestion): void {
    validate(q, this.places);
    if (!this.isLearningUnit(q.unit_id) || !(q.unit_id in this.units)) throw new Error(`${q.id}: cụm tri thức ${q.unit_id} không tồn tại`);
  }

  topicOf(unitId: string): string {
    return this.units[unitId]?.topic ?? unitId;
  }

  isLearningUnit(unitId: string): boolean {
    return !SKIP_CATEGORIES.has(String(this.units[unitId]?.category ?? ''));
  }

  get(id: string): BankQuestion | null {
    const bank = this.questions.get(id);
    if (bank) return bank;
    const hit = this.aiCache.get(id);
    return hit && hit.expires > Date.now() ? hit.q : null;
  }

  unitsWithQuestions(): string[] {
    return [...this.byUnit.entries()].filter(([, ids]) => ids.length).map(([u]) => u);
  }

  /** Chọn ngẫu nhiên `count` câu thuộc các cụm tri thức đã cho (ưu tiên câu chưa gặp) */
  pick(units: string[] | null, count: number, exclude: Set<string>, types?: Set<string> | null, levels?: Set<string> | null): BankQuestion[] {
    let ids = (units ?? [...this.byUnit.keys()]).flatMap((u) => this.byUnit.get(u) ?? []);
    if (types?.size) ids = ids.filter((id) => types.has(this.questions.get(id)!.type)).length ? ids.filter((id) => types.has(this.questions.get(id)!.type)) : ids;
    if (levels?.size) {
      const filtered = ids.filter((id) => levels.has(this.questions.get(id)!.level ?? 'THONG_HIEU'));
      if (filtered.length) ids = filtered;
    }
    const chosen = shuffle(ids.filter((id) => !exclude.has(id))).slice(0, count);
    if (chosen.length < count) chosen.push(...shuffle(ids.filter((id) => exclude.has(id))).slice(0, count - chosen.length)); // hết câu mới thì gặp lại câu cũ
    return chosen.map((id) => this.questions.get(id)!);
  }

  /** Câu hỏi gửi cho học sinh: không kèm đáp án, lựa chọn xáo thứ tự */
  serve(q: BankQuestion): ServedQuestion {
    const out: ServedQuestion = {
      id: q.id, unit_id: q.unit_id, type: q.type, prompt: q.prompt, level: q.level ?? 'THONG_HIEU', topic: this.topicOf(q.unit_id),
      source: q.source ?? null, hint: q.hint ?? null, options: null, items: null, left: null, right: null,
    };
    if (q.type === 'mcq') {
      const options = q.options!.map((text, key) => ({ key, text }));
      out.options = q.keep_order ? options : shuffle(options);
    } else if (q.type === 'map') {
      out.options = shuffle(q.options!.map((place) => ({ key: place, text: this.places[place] })));
    } else if (q.type === 'order') {
      let items = q.items!.map((text, key) => ({ key, text }));
      while (items.length > 1 && items.every((it, i) => it.key === i)) items = shuffle(items);
      out.items = items;
    } else if (q.type === 'match') {
      out.left = q.left!.map((text, key) => ({ key, text }));
      out.right = shuffle(q.right!.map((text, key) => ({ key, text })));
    }
    return out;
  }

  /** Trả về [đúng/sai, đáp án để hiển thị] – so khớp cả kiểu dữ liệu (true khác 1) */
  grade(q: BankQuestion, choice?: unknown, order?: unknown[] | null, pairs?: Record<string, unknown> | null): [boolean, Record<string, unknown>] {
    if (q.type === 'mcq' || q.type === 'map') return [choice === q.answer, { choice: q.answer }];
    if (q.type === 'tf') return [choice === q.answer, { choice: q.answer }];
    if (q.type === 'order') {
      const expected = q.items!.map((_, i) => i);
      return [Array.isArray(order) && order.length === expected.length && order.every((v, i) => v === i), { order: expected }];
    }
    const expected = Object.fromEntries(q.left!.map((_, i) => [String(i), i]));
    const given = Object.entries(pairs ?? {});
    return [given.length === q.left!.length && given.every(([k, v]) => expected[k] === v), { pairs: expected }];
  }

  /** Lưu tạm câu AI sinh để chấm ở server; bỏ qua câu sai định dạng */
  rememberAi(unitId: string, question: string, options: string[], correctIndex: number, explanation: string, source: string): BankQuestion | null {
    const clean = options.map((o) => String(o).trim()).filter(Boolean);
    if (!question.trim() || clean.length !== options.length || clean.length < 2 || clean.length > 5 || !unique(clean)) return null;
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= clean.length) return null;
    const q: BankQuestion = {
      id: `ai-${randomUUID().replace(/-/g, '').slice(0, 12)}`, unit_id: unitId, type: 'mcq', prompt: question.trim(), options: clean,
      answer: correctIndex, explanation: explanation.trim() || 'Đáp án dựa trên tư liệu của bài học.', source, level: 'THONG_HIEU', ai: true,
    };
    const now = Date.now();
    if (this.aiCache.size >= AI_CACHE_LIMIT) {
      for (const [key, hit] of this.aiCache) if (hit.expires <= now || this.aiCache.size >= AI_CACHE_LIMIT) this.aiCache.delete(key);
    }
    this.aiCache.set(q.id, { expires: now + AI_TTL_MS, q });
    return q;
  }
}
