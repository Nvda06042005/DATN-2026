// Xóa trường kèm toàn bộ dữ liệu (quản trị tổng, mục Trường học) và trang Người dùng toàn hệ thống chỉ xem/sửa/khóa, không có mục Xóa.
// Thành phần React Native không nạp được trong Node nên kiểm tra các mắt xích nối nhau trong mã nguồn.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

test('xóa trường: hộp xác nhận nêu rõ sẽ xóa cả tài khoản, lớp, nội dung; không còn câu "chỉ xóa được trường chưa phát sinh dữ liệu"', () => {
  const src = read('components', 'admin', 'RootAdmin.tsx');
  assert.match(src, /Xóa hẳn \$\{removing\.name\} cùng toàn bộ dữ liệu của trường: \$\{removing\.users\} tài khoản \(\$\{removing\.admins\} quản trị viên, \$\{removing\.teachers\} giáo viên, \$\{removing\.students\} học sinh\), \$\{removing\.classes\} lớp/);
  assert.match(src, /Không thể hoàn tác/);
  assert.match(src, /api\.deleteSchool\(token, removing\.id\)[^\n]*'Đã xóa trường và toàn bộ dữ liệu của trường'/);
  assert.doesNotMatch(src, /Chỉ xóa được trường chưa phát sinh dữ liệu/);
  assert.doesNotMatch(src, /Trường đã có dữ liệu chỉ vô hiệu hóa được/);
  assert.doesNotMatch(src, /xóa trường chưa có dữ liệu/);
  assert.match(src, /Xóa trường là xóa luôn toàn bộ tài khoản và dữ liệu của trường/);
  // nút thùng rác nằm ở danh sách trường và mở hộp xác nhận
  assert.match(src, /label=\{`Xóa \$\{s\.name\}`\} tone="giay" size="sm" onPress=\{\(\) => setRemoving\(s\)\}/);
});

test('trang Người dùng toàn hệ thống không có mục Xóa; quản trị trường vẫn xóa được tài khoản chưa phát sinh dữ liệu', () => {
  const root_ = read('components', 'admin', 'RootAdmin.tsx');
  assert.match(root_, /<AccountSheet session=\{session\} id=\{open\} schools=\{schools\} canDelete=\{false\}/);
  assert.doesNotMatch(root_, /hoặc xóa tài khoản chưa phát sinh dữ liệu/);
  assert.match(root_, /Không xóa tài khoản ở đây: muốn xóa, hãy xóa trường ở mục Trường học\./);
  const sheet = read('components', 'admin', 'AccountSheet.tsx');
  assert.match(sheet, /canDelete\?: boolean;/);
  assert.match(sheet, /\}> = \(\{ session, id, schools = \[\], onClose, onChanged, canDelete = true \}\) =>/);
  assert.match(sheet, /\{canDelete \? <Btn title="Xóa" icon=\{Trash2\}[^\n]*testID="acc-delete" \/> : null\}/);
  assert.match(sheet, /\{canAct && canDelete && !u\.deletable \?/);
  assert.match(sheet, /<ConfirmSheet open=\{canDelete && dialog === 'delete'\}/);
  // các thao tác còn lại của quản trị tổng vẫn có
  for (const id of ['acc-edit', 'acc-role', 'acc-lock', 'acc-reset']) assert.ok(sheet.includes(`testID="${id}"`), id);
  // trang giáo viên/học sinh của quản trị trường dùng mặc định canDelete = true
  assert.doesNotMatch(read('components', 'admin', 'SchoolPeople.tsx'), /canDelete/);
});
