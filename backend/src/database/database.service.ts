import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import { baseUsername, hashPassword } from '../auth/passwords';
import { applyMigrations, MigrationError, pgConfig } from './migrator';

export type Role = 'admin' | 'teacher' | 'student';

export interface UserRow {
  id: number;
  username: string;
  full_name: string;
  role: Role;
  class_name: string | null;
  password_hash: string;
  must_change_password: boolean;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
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

const USER_COLUMNS = 'id, username, full_name, role, class_name, password_hash, must_change_password, is_active, created_at, last_login_at';
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

const toUser = (row: Record<string, unknown>): UserRow => ({
  ...(row as unknown as UserRow),
  must_change_password: Boolean(row.must_change_password),
  is_active: Boolean(row.is_active),
});

/** Kho dữ liệu PostgreSQL: tài khoản (app_users), tiến độ (app_progress), lịch sử thi đấu (app_live_*). */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Database');
  private pool: Pool | null = null;
  ready = false;

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
    this.ready = true;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end().catch(() => undefined);
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

  async ping(): Promise<boolean> {
    const rows = await this.query<{ ok: number }>('SELECT 1 AS ok');
    return rows[0]?.ok === 1;
  }

  private async ensureAdmin(): Promise<void> {
    if ((await this.query("SELECT id FROM app_users WHERE role = 'admin' LIMIT 1")).length) return;
    await this.createUser({
      username: config.adminUsername,
      full_name: 'Quản trị viên Đông A',
      role: 'admin',
      class_name: null,
      password_hash: await hashPassword(config.adminPassword),
      must_change_password: false,
    });
    this.logger.warn(`Đã tạo tài khoản quản trị '${config.adminUsername}' (đăng nhập tại trang /admin). Nên đổi mật khẩu mặc định khi triển khai thật.`);
  }

  // ------------------------------------------------------------------ tài khoản
  async getById(id: number): Promise<UserRow | null> {
    const rows = await this.query(`SELECT ${USER_COLUMNS} FROM app_users WHERE id = $1`, [id]);
    return rows.length ? toUser(rows[0]) : null;
  }

  async getByUsername(username: string): Promise<UserRow | null> {
    const rows = await this.query(`SELECT ${USER_COLUMNS} FROM app_users WHERE username = $1`, [username.trim().toLowerCase()]);
    return rows.length ? toUser(rows[0]) : null;
  }

  async listUsers(role?: Role): Promise<UserRow[]> {
    const rows = role
      ? await this.query(`SELECT ${USER_COLUMNS} FROM app_users WHERE role = $1 ORDER BY class_name, full_name`, [role])
      : await this.query(`SELECT ${USER_COLUMNS} FROM app_users ORDER BY role, class_name, full_name`);
    return rows.map(toUser);
  }

  async countByRole(): Promise<Record<Role, number>> {
    const counts: Record<Role, number> = { admin: 0, teacher: 0, student: 0 };
    for (const r of await this.query<{ role: Role; total: string }>('SELECT role, COUNT(*) AS total FROM app_users GROUP BY role')) {
      counts[r.role] = Number(r.total);
    }
    return counts;
  }

  async uniqueUsername(fullName: string, role: Role): Promise<string> {
    const base = baseUsername(fullName, role);
    let candidate = base;
    for (let n = 2; await this.getByUsername(candidate); n += 1) candidate = `${base}${n}`;
    return candidate;
  }

  async createUser(u: { username: string; full_name: string; role: Role; class_name: string | null; password_hash: string; must_change_password: boolean }): Promise<UserRow> {
    const username = u.username.trim().toLowerCase();
    if (await this.getByUsername(username)) throw new DuplicateUsername(username);
    await this.query(
      'INSERT INTO app_users (username, full_name, role, class_name, password_hash, must_change_password, is_active, created_at) VALUES ($1, $2, $3, $4, $5, $6, 1, $7)',
      [username, u.full_name.trim(), u.role, u.class_name?.trim() || null, u.password_hash, u.must_change_password ? 1 : 0, nowIso()],
    );
    return (await this.getByUsername(username))!;
  }

  async updateUser(id: number, fields: { full_name?: string; class_name?: string; is_active?: boolean }): Promise<UserRow | null> {
    const allowed = Object.entries(fields).filter(([, v]) => v !== undefined && v !== null);
    if (allowed.length) {
      const sets = allowed.map(([k], i) => `${k} = $${i + 1}`).join(', ');
      const values = allowed.map(([k, v]) => (k === 'is_active' ? (v ? 1 : 0) : v));
      await this.query(`UPDATE app_users SET ${sets} WHERE id = $${allowed.length + 1}`, [...values, id]);
    }
    return this.getById(id);
  }

  async setPassword(id: number, passwordHash: string, mustChange: boolean): Promise<void> {
    await this.query('UPDATE app_users SET password_hash = $1, must_change_password = $2 WHERE id = $3', [passwordHash, mustChange ? 1 : 0, id]);
  }

  async touchLogin(id: number): Promise<void> {
    await this.query('UPDATE app_users SET last_login_at = $1 WHERE id = $2', [nowIso(), id]);
  }

  /** Xóa tài khoản cùng tiến độ và dữ liệu thi đấu liên quan */
  async deleteUser(id: number): Promise<void> {
    await this.transaction(async (c) => {
      await c.query('DELETE FROM app_progress WHERE user_id = $1', [id]);
      await c.query('DELETE FROM app_live_results WHERE user_id = $1 OR session_id IN (SELECT id FROM app_live_sessions WHERE teacher_id = $1)', [id]);
      await c.query('DELETE FROM app_live_sessions WHERE teacher_id = $1', [id]);
      await c.query('DELETE FROM app_users WHERE id = $1', [id]);
    });
  }

  async studentsInClass(className: string | null): Promise<UserRow[]> {
    if (!className) return [];
    const rows = await this.query(`SELECT ${USER_COLUMNS} FROM app_users WHERE role = 'student' AND class_name = $1 ORDER BY full_name`, [className]);
    return rows.map(toUser);
  }

  // ------------------------------------------------------------------ tiến độ
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
