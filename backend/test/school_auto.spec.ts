import { activate, adminLogin, call, hasPostgres, sql, Started, startApp } from './harness';
import { createHash } from 'node:crypto';
import { directoryInfo } from '../src/admin/school-directory';

(hasPostgres() ? describe : describe.skip)('Mã trường tự sinh và liên kết danh mục', () => {
  let s: Started, root: string;
  const api = (method: string, path: string, body?: unknown, token = root) => call(s.base, method, path, body, token);
  const admin = (suffix: string) => ({ full_name: `Quản Trị ${suffix}`, email: `catalog-${suffix}@example.invalid` });
  beforeAll(async () => { s = await startApp('school_auto_test'); root = await adminLogin(s.base); });
  afterAll(async () => { await s?.close(); });

  test('xem mã kế tiếp không cấp số, không tạo trường/tài khoản và không cache phản hồi', async () => {
    const state = () => sql(s.url, `SELECT last_value::text, is_called,
      (SELECT count(*)::int FROM app_schools) AS schools,
      (SELECT count(*)::int FROM app_users) AS users FROM app_school_registration_code_seq`);
    const before = await state();
    for (let i = 0; i < 3; i++) {
      const result = await fetch(s.base + '/api/admin/school-code-preview', { headers: { Authorization: `Bearer ${root}` } });
      expect(result.status).toBe(200);
      expect(result.headers.get('cache-control')).toBe('no-store');
      expect(await result.json()).toEqual({ school_code: '00000001' });
    }
    expect(await state()).toEqual(before);
    expect((await api('GET', '/api/admin/school-code-preview', undefined, '')).status).toBe(401);
  });

  test('mã mới tăng dần, bỏ qua mã cũ trùng và không sửa mã/đường dẫn đã có', async () => {
    const legacy = await api('POST', '/api/admin/schools', { school_code: '00000001', name: 'Trường mã cũ', admin: admin('legacy') });
    expect(legacy.status).toBe(201);
    const before = legacy.body.school.link;
    expect((await api('GET', '/api/admin/school-code-preview')).body).toEqual({ school_code: '00000002' });
    const first = await api('POST', '/api/admin/schools', { name: 'Trường tự nhập A', admin: admin('auto-a') });
    expect(first.status).toBe(201);
    expect(first.body.school.school_code).toBe('00000002');
    const next = await api('POST', '/api/admin/schools', { name: 'Trường tự nhập B', admin: admin('auto-b') });
    expect(next.status).toBe(201);
    expect(next.body.school.school_code).toBe('00000003');
    expect(next.body.admin).toMatchObject({ role: 'school_admin', school_id: next.body.school.id, school_code: '00000003' });
    expect((await api('GET', `/api/admin/schools/${legacy.body.school.id}`)).body.link).toEqual(before);
  });

  test('mã xem trước không giữ chỗ: tạo đồng thời vẫn nhận mã riêng; quản trị trường không được xem bộ cấp mã', async () => {
    const preview = (await api('GET', '/api/admin/school-code-preview')).body.school_code;
    const results = await Promise.all(['preview-a', 'preview-b'].map(suffix => api('POST', '/api/admin/schools', { name: `Trường kiểm thử ${suffix}`, admin: admin(suffix) })));
    expect(results.map(r => r.status)).toEqual([201, 201]);
    const codes = results.map(r => r.body.school.school_code).sort();
    expect(codes).toEqual([preview, String(Number(preview) + 1).padStart(8, '0')]);
    expect((await api('GET', '/api/admin/school-code-preview')).body.school_code).toBe(String(Number(preview) + 2).padStart(8, '0'));
    const made = results[0].body;
    const schoolAdmin = await activate(s.base, made.admin.username, made.temporary_password, 'Preview@123', 'school_admin');
    expect((await api('GET', '/api/admin/school-code-preview', undefined, schoolAdmin.token)).status).toBe(403);
    const level2 = await api('POST', '/api/admin/users', { role: 'root_admin', admin_level: 2, full_name: 'Quản Trị Cấp Hai', email: 'preview-root2@example.invalid' });
    expect(level2.status).toBe(201);
    const secondRoot = await activate(s.base, level2.body.user.username, level2.body.temporary_password, 'Preview@456', 'root_admin');
    expect((await api('GET', '/api/admin/school-code-preview', undefined, secondRoot.token)).status).toBe(403);
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

  test('trường đã đăng ký bằng mã trước sáp nhập không bị tạo thêm qua mã hoặc tên mới', async () => {
    const legacy = (await api('POST', '/api/admin/schools', { name: 'Trường đã đăng ký từ trước', admin: admin('old-directory') })).body.school;
    await sql(s.url, 'UPDATE app_schools SET directory_code=$1 WHERE id=$2', ['01020513', legacy.id]);
    const found = await api('GET', '/api/admin/school-directory?q=01020513');
    expect(found.body.items[0]).toMatchObject({ code: 'hn-dongocdu-2026', exists: true });
    for (const directory_code of ['01020513', '01020514', 'hn-dongocdu-2026']) {
      expect((await api('POST', '/api/admin/schools', { directory_code, name: 'Trường trùng sau sáp nhập', admin: admin('should-not-exist') })).status).toBe(409);
    }
    const other = (await api('POST', '/api/admin/schools', { name: 'Trường khác', admin: admin('other-directory') })).body.school;
    expect((await api('PATCH', `/api/admin/schools/${other.id}`, { directory_code: 'hn-dongocdu-2026' })).status).toBe(409);
    expect((await api('GET', `/api/admin/schools/${legacy.id}`)).body).toMatchObject({ id: legacy.id, school_code: legacy.school_code, directory_code: '01020513' });
    expect((await call(s.base, 'GET', '/api/auth/school-link/' + legacy.link.slug)).status).toBe(200);
    expect((await api('GET', `/api/admin/users?school_id=${legacy.id}`)).body.total).toBe(1);
  });

  test('logo đã nén nằm trong PostgreSQL, tải riêng từng ảnh, có checksum và cache 304', async () => {
    const counts = (await sql<{ entries: number; assets: number }>(s.url, 'SELECT (SELECT count(*)::int FROM app_school_directory) AS entries, (SELECT count(*)::int FROM app_school_logo_assets) AS assets'))[0];
    expect(counts.entries).toBeGreaterThanOrEqual(directoryInfo().schools);
    expect(counts.assets).toBeGreaterThanOrEqual(422); // lịch sử asset không bị xóa khi danh mục đổi tên
    const choice = (await api('GET', '/api/admin/school-directory?q=79765507')).body.items[0];
    expect(choice).toMatchObject({ region: 'Phường Thạnh Mỹ Tây', address: '120B Ngô Tất Tố, phường Thạnh Mỹ Tây, Thành phố Hồ Chí Minh' });
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
    const oldUrl = `https://previous-api.example.invalid/api/school-logos/${'0'.repeat(64)}.webp`;
    await sql(s.url, 'UPDATE app_schools SET logo_url=$1 WHERE id=$2', [oldUrl, made.body.school.id]);
    expect((await api('GET', `/api/admin/schools/${made.body.school.id}`)).body.logo_url).toBe(choice.logo_url);
    expect((await call(s.base, 'GET', '/api/auth/school-link/' + made.body.school.link.slug)).body.logo_url).toBe(choice.logo_url);
    // Chỉ làm mới ảnh dẫn xuất trong response; không ghi đè ảnh trường tự cung cấp.
    const custom = 'https://school.example.invalid/custom-logo.webp';
    await sql(s.url, 'UPDATE app_schools SET logo_url=$1 WHERE id=$2', [custom, made.body.school.id]);
    expect((await api('GET', `/api/admin/schools/${made.body.school.id}`)).body.logo_url).toBe(custom);
    expect((await call(s.base, 'GET', '/api/auth/school-link/' + made.body.school.link.slug)).body.logo_url).toBe(custom);
  });

  test('hai trường có thể dùng một asset đã xác minh; không nhân đôi ảnh hoặc mở quyền bảng', async () => {
    const before = (await sql<{n:number}>(s.url, 'SELECT count(*)::int AS n FROM app_school_logo_assets'))[0].n;
    const asset = (await sql<{sha256: string}>(s.url, 'SELECT sha256 FROM app_school_logo_assets ORDER BY sha256 LIMIT 1'))[0];
    // Chỉ là dữ liệu kiểm thử dùng chung ảnh, không suy đoán tên trường trên production.
    await sql(s.url, 'UPDATE app_school_directory SET logo_sha256=$1,logo_source_url=$2 WHERE code=ANY($3::text[])', [asset.sha256, 'https://school.example.invalid/logo.webp', ['02000E04','011110759']]);
    const a = (await api('GET', '/api/admin/school-directory?q=02000E04')).body.items[0];
    const b = (await api('GET', '/api/admin/school-directory?q=011110759')).body.items[0];
    expect(a.logo_url).toBe(b.logo_url);
    expect((await sql<{n:number}>(s.url, 'SELECT count(*)::int AS n FROM app_school_logo_assets'))[0].n).toBe(before);
    expect((await sql(s.url, "SELECT tablename FROM pg_tables WHERE tablename IN ('app_school_logo_assets','app_school_directory') AND rowsecurity")).length).toBe(2);
    expect((await sql(s.url, "SELECT * FROM pg_policies WHERE tablename IN ('app_school_logo_assets','app_school_directory')")).length).toBe(0);
    await expect(sql(s.url, 'SET ROLE dong_a_school_scope; SELECT * FROM public.app_school_directory')).rejects.toThrow(/permission denied/);
  });

  test('liên kết trường cũ với danh mục giữ mã, tài khoản và đường dẫn cũ; chặn gán trùng', async () => {
    const before = (await api('GET', '/api/admin/schools?q=00000001')).body.items[0];
    const users = (await api('GET', `/api/admin/users?school_id=${before.id}`)).body.items;
    const updated = await api('PATCH', `/api/admin/schools/${before.id}`, { directory_code: '31303501', name: 'Tên không tin cậy', city: 'Sai địa bàn' });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ id: before.id, school_code: '00000001', directory_code: '31303501', city: 'Thành phố Hải Phòng' });
    expect(updated.body.name).not.toBe('Tên không tin cậy');
    expect(updated.body.logo_url).toMatch(/^https:\/\/.+\/api\/school-logos\/[a-f0-9]{64}\.webp$/);
    const afterUsers = (await api('GET', `/api/admin/users?school_id=${before.id}`)).body.items;
    const identity = (rows: any[]) => rows.map(({ city, region, school_name, ...account }) => account);
    expect(identity(afterUsers)).toEqual(identity(users));
    expect(afterUsers[0]).toMatchObject({ city: updated.body.city, region: updated.body.region, school_name: updated.body.name });
    expect((await call(s.base, 'GET', '/api/auth/school-link/' + before.link.slug)).status).toBe(200);
    expect((await api('POST', '/api/admin/schools', { directory_code: '31303501', name: 'Trường trùng', admin: admin('edit-duplicate') })).status).toBe(409);
    expect((await api('PATCH', `/api/admin/schools/${before.id}`, { directory_code: 'NO-SUCH-SCHOOL' })).status).toBe(422);
  });
});
