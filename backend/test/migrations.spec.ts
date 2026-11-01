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
    expect(await count('SELECT count(*) AS n FROM hk_nodes')).toBe(14);
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
    expect(await count('SELECT count(*) AS n FROM hk_cards')).toBe(13);
    expect(await count('SELECT count(*) AS n FROM hk_cards WHERE figure_id IS NULL')).toBe(0);
    expect(await sql(url, "SELECT rarity, count(*)::int AS n FROM hk_cards GROUP BY rarity ORDER BY rarity")).toEqual([{ rarity: 'common', n: 6 }, { rarity: 'legendary', n: 2 }, { rarity: 'rare', n: 5 }]);
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
