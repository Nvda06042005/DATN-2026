/**
 * Mật khẩu tài khoản (yêu cầu 13/11/2026): quản trị trường xem mật khẩu ban đầu của giáo viên, học sinh trường mình; quản trị tổng xem mọi trường
 * (không gồm quản trị tổng) khi người dùng CHƯA tự đổi; người dùng đổi mật khẩu thì bản lưu mã hóa bị xóa (trigger migration 060).
 * Cấp lại mật khẩu theo quy ước, gửi email, buộc đổi ở lần đăng nhập sau.
 * 18/11/2026 (người dùng chọn "Lưu để quản trị xem được", migration 074): mật khẩu người dùng tự đặt được lưu thêm bản mã hóa, chỉ quản trị tổng xem;
 * quản trị trường vẫn không xem được; cấp lại thì bản cũ bị xóa; không lưu cho quản trị tổng. Lọc STT; họ tên viết hoa chữ cái đầu mỗi từ.
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

  test('lọc STT: chỉ trả đúng dòng có số thứ tự đó (theo các bộ lọc khác), kèm offset để hiện đúng số', async () => {
    const all = (await api('GET', '/api/admin/passwords?limit=200', undefined, root)).body;
    const third = await api('GET', '/api/admin/passwords?stt=3&limit=5', undefined, root);
    expect(third.status).toBe(200);
    expect(third.body).toMatchObject({ offset: 2, total: all.total });
    expect(third.body.items.map((x: { id: number }) => x.id)).toEqual([all.items[2].id]);
    expect((await api('GET', '/api/admin/passwords?stt=0', undefined, root)).status).toBe(422);
  });

  test('họ tên viết hoa chữ cái đầu mỗi từ: tạo tài khoản quản trị và đổi họ tên đều kiểm tra; quản trị tổng tự đổi mật khẩu thì không lưu bản xem được', async () => {
    const bad = await call(s.base, 'POST', '/api/admin/users', { full_name: 'Phạm minh châu', role: 'school_admin', email: 'qt.hoa@example.invalid', phone: '0901112223', birth_date: '1991-02-03', school_id: A.id }, root);
    expect([bad.status, bad.body.detail]).toEqual([422, expect.stringContaining('“Phạm Minh Châu”')]);
    const good = await call(s.base, 'POST', '/api/admin/users', { full_name: 'Phạm Minh Châu', role: 'school_admin', email: 'qt.hoa@example.invalid', phone: '0901112223', birth_date: '1991-02-03', school_id: A.id }, root);
    expect(good.status).toBe(201);
    expect((await call(s.base, 'PATCH', `/api/admin/users/${good.body.user.id}`, { full_name: 'PHẠM MINH CHÂU' }, root)).status).toBe(422);
    expect((await call(s.base, 'PATCH', `/api/admin/users/${good.body.user.id}`, { phone: '0901112224' }, root)).status).toBe(200);
    // ngày sinh của quản trị viên trường: xem và sửa trong hồ sơ (18/11/2026)
    expect((await call(s.base, 'GET', `/api/admin/users/${good.body.user.id}`, undefined, root)).body.birth_date).toBe('1991-02-03');
    expect((await call(s.base, 'PATCH', `/api/admin/users/${good.body.user.id}`, { birth_date: '1992-03-04' }, root)).body.birth_date).toBe('1992-03-04');
    expect((await call(s.base, 'PATCH', `/api/admin/users/${good.body.user.id}`, { birth_date: '2999-01-01' }, root)).status).toBe(422);
    const me = (await call(s.base, 'GET', '/api/auth/me', undefined, root)).body.user ?? (await call(s.base, 'GET', '/api/auth/me', undefined, root)).body;
    await sql(s.url, "UPDATE app_users SET password_view_enc = 'x' WHERE id = $1", [me.id]);
    expect((await sql<{ v: string | null }>(s.url, 'SELECT password_view_enc AS v FROM app_users WHERE id = $1', [me.id]))[0].v).toBeNull(); // trigger: không lưu cho quản trị tổng
  });

  test('quản trị trường thấy mật khẩu ban đầu của giáo viên, học sinh trường mình (tên đăng nhập đúng dạng quy ước); không thấy trường khác, không thấy chính mình', async () => {
    const list = await api('GET', '/api/admin/passwords?limit=200');
    expect(list.status).toBe(200);
    expect(await rowOf(teacher.id)).toMatchObject({ username: 'GVAnh672010042005', password: 'DongAGVAnh10042005', status: 'initial', role: 'teacher' });
    expect(await rowOf(student.id)).toMatchObject({ username: 'HSAn567801072015', password: 'DongAHSAn01072015', status: 'initial' });
    const teacherList = await api('GET', '/api/admin/teachers?limit=200');
    const studentList = await api('GET', '/api/admin/students?limit=200');
    const accountDetail = await api('GET', `/api/admin/users/${teacher.id}`);
    expect(teacherList.body.items.find((u: { id: number }) => u.id === teacher.id).username).toBe((await rowOf(teacher.id))?.username);
    expect(studentList.body.items.find((u: { id: number }) => u.id === student.id).username).toBe((await rowOf(student.id))?.username);
    expect(accountDetail.body.username).toBe((await rowOf(teacher.id))?.username);
    const rootUsers = await api('GET', '/api/admin/users?limit=200', undefined, root);
    expect(rootUsers.body.items.find((u: { id: number }) => u.id === teacher.id).username).toBe((await rowOf(teacher.id, root))?.username);
    expect(await rowOf(other.id)).toBeUndefined();
    expect(list.body.items.map((x: { username: string }) => x.username.toLowerCase())).not.toContain(A.adminUser);
    // lọc theo vai trò và tìm kiếm
    expect((await api('GET', '/api/admin/passwords?role=student')).body.items.map((x: { id: number }) => x.id)).toEqual([student.id]);
    expect((await api('GET', '/api/admin/passwords?q=duc anh')).body.items.map((x: { id: number }) => x.id)).toEqual([teacher.id]);
    expect((await api('GET', `/api/admin/passwords?name=${encodeURIComponent('Nguyễn Đức')}&password_state=initial&active=true`)).body.items.map((x: { id: number }) => x.id)).toEqual([teacher.id]);
    expect((await api('GET', '/api/admin/passwords?username=GVAnh6720')).body.items.map((x: { id: number }) => x.id)).toEqual([teacher.id]);
    // trong cơ sở dữ liệu chỉ có bản mã hóa
    const raw = (await sql<{ e: string }>(s.url, 'SELECT initial_password_enc AS e FROM app_users WHERE id = $1', [teacher.id]))[0].e;
    expect(raw).toBeTruthy();
    expect(raw).not.toContain('DongA');
  });

  test('người dùng tự đổi mật khẩu: quản trị trường không xem được, quản trị tổng xem được (bản mã hóa, migration 074); quản trị tổng thấy mọi trường nhưng không thấy quản trị tổng', async () => {
    await activate(s.base, teacher.username, 'DongAGVAnh10042005', PW, 'teacher');
    expect(await rowOf(teacher.id)).toMatchObject({ password: null, status: 'changed' });
    expect(await rowOf(teacher.id, root)).toMatchObject({ password: PW, status: 'changed' });
    const stored = (await sql<{ e: string | null; v: string | null }>(s.url, 'SELECT initial_password_enc AS e, password_view_enc AS v FROM app_users WHERE id = $1', [teacher.id]))[0];
    expect(stored.e).toBeNull();
    expect(stored.v).not.toContain(PW); // chỉ lưu bản mã hóa
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
    // cấp lại thì bản mã hóa mật khẩu tự đặt bị xóa (quản trị tổng thấy mật khẩu cấp lại, không thấy mật khẩu cũ)
    expect(await rowOf(teacher.id, root)).toMatchObject({ password: 'DongAGVAnh10042005', status: 'initial' });
    expect((await sql<{ v: string | null }>(s.url, 'SELECT password_view_enc AS v FROM app_users WHERE id = $1', [teacher.id]))[0].v).toBeNull();
    // đường dẫn đặt lại cũ (18/11/2026) cũng cấp theo quy ước, không còn mật khẩu ngẫu nhiên
    const random = await api('POST', `/api/admin/users/${student.id}/reset-password`);
    expect(random.body).toMatchObject({ display_username: (await rowOf(student.id))?.username, temporary_password: 'DongAHSAn01072015' });
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

  test('năm học: "Bắt đầu lúc" ghi khi kích hoạt (migration 076); thống kê: danh sách cụ thể sau số liệu theo phạm vi', async () => {
    // bài trước cấp lại mật khẩu cho quản trị viên trường A (phiên cũ bị thu hồi): đăng nhập lại bằng mật khẩu cấp lại rồi đổi
    A.token = (await activate(s.base, 'qlygotan6720', 'DongA06041990@AN', PW, 'school_admin')).token;
    const year = await api('POST', '/api/admin/school-years', { label: '2026-2027', starts_on: '2026-09-05', ends_on: '2027-05-31', calendar_mode: 'manual', term1_starts_on: '2026-09-05', term1_ends_on: '2027-01-16', term2_starts_on: '2027-01-18', term2_ends_on: '2027-05-25' });
    expect(year.status).toBe(201);
    expect(year.body).toMatchObject({ calendar_mode: 'manual', activated_at: null });
    const on = await api('POST', `/api/admin/school-years/${year.body.id}/activate`);
    expect(Math.abs(new Date(on.body.activated_at).getTime() - Date.now())).toBeLessThan(60_000);
    expect((await api('GET', '/api/admin/school-years')).body.find((y: { id: number }) => y.id === year.body.id).activated_at).toBe(on.body.activated_at);
    const schools = await api('GET', '/api/analytics/details?kind=schools', undefined, root);
    expect(schools.status).toBe(200);
    expect(schools.body.find((x: { id: number }) => x.id === A.id)).toMatchObject({ name: 'THCS Giồng Ông Tố', teachers: 1, students: 1 });
    expect((await api('GET', '/api/analytics/details?kind=schools')).status).toBe(403); // quản trị trường không xem danh sách mọi trường
    const mine = (await api('GET', '/api/analytics/details?kind=students')).body as Array<{ id: number }>;
    expect(mine.map((x) => x.id)).toEqual([student.id]); // chỉ học sinh trường mình
    expect(((await api('GET', '/api/analytics/details?kind=students', undefined, root)).body as Array<{ id: number }>).map((x) => x.id)).toEqual(expect.arrayContaining([student.id, other.id]));
    const classes = await api('GET', '/api/analytics/details?kind=classes');
    expect(classes.status).toBe(200);
    // bảng "Theo từng lớp": sĩ số và số liệu hoạt động theo học sinh của lớp
    for (const row of classes.body as Array<Record<string, unknown>>) for (const k of ['students', 'active_7', 'active_30', 'lessons_30', 'ai_30']) expect(typeof row[k]).toBe('number');
    expect((await api('GET', '/api/analytics/details?kind=active_7')).status).toBe(200);
    expect((await api('GET', '/api/analytics/details?kind=khong_co')).status).toBe(400);
  });

  test('đổi người liên hệ của trường: tài khoản quản trị viên trường đổi theo, cấp lại tên đăng nhập + mật khẩu theo quy ước, gửi thư; thông tin cũ lưu ở kho dữ liệu đã xóa', async () => {
    const before = (await sql<{ id: number; username: string }>(s.url, "SELECT id, username FROM app_users WHERE school_id = $1 AND role = 'school_admin' ORDER BY created_at, id LIMIT 1", [A.id]))[0];
    // sai quy tắc viết hoa thì không đổi gì
    expect((await api('PATCH', '/api/admin/school', { contact_name: 'Trần thị Bích', contact_email: 'bich.qt@example.invalid', contact_phone: '0909998877', contact_birth_date: '1992-05-06' })).status).toBe(422);
    const res = await api('PATCH', '/api/admin/school', { contact_name: 'Trần Thị Bích', contact_email: 'bich.qt@example.invalid', contact_phone: '0909998877', contact_birth_date: '1992-05-06' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ contact_name: 'Trần Thị Bích', contact_email: 'bich.qt@example.invalid', contact_phone: '0909998877' });
    expect(res.body.reissued).toMatchObject({ user_id: before.id, username: 'QLYGOTBICH8877', temporary_password: 'DongA06051992@BICH', email: 'bich.qt@example.invalid', self: true });
    // phiên cũ bị thu hồi; đăng nhập bằng thông tin mới (phải đổi mật khẩu)
    expect((await api('GET', '/api/admin/school')).status).toBe(401);
    const fresh = await login('qlygotbich8877', 'DongA06051992@BICH', 'school_admin');
    expect(fresh.status).toBe(200);
    expect(fresh.body.user).toMatchObject({ full_name: 'Trần Thị Bích', must_change_password: true });
    // quản trị tổng thấy tên đăng nhập và mật khẩu mới ở "Mật khẩu tài khoản"
    expect(await rowOf(before.id, root)).toMatchObject({ username: 'QLYGOTBICH8877', password: 'DongA06051992@BICH', status: 'initial' });
    await mail.tick();
    expect([...mail.sent].reverse().find((m) => m.to === 'bich.qt@example.invalid')?.text).toContain('DongA06051992@BICH');
    // thông tin cũ trong kho dữ liệu đã xóa (loại replaced), không có mật khẩu
    const archived = await sql<{ row_data: any; related_data: any; delete_kind: string }>(s.url, "SELECT row_data, related_data, delete_kind FROM app_deleted_records WHERE source_table = 'app_schools' AND delete_kind = 'replaced' AND school_id = $1 ORDER BY id DESC LIMIT 1", [A.id]);
    expect(archived[0].related_data.app_users).toMatchObject({ id: before.id, username: before.username, full_name: 'Nguyễn Văn An', email: 'qt.a@example.invalid' });
    expect(JSON.stringify(archived)).not.toMatch(/password|DongA/i);
    // gửi lại đúng người liên hệ hiện tại thì không cấp lại
    const token = (await activate(s.base, 'qlygotbich8877', 'DongA06051992@BICH', PW, 'school_admin')).token;
    A.token = token;
    const same = await api('PATCH', '/api/admin/school', { contact_name: 'Trần Thị Bích', contact_email: 'bich.qt@example.invalid', contact_phone: '0909998877', contact_birth_date: '1992-05-06' });
    expect(same.status).toBe(200);
    expect(same.body.reissued).toBeNull();
  });
});
