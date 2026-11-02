/**
 * Trình soạn Quiz kiểu Kahoot (HK.GV.085–094, ver0.2 Sprint 8) và kho ảnh tải lên (HK.GV.085, 092).
 *  - Bản nháp: trình soạn tự lưu toàn bộ nội dung đang soạn vào `hk_quiz_drafts` (chỉ chủ bản nháp thấy), chưa tạo câu hỏi hay bộ đề.
 *  - Lưu chính thức: kiểm tra từng câu (thông báo ghi rõ "Câu N"), rồi tạo / cập nhật câu hỏi trong ngân hàng và bộ đề — dùng chung dữ liệu với HK.GV.032 và HK.GV.041.
 *    Câu đã có trong ngân hàng chỉ được sửa tại chỗ khi là câu riêng của người soạn và không nằm trong bộ đề khác; còn lại tạo bản mới để không đổi nội dung của người khác.
 *  - Ảnh tải lên: ảnh nhỏ (PNG, JPEG, WEBP, GIF, tối đa 1,5 MB) lưu trong cơ sở dữ liệu và phục vụ ở đường dẫn công khai chứa mã ngẫu nhiên; mỗi giáo viên tối đa 60 ảnh và 30 MB (ảnh lưu trong cơ sở dữ liệu nên giữ nhỏ).
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DatabaseService, searchText, UserRow } from '../database/database.service';
import { authoringScope, canEdit, notFound } from './access';
import { QuestionInput, QuestionService, QuestionRow } from './question.service';
import { QuizInput, QuizService, ScoreMode, MAX_QUESTIONS } from './quiz.service';
import { normalizeData, QType } from './questions';

export const STUDIO_QTYPES = ['single', 'multiple', 'truefalse'] as const;
export const STUDIO_SECONDS = [5, 10, 20, 30, 60, 90, 120] as const;
const MAX_DRAFTS = 30;
const MAX_PAYLOAD_BYTES = 400_000;
const MAX_IMAGE_BYTES = 1_572_864;
const MAX_IMAGES_PER_USER = 60;
const MAX_IMAGE_TOTAL = 30 * 1024 * 1024;
const SLOTS = 4;
const slotId = (i: number): string => String.fromCharCode(97 + i);

export interface StudioQuestion {
  uid: string; question_id: number | null; qtype: (typeof STUDIO_QTYPES)[number]; prompt: string;
  /** Bốn ô đáp án theo thứ tự ▲ ◆ ● ■; hai ô đầu bắt buộc với câu trắc nghiệm */
  options: string[]; correct: number[]; tf: boolean; seconds: number; score_mode: ScoreMode; image_url: string | null; video_url: string | null; explanation: string;
}
export interface StudioPayload {
  title: string; description: string; cover_url: string | null; theme: { bg: string; music: string }; campaign_id: number | null; shuffle_questions: boolean; shuffle_options: boolean; questions: StudioQuestion[];
}

const blankQuestion = (): StudioQuestion => ({
  uid: randomBytes(5).toString('hex'), question_id: null, qtype: 'single', prompt: '', options: ['', '', '', ''], correct: [0], tf: true, seconds: 20, score_mode: 'standard', image_url: null, video_url: null, explanation: '',
});
const blankPayload = (): StudioPayload => ({
  title: '', description: '', cover_url: null, theme: { bg: 'default', music: 'none' }, campaign_id: null, shuffle_questions: false, shuffle_options: false, questions: [blankQuestion()],
});

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const link = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 500) : null);

/** Làm sạch nội dung bản nháp từ trình duyệt: chỉ giữ các khóa đã biết, cắt độ dài; chưa kiểm tra tính đúng đắn (việc của lúc lưu chính thức) */
export function sanitizeDraft(raw: unknown): StudioPayload {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, any>;
  const list = Array.isArray(r.questions) ? r.questions.slice(0, MAX_QUESTIONS + 10) : [];
  return {
    title: text(r.title, 160), description: text(r.description, 1000), cover_url: link(r.cover_url),
    theme: { bg: text(r.theme?.bg, 30) || 'default', music: text(r.theme?.music, 30) || 'none' },
    campaign_id: Number.isInteger(r.campaign_id) && r.campaign_id > 0 ? r.campaign_id : null, shuffle_questions: Boolean(r.shuffle_questions), shuffle_options: Boolean(r.shuffle_options),
    questions: list.map((x: Record<string, any>): StudioQuestion => {
      const qtype = (STUDIO_QTYPES as readonly string[]).includes(x?.qtype) ? x.qtype : 'single';
      const options = Array.from({ length: SLOTS }, (_, i) => text(Array.isArray(x?.options) ? x.options[i] : '', 200));
      const correct = Array.isArray(x?.correct) ? [...new Set<number>(x.correct.filter((n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) < SLOTS))] : [];
      return {
        uid: text(x?.uid, 20) || randomBytes(5).toString('hex'), question_id: Number.isInteger(x?.question_id) && x.question_id > 0 ? x.question_id : null, qtype, prompt: text(x?.prompt, 1000), options, correct,
        tf: x?.tf !== false, seconds: Number.isInteger(x?.seconds) ? x.seconds : 20, score_mode: ['standard', 'double', 'none'].includes(x?.score_mode) ? x.score_mode : 'standard',
        image_url: link(x?.image_url), video_url: link(x?.video_url), explanation: text(x?.explanation, 2000),
      };
    }),
  };
}

/** Đổi một câu trong trình soạn thành dữ liệu câu hỏi của ngân hàng; ném lỗi tiếng Việt ghi rõ số câu */
export function toQuestionInput(x: StudioQuestion, n: number): QuestionInput {
  const fail = (msg: string): never => { throw new BadRequestException(`Câu ${n}: ${msg}`); };
  const prompt = x.prompt.trim();
  if (prompt.length < 3) fail('hãy nhập nội dung câu hỏi (ít nhất 3 ký tự)');
  if (!(STUDIO_SECONDS as readonly number[]).includes(x.seconds)) fail(`thời gian trả lời chọn trong ${STUDIO_SECONDS.join(' / ')} giây`);
  let data: unknown;
  if (x.qtype === 'truefalse') data = { correct: x.tf };
  else {
    const filled = x.options.map((t, i) => ({ i, t: t.trim() })).filter((o) => o.t);
    if (!x.options[0].trim() || !x.options[1].trim()) fail('hai đáp án đầu (▲ ◆) là bắt buộc');
    const correct = x.correct.filter((i) => filled.some((o) => o.i === i));
    if (x.qtype === 'single' && correct.length !== 1) fail('hãy đánh dấu đúng một đáp án đúng');
    if (x.qtype === 'multiple' && filled.length < 3) fail('câu chọn nhiều đáp án cần ít nhất 3 đáp án');
    if (x.qtype === 'multiple' && correct.length < 2) fail('câu chọn nhiều đáp án cần đánh dấu từ 2 đáp án đúng');
    data = { options: filled.map((o) => ({ id: slotId(o.i), text: o.t })), correct: x.qtype === 'single' ? slotId(correct[0]) : correct.map(slotId) };
  }
  try { normalizeData(x.qtype as QType, data, prompt); } catch (e) { fail((e as Error).message); }
  return { qtype: x.qtype, prompt, image_url: x.image_url, video_url: x.video_url, explanation: x.explanation.trim() || null, difficulty: 2, data };
}

/** Đổi câu hỏi của ngân hàng thành câu của trình soạn; chỉ nhận ba dạng mà trình soạn hỗ trợ */
function fromRow(r: QuestionRow, seconds: number, mode: ScoreMode | null, n: number): StudioQuestion {
  if (!(STUDIO_QTYPES as readonly string[]).includes(r.qtype)) throw new ConflictException(`Câu ${n} thuộc dạng "${r.qtype}" mà trình soạn Quiz chưa mở được; hãy chỉnh bộ đề này ở mục Bộ đề`);
  const d = r.data as Record<string, any>;
  const options = ['', '', '', ''];
  let correct: number[] = [];
  if (r.qtype !== 'truefalse') {
    for (const o of d.options as Array<{ id: string; text: string }>) {
      const slot = o.id.charCodeAt(0) - 97;
      if (o.id.length === 1 && slot >= 0 && slot < SLOTS && !options[slot]) options[slot] = o.text;
      else { const free = options.findIndex((t) => !t); if (free >= 0) options[free] = o.text; }
    }
    const ids: string[] = r.qtype === 'single' ? [d.correct] : d.correct;
    correct = ids.map((id) => (d.options as Array<{ id: string; text: string }>).find((o) => o.id === id)).map((o) => options.indexOf(o?.text ?? '\u0000')).filter((i) => i >= 0);
  }
  return {
    uid: randomBytes(5).toString('hex'), question_id: r.id, qtype: r.qtype as StudioQuestion['qtype'], prompt: r.prompt, options, correct, tf: r.qtype === 'truefalse' ? d.correct === true : true,
    seconds: (STUDIO_SECONDS as readonly number[]).includes(seconds) ? seconds : 20, score_mode: mode ?? 'standard', image_url: r.image_url, video_url: r.video_url, explanation: r.explanation ?? '',
  };
}

// ---------------------------------------------------------------------- ảnh tải lên
const SIGNATURES: Array<{ mime: string; test: (b: Buffer) => boolean }> = [
  { mime: 'image/png', test: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/jpeg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/gif', test: (b) => b.length > 6 && b.subarray(0, 4).toString('latin1') === 'GIF8' },
  { mime: 'image/webp', test: (b) => b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
];

@Injectable()
export class MediaService {
  constructor(private readonly db: DatabaseService) {}

  /** `data` là chuỗi base64 hoặc data URL; loại tệp được xác định bằng nội dung thật chứ không tin tên tệp */
  async upload(user: UserRow, body: { name?: unknown; data?: unknown }) {
    const raw = typeof body.data === 'string' ? body.data.replace(/^data:[^;,]*;base64,/, '').replace(/\s+/g, '') : '';
    if (!raw || !/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) throw new BadRequestException('Hãy chọn một tệp ảnh');
    if (raw.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 8) throw new BadRequestException('Ảnh tối đa 1,5 MB');
    const bytes = Buffer.from(raw, 'base64');
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new BadRequestException('Ảnh tối đa 1,5 MB');
    const kind = SIGNATURES.find((s) => s.test(bytes));
    if (!kind) throw new BadRequestException('Chỉ nhận ảnh PNG, JPEG, WEBP hoặc GIF');
    const used = (await this.db.query<{ n: string; bytes: string }>('SELECT count(*) AS n, COALESCE(sum(size_bytes), 0) AS bytes FROM hk_media WHERE owner_id = $1', [user.id]))[0];
    if (Number(used.n) >= MAX_IMAGES_PER_USER || Number(used.bytes) + bytes.length > MAX_IMAGE_TOTAL) throw new ConflictException(`Mỗi tài khoản tải lên tối đa ${MAX_IMAGES_PER_USER} ảnh (tổng 30 MB); hãy dùng lại ảnh đã tải hoặc dùng liên kết ảnh`);
    const token = randomBytes(16).toString('hex');
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) || null : null;
    await this.db.query('INSERT INTO hk_media (token, owner_id, mime, name, size_bytes, data) VALUES ($1, $2, $3, $4, $5, $6)', [token, user.id, kind.mime, name, bytes.length, bytes]);
    return { token, url: `/api/content/media/${token}`, mime: kind.mime, size_bytes: bytes.length, name };
  }

  async file(token: string): Promise<{ mime: string; data: Buffer }> {
    const row = /^[0-9a-f]{32}$/.test(token) ? (await this.db.query<{ mime: string; data: Buffer }>('SELECT mime, data FROM hk_media WHERE token = $1', [token]))[0] : undefined;
    if (!row) throw new NotFoundException('Không tìm thấy ảnh');
    return row;
  }

  /** Ảnh để chèn vào câu hỏi: ảnh tôi đã tải lên và ảnh sử liệu đã công bố trong kho tư liệu (tranh, bản đồ, hiện vật, chân dung, địa danh) */
  async library(user: UserRow, q?: string) {
    // tìm không phân biệt hoa thường và dấu (lọc ở máy chủ ứng dụng vì chữ hoa có dấu phụ thuộc bộ ký tự của cơ sở dữ liệu)
    const term = searchText(String(q ?? ''));
    const mine = await this.db.query<{ token: string; name: string | null }>('SELECT token, name FROM hk_media WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 24', [user.id]);
    const items = await this.db.query<{ kind: string; id: number; title: string; url: string }>(
      `SELECT * FROM (
         SELECT 'source' AS kind, id, title, attachment_url AS url FROM hist_sources WHERE status = 'published' AND kind IN ('hinh_anh', 'ban_do_co') AND attachment_url IS NOT NULL
         UNION ALL SELECT 'figure', id, name, image_url FROM hist_figures WHERE status = 'published' AND image_url IS NOT NULL
         UNION ALL SELECT 'place', id, name, image_url FROM hist_places WHERE status = 'published' AND image_url IS NOT NULL
         UNION ALL SELECT 'campaign', id, title, image_url FROM hist_campaigns WHERE status = 'published' AND image_url IS NOT NULL
       ) t ORDER BY t.kind, t.title LIMIT 600`);
    const library = items.filter((i) => !term || searchText(i.title).includes(term)).slice(0, 40);
    return { uploads: mine.map((m) => ({ ...m, url: `/api/content/media/${m.token}` })), library };
  }
}

// ---------------------------------------------------------------------- trình soạn Quiz
@Injectable()
export class QuizStudioService {
  constructor(private readonly db: DatabaseService, private readonly questions: QuestionService, private readonly quizzes: QuizService) {}

  private async load(user: UserRow, id: number, lock = false) {
    const row = (await this.db.query<{ id: number; owner_id: number; quiz_id: number | null; payload: StudioPayload; updated_at: string }>(
      `SELECT id, owner_id, quiz_id, payload, updated_at FROM hk_quiz_drafts WHERE id = $1 AND owner_id = $2${lock ? ' FOR UPDATE' : ''}`, [id, user.id]))[0];
    if (!row) throw notFound('bản nháp Quiz');
    return row;
  }

  async list(user: UserRow) {
    authoringScope(user);
    return this.db.query(
      `SELECT id, quiz_id, title, jsonb_array_length(payload->'questions')::int AS questions, updated_at FROM hk_quiz_drafts WHERE owner_id = $1 ORDER BY updated_at DESC LIMIT 50`, [user.id]);
  }

  /** Tạo bản nháp trống, hoặc mở bộ đề có sẵn để sửa trong trình soạn */
  async create(user: UserRow, body: { from_quiz_id?: unknown }) {
    authoringScope(user);
    const count = Number((await this.db.query<{ n: string }>('SELECT count(*) AS n FROM hk_quiz_drafts WHERE owner_id = $1', [user.id]))[0].n);
    if (count >= MAX_DRAFTS) throw new ConflictException(`Bạn đang có ${count} bản nháp; hãy lưu hoặc xóa bớt bản nháp cũ`);
    let payload = blankPayload();
    let quizId: number | null = null;
    if (body.from_quiz_id !== undefined && body.from_quiz_id !== null) {
      quizId = Number(body.from_quiz_id);
      if (!Number.isInteger(quizId)) throw new BadRequestException('Bộ đề không hợp lệ');
      const existing = (await this.db.query<{ id: number }>('SELECT id FROM hk_quiz_drafts WHERE owner_id = $1 AND quiz_id = $2', [user.id, quizId]))[0];
      if (existing) return this.get(user, existing.id);
      payload = await this.fromQuiz(user, quizId);
    }
    const id = (await this.db.query<{ id: number }>('INSERT INTO hk_quiz_drafts (owner_id, quiz_id, title, payload) VALUES ($1, $2, $3, $4) RETURNING id', [user.id, quizId, payload.title, JSON.stringify(payload)]))[0].id;
    return this.get(user, id);
  }

  private async fromQuiz(user: UserRow, quizId: number): Promise<StudioPayload> {
    const quiz = await this.quizzes.get(user, quizId);
    if (!quiz.can_edit) throw new ForbiddenException('Chỉ sửa được bộ đề do bạn soạn; hãy nhân bản bộ đề dùng chung trước');
    if (quiz.locked) throw new ConflictException(quiz.lock_reason ?? 'Bộ đề đang khóa chỉnh sửa; hãy nhân bản để chỉnh sửa');
    const questions: StudioQuestion[] = [];
    let n = 0;
    for (const item of quiz.items as unknown as Array<{ question_id: number; seconds: number | null; score_mode: ScoreMode | null }>) {
      n += 1;
      const row = await this.questions.get(user, item.question_id);
      questions.push(fromRow(row as unknown as QuestionRow, item.seconds ?? quiz.seconds_per_question, item.score_mode, n));
    }
    return {
      title: quiz.title, description: quiz.description ?? '', cover_url: quiz.cover_url, theme: { bg: String((quiz.theme as any)?.bg ?? 'default'), music: String((quiz.theme as any)?.music ?? 'none') },
      campaign_id: quiz.campaign_id, shuffle_questions: quiz.shuffle_questions, shuffle_options: quiz.shuffle_options, questions: questions.length ? questions : [blankQuestion()],
    };
  }

  async get(user: UserRow, id: number) {
    authoringScope(user);
    const d = await this.load(user, id);
    return { id: d.id, quiz_id: d.quiz_id, updated_at: d.updated_at, payload: d.payload };
  }

  /** Tự lưu: ghi đè toàn bộ nội dung bản nháp (nội dung được làm sạch, chưa kiểm tra tính đúng đắn) */
  async save(user: UserRow, id: number, raw: unknown) {
    authoringScope(user);
    const payload = sanitizeDraft(raw);
    if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) throw new BadRequestException('Bản nháp quá lớn');
    const row = (await this.db.query<{ updated_at: string }>('UPDATE hk_quiz_drafts SET payload = $3, title = $4, updated_at = now() WHERE id = $1 AND owner_id = $2 RETURNING updated_at', [id, user.id, JSON.stringify(payload), payload.title]))[0];
    if (!row) throw notFound('bản nháp Quiz');
    return { id, updated_at: row.updated_at };
  }

  async remove(user: UserRow, id: number) {
    authoringScope(user);
    await this.load(user, id);
    await this.db.query('DELETE FROM hk_quiz_drafts WHERE id = $1 AND owner_id = $2', [id, user.id]);
    return { deleted: true };
  }

  /** Câu có thể sửa tại chỗ: của chính người soạn, không nằm trong bộ đề / bài học khác và chưa có học sinh trả lời */
  private async editableInPlace(user: UserRow, questionId: number, quizId: number | null): Promise<boolean> {
    const row = (await this.db.query<QuestionRow>('SELECT id, scope, school_id, owner_id FROM hk_questions WHERE id = $1', [questionId]))[0];
    if (!row || !canEdit(user, row)) return false;
    const used = await this.db.query<{ n: string }>(
      `SELECT (SELECT count(*) FROM hk_quiz_questions WHERE question_id = $1 AND ($2::int IS NULL OR quiz_id <> $2))
            + (SELECT count(*) FROM hk_lesson_checks WHERE question_id = $1) + (SELECT count(*) FROM hk_attempt_answers WHERE question_id = $1) AS n`, [questionId, quizId]);
    return Number(used[0].n) === 0;
  }

  /** Lưu chính thức (HK.GV.094): kiểm tra mọi câu trước khi ghi bất cứ thứ gì, rồi tạo / cập nhật câu hỏi và bộ đề */
  async commit(user: UserRow, id: number) {
    authoringScope(user);
    const draft = await this.load(user, id);
    const p = sanitizeDraft(draft.payload);
    const title = p.title.trim();
    if (title.length < 2) throw new BadRequestException('Hãy đặt tên Quiz (ít nhất 2 ký tự)');
    if (!p.questions.length) throw new BadRequestException('Quiz cần ít nhất 1 câu hỏi');
    if (p.questions.length > MAX_QUESTIONS) throw new BadRequestException(`Quiz tối đa ${MAX_QUESTIONS} câu hỏi`);
    const inputs = p.questions.map((x, i) => toQuestionInput(x, i + 1));
    if (draft.quiz_id) {
      const lock = await this.db.tx((q) => this.quizzes.lockReason(q, draft.quiz_id!));
      if (lock) throw new ConflictException(lock);
    }
    const ids: number[] = [];
    for (let i = 0; i < inputs.length; i++) {
      const old = p.questions[i].question_id;
      const saved = old && (await this.editableInPlace(user, old, draft.quiz_id)) ? await this.questions.update(user, old, inputs[i]) : await this.questions.create(user, inputs[i]);
      ids.push(saved.id);
    }
    const input: QuizInput = {
      title, description: p.description.trim() || null, campaign_id: p.campaign_id, seconds_per_question: 20, shuffle_questions: p.shuffle_questions, shuffle_options: p.shuffle_options,
      cover_url: p.cover_url, theme: p.theme,
      items: p.questions.map((x, i) => ({ question_id: ids[i], points: x.score_mode === 'double' ? 200 : 100, seconds: x.seconds, score_mode: x.score_mode })),
    };
    const quiz = draft.quiz_id ? await this.quizzes.update(user, draft.quiz_id, input) : await this.quizzes.create(user, input);
    p.questions.forEach((x, i) => { x.question_id = ids[i]; });
    await this.db.query('UPDATE hk_quiz_drafts SET quiz_id = $3, payload = $4, title = $5, updated_at = now() WHERE id = $1 AND owner_id = $2', [id, user.id, quiz.id, JSON.stringify(p), title]);
    return { quiz, draft: { id, quiz_id: quiz.id, payload: p } };
  }
}
