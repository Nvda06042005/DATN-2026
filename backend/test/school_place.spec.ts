/**
 * Trang Trường học của quản trị tổng (18/11/2026):
 * - khu vực theo mô hình chính quyền địa phương hai cấp từ 01/07/2025 (34 tỉnh / thành, 3.321 phường / xã / đặc khu, không còn quận / huyện);
 * - thêm trường không cần quản trị viên đầu tiên (thêm sau), địa chỉ ghép "đường, phường / xã, tỉnh / thành";
 * - ngày kết thúc (deactivated_at) khi vô hiệu hóa, xóa khi bật lại;
 * - logo trường bằng ảnh tải lên thay cho liên kết https, thắng logo danh mục ở mọi nơi hiển thị.
 */
import sharp from 'sharp';
import { activate, adminLogin, call, hasPostgres, sql, Started, startApp } from './harness';
import { composeAddress, currentCityName, findWard, isNewUnit, isOldDistrict, PROVINCES, provinceOf, streetPart, suggestWard, wardFromAddress } from '../src/admin/admin-units';
import { directoryEntry, schoolSlug } from '../src/admin/school-directory';

describe('Đơn vị hành chính hai cấp', () => {
  test('34 tỉnh / thành và 3.321 phường / xã / đặc khu; tên tỉnh / thành nhận cách viết cũ, có / không dấu', () => {
    expect(PROVINCES).toHaveLength(34);
    expect(PROVINCES.reduce((n, p) => n + p.wards.length, 0)).toBe(3321);
    expect(provinceOf('TP. Hồ Chí Minh')?.name).toBe('Thành phố Hồ Chí Minh');
    expect(provinceOf('ho chi minh')?.name).toBe('Thành phố Hồ Chí Minh');
    expect(provinceOf('Hà Nội')?.name).toBe('Thành phố Hà Nội');
    expect(provinceOf('Quận 1')).toBeNull();
    expect(provinceOf('Tỉnh Bình Dương')).toBeNull(); // đã nhập vào Thành phố Hồ Chí Minh từ 01/07/2025
    expect(currentCityName('Thành Phố Hồ Chí Minh')).toBe('Thành Phố Hồ Chí Minh'); // chỉ khác chữ hoa: giữ nguyên
    expect(currentCityName(null)).toBeNull();
  });

  test('phường / xã phải thuộc đúng tỉnh / thành; quận / huyện cũ được nhận diện để từ chối', () => {
    expect(findWard('Thành phố Hồ Chí Minh', 'phuong thanh my tay')?.name).toBe('Phường Thạnh Mỹ Tây');
    expect(findWard('Thành phố Hà Nội', 'Phường Thạnh Mỹ Tây')).toBeNull();
    expect(isOldDistrict('Quận Bình Thạnh')).toBe(true);
    expect(isOldDistrict('Huyện Củ Chi')).toBe(true);
    expect(isOldDistrict('Thành phố Thủ Đức')).toBe(true);
    expect(isOldDistrict('Phường Thạnh Mỹ Tây')).toBe(false);
    expect(isNewUnit('Đặc khu Phú Quốc')).toBe(true);
    expect(isNewUnit('Quận 7')).toBe(false);
  });

  test('địa chỉ: tách phần đường, ghép dạng mới; chỉ đọc phường / xã từ địa chỉ đã không còn quận / huyện', () => {
    expect(streetPart('120B Ngô Tất Tố, phường Thạnh Mỹ Tây, Thành phố Hồ Chí Minh')).toBe('120B Ngô Tất Tố');
    expect(streetPart('12 Lê Lợi, P. Bến Thành, Q.1, TP.HCM')).toBe('12 Lê Lợi');
    expect(streetPart('Ấp 3, xã An Thạnh, huyện Bến Lức')).toBe('Ấp 3');
    expect(composeAddress('120B Ngô Tất Tố', 'Phường Thạnh Mỹ Tây', 'Thành phố Hồ Chí Minh')).toBe('120B Ngô Tất Tố, Phường Thạnh Mỹ Tây, Thành phố Hồ Chí Minh');
    expect(composeAddress(null, 'Phường Thạnh Mỹ Tây', 'Thành phố Hồ Chí Minh')).toBe('Phường Thạnh Mỹ Tây, Thành phố Hồ Chí Minh');
    expect(wardFromAddress('Thành phố Hồ Chí Minh', '120B Ngô Tất Tố, phường Thạnh Mỹ Tây, Thành phố Hồ Chí Minh')?.name).toBe('Phường Thạnh Mỹ Tây');
    // địa chỉ cũ còn quận: không đoán (phường cũ đã sáp nhập, tên có thể trùng nơi khác)
    expect(wardFromAddress('Thành phố Hồ Chí Minh', '12 Lê Lợi, phường Bến Thành, quận 1')).toBeNull();
    // gợi ý (không tự điền): tên trường chứa đúng tên một đơn vị mới
    expect(suggestWard('Thành phố Hồ Chí Minh', null, 'THCS Thạnh Mỹ Tây')?.name).toBe('Phường Thạnh Mỹ Tây');
  });

  test('danh mục: trường biết chắc phường mới có địa chỉ dạng mới; quận cũ chỉ còn ở `district`; đường dẫn dùng phường mới', () => {
    expect(directoryEntry('79765507')).toMatchObject({ region: 'Phường Thạnh Mỹ Tây', city: 'Thành phố Hồ Chí Minh', address: '120B Ngô Tất Tố, Phường Thạnh Mỹ Tây, Thành phố Hồ Chí Minh' });
    expect(schoolSlug({ school_code: '79765507', name: 'THCS Phú Mỹ', region: 'Phường Thạnh Mỹ Tây' })).toBe('donga_79765507_phumy_thanhmytay');
    const unknown = directoryEntry('79765511');
    expect(unknown?.region).toBeNull();
    expect(unknown?.district).toBe('Quận Bình Thạnh');
  });
});

(hasPostgres() ? describe : describe.skip)('Trang Trường học: khu vực mới, không cần quản trị viên đầu tiên, ngày kết thúc, logo tải lên', () => {
  let s: Started, root: string;
  const api = (method: string, path: string, body?: unknown, token = root) => call(s.base, method, path, body, token);
  const png = async (color: string, width = 400, height = 240) => sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();

  beforeAll(async () => {
    s = await startApp('school_place_test');
    root = await adminLogin(s.base);
  });
  afterAll(async () => { await s?.close(); });

  test('danh sách đơn vị hành chính: 34 tỉnh / thành, phường / xã theo tỉnh / thành; tên không hợp lệ báo 404; cần đăng nhập', async () => {
    const all = await api('GET', '/api/admin/admin-units');
    expect(all.status).toBe(200);
    expect(all.body.provinces).toHaveLength(34);
    expect(all.body).toMatchObject({ wards: 3321, decree: expect.any(String), source: expect.stringContaining('MIT') });
    const hcm = await api('GET', `/api/admin/admin-units?city=${encodeURIComponent('TP. Hồ Chí Minh')}`);
    expect(hcm.body.province.name).toBe('Thành phố Hồ Chí Minh');
    expect(hcm.body.wards).toContain('Phường Thạnh Mỹ Tây');
    expect(hcm.body.wards.some((w: string) => /^(Quận|Huyện)/.test(w))).toBe(false);
    expect((await api('GET', `/api/admin/admin-units?city=${encodeURIComponent('Quận 1')}`)).status).toBe(404);
    expect((await api('GET', '/api/admin/admin-units', undefined, '')).status).toBe(401);
  });

  test('thêm trường không kèm quản trị viên: không tạo tài khoản, không gửi thư; khu vực và địa chỉ chuẩn hóa', async () => {
    const made = await api('POST', '/api/admin/schools', { name: 'THCS Khu Vực Mới', city: 'TP. Hồ Chí Minh', region: 'phường thạnh mỹ tây', address: '5 Đường Thử, Phường Thạnh Mỹ Tây, Thành phố Hồ Chí Minh' });
    expect(made.status).toBe(201);
    expect(made.body).toMatchObject({ admin: null, temporary_password: null, mail: 'none' });
    expect(made.body.school).toMatchObject({ city: 'Thành phố Hồ Chí Minh', region: 'Phường Thạnh Mỹ Tây', address: '5 Đường Thử, Phường Thạnh Mỹ Tây, Thành phố Hồ Chí Minh', deactivated_at: null });
    expect(made.body.school.school_code).toMatch(/^\d{8}$/);
    expect(made.body.school.link.slug).toBe(`donga_${made.body.school.school_code}_khuvucmoi_thanhmytay`);
    expect((await sql<{ n: number }>(s.url, 'SELECT count(*)::int AS n FROM app_users WHERE school_id = $1', [made.body.school.id]))[0].n).toBe(0);
    // client cũ vẫn tạo kèm quản trị viên được
    const old = await api('POST', '/api/admin/schools', { name: 'THCS Client Cũ', city: 'Thành phố Hà Nội', region: 'Phường Ba Đình', admin: { full_name: 'Quản Trị Cũ', email: 'qt.cu@example.edu.vn' } });
    expect(old.status).toBe(201);
    expect(old.body.admin.role).toBe('school_admin');
  });

  test('không nhận quận / huyện cũ, phường / xã của tỉnh / thành khác, tỉnh / thành không còn, phường / xã khi chưa có tỉnh / thành', async () => {
    const district = await api('POST', '/api/admin/schools', { name: 'THCS Quận Cũ', city: 'Thành phố Hồ Chí Minh', region: 'Quận Bình Thạnh' });
    expect(district.status).toBe(422);
    expect(district.body.detail).toMatch(/01\/07\/2025/);
    expect((await api('POST', '/api/admin/schools', { name: 'THCS Sai Tỉnh', city: 'Thành phố Hà Nội', region: 'Phường Thạnh Mỹ Tây' })).status).toBe(422);
    expect((await api('POST', '/api/admin/schools', { name: 'THCS Tỉnh Cũ', city: 'Tỉnh Bình Dương' })).status).toBe(422);
    expect((await api('POST', '/api/admin/schools', { name: 'THCS Thiếu Tỉnh', region: 'Phường Thạnh Mỹ Tây' })).status).toBe(422);
  });

  test('chọn trường danh mục chưa biết phường mới: dùng phường / xã quản trị viên chọn trong đúng tỉnh / thành, địa chỉ ghép theo phường đó', async () => {
    const entry = directoryEntry('79765511')!;
    expect((await api('POST', '/api/admin/schools', { directory_code: entry.code, name: entry.name, region: 'Quận Bình Thạnh' })).status).toBe(422);
    const made = await api('POST', '/api/admin/schools', { directory_code: entry.code, name: entry.name, region: 'Phường Bình Thạnh' });
    expect(made.status).toBe(201);
    expect(made.body.school).toMatchObject({ directory_code: entry.code, region: 'Phường Bình Thạnh', city: 'Thành phố Hồ Chí Minh' });
  });

  test('sửa trường: đổi phường / xã được kiểm tra; trường cũ còn ghi quận vẫn sửa được thông tin khác khi gửi lại đúng khu vực cũ', async () => {
    const made = (await api('POST', '/api/admin/schools', { name: 'THCS Trường Cũ Có Quận', city: 'Thành phố Hồ Chí Minh' })).body.school;
    await sql(s.url, "UPDATE app_schools SET region = 'Quận 2' WHERE id = $1", [made.id]);
    const same = await api('PATCH', `/api/admin/schools/${made.id}`, { name: 'THCS Trường Cũ Có Quận Đổi Tên', city: 'Thành phố Hồ Chí Minh', region: 'Quận 2' });
    expect(same.status).toBe(200);
    expect(same.body.region).toBe('Quận 2');
    expect((await api('PATCH', `/api/admin/schools/${made.id}`, { region: 'Quận 9' })).status).toBe(422);
    const moved = await api('PATCH', `/api/admin/schools/${made.id}`, { region: 'Phường An Khánh', address: '1 Đường Thử, Phường An Khánh, Thành phố Hồ Chí Minh' });
    expect(moved.status).toBe(200);
    expect(moved.body).toMatchObject({ region: 'Phường An Khánh', address: '1 Đường Thử, Phường An Khánh, Thành phố Hồ Chí Minh' });
  });

  test('vô hiệu hóa ghi ngày kết thúc (hiện ở danh sách), bật lại thì xóa', async () => {
    const made = (await api('POST', '/api/admin/schools', { name: 'THCS Sẽ Kết Thúc', city: 'Thành phố Hà Nội' })).body.school;
    const off = await api('PATCH', `/api/admin/schools/${made.id}`, { is_active: false });
    expect(off.status).toBe(200);
    expect(off.body.is_active).toBe(false);
    expect(Math.abs(new Date(off.body.deactivated_at).getTime() - Date.now())).toBeLessThan(60_000);
    const listed = (await api('GET', `/api/admin/schools?q=${encodeURIComponent('Sẽ Kết Thúc')}`)).body.items[0];
    expect(listed.deactivated_at).toBe(off.body.deactivated_at);
    // sửa thông tin khác không đổi ngày kết thúc
    expect((await api('PATCH', `/api/admin/schools/${made.id}`, { contact_name: 'Cô Lan' })).body.deactivated_at).toBe(off.body.deactivated_at);
    const on = await api('PATCH', `/api/admin/schools/${made.id}`, { is_active: true });
    expect(on.body).toMatchObject({ is_active: true, deactivated_at: null });
  });

  test('logo tải lên: thu về WebP ≤160px, phục vụ ở đường dẫn riêng, thắng logo danh mục ở chi tiết, trang đăng nhập, PDF; bỏ logo thì về logo danh mục', async () => {
    const made = await api('POST', '/api/admin/schools', { directory_code: '79765507', name: 'THCS Phú Mỹ' });
    expect(made.status).toBe(201);
    const id = made.body.school.id, directoryLogo = made.body.school.logo_url;
    expect(directoryLogo).toMatch(/\/api\/school-logos\/[a-f0-9]{64}\.webp$/);
    const up = await api('POST', `/api/admin/schools/${id}/logo`, { data: `data:image/png;base64,${(await png('#b22222')).toString('base64')}` });
    expect(up.status).toBe(200);
    expect(up.body.logo_url).toMatch(/^https?:\/\/[^/]+\/api\/school-logos\/u\/[a-f0-9]{64}\.webp$/);
    const file = await fetch(s.base + new URL(up.body.logo_url).pathname);
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toContain('image/webp');
    const meta = await sharp(Buffer.from(await file.arrayBuffer())).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(160);
    expect((await api('GET', `/api/admin/schools/${id}`)).body.logo_url).toBe(up.body.logo_url);
    expect((await call(s.base, 'GET', '/api/auth/school-link/' + made.body.school.link.slug)).body.logo_url).toBe(up.body.logo_url);
    const { schoolPdfLogo } = await import('../src/admin/pdf');
    const { DatabaseService } = await import('../src/database/database.service');
    const pdfLogo = await schoolPdfLogo(s.moduleRef.get(DatabaseService), up.body);
    expect((await sharp(pdfLogo!).stats()).dominant).toMatchObject({ r: expect.any(Number) });
    expect((await sharp(pdfLogo!).raw().toBuffer())[0]).toBeGreaterThan(150); // ảnh đỏ đã tải, không phải logo danh mục
    // tải lại đúng ảnh đó: không nhân đôi trong kho
    const before = (await sql<{ n: number }>(s.url, 'SELECT count(*)::int AS n FROM app_school_logo_assets'))[0].n;
    expect((await api('POST', `/api/admin/schools/${id}/logo`, { data: (await png('#b22222')).toString('base64') })).body.logo_url).toBe(up.body.logo_url);
    expect((await sql<{ n: number }>(s.url, 'SELECT count(*)::int AS n FROM app_school_logo_assets'))[0].n).toBe(before);
    const removed = await api('DELETE', `/api/admin/schools/${id}/logo`);
    expect(removed.status).toBe(200);
    expect((await api('GET', `/api/admin/schools/${id}`)).body.logo_url).toBe(directoryLogo);
  });

  test('logo: không nhận tệp không phải ảnh; trường không thuộc danh mục bỏ logo thì không có logo', async () => {
    const made = (await api('POST', '/api/admin/schools', { name: 'THCS Logo Riêng', city: 'Thành phố Hà Nội' })).body.school;
    expect((await api('POST', `/api/admin/schools/${made.id}/logo`, { data: Buffer.from('%PDF-1.4 tệp giả').toString('base64') })).status).toBe(400);
    expect((await api('POST', `/api/admin/schools/${made.id}/logo`, { data: 'không phải base64' })).status).toBe(400);
    expect((await api('POST', `/api/admin/schools/${made.id}/logo`, {})).status).toBe(422);
    expect((await api('POST', `/api/admin/schools/${made.id}/logo`, { data: (await png('#1d4ed8', 120, 120)).toString('base64') })).status).toBe(200);
    expect((await api('DELETE', `/api/admin/schools/${made.id}/logo`)).body.logo_url).toBeNull();
  });

  test('quản trị trường tải logo cho trường của mình, không đổi được logo trường khác', async () => {
    const made = await api('POST', '/api/admin/schools', { name: 'THCS Quản Trị Tự Đổi Logo', city: 'Thành phố Hà Nội', region: 'Xã Đại Thanh', admin: { full_name: 'Quản Trị Logo', email: 'qt.logo@example.edu.vn' } });
    const other = (await api('POST', '/api/admin/schools', { name: 'THCS Trường Bên Cạnh', city: 'Thành phố Hà Nội' })).body.school;
    const schoolAdmin = await activate(s.base, made.body.admin.username, made.body.temporary_password, 'MatKhauMoi@2026', 'school_admin');
    const data = (await png('#15803d', 200, 200)).toString('base64');
    const mine = await api('POST', '/api/admin/school/logo', { data }, schoolAdmin.token);
    expect(mine.status).toBe(200);
    expect(mine.body.logo_url).toMatch(/\/api\/school-logos\/u\/[a-f0-9]{64}\.webp$/);
    expect((await api('POST', `/api/admin/school/logo?school_id=${other.id}`, { data }, schoolAdmin.token)).status).toBe(403);
    expect((await api('POST', `/api/admin/schools/${other.id}/logo`, { data }, schoolAdmin.token)).status).toBe(403);
    expect((await api('DELETE', '/api/admin/school/logo', undefined, schoolAdmin.token)).body.logo_url).toBeNull();
  });
});
