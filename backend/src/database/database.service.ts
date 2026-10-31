import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { Pool, PoolClient, types } from 'pg';
import { config } from '../config';
import { baseUsername, hashPassword } from '../auth/passwords';
import { applyMigrations, MigrationError, pgConfig } from './migrator';

// Cột DATE (ngày sinh) giữ dạng chuỗi YYYY-MM-DD, không đổi theo múi giờ máy chủ
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
}

/** Hồ sơ theo file Excel mẫu (khi tạo tài khoản) */
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
}

/** Một dòng app_progress (tiến độ học tập thật của học sinh) */
export interface Progress {
  user_id: number;
  xp: number;
  gems: number;
  streak: number;
  lessons_completed: number;
  perfect_runs: number;
  questions_answered: number;
  questions_correct: number;
  ai_questions: number;
  day_xp: number;
  day_lessons: number;
  day_correct: number;
  day_ai_questions: number;
  day_gems: number;
  week_xp: number;
  last_active_date: string | null;
  day_key: string | null;
  pig_state: string | null;
  bkt_state: string | null;
  game_state: string | null;
  question_stats: string | null;
  week_key: string | null;
  freeze_week: string | null;
  updated_at: string | null;
}

export interface LiveSessionInput {
  teacher_id: number;
  class_name: string | null;
  title: string;
  scope: string;
  question_count: number;
  question_stats: string;
  started_at: string;
  finished_at: string;
}

export interface LiveResultInput {
  user_id: number;
  rank: number;
  score: number;
  correct: number;
  answered: number;
}

export interface LiveSessionRow {
  id: number;
  class_name: string | null;
  title: string;
  scope: string;
  question_count: number;
  player_count: number;
  question_stats: string | null;
  started_at: string;
  finished_at: string;
  results: Array<{ session_id: number; user_id: number; full_name: string; rank: number; score: number; correct: number; answered: number }>;
}

export class DuplicateUsername extends Error {}

/** Truy vấn trong một giao dịch (phạm vi một trường hoặc quyền đầy đủ) */
export type Q = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

export const USER_COLUMNS =
  'id, username, full_name, role, class_name, password_hash, must_change_password, is_active, created_at, last_login_at, ' +
  'school_id, user_code, school_code, region, city, birth_date, school_year, email, grade, deleted_at, purge_at, token_version';
const PROFILE_FIELDS = ['school_id', 'user_code', 'school_code', 'region', 'city', 'birth_date', 'school_year', 'email', 'grade'] as const;
const PROGRESS_INT_FIELDS = [
  'xp', 'gems', 'streak', 'lessons_completed', 'perfect_runs', 'questions_answered', 'questions_correct',
  'ai_questions', 'day_xp', 'day_lessons', 'day_correct', 'day_ai_questions', 'day_gems', 'week_xp',
];
const PROGRESS_TEXT_FIELDS = ['last_active_date', 'day_key', 'pig_state', 'bkt_state', 'game_state', 'question_stats', 'week_key', 'freeze_week'];
const PROGRESS_FIELDS = [...PROGRESS_INT_FIELDS, ...PROGRESS_TEXT_FIELDS];
const PROGRESS_COLUMNS = `user_id, ${PROGRESS_FIELDS.join(', ')}, updated_at`;
/** Bản gọn cho bảng xếp hạng, trang quản trị: bỏ các cột JSON lớn */
const PROGRESS_LIGHT_COLUMNS = `user_id, ${[...PROGRESS_INT_FIELDS, 'last_active_date', 'day_key', 'week_key', 'freeze_week'].join(', ')}, updated_at`;

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

/** Kho dữ liệu PostgreSQL: tài khoản, tiến độ, lịch sử thi đấu, trường, lớp, nhập Excel, hàng đợi email. */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Database');
  private pool: Pool | null = null;
  ready = false;
  /** Vai trò dong_a_school_scope dùng được: truy vấn của một trường chịu Row-Level Security */
  rlsReady = false;
  /** Schema của tiện ích pgvector khi CSDL có (Supabase); null thì tính cosine trong ứng dụng */
  vectorSchema: string | null = null;

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

  /** RLS theo trường và pgvector có bật được hay không (migration bỏ qua phần CSDL không cho phép) */
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
    const vec = await this.query<{ schema: string }>(
      `SELECT n.nspname AS schema FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
       WHERE e.extname = 'vector' AND EXISTS (
         SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'app_incomplete_import_logs' AND column_name = 'embedding_vec')`,
    );
    this.vectorSchema = vec[0]?.schema ?? null;
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
    });
    this.logger.warn(`Đã tạo tài khoản quản trị tổng '${config.adminUsername}' (đăng nhập tại trang /admin). Nên đổi mật khẩu mặc định khi triển khai thật.`);
  }

  // ------------------------------------------------------------------ tài khoản
  async getById(id: number, q: Q = (sql, params) => this.query(sql, params)): Promise<UserRow | null> {
    const rows = await q(`SELECT ${USER_COLUMNS} FROM app_users WHERE id = $1`, [id]);
    return rows.length ? toUser(rows[0]) : null;
  }

  async schoolActive(schoolId:number|null,q:Q=this.query.bind(this)):Promise<boolean> {
    return schoolId === null || (await q('SELECT 1 FROM app_schools WHERE id=$1 AND is_active',[schoolId])).length > 0;
  }

  async getByUsername(username: string): Promise<UserRow | null> {
    const rows = await this.query(`SELECT ${USER_COLUMNS} FROM app_users WHERE username = $1`, [username.trim().toLowerCase()]);
    return rows.length ? toUser(rows[0]) : null;
  }

  /** Tên đăng nhập kiểu cũ cho tài khoản tạo tay (gv.long.nv, long.nv; quản trị trường: qt.long.nv) */
  async uniqueUsername(fullName: string, role: Role): Promise<string> {
    const base = role === 'school_admin' ? `qt.${baseUsername(fullName, 'student')}` : baseUsername(fullName, role);
    let candidate = base;
    for (let n = 2; await this.getByUsername(candidate); n += 1) candidate = `${base}${n}`;
    return candidate;
  }

  async createUser(
    u: { username: string; full_name: string; role: Role; class_name: string | null; password_hash: string; must_change_password: boolean } & UserProfile,
    q: Q = (sql, params) => this.query(sql, params),
  ): Promise<UserRow> {
    const username = u.username.trim().toLowerCase();
    if ((await q('SELECT 1 FROM app_users WHERE username = $1', [username])).length) throw new DuplicateUsername(username);
    const profile = PROFILE_FIELDS.map((f) => (u[f] === undefined || u[f] === '' ? null : u[f]));
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

  async updateUser(id: number, fields: { full_name?: string; class_name?: string | null; is_active?: boolean; email?: string | null; grade?: number | null }, q: Q = (sql, params) => this.query(sql, params)): Promise<UserRow | null> {
    const allowed = Object.entries(fields).filter(([k, v]) => ['full_name', 'class_name', 'is_active', 'email', 'grade'].includes(k) && v !== undefined);
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

  async setPassword(id: number, passwordHash: string, mustChange: boolean, q: Q = (sql, params) => this.query(sql, params)): Promise<void> {
    await q('UPDATE app_users SET password_hash = $1, must_change_password = $2, token_version = token_version + 1 WHERE id = $3', [passwordHash, mustChange ? 1 : 0, id]);
  }

  async touchLogin(id: number): Promise<void> {
    await this.query('UPDATE app_users SET last_login_at = $1 WHERE id = $2', [nowIso(), id]);
  }

  // ------------------------------------------------------------------ quên mật khẩu
  /** Tài khoản còn hoạt động, có email và đúng vai trò của trang; tìm theo tên đăng nhập, hoặc theo email nếu chỉ một tài khoản dùng email đó */
  async findForPasswordReset(identifier: string, roles: Role[]): Promise<UserRow | null> {
    const key = identifier.trim().toLowerCase();
    const rows = await this.query(
      `SELECT ${USER_COLUMNS} FROM app_users
       WHERE (username = $1 OR lower(email) = $1) AND role = ANY($2) AND is_active = 1 AND deleted_at IS NULL AND email IS NOT NULL`,
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

  /** Dùng mã đúng một lần (một câu lệnh nguyên tử): trả về id tài khoản nếu mã còn hạn và chưa dùng */
  async consumePasswordReset(tokenHash: string): Promise<number | null> {
    const rows = await this.query<{ user_id: number }>(
      'UPDATE app_password_resets SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING user_id',
      [tokenHash],
    );
    return rows.length ? rows[0].user_id : null;
  }

  /** Xóa hẳn tài khoản cùng tiến độ và dữ liệu thi đấu liên quan (thùng rác hết hạn hoặc xóa vĩnh viễn) */
  async deleteUser(id: number): Promise<void> {
    await this.transaction(async (c) => {
      await c.query('DELETE FROM app_progress WHERE user_id = $1', [id]);
      await c.query('DELETE FROM app_live_results WHERE user_id = $1 OR session_id IN (SELECT id FROM app_live_sessions WHERE teacher_id = $1)', [id]);
      await c.query('DELETE FROM app_live_sessions WHERE teacher_id = $1', [id]);
      await c.query('DELETE FROM app_users WHERE id = $1', [id]);
    });
  }

  /** Học sinh của một lớp (trong trường của giáo viên nếu có), bỏ qua tài khoản trong thùng rác */
  async studentsInClass(className: string | null, schoolId: number | null = null): Promise<UserRow[]> {
    if (!className) return [];
    const rows = await this.query(
      `SELECT ${USER_COLUMNS} FROM app_users
       WHERE role = 'student' AND class_name = $1 AND deleted_at IS NULL AND school_id IS NOT DISTINCT FROM $2::integer ORDER BY full_name`,
      [className, schoolId],
    );
    return rows.map(toUser);
  }

  // ------------------------------------------------------------------ tiến độ
  /** A school teacher sees only members of their approved, currently selected class. */
  async studentsForTeacher(user: UserRow): Promise<UserRow[]> {
    if (!user.school_id) return this.studentsInClass(user.class_name, null); // assigned legacy class
    const rows = await this.query(`SELECT ${USER_COLUMNS.split(', ').map(c => 'u.' + c).join(', ')} FROM app_users u
      WHERE u.role = 'student' AND u.deleted_at IS NULL AND u.school_id = $2 AND EXISTS (
        SELECT 1 FROM app_classes c JOIN app_class_members m ON m.class_id = c.id
        WHERE c.teacher_id = $1 AND c.school_id = $2 AND c.class_code = $3 AND c.status = 'APPROVED' AND c.is_active AND m.user_id = u.id
      ) ORDER BY u.full_name`, [user.id, user.school_id, user.class_name]);
    return rows.map(toUser);
  }

  async getProgress(userId: number): Promise<Progress> {
    const rows = await this.query<Progress>(`SELECT ${PROGRESS_COLUMNS} FROM app_progress WHERE user_id = $1`, [userId]);
    if (rows.length) return rows[0];
    // Nhiều yêu cầu song song của cùng một học sinh mới: chỉ một yêu cầu tạo được dòng tiến độ
    await this.query('INSERT INTO app_progress (user_id, gems, updated_at) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING', [userId, config.startingGems, nowIso()]);
    return (await this.query<Progress>(`SELECT ${PROGRESS_COLUMNS} FROM app_progress WHERE user_id = $1`, [userId]))[0];
  }

  /** Chỉ ghi các cột có trong `data` */
  async saveProgress(userId: number, data: Partial<Progress>): Promise<Progress> {
    const entries = Object.entries(data).filter(([k]) => PROGRESS_FIELDS.includes(k));
    entries.push(['updated_at', nowIso()]);
    const sets = entries.map(([k], i) => `${k} = $${i + 1}`).join(', ');
    await this.query(`UPDATE app_progress SET ${sets} WHERE user_id = $${entries.length + 1}`, [...entries.map(([, v]) => v), userId]);
    return this.getProgress(userId);
  }

  async allProgress(light = false): Promise<Map<number, Progress>> {
    const rows = await this.query<Progress>(`SELECT ${light ? PROGRESS_LIGHT_COLUMNS : PROGRESS_COLUMNS} FROM app_progress`);
    return new Map(rows.map((r) => [Number(r.user_id), r]));
  }

  // ------------------------------------------------------------------ thi đấu cả lớp
  /** Lưu một trận và kết quả từng học sinh trong cùng một giao dịch */
  async saveLiveSession(session: LiveSessionInput, results: LiveResultInput[]): Promise<number> {
    return this.transaction(async (c) => {
      const inserted = await c.query(
        'INSERT INTO app_live_sessions (teacher_id, class_name, title, scope, question_count, player_count, question_stats, started_at, finished_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
        [session.teacher_id, session.class_name, session.title, session.scope, session.question_count, results.length, session.question_stats, session.started_at, session.finished_at],
      );
      const sessionId = Number(inserted.rows[0].id);
      for (const r of results) {
        await c.query('INSERT INTO app_live_results (session_id, user_id, rank, score, correct, answered) VALUES ($1, $2, $3, $4, $5, $6)', [
          sessionId, r.user_id, r.rank, r.score, r.correct, r.answered,
        ]);
      }
      await c.query(`INSERT INTO app_audit_events (actor_id, actor_name, actor_role, school_id, action, target_type, target_id, success)
        SELECT id, full_name, role, school_id, 'LIVE grade_results', 'live_session', $2, true FROM app_users WHERE id = $1`, [session.teacher_id, String(sessionId)]);
      return sessionId;
    });
  }

  async liveSessionsForTeacher(teacherId: number, limit = 10): Promise<LiveSessionRow[]> {
    const sessions = await this.query<Omit<LiveSessionRow, 'results'>>(
      'SELECT id, class_name, title, scope, question_count, player_count, question_stats, started_at, finished_at FROM app_live_sessions WHERE teacher_id = $1 ORDER BY finished_at DESC, id DESC LIMIT $2',
      [teacherId, limit],
    );
    if (!sessions.length) return [];
    const rows = await this.query<LiveSessionRow['results'][number]>(
      'SELECT r.session_id, r.user_id, u.full_name, r.rank, r.score, r.correct, r.answered FROM app_live_results r JOIN app_users u ON u.id = r.user_id WHERE r.session_id = ANY($1) ORDER BY r.session_id, r.rank',
      [sessions.map((s) => s.id)],
    );
    return sessions.map((s) => ({ ...s, results: rows.filter((r) => r.session_id === s.id) }));
  }
}

export { MigrationError };
