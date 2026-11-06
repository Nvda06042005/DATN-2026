// Thêm trường từ danh mục (mã, khu vực, logo tự điền) và đường dẫn riêng donga_<mã>_<tên>_<khu vực> làm cổng đăng nhập của trường.
// Logic thuần (nhận dạng đường dẫn, danh sách logo chính thức) chạy thật bằng cách biên dịch TypeScript; thành phần React Native không nạp được trong Node
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

function loadLogos() {
  const compiled = ts.transpileModule(read('lib', 'school-logos.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new vm.Script(`(function(module,exports){${compiled}\n})`).runInThisContext()(module, module.exports);
  return module.exports;
}

test('logo chính thức: mỗi mã trong danh sách có đúng một tệp ảnh, không có tệp mồ côi, và trường chưa có logo thì trả null (không vẽ logo giả)', () => {
  const { SCHOOL_LOGO_CODES, schoolLogoUrl } = loadLogos();
  const dir = path.join(root, 'public', 'school-logos');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, '')).sort();
  assert.deepEqual([...SCHOOL_LOGO_CODES].sort(), files);
  assert.ok(files.length >= 100, `chỉ có ${files.length} logo`);
  for (const code of files) assert.match(code, /^\d{4,8}$/);
  assert.equal(schoolLogoUrl('79765507'), '/school-logos/79765507.webp');
  assert.equal(schoolLogoUrl('01015507'), null);
  assert.equal(schoolLogoUrl(''), null);
  // mọi logo đã qua kiểm tra: tệp WebP hợp lệ, nhỏ gọn
  for (const code of files) {
    const buf = fs.readFileSync(path.join(dir, `${code}.webp`));
    assert.equal(buf.subarray(0, 4).toString('latin1'), 'RIFF', code);
    assert.equal(buf.subarray(8, 12).toString('latin1'), 'WEBP', code);
    assert.ok(buf.length < 80 * 1024, `${code} nặng ${buf.length} byte`);
  }
});

test('nguồn của từng logo được ghi lại và chỉ lấy từ website của Sở GD&ĐT TP.HCM (hcm.edu.vn)', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, '..', 'scripts', 'school-logos.json'), 'utf8'));
  const { SCHOOL_LOGO_CODES } = loadLogos();
  assert.equal(manifest.schools.length, SCHOOL_LOGO_CODES.size);
  for (const m of manifest.schools) {
    assert.ok(SCHOOL_LOGO_CODES.has(m.code), m.code);
    assert.match(m.site, /^https:\/\/[a-z0-9-]+\.hcm\.edu\.vn\/$/, m.code);
    assert.ok(['logo-named', 'img-logo', 'og-only', 'icon'].includes(m.confidence), `${m.code}: ${m.confidence}`);
    assert.ok(m.logo_source.startsWith('https://'), m.code);
  }
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
  assert.match(admin, /Logo chính thức của trường tự hiện, không cần dán ảnh/);
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
  assert.match(brand, /copyText\(link\.url\)/);
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
