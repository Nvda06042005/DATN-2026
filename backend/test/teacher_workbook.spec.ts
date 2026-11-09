import {activate,adminLogin,call,hasPostgres,sql,Started,startApp,upload} from './harness';
import {teacherTemplateFilename} from '../src/admin/excel';

describe('Tên file mẫu theo trường',()=>{
  test('bỏ cấp học, dấu và khoảng trắng; giữ đúng tên trường',()=>{
    expect(teacherTemplateFilename('THCS Giồng Ông Tố')).toBe('file_mau_giao-vien_truong_giong-ong-to.xlsx');
    expect(teacherTemplateFilename('Trường Trung học cơ sở Nguyễn Văn Quy')).toBe('file_mau_giao-vien_truong_nguyen-van-quy.xlsx');
  });
});
(hasPostgres()?describe:describe.skip)('Bảng nhập có lịch và file Excel giáo viên',()=>{
  let s:Started,root:string,A:{id:number;token:string},B:{id:number;token:string},workbook:Buffer;
  const row={full_name:'Giáo viên Từ Bảng',email:'draft@example.invalid',birth_date:'1985-03-15',gender:'female',phone:'0901234567'};
  const api=(method:string,path:string,body?:unknown,token?:string)=>call(s.base,method,path,body,token??A.token);
  const xlsx=async(rows:unknown[],token=A.token)=>fetch(s.base+'/api/admin/teachers/workbook',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({rows})});
  beforeAll(async()=>{
    s=await startApp('teacher_workbook_test');root=await adminLogin(s.base);
    const school=async(name:string,email:string)=>{
      const made=await call(s.base,'POST','/api/admin/schools',{name,admin:{full_name:'Quản trị Fixture',email}},root);
      const login=await activate(s.base,made.body.admin.username,made.body.temporary_password,'Fixture@123','school_admin');
      return {id:made.body.school.id,token:login.token};
    };
    A=await school('THCS Giồng Ông Tố','schoola@example.invalid');B=await school('THCS Phú Mỹ','schoolb@example.invalid');
  });
  afterAll(async()=>{await s?.close();});
  test('quy tắc file đúng trường, endpoint được bảo vệ',async()=>{
    const spec=await api('GET','/api/admin/teachers/import-spec');expect(spec.status).toBe(200);
    expect(spec.body).toMatchObject({filename:'file_mau_giao-vien_truong_giong-ong-to.xlsx',prefix:'GOT26',next_serial:1});
    expect((await api('GET','/api/admin/teachers/import-spec',undefined,B.token)).body.filename).toBe('file_mau_giao-vien_truong_phu-my.xlsx');
    expect((await api('GET',`/api/admin/teachers/import-spec?school_id=${B.id}`)).status).toBe(403);
    expect((await call(s.base,'GET','/api/admin/teachers/import-spec')).status).toBe(401);
    const file=await fetch(s.base+'/api/admin/teachers/template',{headers:{Authorization:`Bearer ${A.token}`}});
    expect(file.headers.get('content-disposition')).toContain('file_mau_giao-vien_truong_giong-ong-to.xlsx');
  });
  test('tạo workbook có STT/mã/ngày kiểu Date và không lưu tài khoản, không gửi thư, không giữ số',async()=>{
    const before=await sql(s.url,'SELECT (SELECT count(*)::int FROM app_users) AS users,(SELECT count(*)::int FROM app_email_outbox) AS mail');
    const res=await xlsx([row]);expect(res.status).toBe(200);expect(res.headers.get('content-disposition')).toContain('file_mau_giao-vien_truong_giong-ong-to.xlsx');
    workbook=Buffer.from(await res.arrayBuffer());const wb=new (await import('exceljs')).Workbook();await wb.xlsx.load(workbook as any);
    const sheet=wb.getWorksheet('Giáo viên')!;expect(sheet.getCell('A12').value).toBe(1);expect(sheet.getCell('B12').value).toBe('GOT2615031985001');expect(sheet.getCell('G12').value).toBeInstanceOf(Date);
    expect(await sql(s.url,'SELECT (SELECT count(*)::int FROM app_users) AS users,(SELECT count(*)::int FROM app_email_outbox) AS mail')).toEqual(before);
    expect((await api('GET','/api/admin/teachers/import-spec')).body.next_serial).toBe(1);
    expect((await xlsx([{...row,birth_date:'1985-02-31'}])).status).toBe(422);
    expect((await xlsx([row,{...row,full_name:'Trùng Email'}])).status).toBe(422);
    expect((await xlsx([])).status).toBe(400);
  });
  test('sai tên, file tải trùng (1), file trường khác đều bị chặn ở preview và commit; đúng tên mới nhập',async()=>{
    const expected='file_mau_giao-vien_truong_giong-ong-to.xlsx';
    for(const name of ['mau-giao-vien.xlsx','file_mau_giao-vien_truong_giong-ong-to (1).xlsx','file_mau_giao-vien_truong_phu-my.xlsx']){
      for(const mode of ['', '?commit=true']){const r=await upload(s.base,'/api/admin/teachers/import'+mode,name,workbook,A.token);expect(r.status).toBe(400);expect(r.body.detail).toContain(`Chỉ nhận ${expected}`);}
    }
    const preview=await upload(s.base,'/api/admin/teachers/import',expected,workbook,A.token);expect(preview.status).toBe(200);expect(preview.body.valid).toBe(1);expect(preview.body.created).toBe(0);
    const saved=await upload(s.base,'/api/admin/teachers/import?commit=true',expected,workbook,A.token);expect(saved.status).toBe(200);expect(saved.body.created).toBe(1);expect(saved.body.rows[0].user_code).toBe('GOT2615031985001');
  });
});
