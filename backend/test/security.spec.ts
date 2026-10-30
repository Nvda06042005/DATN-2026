/** TM.SEC acceptance tests: real HTTP + isolated PostgreSQL, never production accounts. */
import { pbkdf2Sync } from 'crypto';
import { adminLogin, call, hasPostgres, LiveClient, Started, startApp } from './harness';
import type { DatabaseService } from '../src/database/database.service';
let s: Started, db: DatabaseService, root: string, school: number, otherSchool: number, schoolAdmin: string;
const api = (method: string, path: string, body?: unknown, token = root) => call(s.base, method, path, body, token);
const login = async (username: string, password: string, portal: string) => (await api('POST','/api/auth/login',{ username, password, portal }, '')).body.token as string;
const create = async (role: string, name: string, sid = school) => (await api('POST','/api/admin/users',{ full_name: name, role, school_id: role === 'root_admin' ? undefined : sid, password: 'Security@123' })).body.user;
(hasPostgres() ? describe : describe.skip)('TM.SEC accounts', () => {
  beforeAll(async () => {
    s = await startApp('security_test');
    db = s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);
    root = await adminLogin(s.base);
    school = (await api('POST','/api/admin/schools',{ school_code: '6001', name: 'Trường kiểm thử A' })).body.id;
    otherSchool = (await api('POST','/api/admin/schools',{ school_code: '6002', name: 'Trường kiểm thử B' })).body.id;
    const admin = await create('school_admin','Quản lý trường thử');
    schoolAdmin = await login(admin.username,'Security@123','school_admin');
  });
  afterAll(async () => { await s?.close(); });

  test('creates admins, hashes with bcrypt, lists/searches/filters and returns safe account details', async () => {
    const created = await create('root_admin','Quản lý tổng thử');
    expect(created.role).toBe('root_admin'); expect(created.school_id).toBeNull();
    const rows = await db.query<{ password_hash: string }>('SELECT password_hash FROM app_users WHERE id = $1',[created.id]);
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$12\$/);
    const person = await create('student','Nguyễn Kiểm Thử');
    const detail = await api('GET',`/api/admin/users/${person.id}`);
    expect(detail.body).toMatchObject({ id: person.id, school_name: 'Trường kiểm thử A', classes: [] });
    expect(detail.body.password_hash).toBeUndefined(); expect(detail.body.token_version).toBeUndefined();
    expect((await api('GET','/api/admin/users?q=nguyen%20kiem%20thu&role=student&active=true')).body.items.map((x: any) => x.id)).toEqual([person.id]);
    expect((await api('GET','/api/admin/users?role=root_admin')).body.items.some((x: any) => x.id === created.id)).toBe(true);
  });

  test('school scope and privilege escalation are enforced on list/detail/create/role/history', async () => {
    const foreign = await create('student','Học sinh trường B',otherSchool);
    const own = await create('student','Học sinh trường A');
    expect((await api('GET',`/api/admin/users/${foreign.id}`,undefined,schoolAdmin)).status).toBe(404);
    expect((await api('PATCH',`/api/admin/users/${foreign.id}/role`,{role:'teacher'},schoolAdmin)).status).toBe(404);
    for (const role of ['root_admin','school_admin']) {
      expect((await api('POST','/api/admin/users',{full_name:'Không được cấp',role,school_id:school},schoolAdmin)).status).toBe(403);
      expect((await api('PATCH',`/api/admin/users/${own.id}/role`,{role},schoolAdmin)).status).toBe(403);
    }
    const res = await api('GET',`/api/admin/users?school_id=${otherSchool}`,undefined,schoolAdmin);
    expect(res.body.items.every((x: any) => x.school_id === school)).toBe(true);
    const token = await login(foreign.username,'Security@123','student');
    expect((await api('GET','/api/admin/users',undefined,token)).status).toBe(403);
    for (const kind of ['login','audit']) {
      const logs = await api('GET',`/api/admin/${kind}-history?school_id=${otherSchool}`,undefined,schoolAdmin);
      expect(logs.status).toBe(200); expect(logs.body.items.every((x: any) => x.school_id === school)).toBe(true);
      expect((await api('GET',`/api/admin/${kind}-history`,undefined,token)).status).toBe(403);
    }
  });

  test('logout revokes only that session, tokens expire, lock/unlock and role changes invalidate old sessions', async () => {
    const person = await create('student','Phiên bảo mật');
    const first = await login(person.username,'Security@123','student'), second = await login(person.username,'Security@123','student');
    expect(first).not.toBe(second);
    expect((await api('POST','/api/auth/logout',{},first)).status).toBe(200);
    expect((await api('GET','/api/auth/me',undefined,first)).status).toBe(401);
    expect((await api('GET','/api/auth/me',undefined,second)).status).toBe(200);
    expect((await api('PATCH',`/api/admin/users/${person.id}`,{is_active:false})).status).toBe(200);
    expect((await api('GET','/api/admin/users?active=false')).body.items.some((x: any) => x.id === person.id)).toBe(true);
    await api('PATCH',`/api/admin/users/${person.id}`,{is_active:true});
    expect((await api('GET','/api/auth/me',undefined,second)).status).toBe(401);
    const current = await login(person.username,'Security@123','student');
    expect((await api('PATCH',`/api/admin/users/${person.id}/role`,{role:'teacher'})).status).toBe(200);
    expect((await api('GET','/api/auth/me',undefined,current)).status).toBe(401);
    const teacher = await login(person.username,'Security@123','teacher');
    expect((await api('GET','/api/student/game',undefined,teacher)).status).toBe(403);
    const {JwtService} = await import('@nestjs/jwt');
    const jwt = s.moduleRef.get(JwtService), payload = jwt.decode(teacher) as any;
    delete payload.exp; delete payload.iat;
    const expired = jwt.sign(payload,{expiresIn:-1});
    expect((await api('GET','/api/auth/me',undefined,expired)).status).toBe(401);
    const rootUser = (await api('GET','/api/auth/me')).body;
    expect((await api('PATCH',`/api/admin/users/${rootUser.id}/role`,{role:'student',school_id:school})).status).toBe(400);
    expect((await api('PATCH',`/api/admin/users/${rootUser.id}`,{is_active:false})).status).toBe(400);
  });

  test('teachers see only assigned class members; equal class names across schools cannot share a live room', async () => {
    const teacher = await create('teacher','Giáo viên A'), otherTeacher = await create('teacher','Giáo viên chưa được phân công');
    const student = await create('student','Học sinh lớp A'), foreign = await create('student','Học sinh lớp B',otherSchool);
    for (const u of [teacher,otherTeacher,student,foreign]) await db.query('UPDATE app_users SET class_name = $1 WHERE id = $2',['7SEC',u.id]);
    const [{id: classId}] = await db.query<{id: number}>("INSERT INTO app_classes (school_id,teacher_id,class_code,school_year,name,join_password_hash,status) VALUES ($1,$2,'7SEC','2026-2027','Lớp kiểm thử',$3,'APPROVED') RETURNING id",[school,teacher.id,'hash-fixture-not-a-password']);
    await db.query('INSERT INTO app_class_members (class_id,user_id) VALUES ($1,$2)',[classId,student.id]);
    const t = await login(teacher.username,'Security@123','teacher'), t2 = await login(otherTeacher.username,'Security@123','teacher');
    expect((await api('GET','/api/teacher/class',undefined,t)).body.students.map((x: any) => x.id)).toEqual([student.id]);
    expect((await api('GET','/api/teacher/class',undefined,t2)).body.students).toEqual([]);
    const f = await login(foreign.username,'Security@123','student');
    const host = new LiveClient(s.ws), guest = new LiveClient(s.ws);
    try {
      await host.send({type:'auth',token:t}); await host.until(m => m.type === 'room');
      await host.send({type:'create',count:5,scope:'all'}); const room = (await host.until(m => m.type === 'room' && m.room)).room;
      await guest.send({type:'auth',token:f}); await guest.until(m => m.type === 'state');
      await guest.send({type:'join',pin:room.pin}); expect((await guest.until(m => m.type === 'error')).code).toBe('not_found');
      await api('POST','/api/auth/logout',{},f);
      await guest.send({type:'ping'}); expect((await guest.until(m => m.type === 'error')).code).toBe('auth');
    } finally { host.close(); guest.close(); }
  });

  test('legacy PBKDF2 login upgrades to bcrypt without changing the supplied password', async () => {
    const user = await create('student','Tài khoản cũ');
    const salt = Buffer.from('legacy-test-salt'), password = 'Legacy@123';
    const oldHash = `pbkdf2_sha256$240000$${salt.toString('base64url')}$${pbkdf2Sync(password,salt,240000,32,'sha256').toString('base64url')}`;
    await db.query('UPDATE app_users SET password_hash = $1 WHERE id = $2',[oldHash,user.id]);
    const token = await login(user.username,password,'student');
    expect(typeof token).toBe('string');
    expect((await db.getById(user.id))!.password_hash).toMatch(/^\$2[aby]\$/);
    expect((await api('GET','/api/auth/me',undefined,token)).status).toBe(200);
  });

  test('login history records success/failure and operation history contains actor, school and target, never secrets', async () => {
    const user = await create('student','Lịch sử thử');
    await api('POST','/api/auth/login',{username:user.username,password:'Wrong@123',portal:'student'},'');
    await login(user.username,'Security@123','student');
    const events = await api('GET',`/api/admin/login-history?user_id=${user.id}&limit=1&page=1`);
    expect(events.body.total).toBe(2); expect(events.body.items).toHaveLength(1); expect(events.body.items[0].reason).toBe('success');
    const failed = await api('GET',`/api/admin/login-history?user_id=${user.id}&success=false`);
    expect(failed.body.items[0].reason).toBe('credentials');
    const audit = await api('GET','/api/admin/audit-history?q=users');
    expect(audit.body.items.some((x: any) => x.target_id === String(user.id) && x.school_id === school && x.actor_name && x.created_at)).toBe(true);
    const stored = JSON.stringify(await db.query('SELECT * FROM app_audit_events'));
    expect(stored).not.toContain('Security@123'); expect(stored).not.toContain('Wrong@123'); expect(stored).not.toContain('password_hash');
    await db.scoped(school,q => expect(q('SELECT school_id FROM app_login_events WHERE school_id = $1',[otherSchool])).resolves.toEqual([]));
    await db.scoped(school,q => expect(q('SELECT * FROM app_audit_events WHERE school_id = $1',[otherSchool])).resolves.toEqual([]));
  });
});
