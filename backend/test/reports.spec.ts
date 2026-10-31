import { Workbook } from 'exceljs';
import { adminLogin, call, hasPostgres, Started, startApp } from './harness';
import type { DatabaseService } from '../src/database/database.service';
let s:Started,db:DatabaseService,root:string,scoped:string,teacherToken:string,a:number,b:number,c:number,t1:any,t2:any,tb:any,p1:any,p2:any,p3:any,pb:any,matchA:number;
const api=(method:string,path:string,body?:unknown,token=root)=>call(s.base,method,path,body,token);
const login=async(u:any,portal:string)=>(await api('POST','/api/auth/login',{username:u.username,password:'ReportsTest@123',portal},'')).body.token as string;
const account=async(role:string,school_id:number,full_name:string,grade?:number,year='2026-2027')=>(await api('POST','/api/admin/users',{role,school_id,full_name,grade,school_year:year,password:'ReportsTest@123'})).body.user;
(hasPostgres()?describe:describe.skip)('TM.SA-REPORT scoped dashboard and XLSX',()=>{
 beforeAll(async()=>{
  s=await startApp('reports_test');db=s.moduleRef.get((await import('../src/database/database.service')).DatabaseService);root=await adminLogin(s.base);
  for(const [code,name,region,city] of [['1101','Trường báo cáo A','Miền Nam','TP.HCM'],['1102','Trường báo cáo B','Miền Bắc','Hà Nội'],['1103','Trường trống','Miền Bắc','Hà Nội']])await api('POST','/api/admin/schools',{school_code:code,name,region,city});
  [a,b,c]=(await db.query<{id:number}>('SELECT id FROM app_schools ORDER BY school_code')).map(x=>x.id);
  scoped=await login(await account('school_admin',a,'Quản trị trường A'),'school_admin');
  t1=await account('teacher',a,'Giáo viên A1');t2=await account('teacher',a,'Giáo viên A2',undefined,'2025-2026');tb=await account('teacher',b,'Giáo viên B');teacherToken=await login(t1,'teacher');
  p1=await account('student',a,'Học sinh A1',7);p2=await account('student',a,'Học sinh A2',7);p3=await account('student',a,'Học sinh A3',8,'2025-2026');pb=await account('student',b,'Học sinh B',9);
  const cls=async(school:number,teacher:number,code:string,year:string,grade:number)=>(await db.query<{id:number}>("INSERT INTO app_classes(school_id,teacher_id,class_code,school_year,name,grade,join_password_hash,status) VALUES($1,$2,$3,$4,$3,$5,'synthetic-hash','APPROVED') RETURNING id",[school,teacher,code,year,grade]))[0].id;
  const ca=await cls(a,t1.id,'7A1','2026-2027',7),ca2=await cls(a,t1.id,'7A2','2026-2027',7),old=await cls(a,t2.id,'6C1','2025-2026',6),cb=await cls(b,tb.id,'9B1','2026-2027',9);
  for(const [classId,userId] of [[ca,p1.id],[ca2,p1.id],[old,p3.id],[cb,pb.id]])await db.query('INSERT INTO app_class_members(class_id,user_id) VALUES($1,$2)',[classId,userId]);
  for(const [id,answered,correct,lessons] of [[p1.id,10,8,2],[p3.id,4,2,0],[pb.id,8,8,3]]){await db.getProgress(id);await db.saveProgress(id,{questions_answered:answered,questions_correct:correct,lessons_completed:lessons});}
  const match=async(teacher:number,school:number,code:string,players:any[])=>db.saveLiveSession({teacher_id:teacher,school_id:school,class_name:code,title:'Thi đấu kiểm thử',scope:'all',question_count:3,question_stats:'[]',started_at:'2026-10-31T01:00:00Z',finished_at:'2026-10-31T01:05:00Z'},players);
  matchA=await match(t1.id,a,'7A1',[{user_id:p1.id,rank:1,score:20,correct:1,answered:2},{user_id:p2.id,rank:2,score:0,correct:0,answered:0}]);
  await match(tb.id,b,'9B1',[{user_id:pb.id,rank:1,score:30,correct:3,answered:3}]);
  await db.query("INSERT INTO app_live_sessions(teacher_id,school_id,class_name,title,scope,started_at,finished_at) VALUES($1,$2,'7A1','Trận cũ','all','2025-01-01','2025-01-01')",[t1.id,a]);
  await api('PATCH',`/api/admin/schools/${c}`,{is_active:false});
 });
 afterAll(async()=>{await s?.close();});
 test('one dashboard counts real schools, school–grade pairs, classes and unique people without duplicate memberships',async()=>{
  const r=await api('GET','/api/admin/reports/dashboard');expect(r.status).toBe(200);expect(r.body.viewer_role).toBe('root_admin');
  expect(r.body.summary).toMatchObject({schools:3,active_schools:2,inactive_schools:1,grades:4,classes:4,teachers:3,active_teachers:3,assigned_teachers:3,unassigned_teachers:0,students:4,joined_students:3,unjoined_students:1,learning_students:3,completed_students:2,completed_sessions:5,answers:22,correct:18,completion_rate:0.5,game_participation_rate:0.75,average_score:7.67,competitions:3,participations:3,unique_participants:3,competition_answers:5,competition_correct:4,competition_accuracy:0.8,legacy_competitions:1});
  expect(r.body.per_school.find((x:any)=>x.id===a)).toMatchObject({students:3,joined_students:2,assigned_teachers:2,average_score:6.5});
  expect(r.body.education_levels[0].level).toBe('THCS');
 });
 test('school/year/place/activity filters produce consistent totals and exclude unknown historical years',async()=>{
  const r=await api('GET',`/api/admin/reports/dashboard?school_id=${a}&school_year=2026-2027&region=${encodeURIComponent('Miền Nam')}&city=TP.HCM&active=true`);
  expect(r.body.summary).toMatchObject({schools:1,classes:2,teachers:1,assigned_teachers:1,students:2,joined_students:1,average_score:8,competitions:1,participations:2,competition_accuracy:0.5});
  expect(r.body.excluded_legacy_competitions).toBe(1);expect(r.body.class_breakdown.every((x:any)=>x.school_year==='2026-2027')).toBe(true);
  expect((await api('GET','/api/admin/reports/dashboard?school_year=2026-2028')).status).toBe(422);
  expect((await api('GET','/api/admin/reports/dashboard?active=invalid')).status).toBe(422);
 });
 test('school admin only sees assigned school, even with forged filters; teacher and anonymous clients cannot read reports',async()=>{
  const r=await api('GET',`/api/admin/reports/dashboard?school_id=${b}`,undefined,scoped);expect(r.status).toBe(200);expect(r.body.scope).toBe('school');expect(r.body.filters.school_id).toBe(a);expect(r.body.per_school.map((x:any)=>x.id)).toEqual([a]);expect(r.body.facets.cities).toEqual(['TP.HCM']);expect(r.body.summary.students).toBe(3);
  expect((await api('GET','/api/admin/reports/dashboard',undefined,teacherToken)).status).toBe(403);expect((await api('GET','/api/admin/reports/export',undefined,teacherToken)).status).toBe(403);expect((await api('GET','/api/admin/reports/dashboard',undefined,'')).status).toBe(401);
 });
 test('empty cohorts show null ratios, not fabricated averages or division-by-zero values',async()=>{
  const r=await api('GET',`/api/admin/reports/dashboard?school_id=${c}`);expect(r.body.summary).toMatchObject({schools:1,students:0,teachers:0,competitions:0,average_score:null,completion_rate:null,competition_accuracy:null,game_participation_rate:null});
 });
 test('root global totals retain legacy people without a school; a school filter and school admins never include them',async()=>{
  const orphan=await db.createUser({username:'unassigned_report_fixture',full_name:'Học sinh chưa gán trường',role:'student',class_name:null,must_change_password:false,password_hash:'synthetic-hash',school_year:'2026-2027'});
  await db.getProgress(orphan.id);await db.saveProgress(orphan.id,{questions_answered:1,questions_correct:1});
  const all=await api('GET','/api/admin/reports/dashboard');expect(all.body.summary.students).toBe(5);expect(all.body.unassigned_people).toBe(1);expect(all.body.summary.average_score).toBe(8.25);
  expect((await api('GET',`/api/admin/reports/dashboard?school_id=${a}`)).body.summary.students).toBe(3);expect((await api('GET','/api/admin/reports/dashboard',undefined,scoped)).body.unassigned_people).toBe(0);
 });
 test('XLSX is a readable workbook with applied filters, all matching rows and no other-school data for a scoped export',async()=>{
  const res=await fetch(`${s.base}/api/admin/reports/export?school_id=${b}`,{headers:{Authorization:`Bearer ${scoped}`}});expect(res.status).toBe(200);expect(res.headers.get('content-type')).toContain('spreadsheetml.sheet');
  const bytes=Buffer.from(await res.arrayBuffer());expect(bytes.subarray(0,2).toString()).toBe('PK');const book=new Workbook();await book.xlsx.load(bytes as any);
  expect(book.worksheets.map(x=>x.name)).toEqual(['Tổng quan','Theo trường','Khối','Lớp theo năm','Phạm vi và cách tính']);
  const names=book.getWorksheet('Theo trường')!.getColumn(2).values;expect(names).toContain('Trường báo cáo A');expect(names).not.toContain('Trường báo cáo B');expect(names).not.toContain('Trường trống');
  const rootRes=await fetch(`${s.base}/api/admin/reports/export?school_year=2026-2027`,{headers:{Authorization:`Bearer ${root}`}});const all=new Workbook();await all.xlsx.load(Buffer.from(await rootRes.arrayBuffer()) as any);expect(all.getWorksheet('Theo trường')!.rowCount).toBe(4);expect(all.getWorksheet('Lớp theo năm')!.getColumn(3).values).not.toContain('2025-2026');
 });
 test('competition snapshots remain owned by the original school after teacher/student reassignment; RLS blocks other schools',async()=>{
  const snapshot=(await db.query('SELECT school_id,school_year,grade FROM app_live_sessions WHERE id=$1',[matchA]))[0];expect(snapshot).toMatchObject({school_id:a,school_year:'2026-2027',grade:7});
  await db.query('UPDATE app_users SET school_id=$1 WHERE id=ANY($2::int[])',[b,[t1.id,p1.id]]);
  const report=await api('GET','/api/admin/reports/dashboard',undefined,scoped);expect(report.body.summary.competitions).toBe(2);expect(report.body.summary.participations).toBe(2);
  expect(await db.scoped(b,q=>q('SELECT id FROM app_live_sessions WHERE id=$1',[matchA]))).toEqual([]);
  expect(await db.scoped(b,q=>q('SELECT session_id FROM app_live_results WHERE session_id=$1',[matchA]))).toEqual([]);
  expect((await db.liveSessionsForTeacher(t1.id)).length).toBe(0);
 });
});
