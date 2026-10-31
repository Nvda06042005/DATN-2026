/**
 * Sprint 1 (HK.HS.001–010, HK.GV.001–006, HK.QT.001–005, HK.AD.001/003–005/011–016/018–025, HK.SYS.015):
 * xác thực, quên mật khẩu bằng OTP, hồ sơ, đăng ký tự học, đăng nhập Google, tham gia lớp bằng mã, quản lý trường và người dùng.
 * Chạy HTTP thật trên PostgreSQL tạm; email chỉ ghi nhận trong bộ nhớ.
 */
import { activate, adminLogin, call, hasPostgres, Started, startApp } from './harness';
import type { MailService } from '../src/admin/mail.service';
import type { AuthService } from '../src/auth/auth.service';
import type { DatabaseService } from '../src/database/database.service';

let s: Started, db: DatabaseService, mail: MailService, root: string;
const PW = 'Matkhau-12345';
const api = (method: string, path: string, body?: unknown, token = root) => call(s.base, method, path, body, token);
const login = (username: string, password = PW, portal = 'app') => api('POST', '/api/auth/login', { username, password, portal }, '');

/** Chờ thư gửi tới `to` (thư OTP gửi nền) và trả mã 6 chữ số trong thư */
async function otpFor(to: string): Promise<string> {
  for (let i = 0; i < 60; i += 1) {
    const found = [...mail.sent].reverse().find((m) => m.to === to && /Mã xác thực của bạn là: (\d{6})/.test(m.text));
    if (found) return /Mã xác thực của bạn là: (\d{6})/.exec(found.text)![1];
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`Không có thư OTP cho ${to}`);
}

async function newSchool(code: string, name: string, adminName: string, email: string) {
  const created = await api('POST', '/api/admin/schools', { school_code: code, name, city: 'Hà Nội', admin: { full_name: adminName, email } });
  expect(created.status).toBe(201);
  const active = await activate(s.base, created.body.admin.username, created.body.temporary_password, PW, 'school_admin');
  return { id: created.body.school.id as number, token: active.token, admin: active.user, created: created.body };
}

(hasPostgres() ? describe : describe.skip)('Sprint 1 – xác thực, tài khoản, trường học', () => {
  let a: Awaited<ReturnType<typeof newSchool>>, b: Awaited<ReturnType<typeof newSchool>>;
  let yearA: number, classA: { id: number; join_code: string };

  beforeAll(async () => {
    s = await startApp('sprint1_test');
    db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    mail = s.moduleRef.get((await import('../src/admin/mail.service')).MailService);
    root = await adminLogin(s.base);
    a = await newSchool('7001', 'THCS Kiểm Thử A', 'Nguyễn Quản Trị A', 'qt.a@example.edu.vn');
    b = await newSchool('7002', 'THCS Kiểm Thử B', 'Trần Quản Trị B', 'qt.b@example.edu.vn');
    yearA = (await call(s.base, 'POST', '/api/admin/school-years', { label: '2026-2027', starts_on: '2026-09-05', ends_on: '2027-05-31' }, a.token)).body.id;
    await call(s.base, 'POST', `/api/admin/school-years/${yearA}/activate`, undefined, a.token);
    classA = (await call(s.base, 'POST', '/api/admin/classes', { year_id: yearA, grade: 7, name: '7A1' }, a.token)).body;
  });
  afterAll(async () => { await s?.close(); });

  // ------------------------------------------------------------------ HK.AD.011–016
  test('HK.AD.013 thêm trường tạo quản trị viên đầu tiên với mật khẩu tạm và thư kích hoạt; mã trường/email trùng bị từ chối', async () => {
    expect(a.created.admin).toMatchObject({ role: 'school_admin', must_change_password: true, email: 'qt.a@example.edu.vn' });
    expect(a.created.admin.password_hash).toBeUndefined();
    expect(a.created.temporary_password).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(a.created.mail).toBe('queued');
    // Thư kích hoạt nằm trong hàng đợi; quản trị viên đã đổi mật khẩu thì thư chứa mật khẩu tạm bị hủy thay vì gửi một mật khẩu không còn dùng được
    await mail.tick();
    expect(mail.sent.find((m) => m.to === 'qt.a@example.edu.vn')).toBeUndefined();
    const pending = await api('POST', '/api/admin/schools', { school_code: '7004', name: 'Trường chưa kích hoạt', admin: { full_name: 'Chưa Kích Hoạt', email: 'chua.kichhoat@example.edu.vn' } });
    await mail.tick();
    const sent = mail.sent.find((m) => m.to === 'chua.kichhoat@example.edu.vn');
    expect(sent?.subject).toContain('Kích hoạt tài khoản quản trị viên trường học');
    expect(sent?.text).toContain(pending.body.temporary_password);
    expect(sent?.text).toContain('/school-manager-admin');
    expect((await api('POST', '/api/admin/schools', { school_code: '7001', name: 'Trùng mã', admin: { full_name: 'Ai Đó', email: 'khac@example.edu.vn' } })).status).toBe(409);
    expect((await api('POST', '/api/admin/schools', { school_code: '7003', name: 'Trùng email', admin: { full_name: 'Ai Đó', email: 'QT.A@example.edu.vn' } })).status).toBe(409);
    expect((await api('POST', '/api/admin/schools', { school_code: '7003', name: 'Thiếu quản trị' })).status).toBe(422);
    expect((await api('POST', '/api/admin/schools', { school_code: '7003', name: 'QTV trường không tạo được', admin: { full_name: 'Ai Đó', email: 'x@example.edu.vn' } }, a.token)).status).toBe(403);
  });

  test('HK.AD.011/012 xem danh sách trường kèm số người dùng, lọc theo tên/mã, tỉnh thành, trạng thái', async () => {
    const all = await api('GET', '/api/admin/schools');
    expect(all.body.items.map((x: any) => x.school_code)).toEqual(expect.arrayContaining(['7001', '7002']));
    const first = all.body.items.find((x: any) => x.school_code === '7001');
    expect(first).toMatchObject({ users: 1, admins: 1, teachers: 0, students: 0, classes: 1, is_active: true });
    expect(first.created_at).toBeTruthy();
    expect((await api('GET', '/api/admin/schools?q=Kiểm Thử B')).body.items.map((x: any) => x.school_code)).toEqual(['7002']);
    expect((await api('GET', '/api/admin/schools?q=7001')).body.items).toHaveLength(1);
    expect((await api('GET', '/api/admin/schools?city=Hà Nội&active=true')).body.total).toBeGreaterThanOrEqual(2);
    expect((await api('GET', '/api/admin/schools?active=false')).body.items.filter((x: any) => ['7001', '7002'].includes(x.school_code))).toHaveLength(0);
    expect((await api('GET', '/api/admin/schools', undefined, a.token)).status).toBe(403);
  });

  test('HK.AD.014/015 sửa thông tin trường; vô hiệu hóa thì tài khoản của trường không đăng nhập được và phiên cũ bị thu hồi', async () => {
    const c = await newSchool('7090', 'Trường sẽ bị khóa', 'Quản Trị Khóa', 'khoa@example.edu.vn');
    const edited = await api('PATCH', `/api/admin/schools/${c.id}`, { name: 'Trường đã đổi tên', address: '1 Phố Thử', contact_email: 'LienHe@Example.edu.vn', logo_url: 'https://example.edu.vn/logo.png' });
    expect(edited.body).toMatchObject({ name: 'Trường đã đổi tên', address: '1 Phố Thử', contact_email: 'lienhe@example.edu.vn', logo_url: 'https://example.edu.vn/logo.png' });
    expect((await api('PATCH', `/api/admin/schools/${c.id}`, { logo_url: 'http://khong-https.example/logo.png' })).status).toBe(422);
    expect((await call(s.base, 'GET', '/api/auth/me', undefined, c.token)).status).toBe(200);
    expect((await api('PATCH', `/api/admin/schools/${c.id}`, { is_active: false })).body.is_active).toBe(false);
    expect((await call(s.base, 'GET', '/api/auth/me', undefined, c.token)).status).toBe(401);
    const blocked = await login(c.admin.username, PW, 'school_admin');
    expect(blocked.status).toBe(403);
    expect(blocked.body.detail).toContain('Trường đang tạm ngưng');
    expect((await api('PATCH', `/api/admin/schools/${c.id}`, { is_active: true })).body.is_active).toBe(true);
    expect((await login(c.admin.username, PW, 'school_admin')).status).toBe(200);
  });

  test('HK.AD.016 chỉ xóa trường chưa phát sinh dữ liệu', async () => {
    const empty = await api('POST', '/api/admin/schools', { school_code: '7091', name: 'Trường trống', admin: { full_name: 'Chưa Dùng', email: 'chuadung@example.edu.vn' } });
    expect((await api('DELETE', `/api/admin/schools/${empty.body.school.id}`)).status).toBe(204);
    expect(await db.query('SELECT 1 FROM app_schools WHERE school_code = $1', ['7091'])).toHaveLength(0);
    expect(await db.query('SELECT 1 FROM app_users WHERE email = $1', ['chuadung@example.edu.vn'])).toHaveLength(0);
    const used = await api('DELETE', `/api/admin/schools/${a.id}`);
    expect(used.status).toBe(409);
    expect(used.body.detail).toContain('chỉ có thể vô hiệu hóa');
    // Quản trị viên đã đăng nhập nên cũng tính là đã sử dụng
    const loggedIn = await newSchool('7092', 'Trường đã dùng', 'Đã Đăng Nhập', 'dadung@example.edu.vn');
    expect((await api('DELETE', `/api/admin/schools/${loggedIn.id}`)).status).toBe(409);
  });

  // ------------------------------------------------------------------ HK.HS.001, GV.001, QT.001, AD.001
  test('HK.*.001 đăng nhập đúng cổng; sai cổng bị từ chối; lỗi không lộ tài khoản có tồn tại hay không', async () => {
    expect((await login(a.admin.username, PW, 'school_admin')).body.user.role).toBe('school_admin');
    const wrongPortal = await login(a.admin.username, PW, 'root_admin');
    expect(wrongPortal.status).toBe(403);
    expect((await login('admin', 'admin@123', 'school_admin')).status).toBe(403);
    expect((await login('admin', 'admin@123', 'root_admin')).body.user).toMatchObject({ role: 'root_admin', admin_level: 1 });
    const wrongUser = await login('khong-ton-tai', 'whatever1');
    const wrongPass = await login(a.admin.username, 'sai-mat-khau1', 'school_admin');
    expect([wrongUser.status, wrongPass.status]).toEqual([401, 401]);
    expect(wrongUser.body.detail).toBe(wrongPass.body.detail);
  });

  test('HK.HS.001 đăng nhập bằng tên đăng nhập, email hoặc mã học sinh; 5 lần sai khóa 15 phút theo tài khoản', async () => {
    const created = await api('POST', '/api/admin/students', { user_code: 'HS7001', full_name: 'Lê Thị Đăng Nhập', birth_date: '2013-04-02', gender: 'female', email: 'dangnhap@example.edu.vn' }, a.token);
    expect(created.status).toBe(201);
    const { username } = created.body.user, temp = created.body.temporary_password;
    for (const who of [username, 'DangNhap@Example.edu.vn', ' hs7001 ']) expect([(await login(who, temp, 'student')).status, who]).toEqual([200, who]);
    const ids = [username, 'dangnhap@example.edu.vn', 'HS7001', username, 'dangnhap@example.edu.vn'];
    for (const id of ids) expect((await login(id, 'sai-mat-khau1', 'student')).status).toBe(401);
    const locked = await login('hs7001', temp, 'student');
    expect(locked.status).toBe(429);
    expect(locked.body.detail).toMatch(/^Sai quá nhiều lần\. Thử lại sau (14|15) phút\.$/);
    expect((await login(a.admin.username, PW, 'school_admin')).status).toBe(200);
  });

  // ------------------------------------------------------------------ HK.HS.004
  test('HK.HS.004 mật khẩu tạm: chỉ được đổi mật khẩu/xem hồ sơ cho đến khi đổi; sau đó xác nhận hồ sơ', async () => {
    const created = await api('POST', '/api/admin/students', { user_code: 'HS7002', full_name: 'Phạm Lần Đầu', birth_date: '2013-01-09' }, a.token);
    const first = await login(created.body.user.username, created.body.temporary_password, 'student');
    expect(first.body.user.must_change_password).toBe(true);
    const token = first.body.token as string;
    expect((await call(s.base, 'GET', '/api/student/classes', undefined, token)).status).toBe(403);
    expect((await call(s.base, 'POST', '/api/student/join-class', { code: classA.join_code }, token)).status).toBe(403);
    const profile = await call(s.base, 'GET', '/api/auth/profile', undefined, token);
    expect(profile.body.needs_profile_confirmation).toBe(true);
    expect(profile.body.school.name).toBe('THCS Kiểm Thử A');
    const changed = await call(s.base, 'POST', '/api/auth/change-password', { current_password: created.body.temporary_password, new_password: PW }, token);
    expect(changed.status).toBe(200);
    expect(changed.body.user.must_change_password).toBe(false);
    expect((await call(s.base, 'GET', '/api/auth/me', undefined, token)).status).toBe(401); // token cũ mất hiệu lực
    const confirmed = await call(s.base, 'POST', '/api/auth/confirm-profile', { email: 'phamlandau@example.edu.vn' }, changed.body.token);
    expect(confirmed.body.needs_profile_confirmation).toBe(false);
    expect(confirmed.body.user.email).toBe('phamlandau@example.edu.vn');
    expect((await call(s.base, 'GET', '/api/student/classes', undefined, changed.body.token)).status).toBe(200);
  });

  // ------------------------------------------------------------------ HK.HS.005/006/007 và tương ứng GV, QT, AD
  test('HK.*.005 quên mật khẩu bằng OTP 5 phút cho cả bốn vai trò; OTP dùng một lần, sai 5 lần thì vô hiệu, mật khẩu mới theo chính sách', async () => {
    const teacher = await api('POST', '/api/admin/teachers', { full_name: 'Giáo Viên Quên Mật Khẩu', email: 'gv.quen@example.edu.vn' }, a.token);
    expect(teacher.status).toBe(201);
    const who: Array<[string, string]> = [['qt.a@example.edu.vn', 'school_admin'], ['gv.quen@example.edu.vn', 'teacher'], ['quantri@example.invalid', 'root_admin']];
    for (const [email, role] of who) {
      expect((await api('POST', '/api/auth/forgot-password', { identifier: email }, '')).body).toEqual({ ok: true });
      const code = await otpFor(email);
      const weak = await api('POST', '/api/auth/reset-password', { identifier: email, otp: code, new_password: 'abc123' }, '');
      expect(weak.status).toBe(422);
      const ok = await api('POST', '/api/auth/reset-password', { identifier: email, otp: code, new_password: `Moi-${role}-9` }, '');
      expect(ok.status).toBe(200);
      expect((await api('POST', '/api/auth/reset-password', { identifier: email, otp: code, new_password: 'Khac-lan2-9' }, '')).status).toBe(400); // dùng một lần
      const username = email === 'qt.a@example.edu.vn' ? a.admin.username : email === 'gv.quen@example.edu.vn' ? teacher.body.user.username : 'admin';
      expect((await login(username, `Moi-${role}-9`, role)).status).toBe(200);
    }
    // Khôi phục mật khẩu cũ của quản trị tổng cho các bài sau
    await db.query("UPDATE app_users SET password_hash = $1, token_version = token_version + 1 WHERE username = 'admin'", [await (await import('../src/auth/passwords')).hashPassword('admin@123', 4)]);
    root = await adminLogin(s.base);
    await db.query("UPDATE app_users SET password_hash = $1, token_version = token_version + 1 WHERE id = $2", [await (await import('../src/auth/passwords')).hashPassword(PW, 4), a.admin.id]);
    a.token = (await login(a.admin.username, PW, 'school_admin')).body.token;
  });

  test('HK.*.005 OTP: tài khoản không tồn tại trả lời giống hệt; sai quá 5 lần bị vô hiệu; hết hạn thì từ chối', async () => {
    expect((await api('POST', '/api/auth/forgot-password', { identifier: 'khong.co@example.edu.vn' }, '')).body).toEqual({ ok: true });
    const teacher = await api('POST', '/api/admin/teachers', { full_name: 'Giáo Viên OTP', email: 'gv.otp@example.edu.vn' }, a.token);
    await api('POST', '/api/auth/forgot-password', { identifier: 'gv.otp@example.edu.vn' }, '');
    const code = await otpFor('gv.otp@example.edu.vn');
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i += 1) expect((await api('POST', '/api/auth/reset-password', { identifier: 'gv.otp@example.edu.vn', otp: wrong, new_password: 'Moi-matkhau-9' }, '')).status).toBe(400);
    expect((await api('POST', '/api/auth/reset-password', { identifier: 'gv.otp@example.edu.vn', otp: code, new_password: 'Moi-matkhau-9' }, '')).status).toBe(400);
    await api('POST', '/api/auth/forgot-password', { identifier: teacher.body.user.username }, '');
    await new Promise((r) => setTimeout(r, 300));
    await db.query("UPDATE app_password_resets SET expires_at = now() - interval '1 minute' WHERE user_id = $1", [teacher.body.user.id]);
    const stale = await otpFor('gv.otp@example.edu.vn');
    expect((await api('POST', '/api/auth/reset-password', { identifier: 'gv.otp@example.edu.vn', otp: stale, new_password: 'Moi-matkhau-9' }, '')).status).toBe(400);
  });

  test('HK.*.006/007 đổi mật khẩu cần mật khẩu cũ và chính sách; đăng xuất thu hồi đúng phiên đó', async () => {
    const t1 = (await login(a.admin.username, PW, 'school_admin')).body.token as string, t2 = (await login(a.admin.username, PW, 'school_admin')).body.token as string;
    for (const weak of ['abc123', 'chicochuuu', '1234567890', 'a1b2c3d']) expect((await api('POST', '/api/auth/change-password', { current_password: PW, new_password: weak }, t1)).status).toBe(422);
    expect((await api('POST', '/api/auth/change-password', { current_password: 'sai-mat-khau-1', new_password: 'Mat-khau-moi-9' }, t1)).status).toBe(400);
    expect((await api('POST', '/api/auth/change-password', { current_password: PW, new_password: PW }, t1)).status).toBe(400);
    expect((await api('POST', '/api/auth/logout', {}, t1)).status).toBe(200);
    expect((await api('GET', '/api/auth/me', undefined, t1)).status).toBe(401);
    expect((await api('GET', '/api/auth/me', undefined, t2)).status).toBe(200);
  });

  // ------------------------------------------------------------------ HK.HS.002
  test('HK.HS.002 đăng nhập Google chỉ khi email Google trùng email trong hồ sơ học sinh', async () => {
    const created = await api('POST', '/api/admin/students', { user_code: 'HS7003', full_name: 'Đỗ Google', birth_date: '2013-02-02', email: 'dogoogle@example.edu.vn' }, a.token);
    const auth: AuthService = s.moduleRef.get((await import('../src/auth/auth.service')).AuthService);
    const spy = jest.spyOn(auth, 'verifyGoogleToken');
    try {
      spy.mockResolvedValue({ email: 'dogoogle@example.edu.vn' });
      const ok = await api('POST', '/api/auth/google', { id_token: 'x'.repeat(40) }, '');
      expect(ok.status).toBe(200);
      expect(ok.body.user).toMatchObject({ id: created.body.user.id, role: 'student' });
      spy.mockResolvedValue({ email: 'khong-co@example.edu.vn' });
      expect((await api('POST', '/api/auth/google', { id_token: 'x'.repeat(40) }, '')).status).toBe(401);
      spy.mockResolvedValue({ email: 'qt.a@example.edu.vn' }); // email của quản trị viên: không dùng Google để đăng nhập
      expect((await api('POST', '/api/auth/google', { id_token: 'x'.repeat(40) }, '')).status).toBe(401);
      await api('POST', `/api/admin/users/${created.body.user.id}/lock`, { locked: true, reason: 'Thử khóa' }, a.token);
      spy.mockResolvedValue({ email: 'dogoogle@example.edu.vn' });
      const locked = await api('POST', '/api/auth/google', { id_token: 'x'.repeat(40) }, '');
      expect(locked.status).toBe(403);
      expect(locked.body.detail).toContain('Thử khóa');
    } finally {
      spy.mockRestore();
    }
    const real = await api('POST', '/api/auth/google', { id_token: 'x'.repeat(40) }, '');
    expect([401, 503]).toContain(real.status); // không có mạng/Google: mã giả bị từ chối, không đăng nhập được
  });

  // ------------------------------------------------------------------ HK.HS.003
  test('HK.HS.003 đăng ký tự học bằng email + OTP: tài khoản không thuộc trường, không vào lớp được; email đã dùng không lộ ra', async () => {
    expect((await api('POST', '/api/auth/register/request', { email: 'tuhoc@example.com' }, '')).body).toEqual({ ok: true });
    const code = await otpFor('tuhoc@example.com');
    const body = { email: 'tuhoc@example.com', otp: code, full_name: 'Học Sinh Tự Học', nickname: 'Tự Học', password: 'Tu-hoc-12345' };
    expect((await api('POST', '/api/auth/register/verify', { ...body, otp: code === '000000' ? '111111' : '000000' }, '')).status).toBe(400);
    expect((await api('POST', '/api/auth/register/verify', { ...body, password: 'ngan1' }, '')).status).toBe(422);
    const done = await api('POST', '/api/auth/register/verify', body, '');
    expect(done.status).toBe(200);
    expect(done.body.user).toMatchObject({ role: 'student', school_id: null, self_registered: true, must_change_password: false, email: 'tuhoc@example.com', nickname: 'Tự Học' });
    expect((await api('POST', '/api/auth/register/verify', body, '')).status).toBe(400); // OTP dùng một lần
    expect((await login('tuhoc@example.com', 'Tu-hoc-12345', 'student')).status).toBe(200);
    const join = await call(s.base, 'POST', '/api/student/join-class', { code: classA.join_code }, done.body.token);
    expect(join.status).toBe(403);
    // Email đã có tài khoản: vẫn trả {ok:true} nhưng không gửi mã
    const before = mail.sent.length;
    expect((await api('POST', '/api/auth/register/request', { email: 'qt.a@example.edu.vn' }, '')).body).toEqual({ ok: true });
    await new Promise((r) => setTimeout(r, 300));
    expect(mail.sent.length).toBe(before);
  });

  // ------------------------------------------------------------------ HK.HS.008
  test('HK.HS.008 tham gia lớp bằng mã 6 ký tự (không mật khẩu): nhiều lớp, đã vào rồi, mã trường khác, tắt tham gia, lớp lưu trữ, đổi mã', async () => {
    const student = await api('POST', '/api/admin/students', { user_code: 'HS7010', full_name: 'Ngô Vào Lớp', birth_date: '2013-06-06' }, a.token);
    const token = (await activate(s.base, student.body.user.username, student.body.temporary_password, PW, 'student')).token;
    expect(classA.join_code).toMatch(/^[A-Z2-9]{6}$/);
    expect((await call(s.base, 'POST', '/api/student/join-class', { code: 'ab' }, token)).status).toBe(422);
    expect((await call(s.base, 'POST', '/api/student/join-class', { code: 'ZZZZZZ' }, token)).status).toBe(404);
    const joined = await call(s.base, 'POST', '/api/student/join-class', { code: ` ${classA.join_code.toLowerCase()} ` }, token);
    expect(joined.status).toBe(200);
    expect(joined.body).toMatchObject({ name: '7A1', students: expect.any(Number) });
    expect((await call(s.base, 'POST', '/api/student/join-class', { code: classA.join_code }, token)).status).toBe(409);
    // Lớp thứ hai: một học sinh thuộc nhiều lớp
    const class2 = (await call(s.base, 'POST', '/api/admin/classes', { year_id: yearA, grade: 7, name: '7A2' }, a.token)).body;
    expect((await call(s.base, 'POST', '/api/student/join-class', { code: class2.join_code }, token)).status).toBe(200);
    expect((await call(s.base, 'GET', '/api/student/classes', undefined, token)).body.map((c: any) => c.name)).toEqual(['7A1', '7A2']);
    // Mã của trường khác trả về như mã sai
    const classB = await (async () => {
      const y = (await call(s.base, 'POST', '/api/admin/school-years', { label: '2026-2027', starts_on: '2026-09-05', ends_on: '2027-05-31' }, b.token)).body.id;
      return (await call(s.base, 'POST', '/api/admin/classes', { year_id: y, grade: 8, name: '8B1' }, b.token)).body;
    })();
    expect((await call(s.base, 'POST', '/api/student/join-class', { code: classB.join_code }, token)).status).toBe(404);
    // Tắt cho phép tự tham gia, lưu trữ lớp, đổi mã
    const other = await api('POST', '/api/admin/students', { user_code: 'HS7011', full_name: 'Vũ Chưa Vào', birth_date: '2013-07-07' }, a.token);
    const otherToken = (await activate(s.base, other.body.user.username, other.body.temporary_password, PW, 'student')).token;
    await call(s.base, 'PATCH', `/api/admin/classes/${class2.id}`, { join_open: false }, a.token);
    expect((await call(s.base, 'POST', '/api/student/join-class', { code: class2.join_code }, otherToken)).status).toBe(403);
    const regenerated = (await call(s.base, 'POST', `/api/admin/classes/${class2.id}/regenerate-code`, undefined, a.token)).body;
    expect(regenerated.join_code).not.toBe(class2.join_code);
    expect((await call(s.base, 'POST', '/api/student/join-class', { code: class2.join_code }, otherToken)).status).toBe(404);
    await call(s.base, 'PATCH', `/api/admin/classes/${class2.id}`, { join_open: true }, a.token);
    await call(s.base, 'POST', `/api/admin/classes/${classA.id}/archive`, { archived: true }, a.token);
    expect((await call(s.base, 'POST', '/api/student/join-class', { code: classA.join_code }, otherToken)).status).toBe(409);
    await call(s.base, 'POST', `/api/admin/classes/${classA.id}/archive`, { archived: false }, a.token);
    expect((await call(s.base, 'POST', '/api/student/join-class', { code: regenerated.join_code }, otherToken)).status).toBe(200);
  });

  // ------------------------------------------------------------------ HK.HS.009/010, GV.005/006, QT.005, AD.005
  test('HK.*.009/010 hồ sơ cá nhân: mỗi vai trò chỉ tự sửa trường được phép; học sinh thấy lớp, trường', async () => {
    const student = await api('POST', '/api/admin/students', { user_code: 'HS7020', full_name: 'Bùi Hồ Sơ', birth_date: '2013-08-08', class_id: classA.id }, a.token);
    const st = await activate(s.base, student.body.user.username, student.body.temporary_password, PW, 'student');
    const view = await call(s.base, 'GET', '/api/auth/profile', undefined, st.token);
    expect(view.body).toMatchObject({ school: { name: 'THCS Kiểm Thử A' }, editable: ['nickname', 'avatar_url', 'bio'] });
    expect(view.body.classes.map((c: any) => [c.name, c.school_year])).toEqual([['7A1', '2026-2027']]);
    const edited = await call(s.base, 'PATCH', '/api/auth/profile', { nickname: 'Hồ Sơ Bự', avatar_url: 'https://example.edu.vn/a.png' }, st.token);
    expect(edited.body.user).toMatchObject({ nickname: 'Hồ Sơ Bự', avatar_url: 'https://example.edu.vn/a.png' });
    for (const bad of [{ full_name: 'Tên Khác' }, { email: 'x@example.edu.vn' }]) expect((await call(s.base, 'PATCH', '/api/auth/profile', bad, st.token)).status).toBe(422);
    expect((await call(s.base, 'PATCH', '/api/auth/profile', { avatar_url: 'http://khong-https.example/a.png' }, st.token)).status).toBe(422);

    const teacher = await api('POST', '/api/admin/teachers', { full_name: 'Cô Giáo Hồ Sơ', email: 'gv.hoso@example.edu.vn', subject: 'Lịch sử' }, a.token);
    const gv = await activate(s.base, teacher.body.user.username, teacher.body.temporary_password, PW, 'teacher');
    await call(s.base, 'PATCH', `/api/admin/classes/${classA.id}`, { teacher_ids: [gv.user.id] }, a.token);
    const gvView = await call(s.base, 'GET', '/api/auth/profile', undefined, gv.token);
    expect(gvView.body.editable).toEqual(['phone', 'avatar_url', 'bio']);
    expect(gvView.body.classes.map((c: any) => c.name)).toEqual(['7A1']);
    expect((await call(s.base, 'PATCH', '/api/auth/profile', { phone: '0912 345 678', bio: 'Dạy Lịch sử 7.' }, gv.token)).body.user).toMatchObject({ phone: '0912 345 678', bio: 'Dạy Lịch sử 7.' });
    expect((await call(s.base, 'PATCH', '/api/auth/profile', { full_name: 'Tên Khác' }, gv.token)).status).toBe(422);

    const qt = await call(s.base, 'PATCH', '/api/auth/profile', { full_name: 'Nguyễn Quản Trị Đổi', phone: '0987 654 321', email: 'qt.a.moi@example.edu.vn' }, a.token);
    expect(qt.body.user).toMatchObject({ full_name: 'Nguyễn Quản Trị Đổi', phone: '0987 654 321', email: 'qt.a.moi@example.edu.vn' });
    expect((await call(s.base, 'PATCH', '/api/auth/profile', { email: 'gv.hoso@example.edu.vn' }, a.token)).status).toBe(409); // email của người khác
    await call(s.base, 'PATCH', '/api/auth/profile', { email: 'qt.a@example.edu.vn' }, a.token);
    expect((await api('PATCH', '/api/auth/profile', { full_name: 'Quản Trị Tổng', phone: '0900 000 000' })).body.user.full_name).toBe('Quản Trị Tổng');
  });

  // ------------------------------------------------------------------ HK.AD.018–025
  test('HK.AD.018/019 xem và lọc người dùng toàn hệ thống theo vai trò, trường, trạng thái, từ khóa không dấu', async () => {
    const all = await api('GET', '/api/admin/users?limit=200');
    expect(all.body.items[0]).toHaveProperty('last_login_at');
    expect(all.body.items.every((u: any) => u.password_hash === undefined && u.token_version === undefined)).toBe(true);
    expect((await api('GET', `/api/admin/users?role=school_admin&school_id=${a.id}`)).body.items.map((u: any) => u.school_id)).toEqual([a.id]);
    expect((await api('GET', '/api/admin/users?q=nguyen%20quan%20tri')).body.items.length).toBeGreaterThanOrEqual(1);
    expect((await api('GET', '/api/admin/users?role=root_admin')).body.items.every((u: any) => u.role === 'root_admin')).toBe(true);
    expect((await api('GET', '/api/admin/users?active=false')).body.items.every((u: any) => u.is_active === false)).toBe(true);
    // Quản trị trường chỉ thấy giáo viên và học sinh của trường mình
    const own = await api('GET', `/api/admin/users?school_id=${b.id}&limit=200`, undefined, a.token);
    expect(own.body.items.every((u: any) => u.school_id === a.id && ['teacher', 'student'].includes(u.role))).toBe(true);
  });

  test('HK.AD.020/022 tạo quản trị tổng cấp 2 và quản trị viên trường; cấp 2 không đụng được quản trị tổng; đổi vai trò thu hồi phiên', async () => {
    const level2 = await api('POST', '/api/admin/users', { full_name: 'Quản Trị Cấp Hai', role: 'root_admin', email: 'cap2@example.edu.vn', admin_level: 2 });
    expect(level2.status).toBe(201);
    expect(level2.body.user).toMatchObject({ role: 'root_admin', admin_level: 2, school_id: null });
    const l2 = await activate(s.base, level2.body.user.username, level2.body.temporary_password, PW, 'root_admin');
    // Cấp 2 quản lý được quản trị viên trường nhưng không tạo/sửa/khóa quản trị tổng
    expect((await call(s.base, 'POST', '/api/admin/users', { full_name: 'Không Được', role: 'root_admin', email: 'khong@example.edu.vn' }, l2.token)).status).toBe(403);
    expect((await call(s.base, 'PATCH', `/api/admin/users/1`, { phone: '0900 111 222' }, l2.token)).status).toBe(403);
    expect((await call(s.base, 'POST', '/api/admin/users/1/lock', { locked: true, reason: 'x' }, l2.token)).status).toBe(403);
    expect((await call(s.base, 'POST', '/api/admin/schools', { school_code: '7099', name: 'Cấp 2 không tạo trường', admin: { full_name: 'Ai Đó', email: 'ai.do@example.edu.vn' } }, l2.token)).status).toBe(403);
    const sa = await call(s.base, 'POST', '/api/admin/users', { full_name: 'Quản Trị Trường Thêm', role: 'school_admin', email: 'qt.them@example.edu.vn', school_id: a.id }, l2.token);
    expect(sa.status).toBe(201);
    expect((await api('POST', '/api/admin/users', { full_name: 'Thiếu Trường', role: 'school_admin', email: 'thieu@example.edu.vn' })).status).toBe(422);
    expect((await api('POST', '/api/admin/users', { full_name: 'Email Trùng', role: 'school_admin', email: 'QT.THEM@example.edu.vn', school_id: a.id })).status).toBe(409);
    // Đổi vai trò: phiên cũ bị thu hồi, vai trò mới có hiệu lực
    const tok = (await activate(s.base, sa.body.user.username, sa.body.temporary_password, PW, 'school_admin')).token;
    const changed = await api('PATCH', `/api/admin/users/${sa.body.user.id}/role`, { role: 'teacher' });
    expect(changed.body).toMatchObject({ role: 'teacher', school_id: a.id });
    expect((await call(s.base, 'GET', '/api/auth/me', undefined, tok)).status).toBe(401);
    expect((await login(sa.body.user.username, PW, 'school_admin')).status).toBe(403);
    expect((await login(sa.body.user.username, PW, 'teacher')).status).toBe(200);
    expect((await api('PATCH', `/api/admin/users/${sa.body.user.id}/role`, { role: 'student', school_id: 999999 })).status).toBe(404);
    expect((await call(s.base, 'PATCH', `/api/admin/users/${sa.body.user.id}/role`, { role: 'root_admin' }, l2.token)).status).toBe(403);
    // Không tự đổi quyền chính mình
    expect((await api('PATCH', `/api/admin/users/${(await db.getByUsername('admin'))!.id}/role`, { role: 'teacher' })).status).toBe(400);
  });

  test('HK.AD.021 sửa thông tin người dùng; chuyển trường chỉ khi chưa thuộc lớp', async () => {
    const t = await api('POST', '/api/admin/teachers', { full_name: 'Cô Chuyển Trường', email: 'chuyen@example.edu.vn' }, a.token);
    const edited = await api('PATCH', `/api/admin/users/${t.body.user.id}`, { full_name: 'Cô Chuyển Trường Mới', email: 'chuyen.moi@example.edu.vn', phone: '0911 222 333', school_id: b.id });
    expect(edited.body).toMatchObject({ full_name: 'Cô Chuyển Trường Mới', email: 'chuyen.moi@example.edu.vn', phone: '0911 222 333', school_id: b.id });
    expect((await api('PATCH', `/api/admin/users/${t.body.user.id}`, { email: 'qt.b@example.edu.vn' })).status).toBe(409);
    expect((await api('PATCH', `/api/admin/users/${t.body.user.id}`, { email: 'khong-phai-email' })).status).toBe(422);
    const gv = await api('POST', '/api/admin/teachers', { full_name: 'Cô Đang Dạy', email: 'dangday@example.edu.vn' }, a.token);
    await call(s.base, 'PATCH', `/api/admin/classes/${classA.id}`, { teacher_ids: [gv.body.user.id] }, a.token);
    expect((await api('PATCH', `/api/admin/users/${gv.body.user.id}`, { school_id: b.id })).status).toBe(409);
    await call(s.base, 'PATCH', `/api/admin/classes/${classA.id}`, { teacher_ids: [] }, a.token);
  });

  test('HK.AD.023/024 khóa kèm lý do (bắt buộc), thu hồi phiên, hiện lý do khi đăng nhập; mở khóa; đặt lại mật khẩu gửi thư', async () => {
    const t = await api('POST', '/api/admin/teachers', { full_name: 'Cô Bị Khóa', email: 'bikhoa@example.edu.vn' }, a.token);
    const session = (await activate(s.base, t.body.user.username, t.body.temporary_password, PW, 'teacher')).token;
    expect((await api('POST', `/api/admin/users/${t.body.user.id}/lock`, { locked: true })).status).toBe(422);
    const locked = await api('POST', `/api/admin/users/${t.body.user.id}/lock`, { locked: true, reason: 'Vi phạm quy chế thử' });
    expect(locked.body).toMatchObject({ is_active: false, lock_reason: 'Vi phạm quy chế thử' });
    expect((await call(s.base, 'GET', '/api/auth/me', undefined, session)).status).toBe(401);
    const denied = await login(t.body.user.username, PW, 'teacher');
    expect(denied.status).toBe(403);
    expect(denied.body.detail).toContain('Vi phạm quy chế thử');
    const reopened = await api('POST', `/api/admin/users/${t.body.user.id}/lock`, { locked: false });
    expect(reopened.body).toMatchObject({ is_active: true, lock_reason: null });
    expect((await login(t.body.user.username, PW, 'teacher')).status).toBe(200);
    const reset = await api('POST', `/api/admin/users/${t.body.user.id}/reset-password`);
    expect(reset.body.temporary_password).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(reset.body.user.must_change_password).toBe(true);
    expect((await login(t.body.user.username, PW, 'teacher')).status).toBe(401);
    await mail.tick();
    const sent = [...mail.sent].reverse().find((m) => m.to === 'bikhoa@example.edu.vn' && m.text.includes('đã được đặt lại'));
    expect(sent?.text).toContain(reset.body.temporary_password);
    const again = await login(t.body.user.username, reset.body.temporary_password, 'teacher');
    expect(again.body.user.must_change_password).toBe(true);
    // Không tự khóa chính mình
    expect((await api('POST', `/api/admin/users/${(await db.getByUsername('admin'))!.id}/lock`, { locked: true, reason: 'tự khóa' })).status).toBe(400);
  });

  test('HK.AD.025 chỉ xóa tài khoản chưa phát sinh dữ liệu; đã đăng nhập hoặc đang dạy thì chỉ khóa', async () => {
    const fresh = await api('POST', '/api/admin/teachers', { full_name: 'Cô Chưa Dùng', email: 'chuadung.gv@example.edu.vn' }, a.token);
    const detail = await api('GET', `/api/admin/users/${fresh.body.user.id}`);
    expect(detail.body).toMatchObject({ deletable: true, delete_blocker: null, school_name: 'THCS Kiểm Thử A' });
    expect((await api('DELETE', `/api/admin/users/${fresh.body.user.id}`)).status).toBe(204);
    expect(await db.getById(fresh.body.user.id)).toBeNull();
    const used = await api('POST', '/api/admin/teachers', { full_name: 'Cô Đã Dùng', email: 'dadung.gv@example.edu.vn' }, a.token);
    await login(used.body.user.username, used.body.temporary_password, 'teacher');
    const blocked = await api('DELETE', `/api/admin/users/${used.body.user.id}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.detail).toContain('đã từng đăng nhập');
    expect((await api('GET', `/api/admin/users/${used.body.user.id}`)).body.deletable).toBe(false);
    const teaching = await api('POST', '/api/admin/teachers', { full_name: 'Cô Được Phân Công', email: 'phancong@example.edu.vn' }, a.token);
    await call(s.base, 'PATCH', `/api/admin/classes/${classA.id}`, { teacher_ids: [teaching.body.user.id] }, a.token);
    expect((await api('DELETE', `/api/admin/users/${teaching.body.user.id}`)).body.detail).toContain('phụ trách lớp');
    await call(s.base, 'PATCH', `/api/admin/classes/${classA.id}`, { teacher_ids: [] }, a.token);
    expect((await api('DELETE', `/api/admin/users/${(await db.getByUsername('admin'))!.id}`)).status).toBe(400);
  });

  // ------------------------------------------------------------------ HK.SYS.015
  test('HK.SYS.015 xác thực và phân quyền API: thiếu/giả token, sai vai trò, khác trường', async () => {
    expect((await api('GET', '/api/admin/users', undefined, '')).status).toBe(401);
    expect((await api('GET', '/api/admin/users', undefined, 'token.gia.mao')).status).toBe(401);
    const student = await api('POST', '/api/admin/students', { user_code: 'HS7030', full_name: 'Học Sinh Quyền', birth_date: '2013-09-09' }, a.token);
    const st = (await activate(s.base, student.body.user.username, student.body.temporary_password, PW, 'student')).token;
    for (const path of ['/api/admin/users', '/api/admin/schools', '/api/admin/classes', '/api/admin/history/campaigns', '/api/admin/teachers']) expect([path, (await api('GET', path, undefined, st)).status]).toEqual([path, 403]);
    const teacher = await api('POST', '/api/admin/teachers', { full_name: 'Cô Quyền', email: 'quyen.gv@example.edu.vn' }, a.token);
    const gv = (await activate(s.base, teacher.body.user.username, teacher.body.temporary_password, PW, 'teacher')).token;
    expect((await api('GET', '/api/admin/users', undefined, gv)).status).toBe(403);
    expect((await api('POST', '/api/student/join-class', { code: classA.join_code }, gv)).status).toBe(403);
    // Quản trị viên trường A không đọc/ghi được dữ liệu trường B dù đoán id
    expect((await api('GET', `/api/admin/schools/${b.id}`, undefined, a.token)).status).toBe(404);
    expect((await api('GET', `/api/admin/users/${b.admin.id}`, undefined, a.token)).status).toBe(404);
    expect((await api('POST', `/api/admin/users/${b.admin.id}/lock`, { locked: true, reason: 'x' }, a.token)).status).toBe(404);
    expect((await api('POST', '/api/admin/users', { full_name: 'Không Được', role: 'school_admin', email: 'k@example.edu.vn', school_id: a.id }, a.token)).status).toBe(403);
    expect((await api('PATCH', `/api/admin/users/${student.body.user.id}/role`, { role: 'teacher' }, a.token)).status).toBe(403);
    expect((await api('GET', `/api/admin/school?school_id=${b.id}`, undefined, a.token)).status).toBe(403);
    expect((await api('GET', '/api/admin/school', undefined, a.token)).body.id).toBe(a.id);
    // Nhật ký thao tác ghi lại ai làm gì mà không ghi mật khẩu
    const audit = await api('GET', '/api/admin/audit-history?limit=100');
    expect(audit.body.items.some((e: any) => e.action.includes('/admin/users/:id/lock'))).toBe(true);
    expect(JSON.stringify(audit.body)).not.toMatch(/Matkhau-12345|temporary_password|password_hash/);
  });
});
