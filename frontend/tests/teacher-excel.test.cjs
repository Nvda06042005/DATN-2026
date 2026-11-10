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
  assert.match(kit, /import \{ acceptNote, checkPickedFile, checkTemplateFilename, XLSM_MIME \} from '@\/lib\/upload-rules';/);
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
  const form = people.slice(people.indexOf('const fields: FieldDef[] = teacher'), people.indexOf(': [{ name: \'user_code\', label: \'Mã học sinh\''));
  const labels = [...form.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(labels.filter((l) => !['Chưa chọn', 'Nam', 'Nữ'].includes(l)), ['Mã giáo viên', 'Họ và tên', 'Giới tính', 'SĐT', 'Email', 'Ngày tháng năm sinh']);
  assert.doesNotMatch(form, /Bộ môn/);
  assert.match(form, /name: 'birth_date', label: 'Ngày tháng năm sinh', type: 'date', calendar: true, min: '1940-01-01', max: today/);
  assert.doesNotMatch(people, /bộ môn|Bộ môn|subject/);
  assert.match(people, /TeacherImportSheet session=\{session\}/);
  const importer=read('components','admin','TeacherImportSheet.tsx');
  assert.match(importer, /Mẫu \.xlsx không macro\. Mở bằng Excel trên web/);
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
  const tableStart=people.indexOf('columns={teacher ? [');
  const table = people.slice(tableStart, people.indexOf('] : [',tableStart));
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
