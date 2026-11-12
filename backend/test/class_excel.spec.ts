/**
 * Xếp lớp từ Excel (HK.QT.039), yêu cầu 12/11/2026, trình bày như danh sách lớp in của nhà trường:
 * UBND phường / TRƯỜNG …, quốc hiệu, "<địa danh>, Thứ …, ngày …"; "DANH SÁCH HỌC SINH LỚP <ô Lớp>", "NĂM HỌC … · HỌC KỲ …";
 * ô Lớp, Khối (6–9), Học kỳ (1/2), Giáo viên phụ trách (mã · họ tên) bắt buộc, thiếu một ô là cả file bị báo lỗi; Sĩ số tự đếm;
 * bảng STT, MÃ HỌC SINH, HỌ VÀ TÊN, NGÀY SINH, GIỚI TÍNH (Nam/Nữ), LỚP; mã và họ tên chọn trong danh sách học sinh của trường.
 * Một file nhiều sheet (mỗi sheet một lớp) hoặc nhiều file. Lớp chưa có thì tạo; giáo viên phân công theo học kỳ; sĩ số = số học sinh thực có;
 * lưu xong lớp có mã tham gia DongA + lớp + giáo viên + HK + năm học, học sinh gõ hoa/thường, có/không dấu gạch đều vào được.
 */
import { activate, adminLogin, call, download, hasPostgres, makeXlsx, Started, startApp, upload } from './harness';
import { PW } from './fixture';
import { classTemplateFilename, CLASS_LIST_FIRST_ROW, joinCodeFor } from '../src/admin/excel';

const SCHOOL = 'THCS Giồng Ông Tố', OTHER = 'THCS Bình An', YEAR = '2026-2027';
const HEADER = ['STT', 'MÃ HỌC SINH', 'HỌ VÀ TÊN', 'NGÀY SINH', 'GIỚI TÍNH', 'LỚP'];

describe('mã tham gia theo quy ước', () => {
  test('DongA + lớp + giáo viên (tên đệm và tên, bỏ dấu) + HK + năm học', () => {
    expect(joinCodeFor('6A5', 'Nguyễn Đức Anh', 1, '2025-2026')).toBe('DongA6A5DucAnhHK12025-2026');
    expect(joinCodeFor('7A1', 'Trần Thị Mai Hoa', 2, '2026-2027')).toBe('DongA7A1ThiMaiHoaHK22026-2027');
    expect(joinCodeFor('6A9 (DK Tích hợp)', 'Lê Đức', 1, '2026-2027')).toBe('DongA6A9DKTichhopDucHK12026-2027');
  });
});

(hasPostgres() ? describe : describe.skip)('Xếp lớp từ Excel: mỗi sheet một lớp, đủ Lớp/Khối/Học kỳ/Giáo viên, mã tham gia theo quy ước', () => {
  let s: Started, root: string;
  let A: { token: string; year: number; next: number }, B: { token: string; year: number };
  const codes: Record<string, string> = {}, passwords: Record<string, string> = {};
  let teacher = '', teacherId = 0;
  const api = (method: string, path: string, body?: unknown, token = A.token) => call(s.base, method, path, body, token);
  const open = async (buffer: Buffer) => { const w = new (await import('exceljs')).Workbook(); await w.xlsx.load(buffer as never); return w; };
  type Head = { lop?: string; khoi?: string; hk?: string; gv?: string };
  const fillSheet = (sheet: import('exceljs').Worksheet, head: Head, rows: string[][]) => {
    if (head.lop !== undefined) sheet.getCell('C11').value = head.lop;
    if (head.khoi !== undefined) sheet.getCell('E11').value = head.khoi;
    if (head.hk !== undefined) sheet.getCell('C12').value = head.hk;
    if (head.gv !== undefined) sheet.getCell('C13').value = head.gv;
    rows.forEach((values, i) => values.forEach((v, c) => { if (v) sheet.getRow(CLASS_LIST_FIRST_ROW + i).getCell(c + 2).value = v; }));
  };
  /** Điền ô đầu file và các dòng [Mã, Họ tên, Ngày sinh, Giới tính] như người dùng làm trong Excel */
  const fill = async (template: Buffer, head: Head, rows: string[][]) => {
    const wb = await open(template);
    fillSheet(wb.getWorksheet('Xếp lớp')!, head, rows);
    return Buffer.from(await wb.xlsx.writeBuffer());
  };
  /** Sheet chép thêm trong cùng file (như Move or Copy → Create a copy): cùng dòng nhận diện, nhãn và bảng */
  const addSheet = (wb: import('exceljs').Workbook, name: string) => {
    const src = wb.getWorksheet('Xếp lớp')!, copy = wb.addWorksheet(name);
    copy.getCell('A2').value = src.getCell('A2').value;
    for (const [ref, text] of [['B11', 'Lớp *:'], ['D11', 'Khối *:'], ['B12', 'Học kỳ *:'], ['B13', 'Giáo viên phụ trách:']]) copy.getCell(ref).value = text;
    HEADER.forEach((h, i) => { copy.getCell(CLASS_LIST_FIRST_ROW - 1, i + 1).value = h; });
    return copy;
  };
  const template = async (year = A.year, token = A.token) => (await download(s.base, `/api/admin/classes/template?year_id=${year}`, token)).buffer;
  const classByName = async (name: string) => (await api('GET', `/api/admin/classes?year_id=${A.year}&limit=200`)).body.items.find((c: { name: string }) => c.name === name);
  const FILE = classTemplateFilename(SCHOOL, YEAR);

  beforeAll(async () => {
    s = await startApp('class_excel_test');
    root = await adminLogin(s.base);
    const school = async (name: string, email: string, region: string) => {
      const made = await call(s.base, 'POST', '/api/admin/schools', { name, region, city: 'Thành phố Hồ Chí Minh', admin: { full_name: 'Quản trị Lớp', email } }, root);
      if (made.status !== 201) throw new Error('tạo trường lỗi ' + JSON.stringify(made.body));
      const token = (await activate(s.base, made.body.admin.username, made.body.temporary_password, PW, 'school_admin')).token;
      const year = (await call(s.base, 'POST', '/api/admin/school-years', { label: YEAR, starts_on: '2026-09-05', ends_on: '2027-05-31' }, token)).body.id as number;
      await call(s.base, 'POST', `/api/admin/school-years/${year}/activate`, undefined, token);
      return { token, year };
    };
    const a = await school(SCHOOL, 'qt.lop.a@example.invalid', 'Phường Thạnh Mỹ Tây');
    const next = (await call(s.base, 'POST', '/api/admin/school-years', { label: '2027-2028', starts_on: '2027-09-05', ends_on: '2028-05-31' }, a.token)).body.id as number;
    A = { ...a, next };
    B = await school(OTHER, 'qt.lop.b@example.invalid', 'Quận 2');
    for (const name of ['6A1', '6A2']) expect((await api('POST', '/api/admin/classes', { year_id: A.year, grade: 6, name })).status).toBe(201);
    const t = await api('POST', '/api/admin/teachers', { full_name: 'Nguyễn Đức Anh', email: 'anh.gv@example.edu.vn', phone: '0901234567', birth_date: '1985-03-15' });
    teacherId = t.body.user.id;
    teacher = `${t.body.user.user_code} · Nguyễn Đức Anh`;
    // học sinh giống danh sách lớp của trường; hai em trùng cả họ tên lẫn ngày sinh
    const students: Array<[string, string, string, string, string]> = [
      ['an', 'Trần Hoài An', '2015-07-01', 'an.hs@example.edu.vn', 'female'],
      ['han', 'Phan Khả Hân', '2015-09-09', 'han.hs@example.edu.vn', 'female'],
      ['hien', 'Lê Minh Hiển', '2015-06-27', 'hien.hs@example.edu.vn', 'male'],
      ['kim1', 'Nguyễn Thiên Kim', '2015-09-16', 'kim1.hs@example.edu.vn', 'female'],
      ['kim2', 'Nguyễn Thiên Kim', '2015-09-16', 'kim2.hs@example.edu.vn', 'female'],
      ['huy', 'Trần Đức Huy', '2015-02-24', 'huy.hs@example.edu.vn', 'male'],
    ];
    for (const [key, full_name, birth_date, email, gender] of students) {
      const made = await api('POST', '/api/admin/students', { full_name, birth_date, email, gender, phone: '0901234567' });
      expect(made.status).toBe(201);
      codes[key] = made.body.user.user_code;
      passwords[key] = `${made.body.user.username}|${made.body.temporary_password}`;
    }
  });
  afterAll(async () => { await s?.close(); });

  test('file mẫu: quốc hiệu và "<địa danh>, Thứ …, ngày …"; ô Lớp, Khối (6–9), Học kỳ, Giáo viên (mã · họ tên); chọn mã học sinh thì họ tên, ngày sinh, giới tính tự hiện', async () => {
    const spec = await api('GET', `/api/admin/classes/import-spec?year_id=${A.year}`);
    expect(spec.body).toMatchObject({ filename: FILE, school_name: SCHOOL, year_label: YEAR, classes: ['6A1', '6A2'] });
    const raw = await fetch(`${s.base}/api/admin/classes/template?year_id=${A.year}`, { headers: { Authorization: `Bearer ${A.token}` } });
    expect(raw.headers.get('content-disposition')).toContain('file_mau_xep-lop_truong_giong-ong-to_2026-2027.xlsx');
    const wb = await open(Buffer.from(await raw.arrayBuffer())), sheet = wb.getWorksheet('Xếp lớp')!, catalog = wb.getWorksheet('Danh mục')!;
    expect(wb.worksheets.map((w) => [w.name, w.state])).toEqual([['Xếp lớp', 'visible'], ['Hướng dẫn', 'visible'], ['Danh mục', 'hidden']]);
    expect(String(sheet.getCell('A2').value)).toMatch(new RegExp(`^Mẫu xếp lớp năm học ${YEAR} · ${SCHOOL} · Mã trường \\S+$`));
    expect([sheet.getCell('A4').value, sheet.getCell('A5').value, sheet.getCell('D4').value, sheet.getCell('D5').value])
      .toEqual(['UBND PHƯỜNG THẠNH MỸ TÂY', 'TRƯỜNG THCS GIỒNG ÔNG TỐ', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 'Độc lập - Tự do - Hạnh phúc']);
    expect(String(sheet.getCell('D6').value)).toMatch(/^Thạnh Mỹ Tây, (Thứ (Hai|Ba|Tư|Năm|Sáu|Bảy)|Chủ Nhật), ngày \d{2} tháng \d{2} năm \d{4}$/);
    expect([sheet.getCell('B11').value, sheet.getCell('D11').value, sheet.getCell('B12').value, sheet.getCell('B13').value]).toEqual(['Lớp *:', 'Khối *:', 'Học kỳ *:', 'Giáo viên phụ trách:']);
    expect(sheet.getCell('E11').dataValidation).toMatchObject({ type: 'list', formulae: ['"6,7,8,9"'] });
    expect(sheet.getCell('C12').dataValidation).toMatchObject({ type: 'list', formulae: ['"1,2"'] });
    expect(sheet.getCell('C13').dataValidation).toMatchObject({ type: 'list', formulae: ["'Danh mục'!$A$1:$A$1"] });
    expect(catalog.getCell('A1').value).toBe(teacher);
    expect((sheet.getRow(CLASS_LIST_FIRST_ROW - 1).values as unknown[]).slice(1)).toEqual(HEADER);
    const r = CLASS_LIST_FIRST_ROW;
    expect(sheet.getCell(r, 2).dataValidation).toMatchObject({ type: 'list', formulae: ["'Danh mục'!$C$1:$C$6"] }); // chọn mã học sinh
    expect(sheet.getCell(r, 3).dataValidation?.type).toBeUndefined(); // họ và tên không có danh sách chọn riêng: tự hiện theo mã (13/11/2026)
    expect(sheet.getCell(r, 3).value).toMatchObject({ formula: expect.stringContaining(`MATCH($B${r},'Danh mục'!$C$1:$C$6,0)`) }); // chọn mã thì họ tên tự điền
    expect(sheet.getCell(r, 4).value).toMatchObject({ formula: expect.stringContaining("'Danh mục'!$E$1:$E$6") }); // ngày sinh tự điền
    expect(sheet.getCell(r, 5).value).toMatchObject({ formula: expect.stringContaining("'Danh mục'!$F$1:$F$6") }); // giới tính tự điền
    expect(sheet.getCell(r, 5).dataValidation).toMatchObject({ type: 'list', formulae: ['"Nam,Nữ"'] });
    expect(sheet.getCell(r, 6).value).toMatchObject({ formula: expect.stringContaining('UPPER(TRIM($C$11))') }); // cột LỚP tự lấy theo ô Lớp ở dòng có học sinh
    const an = [1, 2, 3, 4, 5, 6, 7].map((n) => catalog.getCell(n, 3).value).indexOf(codes.an) + 1;
    expect([catalog.getCell(an, 4).value, catalog.getCell(an, 5).value, catalog.getCell(an, 6).value]).toEqual(['Trần Hoài An', '01/07/2015', 'Nữ']);
    // trường ở Quận 2: giữ "Quận 2", không thành "2, ngày …"
    const other = (await open(await template(B.year, B.token))).getWorksheet('Xếp lớp')!;
    expect(String(other.getCell('D6').value)).toMatch(/^Quận 2, (Thứ \S+|Chủ Nhật), ngày /);
  });

  test('nhập một lớp: mã hoặc họ tên + ngày sinh; giáo viên phụ trách học kỳ; sĩ số thực có; mã tham gia DongA… và học sinh gõ mã kiểu nào cũng vào được', async () => {
    const file = await fill(await template(), { lop: '6a1', khoi: '6', hk: '1', gv: teacher }, [
      [codes.an],
      ['', 'PHAN KHẢ HÂN', '09/09/2015', 'Nữ'],
      ['', 'Nguyễn Thiên Kim', '16/09/2015', 'Nữ'],
      ['', 'Không Có Ai', '01/01/2015'],
      [codes.an],
    ]);
    const name = `${FILE.replace(/\.xlsx$/, '')}_6A1.xlsx`; // mỗi lớp lưu một file, thêm tên lớp ở cuối
    const preview = await upload(s.base, `/api/admin/classes/import?year_id=${A.year}`, name, file, A.token);
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ committed: false, total: 5, valid: 2, errors: 3, classes: [{ name: '6A1', created: false, students: 2, semester: 1, teacher }] });
    expect(preview.body.notes).toEqual([`Lớp 6A1: giáo viên phụ trách học kỳ 1 là ${teacher}.`]);
    const first = CLASS_LIST_FIRST_ROW;
    expect(preview.body.rows.map((r: { row: number; sheet: string; status: string; full_name: string; errors: string[] }) => [r.row, r.sheet, r.status, r.full_name, r.errors])).toEqual([
      [first, 'Lớp 6A1', 'ok', 'Trần Hoài An', []],
      [first + 1, 'Lớp 6A1', 'ok', 'Phan Khả Hân', []],
      [first + 2, 'Lớp 6A1', 'error', 'Nguyễn Thiên Kim', ['Có 2 học sinh cùng họ tên và ngày sinh; hãy điền mã học sinh']],
      [first + 3, 'Lớp 6A1', 'error', 'Không Có Ai', ['Không có học sinh Không Có Ai sinh ngày 01/01/2015 (hoặc đang bị khóa)']],
      [first + 4, 'Lớp 6A1', 'error', 'Trần Hoài An', ['Học sinh trùng với dòng trước trong lớp']],
    ]);
    const commit = await upload(s.base, `/api/admin/classes/import?commit=true&year_id=${A.year}`, name, file, A.token);
    const code = joinCodeFor('6A1', 'Nguyễn Đức Anh', 1, YEAR);
    expect(code).toBe('DongA6A1DucAnhHK12026-2027');
    expect(commit.body).toMatchObject({ committed: true, added: 2, errors: 3, classes: [{ name: '6A1', created: false, students: 2, join_code: code }] });
    expect(commit.body.notes).toContain(`Lớp 6A1: mã tham gia ${code}.`);
    const cls = await classByName('6A1');
    expect(cls).toMatchObject({ students: 2, expected_size: 2, join_code: code });
    const detail = (await api('GET', `/api/admin/classes/${cls.id}?semester=1`)).body;
    expect(detail.term_teachers.find((t: { semester: number }) => t.semester === 1)).toMatchObject({ teacher_id: teacherId });
    // học sinh gõ mã chữ thường, bỏ dấu gạch vẫn vào đúng lớp
    const [username, temp] = passwords.hien.split('|');
    const hien = (await activate(s.base, username, temp, PW, 'student')).token;
    const joined = await call(s.base, 'POST', '/api/student/join-class', { code: code.toLowerCase().replace(/-/g, '') }, hien);
    expect([joined.status, joined.body.name]).toEqual([200, '6A1']);
    // nhập lại: học sinh đã ở trong lớp được bỏ qua, mã giữ nguyên
    expect((await upload(s.base, `/api/admin/classes/import?commit=true&year_id=${A.year}`, name, file, A.token)).body).toMatchObject({ added: 0, classes: [{ name: '6A1', join_code: code }] });
  });

  test('một file nhiều sheet (mỗi sheet một lớp, mỗi lớp một giáo viên): lớp chưa có thì tạo; sheet chưa điền gì bỏ qua', async () => {
    const wb = await open(await template());
    fillSheet(wb.getWorksheet('Xếp lớp')!, { lop: '6A5', khoi: '6', hk: '2', gv: teacher }, [[codes.huy]]);
    fillSheet(addSheet(wb, 'Xếp lớp (2)'), { lop: '7A3', khoi: '7', hk: '1', gv: teacher }, [['', 'Lê Minh Hiển', '27/06/2015']]);
    addSheet(wb, 'Xếp lớp (3)'); // chép thêm nhưng chưa điền
    const file = Buffer.from(await wb.xlsx.writeBuffer());
    const preview = await upload(s.base, `/api/admin/classes/import?year_id=${A.year}`, FILE, file, A.token);
    expect(preview.body).toMatchObject({ valid: 2, errors: 0, classes: [{ name: '6A5', created: true, semester: 2 }, { name: '7A3', created: true, semester: 1 }] });
    expect(preview.body.rows.map((r: { sheet: string }) => r.sheet)).toEqual(['Lớp 6A5', 'Lớp 7A3']);
    expect(await classByName('6A5')).toBeUndefined(); // xem trước không tạo
    const commit = await upload(s.base, `/api/admin/classes/import?commit=true&year_id=${A.year}`, FILE, file, A.token);
    expect(commit.body).toMatchObject({ added: 2, classes: [{ name: '6A5', created: true, students: 1, join_code: joinCodeFor('6A5', 'Nguyễn Đức Anh', 2, YEAR) }, { name: '7A3', created: true, students: 1 }] });
    expect(await classByName('6A5')).toMatchObject({ grade: 6, students: 1, expected_size: 1, join_code: 'DongA6A5DucAnhHK22026-2027' });
    expect(await classByName('7A3')).toMatchObject({ grade: 7, students: 1, join_code: 'DongA7A3DucAnhHK12026-2027' }); // một giáo viên dạy nhiều lớp
  });

  test('thiếu một trong Lớp, Khối, Học kỳ, Giáo viên phụ trách là cả file báo lỗi; khối không khớp tên lớp, học kỳ sai, giáo viên lạ, sheet không có học sinh cũng báo lỗi', async () => {
    const t = await template();
    const full = { lop: '6A1', khoi: '6', hk: '1', gv: teacher };
    for (const [gap, missing] of [[{ lop: '' }, 'Lớp'], [{ khoi: '' }, 'Khối'], [{ hk: '' }, 'Học kỳ'], [{ gv: '' }, 'Giáo viên phụ trách']] as const) {
      const res = await upload(s.base, `/api/admin/classes/import?year_id=${A.year}`, FILE, await fill(t, { ...full, ...gap }, [[codes.han]]), A.token);
      expect([missing, res.status]).toEqual([missing, 400]);
      expect(res.body.detail).toContain(`thiếu ${missing}`);
      expect(res.body.detail).toContain('file chưa được nhập');
    }
    // hai sheet, sheet thứ hai thiếu giáo viên: cả file bị từ chối, không lưu sheet đầu
    const wb = await open(t);
    fillSheet(wb.getWorksheet('Xếp lớp')!, { lop: '6A7', khoi: '6', hk: '1', gv: teacher }, [[codes.han]]);
    fillSheet(addSheet(wb, 'Lớp 6A8'), { lop: '6A8', khoi: '6', hk: '1' }, [[codes.kim1]]);
    const two = await upload(s.base, `/api/admin/classes/import?commit=true&year_id=${A.year}`, FILE, Buffer.from(await wb.xlsx.writeBuffer()), A.token);
    expect(two.status).toBe(400);
    expect(two.body.detail).toBe('Sheet "Lớp 6A8" (lớp 6A8): thiếu Giáo viên phụ trách. Mỗi lớp phải điền đủ Lớp, Khối, Học kỳ và Giáo viên phụ trách; file chưa được nhập.');
    expect(await classByName('6A7')).toBeUndefined();
    const cases: Array<[Head, string]> = [
      [{ ...full, lop: '6A1', khoi: '7' }, 'lớp 6A1 không thuộc khối 7'],
      [{ ...full, khoi: '5' }, 'ô Khối chỉ nhận 6, 7, 8 hoặc 9'],
      [{ ...full, hk: '3' }, 'ô Học kỳ chỉ nhận 1 hoặc 2'],
      [{ ...full, gv: 'GV000 · Không Có Thật' }, 'không có giáo viên "GV000 · Không Có Thật" trong trường'],
    ];
    for (const [head, message] of cases) {
      const res = await upload(s.base, `/api/admin/classes/import?year_id=${A.year}`, FILE, await fill(t, head, [[codes.han]]), A.token);
      expect([message, res.status]).toEqual([message, 400]);
      expect(res.body.detail).toContain(message);
    }
    const empty = await upload(s.base, `/api/admin/classes/import?year_id=${A.year}`, FILE, await fill(t, full, []), A.token);
    expect([empty.status, empty.body.detail]).toEqual([400, 'Sheet "Xếp lớp" (lớp 6A1): chưa có học sinh nào trong danh sách.']);
  });

  test('chỉ nhận đúng file: sai tên file, file tự lập kiểu cũ, file của trường khác (kể cả đổi tên), file của năm học khác, file mẫu học sinh đều bị từ chối', async () => {
    const file = await fill(await template(), { lop: '6A1', khoi: '6', hk: '1', gv: teacher }, [[codes.an]]);
    const wrongName = await upload(s.base, `/api/admin/classes/import?year_id=${A.year}`, 'mau-phan-lop.xlsx', file, A.token);
    expect([wrongName.status, wrongName.body.detail]).toEqual([400, expect.stringContaining('Sai tên file. Tên file phải bắt đầu bằng file_mau_xep-lop_truong_giong-ong-to_2026-2027')]);
    const legacy = await upload(s.base, `/api/admin/classes/import?year_id=${A.year}`, FILE, await makeXlsx(['Mã học sinh *', 'Lớp *'], [[codes.an, '6A1']]), A.token);
    expect([legacy.status, legacy.body.detail]).toEqual([400, 'Không phải file mẫu xếp lớp của hệ thống. Hãy tải file mẫu xếp lớp năm học 2026-2027 rồi điền.']);
    const otherSchool = await upload(s.base, `/api/admin/classes/import?year_id=${B.year}`, classTemplateFilename(OTHER, YEAR), file, B.token);
    expect([otherSchool.status, otherSchool.body.detail]).toEqual([400, expect.stringContaining(`File này của trường khác (${SCHOOL}`)]);
    const otherYear = await upload(s.base, `/api/admin/classes/import?year_id=${A.next}`, classTemplateFilename(SCHOOL, '2027-2028'), file, A.token);
    expect([otherYear.status, otherYear.body.detail]).toEqual([400, expect.stringContaining(`File mẫu này của năm học ${YEAR}, đang xếp lớp năm học 2027-2028`)]);
    const students = (await download(s.base, '/api/admin/students/template', A.token)).buffer;
    const memberFile = await upload(s.base, `/api/admin/classes/import?year_id=${A.year}`, FILE, students, A.token);
    expect([memberFile.status, memberFile.body.detail]).toEqual([400, expect.stringContaining('Đây là file mẫu học sinh, không phải file xếp lớp')]);
  });
});
