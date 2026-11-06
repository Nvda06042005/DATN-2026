/**
 * Khảo sát đánh giá trải nghiệm (Sprint 12): quản trị tổng quản lý mẫu dùng chung (HK.AD.070); quản trị trường tạo từ mẫu hoặc tự soạn, gửi tới học sinh / giáo viên theo
 * lớp (HK.QT.049) và xem kết quả tổng hợp, xuất dữ liệu thô (HK.QT.050); học sinh và giáo viên trả lời một lần (HK.HS.109, HK.GV.079).
 * Kết quả luôn ẩn danh: không có tên hay tài khoản trong dữ liệu trả về hay xuất ra; ý kiến tự do ẩn khi có dưới 3 người trả lời để không lộ ai viết gì.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { toXlsx, Section } from '../analytics/export';
import { config } from '../config';
import { DatabaseService, Q, UserRow } from '../database/database.service';
import { ErrorLog } from './error-log';

export type QType = 'likert5' | 'nps' | 'single' | 'multi' | 'text';
export interface Question { id: string; type: QType; text: string; options?: string[]; required: boolean }
const TYPES: QType[] = ['likert5', 'nps', 'single', 'multi', 'text'];
export const MIN_TEXT_RESPONSES = 3;

/** Kiểm tra và chuẩn hóa danh sách câu hỏi (mẫu hoặc khảo sát tự soạn) */
export function checkQuestions(raw: unknown): Question[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 30) throw new BadRequestException('Khảo sát cần từ 1 đến 30 câu hỏi');
  const seen = new Set<string>();
  return raw.map((r, i) => {
    const q = (r ?? {}) as Record<string, unknown>;
    const type = String(q.type) as QType;
    if (!TYPES.includes(type)) throw new BadRequestException(`Câu ${i + 1}: loại câu hỏi là likert5, nps, single, multi hoặc text`);
    const text = String(q.text ?? '').trim();
    if (text.length < 3 || text.length > 300) throw new BadRequestException(`Câu ${i + 1}: nội dung từ 3 đến 300 ký tự`);
    const id = String(q.id ?? `q${i + 1}`).trim();
    if (!/^[a-z0-9_]{1,20}$/.test(id) || seen.has(id)) throw new BadRequestException(`Câu ${i + 1}: mã câu hỏi không hợp lệ hoặc bị trùng`);
    seen.add(id);
    const out: Question = { id, type, text, required: q.required === undefined ? type !== 'text' : Boolean(q.required) };
    if (type === 'single' || type === 'multi') {
      const options = Array.isArray(q.options) ? q.options.map((o) => String(o).trim()) : [];
      if (options.length < 2 || options.length > 10 || options.some((o) => !o || o.length > 100) || new Set(options).size !== options.length) throw new BadRequestException(`Câu ${i + 1}: cần 2 đến 10 lựa chọn khác nhau, mỗi lựa chọn tối đa 100 ký tự`);
      out.options = options;
    }
    return out;
  });
}

interface SurveyRow {
  id: number; school_id: number; template_id: number | null; title: string; description: string | null; audience: 'student' | 'teacher' | 'both'; questions: Question[]; class_ids: number[];
  status: 'draft' | 'open' | 'closed'; opens_at: string | null; closes_at: string | null; notified_at: string | null; created_at: string;
}
const COLS = 'id, school_id, template_id, title, description, audience, questions, class_ids, status, opens_at, closes_at, notified_at, created_at';
const EFFECTIVE = "s.status = 'open' AND (s.opens_at IS NULL OR s.opens_at <= now()) AND (s.closes_at IS NULL OR s.closes_at > now())";
const phase = (s: SurveyRow, now = Date.now()): 'draft' | 'scheduled' | 'open' | 'closed' => {
  if (s.status === 'draft') return 'draft';
  if (s.status === 'closed' || (s.closes_at && new Date(s.closes_at).getTime() <= now)) return 'closed';
  return s.opens_at && new Date(s.opens_at).getTime() > now ? 'scheduled' : 'open';
};

@Injectable()
export class SurveyService {
  constructor(private readonly db: DatabaseService) {}

  // ---------------------------------------------------------------------- mẫu dùng chung (HK.AD.070)
  async templates(user: UserRow) {
    const rows = await this.db.query('SELECT id::int AS id,school_id, title, description, audience, questions, is_active, updated_at FROM hk_survey_templates ORDER BY id');
    return rows.filter((r:any)=>user.role==='root_admin' || r.school_id===user.school_id || r.is_active).map((r:any)=>({...r,can_edit:user.role==='root_admin' || r.school_id===user.school_id}));
  }

  private cleanTemplate(body: Record<string, unknown>, cur?: Record<string, any>) {
    const has = (k: string): boolean => Object.prototype.hasOwnProperty.call(body, k);
    const title = String(has('title') ? body.title : cur?.title ?? '').trim();
    if (title.length < 3 || title.length > 160) throw new BadRequestException('Tiêu đề từ 3 đến 160 ký tự');
    const description = has('description') ? (String(body.description ?? '').trim() || null) : cur?.description ?? null;
    if (description && description.length > 600) throw new BadRequestException('Mô tả tối đa 600 ký tự');
    const audience = String(has('audience') ? body.audience : cur?.audience ?? '');
    if (!['student', 'teacher', 'both'].includes(audience)) throw new BadRequestException('Đối tượng là student, teacher hoặc both');
    const questions = checkQuestions(has('questions') ? body.questions : cur?.questions);
    return { title, description, audience, questions, is_active: has('is_active') ? Boolean(body.is_active) : cur?.is_active ?? true };
  }

  async createTemplate(user: UserRow, body: Record<string, unknown>) {
    if (user.role !== 'root_admin' && !(user.role === 'school_admin' && user.school_id)) throw new ForbiddenException('Chỉ quản trị viên tổng quản lý mẫu khảo sát');
    const v = this.cleanTemplate(body);
    return (await this.db.query('INSERT INTO hk_survey_templates (title, description, audience, questions, is_active, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id::int AS id, title, description, audience, questions, is_active, updated_at',
      [v.title, v.description, v.audience, JSON.stringify(v.questions), v.is_active, user.id]))[0];
  }

  async updateTemplate(user: UserRow, id: number, body: Record<string, unknown>) {
    await this.db.assertWorkspaceWritable('hk_survey_templates', id);
    if (user.role !== 'root_admin' && !(user.role === 'school_admin' && user.school_id)) throw new ForbiddenException('Chỉ quản trị viên tổng quản lý mẫu khảo sát');
    const cur = (await this.db.query<Record<string, any>>('SELECT * FROM hk_survey_templates WHERE id = $1', [id]))[0];
    if (!cur) throw new NotFoundException('Không tìm thấy mẫu khảo sát');
    const v = this.cleanTemplate(body, cur);
    return (await this.db.query('UPDATE hk_survey_templates SET title = $2, description = $3, audience = $4, questions = $5, is_active = $6, updated_at = now() WHERE id = $1 RETURNING id::int AS id, title, description, audience, questions, is_active, updated_at',
      [id, v.title, v.description, v.audience, JSON.stringify(v.questions), v.is_active]))[0];
  }

  async removeTemplate(user: UserRow, id: number) {
    await this.db.assertWorkspaceWritable('hk_survey_templates', id);
    if (user.role !== 'root_admin' && !(user.role === 'school_admin' && user.school_id)) throw new ForbiddenException('Chỉ quản trị viên tổng quản lý mẫu khảo sát');
    const rows = await this.db.query('DELETE FROM hk_survey_templates WHERE id = $1 RETURNING id', [id]);
    if (!rows.length) throw new NotFoundException('Không tìm thấy mẫu khảo sát'); // khảo sát đã tạo từ mẫu giữ bản chụp câu hỏi nên không bị ảnh hưởng
    return { deleted: true };
  }

  // ---------------------------------------------------------------------- đối tượng nhận
  /** Id người nhận của một khảo sát: học sinh và / hoặc giáo viên đang hoạt động của trường, giới hạn theo lớp nếu có */
  async targetIds(q: Q, s: Pick<SurveyRow, 'school_id' | 'audience' | 'class_ids'>): Promise<{ students: number[]; teachers: number[] }> {
    const scoped = s.class_ids.length > 0;
    const students = s.audience === 'teacher' ? [] : (await q<{ id: number }>(
      `SELECT u.id FROM app_users u WHERE u.role = 'student' AND u.school_id = $1 AND u.deleted_at IS NULL AND u.is_active = 1
         AND (NOT $3 OR EXISTS (SELECT 1 FROM app_class_members m WHERE m.user_id = u.id AND m.class_id = ANY($2)))`, [s.school_id, s.class_ids, scoped])).map((r) => r.id);
    const teachers = s.audience === 'student' ? [] : (await q<{ id: number }>(
      `SELECT u.id FROM app_users u WHERE u.role = 'teacher' AND u.school_id = $1 AND u.deleted_at IS NULL AND u.is_active = 1
         AND (NOT $3 OR EXISTS (SELECT 1 FROM app_class_teachers t WHERE t.teacher_id = u.id AND t.class_id = ANY($2)))`, [s.school_id, s.class_ids, scoped])).map((r) => r.id);
    return { students, teachers };
  }

  private async isTarget(q: Q, user: UserRow, s: SurveyRow): Promise<boolean> {
    if (s.school_id !== user.school_id || !['student', 'teacher'].includes(user.role)) return false;
    if (s.audience !== 'both' && s.audience !== user.role) return false;
    if (!s.class_ids.length) return true;
    const table = user.role === 'student' ? 'app_class_members m WHERE m.user_id' : 'app_class_teachers m WHERE m.teacher_id';
    return (await q(`SELECT 1 FROM ${table} = $1 AND m.class_id = ANY($2) LIMIT 1`, [user.id, s.class_ids])).length > 0;
  }

  // ---------------------------------------------------------------------- quản trị trường: tạo và quản lý (HK.QT.049)
  private schoolOf(user: UserRow): number {
    if (user.role !== 'school_admin' || !user.school_id) throw new ForbiddenException('Chỉ quản trị viên trường học tạo khảo sát cho trường mình');
    return user.school_id;
  }

  private async classIds(q: Q, schoolId: number, raw: unknown): Promise<number[]> {
    const ids = [...new Set((Array.isArray(raw) ? raw : []).map(Number).filter((n) => Number.isInteger(n)))];
    if (!ids.length) return [];
    const found = await q<{ id: number }>('SELECT id FROM app_classes WHERE id = ANY($1) AND school_id = $2', [ids, schoolId]);
    if (found.length !== ids.length) throw new NotFoundException('Có lớp không thuộc trường của bạn');
    return ids;
  }

  private dates(body: Record<string, unknown>, cur?: SurveyRow) {
    const parse = (k: 'opens_at' | 'closes_at'): string | null => {
      if (!Object.prototype.hasOwnProperty.call(body, k)) return cur?.[k] ?? null;
      if (body[k] === null || body[k] === '') return null;
      const d = new Date(String(body[k]));
      if (Number.isNaN(d.getTime())) throw new BadRequestException('Thời điểm mở / đóng không hợp lệ');
      return d.toISOString();
    };
    const opens = parse('opens_at'), closes = parse('closes_at');
    if (opens && closes && new Date(closes) <= new Date(opens)) throw new BadRequestException('Thời điểm đóng phải sau thời điểm mở');
    return { opens, closes };
  }

  async create(user: UserRow, body: Record<string, unknown>) {
    const schoolId = this.schoolOf(user);
    const created = await this.db.tx(async (q) => {
      let title = String(body.title ?? '').trim(), description = body.description ? String(body.description).trim() : null, audience = String(body.audience ?? ''), questionsRaw: unknown = body.questions;
      let templateId: number | null = null;
      if (body.template_id !== undefined && body.template_id !== null) {
        const t = (await q<{ id: number; title: string; description: string | null; audience: string; questions: unknown; is_active: boolean }>('SELECT id, title, description, audience, questions, is_active FROM hk_survey_templates WHERE id = $1', [Number(body.template_id)]))[0];
        if (!t || !t.is_active) throw new NotFoundException('Không tìm thấy mẫu khảo sát');
        templateId = t.id; title = title || t.title; description = description ?? t.description; audience = audience || t.audience; questionsRaw = body.questions ?? t.questions;
      }
      if (title.length < 3 || title.length > 160) throw new BadRequestException('Tiêu đề từ 3 đến 160 ký tự');
      if (description && description.length > 600) throw new BadRequestException('Mô tả tối đa 600 ký tự');
      if (!['student', 'teacher', 'both'].includes(audience)) throw new BadRequestException('Đối tượng là student, teacher hoặc both');
      const questions = checkQuestions(questionsRaw);
      const classIds = await this.classIds(q, schoolId, body.class_ids);
      const { opens, closes } = this.dates(body);
      const status = body.status === 'draft' ? 'draft' : 'open';
      const row = (await q<SurveyRow>(
        `INSERT INTO hk_surveys (school_id, template_id, title, description, audience, questions, class_ids, status, opens_at, closes_at, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING ${COLS}`,
        [schoolId, templateId, title, description, audience, JSON.stringify(questions), classIds, status, opens, closes, user.id]))[0];
      return row;
    });
    if (created.status === 'open') await this.notifyOpen(created.id);
    return this.view(created);
  }

  private async view(s: SurveyRow) {
    const counts = await this.db.tx(async (q) => {
      const t = await this.targetIds(q, s);
      const answered = Number((await q<{ n: string }>('SELECT count(*) AS n FROM hk_survey_responses WHERE survey_id = $1', [s.id]))[0].n);
      return { targets: t.students.length + t.teachers.length, answered };
    });
    return { ...s, phase: phase(s), targets: counts.targets, responses: counts.answered, response_rate: counts.targets ? Math.round((counts.answered / counts.targets) * 100) : null };
  }

  async list(user: UserRow) {
    const schoolId = this.schoolOf(user);
    const rows = await this.db.query<SurveyRow>(`SELECT ${COLS} FROM hk_surveys WHERE school_id = $1 ORDER BY created_at DESC, id DESC LIMIT 100`, [schoolId]);
    return Promise.all(rows.map((r) => this.view(r)));
  }

  private async own(user: UserRow, id: number, q: Q = this.db.query.bind(this.db) as Q): Promise<SurveyRow> {
    const s = (await q<SurveyRow>(`SELECT ${COLS} FROM hk_surveys WHERE id = $1`, [id]))[0];
    if (!s || (user.role === 'school_admin' ? s.school_id !== user.school_id : user.role !== 'root_admin')) throw new NotFoundException('Không tìm thấy khảo sát');
    return s;
  }

  async detail(user: UserRow, id: number) { return this.view(await this.own(user, id)); }

  async update(user: UserRow, id: number, body: Record<string, unknown>) {
    this.schoolOf(user);
    const cur = await this.own(user, id);
    const answered = Number((await this.db.query<{ n: string }>('SELECT count(*) AS n FROM hk_survey_responses WHERE survey_id = $1', [id]))[0].n);
    const has = (k: string): boolean => Object.prototype.hasOwnProperty.call(body, k);
    if ((has('questions') || has('audience') || has('class_ids')) && (answered > 0 || cur.status === 'closed')) throw new ConflictException('Khảo sát đã có câu trả lời hoặc đã đóng nên không đổi câu hỏi, đối tượng, lớp');
    const title = has('title') ? String(body.title).trim() : cur.title;
    if (title.length < 3 || title.length > 160) throw new BadRequestException('Tiêu đề từ 3 đến 160 ký tự');
    const description = has('description') ? (String(body.description ?? '').trim() || null) : cur.description;
    const audience = has('audience') ? String(body.audience) : cur.audience;
    if (!['student', 'teacher', 'both'].includes(audience)) throw new BadRequestException('Đối tượng là student, teacher hoặc both');
    const questions = has('questions') ? checkQuestions(body.questions) : cur.questions;
    const { opens, closes } = this.dates(body, cur);
    const status = has('status') ? String(body.status) : cur.status;
    if (!['draft', 'open', 'closed'].includes(status)) throw new BadRequestException('Trạng thái là draft, open hoặc closed');
    if (cur.status !== 'draft' && status === 'draft') throw new ConflictException('Khảo sát đã mở không quay lại bản nháp được');
    const classIds = has('class_ids') ? await this.classIds(this.db.query.bind(this.db) as Q, cur.school_id, body.class_ids) : cur.class_ids;
    const row = (await this.db.query<SurveyRow>(
      `UPDATE hk_surveys SET title = $2, description = $3, audience = $4, questions = $5, class_ids = $6, status = $7, opens_at = $8, closes_at = $9, updated_at = now() WHERE id = $1 RETURNING ${COLS}`,
      [id, title, description, audience, JSON.stringify(questions), classIds, status, opens, closes]))[0];
    if (row.status === 'open' && !row.notified_at) await this.notifyOpen(id);
    return this.view(row);
  }

  async remove(user: UserRow, id: number) {
    this.schoolOf(user);
    await this.own(user, id);
    const answered = Number((await this.db.query<{ n: string }>('SELECT count(*) AS n FROM hk_survey_responses WHERE survey_id = $1', [id]))[0].n);
    if (answered > 0) throw new ConflictException('Khảo sát đã có câu trả lời nên không xóa được; hãy đóng khảo sát');
    await this.db.query('DELETE FROM hk_surveys WHERE id = $1', [id]);
    return { deleted: true };
  }

  /** Báo cho người nhận một lần khi khảo sát đến giờ mở; chưa đến giờ thì việc nền sẽ làm sau */
  async notifyOpen(id: number): Promise<number> {
    return this.db.tx(async (q) => {
      const s = (await q<SurveyRow>(`SELECT ${COLS} FROM hk_surveys WHERE id = $1 FOR UPDATE`, [id]))[0];
      if (!s || s.status !== 'open' || s.notified_at || phase(s) !== 'open') return 0;
      const t = await this.targetIds(q, s);
      const ids = [...t.students, ...t.teachers];
      const until = s.closes_at ? ` Hạn trả lời: ${new Date(s.closes_at).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.` : '';
      if (ids.length) {
        await q(`INSERT INTO app_notifications (user_id, school_id, kind, title, body, ref, dedupe_key) SELECT u.id, u.school_id, 'survey', $2, $3, $4, $5 FROM app_users u WHERE u.id = ANY($1) ON CONFLICT DO NOTHING`,
          [ids, `Khảo sát mới: ${s.title}`.slice(0, 160), `Mời em / thầy cô tham gia khảo sát ẩn danh về trải nghiệm sử dụng.${until}`.slice(0, 1000), JSON.stringify({ survey_id: s.id }), `survey:${s.id}`]);
      }
      await q('UPDATE hk_surveys SET notified_at = now() WHERE id = $1', [id]);
      return ids.length;
    });
  }

  /** Việc nền: khảo sát hẹn giờ mở đã đến giờ */
  async dispatchDue(): Promise<number> {
    const due = await this.db.query<{ id: number }>("SELECT id FROM hk_surveys s WHERE s.status = 'open' AND s.notified_at IS NULL AND (s.opens_at IS NULL OR s.opens_at <= now()) AND (s.closes_at IS NULL OR s.closes_at > now()) LIMIT 50");
    let n = 0;
    for (const d of due) { try { if (await this.notifyOpen(d.id)) n += 1; } catch (e) { ErrorLog.report('job', `Không gửi được thông báo khảo sát ${d.id}: ${(e as Error).message}`); } }
    return n;
  }

  // ---------------------------------------------------------------------- người trả lời (HK.HS.109, HK.GV.079)
  async mine(user: UserRow) {
    if (!['student', 'teacher'].includes(user.role) || !user.school_id) return [];
    const rows = await this.db.query<SurveyRow & { answered_at: string | null }>(
      `SELECT ${COLS.split(', ').map((c) => `s.${c}`).join(', ')}, r.submitted_at AS answered_at FROM hk_surveys s LEFT JOIN hk_survey_responses r ON r.survey_id = s.id AND r.user_id = $2
       WHERE s.school_id = $1 AND s.status <> 'draft' AND (r.id IS NOT NULL OR (${EFFECTIVE})) ORDER BY s.created_at DESC LIMIT 50`, [user.school_id, user.id]);
    const out = [];
    for (const r of rows) {
      if (await this.isTarget(this.db.query.bind(this.db) as Q, user, r)) out.push({ id: r.id, title: r.title, description: r.description, questions: r.questions.length, closes_at: r.closes_at, answered: Boolean(r.answered_at), answered_at: r.answered_at, phase: phase(r) });
    }
    return out;
  }

  async form(user: UserRow, id: number) {
    const s = (await this.db.query<SurveyRow>(`SELECT ${COLS} FROM hk_surveys s WHERE s.id = $1`, [id]))[0];
    if (!s || !(await this.isTarget(this.db.query.bind(this.db) as Q, user, s)) || s.status === 'draft') throw new NotFoundException('Không tìm thấy khảo sát');
    const done = (await this.db.query('SELECT 1 FROM hk_survey_responses WHERE survey_id = $1 AND user_id = $2', [id, user.id])).length > 0;
    return { id: s.id, title: s.title, description: s.description, questions: s.questions, closes_at: s.closes_at, phase: phase(s), answered: done };
  }

  async respond(user: UserRow, id: number, body: Record<string, unknown>) {
    const s = (await this.db.query<SurveyRow>(`SELECT ${COLS} FROM hk_surveys WHERE id = $1`, [id]))[0];
    if (!s || !(await this.isTarget(this.db.query.bind(this.db) as Q, user, s)) || s.status === 'draft') throw new NotFoundException('Không tìm thấy khảo sát');
    if (phase(s) !== 'open') throw new ConflictException('Khảo sát chưa mở hoặc đã đóng');
    const raw = (body.answers ?? {}) as Record<string, unknown>;
    if (typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('Câu trả lời không hợp lệ');
    const answers: Record<string, unknown> = {};
    for (const q of s.questions) {
      const v = raw[q.id];
      const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
      if (empty) { if (q.required) throw new BadRequestException(`Chưa trả lời câu bắt buộc: ${q.text}`); continue; }
      if (q.type === 'likert5' || q.type === 'nps') {
        const n = Number(v), [lo, hi] = q.type === 'likert5' ? [1, 5] : [0, 10];
        if (!Number.isInteger(n) || n < lo || n > hi) throw new BadRequestException(`Câu “${q.text}”: chọn số từ ${lo} đến ${hi}`);
        answers[q.id] = n;
      } else if (q.type === 'single') {
        if (typeof v !== 'string' || !q.options!.includes(v)) throw new BadRequestException(`Câu “${q.text}”: lựa chọn không hợp lệ`);
        answers[q.id] = v;
      } else if (q.type === 'multi') {
        const list = Array.isArray(v) ? [...new Set(v.map(String))] : [];
        if (!list.length || list.some((o) => !q.options!.includes(o))) throw new BadRequestException(`Câu “${q.text}”: lựa chọn không hợp lệ`);
        answers[q.id] = list;
      } else {
        const t = String(v).trim();
        if (t.length > 1000) throw new BadRequestException(`Câu “${q.text}”: tối đa 1000 ký tự`);
        if (t) answers[q.id] = t;
      }
    }
    const res = await this.db.query('INSERT INTO hk_survey_responses (survey_id, user_id, answers) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id', [id, user.id, JSON.stringify(answers)]);
    if (!res.length) throw new ConflictException('Bạn đã trả lời khảo sát này rồi');
    return { submitted: true };
  }

  // ---------------------------------------------------------------------- kết quả tổng hợp ẩn danh (HK.QT.050)
  async results(user: UserRow, id: number) {
    const s = await this.own(user, id);
    const responses = await this.db.query<{ answers: Record<string, unknown>; role: string }>(
      'SELECT r.answers, u.role FROM hk_survey_responses r JOIN app_users u ON u.id = r.user_id WHERE r.survey_id = $1 ORDER BY r.id', [id]);
    const targets = await this.db.tx(async (q) => { const t = await this.targetIds(q, s); return { students: t.students.length, teachers: t.teachers.length }; });
    const total = responses.length;
    const questions = s.questions.map((q) => {
      const values = responses.map((r) => r.answers[q.id]).filter((v) => v !== undefined);
      const n = values.length;
      if (q.type === 'likert5' || q.type === 'nps') {
        const lo = q.type === 'likert5' ? 1 : 0, hi = q.type === 'likert5' ? 5 : 10;
        const nums = values.map(Number);
        const counts = Array.from({ length: hi - lo + 1 }, (_, i) => nums.filter((x) => x === lo + i).length);
        const out: Record<string, unknown> = { id: q.id, type: q.type, text: q.text, n, min: lo, max: hi, counts, mean: n ? Math.round((nums.reduce((a, b) => a + b, 0) / n) * 100) / 100 : null };
        if (q.type === 'nps') {
          const promoters = nums.filter((x) => x >= 9).length, detractors = nums.filter((x) => x <= 6).length;
          Object.assign(out, { promoters, passives: n - promoters - detractors, detractors, nps: n ? Math.round(((promoters - detractors) / n) * 100) : null });
        } else {
          Object.assign(out, { agree_percent: n ? Math.round((nums.filter((x) => x >= 4).length / n) * 100) : null });
        }
        return out;
      }
      if (q.type === 'single' || q.type === 'multi') {
        const flat = q.type === 'multi' ? values.flatMap((v) => v as string[]) : (values as string[]);
        return { id: q.id, type: q.type, text: q.text, n, options: q.options!.map((o) => ({ option: o, count: flat.filter((x) => x === o).length, percent: n ? Math.round((flat.filter((x) => x === o).length / n) * 100) : 0 })) };
      }
      const hidden = total < MIN_TEXT_RESPONSES;
      return { id: q.id, type: q.type, text: q.text, n, hidden, answers: hidden ? [] : (values as string[]).slice(0, 200) };
    });
    const targeted = targets.students + targets.teachers;
    return {
      survey: { id: s.id, title: s.title, audience: s.audience, status: s.status, phase: phase(s), opens_at: s.opens_at, closes_at: s.closes_at },
      targets: { total: targeted, ...targets }, responses: { total, students: responses.filter((r) => r.role === 'student').length, teachers: responses.filter((r) => r.role === 'teacher').length },
      response_rate: targeted ? Math.round((total / targeted) * 100) : null, min_text_responses: MIN_TEXT_RESPONSES, questions,
    };
  }

  /** Dữ liệu thô ẩn danh: mã ngẫu nhiên riêng của từng khảo sát (không suy ngược được ra tài khoản), vai trò, thời điểm và câu trả lời; không có tên, lớp hay email */
  async exportRaw(user: UserRow, id: number, format: 'xlsx' | 'csv'): Promise<{ data: Buffer; name: string; type: string }> {
    const s = await this.own(user, id);
    const rows = await this.db.query<{ user_id: number; role: string; answers: Record<string, unknown>; submitted_at: string }>(
      'SELECT r.user_id, u.role, r.answers, r.submitted_at FROM hk_survey_responses r JOIN app_users u ON u.id = r.user_id WHERE r.survey_id = $1 ORDER BY r.id', [id]);
    const code = (uid: number): string => createHmac('sha256', `${config.authSecret}:survey:${id}`).update(String(uid)).digest('hex').slice(0, 10);
    const cols = [{ header: 'Mã ẩn danh', key: 'code', width: 14 }, { header: 'Vai trò', key: 'role', width: 12 }, { header: 'Ngày trả lời', key: 'day', width: 14 }, ...s.questions.map((q) => ({ header: q.text.slice(0, 80), key: q.id, width: 24 }))];
    const data = rows.map((r) => ({ code: code(r.user_id), role: r.role === 'student' ? 'Học sinh' : 'Giáo viên', day: new Date(r.submitted_at).toISOString().slice(0, 10), ...Object.fromEntries(s.questions.map((q) => [q.id, Array.isArray(r.answers[q.id]) ? (r.answers[q.id] as string[]).join('; ') : r.answers[q.id] ?? ''])) }));
    const base = `khao-sat-${id}`;
    if (format === 'csv') {
      const esc = (v: unknown): string => { const t = String(v ?? ''); return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
      const csv = `﻿${[cols.map((c) => esc(c.header)).join(','), ...data.map((r) => cols.map((c) => esc((r as Record<string, unknown>)[c.key])).join(','))].join('\r\n')}\r\n`;
      return { data: Buffer.from(csv, 'utf8'), name: `${base}.csv`, type: 'text/csv; charset=utf-8' };
    }
    const sections: Section[] = [{ title: 'Câu trả lời (ẩn danh)', cols, rows: data, note: `Khảo sát: ${s.title}. Mã ẩn danh chỉ có nghĩa trong khảo sát này.` }];
    return { data: await toXlsx(s.title, sections), name: `${base}.xlsx`, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }
}
