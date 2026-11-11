/**
 * Số điện thoại của quản trị tổng, quản trị viên trường, giáo viên và học sinh: đúng 10 chữ số, không dấu cách hay ký hiệu,
 * ở mọi đường vào (tạo, sửa, hồ sơ cá nhân, nhập Excel) và có kiểm tra độ dài trong ô SĐT của mẫu Excel.
 * Điện thoại liên hệ của trường (không thuộc bốn vai trò này) không bị giới hạn.
 */
import { activate, adminLogin, call, download, hasPostgres, Started, startApp, upload } from './harness';

(hasPostgres() ? describe : describe.skip)('Số điện thoại đúng 10 chữ số cho cả bốn vai trò', () => {
  let s: Started, root: string, A: { id: number; token: string; adminId: number; adminUser: string };
  const PW = 'Matkhau-12345';
  const api = (method: string, path: string, body?: unknown, token = A.token) => call(s.base, method, path, body, token);
  const ExcelJS = () => import('exceljs');
  const BAD = ['090123456', '09012345678', '0901 234 567', '(090) 123-4567', '+84901234567', '090123456a', 'abcdefghij'];
  const MESSAGE = 'Số điện thoại gồm đúng 10 chữ số';

  beforeAll(async () => {
    s = await startApp('phone_rule_test');
    root = await adminLogin(s.base);
    const made = await call(s.base, 'POST', '/api/admin/schools', { name: 'THCS Điện Thoại', city: 'Hà Nội', contact_phone: '028 3822 1234', admin: { full_name: 'Quản Trị Điện Thoại', email: 'qt.phone@example.edu.vn' } }, root);
    expect(made.status).toBe(201); // điện thoại liên hệ của trường không bị giới hạn
    const active = await activate(s.base, made.body.admin.username, made.body.temporary_password, PW, 'school_admin');
    A = { id: made.body.school.id, token: active.token, adminId: made.body.admin.id, adminUser: made.body.admin.username };
  });
  afterAll(async () => { await s?.close(); });

  test('giáo viên và học sinh: tạo bằng số sai độ dài hoặc có ký hiệu bị từ chối với lời báo rõ; đúng 10 chữ số thì tạo được', async () => {
    for (const phone of BAD) {
      const t = await api('POST', '/api/admin/teachers', { full_name: 'Giáo Viên Số Sai', email: `gv.${phone.replace(/\W/g, '')}@example.edu.vn`, birth_date: '1985-03-15', phone });
      expect([phone, t.status]).toEqual([phone, 422]);
      expect(JSON.stringify(t.body)).toContain(MESSAGE);
      const st = await api('POST', '/api/admin/students', { full_name: 'Học Sinh Số Sai', birth_date: '2013-04-02', phone, email: 'tu.dong10.phone_rule@example.edu.vn' });
      expect([phone, st.status]).toEqual([phone, 422]);
    }
    const gv = await api('POST', '/api/admin/teachers', { full_name: 'Giáo Viên Số Đúng', email: 'gv.dung@example.edu.vn', birth_date: '1985-03-15', phone: '0901234567' });
    expect(gv.status).toBe(201);
    expect(gv.body.user.phone).toBe('0901234567');
    expect((await api('POST', '/api/admin/students', { full_name: 'Học Sinh Số Đúng', birth_date: '2013-04-02', phone: '0912345678', email: 'tu.dong11.phone_rule@example.edu.vn' })).status).toBe(201);
    // không khai số điện thoại thì không tạo được: SĐT dùng để ghép tên đăng nhập (đủ hết mới tạo, 11/11/2026)
    const none = await api('POST', '/api/admin/students', { full_name: 'Học Sinh Không Số', birth_date: '2013-05-02', email: 'khong.so@example.edu.vn' });
    expect(none.status).toBe(422);
    expect(none.body.detail).toContain('Cần số điện thoại');
  });

  test('quản trị viên trường và quản trị tổng do quản trị tổng tạo: số sai bị từ chối, quản trị viên trường cần đủ 10 chữ số', async () => {
    const base = { role: 'school_admin', school_id: A.id, full_name: 'Lê Thị Bình', email: 'binh.phone@example.edu.vn', birth_date: '1990-12-31' };
    for (const phone of BAD) {
      const r = await api('POST', '/api/admin/users', { ...base, phone }, root);
      expect([phone, r.status]).toEqual([phone, 422]);
    }
    expect((await api('POST', '/api/admin/users', { ...base, phone: '0901234567' }, root)).status).toBe(201);
    // quản trị tổng: số điện thoại không bắt buộc nhưng đã khai thì cũng đúng 10 chữ số
    expect((await api('POST', '/api/admin/users', { role: 'root_admin', full_name: 'Quản Trị Tổng Hai', email: 'tong2.phone@example.edu.vn', phone: '12345' }, root)).status).toBe(422);
    expect((await api('POST', '/api/admin/users', { role: 'root_admin', full_name: 'Quản Trị Tổng Hai', email: 'tong2.phone@example.edu.vn', phone: '0987654321' }, root)).status).toBe(201);
    // Thêm trường: quản trị viên đầu tiên cũng vậy
    const first = (phone: string, n: number) => api('POST', '/api/admin/schools', { name: `THCS Số Điện Thoại ${n}`, city: 'Hà Nội', admin: { full_name: 'Quản Trị Đầu', email: `dau${n}@example.edu.vn`, phone, birth_date: '1991-01-01' } }, root);
    expect((await first('0901 234 567', 1)).status).toBe(422);
    expect((await first('0901234567', 2)).status).toBe(201);
  });

  test('sửa tài khoản và hồ sơ cá nhân: số sai bị từ chối ở cả quản trị trường, giáo viên và quản trị tổng', async () => {
    const gv = await api('POST', '/api/admin/teachers', { full_name: 'Giáo Viên Sửa Số', email: 'gv.sua@example.edu.vn', birth_date: '1986-02-02', phone: '0900000012' });
    const id = gv.body.user.id as number;
    for (const phone of BAD) expect([phone, (await api('PATCH', `/api/admin/users/${id}`, { phone })).status]).toEqual([phone, 422]);
    expect((await api('PATCH', `/api/admin/users/${id}`, { phone: '0988000111' })).body).toMatchObject({ phone: '0988000111' });
    // hồ sơ cá nhân: giáo viên, quản trị viên trường, quản trị tổng
    const gvLogin = await activate(s.base, gv.body.user.username, gv.body.temporary_password, PW, 'teacher');
    for (const [who, token] of [['giáo viên', gvLogin.token], ['quản trị trường', A.token], ['quản trị tổng', root]] as const) {
      for (const phone of ['0912 345 678', '091234567', '09123456789']) {
        const r = await call(s.base, 'PATCH', '/api/auth/profile', { phone }, token);
        expect([who, phone, r.status]).toEqual([who, phone, 422]);
      }
      expect([who, (await call(s.base, 'PATCH', '/api/auth/profile', { phone: '0912345678' }, token)).status]).toEqual([who, 200]);
    }
  });

  test('nhập Excel: dòng có số sai báo lỗi đúng dòng, số đúng được nhập; ô SĐT của mẫu có kiểm tra đúng 10 chữ số', async () => {
    const wb = new (await ExcelJS()).Workbook();
    const ws = wb.addWorksheet('Học sinh');
    ws.addRow(['Họ và tên *', 'SĐT', 'Email', 'Ngày sinh *']);
    ws.addRow(['Em Số Sai', '090123456', 'sai@example.edu.vn', '2013-04-02']);
    ws.addRow(['Em Có Dấu Cách', '0901 234 567', 'cach@example.edu.vn', '2013-04-03']);
    ws.addRow(['Em Số Đúng', '0901234567', 'dung@example.edu.vn', '2013-04-04']);
    const file = Buffer.from(await wb.xlsx.writeBuffer());
    const spec = (await api('GET', '/api/admin/students/import-spec')).body; // máy chủ chỉ nhận đúng tên file mẫu của trường
    const preview = await upload(s.base, '/api/admin/students/import', spec.legacy_filename ?? spec.filename, file, A.token);
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ total: 3, valid: 1, errors: 2 });
    expect(preview.body.rows[0].errors).toEqual([MESSAGE]);
    expect(preview.body.rows[1].errors).toEqual([MESSAGE]);
    expect(preview.body.rows[2].status).toBe('ok');
    // mẫu tải về: cột SĐT chỉ nhận đúng 10 ký tự
    const tpl = new (await ExcelJS()).Workbook();
    await tpl.xlsx.load((await download(s.base, '/api/admin/students/template', A.token)).buffer as unknown as Parameters<typeof tpl.xlsx.load>[0]);
    const sheet = tpl.getWorksheet('Học sinh')!;
    let header = 0;
    sheet.eachRow((row, n) => { if (!header && (row.values as unknown[]).includes('SĐT *')) header = n; });
    expect(header).toBeGreaterThan(0);
    for (const n of [header + 1, header + 1000]) {
      expect(sheet.getCell(n, 5).dataValidation).toMatchObject({ type: 'textLength', operator: 'equal', formulae: [10], allowBlank: true, showErrorMessage: true, error: `${MESSAGE}.` });
      expect(sheet.getCell(n, 5).numFmt).toBe('@');
    }
  });
});
