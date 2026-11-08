/** Kho đã xóa một năm: HTTP thật của cả bốn vai trò, CASCADE, RLS, bí mật, rollback, hết hạn; chỉ PostgreSQL tạm. */
import { adminLogin, call, hasPostgres, sql, Started, startApp } from './harness';
import { bootstrap, Fixture } from './fixture';

(hasPostgres() ? describe : describe.skip)('Kho dữ liệu đã xóa một năm', () => {
  let s: Started, f: Fixture;
  const api = (method: string, path: string, body?: unknown, token?: string) => call(s.base, method, path, body, token ?? f.root);
  const archived = (table: string, key: Record<string, unknown>) => sql<any>(s.url, 'SELECT * FROM app_deleted_records WHERE source_table=$1 AND record_key @> $2::jsonb ORDER BY id', [table, JSON.stringify(key)]);
  beforeAll(async () => { s = await startApp('deleted_archive_test'); f = await bootstrap(s, await adminLogin(s.base), true); });
  afterAll(async () => { await s?.close(); });

  test('migration 052 cài trigger mọi bảng nghiệp vụ, không tạo API đọc kho; RLS không cho vai trò ứng dụng xem/ghi/gọi hàm quản trị', async () => {
    const missing = await sql(s.url, `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' AND (c.relname LIKE 'app\_%' ESCAPE '\' OR c.relname LIKE 'hk\_%' ESCAPE '\' OR c.relname LIKE 'hist\_%' ESCAPE '\')
      AND c.relname<>ALL(ARRAY['app_deleted_records','app_schema_migrations','app_revoked_tokens','app_password_resets','app_signup_otps','app_email_outbox','hk_two_factor','hk_two_factor_codes','hk_job_heartbeats','hk_ai_chunks','hk_recommendations'])
      AND NOT EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid=c.oid AND t.tgname='archive_before_delete' AND NOT t.tgisinternal)`);
    expect(missing).toEqual([]);
    expect((await sql(s.url, "SELECT relrowsecurity FROM pg_class WHERE oid='app_deleted_records'::regclass"))[0]).toEqual({ relrowsecurity: true });
    for (const role of ['dong_a_school_scope', 'dong_a_workspace_scope']) {
      expect((await sql(s.url, "SELECT has_table_privilege($1,'app_deleted_records','SELECT') AS read,has_table_privilege($1,'app_deleted_records','INSERT') AS write,has_function_privilege($1,'app_purge_deleted_records()','EXECUTE') AS purge,has_function_privilege($1,'app_install_delete_archives()','EXECUTE') AS install", [role]))[0]).toEqual({ read: false, write: false, purge: false, install: false });
      await expect(sql(s.url, `BEGIN; SET LOCAL ROLE ${role}; SELECT * FROM public.app_deleted_records`)).rejects.toThrow(/permission denied/);
    }
    expect((await api('GET', '/api/database/health', undefined, '')).body).toMatchObject({ schema_version: 52, deletion_archive: { enabled: true, retention_years: 1, backend_fallback: true } });
    expect((await api('GET', '/api/admin/deleted-records')).status).toBe(404);
  });

  test.each(['root_admin','school_admin','teacher','student'])('xóa thông báo bằng POST của %s: đúng danh tính, giữ dữ liệu trước xóa và hết hạn sau một năm', async role => {
    const person = role === 'root_admin' ? { id: (await api('GET', '/api/auth/me')).body.id, token: f.root } : role === 'school_admin' ? f.A : role === 'teacher' ? f.T1 : f.S1;
    const n = (await sql<{ id: number }>(s.url, "INSERT INTO app_notifications(user_id,school_id,kind,title,body) VALUES($1,$2,'system','Thông báo kiểm thử','Nội dung trước xóa') RETURNING id", [person.id, role === 'root_admin' ? null : f.A.schoolId]))[0];
    expect((await api('POST', '/api/platform/notices/delete?actor_id=9999', { ids: [n.id], actor_id: 9999, actor_role: 'root_admin' }, person.token)).status).toBe(200);
    expect(await sql(s.url, 'SELECT id FROM app_notifications WHERE id=$1', [n.id])).toEqual([]);
    const rows = await archived('app_notifications', { id: n.id }); expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actor_id: person.id, actor_role: role, delete_kind: 'delete', row_data: { body: 'Nội dung trước xóa' } });
    expect(rows[0].route).toBe('POST /api/platform/notices/delete');
    expect((await sql(s.url, 'SELECT expires_at=deleted_at+interval \'1 year\' AS valid FROM app_deleted_records WHERE id=$1', [rows[0].id]))[0]).toEqual({ valid: true });
  });

  test('giáo viên xóa nội dung riêng bằng workspace; học sinh xóa ghi chú có khóa ghép; không rò nội dung sang trường khác', async () => {
    const q = (await sql<{ id: number }>(s.url, "INSERT INTO hk_questions(scope,school_id,owner_id,qtype,prompt,data) VALUES('teacher',$1,$2,'single','Câu hỏi lưu kho','{}') RETURNING id", [f.A.schoolId, f.T1.id]))[0];
    expect((await api('DELETE', `/api/content/questions/${q.id}`, undefined, f.TB.token)).status).toBe(404);
    expect(await archived('hk_questions', { id: q.id })).toEqual([]);
    expect((await api('DELETE', `/api/content/questions/${q.id}`, undefined, f.T1.token)).status).toBe(204);
    expect((await archived('hk_questions', { id: q.id }))[0]).toMatchObject({ actor_id: f.T1.id, school_id: f.A.schoolId, row_data: { prompt: 'Câu hỏi lưu kho' } });
    await sql(s.url, "INSERT INTO hk_notes(user_id,ref_type,ref_id,body) VALUES($1,'lesson',99999,'Ghi chú cần kiểm tra')", [f.S1.id]);
    expect((await api('DELETE', '/api/play/notes/lesson/99999', undefined, f.S2.token)).status).toBe(204);
    expect(await archived('hk_notes', { user_id: f.S1.id, ref_type: 'lesson', ref_id: 99999 })).toEqual([]);
    expect((await api('DELETE', '/api/play/notes/lesson/99999', undefined, f.S1.token)).status).toBe(204);
    const note = (await archived('hk_notes', { user_id: f.S1.id, ref_type: 'lesson', ref_id: 99999 }))[0];
    expect(note.row_data.body).toBe('Ghi chú cần kiểm tra'); expect(note.actor_role).toBe('student');
  });

  test('xóa tài khoản có dữ liệu lưu cả CASCADE; cùng operation_id, không giữ mật khẩu/hash/OTP; phiên cũ vẫn bị thu hồi', async () => {
    await sql(s.url, 'INSERT INTO app_progress(user_id,xp) VALUES($1,222)', [f.S3.id]);
    await sql(s.url, "INSERT INTO hk_notes(user_id,ref_type,ref_id,body) VALUES($1,'lesson',1,'Ghi chú xóa dây chuyền')", [f.S3.id]);
    const before = (await sql(s.url, 'SELECT full_name,password_hash FROM app_users WHERE id=$1', [f.S3.id]))[0];
    expect((await api('DELETE', `/api/admin/users/${f.S3.id}`)).status).toBe(204);
    const account = (await archived('app_users', { id: f.S3.id }))[0]; expect(account.row_data.full_name).toBe(before.full_name);
    expect(account.row_data.password_hash).toBeUndefined(); expect(JSON.stringify(account)).not.toContain(before.password_hash);
    const children = await sql<{ source_table: string }>(s.url, 'SELECT source_table FROM app_deleted_records WHERE operation_id=$1', [account.operation_id]);
    expect(children.map(r => r.source_table)).toEqual(expect.arrayContaining(['app_progress','app_users','hk_notes']));
    expect((await api('GET', '/api/auth/me', undefined, f.S3.token)).status).toBe(401);
    expect((await api('GET', '/api/admin/schools/' + f.A.schoolId)).status).toBe(200);
    expect(await sql(s.url, "SELECT source_table FROM app_deleted_records WHERE source_table IN ('app_password_resets','app_signup_otps','app_email_outbox','hk_two_factor','hk_two_factor_codes','app_revoked_tokens')")).toEqual([]);
    const redacted = (await sql<{ v: any }>(s.url, `SELECT app_archive_redact($1::jsonb) AS v`, [JSON.stringify({ title: 'giữ', password: 'secret', deep: [{ api_key_enc: 'secret', otp: '123456', content: 'giữ nội dung' }], access_token: 'secret' })]))[0].v;
    expect(redacted).toEqual({ title: 'giữ', deep: [{ content: 'giữ nội dung' }] });
  });

  test('hội thoại AI xóa mềm lưu cả tin nhắn/báo cáo; dọn sau một năm xóa cả bản gốc ẩn mà không tạo kho mới', async () => {
    const c = (await sql<{ id: number }>(s.url, "INSERT INTO hk_ai_conversations(user_id,title) VALUES($1,'Hội thoại cần giữ') RETURNING id::int", [f.S1.id]))[0];
    const m = (await sql<{ id: number }>(s.url, "INSERT INTO hk_ai_messages(conversation_id,role,content) VALUES($1,'assistant','Nội dung hội thoại') RETURNING id::int", [c.id]))[0];
    await sql(s.url, "INSERT INTO hk_ai_reports(message_id,user_id,reason) VALUES($1,$2,'Kiểm tra nội dung')", [m.id, f.S1.id]);
    expect((await api('DELETE', `/api/ai/conversations/${c.id}`, undefined, f.S2.token)).status).toBe(404);
    expect((await api('DELETE', `/api/ai/conversations/${c.id}`, undefined, f.S1.token)).status).toBe(204);
    const record = (await archived('hk_ai_conversations', { id: c.id }))[0];
    expect(record.delete_kind).toBe('soft_delete'); expect(record.related_data.hk_ai_messages[0].content).toBe('Nội dung hội thoại');
    expect(record.related_data.hk_ai_reports).toHaveLength(1);
    expect((await api('GET', `/api/ai/conversations/${c.id}`, undefined, f.S1.token)).status).toBe(404);
    await sql(s.url, "UPDATE hk_ai_conversations SET deleted_at=now()-interval '1 year 1 day' WHERE id=$1", [c.id]);
    await sql(s.url, "UPDATE app_deleted_records SET deleted_at=now()-interval '1 year 1 day',expires_at=now()-interval '1 day' WHERE id=$1", [record.id]);
    await sql(s.url, 'SELECT app_purge_deleted_records()');
    expect(await archived('hk_ai_conversations', { id: c.id })).toEqual([]);
    expect(await sql(s.url, 'SELECT id FROM hk_ai_conversations WHERE id=$1', [c.id])).toEqual([]);
    expect(await sql(s.url, 'SELECT id FROM hk_ai_messages WHERE id=$1', [m.id])).toEqual([]);
    expect(await archived('hk_ai_messages', { id: m.id })).toEqual([]);
    const old = (await sql<{ id: number }>(s.url, "INSERT INTO hk_ai_conversations(user_id,title,deleted_at) VALUES($1,'Đã ẩn từ trước',now()-interval '2 months') RETURNING id::int", [f.S2.id]))[0];
    const oldMessage = (await sql<{ id: number }>(s.url, "INSERT INTO hk_ai_messages(conversation_id,role,content) VALUES($1,'assistant','Không gia hạn') RETURNING id::int", [old.id]))[0];
    expect((await api('DELETE', `/api/admin/users/${f.S2.id}`)).status).toBe(204);
    const oldParent = (await archived('hk_ai_conversations', { id: old.id }))[0], oldChild = (await archived('hk_ai_messages', { id: oldMessage.id }))[0];
    expect(oldParent.expires_at).toEqual(oldChild.expires_at);
    expect(new Date(oldParent.deleted_at).getTime()).toBeLessThan(Date.now()-50*86400000);
  });

  test('lỗi ghi kho thì không mất dữ liệu và không để lại bản lưu dở dang; thao tác bị từ chối không có bản lưu', async () => {
    const n = (await sql<{ id: number }>(s.url, "INSERT INTO app_notifications(user_id,school_id,kind,title,body) VALUES($1,$2,'system','Rollback','Giữ lại') RETURNING id", [f.S1.id, f.A.schoolId]))[0];
    const countBefore = (await sql(s.url, 'SELECT count(*)::int AS n FROM app_deleted_records'))[0];
    expect((await api('POST', '/api/platform/notices/delete', { ids: [n.id] }, '')).status).toBe(401);
    await sql(s.url, `CREATE FUNCTION fail_archive_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'archive rollback fixture'; END $$;
      CREATE TRIGGER fail_archive_fixture BEFORE INSERT ON app_deleted_records FOR EACH ROW EXECUTE FUNCTION fail_archive_fixture()`);
    try {
      expect((await api('POST', '/api/platform/notices/delete', { ids: [n.id] }, f.S1.token)).status).toBe(500);
      expect(await sql(s.url, 'SELECT body FROM app_notifications WHERE id=$1', [n.id])).toEqual([{ body: 'Giữ lại' }]);
      expect((await sql(s.url, 'SELECT count(*)::int AS n FROM app_deleted_records'))[0]).toEqual(countBefore);
    } finally { await sql(s.url, 'DROP TRIGGER fail_archive_fixture ON app_deleted_records; DROP FUNCTION fail_archive_fixture()'); }
  });

  test('ngữ cảnh không lẫn giữa hai người xóa đồng thời và không rò sang dọn nền hoặc kết nối tái sử dụng', async () => {
    const ids: number[] = [];
    for (const who of [f.S1, f.TB]) ids.push((await sql<{ id: number }>(s.url, "INSERT INTO app_notifications(user_id,kind,title,body) VALUES($1,'system','Song song','Dữ liệu riêng') RETURNING id", [who.id]))[0].id);
    const res = await Promise.all([api('POST', '/api/platform/notices/delete', { ids: [ids[0]] }, f.S1.token), api('POST', '/api/platform/notices/delete', { ids: [ids[1]] }, f.TB.token)]);
    expect(res.map(r => r.status)).toEqual([200,200]);
    const one = (await archived('app_notifications', { id: ids[0] }))[0], two = (await archived('app_notifications', { id: ids[1] }))[0];
    expect(one.actor_id).toBe(f.S1.id); expect(two.actor_id).toBe(f.TB.id); expect(one.operation_id).not.toBe(two.operation_id);
    await sql(s.url, "INSERT INTO hk_notes(user_id,ref_type,ref_id,body) VALUES($1,'lesson',88888,'Dọn nền giả')", [f.S1.id]);
    const db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    await db.query('DELETE FROM hk_notes WHERE user_id=$1 AND ref_id=88888', [f.S1.id]);
    expect(await archived('hk_notes', { user_id: f.S1.id, ref_id: 88888 })).toEqual([]);
  });

  test('purge chỉ dọn đúng hạn; khởi động/nhịp nền có bước dọn; sao lưu ứng dụng không nhân bản kho giữ quá một năm', async () => {
    const before = (await sql<{ n: number }>(s.url, 'SELECT count(*)::int AS n FROM app_deleted_records'))[0].n;
    expect(before).toBeGreaterThan(0);
    await sql(s.url, 'SELECT app_purge_deleted_records()');
    expect((await sql<{ n: number }>(s.url, 'SELECT count(*)::int AS n FROM app_deleted_records'))[0].n).toBe(before);
    await sql(s.url, "UPDATE app_deleted_records SET deleted_at=now()-interval '1 year 2 days',expires_at=now()-interval '2 days' WHERE id=(SELECT min(id) FROM app_deleted_records)");
    const job = s.moduleRef.get((await import('../src/platform/platform.job')).PlatformJob);
    await job.tick({ hourly: true });
    expect((await sql<{ n: number }>(s.url, 'SELECT count(*)::int AS n FROM app_deleted_records'))[0].n).toBe(before-1);
    const backup = s.moduleRef.get((await import('../src/platform/backup.service')).BackupService) as any;
    expect(await backup.tableNames(backup.db.query.bind(backup.db))).not.toContain('app_deleted_records');
  });

  test('xóa trường lưu tài khoản/lớp/năm học và dữ liệu CASCADE, không xóa ngược kho khi trường mất', async () => {
    const made = await api('POST', '/api/admin/schools', { name: 'THCS Xóa có kho', admin: { full_name: 'Quản trị cần lưu', email: 'archive.school@example.invalid' } });
    expect(made.status).toBe(201);
    const id = made.body.school.id;
    expect((await api('DELETE', '/api/admin/schools/' + id)).status).toBe(204);
    const school = (await archived('app_schools', { id }))[0], admin = (await archived('app_users', { id: made.body.admin.id }))[0];
    expect(school.row_data.name).toBe('THCS Xóa có kho'); expect(school.operation_id).toBe(admin.operation_id);
    expect(school.school_id).toBe(id); expect(admin.row_data.password_hash).toBeUndefined();
    expect((await api('GET', '/api/admin/schools/' + id)).status).toBe(404);
  });
});
