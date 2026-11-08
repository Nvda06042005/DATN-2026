const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const load=file=>{const mod={exports:{}};const code=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new vm.Script(`(function(module,exports){${code}\n})`).runInThisContext()(mod,mod.exports);return mod.exports;};
const {blankTeacherRow,teacherRowError,numberedTeacherRows}=load('lib/teacher-entry.ts');
const {checkTemplateFilename}=load('lib/upload-rules.ts');
test('STT/mã chỉ hiện khi hoàn tất dòng; không đánh sẵn 1–1000, không đếm dòng trống',()=>{
 const row={...blankTeacherRow(),full_name:'Giáo viên Mẫu',email:'fixture@example.invalid',birth_date:'1985-03-15'};
 const spec={prefix:'GOT26',next_serial:3};
 assert.deepEqual(numberedTeacherRows([blankTeacherRow(),row,blankTeacherRow(),{...row,birth_date:'1986-04-16'}],spec,'2026-11-09'),[{stt:null,code:''},{stt:1,code:'GOT2615031985003'},{stt:null,code:''},{stt:2,code:'GOT2616041986004'}]);
 assert.match(teacherRowError({...row,birth_date:'1985-02-31'},'2026-11-09'),/ngày sinh/);
 assert.match(teacherRowError({...row,email:''},'2026-11-09'),/email/);
});
test('chỉ tên file mẫu đúng trường được nhận, kể cả bản tải trùng có (1) cũng báo rõ',()=>{
 const expected='file_mau_giao-vien_giong-ong-to.xlsx';assert.equal(checkTemplateFilename(expected,expected),null);
 for(const wrong of ['mau-giao-vien.xlsx','file_mau_giao-vien_giong-ong-to (1).xlsx','file_mau_giao-vien_phu-my.xlsx'])assert.ok(checkTemplateFilename(wrong,expected).includes(expected));
 assert.equal(checkTemplateFilename('file-kho.xlsx'),null);
});
