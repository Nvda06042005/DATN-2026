/**
 * Lớp học (HK.QT.022, HK.QT.035–040, HK.HS.008): quản trị trường tạo lớp theo năm học và khối, phân công một hoặc nhiều giáo viên,
 * xếp học sinh hàng loạt, chuyển lớp cùng khối, nhân bản sang năm học mới (lên lớp); học sinh tham gia lớp bằng mã 6 ký tự, không mật khẩu.
 * Lớp đã có học sinh chỉ được lưu trữ, không xóa; năm học đã kết thúc không cho sửa dữ liệu.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { DatabaseService, Q, UserRow } from '../database/database.service';
import { buildWorkbook, checkUpload, readSheet, UploadedXlsx } from './excel';
import { likeEscape, SchoolService } from './school.service';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Mã tham gia lớp: 6 ký tự, bỏ I, O, 0, 1 dễ nhầm */
export const newJoinCode = (): string => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
export const normJoinCode = (code: string): string => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

interface ClassRow {
  id: number; school_id: number; year_id: number | null; school_year: string; class_code: string; name: string; grade: number | null; is_active: boolean;
  join_code: string | null; join_open: boolean; expected_size: number | null; description: string | null; status: string; closed_at: string | null;
}

export interface ClassFilter { school_id?: number; year_id?: number; grade?: number; q?: string; active?: 'true' | 'false'; teacher_id?: number; page?: number; limit?: number }

@Injectable()
export class ClassService {
  constructor(
    private readonly db: DatabaseService,
    private readonly schools: SchoolService,
  ) {}

  private async log(q: Q, cls: { id: number; school_id: number }, kind: string, actor: UserRow | null, extra: { user_id?: number | null; teacher_id?: number | null; related_class_id?: number | null; note?: string | null } = {}) {
    await q(
      'INSERT INTO app_class_events (school_id, class_id, kind, actor_id, teacher_id, user_id, related_class_id, note) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [cls.school_id, cls.id, kind, actor?.id ?? null, extra.teacher_id ?? null, extra.user_id ?? null, extra.related_class_id ?? null, extra.note ?? null],
    );
  }

  private async load(q: Q, actor: UserRow, id: number, lock = false): Promise<ClassRow> {
    const scope = actor.role === 'school_admin' ? actor.school_id : null;
    const cls = (await q<ClassRow>(`SELECT * FROM app_classes WHERE id = $1 AND ($2::integer IS NULL OR school_id = $2)${lock ? ' FOR UPDATE' : ''}`, [id, scope]))[0];
    if (!cls) throw new NotFoundException('Không tìm thấy lớp');
    return cls;
  }

  private async openClass(q: Q, actor: UserRow, id: number): Promise<ClassRow> {
    const cls = await this.load(q, actor, id, true);
    await this.schools.assertYearOpen(q, cls.year_id);
    return cls;
  }

  private async view(q: Q, id: number) {
    const cls = (await q<Record<string, unknown>>(
      `SELECT c.id, c.school_id, c.year_id, c.school_year, c.class_code, c.name, c.grade, c.is_active, c.join_code, c.join_open, c.expected_size, c.description, c.status, c.closed_at, c.created_at,
              y.status AS year_status,
              COALESCE((SELECT json_agg(json_build_object('id', u.id, 'full_name', u.full_name, 'email', u.email, 'is_active', u.is_active) ORDER BY u.full_name)
                        FROM app_class_teachers t JOIN app_users u ON u.id = t.teacher_id WHERE t.class_id = c.id), '[]'::json) AS teachers,
              (SELECT count(*)::int FROM app_class_members m JOIN app_users u ON u.id = m.user_id WHERE m.class_id = c.id AND u.role = 'student' AND u.deleted_at IS NULL) AS students
       FROM app_classes c LEFT JOIN app_school_years y ON y.id = c.year_id WHERE c.id = $1`, [id]))[0];
    return cls;
  }

  /** Giáo viên hợp lệ của trường để phân công: đang hoạt động, đúng trường */
  private async validTeachers(q: Q, schoolId: number, ids: number[]): Promise<number[]> {
    const unique = [...new Set(ids)];
    if (!unique.length) return [];
    const rows = await q<{ id: number }>("SELECT id FROM app_users WHERE id = ANY($1) AND school_id = $2 AND role = 'teacher' AND is_active = 1 AND deleted_at IS NULL", [unique, schoolId]);
    if (rows.length !== unique.length) throw new UnprocessableEntityException('Có giáo viên không thuộc trường hoặc đang bị khóa');
    return unique;
  }

  async list(actor: UserRow, f: ClassFilter) {
    return this.schools.run(actor, async (q, scope) => {
      const where: string[] = [], params: unknown[] = [];
      const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
      if (scope !== null) add('c.school_id = ?', scope); else if (f.school_id) add('c.school_id = ?', f.school_id);
      if (f.year_id) add('c.year_id = ?', f.year_id);
      if (f.grade) add('c.grade = ?', f.grade);
      if (f.active) add('c.is_active = ?', f.active === 'true');
      if (f.teacher_id) add('EXISTS (SELECT 1 FROM app_class_teachers t WHERE t.class_id = c.id AND t.teacher_id = ?)', f.teacher_id);
      if (f.q?.trim()) add("(c.name || ' ' || c.class_code) ILIKE ? ESCAPE '\\'", `%${likeEscape(f.q.trim())}%`);
      const condition = where.length ? where.join(' AND ') : 'TRUE';
      const page = f.page ?? 1, limit = f.limit ?? 50;
      const total = Number((await q<{ n: string }>(`SELECT count(*) AS n FROM app_classes c WHERE ${condition}`, params))[0].n);
      const items = await q(
        `SELECT c.id, c.school_id, c.year_id, c.school_year, c.class_code, c.name, c.grade, c.is_active, c.join_code, c.join_open, c.expected_size, c.status, y.status AS year_status,
                COALESCE((SELECT json_agg(json_build_object('id', u.id, 'full_name', u.full_name) ORDER BY u.full_name) FROM app_class_teachers t JOIN app_users u ON u.id = t.teacher_id WHERE t.class_id = c.id), '[]'::json) AS teachers,
                (SELECT count(*)::int FROM app_class_members m JOIN app_users u ON u.id = m.user_id WHERE m.class_id = c.id AND u.role = 'student' AND u.deleted_at IS NULL) AS students
         FROM app_classes c LEFT JOIN app_school_years y ON y.id = c.year_id WHERE ${condition}
         ORDER BY c.school_year DESC, c.grade NULLS LAST, c.name, c.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, (page - 1) * limit]);
      return { items, total, page, limit };
    });
  }

  async detail(actor: UserRow, id: number) {
    return this.schools.run(actor, async (q) => {
      const cls = await this.load(q, actor, id);
      const students = await q(
        `SELECT u.id, u.full_name, u.user_code, u.username, u.birth_date, u.gender, u.is_active, u.nickname, m.joined_at FROM app_class_members m JOIN app_users u ON u.id = m.user_id
         WHERE m.class_id = $1 AND u.role = 'student' AND u.deleted_at IS NULL ORDER BY u.full_name, u.id`, [id]);
      return { ...(await this.view(q, cls.id)), members: students };
    });
  }

  async events(actor: UserRow, id: number) {
    return this.schools.run(actor, async (q) => {
      await this.load(q, actor, id);
      return q(
        `SELECT e.id, e.kind, e.note, e.created_at, a.full_name AS actor_name, u.full_name AS user_name, t.full_name AS teacher_name
         FROM app_class_events e LEFT JOIN app_users a ON a.id = e.actor_id LEFT JOIN app_users u ON u.id = e.user_id LEFT JOIN app_users t ON t.id = e.teacher_id
         WHERE e.class_id = $1 ORDER BY e.id DESC LIMIT 100`, [id]);
    });
  }

  /** Tạo lớp (HK.QT.036): thuộc một năm học còn mở và một khối đang bật; có thể phân công giáo viên ngay */
  async create(actor: UserRow, body: { school_id?: number | null; year_id: number; grade: number; name: string; teacher_ids?: number[]; expected_size?: number | null; description?: string | null }) {
    const schoolId = this.schools.target(actor, body.school_id);
    const name = body.name.trim().replace(/\s+/g, ' ');
    return this.schools.run(actor, async (q) => {
      const year = (await q<{ id: number; label: string; status: string }>('SELECT id, label, status FROM app_school_years WHERE id = $1 AND school_id = $2', [body.year_id, schoolId]))[0];
      if (!year) throw new NotFoundException('Không tìm thấy năm học');
      if (year.status === 'ended') throw new ConflictException('Năm học đã kết thúc, không tạo thêm lớp được');
      await this.assertGradeOpen(q, schoolId, year.label, body.grade);
      const teachers = await this.validTeachers(q, schoolId, body.teacher_ids ?? []);
      const id = await this.insertClass(q, actor, { schoolId, year, grade: body.grade, name, expected_size: body.expected_size ?? null, description: body.description?.trim() || null });
      for (const teacher of teachers) await q('INSERT INTO app_class_teachers (class_id, teacher_id, assigned_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [id, teacher, actor.id]);
      if (teachers.length) await this.log(q, { id, school_id: schoolId }, 'teachers', actor, { note: `Phân công ${teachers.length} giáo viên` });
      return this.view(q, id);
    });
  }

  private async assertGradeOpen(q: Q, schoolId: number, yearLabel: string, grade: number): Promise<void> {
    const row = (await q<{ is_active: boolean }>('SELECT is_active FROM app_school_grades WHERE school_id = $1 AND school_year = $2 AND grade = $3', [schoolId, yearLabel, grade]))[0];
    if (!row?.is_active) throw new ConflictException(`Khối ${grade} chưa được bật trong năm học ${yearLabel}. Hãy thêm khối ở mục khối lớp.`);
  }

  private async insertClass(q: Q, actor: UserRow, c: { schoolId: number; year: { id: number; label: string }; grade: number; name: string; expected_size: number | null; description: string | null }): Promise<number> {
    const code = c.name.toUpperCase().replace(/\s+/g, '');
    if ((await q('SELECT 1 FROM app_classes WHERE school_id = $1 AND school_year = $2 AND class_code = $3', [c.schoolId, c.year.label, code])).length) throw new ConflictException(`Lớp ${c.name} đã có trong năm học ${c.year.label}`);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const joinCode = newJoinCode();
      if ((await q('SELECT 1 FROM app_classes WHERE join_code = $1', [joinCode])).length) continue;
      const row = (await q<{ id: number }>(
        `INSERT INTO app_classes (school_id, year_id, school_year, class_code, name, grade, status, is_active, join_open, join_code, expected_size, description, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'APPROVED', true, true, $7, $8, $9, $10) RETURNING id`,
        [c.schoolId, c.year.id, c.year.label, code, c.name, c.grade, joinCode, c.expected_size, c.description, actor.id]))[0];
      await this.log(q, { id: row.id, school_id: c.schoolId }, 'create', actor);
      return row.id;
    }
    throw new ConflictException('Không sinh được mã tham gia lớp duy nhất, thử lại');
  }

  /** Sửa lớp (HK.QT.037) và phân công giáo viên (HK.QT.022): `teacher_ids` thay toàn bộ danh sách giáo viên của lớp */
  async update(actor: UserRow, id: number, body: { name?: string; grade?: number; expected_size?: number | null; description?: string | null; join_open?: boolean; teacher_ids?: number[] }) {
    return this.schools.run(actor, async (q) => {
      const cls = await this.openClass(q, actor, id);
      const fields: Array<[string, unknown]> = [];
      if (body.name !== undefined) {
        const name = body.name.trim().replace(/\s+/g, ' ');
        const code = name.toUpperCase().replace(/\s+/g, '');
        if ((await q('SELECT 1 FROM app_classes WHERE school_id = $1 AND school_year = $2 AND class_code = $3 AND id <> $4', [cls.school_id, cls.school_year, code, id])).length) throw new ConflictException(`Lớp ${name} đã có trong năm học ${cls.school_year}`);
        fields.push(['name', name], ['class_code', code]);
      }
      if (body.grade !== undefined && body.grade !== cls.grade) {
        const members = (await q<{ n: number }>('SELECT count(*)::int AS n FROM app_class_members WHERE class_id = $1', [id]))[0].n;
        if (members) throw new ConflictException('Lớp đã có học sinh nên không đổi khối được');
        await this.assertGradeOpen(q, cls.school_id, cls.school_year, body.grade);
        fields.push(['grade', body.grade]);
      }
      if (body.expected_size !== undefined) fields.push(['expected_size', body.expected_size]);
      if (body.description !== undefined) fields.push(['description', body.description?.trim() || null]);
      if (body.join_open !== undefined) fields.push(['join_open', body.join_open]);
      if (fields.length) {
        await q(`UPDATE app_classes SET ${fields.map(([k], i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [id, ...fields.map(([, v]) => v)]);
        await this.log(q, cls, body.join_open !== undefined && fields.length === 1 ? (body.join_open ? 'join_open' : 'join_closed') : 'update', actor);
      }
      if (body.teacher_ids !== undefined) await this.setTeachers(q, actor, cls, await this.validTeachers(q, cls.school_id, body.teacher_ids));
      return this.view(q, id);
    });
  }

  private async setTeachers(q: Q, actor: UserRow, cls: ClassRow, wanted: number[]): Promise<void> {
    const current = (await q<{ teacher_id: number }>('SELECT teacher_id FROM app_class_teachers WHERE class_id = $1', [cls.id])).map((r) => r.teacher_id);
    const add = wanted.filter((t) => !current.includes(t)), drop = current.filter((t) => !wanted.includes(t));
    for (const t of add) {
      await q('INSERT INTO app_class_teachers (class_id, teacher_id, assigned_by) VALUES ($1, $2, $3)', [cls.id, t, actor.id]);
      await this.log(q, cls, 'assign', actor, { teacher_id: t });
    }
    for (const t of drop) {
      await q('DELETE FROM app_class_teachers WHERE class_id = $1 AND teacher_id = $2', [cls.id, t]);
      await this.log(q, cls, 'unassign', actor, { teacher_id: t });
    }
  }

  /** Lưu trữ / khôi phục lớp (HK.QT.038): lớp lưu trữ không nhận học sinh mới và mã tham gia ngừng dùng được */
  async archive(actor: UserRow, id: number, archived: boolean) {
    return this.schools.run(actor, async (q) => {
      const cls = await this.openClass(q, actor, id);
      if (cls.is_active === !archived) return this.view(q, id);
      await q('UPDATE app_classes SET is_active = $2, closed_at = CASE WHEN $2 THEN NULL ELSE now() END WHERE id = $1', [id, !archived]);
      await this.log(q, cls, archived ? 'close' : 'reopen', actor);
      return this.view(q, id);
    });
  }

  /** Xóa lớp chưa có học sinh (HK.QT.038); lớp đã có học sinh chỉ được lưu trữ */
  async remove(actor: UserRow, id: number): Promise<void> {
    await this.schools.run(actor, async (q) => {
      const cls = await this.openClass(q, actor, id);
      const members = (await q<{ n: number }>('SELECT count(*)::int AS n FROM app_class_members WHERE class_id = $1', [id]))[0].n;
      if (members) throw new ConflictException(`Lớp đã có ${members} học sinh nên chỉ lưu trữ được, không xóa.`);
      await q('DELETE FROM app_classes WHERE id = $1', [cls.id]);
    });
  }

  /** Đổi mã tham gia lớp (làm mới mã 6 ký tự; mã cũ hết dùng được) */
  async regenerateCode(actor: UserRow, id: number) {
    return this.schools.run(actor, async (q) => {
      const cls = await this.openClass(q, actor, id);
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const code = newJoinCode();
        if ((await q('SELECT 1 FROM app_classes WHERE join_code = $1', [code])).length) continue;
        await q('UPDATE app_classes SET join_code = $2 WHERE id = $1', [id, code]);
        await this.log(q, cls, 'code', actor);
        return this.view(q, id);
      }
      throw new ConflictException('Không sinh được mã tham gia lớp duy nhất, thử lại');
    });
  }

  // ------------------------------------------------------------------ học sinh trong lớp
  private async studentsOf(q: Q, schoolId: number, ids: number[]): Promise<Array<{ id: number; full_name: string }>> {
    const unique = [...new Set(ids)];
    const rows = await q<{ id: number; full_name: string }>("SELECT id, full_name FROM app_users WHERE id = ANY($1) AND school_id = $2 AND role = 'student' AND is_active = 1 AND deleted_at IS NULL", [unique, schoolId]);
    if (rows.length !== unique.length) throw new UnprocessableEntityException('Có học sinh không thuộc trường hoặc đang bị khóa');
    return rows;
  }

  private async addStudent(q: Q, actor: UserRow | null, cls: ClassRow, studentId: number, kind = 'member_add'): Promise<boolean> {
    const done = await q('INSERT INTO app_class_members (class_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING user_id', [cls.id, studentId]);
    if (!done.length) return false;
    await q('UPDATE app_users SET grade = COALESCE($2, grade), school_year = $3 WHERE id = $1', [studentId, cls.grade, cls.school_year]);
    await this.log(q, cls, kind, actor, { user_id: studentId });
    return true;
  }

  /** Xếp nhiều học sinh vào lớp (HK.QT.039); học sinh đã ở trong lớp được bỏ qua */
  async addMembers(actor: UserRow, id: number, studentIds: number[]) {
    return this.schools.run(actor, async (q) => {
      const cls = await this.openClass(q, actor, id);
      if (!cls.is_active) throw new ConflictException('Lớp đã được lưu trữ');
      const students = await this.studentsOf(q, cls.school_id, studentIds);
      let added = 0;
      for (const s of students) if (await this.addStudent(q, actor, cls, s.id)) added += 1;
      return { added, skipped: students.length - added, class: await this.view(q, id) };
    });
  }

  async removeMember(actor: UserRow, id: number, studentId: number): Promise<void> {
    await this.schools.run(actor, async (q) => {
      const cls = await this.openClass(q, actor, id);
      const done = await q('DELETE FROM app_class_members WHERE class_id = $1 AND user_id = $2 RETURNING user_id', [id, studentId]);
      if (!done.length) throw new NotFoundException('Học sinh không ở trong lớp này');
      await this.log(q, cls, 'member_remove', actor, { user_id: studentId });
    });
  }

  /** Chuyển lớp (HK.QT.029): sang lớp khác cùng khối và cùng năm học; dữ liệu học của học sinh giữ nguyên */
  async transfer(actor: UserRow, studentId: number, fromId: number, toId: number) {
    if (fromId === toId) throw new BadRequestException('Lớp đích phải khác lớp hiện tại');
    return this.schools.run(actor, async (q) => {
      const from = await this.openClass(q, actor, fromId), to = await this.openClass(q, actor, toId);
      if (from.school_id !== to.school_id) throw new ForbiddenException('Chỉ chuyển trong cùng trường');
      if (from.year_id !== to.year_id) throw new ConflictException('Chỉ chuyển giữa các lớp cùng năm học; dùng nhân bản lớp để lên lớp.');
      if (from.grade !== to.grade) throw new ConflictException('Chỉ chuyển sang lớp cùng khối');
      if (!to.is_active) throw new ConflictException('Lớp đích đã được lưu trữ');
      if (!(await q('SELECT 1 FROM app_class_members WHERE class_id = $1 AND user_id = $2', [fromId, studentId])).length) throw new NotFoundException('Học sinh không ở trong lớp hiện tại');
      await q('DELETE FROM app_class_members WHERE class_id = $1 AND user_id = $2', [fromId, studentId]);
      const already = !(await this.addStudent(q, actor, to, studentId, 'transfer'));
      await this.log(q, from, 'transfer', actor, { user_id: studentId, related_class_id: toId });
      return { moved: !already, from: await this.view(q, fromId), to: await this.view(q, toId) };
    });
  }

  /** Xếp lớp từ file Excel (HK.QT.039): cột Mã học sinh và Lớp; xem trước rồi lưu như nhập tài khoản */
  async importAssignments(actor: UserRow, file: UploadedXlsx | undefined, opts: { commit: boolean; school_id?: number | null; year_id: number }) {
    const upload = checkUpload(file);
    const schoolId = this.schools.target(actor, opts.school_id);
    const parsed = await readSheet(upload, [{ key: 'user_code', header: 'Mã học sinh *', required: true }, { key: 'class_name', header: 'Lớp *', required: true }]);
    if (!parsed.length) throw new BadRequestException('File không có dòng dữ liệu nào');
    return this.schools.run(actor, async (q) => {
      const year = (await q<{ id: number; status: string }>('SELECT id, status FROM app_school_years WHERE id = $1 AND school_id = $2', [opts.year_id, schoolId]))[0];
      if (!year) throw new NotFoundException('Không tìm thấy năm học');
      if (year.status === 'ended') throw new ConflictException('Năm học đã kết thúc, không xếp lớp được');
      const rows: Array<{ row: number; user_code: string; class_name: string; status: 'ok' | 'error' | 'added' | 'exists'; errors: string[] }> = [];
      for (const { row, values } of parsed) {
        const errors: string[] = [];
        const code = values.user_code.trim(), name = values.class_name.trim();
        const student = code ? (await q<{ id: number }>("SELECT id FROM app_users WHERE school_id = $1 AND role = 'student' AND lower(user_code) = lower($2) AND deleted_at IS NULL AND is_active = 1", [schoolId, code]))[0] : null;
        if (!code || !student) errors.push(code ? `Không có học sinh mã ${code} (hoặc đang bị khóa)` : 'Thiếu mã học sinh');
        const cls = name ? (await q<ClassRow>('SELECT * FROM app_classes WHERE school_id = $1 AND year_id = $2 AND lower(name) = lower($3) AND is_active', [schoolId, opts.year_id, name]))[0] : null;
        if (!name || !cls) errors.push(name ? `Không có lớp "${name}" đang hoạt động trong năm học đã chọn` : 'Thiếu tên lớp');
        const result = { row, user_code: code, class_name: name, status: (errors.length ? 'error' : 'ok') as 'ok' | 'error' | 'added' | 'exists', errors };
        if (!errors.length && opts.commit && student && cls) result.status = (await this.addStudent(q, actor, cls, student.id)) ? 'added' : 'exists';
        rows.push(result);
      }
      const bad = rows.filter((r) => r.status === 'error').length;
      return { committed: opts.commit, total: rows.length, valid: rows.length - bad, errors: bad, added: rows.filter((r) => r.status === 'added').length, rows };
    });
  }

  /**
   * Nhân bản lớp sang năm học mới / lên lớp (HK.QT.040). Với mỗi lớp nguồn tạo một lớp ở năm đích (khối + 1 nếu `promote`, lớp khối 9 không lên lớp),
   * xếp các học sinh được chọn (mặc định mọi học sinh đang hoạt động của lớp) và chép giáo viên phụ trách nếu muốn. Lớp trùng tên hoặc khối chưa bật bị bỏ qua và nêu lý do.
   */
  async clone(actor: UserRow, body: { school_id?: number | null; from_year_id: number; to_year_id: number; class_ids?: number[]; promote?: boolean; copy_teachers?: boolean; student_ids?: number[] }) {
    const schoolId = this.schools.target(actor, body.school_id);
    if (body.from_year_id === body.to_year_id) throw new BadRequestException('Năm học đích phải khác năm học nguồn');
    const promote = body.promote ?? true, copyTeachers = body.copy_teachers ?? true;
    return this.schools.run(actor, async (q) => {
      const years = await q<{ id: number; label: string; status: string }>('SELECT id, label, status FROM app_school_years WHERE school_id = $1 AND id = ANY($2)', [schoolId, [body.from_year_id, body.to_year_id]]);
      const from = years.find((y) => y.id === body.from_year_id), to = years.find((y) => y.id === body.to_year_id);
      if (!from || !to) throw new NotFoundException('Không tìm thấy năm học');
      if (to.status === 'ended') throw new ConflictException('Năm học đích đã kết thúc');
      if (to.label <= from.label) throw new ConflictException('Năm học đích phải sau năm học nguồn');
      const sources = await q<ClassRow>('SELECT * FROM app_classes WHERE school_id = $1 AND year_id = $2 AND is_active AND ($3::int[] IS NULL OR id = ANY($3)) ORDER BY grade, name', [schoolId, from.id, body.class_ids ?? null]);
      const created: Array<{ id: number; name: string; grade: number; students: number; from_class: string }> = [];
      const skipped: Array<{ class: string; reason: string }> = [];
      const selected = body.student_ids ? new Set(body.student_ids) : null;
      for (const src of sources) {
        const grade = (src.grade ?? 0) + (promote ? 1 : 0);
        if (!src.grade) { skipped.push({ class: src.name, reason: 'Lớp chưa có khối' }); continue; }
        if (grade > 9) { skipped.push({ class: src.name, reason: 'Khối 9 đã hoàn thành chương trình, không lên lớp' }); continue; }
        const gradeRow = (await q<{ is_active: boolean }>('SELECT is_active FROM app_school_grades WHERE school_id = $1 AND school_year = $2 AND grade = $3', [schoolId, to.label, grade]))[0];
        if (!gradeRow?.is_active) { skipped.push({ class: src.name, reason: `Khối ${grade} chưa được bật trong năm học ${to.label}` }); continue; }
        const name = promote && src.name.startsWith(String(src.grade)) ? `${grade}${src.name.slice(String(src.grade).length)}` : src.name;
        if ((await q('SELECT 1 FROM app_classes WHERE school_id = $1 AND school_year = $2 AND class_code = $3', [schoolId, to.label, name.toUpperCase().replace(/\s+/g, '')])).length) { skipped.push({ class: src.name, reason: `Lớp ${name} đã có trong năm học ${to.label}` }); continue; }
        const id = await this.insertClass(q, actor, { schoolId, year: to, grade, name, expected_size: src.expected_size, description: src.description });
        const cls = await this.load(q, actor, id);
        const members = await q<{ id: number }>(
          "SELECT u.id FROM app_class_members m JOIN app_users u ON u.id = m.user_id WHERE m.class_id = $1 AND u.role = 'student' AND u.is_active = 1 AND u.deleted_at IS NULL ORDER BY u.full_name", [src.id]);
        let students = 0;
        for (const m of members) if (!selected || selected.has(m.id)) if (await this.addStudent(q, actor, cls, m.id)) students += 1;
        if (copyTeachers) {
          const teachers = await q<{ teacher_id: number }>("SELECT t.teacher_id FROM app_class_teachers t JOIN app_users u ON u.id = t.teacher_id WHERE t.class_id = $1 AND u.is_active = 1 AND u.deleted_at IS NULL", [src.id]);
          for (const t of teachers) await q('INSERT INTO app_class_teachers (class_id, teacher_id, assigned_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [id, t.teacher_id, actor.id]);
        }
        await this.log(q, cls, 'clone', actor, { related_class_id: src.id, note: `Nhân bản từ lớp ${src.name} (${from.label})` });
        created.push({ id, name, grade, students, from_class: src.name });
      }
      return { from_year: from.label, to_year: to.label, created, skipped };
    });
  }

  // ------------------------------------------------------------------ học sinh tham gia lớp bằng mã (HK.HS.008)
  async joinByCode(student: UserRow, rawCode: string) {
    const code = normJoinCode(rawCode);
    if (code.length !== 6) throw new UnprocessableEntityException('Mã lớp gồm 6 ký tự');
    if (!student.school_id) throw new ForbiddenException('Tài khoản tự học không thuộc trường nên chưa tham gia lớp được. Hãy nhờ giáo viên hoặc nhà trường cấp tài khoản.');
    const result = await this.schools.run(student, async (q) => {
      // Học sinh chỉ thấy lớp của trường mình (Row-Level Security); mã của trường khác trả về "không đúng" như mã sai, không lộ lớp nào có thật
      const cls = (await q<ClassRow & { year_status: string | null }>(
        `SELECT c.*, y.status AS year_status FROM app_classes c LEFT JOIN app_school_years y ON y.id = c.year_id WHERE c.join_code = $1 AND c.school_id = $2`, [code, student.school_id]))[0];
      if (!cls) throw new NotFoundException('Mã lớp không đúng hoặc lớp không thuộc trường của bạn');
      if (!cls.is_active || cls.status !== 'APPROVED') throw new ConflictException('Lớp này đã được lưu trữ');
      if (cls.year_status === 'ended') throw new ConflictException('Năm học của lớp đã kết thúc');
      if (!cls.join_open) throw new ForbiddenException('Giáo viên đã tắt cho phép học sinh tự tham gia lớp này');
      if (!(await this.addStudent(q, null, cls, student.id, 'join'))) throw new ConflictException('Bạn đã ở trong lớp này');
      return this.view(q, cls.id);
    });
    return result;
  }

  async mine(student: UserRow) {
    return this.db.query(
      `SELECT c.id, c.name, c.grade, c.school_year, c.is_active,
              COALESCE((SELECT json_agg(u.full_name ORDER BY u.full_name) FROM app_class_teachers t JOIN app_users u ON u.id = t.teacher_id WHERE t.class_id = c.id), '[]'::json) AS teachers,
              (SELECT count(*)::int FROM app_class_members m2 WHERE m2.class_id = c.id) AS members
       FROM app_class_members m JOIN app_classes c ON c.id = m.class_id WHERE m.user_id = $1 ORDER BY c.school_year DESC, c.name`, [student.id]);
  }

  async template(): Promise<Buffer> {
    return buildWorkbook('Phân lớp', [{ key: 'user_code', header: 'Mã học sinh *', width: 16 }, { key: 'class_name', header: 'Lớp *', width: 14 }], [{ user_code: 'HS0001', class_name: '7A1' }],
      ['Mỗi dòng xếp một học sinh vào một lớp của năm học được chọn khi nhập.', 'Học sinh đã ở trong lớp sẽ được bỏ qua. Xóa dòng ví dụ trước khi nhập.']);
  }
}

