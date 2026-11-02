/**
 * Ngân hàng câu hỏi (HK.GV.030–037, 039, HK.AD.045): xem theo kho (của tôi / trường / hệ thống) và theo chủ đề, tìm kiếm, tạo nhiều dạng,
 * sửa có lưu lịch sử, xóa khi chưa dùng, nhập/xuất Excel, gắn dữ liệu lịch sử, sao chép về kho riêng. Việc gửi duyệt nằm ở ShareService.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { buildWorkbook, checkUpload, Column, readSheet, UploadedXlsx } from '../admin/excel';
import { likeEscape } from '../admin/school.service';
import { DatabaseService, Q, searchText, UserRow } from '../database/database.service';
import { authoringScope, canEdit, canSee, checkLinks, LinkInput, linkLabels, notFound, Owned, Scope, storeSql, visibleSql } from './access';
import { dataText, normalizeData, QTYPE_LABEL, QTYPES, QType } from './questions';

export interface QuestionInput {
  qtype: QType; prompt: string; image_url?: string | null; video_url?: string | null; explanation?: string | null; difficulty?: number; campaign_id?: number | null; data: unknown; links?: LinkInput[];
}
export interface QuestionFilter { q?: string; store?: string; campaign_id?: number; qtype?: string; difficulty?: number; ref_type?: string; ref_id?: number; page?: number; limit?: number }

export interface QuestionRow extends Owned {
  id: number; qtype: QType; prompt: string; image_url: string | null; video_url: string | null; explanation: string | null; difficulty: number; campaign_id: number | null;
  data: Record<string, unknown>; version_no: number; created_at: string; updated_at: string;
}

const COLUMNS = 'id, scope, school_id, owner_id, qtype, prompt, image_url, video_url, explanation, difficulty, campaign_id, data, version_no, created_at, updated_at';
const MAX_PAGE = 100;
/** Ảnh đã tải lên qua /api/content/media */
export const MEDIA_PATH = /^\/api\/content\/media\/[0-9a-f]{32}$/;

/** Chuỗi JSON có khóa sắp xếp: PostgreSQL jsonb đổi thứ tự khóa nên không so sánh trực tiếp được */
const stable = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) : x));

/** Đề bài và giải thích: gọn khoảng trắng nhưng giữ nguyên dấu "____" của chỗ trống */
const tidy = (s: unknown): string => (typeof s === 'string' ? s.trim().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') : '');

function plainFields(input: Partial<QuestionInput>, existing?: QuestionRow) {
  const prompt = tidy(input.prompt ?? existing?.prompt);
  if (prompt.length < 3 || prompt.length > 1000) throw new BadRequestException('Đề bài cần từ 3 đến 1000 ký tự');
  const image = input.image_url === undefined ? (existing?.image_url ?? null) : input.image_url ? String(input.image_url).trim() : null;
  if (image && (!(/^https:\/\//.test(image) || MEDIA_PATH.test(image)) || image.length > 500)) throw new BadRequestException('Hình ảnh phải là liên kết https hoặc ảnh đã tải lên (tối đa 500 ký tự)');
  const video = input.video_url === undefined ? (existing?.video_url ?? null) : input.video_url ? String(input.video_url).trim() : null;
  if (video && (!/^https:\/\//.test(video) || video.length > 500)) throw new BadRequestException('Video phải là liên kết https (tối đa 500 ký tự)');
  const explanation = input.explanation === undefined ? (existing?.explanation ?? null) : tidy(input.explanation) || null;
  if (explanation && explanation.length > 2000) throw new BadRequestException('Giải thích tối đa 2000 ký tự');
  const difficulty = Number(input.difficulty ?? existing?.difficulty ?? 2);
  if (![1, 2, 3].includes(difficulty)) throw new BadRequestException('Độ khó từ 1 (dễ) đến 3 (khó)');
  return { prompt, image_url: image, video_url: video, explanation, difficulty };
}

@Injectable()
export class QuestionService {
  constructor(private readonly db: DatabaseService) {}

  // ------------------------------------------------------------------ đọc
  async list(user: UserRow, f: QuestionFilter) {
    const where = await this.filterSql(user, f);
    const limit = Math.min(MAX_PAGE, Math.max(1, f.limit ?? 20));
    const page = Math.max(1, f.page ?? 1);
    const total = Number((await this.db.query<{ n: string }>(`SELECT count(*) AS n FROM hk_questions t WHERE ${where.sql}`, where.params))[0].n);
    const params = [...where.params, limit, (page - 1) * limit];
    const rows = await this.db.query<QuestionRow & { campaign_title: string | null; owner_name: string | null; used_in: number }>(
      `SELECT t.id, t.scope, t.school_id, t.owner_id, t.qtype, t.prompt, t.difficulty, t.campaign_id, c.title AS campaign_title, t.version_no, t.updated_at, u.full_name AS owner_name,
              (SELECT count(*)::int FROM hk_quiz_questions qq WHERE qq.question_id = t.id) AS used_in
       FROM hk_questions t LEFT JOIN hist_campaigns c ON c.id = t.campaign_id LEFT JOIN app_users u ON u.id = t.owner_id
       WHERE ${where.sql} ORDER BY t.updated_at DESC, t.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return {
      total, page, limit,
      items: rows.map((r) => ({ ...r, qtype_label: QTYPE_LABEL[r.qtype], can_edit: canEdit(user, r) })),
    };
  }

  private async filterSql(user: UserRow, f: QuestionFilter): Promise<{ sql: string; params: unknown[] }> {
    const params: unknown[] = [];
    const parts = [visibleSql(user, 't', params), storeSql(user, 't', f.store, params)];
    const term = searchText(f.q ?? '');
    if (term) { params.push(`%${likeEscape(term)}%`); parts.push(`t.search_text LIKE $${params.length}`); }
    if (f.campaign_id) { params.push(f.campaign_id); parts.push(`t.campaign_id = $${params.length}`); }
    if (f.qtype) { if (!(QTYPES as readonly string[]).includes(f.qtype)) throw new BadRequestException('Dạng câu hỏi không hợp lệ'); params.push(f.qtype); parts.push(`t.qtype = $${params.length}`); }
    if (f.difficulty) { params.push(f.difficulty); parts.push(`t.difficulty = $${params.length}`); }
    if (f.ref_type && f.ref_id) { params.push(f.ref_type, f.ref_id); parts.push(`EXISTS (SELECT 1 FROM hk_question_links l WHERE l.question_id = t.id AND l.ref_type = $${params.length - 1} AND l.ref_id = $${params.length})`); }
    return { sql: parts.join(' AND '), params };
  }

  async load(q: Q, user: UserRow, id: number, lock = false): Promise<QuestionRow> {
    const row = (await q<QuestionRow>(`SELECT ${COLUMNS} FROM hk_questions WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id]))[0];
    if (!row || !canSee(user, row)) throw notFound('câu hỏi');
    return row;
  }

  async get(user: UserRow, id: number) {
    return this.db.tx(async (q) => this.view(q, user, await this.load(q, user, id)));
  }

  private async view(q: Q, user: UserRow, row: QuestionRow) {
    const links = await q<LinkInput>('SELECT ref_type, ref_id FROM hk_question_links WHERE question_id = $1 ORDER BY ref_type, ref_id', [row.id]);
    const usage = await this.usage(q, row.id);
    const shares = await q<{ target: string; status: string; review_note: string | null }>(
      "SELECT target, status, review_note FROM hk_shares WHERE entity = 'question' AND entity_id = $1", [row.id]);
    const owner = row.owner_id ? (await q<{ full_name: string }>('SELECT full_name FROM app_users WHERE id = $1', [row.owner_id]))[0]?.full_name ?? null : null;
    return {
      ...row, qtype_label: QTYPE_LABEL[row.qtype], owner_name: owner, can_edit: canEdit(user, row),
      links: await linkLabels(q, links), used_in: usage.quizzes, used_in_lessons: usage.lessons, answered: usage.answers, shares,
    };
  }

  private async usage(q: Q, id: number) {
    const quizzes = await q<{ id: number; title: string }>('SELECT z.id, z.title FROM hk_quiz_questions qq JOIN hk_quizzes z ON z.id = qq.quiz_id WHERE qq.question_id = $1 ORDER BY z.title', [id]);
    const lessons = Number((await q<{ n: string }>('SELECT count(*) AS n FROM hk_lesson_checks WHERE question_id = $1', [id]))[0].n);
    const answers = Number((await q<{ n: string }>('SELECT count(*) AS n FROM hk_attempt_answers WHERE question_id = $1', [id]))[0].n);
    return { quizzes, lessons, answers };
  }

  async versions(user: UserRow, id: number) {
    await this.get(user, id);
    return this.db.query(
      `SELECT v.version_no, v.snapshot, v.created_at, u.full_name AS changed_by_name FROM hk_question_versions v LEFT JOIN app_users u ON u.id = v.changed_by
       WHERE v.question_id = $1 ORDER BY v.version_no DESC`, [id]);
  }

  // ------------------------------------------------------------------ ghi
  /** Kiểm tra toàn bộ nội dung và trả về các cột sẵn sàng ghi */
  private async fields(q: Q, input: Partial<QuestionInput>, existing?: QuestionRow) {
    const qtype = (input.qtype ?? existing?.qtype) as QType;
    if (!(QTYPES as readonly string[]).includes(qtype)) throw new BadRequestException('Dạng câu hỏi không hợp lệ');
    const plain = plainFields(input, existing);
    const data = normalizeData(qtype, input.data ?? existing?.data, plain.prompt);
    const campaign = input.campaign_id === undefined ? (existing?.campaign_id ?? null) : input.campaign_id;
    if (campaign && !(await q('SELECT 1 FROM hist_campaigns WHERE id = $1', [campaign])).length) throw new BadRequestException('Cuộc kháng chiến không tồn tại');
    return { qtype, ...plain, data, campaign_id: campaign, search_text: searchText(plain.prompt, plain.explanation, dataText(data as Record<string, unknown>)) };
  }

  private async writeLinks(q: Q, id: number, links: LinkInput[]): Promise<void> {
    await q('DELETE FROM hk_question_links WHERE question_id = $1', [id]);
    for (const l of links) await q('INSERT INTO hk_question_links (question_id, ref_type, ref_id) VALUES ($1, $2, $3)', [id, l.ref_type, l.ref_id]);
  }

  private async snapshot(q: Q, row: { id: number }, version: number, by: number | null): Promise<void> {
    const cur = (await q<Record<string, unknown>>(`SELECT qtype, prompt, image_url, video_url, explanation, difficulty, campaign_id, data FROM hk_questions WHERE id = $1`, [row.id]))[0];
    const links = await q<LinkInput>('SELECT ref_type, ref_id FROM hk_question_links WHERE question_id = $1 ORDER BY ref_type, ref_id', [row.id]);
    await q('INSERT INTO hk_question_versions (question_id, version_no, snapshot, changed_by) VALUES ($1, $2, $3, $4)', [row.id, version, JSON.stringify({ ...cur, links }), by]);
  }

  async create(user: UserRow, input: QuestionInput) {
    const own = authoringScope(user);
    return this.db.tx(async (q) => {
      const f = await this.fields(q, input);
      const links = await checkLinks(q, input.links);
      const id = (await q<{ id: number }>(
        `INSERT INTO hk_questions (scope, school_id, owner_id, qtype, prompt, image_url, video_url, explanation, difficulty, campaign_id, data, search_text)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [own.scope, own.school_id, own.owner_id, f.qtype, f.prompt, f.image_url, f.video_url, f.explanation, f.difficulty, f.campaign_id, JSON.stringify(f.data), f.search_text]))[0].id;
      await this.writeLinks(q, id, links);
      await this.snapshot(q, { id }, 1, user.id);
      return this.view(q, user, await this.load(q, user, id));
    });
  }

  async update(user: UserRow, id: number, input: Partial<QuestionInput>) {
    return this.db.tx(async (q) => {
      const row = await this.load(q, user, id, true);
      if (!canEdit(user, row)) throw new ForbiddenException('Chỉ sửa được câu hỏi do bạn soạn trong kho riêng; hãy sao chép câu hỏi dùng chung về kho của bạn để chỉnh sửa');
      const f = await this.fields(q, input, row);
      const links = input.links === undefined ? undefined : await checkLinks(q, input.links);
      const oldLinks = JSON.stringify(await q('SELECT ref_type, ref_id FROM hk_question_links WHERE question_id = $1 ORDER BY ref_type, ref_id', [id]));
      const changed =
        f.qtype !== row.qtype || f.prompt !== row.prompt || f.image_url !== row.image_url || f.video_url !== row.video_url || f.explanation !== row.explanation || f.difficulty !== row.difficulty ||
        f.campaign_id !== row.campaign_id || stable(f.data) !== stable(row.data) ||
        (links !== undefined && JSON.stringify([...links].sort((a, b) => a.ref_type.localeCompare(b.ref_type) || a.ref_id - b.ref_id)) !== oldLinks);
      if (changed) {
        const version = row.version_no + 1;
        await q(
          `UPDATE hk_questions SET qtype = $2, prompt = $3, image_url = $4, video_url = $11, explanation = $5, difficulty = $6, campaign_id = $7, data = $8, search_text = $9, version_no = $10, updated_at = now() WHERE id = $1`,
          [id, f.qtype, f.prompt, f.image_url, f.explanation, f.difficulty, f.campaign_id, JSON.stringify(f.data), f.search_text, version, f.video_url]);
        if (links !== undefined) await this.writeLinks(q, id, links);
        await this.snapshot(q, { id }, version, user.id);
      }
      return this.view(q, user, await this.load(q, user, id));
    });
  }

  async remove(user: UserRow, id: number): Promise<void> {
    await this.db.tx(async (q) => {
      const row = await this.load(q, user, id, true);
      if (!canEdit(user, row)) throw new ForbiddenException('Chỉ xóa được câu hỏi do bạn soạn trong kho riêng');
      const use = await this.usage(q, id);
      if (use.quizzes.length) throw new ConflictException(`Câu hỏi đang nằm trong bộ đề: ${use.quizzes.map((z) => z.title).join(', ')}. Hãy gỡ khỏi bộ đề trước`);
      if (use.lessons) throw new ConflictException('Câu hỏi đang là câu kiểm tra nhanh của một bài học');
      if (use.answers) throw new ConflictException('Câu hỏi đã có học sinh trả lời nên được giữ lại để xem lịch sử làm bài');
      await q('DELETE FROM hk_shares WHERE entity = $1 AND entity_id = $2', ['question', id]);
      await q('DELETE FROM hk_questions WHERE id = $1', [id]);
    });
  }

  /** Sao một câu hỏi sang kho khác (dùng khi duyệt chia sẻ và khi giáo viên chép câu dùng chung về kho riêng) */
  async cloneInto(q: Q, id: number, target: { scope: Scope; school_id: number | null; owner_id: number | null }, by: number | null): Promise<number> {
    const src = (await q<QuestionRow>(`SELECT ${COLUMNS} FROM hk_questions WHERE id = $1`, [id]))[0];
    if (!src) throw notFound('câu hỏi');
    const row = (await q<{ id: number }>(
      `INSERT INTO hk_questions (scope, school_id, owner_id, qtype, prompt, image_url, video_url, explanation, difficulty, campaign_id, data, search_text)
       SELECT $2, $3, $4, qtype, prompt, image_url, video_url, explanation, difficulty, campaign_id, data, search_text FROM hk_questions WHERE id = $1 RETURNING id`,
      [id, target.scope, target.school_id, target.owner_id]))[0];
    await q('INSERT INTO hk_question_links (question_id, ref_type, ref_id) SELECT $2, ref_type, ref_id FROM hk_question_links WHERE question_id = $1', [id, row.id]);
    await this.snapshot(q, row, 1, by);
    return row.id;
  }

  async copyToMine(user: UserRow, id: number) {
    const own = authoringScope(user);
    return this.db.tx(async (q) => {
      await this.load(q, user, id);
      const copy = await this.cloneInto(q, id, own, user.id);
      return this.view(q, user, await this.load(q, user, copy));
    });
  }

  // ------------------------------------------------------------------ Excel (HK.GV.035, 036)
  private readonly COLS: Column[] = [
    { key: 'qtype', header: 'Dạng câu hỏi *', width: 20, required: true },
    { key: 'prompt', header: 'Đề bài *', width: 60, required: true },
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ key: `o${n}`, header: `Lựa chọn ${n}`, width: 26 })),
    { key: 'answer', header: 'Đáp án *', width: 30, required: true },
    { key: 'explanation', header: 'Giải thích', width: 50 },
    { key: 'difficulty', header: 'Độ khó (1-3)', width: 12 },
    { key: 'campaign', header: 'Cuộc kháng chiến', width: 30 },
    { key: 'image_url', header: 'Liên kết hình ảnh (https)', width: 40 },
  ];

  private static readonly TYPE_ALIASES: Record<string, QType> = {
    'mot dap an': 'single', single: 'single', 'nhieu dap an': 'multiple', multiple: 'multiple', 'dung sai': 'truefalse', 'dung/sai': 'truefalse', 'dung / sai': 'truefalse', truefalse: 'truefalse',
    'dien khuyet': 'fill', fill: 'fill', 'sap xep': 'order', 'sap xep thu tu': 'order', order: 'order', 'keo tha ban do': 'map', map: 'map',
  };

  async template(): Promise<Buffer> {
    return buildWorkbook('Câu hỏi', this.COLS, [
      { qtype: 'Một đáp án', prompt: 'Ai được vua Trần giao chức Quốc công Tiết chế thống lĩnh quân đội trong kháng chiến lần II và III?', o1: 'Trần Quang Khải', o2: 'Trần Hưng Đạo', o3: 'Trần Nhật Duật', answer: '2', explanation: 'Trần Hưng Đạo được giao chỉ huy toàn quân.', difficulty: '1', campaign: '' },
      { qtype: 'Nhiều đáp án', prompt: 'Những địa danh nào gắn với kháng chiến chống Nguyên – Mông?', o1: 'Bạch Đằng', o2: 'Chương Dương', o3: 'Điện Biên Phủ', o4: 'Hàm Tử', answer: '1,2,4', difficulty: '2' },
      { qtype: 'Đúng/sai', prompt: 'Hội nghị Diên Hồng họp để bàn việc đánh hay hòa.', answer: 'Đúng', difficulty: '1' },
      { qtype: 'Điền khuyết', prompt: 'Năm ____, quân dân nhà Trần giành chiến thắng trên sông ____.', answer: '1288; Bạch Đằng|Bạch Đằng Giang', difficulty: '2' },
      { qtype: 'Sắp xếp', prompt: 'Sắp xếp các sự kiện theo thứ tự thời gian.', o1: 'Hội nghị Diên Hồng', o2: 'Chiến thắng Hàm Tử', o3: 'Chiến thắng Bạch Đằng', answer: '', difficulty: '2' },
    ], [
      'Mỗi dòng là một câu hỏi. Dạng câu hỏi: Một đáp án, Nhiều đáp án, Đúng/sai, Điền khuyết, Sắp xếp. Dạng kéo thả lên bản đồ chỉ tạo trên giao diện.',
      'Một đáp án / Nhiều đáp án: điền các lựa chọn vào cột Lựa chọn 1…8; cột Đáp án ghi số thứ tự lựa chọn đúng (ví dụ 2 hoặc 1,3).',
      'Đúng/sai: cột Đáp án ghi Đúng hoặc Sai.',
      'Điền khuyết: đề bài đánh dấu chỗ trống bằng ____; cột Đáp án ghi đáp án từng chỗ trống, cách nhau dấu chấm phẩy; nhiều cách viết cùng được chấp nhận thì cách nhau dấu |.',
      'Sắp xếp: nhập các mục theo ĐÚNG thứ tự vào Lựa chọn 1…8 (hệ thống tự xáo trộn khi hiển thị); cột Đáp án để trống.',
      'Độ khó: 1 (dễ), 2 (vừa), 3 (khó). Cuộc kháng chiến: ghi đúng tên trong kho lịch sử (để trống nếu không gắn). Xóa các dòng ví dụ trước khi nhập.',
    ]);
  }

  private rowToInput(v: Record<string, string>, campaigns: Map<string, number>): QuestionInput {
    const qtype = QuestionService.TYPE_ALIASES[searchText(v.qtype)];
    if (!qtype) throw new BadRequestException('Dạng câu hỏi không nhận ra (Một đáp án, Nhiều đáp án, Đúng/sai, Điền khuyết, Sắp xếp)');
    if (qtype === 'map') throw new BadRequestException('Dạng kéo thả bản đồ chỉ tạo trên giao diện, không nhập từ Excel');
    const opts = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => v[`o${n}`]).filter(Boolean);
    const campaignKey = searchText(v.campaign);
    if (campaignKey && !campaigns.has(campaignKey)) throw new BadRequestException(`Không có cuộc kháng chiến "${v.campaign}" trong kho lịch sử`);
    const base = {
      qtype, prompt: v.prompt, explanation: v.explanation || null, image_url: v.image_url || null, campaign_id: campaignKey ? campaigns.get(campaignKey)! : null,
      difficulty: v.difficulty ? Number(v.difficulty) : 2,
    };
    const optionList = opts.map((text, i) => ({ id: String.fromCharCode(97 + i), text }));
    const index = (token: string): string => {
      const n = Number(token.trim());
      if (!Number.isInteger(n) || n < 1 || n > opts.length) throw new BadRequestException(`Đáp án "${token}" không khớp số thứ tự lựa chọn (1–${opts.length})`);
      return String.fromCharCode(96 + n);
    };
    if (qtype === 'single') return { ...base, data: { options: optionList, correct: index(v.answer) } };
    if (qtype === 'multiple') return { ...base, data: { options: optionList, correct: v.answer.split(/[,;\s]+/).filter(Boolean).map(index) } };
    if (qtype === 'truefalse') {
      const a = searchText(v.answer);
      if (!['dung', 'true', '1'].includes(a) && !['sai', 'false', '0'].includes(a)) throw new BadRequestException('Đáp án đúng/sai phải ghi Đúng hoặc Sai');
      return { ...base, data: { correct: ['dung', 'true', '1'].includes(a) } };
    }
    if (qtype === 'fill') return { ...base, data: { blanks: v.answer.split(';').map((b) => ({ accept: b.split('|').map((x) => x.trim()).filter(Boolean) })) } };
    return { ...base, data: { items: optionList } };
  }

  private async campaignIndex(): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    for (const c of await this.db.query<{ id: number; title: string; slug: string }>('SELECT id, title, slug FROM hist_campaigns')) { map.set(searchText(c.title), c.id); map.set(c.slug, c.id); }
    return map;
  }

  async importXlsx(user: UserRow, file: UploadedXlsx | undefined, commit: boolean) {
    authoringScope(user);
    const rows = await readSheet(checkUpload(file), this.COLS);
    const campaigns = await this.campaignIndex();
    const out: Array<{ row: number; prompt: string; status: 'ok' | 'error' | 'created'; errors: string[]; id?: number }> = [];
    for (const r of rows) {
      const errors: string[] = [];
      let input: QuestionInput | null = null;
      try {
        input = this.rowToInput(r.values, campaigns);
        await this.db.tx((q) => this.fields(q, input!));
      } catch (e) {
        errors.push((e as { response?: { message?: string | string[] }; message: string }).response?.message?.toString() ?? (e as Error).message);
      }
      const entry: { row: number; prompt: string; status: 'ok' | 'error' | 'created'; errors: string[]; id?: number } = { row: r.row, prompt: r.values.prompt, status: errors.length ? 'error' : 'ok', errors };
      if (!errors.length && commit && input) {
        entry.id = (await this.create(user, input)).id;
        entry.status = 'created';
      }
      out.push(entry);
    }
    const bad = out.filter((r) => r.status === 'error').length;
    return { committed: commit, total: out.length, valid: out.length - bad, errors: bad, created: out.filter((r) => r.status === 'created').length, rows: out };
  }

  async exportXlsx(user: UserRow, f: QuestionFilter): Promise<Buffer> {
    const where = await this.filterSql(user, f);
    const rows = await this.db.query<QuestionRow & { campaign_title: string | null }>(
      `SELECT t.id, t.qtype, t.prompt, t.explanation, t.difficulty, t.image_url, t.data, c.title AS campaign_title FROM hk_questions t LEFT JOIN hist_campaigns c ON c.id = t.campaign_id
       WHERE ${where.sql} ORDER BY t.updated_at DESC, t.id DESC LIMIT 1000`, where.params);
    const out = rows.map((r) => {
      const d = r.data as Record<string, any>;
      const cells: Record<string, unknown> = { qtype: QTYPE_LABEL[r.qtype], prompt: r.prompt, explanation: r.explanation ?? '', difficulty: String(r.difficulty), campaign: r.campaign_title ?? '', image_url: r.image_url ?? '' };
      const list = (d.options ?? d.items ?? []) as Array<{ id: string; text: string }>;
      list.slice(0, 8).forEach((o, i) => { cells[`o${i + 1}`] = o.text; });
      if (r.qtype === 'single') cells.answer = String(list.findIndex((o) => o.id === d.correct) + 1);
      else if (r.qtype === 'multiple') cells.answer = list.map((o, i) => ((d.correct as string[]).includes(o.id) ? i + 1 : 0)).filter(Boolean).join(',');
      else if (r.qtype === 'truefalse') cells.answer = d.correct ? 'Đúng' : 'Sai';
      else if (r.qtype === 'fill') cells.answer = (d.blanks as Array<{ accept: string[] }>).map((b) => b.accept.join('|')).join('; ');
      else if (r.qtype === 'order') cells.answer = '';
      else cells.answer = (d.targets as Array<{ label: string; lat: number; lng: number }>).map((t) => `${t.label} (${t.lat}; ${t.lng})`).join(' · ');
      return cells;
    });
    return buildWorkbook('Câu hỏi', this.COLS, out, ['Danh sách câu hỏi đã lọc. Dạng kéo thả bản đồ chỉ để xem; không nhập lại được từ Excel.']);
  }
}
