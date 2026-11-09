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
 assert.match(acceptNote([XLSX_MIME,XLSM_MIME]),/Microsoft Excel trên Windows/);
});

test('chỉ mẫu .xlsm hoặc mẫu .xlsx cũ đúng trường được nhận, không nhận file tải trùng hoặc sai trường',()=>{
 for(const role of ['giao-vien','hoc-sinh']){
  const expected=`file_mau_${role}_truong_giong-ong-to.xlsm`,legacy=expected.replace('.xlsm','.xlsx');
  assert.equal(checkTemplateFilename(expected,expected,legacy),null);assert.equal(checkTemplateFilename(legacy,expected,legacy),null);
  for(const actual of [expected.replace('giong-ong-to','phu-my'),expected.replace('.xlsm',' (1).xlsm'),'mau.xlsm'])assert.match(checkTemplateFilename(actual,expected,legacy),/Sai tên file/);
 }
});

test('hộp nhập của hai vai trò dùng mẫu Excel có lịch, không còn bảng nhập trên website',()=>{
 const importer=read('components/admin/TeacherImportSheet.tsx'),kit=read('components/admin/kit.tsx');
 assert.match(importer,/kind\?:'teachers'\|'students'/);
 assert.match(importer,/hint="Chỉ nhận đúng file mẫu của trường\. Chọn ngày sinh trong Excel để tự sinh mã\." acceptMacro/);
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
