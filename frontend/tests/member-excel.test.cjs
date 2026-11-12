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
 assert.match(people,/kind=\{teacher \? 'teacher' : 'student'\} showSerial birthDate=\{String\(v\.birth_date \|\| ''\)\}/);
 assert.match(people,/TeacherImportSheet session=\{session\} kind=\{kind\}/);
 const edit=read('components/admin/AccountSheet.tsx');assert.match(edit,/kind="student" showSerial userId=\{u\.id\}/);
 assert.doesNotMatch(edit,/if \(u\.role === 'student'\) Object\.assign\(body, \{ user_code:/);
});

test('thêm giáo viên/học sinh: Họ tên, SĐT, Email, Ngày sinh đều có dấu * (đủ hết mới tạo tài khoản); bỏ ô Email phụ huynh ở form thêm học sinh; hộp nhập ghi phải đúng file mẫu của trường',()=>{
 // các ô dùng chung cho giáo viên, học sinh và "Tạo học sinh mới vào lớp" ở trang Lớp học
 const people=read('components/admin/SchoolPeople.tsx'),fields=people.slice(people.indexOf('export const personFields'),people.indexOf('export const SchoolPeople'));
 for(const name of ['full_name','phone','email','birth_date'])assert.match(fields,new RegExp(`name: '${name}'[^}]*required: true`),name);
 assert.match(fields,/Tên đăng nhập và mật khẩu được gửi vào email này\./);
 assert.match(people,/const fields: FieldDef\[\] = teacher \? personFields\(true, token\)\s+: \[\.\.\.personFields\(false, token\), \{ name: 'class_id'/);
 assert.doesNotMatch(people,/parent_email|Email phụ huynh/);
 const sheet=read('components/admin/TeacherImportSheet.tsx');
 assert.match(sheet,/note=\{`Phải đúng file mẫu \$\{student\?'học sinh':'giáo viên'\} của \$\{spec\.school_name\}\. File của trường khác hoặc nhầm loại sẽ báo lỗi\.`\}/);
 assert.match(read('components/admin/kit.tsx'),/\{note \? <Txt size=\{13\} f="bold" testID="import-file-note">\{note\}<\/Txt> : null\}/);
});

test('Lớp học: bỏ nút Nhân bản; xếp lớp mỗi lớp một file; giáo viên chọn kèm mã; form tạo lớp giống Excel; danh sách học sinh như bảng Excel; tạo học sinh mới vào lớp',()=>{
 const classes=read('components/admin/SchoolClasses.tsx'),kit=read('components/admin/kit.tsx');
 assert.doesNotMatch(classes,/title="Nhân bản sang năm học mới"|setCloning|cloneClasses|class-clone/);
 assert.match(classes,/subtitle="Tạo lớp theo năm học và khối, phân công giáo viên và xếp học sinh vào lớp\."/);
 assert.match(classes,/api\.classImportSpec\(token, yearId\)/);
 assert.match(classes,/hint=\{`Mỗi lớp một file: tải file mẫu năm học \$\{spec\.year_label\}, gõ tên lớp, chọn học kỳ và giáo viên phụ trách/);
 assert.match(classes,/acceptText="Chỉ nhận file Excel\." note=\{`Phải đúng file mẫu xếp lớp năm học \$\{spec\.year_label\} của \$\{spec\.school_name\} \(được thêm tên lớp ở cuối tên file/);
 // mỗi lớp lưu một file nên tên file được thêm tên lớp: máy chủ kiểm tra phần đầu tên file, không so khớp nguyên tên ở trình duyệt
 const importer=classes.slice(classes.indexOf('const ClassImportSheet'),classes.indexOf('// ---------------------------------------------------------------------- chi tiết một lớp'));
 assert.doesNotMatch(importer,/expectedFilename/);
 assert.match(importer,/template=\{\{ filename: spec\.filename, fetchBlob: \(\) => api\.downloadFile\(token, `\/api\/admin\/classes\/template\?year_id=\$\{yearId\}`\) \}\}/);
 assert.doesNotMatch(classes,/mau-phan-lop\.xlsx/);
 assert.match(kit,/\{acceptText \?\? acceptNote\(types\)\}/);
 assert.match(kit,/testID="import-notes"/); // ghi chú: lớp sẽ được tạo, giáo viên phụ trách học kỳ
 // giáo viên phụ trách chọn trong danh sách kèm mã giáo viên (như ô Giáo viên phụ trách của file Excel)
 assert.match(classes,/label: `\$\{t\.user_code \?\? 'Chưa có mã'\} · \$\{t\.full_name\}`/);
 assert.match(classes,/name: 'teacher_id', label: 'Giáo viên phụ trách \(mã giáo viên · họ tên\)'/);
 assert.match(classes,/\{ name: 'name', label: 'Lớp', required: true, placeholder: '6A1'/);
 // chi tiết lớp: bảng STT, Mã học sinh, Họ và tên, Ngày sinh, Giới tính; sĩ số thực có; học sinh vào học muộn tạo ngay trong lớp
 const roster=[...classes.slice(classes.indexOf('testID="class-roster-title"')).matchAll(/key: '(\w+)', label: '([^']*)'/g)].slice(0,6).map(m=>m[2]);
 assert.deepEqual(roster,['STT','Mã học sinh','Họ và tên','Ngày sinh','Giới tính','']);
 assert.match(classes,/Sĩ số \{k\.members\.length\}/);
 assert.match(classes,/testID="class-create-student"/);
 assert.match(classes,/fields=\{personFields\(false, token\)\}/);
 assert.match(classes,/const body: Record<string, unknown> = \{ class_id: id \};/);
 assert.match(classes,/api\.createMember\(token, 'students', body as never\)/);
 assert.match(classes,/<CredentialSheet title=\{`Đã tạo và xếp vào lớp/);
});