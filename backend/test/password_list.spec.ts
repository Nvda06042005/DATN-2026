/**
 * Mật khẩu tài khoản (yêu cầu 13/11/2026): quản trị trường xem mật khẩu ban đầu của giáo viên, học sinh trường mình; quản trị tổng xem mọi trường
 * (không gồm quản trị tổng) khi người dùng CHƯA tự đổi; người dùng đổi mật khẩu thì bản lưu mã hóa bị xóa (trigger migration 060).
 * Cấp lại mật khẩu theo quy ước, gửi email, buộc đổi ở lần đăng nhập sau.
 */
import { activate, adminLogin, call, hasPostgres, sql, Started, startApp } from './harness';
import { PW } from './fixture';
import { openPassword, sealPassword } from '../src/auth/passwords';
import type { MailService } from '../src/admin/mail.service';

describe('mã hóa mật khẩu ban đầu', () => {
  test('mở lại đúng với cùng bí mật; sai bí mật hoặc chuỗi hỏng thì không mở được', () => {
    const sealed = sealPassword('DongAGVAnh10042005', 'bi-mat');
    expect(sealed).not.toContain('DongA');
    expect(openPassword(sealed, 'bi-mat')).toBe('DongAGVAnh10042005');
    expect(openPassword(sealed, 'khac')).toBeNull();
    expect(openPassword('hong.hoc', 'bi-mat')).toBeNull();
    expect(openPassword(null, 'bi-mat')).toBeNull();
  });
});

(hasPostgres() ? describe : describe.skip)('danh sách mật khẩu và cấp lại mật khẩu theo quy ước', () => {
  let s: Started, root: string, mail: MailService;
  let A: { id: number; token: string; adminUser: string }, B: { id: number; token: string };
  let teacher: { id: number; username: string }, student: { id: number }, other: { id: number };
  const api = (method: string, path: string, body?: unknown, token = A.token) => call(s.base, method, path, body, token);
  const login = (username: string, password: string, portal: string) => call(s.base, 'POST', '/api/auth/login', { username, password, portal }, '');
  const rowOf = async (id: number, token = A.token, query = '') => ((await api('GET', `/api/admin/passwords?limit=200${query}`, undefined, token)).body.items as Array<{ id: number }>).find((x) => x.id === id) as Record<string, unknown> | undefined;

  beforeAll(async () => {
    s = await startApp('password_list_test');
    mail = s.moduleRef.get((await import('../src/admin/mail.service')).MailService);
    root = await adminLogin(s.base);
    const school = async (name: string, full_name: string, email: string, phone: string) => {
      const made = await call(s.base, 'POST', '/api/admin/schools', { name, admin: { full_name, email, phone, birth_date: '1990-04-06' } }, root);
      if (made.status !== 201) throw new Error('tạo trường lỗi ' + JSON.stringify(made.body));
      return { made, id: made.body.school.id as number };
    };
    const a = await school('THCS Giồng Ông Tố', 'Nguyễn Văn An', 'qt.a@example.invalid', '0901236720');
    // quản trị viên trường đầu tiên chưa đổi mật khẩu: quản trị tổng xem được mật khẩu ban đầu DongA06041990@AN
    const firstAdmin = await rowOf(a.made.body.admin.id, root);
    expect(firstAdmin).toMatchObject({ role: 'school_admin', username: 'QLYGOTAN6720', password: 'DongA06041990@AN', status: 'initial' });
    const tokenA = (await activate(s.base, a.made.body.admin.username, a.made.body.temporary_password, PW, 'school_admin')).token;
    A = { id: a.id, token: tokenA, adminUser: a.made.body.admin.username };
    const b = await school('THCS Bình An', 'Trần Thị Bình', 'qt.b@example.invalid', '0907654321');
    B = { id: b.id, token: (await activate(s.base, b.made.body.admin.username, b.made.body.temporary_password, PW, 'school_admin')).token };
    const t = await api('POST', '/api/admin/teachers', { full_name: 'Nguyễn Đức Anh', email: 'anh.gv@example.edu.vn', phone: '0901236720', birth_date: '2005-04-10' });
    teacher = { id: t.body.user.id, username: t.body.user.username };
    student = { id: (await api('POST', '/api/admin/students', { full_name: 'Trần Hoài An', email: 'an.hs@example.edu.vn', phone: '0912345678', birth_date: '2015-07-01' })).body.user.id };
    other = { id: (await api('POST', '/api/admin/students', { full_name: 'Lê Văn Khác', email: 'khac.hs@example.edu.vn', phone: '0912345679', birth_date: '2015-08-02' }, B.token)).body.user.id };
  });
  afterAll(async () => { await s?.close(); });

  test('quản trị trường thấy mật khẩu ban đầu của giáo viên, học sinh trường mình (tên đăng nhập đúng dạng quy ước); không thấy trường khác, không thấy chính mình', async () => {
    const list = await api('GET', '/api/admin/passwords?limit=200');
    expect(list.status).toBe(200);
    expect(await rowOf(teacher.id)).toMatchObject({ username: 'GVAnh672010042005', password: 'DongAGVAnh10042005', status: 'initial', role: 'teacher' });
    expect(await rowOf(student.id)).toMatchObject({ username: 'HSAn567801072015', password: 'DongAHSAn01072015', status: 'initial' });
    expect(await rowOf(other.id)).toBeUndefined();
    expect(list.body.items.map((x: { username: string }) => x.username.toLowerCase())).not.toContain(A.adminUser);
    // lọc theo vai trò và tìm kiếm
    expect((await api('GET', '/api/admin/passwords?role=student')).body.items.map((x: { id: number }) => x.id)).toEqual([student.id]);
    expect((await api('GET', '/api/admin/passwords?q=duc anh')).body.items.map((x: { id: number }) => x.id)).toEqual([teacher.id]);
    // trong cơ sở dữ liệu chỉ có bản mã hóa
    const raw = (await sql<{ e: string }>(s.url, 'SELECT initial_password_enc AS e FROM app_users WHERE id = $1', [teacher.id]))[0].e;
    expect(raw).toBeTruthy();
    expect(raw).not.toContain('DongA');
  });

  test('người dùng tự đổi mật khẩu: không ai xem được nữa (bản lưu bị xóa); quản trị tổng thấy mọi trường nhưng không thấy quản trị tổng', async () => {
    await activate(s.base, teacher.username, 'DongAGVAnh10042005', PW, 'teacher');
    expect(await rowOf(teacher.id)).toMatchObject({ password: null, status: 'changed' });
    expect((await sql<{ e: string | null }>(s.url, 'SELECT initial_password_enc AS e FROM app_users WHERE id = $1', [teacher.id]))[0].e).toBeNull();
    const all = (await api('GET', '/api/admin/passwords?limit=200', undefined, root)).body.items as Array<{ id: number; role: string }>;
    expect(all.map((x) => x.id)).toEqual(expect.arrayContaining([teacher.id, student.id, other.id]));
    expect(all.every((x) => x.role !== 'root_admin')).toBe(true);
    expect((await api('GET', `/api/admin/passwords?school_id=${B.id}&limit=200`, undefined, root)).body.items.map((x: { id: number }) => x.id)).toContain(other.id);
    expect((await call(s.base, 'GET', '/api/admin/passwords', undefined, '')).status).toBe(401);
  });

  test('cấp lại theo quy ước: mật khẩu DongA…, gửi email, buộc đổi ở lần đăng nhập sau, xem lại được; thiếu SĐT báo lỗi; không cấp cho tài khoản trường khác', async () => {
    const res = await api('POST', `/api/admin/users/${teacher.id}/reissue-password`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ display_username: 'GVAnh672010042005', temporary_password: 'DongAGVAnh10042005', user: { must_change_password: true } });
    await mail.tick();
    const sent = [...mail.sent].reverse().find((m) => m.to === 'anh.gv@example.edu.vn');
    expect(sent?.text).toContain('DongAGVAnh10042005');
    expect(await rowOf(teacher.id)).toMatchObject({ password: 'DongAGVAnh10042005', status: 'initial' });
    expect((await login('gvanh672010042005', PW, 'teacher')).status).toBe(401); // mật khẩu cũ hết dùng
    expect((await login('gvanh672010042005', 'DongAGVAnh10042005', 'teacher')).body.user).toMatchObject({ must_change_password: true });
    // đặt lại ngẫu nhiên (nút cũ) cũng xem lại được
    const random = await api('POST', `/api/admin/users/${student.id}/reset-password`);
    expect(await rowOf(student.id)).toMatchObject({ password: random.body.temporary_password, status: 'initial' });
    // thiếu số điện thoại: không ghép được mật khẩu theo quy ước
    await sql(s.url, 'UPDATE app_users SET phone = NULL WHERE id = $1', [student.id]);
    const missing = await api('POST', `/api/admin/users/${student.id}/reissue-password`);
    expect([missing.status, missing.body.detail]).toEqual([422, expect.stringContaining('thiếu số điện thoại')]);
    // tài khoản của trường khác
    expect([403, 404]).toContain((await api('POST', `/api/admin/users/${other.id}/reissue-password`)).status);
    // quản trị tổng cấp lại cho quản trị viên trường: DongA + ngày sinh + @ + tên
    const adminA = (await api('GET', '/api/admin/passwords?role=school_admin&limit=200', undefined, root)).body.items.find((x: { school_id: number }) => x.school_id === A.id);
    const again = await api('POST', `/api/admin/users/${adminA.id}/reissue-password`, undefined, root);
    expect(again.body).toMatchObject({ display_username: 'QLYGOTAN6720', temporary_password: 'DongA06041990@AN' });
  });
});
