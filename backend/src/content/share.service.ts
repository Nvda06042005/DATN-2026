/**
 * Chia sẻ và duyệt nội dung (HK.GV.029, 039, HK.QT.041, HK.QT.042, HK.AD.045): giáo viên gửi câu hỏi / bộ đề / hành trình vào kho trường,
 * quản trị viên trường duyệt (hoặc từ chối kèm lý do) và có thể đề xuất nội dung của kho trường lên kho hệ thống để quản trị tổng duyệt.
 * Khi duyệt, nội dung được sao thành bản mới trong kho đích; bản của người gửi giữ nguyên để họ tiếp tục sửa.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService, Q, UserRow } from '../database/database.service';
import { notFound, Scope } from './access';
import { JourneyService } from './journey.service';
import { QuestionService } from './question.service';
import { QuizService } from './quiz.service';

export type ShareEntity = 'question' | 'quiz' | 'journey';
export type ShareTarget = 'school' | 'system';
const ENTITIES: ShareEntity[] = ['question', 'quiz', 'journey'];
const TABLE: Record<ShareEntity, string> = { question: 'hk_questions', quiz: 'hk_quizzes', journey: 'hk_journeys' };
const TITLE: Record<ShareEntity, string> = { question: 'left(t.prompt, 120)', quiz: 't.title', journey: 't.title' };
const LABEL: Record<ShareEntity, string> = { question: 'câu hỏi', quiz: 'bộ đề', journey: 'hành trình' };

interface ShareRow {
  id: number; entity: ShareEntity; entity_id: number; target: ShareTarget; status: 'pending' | 'approved' | 'rejected'; result_id: number | null; school_id: number | null;
  requested_by: number | null; reviewed_by: number | null; review_note: string | null; created_at: string; reviewed_at: string | null;
}

@Injectable()
export class ShareService {
  constructor(
    private readonly db: DatabaseService,
    private readonly questions: QuestionService,
    private readonly quizzes: QuizService,
    private readonly journeys: JourneyService,
  ) {}

  /** Gửi nội dung đi duyệt: giáo viên → kho trường; quản trị viên trường → kho hệ thống */
  async request(user: UserRow, entity: ShareEntity, entityId: number, to: ShareTarget) {
    if (!ENTITIES.includes(entity)) throw new BadRequestException('Loại nội dung không hợp lệ');
    const wantRole = to === 'school' ? 'teacher' : 'school_admin';
    if (user.role !== wantRole) {
      throw new ForbiddenException(to === 'school' ? 'Giáo viên gửi nội dung vào kho chung của trường' : 'Quản trị viên trường đề xuất nội dung của kho trường lên kho hệ thống');
    }
    if (!user.school_id) throw new ForbiddenException('Tài khoản chưa được gán trường');
    const fromScope: Scope = to === 'school' ? 'teacher' : 'school';
    const share = await this.db.tx(async (q) => {
      const item = (await q<{ scope: Scope; school_id: number | null; owner_id: number | null }>(`SELECT scope, school_id, owner_id FROM ${TABLE[entity]} WHERE id = $1 FOR UPDATE`, [entityId]))[0];
      const mine = item && item.scope === fromScope && (fromScope === 'teacher' ? item.owner_id === user.id : item.school_id === user.school_id);
      if (!item || !mine) throw notFound(LABEL[entity]);
      if (entity === 'journey') {
        const problems = await this.journeys.problems(q, entityId);
        if (problems.length) throw new BadRequestException(`Hành trình chưa đủ điều kiện để chia sẻ: ${problems.join('; ')}`);
      }
      if (entity === 'quiz' && !Number((await q<{ n: string }>('SELECT count(*) AS n FROM hk_quiz_questions WHERE quiz_id = $1', [entityId]))[0].n)) throw new BadRequestException('Bộ đề chưa có câu hỏi nào');
      const existing = (await q<ShareRow>('SELECT * FROM hk_shares WHERE entity = $1 AND entity_id = $2 AND target = $3 FOR UPDATE', [entity, entityId, to]))[0];
      if (existing?.status === 'pending') throw new ConflictException('Nội dung này đã được gửi và đang chờ duyệt');
      if (existing) {
        await q(
          `UPDATE hk_shares SET status = 'pending', result_id = NULL, requested_by = $2, reviewed_by = NULL, review_note = NULL, created_at = now(), reviewed_at = NULL, school_id = $3 WHERE id = $1`,
          [existing.id, user.id, user.school_id]);
        return existing.id;
      }
      return (await q<{ id: number }>('INSERT INTO hk_shares (entity, entity_id, target, school_id, requested_by) VALUES ($1, $2, $3, $4, $5) RETURNING id', [entity, entityId, to, user.school_id, user.id]))[0].id;
    });
    return this.detail(user, share);
  }

  /** Người gửi rút lại yêu cầu đang chờ */
  async withdraw(user: UserRow, id: number): Promise<void> {
    await this.db.tx(async (q) => {
      const s = (await q<ShareRow>('SELECT * FROM hk_shares WHERE id = $1 FOR UPDATE', [id]))[0];
      if (!s || s.requested_by !== user.id) throw notFound('yêu cầu chia sẻ');
      if (s.status !== 'pending') throw new ConflictException('Yêu cầu đã được xử lý nên không rút lại được');
      await q('DELETE FROM hk_shares WHERE id = $1', [id]);
    });
  }

  /** Danh sách theo vai trò: giáo viên – yêu cầu của mình; quản trị trường – cần duyệt và đề xuất của trường; quản trị tổng – đề xuất lên hệ thống */
  async list(user: UserRow, f: { status?: string; entity?: string }) {
    const params: unknown[] = [];
    const parts: string[] = [];
    if (user.role === 'teacher') { params.push(user.id); parts.push(`s.requested_by = $${params.length}`); }
    else if (user.role === 'school_admin') { params.push(user.school_id); parts.push(`s.school_id = $${params.length}`); }
    else if (user.role === 'root_admin') parts.push("s.target = 'system'");
    else throw new ForbiddenException('Không có quyền xem danh sách chia sẻ');
    if (f.status && ['pending', 'approved', 'rejected'].includes(f.status)) { params.push(f.status); parts.push(`s.status = $${params.length}`); }
    if (f.entity && ENTITIES.includes(f.entity as ShareEntity)) { params.push(f.entity); parts.push(`s.entity = $${params.length}`); }
    const rows = await this.db.query<ShareRow & { requester: string | null; school_name: string | null }>(
      `SELECT s.*, u.full_name AS requester, sc.name AS school_name FROM hk_shares s LEFT JOIN app_users u ON u.id = s.requested_by LEFT JOIN app_schools sc ON sc.id = s.school_id
       WHERE ${parts.join(' AND ')} ORDER BY (s.status = 'pending') DESC, s.created_at DESC LIMIT 300`, params);
    const out = [];
    for (const r of rows) {
      const title = (await this.db.query<{ title: string }>(`SELECT ${TITLE[r.entity]} AS title FROM ${TABLE[r.entity]} t WHERE t.id = $1`, [r.entity_id]))[0]?.title ?? '(đã xóa)';
      out.push({ ...r, title, entity_label: LABEL[r.entity], can_review: this.canReview(user, r) });
    }
    return out;
  }

  private canReview(user: UserRow, s: ShareRow): boolean {
    if (s.status !== 'pending') return false;
    if (user.role === 'school_admin') return s.target === 'school' && s.school_id === user.school_id;
    return user.role === 'root_admin' && s.target === 'system';
  }

  private async mustView(q: Q, user: UserRow, id: number): Promise<ShareRow> {
    const s = (await q<ShareRow>('SELECT * FROM hk_shares WHERE id = $1', [id]))[0];
    if (!s) throw notFound('yêu cầu chia sẻ');
    const ok = user.role === 'teacher' ? s.requested_by === user.id
      : user.role === 'school_admin' ? s.school_id === user.school_id
        : user.role === 'root_admin' && s.target === 'system';
    if (!ok) throw notFound('yêu cầu chia sẻ');
    return s;
  }

  /** Nội dung đầy đủ để người duyệt xem trước khi quyết định (kể cả nội dung còn nằm trong kho riêng của giáo viên) */
  async detail(user: UserRow, id: number) {
    return this.db.tx(async (q) => {
      const s = await this.mustView(q, user, id);
      let content: unknown = null;
      if (s.entity === 'question') {
        const row = (await q<Record<string, unknown>>('SELECT id, qtype, prompt, image_url, explanation, difficulty, data, campaign_id FROM hk_questions WHERE id = $1', [s.entity_id]))[0];
        content = row ?? null;
      } else if (s.entity === 'quiz') {
        const quiz = (await q<Record<string, unknown>>('SELECT id, title, description, seconds_per_question, pass_percent, shuffle_questions, shuffle_options FROM hk_quizzes WHERE id = $1', [s.entity_id]))[0];
        const items = await q('SELECT qq.position, qq.points, qq.seconds, t.qtype, t.prompt, t.difficulty, t.data FROM hk_quiz_questions qq JOIN hk_questions t ON t.id = qq.question_id WHERE qq.quiz_id = $1 ORDER BY qq.position', [s.entity_id]);
        content = quiz ? { ...quiz, items } : null;
      } else {
        const journey = (await q<Record<string, unknown>>('SELECT id, title, description, campaign_id FROM hk_journeys WHERE id = $1', [s.entity_id]))[0];
        const nodes = await q(
          `SELECT n.position, n.kind, n.title, n.objective, n.reward_points, n.pass_percent FROM hk_nodes n WHERE n.journey_id = $1 ORDER BY n.position`, [s.entity_id]);
        content = journey ? { ...journey, nodes } : null;
      }
      const requester = s.requested_by ? (await q<{ full_name: string }>('SELECT full_name FROM app_users WHERE id = $1', [s.requested_by]))[0]?.full_name ?? null : null;
      return { ...s, requester, entity_label: LABEL[s.entity], content, can_review: this.canReview(user, s) };
    });
  }

  /** Duyệt hoặc từ chối. Từ chối phải ghi lý do; duyệt sao nội dung vào kho đích. */
  async review(user: UserRow, id: number, approve: boolean, note?: string | null) {
    const cleaned = (note ?? '').trim();
    if (!approve && cleaned.length < 3) throw new BadRequestException('Hãy ghi lý do từ chối (ít nhất 3 ký tự)');
    if (cleaned.length > 300) throw new BadRequestException('Ghi chú tối đa 300 ký tự');
    await this.db.tx(async (q) => {
      const s = (await q<ShareRow>('SELECT * FROM hk_shares WHERE id = $1 FOR UPDATE', [id]))[0];
      if (!s || !this.canReview(user, s)) {
        if (s && s.status !== 'pending') throw new ConflictException('Yêu cầu đã được xử lý');
        throw notFound('yêu cầu chia sẻ');
      }
      let resultId: number | null = null;
      if (approve) {
        const to = s.target === 'school' ? { scope: 'school' as Scope, school_id: s.school_id, owner_id: s.requested_by } : { scope: 'system' as Scope, school_id: null, owner_id: s.requested_by };
        if (s.entity === 'question') resultId = await this.questions.cloneInto(q, s.entity_id, to, user.id);
        else if (s.entity === 'quiz') resultId = await this.quizzes.cloneInto(q, s.entity_id, to, user.id);
        else resultId = await this.journeys.cloneInto(q, s.entity_id, to, user.id);
      }
      await q("UPDATE hk_shares SET status = $2, result_id = $3, reviewed_by = $4, review_note = $5, reviewed_at = now() WHERE id = $1", [id, approve ? 'approved' : 'rejected', resultId, user.id, cleaned || null]);
    });
    return this.detail(user, id);
  }
}
