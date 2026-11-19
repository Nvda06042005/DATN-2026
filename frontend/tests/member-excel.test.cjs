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
 assert.match(importer,/kind\?: 'teachers' \| 'students'/);
 assert.match(importer,/hint="Tải file mẫu, điền danh sách rồi chọn file để nhập\."/);
 assert.doesNotMatch(importer,/Nhập trên bảng|TeacherEntrySheet/);
 assert.match(importer,/year_id: yearId \|\| undefined, semester: yearId \? semester : undefined/);
 assert.match(importer,/\/template\?year_id=\$\{yearId\}&semester=\$\{semester\}/);
 assert.match(importer,/yearId \? `\/api\/admin\/\$\{kind\}\/template\?year_id=/);
 assert.match(importer,/expectedFilename=\{spec\.filename\} legacyFilename=\{spec\.legacy_filename\}/);
 assert.doesNotMatch(importer,/Nhập trên bảng|TeacherEntrySheet|Grid2X2|entry-open/);
 assert.match(kit,/acceptMacro=false/);assert.match(kit,/const types=acceptMacro\?\[\.\.\.XLSX_TYPES,XLSM_MIME\]:baseTypes/);
 assert.doesNotMatch(read('api/adminApi.ts'),/DraftWorkbook|\/workbook/);
});

test('19/11/2026: bảng học sinh giống bảng giáo viên; form thêm / sửa không hiện STT (tự sinh); sửa thông tin không đổi mã',()=>{
 const people=read('components/admin/SchoolPeople.tsx'),start=people.indexOf('columns={teacher ? ['),studentStart=people.indexOf('] : [',start),table=people.slice(studentStart,people.indexOf(']} />',studentStart));
 const labels=[...table.matchAll(/label: '([^']+)'/g)].map(m=>m[1]);assert.deepEqual(labels,['STT','Mã học sinh','Họ và tên','Giới tính','Khối','Lớp','Trạng thái']);
 assert.match(people,/kind=\{teacher \? 'teacher' : 'student'\} birthDate=\{String\(v\.birth_date \|\| ''\)\}/);
 assert.doesNotMatch(people,/showSerial/);
 assert.match(people,/TeacherImportSheet session=\{session\} kind=\{kind\}/);
 const edit=read('components/admin/AccountSheet.tsx');assert.doesNotMatch(edit,/showSerial/);
 assert.match(edit,/\{ name: 'user_code', label, readOnly: true, hint: 'Mã đã cấp, không đổi khi sửa thông tin\.' \}/);
 assert.doesNotMatch(edit,/if \(u\.role === 'student'\) Object\.assign\(body, \{ user_code:/);
});

test('thêm giáo viên: Họ tên, SĐT, Email, Ngày sinh có dấu *; thêm học sinh (19/11/2026): SĐT, email không bắt buộc, không còn Xếp vào lớp; hộp nhập ghi phải đúng file mẫu của trường',()=>{
 // các ô dùng chung cho giáo viên, học sinh và "Tạo học sinh mới vào lớp" ở trang Lớp học
 const people=read('components/admin/SchoolPeople.tsx'),fields=people.slice(people.indexOf('export const personFields'),people.indexOf('export const SchoolPeople'));
 for(const name of ['full_name','birth_date'])assert.match(fields,new RegExp(`name: '${name}'[^}]*required: true`),name);
 for(const name of ['phone','email'])assert.match(fields,new RegExp(`name: '${name}'[^}]*required: teacher`),name);
 assert.match(fields,/Tên đăng nhập và mật khẩu được gửi vào email này\./);
 assert.match(people,/name: 'year_id', label: 'Năm học'/);
 assert.match(people,/name: 'semester', label: 'Học kỳ'/);
 assert.match(people,/\.\.\.personFields\(teacher, token\)/);
 assert.doesNotMatch(people,/label: 'Xếp vào lớp'|name: 'class_id'/);
 assert.doesNotMatch(people,/parent_email|Email phụ huynh/);
 const sheet=read('components/admin/TeacherImportSheet.tsx');
 assert.match(sheet,/note=\{`Phải đúng file mẫu \$\{student \? 'học sinh' : 'giáo viên'\} của \$\{spec\.school_name\}\. File của trường khác hoặc nhầm loại sẽ báo lỗi\.`\}/);
 assert.match(read('components/admin/kit.tsx'),/\{note \? <Txt size=\{13\} f="bold" testID="import-file-note">\{note\}<\/Txt> : null\}/);
});

test('Lớp học / Phân công giáo viên (19/11/2026): tạo lớp chỉ Lớp, Học kỳ, Khối, Sĩ số dự kiến; tạo lớp từ Excel; xếp lớp mỗi lớp một file ở Phân công; giáo viên chọn kèm mã; danh sách học sinh như bảng Excel',()=>{
 const classes=read('components/admin/SchoolClasses.tsx'),kit=read('components/admin/kit.tsx');
 assert.doesNotMatch(classes,/title="Nhân bản sang năm học mới"|setCloning|cloneClasses|class-clone/);
 assert.match(classes,/title=\{assign \? 'Phân công giáo viên' : 'Lớp học'\}/);
 // form Tạo lớp: đúng bốn ô, không còn giáo viên, mã lớp, chọn học sinh
 const create=classes.slice(classes.indexOf('<FormSheet title={`Tạo lớp – năm học'),classes.indexOf('onClose={() => setCreating(false)}'));
 assert.deepEqual([...create.matchAll(/name: ?'(\w+)'/g)].map(m=>m[1]),['name','semester','grade','expected_size']);
 assert.match(classes,/name, teacher_ids: \[\], student_ids: \[\]/);
 // tạo lớp từ Excel: mẫu riêng của trường và năm học, xem trước rồi lưu
 assert.match(classes,/api\.classCreateSpec\(token, yearId\)/);
 assert.match(classes,/`\/api\/admin\/classes\/create-template\?year_id=\$\{yearId\}`/);
 assert.match(classes,/api\.importCreateClasses\(token, file, \{ commit, year_id: yearId \}\)/);
 // PDF danh sách lớp dạng bảng ở Lớp học; PDF danh sách học sinh theo lớp ở Phân công
 assert.match(classes,/`\/api\/admin\/classes\/list-pdf\?year_id=\$\{yearId\}/);
 // xếp lớp từ Excel và đề nghị đổi giáo viên chỉ ở Phân công giáo viên
 assert.match(classes,/actions=\{assign \? <>\s*<Btn title=\{`Đề nghị đổi giáo viên/);
 assert.match(classes,/importing && yearId \? \(assign \? <ClassImportSheet/);
 // nhập tay từng lớp ở Phân công (như Tạo lớp): chỉ phân công giáo viên cho lớp đã tạo – lớp, học kỳ, giáo viên (chọn sẵn giáo viên hiện tại); không gồm học sinh (19/11/2026)
 assert.match(classes,/<Btn title="Phân công lớp" icon=\{Plus\} tone="son" size="sm" disabled=\{!yearId \|\| ended\} onPress=\{\(\) => setAssigning\(true\)\} testID="assign-add" \/>/);
 const manual=classes.slice(classes.indexOf('const AssignForm'),classes.indexOf('// ---------------------------------------------------------------------- tạo lớp từ Excel'));
 assert.deepEqual([...manual.matchAll(/\{ name: '(\w+)'/g)].map(m=>m[1]),['class_id','semester','teacher_id']);
 assert.doesNotMatch(manual,/addClassMembers|StudentPicker|student_ids/);
 // mã tham gia chỉ theo quy ước: lớp chưa có giáo viên thì chưa có mã; nút cập nhật mã theo quy ước; cột Trạng thái là nút gạt lưu trữ
 assert.match(classes,/const NO_JOIN_CODE = 'Chưa có – phân công giáo viên';/);
 assert.match(classes,/title="Cập nhật mã theo quy ước"/);
 assert.doesNotMatch(classes,/title="Đổi mã mới"/);
 assert.match(classes,/\{ key: 'status', filter: f_active, label: 'Trạng thái', flex: 1\.2, render: statusSwitch \}/);
 assert.match(classes,/api\.archiveClass\(token, toggling\.id, toggling\.is_active\)/);
 assert.match(manual,/confirm_reassignment: current \? true : undefined/);
 assert.match(classes,/api\.classImportSpec\(token, yearId\)/);
 assert.match(classes,/<ImportSheet title=\{title\} multiple hint=\{`Mỗi lớp một sheet \(chép sheet trong Excel\) hoặc mỗi lớp một file \(chọn nhiều file cùng lúc\)\. Mỗi lớp điền đủ Lớp, Khối, Học kỳ, Giáo viên phụ trách; thiếu một ô là file bị báo lỗi\./);
 // chọn nhiều file: xem trước / lưu lần lượt, gộp kết quả, mỗi dòng ghi file và lớp
 assert.match(kit,/export const pickFiles = async/);
 assert.match(kit,/multiple: true \}\);/);
 assert.match(kit,/sheet: `\$\{f\.name\}\$\{r\.sheet \? ` · \$\{r\.sheet\}` : ''\}`/);
 assert.match(kit,/\{r\.sheet \? `\$\{r\.sheet\} · ` : ''\}Dòng \{r\.row\}/);
 // mã tham gia dài theo quy ước DongA… hiển thị gọn; học sinh gõ được mã dài
 assert.match(classes,/\{k\.join_code \? <Txt f="bold" size=\{20\} selectable/); // 19/11/2026: chỉ mã theo quy ước (dài); chưa có giáo viên thì chưa có mã
 // ô nhập mã tham gia lớp của học sinh (ClassTab) đã xóa cùng giao diện trang học sinh ngày 15/11/2026; máy chủ vẫn nhận mã dài DongA…
 // đề nghị đổi giáo viên phụ trách có lý do (nghỉ sinh con, tai nạn, bệnh dài ngày…)
 const change=read('components/admin/ClassTeacherChange.tsx');
 // 16/11/2026: đơn đề nghị theo bố cục đơn hành chính (Quốc hiệu, Kính gửi Ban Giám hiệu, lý do sinh con / tai nạn / ốm đau…, thời gian, giấy tờ kèm theo, cam kết, chữ ký)
 for(const t of ['CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM','Độc lập – Tự do – Hạnh phúc','ĐƠN ĐỀ NGHỊ THAY ĐỔI GIÁO VIÊN PHỤ TRÁCH LỚP','Kính gửi: ','Nghỉ sinh con (thai sản)','Tai nạn','Ốm đau dài ngày','Giấy tờ kèm theo','Tôi cam kết bàn giao lớp','Người làm đơn','(Ký và ghi rõ họ tên)'])assert.ok(change.includes(t),t);
 assert.match(change,/`Lý do: \$\{reason\}\.`/);
 assert.ok(change.includes("lines.join('\\n').slice(0, 1000)"), 'nội dung đơn gửi kèm, tối đa 1000 ký tự');
 assert.match(classes,/acceptText="Chỉ nhận file Excel\." note=\{`Phải đúng file mẫu xếp lớp năm học \$\{spec\.year_label\} của \$\{spec\.school_name\} \(được thêm tên lớp ở cuối tên file/);
 // mỗi lớp lưu một file nên tên file được thêm tên lớp: máy chủ kiểm tra phần đầu tên file, không so khớp nguyên tên ở trình duyệt
 const importer=classes.slice(classes.indexOf('const ClassImportSheet:'),classes.indexOf('// ---------------------------------------------------------------------- chi tiết một lớp'));
 assert.doesNotMatch(importer,/expectedFilename/);
 assert.match(importer,/template=\{\{ filename: spec\.filename, fetchBlob: \(\) => api\.downloadFile\(token, `\/api\/admin\/classes\/template\?year_id=\$\{yearId\}`\) \}\}/);
 assert.doesNotMatch(classes,/mau-phan-lop\.xlsx/);
 assert.match(kit,/\{acceptText \?\? acceptNote\(types\)\}/);
 assert.match(kit,/testID="import-notes"/); // ghi chú: lớp sẽ được tạo, giáo viên phụ trách học kỳ
 // giáo viên phụ trách chọn trong danh sách kèm mã giáo viên (như ô Giáo viên phụ trách của file Excel)
 assert.match(classes,/label: `\$\{t\.user_code \?\? 'Chưa có mã'\} · \$\{t\.full_name\}`/);
 assert.match(classes,/label="Giáo viên phụ trách lớp \(mã giáo viên · họ tên\)"/);
 assert.match(classes,/testID="class-assign-teacher"/);
 assert.match(classes,/\{ name: 'name', label: 'Lớp', required: true, placeholder: '6A1'/);
 assert.doesNotMatch(classes,/label: 'Mô tả'/); // form tạo lớp và sửa lớp bỏ ô Mô tả (13/11/2026)
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
test('mật khẩu tài khoản: menu ở quản trị trường và quản trị tổng; chỉ hiện mật khẩu ban đầu khi chưa đổi, ẩn mặc định; cấp lại theo quy ước; lớp học có nút xuất danh sách lớp',()=>{
 const school=read('components/admin/SchoolAdmin.tsx'),rootAdmin=read('components/admin/RootAdmin.tsx'),page=read('components/admin/PasswordList.tsx');
 for(const portal of [school,rootAdmin])assert.match(portal,/\{ id: 'passwords' as const, label: 'Mật khẩu tài khoản', icon: KeyRound \}/);
 assert.match(school,/tab === 'passwords' \? <PasswordList session=\{session\} \/>/);
 assert.match(rootAdmin,/tab === 'passwords' \? <PasswordList session=\{session\} schools=\{options\} \/>/);
 assert.match(page,/const \[shown, setShown\] = useState\(false\);/); // mặc định ẩn, bấm Hiện mật khẩu mới thấy
 // 18/11/2026: hiện mọi mật khẩu xem được (ban đầu / cấp lại; mật khẩu tự đổi từ 18/11/2026 với quản trị tổng – migration 074)
 assert.match(page,/\{u\.password\s*\? <Txt f="bold"[^\n]*\{shown \? u\.password : '••••••••••'\}/);
 assert.match(page,/'Không xem được \(đổi trước 18\/11\/2026\)'/); // 18/11/2026: cột Mật khẩu hẹp hơn (thêm cột Vai trò, Trường) nên ghi ngắn; hướng dẫn Cấp lại ở khung trên
 assert.match(page,/'Đã tự đổi, chỉ quản trị tổng xem được'/);
 assert.match(page,/<AccountActiveSwitch session=\{session\} account=\{u\} onRequest=\{lock\.request\} \/>/);
 assert.match(page,/key: 'stt', filter: f_stt/);
 assert.match(page,/api\.reissuePassword\(token, confirm\.id\)/);
 assert.match(read('api/adminApi.ts'),/`\/api\/admin\/users\/\$\{id\}\/reissue-password`/);
 const classes=read('components/admin/SchoolClasses.tsx');
 // 14/11/2026: quản trị trường chỉ xuất PDF danh sách lớp (thể thức văn bản của nhà trường)
 assert.match(classes,/<DownloadButton title="Xuất PDF danh sách học sinh theo lớp" fetchBlob=\{\(\) => api\.downloadFile\(token, `\/api\/admin\/classes\/export\?year_id=\$\{yearId\}&semester=\$\{semester\}&format=pdf`\)\}/);
 assert.match(classes,/<DownloadButton title="Xuất PDF danh sách lớp" fetchBlob=\{\(\) => api\.downloadFile\(token, `\/api\/admin\/classes\/export\?class_id=\$\{id\}&semester=\$\{semester\}&format=pdf`\)\}/);
});
test('13/11/2026: bỏ hẳn Email phụ huynh; email khôi phục cho quản trị viên; thêm học sinh chọn lớp của mọi năm học chưa kết thúc; tạo lớp chọn học sinh theo mã',()=>{
 // Email phụ huynh không còn ở đâu (migration 062 xóa cột): hồ sơ tài khoản, form sửa, kiểu dữ liệu, thư nhận xét của giáo viên
 for(const file of ['components/admin/AccountSheet.tsx','components/admin/SchoolPeople.tsx','types/api.ts','types/analytics.ts','api/analyticsApi.ts'])assert.doesNotMatch(read(file),/parent_email|has_parent_email|Email phụ huynh/,file);
 const teacher=read('components/admin/AnalyticsTeacher.tsx');
 assert.doesNotMatch(teacher,/Gửi cho phụ huynh|toParent|has_parent_email/);
 // email khôi phục: ô riêng trong hồ sơ, gõ như email
 const profile=read('components/profile.tsx');
 assert.match(profile,/recovery_email: \{ label: 'Email khôi phục'/);
 assert.match(profile,/k === 'email' \|\| k === 'recovery_email' \? 'email-address'/);
 assert.match(read('types/api.ts'),/export type EditableField = 'full_name' \| 'email' \| 'recovery_email'/);
 // ô chọn Lớp của Giáo viên / Học sinh (19/11/2026): mọi lớp của năm học đang chọn, kể cả năm đã kết thúc và lớp đã lưu trữ
 const people=read('components/admin/SchoolPeople.tsx');
 assert.match(people,/api\.listClasses\(token, \{ limit: 200 \}\)/);
 assert.doesNotMatch(people,/x\.year_status !== 'ended'/);
 // "Thêm học sinh đã có" (Phân công giáo viên) chọn học sinh theo mã (họ tên, ngày sinh, giới tính tự hiện)
 const classes=read('components/admin/SchoolClasses.tsx');
 assert.match(classes,/const StudentPicker: React\.FC/);
 assert.match(classes,/<StudentPicker session=\{session\} value=\{Array\.isArray\(v\.ids\) \? v\.ids : \[\]\} onChange=\{\(ids\) => set\('ids', ids\)\} exclude=\{memberIds\} \/>/);
 assert.doesNotMatch(classes,/Mã tham gia 6 ký tự được tạo tự động/);
});
