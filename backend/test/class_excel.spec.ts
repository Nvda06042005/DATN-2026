/**
 * Xếp lớp từ Excel (HK.QT.039) theo cùng cách với mẫu giáo viên/học sinh (yêu cầu 12/11/2026): file mẫu có logo Đông A, năm học, tên và mã trường,
 * ví dụ, bảng giống danh sách lớp của nhà trường (STT, Mã học sinh, Họ và tên, Ngày sinh, Giới tính, Lớp); tên file theo trường và năm học.
 * Khi nhập chỉ nhận đúng file của trường và năm học; học sinh nhận ra bằng mã hoặc họ tên + ngày sinh.
 */
import { activate, adminLogin, call, download, hasPostgres, Started, startApp, upload } from './harness';
import { PW } from './fixture';
import { classTemplateFilename, studentTemplateFilename } from '../src/admin/excel';

const SCHOOL = 'THCS Giồng Ông Tố', OTHER = 'THCS Bình An', YEAR = '2026-2027';
const HEADER = ['Số thứ tự', 'Mã học sinh', 'Họ và tên', 'Ngày sinh', 'Giới tính', 'Lớp *'];

(hasPostgres() ? describe : describe.skip)('Xếp lớp từ Excel: file mẫu theo trường và năm học', () => {
  let s: Started, root: string;
  let A: { token: string; year: number; next: number }, B: { token: string; year: number };
  const codes: Record<string, string> = {};
  const api = (method: string, path: string, body?: unknown, token = A.token) => call(s.base, method, path, body, token);
  const open = async (buffer: Buffer) => { const w = new (await import('exceljs')).Workbook(); await w.xlsx.load(buffer as never); return w; };
  const headerRowOf = (sheet: import('exceljs').Worksheet) => { let n = 0; sheet.eachRow((row, i) => { if (!n && (row.values as unknown[]).includes('Lớp *')) n = i; }); return n; };
  /** Điền các dòng [Mã, Họ tên, Ngày sinh, Giới tính, Lớp] vào bảng của file mẫu, ngay dưới dòng tiêu đề */
  const fill = async (template: Buffer, rows: string[][]) => {
    const wb = await open(template), sheet = wb.getWorksheet('Xếp lớp')!, first = headerRowOf(sheet) + 1;
    rows.forEach((values, i) => values.forEach((v, c) => { if (v) sheet.getRow(first + i).getCell(c + 2).value = v; }));
    return { file: Buffer.from(await wb.xlsx.writeBuffer()), first };
  };

  beforeAll(async () => {
    s = await startApp('class_excel_test');
    root = await adminLogin(s.base);
    const school = async (name: string, email: string) => {
      const made = await call(s.base, 'POST', '/api/admin/schools', { name, admin: { full_name: 'Quản trị Lớp', email } }, root);
      if (made.status !== 201) throw new Error('tạo trường lỗi ' + JSON.stringify(made.body));
      const token = (await activate(s.base, made.body.admin.username, made.body.temporary_password, PW, 'school_admin')).token;
      const year = (await call(s.base, 'POST', '/api/admin/school-years', { label: YEAR, starts_on: '2026-09-05', ends_on: '2027-05-31' }, token)).body.id as number;
      await call(s.base, 'POST', `/api/admin/school-years/${year}/activate`, undefined, token);
      return { token, year };
    };
    const a = await school(SCHOOL, 'qt.lop.a@example.invalid');
    const next = (await call(s.base, 'POST', '/api/admin/school-years', { label: '2027-2028', starts_on: '2027-09-05', ends_on: '2028-05-31' }, a.token)).body.id as number;
    A = { ...a, next };
    B = await school(OTHER, 'qt.lop.b@example.invalid');
    for (const name of ['6A1', '6A2']) expect((await api('POST', '/api/admin/classes', { year_id: A.year, grade: 6, name })).status).toBe(201);
    expect((await api('POST', '/api/admin/classes', { year_id: B.year, grade: 6, name: '6A1' }, B.token)).status).toBe(201);
    // học sinh giống danh sách lớp của trường; hai em trùng cả họ tên lẫn ngày sinh
    const students: Array<[string, string, string, string]> = [
      ['an', 'Trần Hoài An', '2015-07-01', 'an.hs@example.edu.vn'],
      ['han', 'Phan Khả Hân', '2015-09-09', 'han.hs@example.edu.vn'],
      ['hien', 'Lê Minh Hiển', '2015-06-27', 'hien.hs@example.edu.vn'],
      ['kim1', 'Nguyễn Thiên Kim', '2015-09-16', 'kim1.hs@example.edu.vn'],
      ['kim2', 'Nguyễn Thiên Kim', '2015-09-16', 'kim2.hs@example.edu.vn'],
    ];
    for (const [key, full_name, birth_date, email] of students) {
      const made = await api('POST', '/api/admin/students', { full_name, birth_date, email, phone: '0901234567' });
      expect(made.status).toBe(201);
      codes[key] = made.body.user.user_code;
    }
  });
  afterAll(async () => { await s?.close(); });

  test('file mẫu: logo Đông A, năm học, tên và mã trường, ví dụ, bảng giống danh sách lớp; ô Lớp chọn trong các lớp của năm học; tên file theo trường và năm học', async () => {
    const spec = await api('GET', `/api/admin/classes/import-spec?year_id=${A.year}`);
    expect(spec.body).toMatchObject({ filename: classTemplateFilename(SCHOOL, YEAR), school_name: SCHOOL, year_label: YEAR, classes: ['6A1', '6A2'] });
    expect(spec.body.filename).toBe('file_mau_xep-lop_truong_giong-ong-to_2026-2027.xlsx');
    const raw = await fetch(`${s.base}/api/admin/classes/template?year_id=${A.year}`, { headers: { Authorization: `Bearer ${A.token}` } });
    expect(raw.headers.get('content-disposition')).toContain(spec.body.filename);
    const wb = await open(Buffer.from(await raw.arrayBuffer())), sheet = wb.getWorksheet('Xếp lớp')!;
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Xếp lớp', 'Hướng dẫn']);
    expect(sheet.getImages()).toHaveLength(1); // logo Đông A
    expect(String(sheet.getCell('A2').value)).toMatch(new RegExp(`^Mẫu xếp lớp năm học ${YEAR} · ${SCHOOL} · Mã trường \\S+$`));
    expect([sheet.getCell('B3').value, sheet.getCell('C3').value]).toEqual(['Năm học:', YEAR]);
    expect(sheet.getCell('B4').value).toBe('Ngày bắt đầu nhập:');
    const head = headerRowOf(sheet);
    expect((sheet.getRow(head).values as unknown[]).slice(1)).toEqual(HEADER);
    const texts: string[] = []; sheet.eachRow((row) => texts.push(String(row.getCell(1).value ?? '')));
    expect(texts.join('\n')).toContain('VÍ DỤ CÁCH ĐIỀN · Chỉ minh họa, không xếp lớp');
    for (const n of [head + 1, head + 1000]) {
      expect(sheet.getCell(n, 6).dataValidation).toMatchObject({ type: 'list', formulae: ['"6A1,6A2"'] });
      expect(sheet.getCell(n, 5).dataValidation).toMatchObject({ type: 'list', formulae: ['"Nam,Nữ,Khác"'] });
      expect(sheet.getCell(n, 4).numFmt).toBe('@'); // ngày sinh gõ dd/mm/yyyy không bị đổi theo cài đặt ngày của Windows
      expect(sheet.getCell(n, 1).value).toMatchObject({ formula: expect.stringContaining(`F${n}`) }); // STT tự hiện khi đã chọn lớp
    }
    const guide: string[] = []; wb.getWorksheet('Hướng dẫn')!.eachRow((row) => guide.push(String(row.getCell(1).value ?? '')));
    expect(guide.join('\n')).toContain(`Giữ nguyên tên file ${spec.body.filename}`);
    expect(guide.join('\n')).toContain('6A1, 6A2');
    // không chọn năm học thì dùng năm học đang hoạt động
    expect((await api('GET', '/api/admin/classes/import-spec')).body.year_label).toBe(YEAR);
  });

  test('nhập: nhận ra học sinh bằng mã hoặc họ tên + ngày sinh (không phân biệt hoa thường); trùng họ tên và ngày sinh phải điền mã; báo lỗi đúng dòng', async () => {
    const template = (await download(s.base, `/api/admin/classes/template?year_id=${A.year}`, A.token)).buffer;
    const { file, first } = await fill(template, [
      [codes.an, '', '', '', '6A1'],
      ['', 'PHAN KHẢ HÂN', '09/09/2015', 'Nữ', '6a1'],
      ['', 'Nguyễn Thiên Kim', '16/09/2015', 'Nữ', '6A2'],
      ['', 'Không Có Ai', '01/01/2015', '', '6A1'],
      ['', 'Lê Minh Hiển', '', '', '6A1'],
      [codes.hien, '', '', '', '9Z9'],
    ]);
    const name = classTemplateFilename(SCHOOL, YEAR);
    const preview = await upload(s.base, `/api/admin/classes/import?year_id=${A.year}`, name, file, A.token);
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ committed: false, total: 6, valid: 2, errors: 4 });
    expect(preview.body.rows.map((r: { row: number; status: string; full_name: string; errors: string[] }) => [r.row, r.status, r.full_name, r.errors])).toEqual([
      [first, 'ok', 'Trần Hoài An', []],
      [first + 1, 'ok', 'Phan Khả Hân', []],
      [first + 2, 'error', 'Nguyễn Thiên Kim', ['Có 2 học sinh cùng họ tên và ngày sinh; hãy điền mã học sinh']],
      [first + 3, 'error', 'Không Có Ai', ['Không có học sinh Không Có Ai sinh ngày 01/01/2015 (hoặc đang bị khóa)']],
      [first + 4, 'error', 'Lê Minh Hiển', ['Thiếu ngày sinh (hoặc mã học sinh) để nhận ra học sinh']],
      [first + 5, 'error', 'Lê Minh Hiển', ['Không có lớp "9Z9" đang hoạt động trong năm học đã chọn']],
    ]);
    const commit = await upload(s.base, `/api/admin/classes/import?commit=true&year_id=${A.year}`, name, file, A.token);
    expect(commit.body).toMatchObject({ committed: true, added: 2, errors: 4 });
    const cls = (await api('GET', `/api/admin/classes?year_id=${A.year}`)).body.items.find((c: { name: string }) => c.name === '6A1');
    expect((await api('GET', `/api/admin/classes/${cls.id}`)).body.members.map((m: { full_name: string }) => m.full_name).sort()).toEqual(['Phan Khả Hân', 'Trần Hoài An']);
    // nhập lại: học sinh đã ở trong lớp được bỏ qua
    expect((await upload(s.base, `/api/admin/classes/import?commit=true&year_id=${A.year}`, name, file, A.token)).body).toMatchObject({ added: 0 });
  });

  test('chỉ nhận đúng file: sai tên file, file của trường khác (kể cả đổi tên cho khớp), file của năm học khác, file mẫu học sinh đều bị từ chối', async () => {
    const template = (await download(s.base, `/api/admin/classes/template?year_id=${A.year}`, A.token)).buffer;
    const { file } = await fill(template, [[codes.an, '', '', '', '6A1']]);
    const wrongName = await upload(s.base, `/api/admin/classes/import?year_id=${A.year}`, 'mau-phan-lop.xlsx', file, A.token);
    expect(wrongName.status).toBe(400);
    expect(wrongName.body.detail).toContain(`Sai tên file. Chỉ nhận ${classTemplateFilename(SCHOOL, YEAR)}`);
    const otherSchool = await upload(s.base, `/api/admin/classes/import?year_id=${B.year}`, classTemplateFilename(OTHER, YEAR), file, B.token);
    expect(otherSchool.status).toBe(400);
    expect(otherSchool.body.detail).toContain(`File này của trường khác (${SCHOOL}`);
    const otherYear = await upload(s.base, `/api/admin/classes/import?year_id=${A.next}`, classTemplateFilename(SCHOOL, '2027-2028'), file, A.token);
    expect(otherYear.status).toBe(400);
    expect(otherYear.body.detail).toContain(`File mẫu này của năm học ${YEAR}, đang xếp lớp năm học 2027-2028`);
    const students = (await download(s.base, '/api/admin/students/template', A.token)).buffer;
    const memberFile = await upload(s.base, `/api/admin/classes/import?year_id=${A.year}`, classTemplateFilename(SCHOOL, YEAR), students, A.token);
    expect(memberFile.status).toBe(400);
    expect(memberFile.body.detail).toContain('Đây là file mẫu học sinh, không phải file xếp lớp');
    expect(studentTemplateFilename(SCHOOL)).not.toBe(classTemplateFilename(SCHOOL, YEAR));
  });
});
