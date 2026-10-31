/** Migration runner (file SQL + PostgreSQL tạm). Không dùng dữ liệu thật. */
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { createDatabase, hasPostgres, sql } from './harness';
import type * as Migrator from '../src/database/migrator';

const MIGRATIONS = resolve(__dirname, '..', '..', 'database', 'migrations');
let m: typeof Migrator;
const temps: string[] = [];

function tempDir(copyMigrations = false): string {
  const dir = mkdtempSync(join(tmpdir(), 'dong_a_migration_files_'));
  temps.push(dir);
  if (copyMigrations) for (const f of readdirSync(MIGRATIONS).filter((n) => n.endsWith('.sql'))) copyFileSync(join(MIGRATIONS, f), join(dir, f));
  return dir;
}

beforeAll(async () => {
  process.env.DATABASE_URL = '';
  m = await import('../src/database/migrator');
});

afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe('file migration', () => {
  test('không đọc được UTF-8 thì báo MigrationError', () => {
    const dir = tempDir();
    writeFileSync(join(dir, '001_broken.sql'), Buffer.from([0xff]));
    expect(() => m.loadMigrations(dir)).toThrow(/Cannot read UTF-8/);
  });

  test('xuống dòng Windows và Linux cho cùng checksum', () => {
    const dir = tempDir();
    writeFileSync(join(dir, '001_first.sql'), 'SELECT 1;\r\n');
    const windows = m.loadMigrations(dir)[0].checksum;
    writeFileSync(join(dir, '001_first.sql'), 'SELECT 1;\n');
    expect(m.loadMigrations(dir)[0].checksum).toBe(windows);
  });

  test('từ chối trùng số thứ tự và file chỉ có comment', () => {
    const dup = tempDir();
    writeFileSync(join(dup, '001_first.sql'), 'SELECT 1;');
    writeFileSync(join(dup, '001_second.sql'), 'SELECT 2;');
    expect(() => m.loadMigrations(dup)).toThrow(/Duplicate/);
    const empty = tempDir();
    writeFileSync(join(empty, '001_empty.sql'), '-- TODO\n/* no statements */');
    expect(() => m.loadMigrations(empty)).toThrow(/no SQL/);
  });

  test('cấm tự mở/đóng transaction nhưng cho phép khối DO và chuỗi chứa COMMIT', () => {
    const dir = tempDir();
    for (const text of ['BEGIN; SELECT 1; COMMIT;', 'SELECT 1; COMMIT;', 'CREATE INDEX CONCURRENTLY idx ON x (id);', 'VACUUM;']) {
      writeFileSync(join(dir, '001_guard.sql'), text);
      expect(() => m.loadMigrations(dir)).toThrow(m.MigrationError);
    }
    writeFileSync(join(dir, '001_guard.sql'), "/* nested /* comment */ */ DO $body$ BEGIN PERFORM 1; END $body$; SELECT 'COMMIT;', E'\\\\';");
    expect(m.loadMigrations(dir)).toHaveLength(1);
  });

  test('lệnh check không cần CSDL', async () => {
    const { main } = await import('../src/database/migrate.cli');
    const lines: string[] = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((line: string) => void lines.push(line));
    try {
      expect(await main(['check'])).toBe(0);
    } finally {
      spy.mockRestore();
    }
    expect(lines.filter((l) => l.startsWith('OK '))).toHaveLength(10);
  });
});

(hasPostgres() ? describe : describe.skip)('PostgreSQL', () => {
  let url: string;
  let dir: string;
  let n = 0;
  const count = async (text: string) => Number((await sql<{ n: string }>(url, text))[0].n);

  beforeEach(async () => {
    n += 1;
    url = await createDatabase(`migration_${n}`);
    dir = tempDir(true);
  });

  test('status chỉ đọc, chạy lại không áp dụng lần hai, mọi bảng bật RLS', async () => {
    expect((await m.migrationStatus(url, dir)).every((s) => !s.applied)).toBe(true);
    expect((await sql(url, "SELECT to_regclass('public.app_schema_migrations') AS t"))[0].t).toBeNull();
    expect(await m.applyMigrations(url, dir)).toHaveLength(10);
    expect(await m.applyMigrations(url, dir)).toEqual([]);
    expect((await m.migrationStatus(url, dir)).every((s) => s.applied)).toBe(true);
    expect(await count('SELECT count(*) AS n FROM public.app_schema_migrations')).toBe(10);
    expect(await count("SELECT count(*) AS n FROM pg_tables WHERE schemaname = 'public' AND rowsecurity")).toBe(20);
    // Chính sách RLS theo trường cho vai trò dong_a_school_scope, không mở cho vai trò khác
    expect(await count("SELECT count(*) AS n FROM pg_policies WHERE schemaname = 'public' AND policyname = 'school_scope'")).toBe(13);
    expect(await count("SELECT count(*) AS n FROM pg_policies WHERE schemaname = 'public' AND NOT ('dong_a_school_scope' = ANY(roles))")).toBe(0);
  });

  test('giữ nguyên dữ liệu đã nhập và lịch sử _prisma_migrations', async () => {
    await sql(url, readFileSync(join(dir, '001_initial_postgres_schema.sql'), 'utf8'));
    await sql(url, `INSERT INTO public."User" (id, email, "passwordHash", "fullName", "updatedAt") VALUES ('legacy-id', 'fixture@example.invalid', 'fake-hash', 'Fixture', now())`);
    await sql(url, "INSERT INTO public._prisma_migrations (id, checksum, migration_name) VALUES ('fixture', 'original-checksum', 'original-import')");
    expect(await m.applyMigrations(url, dir)).toHaveLength(10);
    expect(await sql(url, 'SELECT id, email FROM public."User"')).toEqual([{ id: 'legacy-id', email: 'fixture@example.invalid' }]);
    expect(await sql(url, 'SELECT checksum FROM public._prisma_migrations')).toEqual([{ checksum: 'original-checksum' }]);
  });

  test('010 preserves existing competitions, backfills only school and never guesses a historical year',async()=>{
    // Only the temporary fixture copy is moved aside; repository migrations remain immutable.
    const file=join(dir,'010_reporting_scope.sql'),held=join(dir,'010_reporting_scope.fixture');renameSync(file,held);
    expect(await m.applyMigrations(url,dir)).toHaveLength(9);
    await sql(url,"INSERT INTO app_schools(id,school_code,name) VALUES(777,'0777','Synthetic school'); INSERT INTO app_users(id,username,full_name,role,password_hash,school_id,created_at) VALUES(777,'report_migration_fixture','Synthetic teacher','teacher','synthetic-hash',777,'2025-01-01'); INSERT INTO app_live_sessions(id,teacher_id,class_name,title,started_at,finished_at) VALUES(777,777,'7A1','Old match','2025-01-01','2025-01-01'); INSERT INTO app_live_results(session_id,user_id,rank,score,answered,correct) VALUES(777,777,1,100,2,1);");
    renameSync(held,file);expect(await m.applyMigrations(url,dir)).toEqual(['010_reporting_scope.sql']);
    expect(await sql(url,'SELECT school_id,class_id,school_year,grade,title FROM app_live_sessions WHERE id=777')).toEqual([{school_id:777,class_id:null,school_year:null,grade:null,title:'Old match'}]);
    expect(await sql(url,'SELECT score,answered,correct FROM app_live_results WHERE session_id=777')).toEqual([{score:100,answered:2,correct:1}]);
  });

  test('một file lỗi thì hoàn tác cả lô và lịch sử', async () => {
    await m.applyMigrations(url, dir);
    writeFileSync(join(dir, '011_create_marker.sql'), 'CREATE TABLE public.rollback_marker (id INT);');
    writeFileSync(join(dir, '012_fail.sql'), 'SELECT * FROM deliberately_missing_relation;');
    await expect(m.applyMigrations(url, dir)).rejects.toThrow(/42P01/);
    expect((await sql(url, "SELECT to_regclass('public.rollback_marker') AS t"))[0].t).toBeNull();
    expect(await count('SELECT count(*) AS n FROM public.app_schema_migrations')).toBe(10);
    writeFileSync(join(dir, '012_fail.sql'), 'INSERT INTO public.rollback_marker VALUES (1);');
    expect(await m.applyMigrations(url, dir)).toHaveLength(2);
    expect(await sql(url, 'SELECT id FROM public.rollback_marker')).toEqual([{ id: 1 }]);
  });

  test('file đã chạy bị sửa, đổi tên hoặc xóa thì bị từ chối', async () => {
    await m.applyMigrations(url, dir);
    const path = join(dir, '002_app_users.sql');
    writeFileSync(path, readFileSync(path, 'utf8') + '\n-- changed after applying\n');
    await expect(m.applyMigrations(url, dir)).rejects.toThrow(/was changed/);
    renameSync(path, join(dir, '002_renamed.sql'));
    await expect(m.migrationStatus(url, dir)).rejects.toThrow(/was changed/);
    renameSync(join(dir, '002_renamed.sql'), join(dir, 'removed_migration.txt'));
    await expect(m.applyMigrations(url, dir)).rejects.toThrow(/is missing/);
  });

  test('migration mới chen vào trước file đã chạy thì bị từ chối', async () => {
    await m.applyMigrations(url, dir);
    writeFileSync(join(dir, '000_inserted_late.sql'), 'SELECT 1;');
    await expect(m.applyMigrations(url, dir)).rejects.toThrow(/inserted before/);
  });

  test('hai tiến trình chạy cùng lúc: mỗi file chỉ chạy một lần', async () => {
    const results = await Promise.all([m.applyMigrations(url, dir), m.applyMigrations(url, dir)]);
    expect(results.map((r) => r.length).sort()).toEqual([0, 10]);
    expect(await count('SELECT count(*) AS n FROM public.app_schema_migrations')).toBe(10);
  });

  test('backend khởi động tự chạy migration, ghi được tiến độ và lịch sử thi đấu', async () => {
    process.env.DATABASE_URL = url;
    process.env.ADMIN_EMAIL = 'fill@example.invalid';
    jest.resetModules();
    const { DatabaseService } = await import('../src/database/database.service');
    const { hashPassword } = await import('../src/auth/passwords');
    const db = new DatabaseService();
    await db.onModuleInit();
    try {
      expect(db.ready).toBe(true);
      const hash = await hashPassword('fixture-only');
      const user = await db.createUser({ username: 'migration_student', full_name: 'Fixture', role: 'student', class_name: '7A', password_hash: hash, must_change_password: true });
      expect((await db.getProgress(user.id)).gems).toBe(100);
      expect((await db.saveProgress(user.id, { xp: 42 })).xp).toBe(42);
      const saved = await db.saveProgress(user.id, { game_state: '{"campaign":{"m1p1":3}}', day_gems: 20, week_xp: 42, week_key: '2026-W43' });
      expect([saved.game_state, saved.day_gems, saved.week_xp]).toEqual(['{"campaign":{"m1p1":3}}', 20, 42]);
      expect((await db.allProgress(true)).get(user.id)).not.toHaveProperty('game_state');

      // Khởi động lại: không chạy lại migration, dữ liệu còn nguyên; quản trị tổng chưa có email thì nhận ADMIN_EMAIL (để dùng "Quên mật khẩu")
      expect(await sql(url, "SELECT email FROM public.app_users WHERE role = 'root_admin'")).toEqual([{ email: 'fill@example.invalid' }]);
      await sql(url, "UPDATE public.app_users SET email = NULL WHERE role = 'root_admin'");
      const again = new DatabaseService();
      await again.onModuleInit();
      expect(await sql(url, "SELECT email FROM public.app_users WHERE role = 'root_admin'")).toEqual([{ email: 'fill@example.invalid' }]);
      expect((await again.getByUsername('migration_student'))!.id).toBe(user.id);
      expect((await again.getProgress(user.id)).xp).toBe(42);
      await again.onModuleDestroy();
      expect(await count('SELECT count(*) AS n FROM public.app_schema_migrations')).toBe(10);

      // Lưu một trận thi đấu lớp, đọc lại kèm tên học sinh; xóa tài khoản thì xóa luôn dữ liệu trận liên quan
      const teacher = await db.createUser({ username: 'live_teacher', full_name: 'Fixture GV', role: 'teacher', class_name: '7A', password_hash: hash, must_change_password: true });
      const sessionId = await db.saveLiveSession(
        {
          teacher_id: teacher.id, class_name: '7A', title: 'Thi thử', scope: 'all', question_count: 2, question_stats: '[{"id":"q1","answered":1,"correct":1}]',
          started_at: '2026-10-22T08:00:00+00:00', finished_at: '2026-10-22T08:05:00+00:00',
        },
        [{ user_id: user.id, rank: 1, score: 1800, correct: 2, answered: 2 }],
      );
      const sessions = await db.liveSessionsForTeacher(teacher.id);
      expect(sessions.map((s) => [s.id, s.player_count, s.question_count])).toEqual([[sessionId, 1, 2]]);
      expect(sessions[0].results.map((r) => [r.full_name, r.rank, r.score])).toEqual([['Fixture', 1, 1800]]);
      await db.deleteUser(user.id);
      expect((await db.liveSessionsForTeacher(teacher.id))[0].results).toEqual([]);
      await db.deleteUser(teacher.id);
      expect(await db.liveSessionsForTeacher(teacher.id)).toEqual([]);
      expect(await count('SELECT count(*) AS n FROM public.app_live_sessions')).toBe(0);
      expect(await count('SELECT count(*) AS n FROM public.app_live_results')).toBe(0);
    } finally {
      await db.onModuleDestroy();
    }
  });
});
