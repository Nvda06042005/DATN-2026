// (1) Ảnh đại diện: tải ảnh lên thay cho ô dán liên kết https, chỉ nhận ảnh; bấm ảnh/tên ở thanh đầu mở hồ sơ.
// (2) Một thanh tìm kiếm kèm nút "Bộ lọc" ở trường, người dùng, nhật ký, yêu cầu hỗ trợ.
// Phần logic chạy thật; giao diện React Native kiểm tra mã nguồn (không nạp được trong Node).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const compiled = ts.transpileModule(read('lib', 'avatar.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new vm.Script(`(function(module,exports){${compiled}\n})`).runInThisContext()(mod, mod.exports);
const { isAvatarImage, AVATAR_TYPES, AVATAR_MAX } = mod.exports;

test('chỉ nhận ảnh làm ảnh đại diện: PNG, JPG, WEBP, GIF; Word, Excel, PowerPoint, PDF, văn bản, video bị từ chối', () => {
  assert.deepEqual(AVATAR_TYPES, ['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
  assert.equal(AVATAR_MAX, 1572864);
  for (const [type, name] of [['image/png', 'a.png'], ['image/jpeg', 'a.jpg'], ['IMAGE/JPEG', 'x'], ['image/webp', 'a.webp'], ['image/gif', 'a.gif'], ['', 'anh.JPEG'], ['application/octet-stream', 'a.png']]) assert.equal(isAvatarImage(type, name), true, `${type} ${name}`);
  const office = [
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'bao-cao.docx'],
    ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'so-lieu.xlsx'],
    ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'bai-giang.pptx'],
    ['application/msword', 'a.doc'], ['application/vnd.ms-excel', 'a.xls'], ['application/vnd.ms-powerpoint', 'a.ppt'],
    ['application/pdf', 'a.pdf'], ['text/plain', 'a.txt'], ['video/mp4', 'a.mp4'], ['image/svg+xml', 'a.svg'], ['image/bmp', 'a.bmp'],
    // khai là tệp Office nhưng đặt đuôi .png vẫn bị chặn ở máy khách (và máy chủ kiểm tra thêm nội dung)
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'doi-duoi.png'],
    ['', 'a.docx'], ['application/octet-stream', 'a.xlsx'], ['', ''], [undefined, undefined],
  ];
  for (const [type, name] of office) assert.equal(isAvatarImage(type, name), false, `${type} ${name}`);
});

test('hồ sơ cá nhân: ô dán liên kết https được thay bằng nút tải ảnh; có Đổi ảnh, Xóa ảnh và lời nhắc chỉ nhận ảnh', () => {
  const profile = read('components', 'profile.tsx');
  assert.ok(!profile.includes('liên kết https'), 'vẫn còn chữ "liên kết https"');
  assert.ok(!profile.includes('Dán địa chỉ ảnh'));
  assert.match(profile, /testID="avatar-pick"/);
  assert.match(profile, /testID="avatar-remove"/);
  assert.match(profile, /Chỉ nhận ảnh PNG, JPG, WEBP hoặc GIF, tối đa 1,5 MB\. Không nhận tệp Word, Excel, PowerPoint, PDF hay tệp khác\./);
  // chọn tệp chỉ gợi ý ảnh, rồi kiểm tra lại loại tệp và dung lượng trước khi gửi
  assert.match(profile, /pickFile\(AVATAR_TYPES\)/);
  assert.match(profile, /if \(!isAvatarImage\(picked\.mimeType, picked\.name\)\) throw new Error\(AVATAR_ONLY_IMAGES\);/);
  assert.match(profile, /blob\.size > AVATAR_MAX/);
  // xóa ảnh gửi avatar_url: null; đổi ảnh có hiệu lực ngay và không làm mất chữ đang gõ dở trong form
  assert.match(profile, /save\(\{ avatar_url: null \}\)/);
  assert.match(profile, /const textFields = editable\.filter\(\(k\) => k !== 'avatar_url'\);/);
  assert.match(profile, /setData\(next\);\s*onSaved\?\.\(next\.user\);/);
  assert.match(read('api', 'authApi.ts'), /uploadAvatar = \(token: string, body: \{ data: string \}\) => apiRequest<ProfileData>\('\/api\/auth\/avatar', \{ token, body \}\)/);
});

test('ảnh đại diện hiện ở thanh đầu; bấm ảnh/tên mở hồ sơ cá nhân (cổng quản trị và cổng học tập)', () => {
  const ui = read('components', 'ui.tsx');
  assert.match(ui, /export const Avatar: React\.FC<\{ name: string; size\?: number; uri\?: string \| null \}>/);
  assert.match(ui, /uri\.startsWith\('\/'\) \? `\$\{API_BASE_URL\}\$\{uri\}` : uri/);
  assert.match(ui, /onError=\{\(\) => setFailed\(src\)\}/);
  const shell = read('components', 'admin', 'AdminWorkspace.tsx');
  assert.match(shell, /testID="admin-profile-open"[^\n]*onPress=\{\(\) => setProfile\(true\)\}/);
  assert.match(shell, /<Avatar name=\{session\.user\.full_name\} uri=\{session\.user\.avatar_url\} size=\{34\} \/>/);
  assert.match(shell, /upload=\{uploadAvatar\}/);
  const auth = read('components', 'auth.tsx');
  assert.match(auth, /testID="topbar-profile-open"[^\n]*onPress=\{\(\) => setProfile\(true\)\}/);
  assert.match(auth, /<Avatar name=\{user\.full_name\} uri=\{user\.avatar_url\} size=\{34\} \/>/);
  assert.match(auth, /upload=\{uploadAvatar\}/);
});

test('thanh tìm kiếm kèm nút Bộ lọc: ô tìm kiếm, nút lọc có số bộ lọc đang bật, khung chọn lọc, nhãn bỏ từng bộ lọc', () => {
  const kit = read('components', 'admin', 'kit.tsx');
  assert.match(kit, /export const SearchFilterBar: React\.FC/);
  for (const id of ['filter-toggle', 'filter-panel', 'filter-clear', 'search-clear', 'filter-chip-${f.key}', 'filter-clear-all']) assert.ok(kit.includes(id), id);
  assert.match(kit, /const active = filters\.filter\(\(f\) => f\.value !== ''\);/);
  assert.match(kit, /accessibilityRole="search"/);
  assert.match(kit, /accessibilityState=\{\{ expanded: open \}\}/);
  // khi đóng khung lọc, bộ lọc đang bật hiện thành nhãn; bấm nhãn bỏ bộ lọc đó
  assert.match(kit, /!open && active\.length \?/);
  assert.match(kit, /onPress=\{\(\) => f\.onChange\(''\)\}/);
});

test('trường, người dùng và ba mục nhật ký, yêu cầu hỗ trợ dùng thanh tìm kiếm kèm Bộ lọc, đổi lọc về trang 1', () => {
  const admin = read('components', 'admin', 'RootAdmin.tsx');
  assert.equal((admin.match(/<SearchFilterBar/g) ?? []).length, 2);
  assert.match(admin, /searchId="school-search"[\s\S]*?key: 'city'[\s\S]*?key: 'active'/);
  assert.match(admin, /searchId="user-search"[\s\S]*?key: 'role'[\s\S]*?key: 'school'[\s\S]*?key: 'active'/);
  assert.ok(!admin.includes('<FilterBar>'), 'RootAdmin còn FilterBar cũ');
  const ops = read('components', 'admin', 'PlatformOps.tsx');
  assert.equal((ops.match(/<SearchFilterBar/g) ?? []).length, 4);
  for (const id of ['support-search', 'audit-search', 'login-search', 'error-search']) assert.match(ops, new RegExp(`searchId="${id}"`));
  assert.match(ops, /key: 'status'[\s\S]*?key: 'role'/); // yêu cầu hỗ trợ
  assert.match(ops, /key: 'students'/);                  // nhật ký thao tác
  assert.match(ops, /key: 'source'[\s\S]*?extra=\{session\.user\.admin_level === 1/); // lỗi hệ thống giữ nút xóa lỗi cũ
  // mọi thay đổi tìm kiếm hoặc bộ lọc đều quay về trang đầu
  for (const src of [admin, ops]) {
    const bars = src.match(/<SearchFilterBar[\s\S]*?\/>/g) ?? [];
    for (const bar of bars) assert.ok((bar.match(/setPage\(1\)/g) ?? []).length >= 2, bar.slice(0, 80));
  }
});
