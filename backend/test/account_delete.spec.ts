/** Xóa từng tài khoản: HTTP/RBAC thật, PostgreSQL tạm; không dùng tài khoản hoặc gửi thư production. */
import { activate, adminLogin, call, hasPostgres, sql, Started, startApp } from './harness';

(hasPostgres() ? describe : describe.skip)('Quản trị tổng xóa từng tài khoản đã có dữ liệu', () => {
  let s: Started, root: string, rootId: number, serial = 0;
  const PW = 'Fixture-123!';
  const api = (method: string, path: string, body?: unknown, token = root) => call(s.base, method, path, body, token);
  type School = Awaited<ReturnType<typeof makeSchool>>;
  let a: School, b: School;

  async function makeSchool(tag: string) {
    const made = await api('POST', '/api/admin/schools', { name: `THCS Kiểm thử ${tag}`, admin: { full_name: `Quản trị ${tag}`, email: `qt.${tag}@example.invalid` } });
    expect(made.status).toBe(201);
    const admin = await activate(s.base, made.body.admin.username, made.body.temporary_password, PW, 'school_admin');
    expect(admin.token).toBeTruthy();
    const year = await api('POST', '/api/admin/school-years', { label: '2026-2027' }, admin.token);
    expect(year.status).toBe(201);
    expect((await api('POST', `/api/admin/school-years/${year.body.id}/activate`, undefined, admin.token)).status).toBe(200);
    const klass = await api('POST', '/api/admin/classes', { year_id: year.body.id, grade: 7, name: '7A1' }, admin.token);
    expect(klass.status).toBe(201);
    return { id: made.body.school.id as number, admin, year: year.body.id as number, klass: klass.body.id as number };
  }

  async function member(role: 'teacher' | 'student' | 'school_admin', school = a) {
    const n = ++serial, full_name = `Tài khoản kiểm thử ${n}`, email = `account.${n}@example.invalid`;
    const made = role === 'school_admin'
      ? await api('POST', '/api/admin/users', { full_name, email, role, school_id: school.id })
      : await api('POST', `/api/admin/${role === 'teacher' ? 'teachers' : 'students'}`, { full_name, email, user_code: `USER-${n}`, birth_date: '2013-04-02' }, school.admin.token);
    expect(made.status).toBe(201);
    return made.body as { user: { id: number; username: string; full_name: string }; temporary_password: string };
  }

  const footprint = async (id: number) => ({
    user: (await sql(s.url, 'SELECT id FROM app_users WHERE id=$1', [id])).length,
    progress: (await sql(s.url, 'SELECT user_id FROM app_progress WHERE user_id=$1', [id])).length,
    notes: (await sql(s.url, 'SELECT user_id FROM hk_notes WHERE user_id=$1', [id])).length,
    members: (await sql(s.url, 'SELECT user_id FROM app_class_members WHERE user_id=$1', [id])).length,
  });

  beforeAll(async () => {
    s = await startApp('account_delete_test'); root = await adminLogin(s.base);
    rootId = (await api('GET', '/api/auth/me')).body.id;
    a = await makeSchool('xoa-tai-khoan-a'); b = await makeSchool('xoa-tai-khoan-b');
  });
  afterAll(async () => { await s?.close(); });

  test.each(['school_admin', 'teacher', 'student'] as const)('xóa %s đã đăng nhập và có dữ liệu: thu hồi phiên, giữ trường/lớp/người khác và nhật ký', async role => {
    const made = await member(role), id = made.user.id;
    const session = await activate(s.base, made.user.username, made.temporary_password, PW, role);
    await sql(s.url, 'INSERT INTO app_progress(user_id,xp) VALUES($1,120)', [id]);
    await sql(s.url, "INSERT INTO hk_notes(user_id,ref_type,ref_id,body) VALUES($1,'lesson',1,'Ghi chú kiểm thử')", [id]);
    if (role === 'teacher') {
      expect((await api('PATCH', `/api/admin/classes/${a.klass}`, { teacher_ids: [id] }, a.admin.token)).status).toBe(200);
      await sql(s.url, 'UPDATE app_classes SET teacher_id=$1 WHERE id=$2', [id, a.klass]);
    }
    if (role === 'student') expect((await api('POST', `/api/admin/classes/${a.klass}/members`, { student_ids: [id] }, a.admin.token)).status).toBe(200);
    const question = await sql<{ id: number }>(s.url, "INSERT INTO hk_questions(scope,school_id,owner_id,qtype,prompt,data) VALUES('school',$1,$2,'single','Nội dung dùng chung của trường','{}') RETURNING id", [a.id, id]);
    const before = (await sql(s.url, 'SELECT id,name,year_id FROM app_classes WHERE id=$1', [a.klass]))[0];
    expect((await api('GET', `/api/admin/users/${id}`)).body).toMatchObject({ deletable: true, delete_blocker: null });
    expect((await api('DELETE', `/api/admin/users/${id}`)).status).toBe(204);
    expect(await footprint(id)).toEqual({ user: 0, progress: 0, notes: 0, members: 0 });
    expect((await api('GET', `/api/admin/users/${id}`)).status).toBe(404);
    expect((await api('DELETE', `/api/admin/users/${id}`)).status).toBe(404);
    expect((await api('GET', '/api/auth/me', undefined, session.token)).status).toBe(401);
    expect((await api('POST', '/api/auth/login', { username: made.user.username, password: PW, portal: role }, '')).status).toBe(401);
    expect((await sql(s.url, 'SELECT id,name,year_id FROM app_classes WHERE id=$1', [a.klass]))[0]).toEqual(before);
    expect((await sql(s.url, 'SELECT id FROM app_schools WHERE id=ANY($1::int[])', [[a.id, b.id]]))).toHaveLength(2);
    expect((await api('GET', '/api/auth/me', undefined, a.admin.token)).status).toBe(200);
    expect((await api('GET', '/api/auth/me', undefined, b.admin.token)).status).toBe(200);
    expect(await sql(s.url, 'SELECT owner_id FROM hk_questions WHERE id=$1', [question[0].id])).toEqual([{ owner_id: null }]);
    expect(await sql(s.url, 'SELECT teacher_id FROM app_class_teachers WHERE teacher_id=$1', [id])).toEqual([]);
    if (role === 'teacher') expect(await sql(s.url, 'SELECT teacher_id FROM app_classes WHERE id=$1', [a.klass])).toEqual([{ teacher_id: null }]);
    const audit = await sql<{ actor_id: number; action: string }>(s.url, "SELECT actor_id,action FROM app_audit_events WHERE target_id=$1 AND action LIKE 'Xóa tài khoản%'", [String(id)]);
    expect(audit).toHaveLength(1); expect(audit[0].actor_id).toBe(rootId); expect(audit[0].action).toContain(made.user.username);
    expect(JSON.stringify(audit)).not.toContain(made.temporary_password);
    expect(await sql(s.url, 'SELECT user_id FROM app_login_events WHERE username=$1 AND success', [made.user.username])).toEqual(expect.arrayContaining([{ user_id: null }]));
  });

  test('tài khoản chưa dùng hoặc đã khóa cũng xóa được; không cần xóa cả trường', async () => {
    for (const locked of [false, true]) {
      const made = await member('school_admin');
      if (locked) expect((await api('POST', `/api/admin/users/${made.user.id}/lock`, { locked: true, reason: 'Kiểm thử' })).status).toBe(200);
      expect((await api('GET', `/api/admin/users/${made.user.id}`)).body.deletable).toBe(true);
      expect((await api('DELETE', `/api/admin/users/${made.user.id}`)).status).toBe(204);
    }
    expect((await api('GET', `/api/admin/schools/${a.id}`)).status).toBe(200);
  });

  test('chặn tự xóa và quản trị tổng cấp 2 xóa quản trị tổng; cấp 1 được xóa quản trị tổng khác', async () => {
    const made = await api('POST', '/api/admin/users', { full_name: 'Quản trị tổng kiểm thử', email: 'root.delete@example.invalid', role: 'root_admin', admin_level: 2 });
    expect(made.status).toBe(201);
    const other = await activate(s.base, made.body.user.username, made.body.temporary_password, PW, 'root_admin');
    expect((await api('GET', `/api/admin/users/${rootId}`)).body.deletable).toBe(false);
    expect((await api('DELETE', `/api/admin/users/${rootId}`)).status).toBe(400);
    expect((await api('GET', `/api/admin/users/${rootId}`, undefined, other.token)).body.deletable).toBe(false);
    expect((await api('DELETE', `/api/admin/users/${rootId}`, undefined, other.token)).status).toBe(403);
    expect((await api('DELETE', `/api/admin/users/${other.user.id}`, undefined, other.token)).status).toBe(400);
    expect((await api('DELETE', `/api/admin/users/${other.user.id}`)).status).toBe(204);
    expect((await api('GET', '/api/auth/me', undefined, other.token)).status).toBe(401);
  });

  test('không nâng quyền cho quản trị trường, giáo viên, học sinh; không nhận trường/id giả hoặc phiên không hợp lệ', async () => {
    const target = await member('teacher'), st = await member('student'), gv = await member('teacher');
    const student = await activate(s.base, st.user.username, st.temporary_password, PW, 'student');
    const teacher = await activate(s.base, gv.user.username, gv.temporary_password, PW, 'teacher');
    for (const token of ['', 'token.gia']) expect((await api('DELETE', `/api/admin/users/${target.user.id}`, undefined, token)).status).toBe(401);
    for (const token of [student.token, teacher.token]) expect((await api('DELETE', `/api/admin/users/${target.user.id}`, undefined, token)).status).toBe(403);
    expect((await api('DELETE', `/api/admin/users/${target.user.id}?school_id=${a.id}`, undefined, b.admin.token)).status).toBe(404);
    expect((await api('DELETE', `/api/admin/users/${a.admin.user.id}`, undefined, a.admin.token)).status).toBe(400);
    const extraAdmin = await member('school_admin');
    expect((await api('DELETE', `/api/admin/users/${extraAdmin.user.id}`, undefined, a.admin.token)).status).toBe(403);
    expect((await api('GET', `/api/admin/users/${target.user.id}`)).status).toBe(200);
    expect((await api('DELETE', '/api/admin/users/99999999')).status).toBe(404);
  });

  test('quản trị trường: tài khoản đã đăng nhập/có tiến độ/phụ trách lớp vẫn bị chặn; tài khoản chưa dùng xóa được', async () => {
    for (const kind of ['login', 'progress', 'teaching', 'unused'] as const) {
      const made = await member('teacher'), id = made.user.id;
      if (kind === 'login') await activate(s.base, made.user.username, made.temporary_password, PW, 'teacher');
      if (kind === 'progress') await sql(s.url, 'INSERT INTO app_progress(user_id,xp) VALUES($1,10)', [id]);
      if (kind === 'teaching') await api('PATCH', `/api/admin/classes/${a.klass}`, { teacher_ids: [id] }, a.admin.token);
      const detail = await api('GET', `/api/admin/users/${id}`, undefined, a.admin.token);
      expect(detail.body.deletable).toBe(kind === 'unused');
      expect((await api('DELETE', `/api/admin/users/${id}`, undefined, a.admin.token)).status).toBe(kind === 'unused' ? 204 : 409);
    }
  });

  test('không xóa dở dang nếu ghi nhật ký lỗi; các bảng và phiên của tài khoản được khôi phục cùng giao dịch', async () => {
    const made = await member('student'), id = made.user.id;
    const session = await activate(s.base, made.user.username, made.temporary_password, PW, 'student');
    await sql(s.url, 'INSERT INTO app_progress(user_id,xp) VALUES($1,10)', [id]);
    await sql(s.url, "INSERT INTO hk_notes(user_id,ref_type,ref_id,body) VALUES($1,'lesson',1,'Giữ nguyên')", [id]);
    const before = await footprint(id);
    await sql(s.url, `CREATE FUNCTION fail_account_delete_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action LIKE 'Xóa tài khoản%' THEN RAISE EXCEPTION 'audit rollback fixture'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER fail_account_delete_audit BEFORE INSERT ON app_audit_events FOR EACH ROW EXECUTE FUNCTION fail_account_delete_audit()`);
    try {
      expect((await api('DELETE', `/api/admin/users/${id}`)).status).toBe(500);
      expect(await footprint(id)).toEqual(before);
      expect((await api('GET', '/api/auth/me', undefined, session.token)).status).toBe(200);
    } finally { await sql(s.url, 'DROP TRIGGER fail_account_delete_audit ON app_audit_events; DROP FUNCTION fail_account_delete_audit()'); }
    expect((await api('DELETE', `/api/admin/users/${id}`)).status).toBe(204);
  });

  test('hai yêu cầu xóa đồng thời: một thành công, một 404; chỉ một nhật ký xóa chi tiết', async () => {
    const made = await member('teacher'), id = made.user.id;
    const responses = await Promise.all([api('DELETE', `/api/admin/users/${id}`), api('DELETE', `/api/admin/users/${id}`)]);
    expect(responses.map(r => r.status).sort()).toEqual([204, 404]);
    expect(await sql(s.url, "SELECT id FROM app_audit_events WHERE action LIKE 'Xóa tài khoản%' AND target_id=$1", [String(id)])).toHaveLength(1);
  });
});
