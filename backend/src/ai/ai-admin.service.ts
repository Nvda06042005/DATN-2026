/**
 * Quản trị AI Tutor (Sprint 9, HK.AD.057–062, 064): thử câu hỏi và xem đoạn tư liệu được truy xuất (Playground), kiểm tra kết nối mô hình, nhật ký hội thoại ẩn danh,
 * xử lý báo cáo câu trả lời sai, gắn nhãn đúng / sai để xây bộ dữ liệu đánh giá, hạn mức sử dụng theo trường. Nhật ký không hiện tên học sinh: chỉ mã ẩn danh ngắn.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import { notFound } from '../content/access';
import { DatabaseService, UserRow } from '../database/database.service';
import { AiSettingsService } from './ai-settings.service';
import { AiTutorService } from './ai-tutor.service';
import { LlmClient, LlmError } from './llm.client';

const WHO = "substr(md5(c.user_id::text || 'hk-ai-log'), 1, 6)";
const DAY_START = "(date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh')";
const REPORT_STATUS = ['open', 'reviewing', 'resolved', 'dismissed'];

@Injectable()
export class AiAdminService {
  constructor(private readonly db: DatabaseService, private readonly settings: AiSettingsService, private readonly tutor: AiTutorService, private readonly llm: LlmClient) {}

  /** Playground (HK.AD.059): chạy đúng quy trình trả lời nhưng không lưu hội thoại và không tính hạn mức */
  async playground(body: { question?: string }) {
    const question = String(body.question ?? '').replace(/\s+/g, ' ').trim();
    if (question.length < 2 || question.length > 500) throw new BadRequestException('Câu hỏi từ 2 đến 500 ký tự');
    const s = await this.settings.get();
    const started = Date.now();
    const a = await this.tutor.respond({ question });
    return {
      question, ms: Date.now() - started, refused: a.refused, reason: a.reason, mode: a.mode, model: a.model, answer: a.text, citations: a.citations, followups: a.followups,
      tokens_in: a.tokensIn, tokens_out: a.tokensOut, top_score: a.topScore, min_score: s.min_score, top_k: s.top_k,
      passages: a.passages.map((p, i) => ({ n: i + 1, kind: p.kind, source_id: p.sourceId, title: p.title, coverage: Number(p.coverage.toFixed(3)), cosine: Number(p.cos.toFixed(3)), snippet: p.content.slice(0, 280) })),
    };
  }

  /** Kiểm tra kết nối (HK.AD.057): một lượt trả lời ngắn và một lượt nhúng nếu có mô hình nhúng */
  async testConnection() {
    const cfg = await this.settings.llm();
    if (!cfg) return { configured: false, chat: null, embed: null, message: 'Chưa cấu hình nhà cung cấp hoặc khóa API: AI Tutor đang dùng chế độ trích tư liệu.' };
    const out: { configured: true; provider: string; chat: Record<string, unknown>; embed: Record<string, unknown> | null } = { configured: true, provider: cfg.provider, chat: {}, embed: null };
    let t = Date.now();
    try {
      const r = await this.llm.chat(cfg, { system: 'Trả lời đúng một từ.', messages: [{ role: 'user', content: 'Nói "ok".' }], temperature: 0, maxTokens: 20 });
      out.chat = { ok: true, ms: Date.now() - t, model: cfg.chatModel, sample: r.text.slice(0, 40) };
    } catch (e) { out.chat = { ok: false, ms: Date.now() - t, model: cfg.chatModel, error: e instanceof LlmError ? e.message : 'Lỗi không xác định' }; }
    if (cfg.embedModel) {
      t = Date.now();
      try { const v = await this.llm.embed(cfg, ['Trần Hưng Đạo']); out.embed = { ok: true, ms: Date.now() - t, model: cfg.embedModel, dimensions: v[0].length }; }
      catch (e) { out.embed = { ok: false, ms: Date.now() - t, model: cfg.embedModel, error: e instanceof LlmError ? e.message : 'Lỗi không xác định' }; }
    }
    return out;
  }

  // ---------------------------------------------------------------------- nhật ký (HK.AD.060)
  async logs(f: { school_id?: number; from?: string; to?: string; reported?: string; refused?: string; page?: number }) {
    const params: unknown[] = [];
    const where: string[] = ["a.role = 'assistant'"];
    if (f.school_id) { params.push(Number(f.school_id)); where.push(`u.school_id = $${params.length}`); }
    if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) { params.push(`${f.from}T00:00:00+07:00`); where.push(`a.created_at >= $${params.length}`); }
    if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) { params.push(`${f.to}T23:59:59+07:00`); where.push(`a.created_at <= $${params.length}`); }
    if (f.reported === 'true') where.push('EXISTS (SELECT 1 FROM hk_ai_reports r WHERE r.message_id = a.id)');
    if (f.refused === 'true') where.push('a.refused');
    const page = Math.max(1, Number(f.page ?? 1) || 1);
    const from = `FROM hk_ai_messages a JOIN hk_ai_conversations c ON c.id = a.conversation_id JOIN app_users u ON u.id = c.user_id LEFT JOIN app_schools s ON s.id = u.school_id WHERE ${where.join(' AND ')}`;
    const total = Number((await this.db.query<{ n: string }>(`SELECT count(*) AS n ${from}`, params))[0].n);
    const items = await this.db.query(
      `SELECT a.id::int AS id, a.created_at, c.mode, ${WHO} AS who, u.role, s.name AS school,
              (SELECT content FROM hk_ai_messages q WHERE q.conversation_id = a.conversation_id AND q.role = 'user' AND q.id < a.id ORDER BY q.id DESC LIMIT 1) AS question,
              a.content AS answer, a.refused, a.refusal_reason, a.answer_mode, a.model, a.tokens_in, a.tokens_out, a.latency_ms, a.top_score::float8 AS top_score, a.citations, a.admin_label, a.admin_note,
              (SELECT count(*)::int FROM hk_ai_reports r WHERE r.message_id = a.id) AS reports, c.deleted_at IS NOT NULL AS deleted_by_user
       ${from} ORDER BY a.id DESC LIMIT 30 OFFSET ${(page - 1) * 30}`, params);
    return { total, page, limit: 30, items, note: 'Nhật ký ẩn danh: không hiện tên học sinh; mã người hỏi chỉ để nhận ra cùng một người trong nhật ký.' };
  }

  // ---------------------------------------------------------------------- báo cáo sai (HK.AD.061)
  async reports(status?: string) {
    const params: unknown[] = [];
    let where = '';
    if (status && REPORT_STATUS.includes(status)) { params.push(status); where = 'WHERE r.status = $1'; }
    return this.db.query(
      `SELECT r.id::int AS id, r.status, r.reason, r.resolution, r.created_at, r.handled_at, a.id::int AS message_id, a.content AS answer, a.citations, a.admin_label,
              (SELECT content FROM hk_ai_messages q WHERE q.conversation_id = a.conversation_id AND q.role = 'user' AND q.id < a.id ORDER BY q.id DESC LIMIT 1) AS question,
              s.name AS school, ${WHO} AS who
       FROM hk_ai_reports r JOIN hk_ai_messages a ON a.id = r.message_id JOIN hk_ai_conversations c ON c.id = a.conversation_id JOIN app_users u ON u.id = c.user_id
       LEFT JOIN app_schools s ON s.id = u.school_id ${where} ORDER BY (r.status IN ('open', 'reviewing')) DESC, r.id DESC LIMIT 200`, params);
  }

  async updateReport(user: UserRow, id: number, body: { status?: string; resolution?: string }) {
    const status = String(body.status ?? '');
    if (!REPORT_STATUS.includes(status)) throw new BadRequestException(`Trạng thái báo cáo thuộc: ${REPORT_STATUS.join(', ')}`);
    const resolution = String(body.resolution ?? '').trim();
    if (resolution.length > 500) throw new BadRequestException('Ghi chú xử lý tối đa 500 ký tự');
    const done = status === 'resolved' || status === 'dismissed';
    const res = await this.db.query(
      'UPDATE hk_ai_reports SET status = $2, resolution = $3, handled_by = $4, handled_at = CASE WHEN $5 THEN now() ELSE NULL END WHERE id = $1 RETURNING id', [id, status, resolution || null, user.id, done]);
    if (!res.length) throw notFound('báo cáo');
    return { id, status };
  }

  // ---------------------------------------------------------------------- đánh giá chất lượng (HK.AD.062)
  async label(user: UserRow, messageId: number, body: { label?: string | null; note?: string }) {
    const label = body.label === null || body.label === '' ? null : String(body.label);
    if (label !== null && !['correct', 'incorrect'].includes(label)) throw new BadRequestException('Nhãn là correct (đúng) hoặc incorrect (sai)');
    const note = String(body.note ?? '').trim();
    if (note.length > 500) throw new BadRequestException('Ghi chú tối đa 500 ký tự');
    const res = await this.db.query("UPDATE hk_ai_messages SET admin_label = $2, admin_note = $3, labeled_by = $4, labeled_at = CASE WHEN $2::text IS NULL THEN NULL ELSE now() END WHERE id = $1 AND role = 'assistant' RETURNING id", [messageId, label, note || null, user.id]);
    if (!res.length) throw notFound('câu trả lời');
    return { id: messageId, label };
  }

  async evalSummary() {
    const c = (await this.db.query<{ labeled: number; correct: number; incorrect: number; total: number }>(
      `SELECT count(*) FILTER (WHERE admin_label IS NOT NULL)::int AS labeled, count(*) FILTER (WHERE admin_label = 'correct')::int AS correct,
              count(*) FILTER (WHERE admin_label = 'incorrect')::int AS incorrect, count(*) FILTER (WHERE role = 'assistant' AND NOT refused)::int AS total FROM hk_ai_messages WHERE role = 'assistant'`))[0];
    return { ...c, accuracy: c.labeled ? Number((c.correct / c.labeled).toFixed(3)) : null };
  }

  async evalDataset() {
    return this.db.query(
      `SELECT a.id::int AS id, (SELECT content FROM hk_ai_messages q WHERE q.conversation_id = a.conversation_id AND q.role = 'user' AND q.id < a.id ORDER BY q.id DESC LIMIT 1) AS question,
              a.content AS answer, a.citations, a.answer_mode, a.admin_label AS label, a.admin_note AS note FROM hk_ai_messages a WHERE a.admin_label IS NOT NULL ORDER BY a.id`);
  }

  // ---------------------------------------------------------------------- hạn mức (HK.AD.064)
  async limits() {
    const s = await this.settings.get();
    const schools = await this.db.query(
      `SELECT s.id, s.name, s.school_code, l.daily_per_user, l.daily_per_school,
              (SELECT count(*)::int FROM hk_ai_messages m JOIN hk_ai_conversations c ON c.id = m.conversation_id JOIN app_users u ON u.id = c.user_id WHERE u.school_id = s.id AND m.role = 'user' AND m.created_at >= ${DAY_START}) AS used_today
       FROM app_schools s LEFT JOIN hk_ai_school_limits l ON l.school_id = s.id ORDER BY s.name`);
    return { defaults: { daily_per_user: s.daily_per_user, daily_per_school: s.daily_per_school }, schools };
  }

  async setLimit(user: UserRow, schoolId: number, body: { daily_per_user?: number | null; daily_per_school?: number | null }) {
    if (!(await this.db.query('SELECT 1 FROM app_schools WHERE id = $1', [schoolId])).length) throw notFound('trường');
    const num = (v: unknown, max: number, label: string): number | null => {
      if (v === null || v === undefined || v === '') return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > max) throw new BadRequestException(`${label}: số nguyên từ 1 đến ${max} (để trống là dùng mặc định)`);
      return n;
    };
    const perUser = num(body.daily_per_user, 500, 'Số câu hỏi mỗi người mỗi ngày'), perSchool = num(body.daily_per_school, 100000, 'Số câu hỏi mỗi trường mỗi ngày');
    if (perUser === null && perSchool === null) await this.db.query('DELETE FROM hk_ai_school_limits WHERE school_id = $1', [schoolId]);
    else await this.db.query('INSERT INTO hk_ai_school_limits (school_id, daily_per_user, daily_per_school, updated_by) VALUES ($1, $2, $3, $4) ON CONFLICT (school_id) DO UPDATE SET daily_per_user = $2, daily_per_school = $3, updated_by = $4, updated_at = now()', [schoolId, perUser, perSchool, user.id]);
    return { school_id: schoolId, daily_per_user: perUser, daily_per_school: perSchool };
  }
}
