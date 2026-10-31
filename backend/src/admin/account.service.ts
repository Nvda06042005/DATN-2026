/**
 * Tài khoản (HK.AD.018–025, HK.QT.014–034): quản trị tổng quản lý người dùng toàn hệ thống; quản trị trường quản lý giáo viên và học sinh của trường mình.
 * Mọi thao tác chạy trong giao dịch có khóa, kiểm tra lại quyền của người thao tác; mật khẩu tạm chỉ trả về một lần và gửi qua hàng đợi email.
 * Xóa chỉ khi tài khoản chưa phát sinh dữ liệu, ngược lại chỉ khóa. Nhập Excel có bước xem trước báo lỗi từng dòng trước khi lưu.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { toPublic } from '../auth/auth.service';
import { generatePassword, hashPassword } from '../auth/passwords';
import { DatabaseService, DuplicateUsername, Q, Role, searchText, toUser, USER_COLUMNS, UserRow } from '../database/database.service';
import { buildWorkbook, checkUpload, Column, parseDate, readSheet, UploadedXlsx } from './excel';
import { MailService } from './mail.service';
import { likeEscape, SchoolService } from './school.service';

export type MemberRole = 'teacher' | 'student';
const BATCH_ROUNDS = 8;
const EMAIL = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/;
const PHONE = /^[0-9+() .-]{8,20}$/;
const GENDERS: Record<string, 'male' | 'female' | 'other'> = { nam: 'male', male: 'male', nu: 'female', female: 'female', khac: 'other', other: 'other' };
const GENDER_LABEL = { male: 'Nam', female: 'Nữ', other: 'Khác' } as const;

export const TEACHER_COLUMNS: Column[] = [
  { key: 'full_name', header: 'Họ và tên *', required: true, width: 28 },
  { key: 'email', header: 'Email *', required: true, width: 30 },
  { key: 'subject', header: 'Bộ môn', width: 18 },
  { key: 'phone', header: 'Số điện thoại', width: 18 },
  { key: 'user_code', header: 'Mã giáo viên', width: 16 },
];
export const STUDENT_COLUMNS: Column[] = [
  { key: 'user_code', header: 'Mã học sinh *', required: true, width: 16 },
  { key: 'full_name', header: 'Họ và tên *', required: true, width: 28 },
  { key: 'birth_date', header: 'Ngày sinh *', required: true, width: 16 },
  { key: 'gender', header: 'Giới tính', width: 12 },
  { key: 'class_name', header: 'Lớp', width: 12 },
  { key: 'email', header: 'Email', width: 30 },
  { key: 'parent_email', header: 'Email phụ huynh', width: 30 },
];

export interface AccountFilter {
  q?: string; role?: Role; school_id?: number; active?: 'true' | 'false'; grade?: number; class_id?: number; subject?: string; page?: number; limit?: number;
}

export interface ImportRow { row: number; full_name: string; user_code: string | null; email: string | null; status: 'ok' | 'error' | 'created'; errors: string[]; username?: string }

interface ClassTarget { id: number; name: string; grade: number | null; school_year: string; year_id: number | null; is_active: boolean }

interface MemberInput {
  full_name: string; email?: string | null; phone?: string | null; subject?: string | null; user_code?: string | null;
  birth_date?: string | null; gender?: 'male' | 'female' | 'other' | null; parent_email?: string | null; class_id?: number | null;
}

const clean = (v: unknown): string | null => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') || null : null);

@Injectable()
export class AccountService {
  constructor(
    private readonly db: DatabaseService,
    private readonly schools: SchoolService,
    private readonly mail: MailService,
  ) {}

  // ------------------------------------------------------------------ quyền
  /** Quản trị trường chỉ quản lý giáo viên/học sinh cùng trường; quản trị tổng cấp 2 không đụng tới quản trị tổng; không ai tự khóa/xóa/đổi quyền chính mình */
  private canManage(actor: UserRow, target: UserRow): void {
    if (actor.id === target.id) throw new BadRequestException('Không tự thay đổi quyền, khóa hoặc xóa tài khoản đang đăng nhập');
    if (actor.role === 'school_admin') {
      if (!['teacher', 'student'].includes(target.role)) throw new ForbiddenException('Chỉ quản trị tổng quản lý tài khoản quản trị');
      if (target.school_id !== actor.school_id) throw new NotFoundException('Không tìm thấy tài khoản');
    }
    if (actor.role === 'root_admin' && actor.admin_level !== 1 && target.role === 'root_admin') throw new ForbiddenException('Quản trị tổng cấp 2 không được thay đổi tài khoản quản trị tổng');
  }

  private async load(q: Q, scope: number | null, id: number): Promise<UserRow> {
    const rows = await q(`SELECT ${USER_COLUMNS} FROM app_users WHERE id = $1 AND deleted_at IS NULL AND ($2::integer IS NULL OR school_id = $2)`, [id, scope]);
    if (!rows.length) throw new NotFoundException('Không tìm thấy tài khoản');
    return toUser(rows[0]);
  }

  /** Tuần tự hóa các thay đổi nhạy cảm và kiểm tra lại người thao tác sau khi chờ khóa */
  private async managed<T>(actor: UserRow, id: number, fn: (q: Q, target: UserRow, actor: UserRow) => Promise<T>): Promise<T> {
    return this.schools.run(actor, async (q, scope) => {
      await q('SELECT pg_advisory_xact_lock(7412026)');
      const fresh = await this.load(q, scope, actor.id);
      if (!fresh.is_active || fresh.role !== actor.role || fresh.token_version !== actor.token_version || fresh.admin_level !== actor.admin_level) throw new ForbiddenException('Quyền của phiên đã thay đổi. Hãy đăng nhập lại.');
      const target = await this.load(q, scope, id);
      this.canManage(fresh, target);
      return fn(q, target, fresh);
    });
  }

  private async schoolOf(q: Q, id: number) {
    const rows = await q<{ id: number; school_code: string; name: string; region: string | null; city: string | null; is_active: boolean }>('SELECT id, school_code, name, region, city, is_active FROM app_schools WHERE id = $1', [id]);
    if (!rows.length) throw new NotFoundException('Không tìm thấy trường');
    return rows[0];
  }

  // ------------------------------------------------------------------ danh sách
  async list(actor: UserRow, f: AccountFilter, fixedRole?: MemberRole) {
    return this.schools.run(actor, async (q, scope) => {
      const where = ['u.deleted_at IS NULL'];
      const params: unknown[] = [];
      const add = (cond: string, v: unknown) => { params.push(v); where.push(cond.replaceAll('?', `$${params.length}`)); };
      const role = fixedRole ?? f.role;
      if (scope !== null) {
        add('u.school_id = ?', scope);
        where.push("u.role IN ('teacher', 'student')");
      } else if (f.school_id) add('u.school_id = ?', f.school_id);
      if (role) add('u.role = ?', role);
      if (f.active) add('u.is_active = ?', f.active === 'true' ? 1 : 0);
      if (f.subject) add('u.subject ILIKE ?', `%${likeEscape(f.subject.trim())}%`);
      if (f.grade) add('(u.grade = ? OR EXISTS (SELECT 1 FROM app_class_members m JOIN app_classes c ON c.id = m.class_id WHERE m.user_id = u.id AND c.grade = ?::smallint))', f.grade);
      if (f.class_id) add('(EXISTS (SELECT 1 FROM app_class_members m WHERE m.user_id = u.id AND m.class_id = ?) OR EXISTS (SELECT 1 FROM app_class_teachers t WHERE t.teacher_id = u.id AND t.class_id = ?))', f.class_id);
      const text = searchText(f.q);
      if (text) add("u.search_text LIKE ? ESCAPE '\\'", `%${likeEscape(text)}%`);
      const limit = Math.min(200, Math.max(1, f.limit ?? 50));
      const page = Math.max(1, f.page ?? 1);
      const total = Number((await q<{ n: string }>(`SELECT COUNT(*) AS n FROM app_users u WHERE ${where.join(' AND ')}`, params))[0].n);
      const rows = await q<Record<string, unknown>>(
        `SELECT ${USER_COLUMNS.split(', ').map((c) => `u.${c}`).join(', ')}, s.name AS school_name,
                COALESCE((SELECT json_agg(json_build_object('id', c.id, 'name', c.name, 'school_year', c.school_year, 'grade', c.grade) ORDER BY c.school_year DESC, c.name)
                          FROM app_class_teachers t JOIN app_classes c ON c.id = t.class_id WHERE t.teacher_id = u.id), '[]'::json) AS teaching_classes,
                COALESCE((SELECT json_agg(json_build_object('id', c.id, 'name', c.name, 'school_year', c.school_year, 'grade', c.grade) ORDER BY c.school_year DESC, c.name)
                          FROM app_class_members m JOIN app_classes c ON c.id = m.class_id WHERE m.user_id = u.id), '[]'::json) AS member_classes
         FROM app_users u LEFT JOIN app_schools s ON s.id = u.school_id
         WHERE ${where.join(' AND ')}
         ORDER BY CASE u.role WHEN 'root_admin' THEN 0 WHEN 'school_admin' THEN 1 WHEN 'teacher' THEN 2 ELSE 3 END, u.full_name, u.id
         LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
        params,
      );
      const items = rows.map((r) => {
        const u = toUser(r);
        return { ...toPublic(u), school_name: (r.school_name as string | null) ?? null, classes: u.role === 'teacher' ? r.teaching_classes : u.role === 'student' ? r.member_classes : [] };
      });
      return { total, page, limit, items };
    });
  }

  async detail(actor: UserRow, id: number) {
    return this.schools.run(actor, async (q, scope) => {
      const user = await this.load(q, scope, id);
      if (scope !== null && !['teacher', 'student'].includes(user.role)) throw new NotFoundException('Không tìm thấy tài khoản');
      const school = user.school_id ? await this.schoolOf(q, user.school_id) : null;
      const classes = await q(
        `SELECT c.id, c.name, c.grade, c.school_year, c.is_active, 'teacher' AS relation FROM app_class_teachers t JOIN app_classes c ON c.id = t.class_id WHERE t.teacher_id = $1
         UNION ALL SELECT c.id, c.name, c.grade, c.school_year, c.is_active, 'student' FROM app_class_members m JOIN app_classes c ON c.id = m.class_id WHERE m.user_id = $1
         ORDER BY school_year DESC, name`, [id]);
      const blocker = await this.db.accountHasData(id, q);
      return { ...toPublic(user), school_name: school?.name ?? null, classes, deletable: blocker === null, delete_blocker: blocker };
    });
  }

  // ------------------------------------------------------------------ tạo tài khoản
  private async queueAccountMail(q: Q, user: UserRow, password: string, schoolName: string | null, reset = false): Promise<'queued' | 'no_email' | 'not_configured'> {
    if (!user.email) return 'no_email';
    await this.mail.enqueue(q, {
      school_id: user.school_id, user_id: user.id, batch_id: null, kind: 'bulk', to: user.email,
      subject: reset ? '[Đông A EDU] Mật khẩu tạm mới' : '[Đông A EDU] Thông tin tài khoản',
      payload: { type: 'account', full_name: user.full_name, username: user.username, password, role: user.role, school: schoolName ?? 'Hệ thống Đông A', reset },
    });
    return this.mail.configured ? 'queued' : 'not_configured';
  }

  private async assertUnique(q: Q, school: number | null, email: string | null, code: string | null, exceptId: number | null = null): Promise<void> {
    if (email && (await q('SELECT 1 FROM app_users WHERE lower(email) = $1 AND deleted_at IS NULL AND ($2::integer IS NULL OR id <> $2)', [email.toLowerCase(), exceptId])).length) throw new ConflictException(`Email ${email} đã được dùng cho một tài khoản khác`);
    if (code && school && (await q('SELECT 1 FROM app_users WHERE school_id = $1 AND lower(user_code) = lower($2) AND deleted_at IS NULL AND ($3::integer IS NULL OR id <> $3)', [school, code, exceptId])).length) throw new ConflictException(`Mã ${code} đã có trong trường`);
  }

  /** Quản trị tổng cấp tài khoản quản trị (HK.AD.020): quản trị tổng cấp 1/2 hoặc quản trị viên trường học */
  async createAdmin(actor: UserRow, body: { full_name: string; role: 'root_admin' | 'school_admin'; email: string; phone?: string | null; school_id?: number | null; admin_level?: 1 | 2 }) {
    if (body.role === 'root_admin') this.schools.assertTopAdmin(actor);
    if (body.role === 'school_admin' && !body.school_id) throw new UnprocessableEntityException('Quản trị viên trường học cần thuộc một trường');
    const email = body.email.trim().toLowerCase();
    const password = generatePassword();
    const passwordHash = await hashPassword(password, BATCH_ROUNDS);
    return this.db.tx(async (q) => {
      await q('SELECT pg_advisory_xact_lock(7412026)');
      await this.assertUnique(q, null, email, null);
      const school = body.role === 'school_admin' ? await this.schoolOf(q, body.school_id as number) : null;
      const username = await this.db.uniqueUsername(body.full_name, body.role, q);
      const user = await this.db.createUser({
        username, full_name: clean(body.full_name) as string, role: body.role, class_name: null, password_hash: passwordHash, must_change_password: true, email, phone: clean(body.phone),
        school_id: school?.id ?? null, school_code: school?.school_code ?? null, region: school?.region ?? null, city: school?.city ?? null,
        admin_level: body.role === 'root_admin' ? (body.admin_level ?? 2) : 1,
      }, q);
      const mail = await this.queueAccountMail(q, user, password, school?.name ?? null);
      return { user: toPublic(user), temporary_password: password, mail };
    }).then((r) => { this.mail.kick(); return r; });
  }

  /** Thêm giáo viên (HK.QT.016) hoặc học sinh (HK.QT.026): sinh tên đăng nhập và mật khẩu tạm, bắt buộc đổi ở lần đăng nhập đầu */
  async createMember(actor: UserRow, role: MemberRole, body: MemberInput & { school_id?: number | null }) {
    const schoolId = this.schools.target(actor, body.school_id);
    const input = this.checkMember(role, body);
    const password = generatePassword();
    const passwordHash = await hashPassword(password, BATCH_ROUNDS);
    return this.schools.run(actor, async (q) => {
      await q('SELECT pg_advisory_xact_lock(7412026)');
      const school = await this.schoolOf(q, schoolId);
      const cls = input.class_id ? await this.classTarget(q, schoolId, input.class_id) : null;
      const user = await this.insertMember(q, school, role, input, passwordHash, cls);
      const mail = await this.queueAccountMail(q, user, password, school.name);
      return { user: toPublic(user), temporary_password: password, mail };
    }).then((r) => { this.mail.kick(); return r; });
  }

  private checkMember(role: MemberRole, body: MemberInput): MemberInput {
    const input: MemberInput = {
      full_name: clean(body.full_name) as string, email: clean(body.email)?.toLowerCase() ?? null, phone: clean(body.phone), subject: clean(body.subject), user_code: clean(body.user_code),
      birth_date: body.birth_date ?? null, gender: body.gender ?? null, parent_email: clean(body.parent_email)?.toLowerCase() ?? null, class_id: body.class_id ?? null,
    };
    if (!input.full_name || input.full_name.length < 2) throw new UnprocessableEntityException('Họ tên tối thiểu 2 ký tự');
    if (role === 'teacher' && !input.email) throw new UnprocessableEntityException('Giáo viên cần có email để nhận mật khẩu tạm');
    if (role === 'student' && !input.user_code) throw new UnprocessableEntityException('Học sinh cần có mã học sinh');
    if (role === 'student' && !input.birth_date) throw new UnprocessableEntityException('Học sinh cần có ngày sinh');
    if (input.email && !EMAIL.test(input.email)) throw new UnprocessableEntityException('Email không hợp lệ');
    if (input.parent_email && !EMAIL.test(input.parent_email)) throw new UnprocessableEntityException('Email phụ huynh không hợp lệ');
    if (input.phone && !PHONE.test(input.phone)) throw new UnprocessableEntityException('Số điện thoại không hợp lệ');
    return input;
  }

  private async classTarget(q: Q, schoolId: number, classId: number): Promise<ClassTarget> {
    const cls = (await q<ClassTarget>('SELECT id, name, grade, school_year, year_id, is_active FROM app_classes WHERE id = $1 AND school_id = $2', [classId, schoolId]))[0];
    if (!cls) throw new NotFoundException('Không tìm thấy lớp');
    if (!cls.is_active) throw new ConflictException(`Lớp ${cls.name} đã được lưu trữ`);
    await this.schools.assertYearOpen(q, cls.year_id);
    return cls;
  }

  private async insertMember(q: Q, school: { id: number; school_code: string; region: string | null; city: string | null }, role: MemberRole, input: MemberInput, passwordHash: string, cls: { id: number; grade: number | null; school_year: string } | null): Promise<UserRow> {
    await this.assertUnique(q, school.id, input.email ?? null, input.user_code ?? null);
    const username = await this.db.uniqueUsername(input.full_name, role, q);
    let user: UserRow;
    try {
      user = await this.db.createUser({
        username, full_name: input.full_name, role, class_name: null, password_hash: passwordHash, must_change_password: true, email: input.email, phone: input.phone, subject: role === 'teacher' ? input.subject : null,
        user_code: input.user_code, birth_date: input.birth_date, gender: input.gender, parent_email: role === 'student' ? input.parent_email : null,
        school_id: school.id, school_code: school.school_code, region: school.region, city: school.city, grade: cls?.grade ?? null, school_year: cls?.school_year ?? null,
      }, q);
    } catch (exc) {
      if (exc instanceof DuplicateUsername) throw new ConflictException('Tên đăng nhập sinh tự động bị trùng, thử lại');
      throw exc;
    }
    if (cls) await q('INSERT INTO app_class_members (class_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [cls.id, user.id]);
    return user;
  }

  // ------------------------------------------------------------------ sửa, khóa, đặt lại mật khẩu, đổi vai trò, xóa
  async update(actor: UserRow, id: number, body: Partial<MemberInput> & { school_id?: number | null }) {
    return this.managed(actor, id, async (q, target, me) => {
      const fields: Record<string, string | number | null> = {};
      const set = (k: string, v: unknown, normalize = clean) => { if (v !== undefined) fields[k] = normalize(v) as string | null; };
      set('full_name', body.full_name);
      if (fields.full_name === null) throw new UnprocessableEntityException('Họ tên không được để trống');
      if (body.email !== undefined) {
        const email = clean(body.email)?.toLowerCase() ?? null;
        if (!email && ['teacher', 'school_admin', 'root_admin'].includes(target.role)) throw new UnprocessableEntityException('Tài khoản này cần có email');
        if (email && !EMAIL.test(email)) throw new UnprocessableEntityException('Email không hợp lệ');
        fields.email = email;
      }
      if (body.phone !== undefined) {
        const phone = clean(body.phone);
        if (phone && !PHONE.test(phone)) throw new UnprocessableEntityException('Số điện thoại không hợp lệ');
        fields.phone = phone;
      }
      if (target.role === 'teacher') set('subject', body.subject);
      if (target.role === 'student') {
        set('parent_email', body.parent_email, (v) => clean(v)?.toLowerCase() ?? null);
        if (fields.parent_email && !EMAIL.test(fields.parent_email as string)) throw new UnprocessableEntityException('Email phụ huynh không hợp lệ');
        if (body.birth_date !== undefined) {
          if (body.birth_date !== null && !parseDate(body.birth_date)) throw new UnprocessableEntityException('Ngày sinh có dạng YYYY-MM-DD');
          fields.birth_date = body.birth_date;
        }
        if (body.gender !== undefined) fields.gender = body.gender;
      }
      if (body.user_code !== undefined) fields.user_code = clean(body.user_code);
      if (fields.user_code === null && target.role === 'student') throw new UnprocessableEntityException('Học sinh cần có mã học sinh');
      await this.assertUnique(q, target.school_id, (fields.email as string | null) ?? null, (fields.user_code as string | null) ?? null, id);
      if (body.school_id !== undefined && body.school_id !== target.school_id) {
        if (me.role !== 'root_admin') throw new ForbiddenException('Không được chuyển trường');
        if (target.role === 'teacher' || target.role === 'student') {
          const linked = (await q<{ n: number }>('SELECT ((SELECT count(*) FROM app_class_members WHERE user_id = $1) + (SELECT count(*) FROM app_class_teachers WHERE teacher_id = $1))::int AS n', [id]))[0].n;
          if (linked) throw new ConflictException('Tài khoản đang thuộc lớp; hãy gỡ khỏi lớp trước khi chuyển trường');
        }
        if (target.role !== 'root_admin' && !body.school_id) throw new UnprocessableEntityException('Tài khoản này cần thuộc một trường');
        const school = body.school_id ? await this.schoolOf(q, body.school_id) : null;
        await q('UPDATE app_users SET school_id = $2, school_code = $3, region = $4, city = $5, token_version = token_version + 1 WHERE id = $1', [id, school?.id ?? null, school?.school_code ?? null, school?.region ?? null, school?.city ?? null]);
      }
      const updated = await this.db.updateUser(id, fields, q);
      return toPublic(updated as UserRow);
    });
  }

  /** Khóa/mở khóa (HK.AD.023, HK.QT.019/030): khóa cần ghi lý do và thu hồi mọi phiên đăng nhập; dữ liệu giữ nguyên */
  async setLocked(actor: UserRow, id: number, locked: boolean, reason?: string | null) {
    const why = clean(reason);
    if (locked && !why) throw new UnprocessableEntityException('Hãy ghi lý do khóa tài khoản');
    return this.managed(actor, id, async (q, _target, me) => {
      await this.db.setLocked(id, locked, why, me.id, q);
      return toPublic((await this.db.getById(id, q)) as UserRow);
    });
  }

  /** Đặt lại mật khẩu (HK.AD.024, HK.QT.020/031): sinh mật khẩu tạm, bắt buộc đổi ở lần đăng nhập sau, gửi email nếu có */
  async resetPassword(actor: UserRow, id: number) {
    const password = generatePassword();
    const passwordHash = await hashPassword(password, BATCH_ROUNDS);
    return this.managed(actor, id, async (q, target) => {
      await this.db.setPassword(id, passwordHash, true, q);
      await q('UPDATE app_users SET profile_confirmed_at = COALESCE(profile_confirmed_at, now()) WHERE id = $1 AND role <> \'student\'', [id]);
      const school = target.school_id ? await this.schoolOf(q, target.school_id) : null;
      const fresh = (await this.db.getById(id, q)) as UserRow;
      const mail = await this.queueAccountMail(q, fresh, password, school?.name ?? null, true);
      return { user: toPublic(fresh), temporary_password: password, mail };
    }).then((r) => { this.mail.kick(); return r; });
  }

  /** Đổi vai trò (HK.AD.022): chỉ khi tài khoản chưa thuộc lớp nào; mọi phiên cũ bị thu hồi */
  async changeRole(actor: UserRow, id: number, role: Role, schoolId?: number | null, adminLevel?: 1 | 2) {
    this.schools.assertTopAdmin(actor);
    return this.managed(actor, id, async (q, target) => {
      const linked = (await q<{ n: number }>('SELECT ((SELECT count(*) FROM app_class_members WHERE user_id = $1) + (SELECT count(*) FROM app_class_teachers WHERE teacher_id = $1))::int AS n', [id]))[0].n;
      if (linked && (role !== target.role || (schoolId !== undefined && schoolId !== target.school_id))) throw new ConflictException('Tài khoản đang thuộc lớp; hãy gỡ khỏi lớp trước khi đổi vai trò hoặc trường');
      const sid = role === 'root_admin' ? null : schoolId === undefined ? target.school_id : schoolId;
      if (role !== 'root_admin' && !sid) throw new UnprocessableEntityException('Hãy gán trường trước khi cấp vai trò này');
      if (role !== 'student' && !target.email) throw new UnprocessableEntityException('Giáo viên và quản trị viên cần có email');
      const school = sid ? await this.schoolOf(q, sid) : null;
      await q(
        `UPDATE app_users SET role = $2, school_id = $3, school_code = $4, region = $5, city = $6, class_name = NULL,
           grade = CASE WHEN $2 = 'student' THEN grade ELSE NULL END, admin_level = $7, token_version = token_version + 1 WHERE id = $1`,
        [id, role, sid, school?.school_code ?? null, school?.region ?? null, school?.city ?? null, role === 'root_admin' ? (adminLevel ?? target.admin_level) : 1]);
      return toPublic((await this.db.getById(id, q)) as UserRow);
    });
  }

  /** Xóa tài khoản chưa phát sinh dữ liệu (HK.AD.025, HK.QT.021/032); đã có dữ liệu thì chỉ cho phép khóa */
  async remove(actor: UserRow, id: number): Promise<void> {
    await this.managed(actor, id, async (q) => {
      const blocker = await this.db.accountHasData(id, q);
      if (blocker) throw new ConflictException(`Không xóa được vì tài khoản ${blocker}; hãy khóa tài khoản thay vì xóa.`);
      await this.db.deleteUser(id, q);
    });
  }

  // ------------------------------------------------------------------ nhập / xuất Excel
  async template(kind: 'teachers' | 'students' | 'class-members'): Promise<Buffer> {
    if (kind === 'teachers') {
      return buildWorkbook('Giáo viên', TEACHER_COLUMNS, [{ full_name: 'Nguyễn Văn An', email: 'an.nguyen@example.edu.vn', subject: 'Lịch sử', phone: '0901234567', user_code: 'GV001' }],
        ['Cột có dấu * là bắt buộc. Email phải khác nhau và chưa dùng cho tài khoản nào khác.', 'Hệ thống sinh mật khẩu tạm và gửi vào email của giáo viên; giáo viên đổi mật khẩu ở lần đăng nhập đầu tiên.', 'Xóa dòng ví dụ trước khi nhập.']);
    }
    if (kind === 'students') {
      return buildWorkbook('Học sinh', STUDENT_COLUMNS, [{ user_code: 'HS0001', full_name: 'Trần Thị Bình', birth_date: '15/03/2013', gender: 'Nữ', class_name: '7A1', email: '', parent_email: 'phuhuynh@example.com' }],
        ['Cột có dấu * là bắt buộc. Mã học sinh không được trùng trong trường.', 'Ngày sinh dạng dd/mm/yyyy hoặc yyyy-mm-dd. Giới tính: Nam, Nữ hoặc Khác.', 'Cột Lớp (không bắt buộc) là tên lớp đã tạo trong năm học được chọn khi nhập.', 'Xóa dòng ví dụ trước khi nhập.']);
    }
    return buildWorkbook('Phân lớp', [{ key: 'user_code', header: 'Mã học sinh *', required: true, width: 16 }, { key: 'class_name', header: 'Lớp *', required: true, width: 14 }],
      [{ user_code: 'HS0001', class_name: '7A1' }], ['Mỗi dòng xếp một học sinh vào một lớp của năm học được chọn.', 'Học sinh đã ở trong lớp sẽ được bỏ qua.']);
  }

  /**
   * Nhập danh sách giáo viên/học sinh (HK.QT.017/027). `commit=false`: chỉ kiểm tra và báo lỗi từng dòng (trùng email/mã trong file hoặc trong trường,
   * thiếu dữ liệu, sai định dạng, lớp không có). `commit=true`: kiểm tra lại và lưu các dòng hợp lệ, bỏ qua dòng lỗi; trả mật khẩu tạm một lần.
   */
  async importMembers(actor: UserRow, role: MemberRole, file: UploadedXlsx | undefined, opts: { commit: boolean; school_id?: number | null; year_id?: number | null }) {
    const upload = checkUpload(file);
    const schoolId = this.schools.target(actor, opts.school_id);
    const parsed = await readSheet(upload, role === 'teacher' ? TEACHER_COLUMNS : STUDENT_COLUMNS);
    if (!parsed.length) throw new BadRequestException('File không có dòng dữ liệu nào');
    return this.schools.run(actor, async (q) => {
      if (opts.commit) await q('SELECT pg_advisory_xact_lock(7412026)');
      const school = await this.schoolOf(q, schoolId);
      const yearId = opts.year_id ?? (await q<{ id: number }>("SELECT id FROM app_school_years WHERE school_id = $1 AND status = 'active'", [schoolId]))[0]?.id ?? null;
      if (opts.year_id && !(await q('SELECT 1 FROM app_school_years WHERE id = $1 AND school_id = $2', [opts.year_id, schoolId])).length) throw new NotFoundException('Không tìm thấy năm học');
      const seenEmail = new Set<string>(), seenCode = new Set<string>();
      const rows: ImportRow[] = [];
      const credentials: Array<{ row: number; username: string; password: string; full_name: string; email: string | null }> = [];
      for (const { row, values } of parsed) {
        const errors: string[] = [];
        const input: MemberInput = {
          full_name: clean(values.full_name) ?? '', email: clean(values.email)?.toLowerCase() ?? null, phone: clean(values.phone), subject: clean(values.subject), user_code: clean(values.user_code),
          parent_email: clean(values.parent_email)?.toLowerCase() ?? null, gender: null, birth_date: null, class_id: null,
        };
        if (input.full_name.length < 2) errors.push('Thiếu họ tên');
        if (role === 'teacher' && !input.email) errors.push('Thiếu email');
        if (role === 'student' && !input.user_code) errors.push('Thiếu mã học sinh');
        if (input.email && !EMAIL.test(input.email)) errors.push('Email không hợp lệ');
        if (input.parent_email && !EMAIL.test(input.parent_email)) errors.push('Email phụ huynh không hợp lệ');
        if (input.phone && !PHONE.test(input.phone)) errors.push('Số điện thoại không hợp lệ');
        if (role === 'student') {
          if (!values.birth_date) errors.push('Thiếu ngày sinh');
          else if (!(input.birth_date = parseDate(values.birth_date))) errors.push('Ngày sinh sai định dạng (dd/mm/yyyy)');
          if (values.gender) {
            const g = GENDERS[searchText(values.gender)];
            if (!g) errors.push('Giới tính phải là Nam, Nữ hoặc Khác'); else input.gender = g;
          }
        }
        let cls: ClassTarget | null = null;
        if (role === 'student' && clean(values.class_name)) {
          const found = yearId ? (await q<{ id: number }>('SELECT id FROM app_classes WHERE school_id = $1 AND year_id = $2 AND lower(name) = lower($3)', [schoolId, yearId, clean(values.class_name)]))[0] : null;
          if (!found) errors.push(`Không có lớp "${clean(values.class_name)}" trong năm học đã chọn`);
          else cls = await this.classTarget(q, schoolId, found.id).catch((e: Error) => { errors.push(e.message); return null; });
        }
        const emailKey = input.email?.toLowerCase(), codeKey = input.user_code?.toLowerCase();
        if (emailKey && seenEmail.has(emailKey)) errors.push('Email trùng với dòng trước trong file');
        if (codeKey && seenCode.has(codeKey)) errors.push('Mã trùng với dòng trước trong file');
        if (!errors.length) {
          try { await this.assertUnique(q, schoolId, input.email ?? null, input.user_code ?? null); } catch (e) { errors.push((e as Error).message); }
        }
        if (emailKey) seenEmail.add(emailKey);
        if (codeKey) seenCode.add(codeKey);
        const result: ImportRow = { row, full_name: input.full_name, user_code: input.user_code ?? null, email: input.email ?? null, status: errors.length ? 'error' : 'ok', errors };
        if (!errors.length && opts.commit) {
          const password = generatePassword();
          const user = await this.insertMember(q, school, role, input, await hashPassword(password, BATCH_ROUNDS), cls);
          await this.queueAccountMail(q, user, password, school.name);
          result.status = 'created';
          result.username = user.username;
          credentials.push({ row, username: user.username, password, full_name: user.full_name, email: user.email });
        }
        rows.push(result);
      }
      const invalid = rows.filter((r) => r.status === 'error').length;
      return {
        committed: opts.commit, year_id: yearId, total: rows.length, valid: rows.length - invalid, errors: invalid,
        created: rows.filter((r) => r.status === 'created').length, rows, credentials,
      };
    }).then((r) => { if (opts.commit) this.mail.kick(); return r; });
  }

  async exportMembers(actor: UserRow, role: MemberRole, f: AccountFilter): Promise<Buffer> {
    const all: Awaited<ReturnType<AccountService['list']>>['items'] = [];
    for (let page = 1; page <= 100; page += 1) {
      const chunk = (await this.list(actor, { ...f, page, limit: 200 }, role)).items;
      all.push(...chunk);
      if (chunk.length < 200) break;
    }
    const names = (u: { classes: unknown }) => (u.classes as Array<{ name: string }>).map((c) => c.name).join(', ');
    const columns: Column[] = role === 'teacher'
      ? [...TEACHER_COLUMNS.map((c) => ({ ...c, header: c.header.replace(' *', '') })), { key: 'classes_text', header: 'Lớp phụ trách', width: 26 }, { key: 'status', header: 'Trạng thái', width: 16 }]
      : [...STUDENT_COLUMNS.map((c) => ({ ...c, header: c.header.replace(' *', '') })), { key: 'status', header: 'Trạng thái', width: 16 }];
    const rows = all.map((u) => ({
      ...u, gender: u.gender ? GENDER_LABEL[u.gender] : '', birth_date: u.birth_date ?? '', class_name: names(u), classes_text: names(u), status: u.is_active ? 'Đang hoạt động' : 'Đã khóa',
    }));
    return buildWorkbook(role === 'teacher' ? 'Giáo viên' : 'Học sinh', columns, rows);
  }
}
