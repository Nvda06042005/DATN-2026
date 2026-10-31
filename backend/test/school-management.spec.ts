/** Whole-system versus one-school acceptance tests, using 64 synthetic schools in temporary PostgreSQL. */
import { adminLogin, call, hasPostgres, Started, startApp } from './harness';
import type { DatabaseService } from '../src/database/database.service';
let s:Started,db:DatabaseService,root:string,scoped:string,schoolA:number,schoolB:number,teacher:any,student:any,teacherToken:string,classA:any,classB:any;
const api=(method:string,path:string,body?:unknown,token=root)=>call(s.base,method,path,body,token);
const login=async(user:any,role:string)=>(await api('POST','/api/auth/login',{username:user.username,password:'SchoolTest@123',portal:role},'')).body.token as string;
async function account(role:string,schoolId:number,name:string,grade?:number){return(await api('POST','/api/admin/users',{role,school_id:schoolId,full_name:name,grade,school_year:'2026-2027',password:'SchoolTest@123'})).body.user;}
(hasPostgres()?describe:describe.skip)('TM.SA-SCHOOL',()=>{
 beforeAll(async()=>{
  s=await startApp('school_management_test');db=s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);root=await adminLogin(s.base);
  const schools=await db.query<{id:number}>("INSERT INTO app_schools (school_code,name,region,city) SELECT (1000+n)::text,'Trường kiểm thử '||n,CASE WHEN n=1 THEN 'Miền Nam' ELSE 'Miền Bắc' END,CASE WHEN n=1 THEN 'TP.HCM' ELSE 'Hà Nội' END FROM generate_series(1,64) n RETURNING id");
  schoolA=schools[0].id;schoolB=schools[63].id;
  const admin=await account('school_admin',schoolA,'Quản trị trường A');scoped=await login(admin,'school_admin');
  teacher=await account('teacher',schoolA,'Giáo viên trường A');student=await account('student',schoolA,'Học sinh trường A',7);
  const other=await account('teacher',schoolB,'Giáo viên trường B');await account('student',schoolB,'Học sinh trường B',9);
  teacherToken=await login(teacher,'teacher');const otherToken=await login(other,'teacher');
  classA=(await api('POST','/api/teacher/classes',{class_code:'7A1',school_year:'2026-2027',name:'Lịch sử lớp 7A1',join_password:'ClassTest@123'},teacherToken)).body;
  classB=(await api('POST','/api/teacher/classes',{class_code:'9B1',school_year:'2025-2026',name:'Lịch sử lớp 9B1',join_password:'ClassTest@123'},otherToken)).body;
  expect((await api('POST',`/api/admin/classes/${classA.id}/approve`,{})).status).toBe(200);
  const studentToken=await login(student,'student');expect((await api('POST','/api/student/classes/join',{class_code:'7A1',password:'ClassTest@123'},studentToken)).status).toBe(200);
 });
 afterAll(async()=>{await s?.close();});
 test('root sees all 64 schools with pagination; a school admin sees only one even with forged filters/IDs',async()=>{
  const ids:number[]=[];for(const page of [1,2,3]){const r=await api('GET',`/api/admin/schools?limit=30&page=${page}`);expect(r.status).toBe(200);expect(r.body.total).toBe(64);ids.push(...r.body.items.map((x:any)=>x.id));}expect(new Set(ids).size).toBe(64);
  const own=await api('GET',`/api/admin/schools?school_id=${schoolB}`,undefined,scoped);expect(own.body.total).toBe(1);expect(own.body.items.map((x:any)=>x.id)).toEqual([schoolA]);
  expect((await api('GET',`/api/admin/schools/${schoolB}`,undefined,scoped)).status).toBe(404);
  expect((await api('PATCH',`/api/admin/schools/${schoolA}`,{name:'Không được sửa'},scoped)).status).toBe(403);
  expect((await api('GET','/api/admin/schools',undefined,teacherToken)).status).toBe(403);
  const ov=await api('GET','/api/admin/overview');expect(ov.body.schools).toBe(64);
  expect((await api('GET','/api/database/health')).body.schema_version).toBe(10);
 });
 test('school details expose correct counts, grade breakdown and safe school-admin information',async()=>{
  const r=await api('GET',`/api/admin/schools/${schoolA}`);expect(r.body.counts).toEqual({teachers:1,students:1,classes:1,grades:1,admins:1});
  expect(r.body.grade_counts).toEqual([{grade:7,classes:1,students:1}]);expect(r.body.admins[0].role).toBe('school_admin');expect(r.body.admins[0].password_hash).toBeUndefined();expect(r.body.admins[0].token_version).toBeUndefined();
  expect((await api('GET',`/api/admin/schools/${schoolA}`,undefined,scoped)).body.id).toBe(schoolA);
 });
 test('root updates address/contact and can clear optional fields; invalid fields are rejected',async()=>{
  const r=await api('PATCH',`/api/admin/schools/${schoolA}`,{name:'Trường A cập nhật',address:'Địa chỉ kiểm thử',contact_name:'Người liên hệ thử',contact_email:'school@example.invalid',contact_phone:'0900000000',region:'Miền Nam',city:'TP.HCM'});
  expect(r.status).toBe(200);expect(r.body).toMatchObject({name:'Trường A cập nhật',address:'Địa chỉ kiểm thử',contact_email:'school@example.invalid'});
  expect((await api('PATCH',`/api/admin/schools/${schoolA}`,{contact_email:null,address:null})).body).toMatchObject({contact_email:null,address:null});
  expect((await api('PATCH',`/api/admin/schools/${schoolA}`,{is_active:null})).status).toBe(422);
  expect((await api('PATCH',`/api/admin/schools/${schoolA}`,{name:null})).status).toBe(422);
  expect((await api('PATCH',`/api/admin/schools/${schoolA}`,{contact_email:'invalid'})).status).toBe(422);
 });
 test('class filters combine school/grade/year/place/approval/activity and enforce school scope',async()=>{
  const r=await api('GET',`/api/admin/class-directory?school_id=${schoolA}&grade=7&school_year=2026-2027&region=${encodeURIComponent('Miền Nam')}&city=TP.HCM&status=APPROVED&active=true&education_level=THCS`);
  expect(r.status).toBe(200);expect(r.body.items.map((x:any)=>x.id)).toEqual([classA.id]);expect(r.body.items[0]).toMatchObject({grade:7,students:1,teacher_name:teacher.full_name});
  const own=await api('GET',`/api/admin/class-directory?school_id=${schoolB}`,undefined,scoped);expect(own.body.items.map((x:any)=>x.school_id)).toEqual([schoolA]);
  expect((await api('PATCH',`/api/admin/classes/${classB.id}`,{is_active:false},scoped)).status).toBe(403);
  expect((await api('PATCH',`/api/admin/classes/${classB.id}`,{is_active:false})).status).toBe(200);
  expect((await api('GET','/api/admin/class-directory?active=false')).body.items.map((x:any)=>x.id)).toEqual([classB.id]);
  expect((await api('GET','/api/admin/class-directory?education_level=THPT')).status).toBe(422);
 });
 test('teacher/student directories use real class assignments and class membership',async()=>{
  const all=await api('GET','/api/admin/users?role=teacher');expect(all.body.total).toBe(2);const record=all.body.items.find((x:any)=>x.id===teacher.id);expect(record.teaching_classes).toEqual([{id:classA.id,class_code:'7A1',school_year:'2026-2027'}]);
  expect((await api('GET',`/api/admin/users?role=student&school_id=${schoolA}&grade=7&class_id=${classA.id}`)).body.items.map((x:any)=>x.id)).toEqual([student.id]);
  expect((await api('GET','/api/admin/users?role=teacher&class_name=7A1')).body.items.map((x:any)=>x.id)).toEqual([teacher.id]);
  expect((await api('GET',`/api/admin/users?role=student&class_id=${classB.id}`,undefined,scoped)).body.items).toEqual([]);
 });
 test('pausing a school preserves account flags and data, revokes sessions, blocks login, and supports reopening',async()=>{
  const before=await db.query<{n:string}>('SELECT count(*) AS n FROM app_users WHERE school_id=$1',[schoolA]);
  expect((await api('PATCH',`/api/admin/schools/${schoolA}`,{is_active:false})).status).toBe(200);
  expect((await api('GET','/api/auth/me',undefined,scoped)).status).toBe(401);expect((await api('GET','/api/auth/me',undefined,teacherToken)).status).toBe(401);
  const blocked=await api('POST','/api/auth/login',{username:teacher.username,password:'SchoolTest@123',portal:'teacher'},'');expect(blocked.status).toBe(403);
  expect((await api('GET','/api/admin/class-directory?active=false')).body.items.some((x:any)=>x.id===classA.id)).toBe(true);
  expect(await db.query('SELECT count(*) AS n FROM app_users WHERE school_id=$1',[schoolA])).toEqual(before);expect((await db.getById(teacher.id))!.is_active).toBe(true);
  expect((await api('PATCH',`/api/admin/schools/${schoolA}`,{is_active:true})).status).toBe(200);expect((await api('GET','/api/auth/me',undefined,teacherToken)).status).toBe(401);
  const token=await login(teacher,'teacher');expect((await api('GET','/api/auth/me',undefined,token)).status).toBe(200);
  await db.scoped(schoolA,q=>expect(q('SELECT id FROM app_schools WHERE id=$1',[schoolB])).resolves.toEqual([]));
 });
});
