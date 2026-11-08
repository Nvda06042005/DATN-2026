/** Migration runner (file SQL + PostgreSQL tạm). Không dùng dữ liệu thật. */
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { createDatabase, hasPostgres, sql } from './harness';
import type * as Migrator from '../src/database/migrator';
import { directoryEntry, directoryInfo, searchDirectory } from '../src/admin/school-directory';

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
    expect(await count("SELECT count(*) AS n FROM pg_policies WHERE schemaname = 'public' AND NOT ('dong_a_school_scope' = ANY(roles) OR 'dong_a_workspace_scope' = ANY(roles))")).toBe(0);
    expect(await count("SELECT count(*) AS n FROM pg_policies WHERE schemaname = 'public' AND tablename LIKE 'hist\\_%' AND NOT ('dong_a_workspace_scope'=ANY(roles))")).toBe(0);
    expect(await count("SELECT count(*) AS n FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('app_school_years', 'app_class_teachers') AND 'dong_a_school_scope'=ANY(roles)")).toBe(2);
  });

  test('052 thêm kho xóa một năm, giữ dữ liệu đang dùng và ngày xóa cũ của hội thoại ẩn, không mở quyền API', async () => {
    // giữ 052 và mọi migration sau nó: migration mới hơn không được chạy trước 052
    const later = readdirSync(dir).filter(name => /^\d+_.*\.sql$/.test(name) && Number(name.split('_')[0]) >= 52);
    const change = later.find(name => name.startsWith('052_'))!;
    for (const file of later) renameSync(join(dir,file),join(dir,`${file}.held`));
    await m.applyMigrations(url,dir);
    // Mô phỏng default privileges trực tiếp của Supabase, không chỉ quyền qua PUBLIC.
    await sql(url, `DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; END $$;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anon;
      INSERT INTO app_users(id,username,full_name,role,password_hash,is_active,created_at) VALUES(88001,'archive.fixture','Giữ tài khoản','student','fixture-hash',1,'2026-01-01');
      INSERT INTO hk_ai_conversations(id,user_id,title,deleted_at) VALUES(88001,88001,'Đã ẩn',now()-interval '2 months'),(88002,88001,'Đang dùng',NULL);
      INSERT INTO hk_ai_messages(conversation_id,role,content) VALUES(88001,'assistant','Giữ nội dung hội thoại');`);
    const before = await sql(url, 'SELECT username,password_hash FROM app_users WHERE id=88001');
    renameSync(join(dir,`${change}.held`),join(dir,change));
    expect(await m.applyMigrations(url,dir)).toEqual([change]);
    expect(await sql(url, 'SELECT username,password_hash FROM app_users WHERE id=88001')).toEqual(before);
    const copied = await sql<any>(url, "SELECT actor_role,delete_kind,related_data,expires_at=deleted_at+interval '1 year' AS valid,deleted_at= (SELECT deleted_at FROM hk_ai_conversations WHERE id=88001) AS original_date FROM app_deleted_records");
    expect(copied).toHaveLength(1); expect(copied[0]).toMatchObject({ actor_role: 'system', delete_kind: 'legacy_soft_delete', valid: true, original_date: true });
    expect(copied[0].related_data.hk_ai_messages[0].content).toBe('Giữ nội dung hội thoại');
    expect(await sql(url, "SELECT has_table_privilege('anon','app_deleted_records','SELECT') AS read,has_function_privilege('anon','app_purge_deleted_records()','EXECUTE') AS purge,has_function_privilege('anon','app_install_delete_archives()','EXECUTE') AS install")).toEqual([{ read:false,purge:false,install:false }]);
    expect(await m.applyMigrations(url,dir)).toEqual([]);
    expect(await sql(url, 'SELECT count(*)::int AS n FROM app_deleted_records')).toEqual([{n:1}]);
    expect(await sql(url, 'SELECT id FROM hk_ai_conversations ORDER BY id')).toHaveLength(2);
    await sql(url, 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon; ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT,INSERT,UPDATE,DELETE ON TABLES FROM anon');
    for (const file of later.filter(file => file !== change)) renameSync(join(dir,`${file}.held`),join(dir,file));
  });

  test('042 thêm mã tham chiếu và bộ sinh mã, giữ nguyên trường và đường dẫn cũ', async () => {
    for (const name of readdirSync(dir).filter(name => /^\d+_.*\.sql$/.test(name) && Number(name.split('_')[0]) > 42)) renameSync(join(dir,name),join(dir,`${name}.held`));
    const change = readdirSync(dir).find(name => name.startsWith('042_'))!;
    renameSync(join(dir, change), join(dir, `${change}.held`));
    await m.applyMigrations(url, dir);
    await sql(url, "INSERT INTO app_schools(id,school_code,name,region) VALUES(9901,'00000001','Trường giữ nguyên','Khu vực cũ')");
    renameSync(join(dir, `${change}.held`), join(dir, change));
    expect(await m.applyMigrations(url, dir)).toHaveLength(1);
    expect(await sql(url, 'SELECT school_code,name,region,directory_code FROM app_schools WHERE id=9901')).toEqual([{ school_code: '00000001', name: 'Trường giữ nguyên', region: 'Khu vực cũ', directory_code: null }]);
    expect(await sql(url, 'SELECT public.next_school_registration_code() AS code')).toEqual([{ code: '00000002' }]);
    expect(await sql(url, 'SELECT public.next_school_registration_code() AS code')).toEqual([{ code: '00000003' }]);
    expect(await count("SELECT count(*) AS n FROM information_schema.routine_privileges WHERE routine_schema='public' AND routine_name='next_school_registration_code' AND grantee='PUBLIC'")).toBe(0);
  });

  test('040 chỉ xóa sáu bảng quản trị nội dung cũ; giữ nguyên tài khoản, trường và kho đang dùng', async () => {
    // Kiểm tra riêng bước 040, không áp dụng các điều chỉnh dữ liệu tham chiếu ở phiên bản sau.
    for (const name of readdirSync(dir).filter((name) => /^\d+_.*\.sql$/.test(name) && Number(name.split('_')[0]) > 40)) {
      renameSync(join(dir, name), join(dir, `${name}.held`));
    }
    const removal = readdirSync(dir).find((name) => name.startsWith('040_'))!;
    renameSync(join(dir, removal), join(dir, `${removal}.held`));
    expect(await m.applyMigrations(url, dir)).toHaveLength(39);
    const obsolete = ['app_content_history', 'app_curriculum_nodes', 'app_question_bank', 'app_ai_sources', 'app_hero_cards', 'app_exp_rules'];
    await sql(url, `INSERT INTO app_schools(id,school_code,name) VALUES(9001,'9001','Trường được giữ lại');
      INSERT INTO app_users(id,username,full_name,role,password_hash,school_id,is_active,created_at)
      VALUES(9001,'migration.student','Học sinh kiểm thử','student','synthetic-hash',9001,1,'2026-11-06T00:00:00Z');`);
    const before = await sql<{ tab: string }>(url, "SELECT tablename AS tab FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
    const retained = before.map((r) => r.tab).filter((tab) => !obsolete.includes(tab) && tab !== 'app_schema_migrations');
    const snapshots = new Map<string, unknown>();
    // So sánh toàn bộ dòng của các bảng được giữ, không chỉ đếm dòng.
    const snapshot = (tab: string) => sql(url, `SELECT to_jsonb(t) AS row FROM public."${tab}" t ORDER BY to_jsonb(t)::text`);
    for (const tab of retained) snapshots.set(tab, await snapshot(tab));
    expect(obsolete.every((tab) => before.some((r) => r.tab === tab))).toBe(true);
    renameSync(join(dir, `${removal}.held`), join(dir, removal));
    expect(await m.applyMigrations(url, dir)).toEqual([removal]);
    const after = await sql<{ tab: string }>(url, "SELECT tablename AS tab FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
    expect(after.map((r) => r.tab)).toEqual(before.map((r) => r.tab).filter((tab) => !obsolete.includes(tab)));
    for (const tab of retained) expect(await snapshot(tab)).toEqual(snapshots.get(tab));
    expect(await m.applyMigrations(url, dir)).toEqual([]);
  });

  test('041 giữ chính sách chung đã có và FAQ tự sửa, cập nhật đúng hướng dẫn khởi tạo', async () => {
    for (const name of readdirSync(dir).filter(name => /^\d+_.*\.sql$/.test(name) && Number(name.split('_')[0]) > 41)) renameSync(join(dir,name),join(dir,`${name}.held`));
    const change=readdirSync(dir).find((name)=>name.startsWith('041_'))!;
    renameSync(join(dir,change),join(dir,`${change}.held`));
    expect(await m.applyMigrations(url,dir)).toHaveLength(40);
    await sql(url,"UPDATE hk_reco_settings SET max_items=2 WHERE id=1; INSERT INTO hk_faq(audience,category,question,answer) VALUES('student','Lớp học','Tôi thấy bài tập của lớp ở đâu?','Hướng dẫn riêng của quản trị');");
    renameSync(join(dir,`${change}.held`),join(dir,change));
    expect(await m.applyMigrations(url,dir)).toEqual([change]);
    expect((await sql(url,'SELECT id,max_items FROM hk_reco_settings'))).toEqual([{id:1,max_items:2}]);
    const answers=(await sql<{answer:string}>(url,"SELECT answer FROM hk_faq WHERE audience='student' AND question='Tôi thấy bài tập của lớp ở đâu?' ORDER BY id")).map((r)=>r.answer);
    expect(answers[0]).toContain('Kế hoạch học');
    expect(answers[0]).not.toContain('Gợi ý học tập');
    expect(answers[1]).toBe('Hướng dẫn riêng của quản trị');
  });

  test('046 (ảnh đại diện tải lên) nới ràng buộc avatar_url: nhận đường dẫn kho tệp, vẫn nhận liên kết https cũ, từ chối dạng khác; không đổi dữ liệu', async () => {
    const later = readdirSync(dir).find((name) => name.startsWith('046_'))!;
    const held = readdirSync(dir).filter(name => /^\d+_.*\.sql$/.test(name) && Number(name.slice(0, 3)) >= 46);
    for (const file of held) renameSync(join(dir, file), join(dir, `${file}.held`));
    await m.applyMigrations(url, dir);
    await sql(url, `INSERT INTO app_schools(id,school_code,name) VALUES(9101,'9101','Trường thử 046');
      INSERT INTO app_users(id,username,full_name,role,password_hash,school_id,is_active,avatar_url,created_at)
      VALUES(9101,'cu.https','Dùng liên kết https','student','synthetic-hash',9101,1,'https://example.edu.vn/a.png','2026-11-06T00:00:00Z')`);
    // trước 046: đường dẫn kho tệp bị từ chối
    await expect(sql(url, "UPDATE app_users SET avatar_url = '/api/content/media/' || repeat('a', 32) WHERE id = 9101")).rejects.toThrow();
    renameSync(join(dir, `${later}.held`), join(dir, later));
    expect(await m.applyMigrations(url, dir)).toEqual([later]);
    expect(await sql(url, 'SELECT avatar_url FROM app_users WHERE id = 9101')).toEqual([{ avatar_url: 'https://example.edu.vn/a.png' }]);
    const defs = await sql<{ def: string }>(url, "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'public.app_users'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%avatar_url%'");
    expect(defs).toHaveLength(1);
    expect(defs[0].def).toMatch(/api\/content\/media/);
    await sql(url, "UPDATE app_users SET avatar_url = '/api/content/media/' || repeat('a', 32) WHERE id = 9101");
    await sql(url, 'UPDATE app_users SET avatar_url = NULL WHERE id = 9101');
    for (const bad of ["'http://khong-bao-mat.vn/a.png'", "'/api/content/media/abc'", "'/api/content/media/' || repeat('A', 32)", "'/api/khac/' || repeat('a', 32)", "'javascript:alert(1)'"]) {
      await expect(sql(url, `UPDATE app_users SET avatar_url = ${bad} WHERE id = 9101`)).rejects.toThrow();
    }
    expect(await m.applyMigrations(url, dir)).toEqual([]);
    for (const file of held.filter(file => file !== later)) renameSync(join(dir, `${file}.held`), join(dir, file));
  });

  test('048 và 049 xóa các mục tham chiếu cũ đã sáp nhập, thêm trường mới hình thành sau sáp nhập, giữ trường đăng ký và mọi tài khoản', async () => {
    const held = readdirSync(dir).filter(name => /^\d+_.*\.sql$/.test(name) && Number(name.split('_')[0]) >= 48);
    for (const file of held) renameSync(join(dir, file), join(dir, `${file}.held`));
    await m.applyMigrations(url, dir);
    const retired = searchDirectory('', 20000).flatMap(row => row.previous_codes ?? []);
    expect((await sql(url, 'SELECT code FROM app_school_directory WHERE code=$1', ['01020513'])).length).toBe(1);
    expect((await sql(url, 'SELECT code FROM app_school_directory WHERE code=$1', ['hn-dongocdu-2026'])).length).toBe(1);
    await sql(url, `INSERT INTO app_schools(id,school_code,directory_code,name,region) VALUES(9481,'9481','01020513','Trường đã đăng ký','Khu vực giữ lại');
      INSERT INTO app_users(id,username,full_name,role,password_hash,school_id,is_active,created_at)
      VALUES(9481,'fixture.retired','Tài khoản được giữ','student','synthetic-hash',9481,1,'2026-11-07T00:00:00Z');
      INSERT INTO app_schools(id,school_code,directory_code,name,region) VALUES(9482,'9482','79765508','THCS Cửu Long đã đăng ký','Khu vực giữ lại 2')`);
    expect((await sql(url, 'SELECT code FROM app_school_directory WHERE code=$1', ['79765508'])).length).toBe(1);
    const school = await sql(url, 'SELECT * FROM app_schools WHERE id=9481');
    const school2 = await sql(url, 'SELECT * FROM app_schools WHERE id=9482');
    const user = await sql(url, 'SELECT * FROM app_users WHERE id=9481');
    const assets = await count('SELECT count(*) AS n FROM app_school_logo_assets');
    // 048 xóa các mục cũ đã sáp nhập đến 06/11; 049 gỡ thêm các trường TP.HCM đã gộp (danh sách Dân trí) và thêm trường mới: sau cả hai, CSDL khớp danh mục trong mã nguồn
    const changes = held.filter(file => /^04[89]_/.test(file)).sort();
    expect(changes).toHaveLength(2);
    for (const file of changes) renameSync(join(dir, `${file}.held`), join(dir, file));
    expect(await m.applyMigrations(url, dir)).toEqual(changes);
    expect(await sql(url, 'SELECT code FROM app_school_directory WHERE code=ANY($1::text[])', [retired])).toEqual([]);
    // 049: THCS Cửu Long gộp vào THCS Phú Mỹ và các trường THCS khác đã gộp không còn trong danh mục; tên và mã cũ trỏ tới trường hiện tại
    const merged049 = ['79765508', '79760508', '79764510', '79776504', '79776512', '77751513', '77751503', '79760505', '79760507', '74725512', '74725508', '74718514', '74723513', '77754503', '77751506', '42445505', '42445504', '37374516', '37369510'];
    expect(await sql(url, 'SELECT code FROM app_school_directory WHERE code=ANY($1::text[])', [merged049])).toEqual([]);
    expect((await sql<{ previous_codes: string[] }>(url, "SELECT previous_codes FROM app_school_directory WHERE code='79765507'"))[0].previous_codes).toContain('79765508');
    expect((await sql(url, "SELECT name FROM app_school_directory WHERE code='hcm-tandinh-2026'"))[0]).toEqual({ name: 'Tiểu học - THCS Tân Định' });
    expect((await sql(url, "SELECT name, previous_codes FROM app_school_directory WHERE code='ht-thachha-2026'"))[0]).toEqual({ name: 'Trường THCS Thạch Hà', previous_codes: ['42445504', '42445505'] });
    expect(directoryEntry('79765508')?.code).toBe('79765507');
    expect(searchDirectory('Cửu Long Bình Thạnh').some(row => row.code === '79765508')).toBe(false);
    expect(await count('SELECT count(*) AS n FROM app_school_directory')).toBe(directoryInfo().schools);
    expect((await sql(url, 'SELECT name FROM app_school_directory WHERE code=$1', ['30297509']))[0]).toEqual({ name: 'Trường THCS Hoàng Diệu' });
    expect(await sql(url, 'SELECT * FROM app_schools WHERE id=9481')).toEqual(school);
    expect(await sql(url, 'SELECT * FROM app_schools WHERE id=9482')).toEqual(school2);
    expect(await sql(url, 'SELECT * FROM app_users WHERE id=9481')).toEqual(user);
    expect(await count('SELECT count(*) AS n FROM app_school_logo_assets')).toBe(assets);
    expect(await m.applyMigrations(url, dir)).toEqual([]);
    for (const file of held.filter(file => !changes.includes(file))) renameSync(join(dir, `${file}.held`), join(dir, file));
  });

  test('050 thêm học kỳ 1 và 2 vào năm học: năm học cũ giữ nguyên và chưa có học kỳ, CSDL chặn học kỳ sai', async () => {
    const held = readdirSync(dir).filter(name => /^\d+_.*\.sql$/.test(name) && Number(name.split('_')[0]) >= 50);
    expect(held.some(name => name.startsWith('050_'))).toBe(true);
    for (const file of held) renameSync(join(dir, file), join(dir, `${file}.held`));
    await m.applyMigrations(url, dir);
    await sql(url, `INSERT INTO app_schools(id,school_code,name,region) VALUES(9501,'9501','Trường có năm học cũ','Khu vực thử');
      INSERT INTO app_school_years(school_id,label,starts_on,ends_on,status) VALUES(9501,'2025-2026','2025-09-05','2026-05-31','active')`);
    const before = await sql(url, "SELECT id,label,starts_on,ends_on,status FROM app_school_years WHERE school_id=9501");
    expect(before).toHaveLength(1);
    const applied = held.filter(name => name.startsWith('050_'));
    for (const file of applied) renameSync(join(dir, `${file}.held`), join(dir, file));
    expect(await m.applyMigrations(url, dir)).toEqual(applied);
    // năm học đã có không đổi gì, bốn ngày học kỳ đều trống
    expect(await sql(url, "SELECT id,label,starts_on,ends_on,status FROM app_school_years WHERE school_id=9501")).toEqual(before);
    expect(await sql(url, "SELECT term1_starts_on,term1_ends_on,term2_starts_on,term2_ends_on FROM app_school_years WHERE school_id=9501")).toEqual([{ term1_starts_on: null, term1_ends_on: null, term2_starts_on: null, term2_ends_on: null }]);
    const insert = (terms: string) => sql(url, `INSERT INTO app_school_years(school_id,label,starts_on,ends_on,term1_starts_on,term1_ends_on,term2_starts_on,term2_ends_on) VALUES(9501,'2026-2027','2026-09-05','2027-05-31',${terms})`);
    await expect(insert("'2026-09-05',NULL,NULL,NULL")).rejects.toThrow(/app_school_years_terms_ok/);
    await expect(insert("'2026-09-05','2027-01-16','2027-01-10','2027-05-31'")).rejects.toThrow(/app_school_years_terms_ok/);
    await expect(insert("'2026-09-01','2027-01-16','2027-01-18','2027-05-31'")).rejects.toThrow(/app_school_years_terms_ok/);
    await insert("'2026-09-05','2027-01-16','2027-01-18','2027-05-31'");
    expect(await m.applyMigrations(url, dir)).toEqual([]);
    for (const file of held.filter(file => !applied.includes(file))) renameSync(join(dir, `${file}.held`), join(dir, file));
  });

  test('051 bổ sung/sửa đúng mẫu khung cũ, giữ lịch riêng, trạng thái và dữ liệu; không mở quyền thực thi công khai', async () => {
    const held = readdirSync(dir).filter(name => /^\d+_.*\.sql$/.test(name) && Number(name.split('_')[0]) >= 51);
    for (const file of held) renameSync(join(dir, file), join(dir, `${file}.held`));
    await m.applyMigrations(url, dir);
    await sql(url, `INSERT INTO app_schools(id,school_code,name) VALUES(9511,'9511','Trường kiểm thử khung');
      INSERT INTO app_school_years(school_id,label,starts_on,ends_on,status,ended_at,term1_starts_on,term1_ends_on,term2_starts_on,term2_ends_on) VALUES
      (9511,'2025-2026','2025-09-05','2026-05-31','ended','2026-06-01',NULL,NULL,NULL,NULL),
      (9511,'2026-2027','2026-09-05','2027-05-31','planned',NULL,'2026-09-05','2027-01-16','2027-01-18','2027-05-31'),
      (9511,'2020-2021','2020-09-05','2021-05-31','planned',NULL,'2020-09-05','2021-01-16','2021-01-18','2021-05-31'),
      (9511,'2024-2025','2024-09-09','2025-05-28','active',NULL,'2024-09-09','2025-01-10','2025-01-13','2025-05-28')`);
    const before = await sql(url, 'SELECT id,label,status,ended_at FROM app_school_years WHERE school_id=9511 ORDER BY id');
    const custom = await sql<any>(url, "SELECT to_jsonb(y) AS row FROM app_school_years y WHERE school_id=9511 AND label='2024-2025'");
    const applied = held.filter(name => name.startsWith('051_'));
    expect(applied).toHaveLength(1);
    for (const file of applied) renameSync(join(dir, `${file}.held`), join(dir, file));
    expect(await m.applyMigrations(url, dir)).toEqual(applied);
    expect(await sql(url, 'SELECT id,label,status,ended_at FROM app_school_years WHERE school_id=9511 ORDER BY id')).toEqual(before);
    const years = (await sql<any>(url, 'SELECT to_jsonb(y) AS row FROM app_school_years y WHERE school_id=9511 ORDER BY label')).map(item => item.row);
    expect(years.find(y => y.label === '2025-2026')).toMatchObject({ calendar_mode: 'national', term1_ends_on: '2026-01-17', term2_ends_on: '2026-05-30' });
    expect(years.find(y => y.label === '2026-2027')).toMatchObject({ calendar_mode: 'national', term1_ends_on: '2027-01-17', term2_starts_on: '2027-01-18' });
    expect(years.find(y => y.label === '2020-2021')).toMatchObject({ calendar_mode: 'national', term1_ends_on: '2021-01-15', term2_ends_on: '2021-05-24' });
    expect(years.find(y => y.label === '2024-2025')).toEqual({ ...custom[0].row, calendar_mode: 'manual' });
    expect((await sql<any>(url, "SELECT public.school_year_framework('2029-2030') AS f"))[0].f).toMatchObject({ decision: '2308/QĐ-BGDĐT', term1_finish_before: '2030-01-18', term1_teaching_weeks: 18, term2_teaching_weeks: 17 });
    for (const invalid of ['invalid', '2019-2020', '2026-2028']) expect((await sql<any>(url, 'SELECT public.school_year_framework($1) AS f', [invalid]))[0].f).toBeNull();
    expect(await sql(url, "SELECT a.privilege_type FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid='public.school_year_framework(text)'::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE'")).toEqual([]);
    expect(await m.applyMigrations(url, dir)).toEqual([]);
    for (const file of held.filter(file => !applied.includes(file))) renameSync(join(dir, `${file}.held`), join(dir, file));
  });

  test('053 bỏ cột bộ môn của giáo viên: dữ liệu bộ môn cũ mất cùng cột, mọi cột và tài khoản khác giữ nguyên', async () => {
    const held = readdirSync(dir).filter(name => /^\d+_.*\.sql$/.test(name) && Number(name.split('_')[0]) >= 53);
    expect(held.some(name => name.startsWith('053_'))).toBe(true);
    for (const file of held) renameSync(join(dir, file), join(dir, `${file}.held`));
    await m.applyMigrations(url, dir);
    await sql(url, `INSERT INTO app_schools(id,school_code,name,region) VALUES(9531,'9531','Trường có giáo viên','Khu vực thử');
      INSERT INTO app_users(id,username,full_name,role,password_hash,school_id,is_active,created_at,subject,email) VALUES(9531,'gv.bomon','Giáo viên bộ môn cũ','teacher','synthetic-hash',9531,1,'2026-11-08T00:00:00Z','Địa lí','gv.bomon@example.edu.vn')`);
    expect((await sql(url, 'SELECT subject FROM app_users WHERE id = 9531'))[0]).toEqual({ subject: 'Địa lí' });
    const { subject, ...before } = (await sql(url, 'SELECT * FROM app_users WHERE id = 9531'))[0];
    expect(subject).toBe('Địa lí');
    const applied = held.filter(name => name.startsWith('053_'));
    for (const file of applied) renameSync(join(dir, `${file}.held`), join(dir, file));
    expect(await m.applyMigrations(url, dir)).toEqual(applied);
    expect(await sql(url, "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'subject'")).toEqual([]);
    expect((await sql(url, 'SELECT * FROM app_users WHERE id = 9531'))[0]).toEqual(before);
    await expect(sql(url, "UPDATE app_users SET subject = 'x' WHERE id = 9531")).rejects.toThrow(/subject/);
    expect(await m.applyMigrations(url, dir)).toEqual([]);
    for (const file of held.filter(file => !applied.includes(file))) renameSync(join(dir, `${file}.held`), join(dir, file));
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
    for (const f of readdirSync(dir).filter((x) => /^0(1[4-9]|[2-9][0-9])_/.test(x))) {
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

  test('017–019 tạo ngân hàng câu hỏi, hành trình học và nội dung học mẫu ở trạng thái Nháp; mọi câu hỏi mẫu qua kiểm tra cấu trúc của máy chủ', async () => {
    await m.applyMigrations(url, dir);
    expect(await count("SELECT count(*) AS n FROM hk_questions WHERE scope = 'system' AND school_id IS NULL")).toBe(27);
    expect(await count('SELECT count(*) AS n FROM hk_question_versions')).toBe(27);
    expect(await count('SELECT count(*) AS n FROM hk_quizzes')).toBe(9);
    expect(await count('SELECT count(*) AS n FROM hk_quiz_questions')).toBe(40);
    expect(await count("SELECT count(*) AS n FROM hk_lessons WHERE status = 'draft'")).toBe(3);
    expect(await count("SELECT count(*) AS n FROM hk_lessons WHERE status <> 'draft'")).toBe(0);
    expect(await count("SELECT count(*) AS n FROM hk_lesson_checks")).toBe(3);
    expect(await count("SELECT count(*) AS n FROM hk_journeys WHERE scope = 'system' AND status = 'draft' AND NOT is_default")).toBe(3);
    // 14 nút của migration 019 + 15 nút lộ trình dạng đường đi của migration 027 (nghe kể chuyện, luyện tập, rương, kiểm tra cuối cửa)
    expect(await count('SELECT count(*) AS n FROM hk_nodes')).toBe(29);
    expect(await count("SELECT count(*) AS n FROM hk_nodes WHERE kind = 'final' AND pass_percent = 70")).toBe(3);
    expect(await count('SELECT count(*) AS n FROM hk_node_unlocks')).toBe(1);
    expect(await count('SELECT count(*) AS n FROM hk_question_links')).toBeGreaterThan(30);
    expect(await sql(url, "SELECT j.campaign_id, (SELECT kind FROM hk_nodes n WHERE n.journey_id = j.id ORDER BY position DESC LIMIT 1) AS last FROM hk_journeys j ORDER BY j.campaign_id")).toHaveLength(3);
    const { normalizeData } = await import('../src/content/questions');
    const { normalizeBlocks } = await import('../src/content/lesson.service');
    for (const q of await sql<{ id: number; qtype: never; prompt: string; data: Record<string, unknown> }>(url, 'SELECT id, qtype, prompt, data FROM hk_questions')) {
      expect(() => normalizeData(q.qtype, q.data, q.prompt)).not.toThrow();
      expect(normalizeData(q.qtype, q.data, q.prompt)).toEqual(q.data);
    }
    for (const l of await sql<{ blocks: unknown[] }>(url, 'SELECT blocks FROM hk_lessons')) expect(normalizeBlocks(l.blocks)).toEqual(l.blocks);
    // Mỗi bộ đề có ít nhất 3 câu; bộ đề Quyết chiến có đủ nhiều dạng câu hỏi
    expect(await count('SELECT count(*) AS n FROM (SELECT quiz_id FROM hk_quiz_questions GROUP BY quiz_id HAVING count(*) < 3) x')).toBe(0);
    expect(await count("SELECT count(DISTINCT t.qtype) AS n FROM hk_quiz_questions qq JOIN hk_questions t ON t.id = qq.question_id JOIN hk_quizzes z ON z.id = qq.quiz_id WHERE z.title LIKE 'Quyết chiến%'")).toBe(6);
    // Chạy lại không nhân đôi
    expect(await m.applyMigrations(url, dir)).toHaveLength(0);
  });

  test('020–021 tạo bảng trò chơi hóa và nội dung khởi tạo: cấp độ tăng dần, ba lớp nhân vật, huy hiệu có điều kiện hợp lệ, thẻ gắn nhân vật lịch sử', async () => {
    await m.applyMigrations(url, dir);
    expect(await sql(url, 'SELECT level, xp_required FROM hk_levels ORDER BY level')).toEqual([0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200].map((xp, i) => ({ level: i + 1, xp_required: xp })));
    expect((await sql<{ code: string }>(url, 'SELECT code FROM hk_character_classes ORDER BY sort_order')).map((r) => r.code)).toEqual(['tuong_quan', 'quan_su', 'luong_y']);
    expect(await count('SELECT count(*) AS n FROM hk_shop_items')).toBe(14);
    expect(await count("SELECT count(*) AS n FROM hk_shop_items WHERE kind IN ('outfit', 'weapon', 'banner') AND price = 0 AND min_level = 1")).toBe(3); // mỗi loại một đồ mặc định miễn phí
    expect(await count('SELECT count(*) AS n FROM hk_quest_templates')).toBe(8);
    expect(await count("SELECT count(*) AS n FROM hk_quest_templates WHERE period = 'daily'")).toBe(4);
    expect(await count('SELECT count(*) AS n FROM hk_badges WHERE rule IS NOT NULL')).toBe(12);
    expect(await count("SELECT count(*) AS n FROM hk_badges WHERE rule->>'type' = 'campaign_complete' AND (rule->>'campaign_id') IS NOT NULL")).toBe(3);
    expect(await count('SELECT count(*) AS n FROM hk_cards')).toBe(17); // 13 thẻ tướng (021) + 4 thẻ chiến thuật (029)
    expect(await count("SELECT count(*) AS n FROM hk_cards WHERE figure_id IS NULL AND kind = 'general'")).toBe(0); // thẻ tướng đều gắn nhân vật; thẻ chiến thuật (029) gắn sự kiện nên không có nhân vật
    expect(await sql(url, "SELECT rarity, count(*)::int AS n FROM hk_cards GROUP BY rarity ORDER BY rarity")).toEqual([{ rarity: 'common', n: 6 }, { rarity: 'epic', n: 4 }, { rarity: 'legendary', n: 2 }, { rarity: 'rare', n: 5 }]); // 029: hai thẻ tướng lên Sử thi và bốn thẻ chiến thuật
    expect(await count('SELECT count(*) AS n FROM hk_players')).toBe(0); // không tạo dữ liệu người chơi
    expect(await m.applyMigrations(url, dir)).toHaveLength(0);
  });

  test('022–023 tạo bảng mô phỏng trận đánh và mini-game; kịch bản và tham số khởi tạo hợp lệ theo engine; tất cả ở trạng thái Nháp', async () => {
    await m.applyMigrations(url, dir);
    const { normalizeScenario, normalizeMinigame } = await import('../src/battle/engine');
    expect(await count('SELECT count(*) AS n FROM hk_scenarios')).toBe(6);
    expect(await count("SELECT count(*) AS n FROM hk_scenarios WHERE status <> 'draft'")).toBe(0);
    expect((await sql<{ slug: string }>(url, 'SELECT b.slug FROM hk_scenarios s JOIN hist_battles b ON b.id = s.battle_id ORDER BY b.sort_order')).map((r) => r.slug)).toEqual(['dong-bo-dau', 'ham-tu', 'chuong-duong', 'tay-ket', 'van-don', 'bach-dang']);
    for (const row of await sql<{ content: unknown }>(url, 'SELECT content FROM hk_scenarios')) expect(normalizeScenario(row.content)).toEqual(row.content);
    expect(await count('SELECT count(*) AS n FROM hk_minigames')).toBe(4);
    expect(await count("SELECT count(*) AS n FROM hk_minigames WHERE status <> 'draft'")).toBe(0);
    for (const row of await sql<{ kind: 'match' | 'timeline' | 'crossword'; params: unknown }>(url, 'SELECT kind, params FROM hk_minigames')) expect(normalizeMinigame(row.kind, row.params)).toEqual(row.params);
    expect(await count('SELECT count(*) AS n FROM hk_game_runs')).toBe(0); // không tạo dữ liệu lượt chơi
    // điểm và vàng nhận thêm lý do mới nhưng vẫn từ chối lý do lạ
    await expect(sql(url, "INSERT INTO hk_points (user_id, points, reason, ref_key) VALUES (1, 1, 'khong-co', 'x')")).rejects.toThrow();
    expect(await m.applyMigrations(url, dir)).toHaveLength(0);
  });

  test('024 tạo bảng lớp học (đội, bài tập, bài nộp, thưởng/phạt, mục tiêu, yêu cầu rời lớp, kỹ năng, đường nối nút) có RLS; không tạo dữ liệu người dùng', async () => {
    await m.applyMigrations(url, dir);
    const tables = ['hk_teams', 'hk_team_members', 'hk_leave_requests', 'hk_adjustments', 'hk_class_goals', 'hk_assignments', 'hk_submissions', 'hk_skill_uses', 'hk_node_edges'];
    const rows = await sql<{ relname: string; rowsecurity: boolean }>(url, "SELECT c.relname, c.relrowsecurity AS rowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = ANY($1) ORDER BY c.relname", [tables]);
    expect(rows.map((r) => r.relname)).toEqual([...tables].sort());
    expect(rows.every((r) => r.rowsecurity)).toBe(true);
    for (const table of tables) expect(await count(`SELECT count(*) AS n FROM public.${table}`)).toBe(0);
    // điểm: giáo viên được trừ điểm nhưng không ghi dòng 0; lý do mới được chấp nhận
    const defs = (await sql<{ def: string }>(url, "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname IN ('hk_points_reason_check', 'hk_gold_ledger_reason_check', 'hk_points_points_check', 'hk_attempts_mode_check')")).map((r) => r.def).join(' ');
    expect(defs).toMatch(/'teacher'/);
    expect(defs).toMatch(/'assignment'/);
    expect(defs).toMatch(/points <> 0/);
    // lịch giao hành trình: kết thúc phải sau bắt đầu; nút mới có cột vị trí, điều kiện, thưởng
    expect(await count("SELECT count(*) AS n FROM information_schema.columns WHERE table_name = 'hk_nodes' AND column_name IN ('pos_x', 'pos_y', 'opens_at', 'min_percent', 'min_stars', 'reward_gold', 'reward_card_id', 'reward_badge_id')")).toBe(8);
    expect(await count("SELECT count(*) AS n FROM pg_constraint WHERE conname = 'hk_class_journeys_window_check'")).toBe(1);
    expect(await m.applyMigrations(url, dir)).toHaveLength(0);
  });

  test('nâng từ schema 24 giữ tài khoản, điểm, vàng và nút cũ; migration mới chỉ chạy một lần', async () => {
    const held = readdirSync(dir).filter((name) => name.endsWith('.sql') && Number(name.slice(0, 3)) > 24);
    for (const name of held) renameSync(join(dir, name), join(dir, `${name}.pending`));
    expect(await m.applyMigrations(url, dir)).toHaveLength(24);
    await sql(url, `INSERT INTO public.app_users (id, username, full_name, role, password_hash, created_at)
      VALUES (991, 'upgrade-fixture', 'Upgrade fixture', 'student', 'fake-test-hash', '2026-11-01');
      INSERT INTO public.hk_players (user_id, xp, gold, hearts) VALUES (991, 105, 37, 3);
      INSERT INTO public.hk_points (user_id, points, reason, ref_key) VALUES (991, -5, 'teacher', 'upgrade-fixture');`);
    const oldNodes = await sql(url, 'SELECT id, title, kind FROM public.hk_nodes ORDER BY id');
    for (const name of held) renameSync(join(dir, `${name}.pending`), join(dir, name));
    expect(await m.applyMigrations(url, dir)).toHaveLength(TOTAL - 24);
    expect(await sql(url, 'SELECT username, full_name FROM public.app_users WHERE id = 991')).toEqual([{ username: 'upgrade-fixture', full_name: 'Upgrade fixture' }]);
    expect(await sql(url, 'SELECT xp, gold, hearts, binh_thu FROM public.hk_players WHERE user_id = 991')).toEqual([{ xp: 105, gold: 37, hearts: 3, binh_thu: 0 }]);
    expect(await sql(url, 'SELECT points, reason, ref_key FROM public.hk_points WHERE user_id = 991')).toEqual([{ points: -5, reason: 'teacher', ref_key: 'upgrade-fixture' }]);
    expect(await sql(url, 'SELECT id, title, kind FROM public.hk_nodes ORDER BY id')).toEqual(expect.arrayContaining(oldNodes));
    expect(await count('SELECT max(version) AS n FROM public.app_schema_migrations')).toBe(TOTAL);
    expect(await m.applyMigrations(url, dir)).toEqual([]);
  });

  test('025 tạo bảng thi đấu trực tiếp (phòng, người chơi, câu trả lời) có RLS; mã PIN chỉ duy nhất giữa các phòng chưa kết thúc; thêm lý do điểm "live"', async () => {
    await m.applyMigrations(url, dir);
    const tables = ['hk_live_rooms', 'hk_live_players', 'hk_live_answers'];
    const rows = await sql<{ relname: string; rowsecurity: boolean }>(url, "SELECT c.relname, c.relrowsecurity AS rowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = ANY($1) ORDER BY c.relname", [tables]);
    expect(rows.map((r) => r.relname)).toEqual([...tables].sort());
    expect(rows.every((r) => r.rowsecurity)).toBe(true);
    for (const table of tables) expect(await count(`SELECT count(*) AS n FROM public.${table}`)).toBe(0);
    const defs = (await sql<{ def: string }>(url, "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'hk_points_reason_check'")).map((r) => r.def).join(' ');
    expect(defs).toMatch(/'live'/);
    expect(defs).toMatch(/'teacher'/); // giữ nguyên các lý do cũ
    const idx = (await sql<{ indexdef: string }>(url, "SELECT indexdef FROM pg_indexes WHERE indexname = 'hk_live_rooms_pin_open'"))[0].indexdef;
    expect(idx).toMatch(/UNIQUE/);
    expect(idx).toMatch(/WHERE/);
    expect(await count("SELECT count(*) AS n FROM pg_indexes WHERE indexname = 'hk_live_players_nickname'")).toBe(1);
    expect(await m.applyMigrations(url, dir)).toHaveLength(0);
  });

  test('026–027 thêm Cửa, bốn loại nút mới, Binh thư (có RLS); chia ba hành trình mẫu thành các Cửa mà không đổi trạng thái Nháp hay làm mất nút cũ', async () => {
    await m.applyMigrations(url, dir);
    for (const table of ['hk_gates', 'hk_binh_thu_ledger']) {
      expect((await sql<{ rowsecurity: boolean }>(url, "SELECT c.relrowsecurity AS rowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = $1", [table]))[0].rowsecurity).toBe(true);
    }
    const kinds = (await sql<{ def: string }>(url, "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'hk_nodes_kind_check'"))[0].def;
    for (const kind of ['practice', 'listen', 'chest', 'gate_test', 'final']) expect(kinds).toContain(`'${kind}'`);
    // Hành trình mẫu: vẫn là bản nháp, mỗi hành trình có đúng 2 Cửa, nút cũ còn nguyên, nút Quyết chiến vẫn ở cuối
    const journeys = await sql<{ id: number; status: string; gates: string; nodes: string; last: string }>(
      url, `SELECT j.id, j.status, (SELECT count(*) FROM public.hk_gates g WHERE g.journey_id = j.id) AS gates, (SELECT count(*) FROM public.hk_nodes n WHERE n.journey_id = j.id) AS nodes,
              (SELECT n.kind FROM public.hk_nodes n WHERE n.journey_id = j.id ORDER BY n.position DESC LIMIT 1) AS last FROM public.hk_journeys j WHERE j.scope = 'system' ORDER BY j.id`);
    expect(journeys).toHaveLength(3);
    for (const j of journeys) {
      expect(j.status).toBe('draft');
      expect(Number(j.gates)).toBe(2);
      expect(j.last).toBe('final');
    }
    expect(journeys.map((j) => Number(j.nodes))).toEqual([9, 11, 9]);
    // Vị trí liên tục từ 1 và mọi nút của hành trình có Cửa
    expect(await count("SELECT count(*) AS n FROM (SELECT journey_id, count(*) AS c, max(position) AS mx, min(position) AS mn FROM public.hk_nodes GROUP BY journey_id) x WHERE c <> mx OR mn <> 1")).toBe(0);
    expect(await count('SELECT count(*) AS n FROM public.hk_nodes WHERE gate_id IS NULL')).toBe(0);
    // Chạy lại không nhân đôi nút (migration chỉ động vào hành trình chưa chia Cửa)
    expect(await m.applyMigrations(url, dir)).toHaveLength(0);
    expect(await count('SELECT count(*) AS n FROM public.hk_gates')).toBe(6);
  });

  test('028–029 tạo bảng game thẻ tướng (có RLS) và nội dung khởi tạo ở trạng thái Nháp: thẻ Sử thi và thẻ chiến thuật, chiêu thức, 6 màn chơi, 3 bản đồ hành quân, hội thoại, chỉ huy', async () => {
    await m.applyMigrations(url, dir);
    const tables = ['hk_card_fragments', 'hk_card_moves', 'hk_formations', 'hk_commanders', 'hk_commanders_seen', 'hk_stages', 'hk_war_battles', 'hk_stage_progress', 'hk_march_maps', 'hk_march_points',
      'hk_march_edges', 'hk_dialogs', 'hk_march_state', 'hk_march_visits', 'hk_dialog_log', 'hk_game_assets', 'hk_war_play'];
    expect(await count(`SELECT count(*) AS n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = ANY(ARRAY[${tables.map((t) => `'${t}'`).join(',')}]) AND c.relrowsecurity`)).toBe(tables.length);
    expect((await sql<{ def: string }>(url, "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'hk_cards_rarity_check'"))[0].def).toContain("'epic'");
    expect(await count("SELECT count(*) AS n FROM hk_cards WHERE kind = 'tactic' AND tactic IS NOT NULL")).toBe(4);
    expect(await count("SELECT count(*) AS n FROM hk_cards WHERE rarity = 'epic'")).toBe(4);
    expect(await count("SELECT count(*) AS n FROM hk_cards WHERE kind = 'general' AND branch IS NOT NULL")).toBe(13);
    expect(await count('SELECT count(*) AS n FROM hk_card_moves')).toBe(31);
    expect(await count('SELECT count(*) AS n FROM hk_commanders')).toBe(5);
    expect(await count("SELECT count(*) AS n FROM hk_stages WHERE status = 'draft'")).toBe(6);
    expect(await count("SELECT count(*) AS n FROM hk_march_maps WHERE status = 'draft'")).toBe(3);
    expect((await sql<{ n: string }>(url, 'SELECT count(*) AS n FROM hk_march_points GROUP BY map_id ORDER BY map_id')).map((r) => Number(r.n))).toEqual([6, 8, 6]);
    expect(await count("SELECT count(*) AS n FROM hk_dialogs WHERE status = 'draft'")).toBe(6);
    // mọi điểm trận đánh trỏ tới một màn chơi có thật và mọi điểm có đường nối
    expect(await count("SELECT count(*) AS n FROM hk_march_points p WHERE p.kind = 'battle' AND NOT EXISTS (SELECT 1 FROM hk_stages s WHERE s.id = (p.payload->>'stage_id')::int)")).toBe(0);
    expect(await count('SELECT count(*) AS n FROM hk_march_points p WHERE NOT EXISTS (SELECT 1 FROM hk_march_edges e WHERE e.from_point = p.id OR e.to_point = p.id)')).toBe(0);
    for (const col of ['war_enabled', 'war_grades', 'war_from', 'war_to', 'war_minutes']) expect(await count(`SELECT count(*) AS n FROM information_schema.columns WHERE table_name = 'hk_school_settings' AND column_name = '${col}'`)).toBe(1);
    expect(await m.applyMigrations(url, dir)).toHaveLength(0);
    expect(await count('SELECT count(*) AS n FROM hk_card_moves')).toBe(31); // dữ liệu khởi tạo không nhân đôi
  });

  test('030 tạo bảng AI Tutor (có RLS), cấu hình mặc định một dòng và không lưu khóa API dạng rõ', async () => {
    await m.applyMigrations(url, dir);
    const tables = ['hk_ai_settings', 'hk_ai_school_limits', 'hk_ai_docs', 'hk_ai_chunks', 'hk_ai_conversations', 'hk_ai_messages', 'hk_ai_reports'];
    expect(await count(`SELECT count(*) AS n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = ANY(ARRAY[${tables.map((t) => `'${t}'`).join(',')}]) AND c.relrowsecurity`)).toBe(tables.length);
    expect(await count('SELECT count(*) AS n FROM hk_ai_settings')).toBe(1);
    expect(await count("SELECT count(*) AS n FROM hk_ai_settings WHERE provider = 'none' AND api_key_enc IS NULL AND length(system_prompt) > 100")).toBe(1);
    await expect(sql(url, "INSERT INTO public.hk_ai_settings (id, system_prompt, refusal_message) VALUES (2, repeat('x', 30), repeat('y', 10))")).rejects.toThrow(); // chỉ một dòng cấu hình
    expect(await m.applyMigrations(url, dir)).toHaveLength(0);
    expect(await count('SELECT count(*) AS n FROM hk_ai_settings')).toBe(1);
  });

  test('031–034 (Sprint 10–12) tạo bảng gợi ý, nền tảng, khảo sát và nghiên cứu đều có RLS; dữ liệu khởi tạo đúng; giữ nguyên nhật ký đăng nhập cũ', async () => {
    await m.applyMigrations(url, dir);
    const tables = ['hk_reco_settings', 'hk_recommendations', 'hk_feedback_mails', 'hk_user_prefs', 'hk_broadcasts', 'hk_support_tickets', 'hk_support_messages', 'hk_faq', 'hk_system_settings', 'hk_feature_flags',
      'hk_message_templates', 'hk_permission_features', 'hk_permissions', 'hk_two_factor', 'hk_two_factor_codes', 'hk_error_log', 'hk_job_heartbeats', 'hk_backups', 'hk_survey_templates', 'hk_surveys',
      'hk_survey_responses', 'hk_experiment_groups', 'hk_experiment_classes'];
    expect(await count(`SELECT count(*) AS n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = ANY(ARRAY[${tables.map((t) => `'${t}'`).join(',')}]) AND c.relrowsecurity`)).toBe(tables.length);
    // ma trận phân quyền theo đặc tả: 38 nhóm × 4 vai trò, 8 tính năng đã nối, quyền gốc trùng quyền hiện hành
    expect(await count('SELECT count(*) AS n FROM hk_permission_features')).toBe(38);
    expect(await count('SELECT count(*) AS n FROM hk_permissions')).toBe(152);
    expect(await count('SELECT count(*) AS n FROM hk_permission_features WHERE enforced')).toBe(8);
    expect(await count('SELECT count(*) AS n FROM hk_permissions WHERE allowed <> baseline')).toBe(0);
    expect(await count("SELECT count(*) AS n FROM hk_permissions WHERE feature_key = 'reports' AND allowed")).toBe(3);
    expect(await count('SELECT count(*) AS n FROM hk_feature_flags WHERE enabled')).toBe(8);
    expect(await count('SELECT count(*) AS n FROM hk_system_settings')).toBe(1);
    expect(await count("SELECT count(*) AS n FROM hk_system_settings WHERE language = 'vi' AND timezone = 'Asia/Ho_Chi_Minh' AND rate_ip_per_min IS NULL AND backup_enabled")).toBe(1);
    await expect(sql(url, "INSERT INTO public.hk_system_settings (id) VALUES (2)")).rejects.toThrow(); // chỉ một dòng cấu hình
    expect(await count('SELECT count(*) AS n FROM hk_reco_settings')).toBe(1);
    expect(await count("SELECT count(DISTINCT audience) AS n FROM hk_faq")).toBe(4);
    expect(await count('SELECT count(*) AS n FROM hk_faq WHERE is_published')).toBeGreaterThanOrEqual(30);
    expect(await count('SELECT count(*) AS n FROM hk_survey_templates WHERE is_active')).toBe(3);
    expect(await count("SELECT count(*) AS n FROM hk_survey_templates WHERE jsonb_array_length(questions) >= 7")).toBe(3);
    expect(await count('SELECT count(*) AS n FROM hk_message_templates')).toBe(0); // mẫu thư mặc định nằm trong mã nguồn
    for (const bad of ["INSERT INTO hk_faq (audience, category, question, answer, image_url) VALUES ('all', 'x', 'Câu hỏi hợp lệ?', 'Trả lời hợp lệ', 'http://khong-bao-mat.vn/a.png')",
      "INSERT INTO hk_support_tickets (user_id, role, category, subject, body) VALUES (1, 'student', 'khac', 'Tiêu đề', 'Nội dung đủ dài')",
      "INSERT INTO hk_survey_templates (title, audience, questions) VALUES ('Mẫu rỗng', 'student', '[]')",
      "INSERT INTO hk_experiment_groups (name) VALUES ('x')"]) await expect(sql(url, bad)).rejects.toThrow();
    expect(await m.applyMigrations(url, dir)).toHaveLength(0);
    expect(await count('SELECT count(*) AS n FROM hk_permissions')).toBe(152); // dữ liệu khởi tạo không nhân đôi
  });

  test('037 (giải đấu cấu hình số hạng) nới ràng buộc hạng lên 0–9, mỗi cột còn đúng một ràng buộc và chạy lại không đổi gì', async () => {
    await m.applyMigrations(url, dir);
    for (const [table, col] of [['hk_players', 'league_tier'], ['hk_league_members', 'tier']]) {
      const defs = await sql<{ def: string }>(url, `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'public.${table}'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%${col}%'`);
      expect(defs).toHaveLength(1);
      expect(defs[0].def).toMatch(/<= 9/);
      expect(defs[0].def).not.toMatch(/<= 3/);
    }
    expect(await m.applyMigrations(url, dir)).toHaveLength(0);
  });

  test('038 (bình chọn, video và nhạc tải lên) nới ràng buộc loại câu hỏi, video câu hỏi và kho tệp; mỗi cột còn đúng một ràng buộc; chạy lại không đổi gì', async () => {
    await m.applyMigrations(url, dir);
    const one = async (table: string, like: string): Promise<string> => {
      const defs = await sql<{ def: string }>(url, `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'public.${table}'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%${like}%'`);
      expect(defs).toHaveLength(1);
      return defs[0].def;
    };
    expect(await one('hk_questions', 'qtype')).toMatch(/'poll'/);
    expect(await one('hk_questions', 'video_url')).toMatch(/api\/content\/media/);
    expect(await one('hk_media', 'audio/ogg')).toMatch(/video\/mp4.*video\/webm.*audio\/mpeg.*audio\/ogg/);
    expect(await one('hk_media', '8388608')).toMatch(/size_bytes/);
    // câu bình chọn lưu được; loại lạ và video lạ vẫn bị từ chối
    await sql(url, "INSERT INTO hk_questions (scope, qtype, prompt, data) VALUES ('system', 'poll', 'Câu bình chọn thử nghiệm', '{\"options\": []}')");
    await expect(sql(url, "INSERT INTO hk_questions (scope, qtype, prompt, data) VALUES ('system', 'vote', 'Loại câu hỏi lạ', '{}')")).rejects.toThrow();
    await sql(url, "INSERT INTO hk_questions (scope, qtype, prompt, data, video_url) VALUES ('system', 'truefalse', 'Có video tải lên', '{\"correct\": true}', '/api/content/media/' || repeat('a', 32))");
    await expect(sql(url, "INSERT INTO hk_questions (scope, qtype, prompt, data, video_url) VALUES ('system', 'truefalse', 'Video lạ', '{\"correct\": true}', 'http://khong-bao-mat.vn/v.mp4')")).rejects.toThrow();
    // kho tệp: video và nhạc nhận tới 8 MB, ảnh vẫn tối đa 1,5 MB
    const media = (mime: string, size: number) => `INSERT INTO hk_media (token, mime, size_bytes, data) VALUES (md5(random()::text), '${mime}', ${size}, '\\x00')`;
    for (const ok of [media('video/mp4', 8388608), media('video/webm', 1000), media('audio/mpeg', 4000000), media('audio/ogg', 5), media('image/png', 1572864)]) await sql(url, ok);
    for (const bad of [media('video/mp4', 8388609), media('image/png', 1572865), media('image/gif', 5000000), media('video/avi', 100), media('audio/wav', 100), media('video/mp4', 0)]) await expect(sql(url, bad)).rejects.toThrow();
    expect(await m.applyMigrations(url, dir)).toHaveLength(0);
  });

  test('035–036 (ver0.2 Sprint 7–8) thêm bảng ảnh tải lên, bản nháp Quiz, yêu cầu vào phòng, nhật ký phòng, gắn cửa – trận đều có RLS; ràng buộc đúng; sa bàn khởi tạo cho 6 trận', async () => {
    await m.applyMigrations(url, dir);
    const tables = ['hk_media', 'hk_quiz_drafts', 'hk_live_requests', 'hk_live_events', 'hk_class_battle_links'];
    expect(await count(`SELECT count(*) AS n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = ANY(ARRAY[${tables.map((t) => `'${t}'`).join(',')}]) AND c.relrowsecurity`)).toBe(tables.length);
    // phòng thi: thêm chế độ đánh trùm, mặc định chống tra cứu bật, tự khóa khi bắt đầu không áp cho phòng cũ (NULL = không tự khóa)
    const cols = await sql<{ column_name: string; column_default: string | null }>(url, "SELECT column_name, column_default FROM information_schema.columns WHERE table_name = 'hk_live_rooms' AND column_name IN ('locked', 'profile_names', 'hide_on_device', 'shuffle_device', 'tab_alert', 'auto_lock_seconds')");
    const dflt = Object.fromEntries(cols.map((c) => [c.column_name, c.column_default]));
    expect(dflt).toMatchObject({ locked: 'false', profile_names: 'true', hide_on_device: 'true', shuffle_device: 'true', tab_alert: 'true' });
    expect(dflt.auto_lock_seconds).toBeNull();
    const modeCheck = (await sql<{ def: string }>(url, "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'public.hk_live_rooms'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%mode%boss%'"));
    expect(modeCheck).toHaveLength(1);
    // ảnh câu hỏi: nhận liên kết https và ảnh tải lên, từ chối còn lại
    const imgCheck = (await sql<{ def: string }>(url, "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'public.hk_questions'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%image_url%'"));
    expect(imgCheck).toHaveLength(1);
    expect(imgCheck[0].def).toMatch(/api\/content\/media/);
    for (const bad of ["INSERT INTO hk_media (token, mime, size_bytes, data) VALUES ('abc', 'image/png', 1, '\x00')", "INSERT INTO hk_media (token, mime, size_bytes, data) VALUES (repeat('a', 32), 'image/svg+xml', 1, '\x00')",
      "INSERT INTO hk_media (token, mime, size_bytes, data) VALUES (repeat('b', 32), 'image/png', 9999999, '\x00')", "INSERT INTO hk_live_requests (room_id, user_id, status) VALUES (1, 1, 'khac')",
      "INSERT INTO hk_live_events (room_id, kind) VALUES (1, 'khong-co')"]) await expect(sql(url, bad)).rejects.toThrow();
    await expect(sql(url, "UPDATE hk_quizzes SET theme = '[]' WHERE id = (SELECT min(id) FROM hk_quizzes)")).rejects.toThrow(); // giao diện của Quiz phải là một đối tượng
    await expect(sql(url, "UPDATE hk_quizzes SET cover_url = 'javascript:alert(1)' WHERE id = (SELECT min(id) FROM hk_quizzes)")).rejects.toThrow(); // ảnh bìa chỉ nhận https hoặc ảnh đã tải lên
    expect(await count("SELECT count(*) AS n FROM pg_constraint WHERE conrelid = 'public.hk_class_settings'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%war_minutes%'")).toBe(1); // phút chơi từ 5 đến 240
    // sa bàn khởi tạo (Nháp) cho 6 trận, đúng dạng
    expect(await count("SELECT count(*) AS n FROM hk_stages WHERE sandtable IS NOT NULL AND status = 'draft' AND jsonb_array_length(sandtable->'steps') >= 3 AND jsonb_array_length(sandtable->'armies') = 2")).toBe(6);
    expect(await count("SELECT count(*) AS n FROM hk_stages WHERE sandtable->>'note' LIKE '%minh họa%'")).toBe(6);
    expect(await m.applyMigrations(url, dir)).toHaveLength(0);
    expect(await count('SELECT count(*) AS n FROM hk_stages WHERE sandtable IS NOT NULL')).toBe(6); // không nhân đôi hay ghi đè
  });

  test('032 giữ nguyên nhật ký đăng nhập và hàng đợi thư cũ, thêm cột IP và loại thư mới', async () => {
    const held = readdirSync(dir).filter((name) => name.endsWith('.sql') && Number(name.slice(0, 3)) > 31);
    for (const name of held) renameSync(join(dir, name), join(dir, `${name}.pending`));
    expect(await m.applyMigrations(url, dir)).toHaveLength(31);
    await sql(url, "INSERT INTO public.app_users (id, username, full_name, role, password_hash, created_at) VALUES (950, 'cu950', 'Người Cũ', 'teacher', 'x', '2026-10-01T00:00:00Z')");
    await sql(url, "INSERT INTO public.app_login_events (user_id, username, portal, success, reason) VALUES (950, 'cu950', 'teacher', true, 'success'), (NULL, 'la', 'teacher', false, 'credentials')");
    await sql(url, "INSERT INTO public.app_email_outbox (user_id, kind, to_email, subject, body_encrypted) VALUES (950, 'bulk', 'cu@example.edu.vn', 'Thư cũ', 'x')");
    for (const name of held) renameSync(join(dir, `${name}.pending`), join(dir, name));
    expect(await m.applyMigrations(url, dir)).toHaveLength(TOTAL - 31);
    expect(await sql(url, 'SELECT username, success, reason, ip, user_agent FROM public.app_login_events ORDER BY id')).toEqual([
      { username: 'cu950', success: true, reason: 'success', ip: null, user_agent: null }, { username: 'la', success: false, reason: 'credentials', ip: null, user_agent: null }]);
    expect(await count("SELECT count(*) AS n FROM public.app_email_outbox WHERE kind = 'bulk' AND subject = 'Thư cũ'")).toBe(1);
    await sql(url, "INSERT INTO public.app_email_outbox (user_id, kind, to_email, subject, body_encrypted) VALUES (950, 'notice', 'cu@example.edu.vn', 'Nhắc học', 'x')");
    await sql(url, "INSERT INTO public.app_login_events (user_id, username, portal, success, reason, ip, user_agent) VALUES (950, 'cu950', 'root_admin', false, 'two_factor', '203.0.113.9', 'Chrome')");
    await expect(sql(url, "INSERT INTO public.app_login_events (username, portal, success, reason) VALUES ('x', 'teacher', false, 'khong-co')")).rejects.toThrow();
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
