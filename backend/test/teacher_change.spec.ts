import {adminLogin,call,hasPostgres,sql,Started,startApp} from './harness';
import {bootstrap,Fixture} from './fixture';

(hasPostgres()?describe:describe.skip)('Đề nghị đổi giáo viên phụ trách lớp trong học kỳ',()=>{
  let s:Started,f:Fixture;
  const api=(method:string,path:string,body?:unknown,token?:string)=>call(s.base,method,path,body,token??f.A.token);
  const request=(id:number,token:string,teacher=f.T2.id)=>api('POST',`/api/classroom/classes/${id}/teacher-change`,{teacher_id:teacher,note:'Đề nghị tiếp nhận lớp'},token);
  const decide=(id:number|string,decision='approved',token=f.A.token)=>api('POST',`/api/admin/teacher-change-requests/${id}/decision`,{decision},token);
  const create=async(name:string)=>{
    const r=await api('POST','/api/admin/classes',{year_id:f.yearId,grade:7,name,semester:1,teacher_ids:[f.T1.id]});expect(r.status).toBe(201);return r.body.id as number;
  };
  beforeAll(async()=>{s=await startApp('teacher_change_test');f=await bootstrap(s,await adminLogin(s.base),true);
    await sql(s.url,"UPDATE app_school_years SET starts_on=current_date-100,ends_on=current_date+100,term1_starts_on=current_date-100,term1_ends_on=current_date+9,term2_starts_on=current_date+10,term2_ends_on=current_date+100 WHERE id=$1",[f.yearId]);
  });
  afterAll(async()=>{await s?.close();});
  test('chỉ giáo viên đang phụ trách gửi được; danh sách ứng viên cùng trường; chặn tự chuyển, khác trường, quá dài',async()=>{
    const id=await create('7YC1');
    const options=await api('GET',`/api/classroom/classes/${id}/teacher-change`,undefined,f.T1.token);
    expect(options.status).toBe(200);expect(options.body.candidates.map((t:any)=>t.id)).toContain(f.T2.id);expect(options.body.candidates.map((t:any)=>t.id)).not.toContain(f.TB.id);
    expect((await request(id,f.T2.token,f.T1.id)).status).toBe(403);
    expect((await request(id,f.S1.token)).status).toBe(403);
    expect((await request(id,f.T1.token,f.T1.id)).status).toBe(422);
    expect((await request(id,f.T1.token,f.TB.id)).status).toBe(422);
    expect((await api('POST',`/api/classroom/classes/${id}/teacher-change`,{teacher_id:f.T2.id,note:'x'.repeat(1001)},f.T1.token)).status).toBe(422);
    expect((await api('PATCH',`/api/admin/classes/${id}`,{semester:1,teacher_ids:[f.T2.id],confirm_reassignment:true})).status).toBe(409);
  });
  test('chờ duyệt không đổi quyền; quản trị đúng trường duyệt mới chuyển quyền; không duyệt lại',async()=>{
    const id=await create('7YC2'),r=await request(id,f.T1.token);expect(r.status).toBe(201);expect(r.body).toMatchObject({semester:1,status:'pending',from_teacher_id:f.T1.id,to_teacher_id:f.T2.id});
    expect((await api('GET',`/api/classroom/classes/${id}`,undefined,f.T1.token)).status).toBe(200);
    expect((await api('GET',`/api/classroom/classes/${id}`,undefined,f.T2.token)).status).toBe(404);
    expect((await request(id,f.T1.token)).status).toBe(409);
    expect((await api('GET','/api/admin/teacher-change-requests')).body.map((r:any)=>r.id)).toContain(r.body.id);
    expect((await decide(r.body.id,'approved',f.B.token)).status).toBe(404);
    expect((await decide(r.body.id,'approved',f.T1.token)).status).toBe(403);
    const ok=await decide(r.body.id);expect(ok.status).toBe(200);expect(ok.body.status).toBe('approved');
    expect((await api('GET',`/api/classroom/classes/${id}`,undefined,f.T1.token)).status).toBe(404);
    expect((await api('GET',`/api/classroom/classes/${id}`,undefined,f.T2.token)).status).toBe(200);
    expect((await decide(r.body.id)).status).toBe(409);
    expect((await api('GET',`/api/admin/classes/${id}/events`)).body.some((e:any)=>e.kind==='change_teacher'&&e.note.includes('Học kỳ 1'))).toBe(true);
    expect((await sql(s.url,'SELECT teacher_id FROM app_class_term_teachers WHERE class_id=$1 AND semester=1',[id]))).toEqual([{teacher_id:f.T2.id}]);
    expect((await sql(s.url,'SELECT teacher_id FROM app_class_term_teachers WHERE class_id=$1 AND semester=2',[id]))).toEqual([{teacher_id:null}]);
  });
  test('từ chối và hủy đề nghị giữ nguyên phân công; chỉ người gửi hủy được',async()=>{
    const id=await create('7YC3'),r=await request(id,f.T1.token);
    expect((await api('POST',`/api/classroom/teacher-change-requests/${r.body.id}/cancel`,{},f.T2.token)).status).toBe(404);
    expect((await api('POST',`/api/classroom/teacher-change-requests/${r.body.id}/cancel`,{},f.T1.token)).status).toBe(200);
    expect((await decide(r.body.id)).status).toBe(409);
    const next=await request(id,f.T1.token);expect(next.status).toBe(201);
    expect((await decide(next.body.id,'rejected')).body.status).toBe('rejected');
    expect((await api('GET',`/api/admin/classes/${id}`)).body.teachers[0].id).toBe(f.T1.id);
  });
  test('hai lần duyệt đồng thời chỉ một lần thành công; rollback khi ghi lịch sử lỗi',async()=>{
    const id=await create('7YC4'),r=await request(id,f.T1.token);
    const checks=await Promise.all([decide(r.body.id),decide(r.body.id)]);expect(checks.map(c=>c.status).sort()).toEqual([200,409]);
    const other=await create('7YC5'),pending=await request(other,f.T1.token);
    await sql(s.url,`CREATE FUNCTION fail_teacher_change_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.class_id=${other} AND NEW.kind='change_teacher' THEN RAISE EXCEPTION 'teacher request rollback fixture'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER fail_teacher_change_audit BEFORE INSERT ON app_class_events FOR EACH ROW EXECUTE FUNCTION fail_teacher_change_audit();`);
    try{expect((await decide(pending.body.id)).status).toBe(500);
      expect((await api('GET',`/api/admin/classes/${other}`)).body.teachers[0].id).toBe(f.T1.id);
      expect((await sql(s.url,'SELECT status FROM app_class_teacher_change_requests WHERE id=$1',[pending.body.id]))[0].status).toBe('pending');
    }finally{await sql(s.url,'DROP TRIGGER fail_teacher_change_audit ON app_class_events; DROP FUNCTION fail_teacher_change_audit()');}
    expect((await decide(pending.body.id)).status).toBe(200);
  });
  test('không duyệt khi ứng viên bị khóa hoặc học kỳ thay đổi, không cấp quyền nhầm',async()=>{
    const id=await create('7YC6'),r=await request(id,f.T1.token);
    expect((await api('POST',`/api/admin/users/${f.T2.id}/lock`,{locked:true,reason:'Kiểm thử tài khoản khóa'})).status).toBe(200);
    expect((await decide(r.body.id)).status).toBe(422);
    await api('POST',`/api/admin/users/${f.T2.id}/lock`,{locked:false});
    await sql(s.url,"UPDATE app_school_years SET term1_ends_on=current_date-2,term2_starts_on=current_date-1 WHERE id=$1",[f.yearId]);
    expect((await decide(r.body.id)).status).toBe(409);
    expect((await api('GET',`/api/admin/classes/${id}?semester=1`)).body.teachers[0].id).toBe(f.T1.id);
    await sql(s.url,"UPDATE app_school_years SET term1_ends_on=current_date+9,term2_starts_on=current_date+10 WHERE id=$1",[f.yearId]);
  });
});
