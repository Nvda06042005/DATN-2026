import {activate,adminLogin,call,download,hasPostgres,sql,Started,startApp,upload} from './harness';
import {studentTemplateFilename} from '../src/admin/excel';
const SCHOOL='THCS Giồng Ông Tố',SHORT_SCHOOL='THCS A';
(hasPostgres()?describe:describe.skip)('Excel học sinh cùng quy trình giáo viên',()=>{
 let s:Started,root:string,A:{id:number;token:string},B:{id:number;token:string},C:{id:number;token:string};
 const api=(method:string,path:string,body?:unknown,token?:string)=>call(s.base,method,path,body,token??A.token);
 const prefixOf=(name:string)=>name===SHORT_SCHOOL?'HSA26':'HSGOT26';
 const open=async(buffer:Buffer)=>{const w=new(await import('exceljs')).Workbook();await w.xlsx.load(buffer as any);return w;};
 async function fill(template:Buffer,rows:Array<Array<string|Date|null>>){const wb=await open(template),sheet=wb.getWorksheet('Học sinh')!;const first=12;rows.forEach((values,i)=>values.forEach((v,c)=>{if(v!==null)sheet.getRow(first+i).getCell(c+3).value=v;}));return {file:Buffer.from(await wb.xlsx.writeBuffer()),first};}
 beforeAll(async()=>{
  s=await startApp('student_excel_test');root=await adminLogin(s.base);
  const school=async(name:string,email:string)=>{const made=await call(s.base,'POST','/api/admin/schools',{name,admin:{full_name:'Quản trị Fixture',email}},root);const login=await activate(s.base,made.body.admin.username,made.body.temporary_password,'Fixture@123','school_admin');return{id:made.body.school.id,token:login.token};};
  A=await school(SCHOOL,'schoola@example.invalid');B=await school('THCS Phú Mỹ','schoolb@example.invalid');C=await school(SHORT_SCHOOL,'schoolc@example.invalid');
 });
 afterAll(async()=>{await s?.close();});
 test('file đúng tên trường, bảy cột có mẫu, STT/mã trống ở1000dòng; phạm vi và xác thực',async()=>{
  expect(studentTemplateFilename(SCHOOL)).toBe('file_mau_hoc-sinh_truong_giong-ong-to.xlsm');
  const spec=await api('GET','/api/admin/students/import-spec');expect(spec.body).toMatchObject({filename:studentTemplateFilename(SCHOOL),prefix:'HSGOT26',next_serial:1});
  expect((await call(s.base,'GET','/api/admin/students/import-spec')).status).toBe(401);
  expect((await api('GET',`/api/admin/students/import-spec?school_id=${B.id}`)).status).toBe(403);
  const res=await download(s.base,'/api/admin/students/template',A.token);expect(res.status).toBe(200);
  const wb=await open(res.buffer),sheet=wb.getWorksheet('Học sinh')!;
  expect(wb.worksheets.map(w=>w.name)).toEqual(['Học sinh','Hướng dẫn']);expect(sheet.getImages()).toHaveLength(1);
  expect(sheet.getCell('B8').value).toBe('HSGOT2602042013001');expect(sheet.getCell('G8').value).toBeInstanceOf(Date);
  expect((sheet.getRow(11).values as unknown[]).slice(1)).toEqual(['Số thứ tự','Mã học sinh','Họ và tên *','Giới tính','SĐT','Email','Ngày tháng năm sinh *']);
  expect(sheet.getCell('A12').text).toBe('');expect(sheet.getCell('B12').text).toBe('');expect(sheet.getCell('A1011').text).toBe('');
  expect(sheet.getCell('A12').formula).toBeUndefined();const zip=await(await import('jszip')).default.loadAsync(res.buffer);expect(zip.file('xl/vbaProject.bin')).toBeTruthy();
  expect(sheet.getCell('D12').dataValidation.formulae).toEqual(['"Nam,Nữ,Khác"']);expect(sheet.getCell('G12').numFmt).toBe('dd/mm/yyyy');
  const raw=await fetch(s.base+'/api/admin/students/template',{headers:{Authorization:'Bearer '+A.token}});expect(raw.headers.get('content-disposition')).toContain(spec.body.filename);
 });
 test('mẫu không tạo tài khoản/gửi thư/giữ số; emailoptional và genderother; sai tên bị chặn previewcommit',async()=>{
  const before=await sql(s.url,'SELECT (SELECT count(*)::int FROM app_users) AS users,(SELECT count(*)::int FROM app_email_outbox) AS mail');
  const template=await download(s.base,'/api/admin/students/template',A.token),wb=await open(template.buffer),sheet=wb.getWorksheet('Học sinh')!;
  sheet.getCell('A12').value=1;sheet.getCell('B12').value='HSGOT2615032013001';sheet.getCell('C12').value='Học sinh Lịch';sheet.getCell('D12').value='Khác';sheet.getCell('G12').value=new Date('2013-03-15');
  const file=Buffer.from(await wb.xlsx.writeBuffer());
  expect(await sql(s.url,'SELECT (SELECT count(*)::int FROM app_users) AS users,(SELECT count(*)::int FROM app_email_outbox) AS mail')).toEqual(before);
  expect((await api('GET','/api/admin/students/import-spec')).body.next_serial).toBe(1);
  expect((await api('POST','/api/admin/students/workbook',{rows:[]})).status).toBe(404);
  for(const name of ['mau-hoc-sinh.xlsx','file_mau_hoc-sinh_truong_giong-ong-to (1).xlsm',studentTemplateFilename('THCS Phú Mỹ')])for(const mode of ['', '?commit=true'])expect((await upload(s.base,'/api/admin/students/import'+mode,name,file,A.token)).status).toBe(400);
  const filename=studentTemplateFilename(SCHOOL),preview=await upload(s.base,'/api/admin/students/import',filename,file,A.token);expect(preview.body.valid).toBe(1);expect(preview.body.rows[0].user_code).toBe('HSGOT2615032013001');
  const saved=await upload(s.base,'/api/admin/students/import?commit=true',filename,file,A.token);expect(saved.body.created).toBe(1);
  expect((await upload(s.base,'/api/admin/students/import?commit=true',filename,file,A.token)).body.created).toBe(0);
 });
 test('file cũ giữ cột lớp/phụ huynh, lỗi ngày sinh đúng dòng, export giữ bố cục',async()=>{
  const y=(await api('POST','/api/admin/school-years',{label:'2026-2027'})).body.id;await api('POST',`/api/admin/school-years/${y}/activate`,{});
  const cls=(await api('POST','/api/admin/classes',{year_id:y,name:'7A1',grade:7})).body;
  const wb=new(await import('exceljs')).Workbook(),ws=wb.addWorksheet('Học sinh');ws.addRow(['Mã học sinh','Họ và tên *','Ngày sinh *','Giới tính','Lớp','Email','Email phụ huynh']);ws.addRow(['OLD-CODE','Học sinh Cũ','15/03/2013','Nữ','7A1','','parent@example.invalid']);ws.addRow(['','Học sinh Sai','31/02/2013','','','','']);
  const filename=studentTemplateFilename(SCHOOL),r=await upload(s.base,`/api/admin/students/import?commit=true&year_id=${y}`,filename,Buffer.from(await wb.xlsx.writeBuffer()),A.token);
  expect(r.body.created).toBe(1);expect(r.body.rows[1]).toMatchObject({row:3,status:'error'});
  const list=await api('GET',`/api/admin/students?class_id=${cls.id}`);expect(list.body.items[0]).toMatchObject({full_name:'Học sinh Cũ',parent_email:'parent@example.invalid'});
  const out=await download(s.base,'/api/admin/students/export',A.token),exported=await open(out.buffer);expect(exported.getWorksheet('Học sinh')!.getImages()).toHaveLength(1);const headers:string[]=[];exported.getWorksheet('Học sinh')!.eachRow(row=>{if((row.values as unknown[]).includes('Mã học sinh'))headers.push(...(row.values as string[]).slice(1));});expect(headers).toContain('Mã học sinh');
 });
  test('file đã lưu bằng Excel thật (công thức điền xuống được lưu dạng dùng chung): mã vẫn đúng tiền tố ở mọi dòng', async () => {
    // trường có tiền tố ngắn (HSA26) trông như địa chỉ ô Excel nên ExcelJS dịch nhầm nó thành HSA28 khi đọc công thức dùng chung ở dòng sau
    const{AccountService}=await import('../src/admin/account.service');const actor=(await import('../src/database/database.service')).toUser((await sql(s.url,"SELECT * FROM app_users WHERE school_id=$1 AND role='school_admin'",[C.id]))[0]);const template=await s.moduleRef.get(AccountService).studentTemplate(actor);
    const { file, first } = await fill(template, [
      ['Nguyễn Thị Lan', 'Nữ', null, 'lan.c@example.edu.vn', new Date('2013-04-02T00:00:00.000Z')],
      [null, null, null, null, null],
      ['Trần Văn Bình', 'Nam', null, 'binh.c@example.edu.vn', new Date('2013-05-06T00:00:00.000Z')],
    ]);
    // Excel gộp các công thức giống nhau của một cột thành "công thức dùng chung": ô gốc giữ chữ công thức, các ô con chỉ trỏ về ô gốc
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(file);
    const entry = 'xl/worksheets/sheet1.xml';
    let xml = await zip.file(entry)!.async('string');
    let si = 0;
    for (const col of ['A', 'B']) {
      let rows = 0;
      const cell = new RegExp(`<c r="${col}(\\d+)"([^>]*)><f>([^<]*)</f>`, 'g');
      xml = xml.replace(cell, (whole, row: string, attrs: string, formula: string) => {
        if (Number(row) < first) return whole;
        rows += 1;
        return rows === 1 ? `<c r="${col}${row}"${attrs}><f t="shared" ref="${col}${first}:${col}${first + 999}" si="${si}">${formula}</f>` : `<c r="${col}${row}"${attrs}><f t="shared" si="${si}"/>`;
      });
      expect(rows).toBe(1000);
      si += 1;
    }
    zip.file(entry, xml);
    const shared = Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
    const reread = await open(shared);
    expect((reread.getWorksheet('Học sinh')!.getCell(first + 2, 2).value as { sharedFormula?: string }).sharedFormula).toBe(`B${first}`); // đúng là dạng dùng chung như Excel lưu
    expect(prefixOf(SHORT_SCHOOL)).toMatch(/^HSA\d\d$/);
    const preview = await upload(s.base, '/api/admin/students/import', (await api('GET','/api/admin/students/import-spec',undefined,C.token)).body.filename, shared, C.token);
    expect(preview.status).toBe(200);
    expect(preview.body.rows.map((r: { row: number; user_code: string; status: string }) => [r.row, r.user_code, r.status])).toEqual([
      [first, `${prefixOf(SHORT_SCHOOL)}02042013001`, 'ok'],
      [first + 2, `${prefixOf(SHORT_SCHOOL)}06052013002`, 'ok'], // học sinh thứ hai (dòng trống ở giữa không tính); tiền tố không bị dịch thành HSA28
    ]);
  });

});
