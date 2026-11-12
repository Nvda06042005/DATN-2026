import {activate,adminLogin,call,hasPostgres,sql,Started,startApp,upload} from './harness';
import {teacherTemplateFilename} from '../src/admin/excel';

describe('Tên file mẫu theo trường',()=>{
  test('bỏ cấp học, dấu và khoảng trắng; giữ đúng tên trường',()=>{
    expect(teacherTemplateFilename('THCS Giồng Ông Tố')).toBe('file_mau_giao-vien_truong_giong-ong-to.xlsx');
    expect(teacherTemplateFilename('Trường Trung học cơ sở Nguyễn Văn Quy')).toBe('file_mau_giao-vien_truong_nguyen-van-quy.xlsx');
  });
});
(hasPostgres()?describe:describe.skip)('File Excel giáo viên không macro',()=>{
  let s:Started,root:string,A:{id:number;token:string},B:{id:number;token:string},workbook:Buffer;
  const row={full_name:'Giáo viên Từ Bảng',email:'draft@example.invalid',birth_date:'1985-03-15',gender:'female',phone:'0901234567'};
  const api=(method:string,path:string,body?:unknown,token?:string)=>call(s.base,method,path,body,token??A.token);

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
    expect(spec.body).toMatchObject({filename:'file_mau_giao-vien_truong_giong-ong-to.xlsx',legacy_filename:'file_mau_giao-vien_truong_giong-ong-to.xlsm',prefix:'GOT26',next_serial:1});
    expect((await api('GET','/api/admin/teachers/import-spec',undefined,B.token)).body.filename).toBe('file_mau_giao-vien_truong_phu-my.xlsx');
    expect((await api('GET',`/api/admin/teachers/import-spec?school_id=${B.id}`)).status).toBe(403);
    expect((await call(s.base,'GET','/api/admin/teachers/import-spec')).status).toBe(401);
    const file=await fetch(s.base+'/api/admin/teachers/template',{headers:{Authorization:`Bearer ${A.token}`}});
    expect(file.headers.get('content-disposition')).toContain('file_mau_giao-vien_truong_giong-ong-to.xlsx');
  });
  test('mẫu Excel không có VBA, STT/mã là công thức để trống khi chưa đủ dữ liệu; không tạo tài khoản hoặc giữ số',async()=>{
    const before=await sql(s.url,'SELECT (SELECT count(*)::int FROM app_users) AS users,(SELECT count(*)::int FROM app_email_outbox) AS mail');
    const res=await fetch(s.base+'/api/admin/teachers/template',{headers:{Authorization:`Bearer ${A.token}`}});expect(res.status).toBe(200);expect(res.headers.get('content-type')).toContain('openxmlformats-officedocument.spreadsheetml.sheet');
    workbook=Buffer.from(await res.arrayBuffer());const zip=await(await import('jszip')).default.loadAsync(workbook);expect(Object.keys(zip.files).some(name=>/vba|activeX/i.test(name))).toBe(false);expect(await zip.file('[Content_Types].xml')!.async('string')).not.toContain('macroEnabled');expect(await zip.file('xl/webextensions/dongaCalendar.xml')!.async('string')).toContain('wa102957665');
    const wb=new(await import('exceljs')).Workbook();await wb.xlsx.load(workbook as any);const sheet=wb.getWorksheet('Giáo viên')!;expect(sheet.getCell('A12').text).toBe('');expect(sheet.getCell('B12').text).toBe('');
    expect(sheet.getCell('A12').formula).toContain('COUNTIFS(');expect(sheet.getCell('B12').formula).toContain('GOT26');expect(sheet.getCell('A1011').text).toBe('');
    sheet.getCell('C12').value=row.full_name;sheet.getCell('D12').value='Nữ';sheet.getCell('E12').value=row.phone;sheet.getCell('F12').value=row.email;sheet.getCell('G12').value=new Date(row.birth_date);workbook=Buffer.from(await wb.xlsx.writeBuffer());
    expect(await sql(s.url,'SELECT (SELECT count(*)::int FROM app_users) AS users,(SELECT count(*)::int FROM app_email_outbox) AS mail')).toEqual(before);expect((await api('GET','/api/admin/teachers/import-spec')).body.next_serial).toBe(1);
    expect((await api('POST','/api/admin/teachers/workbook',{rows:[row]})).status).toBe(404);
  });
  test('sai tên, file tải trùng (1), file trường khác đều bị chặn ở preview và commit; đúng tên mới nhập',async()=>{
    const expected='file_mau_giao-vien_truong_giong-ong-to.xlsx';
    for(const name of ['mau-giao-vien.xlsm','file_mau_giao-vien_truong_giong-ong-to (1).xlsm','file_mau_giao-vien_truong_phu-my.xlsm']){
      for(const mode of ['', '?commit=true']){const r=await upload(s.base,'/api/admin/teachers/import'+mode,name,workbook,A.token);expect(r.status).toBe(400);expect(r.body.detail).toContain(`Chỉ nhận ${expected}`);}
    }
    const preview=await upload(s.base,'/api/admin/teachers/import',expected,workbook,A.token);expect(preview.status).toBe(200);expect(preview.body.valid).toBe(1);expect(preview.body.created).toBe(0);
    const saved=await upload(s.base,'/api/admin/teachers/import?commit=true',expected,workbook,A.token);expect(saved.status).toBe(200);expect(saved.body.created).toBe(1);expect(saved.body.rows[0].user_code).toBe('GOT2615031985001');
  });
  test('bản .xlsm cũ đúng tên vẫn đọc được, máy chủ không chạy macro',async()=>{
    const {withEntryMacros}=await import('../src/admin/entry-macros');
    const file=await withEntryMacros(workbook,'teachers','GOT26',0);
    const spec=(await api('GET','/api/admin/teachers/import-spec')).body;
    const preview=await upload(s.base,'/api/admin/teachers/import',spec.legacy_filename,file,A.token);
    expect(preview.status).toBe(200);expect(preview.body.total).toBe(1);
  });
});
