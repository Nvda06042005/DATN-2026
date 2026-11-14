/**
 * Email khôi phục (yêu cầu 13/11/2026): quản trị tổng (và quản trị trường, cổng quản trị trường giống quản trị tổng) có thêm một email phụ
 * cùng email chính quản lý tài khoản. Quên mật khẩu: gõ email chính hoặc email khôi phục đều được, mã gửi tới cả hai email.
 * Giáo viên / học sinh không có ô này. Cột app_users.recovery_email ở migration 061.
 */
import { activate, adminLogin, call, hasPostgres, Started, startApp } from './harness';
import { PW } from './fixture';
import type { MailService } from '../src/admin/mail.service';

(hasPostgres() ? describe : describe.skip)('email khôi phục của quản trị viên', () => {
  let s: Started, root: string, mail: MailService, schoolAdmin: string, teacher: string;
  const api = (method: string, path: string, body?: unknown, token = root) => call(s.base, method, path, body, token);
  /** Chờ thư mã xác thực mới gửi tới `to` (thư gửi nền), khác mã `previous` */
  const otpFor = async (to: string, previous = ''): Promise<string> => {
    for (let i = 0; i < 80; i += 1) {
      const found = [...mail.sent].reverse().find((m) => m.to === to && /Mã xác thực của bạn là: (\d{6})/.test(m.text));
      const code = found ? /Mã xác thực của bạn là: (\d{6})/.exec(found.text)![1] : '';
      if (code && code !== previous) return code;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`Không có thư mã cho ${to}`);
  };

  beforeAll(async () => {
    s = await startApp('recovery_email_test');
    mail = s.moduleRef.get((await import('../src/admin/mail.service')).MailService);
    root = await adminLogin(s.base);
    const made = await api('POST', '/api/admin/schools', { name: 'THCS Khôi Phục', admin: { full_name: 'Lê Thị Quản', email: 'qt.khoiphuc@example.invalid', phone: '0901112223', birth_date: '1988-02-03' } });
    if (made.status !== 201) throw new Error('tạo trường lỗi ' + JSON.stringify(made.body));
    schoolAdmin = (await activate(s.base, made.body.admin.username, made.body.temporary_password, PW, 'school_admin')).token;
    const t = await api('POST', '/api/admin/teachers', { full_name: 'Phạm Văn Giáo', email: 'gv.khoiphuc@example.edu.vn', phone: '0903334445', birth_date: '1990-05-06' }, schoolAdmin);
    teacher = (await activate(s.base, t.body.user.username, t.body.temporary_password, PW, 'teacher')).token;
  });
  afterAll(async () => { await s?.close(); });

  test('hồ sơ quản trị tổng và quản trị trường có ô "email khôi phục"; giáo viên không có; kiểm tra định dạng, khác email chính, không trùng tài khoản khác', async () => {
    const view = (await api('GET', '/api/auth/profile')).body;
    expect(view.editable).toEqual(expect.arrayContaining(['email', 'recovery_email']));
    expect(view.user).toHaveProperty('recovery_email', null);
    expect((await api('GET', '/api/auth/profile', undefined, schoolAdmin)).body.editable).toContain('recovery_email');
    expect((await api('GET', '/api/auth/profile', undefined, teacher)).body.editable).not.toContain('recovery_email');
    expect((await api('PATCH', '/api/auth/profile', { recovery_email: 'phu@example.invalid' }, teacher)).status).toBe(422);

    expect((await api('PATCH', '/api/auth/profile', { recovery_email: 'khong-phai-email' })).status).toBe(422);
    expect((await api('PATCH', '/api/auth/profile', { recovery_email: view.user.email })).status).toBe(422); // trùng email chính
    expect((await api('PATCH', '/api/auth/profile', { recovery_email: 'gv.khoiphuc@example.edu.vn' })).status).toBe(409); // email của tài khoản khác
    const saved = await api('PATCH', '/api/auth/profile', { recovery_email: 'Khoi.Phuc.Tong@Example.invalid' });
    expect(saved.status).toBe(200);
    expect(saved.body.user.recovery_email).toBe('khoi.phuc.tong@example.invalid');
    // email chính không được trùng email khôi phục; tài khoản khác không lấy được email khôi phục này làm email chính
    expect((await api('PATCH', '/api/auth/profile', { email: 'khoi.phuc.tong@example.invalid' })).status).toBe(422);
    expect((await api('PATCH', '/api/auth/profile', { email: 'khoi.phuc.tong@example.invalid' }, schoolAdmin)).status).toBe(409);
    expect((await api('PATCH', '/api/auth/profile', { recovery_email: 'khoi.phuc.tong@example.invalid' }, schoolAdmin)).status).toBe(409);
    expect((await api('PATCH', '/api/auth/profile', { recovery_email: 'khoi.phuc.truong@example.invalid' }, schoolAdmin)).status).toBe(200);
  });

  test('quên mật khẩu: gõ email khôi phục cũng tìm ra tài khoản; mã gửi tới cả email chính và email khôi phục; đặt lại được', async () => {
    const main = (await api('GET', '/api/auth/profile')).body.user.email as string;
    const before = (await otpFor(main).catch(() => ''));
    expect((await api('POST', '/api/auth/forgot-password', { identifier: 'KHOI.PHUC.TONG@example.invalid' }, '')).body).toEqual({ ok: true });
    const toRecovery = await otpFor('khoi.phuc.tong@example.invalid');
    const toMain = await otpFor(main, before);
    expect(toMain).toBe(toRecovery); // cùng một mã
    const ticket = await api('POST', '/api/auth/verify-reset-code', { identifier: 'khoi.phuc.tong@example.invalid', otp: toRecovery }, '');
    expect(ticket.status).toBe(200);
    expect((await api('POST', '/api/auth/reset-password', { reset_token: ticket.body.reset_token, new_password: 'Khoi-phuc-2026' }, '')).status).toBe(200);
    expect((await api('POST', '/api/auth/login', { username: 'admin', password: 'Khoi-phuc-2026', portal: 'root_admin' }, '')).status).toBe(200);
    // quản trị trường: gõ tên đăng nhập, mã cũng tới email khôi phục
    const sa = (await api('GET', '/api/auth/profile', undefined, schoolAdmin)).body.user;
    await api('POST', '/api/auth/forgot-password', { identifier: sa.username }, '');
    expect(await otpFor('khoi.phuc.truong@example.invalid')).toBe(await otpFor(sa.email));
  });

  test('đăng nhập hai lớp bằng email (14/11/2026): bấm đăng nhập là một mã gửi cùng lúc tới email chính và email khôi phục; mã ở hộp thư nào cũng dùng được', async () => {
    const login = () => api('POST', '/api/auth/login', { username: 'admin', password: 'Khoi-phuc-2026', portal: 'root_admin' }, '');
    const token = (await login()).body.token as string; // test trước đã đặt lại mật khẩu nên phiên cũ hết hiệu lực
    const main = (await api('GET', '/api/auth/profile', undefined, token)).body.user.email as string;
    const recovery = 'khoi.phuc.tong@example.invalid';
    const last = async (to: string) => otpFor(to).catch(() => '');
    const [m0, r0] = [await last(main), await last(recovery)];
    const setup = await api('POST', '/api/platform/2fa/setup', { method: 'email' }, token);
    expect(setup.body.sent_to).toMatch(/^.\*\*\*@.+ và k\*\*\*@example\.invalid$/);
    const code1 = await otpFor(recovery, r0);
    expect(await otpFor(main, m0)).toBe(code1);
    expect((await api('POST', '/api/platform/2fa/enable', { code: code1 }, token)).status).toBe(200);
    const step = await login();
    expect(step.body).toMatchObject({ two_factor: true, method: 'email' });
    const toRecovery = await otpFor(recovery, code1), toMain = await otpFor(main, code1);
    expect(toMain).toBe(toRecovery); // cùng một mã, ai giữ hộp thư nào cũng đăng nhập được
    const verified = await api('POST', '/api/auth/2fa/verify', { challenge: step.body.challenge, code: toRecovery, portal: 'root_admin' }, '');
    expect(verified.status).toBe(200);
    expect(verified.body.token).toBeTruthy();
  });
});
