// Thêm trường từ danh mục (mã, khu vực, logo tự điền) và đường dẫn riêng donga_<mã>_<tên>_<khu vực> làm cổng đăng nhập của trường.
// Logic thuần (nhận dạng đường dẫn, chữ và màu huy hiệu) chạy thật bằng cách biên dịch TypeScript; thành phần React Native không nạp được trong Node
// nên phần giao diện kiểm tra các mắt xích nối nhau (ô chọn → hàm gọi API → đường dẫn máy chủ).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

function loadLib() {
  const compiled = ts.transpileModule(read('lib', 'school-link.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new vm.Script(`(function(module,exports){${compiled}\n})`).runInThisContext()(module, module.exports);
  return module.exports;
}
const lib = loadLib();

test('nhận dạng đường dẫn của trường: chỉ dạng donga_<4–8 chữ số>[_tên_khu vực] không dấu; các địa chỉ khác vẫn là trang 404', () => {
  for (const ok of ['donga_79765507_phumy_binhthanh', 'DONGA_79765507_PhuMy', 'donga_0017', 'donga_0017_phumy']) assert.equal(lib.isSchoolSlug(ok), true, ok);
  for (const bad of ['donga_12', 'donga_123456789_x', 'donga_abc_x', 'hoc-sinh', 'admin', 'portal', 'donga_79765507_phú_mỹ', 'donga_79765507_../x', '', undefined, 5]) assert.equal(lib.isSchoolSlug(bad), false, String(bad));
  assert.equal(lib.schoolCodeOfSlug('donga_79765507_phumy_binhthanh'), '79765507');
  assert.equal(lib.schoolCodeOfSlug('DONGA_0017'), '0017');
  assert.equal(lib.schoolCodeOfSlug('hoc-sinh'), null);
});

test('huy hiệu tự tạo: chữ viết tắt lấy từ tên riêng, không lấy từ "THCS"/"Trường", và không làm mất tên như "Trung Sơn"', () => {
  assert.equal(lib.schoolInitials('THCS Phú Mỹ'), 'PM');
  assert.equal(lib.schoolInitials('Trường THCS Trương Công Định'), 'TĐ');
  assert.equal(lib.schoolInitials('Tiểu học và THCS Trần Danh Ninh'), 'TN');
  assert.equal(lib.schoolInitials('THCS Trung Sơn'), 'TS');
  assert.equal(lib.schoolInitials('TH&THCS Tân Hợp'), 'TH');
  assert.equal(lib.schoolInitials('THCS Colette'), 'CO');
  assert.equal(lib.schoolInitials('THCS Đoàn Thị Điểm'), 'ĐĐ');
  assert.equal(lib.schoolInitials('  '), '?');
  assert.deepEqual(Array.from(lib.ownNameWords('Trường THCS Lý Tự Trọng')), ['Lý', 'Tự', 'Trọng']);
});

test('màu huy hiệu cố định theo mã trường, đủ tám bộ màu và luôn có màu chữ đọc được trên nền', () => {
  assert.deepEqual(lib.emblemColors('79765507'), lib.emblemColors('79765507'));
  const used = new Set(Array.from({ length: 80 }, (_, i) => JSON.stringify(lib.emblemColors(String(79760000 + i)))));
  assert.equal(used.size, lib.EMBLEM_COLORS.length);
  assert.equal(lib.EMBLEM_COLORS.length, 8);
  const luminance = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  for (const { bg } of lib.EMBLEM_COLORS) assert.ok((1.05) / (luminance(bg) + 0.05) >= 7, `chữ trắng trên ${bg} cần tương phản từ 7:1`);
  assert.deepEqual(lib.emblemColors(''), lib.EMBLEM_COLORS[0]);
});

test('thêm trường: ô tên trường gợi ý từ danh mục và chọn xong tự điền tên, mã, khu vực, tỉnh/thành', () => {
  const admin = read('components', 'admin', 'RootAdmin.tsx');
  const api = read('api', 'adminApi.ts');
  assert.match(api, /export const searchSchoolDirectory = \(token: string, q: string\) => apiRequest<\{ items: SchoolDirectoryItem\[\] \}>\(`\/api\/admin\/school-directory\$\{qs\(\{ q, limit: 8 \}\)\}`, \{ token \}\)/);
  assert.match(admin, /\{ name: 'name', label: 'Tên trường', required: true, render: \(values, set\) => <SchoolPicker token=\{token\} values=\{values\} set=\{set\} \/> \}/);
  assert.match(admin, /fields=\{CREATE_FIELDS\(token\)\}/);
  const choose = /const choose = \(item: SchoolDirectoryItem\) => \{([\s\S]*?)\n  \};/.exec(admin)[1];
  for (const field of ['name', 'school_code', 'region', 'city']) assert.match(choose, new RegExp(`set\\('${field}', item\\.${field === 'school_code' ? 'code' : field}\\)`));
  // gợi ý tìm sau khi gõ, bỏ kết quả cũ khi gõ tiếp, và không tìm lại ngay sau khi vừa chọn
  assert.match(admin, /useDebounced\(name\.trim\(\), 250\)/);
  assert.match(admin, /let live = true;[\s\S]*return \(\) => \{ live = false; \};/);
  assert.match(admin, /if \(justPicked \|\| query\.length < 2\)/);
  // trường đã có trong hệ thống không chọn lại được
  assert.match(admin, /disabled=\{r\.exists\}/);
  // không còn ô dán logo khi thêm trường: huy hiệu tự hiện
  assert.doesNotMatch(admin.slice(admin.indexOf('const CREATE_FIELDS'), admin.indexOf('const SchoolsPanel')), /name: 'logo_url'/);
  assert.match(admin, /Logo tự tạo từ tên trường, không cần dán ảnh/);
});

test('không có hook sau lệnh return sớm trong ô chọn trường (lỗi React #310 từng làm sập trình soạn Quiz)', () => {
  const admin = read('components', 'admin', 'RootAdmin.tsx');
  const picker = admin.slice(admin.indexOf('const SchoolPicker'), admin.indexOf('const SchoolDetailSheet'));
  const firstReturn = picker.indexOf('\n  return (');
  assert.ok(firstReturn > 0);
  assert.doesNotMatch(picker.slice(firstReturn), /\buse(State|Effect|Memo|Callback|Debounced|Load)\(/);
});

test('tạo xong: hộp thông tin hiện đường dẫn riêng (sao chép, mở); danh sách và chi tiết trường cũng có đường dẫn và huy hiệu', () => {
  const admin = read('components', 'admin', 'RootAdmin.tsx');
  assert.match(admin, /extra=\{<View style=\{\{ gap: 10 \}\}>[\s\S]*<SchoolLinkBox link=\{created\.school\.link\} \/>/);
  assert.match(admin, /<SchoolLinkBox link=\{data\.link\} \/>/);
  assert.match(admin, /<SchoolEmblem name=\{s\.name\} code=\{s\.school_code\} logoUrl=\{s\.logo_url\} size=\{36\} \/>/);
  assert.match(read('components', 'admin', 'kit.tsx'), /onClose: \(\) => void; extra\?: React\.ReactNode \}> = \(\{ title, account, onClose, extra \}\)/);
  assert.match(read('components', 'admin', 'SchoolAdmin.tsx'), /<SchoolLinkBox link=\{school\.link\} \/>/);
  const brand = read('components', 'school-brand.tsx');
  assert.match(brand, /navigator\.clipboard\.writeText\(link\.url\)/);
  assert.match(brand, /Linking\.openURL\(link\.url\)/);
});

test('đường dẫn của trường mở trang đăng nhập riêng: kiểm tra dạng đường dẫn, lấy thông tin trường, 404 khi không có', () => {
  const route = read('app', '[school].tsx');
  assert.match(route, /isSchoolSlug\(slug\) \? <SchoolLinkLogin slug=\{slug\} \/> : <ErrorPage kind="not-found" \/>/);
  assert.match(route, /authApi\.getSchoolLink\(slug\)/);
  assert.match(route, /error instanceof ApiError && error\.status === 404\) setStatus\('missing'\)/);
  assert.match(route, /<LoginScreen[\s\S]*school=\{school\}/);
  assert.match(route, /await saveToken\(user\.role, token\);\s*router\.replace\(PORTAL_PATH\[user\.role\]\)/);
  assert.match(read('api', 'authApi.ts'), /export const getSchoolLink = \(slug: string\) => apiRequest<SchoolLinkInfo>\(`\/api\/auth\/school-link\/\$\{encodeURIComponent\(slug\)\}`\)/);
});

test('đăng nhập qua đường dẫn gửi mã trường (mật khẩu và Google); đăng nhập thường không gửi gì thêm', () => {
  const auth = read('api', 'authApi.ts');
  assert.match(auth, /body: \{ username, password, portal, \.\.\.\(schoolCode \? \{ school_code: schoolCode \} : \{\}\) \}/);
  assert.match(auth, /body: \{ id_token: idToken, portal, \.\.\.\(schoolCode \? \{ school_code: schoolCode \} : \{\}\) \}/);
  const login = read('components', 'school-login.tsx');
  assert.match(login, /authApi\.loginWithPassword\(username\.trim\(\), password, role, school\?\.school_code\)/);
  assert.match(login, /authApi\.loginWithGoogle\(idToken, role, school\?\.school_code\)/);
  assert.match(login, /brand=\{school \? <SchoolBadge school=\{school\} light \/> : undefined\}/);
  assert.match(read('components', 'login-layout.tsx'), /\{brand \?\? <BrandLogo light subtitle=\{subtitle\} \/>\}/);
});

test('đường dẫn máy chủ khớp với hàm gọi API', () => {
  const server = path.join(root, '..', 'backend', 'src');
  if (!fs.existsSync(server)) return;
  const admin = fs.readFileSync(path.join(server, 'admin', 'admin.controller.ts'), 'utf8');
  assert.match(admin, /@Get\('school-directory'\)\s*@Roles\('root_admin'\)/);
  const auth = fs.readFileSync(path.join(server, 'auth', 'auth.controller.ts'), 'utf8');
  assert.match(auth, /@Get\('school-link\/:slug'\)/);
  assert.match(auth, /school_code\?: string/);
});
