const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const mod={exports:{}};const compiled=ts.transpileModule(read('lib/upload-rules.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
new vm.Script(`(function(module,exports){${compiled}\n})`).runInThisContext()(mod,mod.exports);
const {XLSX_MIME,XLSM_MIME,MAX_XLSX_BYTES,acceptedExtensions,checkPickedFile,checkTemplateFilename,acceptNote}=mod.exports;

test('mẫu có macro chỉ được nhận khi hộp nhập giáo viên/học sinh cho phép; giữ giới hạn dung lượng',()=>{
 assert.deepEqual(acceptedExtensions([XLSX_MIME,XLSM_MIME]),['.xlsx','.xlsm']);
 assert.equal(checkPickedFile({name:'mau.xlsm',size:200},[XLSX_MIME,XLSM_MIME]),null);
 assert.match(checkPickedFile({name:'mau.xlsm',size:200},[XLSX_MIME]),/không đúng loại/);
 assert.match(checkPickedFile({name:'mau.xlsm',size:MAX_XLSX_BYTES+1},[XLSX_MIME,XLSM_MIME]),/quá lớn/);
 assert.equal(acceptNote([XLSX_MIME,XLSM_MIME]),'Chỉ nhận file Excel.');
});

test('chỉ mẫu .xlsx hoặc mẫu .xlsm cũ đúng trường được nhận, không nhận file tải trùng hoặc sai trường',()=>{
 for(const role of ['giao-vien','hoc-sinh']){
  const expected=`file_mau_${role}_truong_giong-ong-to.xlsx`,legacy=expected.replace('.xlsx','.xlsm');
  assert.equal(checkTemplateFilename(expected,expected,legacy),null);assert.equal(checkTemplateFilename(legacy,expected,legacy),null);
  for(const actual of [expected.replace('giong-ong-to','phu-my'),expected.replace('.xlsx',' (1).xlsx'),'mau.xlsm'])assert.match(checkTemplateFilename(actual,expected,legacy),/Sai tên file/);
 }
});

test('hộp nhập của hai vai trò dùng mẫu Excel có lịch, không còn bảng nhập trên website',()=>{
 const importer=read('components/admin/TeacherImportSheet.tsx'),kit=read('components/admin/kit.tsx');
 assert.match(importer,/kind\?:'teachers'\|'students'/);
 assert.match(importer,/hint="Tải file mẫu, điền danh sách rồi chọn file để nhập\."/);
 assert.doesNotMatch(importer,/Vertex42|macro|lịch/);
 assert.match(importer,/expectedFilename=\{spec\.filename\} legacyFilename=\{spec\.legacy_filename\}/);
 assert.doesNotMatch(importer,/Nhập trên bảng|TeacherEntrySheet|Grid2X2|entry-open/);
 assert.match(kit,/acceptMacro=false/);assert.match(kit,/const types=acceptMacro\?\[\.\.\.XLSX_TYPES,XLSM_MIME\]:baseTypes/);
 assert.doesNotMatch(read('api/adminApi.ts'),/DraftWorkbook|\/workbook/);
});

test('danh sách và biểu mẫu học sinh cùng cột mẫu Excel; mã xem trước và số thứ tự không nhập tay',()=>{
 const people=read('components/admin/SchoolPeople.tsx'),start=people.indexOf('columns={teacher ? ['),studentStart=people.indexOf('] : [',start),table=people.slice(studentStart,people.indexOf(']} />',studentStart));
 const labels=[...table.matchAll(/label: '([^']+)'/g)].map(m=>m[1]);assert.deepEqual(labels.slice(0,7),['Số thứ tự','Mã học sinh','Họ và tên','Giới tính','SĐT','Email','Ngày tháng năm sinh']);
 assert.match(people,/kind="student" showSerial birthDate=\{String\(v\.birth_date\|\|''\)\}/);
 assert.match(people,/TeacherImportSheet session=\{session\} kind=\{kind\}/);
 const edit=read('components/admin/AccountSheet.tsx');assert.match(edit,/kind="student" showSerial userId=\{u\.id\}/);
 assert.doesNotMatch(edit,/if \(u\.role === 'student'\) Object\.assign\(body, \{ user_code:/);
});

test('thêm giáo viên/học sinh: Họ tên, SĐT, Email, Ngày sinh đều có dấu * (đủ hết mới tạo tài khoản); bỏ ô Email phụ huynh ở form thêm học sinh; hộp nhập ghi phải đúng file mẫu của trường',()=>{
 const people=read('components/admin/SchoolPeople.tsx'),fields=people.slice(people.indexOf('const fields: FieldDef[]'),people.indexOf('return (',people.indexOf('const fields: FieldDef[]')));
 const [teacher,student]=fields.split(': [{ name: \'user_code\', label: \'Mã học sinh\'');
 for(const part of [teacher,student]){
  for(const name of ['full_name','phone','email','birth_date'])assert.match(part,new RegExp(`name: '${name}'[^}]*required: true`),name);
  assert.match(part,/Tên đăng nhập và mật khẩu được gửi vào email này\./);
 }
 assert.doesNotMatch(student,/parent_email|Email phụ huynh/);
 const sheet=read('components/admin/TeacherImportSheet.tsx');
 assert.match(sheet,/note=\{`Phải đúng file mẫu \$\{student\?'học sinh':'giáo viên'\} của \$\{spec\.school_name\}\. File của trường khác hoặc nhầm loại sẽ báo lỗi\.`\}/);
 assert.match(read('components/admin/kit.tsx'),/\{note \? <Txt size=\{13\} f="bold" testID="import-file-note">\{note\}<\/Txt> : null\}/);
});

test('Lớp học: bỏ nút Nhân bản sang năm học mới; Xếp lớp từ Excel dùng file mẫu của trường và năm học như nhập giáo viên/học sinh',()=>{
 const classes=read('components/admin/SchoolClasses.tsx');
 assert.doesNotMatch(classes,/title="Nhân bản sang năm học mới"|setCloning|cloneClasses|class-clone/);
 assert.match(classes,/subtitle="Tạo lớp theo năm học và khối, phân công giáo viên và xếp học sinh vào lớp\."/);
 assert.match(classes,/api\.classImportSpec\(token, yearId\)/);
 assert.match(classes,/acceptText="Chỉ nhận file Excel\." note=\{`Phải đúng file mẫu xếp lớp năm học \$\{spec\.year_label\} của \$\{spec\.school_name\}\. File của trường hoặc năm học khác sẽ báo lỗi\.`\}/);
 assert.match(classes,/expectedFilename=\{spec\.filename\} template=\{\{ filename: spec\.filename, fetchBlob: \(\) => api\.downloadFile\(token, `\/api\/admin\/classes\/template\?year_id=\$\{yearId\}`\) \}\}/);
 assert.doesNotMatch(classes,/mau-phan-lop\.xlsx/);
 assert.match(read('components/admin/kit.tsx'),/\{acceptText \?\? acceptNote\(types\)\}/);
});