/** Migration runner (file SQL + PostgreSQL tạm). Không dùng dữ liệu thật. */
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { createDatabase, hasPostgres, sql } from './harness';
import type * as Migrator from '../src/database/migrator';

const MIGRATIONS = resolve(__dirname, '..', '..', 'database', 'migrations');
const TOTAL = readdirSync(MIGRATIONS).filter((n) => n.endsWith('.sql')).length;
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

  test('lệnh check không cần CSDL và thấy đủ file migration, số thứ tự liên tục', async () => {
    const { main } = await import('../src/database/migrate.cli');
    const lines: string[] = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((line: string) => void lines.push(line));
    try {
      expect(await main(['check'])).toBe(0);
    } finally {
      spy.mockRestore();
    }
    expect(lines.filter((l) => l.startsWith('OK '))).toHaveLength(TOTAL);
    expect(m.loadMigrations(MIGRATIONS).map((x) => x.version)).toEqual(Array.from({ length: TOTAL }, (_, i) => i + 1));
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
    expect(await m.applyMigrations(url, dir)).toHaveLength(TOTAL);
    expect(await m.applyMigrations(url, dir)).toEqual([]);
    expect((await m.migrationStatus(url, dir)).every((s) => s.applied)).toBe(true);
    expect(await count('SELECT count(*) AS n FROM public.app_schema_migrations')).toBe(TOTAL);
    expect(await count("SELECT count(*) AS n FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity")).toBe(0);
    // Chính sách RLS theo trường chỉ dành cho vai trò dong_a_school_scope, không mở cho vai trò khác (kho lịch sử không có chính sách nào)
    expect(await count("SELECT count(*) AS n FROM pg_policies WHERE schemaname = 'public' AND NOT ('dong_a_school_scope' = ANY(roles))")).toBe(0);
    expect(await count("SELECT count(*) AS n FROM pg_policies WHERE schemaname = 'public' AND tablename LIKE 'hist\\_%'")).toBe(0);
    expect(await count("SELECT count(*) AS n FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('app_school_years', 'app_class_teachers')")).toBe(2);
  });

  test('giữ nguyên dữ liệu đã nhập và lịch sử _prisma_migrations', async () => {
    await sql(url, readFileSync(join(dir, '001_initial_postgres_schema.sql'), 'utf8'));
    await sql(url, `INSERT INTO public."User" (id, email, "passwordHash", "fullName", "updatedAt") VALUES ('legacy-id', 'fixture@example.invalid', 'fake-hash', 'Fixture', now())`);
    await sql(url, "INSERT INTO public._prisma_migrations (id, checksum, migration_name) VALUES ('fixture', 'original-checksum', 'original-import')");
    expect(await m.applyMigrations(url, dir)).toHaveLength(TOTAL);
    expect(await sql(url, 'SELECT id, email FROM public."User"')).toEqual([{ id: 'legacy-id', email: 'fixture@example.invalid' }]);
    expect(await sql(url, 'SELECT checksum FROM public._prisma_migrations')).toEqual([{ checksum: 'original-checksum' }]);
  });

  test('014 giữ nguyên lớp, giáo viên, học sinh hiện có: tạo năm học, mã tham gia 6 ký tự, bảng giáo viên–lớp', async () => {
    // Chỉ bản sao tạm của file 014–016 được dời đi; migration trong repo giữ nguyên
    const held = new Map<string, string>();
    for (const f of readdirSync(dir).filter((x) => /^01[4-9]_/.test(x))) {
      renameSync(join(dir, f), join(dir, `${f}.held`));
      held.set(f, `${f}.held`);
    }
    expect(await m.applyMigrations(url, dir)).toHaveLength(13);
    await sql(url, `
      INSERT INTO app_schools (id, school_code, name) VALUES (901, '0901', 'Trường cũ');
      INSERT INTO app_users (id, username, full_name, role, password_hash, school_id, created_at, is_active) VALUES
        (901, 'gv.cu', 'Giáo viên cũ', 'teacher', 'x', 901, '2025-01-01', 1), (902, 'hs.cu', 'Học sinh cũ', 'student', 'x', 901, '2025-01-01', 0);
      INSERT INTO app_classes (id, school_id, teacher_id, class_code, school_year, name, join_password_hash, status, grade) VALUES
        (901, 901, 901, '7A1', '2025-2026', 'Lớp 7A1', 'hash', 'APPROVED', 7), (902, 901, 901, '7A2', '2026-2027', 'Lớp 7A2', 'hash', 'APPROVED', 7), (903, 901, NULL, 'LAB', 'năm lạ', 'Lớp lạ', 'hash', 'PENDING', NULL);
      INSERT INTO app_class_members (class_id, user_id) VALUES (901, 902);`);
    for (const [f, h] of held) renameSync(join(dir, h), join(dir, f));
    expect(await m.applyMigrations(url, dir)).toHaveLength(TOTAL - 13);
    // Năm học nhận từ dữ liệu cũ; năm mới nhất đang hoạt động, năm trước đã kết thúc; năm viết sai định dạng bị bỏ qua, lớp đó giữ nguyên
    expect(await sql(url, 'SELECT label, status FROM app_school_years WHERE school_id = 901 ORDER BY label')).toEqual([{ label: '2025-2026', status: 'ended' }, { label: '2026-2027', status: 'active' }]);
    expect(await sql(url, 'SELECT c.id, y.label AS year FROM app_classes c LEFT JOIN app_school_years y ON y.id = c.year_id WHERE c.school_id = 901 ORDER BY c.id')).toEqual([
      { id: 901, year: '2025-2026' }, { id: 902, year: '2026-2027' }, { id: 903, year: null },
    ]);
    const codes = await sql<{ join_code: string }>(url, 'SELECT join_code FROM app_classes WHERE school_id = 901');
    expect(codes.every((c) => /^[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{6}$/.test(c.join_code))).toBe(true);
    expect(new Set(codes.map((c) => c.join_code)).size).toBe(3);
    expect(await sql(url, 'SELECT class_id, teacher_id FROM app_class_teachers ORDER BY class_id')).toEqual([{ class_id: 901, teacher_id: 901 }, { class_id: 902, teacher_id: 901 }]);
    // Dữ liệu cũ còn nguyên: lớp có mật khẩu gia nhập cũ, học sinh bị khóa vẫn bị khóa, thành viên lớp còn
    expect(await sql(url, 'SELECT is_active, lock_reason, admin_level FROM app_users WHERE id = 902')).toEqual([{ is_active: 0, lock_reason: null, admin_level: 1 }]);
    expect(await sql(url, 'SELECT user_id FROM app_class_members WHERE class_id = 901')).toEqual([{ user_id: 902 }]);
    expect((await sql(url, 'SELECT join_password_hash FROM app_classes WHERE id = 901'))[0]).toEqual({ join_password_hash: 'hash' });
    // Xóa giáo viên không còn kéo theo xóa lớp
    await sql(url, 'DELETE FROM app_users WHERE id = 901');
    expect(await count('SELECT count(*) AS n FROM app_classes WHERE school_id = 901')).toBe(3);
  });

  test('016 khởi tạo kho lịch sử ở trạng thái Nháp, có phiên bản 1 và liên kết', async () => {
    await m.applyMigrations(url, dir);
    expect(await sql(url, 'SELECT slug FROM hist_campaigns ORDER BY sort_order')).toEqual([{ slug: 'khang-chien-lan-1-1258' }, { slug: 'khang-chien-lan-2-1285' }, { slug: 'khang-chien-lan-3-1287-1288' }]);
    for (const table of ['hist_campaigns', 'hist_places', 'hist_figures', 'hist_events', 'hist_battles', 'hist_sources', 'hist_terms']) {
      expect(await count(`SELECT count(*) AS n FROM ${table} WHERE status <> 'draft'`)).toBe(0);
      expect(await count(`SELECT count(*) AS n FROM ${table}`)).toBeGreaterThan(0);
    }
    expect(await count('SELECT count(*) AS n FROM hist_versions')).toBe(await count("SELECT (SELECT count(*) FROM hist_campaigns) + (SELECT count(*) FROM hist_places) + (SELECT count(*) FROM hist_figures) + (SELECT count(*) FROM hist_events) + (SELECT count(*) FROM hist_battles) + (SELECT count(*) FROM hist_sources) + (SELECT count(*) FROM hist_terms) AS n"));
    expect(await count('SELECT count(*) AS n FROM hist_links')).toBeGreaterThan(20);
    expect(await sql(url, "SELECT b.slug AS battle, e.slug AS event, p.slug AS place FROM hist_battles b JOIN hist_events e ON e.id = b.event_id JOIN hist_places p ON p.id = b.place_id WHERE b.slug = 'bach-dang'")).toEqual([{ battle: 'bach-dang', event: 'dai-thang-bach-dang-1288', place: 'bach-dang' }]);
  });

  test('một file lỗi thì hoàn tác cả lô và lịch sử', async () => {
    await m.applyMigrations(url, dir);
    const next = String(TOTAL + 1).padStart(3, '0'), after = String(TOTAL + 2).padStart(3, '0');
    writeFileSync(join(dir, `${next}_create_marker.sql`), 'CREATE TABLE public.rollback_marker (id INT);');
    writeFileSync(join(dir, `${after}_fail.sql`), 'SELECT * FROM deliberately_missing_relation;');
    await expect(m.applyMigrations(url, dir)).rejects.toThrow(/42P01/);
    expect((await sql(url, "SELECT to_regclass('public.rollback_marker') AS t"))[0].t).toBeNull();
    expect(await count('SELECT count(*) AS n FROM public.app_schema_migrations')).toBe(TOTAL);
    writeFileSync(join(dir, `${after}_fail.sql`), 'INSERT INTO public.rollback_marker VALUES (1);');
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
    expect(results.map((r) => r.length).sort((a, b) => a - b)).toEqual([0, TOTAL]);
    expect(await count('SELECT count(*) AS n FROM public.app_schema_migrations')).toBe(TOTAL);
  });

  test('backend khởi động tự chạy migration, ghi tài khoản và lớp; khởi động lại không đổi dữ liệu, quản trị tổng nhận ADMIN_EMAIL', async () => {
    process.env.DATABASE_URL = url;
    process.env.ADMIN_EMAIL = 'fill@example.invalid';
    jest.resetModules();
    const { DatabaseService } = await import('../src/database/database.service');
    const { hashPassword } = await import('../src/auth/passwords');
    const db = new DatabaseService();
    await db.onModuleInit();
    try {
      expect(db.ready).toBe(true);
      const hash = await hashPassword('fixture-only', 4);
      const user = await db.createUser({ username: 'migration_student', full_name: 'Fixture', role: 'student', class_name: null, password_hash: hash, must_change_password: true });
      expect(await db.accountHasData(user.id)).toBeNull();
      expect(await sql(url, "SELECT email, admin_level FROM public.app_users WHERE role = 'root_admin'")).toEqual([{ email: 'fill@example.invalid', admin_level: 1 }]);
      await sql(url, "UPDATE public.app_users SET email = NULL WHERE role = 'root_admin'");
      const again = new DatabaseService();
      await again.onModuleInit();
      expect(await sql(url, "SELECT email FROM public.app_users WHERE role = 'root_admin'")).toEqual([{ email: 'fill@example.invalid' }]);
      expect((await again.getByUsername('migration_student'))!.id).toBe(user.id);
      await again.onModuleDestroy();
      expect(await count('SELECT count(*) AS n FROM public.app_schema_migrations')).toBe(TOTAL);
      await db.deleteUser(user.id);
      expect(await db.getByUsername('migration_student')).toBeNull();
    } finally {
      await db.onModuleDestroy();
    }
  });
});
