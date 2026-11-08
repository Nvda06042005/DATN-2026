/**
 * Học kỳ của năm học: học kỳ 1 và học kỳ 2 do quản trị viên trường đặt (gợi ý theo khung kế hoạch của Bộ GD&ĐT nằm ở giao diện).
 * Hoặc chưa đặt học kỳ (năm học cũ), hoặc đặt đủ hai học kỳ nối tiếp nhau và nằm trong năm học; ràng buộc có cả ở máy chủ lẫn CSDL.
 */
import { activate, adminLogin, call, hasPostgres, sql, Started, startApp } from './harness';

(hasPostgres() ? describe : describe.skip)('Học kỳ của năm học', () => {
  let s: Started, root: string, admin: string, schoolId: number;
  const PW = 'Matkhau-12345';
  const api = (method: string, path: string, body?: unknown, token = admin) => call(s.base, method, path, body, token);
  const YEAR = { label: '2026-2027', starts_on: '2026-09-05', ends_on: '2027-05-31' };
  const TERMS = { term1_starts_on: '2026-09-05', term1_ends_on: '2027-01-16', term2_starts_on: '2027-01-18', term2_ends_on: '2027-05-31' };

  beforeAll(async () => {
    s = await startApp('school_terms_test');
    root = await adminLogin(s.base);
    const made = await call(s.base, 'POST', '/api/admin/schools', { name: 'THCS Học Kỳ', city: 'Thành phố Hồ Chí Minh', admin: { full_name: 'Quản Trị Học Kỳ', email: 'qt.hocky@example.edu.vn' } }, root);
    expect(made.status).toBe(201);
    schoolId = made.body.school.id;
    const active = await activate(s.base, made.body.admin.username, made.body.temporary_password, PW, 'school_admin');
    admin = active.token;
  });
  afterAll(async () => { await s?.close(); });

  test('năm học tạo không có học kỳ vẫn hợp lệ (như trước), cả bốn ngày học kỳ là null', async () => {
    const made = await api('POST', '/api/admin/school-years', { label: '2025-2026', starts_on: '2025-09-05', ends_on: '2026-05-31' });
    expect(made.status).toBe(201);
    expect(made.body).toMatchObject({ label: '2025-2026', term1_starts_on: null, term1_ends_on: null, term2_starts_on: null, term2_ends_on: null });
  });

  test('tạo năm học kèm hai học kỳ; danh sách, kích hoạt và chi tiết trường trả đủ ngày học kỳ', async () => {
    const made = await api('POST', '/api/admin/school-years', { ...YEAR, ...TERMS });
    expect(made.status).toBe(201);
    expect(made.body).toMatchObject(TERMS);
    const list = await api('GET', '/api/admin/school-years');
    expect(list.body.find((y: { label: string }) => y.label === '2026-2027')).toMatchObject(TERMS);
    expect((await api('POST', `/api/admin/school-years/${made.body.id}/activate`, {})).body).toMatchObject(TERMS);
    const mine = await api('GET', '/api/admin/school');
    expect(mine.body.current_year).toMatchObject({ label: '2026-2027', ...TERMS });
  });

  test('học kỳ sai bị từ chối với thông báo rõ: thiếu, ngoài năm học, đảo thứ tự, chồng nhau', async () => {
    const post = (terms: Record<string, string | null>) => api('POST', '/api/admin/school-years', { label: '2030-2031', starts_on: '2030-09-05', ends_on: '2031-05-31', ...terms });
    const base = { term1_starts_on: '2030-09-05', term1_ends_on: '2031-01-16', term2_starts_on: '2031-01-18', term2_ends_on: '2031-05-31' };
    const cases: Array<[Record<string, string | null>, RegExp]> = [
      [{ term1_starts_on: '2030-09-05' }, /đủ ngày/],
      [{ ...base, term1_starts_on: '2030-09-01' }, /từ ngày bắt đầu năm học/],
      [{ ...base, term1_ends_on: '2030-09-01' }, /Học kỳ 1 phải kết thúc sau/],
      [{ ...base, term2_starts_on: '2031-01-16' }, /sau khi học kỳ 1 kết thúc/],
      [{ ...base, term2_starts_on: '2031-01-10' }, /sau khi học kỳ 1 kết thúc/],
      [{ ...base, term2_ends_on: '2031-06-15' }, /kết thúc trước hoặc đúng ngày kết thúc năm học/],
    ];
    for (const [terms, message] of cases) {
      const res = await post(terms);
      expect(res.status).toBe(422);
      expect(String(res.body.detail)).toMatch(message);
    }
    // hai học kỳ cùng một ngày duy nhất vẫn hợp lệ về thứ tự (học kỳ 2 một ngày)
    const edge = await post({ ...base, term2_starts_on: '2031-01-18', term2_ends_on: '2031-01-18' });
    expect(edge.status).toBe(201);
    // ngày sai định dạng
    expect((await post({ ...base, term1_ends_on: '16/01/2031' })).status).toBe(422);
  });

  test('sửa năm học: đặt học kỳ cho năm học chưa có học kỳ, đổi cả bộ, xóa học kỳ bằng null; đổi ngày năm học làm học kỳ lệch thì báo lỗi', async () => {
    const years = (await api('GET', '/api/admin/school-years')).body as Array<{ id: number; label: string }>;
    const legacy = years.find((y) => y.label === '2025-2026')!;
    const set = await api('PATCH', `/api/admin/school-years/${legacy.id}`, { term1_starts_on: '2025-09-05', term1_ends_on: '2026-01-17', term2_starts_on: '2026-01-19', term2_ends_on: '2026-05-31' });
    expect(set.status).toBe(200);
    expect(set.body).toMatchObject({ term1_ends_on: '2026-01-17', term2_starts_on: '2026-01-19' });
    // chỉ sửa tên/ngày năm học mà không gửi học kỳ: học kỳ giữ nguyên nếu còn nằm trong năm học
    expect((await api('PATCH', `/api/admin/school-years/${legacy.id}`, { ends_on: '2026-06-15' })).body).toMatchObject({ ends_on: '2026-06-15', term2_ends_on: '2026-05-31' });
    // rút ngày kết thúc năm học ngắn hơn học kỳ 2: lỗi
    const bad = await api('PATCH', `/api/admin/school-years/${legacy.id}`, { ends_on: '2026-05-20' });
    expect(bad.status).toBe(422);
    expect(String(bad.body.detail)).toMatch(/Học kỳ 2 phải kết thúc trước hoặc đúng ngày kết thúc năm học/);
    // gửi null cả bốn ô: xóa học kỳ
    const cleared = await api('PATCH', `/api/admin/school-years/${legacy.id}`, { term1_starts_on: null, term1_ends_on: null, term2_starts_on: null, term2_ends_on: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body).toMatchObject({ term1_starts_on: null, term2_ends_on: null });
    // gửi thiếu (chỉ một ô) bị từ chối
    expect((await api('PATCH', `/api/admin/school-years/${legacy.id}`, { term1_starts_on: '2025-09-05' })).status).toBe(422);
  });

  test('CSDL cũng chặn học kỳ sai kể cả khi ghi thẳng, và năm học cũ chưa có học kỳ vẫn hợp lệ', async () => {
    const insert = (cols: string, vals: string) => sql(s.url, `INSERT INTO app_school_years(school_id,label,starts_on,ends_on${cols}) VALUES(${schoolId},'2040-2041','2040-09-05','2041-05-31'${vals})`);
    await expect(insert(',term1_starts_on', ",'2040-09-05'")).rejects.toThrow(/app_school_years_terms_ok/);
    await expect(insert(',term1_starts_on,term1_ends_on,term2_starts_on,term2_ends_on', ",'2040-09-05','2041-01-16','2041-01-10','2041-05-31'")).rejects.toThrow(/app_school_years_terms_ok/);
    await expect(insert(',term1_starts_on,term1_ends_on,term2_starts_on,term2_ends_on', ",'2040-09-05','2041-01-16','2041-01-18','2041-06-30'")).rejects.toThrow(/app_school_years_terms_ok/);
    await insert('', '');
    expect((await sql(s.url, "SELECT term1_starts_on FROM app_school_years WHERE label='2040-2041'"))[0]).toEqual({ term1_starts_on: null });
  });

  test('năm học đã kết thúc không sửa học kỳ được; quản trị trường khác không đụng được năm học của trường này', async () => {
    const years = (await api('GET', '/api/admin/school-years')).body as Array<{ id: number; label: string; status: string }>;
    const active = years.find((y) => y.status === 'active')!;
    expect((await api('POST', `/api/admin/school-years/${active.id}/end`, {})).status).toBe(200);
    const ended = await api('PATCH', `/api/admin/school-years/${active.id}`, { ...TERMS, term1_ends_on: '2027-01-15' });
    expect(ended.status).toBe(409);
    const other = await call(s.base, 'POST', '/api/admin/schools', { name: 'THCS Trường Khác', city: 'Thành phố Hà Nội', admin: { full_name: 'Quản Trị Khác', email: 'qt.khac@example.edu.vn' } }, root);
    const otherAdmin = (await activate(s.base, other.body.admin.username, other.body.temporary_password, PW, 'school_admin')).token;
    expect((await call(s.base, 'PATCH', `/api/admin/school-years/${active.id}`, { ...TERMS }, otherAdmin)).status).toBe(404);
  });
});
