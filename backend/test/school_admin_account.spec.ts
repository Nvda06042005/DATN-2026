/**
 * Tài khoản quản trị viên trường do quản trị tổng tạo (trang Người dùng → Tạo tài khoản quản trị, và Thêm trường):
 * tên đăng nhập = QLY + viết tắt tên trường + tên người quản lý + 4 số cuối điện thoại (QLYGOTAN6720),
 * mật khẩu = DongA + ngày sinh ddmmyyyy + @ + tên người quản lý (DongA06042005@AN), gửi vào email của họ; email bắt buộc.
 */
import { call, hasPostgres, adminLogin, Started, startApp } from './harness';
import type { MailService } from '../src/admin/mail.service';

(hasPostgres() ? describe : describe.skip)('Quản trị viên trường: tên đăng nhập và mật khẩu theo quy ước, gửi thư thông tin', () => {
  let s: Started, root: string, mail: MailService;
  const api = (method: string, path: string, body?: unknown, token = root) => call(s.base, method, path, body, token);

  beforeAll(async () => {
    s = await startApp('school_admin_account_test');
    mail = s.moduleRef.get((await import('../src/admin/mail.service')).MailService);
    root = await adminLogin(s.base);
  });
  afterAll(async () => { await s?.close(); });

  const mailTo = async (to: string) => { await mail.tick(); return mail.sent.find((m) => m.to === to); };

  test('Thêm trường kèm quản trị viên có điện thoại và ngày sinh: QLYGOTAN6720 / DongA06042005@AN, thư ghi đúng, đăng nhập bằng chữ hoa được và bị buộc đổi mật khẩu', async () => {
    const created = await api('POST', '/api/admin/schools', { name: 'THCS Giồng Ông Tố', city: 'Thành phố Hồ Chí Minh', admin: { full_name: 'Nguyễn Hoài An', email: 'an.got@example.edu.vn', phone: '0901236720', birth_date: '2005-04-06' } });
    expect(created.status).toBe(201);
    expect(created.body.admin).toMatchObject({ username: 'qlygotan6720', role: 'school_admin', birth_date: '2005-04-06', must_change_password: true });
    expect(created.body.temporary_password).toBe('DongA06042005@AN');
    const sent = await mailTo('an.got@example.edu.vn');
    expect(sent?.text).toContain('QLYGOTAN6720');
    expect(sent?.text).toContain('DongA06042005@AN');
    // đăng nhập không phân biệt hoa thường; mật khẩu theo quy ước chỉ dùng lần đầu
    const login = await call(s.base, 'POST', '/api/auth/login', { username: 'QLYGOTAN6720', password: 'DongA06042005@AN', portal: 'school_admin' }, '');
    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({ username: 'qlygotan6720', must_change_password: true });
    expect((await call(s.base, 'GET', '/api/admin/teachers', undefined, login.body.token)).status).toBe(403); // chưa đổi mật khẩu thì chưa dùng được chức năng khác
  });

  test('Tạo tài khoản quản trị (trang Người dùng): tên gọi bỏ dấu, 4 số cuối bỏ ký hiệu, trùng thì thêm số; thư gửi tên đăng nhập và mật khẩu', async () => {
    const school = (await api('POST', '/api/admin/schools', { name: 'THCS Phú Mỹ', city: 'Thành phố Hồ Chí Minh', admin: { full_name: 'Quản Trị Đầu Tiên', email: 'dau.pm@example.edu.vn' } })).body.school;
    const body = { role: 'school_admin', school_id: school.id, full_name: 'Lê Thị Bình', email: 'binh.pm@example.edu.vn', phone: '0901234567', birth_date: '1990-12-31' };
    const one = await api('POST', '/api/admin/users', body);
    expect(one.status).toBe(201);
    expect(one.body.user).toMatchObject({ username: 'qlypmbinh4567', birth_date: '1990-12-31', phone: '0901234567', email: 'binh.pm@example.edu.vn' });
    expect(one.body.temporary_password).toBe('DongA31121990@BINH');
    const sent = await mailTo('binh.pm@example.edu.vn');
    expect(sent?.text).toContain('QLYPMBINH4567');
    expect(sent?.text).toContain('DongA31121990@BINH');
    // cùng tên và 4 số cuối: thêm số phía sau, vẫn đăng nhập được
    const two = await api('POST', '/api/admin/users', { ...body, email: 'binh2.pm@example.edu.vn' });
    expect(two.status).toBe(201);
    expect(two.body.user.username).toBe('qlypmbinh45672');
    // chữ Đ được bỏ dấu thành D
    const duc = await api('POST', '/api/admin/users', { role: 'school_admin', school_id: school.id, full_name: 'Trần Văn Đức', email: 'duc.pm@example.edu.vn', phone: '0912340000', birth_date: '1985-01-02' });
    expect(duc.body.user.username).toBe('qlypmduc0000');
    expect(duc.body.temporary_password).toBe('DongA02011985@DUC');
  });

  test('bắt buộc email, số điện thoại từ 4 chữ số và ngày sinh hợp lệ; quản trị tổng và luồng không có điện thoại/ngày sinh giữ mật khẩu ngẫu nhiên', async () => {
    const school = (await api('POST', '/api/admin/schools', { name: 'THCS Bình Trị', city: 'Thành phố Hồ Chí Minh', admin: { full_name: 'Quản Trị Bình Trị', email: 'dau.bt@example.edu.vn' } })).body;
    // luồng cũ không khai điện thoại và ngày sinh: mật khẩu tạm ngẫu nhiên, tên đăng nhập kiểu cũ
    expect(school.temporary_password).not.toMatch(/^DongA/);
    expect(school.admin.username).toMatch(/^qt\./);
    const base = { role: 'school_admin', school_id: school.school.id, full_name: 'Phạm Quang Vinh', email: 'vinh.bt@example.edu.vn', phone: '0987654321', birth_date: '1992-05-20' };
    const bad = async (patch: Record<string, unknown>) => (await api('POST', '/api/admin/users', { ...base, ...patch })).status;
    expect(await bad({ email: undefined })).toBe(422); // email bắt buộc
    expect(await bad({ email: 'khong-phai-email' })).toBe(422);
    expect(await bad({ phone: undefined })).toBe(422);
    expect(await bad({ phone: '123' })).toBe(422);
    expect(await bad({ birth_date: undefined })).toBe(422);
    expect(await bad({ birth_date: '2999-01-01' })).toBe(422);
    expect(await bad({ birth_date: '20-05-1992' })).toBe(422);
    // Thêm trường: chỉ khai điện thoại hoặc chỉ khai ngày sinh thì báo thiếu phần còn lại
    const half = await api('POST', '/api/admin/schools', { name: 'THCS Chỉ Điện Thoại', city: 'Thành phố Hồ Chí Minh', admin: { full_name: 'Ai Đó', email: 'half@example.edu.vn', phone: '0901112233' } });
    expect(half.status).toBe(422);
    const ok = await api('POST', '/api/admin/users', base);
    expect(ok.status).toBe(201);
    expect(ok.body.user.username).toBe('qlybtvinh4321');
    expect(ok.body.temporary_password).toBe('DongA20051992@VINH');
    // quản trị tổng không thuộc trường nào: không cần điện thoại và ngày sinh, mật khẩu tạm ngẫu nhiên
    const top = await api('POST', '/api/admin/users', { role: 'root_admin', full_name: 'Quản Trị Cấp Hai', email: 'cap2@example.edu.vn' });
    expect(top.status).toBe(201);
    expect(top.body.temporary_password).not.toMatch(/^DongA/);
  });
});
