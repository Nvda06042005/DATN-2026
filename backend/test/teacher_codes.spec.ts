import { adminLogin, call, createDatabase, hasPostgres, sql, Started, startApp } from './harness';
import { bootstrap, Fixture } from './fixture';
import { schoolInitials } from '../src/admin/excel';
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';

(hasPostgres()?describe:describe.skip)('Mã giáo viên thống nhất theo từng trường',()=>{
  let s:Started,f:Fixture;
  const api=(method:string,path:string,body?:unknown,token?:string)=>call(s.base,method,path,body,token??f.A.token);
  beforeAll(async()=>{s=await startApp('teacher_codes_test');f=await bootstrap(s,await adminLogin(s.base),true);});
  afterAll(async()=>{await s?.close();});

  test('viết tắt trong PostgreSQL trùng Excel cho tên trường có dấu và cấp học',async()=>{
    for(const name of ['THCS Giồng Ông Tố','Trường Trung học cơ sở Nguyễn Văn Quy','THCS Phú Mỹ','THCS Đặng Văn Ngữ','THCS Nguyễn Văn A (cơ sở 2)']) {
      expect((await sql<{code:string}>(s.url,'SELECT public.app_school_initials($1) AS code',[name]))[0].code).toBe(schoolInitials(name));
    }
    expect((await sql(s.url,"SELECT public.app_teacher_identity('THCS Giồng Ông Tố',26,'1985-03-15',1) AS code"))[0]).toEqual({code:'GOT2615031985001'});
  });
  test('xem mã cần ngày sinh, không cấp số; tạo/sửa/danh sách/xuất dùng mã đã lưu, không đổi tên đăng nhập hay lớp',async()=>{
    const empty=await api('GET','/api/admin/registration-code/teacher');expect(empty.status).toBe(200);expect(empty.body.code).toBeNull();
    const path='/api/admin/registration-code/teacher?birth_date=1985-03-15';
    const before=await api('GET',path);expect(before.status).toBe(200);
    expect((await api('GET',path)).body).toEqual(before.body);
    expect(before.body.code).toMatch(/2615031985\d{3}$/);
    const made=await api('POST','/api/admin/teachers',{full_name:'Giáo viên Định Danh',email:'identity@example.invalid',birth_date:'1985-03-15',user_code:'GV99999999', phone: '0900000081'});
    expect(made.status).toBe(201);expect(made.body.user.user_code).toBe(before.body.code);
    const {id,username}=made.body.user;
    const edited=await api('PATCH',`/api/admin/users/${id}`,{birth_date:'1986-04-16',user_code:'MA-SAI'});
    expect(edited.status).toBe(200);expect(edited.body.username).toBe(username);
    expect(edited.body.user_code).toBe(before.body.code.replace('15031985','16041986'));
    const preview=await api('GET',`/api/admin/registration-code/teacher?user_id=${id}&birth_date=1986-04-16`);
    expect(preview.body.code).toBe(edited.body.user_code);
    const list=await api('GET','/api/admin/teachers');expect(list.body.items.find((u:any)=>u.id===id).user_code).toBe(edited.body.user_code);
    expect((await api('GET',`/api/admin/registration-code/teacher?user_id=${id}&birth_date=1986-04-16`,undefined,f.B.token)).status).toBe(404);
    expect((await api('GET',path+`&school_id=${f.B.schoolId}`)).status).toBe(403);
    expect((await api('GET',path,undefined,f.T1.token)).status).toBe(403);
    expect((await api('GET','/api/admin/registration-code/teacher?birth_date=1985-02-31')).status).toBe(422);
  });
  test('tạo đồng thời không trùng số; trường khác có dãy riêng; bổ sung ngày sinh cho giáo viên cũ tự cập nhật mã',async()=>{
    const before=(await api('GET','/api/admin/registration-code/teacher')).body.serial;
    const result=await Promise.all([1,2].map(n=>api('POST','/api/admin/teachers',{full_name:`Giáo viên Đồng Thời ${n}`,email:`concurrent${n}@example.invalid`,birth_date:'1985-03-15', phone: '0900000082'})));
    expect(result.map(r=>r.status)).toEqual([201,201]);
    const serials=result.map(r=>Number(r.body.user.user_code.slice(-3))).sort((a,b)=>a-b);expect(serials).toEqual([before,before+1]);
    expect((await api('DELETE',`/api/admin/users/${result[0].body.user.id}`,undefined,f.root)).status).toBe(204);
    expect((await api('GET','/api/admin/registration-code/teacher')).body.serial).toBe(before+2);
    expect((await api('GET','/api/admin/registration-code/teacher',undefined,f.B.token)).body.serial).toBe(2);
    const old=(await api('PATCH',`/api/admin/users/${f.T1.id}`,{birth_date:'1980-06-01'})).body;
    expect(old.user_code).toMatch(/2601061980001$/);
    expect((await api('GET',`/api/admin/classes/${f.class7a.id}`)).body.teachers[0].id).toBe(f.T1.id);
    const scoped=await sql(s.url,`SELECT school_id FROM app_teacher_code_counters`);expect(scoped).toHaveLength(2);
    const {DatabaseService}=await import('../src/database/database.service');
    const db=s.moduleRef.get(DatabaseService);
    expect(await db.scoped(f.A.schoolId,q=>q('SELECT school_id FROM app_teacher_code_counters'))).toEqual([{school_id:f.A.schoolId}]);
    expect(await db.scoped(f.A.schoolId,q=>q('SELECT school_id FROM app_teacher_code_counters WHERE school_id=$1',[f.B.schoolId]))).toEqual([]);
    expect((await sql(s.url,"SELECT count(*)::int AS n FROM information_schema.routine_privileges WHERE routine_name='app_fill_teacher_identity' AND grantee='PUBLIC'"))[0]).toEqual({n:0});
  });
  test('nâng 055→056 cập nhật tài khoản đã có ngày sinh, giữ nguyên lớp/tên đăng nhập; không tự bịa ngày sinh',async()=>{
    const {applyMigrations}=await import('../src/database/migrator');
    const url=await createDatabase('teacher_codes_upgrade');
    const dir=mkdtempSync(join(tmpdir(),'dong_a_teacher_codes_'));
    const source=resolve(__dirname,'../../database/migrations');
    try{
      for(const file of readdirSync(source).filter(f=>f.endsWith('.sql')&&Number(f.slice(0,3))<=55)) copyFileSync(join(source,file),join(dir,file));
      await applyMigrations(url,dir);
      await sql(url,`INSERT INTO app_schools(id,school_code,name) VALUES(8801,'00008801','THCS Giồng Ông Tố');
        INSERT INTO app_users(id,username,full_name,role,password_hash,must_change_password,created_at,school_id,birth_date,user_code)
        VALUES(8801,'gv-old','Fixture Teacher','teacher','fixture',1,'2026-01-01T00:00:00Z',8801,'1985-03-15','GV100001'),
              (8802,'gv-no-birth','Fixture No Birth','teacher','fixture',1,'2026-01-02T00:00:00Z',8801,NULL,'GV100002');
        INSERT INTO app_classes(id,school_id,school_year,class_code,name,grade) VALUES(8801,8801,'2026-2027','7A1','7A1',7);
        INSERT INTO app_class_teachers(class_id,teacher_id) VALUES(8801,8801);`);
      const change=readdirSync(source).find(f=>f.startsWith('056_'))!;copyFileSync(join(source,change),join(dir,change));
      await applyMigrations(url,dir);
      expect(await sql(url,'SELECT id,username,user_code FROM app_users ORDER BY id')).toEqual([{id:8801,username:'gv-old',user_code:'GOT2615031985001'},{id:8802,username:'gv-no-birth',user_code:'GV100002'}]);
      expect(await sql(url,'SELECT class_id,teacher_id FROM app_class_teachers')).toEqual([{class_id:8801,teacher_id:8801}]);
      expect((await sql(url,"SELECT relrowsecurity FROM pg_class WHERE relname='app_teacher_code_counters'"))[0]).toEqual({relrowsecurity:true});
    }finally{rmSync(dir,{recursive:true,force:true});}
  });
});
