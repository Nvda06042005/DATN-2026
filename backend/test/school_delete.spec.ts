/**
 * Xóa trường (HK.AD.016) kèm toàn bộ dữ liệu của trường: tài khoản quản trị viên, giáo viên, học sinh, năm học, lớp, nội dung, tiến độ học.
 * Trường khác, quản trị tổng và nhật ký kiểm toán được giữ nguyên; lỗi giữa chừng thì không xóa gì cả.
 */
import { activate, adminLogin, call, hasPostgres, sql, Started, startApp } from './harness';

(hasPostgres() ? describe : describe.skip)('Xóa trường kèm toàn bộ dữ liệu', () => {
  let s: Started, root: string;
  const PW = 'Matkhau-12345';
  const api = (method: string, path: string, body?: unknown, token = root) => call(s.base, method, path, body, token);
  type School = Awaited<ReturnType<typeof makeSchool>>;

  /** Một trường có đủ dữ liệu: quản trị viên đã đăng nhập, năm học đang hoạt động, lớp, giáo viên, hai học sinh (một đã vào lớp), câu hỏi của trường, tiến độ, ghi chú */
  async function makeSchool(tag: string) {
    const made = await api('POST', '/api/admin/schools', { name: `THCS Thử ${tag}`, city: 'Thành phố Hà Nội', admin: { full_name: `Quản Trị ${tag}`, email: `qt.${tag}@example.edu.vn` } });
    expect(made.status).toBe(201);
    const id = made.body.school.id as number;
    const admin = await activate(s.base, made.body.admin.username, made.body.temporary_password, PW, 'school_admin');
    const year = (await api('POST', '/api/admin/school-years', { label: '2026-2027', starts_on: '2026-09-05', ends_on: '2027-05-31' }, admin.token)).body;
    await api('POST', `/api/admin/school-years/${year.id}/activate`, undefined, admin.token);
    const klass = (await api('POST', '/api/admin/classes', { year_id: year.id, grade: 7, name: '7A1' }, admin.token)).body;
    const t = await api('POST', '/api/admin/teachers', { full_name: `Cô Giáo ${tag}`, email: `gv.${tag}@example.edu.vn`, phone: '0900000021', birth_date: '1985-03-15' }, admin.token);
    const teacher = await activate(s.base, t.body.user.username, t.body.temporary_password, PW, 'teacher');
    const st1 = await api('POST', '/api/admin/students', { user_code: `HS-${tag}-1`, full_name: `Học Sinh ${tag} Một`, birth_date: '2013-04-02', phone: '0900000022', email: `tu.dong23.${tag}@example.edu.vn` }, admin.token);
    const student = await activate(s.base, st1.body.user.username, st1.body.temporary_password, PW, 'student');
    const st2 = await api('POST', '/api/admin/students', { user_code: `HS-${tag}-2`, full_name: `Học Sinh ${tag} Hai`, birth_date: '2013-05-03', phone: '0900000024', email: `tu.dong25.${tag}@example.edu.vn` }, admin.token);
    expect((await api('POST', '/api/student/join-class', { code: klass.join_code }, student.token)).status).toBeLessThan(300);
    await sql(s.url, `INSERT INTO app_progress(user_id, xp) VALUES (${student.user.id}, 120)`);
    await sql(s.url, `INSERT INTO hk_notes(user_id, ref_type, ref_id, body) VALUES (${student.user.id}, 'lesson', 1, 'Ghi chú của học sinh')`);
    await sql(s.url, `INSERT INTO hk_questions(scope, school_id, owner_id, qtype, prompt, data) VALUES ('school', ${id}, ${teacher.user.id}, 'single', 'Câu hỏi riêng của trường ${tag}', '{}'::jsonb)`);
    const users = (await sql<{ id: number }>(s.url, `SELECT id FROM app_users WHERE school_id = ${id} ORDER BY id`)).map((r) => r.id);
    return { id, admin, teacher, student, st2: st2.body.user.id as number, year: year.id as number, klass: klass.id as number, users };
  }

  const footprint = async (x: School) => ({
    users: (await sql(s.url, `SELECT 1 FROM app_users WHERE school_id = ${x.id}`)).length,
    years: (await sql(s.url, `SELECT 1 FROM app_school_years WHERE school_id = ${x.id}`)).length,
    classes: (await sql(s.url, `SELECT 1 FROM app_classes WHERE school_id = ${x.id}`)).length,
    members: (await sql(s.url, `SELECT 1 FROM app_class_members WHERE class_id = ${x.klass}`)).length,
    questions: (await sql(s.url, `SELECT 1 FROM hk_questions WHERE school_id = ${x.id}`)).length,
    progress: (await sql(s.url, `SELECT 1 FROM app_progress WHERE user_id = ANY(ARRAY[${x.users.join(',')}]::int[])`)).length,
    notes: (await sql(s.url, `SELECT 1 FROM hk_notes WHERE user_id = ANY(ARRAY[${x.users.join(',')}]::int[])`)).length,
    school: (await sql(s.url, `SELECT 1 FROM app_schools WHERE id = ${x.id}`)).length,
  });

  beforeAll(async () => {
    s = await startApp('school_delete_test');
    root = await adminLogin(s.base);
  });
  afterAll(async () => { await s?.close(); });

  test('trường đã có dữ liệu vẫn xóa được: mọi dữ liệu của trường đi theo; trường khác, quản trị tổng và người dùng ngoài trường giữ nguyên', async () => {
    const x = await makeSchool('xoa'), y = await makeSchool('giu');
    expect(x.users).toHaveLength(4);
    expect(await footprint(x)).toEqual({ users: 4, years: 1, classes: 1, members: 1, questions: 1, progress: 1, notes: 1, school: 1 });
    // quản trị tổng thứ hai bị gán nhầm school_id của trường: không bao giờ bị xóa; người dùng tự do (không thuộc trường) cũng giữ nguyên
    await sql(s.url, `INSERT INTO app_users(id,username,full_name,role,password_hash,school_id,is_active,created_at) VALUES (99001,'root.phu','Quản trị tổng phụ','root_admin','synthetic-hash',${x.id},1,'2026-11-08T00:00:00Z'),(99002,'tu.do','Người tự do','student','synthetic-hash',NULL,1,'2026-11-08T00:00:00Z')`);
    const before = await footprint(y);
    const rootsBefore = (await sql(s.url, "SELECT count(*)::int AS n FROM app_users WHERE role = 'root_admin'"))[0];

    const gone = await api('DELETE', `/api/admin/schools/${x.id}`);
    expect(gone.status).toBe(204);
    expect(await footprint(x)).toEqual({ users: 0, years: 0, classes: 0, members: 0, questions: 0, progress: 0, notes: 0, school: 0 });
    expect(await sql(s.url, `SELECT 1 FROM app_users WHERE id = ANY(ARRAY[${x.users.join(',')}]::int[])`)).toEqual([]);
    // không còn tài khoản mồ côi (role không phải quản trị tổng mà không thuộc trường) do xóa trường
    expect(await sql(s.url, "SELECT username FROM app_users WHERE school_id IS NULL AND role IN ('teacher','school_admin') ")).toEqual([]);
    // quản trị tổng (kể cả bị gán nhầm trường) và người tự do còn nguyên
    expect((await sql(s.url, "SELECT count(*)::int AS n FROM app_users WHERE role = 'root_admin'"))[0]).toEqual(rootsBefore);
    expect(await sql(s.url, 'SELECT username, school_id FROM app_users WHERE id IN (99001, 99002) ORDER BY id')).toEqual([{ username: 'root.phu', school_id: null }, { username: 'tu.do', school_id: null }]);
    // trường còn lại nguyên vẹn, phiên cũ của trường đã xóa không dùng được nữa
    expect(await footprint(y)).toEqual(before);
    for (const token of [x.admin.token, x.teacher.token, x.student.token]) expect((await call(s.base, 'GET', '/api/auth/me', undefined, token)).status).toBe(401);
    for (const token of [y.admin.token, y.teacher.token, y.student.token]) expect((await call(s.base, 'GET', '/api/auth/me', undefined, token)).status).toBe(200);
    expect((await api('GET', '/api/admin/schools')).body.items.map((i: { id: number }) => i.id)).toEqual(expect.not.arrayContaining([x.id]));
    // nhật ký kiểm toán giữ lại và nêu rõ tên trường, số tài khoản đã xóa
    const audit = await sql<{ action: string }>(s.url, "SELECT action FROM app_audit_events WHERE action LIKE 'Xóa trường%'");
    expect(audit.map((a) => a.action)).toEqual([expect.stringContaining('THCS Thử xoa')]);
    expect(audit[0].action).toContain('4 tài khoản');
  });

  test('xóa trường đã xóa trả 404; chỉ quản trị tổng được xóa; trường dùng thử vừa tạo (chưa ai đăng nhập) cũng xóa được', async () => {
    const z = await makeSchool('khac');
    for (const token of [z.admin.token, z.teacher.token, z.student.token]) expect((await api('DELETE', `/api/admin/schools/${z.id}`, undefined, token)).status).toBe(403);
    expect(await footprint(z)).toMatchObject({ school: 1, users: 4 });
    expect((await api('DELETE', `/api/admin/schools/${z.id}`)).status).toBe(204);
    expect((await api('DELETE', `/api/admin/schools/${z.id}`)).status).toBe(404);
    const fresh = await api('POST', '/api/admin/schools', { name: 'THCS Mới Tạo', city: 'Thành phố Hà Nội', admin: { full_name: 'Chưa Dùng', email: 'chuadung.moi@example.edu.vn' } });
    expect((await api('DELETE', `/api/admin/schools/${fresh.body.school.id}`)).status).toBe(204);
    expect(await sql(s.url, "SELECT 1 FROM app_users WHERE email = 'chuadung.moi@example.edu.vn'")).toEqual([]);
  });

  test('lỗi giữa chừng thì không xóa gì cả (một giao dịch)', async () => {
    const w = await makeSchool('loi');
    await sql(s.url, `CREATE FUNCTION chan_xoa_truong() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'chặn thử'; END $$;
      CREATE TRIGGER chan_xoa_truong BEFORE DELETE ON app_schools FOR EACH ROW EXECUTE FUNCTION chan_xoa_truong()`);
    try {
      const failed = await api('DELETE', `/api/admin/schools/${w.id}`);
      expect(failed.status).toBeGreaterThanOrEqual(500);
      expect(await footprint(w)).toEqual({ users: 4, years: 1, classes: 1, members: 1, questions: 1, progress: 1, notes: 1, school: 1 });
      expect((await call(s.base, 'GET', '/api/auth/me', undefined, w.student.token)).status).toBe(200);
    } finally {
      await sql(s.url, 'DROP TRIGGER chan_xoa_truong ON app_schools; DROP FUNCTION chan_xoa_truong()');
    }
    expect((await api('DELETE', `/api/admin/schools/${w.id}`)).status).toBe(204);
  });
});
