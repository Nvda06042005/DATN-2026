/**
 * Giáo viên và học sinh: tên đăng nhập và mật khẩu ban đầu theo quy ước (yêu cầu 11/11/2026), gửi vào email như quản trị viên trường,
 * cả khi thêm từng người lẫn khi nhập file Excel:
 * tên đăng nhập = GV/HS + tên gọi + 4 số cuối điện thoại + ngày sinh ddmmyyyy (GVAnh672010042005);
 * mật khẩu = DongA + GV/HS + tên gọi + ngày sinh (DongAGVAnh10042005). Đăng nhập không phân biệt hoa thường, bị buộc đổi mật khẩu lần đầu.
 * Phải đủ họ tên, SĐT, email và ngày sinh mới tạo tài khoản (không còn cách cũ); file nhập phải đúng file mẫu của trường và đúng loại.
 */
import { activate, adminLogin, call, download, hasPostgres, Started, startApp, upload } from './harness';
import { PW } from './fixture';
import { memberCredentials, shownUsername, studentTemplateFilename, teacherTemplateFilename } from '../src/admin/excel';
import type { MailService } from '../src/admin/mail.service';

const SCHOOL = 'THCS Giồng Ông Tố';
const OTHER = 'THCS Bình An';

describe('quy ước tên đăng nhập và mật khẩu của giáo viên, học sinh', () => {
  test('đúng ví dụ của người dùng', () => {
    expect(memberCredentials('teacher', 'Nguyễn Đức Anh', '0901236720', '2005-04-10')).toEqual({ username: 'GVAnh672010042005', password: 'DongAGVAnh10042005' });
    expect(memberCredentials('student', 'Trần Thị Anh', '0901236720', '2005-04-10')).toEqual({ username: 'HSAnh672010042005', password: 'DongAHSAnh10042005' });
  });

  test('bỏ dấu và chữ đ; thiếu SĐT, ngày sinh hoặc tên gọi thì không tạo (đủ hết mới tạo)', () => {
    expect(memberCredentials('teacher', 'Trần Thị Ánh', '0912340000', '1990-01-02')?.username).toBe('GVAnh000002011990');
    expect(memberCredentials('teacher', 'Đỗ Văn Đức', '0901234567', '1990-01-02')).toEqual({ username: 'GVDuc456702011990', password: 'DongAGVDuc02011990' });
    expect(memberCredentials('student', 'Nguyễn Klm Ling', null, '2008-12-12')).toBeNull();
    expect(memberCredentials('student', 'Nguyễn Klm Ling', '12345', '2008-12-12')).toBeNull();
    expect(memberCredentials('teacher', 'Lê Văn A', '0901234567', null)).toBeNull();
    expect(memberCredentials('teacher', '!!!', '0901234567', '1990-01-02')).toBeNull();
    // tên hiển thị = dạng quy ước + số thêm vào khi trùng
    expect(shownUsername('gvanh672010042005', 'GVAnh672010042005')).toBe('GVAnh672010042005');
    expect(shownUsername('gvanh6720100420052', 'GVAnh672010042005')).toBe('GVAnh6720100420052');
  });
});

(hasPostgres() ? describe : describe.skip)('giáo viên và học sinh: tài khoản theo quy ước, gửi thư tên đăng nhập và mật khẩu', () => {
  let s: Started, root: string, mail: MailService, A: { id: number; token: string }, B: string;
  const api = (method: string, path: string, body?: unknown, token?: string) => call(s.base, method, path, body, token ?? A.token);
  const mailTo = async (to: string) => { await mail.tick(); return [...mail.sent].reverse().find((m) => m.to === to); };
  const open = async (buffer: Buffer) => { const w = new (await import('exceljs')).Workbook(); await w.xlsx.load(buffer as never); return w; };
  /** Điền các dòng (Họ tên, SĐT, Email, Ngày sinh dạng chữ dd/mm/yyyy) vào bảng nhập của file mẫu, bắt đầu dòng 12 */
  const fill = async (template: Buffer, sheetName: string, rows: Array<[string, string | null, string | null, string | null]>) => {
    const wb = await open(template), sheet = wb.getWorksheet(sheetName)!;
    rows.forEach(([name, phone, email, birth], i) => {
      const r = sheet.getRow(12 + i);
      r.getCell(3).value = name;
      if (phone) r.getCell(5).value = phone;
      if (email) r.getCell(6).value = email;
      if (birth) r.getCell(7).value = birth;
    });
    return Buffer.from(await wb.xlsx.writeBuffer());
  };
  const login = (username: string, password: string, portal: string) => call(s.base, 'POST', '/api/auth/login', { username, password, portal }, '');

  beforeAll(async () => {
    s = await startApp('member_account_test');
    mail = s.moduleRef.get((await import('../src/admin/mail.service')).MailService);
    root = await adminLogin(s.base);
    const school = async (name: string, admin: string, email: string) => {
      const made = await call(s.base, 'POST', '/api/admin/schools', { name, admin: { full_name: admin, email } }, root);
      if (made.status !== 201) throw new Error('tạo trường lỗi ' + made.status + ' ' + JSON.stringify(made.body));
      return { id: made.body.school.id as number, token: (await activate(s.base, made.body.admin.username, made.body.temporary_password, PW, 'school_admin')).token };
    };
    A = await school(SCHOOL, 'Quản trị Fixture', 'qt.fixture@example.invalid');
    B = (await school(OTHER, 'Quản trị Hai', 'qt.hai@example.invalid')).token;
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
  });

  test('thiếu SĐT, email hoặc ngày sinh: không tạo tài khoản (không còn tên tự sinh, mật khẩu ngẫu nhiên)', async () => {
    const full = { full_name: 'Lê Văn Đủ', email: 'du.gv@example.edu.vn', phone: '0901112222', birth_date: '1990-01-02' };
    for (const [path, gap, message] of [
      ['/api/admin/teachers', { birth_date: undefined }, 'Cần ngày sinh'],
      ['/api/admin/teachers', { phone: undefined }, 'Cần số điện thoại'],
      ['/api/admin/teachers', { email: undefined }, 'Cần email'],
      ['/api/admin/students', { phone: undefined }, 'Cần số điện thoại'],
      ['/api/admin/students', { email: undefined }, 'Cần email'],
      ['/api/admin/students', { birth_date: undefined }, 'Cần ngày sinh'],
    ] as const) {
      const res = await api('POST', path, { ...full, ...gap });
      expect([path, JSON.stringify(gap), res.status]).toEqual([path, JSON.stringify(gap), 422]);
      expect(res.body.detail).toContain(message);
    }
    expect((await api('POST', '/api/admin/teachers', { ...full, full_name: '!! ??' })).status).toBe(422);
    expect((await api('POST', '/api/admin/teachers', full)).status).toBe(201);
  });

  test('nhập file học sinh: HS + tên + 4 số cuối + ngày sinh, thư gửi vào email; dòng thiếu SĐT/email/ngày sinh báo lỗi, không tạo', async () => {
    const template = (await download(s.base, '/api/admin/students/template', A.token)).buffer;
    const file = await fill(template, 'Học sinh', [
      ['Nguyễn Klm Ling', '0987650000', 'ling.hs@example.edu.vn', '12/12/2008'],
      ['Trần Thị Mai', '0987654321', 'mai.hs@example.edu.vn', '01/02/2009'],
      ['Thiếu Email', '0987654321', null, '01/02/2009'],
      ['Thiếu Điện Thoại', null, 'thieu.sdt@example.edu.vn', '01/02/2009'],
      ['Thiếu Ngày Sinh', '0987654321', 'thieu.ns@example.edu.vn', null],
    ]);
    const res = await upload(s.base, '/api/admin/students/import?commit=true', studentTemplateFilename(SCHOOL), file, A.token);
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(2);
    expect(res.body.credentials.map((c: { username: string; password: string }) => [c.username, c.password])).toEqual([
      ['HSLing000012122008', 'DongAHSLing12122008'],
      ['HSMai432101022009', 'DongAHSMai01022009'],
    ]);
    expect(res.body.rows.filter((r: { status: string }) => r.status === 'error').map((r: { row: number; errors: string[] }) => [r.row, r.errors])).toEqual([
      [14, ['Thiếu email']], [15, ['Thiếu SĐT']], [16, ['Thiếu ngày sinh']],
    ]);
    const sent = await mailTo('ling.hs@example.edu.vn');
    expect(sent?.text).toContain('HSLing000012122008');
    expect(sent?.text).toContain('DongAHSLing12122008');
    expect((await mailTo('mai.hs@example.edu.vn'))?.text).toContain('HSMai432101022009');
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

  test('chỉ nhận đúng file mẫu của trường và đúng loại: file trường khác (dù đổi tên cho khớp) hoặc nhầm mẫu giáo viên/học sinh đều báo lỗi', async () => {
    const studentTemplate = (await download(s.base, '/api/admin/students/template', A.token)).buffer;
    const teacherTemplate = (await download(s.base, '/api/admin/teachers/template', A.token)).buffer;
    const sheet = (await open(studentTemplate)).getWorksheet('Học sinh')!;
    expect(String(sheet.getCell('A2').value)).toMatch(new RegExp(`^Mẫu nhập danh sách học sinh · ${SCHOOL} · Mã trường \\S+$`));
    const students = await fill(studentTemplate, 'Học sinh', [['Lý Văn Nhầm', '0900000001', 'nham@example.edu.vn', '02/02/2010']]);
    // file của trường A đổi tên cho giống file mẫu trường B rồi nhập vào trường B
    const wrongSchool = await upload(s.base, '/api/admin/students/import?commit=true', studentTemplateFilename(OTHER), students, B);
    expect(wrongSchool.status).toBe(400);
    expect(wrongSchool.body.detail).toContain('File này của trường khác');
    expect(wrongSchool.body.detail).toContain(SCHOOL);
    // mẫu giáo viên đặt tên như mẫu học sinh
    const teachers = await fill(teacherTemplate, 'Giáo viên', [['Lý Thị Nhầm', '0900000002', 'nham2@example.edu.vn', '02/02/1990']]);
    const wrongKind = await upload(s.base, '/api/admin/students/import', studentTemplateFilename(SCHOOL), teachers, A.token);
    expect(wrongKind.status).toBe(400);
    expect(wrongKind.body.detail).toContain('Đây là file mẫu giáo viên');
    // file xuất danh sách của trường A nhập vào trường B cũng bị từ chối
    const exported = (await download(s.base, '/api/admin/students/export', A.token)).buffer;
    const wrongExport = await upload(s.base, '/api/admin/students/import', studentTemplateFilename(OTHER), exported, B);
    expect(wrongExport.status).toBe(400);
    expect(wrongExport.body.detail).toContain('File này của trường khác');
    // không tạo tài khoản nào từ các lần nhập sai
    expect((await login('hsnham000102022010', 'DongAHSNham02022010', 'student')).status).toBe(401);
    // đúng trường, đúng loại thì nhận
    expect((await upload(s.base, '/api/admin/students/import', studentTemplateFilename(SCHOOL), students, A.token)).status).toBe(200);
  });

  test('trùng với tài khoản trường khác (RLS che): vẫn tạo được, thêm số thay vì lỗi 500', async () => {
    // cùng tên gọi Ling, cùng 4 số cuối và ngày sinh với học sinh đã nhập ở trường đầu
    const twin = await call(s.base, 'POST', '/api/admin/students', { full_name: 'Phạm Ling', phone: '0911110000', birth_date: '2008-12-12', email: 'ling2.hs@example.edu.vn' }, B);
    expect(twin.status).toBe(201);
    expect(twin.body).toMatchObject({ display_username: 'HSLing0000121220082', temporary_password: 'DongAHSLing12122008' });
    expect((await mailTo('ling2.hs@example.edu.vn'))?.text).toContain('HSLing0000121220082');
    // giáo viên trùng với hai tài khoản GVAnh… của trường đầu: số 3
    const third = await call(s.base, 'POST', '/api/admin/teachers', { full_name: 'Võ Anh', email: 'anh3.gv@example.edu.vn', phone: '0922226720', birth_date: '2005-04-10' }, B);
    expect(third.status).toBe(201);
    expect(third.body.display_username).toBe('GVAnh6720100420053');
  });
});
