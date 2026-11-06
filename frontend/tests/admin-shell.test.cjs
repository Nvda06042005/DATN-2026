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

test('thu nhỏ vừa đủ: trang hẹp lại, thanh tìm kiếm và khung lọc có giới hạn rộng, hộp nhập liệu hai cột, nút chuyển trang gọn, hộp hồ sơ chia tab', () => {
  // nội dung trang không trải hết màn hình lớn
  assert.match(kit, /gap: 16, maxWidth: 1120, width: '100%', alignSelf: 'center'/);
  // thanh tìm kiếm + Bộ lọc và khung lọc
  assert.match(kit, /accessibilityRole="search" style=\{\{ flex: 1, minWidth: 260, maxWidth: 520, minHeight: 44,/);
  assert.match(kit, /testID="filter-panel" style=\{\{ alignSelf: 'flex-start', width: '100%', maxWidth: 680,/);
  assert.match(kit, /maxWidth: flex > 1 \? 360 : 280/);
  // hộp nhập liệu: ô ngắn xếp hai cột, ô dài/tùy biến/chọn nhiều chiếm cả hàng; hộp rộng giới hạn 720 px
  assert.match(kit, /const full = Boolean\(f\.render\) \|\| f\.type === 'textarea' \|\| f\.type === 'multi';/);
  assert.match(kit, /flexBasis: full \? '100%' : 240/);
  assert.match(kit, /panelStyle=\{wide \? \{ maxWidth: 720 \} : undefined\}/);
  // nút chuyển trang gọn, nằm giữa
  assert.match(kit, /minWidth: 34, height: 34, paddingHorizontal: 10, borderRadius: 999/);
  assert.match(kit, /testID="pager"[^\n]*justifyContent: 'center'/);
  // hộp Hồ sơ cá nhân: hẹp 520 px, tab Thông tin / Đăng nhập và bảo mật khi có phần bảo mật, giữ cả hai tab trong bộ nhớ
  const profile = read('components', 'profile.tsx');
  assert.match(profile, /panelStyle=\{\{ maxWidth: 520 \}\}/);
  assert.match(profile, /label: 'Thông tin' \}, \{ value: 'security', label: 'Đăng nhập và bảo mật' \}/);
  assert.match(profile, /display: tab === 'info' \? 'flex' : 'none'/);
  assert.match(profile, /display: tab === 'security' \? 'flex' : 'none'/);
  assert.match(profile, /<Avatar name=\{user\.full_name\} uri=\{user\.avatar_url\} size=\{56\} \/>/);
});
