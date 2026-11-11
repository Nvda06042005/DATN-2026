/**
 * Giáo viên và học sinh: tên đăng nhập và mật khẩu ban đầu theo quy ước (yêu cầu 11/11/2026), gửi vào email như quản trị viên trường,
 * cả khi thêm từng người lẫn khi nhập file Excel:
 * tên đăng nhập = GV/HS + tên gọi + 4 số cuối điện thoại (không có thì 0000) + ngày sinh ddmmyyyy (GVAnh672010042005);
 * mật khẩu = DongA + GV/HS + tên gọi + ngày sinh (DongAGVAnh10042005). Đăng nhập không phân biệt hoa thường, bị buộc đổi mật khẩu lần đầu.
 */
import { activate, adminLogin, call, download, hasPostgres, Started, startApp, upload } from './harness';
import { PW } from './fixture';
import { memberCredentials, shownUsername, studentTemplateFilename, teacherTemplateFilename } from '../src/admin/excel';
import type { MailService } from '../src/admin/mail.service';

const SCHOOL = 'THCS Giồng Ông Tố';

describe('quy ước tên đăng nhập và mật khẩu của giáo viên, học sinh', () => {
  test('đúng ví dụ của người dùng', () => {
    expect(memberCredentials('teacher', 'Nguyễn Đức Anh', '0901236720', '2005-04-10')).toEqual({ username: 'GVAnh672010042005', password: 'DongAGVAnh10042005' });
    expect(memberCredentials('student', 'Trần Thị Anh', '0901236720', '2005-04-10')).toEqual({ username: 'HSAnh672010042005', password: 'DongAHSAnh10042005' });
  });

  test('không có số điện thoại thì 0000; bỏ dấu và chữ đ; thiếu ngày sinh hoặc tên gọi thì không theo quy ước', () => {
    expect(memberCredentials('student', 'Nguyễn Klm Ling', null, '2008-12-12')).toEqual({ username: 'HSLing000012122008', password: 'DongAHSLing12122008' });
    expect(memberCredentials('teacher', 'Trần Thị Ánh', '', '1990-01-02')?.username).toBe('GVAnh000002011990');
    expect(memberCredentials('teacher', 'Đỗ Văn Đức', '0901234567', '1990-01-02')).toEqual({ username: 'GVDuc456702011990', password: 'DongAGVDuc02011990' });
    expect(memberCredentials('teacher', 'Lê Văn A', '0901234567', null)).toBeNull();
    expect(memberCredentials('teacher', '!!!', '0901234567', '1990-01-02')).toBeNull();
    // tên hiển thị = dạng quy ước + số thêm vào khi trùng; không theo quy ước thì đúng tên đã lưu
    expect(shownUsername('gvanh672010042005', 'GVAnh672010042005')).toBe('GVAnh672010042005');
    expect(shownUsername('gvanh6720100420052', 'GVAnh672010042005')).toBe('GVAnh6720100420052');
    expect(shownUsername('gv.anh.nd', null)).toBe('gv.anh.nd');
  });
});

(hasPostgres() ? describe : describe.skip)('giáo viên và học sinh: tài khoản theo quy ước, gửi thư tên đăng nhập và mật khẩu', () => {
  let s: Started, root: string, mail: MailService, A: { id: number; token: string };
  const api = (method: string, path: string, body?: unknown, token?: string) => call(s.base, method, path, body, token ?? A.token);
  const mailTo = async (to: string) => { await mail.tick(); return [...mail.sent].reverse().find((m) => m.to === to); };
  const open = async (buffer: Buffer) => { const w = new (await import('exceljs')).Workbook(); await w.xlsx.load(buffer as never); return w; };
  /** Điền các dòng (Họ tên, SĐT, Email, Ngày sinh dạng chữ dd/mm/yyyy) vào bảng nhập của file mẫu, bắt đầu dòng 12 */
  const fill = async (template: Buffer, sheetName: string, rows: Array<[string, string | null, string | null, string]>) => {
    const wb = await open(template), sheet = wb.getWorksheet(sheetName)!;
    rows.forEach(([name, phone, email, birth], i) => {
      const r = sheet.getRow(12 + i);
      r.getCell(3).value = name;
      if (phone) r.getCell(5).value = phone;
      if (email) r.getCell(6).value = email;
      r.getCell(7).value = birth;
    });
    return Buffer.from(await wb.xlsx.writeBuffer());
  };
  const login = (username: string, password: string, portal: string) => call(s.base, 'POST', '/api/auth/login', { username, password, portal }, '');

  beforeAll(async () => {
    s = await startApp('member_account_test');
    mail = s.moduleRef.get((await import('../src/admin/mail.service')).MailService);
    root = await adminLogin(s.base);
    const made = await call(s.base, 'POST', '/api/admin/schools', { name: SCHOOL, admin: { full_name: 'Quản trị Fixture', email: 'qt.fixture@example.invalid' } }, root);
    if (made.status !== 201) throw new Error('tạo trường lỗi ' + made.status + ' ' + JSON.stringify(made.body));
    const active = await activate(s.base, made.body.admin.username, made.body.temporary_password, PW, 'school_admin');
    A = { id: made.body.school.id, token: active.token };
  });
  afterAll(async () => { await s?.close(); });

  test('thêm từng giáo viên: GVAnh672010042005 / DongAGVAnh10042005, thư ghi đúng, đăng nhập bằng chữ hoa được và bị buộc đổi mật khẩu; trùng thì thêm số', async () => {
    const created = await api('POST', '/api/admin/teachers', { full_name: 'Nguyễn Đức Anh', email: 'anh.gv@example.edu.vn', phone: '0901236720', birth_date: '2005-04-10' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ display_username: 'GVAnh672010042005', temporary_password: 'DongAGVAnh10042005' });
    expect(created.body.user).toMatchObject({ username: 'gvanh672010042005', must_change_password: true });
    const sent = await mailTo('anh.gv@example.edu.vn');
    expect(sent?.text).toContain('GVAnh672010042005');
    expect(sent?.text).toContain('DongAGVAnh10042005');
    const first = await login('GVANH672010042005', 'DongAGVAnh10042005', 'teacher');
    expect(first.status).toBe(200);
    expect(first.body.user).toMatchObject({ username: 'gvanh672010042005', must_change_password: true });
    // cùng tên gọi, 4 số cuối và ngày sinh (email khác): thêm số 2
    const twin = await api('POST', '/api/admin/teachers', { full_name: 'Trần Văn Anh', email: 'anh2.gv@example.edu.vn', phone: '0911116720', birth_date: '2005-04-10' });
    expect(twin.body).toMatchObject({ display_username: 'GVAnh6720100420052', temporary_password: 'DongAGVAnh10042005' });
    expect((await mailTo('anh2.gv@example.edu.vn'))?.text).toContain('GVAnh6720100420052');
    // giáo viên chưa có ngày sinh: không ghép được nên dùng cách cũ (tên tự sinh, mật khẩu ngẫu nhiên)
    const old = await api('POST', '/api/admin/teachers', { full_name: 'Lê Văn Cũ', email: 'cu.gv@example.edu.vn' });
    expect(old.status).toBe(201);
    expect(old.body.temporary_password).not.toMatch(/^DongA/);
    expect(old.body.display_username).toBe(old.body.user.username);
  });

  test('nhập file học sinh: HS + tên + 4 số cuối (không có SĐT thì 0000) + ngày sinh; có email thì gửi thư, không có thì chỉ có trong danh sách tải về', async () => {
    const template = (await download(s.base, '/api/admin/students/template', A.token)).buffer;
    const file = await fill(template, 'Học sinh', [
      ['Nguyễn Klm Ling', null, 'ling.hs@example.edu.vn', '12/12/2008'],
      ['Trần Thị Mai', '0987654321', null, '01/02/2009'],
    ]);
    const res = await upload(s.base, '/api/admin/students/import?commit=true', studentTemplateFilename(SCHOOL), file, A.token);
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(2);
    expect(res.body.credentials.map((c: { username: string; password: string }) => [c.username, c.password])).toEqual([
      ['HSLing000012122008', 'DongAHSLing12122008'],
      ['HSMai432101022009', 'DongAHSMai01022009'],
    ]);
    expect(res.body.rows.map((r: { username: string }) => r.username)).toEqual(['HSLing000012122008', 'HSMai432101022009']);
    const sent = await mailTo('ling.hs@example.edu.vn');
    expect(sent?.text).toContain('HSLing000012122008');
    expect(sent?.text).toContain('DongAHSLing12122008');
    expect((await login('hsling000012122008', 'DongAHSLing12122008', 'student')).body.user).toMatchObject({ role: 'student', must_change_password: true });
    expect((await login('HSMAI432101022009', 'DongAHSMai01022009', 'student')).status).toBe(200);
  });

  test('nhập file giáo viên: GVHoa567815031985 / DongAGVHoa15031985, thư gửi vào email', async () => {
    const template = (await download(s.base, '/api/admin/teachers/template', A.token)).buffer;
    const file = await fill(template, 'Giáo viên', [['Phạm Thị Hoa', '0912345678', 'hoa.gv@example.edu.vn', '15/03/1985']]);
    const res = await upload(s.base, '/api/admin/teachers/import?commit=true', teacherTemplateFilename(SCHOOL), file, A.token);
    expect(res.status).toBe(200);
    expect(res.body.credentials).toEqual([expect.objectContaining({ username: 'GVHoa567815031985', password: 'DongAGVHoa15031985', email: 'hoa.gv@example.edu.vn' })]);
    const sent = await mailTo('hoa.gv@example.edu.vn');
    expect(sent?.text).toContain('GVHoa567815031985');
    expect(sent?.text).toContain('DongAGVHoa15031985');
    expect((await login('gvhoa567815031985', 'DongAGVHoa15031985', 'teacher')).status).toBe(200);
  });

  test('trùng với tài khoản trường khác (RLS che): vẫn tạo được, thêm số 2 thay vì lỗi 500', async () => {
    const other = await call(s.base, 'POST', '/api/admin/schools', { name: 'THCS Bình An', admin: { full_name: 'Quản trị Hai', email: 'qt.hai@example.invalid' } }, root);
    expect(other.status).toBe(201);
    const B = (await activate(s.base, other.body.admin.username, other.body.temporary_password, PW, 'school_admin')).token;
    // cùng tên gọi Ling, không SĐT, cùng ngày sinh với học sinh đã nhập ở trường đầu
    const twin = await call(s.base, 'POST', '/api/admin/students', { full_name: 'Phạm Ling', birth_date: '2008-12-12', email: 'ling2.hs@example.edu.vn' }, B);
    expect(twin.status).toBe(201);
    expect(twin.body).toMatchObject({ display_username: 'HSLing0000121220082', temporary_password: 'DongAHSLing12122008' });
    expect((await mailTo('ling2.hs@example.edu.vn'))?.text).toContain('HSLing0000121220082');
    // tài khoản kiểu cũ (giáo viên chưa có ngày sinh) trùng tên với trường đầu cũng không lỗi
    const oldTwin = await call(s.base, 'POST', '/api/admin/teachers', { full_name: 'Lê Văn Cũ', email: 'cu2.gv@example.edu.vn' }, B);
    expect(oldTwin.status).toBe(201);
    expect(oldTwin.body.user.username).toMatch(/2$/);
  });
});
