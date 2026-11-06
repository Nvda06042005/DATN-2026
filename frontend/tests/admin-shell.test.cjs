// Khung chung của cổng quản trị tổng, quản trị trường và giáo viên (AdminWorkspace): cùng ngôn ngữ thiết kế với trang chủ, có dòng bản quyền như trang đăng nhập,
// không còn thanh "Quản trị tổng · Toàn hệ thống". Thành phần React Native không nạp được trong Node nên kiểm tra mã nguồn.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const shell = read('components', 'admin', 'AdminWorkspace.tsx');
const kit = read('components', 'admin', 'kit.tsx');

test('đã xóa thanh vai trò và phạm vi ("Quản trị tổng · Toàn hệ thống", "Bạn quản lý mọi trường")', () => {
  for (const gone of ['admin-scope', 'Toàn hệ thống', 'Bạn quản lý mọi trường', 'Bạn chỉ truy cập dữ liệu của trường này', 'ShieldCheck', 'schoolCount']) {
    assert.ok(!shell.includes(gone), `AdminWorkspace còn ${gone}`);
  }
  assert.ok(!read('components', 'admin', 'RootAdmin.tsx').includes('schoolCount'));
});

test('tên trường (quản trị trường, giáo viên) chuyển lên đường dẫn trang ở thanh đầu để không mất thông tin', () => {
  assert.match(shell, /const trail = \[schoolName, `\$\{session\.user\.role === 'teacher' \? 'Giáo viên' : 'Quản trị'\} \/ \$\{label\}`\]\.filter\(Boolean\)\.join\(' · '\);/);
  assert.match(shell, /numberOfLines=\{1\} style=\{\{ flex: 1 \}\}>\{trail\}<\/Txt>/);
});

test('cùng ngôn ngữ thiết kế với trang chủ: nền giấy dó có hoa văn, thanh đầu viên thuốc nổi, nút Đăng xuất tối bo tròn', () => {
  assert.match(shell, /backgroundColor: c\.logoPaper \}\}>\s*<PatternOverlay opacity=\{0\.075\} \/>/);
  assert.match(shell, /testID="admin-topbar" style=\{\[\{[^\]]*borderRadius: 999, borderWidth: 1, borderColor: c\.bienXanh, backgroundColor: c\.kinhDac/);
  assert.match(shell, /backdropFilter: 'blur\(10px\)'/);
  assert.match(shell, /testID="admin-logout"[^\n]*backgroundColor: pressed \? c\.logoInk : c\.den[^\n]*borderRadius: 999|borderRadius: 999, backgroundColor: pressed \? c\.logoInk : c\.den/);
  // thanh bên bo góc nổi trên máy tính, ngăn kéo toàn chiều cao trên điện thoại; không lộ thanh cuộn ở mép bo
  assert.match(shell, /wide \? \{ width: 232, marginLeft: 16, marginBottom: 12, borderRadius: 20, overflow: 'hidden' \} : \{ width: 260, height: '100%' \}/);
  assert.match(shell, /<ScrollView showsVerticalScrollIndicator=\{false\}/);
});

test('dòng bản quyền giống trang đăng nhập nằm ở chân khung, ngoài vùng cuộn', () => {
  assert.match(shell, /<Txt testID="admin-copyright" f="body" size=\{11\} color=\{c\.muc3\} center[^>]*>© 2026 · Bản quyền thuộc quản lý Đông A<\/Txt>/);
  assert.ok(read('components', 'login-layout.tsx').includes('© 2026 · Bản quyền thuộc quản lý Đông A'), 'chữ ở trang đăng nhập đã đổi: cập nhật lại cho khớp');
  assert.ok(shell.indexOf('{children}') < shell.indexOf('admin-copyright'));
});

test('tiêu đề trang: chữ cuối nghiêng đỏ như tiêu đề ở trang chủ và trang đăng nhập; mọi trang quản trị dùng chung PageHeader', () => {
  assert.match(kit, /<Txt f="serifItalic" size=\{26\} color=\{c\.logoRed\}[^>]*>\{accent\}<\/Txt>/);
  assert.match(kit, /const accent = words\.length > 1 \? words\[words\.length - 1\] : null;/);
  assert.match(kit, /f="displayHeavy" size=\{26\} color=\{c\.logoInk\} accessibilityRole="header"/);
});
