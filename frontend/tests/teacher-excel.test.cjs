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
  assert.match(kit, /testID="import-accept-note"[\s\S]*?\{acceptText \?\? acceptNote\(types\)\}/); // hộp xếp lớp thay bằng câu ngắn "Chỉ nhận file Excel."
  // kiểm tra từng file ngay khi chọn (được chọn nhiều file ở hộp xếp lớp)
  assert.match(kit, /const wrong = checkPickedFile\(picked, types\) \?\? checkTemplateFilename\(picked\.name, expectedFilename, legacyFilename\);\s+if \(wrong\) \{ setFile\(null\); setFiles\(\[\]\); setError\(/);
  // câu báo nằm trước nút "Chọn file"
  assert.ok(kit.indexOf('import-accept-note') < kit.indexOf('testID="import-choose"'));
  assert.match(kit, /danh sách trong trang đã tự cập nhật/);
});

test('trang Giáo viên: hai cách thêm, biểu mẫu cùng cột với file mẫu (không có Bộ môn), ngày sinh chọn bằng lịch', () => {
  const people = read('components', 'admin', 'SchoolPeople.tsx');
  assert.match(people, /const periodLabel = year \? `Năm học \$\{year\.label\} · Học kỳ \$\{semester\}` : 'Mọi năm học'/);
  assert.match(people, /Thêm từng giáo viên hoặc nhập từ Excel/);
  assert.match(people, /Thêm từng giáo viên \(muốn thêm nhiều người cùng lúc, hãy dùng Nhập từ Excel\)/);
  // các ô dùng chung của form thêm giáo viên / học sinh (personFields)
  const form = people.slice(people.indexOf('export const personFields'), people.indexOf('export const SchoolPeople'));
  const labels = [...form.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
  assert.match(form, /label: teacher \? 'Mã giáo viên' : 'Mã học sinh'/);
  assert.deepEqual(labels.filter((l) => !['Chưa chọn', 'Nam', 'Nữ', 'Khác'].includes(l)), ['Họ và tên', 'Giới tính', 'SĐT', 'Email', 'Ngày tháng năm sinh']);
  assert.doesNotMatch(form, /Bộ môn/);
  assert.match(form, /name: 'birth_date', label: 'Ngày tháng năm sinh', type: 'date', calendar: true, min: teacher \? '1940-01-01' : '2000-01-01', max: today/);
  assert.doesNotMatch(people, /bộ môn|Bộ môn|subject/);
  assert.match(people, /TeacherImportSheet session=\{session\}/);
  const importer=read('components','admin','TeacherImportSheet.tsx');
  assert.match(importer, /hint="Tải file mẫu, điền danh sách rồi chọn file để nhập\."/);
  const sheet = read('components', 'admin', 'AccountSheet.tsx');
  assert.match(sheet, /u\.role === 'student' \|\| u\.role === 'teacher' \|\| u\.role === 'school_admin' \? \['Ngày sinh', dmy\(u\.birth_date\)\]/);
  assert.match(sheet, /birth_date: v\.birth_date \|\| null, gender: v\.gender \|\| null/);
  // ô ngày bằng lịch chỉ trên web, điện thoại vẫn gõ YYYY-MM-DD
  const kit = read('components', 'admin', 'kit.tsx');
  assert.match(kit, /if \(def\.type === 'date' && def\.calendar && Platform\.OS === 'web'\) return <CalendarInput/);
  assert.match(kit, /type: 'date', id: `field-\$\{def\.name\}`/);
});

test('18/11/2026: bảng giáo viên gọn – STT (lọc), Mã giáo viên, Họ và tên, Giới tính, Khối, Lớp đang dạy, Trạng thái; SĐT, email, ngày sinh xem trong hồ sơ', () => {
  const people = read('components', 'admin', 'SchoolPeople.tsx');
  const tableStart=people.indexOf('columns={teacher ? [');
  const table = people.slice(tableStart, people.indexOf('] : [',tableStart));
  const labels = [...table.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(labels, ['STT', 'Mã giáo viên', 'Họ và tên', 'Giới tính', 'Khối', 'Lớp đang dạy', 'Trạng thái']);
  // số thứ tự nối tiếp qua các trang (lọc STT trả đúng dòng đó: offset từ máy chủ); ngày sinh của học sinh hiện dd/mm/yyyy như trong Excel; lọc được theo các cột
  assert.match(people, /const rowNo = \(u: Account\) => String\(\(data\?\.offset \?\? \(page - 1\) \* size\) \+ \(data\?\.items\.indexOf\(u\) \?\? 0\) \+ 1\)/);
  assert.match(people, /`\$\{iso\.slice\(8, 10\)\}\/\$\{iso\.slice\(5, 7\)\}\/\$\{iso\.slice\(0, 4\)\}`/);
  assert.match(people, /filters=\{teacher \? \[f_stt, f_code, f_name, f_gender, f_grade, f_class, f_active\] : \[f_stt, f_code, f_name, f_gender, f_phone, f_email, f_birth, f_grade, f_class, f_active\]\}/);
  // ô chọn Khối, Lớp cạnh Năm học, Học kỳ; lớp đang dạy theo khối / lớp đang chọn, nhiều lớp thì "+N lớp"
  for (const id of ['member-year', 'member-semester', 'member-grade', 'member-class-filter']) assert.ok(people.includes(`testID="${id}"`), id);
  assert.match(people, /list\.length > 3 \? ` \+\$\{list\.length - 3\} lớp` : ''/);
  // không còn Bộ môn ở chi tiết, biểu mẫu sửa, nhãn chọn giáo viên của lớp và hồ sơ cá nhân
  assert.doesNotMatch(read('components', 'admin', 'AccountSheet.tsx'), /Bộ môn|subject/);
  assert.doesNotMatch(read('components', 'admin', 'SchoolClasses.tsx'), /\.subject/);
  assert.doesNotMatch(read('components', 'profile.tsx'), /user\.subject/);
  assert.doesNotMatch(read('types', 'api.ts'), /\bsubject\b/);
  assert.doesNotMatch(read('api', 'adminApi.ts'), /\bsubject\b/);
});
