/**
 * Bộ đề (HK.GV.040–044): danh sách bộ đề của tôi / trường / hệ thống, tạo (chọn câu hỏi, thứ tự, thời gian, điểm, xáo trộn), sửa,
 * xóa, nhân bản, và dữ liệu để làm thử như học sinh. Bộ đề đang được giao (nằm trong hành trình đã phát hành) hoặc đã có học sinh làm thì khóa chỉnh sửa;
 * muốn đổi phải nhân bản.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { likeEscape } from '../admin/school.service';
import { DatabaseService, Q, searchText, UserRow } from '../database/database.service';
import { authoringScope, canEdit, canSee, notFound, Owned, Scope, storeSql, visibleSql } from './access';
import { QuestionService } from './question.service';
import { DEFAULT_SECONDS, QTYPE_LABEL, QType } from './questions';

export type ScoreMode = 'standard' | 'double' | 'none';
export interface QuizItemInput { question_id: number; points?: number; seconds?: number | null; score_mode?: ScoreMode | null }
/** Nền và nhạc chờ có sẵn cho giao diện Quiz (HK.GV.093); giao diện chỉ chọn trong danh sách này */
export const QUIZ_BACKGROUNDS = ['default', 'bach-dang', 'thang-long', 'chuong-duong', 'dong-bo-dau'] as const;
/** `upload`: tệp nhạc do giáo viên tải lên (HK.GV.093), đường dẫn nằm ở `theme.music_url`; các mã còn lại là giai điệu ngũ cung có sẵn */
export const QUIZ_MUSIC = ['none', 'trong-tran', 'song-nuoc', 'hao-khi', 'upload'] as const;
const MEDIA_OR_HTTPS = /^(https:\/\/|\/api\/content\/media\/[0-9a-f]{32}$)/;
const MEDIA_PATH_ONLY = /^\/api\/content\/media\/[0-9a-f]{32}$/;
export interface QuizInput {
  title: string; description?: string | null; campaign_id?: number | null; seconds_per_question?: number; shuffle_questions?: boolean; shuffle_options?: boolean;
  pass_percent?: number; cover_url?: string | null; theme?: Record<string, unknown>; items: QuizItemInput[];
}
export interface QuizFilter { q?: string; store?: string; campaign_id?: number; page?: number; limit?: number }

export interface QuizRow extends Owned {
  id: number; title: string; description: string | null; campaign_id: number | null; seconds_per_question: number; shuffle_questions: boolean; shuffle_options: boolean;
  pass_percent: number; cover_url: string | null; theme: Record<string, unknown>; created_at: string; updated_at: string;
}

const COLUMNS = 'id, scope, school_id, owner_id, title, description, campaign_id, seconds_per_question, shuffle_questions, shuffle_options, pass_percent, cover_url, theme, created_at, updated_at';
export const MAX_QUESTIONS = 50;

@Injectable()
export class QuizService {
  constructor(private readonly db: DatabaseService, private readonly questions: QuestionService) {}

  // ------------------------------------------------------------------ đọc
  async list(user: UserRow, f: QuizFilter) {
    const params: unknown[] = [];
    const parts = [visibleSql(user, 't', params), storeSql(user, 't', f.store, params)];
    const term = searchText(f.q ?? '');
    if (term) { params.push(`%${likeEscape(term)}%`); parts.push(`t.search_text LIKE $${params.length}`); }
    if (f.campaign_id) { params.push(f.campaign_id); parts.push(`t.campaign_id = $${params.length}`); }
    const where = parts.join(' AND ');
    const limit = Math.min(100, Math.max(1, f.limit ?? 20));
    const page = Math.max(1, f.page ?? 1);
    const total = Number((await this.db.query<{ n: string }>(`SELECT count(*) AS n FROM hk_quizzes t WHERE ${where}`, params))[0].n);
    const all = [...params, limit, (page - 1) * limit];
    const rows = await this.db.query<QuizRow & { owner_name: string | null; campaign_title: string | null; question_count: number; total_seconds: number; assigned: number; attempts: number }>(
      `SELECT t.id, t.scope, t.school_id, t.owner_id, t.title, t.description, t.campaign_id, t.seconds_per_question, t.pass_percent, t.cover_url, t.theme, t.updated_at, u.full_name AS owner_name, c.title AS campaign_title,
              (SELECT count(*)::int FROM hk_quiz_questions qq WHERE qq.quiz_id = t.id) AS question_count,
              (SELECT COALESCE(sum(COALESCE(qq.seconds, t.seconds_per_question)), 0)::int FROM hk_quiz_questions qq WHERE qq.quiz_id = t.id) AS total_seconds,
              (SELECT count(*)::int FROM hk_nodes n JOIN hk_journeys j ON j.id = n.journey_id WHERE n.quiz_id = t.id AND j.status = 'published') AS assigned,
              (SELECT count(*)::int FROM hk_attempts a WHERE a.quiz_id = t.id AND a.mode <> 'preview') AS attempts
       FROM hk_quizzes t LEFT JOIN app_users u ON u.id = t.owner_id LEFT JOIN hist_campaigns c ON c.id = t.campaign_id
       WHERE ${where} ORDER BY t.updated_at DESC, t.id DESC LIMIT $${all.length - 1} OFFSET $${all.length}`, all);
    return { total, page, limit, items: rows.map((r) => ({ ...r, can_edit: canEdit(user, r), locked: r.assigned > 0 || r.attempts > 0 })) };
  }

  async load(q: Q, user: UserRow, id: number, lock = false): Promise<QuizRow> {
    const row = (await q<QuizRow>(`SELECT ${COLUMNS} FROM hk_quizzes WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id]))[0];
    if (!row || !canSee(user, row)) throw notFound('bộ đề');
    return row;
  }

  /** Lý do khóa chỉnh sửa (null nếu sửa được) */
  async lockReason(q: Q, id: number): Promise<string | null> {
    const published = (await q<{ title: string }>(
      "SELECT j.title FROM hk_nodes n JOIN hk_journeys j ON j.id = n.journey_id WHERE n.quiz_id = $1 AND j.status = 'published' ORDER BY j.title LIMIT 3", [id])).map((r) => r.title);
    if (published.length) return `Bộ đề đang được giao trong hành trình: ${published.join(', ')}. Hãy nhân bản bộ đề để chỉnh sửa`;
    const attempts = Number((await q<{ n: string }>("SELECT count(*) AS n FROM hk_attempts WHERE quiz_id = $1 AND mode <> 'preview'", [id]))[0].n);
    if (attempts) return 'Đã có học sinh làm bộ đề này. Hãy nhân bản bộ đề để chỉnh sửa';
    return null;
  }

  async get(user: UserRow, id: number) {
    return this.db.tx(async (q) => {
      const row = await this.load(q, user, id);
      const items = await q(
        `SELECT qq.question_id, qq.position, qq.points, qq.seconds, qq.score_mode, t.qtype, t.prompt, t.difficulty, t.scope
         FROM hk_quiz_questions qq JOIN hk_questions t ON t.id = qq.question_id WHERE qq.quiz_id = $1 ORDER BY qq.position`, [id]);
      const owner = row.owner_id ? (await q<{ full_name: string }>('SELECT full_name FROM app_users WHERE id = $1', [row.owner_id]))[0]?.full_name ?? null : null;
      const shares = await q<{ target: string; status: string; review_note: string | null }>("SELECT target, status, review_note FROM hk_shares WHERE entity = 'quiz' AND entity_id = $1", [id]);
      const lock = await this.lockReason(q, id);
      return {
        ...row, owner_name: owner, can_edit: canEdit(user, row), locked: Boolean(lock), lock_reason: lock, shares,
        items: (items as Array<Record<string, unknown> & { qtype: QType }>).map((i) => ({ ...i, qtype_label: QTYPE_LABEL[i.qtype] })),
      };
    });
  }

  // ------------------------------------------------------------------ ghi
  private async fields(q: Q, input: Partial<QuizInput>, existing?: QuizRow) {
    const title = String(input.title ?? existing?.title ?? '').trim().replace(/\s+/g, ' ');
    if (title.length < 2 || title.length > 160) throw new BadRequestException('Tên bộ đề cần từ 2 đến 160 ký tự');
    const description = input.description === undefined ? (existing?.description ?? null) : String(input.description ?? '').trim() || null;
    if (description && description.length > 1000) throw new BadRequestException('Mô tả tối đa 1000 ký tự');
    const campaign = input.campaign_id === undefined ? (existing?.campaign_id ?? null) : input.campaign_id;
    if (campaign && !(await q('SELECT 1 FROM hist_campaigns WHERE id = $1', [campaign])).length) throw new BadRequestException('Cuộc kháng chiến không tồn tại');
    const seconds = Number(input.seconds_per_question ?? existing?.seconds_per_question ?? DEFAULT_SECONDS);
    if (!Number.isInteger(seconds) || seconds < 5 || seconds > 300) throw new BadRequestException('Thời gian mỗi câu từ 5 đến 300 giây');
    const pass = Number(input.pass_percent ?? existing?.pass_percent ?? 60);
    if (!Number.isInteger(pass) || pass < 1 || pass > 100) throw new BadRequestException('Điểm đạt từ 1% đến 100%');
    const cover = input.cover_url === undefined ? (existing?.cover_url ?? null) : input.cover_url ? String(input.cover_url).trim() : null;
    if (cover && (!MEDIA_OR_HTTPS.test(cover) || cover.length > 500)) throw new BadRequestException('Ảnh bìa phải là liên kết https hoặc ảnh đã tải lên');
    const rawTheme = input.theme === undefined ? (existing?.theme ?? {}) : input.theme;
    if (typeof rawTheme !== 'object' || rawTheme === null || Array.isArray(rawTheme)) throw new BadRequestException('Giao diện không hợp lệ');
    const bg = String((rawTheme as Record<string, unknown>).bg ?? 'default'), music = String((rawTheme as Record<string, unknown>).music ?? 'none');
    if (!(QUIZ_BACKGROUNDS as readonly string[]).includes(bg)) throw new BadRequestException('Nền giao diện không có trong danh sách');
    if (!(QUIZ_MUSIC as readonly string[]).includes(music)) throw new BadRequestException('Nhạc chờ không có trong danh sách');
    let musicUrl: string | null = null;
    if (music === 'upload') {
      const url = String((rawTheme as Record<string, unknown>).music_url ?? '');
      if (!MEDIA_PATH_ONLY.test(url)) throw new BadRequestException('Hãy chọn một tệp nhạc đã tải lên làm nhạc chờ');
      const file = (await q<{ mime: string }>('SELECT mime FROM hk_media WHERE token = $1', [url.slice(-32)]))[0];
      if (!file || !file.mime.startsWith('audio/')) throw new BadRequestException('Nhạc chờ phải là tệp nhạc (MP3, OGG) đã tải lên');
      musicUrl = url;
    }
    return {
      title, description, campaign_id: campaign, seconds_per_question: seconds, pass_percent: pass, cover_url: cover, theme: musicUrl ? { bg, music, music_url: musicUrl } : { bg, music },
      shuffle_questions: input.shuffle_questions ?? existing?.shuffle_questions ?? false, shuffle_options: input.shuffle_options ?? existing?.shuffle_options ?? false,
      search_text: searchText(title, description),
    };
  }

  /** Câu hỏi đưa vào bộ đề phải người soạn được thấy và cùng kho hoặc kho rộng hơn (bộ đề hệ thống chỉ dùng câu hỏi hệ thống) */
  private async checkItems(q: Q, user: UserRow, scope: Scope, schoolId: number | null, items: QuizItemInput[] | undefined) {
    if (!items?.length) throw new BadRequestException('Bộ đề cần ít nhất 1 câu hỏi');
    if (items.length > MAX_QUESTIONS) throw new BadRequestException(`Bộ đề tối đa ${MAX_QUESTIONS} câu hỏi`);
    const ids = items.map((i) => i.question_id);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Một câu hỏi chỉ xuất hiện một lần trong bộ đề');
    for (const item of items) {
      const question = await this.questions.load(q, user, item.question_id).catch(() => null);
      if (!question) throw new BadRequestException(`Câu hỏi #${item.question_id} không tồn tại hoặc bạn không có quyền dùng`);
      const ok = scope === 'system' ? question.scope === 'system' : scope === 'school' ? question.scope === 'system' || (question.scope === 'school' && question.school_id === schoolId) : true;
      if (!ok) throw new BadRequestException(`Câu hỏi #${item.question_id} chưa thuộc kho phù hợp với bộ đề này`);
      const points = item.points ?? 100;
      if (!Number.isInteger(points) || points < 10 || points > 1000) throw new BadRequestException('Điểm mỗi câu từ 10 đến 1000');
      if (item.seconds !== undefined && item.seconds !== null && (!Number.isInteger(item.seconds) || item.seconds < 5 || item.seconds > 300)) throw new BadRequestException('Thời gian riêng của câu từ 5 đến 300 giây');
      if (item.score_mode !== undefined && item.score_mode !== null && !['standard', 'double', 'none'].includes(item.score_mode)) throw new BadRequestException('Loại điểm là tiêu chuẩn, gấp đôi hoặc không tính điểm');
    }
  }

  private async writeItems(q: Q, quizId: number, items: QuizItemInput[]): Promise<void> {
    await q('DELETE FROM hk_quiz_questions WHERE quiz_id = $1', [quizId]);
    let position = 1;
    for (const item of items) {
      await q('INSERT INTO hk_quiz_questions (quiz_id, question_id, position, points, seconds, score_mode) VALUES ($1, $2, $3, $4, $5, $6)', [quizId, item.question_id, position, item.points ?? 100, item.seconds ?? null, item.score_mode ?? null]);
      position += 1;
    }
  }

  async create(user: UserRow, input: QuizInput) {
    const own = authoringScope(user);
    return this.db.tx(async (q) => {
      const f = await this.fields(q, input);
      await this.checkItems(q, user, own.scope, own.school_id, input.items);
      const id = (await q<{ id: number }>(
        `INSERT INTO hk_quizzes (scope, school_id, owner_id, title, description, campaign_id, seconds_per_question, shuffle_questions, shuffle_options, pass_percent, search_text, cover_url, theme)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
        [own.scope, own.school_id, own.owner_id, f.title, f.description, f.campaign_id, f.seconds_per_question, f.shuffle_questions, f.shuffle_options, f.pass_percent, f.search_text, f.cover_url, JSON.stringify(f.theme)]))[0].id;
      await this.writeItems(q, id, input.items);
      return id;
    }).then((id) => this.get(user, id));
  }

  async update(user: UserRow, id: number, input: Partial<QuizInput>) {
    await this.db.tx(async (q) => {
      const row = await this.load(q, user, id, true);
      if (!canEdit(user, row)) throw new ForbiddenException('Chỉ sửa được bộ đề do bạn soạn trong kho riêng; hãy nhân bản bộ đề dùng chung để chỉnh sửa');
      const lock = await this.lockReason(q, id);
      if (lock) throw new ConflictException(lock);
      const f = await this.fields(q, input, row);
      if (input.items !== undefined) await this.checkItems(q, user, row.scope, row.school_id, input.items);
      await q(
        `UPDATE hk_quizzes SET title = $2, description = $3, campaign_id = $4, seconds_per_question = $5, shuffle_questions = $6, shuffle_options = $7, pass_percent = $8, search_text = $9, cover_url = $10, theme = $11, updated_at = now() WHERE id = $1`,
        [id, f.title, f.description, f.campaign_id, f.seconds_per_question, f.shuffle_questions, f.shuffle_options, f.pass_percent, f.search_text, f.cover_url, JSON.stringify(f.theme)]);
      if (input.items !== undefined) await this.writeItems(q, id, input.items);
    });
    return this.get(user, id);
  }

  async remove(user: UserRow, id: number): Promise<void> {
    await this.db.tx(async (q) => {
      const row = await this.load(q, user, id, true);
      if (!canEdit(user, row)) throw new ForbiddenException('Chỉ xóa được bộ đề do bạn soạn trong kho riêng');
      const nodes = Number((await q<{ n: string }>('SELECT count(*) AS n FROM hk_nodes WHERE quiz_id = $1', [id]))[0].n);
      if (nodes) throw new ConflictException('Bộ đề đang nằm trong hành trình học; hãy gỡ khỏi hành trình trước khi xóa');
      const attempts = Number((await q<{ n: string }>("SELECT count(*) AS n FROM hk_attempts WHERE quiz_id = $1 AND mode <> 'preview'", [id]))[0].n);
      if (attempts) throw new ConflictException('Bộ đề đã có học sinh làm bài nên được giữ lại');
      await q('DELETE FROM hk_shares WHERE entity = $1 AND entity_id = $2', ['quiz', id]);
      await q('DELETE FROM hk_quizzes WHERE id = $1', [id]);
    });
  }

  /** Nhân bản về kho riêng của người dùng (HK.GV.043), giữ nguyên danh sách câu hỏi */
  async duplicate(user: UserRow, id: number) {
    const own = authoringScope(user);
    const copy = await this.db.tx(async (q) => {
      const row = await this.load(q, user, id);
      const input: QuizInput = {
        title: `${row.title} (bản sao)`.slice(0, 160), description: row.description, campaign_id: row.campaign_id, seconds_per_question: row.seconds_per_question,
        shuffle_questions: row.shuffle_questions, shuffle_options: row.shuffle_options, pass_percent: row.pass_percent, cover_url: row.cover_url, theme: row.theme,
        items: (await q<{ question_id: number; points: number; seconds: number | null; score_mode: ScoreMode | null }>('SELECT question_id, points, seconds, score_mode FROM hk_quiz_questions WHERE quiz_id = $1 ORDER BY position', [id])),
      };
      const f = await this.fields(q, input);
      // Giáo viên nhân bản bộ đề hệ thống/trường vẫn dùng chính các câu hỏi đó; quản trị tổng chỉ dùng được câu hỏi hệ thống
      await this.checkItems(q, user, own.scope, own.school_id, input.items);
      const newId = (await q<{ id: number }>(
        `INSERT INTO hk_quizzes (scope, school_id, owner_id, title, description, campaign_id, seconds_per_question, shuffle_questions, shuffle_options, pass_percent, search_text, cover_url, theme)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
        [own.scope, own.school_id, own.owner_id, f.title, f.description, f.campaign_id, f.seconds_per_question, f.shuffle_questions, f.shuffle_options, f.pass_percent, f.search_text, f.cover_url, JSON.stringify(f.theme)]))[0].id;
      await this.writeItems(q, newId, input.items);
      return newId;
    });
    return this.get(user, copy);
  }

  /**
   * Sao bộ đề sang kho khác khi duyệt chia sẻ: câu hỏi chưa thuộc kho hệ thống/kho đích được sao theo (mỗi câu một bản mới),
   * để học sinh và giáo viên khác dùng bộ đề mà không phụ thuộc vào kho riêng của người gửi.
   */
  async cloneInto(q: Q, id: number, target: { scope: Scope; school_id: number | null; owner_id: number | null }, by: number | null, copied = new Map<number, number>()): Promise<number> {
    const src = (await q<QuizRow>(`SELECT ${COLUMNS} FROM hk_quizzes WHERE id = $1`, [id]))[0];
    if (!src) throw notFound('bộ đề');
    const newId = (await q<{ id: number }>(
      `INSERT INTO hk_quizzes (scope, school_id, owner_id, title, description, campaign_id, seconds_per_question, shuffle_questions, shuffle_options, pass_percent, search_text, cover_url, theme)
       SELECT $2, $3, $4, title, description, campaign_id, seconds_per_question, shuffle_questions, shuffle_options, pass_percent, search_text, cover_url, theme FROM hk_quizzes WHERE id = $1 RETURNING id`,
      [id, target.scope, target.school_id, target.owner_id]))[0].id;
    const items = await q<{ question_id: number; position: number; points: number; seconds: number | null; score_mode: ScoreMode | null; scope: Scope; school_id: number | null }>(
      'SELECT qq.question_id, qq.position, qq.points, qq.seconds, qq.score_mode, t.scope, t.school_id FROM hk_quiz_questions qq JOIN hk_questions t ON t.id = qq.question_id WHERE qq.quiz_id = $1 ORDER BY qq.position', [id]);
    for (const item of items) {
      let questionId = item.question_id;
      const reusable = item.scope === 'system' || (item.scope === target.scope && item.school_id === target.school_id);
      if (!reusable) {
        if (!copied.has(item.question_id)) copied.set(item.question_id, await this.questions.cloneInto(q, item.question_id, target, by));
        questionId = copied.get(item.question_id)!;
      }
      await q('INSERT INTO hk_quiz_questions (quiz_id, question_id, position, points, seconds, score_mode) VALUES ($1, $2, $3, $4, $5, $6)', [newId, questionId, item.position, item.points, item.seconds, item.score_mode]);
    }
    return newId;
  }

  /**
   * Bộ đề và các câu hỏi (kèm đáp án) cho dịch vụ làm bài; nơi gọi phải tự kiểm tra quyền (qua nút của hành trình hoặc quyền xem của giáo viên).
   * Câu bình chọn (HK.GV.088) không có đáp án đúng nên chỉ phòng thi trực tiếp lấy (`polls: true`); làm bài, bài tập và hành trình bỏ qua chúng.
   */
  async forPlay(q: Q, id: number, opts: { polls?: boolean } = {}) {
    const quiz = (await q<QuizRow>(`SELECT ${COLUMNS} FROM hk_quizzes WHERE id = $1`, [id]))[0];
    if (!quiz) throw notFound('bộ đề');
    const items = await q<{ question_id: number; position: number; points: number; seconds: number | null; score_mode: ScoreMode | null; qtype: QType; prompt: string; image_url: string | null; video_url: string | null; explanation: string | null; difficulty: number; data: Record<string, unknown> }>(
      `SELECT qq.question_id, qq.position, qq.points, qq.seconds, qq.score_mode, t.qtype, t.prompt, t.image_url, t.video_url, t.explanation, t.difficulty, t.data
       FROM hk_quiz_questions qq JOIN hk_questions t ON t.id = qq.question_id WHERE qq.quiz_id = $1${opts.polls ? '' : " AND t.qtype <> 'poll'"} ORDER BY qq.position`, [id]);
    return { quiz, items };
  }
}
