import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { Pool, PoolClient, types } from 'pg';
import { config } from '../config';
import { baseUsername, hashPassword } from '../auth/passwords';
import { applyMigrations, MigrationError, pgConfig } from './migrator';

// Cột DATE (ngày sinh, ngày năm học) giữ dạng chuỗi YYYY-MM-DD, không đổi theo múi giờ máy chủ
types.setTypeParser(1082, (v: string) => v);

/** root_admin: quản trị tổng (/admin); school_admin: quản trị một trường (/school-manager-admin) */
export type Role = 'root_admin' | 'school_admin' | 'teacher' | 'student';

export interface UserRow {
  id: number;
  username: string;
  full_name: string;
  role: Role;
  class_name: string | null;
  password_hash: string;
  token_version: number;
  must_change_password: boolean;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  school_id: number | null;
  user_code: string | null;
  school_code: string | null;
  region: string | null;
  city: string | null;
  birth_date: string | null;
  school_year: string | null;
  email: string | null;
  grade: number | null;
  deleted_at: string | null;
  purge_at: string | null;
  phone: string | null;
  avatar_url: string | null;
  bio: string | null;
  nickname: string | null;
  gender: 'male' | 'female' | 'other' | null;
  subject: string | null;
  parent_email: string | null;
  lock_reason: string | null;
  locked_at: string | null;
  admin_level: 1 | 2;
  profile_confirmed_at: string | null;
  self_registered: boolean;
}

/** Hồ sơ khi tạo tài khoản (đều tùy chọn) */
export interface UserProfile {
  school_id?: number | null;
  user_code?: string | null;
  school_code?: string | null;
  region?: string | null;
  city?: string | null;
  birth_date?: string | null;
  school_year?: string | null;
  email?: string | null;
  grade?: number | null;
  phone?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  subject?: string | null;
  parent_email?: string | null;
  nickname?: string | null;
  admin_level?: 1 | 2;
  self_registered?: boolean;
  profile_confirmed_at?: string | null;
}

export class DuplicateUsername extends Error {}

/** Truy vấn trong một giao dịch (phạm vi một trường hoặc quyền đầy đủ) */
export type Q = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

export const USER_COLUMNS =
  'id, username, full_name, role, class_name, password_hash, must_change_password, is_active, created_at, last_login_at, ' +
  'school_id, user_code, school_code, region, city, birth_date, school_year, email, grade, deleted_at, purge_at, token_version, phone, avatar_url, bio, nickname, gender, subject, parent_email, ' +
  'lock_reason, locked_at, admin_level, profile_confirmed_at, self_registered';
const PROFILE_FIELDS = [
  'school_id', 'user_code', 'school_code', 'region', 'city', 'birth_date', 'school_year', 'email', 'grade',
  'phone', 'gender', 'subject', 'parent_email', 'nickname', 'admin_level', 'self_registered', 'profile_confirmed_at',
] as const;
/** Cột cho phép sửa qua updateUser */
const UPDATABLE = ['full_name', 'class_name', 'is_active', 'email', 'grade', 'phone', 'subject', 'gender', 'birth_date', 'parent_email', 'user_code', 'nickname'] as const;

export const nowIso = (): string => new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');

const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : null);

/** Một dòng app_users -> tài khoản (cột số nguyên 0/1 thành boolean, mốc thời gian thành chuỗi ISO) */
export const toUser = (row: Record<string, unknown>): UserRow => ({
  ...(row as unknown as UserRow),
  must_change_password: Boolean(row.must_change_password),
  is_active: Boolean(row.is_active),
  grade: row.grade === null || row.grade === undefined ? null : Number(row.grade),
  deleted_at: iso(row.deleted_at),
  purge_at: iso(row.purge_at),
  locked_at: iso(row.locked_at),
  profile_confirmed_at: iso(row.profile_confirmed_at),
  admin_level: Number(row.admin_level ?? 1) === 2 ? 2 : 1,
  self_registered: Boolean(row.self_registered),
});

/** Chuỗi tìm kiếm không dấu, chữ thường (đánh chỉ mục trigram cho tìm kiếm tức thời) */
export const searchText = (...parts: Array<string | number | null | undefined>): string =>
  parts
    .filter((p) => p !== null && p !== undefined && p !== '')
    .join(' ')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Kho dữ liệu PostgreSQL: tài khoản, trường, năm học, lớp, kho lịch sử, hàng đợi email. */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Database');
  private pool: Pool | null = null;
  ready = false;
  /** Vai trò dong_a_school_scope dùng được: truy vấn của một trường chịu Row-Level Security */
  rlsReady = false;

  async onModuleInit(): Promise<void> {
    if (!config.databaseUrl) {
      this.logger.error('Chưa cấu hình DATABASE_URL – các API cần tài khoản sẽ trả lỗi 503');
      return;
    }
    // Không phục vụ bản phát hành mới trên một CSDL migration lỗi hoặc dở dang
    const applied = await applyMigrations(config.databaseUrl, config.migrationsDir);
    this.logger.log(`Migration sẵn sàng: ${applied.length} file mới`);
    this.pool = new Pool({ ...pgConfig(config.databaseUrl), max: 10 });
    this.pool.on('error', () => this.logger.error('Mất kết nối PostgreSQL (chi tiết kết nối đã ẩn)'));
    await this.ensureAdmin();
    await this.detectFeatures();
    await this.backfillSearchText();
    this.ready = true;
  }

  async onModuleDestroy(): Promise<void> {
    this.ready = false;
    await this.pool?.end().catch(() => undefined);
    this.pool = null;
  }

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (!this.pool) throw new ServiceUnavailableException('Kho tài khoản chưa sẵn sàng. Kiểm tra cấu hình cơ sở dữ liệu.');
    return (await this.pool.query(sql, params)).rows as T[];
  }

  private async transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) throw new ServiceUnavailableException('Kho tài khoản chưa sẵn sàng. Kiểm tra cấu hình cơ sở dữ liệu.');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await run(client);
      await client.query('COMMIT');
      return result;
    } catch (exc) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw exc;
    } finally {
      client.release();
    }
  }

  /**
   * Chạy truy vấn của một trường trong một giao dịch: vai trò dong_a_school_scope + app.school_id (Row-Level Security),
   * nên kể cả khi một truy vấn thiếu điều kiện WHERE cũng không chạm được dữ liệu trường khác. Truy vấn vẫn lọc school_id.
   */
  async scoped<T>(schoolId: number, run: (q: Q) => Promise<T>): Promise<T> {
    return this.transaction(async (c) => {
      if (this.rlsReady) await c.query('SET LOCAL ROLE dong_a_school_scope');
      await c.query("SELECT set_config('app.school_id', $1, true)", [String(schoolId)]);
      return run(async <R = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await c.query(sql, params)).rows as R[]);
    });
  }

  /** Giao dịch với quyền đầy đủ (quản trị tổng, tiến trình nền) */
  async tx<T>(run: (q: Q) => Promise<T>): Promise<T> {
    return this.transaction((c) => run(async <R = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await c.query(sql, params)).rows as R[]));
  }

  async ping(): Promise<boolean> {
    const rows = await this.query<{ ok: number }>('SELECT 1 AS ok');
    return rows[0]?.ok === 1;
  }

  /** RLS theo trường có bật được hay không (migration bỏ qua phần CSDL không cho phép) */
  private async detectFeatures(): Promise<void> {
    try {
      await this.transaction(async (c) => {
        await c.query('SET LOCAL ROLE dong_a_school_scope');
      });
      this.rlsReady = true;
    } catch {
      this.rlsReady = false;
      this.logger.warn('Chưa bật được RLS theo trường – truy vấn vẫn lọc theo school_id');
    }
  }

  /** Tài khoản tạo trước migration 006 chưa có chuỗi tìm kiếm */
  private async backfillSearchText(): Promise<void> {
    const rows = await this.query<{ id: number; full_name: string; username: string; user_code: string | null; email: string | null; class_name: string | null }>(
      "SELECT id, full_name, username, user_code, email, class_name FROM app_users WHERE search_text = ''",
    );
    for (const r of rows) await this.query('UPDATE app_users SET search_text = $1 WHERE id = $2', [searchText(r.full_name, r.username, r.user_code, r.email, r.class_name), r.id]);
  }

  private async ensureAdmin(): Promise<void> {
    const existing = await this.query<{ id: number; email: string | null; full_name: string; username: string }>(
      "SELECT id, email, full_name, username FROM app_users WHERE role = 'root_admin' ORDER BY id LIMIT 1",
    );
    if (existing.length) {
      // "Quên mật khẩu" gửi thư tới email của tài khoản: điền ADMIN_EMAIL cho quản trị tổng chưa có email, không ghi đè email đã có
      const [admin] = existing;
      if (config.adminEmail && !admin.email) {
        await this.query('UPDATE app_users SET email = $1, search_text = $2 WHERE id = $3', [config.adminEmail, searchText(admin.full_name, admin.username, config.adminEmail), admin.id]);
      }
      return;
    }
    await this.createUser({
      username: config.adminUsername,
      full_name: 'Quản trị tổng Đông A',
      role: 'root_admin',
      class_name: null,
      password_hash: await hashPassword(config.adminPassword),
      must_change_password: false,
      email: config.adminEmail || null,
      profile_confirmed_at: nowIso(),
    });
    this.logger.warn(`Đã tạo tài khoản quản trị tổng '${config.adminUsername}' (đăng nhập tại trang /admin). Nên đổi mật khẩu mặc định khi triển khai thật.`);
  }

  // ------------------------------------------------------------------ tài khoản
  async getById(id: number, q: Q = (sql, params) => this.query(sql, params)): Promise<UserRow | null> {
    const rows = await q(`SELECT ${USER_COLUMNS} FROM app_users WHERE id = $1`, [id]);
    return rows.length ? toUser(rows[0]) : null;
  }

  /**
   * Đăng nhập bằng tên đăng nhập, email hoặc mã người dùng (mã học sinh). Tên đăng nhập khớp chính xác được ưu tiên (kể cả tài khoản trong
   * thùng rác để báo đúng lý do); email/mã chỉ nhận khi khớp đúng một tài khoản còn dùng được, tránh đăng nhập nhầm khi mã trùng giữa các trường.
   */
  async findForLogin(identifier: string): Promise<UserRow | null> {
    const key = identifier.trim().toLowerCase();
    const rows = (await this.query(
      `SELECT ${USER_COLUMNS} FROM app_users WHERE username = $1 OR (deleted_at IS NULL AND (lower(email) = $1 OR lower(user_code) = $1))`,
      [key],
    )).map(toUser);
    return rows.find((u) => u.username === key) ?? (rows.length === 1 ? rows[0] : null);
  }

  /** Đăng nhập Google (HK.HS.002): email Google phải trùng đúng một tài khoản còn dùng được */
  async findByEmail(email: string): Promise<UserRow | null> {
    const rows = (await this.query(`SELECT ${USER_COLUMNS} FROM app_users WHERE deleted_at IS NULL AND lower(email) = $1`, [email.trim().toLowerCase()])).map(toUser);
    return rows.length === 1 ? rows[0] : null;
  }

  async schoolActive(schoolId: number | null, q: Q = (sql, params) => this.query(sql, params)): Promise<boolean> {
    return schoolId === null || (await q('SELECT 1 FROM app_schools WHERE id = $1 AND is_active', [schoolId])).length > 0;
  }

  async getByUsername(username: string, q: Q = (sql, params) => this.query(sql, params)): Promise<UserRow | null> {
    const rows = await q(`SELECT ${USER_COLUMNS} FROM app_users WHERE username = $1`, [username.trim().toLowerCase()]);
    return rows.length ? toUser(rows[0]) : null;
  }

  /** Tên đăng nhập kiểu cũ cho tài khoản tạo tay (gv.long.nv, long.nv; quản trị trường: qt.long.nv) */
  async uniqueUsername(fullName: string, role: Role, q: Q = (sql, params) => this.query(sql, params)): Promise<string> {
    const base = role === 'school_admin' ? `qt.${baseUsername(fullName, 'student')}` : role === 'root_admin' ? `ad.${baseUsername(fullName, 'student')}` : baseUsername(fullName, role);
    let candidate = base;
    for (let n = 2; await this.getByUsername(candidate, q); n += 1) candidate = `${base}${n}`;
    return candidate;
  }

  async createUser(
    u: { username: string; full_name: string; role: Role; class_name: string | null; password_hash: string; must_change_password: boolean } & UserProfile,
    q: Q = (sql, params) => this.query(sql, params),
  ): Promise<UserRow> {
    const username = u.username.trim().toLowerCase();
    if ((await q('SELECT 1 FROM app_users WHERE username = $1', [username])).length) throw new DuplicateUsername(username);
    const profile = PROFILE_FIELDS.map((f) => {
      const value = u[f];
      return value === undefined || value === '' ? (f === 'admin_level' ? 1 : f === 'self_registered' ? false : null) : value;
    });
    const rows = await q<Record<string, unknown>>(
      `INSERT INTO app_users (username, full_name, role, class_name, password_hash, must_change_password, is_active, created_at, search_text, ${PROFILE_FIELDS.join(', ')})
       VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8, ${PROFILE_FIELDS.map((_, i) => `$${i + 9}`).join(', ')}) RETURNING ${USER_COLUMNS}`,
      [
        username, u.full_name.trim(), u.role, u.class_name?.trim() || null, u.password_hash, u.must_change_password ? 1 : 0, nowIso(),
        searchText(u.full_name, username, u.user_code, u.email, u.class_name), ...profile,
      ],
    );
    return toUser(rows[0]);
  }

  async updateUser(id: number, fields: Partial<Record<(typeof UPDATABLE)[number], string | number | boolean | null>>, q: Q = (sql, params) => this.query(sql, params)): Promise<UserRow | null> {
    const allowed = Object.entries(fields).filter(([k, v]) => (UPDATABLE as readonly string[]).includes(k) && v !== undefined);
    if (allowed.length) {
      const sets = allowed.map(([k], i) => `${k} = $${i + 1}`);
      const active = allowed.findIndex(([k]) => k === 'is_active');
      if (active >= 0) sets.push(`token_version = token_version + CASE WHEN is_active <> $${active + 1} THEN 1 ELSE 0 END`);
      const values = allowed.map(([k, v]) => (k === 'is_active' ? (v ? 1 : 0) : v));
      await q(`UPDATE app_users SET ${sets.join(', ')} WHERE id = $${allowed.length + 1}`, [...values, id]);
      const u = await this.getById(id, q);
      if (u) await q('UPDATE app_users SET search_text = $1 WHERE id = $2', [searchText(u.full_name, u.username, u.user_code, u.email, u.class_name), id]);
    }
    return this.getById(id, q);
  }

  /** Khóa/mở khóa kèm lý do (HK.AD.023, HK.QT.019/030); khóa thu hồi mọi phiên đăng nhập */
  async setLocked(id: number, locked: boolean, reason: string | null, by: number, q: Q = (sql, params) => this.query(sql, params)): Promise<void> {
    await q(
      `UPDATE app_users SET is_active = $2, lock_reason = $3, locked_at = CASE WHEN $4 THEN now() ELSE NULL END, locked_by = CASE WHEN $4 THEN $5::integer ELSE NULL END,
         token_version = token_version + 1 WHERE id = $1`,
      [id, locked ? 0 : 1, locked ? reason : null, locked, by],
    );
  }

  async setPassword(id: number, passwordHash: string, mustChange: boolean, q: Q = (sql, params) => this.query(sql, params)): Promise<void> {
    await q('UPDATE app_users SET password_hash = $1, must_change_password = $2, token_version = token_version + 1 WHERE id = $3', [passwordHash, mustChange ? 1 : 0, id]);
  }

  async touchLogin(id: number): Promise<void> {
    await this.query('UPDATE app_users SET last_login_at = $1 WHERE id = $2', [nowIso(), id]);
  }

  /**
   * Tài khoản đã "phát sinh dữ liệu"? Đã đăng nhập, có tiến độ học, đã thực hiện thao tác (nhật ký), hoặc là giáo viên được phân công lớp.
   * Dùng cho các chức năng "chỉ xóa khi chưa phát sinh dữ liệu" (HK.AD.025, HK.QT.021, HK.QT.032).
   */
  async accountHasData(id: number, q: Q = (sql, params) => this.query(sql, params)): Promise<string | null> {
    const rows = await q<{ logged_in: boolean; learned: boolean; acted: boolean; teaching: boolean }>(
      `SELECT (u.last_login_at IS NOT NULL) AS logged_in,
              EXISTS (SELECT 1 FROM app_progress p WHERE p.user_id = u.id AND (p.xp > 0 OR p.questions_answered > 0 OR p.lessons_completed > 0)) AS learned,
              EXISTS (SELECT 1 FROM app_audit_events a WHERE a.actor_id = u.id) AS acted,
              (EXISTS (SELECT 1 FROM app_class_teachers t WHERE t.teacher_id = u.id) OR EXISTS (SELECT 1 FROM app_classes c WHERE c.teacher_id = u.id)) AS teaching
       FROM app_users u WHERE u.id = $1`,
      [id],
    );
    const r = rows[0];
    if (!r) return null;
    if (r.teaching) return 'đang được phân công phụ trách lớp';
    if (r.learned) return 'đã có dữ liệu học tập';
    if (r.logged_in) return 'đã từng đăng nhập';
    if (r.acted) return 'đã có thao tác trong nhật ký';
    return null;
  }

  // ------------------------------------------------------------------ quên mật khẩu
  /** Tài khoản còn hoạt động, có email và đúng vai trò của trang; tìm theo tên đăng nhập, hoặc theo email nếu chỉ một tài khoản dùng email đó */
  async findForPasswordReset(identifier: string, roles: Role[]): Promise<UserRow | null> {
    const key = identifier.trim().toLowerCase();
    const rows = await this.query(
      `SELECT ${USER_COLUMNS} FROM app_users
       WHERE (username = $1 OR lower(email) = $1 OR lower(user_code) = $1) AND role = ANY($2) AND is_active = 1 AND deleted_at IS NULL AND email IS NOT NULL`,
      [key, roles],
    );
    const users = rows.map(toUser);
    return users.find((u) => u.username === key) ?? (users.length === 1 ? users[0] : null);
  }

  /** Lưu băm của mã đặt lại; mã chưa dùng trước đó của tài khoản hết hiệu lực, mã quá hạn từ hơn một ngày bị dọn */
  async createPasswordReset(userId: number, tokenHash: string, ttlMinutes: number): Promise<void> {
    await this.tx(async (q) => {
      await q("DELETE FROM app_password_resets WHERE expires_at < now() - interval '1 day'");
      await q('UPDATE app_password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [userId]);
      await q("INSERT INTO app_password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, now() + ($3 || ' minutes')::interval)", [userId, tokenHash, String(ttlMinutes)]);
    });
  }

  /**
   * Kiểm tra mã OTP quên mật khẩu: lấy mã mới nhất còn hạn và chưa dùng của tài khoản. Sai thì tăng số lần thử (quá 5 lần mã bị vô hiệu,
   * vì OTP 6 chữ số dễ bị dò); đúng thì đánh dấu đã dùng. Trả về đúng/sai, không nêu lý do.
   */
  async consumePasswordOtp(userId: number, tokenHash: string): Promise<boolean> {
    return this.transaction(async (c) => {
      const row = (await c.query('SELECT id, token_hash, attempts FROM app_password_resets WHERE user_id = $1 AND used_at IS NULL AND expires_at > now() ORDER BY id DESC LIMIT 1 FOR UPDATE', [userId])).rows[0];
      if (!row || Number(row.attempts) >= 5) return false;
      if (row.token_hash !== tokenHash) {
        await c.query('UPDATE app_password_resets SET attempts = attempts + 1 WHERE id = $1', [row.id]);
        return false;
      }
      await c.query('UPDATE app_password_resets SET used_at = now() WHERE id = $1', [row.id]);
      return true;
    });
  }

  /** OTP đăng ký tự học (HK.HS.003): cùng cách kiểm tra như quên mật khẩu nhưng theo email, chưa có tài khoản */
  async createSignupOtp(email: string, otpHash: string, ttlMinutes: number): Promise<void> {
    await this.tx(async (q) => {
      await q("DELETE FROM app_signup_otps WHERE expires_at < now() - interval '1 day'");
      await q('UPDATE app_signup_otps SET used_at = now() WHERE lower(email) = $1 AND used_at IS NULL', [email]);
      await q("INSERT INTO app_signup_otps (email, otp_hash, expires_at) VALUES ($1, $2, now() + ($3 || ' minutes')::interval)", [email, otpHash, String(ttlMinutes)]);
    });
  }

  async consumeSignupOtp(email: string, otpHash: string, q?: Q): Promise<boolean> {
    const run = async (c: Q): Promise<boolean> => {
      const row = (await c('SELECT id, otp_hash, attempts FROM app_signup_otps WHERE lower(email) = $1 AND used_at IS NULL AND expires_at > now() ORDER BY id DESC LIMIT 1 FOR UPDATE', [email]))[0] as { id: number; otp_hash: string; attempts: number } | undefined;
      if (!row || Number(row.attempts) >= 5) return false;
      if (row.otp_hash !== otpHash) {
        await c('UPDATE app_signup_otps SET attempts = attempts + 1 WHERE id = $1', [row.id]);
        return false;
      }
      await c('UPDATE app_signup_otps SET used_at = now() WHERE id = $1', [row.id]);
      return true;
    };
    return q ? run(q) : this.tx(run);
  }

  /**
   * Xóa hẳn tài khoản (các bảng liên quan tự xóa theo khóa ngoại ON DELETE CASCADE/SET NULL). Tài khoản có tiến độ học không bao giờ tới đây
   * (accountHasData chặn); dòng tiến độ rỗng nếu có thì để lại vì mã tài khoản không được dùng lại và vai trò theo trường không được xóa bảng này.
   */
  async deleteUser(id: number, q: Q = (sql, params) => this.query(sql, params)): Promise<void> {
    await q('DELETE FROM app_users WHERE id = $1', [id]);
  }
}

export { MigrationError };
