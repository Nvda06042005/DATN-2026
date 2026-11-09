const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const load=file=>{const mod={exports:{}};const code=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new vm.Script(`(function(module,exports){${code}\n})`).runInThisContext()(mod,mod.exports);return mod.exports;};
const {blankTeacherRow,hasTeacherInput,teacherRowError,numberedTeacherRows,teacherDraft}=load('lib/teacher-entry.ts');
const {checkTemplateFilename}=load('lib/upload-rules.ts');
test('STT/mã chỉ hiện sau xác nhận Enter; không đánh sẵn 1–1000, không đếm dòng trống',()=>{
 const row={...blankTeacherRow(),full_name:'Giáo viên Mẫu',email:'fixture@example.invalid',birth_date:'1985-03-15'};
 const spec={prefix:'GOT26',next_serial:3};
 assert.equal(blankTeacherRow().confirmed,false);
 assert.deepEqual(numberedTeacherRows([row],spec,'2026-11-09'),[{stt:null,code:''}]);
 const confirmed={...row,confirmed:true};
 assert.deepEqual(numberedTeacherRows([blankTeacherRow(),confirmed,row,{...confirmed,birth_date:'1986-04-16'}],spec,'2026-11-09'),[{stt:null,code:''},{stt:1,code:'GOT2615031985003'},{stt:null,code:''},{stt:2,code:'GOT2616041986004'}]);
 assert.deepEqual(numberedTeacherRows([{...confirmed,confirmed:false}],spec,'2026-11-09'),[{stt:null,code:''}]);
 assert.deepEqual(numberedTeacherRows([{...confirmed,birth_date:'1985-02-31'}],spec,'2026-11-09'),[{stt:null,code:''}]);
 assert.match(teacherRowError({...row,birth_date:'1985-02-31'},'2026-11-09'),/ngày sinh/);
 assert.match(teacherRowError({...row,email:''},'2026-11-09'),/email/);
});

test('dòng trống không tính là dữ liệu; xác nhận chỉ nằm trên web, không gửi vào workbook',()=>{
 assert.equal(hasTeacherInput(blankTeacherRow()),false);
 assert.equal(hasTeacherInput({...blankTeacherRow(),confirmed:true}),false);
 const row={...blankTeacherRow(),full_name:'  Giáo viên Mẫu  ',email:' fixture@example.invalid ',birth_date:'1985-03-15',confirmed:true};
 assert.equal(hasTeacherInput(row),true);
 assert.deepEqual(teacherDraft(row),{full_name:'Giáo viên Mẫu',email:'fixture@example.invalid',phone:undefined,gender:undefined,birth_date:'1985-03-15'});
 assert.equal(Object.hasOwn(teacherDraft(row),'confirmed'),false);
});
test('chỉ tên file mẫu đúng trường được nhận, kể cả bản tải trùng có (1) cũng báo rõ',()=>{
 const expected='file_mau_giao-vien_truong_giong-ong-to.xlsx';assert.equal(checkTemplateFilename(expected,expected),null);
 for(const wrong of ['mau-giao-vien.xlsx','file_mau_giao-vien_truong_giong-ong-to (1).xlsx','file_mau_giao-vien_truong_phu-my.xlsx'])assert.ok(checkTemplateFilename(wrong,expected).includes(expected));
 assert.equal(checkTemplateFilename('file-kho.xlsx'),null);
});
