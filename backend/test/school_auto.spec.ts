import { adminLogin, call, hasPostgres, sql, Started, startApp } from './harness';
import { createHash } from 'node:crypto';

(hasPostgres() ? describe : describe.skip)('Mã trường tự sinh và liên kết danh mục', () => {
  let s: Started, root: string;
  const api = (method: string, path: string, body?: unknown, token = root) => call(s.base, method, path, body, token);
  const admin = (suffix: string) => ({ full_name: `Quản Trị ${suffix}`, email: `catalog-${suffix}@example.invalid` });
  beforeAll(async () => { s = await startApp('school_auto_test'); root = await adminLogin(s.base); });
  afterAll(async () => { await s?.close(); });

  test('mã mới tăng dần, bỏ qua mã cũ trùng và không sửa mã/đường dẫn đã có', async () => {
    const legacy = await api('POST', '/api/admin/schools', { school_code: '00000001', name: 'Trường mã cũ', admin: admin('legacy') });
    expect(legacy.status).toBe(201);
    const before = legacy.body.school.link;
    const first = await api('POST', '/api/admin/schools', { name: 'Trường tự nhập A', admin: admin('auto-a') });
    expect(first.status).toBe(201);
    expect(first.body.school.school_code).toBe('00000002');
    const next = await api('POST', '/api/admin/schools', { name: 'Trường tự nhập B', admin: admin('auto-b') });
    expect(next.status).toBe(201);
    expect(next.body.school.school_code).toBe('00000003');
    expect(next.body.admin).toMatchObject({ role: 'school_admin', school_id: next.body.school.id, school_code: '00000003' });
    expect((await api('GET', `/api/admin/schools/${legacy.body.school.id}`)).body.link).toEqual(before);
  });

  test('mã tham chiếu dài không làm hỏng mã đăng nhập; tên và khu vực lấy từ danh mục máy chủ', async () => {
    const made = await api('POST', '/api/admin/schools', { directory_code: '011110759', name: 'Tên bị sửa ở client', city: 'Địa bàn giả', admin: admin('long-code') });
    expect(made.status).toBe(201);
    expect(made.body.school).toMatchObject({ directory_code: '011110759', city: 'Thành phố Hà Nội' });
    expect(made.body.school.name).toContain('Vinschool');
    expect(made.body.school.school_code).toMatch(/^\d{8}$/);
    expect(made.body.school.school_code).not.toBe('011110759');
    expect(made.body.school.link.path).toContain(`/donga_${made.body.school.school_code}_`);
    const search = await api('GET', '/api/admin/school-directory?q=011110759');
    expect(search.body.items[0]).toMatchObject({ code: '011110759', exists: true });
    const users = await api('GET', `/api/admin/users?school_id=${made.body.school.id}`);
    expect(users.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ role: 'school_admin', email: 'catalog-long-code@example.invalid' })]));
  });

  test('hai yêu cầu cùng chọn một trường: chỉ tạo một trường và một tài khoản quản trị', async () => {
    const results = await Promise.all(['race-a', 'race-b'].map(suffix => api('POST', '/api/admin/schools', { directory_code: '02000E04', name: 'Trường từ danh mục', admin: admin(suffix) })));
    expect(results.map(result => result.status).sort()).toEqual([201, 409]);
    const created = results.find(result => result.status === 201)!.body;
    const users = await api('GET', `/api/admin/users?school_id=${created.school.id}`);
    expect(users.body.total).toBe(1);
    expect((await api('GET', '/api/admin/schools?q=02000E04')).body.total).toBe(1);
  });

  test('tên cũ sau sáp nhập trỏ tới trường mới; tìm không dấu và tìm theo chữ viết tắt', async () => {
    const created = await api('POST', '/api/admin/schools', { directory_code: '31311522', name: 'THCS Minh Đức', admin: admin('merged') });
    expect(created.status).toBe(201);
    expect(created.body.school).toMatchObject({ directory_code: 'hp-tranquocbao-2026', name: 'Trường THCS Trần Quốc Bảo', region: 'Phường Bạch Đằng' });
    expect((await api('GET', '/api/admin/schools?q=tran%20quoc%20bao')).body.items.some((item: any) => item.id === created.body.school.id)).toBe(true);
    expect((await api('GET', '/api/admin/schools?q=T,Q,B')).body.items.some((item: any) => item.id === created.body.school.id)).toBe(true);
    expect((await api('POST', '/api/admin/schools', { directory_code: 'hp-tranquocbao-2026', name: 'Trường trùng', admin: admin('duplicate') })).status).toBe(409);
  });

  test('danh mục không tạo trường hàng loạt; mã không có trong nguồn bị từ chối', async () => {
    const before = await api('GET', '/api/admin/schools');
    expect((await api('GET', '/api/admin/school-directory?q=T,S')).body.items.length).toBeGreaterThan(0);
    expect((await api('GET', '/api/admin/schools')).body.total).toBe(before.body.total);
    expect((await api('POST', '/api/admin/schools', { directory_code: 'NOT-A-SCHOOL', name: 'Trường không tồn tại', admin: admin('invalid') })).status).toBe(422);
    expect((await api('GET', '/api/admin/school-directory', undefined, '')).status).toBe(401);
  });

  test('logo đã nén nằm trong PostgreSQL, tải riêng từng ảnh, có checksum và cache 304', async () => {
    const counts = (await sql<{ entries: number; assets: number }>(s.url, 'SELECT (SELECT count(*)::int FROM app_school_directory) AS entries, (SELECT count(*)::int FROM app_school_logo_assets) AS assets'))[0];
    expect(counts.entries).toBe(11371);
    expect(counts.assets).toBe(422);
    const choice = (await api('GET', '/api/admin/school-directory?q=79765507')).body.items[0];
    expect(choice.logo_url).toMatch(/^https:\/\/[^/]+\/api\/school-logos\/[a-f0-9]{64}\.webp$/);
    const logoPath = new URL(choice.logo_url).pathname;
    expect(choice.image_data).toBeUndefined();
    const response = await fetch(s.base + logoPath);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/webp');
    expect(response.headers.get('cache-control')).toContain('immutable');
    const image = Buffer.from(await response.arrayBuffer());
    expect(image.subarray(8, 12).toString()).toBe('WEBP');
    expect(image.length).toBeLessThan(81920);
    const hash = createHash('sha256').update(image).digest('hex');
    expect(choice.logo_url).toContain(hash);
    expect((await fetch(s.base + logoPath, { headers: { 'If-None-Match': `"${hash}"` } })).status).toBe(304);
    expect((await fetch(s.base + '/api/school-logos/not-a-hash.webp')).status).toBe(404);
    expect((await fetch(s.base + '/api/school-logos/' + '0'.repeat(64) + '.webp')).status).toBe(404);
    const made = await api('POST', '/api/admin/schools', { directory_code: choice.code, name: choice.name, admin: admin('logo') });
    expect(made.status).toBe(201);
    expect(made.body.school.logo_url).toBe(choice.logo_url);
  });

  test('hai trường có thể dùng một asset đã xác minh; không nhân đôi ảnh hoặc mở quyền bảng', async () => {
    const asset = (await sql<{sha256: string}>(s.url, 'SELECT sha256 FROM app_school_logo_assets ORDER BY sha256 LIMIT 1'))[0];
    // Chỉ là dữ liệu kiểm thử dùng chung ảnh, không suy đoán tên trường trên production.
    await sql(s.url, 'UPDATE app_school_directory SET logo_sha256=$1,logo_source_url=$2 WHERE code=ANY($3::text[])', [asset.sha256, 'https://school.example.invalid/logo.webp', ['02000E04','011110759']]);
    const a = (await api('GET', '/api/admin/school-directory?q=02000E04')).body.items[0];
    const b = (await api('GET', '/api/admin/school-directory?q=011110759')).body.items[0];
    expect(a.logo_url).toBe(b.logo_url);
    expect((await sql<{n:number}>(s.url, 'SELECT count(*)::int AS n FROM app_school_logo_assets'))[0].n).toBe(422);
    expect((await sql(s.url, "SELECT tablename FROM pg_tables WHERE tablename IN ('app_school_logo_assets','app_school_directory') AND rowsecurity")).length).toBe(2);
    expect((await sql(s.url, "SELECT * FROM pg_policies WHERE tablename IN ('app_school_logo_assets','app_school_directory')")).length).toBe(0);
    await expect(sql(s.url, 'SET ROLE dong_a_school_scope; SELECT * FROM public.app_school_directory')).rejects.toThrow(/permission denied/);
  });
});
