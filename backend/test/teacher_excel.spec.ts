/**
 * Nhập danh sách giáo viên từ Excel và danh sách xuất theo bố cục chuẩn của Đông A: "Đông A", tên trường, ngày (tự cập nhật khi tải), rồi bảng
 * Số thứ tự, Mã giáo viên, Họ và tên, Giới tính (chọn Nam/Nữ), SĐT, Email, Ngày tháng năm sinh (ô ngày); không có Bộ môn (đã bỏ hẳn). Đầu file là logo ngang của Đông A (ảnh).
 * Hai cách thêm giáo viên: biểu mẫu "Thêm giáo viên" (từng người) và nhập file (hàng loạt).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { activate, adminLogin, call, download, hasPostgres, sql, Started, startApp, upload } from './harness';
import { brandLogo, BRAND_LOGO_SIZE, buildFormSheet, schoolInitials, vnDayLabel } from '../src/admin/excel';

const LOGO_FILE = join(__dirname, '..', 'assets', 'brand', 'dong-a-edu-lockup.png');


describe('Logo ở đầu file Excel', () => {
  const spec = { sheetName: 'Thử', title: 'Đông A', subtitle: 'Phụ đề', meta: [{ label: 'Ngày', value: 'x' }], columns: [{ key: 'a', header: 'Cột A', kind: 'text' as const }], blankRows: 2 };
  const load = async (buffer: Buffer) => { const wb = new (await import('exceljs')).Workbook(); await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]); return wb; };

  test('ảnh logo là PNG thật đúng kích thước, đọc được từ thư mục assets', () => {
    const file = readFileSync(LOGO_FILE);
    expect(file.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect([file.readUInt32BE(16), file.readUInt32BE(20)]).toEqual([BRAND_LOGO_SIZE.width * 3, BRAND_LOGO_SIZE.height * 3]); // vẽ ở 3 lần kích thước hiển thị cho nét
    expect(file[25]).toBe(6); // có kênh trong suốt: nền ô hiện qua logo
    expect(brandLogo()?.equals(file)).toBe(true);
  });

  test('phần viết tắt lấy tên riêng của trường, bỏ cấp học và dấu tiếng Việt', () => {
    expect(schoolInitials('THCS Giồng Ông Tố')).toBe('GOT');
    expect(schoolInitials('Trường Trung học cơ sở Nguyễn Văn Quy')).toBe('NVQ');
    expect(schoolInitials('THCS Phú Mỹ')).toBe('PM');
  });

  test('có logo thì đặt ảnh ở góc trên bên trái, không có ô chữ; không có ảnh thì dùng chữ thay thế', async () => {
    const withLogo = (await load(await buildFormSheet(spec))).getWorksheet('Thử')!;
    expect(withLogo.getCell('A1').value).toBeNull();
    expect(withLogo.getImages()).toHaveLength(1);
    expect(withLogo.getRow(1).height).toBe(46);
    const wbLogo = await load(await buildFormSheet(spec));
    const media = wbLogo.getImage(Number(wbLogo.getWorksheet('Thử')!.getImages()[0].imageId));
    expect(media.extension).toBe('png');
    expect(Buffer.from(media.buffer as ArrayBuffer).equals(readFileSync(LOGO_FILE))).toBe(true);
    const fallback = (await load(await buildFormSheet({ ...spec, logo: null }))).getWorksheet('Thử')!;
    expect(fallback.getCell('A1').value).toBe('Đông A');
    expect(fallback.getImages()).toHaveLength(0);
  });
});

const HEADER = ['Số thứ tự', 'Mã giáo viên', 'Họ và tên *', 'Giới tính', 'SĐT', 'Email *', 'Ngày tháng năm sinh'];

(hasPostgres() ? describe : describe.skip)('Giáo viên: mẫu Excel, nhập hàng loạt, xuất danh sách', () => {
  let s: Started, root: string, A: { id: number; token: string }, B: { id: number; token: string };
  const PW = 'Matkhau-12345';
  const api = (method: string, path: string, body?: unknown, token = A.token) => call(s.base, method, path, body, token);
  const ExcelJS = () => import('exceljs');
  const teacherFileName=async(token=A.token)=>(await api('GET','/api/admin/teachers/import-spec',undefined,token)).body.filename as string;

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
  /** Điền các dòng vào file mẫu đã tải (đúng như người dùng làm trong Excel) rồi lưu lại thành file tải lên */
  async function fill(template: Buffer, rows: Array<Array<string | Date | null>>): Promise<{ file: Buffer; first: number }> {
    const wb = await open(template);
    const sheet = wb.worksheets[0];
    let headerRow = 0;
    sheet.eachRow((row, n) => { if (!headerRow && (row.values as unknown[]).includes('Họ và tên *')) headerRow = n; });
    rows.forEach((values, i) => values.forEach((v, c) => { if (v !== null) sheet.getRow(headerRow + 1 + i).getCell(c + 2).value = v; })); // cột A là số thứ tự: để công thức tự hiện
    return { file: Buffer.from(await wb.xlsx.writeBuffer()), first: headerRow + 1 };
  }

  beforeAll(async () => {
    s = await startApp('teacher_excel_test');
    root = await adminLogin(s.base);
    A = await school('THCS Mẫu Excel', 'qt.excel.a@example.edu.vn');
    B = await school('THCS Trường Khác', 'qt.excel.b@example.edu.vn');
  });
  afterAll(async () => { await s?.close(); });

  test('file mẫu: Đông A, tên trường, ngày tự cập nhật, bảng đúng cột, ô chọn Nam/Nữ, ô ngày, số 0 đầu được giữ, có hướng dẫn', async () => {
    const before = vnDayLabel();
    const res = await download(s.base, '/api/admin/teachers/template', A.token);
    const after = vnDayLabel();
    expect(res.status).toBe(200);
    const wb = await open(res.buffer);
    const sheet = wb.getWorksheet('Giáo viên')!;
    expect(sheet.getCell('A1').value).toBeNull(); // logo ngang là ảnh, không phải chữ thường
    expect(sheet.getImages()).toHaveLength(1);
    expect(String(sheet.getCell('A2').value)).toBe('Mẫu nhập danh sách giáo viên · THCS Mẫu Excel');
    expect(sheet.getCell('B3').value).toBe('Ngày bắt đầu nhập:');
    expect([before, after]).toContain(sheet.getCell('C3').value); // ngày của lúc tải, dạng 08/11/2026 (Chủ Nhật)
    expect(String(sheet.getCell('C3').value)).toMatch(/^\d{2}\/\d{2}\/\d{4} \((Chủ Nhật|Thứ (Hai|Ba|Tư|Năm|Sáu|Bảy))\)$/);
    let headerRow = 0;
    sheet.eachRow((row, n) => { if (!headerRow && (row.values as unknown[]).includes('Họ và tên *')) headerRow = n; });
    expect(headerRow).toBe(11); // ví dụ riêng ở phía trên; bảng nhập thật bắt đầu dưới dòng tiêu đề này
    expect(sheet.getCell('A6').value).toContain('VÍ DỤ CÁCH ĐIỀN');
    expect(sheet.getCell('B8').value).toBe('ME' + vnDayLabel().slice(8,10) + '15031985001');
    expect(sheet.getCell('C8').value).toBe('Nguyễn Văn Mẫu');
    expect(sheet.getCell('G8').value).toBeInstanceOf(Date);
    expect(sheet.getCell('A9').value).toContain('15 + 03 + 1985');
    expect(sheet.getCell('A10').value).toBe('Điền họ tên, email và ngày sinh; nhấn Enter, STT và mã tự tính.');
    expect((sheet.getRow(headerRow).values as unknown[]).slice(1)).toEqual(HEADER);
    expect(HEADER).not.toContain('Bộ môn');
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: headerRow });
    // 1000 dòng định dạng sẵn: giới tính, ngày sinh, STT và mã tự ghép.
    for (const n of [headerRow + 1, headerRow + 1000]) {
      expect(sheet.getCell(n, 4).dataValidation).toMatchObject({ type: 'list', formulae: ['"Nam,Nữ"'], allowBlank: true, showErrorMessage: true });
      expect(sheet.getCell(n, 7).dataValidation).toMatchObject({ type: 'date', operator: 'between', allowBlank: true, showErrorMessage: true });
      expect(sheet.getCell(n, 7).numFmt).toBe('dd/mm/yyyy');
      expect(sheet.getCell(n, 5).numFmt).toBe('@');
      expect(sheet.getCell(n, 2).numFmt).toBe('@');
      expect(sheet.getCell(n, 1).value).toMatchObject({formula:expect.stringContaining('COUNTIFS(')});
      expect(sheet.getCell(n, 1).result).toBeFalsy();
      expect(sheet.getCell(n, 2).value).toMatchObject({ formula: expect.stringContaining('TEXT(G' + n + ',"ddmmyyyy")') });
    }
    expect(sheet.getCell(headerRow + 1001, 4).dataValidation).toBeFalsy();
    const guide = wb.getWorksheet('Hướng dẫn')!;
    const lines: string[] = [];
    guide.eachRow((row) => lines.push(String(row.getCell(1).value ?? '')));
    // hướng dẫn ngắn gọn: cách điền, mã, giữ tên file; không nói về công cụ lịch
    expect(lines.join('\n')).toContain('Giữ nguyên tên file');
    // ví dụ mã theo đúng trường đang tải (trường thử là "Mẫu Excel" nên viết tắt ME)
    expect(lines.join('\n')).toMatch(/Ví dụ: ME\d{2}15031985001\./);
    expect(lines.join('\n')).not.toMatch(/Vertex42|Office Store|tiện ích|Add-ins|Calculation Options|macro/);
    expect(lines.filter((l) => l && l !== 'Hướng dẫn').length).toBeLessThanOrEqual(6);
    // tải lại lần nữa ở trường khác: tên trường đổi theo trường của người tải
    const other = await open((await download(s.base, '/api/admin/teachers/template', B.token)).buffer);
    expect(String(other.getWorksheet('Giáo viên')!.getCell('A2').value)).toContain('THCS Trường Khác');
  });

  test('khối ví dụ không tạo tài khoản hoặc gửi thư khi tải nguyên mẫu lên', async () => {
    const before = await sql(s.url, 'SELECT count(*)::int AS n FROM app_users');
    const template = (await download(s.base, '/api/admin/teachers/template', A.token)).buffer;
    const res = await upload(s.base, '/api/admin/teachers/import?commit=true', await teacherFileName(), template, A.token);
    expect(res.status).toBe(400);
    expect(res.body.detail).toContain('không có dòng dữ liệu');
    expect(await sql(s.url, 'SELECT count(*)::int AS n FROM app_users')).toEqual(before);
    expect(await sql(s.url, "SELECT id FROM app_users WHERE email='giao.vien@example.invalid'")).toEqual([]);
  });

  test('mã chỉ hiện cho dòng hoàn tất, STT liên tiếp qua dòng trống; vẫn đọc mẫu cũ có STT công thức', async () => {
    const template = (await download(s.base, '/api/admin/teachers/template', A.token)).buffer;
    const wb = await open(template), sheet = wb.getWorksheet('Giáo viên')!;
    let first = 0;
    sheet.eachRow((row, n) => { if (!first && (row.values as unknown[]).includes('Họ và tên *')) first = n + 1; });
    for (const [n, name, email] of [[first,'Mẫu Tự Động Một','tu.dong.1@example.edu.vn'],[first+2,'Mẫu Tự Động Hai','tu.dong.2@example.edu.vn']] as const) {
      sheet.getCell(n,3).value=name; sheet.getCell(n,6).value=email;
      sheet.getCell(n,7).value=new Date('1985-03-15T00:00:00.000Z');
    }
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const preview = await upload(s.base, '/api/admin/teachers/import', await teacherFileName(), buffer, A.token);
    expect(preview.status).toBe(200);
    expect(preview.body.total).toBe(2);
    const prefix = 'ME' + vnDayLabel().slice(8,10);
    expect(preview.body.rows.map((r: {user_code:string})=>r.user_code)).toEqual([prefix+'15031985001',prefix+'15031985002']);
    const old = await open(buffer), oldSheet = old.getWorksheet('Giáo viên')!;
    for(const n of [first,first+2]) {
      oldSheet.getCell(n,1).value={formula:`IF(C${n}="","",COUNTIFS($C$${first}:C${n},"?*"))`,result:''};
      oldSheet.getCell(n,2).value={formula:`IF(AND(C${n}<>"",ISNUMBER(G${n})),"${prefix}"&TEXT(G${n},"ddmmyyyy")&TEXT(A${n},"000"),"")`,result:''};
    }
    const legacy = await upload(s.base,'/api/admin/teachers/import',await teacherFileName(),Buffer.from(await old.xlsx.writeBuffer()),A.token);
    expect(legacy.body.rows.map((r:{user_code:string})=>r.user_code)).toEqual([prefix+'15031985001',prefix+'15031985002']);
    const saved = await upload(s.base, '/api/admin/teachers/import?commit=true', await teacherFileName(), buffer, A.token);
    expect(saved.body.created).toBe(2);
    expect(saved.body.rows.map((r: {user_code:string})=>r.user_code)).toEqual(preview.body.rows.map((r:{user_code:string})=>r.user_code));
    const repeated = await upload(s.base, '/api/admin/teachers/import', await teacherFileName(), buffer, A.token);
    expect(repeated.body.errors).toBe(2);
    expect(repeated.body.rows.every((r:{errors:string[]})=>r.errors.some(e=>/đã được dùng|trùng/.test(e)))).toBe(true);
  });

  test('file đã lưu bằng Excel thật (công thức điền xuống được lưu dạng dùng chung) vẫn đọc ra đúng mã, giống file chưa gộp công thức', async () => {
    const template = (await download(s.base, '/api/admin/teachers/template', A.token)).buffer;
    const wb = await open(template), sheet = wb.getWorksheet('Giáo viên')!;
    let first = 0;
    sheet.eachRow((row, n) => { if (!first && (row.values as unknown[]).includes('Họ và tên *')) first = n + 1; });
    for (const [n, name, email] of [[first, 'Dùng Chung Một', 'dung.chung.1@example.edu.vn'], [first + 2, 'Dùng Chung Hai', 'dung.chung.2@example.edu.vn']] as const) {
      sheet.getCell(n, 3).value = name; sheet.getCell(n, 6).value = email; sheet.getCell(n, 7).value = new Date('1991-08-20T00:00:00.000Z');
    }
    const plain = Buffer.from(await wb.xlsx.writeBuffer());
    // Excel gộp các công thức giống nhau của một cột thành "công thức dùng chung": ô gốc giữ chữ công thức, các ô con chỉ trỏ về ô gốc
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(plain);
    const entry = 'xl/worksheets/sheet1.xml';
    let xml = await zip.file(entry)!.async('string');
    let si = 0;
    for (const col of ['A', 'B']) {
      let rows = 0;
      xml = xml.replace(new RegExp(`<c r="${col}(\\d+)"([^>]*)><f>([^<]*)</f>`, 'g'), (whole, row: string, attrs: string, formula: string) => {
        if (Number(row) < first) return whole;
        rows += 1;
        return rows === 1 ? `<c r="${col}${row}"${attrs}><f t="shared" ref="${col}${first}:${col}${first + 999}" si="${si}">${formula}</f>` : `<c r="${col}${row}"${attrs}><f t="shared" si="${si}"/>`;
      });
      expect(rows).toBe(1000);
      si += 1;
    }
    zip.file(entry, xml);
    const shared = Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
    expect(((await open(shared)).getWorksheet('Giáo viên')!.getCell(first + 2, 2).value as { sharedFormula?: string }).sharedFormula).toBe(`B${first}`);
    const control = await upload(s.base, '/api/admin/teachers/import', await teacherFileName(), plain, A.token);
    const preview = await upload(s.base, '/api/admin/teachers/import', await teacherFileName(), shared, A.token);
    expect(preview.status).toBe(200);
    const codes = preview.body.rows.map((r: { user_code: string }) => r.user_code);
    const prefix = 'ME' + vnDayLabel().slice(8, 10) + '20081991';
    expect(codes).toHaveLength(2);
    expect(codes.every((c: string) => c.startsWith(prefix))).toBe(true); // máy chủ tự cấp lại mã giáo viên từ bộ đếm của trường nên tiền tố luôn đúng
    expect(codes).toEqual(control.body.rows.map((r: { user_code: string }) => r.user_code)); // giống hệt khi không dùng công thức dùng chung
  });

  test('mã tự đổi tiền tố theo trường; ngày sinh dạng chữ dd/mm/yyyy hoặc ISO vẫn nhập đúng, ngày không tồn tại bị chặn', async () => {
    for(const [token,initials] of [[A.token,'ME'],[B.token,'TK']]) {
      const next=(await api('GET','/api/admin/registration-code/teacher',undefined,token)).body.serial;
      const template=(await download(s.base,'/api/admin/teachers/template',token)).buffer;
      const {file}=await fill(template,[[null,'Giáo viên Ngày Chữ',null,null,'ngay.chu@example.edu.vn','15/03/1985'],[null,'Giáo viên ISO',null,null,'ngay.iso@example.edu.vn','1985-03-15'],[null,'Giáo viên Ngày Sai',null,null,'ngay.sai.text@example.edu.vn','31/02/1985']]);
      const preview=await upload(s.base,'/api/admin/teachers/import',await teacherFileName(token),file,token);
      expect(preview.status).toBe(200);
      expect(preview.body).toMatchObject({valid:2,errors:1});
      const prefix=initials+vnDayLabel().slice(8,10);
      expect(preview.body.rows.slice(0,2).map((r:{user_code:string})=>r.user_code)).toEqual([prefix+'15031985'+String(next).padStart(3,'0'),prefix+'15031985'+String(next+1).padStart(3,'0')]);
      expect(preview.body.rows[2].errors).toContain('Ngày sinh sai định dạng (dd/mm/yyyy)');
    }
  });

  test('điền file mẫu rồi nhập: xem trước báo lỗi đúng số dòng trong Excel, lưu dòng hợp lệ, giới tính/ngày sinh/mã/số 0 đầu đúng', async () => {
    const template = (await download(s.base, '/api/admin/teachers/template', A.token)).buffer;
    const { file, first } = await fill(template, [
      ['GV101', 'Nguyễn Thị Hoa', 'Nữ', '0901234567', 'hoa.nguyen@example.edu.vn', new Date('1985-03-15T00:00:00.000Z')],
      ['GV102', 'Trần Văn Nam', 'Nam', null, 'nam.tran@example.edu.vn', '20/11/1979'],
      [null, 'Lê Không Giới Tính', null, null, 'khongsex@example.edu.vn', null],
      ['GV104', 'Giới Tính Sai', 'Khác', null, 'gioitinh@example.edu.vn', null],
      ['GV105', 'Ngày Sinh Sai', 'Nữ', null, 'ngaysai@example.edu.vn', 'không phải ngày'],
      ['GV106', 'Sinh Ở Tương Lai', 'Nam', null, 'tuonglai@example.edu.vn', new Date('2999-01-01T00:00:00.000Z')],
      ['GV107', 'Thiếu Email', 'Nam', null, null, null],
    ]);
    const preview = await upload(s.base, '/api/admin/teachers/import', await teacherFileName(), file, A.token);
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ committed: false, total: 7, valid: 3, errors: 4, created: 0 });
    expect(preview.body.rows.map((r: { row: number; status: string }) => [r.row, r.status])).toEqual([[first, 'ok'], [first + 1, 'ok'], [first + 2, 'ok'], [first + 3, 'error'], [first + 4, 'error'], [first + 5, 'error'], [first + 6, 'error']]);
    expect(preview.body.rows[3].errors).toEqual(['Giới tính phải là Nam hoặc Nữ']);
    expect(preview.body.rows[4].errors).toEqual(['Ngày sinh sai định dạng (dd/mm/yyyy)']);
    expect(preview.body.rows[5].errors).toEqual(['Ngày sinh không được ở tương lai']);
    expect(preview.body.rows[6].errors).toEqual(['Thiếu email']);
    expect(await sql(s.url, "SELECT 1 FROM app_users WHERE email = 'hoa.nguyen@example.edu.vn'")).toEqual([]); // xem trước không lưu
    const commit = await upload(s.base, '/api/admin/teachers/import?commit=true', await teacherFileName(), file, A.token);
    expect(commit.body).toMatchObject({ committed: true, created: 3, errors: 4 });
    const saved = await sql<{ full_name: string; user_code: string | null; gender: string | null; birth_date: string | null; phone: string | null; school_id: number }>(s.url,
      "SELECT full_name, user_code, gender, birth_date::text AS birth_date, phone, school_id FROM app_users WHERE role = 'teacher' AND email IN ('hoa.nguyen@example.edu.vn','nam.tran@example.edu.vn','khongsex@example.edu.vn') AND school_id = " + A.id + ' ORDER BY id');
    expect(saved).toEqual([
      { full_name: 'Nguyễn Thị Hoa', user_code: preview.body.rows[0].user_code, gender: 'female', birth_date: '1985-03-15', phone: '0901234567', school_id: A.id },
      { full_name: 'Trần Văn Nam', user_code: preview.body.rows[1].user_code, gender: 'male', birth_date: '1979-11-20', phone: null, school_id: A.id },
      { full_name: 'Lê Không Giới Tính', user_code: expect.stringMatching(/^GV\d{8}$/), gender: null, birth_date: null, phone: null, school_id: A.id },
    ]);
    expect(saved[0].user_code).toMatch(/^ME\d{2}15031985\d{3}$/);
    expect(saved[1].user_code).toMatch(/^ME\d{2}20111979\d{3}$/);
    // danh sách giáo viên của trường tự có người mới (trang Giáo viên tải lại danh sách sau khi lưu)
    const list = await api('GET', '/api/admin/teachers');
    expect(list.body.items.map((t: { full_name: string }) => t.full_name)).toEqual(expect.arrayContaining(['Nguyễn Thị Hoa', 'Trần Văn Nam', 'Lê Không Giới Tính']));
    // trường khác không thấy
    expect((await api('GET', '/api/admin/teachers', undefined, B.token)).body.items.map((t: { full_name: string }) => t.full_name)).not.toContain('Nguyễn Thị Hoa');
  });

  test('file cũ (tiêu đề ở dòng 1, có cột Bộ môn) vẫn nhập được; thiếu cột bắt buộc báo rõ cột nào; chỉ nhận .xlsx', async () => {
    const { makeXlsx } = await import('./harness');
    const legacy = await makeXlsx(['Họ và tên *', 'Email *', 'Bộ môn', 'Số điện thoại', 'Mã giáo viên'], [['Cô Cũ Địa Lí', 'co.cu@example.edu.vn', 'Địa lí', '0912345678', 'GV901']]);
    const ok = await upload(s.base, '/api/admin/teachers/import?commit=true', await teacherFileName(), legacy, A.token);
    expect(ok.body).toMatchObject({ created: 1, errors: 0 });
    expect((await sql(s.url, "SELECT column_name FROM information_schema.columns WHERE table_name = 'app_users' AND column_name = 'subject'"))).toEqual([]); // cột Bộ môn của file cũ bị bỏ qua, CSDL không còn cột này
    const missing = await upload(s.base, '/api/admin/teachers/import', await teacherFileName(), await makeXlsx(['Mã giáo viên', 'Giới tính'], [['GV1', 'Nam']]), A.token);
    expect(missing.status).toBe(400);
    expect(missing.body.detail).toBe('File thiếu cột bắt buộc: Họ và tên, Email. Hãy dùng đúng file mẫu.');
    for (const [name, content] of [['danh-sach.xls', Buffer.from('PK\u0003\u0004')], ['danh-sach.csv', Buffer.from('a,b')], ['ghi-chu.pdf', Buffer.from('%PDF-1.4')], ['anh.png', Buffer.from('PNG')], ['gia.xlsx', Buffer.from('khong phai zip')]] as const) {
      const res = await upload(s.base, '/api/admin/teachers/import', name, content, A.token);
      expect([name, res.status]).toEqual([name, 400]);
      expect(res.body.detail).toMatch(/Chỉ nhận file Excel \.xlsx/);
    }
    expect((await upload(s.base, '/api/admin/teachers/import', 'to.xlsx', Buffer.alloc(2 * 1024 * 1024 + 10, 1), A.token)).status).toBe(413);
  });

  test('danh sách xuất cùng bố cục: Đông A, trường, ngày xuất, số giáo viên, bảng cùng cột (thêm Lớp phụ trách, Trạng thái), giới tính và ngày sinh; nhập lại được', async () => {
    const res = await download(s.base, '/api/admin/teachers/export', A.token);
    expect(res.status).toBe(200);
    const wb = await open(res.buffer);
    const sheet = wb.getWorksheet('Giáo viên')!;
    expect(sheet.getCell('A1').value).toBeNull();
    expect(sheet.getImages()).toHaveLength(1);
    expect(String(sheet.getCell('A2').value)).toBe('Danh sách giáo viên · THCS Mẫu Excel');
    expect(sheet.getCell('B3').value).toBe('Ngày xuất:');
    expect(String(sheet.getCell('C3').value)).toMatch(/^\d{2}\/\d{2}\/\d{4} \(/);
    expect(sheet.getCell('B4').value).toBe('Số giáo viên:');
    const total = (await api('GET', '/api/admin/teachers')).body.total as number;
    expect(sheet.getCell('C4').value).toBe(String(total));
    let headerRow = 0;
    sheet.eachRow((row, n) => { if (!headerRow && (row.values as unknown[]).includes('Họ và tên')) headerRow = n; });
    expect((sheet.getRow(headerRow).values as unknown[]).slice(1)).toEqual(['Số thứ tự', 'Mã giáo viên', 'Họ và tên', 'Giới tính', 'SĐT', 'Email', 'Ngày tháng năm sinh', 'Lớp phụ trách', 'Trạng thái']);
    const rows: Array<Record<string, unknown>> = [];
    for (let n = headerRow + 1; n <= sheet.rowCount; n += 1) {
      const r = sheet.getRow(n);
      if (r.getCell(3).value) rows.push({ stt: r.getCell(1).value, code: r.getCell(2).value, name: r.getCell(3).value, gender: r.getCell(4).value, phone: r.getCell(5).value, email: r.getCell(6).value, born: r.getCell(7).value, status: r.getCell(9).value });
    }
    expect(rows).toHaveLength(total);
    expect(rows.map((r) => r.stt)).toEqual(rows.map((_, i) => i + 1));
    const hoa = rows.find((r) => r.name === 'Nguyễn Thị Hoa')!;
    expect(hoa).toMatchObject({ code: expect.stringMatching(/^ME\d{2}15031985\d{3}$/), gender: 'Nữ', phone: '0901234567', email: 'hoa.nguyen@example.edu.vn', status: 'Đang hoạt động' });
    expect((hoa.born as Date).toISOString().slice(0, 10)).toBe('1985-03-15');
    // file xuất tải lên lại ở trường khác: đọc đủ dòng (email đã dùng nên báo lỗi trùng, không phải lỗi định dạng file)
    const again = await upload(s.base, '/api/admin/teachers/import', await teacherFileName(B.token), res.buffer, B.token);
    expect(again.status).toBe(200);
    expect(again.body.total).toBe(total);
    expect(again.body.rows.every((r: { errors: string[] }) => r.errors.every((e) => /đã được dùng|trùng/i.test(e)))).toBe(true);
  });

  test('hai cách thêm giáo viên: biểu mẫu từng người (giới tính, ngày sinh; không có bộ môn) và nhập file hàng loạt; ngày sinh sai bị chặn; sửa được giới tính, ngày sinh', async () => {
    const one = await api('POST', '/api/admin/teachers', { full_name: 'Phạm Thị Từng Người', email: 'tung.nguoi@example.edu.vn', user_code: 'GV201', phone: '0933444555', gender: 'female', birth_date: '1990-07-01' });
    expect(one.status).toBe(201);
    expect(one.body.user).toMatchObject({ role: 'teacher', gender: 'female', birth_date: '1990-07-01', user_code: expect.stringMatching(/^ME\d{2}01071990\d{3}$/) });
    expect(one.body.user).not.toHaveProperty('subject');
    const withSubject = await api('POST', '/api/admin/teachers', { full_name: 'Gửi Bộ Môn', email: 'bo.mon.khac@example.edu.vn', subject: 'Địa lí' }); // bộ môn gửi lên bị bỏ qua
    expect(withSubject.status).toBe(201);
    expect(withSubject.body.user).not.toHaveProperty('subject');
    expect((await api('POST', '/api/admin/teachers', { full_name: 'Ngày Sai', email: 'ngay.sai@example.edu.vn', birth_date: '2999-01-01' })).status).toBe(422);
    expect((await api('POST', '/api/admin/teachers', { full_name: 'Ngày Sai Hai', email: 'ngay.sai2@example.edu.vn', birth_date: '1990-02-31' })).status).toBe(422);
    expect((await api('POST', '/api/admin/teachers', { full_name: 'Giới Tính Sai', email: 'gt.sai@example.edu.vn', gender: 'x' })).status).toBe(422);
    const id = one.body.user.id as number;
    const edited = await api('PATCH', `/api/admin/users/${id}`, { gender: 'male', birth_date: '1991-08-02' });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ gender: 'male', birth_date: '1991-08-02' });
    expect((await api('PATCH', `/api/admin/users/${id}`, { birth_date: '1991-13-45' })).status).toBe(422);
    const detail = await api('GET', `/api/admin/users/${id}`);
    expect(detail.body).toMatchObject({ gender: 'male', birth_date: '1991-08-02' });
  });
});
