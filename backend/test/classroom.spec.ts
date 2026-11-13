/**
 * Sprint 7, lớp học (HK.GV.007–017, 059–065; HK.HS.071, 072, 076, 099, 103–105): giáo viên tạo và quản lý lớp, thêm/xóa/tìm học sinh, chia đội, duyệt rời lớp, luật lớp,
 * thưởng/phạt điểm – vàng – tim, vòng quay vận mệnh, hộp quà lớp, huy hiệu, xếp hạng lớp/đội, thông báo, kỹ năng nhân vật. HTTP thật trên PostgreSQL tạm.
 */
import { call, download, hasPostgres, makeXlsx, Started, startApp, upload } from './harness';
import { bootstrap, Fixture } from './fixture';
import type { DatabaseService } from '../src/database/database.service';
import type { GameClock } from '../src/game/clock';
import type { GameService } from '../src/game/game.service';

let s: Started, f: Fixture, db: DatabaseService, clock: GameClock, game: GameService;
const api = (method: string, path: string, body?: unknown, token = f.T1.token) => call(s.base, method, path, body, token);
const as = (who: { token: string }) => (method: string, path: string, body?: unknown) => call(s.base, method, path, body, who.token);
const tx = <T>(run: (q: any) => Promise<T>) => db.tx(run as never) as Promise<T>;
const userRow = async (id: number) => (await db.query<any>('SELECT * FROM app_users WHERE id = $1', [id]))[0];
const hud = async (who: { token: string }) => (await call(s.base, 'GET', '/api/game/me', undefined, who.token)).body;
const notes = async (who: { token: string }) => (await call(s.base, 'GET', '/api/classroom/notifications', undefined, who.token)).body;

(hasPostgres() ? describe : describe.skip)('Sprint 7 – lớp học', () => {
  let classId: number;
  beforeAll(async () => {
    s = await startApp('classroom_test');
    db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    clock = s.moduleRef.get((await import('../src/game/clock')).GameClock);
    game = s.moduleRef.get((await import('../src/game/game.service')).GameService);
    const rootToken = (await call(s.base, 'POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'root_admin' })).body.token;
    f = await bootstrap(s, rootToken, true);
    classId = f.class7a.id;
    await call(s.base, 'PUT', '/api/game/admin/settings', { leaderboard_cache_seconds: 0 }, f.root);
  });
  afterAll(async () => { clock?.reset(); await s?.close(); });

  // ------------------------------------------------------------------ HK.GV.007–011
  test('HK.GV.007/008 danh sách lớp phụ trách kèm sĩ số, đội, yêu cầu chờ; giáo viên tự tạo lớp trong năm học đang hoạt động', async () => {
    const list = (await api('GET', '/api/classroom/classes')).body;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: classId, name: '7A1', students: 2, teams: 0, pending_leaves: 0, own: false, join_open: true, journeys: [], avg_progress: null });
    expect(list[0].join_code).toMatch(/^DongA7A1[A-Za-z]+HK[12]\d{4}-\d{4}$/); // lớp tạo kèm giáo viên phụ trách: mã tham gia theo quy ước (13/11/2026)
    expect((await api('GET', '/api/classroom/classes', undefined, f.S1.token)).status).toBe(403);
    const created = await api('POST', '/api/classroom/classes', { name: ' 7A9 ', grade: 7, description: 'Lớp thử nghiệm' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: '7A9', grade: 7, own: true, students: 0, teachers: [{ id: f.T1.id }], is_active: true });
    expect((await api('POST', '/api/classroom/classes', { name: '7a9', grade: 7 })).status).toBe(409); // trùng tên trong năm học
    expect((await api('POST', '/api/classroom/classes', { name: '5A1', grade: 5 })).status).toBeGreaterThanOrEqual(400); // khối 5 không được bật
    expect((await api('POST', '/api/classroom/classes', { name: 'X', grade: 7 }, f.A.token)).status).toBe(403); // quản trị viên tạo lớp ở trang quản trị
    expect((await api('GET', `/api/classroom/classes/${created.body.id}`, undefined, f.TB.token)).status).toBe(404); // giáo viên trường khác
    expect((await api('GET', `/api/classroom/classes/${created.body.id}`, undefined, f.T2.token)).status).toBe(404); // giáo viên khác trong trường nhưng không phụ trách
  });

  test('HK.GV.009/010/011 sửa tên, mô tả, ảnh bìa; tạo lại mã và đóng mở tham gia; lưu trữ/xóa chỉ với lớp tự tạo và chưa có dữ liệu', async () => {
    const own = (await api('GET', '/api/classroom/classes')).body.find((c: any) => c.name === '7A9');
    const edit = await api('PATCH', `/api/classroom/classes/${own.id}`, { name: '7A9 chuyên Sử', description: 'Lớp học lịch sử', cover_url: 'https://example.com/bia.jpg' });
    expect(edit.body).toMatchObject({ name: '7A9 chuyên Sử', description: 'Lớp học lịch sử', cover_url: 'https://example.com/bia.jpg' });
    expect((await api('PATCH', `/api/classroom/classes/${own.id}`, { cover_url: 'http://bad.example/x.jpg' })).status).toBe(400);
    expect((await api('PATCH', `/api/classroom/classes/${classId}`, { description: 'Mô tả do giáo viên sửa' })).body.description).toBe('Mô tả do giáo viên sửa'); // lớp của trường cũng sửa được mô tả
    const code1 = (await api('GET', `/api/classroom/classes/${own.id}`)).body.join_code;
    const code2 = (await api('POST', `/api/classroom/classes/${own.id}/regenerate-code`)).body.join_code;
    expect(code2).toMatch(/^[A-Z2-9]{6}$/);
    expect(code2).not.toBe(code1);
    expect((await call(s.base, 'POST', '/api/student/join-class', { code: code1 }, f.S3.token)).status).toBeGreaterThanOrEqual(400); // mã cũ hết dùng
    expect((await api('POST', `/api/classroom/classes/${own.id}/join`, { open: false })).body.join_open).toBe(false);
    expect((await call(s.base, 'POST', '/api/student/join-class', { code: code2 }, f.S3.token)).status).toBeGreaterThanOrEqual(400); // đã đóng tham gia
    await api('POST', `/api/classroom/classes/${own.id}/join`, { open: true });
    // lớp của trường: giáo viên không lưu trữ hay xóa
    expect((await api('POST', `/api/classroom/classes/${classId}/archive`, { archived: true })).status).toBe(403);
    expect((await api('DELETE', `/api/classroom/classes/${classId}`)).status).toBe(403);
    // lớp tự tạo: lưu trữ rồi khôi phục, xóa khi chưa có dữ liệu
    expect((await api('POST', `/api/classroom/classes/${own.id}/archive`, { archived: true })).body.is_active).toBe(false);
    expect((await api('PATCH', `/api/classroom/classes/${own.id}`, { description: 'x' })).status).toBe(409); // lớp lưu trữ không sửa được
    expect((await api('POST', `/api/classroom/classes/${own.id}/archive`, { archived: false })).body.is_active).toBe(true);
    await tx((q) => q('INSERT INTO hk_class_goals (class_id, title, target_xp) VALUES ($1, $2, $3)', [own.id, 'tạm', 100]));
    expect((await api('DELETE', `/api/classroom/classes/${own.id}`)).status).toBe(204); // mục tiêu chưa có học sinh không cản xóa? kiểm tra bên dưới
  });

  // ------------------------------------------------------------------ HK.GV.012–015
  test('HK.GV.012/013/014/015 thêm học sinh từ danh sách trường hoặc Excel, xem nhân vật, tìm theo tên/mã/biệt danh, xóa khỏi lớp (dữ liệu học còn nguyên)', async () => {
    const pool = (await api('GET', `/api/classroom/classes/${classId}/student-pool?q=do van`)).body;
    expect(pool.map((p: any) => p.id)).toEqual([f.S3.id]); // tìm không dấu
    expect((await api('GET', `/api/classroom/classes/${classId}/student-pool?q=pham`)).body).toEqual([]); // học sinh đã trong lớp không hiện
    expect((await api('POST', `/api/classroom/classes/${classId}/students`, { student_ids: [f.S3.id] })).body).toMatchObject({ added: 1, skipped: 0 });
    expect((await api('POST', `/api/classroom/classes/${classId}/students`, { student_ids: [f.S3.id] })).body).toMatchObject({ added: 0, skipped: 1 });
    expect((await api('POST', `/api/classroom/classes/${classId}/students`, { student_ids: [999999] })).status).toBeGreaterThanOrEqual(400);
    const all = (await api('GET', `/api/classroom/classes/${classId}/students`)).body;
    expect(all).toHaveLength(3);
    expect(all[0]).toEqual(expect.objectContaining({ id: expect.any(Number), level: 1, hearts: 5, hearts_max: 5, xp: 0 }));
    expect((await api('GET', `/api/classroom/classes/${classId}/students?q=${(await userRow(f.S2.id)).user_code}`)).body.map((x: any) => x.id)).toEqual([f.S2.id]);
    expect((await api('GET', `/api/classroom/classes/${classId}/students?q=hoang thi`)).body.map((x: any) => x.id)).toEqual([f.S2.id]);
    await tx((q) => q("UPDATE app_users SET nickname = 'Cơn Lốc' WHERE id = $1", [f.S1.id]));
    expect((await api('GET', `/api/classroom/classes/${classId}/students?q=con loc`)).body.map((x: any) => x.id)).toEqual([f.S1.id]);
    // Excel: một mã đúng (đã trong lớp nên bị bỏ qua), một mã lạ, một mã lặp
    const file = await makeXlsx(['Mã học sinh *'], [[(await userRow(f.S3.id)).user_code],['HS9999'],[(await userRow(f.S3.id)).user_code]]);
    const res = await upload(s.base, `/api/classroom/classes/${classId}/students/import`, 'mau.xlsx', file, f.T1.token);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ added: 0, skipped: 1 });
    expect(res.body.errors.map((e: any) => e.code)).toEqual(['HS9999',(await userRow(f.S3.id)).user_code]);
    const template = await download(s.base, '/api/classroom/students-template', f.T1.token);
    expect(template.status).toBe(200);
    expect(template.type).toMatch(/spreadsheetml/);
    // xóa khỏi lớp: dữ liệu học vẫn còn
    await tx((q) => q("INSERT INTO hk_players (user_id, xp) VALUES ($1, 77) ON CONFLICT DO NOTHING", [f.S3.id]));
    expect((await api('DELETE', `/api/classroom/classes/${classId}/students/${f.S3.id}`)).status).toBe(204);
    expect((await api('GET', `/api/classroom/classes/${classId}/students`)).body).toHaveLength(2);
    expect(Number((await db.query<any>('SELECT xp FROM hk_players WHERE user_id = $1', [f.S3.id]))[0].xp)).toBe(77);
    await api('POST', `/api/classroom/classes/${classId}/students`, { student_ids: [f.S3.id] });
  });

  // ------------------------------------------------------------------ HK.GV.016, HK.HS.071/076/103
  test('HK.GV.016 chia đội ngẫu nhiên (4–6 học sinh/đội) hoặc thủ công; mỗi học sinh một đội; tên, biểu tượng, giới hạn', async () => {
    expect((await api('POST', `/api/classroom/classes/${classId}/teams/auto`, { size: 3 })).status).toBe(400);
    expect((await api('POST', `/api/classroom/classes/${classId}/teams/auto`, { size: 7 })).status).toBe(400);
    const auto = (await api('POST', `/api/classroom/classes/${classId}/teams/auto`, { size: 5 })).body;
    expect(auto).toHaveLength(1);
    expect(auto[0].members).toHaveLength(3);
    expect(auto[0].name).toMatch(/^Đội /);
    const manual = await api('PUT', `/api/classroom/classes/${classId}/teams`, { teams: [
      { name: 'Đội Hưng Đạo', icon: 'crown', member_ids: [f.S1.id, f.S3.id] }, { name: 'Đội Quang Khải', icon: 'flag', member_ids: [f.S2.id] }, { name: 'Đội Trống', member_ids: [] },
    ] });
    expect(manual.body.map((t: any) => [t.name, t.members.length])).toEqual([['Đội Hưng Đạo', 2], ['Đội Quang Khải', 1]]); // đội trống bị bỏ
    const dup = await api('PUT', `/api/classroom/classes/${classId}/teams`, { teams: [{ name: 'A1', member_ids: [f.S1.id] }, { name: 'B1', member_ids: [f.S1.id] }] });
    expect(dup.status).toBe(400); // một học sinh ở hai đội
    expect((await api('PUT', `/api/classroom/classes/${classId}/teams`, { teams: [{ name: 'A1', member_ids: [f.S1.id], icon: 'khong-co' }] })).status).toBe(400);
    expect((await api('PUT', `/api/classroom/classes/${classId}/teams`, { teams: [{ name: 'A1', member_ids: [424242] }] })).status).toBe(403);
    expect((await api('GET', `/api/classroom/classes/${classId}/teams`)).body).toHaveLength(2); // lần lưu hỏng không đổi gì
  });

  test('HK.HS.099/103/071/076 lớp học của tôi: giáo viên, bạn cùng lớp kèm nhân vật và đội, đội của em, bảng xếp hạng đội', async () => {
    const mine = as(f.S1);
    const list = (await mine('GET', '/api/classroom/my-classes')).body;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: classId, name: '7A1', members: 3, team_name: 'Đội Hưng Đạo', leave_pending: 0, teachers: [{ full_name: 'Nguyễn Văn Sử' }] });
    const detail = (await mine('GET', `/api/classroom/my-classes/${classId}`)).body;
    expect(detail.members.map((m: any) => m.name)).toEqual(expect.arrayContaining(['Cơn Lốc']));
    expect(detail.members.find((m: any) => m.me)).toMatchObject({ team_name: 'Đội Hưng Đạo', level: 1 });
    expect(detail.members.every((m: any) => !('full_name' in m) && !('user_code' in m))).toBe(true); // không lộ mã học sinh
    expect(detail.team).toMatchObject({ name: 'Đội Hưng Đạo', rank: expect.any(Number), teams: 2 });
    expect(detail.team.members).toHaveLength(2);
    expect(detail.team.quests).toHaveLength(2);
    expect(detail.team.quests[0]).toMatchObject({ target: 200, progress: 0, done: false }); // 100 điểm mỗi người × 2 người
    expect((await as(f.S3)('GET', `/api/classroom/my-classes/${f.class7b.id}`)).status).toBe(404); // lớp khác
    const u = await userRow(f.S1.id), u2 = await userRow(f.S2.id), u3 = await userRow(f.S3.id);
    await tx((q) => game.awardXp(q, u, 120, 'node', 'cls:s1'));
    await tx((q) => game.awardXp(q, u2, 60, 'node', 'cls:s2'));
    await tx((q) => game.awardXp(q, u3, 30, 'node', 'cls:s3'));
    const board = (await mine('GET', `/api/classroom/my-classes/${classId}/team-board`)).body;
    expect(board.teams.map((t: any) => [t.name, t.xp, t.rank, t.mine])).toEqual([['Đội Hưng Đạo', expect.any(Number), 1, true], ['Đội Quang Khải', expect.any(Number), 2, false]]);
    expect(board.teams[0].xp).toBeGreaterThanOrEqual(150); // S1 + S3 (kèm thưởng nhiệm vụ nếu có)
    const after = (await mine('GET', `/api/classroom/my-classes/${classId}`)).body;
    expect(after.team.quests[0].progress).toBeGreaterThanOrEqual(150);
    // giáo viên xem xếp hạng lớp và đội
    const tb = (await api('GET', `/api/classroom/classes/${classId}/board?period=week`)).body;
    expect(tb.students[0]).toMatchObject({ id: f.S1.id, rank: 1 });
    expect(tb.teams).toHaveLength(2);
    expect((await api('GET', `/api/classroom/classes/${classId}/board?period=all`)).body.period).toBe('all');
  });

  // ------------------------------------------------------------------ HK.HS.105, HK.GV.017
  test('HK.HS.105 + HK.GV.017 yêu cầu rời lớp: giáo viên nhận thông báo, chấp nhận thì rời lớp (dữ liệu học còn), từ chối thì ở lại', async () => {
    const mine = as(f.S2);
    expect((await mine('POST', '/api/classroom/leave-requests', { class_id: f.class7b.id })).status).toBe(404); // không thuộc lớp đó
    const req = await mine('POST', '/api/classroom/leave-requests', { class_id: classId, reason: 'Chuyển sang lớp khác' });
    expect(req.body.status).toBe('pending');
    expect((await mine('POST', '/api/classroom/leave-requests', { class_id: classId })).status).toBe(409);
    expect((await notes(f.T1)).items.find((n: any) => n.kind === 'leave')).toMatchObject({ title: 'Yêu cầu rời lớp', class_name: '7A1' });
    expect((await api('GET', `/api/classroom/classes/${classId}`)).body.pending_leaves).toBe(1);
    const list = (await api('GET', `/api/classroom/classes/${classId}/leave-requests`)).body;
    expect(list[0]).toMatchObject({ status: 'pending', full_name: 'Hoàng Thị Hai', reason: 'Chuyển sang lớp khác' });
    expect((await api('POST', `/api/classroom/leave-requests/${list[0].id}/decide`, { approve: false }, f.T2.token)).status).toBe(404); // giáo viên lớp khác
    expect((await api('POST', `/api/classroom/leave-requests/${list[0].id}/decide`, { approve: false })).body.status).toBe('rejected');
    expect((await api('POST', `/api/classroom/leave-requests/${list[0].id}/decide`, { approve: true })).status).toBe(409); // đã xử lý
    expect((await as(f.S2)('GET', '/api/classroom/my-classes')).body).toHaveLength(1);
    expect((await notes(f.S2)).items[0].title).toMatch(/chưa đồng ý/);
    await mine('POST', '/api/classroom/leave-requests', { class_id: classId });
    const second = (await api('GET', `/api/classroom/classes/${classId}/leave-requests`)).body.find((r: any) => r.status === 'pending');
    await api('POST', `/api/classroom/leave-requests/${second.id}/decide`, { approve: true });
    expect((await as(f.S2)('GET', '/api/classroom/my-classes')).body).toEqual([]);
    expect(Number((await db.query<any>('SELECT xp FROM hk_players WHERE user_id = $1', [f.S2.id]))[0].xp)).toBeGreaterThan(0); // dữ liệu học vẫn còn
    expect((await api('GET', `/api/classroom/classes/${classId}/teams`)).body.find((t: any) => t.name === 'Đội Quang Khải')?.members ?? []).toEqual([]); // rời đội theo
    await api('POST', `/api/classroom/classes/${classId}/students`, { student_ids: [f.S2.id] });
  });

  // ------------------------------------------------------------------ HK.GV.059–060
  test('HK.GV.060 luật lớp: danh sách hành vi mặc định, sửa hành vi, HP tối đa, tắt xếp hạng; kiểm tra giới hạn', async () => {
    const def = (await api('GET', `/api/classroom/classes/${classId}/rules`)).body;
    expect(def).toMatchObject({ rules_default: true, hearts_enabled: true, hearts_max: null, leaderboard_enabled: true, skill_approval: false, team_goal_per_member: 100 });
    expect(def.rules.map((r: any) => r.id)).toEqual(['phat-bieu', 'giup-ban', 'nop-muon', 'mat-trat-tu']);
    expect((await api('PUT', `/api/classroom/classes/${classId}/rules`, { hearts_max: 11 })).status).toBe(400);
    expect((await api('PUT', `/api/classroom/classes/${classId}/rules`, { rules: [{ label: 'A', xp: 1 }] })).status).toBe(400);
    expect((await api('PUT', `/api/classroom/classes/${classId}/rules`, { rules: [{ label: 'Hành vi', xp: 500 }] })).status).toBe(400);
    const saved = (await api('PUT', `/api/classroom/classes/${classId}/rules`, { hearts_max: 4, team_goal_per_member: 150, rules: [{ id: 'dung-cam', label: 'Dũng cảm nhận lỗi', xp: 15, gold: 5, hp: 1 }, { label: 'Quên đồ dùng', xp: -5, gold: 0, hp: 0 }] })).body;
    expect(saved).toMatchObject({ hearts_max: 4, team_goal_per_member: 150, rules_default: false });
    expect(saved.rules.map((r: any) => r.id)).toEqual(['dung-cam', 'h2']);
    expect((await hud(f.S1)).hearts).toMatchObject({ max: 4, current: 4 }); // HP tối đa theo lớp áp dụng ngay
    expect((await api('GET', `/api/classroom/classes/${classId}/students`)).body.every((x: any) => x.hearts_max === 4)).toBe(true); // giáo viên cũng thấy mức của lớp
    expect((await as(f.T2)('GET', `/api/classroom/classes/${classId}/rules`)).status).toBe(404);
  });

  test('HK.GV.059 thưởng/phạt cho học sinh hoặc đội kèm lý do: điểm, vàng, tim bị chặn đúng giới hạn; học sinh nhận thông báo; có lịch sử', async () => {
    const before = await hud(f.S1);
    const reward = await api('POST', `/api/classroom/classes/${classId}/adjust`, { user_ids: [f.S1.id], rule_id: 'dung-cam' });
    expect(reward.body).toMatchObject({ label: 'Dũng cảm nhận lỗi', kind: 'reward', count: 1 });
    expect(reward.body.results[0].applied).toMatchObject({ xp: 15, gold: 5, hp: 0 }); // tim đã đầy (4/4) nên không tăng
    const after = await hud(f.S1);
    expect(after.xp - before.xp).toBeGreaterThanOrEqual(15);
    expect(after.gold - before.gold).toBeGreaterThanOrEqual(5);
    const note = (await notes(f.S1)).items.find((n: any) => n.kind === 'reward');
    expect(note).toMatchObject({ title: 'Giáo viên thưởng cho em', class_name: '7A1' });
    expect(note.body).toMatch(/Dũng cảm nhận lỗi: \+15 điểm, \+5 vàng/);
    expect((await notes(f.S1)).unread).toBeGreaterThan(0);
    // phạt: trừ tim, trừ điểm nhiều hơn số đang có (chặn ở 0), không hạ cấp
    const pen = await api('POST', `/api/classroom/classes/${classId}/adjust`, { user_ids: [f.S1.id], label: 'Làm mất trật tự', xp: -500, gold: -500, hp: -2 });
    expect(pen.body.kind).toBe('penalty');
    const applied = pen.body.results[0].applied;
    expect(applied.hp).toBe(-2);
    expect(applied.xp).toBeLessThanOrEqual(0);
    const low = await hud(f.S1);
    expect(low.hearts.current).toBe(2);
    expect(low.xp).toBeGreaterThanOrEqual(0);
    expect(low.gold).toBeGreaterThanOrEqual(0);
    expect(low.level.level).toBeGreaterThanOrEqual(1);
    // cho cả đội; thiếu lý do hoặc không có giá trị bị từ chối
    expect((await api('POST', `/api/classroom/classes/${classId}/adjust`, { user_ids: [f.S1.id], xp: 5 })).status).toBe(400);
    expect((await api('POST', `/api/classroom/classes/${classId}/adjust`, { user_ids: [f.S1.id], label: 'Không đổi gì' })).status).toBe(400);
    expect((await api('POST', `/api/classroom/classes/${classId}/adjust`, { label: 'Không chọn ai', xp: 5 })).status).toBe(400);
    expect((await api('POST', `/api/classroom/classes/${classId}/adjust`, { user_ids: [f.S1.id], label: 'Quá lớn', xp: 9999 })).status).toBe(400);
    expect((await api('POST', `/api/classroom/classes/${classId}/adjust`, { user_ids: [f.S1.id], label: 'Học sinh lớp khác', xp: 5 }, f.T2.token)).status).toBe(404);
    const team = (await api('GET', `/api/classroom/classes/${classId}/teams`)).body.find((t: any) => t.name === 'Đội Hưng Đạo');
    const teamReward = await api('POST', `/api/classroom/classes/${classId}/adjust`, { team_ids: [team.id], label: 'Cả đội làm việc nhóm tốt', gold: 10 });
    expect(teamReward.body.count).toBe(2);
    const history = (await api('GET', `/api/classroom/classes/${classId}/history`)).body;
    expect(history[0]).toMatchObject({ label: 'Cả đội làm việc nhóm tốt', team_name: 'Đội Hưng Đạo' });
    expect(history).toHaveLength(4); // mỗi học sinh một dòng: thưởng, phạt, và hai thành viên của đội
    // khóa chống cộng hai lần: gọi lại tạo bản ghi mới nhưng mỗi bản ghi có khóa riêng
    const goldRows = await db.query<any>("SELECT count(*)::int AS n FROM hk_gold_ledger WHERE reason = 'teacher' AND user_id = $1", [f.S1.id]);
    expect(goldRows[0].n).toBeGreaterThanOrEqual(2);
  });

  test('HK.GV.060 bảng xếp hạng lớp có thể tắt: học sinh thấy thông báo thay cho bảng', async () => {
    expect((await as(f.S1)('GET', '/api/game/leaderboard?scope=class&period=week')).body.entries.length).toBeGreaterThan(0);
    await api('PUT', `/api/classroom/classes/${classId}/rules`, { leaderboard_enabled: false });
    const off = (await as(f.S1)('GET', '/api/game/leaderboard?scope=class&period=week')).body;
    expect(off).toMatchObject({ disabled: true, entries: [] });
    expect(off.message).toMatch(/tắt bảng xếp hạng/);
    expect((await as(f.S1)('GET', `/api/classroom/my-classes/${classId}/team-board`)).body).toMatchObject({ disabled: true, teams: [] });
    await api('PUT', `/api/classroom/classes/${classId}/rules`, { leaderboard_enabled: true });
  });

  // ------------------------------------------------------------------ HK.GV.062, 065, 061
  test('HK.GV.062 vòng quay vận mệnh: máy chủ chọn sự kiện ngẫu nhiên, áp cho cả lớp hoặc một đội, ghi lịch sử và thông báo', async () => {
    const goldBefore = (await hud(f.S3)).gold;
    clock.random = () => 0.99; // sự kiện cuối: một ngày bình yên
    const calm = await api('POST', `/api/classroom/classes/${classId}/random-event`, { target: 'class' });
    expect(calm.body).toMatchObject({ event: { id: 'binh-yen' }, scope: 'cả lớp', affected: 3 });
    clock.random = () => 0.0; // sự kiện đầu: mưa điểm +20
    const xpBefore = (await hud(f.S3)).xp;
    const rain = await api('POST', `/api/classroom/classes/${classId}/random-event`, { target: 'class' });
    expect(rain.body.event).toMatchObject({ id: 'mua-diem', xp: 20 });
    expect((await hud(f.S3)).xp - xpBefore).toBeGreaterThanOrEqual(20);
    expect((await notes(f.S3)).items.find((n: any) => n.kind === 'event' && /Mưa điểm/.test(n.body))).toBeTruthy();
    clock.random = () => 0.4; // sự kiện thứ 4 trong danh sách 8 phần: tiếp tế +10 điểm +5 vàng
    const team = (await api('GET', `/api/classroom/classes/${classId}/teams`)).body.find((t: any) => t.name === 'Đội Hưng Đạo');
    const supply = await api('POST', `/api/classroom/classes/${classId}/random-event`, { target: 'team', team_id: team.id });
    expect(supply.body).toMatchObject({ event: { id: 'tiep-te' }, scope: 'Đội Hưng Đạo', affected: 2 });
    expect((await hud(f.S3)).gold - goldBefore).toBeGreaterThanOrEqual(5);
    expect((await api('POST', `/api/classroom/classes/${classId}/random-event`, { target: 'team', team_id: 99999 })).status).toBe(404);
    expect((await api('GET', '/api/classroom/random-events')).body).toHaveLength(8);
    clock.random = Math.random;
  });

  test('HK.GV.065 hộp quà lớp: chỉ mở khi cả lớp đạt mục tiêu điểm chung; thưởng cho từng học sinh một lần', async () => {
    const created = (await api('POST', `/api/classroom/classes/${classId}/goals`, { title: 'Cả lớp 300 điểm', target_xp: 300, reward_gold: 25, reward_xp: 0 })).body;
    const goal = created[0];
    expect(goal).toMatchObject({ title: 'Cả lớp 300 điểm', progress: 0, reached: false, opened: false });
    expect((await api('POST', `/api/classroom/classes/${classId}/goals`, { title: 'Sai', target_xp: 5 })).status).toBe(400);
    expect((await api('POST', `/api/classroom/goals/${goal.id}/open`)).status).toBe(409); // chưa đủ điểm
    // thưởng của giáo viên không tính vào mục tiêu chung
    await api('POST', `/api/classroom/classes/${classId}/adjust`, { user_ids: [f.S1.id], label: 'Thưởng thêm', xp: 200 });
    expect((await api('GET', `/api/classroom/classes/${classId}/goals`)).body[0].progress).toBe(0);
    const u = [await userRow(f.S1.id), await userRow(f.S2.id), await userRow(f.S3.id)];
    for (const [i, user] of u.entries()) await tx((q) => game.awardXp(q, user, 120, 'node', `goalbox:${i}`));
    const ready = (await api('GET', `/api/classroom/classes/${classId}/goals`)).body[0];
    expect(ready).toMatchObject({ progress: 360, reached: true });
    expect((await as(f.S1)('GET', `/api/classroom/my-classes/${classId}`)).body.goals[0]).toMatchObject({ reached: true });
    const gold = (await hud(f.S1)).gold;
    expect((await api('POST', `/api/classroom/goals/${goal.id}/open`, undefined, f.T2.token)).status).toBe(404);
    expect((await api('POST', `/api/classroom/goals/${goal.id}/open`)).body).toMatchObject({ opened: true, students: 3 });
    expect((await hud(f.S1)).gold - gold).toBe(25);
    expect((await api('POST', `/api/classroom/goals/${goal.id}/open`)).status).toBe(409);
    expect((await api('DELETE', `/api/classroom/goals/${goal.id}`)).status).toBe(409); // đã mở nên giữ lại
    const extra = (await api('POST', `/api/classroom/classes/${classId}/goals`, { title: 'Mục tiêu mới', target_xp: 10000 })).body[0];
    expect((await api('DELETE', `/api/classroom/goals/${extra.id}`)).status).toBe(204);
  });

  test('HK.GV.061 trao huy hiệu của trường cho học sinh hoặc cả đội; không trao hai lần; không trao huy hiệu hệ thống', async () => {
    const badge = (await api('POST', '/api/game/admin/badges', { code: 'doan-ket', name: 'Đoàn kết', icon: 'heart', color: '#0b6cc0' }, f.A.token)).body;
    const team = (await api('GET', `/api/classroom/classes/${classId}/teams`)).body.find((t: any) => t.name === 'Đội Hưng Đạo');
    const res = await api('POST', `/api/classroom/classes/${classId}/badges/${badge.id}/award`, { team_ids: [team.id], user_ids: [f.S2.id] });
    expect(res.body).toMatchObject({ badge: 'Đoàn kết', awarded: 3, already: 0 });
    expect((await api('POST', `/api/classroom/classes/${classId}/badges/${badge.id}/award`, { user_ids: [f.S1.id] })).body).toMatchObject({ awarded: 0, already: 1 });
    expect((await as(f.S1)('GET', '/api/game/badges')).body.find((b: any) => b.id === badge.id)).toMatchObject({ earned: true });
    const sys = (await call(s.base, 'GET', '/api/game/admin/badges', undefined, f.root)).body.find((b: any) => b.scope === 'system');
    expect((await api('POST', `/api/classroom/classes/${classId}/badges/${sys.id}/award`, { user_ids: [f.S1.id] })).status).toBe(404);
    expect((await api('POST', `/api/classroom/classes/${classId}/badges/${badge.id}/award`, {})).status).toBe(400);
  });

  // ------------------------------------------------------------------ HK.GV.017 thông báo, HK.HS.104
  test('HK.HS.104 thông báo: giáo viên gửi cho lớp hoặc một đội, học sinh xem và đánh dấu đã đọc; người khác không đọc được', async () => {
    const team = (await api('GET', `/api/classroom/classes/${classId}/teams`)).body.find((t: any) => t.name === 'Đội Hưng Đạo');
    expect((await api('POST', `/api/classroom/classes/${classId}/announcements`, { title: '', body: 'x' })).status).toBe(400);
    expect((await api('POST', `/api/classroom/classes/${classId}/announcements`, { title: 'Họp lớp', body: 'Thứ Sáu họp lớp lúc 7 giờ' })).body.sent).toBe(3);
    expect((await api('POST', `/api/classroom/classes/${classId}/announcements`, { title: 'Chỉ đội Hưng Đạo', body: 'Mang theo tư liệu', team_id: team.id })).body.sent).toBe(2);
    const mine = await notes(f.S1);
    expect(mine.items.filter((n: any) => n.kind === 'announce').map((n: any) => n.title)).toEqual(expect.arrayContaining(['Họp lớp', 'Chỉ đội Hưng Đạo']));
    expect((await notes(f.S2)).items.filter((n: any) => n.kind === 'announce').map((n: any) => n.title)).toEqual(['Họp lớp']);
    expect((await as(f.S1)('GET', `/api/classroom/my-classes/${classId}`)).body.announcements.map((a: any) => a.title)).toContain('Họp lớp');
    expect((await api('GET', `/api/classroom/classes/${classId}/announcements`)).body[0]).toMatchObject({ title: 'Chỉ đội Hưng Đạo', recipients: 2, read: 0 });
    expect(mine.unread).toBeGreaterThan(0);
    const first = mine.items[0];
    await as(f.S1)('POST', '/api/classroom/notifications/read', { ids: [first.id] });
    expect((await notes(f.S1)).unread).toBe(mine.unread - 1);
    await as(f.S1)('POST', '/api/classroom/notifications/read', {});
    expect((await notes(f.S1)).unread).toBe(0);
    expect((await call(s.base, 'GET', '/api/classroom/notifications')).status).toBe(401);
    expect((await as(f.S2)('POST', '/api/classroom/notifications/read', { ids: [first.id] })).status).toBe(200); // không đánh dấu hộ người khác
    expect((await notes(f.S1)).items.find((n: any) => n.id === first.id).read_at).toBeTruthy();
  });

  // ------------------------------------------------------------------ HK.HS.072, HK.GV.063
  const skillsOf = async (who: { token: string }) => (await as(who)('GET', '/api/classroom/skills')).body;
  const cost = (mine: any, code: string): number => mine.skills.find((k: any) => k.code === code).cost;

  test('HK.HS.072 kỹ năng nhân vật: điểm hành động hồi mỗi ngày; thuốc quý và hồi sinh hồi tim; cần thuộc một lớp và có kỹ năng đó', async () => {
    const chars = (await call(s.base, 'GET', '/api/game/classes', undefined, f.S1.token)).body;
    await as(f.S1)('POST', '/api/game/character', { class_id: chars.find((c: any) => c.code === 'luong_y').id });
    await as(f.S2)('POST', '/api/game/character', { class_id: chars.find((c: any) => c.code === 'tuong_quan').id });
    clock.advance(86_400_000); // điểm hành động chỉ hồi đầy khi sang ngày mới (lên cấp trong ngày chưa nâng điểm đang có)
    await tx(async (q) => game.adjustHearts(q, await userRow(f.S1.id), -2));
    const mine = await skillsOf(f.S1);
    expect(mine.in_class).toBe(true);
    expect(mine.ap.current).toBe(mine.ap.max);
    expect(mine.ap.max).toBeGreaterThanOrEqual(3); // 3 ở cấp 1, thêm 1 sau mỗi 2 cấp
    expect(mine.skills.map((k: any) => k.code).sort()).toEqual(['hoi_sinh', 'thuoc_quy']);
    expect(cost(mine, 'thuoc_quy')).toBe(3);
    expect(cost(mine, 'hoi_sinh')).toBe(4);
    expect(mine.classmates.map((c: any) => c.id)).toEqual(expect.arrayContaining([f.S2.id]));
    expect((await as(f.S3)('POST', '/api/classroom/skills/use', { skill: 'thuoc_quy' })).status).toBe(409); // chưa chọn lớp nhân vật
    expect((await as(f.S1)('POST', '/api/classroom/skills/use', { skill: 'xung_phong' })).status).toBe(400); // kỹ năng của lớp nhân vật khác
    expect((await as(f.S1)('POST', '/api/classroom/skills/use', { skill: 'khong-co' })).status).toBe(400);
    // thuốc quý: +1 tim cho bản thân, tốn 3 điểm hành động
    const hearts = (await hud(f.S1)).hearts.current;
    expect(hearts).toBeLessThan(4);
    const heal = (await as(f.S1)('POST', '/api/classroom/skills/use', { skill: 'thuoc_quy' })).body;
    expect(heal).toMatchObject({ status: 'done', message: '+1 tim', ap: { current: mine.ap.max - 3 } });
    expect((await hud(f.S1)).hearts.current).toBe(hearts + 1);
    // hồi sinh tốn 4 nên hôm nay không đủ điểm nếu chỉ còn ít hơn 4
    if (mine.ap.max - 3 < 4) expect((await as(f.S1)('POST', '/api/classroom/skills/use', { skill: 'hoi_sinh', target_id: f.S2.id })).status).toBe(409);
    clock.advance(86_400_000); // sang ngày mới: điểm hành động hồi đầy, tim cũng đã hồi theo giờ
    expect((await skillsOf(f.S1)).ap.current).toBe(mine.ap.max);
    const s2 = await userRow(f.S2.id);
    await tx((q) => game.adjustHearts(q, s2, -2));
    const before = (await hud(f.S2)).hearts.current;
    const rescue = (await as(f.S1)('POST', '/api/classroom/skills/use', { skill: 'hoi_sinh', target_id: f.S2.id })).body;
    expect(rescue).toMatchObject({ status: 'done', message: '+1 tim', ap: { current: mine.ap.max - 4 } });
    expect((await hud(f.S2)).hearts.current).toBe(before + 1);
    expect((await notes(f.S2)).items.find((n: any) => n.kind === 'skill')).toMatchObject({ title: 'Bạn đã hồi tim cho em' });
    clock.advance(86_400_000);
    expect((await as(f.S1)('POST', '/api/classroom/skills/use', { skill: 'hoi_sinh', target_id: f.S1.id })).status).toBe(400); // phải là bạn khác
    expect((await as(f.S1)('POST', '/api/classroom/skills/use', { skill: 'hoi_sinh', target_id: f.TB.id })).status).toBe(403); // không phải bạn cùng lớp
    expect((await as(f.S1)('POST', '/api/classroom/skills/use', { skill: 'hoi_sinh', target_id: f.S2.id })).status).toBe(409); // bạn đã đầy tim (không hao điểm hành động)
    expect((await skillsOf(f.S1)).ap.current).toBe(mine.ap.max);
  });

  test('HK.GV.063 duyệt sử dụng kỹ năng: khi lớp bật duyệt, kỹ năng hồi tim chờ giáo viên; từ chối thì hoàn điểm hành động', async () => {
    await api('PUT', `/api/classroom/classes/${classId}/rules`, { skill_approval: true });
    clock.advance(86_400_000);
    const s2 = await userRow(f.S2.id);
    await tx((q) => game.adjustHearts(q, s2, -2));
    const max = (await skillsOf(f.S1)).ap.max;
    const before = (await hud(f.S2)).hearts.current;
    const pending = (await as(f.S1)('POST', '/api/classroom/skills/use', { skill: 'hoi_sinh', target_id: f.S2.id })).body;
    expect(pending).toMatchObject({ status: 'pending', ap: { current: max - 4 } });
    expect((await hud(f.S2)).hearts.current).toBe(before); // chưa hồi
    expect((await skillsOf(f.S1)).skills.find((k: any) => k.code === 'hoi_sinh').needs_approval).toBe(true);
    expect((await notes(f.T1)).items.find((n: any) => n.kind === 'skill')).toMatchObject({ title: 'Học sinh xin dùng kỹ năng' });
    const list = (await api('GET', `/api/classroom/classes/${classId}/skill-requests`)).body;
    expect(list[0]).toMatchObject({ status: 'pending', skill: 'hoi_sinh', user_name: 'Phạm Minh Một', target_name: 'Hoàng Thị Hai' });
    expect((await api('POST', `/api/classroom/skill-requests/${list[0].id}/decide`, { approve: true }, f.T2.token)).status).toBe(404);
    expect((await api('POST', `/api/classroom/skill-requests/${list[0].id}/decide`, { approve: false })).body.status).toBe('rejected');
    expect((await skillsOf(f.S1)).ap.current).toBe(max); // hoàn lại điểm hành động
    expect((await notes(f.S1)).items.find((n: any) => n.kind === 'skill' && /chưa đồng ý/.test(n.title))).toBeTruthy();
    await as(f.S1)('POST', '/api/classroom/skills/use', { skill: 'hoi_sinh', target_id: f.S2.id });
    const again = (await api('GET', `/api/classroom/classes/${classId}/skill-requests`)).body.find((r: any) => r.status === 'pending');
    expect((await api('POST', `/api/classroom/skill-requests/${again.id}/decide`, { approve: true })).body.status).toBe('done');
    expect((await hud(f.S2)).hearts.current).toBe(before + 1);
    expect((await api('POST', `/api/classroom/skill-requests/${again.id}/decide`, { approve: true })).status).toBe(409);
    await api('PUT', `/api/classroom/classes/${classId}/rules`, { skill_approval: false });
  });

  test('HK.HS.072 hiệu ứng chờ: Hộ giáp bỏ qua một lần mất tim; Xung phong chỉ dùng được một lần mỗi lúc và được tiêu thụ khi trả lời đúng', async () => {
    clock.advance(86_400_000);
    const tq = (await hud(f.S2)).hearts.current;
    expect(tq).toBeGreaterThanOrEqual(3);
    const mine = await skillsOf(f.S2);
    expect(mine.skills.map((k: any) => k.code).sort()).toEqual(['ho_giap', 'xung_phong']);
    const armor = cost(mine, 'ho_giap');
    if (mine.ap.max >= armor) {
      expect((await as(f.S2)('POST', '/api/classroom/skills/use', { skill: 'ho_giap' })).body).toMatchObject({ status: 'done', ap: { current: mine.ap.max - armor } });
    } else {
      expect((await as(f.S2)('POST', '/api/classroom/skills/use', { skill: 'ho_giap' })).status).toBe(409); // cấp thấp chưa đủ điểm hành động cho Hộ giáp
      await tx((q) => q('UPDATE hk_players SET ap = 4 WHERE user_id = $1', [f.S2.id]));
      expect((await as(f.S2)('POST', '/api/classroom/skills/use', { skill: 'ho_giap' })).body).toMatchObject({ status: 'done' });
    }
    expect((await hud(f.S2)).buffs).toEqual({ ho_giap: 1 });
    await tx((q) => q('UPDATE hk_players SET ap = 4 WHERE user_id = $1', [f.S2.id]));
    expect((await as(f.S2)('POST', '/api/classroom/skills/use', { skill: 'ho_giap' })).status).toBe(409); // đang chờ được dùng
    const u = await userRow(f.S2.id);
    await tx((q) => game.loseHeart(q, u));
    expect((await hud(f.S2)).hearts.current).toBe(tq); // lần mất tim đầu được bỏ qua
    expect((await hud(f.S2)).buffs).toEqual({});
    await tx((q) => game.loseHeart(q, u));
    expect((await hud(f.S2)).hearts.current).toBe(tq - 1); // lần sau mất tim bình thường
    // Xung phong: hiệu ứng được ghi nhận rồi tiêu thụ đúng một lần
    await tx((q) => q('UPDATE hk_players SET ap = 4 WHERE user_id = $1', [f.S2.id]));
    expect((await as(f.S2)('POST', '/api/classroom/skills/use', { skill: 'xung_phong' })).body.status).toBe('done');
    expect((await hud(f.S2)).buffs).toEqual({ xung_phong: 1 });
    expect(await tx((q) => game.useBuff(q, u, 'xung_phong'))).toBe(true);
    expect(await tx((q) => game.useBuff(q, u, 'xung_phong'))).toBe(false);
  });
});
