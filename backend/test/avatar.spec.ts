/**
 * Ảnh đại diện tải lên (thay cho liên kết https dán tay): chỉ nhận ảnh, loại tệp xác định bằng nội dung thật, mỗi người một ảnh,
 * ảnh không lẫn vào hạn mức và thư viện ảnh Quiz. Chạy HTTP thật trên PostgreSQL tạm.
 */
import { activate, adminLogin, call, hasPostgres, sql, Started, startApp } from './harness';

const PW = 'Matkhau-12345';
const b64 = (bytes: Buffer) => bytes.toString('base64');
/** Tệp có chữ ký đúng của từng định dạng (đủ để máy chủ nhận dạng, không cần ảnh thật) */
const FILES: Record<string, Buffer> = {
  png: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]),
  jpeg: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 2)]),
  gif: Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(64, 3)]),
  webp: Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP'), Buffer.alloc(64, 4)]),
  // tệp Office mới (docx, xlsx, pptx) đều là ZIP "PK"; tệp Office cũ (doc, xls, ppt) là OLE; ngoài ra PDF, văn bản, mp4
  docx: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('[Content_Types].xml word/document.xml'), Buffer.alloc(64, 5)]),
  xlsx: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('[Content_Types].xml xl/workbook.xml'), Buffer.alloc(64, 6)]),
  pptx: Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('[Content_Types].xml ppt/presentation.xml'), Buffer.alloc(64, 7)]),
  doc: Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(64, 8)]),
  pdf: Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(64, 9)]),
  txt: Buffer.from('xin chao, day khong phai la anh'),
  mp4: Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(64, 10)]),
};

(hasPostgres() ? describe : describe.skip)('Ảnh đại diện tải lên', () => {
  let s: Started, root: string;
  const api = (method: string, path: string, body?: unknown, token = root) => call(s.base, method, path, body, token);
  let teacher: { token: string; id: number }, student: { token: string; id: number }, schoolAdmin: { token: string; id: number };

  beforeAll(async () => {
    s = await startApp('avatar_test');
    root = await adminLogin(s.base);
    const made = await api('POST', '/api/admin/schools', { school_code: '79765507', name: 'THCS Phú Mỹ', admin: { full_name: 'Quản Trị Phú Mỹ', email: 'qt.phumy@example.edu.vn' } });
    const qt = await activate(s.base, made.body.admin.username, made.body.temporary_password, PW, 'school_admin');
    schoolAdmin = { token: qt.token, id: qt.user.id };
    const year = (await api('POST', '/api/admin/school-years', { label: '2026-2027', starts_on: '2026-09-05', ends_on: '2027-05-31' }, qt.token)).body;
    await api('POST', `/api/admin/school-years/${year.id}/activate`, undefined, qt.token);
    const cls = (await api('POST', '/api/admin/classes', { year_id: year.id, grade: 7, name: '7A1' }, qt.token)).body;
    const t = (await api('POST', '/api/admin/teachers', { full_name: 'Lê Giáo Viên', email: 'gv@phumy.edu.vn', phone: '0900000001', birth_date: '1985-03-15' }, qt.token)).body;
    const gv = await activate(s.base, t.user.username, t.temporary_password, PW, 'teacher');
    teacher = { token: gv.token, id: gv.user.id };
    const st = (await api('POST', '/api/admin/students', { user_code: 'HS0001', full_name: 'Trần Học Sinh', birth_date: '2013-03-15', class_id: cls.id, phone: '0900000002', email: 'tu.dong3.avatar@example.edu.vn' }, qt.token)).body;
    const hs = await activate(s.base, st.user.username, st.temporary_password, PW, 'student');
    student = { token: hs.token, id: hs.user.id };
  });
  afterAll(async () => { await s?.close(); });

  const upload = (token: string, data: Buffer | string) => api('POST', '/api/auth/avatar', { data: typeof data === 'string' ? data : b64(data) }, token);

  test('mọi vai trò tải được ảnh đại diện; hồ sơ trả đường dẫn kho tệp và ảnh đọc lại được đúng loại', async () => {
    for (const [who, token] of [['học sinh', student.token], ['giáo viên', teacher.token], ['quản trị trường', schoolAdmin.token], ['quản trị tổng', root]] as const) {
      const res = await upload(token, FILES.png);
      expect([who, res.status]).toEqual([who, 200]);
      expect(res.body.user.avatar_url).toMatch(/^\/api\/content\/media\/[0-9a-f]{32}$/);
      const img = await fetch(`${s.base}${res.body.user.avatar_url}`);
      expect([img.status, img.headers.get('content-type')]).toEqual([200, 'image/png']);
      expect(Buffer.from(await img.arrayBuffer()).equals(FILES.png)).toBe(true);
    }
    // tải bằng data URL (trình duyệt đọc tệp ra dạng này) và đủ bốn định dạng ảnh
    for (const [name, mime] of [['jpeg', 'image/jpeg'], ['gif', 'image/gif'], ['webp', 'image/webp'], ['png', 'image/png']] as const) {
      const res = await upload(student.token, `data:${mime};base64,${b64(FILES[name])}`);
      expect([name, res.status]).toEqual([name, 200]);
      expect((await fetch(`${s.base}${res.body.user.avatar_url}`)).headers.get('content-type')).toBe(mime);
    }
  });

  test('chỉ nhận ảnh: Word, Excel, PowerPoint, PDF, văn bản, video bị từ chối dù đổi đuôi hay khai là ảnh; ảnh cũ không đổi', async () => {
    const before = (await api('GET', '/api/auth/profile', undefined, teacher.token)).body.user.avatar_url;
    for (const name of ['docx', 'xlsx', 'pptx', 'doc', 'pdf', 'txt', 'mp4']) {
      for (const wrap of [(f: Buffer) => b64(f), (f: Buffer) => `data:image/png;base64,${b64(f)}`]) {
        const res = await upload(teacher.token, wrap(FILES[name]));
        expect([name, res.status]).toEqual([name, 400]);
        expect(res.body.detail).toContain('chỉ nhận ảnh PNG, JPEG, WEBP hoặc GIF');
        expect(res.body.detail).toContain('Word, Excel, PowerPoint');
      }
    }
    for (const bad of ['', '***không phải base64***', 'QQ==']) expect((await upload(teacher.token, bad)).status).toBe(400);
    expect((await api('POST', '/api/auth/avatar', {}, teacher.token)).status).toBe(422);
    expect((await api('POST', '/api/auth/avatar', { data: b64(FILES.png) }, '')).status).toBe(401);
    expect((await api('GET', '/api/auth/profile', undefined, teacher.token)).body.user.avatar_url).toBe(before);
  });

  test('tối đa 1,5 MB; vừa đúng 1,5 MB vẫn nhận', async () => {
    const big = (size: number) => Buffer.concat([FILES.png, Buffer.alloc(size - FILES.png.length, 7)]);
    const over = await upload(student.token, big(1572865));
    expect(over.status).toBe(400);
    expect(over.body.detail).toContain('tối đa 1,5 MB');
    expect((await upload(student.token, big(1572864))).status).toBe(200);
  });

  test('mỗi người một ảnh: đổi ảnh thì ảnh cũ bị xóa; ảnh của người khác không bị đụng tới', async () => {
    const mine = async () => (await sql<{ token: string; owner_id: number }>(s.url, "SELECT token, owner_id FROM hk_media WHERE name = 'avatar:user' ORDER BY id")).filter((r) => r.owner_id === teacher.id);
    const first = (await upload(teacher.token, FILES.jpeg)).body.user.avatar_url as string;
    const second = (await upload(teacher.token, FILES.webp)).body.user.avatar_url as string;
    expect(second).not.toBe(first);
    expect((await mine()).map((r) => `/api/content/media/${r.token}`)).toEqual([second]);
    expect((await fetch(`${s.base}${first}`)).status).toBe(404);
    expect((await fetch(`${s.base}${second}`)).status).toBe(200);
    const studentAvatar = (await api('GET', '/api/auth/profile', undefined, student.token)).body.user.avatar_url;
    expect((await fetch(`${s.base}${studentAvatar}`)).status).toBe(200);
  });

  test('xóa ảnh đại diện (PATCH avatar_url: null) gỡ cả tệp; dán liên kết không còn được nhận', async () => {
    await upload(teacher.token, FILES.png);
    const url = (await api('GET', '/api/auth/profile', undefined, teacher.token)).body.user.avatar_url as string;
    const gone = await api('PATCH', '/api/auth/profile', { avatar_url: null }, teacher.token);
    expect(gone.status).toBe(200);
    expect(gone.body.user.avatar_url).toBeNull();
    expect((await fetch(`${s.base}${url}`)).status).toBe(404);
    expect(await sql(s.url, "SELECT 1 FROM hk_media WHERE owner_id = $1 AND name = 'avatar:user'", [teacher.id])).toHaveLength(0);
    for (const link of ['https://example.edu.vn/a.png', 'http://example.edu.vn/a.png', '/api/content/media/' + 'a'.repeat(32)]) {
      const res = await api('PATCH', '/api/auth/profile', { avatar_url: link }, teacher.token);
      expect([link, res.status]).toEqual([link, 422]);
      expect(res.body.detail).toBeDefined();
    }
  });

  test('ảnh đại diện không tính vào hạn mức ảnh Quiz, không hiện trong thư viện ảnh của giáo viên, không dùng tên dành riêng để lách', async () => {
    await upload(teacher.token, FILES.png);
    const lib = (await api('GET', '/api/content/media-library', undefined, teacher.token)).body;
    expect(lib.uploads).toEqual([]);
    // tải ảnh Quiz vẫn bình thường và hiện trong thư viện
    const quizImage = await api('POST', '/api/content/media', { name: 'anh-quiz.png', data: b64(FILES.jpeg) }, teacher.token);
    expect(quizImage.status).toBe(200);
    expect((await api('GET', '/api/content/media-library', undefined, teacher.token)).body.uploads.map((u: { name: string }) => u.name)).toEqual(['anh-quiz.png']);
    // đặt tên trùng tên dành riêng cho ảnh đại diện thì bị bỏ tên, không thể ẩn khỏi thư viện và hạn mức
    const sneaky = await api('POST', '/api/content/media', { name: 'avatar:user', data: b64(FILES.gif) }, teacher.token);
    expect(sneaky.status).toBe(200);
    expect((await sql<{ name: string | null }>(s.url, 'SELECT name FROM hk_media WHERE token = $1', [sneaky.body.token]))[0].name).toBeNull();
    // ảnh đang làm ảnh đại diện không xóa được bằng thư viện Quiz
    const avatarToken = ((await api('GET', '/api/auth/profile', undefined, teacher.token)).body.user.avatar_url as string).split('/').pop()!;
    const del = await api('DELETE', `/api/content/media/${avatarToken}`, undefined, teacher.token);
    expect(del.status).toBe(409);
    expect(del.body.detail).toContain('ảnh đại diện');
  });
});
