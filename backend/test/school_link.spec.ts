/**
 * Thêm trường từ danh mục: gõ tên → mã Bộ GD&ĐT, khu vực, tỉnh/thành tự điền; đường dẫn riêng donga_<mã>_<tên>_<khu vực> làm cổng đăng nhập của trường.
 * Phần danh mục và quy tắc đặt tên chạy không cần CSDL; phần còn lại chạy HTTP thật trên PostgreSQL tạm.
 */
import { activate, adminLogin, call, hasPostgres, Started, startApp } from './harness';
import { areaSlug, directoryEntry, directoryInfo, nameSlug, parseSchoolSlug, schoolSlug, searchDirectory } from '../src/admin/school-directory';
import directory from '../src/admin/school-directory.json';
import extra from '../src/admin/school-directory-extra.json';
import confirmed from '../src/admin/school-confirmed-2026.json';
import type { MailService } from '../src/admin/mail.service';

describe('Danh mục trường và quy tắc đặt tên đường dẫn', () => {
  test('đường dẫn: donga_<mã>_<tên>_<khu vực> không dấu, viết liền', () => {
    expect(schoolSlug({ school_code: '79765507', name: 'THCS Phú Mỹ', region: 'Quận Bình Thạnh' })).toBe('donga_79765507_phumy_binhthanh');
    expect(schoolSlug({ school_code: '79778504', name: 'THCS Nguyễn Hiền', region: 'Quận 7' })).toBe('donga_79778504_nguyenhien_7');
    expect(schoolSlug({ school_code: '79783521', name: 'THCS Hòa Phú', region: 'Huyện Củ Chi' })).toBe('donga_79783521_hoaphu_cuchi');
    expect(schoolSlug({ school_code: '0017', name: 'Trường THCS Đoàn Thị Điểm' })).toBe('donga_0017_doanthidiem');
  });

  test('chỉ bỏ cụm từ chỉ cấp học ở đầu tên, không làm mất tên riêng như "Trung Sơn"', () => {
    expect(nameSlug('THCS Trung Sơn')).toBe('trungson');
    expect(nameSlug('Trường THCS Lý Tự Trọng')).toBe('lytutrong');
    expect(nameSlug('Tiểu học và THCS Trần Danh Ninh')).toBe('trandanhninh');
    expect(nameSlug('TH&THCS Tân Hợp')).toBe('tanhop');
    expect(nameSlug('Trung học cơ sở Nguyễn Du')).toBe('nguyendu');
    expect(nameSlug('THCS')).toBe('thcs');
    // "Trương" (họ) khác "Trường" (cấp trường): chỉ bỏ "Trường" đúng dấu
    expect(nameSlug('THCS Trương Công Định')).toBe('truongcongdinh');
    expect(nameSlug('Trường THCS Trương Văn Ngư')).toBe('truongvanngu');
    expect(nameSlug('Truong THCS Le Loi')).toBe('leloi');
    expect(areaSlug('Thành phố Thủ Dầu Một')).toBe('thudaumot');
    expect(areaSlug('Thị xã Tân Uyên')).toBe('tanuyen');
    expect(areaSlug(null)).toBe('');
  });

  test('đọc mã trường từ đường dẫn; phần tên và khu vực chỉ để người đọc, đường dẫn sai dạng bị từ chối', () => {
    expect(parseSchoolSlug('donga_79765507_phumy_binhthanh')).toEqual({ code: '79765507' });
    expect(parseSchoolSlug('DONGA_79765507_PhuMy')).toEqual({ code: '79765507' });
    expect(parseSchoolSlug('donga_0017')).toEqual({ code: '0017' });
    for (const bad of ['donga_12', 'donga_123456789_x', 'donga_abc_x', 'hoc-sinh', 'admin', 'donga_79765507_phú_mỹ', 'donga_79765507_../x', '']) expect(parseSchoolSlug(bad)).toBeNull();
  });

  test('tìm theo tên, có dấu hay không dấu, theo mã hoặc theo quận; trường THCS Phú Mỹ (Bình Thạnh) có mã Bộ GD&ĐT, khu vực và tỉnh/thành', () => {
    for (const q of ['phu my binh thanh', 'Phú Mỹ Bình Thạnh', '79765507']) {
      expect(searchDirectory(q)[0]).toMatchObject({ code: '79765507', name: 'THCS Phú Mỹ', region: 'Phường Thạnh Mỹ Tây', city: 'Thành phố Hồ Chí Minh' });
    }
    expect(searchDirectory('   ')).toHaveLength(12);
    expect(searchDirectory('khong-co-truong-nao-ten-nhu-the-xyz')).toEqual([]);
    expect(searchDirectory('thcs', 5)).toHaveLength(5);
    expect(directoryEntry('79765507')?.name).toBe('THCS Phú Mỹ');
    expect(directoryEntry('00000000')).toBeNull();
  });

  test('toàn bộ danh mục: mã duy nhất, 4–8 chữ số, đã đổi sang 34 tỉnh/thành từ 01/07/2025', () => {
    const rows = directory.schools as Array<[string, string, number, string, string | null]>;
    expect(directoryInfo().schools).toBeGreaterThan(rows.length);
    expect(directoryInfo().source_rows).toBe(11391);
    expect(directoryEntry('02000E04')).not.toBeNull();
    expect(directoryEntry('011110759')?.name).toContain('Vinschool');
    expect(directoryEntry('TEST01')).toBeNull();
    const shorthand = searchDirectory('T,S', 30);
    expect(shorthand.length).toBeGreaterThan(0);
    expect(shorthand.some(row => /Trung Sơn|Tân Sơn|Trần Sơn/.test(row.name))).toBe(true);
    expect(directoryEntry('31311522')?.code).toBe('hp-tranquocbao-2026');
    expect(searchDirectory('Trần Nhật Duật Bạch Đằng')[0]?.code).toBe('hp-bachdang-2026');
    expect(rows.length).toBeGreaterThan(11000);
    expect(new Set(rows.map((r) => r[0])).size).toBe(rows.length);
    expect(rows.every((r) => /^\d{4,8}$/.test(r[0]) && r[1] === r[1].trim() && !/&amp;|\s{2}/.test(r[1]) && r[3])).toBe(true);
    expect(directory.provinces).toHaveLength(34);
    expect(directory.provinces).toEqual(expect.arrayContaining(['Thành phố Hồ Chí Minh', 'Tỉnh Tuyên Quang', 'Thành phố Huế']));
    expect(directory.provinces).not.toEqual(expect.arrayContaining(['Tỉnh Bình Dương']));
    // Bình Dương và Bà Rịa - Vũng Tàu nay thuộc TP. Hồ Chí Minh
    expect(directoryEntry('74718514')?.city).toBe('Thành phố Hồ Chí Minh');
    expect(directoryEntry('77748506')?.city).toBe('Thành phố Hồ Chí Minh');
    // mã có chữ (trường tư thục, quốc tế) không đưa vào vì ô mã trường chỉ nhận chữ số
    expect(rows.some((r) => /\D/.test(r[0]))).toBe(false);
  });

  test('sáp nhập 2026: trường bị gộp không còn trong danh mục, trường giữ lại ghi chú trường đã gộp', () => {
    // THCS Lam Sơn gộp vào THCS Trương Công Định (phường Gia Định, trước là quận Bình Thạnh)
    expect(directoryEntry('79765501')?.code).toBe('79765511');
    expect(searchDirectory('lam son binh thanh').some((e) => e.code === '79765501')).toBe(false);
    expect(directoryEntry('79765511')).toMatchObject({ name: 'THCS Trương Công Định', region: 'Quận Bình Thạnh' });
    expect(directoryEntry('79765511')?.note).toContain('THCS Lam Sơn');
    expect(directoryInfo().merged).toBeGreaterThanOrEqual(15);
  });

  test('sáp nhập đã công bố: THCS Cửu Long gộp vào THCS Phú Mỹ và các trường khác trong danh sách Dân trí không còn là mục riêng; tên và mã cũ trỏ tới trường hiện tại', () => {
    const gone: Array<[string, string]> = [
      ['79765508', '79765507'], ['79760508', '79760504'], ['79764510', '79764503'], ['79776504', '79776505'], ['79776512', '79776509'], ['77751513', '77751510'], ['77751503', '77751510'],
      ['79760505', 'hcm-tandinh-2026'], ['79760507', 'hcm-phanvantri-2026'], ['74725512', 'hcm-tanthoi-2026'], ['74725508', 'hcm-vinhphu-2026'], ['74718514', 'hcm-binhduong-2026'],
      ['74723513', 'hcm-binhduong-2026'], ['77754503', 'hcm-phuochoa-2026'], ['77751506', 'hcm-chuvanan-hotram-2026'],
      ['42445505', 'ht-thachha-2026'], ['42445504', 'ht-thachha-2026'], ['37374516', 'nb-anphong-2026'], ['37369510', 'nb-anphong-2026'],
    ];
    const all = searchDirectory('', 20000);
    for (const [old, current] of gone) {
      expect(all.some(row => row.code === old)).toBe(false);
      expect(directoryEntry(old)?.code).toBe(current);
      expect(directoryEntry(current)?.previous_codes).toContain(old);
    }
    // gõ tên cũ vẫn ra trường hiện tại; không còn mục THCS Cửu Long riêng
    expect(searchDirectory('THCS Cửu Long Bình Thạnh')[0]?.code).toBe('79765507');
    expect(searchDirectory('Phan Huy Chú Thạch Hà')[0]?.code).toBe('ht-thachha-2026');
    expect(searchDirectory('Ninh Phong')[0]?.code).toBe('nb-anphong-2026');
    // trường mới hình thành: tên theo nguồn, thuộc đúng tỉnh/thành
    expect(directoryEntry('hcm-tandinh-2026')).toMatchObject({ name: 'Tiểu học - THCS Tân Định', city: 'Thành phố Hồ Chí Minh', region: 'Phường Tân Định' });
    expect(directoryEntry('ht-thachha-2026')).toMatchObject({ name: 'Trường THCS Thạch Hà', city: 'Tỉnh Hà Tĩnh' });
    expect(directoryEntry('nb-anphong-2026')).toMatchObject({ name: 'Trường THCS An Phong', city: 'Tỉnh Ninh Bình' });
    // trường cùng tên ở nơi khác không bị ảnh hưởng
    expect(directoryEntry('87874501')?.name).toBe('Trường THCS An Phong');
    expect(directoryEntry('79767504')?.name).toBe('THCS Đồng Khởi');
  });

  test('đối chiếu tên cũ 2026 theo đúng địa bàn, không gộp trường trùng tên ở tỉnh khác', () => {
    expect(directoryEntry('01020513')).toMatchObject({ code: 'hn-dongocdu-2026', name: 'THCS Đỗ Ngọc Du', region: 'Xã Đại Thanh' });
    expect(directoryEntry('01020514')?.code).toBe('hn-dongocdu-2026');
    expect(searchDirectory('Hữu Hoà Đại Thanh')[0]?.code).toBe('hn-dongocdu-2026');
    expect(directoryEntry('56568501')?.code).toBe('kh-nhatrang-2026');
    expect(directoryEntry('19164521')?.name).toBe('Trường THCS Đại Phúc');
    expect(directoryEntry('31305501')?.code).toBe('31305506');
    expect(directoryEntry('30297509')?.name).toContain('Hoàng Diệu');
    expect(directoryEntry('79784505')?.name).toBe('Trường THCS Hà Huy Tập');
    expect(searchDirectory('Trung Mỹ Tây 1')[0]?.code).toBe('79784505');
    const all = searchDirectory('', 20000);
    expect(all.some(row => row.code === '01020513' || row.code === '56568501')).toBe(false);
    expect(new Set(all.map(row => row.code)).size).toBe(all.length);
  });

  test('nguồn danh mục không còn mục cũ đã sáp nhập; tên và mã cũ chỉ trả trường hiện tại', () => {
    const retired = new Set<string>([...directory.merged.map(row => row[0]), ...confirmed.schools.flatMap(row => ('previous_codes' in row ? row.previous_codes : []) ?? [])]);
    const source = [...directory.schools, ...extra.schools] as Array<[string, string, number, string, string | null]>;
    expect(source.filter(row => retired.has(row[0]))).toEqual([]);
    const current = searchDirectory('', 20000);
    for (const entry of current) for (const code of entry.previous_codes ?? []) {
      expect(current.some(row => row.code === code)).toBe(false);
      expect(directoryEntry(code)?.code).toBe(entry.code);
      expect(searchDirectory(code, 30).some(row => row.code === entry.code)).toBe(true);
    }
  });
});

(hasPostgres() ? describe : describe.skip)('Thêm trường từ danh mục và đăng nhập qua đường dẫn của trường', () => {
  let s: Started, root: string, mail: MailService;
  const PW = 'Matkhau-12345';
  const api = (method: string, path: string, body?: unknown, token = root) => call(s.base, method, path, body, token);
  const SLUG = 'donga_79765507_phumy_binhthanh';
  let schoolId: number, admin: { token: string; user: { username: string } }, teacher: { token: string; username: string }, otherTeacher: { token: string; username: string };

  const mkTeacher = async (adminToken: string, name: string, email: string) => {
    const made = await api('POST', '/api/admin/teachers', { full_name: name, email, phone: '0900000026', birth_date: '1985-03-15' }, adminToken);
    expect(made.status).toBe(201);
    const active = await activate(s.base, made.body.user.username, made.body.temporary_password, PW, 'teacher');
    return { token: active.token as string, username: made.body.user.username as string };
  };

  beforeAll(async () => {
    s = await startApp('school_link_test');
    mail = s.moduleRef.get((await import('../src/admin/mail.service')).MailService);
    root = await adminLogin(s.base);
  });
  afterAll(async () => { await s?.close(); });

  test('mã trường: giữ nguyên mã 8 chữ số của Bộ GD&ĐT, mã ngắn thêm số 0 phía trước (không cắt còn 4 số vì trùng mã)', async () => {
    const { normCode } = await import('../src/admin/school.service');
    expect(normCode('79765507')).toBe('79765507');
    expect(normCode('7001')).toBe('7001');
    expect(normCode('12')).toBe('0012');
    expect(normCode('ab-5507')).toBe('5507');
    expect(normCode('0079765507')).toBe('79765507');
    expect(normCode('abc')).toBe('');
    expect(normCode(null)).toBe('');
  });

  test('gợi ý từ danh mục chỉ dành cho quản trị tổng, kèm cờ "đã có trong hệ thống" và đường dẫn sẽ tạo', async () => {
    const found = await api('GET', `/api/admin/school-directory?q=${encodeURIComponent('phú mỹ bình thạnh')}`);
    expect(found.status).toBe(200);
    expect(found.body.items[0]).toMatchObject({ code: '79765507', name: 'THCS Phú Mỹ', region: 'Phường Thạnh Mỹ Tây', city: 'Thành phố Hồ Chí Minh', exists: false, slug: 'donga_79765507_phumy_phuongthanhmytay' });
    expect((await api('GET', '/api/admin/school-directory')).body.items).toHaveLength(30);
    expect((await api('GET', '/api/admin/school-directory?q=x&limit=999')).status).toBe(422);
    expect((await api('GET', '/api/admin/school-directory?q=phu', undefined, '')).status).toBe(401);
  });

  test('thêm trường đã chọn từ danh mục: mã 8 chữ số được giữ, trả đường dẫn riêng; chi tiết và danh sách cùng đường dẫn đó', async () => {
    const created = await api('POST', '/api/admin/schools', {
      school_code: '79765507', name: 'THCS Phú Mỹ', region: 'Quận Bình Thạnh', city: 'Thành phố Hồ Chí Minh',
      admin: { full_name: 'Nguyễn Quản Trị Phú Mỹ', email: 'qt.phumy@example.edu.vn' },
    });
    expect(created.status).toBe(201);
    schoolId = created.body.school.id;
    expect(created.body.school).toMatchObject({ school_code: '79765507', logo_url: null });
    expect(created.body.school.link).toEqual({ slug: SLUG, path: `/${SLUG}`, url: expect.stringMatching(new RegExp(`^https?://[^/]+/${SLUG}$`)) });
    expect((await api('GET', `/api/admin/schools/${schoolId}`)).body.link.slug).toBe(SLUG);
    expect((await api('GET', `/api/admin/schools?q=${encodeURIComponent('Phú Mỹ')}`)).body.items.find((x: { id: number }) => x.id === schoolId).link.slug).toBe(SLUG);
    expect((await api('GET', `/api/admin/school-directory?q=${encodeURIComponent('phú mỹ bình thạnh')}`)).body.items[0]).toMatchObject({ code: '79765507', exists: true });
    // mã 8 số nhưng cùng 4 số cuối với trường khác vẫn là trường khác, không bị coi là trùng
    const sibling = await api('POST', '/api/admin/schools', { school_code: '01015507', name: 'THCS Trùng Bốn Số Cuối', admin: { full_name: 'Quản Trị Khác', email: 'qt.khac@example.edu.vn' } });
    expect(sibling.status).toBe(201);
    expect(sibling.body.school.school_code).toBe('01015507');
    expect((await api('POST', '/api/admin/schools', { school_code: '79765507', name: 'Trùng mã', admin: { full_name: 'Ai Đó', email: 'aido@example.edu.vn' } })).status).toBe(409);
    admin = await activate(s.base, created.body.admin.username, created.body.temporary_password, PW, 'school_admin');
    teacher = await mkTeacher(admin.token, 'Lê Giáo Viên Phú Mỹ', 'gv.phumy@example.edu.vn');
    otherTeacher = await mkTeacher((await activate(s.base, sibling.body.admin.username, sibling.body.temporary_password, PW, 'school_admin')).token, 'Trần Giáo Viên Khác', 'gv.khac@example.edu.vn');
  });

  test('trang đăng nhập của trường lấy thông tin công khai tối thiểu, không cần đăng nhập, không lộ người dùng hay liên hệ', async () => {
    const page = await api('GET', `/api/auth/school-link/${SLUG}`, undefined, '');
    expect(page.status).toBe(200);
    expect(page.body).toEqual({ school_code: '79765507', name: 'THCS Phú Mỹ', region: 'Quận Bình Thạnh', city: 'Thành phố Hồ Chí Minh', logo_url: null, is_active: true, slug: SLUG });
    // phần tên và khu vực cũ hay gõ sai vẫn mở đúng trường và trả đường dẫn chuẩn
    expect((await api('GET', '/api/auth/school-link/donga_79765507_tencu_khuvuccu', undefined, '')).body.slug).toBe(SLUG);
    expect((await api('GET', '/api/auth/school-link/donga_79765507', undefined, '')).body.slug).toBe(SLUG);
    for (const bad of ['donga_12345678_khong_co', 'hoc-sinh', 'donga_12', 'donga_79765507_phú_mỹ']) expect((await api('GET', `/api/auth/school-link/${encodeURIComponent(bad)}`, undefined, '')).status).toBe(404);
  });

  test('vô hiệu hóa trường: trang vẫn mở nhưng báo is_active=false và không ai đăng nhập được', async () => {
    expect((await api('PATCH', `/api/admin/schools/${schoolId}`, { is_active: false })).status).toBe(200);
    expect((await api('GET', `/api/auth/school-link/${SLUG}`, undefined, '')).body.is_active).toBe(false);
    expect((await api('POST', '/api/auth/login', { username: teacher.username, password: PW, portal: 'app', school_code: '79765507' }, '')).status).toBe(403);
    expect((await api('PATCH', `/api/admin/schools/${schoolId}`, { is_active: true })).status).toBe(200);
  });

  test('đăng nhập qua đường dẫn của trường: chỉ tài khoản của trường đó vào được; trường khác và quản trị tổng bị chặn', async () => {
    const login = (username: string, password: string, portal: string, school_code?: string) => api('POST', '/api/auth/login', { username, password, portal, school_code }, '');
    expect((await login(teacher.username, PW, 'app', '79765507')).status).toBe(200);
    expect((await login(admin.user.username, PW, 'school_admin', '79765507')).status).toBe(200);
    const wrong = await login(otherTeacher.username, PW, 'app', '79765507');
    expect(wrong.status).toBe(403);
    expect(wrong.body.detail).toContain('không thuộc trường');
    expect((await login('admin', 'admin@123', 'root_admin', '79765507')).status).toBe(403);
    // không qua đường dẫn thì không đổi gì
    expect((await login(otherTeacher.username, PW, 'app')).status).toBe(200);
    expect((await login(teacher.username, PW, 'app', '12345678')).status).toBe(403);
    // sai mật khẩu vẫn là sai mật khẩu, không lộ tài khoản có thuộc trường hay không
    expect((await login(otherTeacher.username, 'sai-mat-khau', 'app', '79765507')).status).toBe(401);
    expect((await login(teacher.username, PW, 'app', 'abc')).status).toBe(422);
    const events = (await api('GET', '/api/admin/login-history?limit=50')).body.items as Array<{ reason: string; success: boolean }>;
    expect(events.some((e) => e.reason === 'portal' && !e.success)).toBe(true);
  });

  test('quản trị trường bật xác thực hai lớp: thử thách mang theo mã trường của đường dẫn, nên bước hai không đổi sang trường khác', async () => {
    const sent = mail.sent;
    const before = sent.length; // mail.sent là danh sách dùng chung: thư mới được thêm vào cuối
    // vô hiệu hóa trường ở bài trước đã thu hồi phiên cũ nên đăng nhập lại
    const token = (await api('POST', '/api/auth/login', { username: admin.user.username, password: PW, portal: 'school_admin' }, '')).body.token as string;
    expect((await api('POST', '/api/platform/2fa/setup', { method: 'email' }, token)).body.sent_to).toMatch(/^q\*\*\*@example\.edu\.vn$/);
    const code = /Mã xác thực của bạn là: (\d{6})/.exec(sent[sent.length - 1].text)![1];
    expect(sent.length).toBe(before + 1);
    expect((await api('POST', '/api/platform/2fa/enable', { code }, token)).body.backup_codes).toHaveLength(8);
    const step1 = await api('POST', '/api/auth/login', { username: admin.user.username, password: PW, portal: 'school_admin', school_code: '79765507' }, '');
    expect(step1.body).toMatchObject({ two_factor: true, method: 'email' });
    const payload = JSON.parse(Buffer.from(step1.body.challenge.split('.')[1], 'base64url').toString('utf8'));
    expect(payload).toMatchObject({ purpose: '2fa', portal: 'school_admin', sc: '79765507' });
    const code2 = /Mã xác thực của bạn là: (\d{6})/.exec(sent[sent.length - 1].text)![1];
    expect((await api('POST', '/api/auth/2fa/verify', { challenge: step1.body.challenge, code: code2, portal: 'school_admin' }, '')).status).toBe(200);
  });
});
