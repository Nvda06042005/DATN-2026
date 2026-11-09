import {activate,adminLogin,call,createDatabase,hasPostgres,sql,Started,startApp} from './harness';
import {copyFileSync,mkdtempSync,readdirSync,rmSync} from 'fs';
import {join,resolve} from 'path';
import {tmpdir} from 'os';

(hasPostgres()?describe:describe.skip)('Mã học sinh theo trường, ngày sinh và bộ đếm',()=>{
 let s:Started,root:string,A:{id:number;token:string},B:{id:number;token:string};
 const api=(method:string,path:string,body?:unknown,token?:string)=>call(s.base,method,path,body,token??A.token);
 beforeAll(async()=>{
  s=await startApp('student_codes_test');root=await adminLogin(s.base);
  const school=async(email:string,name='THCS Giồng Ông Tố')=>{const made=await call(s.base,'POST','/api/admin/schools',{name,admin:{full_name:'Quản trị Fixture',email}},root);const login=await activate(s.base,made.body.admin.username,made.body.temporary_password,'Fixture@123','school_admin');return{id:made.body.school.id,token:login.token};};
  A=await school('studentcodes.a@example.invalid');B=await school('studentcodes.b@example.invalid','THCS Giang Ông Tổ');
 });
 afterAll(async()=>{await s?.close();});
 test('xem trước không cấp số; tạo/sửa/ngày sinh/danh sách dùng mã chuẩn; giữ username và số đã cấp',async()=>{
  const empty=await api('GET','/api/admin/registration-code/student');expect(empty.body).toMatchObject({code:null,serial:1,prefix:'HSGOT'});
  const path='/api/admin/registration-code/student?birth_date=2013-03-15';const preview=await api('GET',path);expect(preview.body.code).toBe('HSGOT2615032013001');expect((await api('GET',path)).body).toEqual(preview.body);
  const made=await api('POST','/api/admin/students',{full_name:'Học sinh Định Danh',birth_date:'2013-03-15',user_code:'HS00000001'});expect(made.status).toBe(201);expect(made.body.user.user_code).toBe(preview.body.code);
  const {id,username}=made.body.user;
  const edited=await api('PATCH',`/api/admin/users/${id}`,{birth_date:'2014-04-16',user_code:'SAI-MA'});expect(edited.status).toBe(200);expect(edited.body).toMatchObject({username,user_code:'HSGOT2616042014001'});
  expect((await api('GET',`/api/admin/registration-code/student?user_id=${id}&birth_date=2014-04-16`)).body.code).toBe(edited.body.user_code);
  expect((await api('GET','/api/admin/students')).body.items[0].user_code).toBe(edited.body.user_code);
  expect((await api('PATCH',`/api/admin/users/${id}`,{birth_date:null})).status).toBe(422);
  expect((await api('GET',path+`&school_id=${B.id}`)).status).toBe(403);
  expect((await api('GET',`/api/admin/registration-code/student?user_id=${id}&birth_date=2013-03-15`,undefined,B.token)).status).toBe(404);
  expect((await api('GET','/api/admin/registration-code/student?birth_date=2013-02-31')).status).toBe(422);
  expect((await api('DELETE',`/api/admin/users/${id}`,undefined,root)).status).toBe(204);expect((await api('GET','/api/admin/registration-code/student')).body.serial).toBe(2);
 });
 test('đồng thời cấp số khác nhau; trường trùng tên/viết tắt vẫn không trùng mã; bộ đếm RLS',async()=>{
  const before=(await api('GET','/api/admin/registration-code/student')).body.serial;
  const made=await Promise.all([1,2].map(n=>api('POST','/api/admin/students',{full_name:`Học sinh Đồng Thời ${n}`,birth_date:'2013-03-15'})));
  expect(made.map(r=>r.status)).toEqual([201,201]);expect(new Set(made.map(r=>r.body.user.user_code)).size).toBe(2);
  expect(made.map(r=>Number(r.body.user.user_code.slice(-3))).sort((a,b)=>a-b)).toEqual([before,before+1]);
  const inB=await api('POST','/api/admin/students',{full_name:'Học sinh Trường B Một',birth_date:'2013-03-15'},B.token);expect(inB.status).toBe(201);
  const inB2=await api('POST','/api/admin/students',{full_name:'Học sinh Trường B Hai',birth_date:'2013-03-15'},B.token);expect(inB2.status).toBe(201);
  const all=await sql<{user_code:string}>(s.url,"SELECT user_code FROM app_users WHERE role='student'");expect(new Set(all.map(r=>r.user_code)).size).toBe(all.length);
  const {DatabaseService}=await import('../src/database/database.service');const db=s.moduleRef.get(DatabaseService);
  expect(await db.scoped(A.id,q=>q('SELECT school_id FROM app_student_code_counters'))).toEqual([{school_id:A.id}]);
  expect(await db.scoped(A.id,q=>q('SELECT school_id FROM app_student_code_counters WHERE school_id=$1',[B.id]))).toEqual([]);
  await expect(db.scoped(A.id,q=>q('SELECT public.app_next_student_serial($1,26,$2::date,NULL)',[B.id,'2013-03-15']))).rejects.toThrow(/trường khác/);
  const acl=await sql(s.url,"SELECT coalesce(bool_or(a.grantee=0 AND a.privilege_type='EXECUTE'),false) AS allowed FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid='public.app_next_student_serial(integer,integer,date,integer)'::regprocedure");expect(acl[0].allowed).toBe(false);
 });
 test('nâng056→057 giữ tài khoản/lớp/giáo viên và không bịa ngày sinh',async()=>{
  const {applyMigrations}=await import('../src/database/migrator'),url=await createDatabase('student_codes_upgrade');
  const dir=mkdtempSync(join(tmpdir(),'dong_a_student_codes_')),source=resolve(__dirname,'../../database/migrations');
  try{
   for(const f of readdirSync(source).filter(f=>f.endsWith('.sql')&&Number(f.slice(0,3))<=56))copyFileSync(join(source,f),join(dir,f));await applyMigrations(url,dir);
   await sql(url,`INSERT INTO app_schools(id,school_code,name) VALUES(8801,'00008801','THCS Giồng Ông Tố');
    INSERT INTO app_users(id,username,full_name,role,password_hash,must_change_password,created_at,school_id,birth_date,user_code)
      VALUES(8801,'hs-old','Fixture Student','student','fixture',1,'2026-01-01T00:00:00Z',8801,'2013-03-15','HS100001'),
      (8802,'hs-no-birth','Fixture Missing Birth','student','fixture',1,'2026-01-02T00:00:00Z',8801,NULL,'HS100002'),
      (8803,'gv-old','Fixture Teacher','teacher','fixture',1,'2026-01-03T00:00:00Z',8801,'1985-03-15','GV100001');
    INSERT INTO app_classes(id,school_id,school_year,class_code,name,grade) VALUES(8801,8801,'2026-2027','7A1','7A1',7);
    INSERT INTO app_class_members(class_id,user_id) VALUES(8801,8801);`);
   const teacherBefore=await sql(url,'SELECT id,username,user_code FROM app_users WHERE id=8803');
   const change=readdirSync(source).find(f=>f.startsWith('057_'))!;copyFileSync(join(source,change),join(dir,change));await applyMigrations(url,dir);
   expect(await sql(url,"SELECT id,username,user_code FROM app_users WHERE role='student' ORDER BY id")).toEqual([{id:8801,username:'hs-old',user_code:'HSGOT2615032013001'},{id:8802,username:'hs-no-birth',user_code:'HS100002'}]);
   expect(await sql(url,'SELECT class_id,user_id FROM app_class_members')).toEqual([{class_id:8801,user_id:8801}]);expect(await sql(url,'SELECT id,username,user_code FROM app_users WHERE id=8803')).toEqual(teacherBefore);
   expect((await sql(url,"SELECT relrowsecurity FROM pg_class WHERE relname='app_student_code_counters'"))[0].relrowsecurity).toBe(true);
  }finally{rmSync(dir,{recursive:true,force:true});}
 });
});
