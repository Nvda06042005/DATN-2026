/**
 * Đề kiểm tra giữa kỳ / cuối kỳ (16/11/2026, migration 068): giáo viên chọn một bộ đề trong Thư viện học liệu và lớp mình phụ trách, gửi quản trị trường duyệt;
 * quản trị trường duyệt hoặc từ chối (ghi lý do). Đề đã duyệt thì giáo viên "Tổ chức thi": đặt mật khẩu, giờ mở và giờ đóng; hệ thống tạo bài thi
 * (bài tập loại bộ đề, một lượt làm, hạn là giờ đóng) cho cả lớp và báo học sinh. Học sinh chỉ vào làm được trong khung giờ và khi nhập đúng mật khẩu
 * giáo viên cung cấp. Mật khẩu chỉ lưu dạng băm.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { hashPassword } from '../auth/passwords';
import { DatabaseService, Q, UserRow } from '../database/database.service';
import { GameClock } from '../game/clock';
import { notFound } from '../content/access';
import { AssignmentService } from './assignment.service';
import { ClassroomService } from './classroom.service';
import { notify } from './notify';

export const EXAM_KIND = { midterm: 'Kiểm tra giữa kỳ', final: 'Kiểm tra cuối kỳ' } as const;
type ExamKind = keyof typeof EXAM_KIND;
export interface ExamRow {
  id: number; school_id: number; class_id: number; teacher_id: number | null; quiz_id: number; kind: ExamKind; semester: number; title: string; note: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'scheduled'; reviewed_by: number | null; review_note: string | null; reviewed_at: string | null; password_hash: string | null;
  starts_at: string | null; ends_at: string | null; assignment_id: number | null; created_at: string; updated_at: string;
}
const when = (d: Date | string) => new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });

@Injectable()
export class ExamService {
  constructor(private readonly db: DatabaseService, private readonly rooms: ClassroomService, private readonly assignments: AssignmentService, private readonly clock: GameClock) {}

  private readonly read: Q = (sql, params) => this.db.query(sql, params);

  /** Danh sách kèm tên lớp, bộ đề, giáo viên, người duyệt (không bao giờ trả mật khẩu) */
  private async rows(where: string, params: unknown[]) {
    const rows = await this.db.query<ExamRow & { class_name: string; quiz_title: string | null; question_count: number; teacher_name: string | null; reviewer_name: string | null }>(
      `SELECT e.*, c.name AS class_name, z.title AS quiz_title, (SELECT count(*)::int FROM hk_quiz_questions k WHERE k.quiz_id = e.quiz_id) AS question_count,
              t.full_name AS teacher_name, r.full_name AS reviewer_name
       FROM hk_exams e JOIN app_classes c ON c.id = e.class_id LEFT JOIN hk_quizzes z ON z.id = e.quiz_id LEFT JOIN app_users t ON t.id = e.teacher_id LEFT JOIN app_users r ON r.id = e.reviewed_by
       WHERE ${where} ORDER BY (e.status = 'pending') DESC, e.created_at DESC LIMIT 300`, params);
    return rows.map(({ password_hash, ...r }) => ({ ...r, has_password: Boolean(password_hash), kind_label: EXAM_KIND[r.kind] }));
  }

  /** Giáo viên: đề mình gửi; quản trị trường: đề của trường */
  async list(user: UserRow) {
    if (user.role === 'teacher') return this.rows('e.teacher_id = $1', [user.id]);
    if (user.role === 'school_admin' && user.school_id) return this.rows('e.school_id = $1', [user.school_id]);
    throw new ForbiddenException('Chức năng dành cho giáo viên và quản trị viên trường');
  }

  private async load(q: Q, id: number, lock = false): Promise<ExamRow> {
    const row = (await q<ExamRow>(`SELECT * FROM hk_exams WHERE id = $1${lock ? ' FOR UPDATE' : ''}`, [id]))[0];
    if (!row) throw notFound('đề kiểm tra');
    return row;
  }

  /** Giáo viên gửi đề giữa kỳ / cuối kỳ của lớp mình phụ trách, bộ đề trong thư viện của mình (hoặc kho trường / hệ thống) */
  async request(user: UserRow, body: { class_id?: unknown; quiz_id?: unknown; kind?: unknown; title?: unknown; note?: unknown }) {
    if (user.role !== 'teacher') throw new ForbiddenException('Giáo viên gửi đề kiểm tra để quản trị trường duyệt');
    const kind = String(body.kind ?? '') as ExamKind;
    if (!(kind in EXAM_KIND)) throw new BadRequestException('Loại đề là kiểm tra giữa kỳ hoặc cuối kỳ');
    const title = String(body.title ?? '').replace(/\s+/g, ' ').trim();
    if (title.length < 3 || title.length > 150) throw new BadRequestException('Tên đề kiểm tra từ 3 đến 150 ký tự');
    const note = String(body.note ?? '').trim() || null;
    if (note && note.length > 1000) throw new BadRequestException('Ghi chú tối đa 1000 ký tự');
    const cls = await this.rooms.mine(this.read, user, Number(body.class_id), true);
    const quizId = Number(body.quiz_id);
    return this.db.tx(async (q) => {
      const quiz = (await q<{ id: number; scope: string; school_id: number | null; owner_id: number | null }>('SELECT id, scope, school_id, owner_id FROM hk_quizzes WHERE id = $1', [quizId]))[0];
      const visible = quiz && (quiz.scope === 'system' || (quiz.scope === 'school' && quiz.school_id === cls.school_id) || (quiz.scope === 'teacher' && quiz.owner_id === user.id));
      if (!visible) throw notFound('bộ đề');
      const usable = Number((await q<{ n: string }>("SELECT count(*) AS n FROM hk_quiz_questions k JOIN hk_questions t ON t.id = k.question_id WHERE k.quiz_id = $1 AND t.qtype <> 'poll'", [quizId]))[0].n);
      if (!usable) throw new BadRequestException('Bộ đề chưa có câu hỏi chấm điểm được');
      const semester = Number((await q<{ n: number }>('SELECT COALESCE(public.app_class_semester($1), 1) AS n', [cls.year_id]))[0]?.n ?? 1);
      const dup = (await q<{ id: number; status: string }>("SELECT id, status FROM hk_exams WHERE class_id = $1 AND kind = $2 AND semester = $3 AND status <> 'rejected'", [cls.id, kind, semester]))[0];
      if (dup) throw new ConflictException(`Lớp ${cls.name} đã có ${EXAM_KIND[kind].toLowerCase()} học kỳ ${semester} (${dup.status === 'pending' ? 'đang chờ duyệt' : 'đã duyệt'})`);
      const id = (await q<{ id: number }>('INSERT INTO hk_exams (school_id, class_id, teacher_id, quiz_id, kind, semester, title, note) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
        [cls.school_id, cls.id, user.id, quizId, kind, semester, title, note]))[0].id;
      const admins = (await q<{ id: number }>("SELECT id FROM app_users WHERE school_id = $1 AND role = 'school_admin' AND is_active = 1 AND deleted_at IS NULL", [cls.school_id])).map((r) => r.id);
      await notify(q, admins, { kind: 'exam', title: `Đề kiểm tra chờ duyệt: ${title}`, body: `${user.full_name} gửi ${EXAM_KIND[kind].toLowerCase()} học kỳ ${semester} cho lớp ${cls.name}.`, class_id: cls.id, by: user.id, ref: { exam_id: id } });
      return id;
    }).then(async (id) => (await this.rows('e.id = $1', [id]))[0]);
  }

  /** Giáo viên rút lại đề còn chờ duyệt */
  async cancel(user: UserRow, id: number): Promise<void> {
    await this.db.tx(async (q) => {
      const e = await this.load(q, id, true);
      if (e.teacher_id !== user.id) throw notFound('đề kiểm tra');
      if (e.status !== 'pending') throw new ConflictException('Đề đã được xử lý nên không rút lại được');
      await q('DELETE FROM hk_exams WHERE id = $1', [id]);
    });
  }

  /** Quản trị trường duyệt hoặc từ chối (từ chối phải có lý do); báo giáo viên */
  async review(user: UserRow, id: number, approve: boolean, note?: unknown) {
    if (user.role !== 'school_admin') throw new ForbiddenException('Quản trị viên trường duyệt đề kiểm tra');
    const text = String(note ?? '').trim();
    if (!approve && text.length < 3) throw new BadRequestException('Hãy ghi lý do từ chối (ít nhất 3 ký tự)');
    if (text.length > 300) throw new BadRequestException('Ghi chú tối đa 300 ký tự');
    await this.db.tx(async (q) => {
      const e = await this.load(q, id, true);
      if (e.school_id !== user.school_id) throw notFound('đề kiểm tra');
      if (e.status !== 'pending') throw new ConflictException('Đề này đã được xử lý');
      await q('UPDATE hk_exams SET status = $2, reviewed_by = $3, review_note = $4, reviewed_at = now(), updated_at = now() WHERE id = $1', [id, approve ? 'approved' : 'rejected', user.id, text || null]);
      if (e.teacher_id) await notify(q, [e.teacher_id], { kind: 'exam', title: approve ? `Đề kiểm tra đã được duyệt: ${e.title}` : `Đề kiểm tra bị từ chối: ${e.title}`,
        body: approve ? 'Vào Thư viện học liệu → Đề kiểm tra, bấm "Tổ chức thi" để đặt mật khẩu và giờ thi.' : `Lý do: ${text}`, class_id: e.class_id, by: user.id, ref: { exam_id: id } });
    });
    return (await this.rows('e.id = $1', [id]))[0];
  }

  /**
   * Giáo viên tổ chức thi đề đã duyệt: mật khẩu 4–32 ký tự, giờ mở trước giờ đóng, thi tối đa 8 giờ. Tạo bài thi (một lượt) cho cả lớp, báo học sinh
   * (thông báo không chứa mật khẩu: giáo viên tự đọc cho học sinh khi vào giờ thi).
   */
  async organize(user: UserRow, id: number, body: { password?: unknown; starts_at?: unknown; ends_at?: unknown }) {
    const password = String(body.password ?? '');
    if (password.length < 4 || password.length > 32 || /\s/.test(password)) throw new BadRequestException('Mật khẩu bài thi 4–32 ký tự, không có khoảng trắng');
    const starts = new Date(String(body.starts_at ?? '')), ends = new Date(String(body.ends_at ?? ''));
    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) throw new BadRequestException('Giờ mở và giờ đóng bài thi không hợp lệ');
    if (ends.getTime() <= starts.getTime()) throw new BadRequestException('Giờ đóng phải sau giờ mở');
    if (ends.getTime() - starts.getTime() > 8 * 3_600_000) throw new BadRequestException('Bài thi mở tối đa 8 giờ');
    if (ends.getTime() <= this.clock.now().getTime()) throw new BadRequestException('Giờ đóng phải ở sau thời điểm hiện tại');
    const e = await this.db.tx((q) => this.load(q, id));
    if (e.teacher_id !== user.id) throw notFound('đề kiểm tra');
    if (e.status !== 'approved') throw new ConflictException(e.status === 'scheduled' ? 'Đề này đã được tổ chức thi' : 'Đề cần được quản trị trường duyệt trước khi tổ chức thi');
    const hash = await hashPassword(password, 10);
    // tên đề đã ghi loại ("Kiểm tra giữa kỳ …") thì không lặp lại loại ở đầu
    const label = e.title.toLowerCase().includes(EXAM_KIND[e.kind].toLowerCase()) ? `${e.title} (HK${e.semester})` : `${EXAM_KIND[e.kind]} HK${e.semester}: ${e.title}`;
    const created = await this.assignments.create(user, e.class_id, {
      title: label.slice(0, 160), description: `Mở lúc ${when(starts)}, đóng lúc ${when(ends)}. Nhập mật khẩu giáo viên cung cấp để vào làm; chỉ được làm một lần.`,
      kind: 'quiz', quiz_id: e.quiz_id, audience: 'class', due_at: ends.toISOString(), max_attempts: 1, bonus_points: 0,
    }, { title: `Kỳ thi: ${label}`.slice(0, 160), body: `Mở lúc ${when(starts)}, đóng lúc ${when(ends)}. Vào mục Kỳ thi, nhập mật khẩu thầy cô cung cấp để làm bài (một lần).` });
    await this.db.tx(async (q) => {
      const cur = await this.load(q, id, true);
      if (cur.status !== 'approved') throw new ConflictException('Đề này đã được tổ chức thi');
      await q("UPDATE hk_exams SET status = 'scheduled', password_hash = $2, starts_at = $3, ends_at = $4, assignment_id = $5, updated_at = now() WHERE id = $1", [id, hash, starts, ends, created.id]);
    });
    return (await this.rows('e.id = $1', [id]))[0];
  }
}
