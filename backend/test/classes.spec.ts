/** TM.SCH-CLASS và TM.T-CLASS: vòng đời lớp do quản trị trường tạo, phân công giáo viên, chuyển học sinh, đóng/mở lớp và đăng ký lớp. */
import { adminLogin, call, hasPostgres, Started, startApp } from './harness';
import type { DatabaseService } from '../src/database/database.service';

let s: Started, db: DatabaseService, root: string, adminA: string, adminB: string, schoolA: number, schoolB: number;
let t1: any, t2: any, tOther: any, tLocked: any, st1: any, st2: any, tok: Record<string, string> = {};
const YEAR = '2026-2027', PW = 'ClassTest@123';
const api = (method: string, path: string, body?: unknown, token = root) => call(s.base, method, path, body, token);
const login = async (u: any, portal: string) => (await api('POST', '/api/auth/login', { username: u.username, password: PW, portal }, '')).body.token as string;
const account = async (role: string, school_id: number, full_name: string, grade?: number) => (await api('POST', '/api/admin/users', { role, school_id, full_name, grade, school_year: YEAR, password: PW })).body.user;
const newClass = (code: string, extra: Record<string, unknown> = {}, token = adminA) => api('POST', '/api/admin/classes', { class_code: code, school_year: YEAR, grade: 7, name: `Lịch sử lớp ${code}`, ...extra }, token);
const notes = async (token: string) => (await api('GET', '/api/auth/notifications', undefined, token)).body.items.map((n: any) => n.kind);
const join = (token: string, code: string, password: string) => api('POST', '/api/student/classes/join', { class_code: code, password }, token);

(hasPostgres() ? describe : describe.skip)('TM.SCH-CLASS / TM.T-CLASS vòng đời lớp', () => {
  beforeAll(async () => {
    s = await startApp('classes_test');
    db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    root = await adminLogin(s.base);
    for (const [code, name] of [['3301', 'Trường lớp A'], ['3302', 'Trường lớp B']]) await api('POST', '/api/admin/schools', { school_code: code, name });
    [schoolA, schoolB] = (await db.query<{ id: number }>("SELECT id FROM app_schools WHERE school_code IN ('3301', '3302') ORDER BY school_code")).map((x) => x.id);
    adminA = await login(await account('school_admin', schoolA, 'Quản trị trường A'), 'school_admin');
    adminB = await login(await account('school_admin', schoolB, 'Quản trị trường B'), 'school_admin');
    [t1, t2, tLocked] = [await account('teacher', schoolA, 'Giáo viên A1'), await account('teacher', schoolA, 'Giáo viên A2'), await account('teacher', schoolA, 'Giáo viên bị khóa')];
    tOther = await account('teacher', schoolB, 'Giáo viên B1');
    [st1, st2] = [await account('student', schoolA, 'Học sinh A1', 7), await account('student', schoolA, 'Học sinh A2', 7)];
    await api('PATCH', `/api/admin/users/${tLocked.id}`, { is_active: false });
    for (const [key, u, portal] of [['t1', t1, 'teacher'], ['t2', t2, 'teacher'], ['st1', st1, 'student'], ['st2', st2, 'student']] as const) tok[key] = await login(u, portal);
  });
  afterAll(async () => {
    await s?.close();
  });

  test('khối theo năm học: bật/ngưng có kiểm tra, quản trị trường chỉ tác động trường mình dù gửi school_id trường khác', async () => {
    const put = (body: Record<string, unknown>, token = adminA) => api('PUT', '/api/admin/school-grades', { school_year: YEAR, ...body }, token);
    expect((await put({ grade: 7, is_active: true })).body).toEqual([{ school_year: YEAR, grade: 7, is_active: true, classes: 0, active_classes: 0 }]);
    expect((await put({ grade: 7, is_active: true, school_id: schoolB })).status).toBe(200); // school_id giả bị bỏ qua
    expect((await api('GET', `/api/admin/school-grades?school_id=${schoolB}`)).body).toEqual([]);
    expect((await put({ grade: 5, is_active: true })).status).toBe(422);
    expect((await put({ grade: 7, is_active: true, school_year: '2026-2028' })).status).toBe(422);
    expect((await api('PUT', '/api/admin/school-grades', { school_year: YEAR, grade: 7, is_active: true })).status).toBe(422); // quản trị tổng phải chọn trường
    expect((await api('PUT', '/api/admin/school-grades', { school_id: schoolB, school_year: YEAR, grade: 8, is_active: true })).status).toBe(200);
    expect((await api('GET', '/api/admin/school-grades', undefined, adminB)).body.map((g: any) => g.grade)).toEqual([8]);
    expect((await put({ grade: 7, is_active: false })).body[0].is_active).toBe(false);
    expect((await put({ grade: 7, is_active: true })).body[0].is_active).toBe(true);
    for (const token of [tok.t1, tok.st1, '']) expect((await api('GET', '/api/admin/school-grades', undefined, token)).status).toBe(token ? 403 : 401);
  });

  test('tạo lớp: cần khối đang bật, mã duy nhất, giáo viên cùng trường; lớp mới chưa có mật khẩu nên học sinh chưa vào được', async () => {
    expect((await newClass('8A1', { grade: 8 })).status).toBe(422); // khối 8 chưa bật ở trường A
    expect((await newClass('x')).status).toBe(422);
    expect((await newClass('7A1', { school_year: '2026-2028' })).status).toBe(422);
    expect((await newClass('7A1', { teacher_id: tOther.id })).status).toBe(422); // giáo viên trường khác
    expect((await newClass('7A1', { teacher_id: tLocked.id })).status).toBe(422); // giáo viên bị khóa
    expect((await newClass('7A1', { teacher_id: st1.id })).status).toBe(422); // không phải giáo viên
    const made = await newClass('7A1', { expected_size: 40 });
    expect(made.status).toBe(201);
    expect(made.body).toMatchObject({ class_code: '7A1', status: 'APPROVED', teacher_id: null, teacher_name: null, has_password: false, is_active: true, grade: 7, expected_size: 40, school_id: schoolA });
    expect((await newClass('7a1')).status).toBe(409); // trùng mã (không phân biệt hoa thường)
    expect((await join(tok.st1, '7A1', PW)).status).toBe(400);
    expect((await api('GET', '/api/student/classes/available', undefined, tok.st1)).body).toEqual([]);
    // Quản trị tổng tạo cho trường chỉ định; quản trị trường B không thấy lớp của A
    expect((await api('POST', '/api/admin/classes', { school_id: schoolB, class_code: '8B1', school_year: YEAR, grade: 8, name: 'Lớp 8B1' })).status).toBe(201);
    expect((await api('POST', '/api/admin/classes', { class_code: '8B2', school_year: YEAR, grade: 8, name: 'Lớp 8B2' })).status).toBe(422);
    const cid = made.body.id;
    for (const path of [`/api/admin/classes/${cid}/events`]) expect((await api('GET', path, undefined, adminB)).status).toBe(404);
    expect((await api('PATCH', `/api/admin/classes/${cid}`, { name: 'Đổi tên trái phép' }, adminB)).status).toBe(404);
    expect((await api('POST', `/api/admin/classes/${cid}/teacher`, { teacher_id: tOther.id }, adminB)).status).toBe(404);
    expect((await api('POST', '/api/admin/classes', { class_code: '7Z', school_year: YEAR, grade: 7, name: 'X' }, tok.t1)).status).toBe(403);
    const directory = (await api('GET', '/api/admin/class-directory', undefined, adminA)).body.items.find((c: any) => c.id === cid);
    expect(directory).toMatchObject({ teacher_name: null, has_password: false, join_open: true }); // lớp chưa có giáo viên vẫn hiện trong danh sách
  });

  test('phân công giáo viên → giáo viên đặt mật khẩu → học sinh vào lớp; đổi giáo viên thu hồi mật khẩu và quyền của người cũ', async () => {
    const cid = (await db.query<{ id: number }>("SELECT id FROM app_classes WHERE class_code = '7A1' AND school_id = $1", [schoolA]))[0].id;
    const assigned = await api('POST', `/api/admin/classes/${cid}/teacher`, { teacher_id: t1.id }, adminA);
    expect(assigned.body).toMatchObject({ teacher_id: t1.id, teacher_name: 'Giáo viên A1', has_password: false });
    expect(await notes(tok.t1)).toContain('class_assigned');
    expect((await db.query<{ class_name: string }>('SELECT class_name FROM app_users WHERE id = $1', [t1.id]))[0].class_name).toBe('7A1');
    expect((await api('POST', `/api/admin/classes/${cid}/teacher`, { teacher_id: tOther.id })).status).toBe(422);
    // Chỉ giáo viên được phân công mới đặt được mật khẩu
    expect((await api('POST', `/api/teacher/classes/${cid}/join-password`, { password: 'MatKhauLop1' }, tok.t2)).status).toBe(404);
    expect((await api('POST', `/api/teacher/classes/${cid}/join-password`, { password: 'abc' }, tok.t1)).status).toBe(422);
    expect((await api('POST', `/api/teacher/classes/${cid}/join-open`, { open: true }, tok.t1)).status).toBe(422); // chưa có mật khẩu
    const withPw = await api('POST', `/api/teacher/classes/${cid}/join-password`, { password: 'MatKhauLop1' }, tok.t1);
    expect(withPw.body).toMatchObject({ has_password: true, join_open: true });
    expect(JSON.stringify(withPw.body)).not.toContain('MatKhauLop1');
    expect((await api('GET', '/api/student/classes/available', undefined, tok.st1)).body).toMatchObject([{ class_code: '7A1', teacher_name: 'Giáo viên A1', joined: false }]);
    expect((await join(tok.st1, '7A1', 'sai-mat-khau')).body.detail).toBe('Sai mã lớp hoặc mật khẩu lớp');
    expect((await join(tok.st1, '7A1', 'MatKhauLop1')).status).toBe(200);
    expect(await notes(tok.t1)).toContain('class_join');
    // Đổi mật khẩu: mật khẩu cũ ngừng hiệu lực ngay
    await api('POST', `/api/teacher/classes/${cid}/join-password`, { password: 'MatKhauLop2' }, tok.t1);
    expect((await join(tok.st2, '7A1', 'MatKhauLop1')).status).toBe(400);
    // Đóng đăng ký: mật khẩu đúng báo lớp đóng, mật khẩu sai vẫn chỉ báo sai chung (không dò được lớp)
    expect((await api('POST', `/api/teacher/classes/${cid}/join-open`, { open: false }, tok.t1)).body.join_open).toBe(false);
    expect((await join(tok.st2, '7A1', 'MatKhauLop2')).body.detail).toContain('tạm đóng');
    expect((await join(tok.st2, '7A1', 'sai')).body.detail).toBe('Sai mã lớp hoặc mật khẩu lớp');
    expect((await api('GET', '/api/student/classes/available', undefined, tok.st2)).body).toEqual([]);
    expect((await api('POST', `/api/teacher/classes/${cid}/join-open`, { open: true }, tok.t1)).body.join_open).toBe(true);
    expect((await api('GET', '/api/teacher/classes', undefined, tok.t1)).body[0]).toMatchObject({ class_code: '7A1', has_password: true, join_open: true, members: 1 });

    // Đổi sang giáo viên khác
    const changed = await api('POST', `/api/admin/classes/${cid}/teacher`, { teacher_id: t2.id }, adminA);
    expect(changed.body).toMatchObject({ teacher_id: t2.id, has_password: false, join_open: false, students: 1 });
    expect(await notes(tok.t1)).toContain('class_unassigned');
    expect((await db.query<{ class_name: string | null }>('SELECT class_name FROM app_users WHERE id = $1', [t1.id]))[0].class_name).toBeNull();
    expect((await api('POST', `/api/teacher/classes/${cid}/join-password`, { password: 'MatKhauCu123' }, tok.t1)).status).toBe(404);
    expect((await join(tok.st2, '7A1', 'MatKhauLop2')).status).toBe(400); // mật khẩu do giáo viên cũ đặt đã bị thu hồi
    expect((await api('POST', `/api/teacher/classes/${cid}/join-password`, { password: 'MatKhauMoi1' }, tok.t2)).body).toMatchObject({ has_password: true, join_open: true });
    expect((await join(tok.st2, '7A1', 'MatKhauMoi1')).status).toBe(200);
    // Hủy phân công
    expect((await api('POST', `/api/admin/classes/${cid}/teacher`, { teacher_id: null }, adminA)).body).toMatchObject({ teacher_id: null, teacher_name: null, has_password: false });
    expect((await api('GET', '/api/student/classes', undefined, tok.st1)).body[0]).toMatchObject({ class_code: '7A1', teacher_name: null }); // học sinh vẫn thấy lớp của mình
    const events = (await api('GET', `/api/admin/classes/${cid}/events`, undefined, adminA)).body;
    expect(events.map((e: any) => e.kind)).toEqual(['unassign', 'join_password', 'change_teacher', 'join_open', 'join_closed', 'join_password', 'join_password', 'assign', 'create']);
    expect(events.find((e: any) => e.kind === 'change_teacher')).toMatchObject({ teacher_name: 'Giáo viên A2', previous_teacher_name: 'Giáo viên A1', actor_name: 'Quản trị trường A' });
    expect(JSON.stringify(events)).not.toMatch(/MatKhau|hash/i);
    await api('POST', `/api/admin/classes/${cid}/teacher`, { teacher_id: t1.id }, adminA);
  });

  test('chuyển học sinh giữa các lớp cùng trường: giữ điểm, ghi lịch sử, chặn lớp khác trường/lớp đóng/không phải thành viên', async () => {
    const [from, to] = [(await db.query<{ id: number }>("SELECT id FROM app_classes WHERE class_code = '7A1' AND school_id = $1", [schoolA]))[0].id, (await newClass('7A2')).body.id];
    const other = (await db.query<{ id: number }>("SELECT id FROM app_classes WHERE class_code = '8B1' AND school_id = $1", [schoolB]))[0].id;
    await db.getProgress(st1.id);
    await db.saveProgress(st1.id, { xp: 70, questions_answered: 9, questions_correct: 6 });
    const transfer = (classId: number, body: Record<string, unknown>, token = adminA) => api('POST', `/api/admin/classes/${classId}/transfer`, body, token);
    expect((await transfer(from, { user_id: st1.id, to_class_id: from })).status).toBe(422);
    expect((await transfer(from, { user_id: st1.id, to_class_id: other })).status).toBe(404); // lớp trường khác
    expect((await transfer(to, { user_id: st1.id, to_class_id: from })).status).toBe(422); // không thuộc lớp nguồn
    expect((await transfer(from, { user_id: t1.id, to_class_id: to })).status).toBe(404); // không phải học sinh
    expect((await transfer(from, { user_id: st1.id, to_class_id: to }, adminB)).status).toBe(404);
    const done = await transfer(from, { user_id: st1.id, to_class_id: to });
    expect(done.body.from.students).toBe(1);
    expect(done.body.to.students).toBe(1);
    expect(await db.query('SELECT class_id FROM app_class_members WHERE user_id = $1', [st1.id])).toEqual([{ class_id: to }]);
    expect((await db.query<{ class_name: string }>('SELECT class_name FROM app_users WHERE id = $1', [st1.id]))[0].class_name).toBe('7A2');
    expect(await db.getProgress(st1.id)).toMatchObject({ xp: 70, questions_answered: 9, questions_correct: 6 }); // điểm đã học không mất
    expect(await notes(tok.st1)).toContain('class_transfer');
    expect((await api('GET', `/api/admin/classes/${to}/events`)).body[0]).toMatchObject({ kind: 'transfer', student_name: 'Học sinh A1', related_class_code: '7A1' });
    // Lớp đích đã đóng thì không chuyển vào được
    await api('PATCH', `/api/admin/classes/${from}`, { is_active: false });
    expect((await transfer(to, { user_id: st1.id, to_class_id: from })).status).toBe(409);
    await api('PATCH', `/api/admin/classes/${from}`, { is_active: true });
  });

  test('đóng/mở lớp giữ nguyên thành viên và điểm; ngưng khối chỉ khi không còn lớp hoạt động; sửa thông tin lớp có kiểm tra', async () => {
    const cid = (await db.query<{ id: number }>("SELECT id FROM app_classes WHERE class_code = '7A2' AND school_id = $1", [schoolA]))[0].id;
    await api('POST', `/api/admin/classes/${cid}/teacher`, { teacher_id: t2.id });
    await api('POST', `/api/teacher/classes/${cid}/join-password`, { password: 'LopDongMo1' }, tok.t2);
    expect((await api('PATCH', `/api/admin/classes/${cid}`, { name: 'Lịch sử 7A2 (sửa)', expected_size: 35 }, adminA)).body).toMatchObject({ name: 'Lịch sử 7A2 (sửa)', expected_size: 35 });
    expect((await api('PATCH', `/api/admin/classes/${cid}`, { name: 'x' }, adminA)).status).toBe(422);
    expect((await api('PATCH', `/api/admin/classes/${cid}`, { expected_size: 500 }, adminA)).status).toBe(422);
    expect((await api('PATCH', `/api/admin/classes/${cid}`, { grade: 5 }, adminA)).status).toBe(422);
    const closed = await api('PATCH', `/api/admin/classes/${cid}`, { is_active: false }, adminA);
    expect(closed.body).toMatchObject({ is_active: false, join_open: false, students: 1 });
    expect(closed.body.closed_at).toBeTruthy();
    expect(await db.query('SELECT 1 FROM app_class_members WHERE class_id = $1', [cid])).toHaveLength(1); // thành viên còn nguyên
    expect(await notes(tok.t2)).toContain('class_closed');
    expect((await join(tok.st2, '7A2', 'LopDongMo1')).status).toBe(400);
    expect((await api('POST', `/api/teacher/classes/${cid}/join-open`, { open: true }, tok.t2)).status).toBe(409); // lớp đã đóng
    // Ngưng khối khi còn lớp hoạt động bị chặn; ngưng được khi mọi lớp khối đó đã đóng; mở lại lớp khi khối ngưng bị chặn
    expect((await api('PUT', '/api/admin/school-grades', { school_year: YEAR, grade: 7, is_active: false }, adminA)).status).toBe(409);
    const other = (await db.query<{ id: number }>("SELECT id FROM app_classes WHERE class_code = '7A1' AND school_id = $1", [schoolA]))[0].id;
    await api('PATCH', `/api/admin/classes/${other}`, { is_active: false });
    expect((await api('PUT', '/api/admin/school-grades', { school_year: YEAR, grade: 7, is_active: false }, adminA)).body[0]).toMatchObject({ is_active: false, active_classes: 0, classes: 2 });
    expect((await api('PATCH', `/api/admin/classes/${cid}`, { is_active: true }, adminA)).status).toBe(409);
    expect((await newClass('7A3')).status).toBe(422); // khối đã ngưng
    await api('PUT', '/api/admin/school-grades', { school_year: YEAR, grade: 7, is_active: true }, adminA);
    expect((await api('PATCH', `/api/admin/classes/${cid}`, { is_active: true }, adminA)).body).toMatchObject({ is_active: true, join_open: false }); // mở lớp nhưng đăng ký vẫn đóng tới khi giáo viên mở
    expect((await api('GET', `/api/admin/classes/${cid}/events`)).body.map((e: any) => e.kind)).toEqual(expect.arrayContaining(['reopen', 'close', 'update', 'join_password', 'assign']));
  });

  test('luồng cũ giữ nguyên (giáo viên xin mở lớp, quản trị duyệt, học sinh vào) và RLS của bảng mới', async () => {
    const asked = await api('POST', '/api/teacher/classes', { class_code: '7C9', school_year: YEAR, name: 'Lớp xin mở', join_password: 'LopCu12345' }, tok.t1);
    expect(asked.status).toBe(201);
    expect((await api('POST', `/api/admin/classes/${asked.body.id}/approve`, {}, adminA)).status).toBe(200);
    expect((await api('GET', '/api/teacher/classes', undefined, tok.t1)).body.find((c: any) => c.class_code === '7C9')).toMatchObject({ status: 'APPROVED', join_open: true, has_password: true });
    expect((await join(tok.st2, '7C9', 'LopCu12345')).status).toBe(200);
    const approved = (await api('GET', '/api/admin/classes?status=APPROVED', undefined, adminA)).body;
    expect(approved.map((c: any) => c.class_code)).toEqual(expect.arrayContaining(['7A1', '7A2', '7C9']));
    expect(approved.find((c: any) => c.class_code === '7A2').teacher_name).toBe('Giáo viên A2'); // danh sách duyệt lớp vẫn hiện lớp do quản trị tạo
    // Bảng mới bật RLS; vai trò theo trường chỉ thấy trường mình và không sửa/xóa lịch sử
    for (const table of ['app_school_grades', 'app_class_events']) {
      expect(await db.query("SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = $1", [table])).toEqual([{ rowsecurity: true }]);
    }
    const scopedRows = await db.scoped(schoolA, (q) => q<{ school_id: number }>('SELECT DISTINCT school_id FROM app_class_events'));
    expect(scopedRows).toEqual([{ school_id: schoolA }]);
    await expect(db.scoped(schoolA, (q) => q("DELETE FROM app_class_events WHERE school_id = $1", [schoolA]))).rejects.toThrow(/permission denied/);
    const anyClass = (await db.query<{ id: number }>('SELECT id FROM app_classes WHERE school_id = $1 LIMIT 1', [schoolA]))[0].id;
    await expect(db.scoped(schoolA, (q) => q("INSERT INTO app_class_events (school_id, class_id, kind) VALUES ($1, $2, 'update')", [schoolB, anyClass]))).rejects.toThrow(/row-level security/);
  });
});
