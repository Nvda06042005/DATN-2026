import { adminLogin, call, download, hasPostgres, sql, Started, startApp, upload } from './harness';
import { bootstrap, Fixture } from './fixture';

(hasPostgres() ? describe : describe.skip)('Mã tự động và giáo viên phụ trách lớp theo học kỳ',()=>{
  let s:Started,f:Fixture;
  const api=(method:string,path:string,body?:unknown,token?:string)=>call(s.base,method,path,body,token??f.A.token);
  beforeAll(async()=>{s=await startApp('class_semesters_test');f=await bootstrap(s,await adminLogin(s.base),true);});
  afterAll(async()=>{await s?.close();});
  test('tạo giáo viên và học sinh theo học kỳ, vẫn thấy khi chưa xếp lớp; PDF có tên đúng kỳ', async()=>{
    const teacher=await api('POST','/api/admin/teachers',{full_name:'Giáo viên học kỳ hai',email:'term.teacher@example.invalid',phone:'0900000123',birth_date:'1987-04-12',year_id:f.yearId,semester:2});
    expect(teacher.status).toBe(201);
    const student=await api('POST','/api/admin/students',{full_name:'Học sinh học kỳ hai',email:'term.student@example.invalid',phone:'0900000124',birth_date:'2012-05-16',year_id:f.yearId,semester:2});
    expect(student.status).toBe(201);
    expect((await sql(s.url,'SELECT user_id,semester FROM app_member_school_terms WHERE user_id IN ($1,$2) ORDER BY user_id',[teacher.body.user.id,student.body.user.id])).map((r:any)=>r.semester)).toEqual([2,2]);
    for(const [kind,id] of [['teachers',teacher.body.user.id],['students',student.body.user.id]] as const){
      const hk2=await api('GET',`/api/admin/${kind}?year_id=${f.yearId}&semester=2`);
      expect(hk2.body.items.map((u:any)=>u.id)).toContain(id);
      const hk1=await api('GET',`/api/admin/${kind}?year_id=${f.yearId}&semester=1`);
      expect(hk1.body.items.map((u:any)=>u.id)).not.toContain(id);
      const pdf=await fetch(`${s.base}/api/admin/${kind}/export?year_id=${f.yearId}&semester=2&format=pdf`,{headers:{Authorization:`Bearer ${f.A.token}`}});
      expect(pdf.status).toBe(200);
      expect(pdf.headers.get('content-disposition')).toMatch(new RegExp(`danh_sach_${kind==='teachers'?'giao-vien':'hoc-sinh'}_\\d{4}-\\d{4}_hoc-ky-2\\.pdf`));
    }
    expect((await api('POST','/api/admin/teachers',{full_name:'Giáo viên thiếu kỳ',email:'term.bad@example.invalid',phone:'0900000125',birth_date:'1987-04-12',year_id:f.yearId})).status).toBe(422);
  });
  test('nhập Excel giáo viên và học sinh gắn đúng học kỳ đã chọn',async()=>{
    for(const kind of ['teachers','students'] as const){
      const spec=(await api('GET',`/api/admin/${kind}/import-spec`)).body;
      const template=await download(s.base,`/api/admin/${kind}/template?year_id=${f.yearId}&semester=2`,f.A.token);
      const wb=new(await import('exceljs')).Workbook();await wb.xlsx.load(template.buffer as any);
      const ws=wb.worksheets[0];
      const year=(await sql(s.url,'SELECT label FROM app_school_years WHERE id=$1',[f.yearId]))[0].label;
      expect(ws.getCell('D3').value).toBe('Năm học:');
      expect(ws.getCell('E3').value).toBe(year);
      expect(ws.getCell('D4').value).toBe('Học kỳ:');
      expect(ws.getCell('E4').value).toBe('Học kỳ 2');
      expect(ws.getCell('C11').value).toBe('Họ và tên *');
      ws.getCell('C12').value=kind==='teachers'?'Giáo viên nhập kỳ hai':'Học sinh nhập kỳ hai';
      ws.getCell('E12').value=kind==='teachers'?'0900000141':'0900000142';
      ws.getCell('F12').value=`term.${kind}@example.invalid`;
      ws.getCell('G12').value=kind==='teachers'?'15/03/1985':'15/03/2013';
      const file=Buffer.from(await wb.xlsx.writeBuffer());
      const mismatch=await upload(s.base,`/api/admin/${kind}/import?year_id=${f.yearId}&semester=1`,spec.filename,file,f.A.token);
      expect(mismatch.status).toBe(400);
      expect(mismatch.body.detail).toContain('Năm học hoặc học kỳ trong file khác');
      const path=`/api/admin/${kind}/import?commit=true&year_id=${f.yearId}&semester=2`;
      const result=await upload(s.base,path,spec.filename,file,f.A.token);
      expect(result.status).toBe(200);expect(result.body.created).toBe(1);
      const id=(await api('GET',`/api/admin/${kind}?email=term.${kind}@example.invalid`)).body.items[0].id;
      expect((await sql(s.url,'SELECT semester FROM app_member_school_terms WHERE user_id=$1 AND year_id=$2',[id,f.yearId]))[0].semester).toBe(2);
      expect((await api('GET',`/api/admin/${kind}?year_id=${f.yearId}&semester=2`)).body.items.map((u:any)=>u.id)).toContain(id);
    }
  });
  test('xem mã không giữ chỗ; tạo giáo viên/học sinh không cần nhập mã; giữ mã cũ khi sửa',async()=>{
    const first=await api('GET','/api/admin/registration-code/teacher?birth_date=1985-03-15'); expect(first.status).toBe(200);expect(first.body.code).toMatch(/15031985\d{3}$/);
    expect((await api('GET','/api/admin/registration-code/teacher?birth_date=1985-03-15')).body).toEqual(first.body);
    const t=await api('POST','/api/admin/teachers',{full_name:'Giáo viên mã tự động',email:'auto-code@example.invalid',birth_date:'1985-03-15', phone: '0900000004'});
    expect(t.status).toBe(201);expect(t.body.user.user_code).toBe(first.body.code);
    expect((await api('PATCH',`/api/admin/users/${t.body.user.id}`,{full_name:'Giáo Viên Sửa Tên'})).body.user_code).toBe(first.body.code);
    const studentPreview=(await api('GET','/api/admin/registration-code/student?birth_date=2013-03-15')).body.code;
    const st=await api('POST','/api/admin/students',{full_name:'Học sinh mã tự động',birth_date:'2013-03-15', phone: '0900000005', email: 'tu.dong6.class_semesters@example.edu.vn'});
    expect(st.status).toBe(201);expect(st.body.user.user_code).toBe(studentPreview); // HS + viết tắt trường + năm + ngày sinh + STT, giống mẫu Excel học sinh
    expect((await api('GET','/api/admin/registration-code/student',undefined,f.S1.token)).status).toBe(403);
    expect((await api('GET','/api/admin/registration-code/invalid')).status).toBe(400);
  });
  test('mã lớp tăng dần, tách mã tham gia, không đổi khi đổi tên lớp; tạo đồng thời không trùng',async()=>{
    const preview=(await api('GET','/api/admin/registration-code/class')).body.code;
    const made=await api('POST','/api/admin/classes',{year_id:f.yearId,grade:7,name:'7M1',semester:1,teacher_ids:[f.T1.id]});
    expect(made.status).toBe(201);expect(made.body.registration_code).toBe(preview);expect(made.body.join_code).toMatch(/^DongA7M1[A-Za-z]+HK1\d{4}-\d{4}$/); // có giáo viên: mã tham gia theo quy ước (13/11/2026)
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
    expect((await api('PATCH',`/api/admin/classes/${id}`,{semester:1,teacher_ids:[f.T2.id],confirm_reassignment:true})).status).toBe(409);
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
  test('16/11/2026 (migration 069): đã sang HK2 mà lớp chỉ được phân công HK1 thì giáo viên HK1 vẫn thấy lớp ở Lớp học và Thống kê lớp cho tới khi có phân công HK2',async()=>{
    const made=await api('POST','/api/admin/classes',{year_id:f.yearId,grade:7,name:'7HK1',semester:1,teacher_ids:[f.T2.id]});
    expect(made.status).toBe(201);
    const id=made.body.id;
    const saved=(await sql(s.url,'SELECT starts_on::text AS a,ends_on::text AS b,term1_starts_on::text AS c,term1_ends_on::text AS d,term2_starts_on::text AS e,term2_ends_on::text AS f FROM app_school_years WHERE id=$1',[f.yearId]))[0];
    try{
      // ngày hiện tại đã thuộc HK2 (như năm học 2020-2021 vẫn đang hoạt động)
      await sql(s.url,"UPDATE app_school_years SET starts_on=current_date-100,ends_on=current_date+100,term1_starts_on=current_date-100,term1_ends_on=(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date-2,term2_starts_on=(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date-1,term2_ends_on=current_date+100 WHERE id=$1",[f.yearId]);
      expect((await api('GET','/api/classroom/classes',undefined,f.T2.token)).body.map((c:any)=>c.id)).toContain(id);
      expect((await api('GET','/api/analytics/classes',undefined,f.T2.token)).body.map((c:any)=>c.id)).toContain(id);
      expect((await api('GET',`/api/analytics/classes/${id}/dashboard`,undefined,f.T2.token)).status).toBe(200);
      expect((await api('GET',`/api/classroom/classes/${id}`,undefined,f.T1.token)).status).toBe(404); // giáo viên khác vẫn không thấy
      // quản trị trường phân công HK2 cho giáo viên khác thì giáo viên HK1 hết quyền, giáo viên HK2 có quyền
      expect((await api('PATCH',`/api/admin/classes/${id}`,{semester:2,teacher_ids:[f.T1.id],confirm_reassignment:true})).status).toBe(200);
      expect((await api('GET','/api/classroom/classes',undefined,f.T2.token)).body.map((c:any)=>c.id)).not.toContain(id);
      expect((await api('GET','/api/classroom/classes',undefined,f.T1.token)).body.map((c:any)=>c.id)).toContain(id);
    }finally{
      await sql(s.url,'UPDATE app_school_years SET starts_on=$2,ends_on=$3,term1_starts_on=$4,term1_ends_on=$5,term2_starts_on=$6,term2_ends_on=$7 WHERE id=$1',[f.yearId,saved.a,saved.b,saved.c,saved.d,saved.e,saved.f]);
      await api('DELETE',`/api/admin/classes/${id}`);
    }
  });
  test('RLS bảo vệ phân công học kỳ và kho xóa vẫn lưu phân công khi xóa lớp',async()=>{
    const made=await api('POST','/api/admin/classes',{year_id:f.yearId,grade:7,name:'7Xoa',semester:1,teacher_ids:[f.T1.id]});
    expect(made.status).toBe(201);
    const denied=await api('PATCH',`/api/admin/classes/${made.body.id}`,{semester:1,teacher_ids:[f.TB.id],confirm_reassignment:true});expect(denied.status).toBe(422);
    expect((await api('DELETE',`/api/admin/classes/${made.body.id}`)).status).toBe(204);
    expect((await sql(s.url,"SELECT * FROM app_deleted_records WHERE source_table='app_class_term_teachers' AND record_key->>'class_id'=$1",[String(made.body.id)]))).toHaveLength(2);
    for(const role of ['dong_a_school_scope','dong_a_workspace_scope'])expect((await sql(s.url,"SELECT has_table_privilege($1,'app_deleted_records','SELECT') AS allowed",[role]))[0].allowed).toBe(false);
  });
  test('bộ lọc năm học, học kỳ và các cột dùng đúng dữ liệu phân công', async()=>{
    const classId=f.class7a.id;
    const hk1=await api('GET',`/api/admin/teachers?year_id=${f.yearId}&semester=1&class_id=${classId}&name=${encodeURIComponent('Nguyễn Văn Sử')}&limit=20`);
    expect(hk1.status).toBe(200);
    expect(hk1.body.items.map((u:{id:number})=>u.id)).toContain(f.T1.id);
    const hk2=await api('GET',`/api/admin/teachers?year_id=${f.yearId}&semester=2&class_id=${classId}&limit=20`);
    expect(hk2.status).toBe(200);
    expect(hk2.body.items.map((u:{id:number})=>u.id)).toContain(f.T2.id);
    expect(hk2.body.items.map((u:{id:number})=>u.id)).not.toContain(f.T1.id);
    const classes=await api('GET',`/api/admin/classes?year_id=${f.yearId}&semester=1&name=7A1&teacher=${encodeURIComponent('Nguyễn Văn Sử')}&students=2`);
    expect(classes.status).toBe(200);
    expect(classes.body.items.map((c:{id:number})=>c.id)).toContain(classId);
  });
});
