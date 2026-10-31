/** HK.*.001/005/006/009/010: đăng nhập bằng tên/email/mã, khóa theo tài khoản, chính sách mật khẩu, hồ sơ cá nhân theo vai trò. */
import { adminLogin, call, hasPostgres, Started, startApp } from './harness';
import type { DatabaseService } from '../src/database/database.service';

let s: Started, db: DatabaseService, root: string, schoolA: number, schoolB: number;
const PW = 'Profile@12345';
const api = (method: string, path: string, body?: unknown, token = root) => call(s.base, method, path, body, token);
const login = (username: string, password = PW, portal = 'app') => api('POST', '/api/auth/login', { username, password, portal }, '');
const create = async (body: Record<string, unknown>) => (await api('POST', '/api/admin/users', { password: PW, ...body })).body.user;
const tokenOf = async (username: string, portal: string) => (await login(username, PW, portal)).body.token as string;

(hasPostgres() ? describe : describe.skip)('HK.* xác thực và hồ sơ cá nhân', () => {
  beforeAll(async () => {
    s = await startApp('profile_test');
    db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    root = await adminLogin(s.base);
    for (const [code, name] of [['4401', 'Trường hồ sơ A'], ['4402', 'Trường hồ sơ B']]) await api('POST', '/api/admin/schools', { school_code: code, name });
    [schoolA, schoolB] = (await db.query<{ id: number }>("SELECT id FROM app_schools WHERE school_code IN ('4401', '4402') ORDER BY school_code")).map((x) => x.id);
    await create({ role: 'student', school_id: schoolA, full_name: 'Học Sinh Hồ Sơ', username: 'hs.hoso', user_code: 'HS001', email: 'hs.hoso@example.invalid' });
    await create({ role: 'student', school_id: schoolB, full_name: 'Học Sinh Trùng Mã', username: 'hs.trungma', user_code: 'HS001' });
    await create({ role: 'teacher', school_id: schoolA, full_name: 'Giáo Viên Hồ Sơ', username: 'gv.hoso', email: 'gv.hoso@example.invalid' });
    await create({ role: 'school_admin', school_id: schoolA, full_name: 'Quản Trị Trường Hồ Sơ', username: 'qt.hoso', email: 'qt.hoso@example.invalid' });
  });
  afterAll(async () => {
    await s?.close();
  });

  test('đăng nhập bằng tên đăng nhập, email hoặc mã học sinh; mã trùng giữa các trường không được đoán', async () => {
    for (const who of ['hs.hoso', ' HS.Hoso@Example.Invalid ', 'hs001 ']) {
      // HS001 trùng ở hai trường nên chỉ tên đăng nhập và email dùng được
      const res = await login(who);
      expect([who.trim().toLowerCase() === 'hs001' ? 401 : 200, who]).toEqual([res.status, who]);
    }
    expect((await login('hs.trungma')).status).toBe(200);
    // Mã duy nhất thì đăng nhập được
    await db.query("UPDATE app_users SET user_code = 'HS-DUY-NHAT' WHERE username = 'hs.hoso'");
    expect((await login('hs-duy-nhat')).body.user.username).toBe('hs.hoso');
    expect((await login('hs.hoso', 'sai-mat-khau1')).status).toBe(401);
  });

  test('khóa 15 phút sau 5 lần sai, tính theo tài khoản dù đổi qua lại giữa tên, email và mã', async () => {
    const ids = ['gv.hoso', 'gv.hoso@example.invalid', 'GV.HOSO', 'gv.hoso@example.invalid', 'gv.hoso'];
    for (const id of ids) expect((await login(id, 'sai-mat-khau1')).status).toBe(401);
    const locked = await login('gv.hoso@example.invalid', PW); // đúng mật khẩu nhưng đang bị khóa
    expect(locked.status).toBe(429);
    expect(locked.body.detail).toMatch(/^Sai quá nhiều lần\. Thử lại sau (14|15) phút\.$/);
    expect((await login('gv.hoso', PW)).status).toBe(429);
    expect((await login('hs.hoso', PW)).status).toBe(200); // tài khoản khác không bị ảnh hưởng
  });

  test('mật khẩu tự đặt: tối thiểu 8 ký tự, có cả chữ và số', async () => {
    const token = await tokenOf('qt.hoso', 'school_admin');
    for (const weak of ['abc123', 'chicochu', '12345678', 'a1b2c3d']) expect((await api('POST', '/api/auth/change-password', { current_password: PW, new_password: weak }, token)).status).toBe(422);
    const ok = await api('POST', '/api/auth/change-password', { current_password: PW, new_password: 'MatKhau-moi9' }, token);
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();
    expect((await login('qt.hoso', 'MatKhau-moi9', 'school_admin')).status).toBe(200);
  });

  test('hồ sơ học sinh: xem kèm trường và lớp, chỉ tự sửa biệt danh, ảnh đại diện, giới thiệu', async () => {
    const token = await tokenOf('hs.hoso', 'student');
    const before = (await api('GET', '/api/auth/profile', undefined, token)).body;
    expect(before.user).toMatchObject({ username: 'hs.hoso', full_name: 'Học Sinh Hồ Sơ', nickname: null, email: 'hs.hoso@example.invalid' });
    expect(before.user.password_hash).toBeUndefined();
    expect(before.school).toMatchObject({ name: 'Trường hồ sơ A', school_code: '4401' });
    expect(before.classes).toEqual([]);
    expect(before.editable).toEqual(['nickname', 'avatar_url', 'bio']);

    const saved = await api('PATCH', '/api/auth/profile', { nickname: '  Tiểu   Tướng ', avatar_url: 'https://example.com/avatar.png', bio: 'Thích lịch sử Đại Việt' }, token);
    expect(saved.status).toBe(200);
    expect(saved.body.user).toMatchObject({ nickname: 'Tiểu Tướng', avatar_url: 'https://example.com/avatar.png', bio: 'Thích lịch sử Đại Việt' });
    expect((await api('GET', '/api/auth/me', undefined, token)).body.nickname).toBe('Tiểu Tướng');
    // Không tự sửa được họ tên, số điện thoại, email; dữ liệu sai bị từ chối
    for (const patch of [{ full_name: 'Tên Khác' }, { phone: '0900000000' }, { email: 'khac@example.invalid' }]) {
      const res = await api('PATCH', '/api/auth/profile', patch, token);
      expect([res.status, res.body.detail]).toEqual([422, expect.stringContaining('Bạn không tự sửa được')]);
    }
    expect((await api('PATCH', '/api/auth/profile', { avatar_url: 'http://example.com/a.png' }, token)).status).toBe(422); // chỉ https
    expect((await api('PATCH', '/api/auth/profile', { avatar_url: 'javascript:alert(1)' }, token)).status).toBe(422);
    expect((await api('PATCH', '/api/auth/profile', { nickname: 'a' }, token)).status).toBe(422);
    expect((await api('PATCH', '/api/auth/profile', { bio: 'x'.repeat(301) }, token)).status).toBe(422);
    // Xóa bằng null
    expect((await api('PATCH', '/api/auth/profile', { nickname: null, avatar_url: null }, token)).body.user).toMatchObject({ nickname: null, avatar_url: null });
    expect((await api('PATCH', '/api/auth/profile', { nickname: 'Ổn' }, '')).status).toBe(401);
  });

  test('hồ sơ giáo viên (số điện thoại, ảnh, giới thiệu) và quản trị (họ tên, email, điện thoại); tìm kiếm theo thông tin mới', async () => {
    // gv.hoso đang bị khóa ở test trước (khóa nằm trong bộ nhớ), nên dùng một giáo viên khác
    await create({ role: 'teacher', school_id: schoolA, full_name: 'Giáo Viên Thứ Hai', username: 'gv.hai', email: 'gv.hai@example.invalid' });
    const t = await tokenOf('gv.hai', 'teacher');
    const view = (await api('GET', '/api/auth/profile', undefined, t)).body;
    expect(view.editable).toEqual(['phone', 'avatar_url', 'bio']);
    expect((await api('PATCH', '/api/auth/profile', { phone: 'abc' }, t)).status).toBe(422);
    expect((await api('PATCH', '/api/auth/profile', { nickname: 'Thầy Hai' }, t)).status).toBe(422);
    expect((await api('PATCH', '/api/auth/profile', { phone: '0901 234 567', bio: 'Dạy Lịch sử 7' }, t)).body.user).toMatchObject({ phone: '0901 234 567', bio: 'Dạy Lịch sử 7' });

    const adminToken = (await login('qt.hoso', 'MatKhau-moi9', 'school_admin')).body.token as string; // mật khẩu đã đổi ở test trước
    const updated = await api('PATCH', '/api/auth/profile', { full_name: '  Nguyễn  Thị   Quản Trị ', email: 'qt.moi@example.invalid', phone: '+84 28 3822 0000' }, adminToken);
    expect(updated.status).toBe(200);
    expect(updated.body.user).toMatchObject({ full_name: 'Nguyễn Thị Quản Trị', email: 'qt.moi@example.invalid', phone: '+84 28 3822 0000' });
    expect((await api('PATCH', '/api/auth/profile', { full_name: '' }, adminToken)).status).toBe(422);
    expect((await api('PATCH', '/api/auth/profile', { email: 'khong-phai-email' }, adminToken)).status).toBe(422);
    expect((await api('PATCH', '/api/auth/profile', { bio: 'quản trị không có mục này' }, adminToken)).status).toBe(422);
    const found = await api('GET', `/api/admin/users?q=${encodeURIComponent('quan tri')}&role=school_admin`);
    expect(found.body.items.map((u: any) => u.username)).toContain('qt.hoso');
    // Quản trị tổng tự sửa hồ sơ của mình
    const me = await api('PATCH', '/api/auth/profile', { phone: '028 3822 1111', full_name: 'Quản trị tổng Đông A' });
    expect(me.body.user).toMatchObject({ phone: '028 3822 1111', role: 'root_admin' });
    expect(me.body.editable).toEqual(['full_name', 'email', 'phone', 'avatar_url']);
  });
});
