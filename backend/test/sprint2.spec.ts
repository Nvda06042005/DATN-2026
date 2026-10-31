/**
 * Sprint 2, phần quản trị viên trường học (HK.QT.010–040): thông tin trường, năm học, khối lớp, giáo viên, học sinh, lớp học,
 * nhập/xuất Excel có xem trước, nhân bản lớp sang năm học mới. HTTP thật trên PostgreSQL tạm; email chỉ ghi nhận trong bộ nhớ.
 */
import { activate, adminLogin, call, download, hasPostgres, makeXlsx, Started, startApp, upload } from './harness';
import type { MailService } from '../src/admin/mail.service';
import type { DatabaseService } from '../src/database/database.service';

let s: Started, db: DatabaseService, mail: MailService, root: string;
const PW = 'Matkhau-12345';
const api = (method: string, path: string, body?: unknown, token = root) => call(s.base, method, path, body, token);
const TEACHER_HEADER = ['Họ và tên *', 'Email *', 'Bộ môn', 'Số điện thoại', 'Mã giáo viên'];
const STUDENT_HEADER = ['Mã học sinh *', 'Họ và tên *', 'Ngày sinh *', 'Giới tính', 'Lớp', 'Email', 'Email phụ huynh'];

async function readRows(buffer: Buffer): Promise<string[][]> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const rows: string[][] = [];
  workbook.worksheets[0].eachRow((row) => rows.push((row.values as unknown[]).slice(1).map((v) => String(v ?? ''))));
  return rows;
}

(hasPostgres() ? describe : describe.skip)('Sprint 2 – quản trị viên trường học', () => {
  let A: { id: number; token: string }, B: { id: number; token: string };
  let y25: number, y26: number;
  const qa = (method: string, path: string, body?: unknown) => api(method, path, body, A.token);

  async function school(code: string, name: string, email: string) {
    const created = await api('POST', '/api/admin/schools', { school_code: code, name, admin: { full_name: `Quản Trị ${code}`, email } });
    const active = await activate(s.base, created.body.admin.username, created.body.temporary_password, PW, 'school_admin');
    return { id: created.body.school.id as number, token: active.token };
  }

  beforeAll(async () => {
    s = await startApp('sprint2_test');
    db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    mail = s.moduleRef.get((await import('../src/admin/mail.service')).MailService);
    root = await adminLogin(s.base);
    A = await school('8001', 'THCS Quản Lý A', 'qt8001@example.edu.vn');
    B = await school('8002', 'THCS Quản Lý B', 'qt8002@example.edu.vn');
  });
  afterAll(async () => { await s?.close(); });

  // ------------------------------------------------------------------ HK.QT.010–011
  test('HK.QT.010/011 xem và cập nhật thông tin trường; không tự đổi mã trường hay vô hiệu hóa trường', async () => {
    const view = await qa('GET', '/api/admin/school');
    expect(view.body).toMatchObject({ id: A.id, school_code: '8001', name: 'THCS Quản Lý A', is_active: true, counts: { admins: 1, teachers: 0, students: 0, classes: 0 }, current_year: null });
    const edited = await qa('PATCH', '/api/admin/school', {
      name: '  THCS   Quản Lý   A  (đã đổi) ', logo_url: 'https://example.edu.vn/logo.png', address: '12 Phố Thử, Hà Nội', contact_name: 'Thầy Hiệu Trưởng', contact_email: 'HieuTruong@Example.edu.vn', contact_phone: '024 1234 5678',
      school_code: '9999', is_active: false,
    });
    expect(edited.body).toMatchObject({ school_code: '8001', is_active: true, name: 'THCS Quản Lý A (đã đổi)', logo_url: 'https://example.edu.vn/logo.png', address: '12 Phố Thử, Hà Nội', contact_email: 'hieutruong@example.edu.vn' });
    expect((await qa('PATCH', '/api/admin/school', { logo_url: 'http://khong-https/logo.png' })).status).toBe(422);
    expect((await qa('PATCH', '/api/admin/school', { name: 'A' })).status).toBe(422);
    expect((await qa('PATCH', '/api/admin/school', { contact_email: 'khong-phai-email' })).status).toBe(422);
  });

  // ------------------------------------------------------------------ HK.QT.012
  test('HK.QT.012 năm học: thêm, sửa, kích hoạt (một năm hoạt động), kết thúc; năm đã kết thúc không sửa được', async () => {
    for (const bad of [{ label: '2025-2027' }, { label: '2025/2026' }, { label: '2025-2026', starts_on: '2026-06-01' }]) {
      expect([JSON.stringify(bad), (await qa('POST', '/api/admin/school-years', { starts_on: '2025-09-05', ends_on: '2026-05-31', ...bad })).status]).toEqual([JSON.stringify(bad), bad.starts_on ? 422 : 422]);
    }
    const first = await qa('POST', '/api/admin/school-years', { label: '2025-2026', starts_on: '2025-09-05', ends_on: '2026-05-31' });
    expect(first.status).toBe(201);
    y25 = first.body.id;
    expect(first.body.status).toBe('planned');
    expect((await qa('POST', '/api/admin/school-years', { label: '2025-2026', starts_on: '2025-09-05', ends_on: '2026-05-31' })).status).toBe(409);
    const second = await qa('POST', '/api/admin/school-years', { label: '2026-2027', starts_on: '2026-09-05', ends_on: '2027-05-31' });
    y26 = second.body.id;
    expect((await qa('PATCH', `/api/admin/school-years/${y26}`, { ends_on: '2027-06-15' })).body.ends_on).toBe('2027-06-15');
    expect((await qa('PATCH', `/api/admin/school-years/${y26}`, { starts_on: '2027-07-01' })).status).toBe(422);
    expect((await qa('POST', `/api/admin/school-years/${y25}/activate`)).body.status).toBe('active');
    const conflict = await qa('POST', `/api/admin/school-years/${y26}/activate`);
    expect(conflict.status).toBe(409);
    expect(conflict.body.detail).toContain('2025-2026');
    expect((await qa('POST', `/api/admin/school-years/${y26}/end`)).status).toBe(409); // chỉ kết thúc năm đang hoạt động
    // Khối của năm đầu tiên là 6–9; năm sau chép từ năm trước
    expect((await qa('GET', `/api/admin/school-grades?year_id=${y25}`)).body.grades.map((g: any) => g.grade)).toEqual([6, 7, 8, 9]);
    expect((await qa('GET', `/api/admin/school-grades?year_id=${y26}`)).body.grades.map((g: any) => [g.grade, g.is_active])).toEqual([[6, true], [7, true], [8, true], [9, true]]);
    expect((await qa('GET', '/api/admin/school-years')).body.map((y: any) => [y.label, y.status])).toEqual([['2026-2027', 'planned'], ['2025-2026', 'active']]);
    // Năm học của trường khác không đọc/sửa được
    expect((await call(s.base, 'POST', `/api/admin/school-years/${y25}/end`, undefined, B.token)).status).toBe(404);
    expect((await call(s.base, 'GET', `/api/admin/school-grades?year_id=${y25}`, undefined, B.token)).status).toBe(404);
  });

  // ------------------------------------------------------------------ HK.QT.013
  test('HK.QT.013 khối lớp: tắt/bật/xóa khối; không tạo lớp ở khối chưa bật; không tắt hoặc xóa khối còn lớp', async () => {
    expect((await qa('PUT', '/api/admin/school-grades', { year_id: y25, grade: 6, is_active: false })).body).toMatchObject({ grade: 6, is_active: false });
    const blocked = await qa('POST', '/api/admin/classes', { year_id: y25, grade: 6, name: '6A1' });
    expect(blocked.status).toBe(409);
    expect(blocked.body.detail).toContain('Khối 6 chưa được bật');
    await qa('PUT', '/api/admin/school-grades', { year_id: y25, grade: 6, is_active: true });
    expect((await qa('POST', '/api/admin/classes', { year_id: y25, grade: 6, name: '6A1' })).status).toBe(201);
    expect((await qa('PUT', '/api/admin/school-grades', { year_id: y25, grade: 6, is_active: false })).status).toBe(409);
    expect((await call(s.base, 'DELETE', `/api/admin/school-grades?year_id=${y25}&grade=6`, undefined, A.token)).status).toBe(409);
    expect((await call(s.base, 'DELETE', `/api/admin/school-grades?year_id=${y25}&grade=9`, undefined, A.token)).status).toBe(204);
    expect((await qa('GET', `/api/admin/school-grades?year_id=${y25}`)).body.grades.map((g: any) => g.grade)).toEqual([6, 7, 8]);
    expect((await call(s.base, 'DELETE', `/api/admin/school-grades?year_id=${y25}&grade=9`, undefined, A.token)).status).toBe(404);
    expect((await qa('PUT', '/api/admin/school-grades', { year_id: y25, grade: 10, is_active: true })).status).toBe(422);
    await qa('PUT', '/api/admin/school-grades', { year_id: y25, grade: 9, is_active: true });
  });

  // ------------------------------------------------------------------ HK.QT.014–016, 018–021, 023
  test('HK.QT.014–016/018–021 giáo viên: thêm (mật khẩu tạm + email), tìm/lọc, sửa, khóa/mở khóa, đặt lại mật khẩu, xóa khi chưa có dữ liệu', async () => {
    const created = await qa('POST', '/api/admin/teachers', { full_name: '  Nguyễn  Văn  Sử ', email: 'Su.Nguyen@Example.edu.vn', subject: 'Lịch sử', phone: '0901 234 567', user_code: 'GV01' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ user: { role: 'teacher', full_name: 'Nguyễn Văn Sử', email: 'su.nguyen@example.edu.vn', subject: 'Lịch sử', school_id: A.id, must_change_password: true }, mail: 'queued' });
    expect(created.body.temporary_password).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    await mail.tick();
    expect(mail.sent.find((m) => m.to === 'su.nguyen@example.edu.vn')?.text).toContain(created.body.temporary_password);
    await qa('POST', '/api/admin/teachers', { full_name: 'Trần Thị Địa', email: 'dia@example.edu.vn', subject: 'Địa lí' });
    for (const bad of [{ full_name: 'Thiếu Email' }, { full_name: 'Email Hỏng', email: 'khong-phai-email' }, { full_name: 'X', email: 'x@example.edu.vn' }, { full_name: 'Điện Thoại', email: 'dt@example.edu.vn', phone: 'abc' }]) {
      expect([JSON.stringify(bad), (await qa('POST', '/api/admin/teachers', bad)).status]).toEqual([JSON.stringify(bad), 422]);
    }
    expect((await qa('POST', '/api/admin/teachers', { full_name: 'Trùng Email', email: 'SU.NGUYEN@example.edu.vn' })).status).toBe(409);
    expect((await qa('POST', '/api/admin/teachers', { full_name: 'Trùng Mã', email: 'moi@example.edu.vn', user_code: 'gv01' })).status).toBe(409);
    expect((await call(s.base, 'POST', '/api/admin/teachers', { full_name: 'Trường B Cùng Mã', email: 'b.gv@example.edu.vn', user_code: 'GV01' }, B.token)).status).toBe(201); // mã trùng giữa các trường được phép

    const all = await qa('GET', '/api/admin/teachers');
    expect(all.body.items.map((t: any) => t.full_name)).toEqual(['Nguyễn Văn Sử', 'Trần Thị Địa']);
    expect(all.body.items.every((t: any) => t.role === 'teacher' && t.school_id === A.id && !('password_hash' in t))).toBe(true);
    expect((await qa('GET', '/api/admin/teachers?q=nguyen%20van%20su')).body.items).toHaveLength(1);
    expect((await qa('GET', '/api/admin/teachers?q=dia@example')).body.items).toHaveLength(1);
    expect((await qa('GET', '/api/admin/teachers?subject=lịch')).body.items.map((t: any) => t.subject)).toEqual(['Lịch sử']);

    const id = created.body.user.id;
    const edited = await qa('PATCH', `/api/admin/users/${id}`, { full_name: 'Nguyễn Văn Sử Mới', email: 'su.moi@example.edu.vn', subject: 'Lịch sử – Địa lí', phone: '0988 000 111' });
    expect(edited.body).toMatchObject({ full_name: 'Nguyễn Văn Sử Mới', email: 'su.moi@example.edu.vn', subject: 'Lịch sử – Địa lí', phone: '0988 000 111' });
    expect((await qa('PATCH', `/api/admin/users/${id}`, { email: 'dia@example.edu.vn' })).status).toBe(409);
    expect((await qa('PATCH', `/api/admin/users/${id}`, { email: null })).status).toBe(422);
    expect((await qa('GET', '/api/admin/teachers?q=su%20moi')).body.items).toHaveLength(1); // chuỗi tìm kiếm cập nhật theo tên mới
    expect((await call(s.base, 'PATCH', `/api/admin/users/${id}`, { full_name: 'Người Trường Khác' }, B.token)).status).toBe(404);

    const session = (await activate(s.base, created.body.user.username, created.body.temporary_password, PW, 'teacher')).token;
    expect((await qa('POST', `/api/admin/users/${id}/lock`, { locked: true, reason: 'Nghỉ việc' })).body.is_active).toBe(false);
    expect((await call(s.base, 'GET', '/api/auth/me', undefined, session)).status).toBe(401);
    expect((await qa('GET', '/api/admin/teachers?active=false')).body.items.map((t: any) => t.id)).toEqual([id]);
    await qa('POST', `/api/admin/users/${id}/lock`, { locked: false });
    const reset = await qa('POST', `/api/admin/users/${id}/reset-password`);
    expect(reset.body.user.must_change_password).toBe(true);
    const gone = await qa('DELETE', `/api/admin/users/${id}`);
    expect(gone.status).toBe(409); // đã đăng nhập nên chỉ khóa được
    const fresh = await qa('POST', '/api/admin/teachers', { full_name: 'Giáo Viên Xóa Được', email: 'xoa@example.edu.vn' });
    expect((await qa('DELETE', `/api/admin/users/${fresh.body.user.id}`)).status).toBe(204);
    // Quản trị trường không khóa/xóa được tài khoản quản trị hay chính mình
    const self = (await qa('GET', '/api/auth/me')).body;
    expect((await qa('POST', `/api/admin/users/${self.id}/lock`, { locked: true, reason: 'tự khóa' })).status).toBe(400);
  });

  test('HK.QT.017 nhập giáo viên từ Excel: xem trước báo lỗi từng dòng (trùng email, thiếu dữ liệu, sai định dạng) rồi lưu dòng hợp lệ', async () => {
    const file = await makeXlsx(TEACHER_HEADER, [
      ['Lê Văn Nhập Một', 'nhap1@example.edu.vn', 'Lịch sử', '0901 111 222', 'GV11'],
      ['Phạm Thị Nhập Hai', 'nhap2@example.edu.vn', 'Địa lí', '', 'GV12'],
      ['Trùng Trong File', 'NHAP1@example.edu.vn', '', '', ''],
      ['', 'thieu.ten@example.edu.vn', '', '', ''],
      ['Thiếu Email', '', '', '', ''],
      ['Email Hỏng', 'khong-phai-email', '', '', ''],
      ['Trùng Trong Trường', 'dia@example.edu.vn', '', '', ''],
      ['Điện Thoại Sai', 'dt.sai@example.edu.vn', '', 'abc', ''],
    ]);
    const preview = await upload(s.base, '/api/admin/teachers/import', 'giao-vien.xlsx', file, A.token);
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ committed: false, total: 8, valid: 2, errors: 6, created: 0, credentials: [] });
    expect(preview.body.rows.map((r: any) => [r.row, r.status])).toEqual([[2, 'ok'], [3, 'ok'], [4, 'error'], [5, 'error'], [6, 'error'], [7, 'error'], [8, 'error'], [9, 'error']]);
    expect(preview.body.rows[2].errors).toEqual(['Email trùng với dòng trước trong file']);
    expect(preview.body.rows[3].errors).toEqual(['Thiếu họ tên']);
    expect(preview.body.rows[6].errors[0]).toContain('đã được dùng cho một tài khoản khác');
    expect(await db.query("SELECT 1 FROM app_users WHERE email IN ('nhap1@example.edu.vn', 'nhap2@example.edu.vn')")).toHaveLength(0); // xem trước không lưu
    const commit = await upload(s.base, '/api/admin/teachers/import?commit=true', 'giao-vien.xlsx', file, A.token);
    expect(commit.body).toMatchObject({ committed: true, created: 2, errors: 6 });
    expect(commit.body.credentials.map((c: any) => c.email)).toEqual(['nhap1@example.edu.vn', 'nhap2@example.edu.vn']);
    expect(commit.body.credentials[0].password).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(await db.query("SELECT 1 FROM app_users WHERE role = 'teacher' AND email IN ('nhap1@example.edu.vn', 'nhap2@example.edu.vn')")).toHaveLength(2);
    // Chạy lại cùng file: hai dòng đầu giờ là trùng
    expect((await upload(s.base, '/api/admin/teachers/import?commit=true', 'giao-vien.xlsx', file, A.token)).body.created).toBe(0);
    // File sai: thiếu cột, đuôi sai, không phải xlsx
    expect((await upload(s.base, '/api/admin/teachers/import', 'x.xlsx', await makeXlsx(['Họ và tên *'], [['A B']]), A.token)).status).toBe(400);
    expect((await upload(s.base, '/api/admin/teachers/import', 'x.csv', Buffer.from('a,b'), A.token)).status).toBe(400);
    expect((await upload(s.base, '/api/admin/teachers/import', 'x.xlsx', Buffer.from('khong phai zip'), A.token)).status).toBe(400);
    const template = await download(s.base, '/api/admin/teachers/template', A.token);
    expect(template.status).toBe(200);
    expect((await readRows(template.buffer))[0]).toEqual(['Họ và tên *', 'Email *', 'Bộ môn', 'Số điện thoại', 'Mã giáo viên']);
  });

  test('HK.QT.023 xuất danh sách giáo viên ra Excel theo bộ lọc', async () => {
    const all = await readRows((await download(s.base, '/api/admin/teachers/export', A.token)).buffer);
    expect(all[0]).toEqual(['Họ và tên', 'Email', 'Bộ môn', 'Số điện thoại', 'Mã giáo viên', 'Lớp phụ trách', 'Trạng thái']);
    expect(all.length).toBe(1 + (await qa('GET', '/api/admin/teachers')).body.total);
    const filtered = await readRows((await download(s.base, '/api/admin/teachers/export?subject=Địa', A.token)).buffer);
    expect(filtered.slice(1).map((r) => r[0]).sort()).toEqual(['Nguyễn Văn Sử Mới', 'Phạm Thị Nhập Hai', 'Trần Thị Địa'].sort()); // bộ môn chứa "Địa"
  });

  // ------------------------------------------------------------------ HK.QT.035–040 (lớp) và HK.QT.022
  let c7a: { id: number; join_code: string }, c7b: { id: number }, t1: number, t2: number;
  test('HK.QT.036/022 tạo lớp theo năm học và khối, phân công một hoặc nhiều giáo viên; tên lớp không trùng trong năm; mã tham gia duy nhất', async () => {
    [t1, t2] = (await qa('GET', '/api/admin/teachers?q=nhap')).body.items.map((t: any) => t.id);
    const created = await qa('POST', '/api/admin/classes', { year_id: y25, grade: 7, name: '7A1', teacher_ids: [t1, t2], expected_size: 40, description: 'Lớp chọn' });
    expect(created.status).toBe(201);
    c7a = created.body;
    expect(created.body).toMatchObject({ name: '7A1', grade: 7, school_year: '2025-2026', is_active: true, join_open: true, expected_size: 40, students: 0, year_status: 'active' });
    expect(created.body.join_code).toMatch(/^[A-Z2-9]{6}$/);
    expect(created.body.teachers.map((t: any) => t.id).sort()).toEqual([t1, t2].sort());
    c7b = (await qa('POST', '/api/admin/classes', { year_id: y25, grade: 7, name: '7A2' })).body;
    expect(c7b).toMatchObject({ teachers: [], students: 0 });
    expect(new Set([c7a.join_code, (c7b as any).join_code]).size).toBe(2);
    expect((await qa('POST', '/api/admin/classes', { year_id: y25, grade: 7, name: ' 7a1 ' })).status).toBe(409);
    expect((await qa('POST', '/api/admin/classes', { year_id: y26, grade: 7, name: '7A1' })).status).toBe(201); // cùng tên ở năm khác được
    expect((await qa('POST', '/api/admin/classes', { year_id: y25, grade: 7, name: '7A3', teacher_ids: [(await qa('GET', '/api/auth/me')).body.id] })).status).toBe(422); // không phải giáo viên
    expect((await call(s.base, 'POST', '/api/admin/classes', { year_id: y25, grade: 7, name: '7A4', teacher_ids: [(await call(s.base, 'GET', '/api/admin/teachers', undefined, B.token)).body.items[0].id] }, A.token)).status).toBe(422); // giáo viên trường khác
    expect((await call(s.base, 'POST', '/api/admin/classes', { year_id: y25, grade: 7, name: '7A9' }, B.token)).status).toBe(404); // năm học của trường khác
    expect((await qa('POST', '/api/admin/classes', { year_id: y25, grade: 10, name: 'X' })).status).toBe(422);
  });

  test('HK.QT.035/037 xem danh sách lớp (lọc theo năm, khối, giáo viên, từ khóa) và sửa lớp, đổi giáo viên phụ trách', async () => {
    const list = await qa('GET', `/api/admin/classes?year_id=${y25}`);
    expect(list.body.items.map((c: any) => [c.name, c.teachers.length, c.students])).toEqual([['6A1', 0, 0], ['7A1', 2, 0], ['7A2', 0, 0]]);
    expect((await qa('GET', `/api/admin/classes?year_id=${y25}&grade=7&q=a2`)).body.items.map((c: any) => c.name)).toEqual(['7A2']);
    expect((await qa('GET', `/api/admin/classes?teacher_id=${t1}`)).body.items.map((c: any) => c.name)).toEqual(['7A1']);
    const edited = await qa('PATCH', `/api/admin/classes/${c7a.id}`, { name: '7A1 chọn', teacher_ids: [t1], expected_size: 35 });
    expect(edited.body).toMatchObject({ name: '7A1 chọn', expected_size: 35 });
    expect(edited.body.teachers.map((t: any) => t.id)).toEqual([t1]);
    await qa('PATCH', `/api/admin/classes/${c7a.id}`, { name: '7A1', teacher_ids: [t1, t2] });
    expect((await qa('PATCH', `/api/admin/classes/${c7a.id}`, { name: '7A2' })).status).toBe(409);
    const events = await qa('GET', `/api/admin/classes/${c7a.id}/events`);
    expect(events.body.map((e: any) => e.kind)).toEqual(expect.arrayContaining(['create', 'teachers', 'update', 'unassign', 'assign']));
    expect((await call(s.base, 'GET', `/api/admin/classes/${c7a.id}`, undefined, B.token)).status).toBe(404);
    expect((await call(s.base, 'PATCH', `/api/admin/classes/${c7a.id}`, { name: 'Hack' }, B.token)).status).toBe(404);
  });

  // ------------------------------------------------------------------ HK.QT.024–034
  let students: number[];
  test('HK.QT.024–028 học sinh: thêm (mã, ngày sinh, giới tính, lớp), mật khẩu tạm, tìm/lọc, sửa họ tên – ngày sinh – email phụ huynh', async () => {
    const s1 = await qa('POST', '/api/admin/students', { user_code: 'HS001', full_name: 'Nguyễn Văn Một', birth_date: '2013-03-15', gender: 'male', class_id: c7a.id, parent_email: 'PhuHuynh1@example.com' });
    expect(s1.status).toBe(201);
    expect(s1.body.user).toMatchObject({ role: 'student', user_code: 'HS001', birth_date: '2013-03-15', gender: 'male', grade: 7, school_year: '2025-2026', parent_email: 'phuhuynh1@example.com', must_change_password: true });
    expect(s1.body.mail).toBe('no_email');
    expect(s1.body.temporary_password).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    const s2 = await qa('POST', '/api/admin/students', { user_code: 'HS002', full_name: 'Trần Thị Hai', birth_date: '2013-07-20', gender: 'female', class_id: c7a.id, email: 'hs002@example.edu.vn' });
    const s3 = await qa('POST', '/api/admin/students', { user_code: 'HS003', full_name: 'Lê Văn Ba', birth_date: '2013-11-01', class_id: c7b.id });
    students = [s1.body.user.id, s2.body.user.id, s3.body.user.id];
    for (const bad of [{ full_name: 'Thiếu Mã', birth_date: '2013-01-01' }, { user_code: 'HS9', full_name: 'Thiếu Sinh' }, { user_code: 'HS9', full_name: 'Sinh Sai', birth_date: '15/03/2013' }, { user_code: 'HS9', full_name: 'Phụ Huynh Sai', birth_date: '2013-01-01', parent_email: 'x' }]) {
      expect([JSON.stringify(bad), (await qa('POST', '/api/admin/students', bad)).status]).toEqual([JSON.stringify(bad), 422]);
    }
    expect((await qa('POST', '/api/admin/students', { user_code: 'hs001', full_name: 'Trùng Mã', birth_date: '2013-01-01' })).status).toBe(409);
    expect((await qa('POST', '/api/admin/students', { user_code: 'HS777', full_name: 'Trùng Email', birth_date: '2013-01-01', email: 'HS002@example.edu.vn' })).status).toBe(409);
    expect((await qa('POST', '/api/admin/students', { user_code: 'HS778', full_name: 'Lớp Lạ', birth_date: '2013-01-01', class_id: 999999 })).status).toBe(404);
    expect((await call(s.base, 'POST', '/api/admin/students', { user_code: 'HS001', full_name: 'Học Sinh Trường B', birth_date: '2013-01-01' }, B.token)).status).toBe(201); // trùng mã khác trường

    expect((await qa('GET', '/api/admin/students')).body.items.map((x: any) => x.user_code)).toEqual(['HS003', 'HS001', 'HS002']); // theo họ tên
    expect((await qa('GET', '/api/admin/students?q=tran%20thi')).body.items.map((x: any) => x.user_code)).toEqual(['HS002']);
    expect((await qa('GET', '/api/admin/students?q=hs001')).body.items).toHaveLength(1);
    expect((await qa('GET', `/api/admin/students?class_id=${c7a.id}`)).body.items.map((x: any) => x.user_code)).toEqual(['HS001', 'HS002']);
    expect((await qa('GET', '/api/admin/students?grade=7')).body.total).toBe(3);
    expect((await qa('GET', '/api/admin/students?grade=8')).body.total).toBe(0);
    expect((await qa('GET', '/api/admin/students')).body.items.find((x: any) => x.user_code === 'HS001').classes.map((c: any) => c.name)).toEqual(['7A1']);

    const edited = await qa('PATCH', `/api/admin/users/${students[0]}`, { full_name: 'Nguyễn Văn Một (sửa)', birth_date: '2013-03-16', parent_email: 'moi@example.com' });
    expect(edited.body).toMatchObject({ full_name: 'Nguyễn Văn Một (sửa)', birth_date: '2013-03-16', parent_email: 'moi@example.com' });
    expect((await qa('PATCH', `/api/admin/users/${students[0]}`, { birth_date: '16/03/2013' })).status).toBe(422);
    expect((await qa('PATCH', `/api/admin/users/${students[0]}`, { user_code: 'HS002' })).status).toBe(409);
    expect((await qa('PATCH', `/api/admin/users/${students[0]}`, { school_id: B.id })).status).toBe(403); // quản trị trường không chuyển trường
  });

  test('HK.QT.029/030/031/032 chuyển lớp cùng khối giữ nguyên dữ liệu, khóa/mở khóa, đặt lại mật khẩu, xóa khi chưa có dữ liệu học', async () => {
    const [h1, h2, h3] = students;
    await qa('PATCH', `/api/admin/users/${h1}`, { full_name: 'Nguyễn Văn Một' });
    const moved = await qa('POST', '/api/admin/classes/transfer', { student_id: h1, from_class_id: c7a.id, to_class_id: c7b.id });
    expect(moved.body).toMatchObject({ moved: true, from: { students: 1 }, to: { students: 2 } });
    expect((await qa('GET', `/api/admin/students?class_id=${c7b.id}`)).body.items.map((x: any) => x.user_code)).toEqual(['HS003', 'HS001']);
    expect(await db.getById(h1)).toMatchObject({ user_code: 'HS001', birth_date: '2013-03-16', parent_email: 'moi@example.com' });
    const other = (await qa('POST', '/api/admin/classes', { year_id: y25, grade: 8, name: '8A1' })).body;
    expect((await qa('POST', '/api/admin/classes/transfer', { student_id: h1, from_class_id: c7b.id, to_class_id: other.id })).status).toBe(409); // khác khối
    expect((await qa('POST', '/api/admin/classes/transfer', { student_id: h1, from_class_id: c7b.id, to_class_id: c7b.id })).status).toBe(400);
    expect((await qa('POST', '/api/admin/classes/transfer', { student_id: h2, from_class_id: c7b.id, to_class_id: c7a.id })).status).toBe(404); // không ở lớp nguồn
    const bClass = await (async () => {
      const y = (await call(s.base, 'POST', '/api/admin/school-years', { label: '2025-2026', starts_on: '2025-09-05', ends_on: '2026-05-31' }, B.token)).body.id;
      return (await call(s.base, 'POST', '/api/admin/classes', { year_id: y, grade: 7, name: '7B' }, B.token)).body;
    })();
    expect((await qa('POST', '/api/admin/classes/transfer', { student_id: h1, from_class_id: c7b.id, to_class_id: bClass.id })).status).toBe(404); // lớp trường khác

    const session = (await activate(s.base, (await db.getById(h2))!.username, (await qa('POST', `/api/admin/users/${h2}/reset-password`)).body.temporary_password, PW, 'student')).token;
    expect((await qa('POST', `/api/admin/users/${h2}/lock`, { locked: true, reason: 'Nghỉ học tạm thời' })).body.lock_reason).toBe('Nghỉ học tạm thời');
    expect((await call(s.base, 'GET', '/api/auth/me', undefined, session)).status).toBe(401);
    expect((await qa('GET', '/api/admin/students?active=false')).body.items.map((x: any) => x.id)).toEqual([h2]);
    // Học sinh bị khóa không được xếp vào lớp mới
    expect((await qa('POST', `/api/admin/classes/${c7a.id}/members`, { student_ids: [h2] })).status).toBe(422);
    await qa('POST', `/api/admin/users/${h2}/lock`, { locked: false });
    const reset = await qa('POST', `/api/admin/users/${h3}/reset-password`);
    expect(reset.body).toMatchObject({ mail: 'no_email', user: { must_change_password: true } });
    expect((await qa('DELETE', `/api/admin/users/${h2}`)).status).toBe(409); // đã đăng nhập
    const fresh = await qa('POST', '/api/admin/students', { user_code: 'HS900', full_name: 'Học Sinh Xóa Được', birth_date: '2013-01-01', class_id: c7a.id });
    expect((await qa('DELETE', `/api/admin/users/${fresh.body.user.id}`)).status).toBe(204);
    expect(await db.query('SELECT 1 FROM app_class_members WHERE user_id = $1', [fresh.body.user.id])).toHaveLength(0);
    // Giáo viên không dùng được các route quản trị
    const gv = (await db.query<{ id: number }>("SELECT id FROM app_users WHERE email = 'nhap1@example.edu.vn'"))[0].id;
    const gvTemp = (await qa('POST', `/api/admin/users/${gv}/reset-password`)).body.temporary_password;
    const gvToken = (await activate(s.base, (await db.getById(gv))!.username, gvTemp, PW, 'teacher')).token;
    expect((await call(s.base, 'POST', `/api/admin/users/${h1}/lock`, { locked: true, reason: 'x' }, gvToken)).status).toBe(403);
  });

  test('HK.QT.027 nhập học sinh từ Excel: xem trước báo trùng mã, sai định dạng, lớp không có; lưu dòng hợp lệ kèm xếp lớp', async () => {
    const file = await makeXlsx(STUDENT_HEADER, [
      ['HS101', 'Đỗ Văn Một Trăm', '01/02/2013', 'Nam', '7A1', 'hs101@example.edu.vn', 'ph101@example.com'],
      ['HS102', 'Vũ Thị Một Không Hai', '2013-05-06', 'Nữ', '7a2', '', ''],
      ['HS101', 'Trùng Mã Trong File', '2013-01-01', '', '', '', ''],
      ['HS001', 'Trùng Mã Trong Trường', '2013-01-01', '', '', '', ''],
      ['HS103', 'Ngày Sinh Sai', '31/02/2013', '', '', '', ''],
      ['HS104', 'Giới Tính Sai', '2013-01-01', 'Robot', '', '', ''],
      ['HS105', 'Lớp Không Có', '2013-01-01', '', '9Z9', '', ''],
      ['', 'Thiếu Mã', '2013-01-01', '', '', '', ''],
      ['HS106', 'Email Học Sinh Trùng', '2013-01-01', '', '', 'hs002@example.edu.vn', ''],
      ['HS107', 'Không Lớp', '2013-01-01', '', '', '', ''],
    ]);
    const preview = await upload(s.base, `/api/admin/students/import?year_id=${y25}`, 'hoc-sinh.xlsx', file, A.token);
    expect(preview.body).toMatchObject({ committed: false, total: 10, valid: 3, errors: 7, year_id: y25 });
    expect(preview.body.rows.filter((r: any) => r.status === 'error').map((r: any) => r.errors[0])).toEqual([
      'Mã trùng với dòng trước trong file', 'Mã HS001 đã có trong trường', 'Ngày sinh sai định dạng (dd/mm/yyyy)', 'Giới tính phải là Nam, Nữ hoặc Khác',
      'Không có lớp "9Z9" trong năm học đã chọn', 'Thiếu mã học sinh', expect.stringContaining('hs002@example.edu.vn'),
    ]);
    expect(await db.query("SELECT 1 FROM app_users WHERE user_code IN ('HS101', 'HS102', 'HS107')")).toHaveLength(0);
    const commit = await upload(s.base, `/api/admin/students/import?commit=true&year_id=${y25}`, 'hoc-sinh.xlsx', file, A.token);
    expect(commit.body).toMatchObject({ committed: true, created: 3, errors: 7 });
    expect(commit.body.credentials).toHaveLength(3);
    const byCode = async (code: string) => (await qa('GET', `/api/admin/students?q=${code}`)).body.items[0];
    expect((await byCode('hs101')).classes.map((c: any) => c.name)).toEqual(['7A1']);
    expect((await byCode('hs102')).classes.map((c: any) => c.name)).toEqual(['7A2']);
    expect(await byCode('hs102')).toMatchObject({ gender: 'female', birth_date: '2013-05-06' });
    expect((await byCode('hs107')).classes).toEqual([]);
    await mail.tick();
    expect(mail.sent.find((m) => m.to === 'hs101@example.edu.vn')?.text).toContain(commit.body.credentials[0].password);
    // Năm học đã kết thúc: không nhập vào lớp của năm đó
    const template = await download(s.base, '/api/admin/students/template', A.token);
    expect((await readRows(template.buffer))[0]).toEqual(STUDENT_HEADER);
  });

  test('HK.QT.034 xuất danh sách học sinh ra Excel theo lớp', async () => {
    const rows = await readRows((await download(s.base, `/api/admin/students/export?class_id=${c7a.id}`, A.token)).buffer);
    expect(rows[0]).toEqual(['Mã học sinh', 'Họ và tên', 'Ngày sinh', 'Giới tính', 'Lớp', 'Email', 'Email phụ huynh', 'Trạng thái']);
    expect(rows.slice(1).map((r) => [r[0], r[4]]).sort()).toEqual([['HS002', '7A1'], ['HS101', '7A1']]);
  });

  // ------------------------------------------------------------------ HK.QT.038–040
  test('HK.QT.039 xếp nhiều học sinh vào lớp (chọn hoặc nhập Excel); học sinh đã có trong lớp được bỏ qua', async () => {
    const [h1] = students;
    const added = await qa('POST', `/api/admin/classes/${c7a.id}/members`, { student_ids: students });
    expect(added.body).toMatchObject({ added: 2, skipped: 1 }); // h2 đã ở 7A1; h1, h3 mới vào (học sinh thuộc nhiều lớp)
    expect((await qa('GET', '/api/admin/students?q=hs001')).body.items[0].classes.map((c: any) => c.name).sort()).toEqual(['7A1', '7A2']);
    const file = await makeXlsx(['Mã học sinh *', 'Lớp *'], [['HS107', '7A1'], ['HS107', '7A1'], ['HS999', '7A1'], ['HS107', '8Z'], ['', '7A1']]);
    const preview = await upload(s.base, `/api/admin/classes/import?year_id=${y25}`, 'phan-lop.xlsx', file, A.token);
    expect(preview.body).toMatchObject({ committed: false, total: 5, valid: 2, errors: 3 });
    const commit = await upload(s.base, `/api/admin/classes/import?commit=true&year_id=${y25}`, 'phan-lop.xlsx', file, A.token);
    expect(commit.body).toMatchObject({ added: 1, errors: 3 }); // dòng thứ hai trùng dòng đầu nên "đã có"
    expect(commit.body.rows[1].status).toBe('exists');
    expect((await qa('DELETE', `/api/admin/classes/${c7a.id}/members/${h1}`)).status).toBe(204);
    expect((await qa('DELETE', `/api/admin/classes/${c7a.id}/members/${h1}`)).status).toBe(404);
    expect((await qa('GET', `/api/admin/classes/${c7a.id}`)).body.members.map((m: any) => m.user_code).sort()).toEqual(['HS002', 'HS003', 'HS101', 'HS107']);
    expect((await readRows((await download(s.base, '/api/admin/classes/template', A.token)).buffer))[0]).toEqual(['Mã học sinh *', 'Lớp *']);
  });

  test('HK.QT.038 lớp đã có học sinh chỉ lưu trữ, lớp trống được xóa; lớp lưu trữ khôi phục được', async () => {
    const empty = (await qa('POST', '/api/admin/classes', { year_id: y25, grade: 6, name: '6A9' })).body;
    expect((await qa('DELETE', `/api/admin/classes/${empty.id}`)).status).toBe(204);
    expect(await db.query('SELECT 1 FROM app_classes WHERE id = $1', [empty.id])).toHaveLength(0);
    const used = await qa('DELETE', `/api/admin/classes/${c7a.id}`);
    expect(used.status).toBe(409);
    expect(used.body.detail).toContain('chỉ lưu trữ');
    const archived = await qa('POST', `/api/admin/classes/${c7b.id}/archive`, { archived: true });
    expect(archived.body).toMatchObject({ is_active: false });
    expect(archived.body.closed_at).toBeTruthy();
    expect((await qa('GET', `/api/admin/classes?year_id=${y25}&active=false`)).body.items.map((c: any) => c.name)).toEqual(['7A2']);
    expect((await qa('POST', `/api/admin/classes/${c7b.id}/members`, { student_ids: [students[0]] })).status).toBe(409);
    expect((await qa('POST', `/api/admin/classes/${c7b.id}/archive`, { archived: false })).body.is_active).toBe(true);
  });

  test('HK.QT.040 nhân bản lớp sang năm học mới (lên lớp): khối + 1, học sinh được chọn, giáo viên; lớp khối 9, trùng tên, khối chưa bật bị bỏ qua có lý do', async () => {
    const c9 = (await qa('POST', '/api/admin/classes', { year_id: y25, grade: 9, name: '9A1' })).body;
    const c8 = (await qa('POST', '/api/admin/classes', { year_id: y25, grade: 8, name: 'Lớp Chọn Tám', teacher_ids: [t1] })).body;
    await qa('POST', `/api/admin/classes/${c9.id}/members`, { student_ids: [students[2]] });
    const [hs101] = (await qa('GET', '/api/admin/students?q=hs101')).body.items;
    // Năm đích 2026-2027 đã có 7A1 (tạo ở bài trước) nên 6A1 → 7A1 bị bỏ qua; khối 9 kết thúc chương trình
    const dry = await qa('POST', '/api/admin/classes/clone', { from_year_id: y25, to_year_id: y26 });
    expect(dry.status).toBe(200);
    const names = dry.body.created.map((c: any) => `${c.from_class}→${c.name}`);
    expect(names).toEqual(expect.arrayContaining(['7A1→8A1', '7A2→8A2', '8A1→9A1', 'Lớp Chọn Tám→Lớp Chọn Tám'.replace('Lớp Chọn Tám→Lớp Chọn Tám', 'Lớp Chọn Tám→Lớp Chọn Tám')]));
    expect(dry.body.skipped).toEqual(expect.arrayContaining([
      { class: '6A1', reason: 'Lớp 7A1 đã có trong năm học 2026-2027' },
      { class: '9A1', reason: 'Khối 9 đã hoàn thành chương trình, không lên lớp' },
    ]));
    const eight = dry.body.created.find((c: any) => c.from_class === '7A1');
    expect(eight).toMatchObject({ name: '8A1', grade: 8, students: 4 });
    expect((await qa('GET', `/api/admin/students?q=hs101`)).body.items[0].classes.map((c: any) => [c.name, c.school_year]).sort()).toEqual([['7A1', '2025-2026'], ['8A1', '2026-2027']]);
    expect(await db.getById(hs101.id)).toMatchObject({ grade: 8, school_year: '2026-2027' });
    const clone = (await qa('GET', `/api/admin/classes/${eight.id}`)).body;
    expect(clone).toMatchObject({ school_year: '2026-2027', grade: 8, year_status: 'planned' });
    expect(clone.teachers.map((t: any) => t.id).sort()).toEqual([t1, t2].sort());
    expect(clone.join_code).not.toBe(c7a.join_code);
    expect((await qa('GET', `/api/admin/classes/${eight.id}/events`)).body.map((e: any) => e.kind)).toContain('clone');
    // Chạy lại: mọi lớp đã nhân bản nên bị bỏ qua, không tạo trùng
    const again = await qa('POST', '/api/admin/classes/clone', { from_year_id: y25, to_year_id: y26 });
    expect(again.body.created).toEqual([]);
    expect(again.body.skipped.length).toBeGreaterThan(0);
    // Chọn một lớp và một số học sinh, không lên lớp
    const selective = await qa('POST', '/api/admin/classes/clone', { from_year_id: y25, to_year_id: y26, class_ids: [c8.id], promote: false, copy_teachers: false, student_ids: [] });
    expect(selective.body.skipped).toEqual([{ class: 'Lớp Chọn Tám', reason: 'Lớp Lớp Chọn Tám đã có trong năm học 2026-2027' }]);
    expect((await qa('POST', '/api/admin/classes/clone', { from_year_id: y26, to_year_id: y25 })).status).toBe(409); // năm đích phải sau năm nguồn
    expect((await qa('POST', '/api/admin/classes/clone', { from_year_id: y25, to_year_id: y25 })).status).toBe(400);
    expect((await call(s.base, 'POST', '/api/admin/classes/clone', { from_year_id: y25, to_year_id: y26 }, B.token)).status).toBe(404);
  });

  test('HK.QT.012 kết thúc năm học: dữ liệu của năm đó (lớp, học sinh trong lớp) không sửa được nữa, năm mới vẫn làm việc bình thường', async () => {
    expect((await qa('POST', `/api/admin/school-years/${y25}/end`)).body).toMatchObject({ status: 'ended' });
    expect((await qa('POST', `/api/admin/school-years/${y25}/end`)).status).toBe(409);
    expect((await qa('PATCH', `/api/admin/school-years/${y25}`, { ends_on: '2026-06-30' })).status).toBe(409);
    expect((await qa('POST', `/api/admin/school-years/${y25}/activate`)).status).toBe(409);
    for (const [method, path, body] of [
      ['POST', '/api/admin/classes', { year_id: y25, grade: 7, name: '7Z' }],
      ['PATCH', `/api/admin/classes/${c7a.id}`, { name: '7A1 sửa' }],
      ['POST', `/api/admin/classes/${c7a.id}/archive`, { archived: true }],
      ['DELETE', `/api/admin/classes/${c7a.id}`, undefined],
      ['POST', `/api/admin/classes/${c7a.id}/members`, { student_ids: [students[1]] }],
      ['DELETE', `/api/admin/classes/${c7a.id}/members/${students[1]}`, undefined],
      ['POST', '/api/admin/students', { user_code: 'HS555', full_name: 'Vào Lớp Đã Đóng', birth_date: '2013-01-01', class_id: c7a.id }],
      ['PUT', '/api/admin/school-grades', { year_id: y25, grade: 7, is_active: false }],
    ] as Array<[string, string, unknown]>) {
      expect([method, path, (await qa(method, path, body)).status]).toEqual([method, path, 409]);
    }
    expect((await qa('GET', `/api/admin/classes/${c7a.id}`)).status).toBe(200); // vẫn xem được
    expect((await qa('POST', `/api/admin/school-years/${y26}/activate`)).body.status).toBe('active');
    expect((await qa('POST', '/api/admin/classes', { year_id: y26, grade: 7, name: '7M' })).status).toBe(201);
    // Học sinh không tham gia được lớp của năm đã kết thúc
    const student = (await qa('POST', '/api/admin/students', { user_code: 'HS556', full_name: 'Vào Lớp Cũ', birth_date: '2013-01-01' })).body;
    const token = (await activate(s.base, student.user.username, student.temporary_password, PW, 'student')).token;
    expect((await call(s.base, 'POST', '/api/student/join-class', { code: c7a.join_code }, token)).status).toBe(409);
  });

  test('cách ly dữ liệu theo trường: Row-Level Security chặn truy vấn thiếu điều kiện school_id', async () => {
    const dbService = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    expect(dbService.rlsReady).toBe(true);
    const own = await dbService.scoped(A.id, (q) => q<{ school_id: number }>('SELECT DISTINCT school_id FROM app_classes'));
    expect(own.map((r) => r.school_id)).toEqual([A.id]);
    const users = await dbService.scoped(B.id, (q) => q<{ school_id: number }>('SELECT DISTINCT school_id FROM app_users'));
    expect(users.map((r) => r.school_id)).toEqual([B.id]);
    expect(await dbService.scoped(B.id, (q) => q('SELECT * FROM app_class_teachers'))).toEqual([]);
    expect(await dbService.scoped(B.id, (q) => q('SELECT * FROM app_school_years WHERE school_id = $1', [A.id]))).toEqual([]);
    await expect(dbService.scoped(A.id, (q) => q('SELECT * FROM hist_figures'))).rejects.toThrow(); // vai trò theo trường không có quyền với kho lịch sử
    await expect(dbService.scoped(A.id, (q) => q('SELECT * FROM app_password_resets'))).rejects.toThrow();
  });
});
