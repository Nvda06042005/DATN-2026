/**
 * Xếp lớp từ Excel (HK.QT.039), mỗi lớp một file (yêu cầu 12/11/2026), trình bày như danh sách lớp in của nhà trường:
 * UBND phường / TRƯỜNG …, quốc hiệu, "DANH SÁCH HỌC SINH LỚP <ô Lớp>", "NĂM HỌC … · HỌC KỲ …"; ô Lớp, Học kỳ, Giáo viên phụ trách (mã · họ tên),
 * Sĩ số tự đếm; bảng STT, MÃ HỌC SINH, HỌ VÀ TÊN, NGÀY SINH, GIỚI TÍNH, LỚP. Khi nhập: chỉ nhận đúng file của trường và năm học; học sinh nhận ra
 * bằng mã hoặc họ tên + ngày sinh; lớp chưa có thì tạo; giáo viên phân công cho học kỳ đã chọn; sĩ số = số học sinh thực có.
 */
import { activate, adminLogin, call, download, hasPostgres, Started, startApp, upload } from './harness';
import { PW } from './fixture';
import { classTemplateFilename, CLASS_LIST_FIRST_ROW } from '../src/admin/excel';

const SCHOOL = 'THCS Giồng Ông Tố', OTHER = 'THCS Bình An', YEAR = '2026-2027';
const HEADER = ['STT', 'MÃ HỌC SINH', 'HỌ VÀ TÊN', 'NGÀY SINH', 'GIỚI TÍNH', 'LỚP'];

(hasPostgres() ? describe : describe.skip)('Xếp lớp từ Excel: mỗi lớp một file, theo trường và năm học', () => {
  let s: Started, root: string;
  let A: { token: string; year: number; next: number }, B: { token: string; year: number };
  const codes: Record<string, string> = {};
  let teacher = '', teacherId = 0;
  const api = (method: string, path: string, body?: unknown, token = A.token) => call(s.base, method, path, body, token);
  const open = async (buffer: Buffer) => { const w = new (await import('exceljs')).Workbook(); await w.xlsx.load(buffer as never); return w; };
  /** Điền ô Lớp, Học kỳ, Giáo viên và các dòng [Mã, Họ tên, Ngày sinh, Giới tính] như người dùng làm trong Excel */
  const fill = async (template: Buffer, head: { lop?: string; hk?: string; gv?: string }, rows: string[][]) => {
    const wb = await open(template), sheet = wb.getWorksheet('Xếp lớp')!;
    if (head.lop !== undefined) sheet.getCell('C11').value = head.lop;
    if (head.hk !== undefined) sheet.getCell('C12').value = head.hk;
    if (head.gv !== undefined) sheet.getCell('C13').value = head.gv;
    rows.forEach((values, i) => values.forEach((v, c) => { if (v) sheet.getRow(CLASS_LIST_FIRST_ROW + i).getCell(c + 2).value = v; }));
    return Buffer.from(await wb.xlsx.writeBuffer());
  };
  const classByName = async (name: string, year = A.year, token = A.token) => (await api('GET', `/api/admin/classes?year_id=${year}&limit=200`, undefined, token)).body.items.find((c: { name: string }) => c.name === name);

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
    B = await school(OTHER, 'qt.lop.b@example.invalid', 'Phường Bình An');
    for (const name of ['6A1', '6A2']) expect((await api('POST', '/api/admin/classes', { year_id: A.year, grade: 6, name })).status).toBe(201);
    const t = await api('POST', '/api/admin/teachers', { full_name: 'Nguyễn Văn Sử', email: 'su.gv@example.edu.vn', phone: '0901234567', birth_date: '1985-03-15' });
    teacherId = t.body.user.id;
    teacher = `${t.body.user.user_code} · Nguyễn Văn Sử`;
    // học sinh giống danh sách lớp của trường; hai em trùng cả họ tên lẫn ngày sinh
    const students: Array<[string, string, string, string]> = [
      ['an', 'Trần Hoài An', '2015-07-01', 'an.hs@example.edu.vn'],
      ['han', 'Phan Khả Hân', '2015-09-09', 'han.hs@example.edu.vn'],
      ['hien', 'Lê Minh Hiển', '2015-06-27', 'hien.hs@example.edu.vn'],
      ['kim1', 'Nguyễn Thiên Kim', '2015-09-16', 'kim1.hs@example.edu.vn'],
      ['kim2', 'Nguyễn Thiên Kim', '2015-09-16', 'kim2.hs@example.edu.vn'],
      ['huy', 'Trần Đức Huy', '2015-02-24', 'huy.hs@example.edu.vn'],
    ];
    for (const [key, full_name, birth_date, email] of students) {
      const made = await api('POST', '/api/admin/students', { full_name, birth_date, email, phone: '0901234567' });
      expect(made.status).toBe(201);
      codes[key] = made.body.user.user_code;
    }
  });
  afterAll(async () => { await s?.close(); });

  test('file mẫu như danh sách lớp của nhà trường: UBND phường / trường, quốc hiệu, tiêu đề theo ô Lớp, ô Học kỳ và Giáo viên (mã · họ tên), Sĩ số tự đếm', async () => {
    const spec = await api('GET', `/api/admin/classes/import-spec?year_id=${A.year}`);
    expect(spec.body).toMatchObject({ filename: classTemplateFilename(SCHOOL, YEAR), school_name: SCHOOL, year_label: YEAR, classes: ['6A1', '6A2'], semester: 1 });
    const raw = await fetch(`${s.base}/api/admin/classes/template?year_id=${A.year}`, { headers: { Authorization: `Bearer ${A.token}` } });
    expect(raw.headers.get('content-disposition')).toContain('file_mau_xep-lop_truong_giong-ong-to_2026-2027.xlsx');
    const wb = await open(Buffer.from(await raw.arrayBuffer())), sheet = wb.getWorksheet('Xếp lớp')!;
    expect(wb.worksheets.map((w) => [w.name, w.state])).toEqual([['Xếp lớp', 'visible'], ['Hướng dẫn', 'visible'], ['Danh mục', 'hidden']]);
    expect(sheet.getImages()).toHaveLength(1); // logo Đông A
    expect(String(sheet.getCell('A2').value)).toMatch(new RegExp(`^Mẫu xếp lớp năm học ${YEAR} · ${SCHOOL} · Mã trường \\S+$`));
    expect([sheet.getCell('A4').value, sheet.getCell('A5').value, sheet.getCell('D4').value, sheet.getCell('D5').value])
      .toEqual(['UBND PHƯỜNG THẠNH MỸ TÂY', 'TRƯỜNG THCS GIỒNG ÔNG TỐ', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 'Độc lập - Tự do - Hạnh phúc']);
    expect(String(sheet.getCell('D6').value)).toMatch(/^Thạnh Mỹ Tây, ngày \d{2} tháng \d{2} năm \d{4}$/);
    expect(sheet.getCell('A8').value).toMatchObject({ formula: expect.stringContaining('"DANH SÁCH HỌC SINH LỚP "&') });
    expect(sheet.getCell('A9').value).toMatchObject({ formula: expect.stringContaining(`"NĂM HỌC ${YEAR} · HỌC KỲ "&`) });
    expect([sheet.getCell('B11').value, sheet.getCell('B12').value, sheet.getCell('B13').value, sheet.getCell('B14').value]).toEqual(['Lớp *:', 'Học kỳ *:', 'Giáo viên phụ trách:', 'Sĩ số:']);
    expect(sheet.getCell('C12').value).toBe('1');
    expect(sheet.getCell('C12').dataValidation).toMatchObject({ type: 'list', formulae: ['"1,2"'] });
    expect(sheet.getCell('C13').dataValidation).toMatchObject({ type: 'list', formulae: ["'Danh mục'!$A$1:$A$1"] });
    expect(sheet.getCell('C11').dataValidation).toMatchObject({ type: 'list', formulae: ["'Danh mục'!$B$1:$B$2"] }); // gợi ý lớp đã có, không báo lỗi nên gõ lớp mới được
    expect(sheet.getCell('C11').dataValidation.showErrorMessage).toBeFalsy();
    expect(wb.getWorksheet('Danh mục')!.getCell('A1').value).toBe(teacher);
    expect((sheet.getRow(CLASS_LIST_FIRST_ROW - 1).values as unknown[]).slice(1)).toEqual(HEADER);
    const r = CLASS_LIST_FIRST_ROW;
    expect(sheet.getCell(r, 6).value).toMatchObject({ formula: expect.stringContaining('UPPER(TRIM($C$11))') }); // cột LỚP tự lấy theo ô Lớp
    expect(sheet.getCell(r, 4).numFmt).toBe('@');
    expect(sheet.getCell('C14').value).toMatchObject({ formula: expect.stringContaining('SUMPRODUCT') });
    const guide: string[] = []; wb.getWorksheet('Hướng dẫn')!.eachRow((row) => guide.push(String(row.getCell(1).value ?? '')));
    expect(guide.join('\n')).toContain('Mỗi lớp một file');
    expect(guide.join('\n')).toContain('học kỳ 1 và học kỳ 2');
  });

  test('nhập một lớp đã có: nhận ra bằng mã hoặc họ tên + ngày sinh, trùng tên phải điền mã; giáo viên được phân công học kỳ đã chọn; sĩ số = số học sinh thực có', async () => {
    const template = (await download(s.base, `/api/admin/classes/template?year_id=${A.year}`, A.token)).buffer;
    const file = await fill(template, { lop: '6a1', hk: '1', gv: teacher }, [
      [codes.an],
      ['', 'PHAN KHẢ HÂN', '09/09/2015', 'Nữ'],
      ['', 'Nguyễn Thiên Kim', '16/09/2015', 'Nữ'],
      ['', 'Không Có Ai', '01/01/2015'],
      ['', 'Lê Minh Hiển'],
    ]);
    const name = `${classTemplateFilename(SCHOOL, YEAR).replace(/\.xlsx$/, '')}_6A1.xlsx`; // mỗi lớp lưu một file, thêm tên lớp ở cuối
    const preview = await upload(s.base, `/api/admin/classes/import?year_id=${A.year}`, name, file, A.token);
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ committed: false, total: 5, valid: 2, errors: 3, semester: 1, teacher, classes: [{ name: '6A1', created: false, students: 2 }] });
    expect(preview.body.notes).toEqual([`Giáo viên phụ trách lớp 6A1 học kỳ 1: ${teacher}.`]);
    const first = CLASS_LIST_FIRST_ROW;
    expect(preview.body.rows.map((r: { row: number; status: string; full_name: string; class_name: string; errors: string[] }) => [r.row, r.status, r.full_name, r.class_name, r.errors])).toEqual([
      [first, 'ok', 'Trần Hoài An', '6A1', []],
      [first + 1, 'ok', 'Phan Khả Hân', '6A1', []],
      [first + 2, 'error', 'Nguyễn Thiên Kim', '6A1', ['Có 2 học sinh cùng họ tên và ngày sinh; hãy điền mã học sinh']],
      [first + 3, 'error', 'Không Có Ai', '6A1', ['Không có học sinh Không Có Ai sinh ngày 01/01/2015 (hoặc đang bị khóa)']],
      [first + 4, 'error', 'Lê Minh Hiển', '6A1', ['Thiếu ngày sinh (hoặc mã học sinh) để nhận ra học sinh']],
    ]);
    const commit = await upload(s.base, `/api/admin/classes/import?commit=true&year_id=${A.year}`, name, file, A.token);
    expect(commit.body).toMatchObject({ committed: true, added: 2, errors: 3, classes: [{ name: '6A1', created: false, students: 2 }] });
    const cls = await classByName('6A1');
    expect(cls).toMatchObject({ students: 2, expected_size: 2 }); // sĩ số = số học sinh thực có
    const detail = (await api('GET', `/api/admin/classes/${cls.id}?semester=1`)).body;
    expect(detail.members.map((m: { full_name: string }) => m.full_name).sort()).toEqual(['Phan Khả Hân', 'Trần Hoài An']);
    expect(detail.term_teachers.find((t: { semester: number }) => t.semester === 1)).toMatchObject({ teacher_id: teacherId });
    // nhập lại: học sinh đã ở trong lớp được bỏ qua, sĩ số không đổi
    expect((await upload(s.base, `/api/admin/classes/import?commit=true&year_id=${A.year}`, name, file, A.token)).body).toMatchObject({ added: 0, classes: [{ name: '6A1', students: 2 }] });
  });

  test('lớp chưa có thì tạo khi lưu (khối theo số đầu tên lớp), giáo viên phụ trách học kỳ 2; tên lớp sai khối hoặc thiếu ô Lớp bị báo lỗi', async () => {
    const template = (await download(s.base, `/api/admin/classes/template?year_id=${A.year}`, A.token)).buffer;
    const file = await fill(template, { lop: '6A5', hk: '2', gv: teacher }, [[codes.huy], [codes.hien]]);
    const name = classTemplateFilename(SCHOOL, YEAR);
    const preview = await upload(s.base, `/api/admin/classes/import?year_id=${A.year}`, name, file, A.token);
    expect(preview.body).toMatchObject({ valid: 2, errors: 0, semester: 2, classes: [{ name: '6A5', created: true, students: 2 }] });
    expect(preview.body.notes[0]).toBe(`Lớp 6A5 (khối 6) chưa có trong năm học ${YEAR}: sẽ được tạo khi lưu.`);
    expect(await classByName('6A5')).toBeUndefined(); // xem trước không tạo
    const commit = await upload(s.base, `/api/admin/classes/import?commit=true&year_id=${A.year}`, name, file, A.token);
    expect(commit.body).toMatchObject({ added: 2, classes: [{ name: '6A5', created: true, students: 2 }] });
    const cls = await classByName('6A5');
    expect(cls).toMatchObject({ grade: 6, students: 2, expected_size: 2 });
    const detail = (await api('GET', `/api/admin/classes/${cls.id}?semester=2`)).body;
    expect(detail.term_teachers.find((t: { semester: number }) => t.semester === 2)).toMatchObject({ teacher_id: teacherId });
    expect(detail.term_teachers.find((t: { semester: number }) => t.semester === 1)).toMatchObject({ teacher_id: null });
    // tên lớp không bắt đầu bằng khối 6–9, thiếu ô Lớp, học kỳ sai, giáo viên lạ
    const bad = await upload(s.base, `/api/admin/classes/import?year_id=${A.year}`, name, await fill(template, { lop: 'A1', hk: '1' }, [[codes.an]]), A.token);
    expect(bad.body.rows[0].errors).toEqual(['Tên lớp "A1" phải bắt đầu bằng khối 6–9, ví dụ 6A1']);
    const none = await upload(s.base, `/api/admin/classes/import?year_id=${A.year}`, name, await fill(template, { hk: '1' }, [[codes.an]]), A.token);
    expect(none.body.rows[0].errors).toEqual(['Thiếu tên lớp: gõ tên lớp ở ô Lớp đầu file']);
    const hk = await upload(s.base, `/api/admin/classes/import?year_id=${A.year}`, name, await fill(template, { lop: '6A1', hk: '3' }, [[codes.an]]), A.token);
    expect([hk.status, hk.body.detail]).toEqual([400, 'Ô Học kỳ chỉ nhận 1 hoặc 2 (một năm học có hai học kỳ)']);
    const gv = await upload(s.base, `/api/admin/classes/import?year_id=${A.year}`, name, await fill(template, { lop: '6A1', hk: '1', gv: 'GV000 · Không Có Thật' }, [[codes.an]]), A.token);
    expect(gv.status).toBe(400);
    expect(gv.body.detail).toContain('Không có giáo viên "GV000 · Không Có Thật" trong trường');
  });

  test('chỉ nhận đúng file: sai tên file, file của trường khác (kể cả đổi tên cho khớp), file của năm học khác, file mẫu học sinh đều bị từ chối', async () => {
    const template = (await download(s.base, `/api/admin/classes/template?year_id=${A.year}`, A.token)).buffer;
    const file = await fill(template, { lop: '6A1', hk: '1' }, [[codes.an]]);
    const wrongName = await upload(s.base, `/api/admin/classes/import?year_id=${A.year}`, 'mau-phan-lop.xlsx', file, A.token);
    expect(wrongName.status).toBe(400);
    expect(wrongName.body.detail).toContain('Sai tên file. Tên file phải bắt đầu bằng file_mau_xep-lop_truong_giong-ong-to_2026-2027');
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
  });
});
