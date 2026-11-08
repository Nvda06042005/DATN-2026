// Nhập giáo viên từ Excel: báo trước chỉ nhận file Excel (.xlsx), chặn file sai loại ngay; hai cách thêm giáo viên (từng người bằng biểu mẫu, hàng loạt bằng file);
// biểu mẫu cùng cột với file mẫu (mã, họ tên, giới tính, SĐT, email, ngày sinh bằng lịch), không còn Bộ môn. Phần quy tắc chạy thật bằng cách biên dịch TypeScript.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const compiled = ts.transpileModule(read('lib', 'upload-rules.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new vm.Script(`(function(module,exports){${compiled}\n})`).runInThisContext()(mod, mod.exports);
const { acceptNote, checkPickedFile, acceptedExtensions, MAX_XLSX_BYTES, XLSX_MIME, JSON_MIME } = mod.exports;

test('thông báo loại file được nhận: chỉ Excel (.xlsx) và 2 MB; kho lịch sử nhận thêm .json', () => {
  assert.deepEqual(acceptedExtensions([XLSX_MIME]), ['.xlsx']);
  assert.deepEqual(acceptedExtensions([XLSX_MIME, JSON_MIME]), ['.xlsx', '.json']);
  assert.equal(acceptNote([XLSX_MIME]), 'Chỉ nhận file Excel (.xlsx), tối đa 2 MB. Các loại file khác (PDF, Word, ảnh, .xls, .csv…) sẽ bị từ chối.');
  assert.equal(acceptNote([XLSX_MIME, JSON_MIME]), 'Chỉ nhận file Excel (.xlsx) hoặc JSON (.json). Các loại file khác sẽ bị từ chối.');
  assert.equal(MAX_XLSX_BYTES, 2 * 1024 * 1024);
});

test('chặn ngay file sai loại hoặc quá lớn, không phân biệt hoa thường; file đúng thì cho qua', () => {
  const only = [XLSX_MIME];
  assert.equal(checkPickedFile({ name: 'giao-vien.xlsx', size: 5000 }, only), null);
  assert.equal(checkPickedFile({ name: 'GIAO VIEN.XLSX', size: 5000 }, only), null);
  assert.equal(checkPickedFile({ name: 'giao-vien.xlsx' }, only), null);
  for (const bad of ['giao-vien.xls', 'giao-vien.csv', 'ghi-chu.pdf', 'anh.png', 'bao-cao.docx', 'giao-vien.xlsx.exe', 'xlsx', 'giao-vien']) {
    assert.match(checkPickedFile({ name: bad, size: 100 }, only), /^Chỉ nhận file Excel \(\.xlsx\)\. File ".+" không đúng loại/, bad);
  }
  assert.match(checkPickedFile({ name: 'to.xlsx', size: MAX_XLSX_BYTES + 1 }, only), /quá lớn \(tối đa 2 MB\)/);
  assert.equal(checkPickedFile({ name: 'vua.xlsx', size: MAX_XLSX_BYTES }, only), null);
  // kho lịch sử: nhận .xlsx và .json, không giới hạn 2 MB ở giao diện
  assert.equal(checkPickedFile({ name: 'kho.json', size: 9 * 1024 * 1024 }, [XLSX_MIME, JSON_MIME]), null);
  assert.match(checkPickedFile({ name: 'kho.csv', size: 10 }, [XLSX_MIME, JSON_MIME]), /Chỉ nhận file \.xlsx hoặc \.json/);
});

test('hộp nhập Excel: câu báo trước ở chỗ nút Chọn file, kiểm tra file ngay sau khi chọn, báo danh sách đã tự cập nhật', () => {
  const kit = read('components', 'admin', 'kit.tsx');
  assert.match(kit, /import \{ acceptNote, checkPickedFile, checkTemplateFilename \} from '@\/lib\/upload-rules';/);
  assert.match(kit, /testID="import-accept-note"[\s\S]*?\{acceptNote\(types\)\}/);
  assert.match(kit, /const wrong = checkPickedFile\(picked, types\);\s+if \(wrong\) \{ setFile\(null\); setError\(wrong\); return; \}/);
  // câu báo nằm trước nút "Chọn file"
  assert.ok(kit.indexOf('import-accept-note') < kit.indexOf('testID="import-choose"'));
  assert.match(kit, /danh sách trong trang đã tự cập nhật/);
});

test('trang Giáo viên: hai cách thêm, biểu mẫu cùng cột với file mẫu (không có Bộ môn), ngày sinh chọn bằng lịch', () => {
  const people = read('components', 'admin', 'SchoolPeople.tsx');
  assert.match(people, /Có hai cách thêm giáo viên: nút Thêm giáo viên để thêm từng người, hoặc Nhập từ Excel để thêm hàng loạt/);
  assert.match(people, /Thêm từng giáo viên \(muốn thêm nhiều người cùng lúc, hãy dùng Nhập từ Excel\)/);
  const form = people.slice(people.indexOf('const fields: FieldDef[] = teacher'), people.indexOf(": [{ name: 'user_code', label: 'Mã học sinh'"));
  // thứ tự giống các cột của file Excel: (Số thứ tự và Mã giáo viên), Họ và tên, Giới tính, SĐT, Email, Ngày tháng năm sinh
  const order = ['kind="teacher" showSerial', "name: 'full_name'", "name: 'gender'", "name: 'phone'", "name: 'email'", "name: 'birth_date'"].map((part) => form.indexOf(part));
  assert.ok(order.every((n, i) => n >= 0 && (i === 0 || n > order[i - 1])), `thứ tự các ô: ${order}`);
  assert.deepEqual([...form.matchAll(/name: '(\w+)', label: '([^']+)'/g)].map((m) => m[2]), ['Mã giáo viên', 'Họ và tên', 'Giới tính', 'SĐT', 'Email', 'Ngày tháng năm sinh']);
  assert.match(form, /name: 'gender', label: 'Giới tính', type: 'select'/);
  assert.doesNotMatch(form, /Bộ môn/);
  assert.match(form, /name: 'birth_date', label: 'Ngày tháng năm sinh', type: 'date', calendar: true, min: '1940-01-01', max: today/);
  assert.doesNotMatch(people, /bộ môn|Bộ môn|subject/);
  assert.match(people, /TeacherImportSheet session=\{session\}/);
  const importer=read('components','admin','TeacherImportSheet.tsx');
  assert.match(importer, /Chỉ nhận đúng file mẫu của trường\. Nhập trên bảng để chọn ngày sinh và tự sinh mã\./);
  const sheet = read('components', 'admin', 'AccountSheet.tsx');
  assert.match(sheet, /u\.role === 'student' \|\| u\.role === 'teacher' \? \['Ngày sinh', u\.birth_date\]/);
  assert.match(sheet, /birth_date: v\.birth_date \|\| null, gender: v\.gender \|\| null/);
  // ô ngày bằng lịch chỉ trên web, điện thoại vẫn gõ YYYY-MM-DD
  const kit = read('components', 'admin', 'kit.tsx');
  assert.match(kit, /if \(def\.type === 'date' && def\.calendar && Platform\.OS === 'web'\) return <CalendarInput/);
  assert.match(kit, /type: 'date', id: `field-\$\{def\.name\}`/);
});

test('bảng danh sách giáo viên cùng cột với file Excel: Số thứ tự, Mã giáo viên, Họ và tên, Giới tính, SĐT, Email, Ngày tháng năm sinh, rồi Lớp phụ trách và Trạng thái', () => {
  const people = read('components', 'admin', 'SchoolPeople.tsx');
  const table = people.slice(people.indexOf('columns={teacher ? ['), people.search(/\] : \[\s*\/\/ cùng các cột với file Excel: Số thứ tự, Mã học sinh/));
  const labels = [...table.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(labels, ['Số thứ tự', 'Mã giáo viên', 'Họ và tên', 'Giới tính', 'SĐT', 'Email', 'Ngày tháng năm sinh', 'Lớp phụ trách', 'Trạng thái']);
  // số thứ tự nối tiếp qua các trang; ngày sinh hiện dd/mm/yyyy như trong Excel; chỉ còn bộ lọc Trạng thái
  assert.match(table, /\(page - 1\) \* size \+ data\.items\.indexOf\(u\) \+ 1/);
  assert.match(people, /`\$\{iso\.slice\(8, 10\)\}\/\$\{iso\.slice\(5, 7\)\}\/\$\{iso\.slice\(0, 4\)\}`/);
  assert.match(people, /filters=\{teacher \? \[f_active\] : \[f_grade, f_class, f_active\]\}/);
  // không còn Bộ môn ở chi tiết, biểu mẫu sửa, nhãn chọn giáo viên của lớp và hồ sơ cá nhân
  assert.doesNotMatch(read('components', 'admin', 'AccountSheet.tsx'), /Bộ môn|subject/);
  assert.doesNotMatch(read('components', 'admin', 'SchoolClasses.tsx'), /\.subject/);
  assert.doesNotMatch(read('components', 'profile.tsx'), /user\.subject/);
  assert.doesNotMatch(read('types', 'api.ts'), /\bsubject\b/);
  assert.doesNotMatch(read('api', 'adminApi.ts'), /\bsubject\b/);
});

test('trang Học sinh làm như Giáo viên: bỏ ô chọn năm học, bảng cùng cột với file Excel, biểu mẫu cùng thứ tự cột, mẫu Excel không còn tham số năm học', () => {
  const people = read('components', 'admin', 'SchoolPeople.tsx');
  // ô chọn năm học bị bỏ: lớp luôn theo năm học đang hoạt động
  assert.doesNotMatch(people, /yearSel|setYearSel|member-year|AdminSelect|yearOptions/);
  assert.match(people, /const yearId = years\.find\(\(y\) => y\.status === 'active'\)\?\.id \?\? years\[0\]\?\.id \?\? 0;/);
  // bảng: cùng cột với file Excel (Số thứ tự, Mã, Họ và tên, Giới tính, SĐT, Email, Ngày sinh) rồi Lớp, Khối, Trạng thái
  const start = people.search(/\] : \[\s*\/\/ cùng các cột với file Excel: Số thứ tự, Mã học sinh/);
  const table = people.slice(start, people.indexOf('<Pager page={page}'));
  assert.deepEqual([...table.matchAll(/label: '([^']+)'/g)].map((m) => m[1]), ['Số thứ tự', 'Mã học sinh', 'Họ và tên', 'Giới tính', 'SĐT', 'Email', 'Ngày tháng năm sinh', 'Lớp', 'Khối', 'Trạng thái']);
  assert.match(table, /\(page - 1\) \* size \+ data\.items\.indexOf\(u\) \+ 1/);
  assert.match(table, /key: 'classes', filter: f_class, label: 'Lớp'/);
  assert.match(table, /key: 'grade', filter: f_grade, label: 'Khối'/);
  assert.doesNotMatch(table, /parent_email|Email phụ huynh'/);
  // biểu mẫu thêm học sinh: đúng các ô của file Excel (Số thứ tự và Mã, Họ và tên, Giới tính, SĐT, Email, Ngày sinh), không còn Lớp và Email phụ huynh
  const form = people.slice(people.indexOf(": [{ name: 'user_code', label: 'Mã học sinh'"), people.search(/return \(\s*<Page>/));
  const order = ['kind="student" showSerial', "name: 'full_name'", "name: 'gender'", "name: 'phone'", "name: 'email'", "name: 'birth_date'"].map((part) => form.indexOf(part));
  assert.ok(order.every((n, i) => n >= 0 && (i === 0 || n > order[i - 1])), `thứ tự các ô: ${order}`);
  assert.deepEqual([...form.matchAll(/name: '(\w+)', label: '([^']+)'/g)].map((m) => m[2]), ['Mã học sinh', 'Họ và tên', 'Giới tính', 'SĐT', 'Email', 'Ngày tháng năm sinh']);
  assert.match(form, /name: 'email', label: 'Email', type: 'email', required: true/); // Email * bắt buộc như giáo viên
  assert.doesNotMatch(form, /class_id|parent_email/);
  assert.match(form, /name: 'birth_date', label: 'Ngày tháng năm sinh', type: 'date', calendar: true, min: '2000-01-01', max: today, required: true/);
  assert.match(people, /Có hai cách thêm học sinh: nút Thêm học sinh để thêm từng em, hoặc Nhập từ Excel để thêm hàng loạt/);
  // nhập Excel: mẫu tải không kèm năm học, lời nhắc nêu đúng năm cột người dùng nhập và việc mã/STT tự hiện
  assert.match(people, /api\.downloadFile\(token, '\/api\/admin\/students\/template'\)/);
  assert.doesNotMatch(people, /template\?year_id/);
  assert.match(people, /Bạn chỉ nhập Họ và tên, Giới tính, SĐT, Email, Ngày tháng năm sinh \(họ tên, email và ngày sinh bắt buộc\): mã học sinh tự sinh, số thứ tự tự hiện khi nhấn Enter/);
});

test('biểu mẫu thêm giáo viên và học sinh giống file Excel: Số thứ tự và Mã hiện khi chọn ngày sinh (ô chỉ đọc), máy chủ cấp mã lúc tạo', () => {
  const people = read('components', 'admin', 'SchoolPeople.tsx');
  const code = read('components', 'admin', 'RegistrationCode.tsx');
  // hai ô đầu của file Excel: Số thứ tự rồi Mã; chỉ đọc, trống cho đến khi chọn ngày sinh
  assert.match(code, /showSerial\?:boolean/);
  assert.match(code, /<Field label="Số thứ tự" value=\{serial\} editable=\{false\} testID=\{`registration-serial-\$\{kind\}`\} \/>/);
  assert.match(code, /placeholder=\{loading\?'…':kind==='class'\?'':'Chọn ngày sinh để hiện mã'\}/);
  assert.match(people, /<RegistrationCode token=\{token\} kind="teacher" showSerial birthDate=\{String\(v\.birth_date\|\|''\)\}\/>/);
  assert.match(people, /<RegistrationCode token=\{token\} kind="student" showSerial birthDate=\{String\(v\.birth_date\|\|''\)\}\/>/);
  // ô render (mã) không gửi lên: máy chủ cấp mã chính thức trong cùng giao dịch tạo tài khoản
  assert.match(people, /if\(f\.render\)continue;/);
  // học sinh dùng chung điểm xem trước registration-code với giáo viên, không còn điểm vào riêng
  assert.doesNotMatch(read('api', 'adminApi.ts'), /previewMemberCode|member-code/);
  assert.match(read('api', 'adminApi.ts'), /previewRegistrationCode = \(token:string,kind:'teacher'\|'student'\|'class',query:Query=\{\}\)/);
});
