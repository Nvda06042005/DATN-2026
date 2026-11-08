/**
 * Học sinh làm đúng như giáo viên: file mẫu và danh sách xuất theo bố cục chuẩn của Đông A (logo, tên trường, ngày tự cập nhật, khối ví dụ, bảng Số thứ tự tự hiện khi nhập họ tên,
 * Mã học sinh tự sinh = HS + viết tắt trường + năm + ngày sinh + STT, Họ và tên, Giới tính chọn Nam/Nữ, SĐT, Email, Ngày tháng năm sinh), nhập hàng loạt, nhập file cũ còn cột Lớp
 * và Email phụ huynh, xem trước mã cho biểu mẫu thêm từng người (cùng công thức với Excel).
 */
import { activate, adminLogin, call, download, hasPostgres, sql, Started, startApp, upload } from './harness';
import { studentCodePrefix, vnDayLabel } from '../src/admin/excel';

const HEADER = ['Số thứ tự', 'Mã học sinh', 'Họ và tên *', 'Giới tính', 'SĐT', 'Email *', 'Ngày tháng năm sinh *'];
const EXPORT_HEADER = ['Số thứ tự', 'Mã học sinh', 'Họ và tên', 'Giới tính', 'SĐT', 'Email', 'Ngày tháng năm sinh', 'Lớp', 'Khối', 'Trạng thái'];

(hasPostgres() ? describe : describe.skip)('Học sinh: mẫu Excel, nhập hàng loạt, xuất danh sách, xem trước mã', () => {
  let s: Started, root: string, A: { id: number; token: string }, B: { id: number; token: string }, C: { id: number; token: string }, yearA: number;
  const PW = 'Matkhau-12345';
  const SCHOOL = 'THCS Nam Kỳ Khởi Nghĩa'; // viết tắt NKKN
  const SHORT_SCHOOL = 'THCS An'; // viết tắt chỉ một chữ A: tiền tố HSA26 trông như địa chỉ ô Excel
  const api = (method: string, path: string, body?: unknown, token = A.token) => call(s.base, method, path, body, token);
  const ExcelJS = () => import('exceljs');
  const prefixOf = (school: string) => studentCodePrefix(school);

  async function school(name: string, email: string) {
    const made = await call(s.base, 'POST', '/api/admin/schools', { name, city: 'Thành phố Hà Nội', admin: { full_name: `QT ${name}`, email } }, root);
    const active = await activate(s.base, made.body.admin.username, made.body.temporary_password, PW, 'school_admin');
    return { id: made.body.school.id as number, token: active.token };
  }
  async function open(buffer: Buffer) {
    const wb = new (await ExcelJS()).Workbook();
    await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
    return wb;
  }
  const headerRowOf = (sheet: { eachRow: (cb: (row: { values: unknown }, n: number) => void) => void }, label: string) => { let at = 0; sheet.eachRow((row, n) => { if (!at && (row.values as unknown[]).includes(label)) at = n; }); return at; };
  /** Điền các dòng vào file mẫu đã tải như người dùng làm trong Excel: chỉ gõ Họ và tên, Giới tính, SĐT, Email, Ngày sinh (cột C đến G); cột A (số thứ tự) và B (mã) là công thức nên để nguyên */
  async function fill(template: Buffer, rows: Array<Array<string | Date | null>>): Promise<{ file: Buffer; first: number }> {
    const wb = await open(template);
    const sheet = wb.getWorksheet('Học sinh')!;
    const header = headerRowOf(sheet as never, 'Họ và tên *');
    rows.forEach((values, i) => values.forEach((v, c) => { if (v !== null) sheet.getRow(header + 1 + i).getCell(c + 3).value = v; }));
    return { file: Buffer.from(await wb.xlsx.writeBuffer()), first: header + 1 };
  }
  /** Tệp .xlsx theo bố cục cũ (một dòng tiêu đề ở dòng 1, có cột Lớp và Email phụ huynh) như các file học sinh đã tải từ trước */
  async function legacy(rows: Array<Array<string | null>>): Promise<Buffer> {
    const wb = new (await ExcelJS()).Workbook();
    const ws = wb.addWorksheet('Học sinh');
    ws.addRow(['Mã học sinh', 'Họ và tên *', 'Ngày sinh *', 'Giới tính', 'Lớp', 'Email', 'Email phụ huynh']);
    for (const r of rows) ws.addRow(r);
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  beforeAll(async () => {
    s = await startApp('student_excel_test');
    root = await adminLogin(s.base);
    A = await school(SCHOOL, 'qt.hs.a@example.edu.vn');
    B = await school('THCS Trường Không Năm Học', 'qt.hs.b@example.edu.vn');
    C = await school(SHORT_SCHOOL, 'qt.hs.c@example.edu.vn');
    yearA = (await api('POST', '/api/admin/school-years', { label: '2026-2027', starts_on: '2026-09-05', ends_on: '2027-05-31' })).body.id;
    await api('POST', `/api/admin/school-years/${yearA}/activate`, {});
    for (const [grade, name] of [[8, '8B1'], [7, '7A2'], [7, '7A1']] as const) await api('POST', '/api/admin/classes', { year_id: yearA, grade, name });
  });
  afterAll(async () => { await s?.close(); });

  test('file mẫu học sinh: logo, tên trường, ngày tự cập nhật, khối ví dụ, bảng đúng bảy cột như giáo viên, STT và mã tự hiện, ô chọn Nam/Nữ, ô ngày, 1000 dòng công thức', async () => {
    const before = vnDayLabel();
    const res = await download(s.base, '/api/admin/students/template', A.token);
    const after = vnDayLabel();
    expect(res.status).toBe(200);
    const wb = await open(res.buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Học sinh', 'Hướng dẫn']); // không còn sheet danh sách lớp: mẫu không có cột Lớp
    const sheet = wb.getWorksheet('Học sinh')!;
    expect(sheet.getCell('A1').value).toBeNull();
    expect(sheet.getImages()).toHaveLength(1);
    expect(String(sheet.getCell('A2').value)).toBe(`Mẫu nhập danh sách học sinh · ${SCHOOL}`);
    expect(sheet.getCell('B3').value).toBe('Ngày bắt đầu nhập:');
    expect([before, after]).toContain(sheet.getCell('C3').value);
    expect(sheet.getCell('B4').value).not.toBe('Năm học:'); // như mẫu giáo viên: chỉ có ngày bắt đầu nhập
    const header = headerRowOf(sheet as never, 'Họ và tên *');
    expect(header).toBe(11); // 1 logo, 2 trường, 3 ngày, 4 ghi chú, 5 dòng đệm, 6–10 khối ví dụ, 11 tiêu đề của bảng nhập thật (đúng như mẫu giáo viên)
    expect((sheet.getRow(header).values as unknown[]).slice(1)).toEqual(HEADER);
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: header });
    const prefix = prefixOf(SCHOOL);
    expect(prefix).toBe(`HSNKKN${vnDayLabel().slice(8, 10)}`);
    // khối ví dụ riêng ở trên bảng: không nằm trong dữ liệu nhập
    expect(String(sheet.getCell('A6').value)).toContain('VÍ DỤ CÁCH ĐIỀN');
    expect(sheet.getCell('B8').value).toBe(`${prefix}02042013001`);
    expect(sheet.getCell('C8').value).toBe('Trần Thị Mẫu');
    expect(sheet.getCell('G8').value).toBeInstanceOf(Date);
    expect(String(sheet.getCell('A9').value)).toContain('HS = học sinh');
    expect(String(sheet.getCell('A9').value)).toContain('02 + 04 + 2013');
    // dòng ghi chú dưới khối ví dụ: nói rõ chỉ nhập các cột nào, mã tự sinh, STT tự hiện khi nhấn Enter
    const banner = String(sheet.getCell('A10').value);
    expect(banner).toContain('Bạn chỉ nhập Họ và tên *, Giới tính, SĐT, Email *, Ngày tháng năm sinh *');
    expect(banner).toContain('Mã học sinh tự động sinh');
    expect(banner).toContain('Số thứ tự tự xuất hiện khi bạn nhấn Enter');
    for (const n of [header + 1, header + 1000]) {
      // số thứ tự là công thức: trống cho đến khi dòng có họ tên rồi mới hiện
      expect(sheet.getCell(n, 1).value).toMatchObject({ formula: `IF(C${n}="","",COUNTIFS($C$${header + 1}:C${n},"?*"))` });
      expect(sheet.getCell(n, 2).value).toMatchObject({ formula: expect.stringContaining(`"${prefix}"&TEXT(G${n},"ddmmyyyy")&TEXT(A${n},"000")`) }); // mã tự tính từ ngày sinh và số thứ tự
      expect(sheet.getCell(n, 2).numFmt).toBe('@');
      expect(sheet.getCell(n, 4).dataValidation).toMatchObject({ type: 'list', formulae: ['"Nam,Nữ"'], allowBlank: true, showErrorMessage: true });
      expect(sheet.getCell(n, 5).numFmt).toBe('@'); // SĐT giữ số 0 đầu
      expect(sheet.getCell(n, 7).dataValidation).toMatchObject({ type: 'date', operator: 'between', allowBlank: true, showErrorMessage: true });
      expect(sheet.getCell(n, 7).numFmt).toBe('dd/mm/yyyy');
    }
    expect(sheet.getCell(header + 1001, 4).dataValidation).toBeFalsy();
    const guide: string[] = [];
    wb.getWorksheet('Hướng dẫn')!.eachRow((row) => guide.push(String(row.getCell(1).value ?? '')));
    const text = guide.join('\n');
    expect(text).toContain('Chỉ nhận file Excel .xlsx');
    expect(text).toContain(`HS + NKKN + ${vnDayLabel().slice(8, 10)} + ngày sinh ddmmyyyy + STT 3 chữ số`);
    expect(text).toContain(`${prefix}02042013001`);
    expect(text).toContain('nhấn Enter');
    expect(text).toContain('Lớp và Email phụ huynh không có trong mẫu này');
    // tải ở trường khác: tên trường và tiền tố mã đổi theo trường của người tải; tham số năm học cũ không còn tác dụng
    const other = await open((await download(s.base, `/api/admin/students/template?year_id=${yearA}`, B.token)).buffer);
    expect(String(other.getWorksheet('Học sinh')!.getCell('A2').value)).toContain('THCS Trường Không Năm Học');
    expect(other.getWorksheet('Học sinh')!.getCell('B8').value).toBe(`${prefixOf('THCS Trường Không Năm Học')}02042013001`);
  });

  test('khối ví dụ không tạo tài khoản hoặc gửi thư khi tải nguyên mẫu lên', async () => {
    const before = await sql(s.url, 'SELECT count(*)::int AS n FROM app_users');
    const template = (await download(s.base, '/api/admin/students/template', A.token)).buffer;
    const res = await upload(s.base, '/api/admin/students/import?commit=true', 'chua-dien.xlsx', template, A.token);
    expect(res.status).toBe(400);
    expect(res.body.detail).toContain('không có dòng dữ liệu');
    expect(await sql(s.url, 'SELECT count(*)::int AS n FROM app_users')).toEqual(before);
    expect(await sql(s.url, "SELECT id FROM app_users WHERE email IN ('hoc.sinh@example.invalid', 'phu.huynh@example.invalid') OR full_name = 'Trần Thị Mẫu'")).toEqual([]);
  });

  test('điền file mẫu rồi nhập: chỉ gõ năm cột, mã HS... tự tính từ ngày sinh và số thứ tự, email bắt buộc, lỗi đúng số dòng trong Excel', async () => {
    const template = (await download(s.base, '/api/admin/students/template', A.token)).buffer;
    const { file, first } = await fill(template, [
      ['Nguyễn Thị Lan', 'Nữ', '0901234567', 'lan@example.edu.vn', new Date('2013-04-02T00:00:00.000Z')],
      ['Trần Văn Bình', 'Nam', null, 'binh@example.edu.vn', new Date('2013-05-06T00:00:00.000Z')],
      ['Lê Thị Gõ Ngày Tay', 'Nữ', null, 'le@example.edu.vn', '20/11/2012'],
      ['Thiếu Ngày Sinh', 'Nam', null, 'ngay@example.edu.vn', null],
      ['Giới Tính Sai', 'X', null, 'gt@example.edu.vn', new Date('2013-02-02T00:00:00.000Z')],
      ['SĐT Sai', 'Nữ', '12', 'sdt@example.edu.vn', new Date('2013-03-03T00:00:00.000Z')],
      ['Email Trùng Dòng Trước', 'Nam', null, 'lan@example.edu.vn', new Date('2013-04-04T00:00:00.000Z')],
      ['Thiếu Email', 'Nữ', null, null, new Date('2013-06-06T00:00:00.000Z')],
    ]);
    const preview = await upload(s.base, '/api/admin/students/import', 'mau-hoc-sinh.xlsx', file, A.token);
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ committed: false, total: 8, valid: 3, errors: 5, created: 0 });
    expect(preview.body.rows.map((r: { row: number; status: string }) => [r.row, r.status])).toEqual(Array.from({ length: 8 }, (_, i) => [first + i, i < 3 ? 'ok' : 'error']));
    expect(preview.body.rows[3].errors).toEqual(['Thiếu ngày sinh']);
    expect(preview.body.rows[4].errors).toEqual(['Giới tính phải là Nam, Nữ hoặc Khác']);
    expect(preview.body.rows[5].errors).toEqual(['Số điện thoại không hợp lệ']);
    expect(preview.body.rows[6].errors).toEqual(['Email trùng với dòng trước trong file']);
    expect(preview.body.rows[7].errors).toEqual(['Thiếu email']);
    expect(await sql(s.url, "SELECT 1 FROM app_users WHERE role = 'student' AND full_name = 'Nguyễn Thị Lan'")).toEqual([]); // xem trước không lưu
    const commit = await upload(s.base, '/api/admin/students/import?commit=true', 'mau-hoc-sinh.xlsx', file, A.token);
    expect(commit.body).toMatchObject({ committed: true, created: 3, errors: 5 });
    const prefix = prefixOf(SCHOOL);
    const saved = await sql<{ full_name: string; user_code: string; gender: string | null; birth_date: string; phone: string | null; email: string | null }>(s.url,
      `SELECT full_name, user_code, gender, birth_date::text AS birth_date, phone, email FROM app_users WHERE role = 'student' AND school_id = ${A.id} ORDER BY id`);
    expect(saved).toEqual([
      { full_name: 'Nguyễn Thị Lan', user_code: `${prefix}02042013001`, gender: 'female', birth_date: '2013-04-02', phone: '0901234567', email: 'lan@example.edu.vn' },
      { full_name: 'Trần Văn Bình', user_code: `${prefix}06052013002`, gender: 'male', birth_date: '2013-05-06', phone: null, email: 'binh@example.edu.vn' },
      { full_name: 'Lê Thị Gõ Ngày Tay', user_code: `${prefix}20112012003`, gender: 'female', birth_date: '2012-11-20', phone: null, email: 'le@example.edu.vn' },
    ]);
    // nhập lại đúng file: ba học sinh đầu trùng mã nên bị báo, không tạo thêm
    const again = await upload(s.base, '/api/admin/students/import?commit=true', 'mau-hoc-sinh.xlsx', file, A.token);
    expect(again.body.created).toBe(0);
    expect(again.body.rows[0].errors[0]).toMatch(/đã được dùng|trùng|đã có/i);
    // danh sách học sinh của trường tự có người mới, kèm số điện thoại như cột trong Excel
    const list = (await api('GET', '/api/admin/students')).body.items as Array<{ user_code: string; phone: string | null }>;
    expect(list.map((u) => u.user_code)).toEqual(expect.arrayContaining([`${prefix}02042013001`, `${prefix}06052013002`]));
    expect(list.find((u) => u.user_code === `${prefix}02042013001`)?.phone).toBe('0901234567');
  });

  test('file cũ có cột Lớp và Email phụ huynh vẫn nhập được: xếp lớp theo tên, báo lớp không có', async () => {
    const file = await legacy([
      ['HS0001', 'Trần Thị Bình', '15/03/2013', 'Nữ', '7A1', 'binh.cu@example.edu.vn', 'ph.binh@example.com'],
      [null, 'Lớp Không Có', '01/01/2013', 'Nam', '9Z', 'khong@example.edu.vn', null],
    ]);
    const preview = await upload(s.base, '/api/admin/students/import', 'file-cu.xlsx', file, A.token);
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ total: 2, valid: 1, errors: 1 });
    expect(preview.body.rows[1].errors).toEqual(['Không có lớp "9Z" trong năm học đã chọn']);
    const commit = await upload(s.base, '/api/admin/students/import?commit=true', 'file-cu.xlsx', file, A.token);
    expect(commit.body).toMatchObject({ created: 1, errors: 1 });
    const bình = (await api('GET', '/api/admin/students?q=HS0001')).body.items[0];
    expect(bình).toMatchObject({ user_code: 'HS0001', full_name: 'Trần Thị Bình', parent_email: 'ph.binh@example.com' });
    expect(bình.classes.map((c: { name: string }) => c.name)).toEqual(['7A1']);
  });

  test('file đã lưu bằng Excel thật (công thức điền xuống được lưu dạng dùng chung): mã vẫn đúng tiền tố ở mọi dòng', async () => {
    // trường có tiền tố ngắn (HSA26) trông như địa chỉ ô Excel nên ExcelJS dịch nhầm nó thành HSA28 khi đọc công thức dùng chung ở dòng sau
    const template = (await download(s.base, '/api/admin/students/template', C.token)).buffer;
    const { file, first } = await fill(template, [
      ['Nguyễn Thị Lan', 'Nữ', null, 'lan.c@example.edu.vn', new Date('2013-04-02T00:00:00.000Z')],
      [null, null, null, null, null],
      ['Trần Văn Bình', 'Nam', null, 'binh.c@example.edu.vn', new Date('2013-05-06T00:00:00.000Z')],
    ]);
    // Excel gộp các công thức giống nhau của một cột thành "công thức dùng chung": ô gốc giữ chữ công thức, các ô con chỉ trỏ về ô gốc
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(file);
    const entry = 'xl/worksheets/sheet1.xml';
    let xml = await zip.file(entry)!.async('string');
    let si = 0;
    for (const col of ['A', 'B']) {
      let rows = 0;
      const cell = new RegExp(`<c r="${col}(\\d+)"([^>]*)><f>([^<]*)</f>`, 'g');
      xml = xml.replace(cell, (whole, row: string, attrs: string, formula: string) => {
        if (Number(row) < first) return whole;
        rows += 1;
        return rows === 1 ? `<c r="${col}${row}"${attrs}><f t="shared" ref="${col}${first}:${col}${first + 999}" si="${si}">${formula}</f>` : `<c r="${col}${row}"${attrs}><f t="shared" si="${si}"/>`;
      });
      expect(rows).toBe(1000);
      si += 1;
    }
    zip.file(entry, xml);
    const shared = Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
    const reread = await open(shared);
    expect((reread.getWorksheet('Học sinh')!.getCell(first + 2, 2).value as { sharedFormula?: string }).sharedFormula).toBe(`B${first}`); // đúng là dạng dùng chung như Excel lưu
    expect(prefixOf(SHORT_SCHOOL)).toMatch(/^HSA\d\d$/);
    const preview = await upload(s.base, '/api/admin/students/import', 'da-luu-bang-excel.xlsx', shared, C.token);
    expect(preview.status).toBe(200);
    expect(preview.body.rows.map((r: { row: number; user_code: string; status: string }) => [r.row, r.user_code, r.status])).toEqual([
      [first, `${prefixOf(SHORT_SCHOOL)}02042013001`, 'ok'],
      [first + 2, `${prefixOf(SHORT_SCHOOL)}06052013002`, 'ok'], // học sinh thứ hai (dòng trống ở giữa không tính); tiền tố không bị dịch thành HSA28
    ]);
  });

  test('danh sách xuất cùng bố cục: logo, trường, ngày xuất, số học sinh, cùng bảy cột rồi thêm Lớp, Khối và Trạng thái; lọc theo lớp; tải lên lại được', async () => {
    const res = await download(s.base, '/api/admin/students/export', A.token);
    expect(res.status).toBe(200);
    const wb = await open(res.buffer);
    const sheet = wb.getWorksheet('Học sinh')!;
    expect(sheet.getCell('A1').value).toBeNull();
    expect(sheet.getImages()).toHaveLength(1);
    expect(String(sheet.getCell('A2').value)).toBe(`Danh sách học sinh · ${SCHOOL}`);
    expect(sheet.getCell('B3').value).toBe('Ngày xuất:');
    expect(sheet.getCell('B4').value).toBe('Số học sinh:');
    const total = (await api('GET', '/api/admin/students')).body.total as number;
    expect(sheet.getCell('C4').value).toBe(String(total));
    const header = headerRowOf(sheet as never, 'Họ và tên');
    expect((sheet.getRow(header).values as unknown[]).slice(1)).toEqual(EXPORT_HEADER);
    const rows: Array<Record<string, unknown>> = [];
    for (let n = header + 1; n <= sheet.rowCount; n += 1) {
      const r = sheet.getRow(n);
      if (r.getCell(3).value) rows.push({ stt: r.getCell(1).value, code: r.getCell(2).value, name: r.getCell(3).value, gender: r.getCell(4).value, phone: r.getCell(5).value, email: r.getCell(6).value, born: r.getCell(7).value, klass: r.getCell(8).value, grade: r.getCell(9).value, status: r.getCell(10).value });
    }
    expect(rows).toHaveLength(total);
    expect(rows.map((r) => r.stt)).toEqual(rows.map((_, i) => i + 1));
    const lan = rows.find((r) => r.name === 'Nguyễn Thị Lan')!;
    expect(lan).toMatchObject({ code: `${prefixOf(SCHOOL)}02042013001`, gender: 'Nữ', phone: '0901234567', email: 'lan@example.edu.vn', status: 'Đang hoạt động' });
    expect((lan.born as Date).toISOString().slice(0, 10)).toBe('2013-04-02');
    const bình = rows.find((r) => r.name === 'Trần Thị Bình')!; // nhập từ file cũ, đã xếp vào lớp 7A1
    expect(bình).toMatchObject({ code: 'HS0001', klass: '7A1', grade: 'Khối 7' });
    // lọc theo lớp như ở danh sách
    const classId = (await api('GET', `/api/admin/classes?year_id=${yearA}`)).body.items.find((c: { name: string }) => c.name === '7A1').id;
    const filtered = await open((await download(s.base, `/api/admin/students/export?class_id=${classId}`, A.token)).buffer);
    const names: string[] = [];
    const fs = filtered.getWorksheet('Học sinh')!;
    for (let n = headerRowOf(fs as never, 'Họ và tên') + 1; n <= fs.rowCount; n += 1) if (fs.getRow(n).getCell(3).value) names.push(String(fs.getRow(n).getCell(3).value));
    expect(names).toEqual(['Trần Thị Bình']);
    // file xuất tải lên ở trường khác: đọc đủ dòng (lớp không có ở trường đó nên báo lỗi lớp, không phải lỗi định dạng file)
    const again = await upload(s.base, '/api/admin/students/import', 'danh-sach.xlsx', res.buffer, B.token);
    expect(again.status).toBe(200);
    expect(again.body.total).toBe(total);
  });

  test('xem trước mã học sinh cho biểu mẫu thêm từng em (registration-code/student): cùng công thức với Excel, số thứ tự là số kế tiếp chưa dùng, HS ở đầu nên dãy riêng với giáo viên', async () => {
    const prefix = prefixOf(SCHOOL);
    const preview = (query: string, token = A.token) => api('GET', `/api/admin/registration-code/student${query}`, undefined, token);
    // ngày sinh 02/04/2013 đã có mã ...001 do nhập Excel ở trên: số kế tiếp là 002
    expect((await preview('?birth_date=2013-04-02')).body).toEqual({ prefix, code: `${prefix}02042013002`, serial: 2 });
    // thêm giáo viên cùng ngày sinh (mã giáo viên do bộ sinh riêng cấp): mã học sinh cùng ngày sinh vẫn bắt đầu từ 001 vì khác tiền tố HS
    const teacher = await api('POST', '/api/admin/teachers', { full_name: 'Cô Cùng Ngày Sinh', email: 'co.cung@example.edu.vn', birth_date: '1985-03-15' });
    expect(teacher.status).toBe(201);
    expect(teacher.body.user.user_code).not.toMatch(/^HS/);
    expect((await preview('?birth_date=1985-03-15')).body.code).toBe(`${prefix}15031985001`);
    // thêm học sinh không gửi mã (biểu mẫu thêm từng em): máy chủ cấp đúng mã vừa xem trước, em kế tiếp cùng ngày sinh nhận số kế tiếp; gửi kèm mã đã dùng thì bị từ chối
    const made = await api('POST', '/api/admin/students', { full_name: 'Em Mã Tự Tính', birth_date: '2013-04-02' });
    expect(made.status).toBe(201);
    expect(made.body.user.user_code).toBe(`${prefix}02042013002`);
    expect((await api('POST', '/api/admin/students', { full_name: 'Em Cùng Ngày Sinh', birth_date: '2013-04-02' })).body.user.user_code).toBe(`${prefix}02042013003`);
    expect((await api('POST', '/api/admin/students', { full_name: 'Em Trùng Mã', birth_date: '2013-02-02', user_code: `${prefix}02042013002` })).status).toBe(409);
    expect((await preview('?birth_date=2013-04-02')).body.code).toBe(`${prefix}02042013004`);
    // chưa chọn ngày sinh: chưa có mã; ngày sai hoặc ở tương lai bị từ chối
    expect((await preview('')).body).toEqual({ prefix, code: null, serial: null });
    for (const q of ['?birth_date=2999-01-01', '?birth_date=1990-02-31']) expect([q, (await preview(q)).status]).toEqual([q, 422]);
    expect((await preview('?birth_date=2013-04-02', root)).status).toBe(422); // quản trị tổng phải chỉ rõ trường
    expect((await preview(`?birth_date=2013-04-02&school_id=${A.id}`, root)).body.code).toBe(`${prefix}02042013004`);
    // trường khác có dãy riêng và tiền tố riêng
    const other = (await preview('?birth_date=2013-04-02', B.token)).body;
    expect(other.code).toBe(`${prefixOf('THCS Trường Không Năm Học')}02042013001`);
    expect(other.code).not.toBe(`${prefix}02042013004`);
  });
});
