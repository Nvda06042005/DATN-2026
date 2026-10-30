/**
 * Nghiệp vụ nhiều trường: thống kê, trường, tài khoản (lọc nhanh, thùng rác 45 ngày), cấp tài khoản từ file Excel mẫu
 * (Python kiểm chữ ký, chuẩn hóa dòng, sinh tên đăng nhập/mật khẩu; RAG Smart Delta Dispatch), lớp học chờ duyệt, thông báo.
 * Quản trị trường và giáo viên: truy vấn chạy trong db.scoped(school_id lấy từ token) – Row-Level Security theo trường.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, UnprocessableEntityException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AiService, ExcelRow, MatchCandidate, MatchDecision } from '../ai/ai.service';
import { toPublic } from '../auth/auth.service';
import { generatePassword, hashPassword, TEMP_ITERATIONS, verifyPassword } from '../auth/passwords';
import { config } from '../config';
import { DatabaseService, DuplicateUsername, Progress, Q, Role, searchText, toUser, USER_COLUMNS, UserRow } from '../database/database.service';
import { accuracy, effectiveStreak } from '../student/progress';
import { MailService } from './mail.service';

export const TRASH_DAYS = 45;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 1000;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
/** Trình duyệt gửi MIME chuẩn của .xlsx; app điện thoại có thể gửi application/octet-stream */
const ACCEPTED_MIMES = [XLSX_MIME, 'application/octet-stream'];
const GRADES = [6, 7, 8, 9] as const;

export interface UploadedXlsx {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface UserFilter {
  q?: string;
  school_id?: number;
  region?: string;
  city?: string;
  school_year?: string;
  grade?: number;
  role?: Role;
  active?: 'true' | 'false';
  page?: number;
  limit?: number;
}

type RowStatus = 'created' | 'delta' | 'existing' | 'incomplete' | 'error';

export interface RowResult {
  row: number;
  full_name: string;
  role: 'teacher' | 'student' | null;
  school_code: string;
  status: RowStatus;
  username?: string;
  missing?: string[];
  message?: string;
}

interface SchoolRow {
  id: number;
  school_code: string;
  name: string;
  region: string | null;
  city: string | null;
}

/** Mã trường chuẩn hóa 4 chữ số: chỉ giữ chữ số, lấy 4 số cuối, thêm 0 phía trước */
export const normCode = (code: string | null | undefined): string => {
  const digits = String(code ?? '').replace(/\D/g, '');
  return digits ? digits.slice(-4).padStart(4, '0') : '';
};

const SCHOOL_YEAR = /^(\d{4})-(\d{4})$/;
export const validSchoolYear = (y: string) => {
  const m = SCHOOL_YEAR.exec(y.trim());
  return !!m && Number(m[2]) === Number(m[1]) + 1;
};

const cosine = (a: number[], b: number[]): number => {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
};

const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (ch) => `\\${ch}`);
const daysLeft = (purgeAt: string | null) => (purgeAt ? Math.max(0, Math.ceil((new Date(purgeAt).getTime() - Date.now()) / 86_400_000)) : 0);

@Injectable()
export class SchoolService implements OnApplicationBootstrap {
  private readonly logger = new Logger('School');

  constructor(
    private readonly db: DatabaseService,
    private readonly ai: AiService,
    private readonly mail: MailService,
  ) {}

  /** Máy chủ gói miễn phí có thể ngủ lúc 00:00: dọn thùng rác bù khi khởi động */
  onApplicationBootstrap(): void {
    if (this.db.ready) void this.purgeExpired().catch(() => undefined);
  }

  /** Quản trị tổng: toàn hệ thống; quản trị trường, giáo viên, học sinh: chỉ trường của mình (Row-Level Security) */
  private run<T>(user: UserRow, fn: (q: Q, scope: number | null) => Promise<T>): Promise<T> {
    if (user.role === 'root_admin') return this.db.tx((q) => fn(q, null));
    if (!user.school_id) throw new ForbiddenException('Tài khoản chưa được gán trường – liên hệ quản trị tổng');
    return this.db.scoped(user.school_id, (q) => fn(q, user.school_id));
  }

  private async userInScope(q: Q, scope: number | null, id: number): Promise<UserRow> {
    const rows = await q(`SELECT ${USER_COLUMNS} FROM app_users WHERE id = $1 AND ($2::integer IS NULL OR school_id = $2)`, [id, scope]);
    if (!rows.length) throw new NotFoundException('Không tìm thấy tài khoản');
    return toUser(rows[0]);
  }

  /** Quản trị trường chỉ quản lý giáo viên/học sinh; quản trị tổng quản lý tài khoản khác, không tự thay đổi quyền/khóa/xóa. */
  private canManage(actor: UserRow, target: UserRow): void {
    if (actor.id === target.id) throw new BadRequestException('Không tự thay đổi quyền, khóa hoặc xóa tài khoản đang đăng nhập');
    if (actor.role !== 'root_admin' && !['teacher', 'student'].includes(target.role)) throw new ForbiddenException('Chỉ quản trị tổng quản lý tài khoản quản trị');
    if (actor.role === 'school_admin' && target.role === 'school_admin') throw new ForbiddenException('Chỉ quản trị tổng quản lý tài khoản quản trị trường');
  }

  // ------------------------------------------------------------------ thống kê
  async overview(actor: UserRow, schoolId?: number) {
    return this.run(actor, async (q, scope) => {
      const sid = scope ?? schoolId ?? null;
      const schools = await q<SchoolRow & Record<string, string>>(
        `SELECT s.id, s.school_code, s.name, s.region, s.city,
                COUNT(u.id) FILTER (WHERE u.role = 'school_admin') AS admins,
                COUNT(u.id) FILTER (WHERE u.role = 'teacher') AS teachers,
                COUNT(u.id) FILTER (WHERE u.role = 'student') AS students,
                ${GRADES.map((g) => `COUNT(u.id) FILTER (WHERE u.role = 'student' AND u.grade = ${g}) AS g${g}`).join(', ')}
         FROM app_schools s LEFT JOIN app_users u ON u.school_id = s.id AND u.deleted_at IS NULL
         WHERE ($1::integer IS NULL OR s.id = $1)
         GROUP BY s.id ORDER BY s.name`,
        [sid],
      );
      const perSchool = schools.map((s) => ({
        id: s.id, school_code: s.school_code, name: s.name, region: s.region, city: s.city,
        admins: Number(s.admins), teachers: Number(s.teachers), students: Number(s.students),
        grades: Object.fromEntries(GRADES.map((g) => [g, Number(s[`g${g}`])])) as Record<6 | 7 | 8 | 9, number>,
      }));
      const unassigned = sid === null
        ? Number((await q<{ n: string }>("SELECT COUNT(*) AS n FROM app_users WHERE school_id IS NULL AND role IN ('teacher', 'student') AND deleted_at IS NULL"))[0].n)
        : 0;
      const count = async (sql: string) => Number((await q<{ n: string }>(sql, [sid]))[0].n);
      const outbox = await q<{ status: string; n: string }>('SELECT status, COUNT(*) AS n FROM app_email_outbox WHERE ($1::integer IS NULL OR school_id = $1) GROUP BY status', [sid]);
      return {
        scope: sid === null ? 'system' : 'school',
        schools: perSchool.length,
        teachers: perSchool.reduce((a, s) => a + s.teachers, 0),
        students: perSchool.reduce((a, s) => a + s.students, 0),
        grades: Object.fromEntries(GRADES.map((g) => [g, perSchool.reduce((a, s) => a + s.grades[g], 0)])),
        unassigned,
        per_school: perSchool,
        pending_classes: await count("SELECT COUNT(*) AS n FROM app_classes WHERE status = 'PENDING' AND ($1::integer IS NULL OR school_id = $1)"),
        incomplete: await count('SELECT COUNT(*) AS n FROM app_incomplete_import_logs WHERE resolved_at IS NULL AND ($1::integer IS NULL OR school_id = $1)'),
        trash: await count('SELECT COUNT(*) AS n FROM app_users WHERE deleted_at IS NOT NULL AND ($1::integer IS NULL OR school_id = $1)'),
        pending_first_login: await count("SELECT COUNT(*) AS n FROM app_users WHERE must_change_password = 1 AND role IN ('teacher', 'student') AND deleted_at IS NULL AND ($1::integer IS NULL OR school_id = $1)"),
        outbox: Object.fromEntries(['queued', 'sending', 'sent', 'failed', 'cancelled'].map((st) => [st, Number(outbox.find((o) => o.status === st)?.n ?? 0)])),
        features: { pgvector: this.db.vectorSchema !== null, rls_school_scope: this.db.rlsReady, smtp: this.mail.configured },
      };
    });
  }

  // ------------------------------------------------------------------ trường (quản trị tổng)
  async createSchool(body: { school_code: string; name: string; region?: string | null; city?: string | null }) {
    const code = normCode(body.school_code);
    if (!code) throw new UnprocessableEntityException('Mã số trường cần có chữ số');
    const exists = await this.db.query('SELECT 1 FROM app_schools WHERE school_code = $1', [code]);
    if (exists.length) throw new ConflictException(`Mã trường ${code} đã có trong hệ thống`);
    return (
      await this.db.query<SchoolRow>('INSERT INTO app_schools (school_code, name, region, city) VALUES ($1, $2, $3, $4) RETURNING id, school_code, name, region, city', [
        code, body.name.trim(), body.region?.trim() || null, body.city?.trim() || null,
      ])
    )[0];
  }

  async updateSchool(id: number, body: { name?: string; region?: string | null; city?: string | null }) {
    const rows = await this.db.query<SchoolRow>(
      'UPDATE app_schools SET name = COALESCE($2, name), region = COALESCE($3, region), city = COALESCE($4, city) WHERE id = $1 RETURNING id, school_code, name, region, city',
      [id, body.name?.trim() || null, body.region?.trim() ?? null, body.city?.trim() ?? null],
    );
    if (!rows.length) throw new NotFoundException('Không tìm thấy trường');
    return rows[0];
  }

  private async schoolById(q: Q, id: number): Promise<SchoolRow> {
    const rows = await q<SchoolRow>('SELECT id, school_code, name, region, city FROM app_schools WHERE id = $1', [id]);
    if (!rows.length) throw new NotFoundException('Không tìm thấy trường');
    return rows[0];
  }

  // ------------------------------------------------------------------ tài khoản
  /** Bộ lọc kết hợp + tìm kiếm tức thời (chuỗi không dấu, chỉ mục trigram) */
  async listUsers(actor: UserRow, f: UserFilter) {
    return this.run(actor, async (q, scope) => {
      const where = ['u.deleted_at IS NULL'];
      const params: unknown[] = [];
      const add = (cond: string, v: unknown) => {
        params.push(v);
        where.push(cond.replace('?', `$${params.length}`));
      };
      if (scope !== null) {
        add('u.school_id = ?', scope);
        where.push("u.role IN ('teacher', 'student'" + (actor.role === 'school_admin' ? ", 'school_admin'" : '') + ')');
      } else if (f.school_id) add('u.school_id = ?', f.school_id);
      if (f.role) add('u.role = ?', f.role);
      if (f.active) add('u.is_active = ?', f.active === 'true' ? 1 : 0);
      if (f.grade) add('u.grade = ?', f.grade);
      if (f.school_year) add('u.school_year = ?', f.school_year);
      if (f.region) add('u.region = ?', f.region);
      if (f.city) add('u.city = ?', f.city);
      const text = searchText(f.q);
      if (text) add("u.search_text LIKE ? ESCAPE '\\'", `%${likeEscape(text)}%`);
      const limit = Math.min(200, Math.max(1, f.limit ?? 50));
      const page = Math.max(1, f.page ?? 1);
      const total = Number((await q<{ n: string }>(`SELECT COUNT(*) AS n FROM app_users u WHERE ${where.join(' AND ')}`, params))[0].n);
      const rows = await q<Record<string, unknown>>(
        `SELECT ${USER_COLUMNS.split(', ').map((c) => `u.${c}`).join(', ')}, s.name AS school_name,
                p.xp, p.streak, p.last_active_date, p.lessons_completed, p.questions_answered, p.questions_correct, p.freeze_week
         FROM app_users u LEFT JOIN app_schools s ON s.id = u.school_id LEFT JOIN app_progress p ON p.user_id = u.id
         WHERE ${where.join(' AND ')}
         ORDER BY CASE u.role WHEN 'root_admin' THEN 0 WHEN 'school_admin' THEN 1 WHEN 'teacher' THEN 2 ELSE 3 END, u.grade NULLS LAST, u.full_name
         LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
        params,
      );
      const items = rows.map((r) => {
        const u = toUser(r);
        const student = u.role === 'student';
        const p = r.xp === null || r.xp === undefined ? undefined : (r as unknown as Progress);
        return {
          ...toPublic(u),
          school_name: (r.school_name as string | null) ?? null,
          xp: student ? Number(r.xp ?? 0) : null,
          streak: student ? effectiveStreak(p) : null,
          lessons_completed: student ? Number(r.lessons_completed ?? 0) : null,
          accuracy: student ? accuracy(p) : null,
        };
      });
      const facets = await q<{ region: string | null; city: string | null; school_year: string | null }>(
        `SELECT DISTINCT region, city, school_year FROM app_users u WHERE u.deleted_at IS NULL AND ($1::integer IS NULL OR u.school_id = $1)`,
        [scope ?? f.school_id ?? null],
      );
      const uniq = (vals: Array<string | null>) => [...new Set(vals.filter((v): v is string => Boolean(v)))].sort();
      return {
        total, page, limit, items,
        facets: { regions: uniq(facets.map((x) => x.region)), cities: uniq(facets.map((x) => x.city)), school_years: uniq(facets.map((x) => x.school_year)) },
      };
    });
  }

  /** Cấp một tài khoản thủ công (quản trị trường: giáo viên/học sinh của trường; quản trị tổng: thêm quản trị trường) */
  async createUser(
    actor: UserRow,
    body: { full_name: string; role: Role; school_id?: number | null; class_name?: string | null; grade?: number | null; school_year?: string | null; email?: string | null; user_code?: string | null; username?: string | null; password?: string | null },
  ) {
    if (actor.role !== 'root_admin' && !['teacher', 'student'].includes(body.role)) throw new ForbiddenException('Chỉ quản trị tổng cấp được tài khoản quản trị trường');
    const schoolId = body.role === 'root_admin' ? null : actor.role === 'school_admin' ? actor.school_id : (body.school_id ?? null);
    if (body.role === 'school_admin' && !schoolId) throw new UnprocessableEntityException('Quản trị trường cần thuộc một trường');
    if (body.school_year && !validSchoolYear(body.school_year)) throw new UnprocessableEntityException('Năm học có dạng 2025-2026');
    const username = body.username || (await this.db.uniqueUsername(body.full_name, body.role));
    const password = body.password || generatePassword();
    const passwordHash = await hashPassword(password);
    return this.run(actor, async (q, scope) => {
      await q('SELECT pg_advisory_xact_lock(7412026)');
      const fresh = await this.userInScope(q, scope, actor.id);
      if (!fresh.is_active || fresh.deleted_at || fresh.role !== actor.role || fresh.token_version !== actor.token_version) throw new ForbiddenException('Phiên đã thay đổi. Hãy đăng nhập lại.');
      const school = schoolId ? await this.schoolById(q, schoolId) : null;
      try {
        const user = await this.db.createUser(
          {
            username, full_name: body.full_name, role: body.role, class_name: body.class_name ?? null, password_hash: passwordHash, must_change_password: true,
            school_id: school?.id ?? null, school_code: school?.school_code ?? null, region: school?.region ?? null, city: school?.city ?? null,
            grade: body.grade ?? null, school_year: body.school_year ?? null, email: body.email?.trim().toLowerCase() || null, user_code: body.user_code?.trim() || null,
          },
          q,
        );
        return { user: toPublic(user), password };
      } catch (exc) {
        if (exc instanceof DuplicateUsername) throw new ConflictException(`Tên đăng nhập '${username}' đã tồn tại`);
        if ((exc as { code?: string }).code === '23505') throw new ConflictException('Đã có tài khoản trùng mã người dùng, mã trường và email');
        throw exc;
      }
    });
  }

  /** Serialize sensitive account changes and recheck the actor after waiting for the lock. */
  private async managed<T>(actor: UserRow, id: number, fn: (q: Q, target: UserRow) => Promise<T>): Promise<T> {
    return this.run(actor, async (q, scope) => {
      await q('SELECT pg_advisory_xact_lock(7412026)');
      const fresh = await this.userInScope(q, scope, actor.id);
      if (!fresh.is_active || fresh.deleted_at || fresh.role !== actor.role || fresh.token_version !== actor.token_version) throw new ForbiddenException('Quyền của phiên đã thay đổi. Hãy đăng nhập lại.');
      const target = await this.userInScope(q, scope, id);
      this.canManage(fresh, target);
      if (target.deleted_at) throw new BadRequestException('Tài khoản đã ở thùng rác');
      return fn(q, target);
    });
  }

  async userDetail(actor: UserRow, id: number) {
    return this.run(actor, async (q, scope) => {
      const user = await this.userInScope(q, scope, id);
      const school = user.school_id ? await this.schoolById(q, user.school_id) : null;
      const classes = await q('SELECT c.id, c.class_code, c.name, c.school_year, c.status FROM app_classes c WHERE c.school_id = $2 AND (c.teacher_id = $1 OR EXISTS (SELECT 1 FROM app_class_members m WHERE m.class_id = c.id AND m.user_id = $1)) ORDER BY c.school_year DESC, c.class_code', [id, user.school_id]);
      return { ...toPublic(user), school_name: school?.name ?? null, classes };
    });
  }

  async updateUser(actor: UserRow, id: number, body: { full_name?: string; class_name?: string | null; is_active?: boolean; email?: string | null; grade?: number | null }) {
    return this.managed(actor, id, async q => toPublic((await this.db.updateUser(id, body, q))!));
  }

  async assignRole(actor: UserRow, id: number, role: Role, schoolId?: number | null) {
    if (actor.role !== 'root_admin' && !['teacher', 'student'].includes(role)) throw new ForbiddenException('Không được nâng quyền quản trị');
    return this.managed(actor, id, async (q, target) => {
      if (actor.role !== 'root_admin' && schoolId !== undefined && schoolId !== target.school_id) throw new ForbiddenException('Không được chuyển trường');
      const sid = role === 'root_admin' ? null : schoolId ?? target.school_id;
      if (role !== 'root_admin' && !sid) throw new UnprocessableEntityException('Hãy gán trường trước khi cấp vai trò này');
      const school = sid ? await this.schoolById(q, sid) : null;
      const changed = role !== target.role || sid !== target.school_id;
      if (changed) await q("UPDATE app_users SET role = $2, school_id = $3, school_code = $4, region = $5, city = $6, class_name = NULL, grade = CASE WHEN $2 = 'student' THEN grade ELSE NULL END, token_version = token_version + 1 WHERE id = $1", [id, role, sid, school?.school_code ?? null, school?.region ?? null, school?.city ?? null]);
      return toPublic((await this.db.getById(id, q))!);
    });
  }

  async resetPassword(actor: UserRow, id: number) {
    const password = generatePassword(), passwordHash = await hashPassword(password);
    return this.managed(actor, id, async q => {
      await this.db.setPassword(id, passwordHash, true, q);
      return { user: toPublic((await this.db.getById(id, q))!), password };
    });
  }

  // ------------------------------------------------------------------ thùng rác 45 ngày
  async trashUser(actor: UserRow, id: number): Promise<void> {
    await this.managed(actor, id, async q => {
      await q(`UPDATE app_users SET deleted_at = now(), purge_at = now() + interval '${TRASH_DAYS} days', is_active = 0, token_version = token_version + 1 WHERE id = $1`, [id]);
    });
  }

  async trash(actor: UserRow) {
    return this.run(actor, async (q, scope) => {
      const rows = await q(`SELECT ${USER_COLUMNS} FROM app_users WHERE deleted_at IS NOT NULL AND ($1::integer IS NULL OR school_id = $1) ORDER BY purge_at`, [scope]);
      return rows.map((r) => {
        const u = toUser(r);
        return { ...toPublic(u), days_left: daysLeft(u.purge_at) };
      });
    });
  }

  async restore(actor: UserRow, id: number) {
    return this.run(actor, async (q, scope) => {
      const u = await this.userInScope(q, scope, id);
      this.canManage(actor, u);
      if (!u.deleted_at) throw new BadRequestException('Tài khoản không ở thùng rác');
      await q('UPDATE app_users SET deleted_at = NULL, purge_at = NULL, is_active = 1, token_version = token_version + 1 WHERE id = $1', [id]);
      return toPublic({ ...u, deleted_at: null, purge_at: null, is_active: true });
    });
  }

  /** Xóa vĩnh viễn ngay (không chờ 45 ngày) */
  async purgeNow(actor: UserRow, id: number): Promise<void> {
    await this.run(actor, async (q, scope) => {
      const u = await this.userInScope(q, scope, id);
      this.canManage(actor, u);
      if (!u.deleted_at) throw new BadRequestException('Chỉ xóa vĩnh viễn được tài khoản đã ở thùng rác');
    });
    await this.db.deleteUser(id);
  }

  /** Mỗi ngày 00:00 (giờ Việt Nam): xóa hẳn tài khoản đã ở thùng rác quá 45 ngày */
  @Cron('0 0 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async purgeExpired(): Promise<number> {
    if (!this.db.ready) return 0;
    const due = await this.db.query<{ id: number }>('SELECT id FROM app_users WHERE purge_at IS NOT NULL AND purge_at <= now()');
    for (const { id } of due) await this.db.deleteUser(id);
    if (due.length) this.logger.log(`Đã xóa vĩnh viễn ${due.length} tài khoản hết hạn thùng rác`);
    return due.length;
  }

  // ------------------------------------------------------------------ nhập file Excel mẫu
  /**
   * Kiểm tra file (đuôi, MIME, chữ ký ZIP) → dịch vụ Python kiểm chữ ký HMAC, cấu trúc cột, chuẩn hóa dòng, sinh tên đăng nhập/mật khẩu
   * → mỗi trường một giao dịch (khóa theo trường, RLS): dòng đủ thông tin cấp tài khoản + xếp thư vào hàng đợi; dòng thiếu ghi nhật ký.
   * Dòng vừa được bổ sung (khớp nhật ký thiếu bằng mã/email hoặc vector) là "delta": chỉ những tài khoản này được gửi thư riêng.
   */
  async importExcel(actor: UserRow, file: UploadedXlsx | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('Chưa chọn file Excel');
    if (file.size > MAX_FILE_BYTES) throw new UnprocessableEntityException('File quá lớn (tối đa 2 MB)');
    if (!/\.xlsx$/i.test(file.originalname)) throw new UnprocessableEntityException('Chỉ nhận file .xlsx tải từ trang chủ (không nhận .xls, .csv)');
    if (!ACCEPTED_MIMES.includes(file.mimetype)) throw new UnprocessableEntityException(`Định dạng ${file.mimetype || 'không rõ'} không phải file Excel .xlsx`);
    if (file.buffer.subarray(0, 4).toString('hex') !== '504b0304') throw new UnprocessableEntityException('Nội dung không phải file .xlsx chuẩn');
    if (actor.role !== 'root_admin' && !actor.school_id) throw new ForbiddenException('Tài khoản chưa được gán trường');

    const checked = await this.ai.excelValidate(file.buffer.toString('base64'), file.originalname, file.mimetype);
    if (!checked.ok) throw new UnprocessableEntityException(checked.errors.join('\n') || 'File không hợp lệ');
    if (checked.rows.length > MAX_ROWS) throw new UnprocessableEntityException(`Mỗi lần nhập tối đa ${MAX_ROWS} dòng`);
    if (!checked.rows.length) throw new UnprocessableEntityException('File chưa có dòng dữ liệu nào');

    // Gom dòng theo trường; quản trị trường, giáo viên chỉ nhập cho trường mình
    const results: RowResult[] = [];
    const groups = new Map<number, ExcelRow[]>();
    const own = actor.role === 'root_admin' ? null : await this.db.query<SchoolRow>('SELECT id, school_code, name, region, city FROM app_schools WHERE id = $1', [actor.school_id]);
    const fail = (r: ExcelRow, message: string) =>
      results.push({ row: r.row, full_name: r.values.full_name, role: r.values.role === 'GV' ? 'teacher' : r.values.role === 'HS' ? 'student' : null, school_code: r.values.school_code, status: 'error', message });
    for (const r of checked.rows) {
      let schoolId: number;
      if (own) {
        if (r.values.school_code && r.values.school_code !== own[0].school_code) {
          fail(r, `Dòng thuộc trường mã ${r.values.school_code}, không phải trường của bạn (${own[0].school_code})`);
          continue;
        }
        if (actor.role === 'teacher' && r.values.role === 'GV') {
          fail(r, 'Giáo viên chỉ nhập được tài khoản học sinh; tài khoản giáo viên do quản trị trường cấp');
          continue;
        }
        schoolId = own[0].id;
      } else {
        if (!r.values.school_code) {
          fail(r, 'Thiếu Mã số trường – không xác định được trường');
          continue;
        }
        schoolId = await this.ensureSchool(r);
      }
      groups.set(schoolId, [...(groups.get(schoolId) ?? []), r]);
    }

    // Băm trước mật khẩu mặc định (tốn CPU) ngoài giao dịch
    const hashes = new Map<number, string>();
    const complete = checked.rows.filter((r) => r.complete && r.credentials);
    for (let i = 0; i < complete.length; i += 16) {
      const chunk = complete.slice(i, i + 16);
      const done = await Promise.all(chunk.map((r) => hashPassword(r.credentials!.password, TEMP_ITERATIONS)));
      chunk.forEach((r, k) => hashes.set(r.row, done[k]));
    }

    // Quản trị trường, giáo viên: một lượt nhập = một bản báo cáo gồm cả các dòng bị loại ở bước phạm vi
    const preErrors = own ? results.splice(0) : [];
    if (own && !groups.has(own[0].id)) groups.set(own[0].id, []);
    const batches: Array<{ id: number; school_id: number; school_code: string; school_name: string }> = [];
    let queued = 0;
    for (const [schoolId, rows] of groups) {
      const out = await this.db.scoped(schoolId, (q) => this.importForSchool(q, actor, schoolId, rows, hashes, file.originalname, checked.template_id, own ? preErrors : []));
      batches.push(out.batch);
      results.push(...out.results);
      queued += out.queued;
    }
    results.sort((a, b) => a.row - b.row);
    const totals = { total: checked.rows.length, created: 0, delta: 0, existing: 0, incomplete: 0, error: 0 } as Record<'total' | RowStatus, number>;
    for (const r of results) totals[r.status] += 1;
    if (queued) this.mail.kick();
    return { batches, totals, rows: results, emails_queued: queued, smtp: this.mail.configured };
  }

  /** Quản trị tổng nhập dòng của trường chưa có: tạo trường từ cột Trường, Khu vực, Thành phố */
  private async ensureSchool(r: ExcelRow): Promise<number> {
    const found = await this.db.query<{ id: number }>('SELECT id FROM app_schools WHERE school_code = $1', [r.values.school_code]);
    if (found.length) return found[0].id;
    const rows = await this.db.query<{ id: number }>(
      'INSERT INTO app_schools (school_code, name, region, city) VALUES ($1, $2, $3, $4) ON CONFLICT (school_code) DO UPDATE SET name = app_schools.name RETURNING id',
      [r.values.school_code, r.values.school_name || `Trường ${r.values.school_code}`, r.values.region || null, r.values.city || null],
    );
    return rows[0].id;
  }

  private async importForSchool(q: Q, actor: UserRow, schoolId: number, rows: ExcelRow[], hashes: Map<number, string>, fileName: string, templateId: string | null, preErrors: RowResult[]) {
    // Hai lượt nhập cùng trường chạy tuần tự (số thứ tự tên đăng nhập không trùng)
    await q('SELECT pg_advisory_xact_lock(hashtext($1))', [`dong-a-provision:${schoolId}`]);
    const school = await this.schoolById(q, schoolId);
    const batchId = Number(
      (await q<{ id: number }>('INSERT INTO app_import_batches (school_id, uploaded_by, file_name, template_id, total_rows) VALUES ($1, $2, $3, $4, $5) RETURNING id', [
        schoolId, actor.id, fileName.slice(0, 200), templateId, rows.length + preErrors.length,
      ]))[0].id,
    );

    // Truy xuất: ứng viên trong nhật ký dòng thiếu (khớp chính xác + gần nhất theo vector) → Python quyết định dòng nào bổ sung cho dòng nào
    const candidates = await this.candidates(q, schoolId, rows);
    const decisions = new Map<number, MatchDecision>();
    const withCandidates = rows.filter((r) => (candidates.get(r.row) ?? []).length);
    for (const d of await this.ai.provisionMatch(withCandidates.map((r) => ({ row: r.row, values: r.values, embedding: r.embedding, candidates: candidates.get(r.row)! })))) decisions.set(d.row, d);

    const codes = rows.map((r) => r.values.user_code).filter(Boolean);
    const emails = rows.map((r) => r.values.email.toLowerCase()).filter(Boolean);
    const existing = await q<{ id: number; user_code: string | null; email: string | null; username: string; deleted_at: Date | null }>(
      'SELECT id, user_code, email, username, deleted_at FROM app_users WHERE school_id = $1 AND (user_code = ANY($2::text[]) OR lower(email) = ANY($3::text[]))',
      [schoolId, codes, emails],
    );
    const seenCodes = new Set<string>();
    const seenEmails = new Set<string>();
    const seq = new Map<string, number>();
    const usedLogs = new Set<number>();
    const results: RowResult[] = [...preErrors];
    let queued = 0;

    for (const r of rows) {
      const v = r.values;
      const role = v.role === 'GV' ? 'teacher' : v.role === 'HS' ? 'student' : null;
      const base: RowResult = { row: r.row, full_name: v.full_name, role, school_code: v.school_code || school.school_code, status: 'error' };
      const email = v.email.toLowerCase();
      if ((v.user_code && seenCodes.has(v.user_code)) || (email && seenEmails.has(email))) {
        results.push({ ...base, message: 'Trùng mã người dùng hoặc email với một dòng phía trên trong file' });
        continue;
      }
      if (v.user_code) seenCodes.add(v.user_code);
      if (email) seenEmails.add(email);
      const match = existing.find((e) => (v.user_code && e.user_code === v.user_code) || (email && e.email?.toLowerCase() === email));
      if (match) {
        results.push({ ...base, status: 'existing', username: match.username, message: match.deleted_at ? 'Tài khoản đang ở thùng rác' : 'Đã có tài khoản – không gửi lại' });
        continue;
      }
      const decision = decisions.get(r.row);
      const logId = decision?.log_id && !usedLogs.has(decision.log_id) ? decision.log_id : null;
      if (logId) usedLogs.add(logId);

      if (!r.complete || !r.credentials || !role) {
        const missing = [...new Set([...r.missing, ...r.invalid.map((x) => x.field)])];
        const rowData = { ...v, invalid: r.invalid };
        const embedding = r.embedding?.length ? r.embedding : null;
        if (logId) {
          await q(
            `UPDATE app_incomplete_import_logs SET batch_id = $2, row_number = $3, user_code = $4, email = $5, full_name = $6, school_code = $7,
               missing_fields = $8, row_data = $9, embedding = $10, updated_at = now() WHERE id = $1 AND school_id = $11`,
            [logId, batchId, r.row, v.user_code || null, email || null, v.full_name || null, v.school_code || school.school_code, missing, JSON.stringify(rowData), embedding, schoolId],
          );
        } else {
          await q(
            `INSERT INTO app_incomplete_import_logs (school_id, batch_id, row_number, user_code, email, full_name, school_code, missing_fields, row_data, embedding)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [schoolId, batchId, r.row, v.user_code || null, email || null, v.full_name || null, v.school_code || school.school_code, missing, JSON.stringify(rowData), embedding],
          );
        }
        results.push({ ...base, status: 'incomplete', missing, message: r.invalid.map((x) => `${x.field}: ${x.message}`).join('; ') || undefined });
        continue;
      }

      // Dòng đủ thông tin: tên đăng nhập = phần đầu do Python sinh + 3 số thứ tự theo trường/khối + @miền
      const prefix = r.credentials.username_prefix;
      const group = prefix.split('.').pop()!;
      let username = '';
      for (let tries = 0; tries < 50; tries++) {
        const n = await this.nextSeq(q, group, seq);
        username = `${prefix}${String(n).padStart(3, '0')}@${config.accountDomain}`;
        if (!(await q('SELECT 1 FROM app_users WHERE username = $1', [username])).length) break;
      }
      const user = await this.db.createUser(
        {
          username, full_name: v.full_name, role, class_name: null, password_hash: hashes.get(r.row)!, must_change_password: true,
          school_id: schoolId, user_code: v.user_code, school_code: school.school_code, region: v.region, city: v.city,
          birth_date: v.birth_date, school_year: v.school_year, email, grade: v.grade,
        },
        q,
      );
      if (logId) await q('UPDATE app_incomplete_import_logs SET resolved_at = now(), resolved_user_id = $2, batch_id = $3 WHERE id = $1 AND school_id = $4', [logId, user.id, batchId, schoolId]);
      const kind = logId ? 'delta' : 'bulk';
      await this.mail.enqueue(q, {
        school_id: schoolId, user_id: user.id, batch_id: batchId, kind, to: email,
        subject: `Tài khoản Đông A EDU của ${v.full_name}${kind === 'delta' ? ' (bổ sung)' : ''}`,
        payload: { type: 'account', full_name: v.full_name, username, password: r.credentials.password, role, school: school.name },
      });
      queued += 1;
      results.push({ ...base, status: kind === 'delta' ? 'delta' : 'created', username, message: logId ? `Bổ sung cho dòng thiếu trước đây (${decision?.reason ?? 'khớp'})` : undefined });
    }

    results.sort((a, b) => a.row - b.row);
    const count = (s: RowStatus) => results.filter((x) => x.status === s).length;
    await q(
      `UPDATE app_import_batches SET created_count = $2, delta_count = $3, existing_count = $4, incomplete_count = $5, error_count = $6, report = $7 WHERE id = $1`,
      [batchId, count('created'), count('delta'), count('existing'), count('incomplete'), count('error'), JSON.stringify(results)],
    );
    return { batch: { id: batchId, school_id: schoolId, school_code: school.school_code, school_name: school.name }, results, queued };
  }

  /** Số thứ tự kế tiếp (3 chữ số) của nhóm năm học + mã trường + mã khối niên khóa */
  private async nextSeq(q: Q, group: string, cache: Map<string, number>): Promise<number> {
    if (!cache.has(group)) {
      const rows = await q<{ max: number | null }>(
        "SELECT max(substring(username from '\\.' || $1 || '(\\d{3})@')::int) AS max FROM app_users WHERE username ~ ('\\.' || $1 || '\\d{3}@')",
        [group],
      );
      cache.set(group, Number(rows[0]?.max ?? 0));
    }
    const next = cache.get(group)! + 1;
    cache.set(group, next);
    if (next > 999) throw new UnprocessableEntityException('Nhóm năm học/trường/khối đã đủ 999 tài khoản');
    return next;
  }

  /** Ứng viên cho từng dòng: khớp chính xác mã người dùng/email, cộng 3 dòng thiếu gần nhất theo vector (pgvector hoặc cosine) */
  private async candidates(q: Q, schoolId: number, rows: ExcelRow[]): Promise<Map<number, MatchCandidate[]>> {
    const open = await q<MatchCandidate>(
      'SELECT id, user_code, email, full_name, school_code, row_data, embedding FROM app_incomplete_import_logs WHERE school_id = $1 AND resolved_at IS NULL',
      [schoolId],
    );
    const out = new Map<number, MatchCandidate[]>();
    if (!open.length) return out;
    const byId = new Map(open.map((c) => [c.id, c]));
    for (const r of rows) {
      const picked = new Set<number>();
      const email = r.values.email.toLowerCase();
      for (const c of open) if ((r.values.user_code && c.user_code === r.values.user_code) || (email && c.email === email)) picked.add(c.id);
      if (r.embedding?.length) {
        let near: number[] | null = null;
        if (this.db.vectorSchema) {
          const s = ident(this.db.vectorSchema);
          try {
            await q('SAVEPOINT near_vec');
            near = (
              await q<{ id: number }>(
                `SELECT id FROM app_incomplete_import_logs WHERE school_id = $1 AND resolved_at IS NULL AND embedding_vec IS NOT NULL
                 ORDER BY embedding_vec OPERATOR(${s}.<=>) $2::${s}.vector LIMIT 3`,
                [schoolId, `[${r.embedding.join(',')}]`],
              )
            ).map((x) => x.id);
            await q('RELEASE SAVEPOINT near_vec');
          } catch {
            await q('ROLLBACK TO SAVEPOINT near_vec');
            near = null;
          }
        }
        near ??= open
          .filter((c) => c.embedding?.length)
          .map((c) => ({ id: c.id, s: cosine(r.embedding, c.embedding!) }))
          .sort((a, b) => b.s - a.s)
          .slice(0, 3)
          .map((x) => x.id);
        near.forEach((id) => picked.add(id));
      }
      if (picked.size) out.set(r.row, [...picked].map((id) => byId.get(id)!).filter(Boolean));
    }
    return out;
  }

  async imports(actor: UserRow) {
    return this.run(actor, (q, scope) =>
      q(
        `SELECT b.id, b.school_id, s.school_code, s.name AS school_name, b.file_name, b.total_rows, b.created_count, b.delta_count, b.existing_count,
                b.incomplete_count, b.error_count, b.created_at, u.full_name AS uploaded_by
         FROM app_import_batches b JOIN app_schools s ON s.id = b.school_id LEFT JOIN app_users u ON u.id = b.uploaded_by
         WHERE ($1::integer IS NULL OR b.school_id = $1) AND ($2::integer IS NULL OR b.uploaded_by = $2)
         ORDER BY b.created_at DESC LIMIT 30`,
        [scope, actor.role === 'teacher' ? actor.id : null],
      ),
    );
  }

  async importReport(actor: UserRow, id: number) {
    return this.run(actor, async (q, scope) => {
      const rows = await q('SELECT id, school_id, file_name, report, created_at FROM app_import_batches WHERE id = $1 AND ($2::integer IS NULL OR school_id = $2)', [id, scope]);
      if (!rows.length) throw new NotFoundException('Không tìm thấy lượt nhập');
      return rows[0];
    });
  }

  async incomplete(actor: UserRow) {
    return this.run(actor, (q, scope) =>
      q(
        `SELECT l.id, l.school_id, s.school_code, l.row_number, l.user_code, l.email, l.full_name, l.missing_fields, l.batch_id, l.created_at, l.updated_at
         FROM app_incomplete_import_logs l JOIN app_schools s ON s.id = l.school_id
         WHERE l.resolved_at IS NULL AND ($1::integer IS NULL OR l.school_id = $1) ORDER BY l.updated_at DESC LIMIT 300`,
        [scope],
      ),
    );
  }

  // ------------------------------------------------------------------ hàng đợi email
  async outbox(actor: UserRow) {
    return this.run(actor, async (q, scope) => ({
      smtp: this.mail.configured,
      worker: this.mail.workerEnabled,
      test_recipient: actor.role === 'root_admin' ? this.mail.testRecipient : null,
      items: await q(
        `SELECT o.id, o.kind, o.to_email, o.subject, o.status, o.attempts, o.last_error, o.created_at, o.sent_at, u.full_name, u.username
         FROM app_email_outbox o LEFT JOIN app_users u ON u.id = o.user_id
         WHERE ($1::integer IS NULL OR o.school_id = $1) ORDER BY o.id DESC LIMIT 200`,
        [scope],
      ),
    }));
  }

  async retryFailed(actor: UserRow) {
    return this.run(actor, async (q, scope) => {
      const rows = await q("UPDATE app_email_outbox SET status = 'queued', next_attempt_at = now(), attempts = 0 WHERE status = 'failed' AND body_encrypted IS NOT NULL AND ($1::integer IS NULL OR school_id = $1) RETURNING id", [scope]);
      return { requeued: rows.length };
    });
  }

  /** Danh sách tài khoản chưa gửi được (giải mã), để in hoặc phát tay khi chưa cấu hình SMTP */
  async pendingCredentialsCsv(actor: UserRow, batchId?: number): Promise<string> {
    const rows = await this.run(actor, (q, scope) =>
      q<{ body_encrypted: string | null; to_email: string; status: string }>(
        "SELECT body_encrypted, to_email, status FROM app_email_outbox WHERE status IN ('queued', 'failed', 'sending') AND kind IN ('bulk', 'delta') AND ($1::integer IS NULL OR school_id = $1) AND ($2::integer IS NULL OR batch_id = $2) ORDER BY id",
        [scope, batchId ?? null],
      ),
    );
    const cell = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = ['Họ và tên,Vai trò,Tên đăng nhập,Mật khẩu mặc định,Email'];
    for (const r of rows) {
      const p = this.mail.decrypt(r.body_encrypted);
      if (p?.type === 'account') lines.push([p.full_name, p.role === 'teacher' ? 'GV' : 'HS', p.username, p.password, r.to_email].map(cell).join(','));
    }
    return `﻿${lines.join('\r\n')}\r\n`;
  }

  // ------------------------------------------------------------------ lớp học: giáo viên → quản trị duyệt → học sinh
  async createClass(teacher: UserRow, body: { class_code: string; school_year: string; name: string; join_password: string }) {
    const code = body.class_code.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9._-]{1,19}$/.test(code)) throw new UnprocessableEntityException('Mã lớp gồm 2–20 chữ in hoa, số, dấu chấm, gạch');
    if (!validSchoolYear(body.school_year)) throw new UnprocessableEntityException('Năm học có dạng 2025-2026');
    const hash = await hashPassword(body.join_password);
    return this.run(teacher, async (q, scope) => {
      const dup = await q('SELECT 1 FROM app_classes WHERE school_id = $1 AND school_year = $2 AND class_code = $3', [scope, body.school_year.trim(), code]);
      if (dup.length) throw new ConflictException(`Lớp ${code} năm học ${body.school_year} đã có`);
      const row = (
        await q(
          `INSERT INTO app_classes (school_id, teacher_id, class_code, school_year, name, join_password_hash) VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, class_code, school_year, name, status, created_at`,
          [scope, teacher.id, code, body.school_year.trim(), body.name.trim(), hash],
        )
      )[0];
      const admins = await q<{ id: number }>("SELECT id FROM app_users WHERE school_id = $1 AND role = 'school_admin' AND deleted_at IS NULL", [scope]);
      for (const a of admins) await this.notify(q, a.id, scope!, 'class_request', 'Yêu cầu mở lớp mới', `${teacher.full_name} xin mở lớp "${body.name.trim()}" (mã ${code}, năm học ${body.school_year}).`);
      return row;
    });
  }

  async teacherClasses(teacher: UserRow) {
    return this.run(teacher, (q) =>
      q(
        `SELECT c.id, c.class_code, c.school_year, c.name, c.status, c.review_note, c.reviewed_at, c.created_at,
                (SELECT COUNT(*) FROM app_class_members m WHERE m.class_id = c.id)::int AS members
         FROM app_classes c WHERE c.teacher_id = $1 ORDER BY c.created_at DESC`,
        [teacher.id],
      ),
    );
  }

  /** Chọn lớp đang dạy (bảng theo dõi, thi đấu cả lớp dùng lớp này) */
  async activateClass(teacher: UserRow, id: number) {
    const cls = await this.run(teacher, async (q) => {
      const rows = await q<{ class_code: string; status: string }>('SELECT class_code, status FROM app_classes WHERE id = $1 AND teacher_id = $2', [id, teacher.id]);
      if (!rows.length) throw new NotFoundException('Không tìm thấy lớp');
      if (rows[0].status !== 'APPROVED') throw new BadRequestException('Lớp chưa được duyệt');
      return rows[0];
    });
    return toPublic((await this.db.updateUser(teacher.id, { class_name: cls.class_code }))!);
  }

  async adminClasses(actor: UserRow, status?: string) {
    return this.run(actor, (q, scope) =>
      q(
        `SELECT c.id, c.school_id, s.school_code, s.name AS school_name, c.class_code, c.school_year, c.name, c.status, c.review_note, c.reviewed_at, c.created_at,
                u.full_name AS teacher_name, u.username AS teacher_username, (SELECT COUNT(*) FROM app_class_members m WHERE m.class_id = c.id)::int AS members
         FROM app_classes c JOIN app_users u ON u.id = c.teacher_id JOIN app_schools s ON s.id = c.school_id
         WHERE ($1::integer IS NULL OR c.school_id = $1) AND ($2::text IS NULL OR c.status = $2)
         ORDER BY (c.status = 'PENDING') DESC, c.created_at DESC LIMIT 200`,
        [scope, status ?? null],
      ),
    );
  }

  /** Duyệt hoặc từ chối: thông báo trong app + email cho giáo viên */
  async reviewClass(actor: UserRow, id: number, approve: boolean, note: string | null) {
    return this.run(actor, async (q, scope) => {
      const rows = await q<{ id: number; school_id: number; teacher_id: number; class_code: string; school_year: string; name: string; status: string }>(
        'SELECT id, school_id, teacher_id, class_code, school_year, name, status FROM app_classes WHERE id = $1 AND ($2::integer IS NULL OR school_id = $2)',
        [id, scope],
      );
      if (!rows.length) throw new NotFoundException('Không tìm thấy yêu cầu mở lớp');
      const c = rows[0];
      if (c.status !== 'PENDING') throw new BadRequestException('Yêu cầu này đã được xử lý');
      const status = approve ? 'APPROVED' : 'REJECTED';
      await q('UPDATE app_classes SET status = $2, review_note = $3, reviewed_by = $4, reviewed_at = now() WHERE id = $1', [id, status, note?.trim() || null, actor.id]);
      const teacher = toUser((await q(`SELECT ${USER_COLUMNS} FROM app_users WHERE id = $1`, [c.teacher_id]))[0]);
      if (approve && !teacher.class_name) await q('UPDATE app_users SET class_name = $2 WHERE id = $1', [teacher.id, c.class_code]);
      await this.notify(
        q, teacher.id, c.school_id, approve ? 'class_approved' : 'class_rejected',
        approve ? `Lớp ${c.class_code} đã được duyệt` : `Lớp ${c.class_code} chưa được duyệt`,
        approve ? `"${c.name}" (năm học ${c.school_year}) đã mở. Hãy gửi mã lớp và mật khẩu lớp cho học sinh.` : `"${c.name}" – lý do: ${note?.trim() || 'quản trị chưa ghi chú'}.`,
      );
      if (teacher.email) {
        await this.mail.enqueue(q, {
          school_id: c.school_id, user_id: teacher.id, batch_id: null, kind: 'class', to: teacher.email,
          subject: approve ? `Lớp ${c.class_code} đã được duyệt` : `Yêu cầu mở lớp ${c.class_code} chưa được duyệt`,
          payload: { type: 'class', full_name: teacher.full_name, class_name: c.name, class_code: c.class_code, school_year: c.school_year, approved: approve, note: note?.trim() || null },
        });
      }
      return { id, status };
    });
  }

  /** Học sinh vào lớp đã duyệt của trường mình bằng mã lớp + mật khẩu lớp */
  async joinClass(student: UserRow, classCode: string, password: string) {
    const code = classCode.trim().toUpperCase();
    return this.run(student, async (q, scope) => {
      const rows = await q<{ id: number; class_code: string; name: string; school_year: string; join_password_hash: string; teacher_id: number }>(
        "SELECT id, class_code, name, school_year, join_password_hash, teacher_id FROM app_classes WHERE school_id = $1 AND class_code = $2 AND status = 'APPROVED' ORDER BY school_year DESC LIMIT 1",
        [scope, code],
      );
      if (!rows.length || !(await verifyPassword(password, rows[0].join_password_hash))) throw new BadRequestException('Sai mã lớp hoặc mật khẩu lớp');
      const c = rows[0];
      await q('INSERT INTO app_class_members (class_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [c.id, student.id]);
      await q('UPDATE app_users SET class_name = $2 WHERE id = $1', [student.id, c.class_code]);
      await this.notify(q, c.teacher_id, scope!, 'class_join', `Học sinh mới vào lớp ${c.class_code}`, `${student.full_name} vừa vào "${c.name}".`);
      return { id: c.id, class_code: c.class_code, name: c.name, school_year: c.school_year };
    });
  }

  async studentClasses(student: UserRow) {
    return this.run(student, (q) =>
      q(
        `SELECT c.id, c.class_code, c.name, c.school_year, u.full_name AS teacher_name, m.joined_at
         FROM app_class_members m JOIN app_classes c ON c.id = m.class_id JOIN app_users u ON u.id = c.teacher_id
         WHERE m.user_id = $1 ORDER BY m.joined_at DESC`,
        [student.id],
      ),
    );
  }

  // ------------------------------------------------------------------ thông báo
  private async notify(q: Q, userId: number, schoolId: number, kind: string, title: string, body: string): Promise<void> {
    await q('INSERT INTO app_notifications (user_id, school_id, kind, title, body) VALUES ($1, $2, $3, $4, $5)', [userId, schoolId, kind, title, body]);
  }

  async notifications(user: UserRow) {
    const rows = await this.db.query('SELECT id, kind, title, body, read_at, created_at FROM app_notifications WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 30', [user.id]);
    return { unread: rows.filter((r) => !r.read_at).length, items: rows };
  }

  async markRead(user: UserRow, ids: number[] | null): Promise<void> {
    await this.db.query('UPDATE app_notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL AND ($2::int[] IS NULL OR id = ANY($2::int[]))', [user.id, ids]);
  }
}
