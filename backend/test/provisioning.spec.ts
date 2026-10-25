/**
 * Nhiều trường và hai cấp quản trị: file Excel mẫu công khai, kiểm duyệt file, cấp tài khoản theo công thức, gửi thư hàng loạt,
 * RAG Smart Delta Dispatch (nhập lại chỉ gửi riêng dòng vừa bổ sung), Row-Level Security theo trường, lớp học chờ duyệt, thùng rác 45 ngày.
 * Backend NestJS thật + PostgreSQL tạm; dịch vụ Python được thay bằng FakeAi (cùng công thức tên đăng nhập/mật khẩu), email ghi nhận dạng json.
 */
import { adminLogin, call, fakeXlsx, hasPostgres, Started, startApp, upload } from './harness';
import type { MailService } from '../src/admin/mail.service';
import type { SchoolService } from '../src/admin/school.service';
import type { DatabaseService } from '../src/database/database.service';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

let s: Started;
let mail: MailService;
let school: SchoolService;
let db: DatabaseService;
let ROOT: string;
let SA: string;
let T: string;
let A: { id: number; school_code: string };
let B: { id: number; school_code: string };

const api = <R = any>(method: string, path: string, body?: unknown, token?: string) => call<R>(s.base, method, path, body, token);

const row = (n: number, role: 'HS' | 'GV', code: string, name: string, email: string, extra: Record<string, unknown> = {}, missing: string[] = []) => ({
  row: n,
  values: {
    user_code: code, school_name: 'THCS Văn Lang', school_code: '7480', region: 'Miền Nam', city: 'TP. Hồ Chí Minh', full_name: name,
    birth_date: role === 'GV' ? '1985-09-02' : '2012-04-06', school_year: '2023-2024', email, grade: 7, role, ...extra,
  },
  missing,
});

const firstRows = (thieuBirth: string | null) => [
  row(2, 'HS', 'HS001', 'Nguyễn Vũ Đức Anh', 'anh@example.edu.vn'),
  row(3, 'HS', 'HS002', 'Trần Thị Bích', 'bich@example.edu.vn'),
  row(4, 'GV', 'GV001', 'Phạm Văn Giáo', 'giao@example.edu.vn'),
  thieuBirth ? row(5, 'HS', 'HS003', 'Lê Minh Thiếu', 'thieu@example.edu.vn', { birth_date: thieuBirth }) : row(5, 'HS', 'HS003', 'Lê Minh Thiếu', 'thieu@example.edu.vn', { birth_date: null }, ['Ngày tháng năm sinh']),
  row(6, 'HS', 'HS900', 'Hồ Trường Khác', 'khac@example.edu.vn', { school_code: '0915' }),
  row(7, 'HS', 'HS001', 'Nguyễn Vũ Đức Anh', 'anh2@example.edu.vn'),
];

/** Đăng nhập lần đầu bằng mật khẩu được cấp rồi đặt mật khẩu mới; trả về token mới */
async function firstLogin(username: string, password: string, portal: string, newPassword: string): Promise<string> {
  const login = await api('POST', '/api/auth/login', { username, password, portal });
  expect(login.status).toBe(200);
  expect(login.body.user.must_change_password).toBe(true);
  return (await api('POST', '/api/auth/change-password', { current_password: password, new_password: newPassword }, login.body.token)).body.token;
}

(hasPostgres() ? describe : describe.skip)('Nhiều trường, nhập Excel, lớp học, thùng rác', () => {
  beforeAll(async () => {
    s = await startApp('provision_test');
    const { MailService: Mail } = await import('../src/admin/mail.service');
    const { SchoolService: School } = await import('../src/admin/school.service');
    const { DatabaseService: Database } = await import('../src/database/database.service');
    mail = s.moduleRef.get(Mail);
    school = s.moduleRef.get(School);
    db = s.moduleRef.get(Database);
    ROOT = await adminLogin(s.base);
    A = (await api('POST', '/api/admin/schools', { school_code: '7480', name: 'THCS Văn Lang', region: 'Miền Nam', city: 'TP. Hồ Chí Minh' }, ROOT)).body;
    B = (await api('POST', '/api/admin/schools', { school_code: 'BD-12-0915', name: 'THCS Ba Đình', region: 'Miền Bắc', city: 'Hà Nội' }, ROOT)).body;
    const sa = await api('POST', '/api/admin/users', { full_name: 'Lê Quản Trị', role: 'school_admin', school_id: A.id, password: 'tamthoi1' }, ROOT);
    expect([sa.status, sa.body.user.username, sa.body.user.school_id]).toEqual([201, 'qt.tri.lq', A.id]);
    SA = await firstLogin('qt.tri.lq', 'tamthoi1', 'school_admin', 'quantri1');
  });

  afterAll(async () => {
    await s?.close();
  });

  test('file mẫu công khai, mã trường chuẩn hóa, hai cổng quản trị tách biệt', async () => {
    const res = await fetch(`${s.base}/api/public/excel-template`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain(XLSX);
    expect(res.headers.get('content-disposition')).toContain('attachment');
    expect(Buffer.from(await res.arrayBuffer()).subarray(0, 4).toString('hex')).toBe('504b0304');
    expect([A.school_code, B.school_code]).toEqual(['7480', '0915']);
    expect((await api('POST', '/api/admin/schools', { school_code: '07480', name: 'Trùng mã' }, ROOT)).status).toBe(409);
    expect((await api('POST', '/api/admin/schools', { school_code: '1234', name: 'Tự tạo' }, SA)).status).toBe(403);
    const wrong = await api('POST', '/api/auth/login', { username: 'qt.tri.lq', password: 'quantri1', portal: 'root_admin' });
    expect([wrong.status, wrong.body.detail]).toEqual([403, 'Trang này chỉ dành cho tài khoản quản trị được cấp quyền.']);
    expect((await api('POST', '/api/auth/login', { username: 'admin', password: 'admin@123', portal: 'school_admin' })).status).toBe(403);
    expect((await api('POST', '/api/auth/login', { username: 'qt.tri.lq', password: 'quantri1', portal: 'app' })).body.detail).toBe('Tài khoản quản trị không đăng nhập ở trang học tập.');
  });

  test('từ chối file không phải .xlsx, sai MIME, nội dung giả và file sai chữ ký', async () => {
    expect((await upload(s.base, '/api/admin/import', 'ds.csv', Buffer.from('a,b'), 'text/csv', SA)).body.detail).toContain('Chỉ nhận file .xlsx');
    expect((await upload(s.base, '/api/admin/import', 'ds.xlsx', Buffer.from('PK'), 'application/vnd.ms-excel', SA)).body.detail).toContain('không phải file Excel .xlsx');
    const fake = await upload(s.base, '/api/admin/import', 'ds.xlsx', Buffer.from('không phải zip'), XLSX, SA);
    expect([fake.status, fake.body.detail]).toEqual([422, 'Nội dung không phải file .xlsx chuẩn']);
    const tampered = await upload(s.base, '/api/admin/import', 'ds.xlsx', fakeXlsx({ ok: false, errors: ['Cấu trúc cột đã bị sửa: cột 3 là "Mã trường" thay vì "Mã số trường"'] }), XLSX, SA);
    expect([tampered.status, tampered.body.detail]).toEqual([422, 'Cấu trúc cột đã bị sửa: cột 3 là "Mã trường" thay vì "Mã số trường"']);
    expect((await upload(s.base, '/api/admin/import', 'ds.xlsx', fakeXlsx({ rows: [] }), XLSX)).status).toBe(401);
  });

  test('nhập lần đầu: cấp tài khoản theo công thức, ghi dòng thiếu, gửi thư hàng loạt', async () => {
    const res = await upload(s.base, '/api/admin/import', 'lop7.xlsx', fakeXlsx({ rows: firstRows(null) }), XLSX, SA);
    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({ total: 6, created: 3, delta: 0, existing: 0, incomplete: 1, error: 2 });
    const by = (n: number) => res.body.rows.find((r: { row: number }) => r.row === n);
    expect([by(2).username, by(3).username, by(4).username]).toEqual([
      'anh.2374807022001@donga.local', 'bich.2374807022002@donga.local', 'giao.2374807022003@donga.local',
    ]);
    expect(by(5)).toMatchObject({ status: 'incomplete', missing: ['Ngày tháng năm sinh'] });
    expect(by(6).message).toContain('không phải trường của bạn');
    expect(by(7).message).toContain('Trùng mã người dùng');
    expect(res.body.emails_queued).toBe(3);
    expect(JSON.stringify(res.body)).not.toContain('VN@');

    // Chưa gửi: tải được danh sách tài khoản để phát tay
    const csv = await fetch(`${s.base}/api/admin/outbox/credentials.csv`, { headers: { Authorization: `Bearer ${SA}` } });
    const text = await csv.text();
    expect(text).toContain('anh.2374807022001@donga.local');
    expect(text).toContain('Nvda06042012VN@');
    expect(text).toContain('Pvg02091985VN@');

    expect(await mail.tick()).toBe(3);
    expect(mail.sent.map((m) => m.to).sort()).toEqual(['anh@example.edu.vn', 'bich@example.edu.vn', 'giao@example.edu.vn']);
    expect(mail.sent.find((m) => m.to === 'anh@example.edu.vn')!.text).toContain('Mật khẩu mặc định: Nvda06042012VN@');
    const outbox = (await api('GET', '/api/admin/outbox', undefined, SA)).body;
    expect(outbox.items.every((o: { status: string }) => o.status === 'sent')).toBe(true);
    expect(await db.query("SELECT 1 FROM app_email_outbox WHERE body_encrypted IS NOT NULL")).toEqual([]);
    expect((await api('GET', '/api/admin/incomplete', undefined, SA)).body.map((l: { user_code: string }) => l.user_code)).toEqual(['HS003']);

    const me = await api('POST', '/api/auth/login', { username: 'anh.2374807022001@donga.local', password: 'Nvda06042012VN@', portal: 'app' });
    expect(me.body.user).toMatchObject({ role: 'student', school_id: A.id, grade: 7, school_year: '2023-2024', birth_date: '2012-04-06', must_change_password: true });
  });

  test('nhập lại sau khi bổ sung: chỉ gửi riêng tài khoản vừa đủ thông tin (Smart Delta Dispatch)', async () => {
    const before = mail.sent.length;
    const res = await upload(s.base, '/api/admin/import', 'lop7-bo-sung.xlsx', fakeXlsx({ rows: firstRows('2012-11-20') }), XLSX, SA);
    expect(res.body.totals).toEqual({ total: 6, created: 0, delta: 1, existing: 3, incomplete: 0, error: 2 });
    expect(res.body.rows.find((r: { row: number }) => r.row === 5)).toMatchObject({ status: 'delta', username: 'thieu.2374807022004@donga.local' });
    expect(res.body.emails_queued).toBe(1);
    expect(await mail.tick()).toBe(1);
    expect(mail.sent.slice(before).map((m) => [m.to, m.subject])).toEqual([['thieu@example.edu.vn', 'Tài khoản Đông A EDU của Lê Minh Thiếu (bổ sung)']]);
    expect((await api('GET', '/api/admin/incomplete', undefined, SA)).body).toEqual([]);
    // Nhập lại lần nữa: không còn ai mới, không gửi thêm thư
    const again = await upload(s.base, '/api/admin/import', 'lop7.xlsx', fakeXlsx({ rows: firstRows('2012-11-20') }), XLSX, SA);
    expect(again.body.totals).toMatchObject({ created: 0, delta: 0, existing: 4 });
    expect(again.body.emails_queued).toBe(0);
    const batches = (await api('GET', '/api/admin/imports', undefined, SA)).body;
    expect(batches.map((b: { delta_count: number }) => b.delta_count)).toEqual([0, 1, 0]);
    expect((await api('GET', `/api/admin/imports/${batches[1].id}`, undefined, SA)).body.report).toHaveLength(6);
  });

  test('quản trị trường chỉ thấy trường mình (Row-Level Security)', async () => {
    const other = await api('POST', '/api/admin/users', { full_name: 'Đinh Thị Ngoài', role: 'student', school_id: B.id, grade: 8 }, ROOT);
    expect(other.body.user.school_code).toBe('0915');
    const mine = (await api('GET', '/api/admin/users?limit=200', undefined, SA)).body;
    expect(mine.items.length).toBeGreaterThanOrEqual(5);
    expect(mine.items.every((u: { school_id: number }) => u.school_id === A.id)).toBe(true);
    expect((await api('GET', `/api/admin/users?school_id=${B.id}`, undefined, SA)).body.items.every((u: { school_id: number }) => u.school_id === A.id)).toBe(true);
    expect((await api('PATCH', `/api/admin/users/${other.body.user.id}`, { full_name: 'Sửa trộm' }, SA)).status).toBe(404);
    expect((await api('POST', `/api/admin/users/${other.body.user.id}/reset-password`, undefined, SA)).status).toBe(404);
    expect((await api('DELETE', `/api/admin/users/${other.body.user.id}`, undefined, SA)).status).toBe(404);
    const filtered = (await api('GET', '/api/admin/users?role=student&grade=7&school_year=2023-2024&q=thieu', undefined, SA)).body;
    expect(filtered.items.map((u: { user_code: string }) => u.user_code)).toEqual(['HS003']);

    const sv = (await api('GET', '/api/admin/overview', undefined, SA)).body;
    expect(sv).toMatchObject({ scope: 'school', schools: 1, teachers: 1, students: 3, grades: { 6: 0, 7: 3, 8: 0, 9: 0 } });
    const root = (await api('GET', '/api/admin/overview', undefined, ROOT)).body;
    expect(root.per_school.map((x: { school_code: string; students: number }) => [x.school_code, x.students])).toEqual([
      ['0915', 1],
      ['7480', 3],
    ]);

    // Ở tầng CSDL: truy vấn không có WHERE trong phạm vi trường A vẫn chỉ thấy dữ liệu trường A
    expect(db.rlsReady).toBe(true);
    const seen = await db.scoped(A.id, (q) => q<{ n: number; schools: number }>('SELECT COUNT(*)::int AS n, COUNT(DISTINCT school_id)::int AS schools FROM app_users'));
    const total = await db.query<{ n: number }>('SELECT COUNT(*)::int AS n FROM app_users WHERE school_id = $1', [A.id]);
    expect(seen[0]).toEqual({ n: total[0].n, schools: 1 });
    await expect(db.scoped(A.id, (q) => q('UPDATE app_users SET full_name = $1 WHERE id = $2 RETURNING id', ['Sửa trộm', other.body.user.id]).then((r) => r.length))).resolves.toBe(0);
    await expect(db.scoped(A.id, (q) => q("INSERT INTO app_users (username, full_name, role, password_hash, created_at, school_id) VALUES ('lach.rls', 'Lách', 'student', 'x', 'now', $1)", [B.id]))).rejects.toThrow(/row-level security/);
  });

  test('giáo viên chỉ nhập được học sinh của trường mình', async () => {
    T = await firstLogin('giao.2374807022003@donga.local', 'Pvg02091985VN@', 'teacher', 'giaovien1');
    const res = await upload(s.base, '/api/teacher/import', 'hs-moi.xlsx', fakeXlsx({ rows: [row(2, 'GV', 'GV002', 'Vũ Thị Cô', 'co@example.edu.vn'), row(3, 'HS', 'HS010', 'Mai Thanh Hà', 'ha@example.edu.vn')] }), XLSX, T);
    expect(res.body.totals).toMatchObject({ created: 1, error: 1 });
    expect(res.body.rows[0].message).toContain('Giáo viên chỉ nhập được tài khoản học sinh');
    expect(res.body.rows[1].username).toBe('ha.2374807022005@donga.local');
    expect((await api('GET', '/api/teacher/imports', undefined, T)).body).toHaveLength(1);
    expect((await api('GET', '/api/admin/overview', undefined, T)).status).toBe(403);
    expect(await mail.tick()).toBe(1);
  });

  test('mở lớp: giáo viên gửi yêu cầu, quản trị duyệt (thông báo + email), học sinh vào lớp bằng mã + mật khẩu', async () => {
    const req = await api('POST', '/api/teacher/classes', { class_code: '7a1', school_year: '2023-2024', name: 'Lớp 7A1', join_password: 'lop7a1' }, T);
    expect(req.status).toBe(201);
    expect(req.body).toMatchObject({ class_code: '7A1', status: 'PENDING' });
    expect((await api('POST', '/api/teacher/classes', { class_code: '7A1', school_year: '2023-2024', name: 'Trùng', join_password: 'abcd' }, T)).status).toBe(409);
    const saNote = (await api('GET', '/api/auth/notifications', undefined, SA)).body;
    expect(saNote.items[0]).toMatchObject({ kind: 'class_request', title: 'Yêu cầu mở lớp mới' });
    expect((await api('GET', '/api/admin/classes?status=PENDING', undefined, SA)).body.map((c: { class_code: string }) => c.class_code)).toEqual(['7A1']);

    const before = mail.sent.length;
    expect((await api('POST', `/api/admin/classes/${req.body.id}/approve`, { note: 'Đủ điều kiện' }, SA)).body).toEqual({ id: req.body.id, status: 'APPROVED' });
    expect((await api('POST', `/api/admin/classes/${req.body.id}/approve`, {}, SA)).status).toBe(400);
    const tNote = (await api('GET', '/api/auth/notifications', undefined, T)).body;
    expect([tNote.unread, tNote.items[0].kind]).toEqual([1, 'class_approved']);
    await api('POST', '/api/auth/notifications/read', {}, T);
    expect((await api('GET', '/api/auth/notifications', undefined, T)).body.unread).toBe(0);
    expect(await mail.tick()).toBe(1);
    expect(mail.sent.slice(before)[0]).toMatchObject({ to: 'giao@example.edu.vn', subject: 'Lớp 7A1 đã được duyệt' });
    expect((await api('GET', '/api/auth/me', undefined, T)).body.class_name).toBe('7A1');

    const S = await firstLogin('anh.2374807022001@donga.local', 'Nvda06042012VN@', 'student', 'hocsinh1');
    expect((await api('POST', '/api/student/classes/join', { class_code: '7a1', password: 'sai-mat-khau' }, S)).body.detail).toBe('Sai mã lớp hoặc mật khẩu lớp');
    expect((await api('POST', '/api/student/classes/join', { class_code: '7a1', password: 'lop7a1' }, S)).body).toMatchObject({ class_code: '7A1', name: 'Lớp 7A1' });
    expect((await api('GET', '/api/auth/me', undefined, S)).body.class_name).toBe('7A1');
    expect((await api('GET', '/api/student/classes', undefined, S)).body.map((c: { class_code: string }) => c.class_code)).toEqual(['7A1']);
    expect((await api('GET', '/api/teacher/class', undefined, T)).body.students.map((x: { full_name: string }) => x.full_name)).toEqual(['Nguyễn Vũ Đức Anh']);
    expect((await api('GET', '/api/teacher/classes', undefined, T)).body[0]).toMatchObject({ class_code: '7A1', status: 'APPROVED', members: 1 });

    // Học sinh trường khác không vào được lớp của trường này
    const outsider = await api('POST', '/api/admin/users', { full_name: 'Học Sinh Trường B', role: 'student', school_id: B.id, password: 'tamthoi2' }, ROOT);
    const O = await firstLogin(outsider.body.user.username, 'tamthoi2', 'student', 'hocsinh2');
    expect((await api('POST', '/api/student/classes/join', { class_code: '7A1', password: 'lop7a1' }, O)).status).toBe(400);

    const second = await api('POST', '/api/teacher/classes', { class_code: '7A2', school_year: '2023-2024', name: 'Lớp 7A2', join_password: 'lop7a2' }, T);
    expect((await api('POST', `/api/admin/classes/${second.body.id}/reject`, { note: 'Trùng lịch' }, SA)).body.status).toBe('REJECTED');
    expect((await api('GET', '/api/auth/notifications', undefined, T)).body.items[0]).toMatchObject({ kind: 'class_rejected', body: '"Lớp 7A2" – lý do: Trùng lịch.' });
    expect((await api('POST', `/api/teacher/classes/${second.body.id}/activate`, undefined, T)).status).toBe(400);
  });

  test('thùng rác 45 ngày: xóa, khôi phục, tự xóa vĩnh viễn khi hết hạn', async () => {
    const target = (await api('GET', '/api/admin/users?q=bich', undefined, SA)).body.items[0];
    expect((await api('DELETE', `/api/admin/users/${target.id}`, undefined, SA)).status).toBe(204);
    expect((await api('GET', '/api/admin/trash', undefined, SA)).body.map((u: { id: number; days_left: number }) => [u.id, u.days_left])).toEqual([[target.id, 45]]);
    expect((await api('GET', '/api/admin/trash', undefined, ROOT)).body.some((u: { id: number }) => u.id === target.id)).toBe(true);
    await db.query("UPDATE app_users SET purge_at = now() - interval '1 minute' WHERE id = $1", [target.id]);
    expect(await school.purgeExpired()).toBe(1);
    expect(await db.getById(target.id)).toBeNull();
    expect((await api('GET', '/api/admin/trash', undefined, SA)).body).toEqual([]);
  });
});
