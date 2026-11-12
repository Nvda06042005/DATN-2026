/**
 * Không tạo thêm một trường đã có: tên trường so khớp sau khi bỏ dấu và bỏ từ chỉ cấp học ("THCS", "Trường"), kèm tỉnh/thành.
 * Trường nhập tay chưa gắn danh mục (mã tự sinh) vẫn là trường đã có khi chọn lại đúng trường đó trong danh mục; sửa trường thì liên kết danh mục để dùng logo
 * chính thức mà giữ nguyên tên, khu vực và mã (nên đường dẫn riêng của trường không đổi).
 */
import { adminLogin, call, hasPostgres, Started, startApp } from './harness';
import { sameSchoolName } from '../src/admin/school-directory';

describe('So khớp tên trường', () => {
  test('bỏ dấu, bỏ từ chỉ cấp học ở đầu, không phân biệt hoa thường', () => {
    expect(sameSchoolName({ name: 'THCS Phú Mỹ' }, { name: 'Trường THCS Phu My' })).toBe(true);
    expect(sameSchoolName({ name: 'thcs phú mỹ' }, { name: 'THCS PHÚ MỸ' })).toBe(true);
    expect(sameSchoolName({ name: 'THCS Phú Mỹ' }, { name: 'THCS Phú Mỹ Hưng' })).toBe(false);
    expect(sameSchoolName({ name: 'THCS Trương Công Định' }, { name: 'THCS Trường Công Định' })).toBe(false);
  });

  test('tỉnh/thành mâu thuẫn thì là hai trường khác nhau; thiếu một bên thì không mâu thuẫn', () => {
    expect(sameSchoolName({ name: 'THCS Nguyễn Trãi', city: 'Thành Phố Hồ Chí Minh' }, { name: 'THCS Nguyễn Trãi', city: 'Thành phố Hồ Chí Minh' })).toBe(true);
    expect(sameSchoolName({ name: 'THCS Nguyễn Trãi', city: 'Thành phố Hà Nội' }, { name: 'THCS Nguyễn Trãi', city: 'Thành phố Hồ Chí Minh' })).toBe(false);
    expect(sameSchoolName({ name: 'THCS Nguyễn Trãi' }, { name: 'THCS Nguyễn Trãi', city: 'Thành phố Hà Nội' })).toBe(true);
  });
});

(hasPostgres() ? describe : describe.skip)('Không tạo thêm trường đã có', () => {
  let s: Started, root: string;
  const api = (method: string, path: string, body?: unknown) => call(s.base, method, path, body, root);
  const admin = (name: string, email: string) => ({ full_name: name, email });

  beforeAll(async () => {
    s = await startApp('school_dup_test');
    root = await adminLogin(s.base);
  });
  afterAll(async () => { await s?.close(); });

  test('trường nhập tay có mã tự sinh: mã hiện ngay khi tạo và khớp ở danh sách, chi tiết, đường dẫn riêng', async () => {
    const made = await api('POST', '/api/admin/schools', { name: 'THCS Phú Mỹ', region: 'Miền Nam', city: 'Thành Phố Hồ Chí Minh', admin: admin('Quản Trị Phú Mỹ', 'qt.phumy@example.edu.vn') });
    expect(made.status).toBe(201);
    const { id, school_code: code } = made.body.school;
    expect(code).toMatch(/^\d{4,8}$/);
    expect(made.body.school.link.slug).toBe(`donga_${code}_phumy_miennam`);
    const list = await api('GET', '/api/admin/schools?q=phu%20my');
    expect(list.body.items.map((x: { school_code: string }) => x.school_code)).toContain(code);
    const detail = await api('GET', `/api/admin/schools/${id}`);
    expect(detail.body).toMatchObject({ school_code: code, name: 'THCS Phú Mỹ', link: { slug: `donga_${code}_phumy_miennam` } });
  });

  test('gợi ý danh mục báo trường đã có kèm mã, và báo cả trường nhập tay trùng tên đang gõ', async () => {
    const code = (await api('GET', '/api/admin/schools?q=phu%20my')).body.items[0].school_code;
    const found = await api('GET', `/api/admin/school-directory?q=${encodeURIComponent('THCS Phú Mỹ')}&limit=30`);
    expect(found.status).toBe(200);
    expect(found.body.items.find((i: { code: string }) => i.code === '79765507')).toMatchObject({ exists: true, existing_code: code });
    expect(found.body.duplicates.map((d: { school_code: string }) => d.school_code)).toContain(code);
    const none = await api('GET', `/api/admin/school-directory?q=${encodeURIComponent('Khác hẳn tên')}&limit=30`);
    expect(none.body.duplicates).toEqual([]);
  });

  test('chọn từ danh mục hoặc nhập tay lại đúng trường đó đều bị chặn, nêu mã của trường đã có; khác tỉnh/thành thì vẫn tạo được', async () => {
    const code = (await api('GET', '/api/admin/schools?q=phu%20my')).body.items[0].school_code;
    const fromDirectory = await api('POST', '/api/admin/schools', { directory_code: '79765507', name: 'THCS Phú Mỹ', admin: admin('Người Khác', 'khac1@example.edu.vn') });
    expect(fromDirectory.status).toBe(409);
    expect(fromDirectory.body.detail).toContain(`mã ${code}`);
    const manual = await api('POST', '/api/admin/schools', { name: 'Trường THCS Phu My', city: 'Thành phố Hồ Chí Minh', admin: admin('Người Khác', 'khac2@example.edu.vn') });
    expect(manual.status).toBe(409);
    expect(manual.body.detail).toContain(`mã ${code}`);
    const otherCity = await api('POST', '/api/admin/schools', { name: 'THCS Phú Mỹ', city: 'Tỉnh Đồng Nai', admin: admin('Người Ba', 'khac3@example.edu.vn') });
    expect(otherCity.status).toBe(201);
    expect(otherCity.body.school.school_code).not.toBe(code);
    // không tạo thêm trường nào: vẫn đúng hai trường tên Phú Mỹ
    expect((await api('GET', '/api/admin/schools?q=phu%20my')).body.total).toBe(2);
  });

  test('sửa trường: danh mục gợi ý đúng bản ghi khớp, liên kết chỉ lấy mã danh mục và logo, giữ nguyên tên, khu vực, mã; sau đó danh mục báo đã có', async () => {
    const mine = (await api('GET', '/api/admin/schools?q=phu%20my&city=' + encodeURIComponent('Thành Phố Hồ Chí Minh'))).body.items[0];
    const suggest = await api('GET', `/api/admin/school-directory?q=${encodeURIComponent(mine.name)}&limit=30&exclude_school_id=${mine.id}`);
    expect(suggest.body.items.find((i: { code: string }) => i.code === '79765507')).toMatchObject({ exists: false, matches_school: true });
    // bản ghi khác tên không được đánh dấu khớp
    expect(suggest.body.items.filter((i: { matches_school: boolean }) => i.matches_school).every((i: { name: string }) => /Phú Mỹ$/.test(i.name))).toBe(true);
    const linked = await api('PATCH', `/api/admin/schools/${mine.id}`, { directory_code: '79765507', link_only: true });
    expect(linked.status).toBe(200);
    expect(linked.body).toMatchObject({ directory_code: '79765507', name: mine.name, region: 'Miền Nam', city: mine.city, school_code: mine.school_code });
    expect(linked.body.link.slug).toBe(mine.link.slug);
    const after = await api('GET', `/api/admin/school-directory?q=${encodeURIComponent('THCS Phú Mỹ')}&limit=30`);
    expect(after.body.items.find((i: { code: string }) => i.code === '79765507')).toMatchObject({ exists: true, existing_code: mine.school_code });
    const again = await api('POST', '/api/admin/schools', { directory_code: '79765507', name: 'THCS Phú Mỹ', admin: admin('Người Bốn', 'khac4@example.edu.vn') });
    expect(again.status).toBe(409);
  });

  test('sửa thường (không link_only) vẫn đổi theo danh mục như trước', async () => {
    const made = await api('POST', '/api/admin/schools', { name: 'THCS Lê Quý Đôn Thử', region: 'Vùng thử', city: 'Thành phố Hà Nội', admin: admin('Quản Trị Lê', 'qt.le@example.edu.vn') });
    expect(made.status).toBe(201);
    const full = await api('PATCH', `/api/admin/schools/${made.body.school.id}`, { directory_code: '79778504' });
    expect(full.status).toBe(200);
    expect(full.body).toMatchObject({ directory_code: '79778504', name: 'THCS Nguyễn Hiền', city: 'Thành phố Hồ Chí Minh' });
  });
});
