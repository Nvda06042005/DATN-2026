import { adminLogin, call, hasPostgres, sql, Started, startApp } from './harness';
import { bootstrap, Fixture } from './fixture';

(hasPostgres() ? describe : describe.skip)('Mã tự động và giáo viên phụ trách lớp theo học kỳ',()=>{
  let s:Started,f:Fixture;
  const api=(method:string,path:string,body?:unknown,token?:string)=>call(s.base,method,path,body,token??f.A.token);
  beforeAll(async()=>{s=await startApp('class_semesters_test');f=await bootstrap(s,await adminLogin(s.base),true);});
  afterAll(async()=>{await s?.close();});
  test('xem mã không giữ chỗ; tạo giáo viên/học sinh không cần nhập mã; giữ mã cũ khi sửa',async()=>{
    const first=await api('GET','/api/admin/registration-code/teacher'); expect(first.status).toBe(200);expect(first.body.code).toMatch(/^GV\d{8}$/);
    expect((await api('GET','/api/admin/registration-code/teacher')).body).toEqual(first.body);
    const t=await api('POST','/api/admin/teachers',{full_name:'Giáo viên mã tự động',email:'auto-code@example.invalid'});
    expect(t.status).toBe(201);expect(t.body.user.user_code).toBe(first.body.code);
    expect((await api('PATCH',`/api/admin/users/${t.body.user.id}`,{full_name:'Giáo viên sửa tên'})).body.user_code).toBe(first.body.code);
    const st=await api('POST','/api/admin/students',{full_name:'Học sinh mã tự động',birth_date:'2013-03-15'});
    expect(st.status).toBe(201);expect(st.body.user.user_code).toMatch(/^HS\d{8}$/);
    expect((await api('GET','/api/admin/registration-code/student',undefined,f.S1.token)).status).toBe(403);
    expect((await api('GET','/api/admin/registration-code/invalid')).status).toBe(400);
  });
  test('mã lớp tăng dần, tách mã tham gia, không đổi khi đổi tên lớp; tạo đồng thời không trùng',async()=>{
    const preview=(await api('GET','/api/admin/registration-code/class')).body.code;
    const made=await api('POST','/api/admin/classes',{year_id:f.yearId,grade:7,name:'7M1',semester:1,teacher_ids:[f.T1.id]});
    expect(made.status).toBe(201);expect(made.body.registration_code).toBe(preview);expect(made.body.join_code).toMatch(/^[A-Z2-9]{6}$/);
    const edit=await api('PATCH',`/api/admin/classes/${made.body.id}`,{name:'7M1 mới'});expect(edit.body.registration_code).toBe(preview);
    const many=await Promise.all([2,3,4,5].map(n=>api('POST','/api/admin/classes',{year_id:f.yearId,grade:7,name:`7M${n}`})));
    expect(many.map(r=>r.status)).toEqual([201,201,201,201]);expect(new Set(many.map(r=>r.body.registration_code)).size).toBe(4);
    expect((await api('GET',`/api/admin/classes?q=${preview}`)).body.items.map((c:any)=>c.id)).toContain(made.body.id);
  });
  test('một giáo viên nhiều lớp, mỗi học kỳ chỉ một giáo viên; chặn học kỳ sai và giáo viên trường khác',async()=>{
    for(const n of [1,2])expect((await api('POST','/api/admin/classes',{year_id:f.yearId,grade:7,name:`7P${n}`,semester:1,teacher_ids:[f.T1.id]})).status).toBe(201);
    for(const bad of [{semester:3},{teacher_ids:[f.T1.id,f.T2.id]},{teacher_ids:[f.TB.id]}]){
      expect((await api('POST','/api/admin/classes',{year_id:f.yearId,grade:7,name:'7Sai',...bad})).status).toBe(422);
    }
  });
  test('phân công riêng HK1/HK2, lịch lấy từ năm học; thay giáo viên cần xác nhận và có lịch sử',async()=>{
    const id=f.class7a.id;
    expect((await api('PATCH',`/api/admin/classes/${id}`,{semester:2,teacher_ids:[f.T2.id]})).status).toBe(200);
    const first=(await api('GET',`/api/admin/classes/${id}?semester=1`)).body;
    expect(first.teachers.map((t:any)=>t.id)).toEqual([f.T1.id]);
    expect(first.term_teachers.map((t:any)=>[t.semester,t.teacher_id])).toEqual([[1,f.T1.id],[2,f.T2.id]]);
    const dates=(await sql(s.url,'SELECT term1_starts_on::text AS starts_on,term1_ends_on::text AS ends_on FROM app_school_years WHERE id=$1',[f.yearId]))[0];
    expect(first.term_teachers[0]).toMatchObject(dates);
    expect((await api('PATCH',`/api/admin/classes/${id}`,{semester:1,teacher_ids:[f.T2.id]})).status).toBe(409);
    expect((await api('GET',`/api/admin/classes/${id}?semester=1`)).body.teachers[0].id).toBe(f.T1.id);
    expect((await api('PATCH',`/api/admin/classes/${id}`,{semester:1,teacher_ids:[f.T2.id],confirm_reassignment:true})).status).toBe(200);
    expect((await api('GET',`/api/admin/classes/${id}/events`)).body.some((e:any)=>e.kind==='change_teacher'&&e.note.includes('Học kỳ 1'))).toBe(true);
    await api('PATCH',`/api/admin/classes/${id}`,{semester:1,teacher_ids:[f.T1.id],confirm_reassignment:true});
  });
  test('quyền giáo viên chuyển đúng học kỳ ở API lớp, hồ sơ và thống kê; không truy cập trường khác',async()=>{
    const id=f.class7a.id;
    const saved=(await sql(s.url,'SELECT starts_on::text AS a,ends_on::text AS b,term1_starts_on::text AS c,term1_ends_on::text AS d,term2_starts_on::text AS e,term2_ends_on::text AS f FROM app_school_years WHERE id=$1',[f.yearId]))[0];
    try{
      await sql(s.url,"UPDATE app_school_years SET starts_on=current_date-100,ends_on=current_date+100,term1_starts_on=current_date-100,term1_ends_on=current_date+9,term2_starts_on=current_date+10,term2_ends_on=current_date+100 WHERE id=$1",[f.yearId]);
      expect((await api('GET',`/api/classroom/classes/${id}`,undefined,f.T1.token)).status).toBe(200);
      expect((await api('GET',`/api/classroom/classes/${id}`,undefined,f.T2.token)).status).toBe(404);
      await sql(s.url,"UPDATE app_school_years SET term1_ends_on=(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date-2,term2_starts_on=(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date-1 WHERE id=$1",[f.yearId]);
      expect((await api('GET',`/api/classroom/classes/${id}`,undefined,f.T1.token)).status).toBe(404);
      expect((await api('GET',`/api/classroom/classes/${id}`,undefined,f.T2.token)).status).toBe(200);
      expect((await api('GET',`/api/analytics/classes/${id}/dashboard`,undefined,f.T1.token)).status).toBe(404);
      expect((await api('GET',`/api/admin/classes/${id}`,undefined,f.B.token)).status).toBe(404);
    }finally{await sql(s.url,'UPDATE app_school_years SET starts_on=$2,ends_on=$3,term1_starts_on=$4,term1_ends_on=$5,term2_starts_on=$6,term2_ends_on=$7 WHERE id=$1',[f.yearId,saved.a,saved.b,saved.c,saved.d,saved.e,saved.f]);}
  });
  test('RLS bảo vệ phân công học kỳ và kho xóa vẫn lưu phân công khi xóa lớp',async()=>{
    const made=await api('POST','/api/admin/classes',{year_id:f.yearId,grade:7,name:'7Xoa',semester:1,teacher_ids:[f.T1.id]});
    expect(made.status).toBe(201);
    const denied=await api('PATCH',`/api/admin/classes/${made.body.id}`,{semester:1,teacher_ids:[f.TB.id],confirm_reassignment:true});expect(denied.status).toBe(422);
    expect((await api('DELETE',`/api/admin/classes/${made.body.id}`)).status).toBe(204);
    expect((await sql(s.url,"SELECT * FROM app_deleted_records WHERE source_table='app_class_term_teachers' AND record_key->>'class_id'=$1",[String(made.body.id)]))).toHaveLength(2);
    for(const role of ['dong_a_school_scope','dong_a_workspace_scope'])expect((await sql(s.url,"SELECT has_table_privilege($1,'app_deleted_records','SELECT') AS allowed",[role]))[0].allowed).toBe(false);
  });
});
