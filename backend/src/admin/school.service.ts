/**
 * Trường, năm học và khối lớp (HK.AD.011–017, HK.QT.010–013).
 * Quản trị tổng: toàn hệ thống (thêm trường kèm quản trị viên đầu tiên, bật/tắt, xóa khi trống). Quản trị trường: chỉ trường trong token;
 * truy vấn chạy trong db.scoped(school_id) nên Row-Level Security chặn dữ liệu trường khác kể cả khi quên điều kiện WHERE.
 */
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { toPublic } from '../auth/auth.service';
import { generatePassword, hashPassword } from '../auth/passwords';
import { DatabaseService, DuplicateUsername, Q, UserRow } from '../database/database.service';
import { MailService } from './mail.service';

export const GRADES = [6, 7, 8, 9] as const;
export const likeEscape = (s: string) => s.replace(/[\\%_]/g, (ch) => `\\${ch}`);

export interface SchoolRow {
  id: number;
  school_code: string;
  name: string;
  region: string | null;
  city: string | null;
  address: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface YearRow { id: number; school_id: number; label: string; starts_on: string; ends_on: string; status: 'planned' | 'active' | 'ended'; ended_at: string | null }

/** Mã trường chuẩn hóa 4 chữ số: chỉ giữ chữ số, lấy 4 số cuối, thêm 0 phía trước */
export const normCode = (code: string | null | undefined): string => {
  const digits = String(code ?? '').replace(/\D/g, '');
  return digits ? digits.slice(-4).padStart(4, '0') : '';
};

const trimOrNull = (v: unknown): string | null => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') || null : null);

@Injectable()
export class SchoolService {
  constructor(
    private readonly db: DatabaseService,
    private readonly mail: MailService,
  ) {}

  /** Quản trị tổng: toàn hệ thống; quản trị trường: chỉ trường của mình (Row-Level Security) */
  run<T>(user: UserRow, fn: (q: Q, scope: number | null) => Promise<T>): Promise<T> {
    if (user.role === 'root_admin') return this.db.tx((q) => fn(q, null));
    if (!user.school_id) throw new ForbiddenException('Tài khoản chưa được gán trường – liên hệ quản trị tổng');
    return this.db.scoped(user.school_id, (q) => fn(q, user.school_id));
  }

  /** Trường mà thao tác nhắm tới: quản trị trường luôn là trường của mình; quản trị tổng phải chỉ rõ school_id */
  target(actor: UserRow, schoolId?: number | null): number {
    if (actor.role === 'school_admin') {
      if (!actor.school_id) throw new ForbiddenException('Tài khoản chưa được gán trường');
      if (schoolId && schoolId !== actor.school_id) throw new ForbiddenException('Chỉ thao tác được trên trường của bạn');
      return actor.school_id;
    }
    if (!schoolId) throw new UnprocessableEntityException('Hãy chọn trường (school_id)');
    return schoolId;
  }

  /** Quản trị tổng cấp 2 không được thay đổi hệ thống ở mức quản trị tổng (HK.AD.020/026) */
  assertTopAdmin(actor: UserRow): void {
    if (actor.role === 'root_admin' && actor.admin_level !== 1) throw new ForbiddenException('Chỉ quản trị tổng cấp 1 được thực hiện thao tác này');
  }

  // ------------------------------------------------------------------ trường (quản trị tổng)
  async list(f: { q?: string; city?: string; region?: string; active?: 'true' | 'false'; page?: number; limit?: number }) {
    const where: string[] = [], params: unknown[] = [];
    const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
    if (f.q?.trim()) add("(s.name || ' ' || s.school_code) ILIKE ? ESCAPE '\\'", `%${likeEscape(f.q.trim())}%`);
    if (f.city) add('s.city = ?', f.city);
    if (f.region) add('s.region = ?', f.region);
    if (f.active) add('s.is_active = ?', f.active === 'true');
    const condition = where.length ? where.join(' AND ') : 'TRUE';
    const page = f.page ?? 1, limit = f.limit ?? 30;
    const total = Number((await this.db.query<{ n: string }>(`SELECT count(*) AS n FROM app_schools s WHERE ${condition}`, params))[0].n);
    const items = await this.db.query(
      `SELECT s.*,
        (SELECT count(*)::int FROM app_users u WHERE u.school_id = s.id AND u.deleted_at IS NULL) AS users,
        (SELECT count(*)::int FROM app_users u WHERE u.school_id = s.id AND u.role = 'school_admin' AND u.deleted_at IS NULL) AS admins,
        (SELECT count(*)::int FROM app_users u WHERE u.school_id = s.id AND u.role = 'teacher' AND u.deleted_at IS NULL) AS teachers,
        (SELECT count(*)::int FROM app_users u WHERE u.school_id = s.id AND u.role = 'student' AND u.deleted_at IS NULL) AS students,
        (SELECT count(*)::int FROM app_classes c WHERE c.school_id = s.id) AS classes
       FROM app_schools s WHERE ${condition} ORDER BY s.name, s.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    );
    const places = await this.db.query<{ city: string | null; region: string | null }>('SELECT DISTINCT city, region FROM app_schools');
    const uniq = (v: Array<string | null>) => [...new Set(v.filter((x): x is string => !!x))].sort();
    return { items, total, page, limit, facets: { cities: uniq(places.map((x) => x.city)), regions: uniq(places.map((x) => x.region)) } };
  }

  async detail(actor: UserRow, id: number) {
    return this.run(actor, async (q, scope) => {
      const school = (await q<SchoolRow>('SELECT * FROM app_schools WHERE id = $1 AND ($2::integer IS NULL OR id = $2)', [id, scope]))[0];
      if (!school) throw new NotFoundException('Không tìm thấy trường');
      const counts = (await q<Record<string, number>>(
        `SELECT count(*) FILTER (WHERE role = 'school_admin')::int AS admins, count(*) FILTER (WHERE role = 'teacher')::int AS teachers, count(*) FILTER (WHERE role = 'student')::int AS students
         FROM app_users WHERE school_id = $1 AND deleted_at IS NULL`, [id]))[0];
      const classes = (await q<{ n: number }>('SELECT count(*)::int AS n FROM app_classes WHERE school_id = $1', [id]))[0].n;
      const admins = (await q('SELECT id, username, full_name, email, phone, is_active, last_login_at FROM app_users WHERE school_id = $1 AND role = \'school_admin\' AND deleted_at IS NULL ORDER BY full_name', [id]));
      const year = (await q<YearRow>("SELECT * FROM app_school_years WHERE school_id = $1 AND status = 'active'", [id]))[0] ?? null;
      return { ...school, counts: { ...counts, classes }, admins, current_year: year };
    });
  }

  /** Thêm trường kèm tài khoản quản trị viên trường đầu tiên và thư cấp mật khẩu tạm (HK.AD.013) */
  async create(actor: UserRow, body: {
    school_code: string; name: string; region?: string | null; city?: string | null; address?: string | null; contact_name?: string | null; contact_email?: string | null; contact_phone?: string | null;
    admin: { full_name: string; email: string; phone?: string | null };
  }) {
    this.assertTopAdmin(actor);
    const code = normCode(body.school_code);
    if (!code) throw new UnprocessableEntityException('Mã số trường cần có chữ số');
    const email = body.admin.email.trim().toLowerCase();
    const password = generatePassword();
    const passwordHash = await hashPassword(password);
    return this.db.tx(async (q) => {
      if ((await q('SELECT 1 FROM app_schools WHERE school_code = $1', [code])).length) throw new ConflictException(`Mã trường ${code} đã có trong hệ thống`);
      if ((await q('SELECT 1 FROM app_users WHERE lower(email) = $1 AND deleted_at IS NULL', [email])).length) throw new ConflictException('Email quản trị viên đã được dùng cho một tài khoản khác');
      const school = (await q<SchoolRow>(
        `INSERT INTO app_schools (school_code, name, region, city, address, contact_name, contact_email, contact_phone) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [code, trimOrNull(body.name), trimOrNull(body.region), trimOrNull(body.city), trimOrNull(body.address), trimOrNull(body.contact_name), trimOrNull(body.contact_email)?.toLowerCase() ?? null, trimOrNull(body.contact_phone)],
      ))[0];
      const username = await this.db.uniqueUsername(body.admin.full_name, 'school_admin', q);
      let admin: UserRow;
      try {
        admin = await this.db.createUser({
          username, full_name: body.admin.full_name, role: 'school_admin', class_name: null, password_hash: passwordHash, must_change_password: true,
          school_id: school.id, school_code: school.school_code, region: school.region, city: school.city, email, phone: trimOrNull(body.admin.phone),
        }, q);
      } catch (exc) {
        if (exc instanceof DuplicateUsername) throw new ConflictException('Tên đăng nhập của quản trị viên bị trùng, thử lại');
        throw exc;
      }
      await this.mail.enqueue(q, {
        school_id: school.id, user_id: admin.id, batch_id: null, kind: 'bulk', to: email, subject: '[Đông A EDU] Kích hoạt tài khoản quản trị viên trường học',
        payload: { type: 'account', full_name: admin.full_name, username, password, role: 'school_admin', school: school.name },
      });
      return { school, admin: toPublic(admin), temporary_password: password, mail: this.mail.configured ? 'queued' : 'not_configured' };
    }).then((result) => { this.mail.kick(); return result; });
  }

  async update(id: number, body: { name?: string; region?: string | null; city?: string | null; address?: string | null; contact_name?: string | null; contact_email?: string | null; contact_phone?: string | null; logo_url?: string | null; is_active?: boolean }) {
    return this.db.tx(async (q) => {
      const old = (await q<SchoolRow>('SELECT * FROM app_schools WHERE id = $1 FOR UPDATE', [id]))[0];
      if (!old) throw new NotFoundException('Không tìm thấy trường');
      const entries = Object.entries(body).filter(([k, v]) => ['name', 'region', 'city', 'address', 'contact_name', 'contact_email', 'contact_phone', 'logo_url', 'is_active'].includes(k) && v !== undefined);
      if (entries.length) {
        const values = entries.map(([k, v]) => (typeof v === 'string' ? (k === 'contact_email' ? v.trim().toLowerCase() : v.trim().replace(/\s+/g, ' ')) || null : v));
        await q(`UPDATE app_schools SET ${entries.map(([k], i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [id, ...values]);
        // Vô hiệu hóa/kích hoạt lại trường: thu hồi mọi phiên đăng nhập của tài khoản thuộc trường
        if (body.is_active !== undefined && body.is_active !== old.is_active) await q('UPDATE app_users SET token_version = token_version + 1 WHERE school_id = $1', [id]);
        if (body.region !== undefined || body.city !== undefined) await q('UPDATE app_users SET region = s.region, city = s.city FROM app_schools s WHERE app_users.school_id = s.id AND s.id = $1', [id]);
      }
      return (await q<SchoolRow>('SELECT * FROM app_schools WHERE id = $1', [id]))[0];
    });
  }

  /** Xóa trường chưa phát sinh dữ liệu (HK.AD.016): không lớp, không giáo viên/học sinh, quản trị viên chưa từng đăng nhập hay thao tác */
  async remove(actor: UserRow, id: number): Promise<void> {
    this.assertTopAdmin(actor);
    await this.db.tx(async (q) => {
      const school = (await q<SchoolRow>('SELECT * FROM app_schools WHERE id = $1 FOR UPDATE', [id]))[0];
      if (!school) throw new NotFoundException('Không tìm thấy trường');
      const r = (await q<{ classes: number; members: number; used_admins: number; years: number }>(
        `SELECT (SELECT count(*)::int FROM app_classes WHERE school_id = $1) AS classes,
                (SELECT count(*)::int FROM app_users WHERE school_id = $1 AND role IN ('teacher', 'student')) AS members,
                (SELECT count(*)::int FROM app_users u WHERE u.school_id = $1 AND u.role = 'school_admin' AND (u.last_login_at IS NOT NULL OR EXISTS (SELECT 1 FROM app_audit_events a WHERE a.actor_id = u.id))) AS used_admins,
                (SELECT count(*)::int FROM app_school_years WHERE school_id = $1 AND status <> 'planned') AS years`, [id]))[0];
      const reasons = [
        r.classes && `${r.classes} lớp`, r.members && `${r.members} giáo viên/học sinh`, r.used_admins && `${r.used_admins} quản trị viên đã sử dụng hệ thống`, r.years && `${r.years} năm học đã kích hoạt`,
      ].filter(Boolean);
      if (reasons.length) throw new ConflictException(`Trường đã phát sinh dữ liệu (${reasons.join(', ')}); chỉ có thể vô hiệu hóa trường.`);
      await q("DELETE FROM app_users WHERE school_id = $1 AND role = 'school_admin'", [id]);
      await q('DELETE FROM app_schools WHERE id = $1', [id]);
    });
  }

  // ------------------------------------------------------------------ thông tin trường của quản trị viên trường học (HK.QT.010–011)
  async mine(actor: UserRow) {
    return this.detail(actor, this.target(actor));
  }

  async updateMine(actor: UserRow, schoolId: number | null | undefined, body: { name?: string; address?: string | null; contact_name?: string | null; contact_email?: string | null; contact_phone?: string | null; logo_url?: string | null }) {
    const id = this.target(actor, schoolId);
    const { name, address, contact_name, contact_email, contact_phone, logo_url } = body;
    await this.update(id, { name, address, contact_name, contact_email, contact_phone, logo_url });
    return this.detail(actor, id);
  }

  // ------------------------------------------------------------------ năm học (HK.QT.012)
  async years(actor: UserRow, schoolId?: number | null) {
    const id = this.target(actor, schoolId);
    return this.run(actor, async (q) => q<YearRow & { classes: number }>(
      `SELECT y.*, (SELECT count(*)::int FROM app_classes c WHERE c.year_id = y.id) AS classes FROM app_school_years y WHERE y.school_id = $1 ORDER BY y.label DESC`, [id]));
  }

  private validYear(label: string, starts_on: string, ends_on: string): void {
    const m = /^(\d{4})-(\d{4})$/.exec(label);
    if (!m || Number(m[2]) !== Number(m[1]) + 1) throw new UnprocessableEntityException('Năm học có dạng 2026-2027 (hai năm liên tiếp)');
    if (!(starts_on < ends_on)) throw new UnprocessableEntityException('Ngày bắt đầu phải trước ngày kết thúc');
  }

  async createYear(actor: UserRow, body: { school_id?: number | null; label: string; starts_on: string; ends_on: string }) {
    const schoolId = this.target(actor, body.school_id);
    const label = body.label.trim();
    this.validYear(label, body.starts_on, body.ends_on);
    return this.run(actor, async (q) => {
      if ((await q('SELECT 1 FROM app_school_years WHERE school_id = $1 AND label = $2', [schoolId, label])).length) throw new ConflictException(`Năm học ${label} đã có`);
      const year = (await q<YearRow>('INSERT INTO app_school_years (school_id, label, starts_on, ends_on, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *', [schoolId, label, body.starts_on, body.ends_on, actor.id]))[0];
      // Khối của năm mới chép từ năm gần nhất của trường (hoặc bật cả bốn khối 6–9 nếu là năm đầu tiên); quản trị viên chỉnh lại ở mục khối lớp
      const previous = await q<{ grade: number; is_active: boolean }>(
        `SELECT grade, is_active FROM app_school_grades WHERE school_id = $1 AND school_year = (SELECT max(school_year) FROM app_school_grades WHERE school_id = $1 AND school_year < $2)`, [schoolId, label]);
      const grades = previous.length ? previous : GRADES.map((grade) => ({ grade, is_active: true }));
      for (const g of grades) await q('INSERT INTO app_school_grades (school_id, school_year, grade, is_active, created_by) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING', [schoolId, label, g.grade, g.is_active, actor.id]);
      return year;
    });
  }

  private async yearOf(q: Q, actor: UserRow, id: number, lock = true): Promise<YearRow> {
    const scope = actor.role === 'school_admin' ? actor.school_id : null;
    const year = (await q<YearRow>(`SELECT * FROM app_school_years WHERE id = $1 AND ($2::integer IS NULL OR school_id = $2)${lock ? ' FOR UPDATE' : ''}`, [id, scope]))[0];
    if (!year) throw new NotFoundException('Không tìm thấy năm học');
    return year;
  }

  async updateYear(actor: UserRow, id: number, body: { label?: string; starts_on?: string; ends_on?: string }) {
    return this.run(actor, async (q) => {
      const year = await this.yearOf(q, actor, id);
      if (year.status === 'ended') throw new ConflictException('Năm học đã kết thúc, không sửa được');
      const label = body.label?.trim() ?? year.label, starts_on = body.starts_on ?? year.starts_on, ends_on = body.ends_on ?? year.ends_on;
      this.validYear(label, starts_on, ends_on);
      if (label !== year.label) {
        const used = (await q<{ n: number }>('SELECT (SELECT count(*) FROM app_classes WHERE year_id = $1)::int AS n', [id]))[0].n;
        if (used) throw new ConflictException('Năm học đã có lớp nên không đổi được tên; chỉ sửa được ngày bắt đầu và kết thúc');
        if ((await q('SELECT 1 FROM app_school_years WHERE school_id = $1 AND label = $2 AND id <> $3', [year.school_id, label, id])).length) throw new ConflictException(`Năm học ${label} đã có`);
        await q('UPDATE app_school_grades SET school_year = $3 WHERE school_id = $1 AND school_year = $2', [year.school_id, year.label, label]);
      }
      return (await q<YearRow>('UPDATE app_school_years SET label = $2, starts_on = $3, ends_on = $4, updated_at = now() WHERE id = $1 RETURNING *', [id, label, starts_on, ends_on]))[0];
    });
  }

  /** Kích hoạt năm học (mỗi trường chỉ một năm đang hoạt động; phải kết thúc năm đang hoạt động trước) */
  async activateYear(actor: UserRow, id: number) {
    return this.run(actor, async (q) => {
      const year = await this.yearOf(q, actor, id);
      if (year.status === 'ended') throw new ConflictException('Năm học đã kết thúc, không kích hoạt lại được');
      if (year.status === 'active') return year;
      const other = (await q<{ label: string }>("SELECT label FROM app_school_years WHERE school_id = $1 AND status = 'active'", [year.school_id]))[0];
      if (other) throw new ConflictException(`Năm học ${other.label} đang hoạt động. Hãy kết thúc năm học đó trước khi kích hoạt năm mới.`);
      return (await q<YearRow>("UPDATE app_school_years SET status = 'active', updated_at = now() WHERE id = $1 RETURNING *", [id]))[0];
    });
  }

  /** Kết thúc năm học: từ đó dữ liệu của năm học (lớp, học sinh trong lớp) không sửa được nữa */
  async endYear(actor: UserRow, id: number) {
    return this.run(actor, async (q) => {
      const year = await this.yearOf(q, actor, id);
      if (year.status !== 'active') throw new ConflictException(year.status === 'ended' ? 'Năm học đã kết thúc' : 'Chỉ kết thúc được năm học đang hoạt động');
      return (await q<YearRow>("UPDATE app_school_years SET status = 'ended', ended_at = now(), updated_at = now() WHERE id = $1 RETURNING *", [id]))[0];
    });
  }

  /** Dùng chung cho lớp, học sinh: năm học đã kết thúc không cho ghi thêm */
  async assertYearOpen(q: Q, yearId: number | null): Promise<void> {
    if (!yearId) return;
    const status = (await q<{ status: string }>('SELECT status FROM app_school_years WHERE id = $1', [yearId]))[0]?.status;
    if (status === 'ended') throw new ConflictException('Năm học đã kết thúc, không sửa được dữ liệu của năm học này');
  }

  // ------------------------------------------------------------------ khối lớp (HK.QT.013)
  async grades(actor: UserRow, yearId: number, schoolId?: number | null) {
    return this.run(actor, async (q) => {
      const year = await this.yearOf(q, actor, yearId, false);
      if (schoolId && year.school_id !== schoolId) throw new NotFoundException('Không tìm thấy năm học');
      const rows = await q<{ grade: number; is_active: boolean; classes: number; students: number }>(
        `SELECT g.grade, g.is_active,
           (SELECT count(*)::int FROM app_classes c WHERE c.year_id = $3 AND c.grade = g.grade) AS classes,
           (SELECT count(DISTINCT m.user_id)::int FROM app_class_members m JOIN app_classes c ON c.id = m.class_id WHERE c.year_id = $3 AND c.grade = g.grade) AS students
         FROM app_school_grades g WHERE g.school_id = $1 AND g.school_year = $2 ORDER BY g.grade`, [year.school_id, year.label, yearId]);
      return { year, grades: rows };
    });
  }

  async setGrade(actor: UserRow, body: { year_id: number; grade: number; is_active: boolean }) {
    return this.run(actor, async (q) => {
      const year = await this.yearOf(q, actor, body.year_id);
      if (year.status === 'ended') throw new ConflictException('Năm học đã kết thúc, không sửa được khối lớp');
      if (!(GRADES as readonly number[]).includes(body.grade)) throw new BadRequestException('Khối lớp từ 6 đến 9');
      if (!body.is_active) {
        const open = (await q<{ n: number }>('SELECT count(*)::int AS n FROM app_classes WHERE year_id = $1 AND grade = $2 AND is_active', [year.id, body.grade]))[0].n;
        if (open) throw new ConflictException(`Khối ${body.grade} còn ${open} lớp đang hoạt động; hãy lưu trữ các lớp trước khi tắt khối.`);
      }
      await q(
        `INSERT INTO app_school_grades (school_id, school_year, grade, is_active, created_by) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (school_id, school_year, grade) DO UPDATE SET is_active = EXCLUDED.is_active, updated_at = now()`,
        [year.school_id, year.label, body.grade, body.is_active, actor.id]);
      return { year_id: year.id, grade: body.grade, is_active: body.is_active };
    });
  }

  async removeGrade(actor: UserRow, yearId: number, grade: number): Promise<void> {
    await this.run(actor, async (q) => {
      const year = await this.yearOf(q, actor, yearId);
      if (year.status === 'ended') throw new ConflictException('Năm học đã kết thúc, không sửa được khối lớp');
      const classes = (await q<{ n: number }>('SELECT count(*)::int AS n FROM app_classes WHERE year_id = $1 AND grade = $2', [year.id, grade]))[0].n;
      if (classes) throw new ConflictException(`Khối ${grade} đã có ${classes} lớp; chỉ xóa được khối chưa có lớp.`);
      const done = await q('DELETE FROM app_school_grades WHERE school_id = $1 AND school_year = $2 AND grade = $3 RETURNING grade', [year.school_id, year.label, grade]);
      if (!done.length) throw new NotFoundException('Khối chưa được thêm vào năm học này');
    });
  }
}
