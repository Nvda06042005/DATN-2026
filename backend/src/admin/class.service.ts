/**
 * TM.SCH-CLASS (quản trị trường/tổng) và TM.T-CLASS (giáo viên): vòng đời lớp học.
 * Quản trị trường bật khối theo năm học, tạo lớp (ban đầu chưa có giáo viên, chưa có mật khẩu gia nhập), phân công/đổi/hủy giáo viên,
 * chuyển học sinh giữa các lớp cùng trường, đóng/mở lớp. Giáo viên được phân công đặt/đổi mật khẩu lớp và đóng/mở đăng ký.
 * Mọi thao tác ghi app_class_events (chỉ thêm) và gửi thông báo cho người liên quan; dữ liệu học tập không bị xóa.
 * Quản trị trường chạy dưới RLS của trường mình; quản trị tổng phải chỉ rõ trường khi tạo lớp/bật khối.
 */
import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { hashPassword } from '../auth/passwords';
import { DatabaseService, Q, UserRow } from '../database/database.service';
import { validSchoolYear } from './school.service';

const bad = (message: string) => new UnprocessableEntityException(message);
const clean = (s: string | null | undefined) => (s ?? '').split(/\s+/).filter(Boolean).join(' ');

interface ClassRow {
  id: number; school_id: number; teacher_id: number | null; class_code: string; school_year: string; name: string; grade: number | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED'; is_active: boolean; join_open: boolean; has_password: boolean; expected_size: number | null;
}
export interface NewClassInput { school_id?: number | null; class_code: string; school_year: string; grade: number; name: string; expected_size?: number | null; teacher_id?: number | null }
export interface ClassPatch { name?: string; grade?: number | null; expected_size?: number | null; is_active?: boolean }

const CLASS_SQL = `SELECT c.id, c.school_id, c.teacher_id, c.class_code, c.school_year, c.name, c.grade, c.status, c.is_active, c.join_open, c.expected_size, c.closed_at,
  (c.join_password_hash IS NOT NULL) AS has_password, t.full_name AS teacher_name,
  (SELECT count(*)::int FROM app_class_members m JOIN app_users u ON u.id = m.user_id WHERE m.class_id = c.id AND u.role = 'student' AND u.deleted_at IS NULL) AS students
  FROM app_classes c LEFT JOIN app_users t ON t.id = c.teacher_id`;

@Injectable()
export class ClassService {
  constructor(private readonly db: DatabaseService) {}

  private run<T>(user: UserRow, fn: (q: Q, scope: number | null) => Promise<T>): Promise<T> {
    if (user.role === 'root_admin') return this.db.tx((q) => fn(q, null));
    if (!user.school_id) throw new ForbiddenException('Tài khoản chưa được gán trường – liên hệ quản trị tổng');
    return this.db.scoped(user.school_id, (q) => fn(q, user.school_id));
  }

  /** Trường được thao tác: quản trị trường luôn là trường trong phiên (bỏ qua school_id client gửi); quản trị tổng phải chọn trường */
  private target(actor: UserRow, schoolId?: number | null): number {
    if (actor.role === 'root_admin') {
      if (!schoolId) throw bad('Hãy chọn trường');
      return schoolId;
    }
    if (!actor.school_id) throw new ForbiddenException('Tài khoản chưa được gán trường – liên hệ quản trị tổng');
    return actor.school_id;
  }

  private async log(q: Q, school: number, classId: number, kind: string, actor: UserRow, extra: { teacher_id?: number | null; previous_teacher_id?: number | null; user_id?: number | null; related_class_id?: number | null; note?: string | null } = {}) {
    await q('INSERT INTO app_class_events (school_id, class_id, kind, actor_id, teacher_id, previous_teacher_id, user_id, related_class_id, note) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [school, classId, kind, actor.id, extra.teacher_id ?? null, extra.previous_teacher_id ?? null, extra.user_id ?? null, extra.related_class_id ?? null, extra.note ?? null]);
  }

  private async notify(q: Q, userId: number | null, school: number, kind: string, title: string, body: string) {
    if (userId) await q('INSERT INTO app_notifications (user_id, school_id, kind, title, body) VALUES ($1, $2, $3, $4, $5)', [userId, school, kind, title, body]);
  }

  private async view(q: Q, id: number) {
    return (await q(`${CLASS_SQL} WHERE c.id = $1`, [id]))[0];
  }

  private async load(q: Q, scope: number | null, id: number): Promise<ClassRow> {
    const row = (await q<ClassRow>('SELECT id, school_id, teacher_id, class_code, school_year, name, grade, status, is_active, join_open, expected_size, (join_password_hash IS NOT NULL) AS has_password FROM app_classes WHERE id = $1 AND ($2::integer IS NULL OR school_id = $2) FOR UPDATE', [id, scope]))[0];
    if (!row) throw new NotFoundException('Không tìm thấy lớp');
    return row;
  }

  private async teacherOf(q: Q, school: number, teacherId: number) {
    const t = (await q<{ id: number; full_name: string; class_name: string | null }>("SELECT id, full_name, class_name FROM app_users WHERE id = $1 AND school_id = $2 AND role = 'teacher' AND is_active = 1 AND deleted_at IS NULL", [teacherId, school]))[0];
    if (!t) throw bad('Giáo viên không thuộc trường này hoặc tài khoản đang bị khóa');
    return t;
  }

  // ------------------------------------------------------------------ SCH-CLASS.001/002 khối theo năm học
  async grades(actor: UserRow, schoolId?: number | null, schoolYear?: string) {
    const school = this.target(actor, schoolId);
    return this.run(actor, (q) => q(
      `SELECT g.school_year, g.grade, g.is_active,
         (SELECT count(*)::int FROM app_classes c WHERE c.school_id = g.school_id AND c.school_year = g.school_year AND c.grade = g.grade) AS classes,
         (SELECT count(*)::int FROM app_classes c WHERE c.school_id = g.school_id AND c.school_year = g.school_year AND c.grade = g.grade AND c.is_active) AS active_classes
       FROM app_school_grades g WHERE g.school_id = $1 AND ($2::text IS NULL OR g.school_year = $2) ORDER BY g.school_year DESC, g.grade`, [school, schoolYear ?? null]));
  }

  /** Bật hoặc ngưng một khối trong năm học. Không xóa; không ngưng được khi còn lớp đang hoạt động thuộc khối đó. */
  async setGrade(actor: UserRow, body: { school_id?: number | null; school_year: string; grade: number; is_active: boolean }) {
    if (!validSchoolYear(body.school_year)) throw bad('Năm học có dạng 2026-2027 và hai năm liên tiếp');
    const school = this.target(actor, body.school_id);
    await this.run(actor, async (q) => {
      if (!(await q('SELECT 1 FROM app_schools WHERE id = $1', [school])).length) throw new NotFoundException('Không tìm thấy trường');
      if (!body.is_active) {
        const n = Number((await q<{ n: number }>('SELECT count(*)::int AS n FROM app_classes WHERE school_id = $1 AND school_year = $2 AND grade = $3 AND is_active', [school, body.school_year, body.grade]))[0].n);
        if (n) throw new ConflictException(`Khối ${body.grade} còn ${n} lớp đang hoạt động trong năm học ${body.school_year}; hãy đóng hoặc chuyển các lớp trước`);
      }
      await q('INSERT INTO app_school_grades (school_id, school_year, grade, is_active, created_by) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (school_id, school_year, grade) DO UPDATE SET is_active = EXCLUDED.is_active, updated_at = now()',
        [school, body.school_year, body.grade, body.is_active, actor.id]);
    });
    return this.grades(actor, school, body.school_year);
  }

  // ------------------------------------------------------------------ SCH-CLASS.003 tạo lớp, .005 phân công
  async createClass(actor: UserRow, body: NewClassInput) {
    const code = body.class_code.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9._-]{1,19}$/.test(code)) throw bad('Mã lớp gồm 2–20 chữ in hoa, số, dấu chấm, gạch');
    if (!validSchoolYear(body.school_year)) throw bad('Năm học có dạng 2026-2027 và hai năm liên tiếp');
    const school = this.target(actor, body.school_id);
    return this.run(actor, async (q) => {
      if (!(await q('SELECT 1 FROM app_schools WHERE id = $1', [school])).length) throw new NotFoundException('Không tìm thấy trường');
      const grade = (await q<{ is_active: boolean }>('SELECT is_active FROM app_school_grades WHERE school_id = $1 AND school_year = $2 AND grade = $3', [school, body.school_year, body.grade]))[0];
      if (!grade?.is_active) throw bad(`Khối ${body.grade} chưa được bật cho năm học ${body.school_year}; hãy bật khối trước khi tạo lớp`);
      if ((await q('SELECT 1 FROM app_classes WHERE school_id = $1 AND school_year = $2 AND class_code = $3', [school, body.school_year, code])).length) throw new ConflictException(`Lớp ${code} năm học ${body.school_year} đã có`);
      const teacher = body.teacher_id ? await this.teacherOf(q, school, body.teacher_id) : null;
      const id = Number((await q<{ id: number }>(
        `INSERT INTO app_classes (school_id, teacher_id, class_code, school_year, name, grade, status, expected_size, created_by, reviewed_by, reviewed_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'APPROVED', $7, $8, $8, now()) RETURNING id`,
        [school, teacher?.id ?? null, code, body.school_year, clean(body.name), body.grade, body.expected_size ?? null, actor.id]))[0].id);
      await this.log(q, school, id, 'create', actor);
      if (teacher) await this.afterAssign(q, school, id, code, clean(body.name), teacher, null, actor);
      return this.view(q, id);
    });
  }

  private async afterAssign(q: Q, school: number, classId: number, code: string, name: string, teacher: { id: number; full_name: string; class_name: string | null }, previous: number | null, actor: UserRow) {
    await this.log(q, school, classId, previous ? 'change_teacher' : 'assign', actor, { teacher_id: teacher.id, previous_teacher_id: previous });
    if (!teacher.class_name) await q('UPDATE app_users SET class_name = $2 WHERE id = $1', [teacher.id, code]);
    await this.notify(q, teacher.id, school, 'class_assigned', `Bạn được phân công lớp ${code}`, `"${name}". Hãy đặt mật khẩu gia nhập lớp để học sinh vào lớp.`);
  }

  /** Sửa thông tin lớp thuộc trường mình; đóng/mở lớp dùng chung đường với close/reopen để có lịch sử */
  async updateClass(actor: UserRow, id: number, body: ClassPatch) {
    return this.run(actor, async (q, scope) => {
      const cur = await this.load(q, scope, id);
      const next: ClassPatch = {};
      if (body.name !== undefined && clean(body.name) !== cur.name) next.name = clean(body.name);
      if (body.expected_size !== undefined && body.expected_size !== cur.expected_size) next.expected_size = body.expected_size;
      if (body.grade !== undefined && body.grade !== cur.grade) {
        if (body.grade !== null) {
          const g = (await q<{ is_active: boolean }>('SELECT is_active FROM app_school_grades WHERE school_id = $1 AND school_year = $2 AND grade = $3', [cur.school_id, cur.school_year, body.grade]))[0];
          if (g && !g.is_active) throw bad(`Khối ${body.grade} đã ngưng sử dụng trong năm học ${cur.school_year}`);
        }
        next.grade = body.grade;
      }
      const sets = Object.keys(next);
      if (sets.length) {
        const cols = { name: 'name', grade: 'grade', expected_size: 'expected_size' } as const;
        await q(`UPDATE app_classes SET ${sets.map((k, i) => `${cols[k as keyof typeof cols]} = $${i + 2}`).join(', ')} WHERE id = $1`, [id, ...sets.map((k) => next[k as keyof ClassPatch])]);
        await this.log(q, cur.school_id, id, 'update', actor, { note: `Đã sửa: ${sets.join(', ')}` });
      }
      if (body.is_active !== undefined && body.is_active !== cur.is_active) await this.setActive(q, cur, body.is_active, actor);
      return this.view(q, id);
    });
  }

  /** SCH-CLASS.009: đóng lớp = ngưng hoạt động và nhận học sinh; giữ nguyên thành viên, điểm và lịch sử thi đấu */
  private async setActive(q: Q, cur: ClassRow, active: boolean, actor: UserRow) {
    if (active) {
      const g = (await q<{ is_active: boolean }>('SELECT is_active FROM app_school_grades WHERE school_id = $1 AND school_year = $2 AND grade = $3', [cur.school_id, cur.school_year, cur.grade]))[0];
      if (g && !g.is_active) throw new ConflictException(`Khối ${cur.grade} đã ngưng sử dụng trong năm học ${cur.school_year}; hãy bật lại khối trước`);
    }
    await q('UPDATE app_classes SET is_active = $2, closed_at = CASE WHEN $2 THEN NULL ELSE now() END, join_open = CASE WHEN $2 THEN join_open ELSE false END WHERE id = $1', [cur.id, active]);
    await this.log(q, cur.school_id, cur.id, active ? 'reopen' : 'close', actor);
    await this.notify(q, cur.teacher_id, cur.school_id, active ? 'class_reopened' : 'class_closed', active ? `Lớp ${cur.class_code} đã mở lại` : `Lớp ${cur.class_code} đã đóng`,
      active ? 'Lớp hoạt động trở lại. Đăng ký vào lớp vẫn đóng cho tới khi bạn mở.' : 'Lớp ngưng hoạt động và ngưng nhận học sinh. Điểm và lịch sử thi đấu được giữ nguyên.');
  }

  // ------------------------------------------------------------------ SCH-CLASS.005/006 phân công, đổi, hủy giáo viên
  async assignTeacher(actor: UserRow, id: number, teacherId: number | null) {
    return this.run(actor, async (q, scope) => {
      const cur = await this.load(q, scope, id);
      if (cur.status !== 'APPROVED') throw new ConflictException('Lớp chưa được duyệt; hãy xử lý yêu cầu mở lớp trước');
      if (teacherId === cur.teacher_id) return this.view(q, id);
      const teacher = teacherId ? await this.teacherOf(q, cur.school_id, teacherId) : null;
      // Giáo viên cũ không còn quyền với lớp nên mật khẩu họ biết bị thu hồi; học sinh đã vào lớp không bị ảnh hưởng
      await q('UPDATE app_classes SET teacher_id = $2, join_password_hash = NULL, join_open = false WHERE id = $1', [id, teacher?.id ?? null]);
      if (cur.teacher_id) {
        await q('UPDATE app_users SET class_name = NULL WHERE id = $1 AND class_name = $2', [cur.teacher_id, cur.class_code]);
        await this.notify(q, cur.teacher_id, cur.school_id, 'class_unassigned', `Bạn không còn phụ trách lớp ${cur.class_code}`, 'Quyền xem điểm và học sinh của lớp này đã chuyển theo phân công mới.');
      }
      if (teacher) await this.afterAssign(q, cur.school_id, id, cur.class_code, cur.name, teacher, cur.teacher_id, actor);
      else await this.log(q, cur.school_id, id, 'unassign', actor, { previous_teacher_id: cur.teacher_id });
      return this.view(q, id);
    });
  }

  // ------------------------------------------------------------------ SCH-CLASS.008 chuyển học sinh
  async transferStudent(actor: UserRow, fromId: number, userId: number, toId: number) {
    if (fromId === toId) throw bad('Lớp đích phải khác lớp hiện tại');
    return this.run(actor, async (q, scope) => {
      const from = await this.load(q, scope, fromId);
      const to = await this.load(q, from.school_id, toId);
      for (const c of [from, to]) if (c.status !== 'APPROVED') throw new ConflictException(`Lớp ${c.class_code} chưa được duyệt`);
      if (!to.is_active) throw new ConflictException(`Lớp ${to.class_code} đã đóng`);
      const student = (await q<{ id: number; full_name: string; class_name: string | null }>("SELECT id, full_name, class_name FROM app_users WHERE id = $1 AND school_id = $2 AND role = 'student' AND deleted_at IS NULL", [userId, from.school_id]))[0];
      if (!student) throw new NotFoundException('Không tìm thấy học sinh trong trường này');
      if (!(await q('SELECT 1 FROM app_class_members WHERE class_id = $1 AND user_id = $2', [fromId, userId])).length) throw bad(`Học sinh không thuộc lớp ${from.class_code}`);
      await q('DELETE FROM app_class_members WHERE class_id = $1 AND user_id = $2', [fromId, userId]);
      await q('INSERT INTO app_class_members (class_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [toId, userId]);
      if (!student.class_name || student.class_name === from.class_code) await q('UPDATE app_users SET class_name = $2 WHERE id = $1', [userId, to.class_code]);
      await this.log(q, from.school_id, toId, 'transfer', actor, { user_id: userId, related_class_id: fromId });
      await this.notify(q, userId, from.school_id, 'class_transfer', `Bạn đã chuyển sang lớp ${to.class_code}`, `Từ lớp ${from.class_code} sang "${to.name}". Điểm và tiến độ học của bạn được giữ nguyên.`);
      await this.notify(q, to.teacher_id, from.school_id, 'class_join', `Học sinh mới vào lớp ${to.class_code}`, `${student.full_name} được chuyển từ lớp ${from.class_code}.`);
      return { from: await this.view(q, fromId), to: await this.view(q, toId) };
    });
  }

  async events(actor: UserRow, id: number) {
    return this.run(actor, async (q, scope) => {
      const cur = await this.load(q, scope, id);
      return q(`SELECT e.id, e.kind, e.note, e.created_at, a.full_name AS actor_name, t.full_name AS teacher_name, p.full_name AS previous_teacher_name, u.full_name AS student_name, r.class_code AS related_class_code
        FROM app_class_events e LEFT JOIN app_users a ON a.id = e.actor_id LEFT JOIN app_users t ON t.id = e.teacher_id LEFT JOIN app_users p ON p.id = e.previous_teacher_id
        LEFT JOIN app_users u ON u.id = e.user_id LEFT JOIN app_classes r ON r.id = e.related_class_id WHERE e.class_id = $1 AND e.school_id = $2 ORDER BY e.id DESC LIMIT 100`, [id, cur.school_id]);
    });
  }

  // ------------------------------------------------------------------ T-CLASS.003/004/005 giáo viên đặt mật khẩu, đóng/mở đăng ký
  private async ownClass(q: Q, teacher: UserRow, id: number): Promise<ClassRow> {
    const row = (await q<ClassRow>('SELECT id, school_id, teacher_id, class_code, school_year, name, grade, status, is_active, join_open, expected_size, (join_password_hash IS NOT NULL) AS has_password FROM app_classes WHERE id = $1 AND teacher_id = $2 AND school_id = $3 FOR UPDATE', [id, teacher.id, teacher.school_id]))[0];
    if (!row) throw new NotFoundException('Không tìm thấy lớp bạn phụ trách');
    if (row.status !== 'APPROVED' || !row.is_active) throw new ConflictException('Lớp chưa được duyệt hoặc đã đóng');
    return row;
  }

  /** Mật khẩu cũ ngừng có hiệu lực ngay (chỉ lưu băm mới); đặt mật khẩu cũng mở đăng ký nếu lớp chưa từng có mật khẩu */
  async setJoinPassword(teacher: UserRow, id: number, password: string) {
    const hash = await hashPassword(password);
    return this.run(teacher, async (q) => {
      const cur = await this.ownClass(q, teacher, id);
      await q('UPDATE app_classes SET join_password_hash = $2, join_open = CASE WHEN join_password_hash IS NULL THEN true ELSE join_open END WHERE id = $1', [id, hash]);
      await this.log(q, cur.school_id, id, 'join_password', teacher);
      return this.view(q, id);
    });
  }

  async setJoinOpen(teacher: UserRow, id: number, open: boolean) {
    return this.run(teacher, async (q) => {
      const cur = await this.ownClass(q, teacher, id);
      if (open && !cur.has_password) throw bad('Hãy đặt mật khẩu lớp trước khi mở đăng ký');
      if (cur.join_open !== open) {
        await q('UPDATE app_classes SET join_open = $2 WHERE id = $1', [id, open]);
        await this.log(q, cur.school_id, id, open ? 'join_open' : 'join_closed', teacher);
      }
      return this.view(q, id);
    });
  }

  // ------------------------------------------------------------------ S-CLASS.001 lớp có thể gia nhập (không lộ mật khẩu)
  async availableClasses(student: UserRow) {
    return this.run(student, (q) => q(
      `SELECT c.id, c.class_code, c.name, c.school_year, c.grade, t.full_name AS teacher_name,
         EXISTS (SELECT 1 FROM app_class_members m WHERE m.class_id = c.id AND m.user_id = $1) AS joined
       FROM app_classes c JOIN app_users t ON t.id = c.teacher_id
       WHERE c.school_id = $2 AND c.status = 'APPROVED' AND c.is_active AND c.join_open AND c.join_password_hash IS NOT NULL
       ORDER BY c.school_year DESC, c.grade NULLS LAST, c.class_code`, [student.id, student.school_id]));
  }
}
