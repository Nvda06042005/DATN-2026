// Quên mật khẩu không mất tiến độ khi tab bị tải lại giữa chừng (quay lại từ hộp thư, trình duyệt giải phóng tab nền, F5).
// Logic thuần của lib/forgot-progress.ts chạy thật bằng cách biên dịch TypeScript với sessionStorage giả; phần nối vào giao diện kiểm tra các mắt xích.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

function fakeStorage(overrides = {}) {
  const data = new Map();
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
    ...overrides,
  };
}

function loadProgress(sessionStorage) {
  const out = ts.transpileModule(read('lib', 'forgot-progress.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  const sandbox = { module: mod, exports: mod.exports };
  if (sessionStorage !== undefined) sandbox.sessionStorage = sessionStorage;
  vm.runInNewContext(out, sandbox);
  return mod.exports;
}

const MIN = 60_000;
const T0 = 1_800_000_000_000;

test('lưu rồi đọc lại đúng cổng; cổng khác không dùng được tiến độ của cổng này', () => {
  const store = fakeStorage();
  const p = loadProgress(store);
  p.saveForgotProgress({ scope: 'admin:root_admin', step: 'code', identifier: 'admin' }, T0);
  assert.deepEqual({ ...p.loadForgotProgress('admin:root_admin', T0 + MIN) }, { scope: 'admin:root_admin', step: 'code', identifier: 'admin', at: T0 });
  assert.equal(p.loadForgotProgress('school:00000001', T0 + MIN), null);
  p.saveForgotProgress({ scope: 'school:00000001', step: 'password', identifier: 'gv.an', ticket: 't'.repeat(40) }, T0);
  assert.equal(p.loadForgotProgress('school:00000001', T0 + MIN).ticket, 't'.repeat(40));
  assert.equal(p.loadForgotProgress('admin:root_admin', T0 + MIN), null); // một tab chỉ giữ một tiến độ, bản mới thay bản cũ
});

test('bước nhập mã sống 5 phút, bước đặt mật khẩu 10 phút; hết hạn thì bỏ và xóa', () => {
  const store = fakeStorage();
  const p = loadProgress(store);
  p.saveForgotProgress({ scope: 's', step: 'code', identifier: 'x' }, T0);
  assert.ok(p.loadForgotProgress('s', T0 + 5 * MIN));
  assert.equal(p.loadForgotProgress('s', T0 + 5 * MIN + 1), null);
  assert.equal(store.data.size, 0, 'bản hết hạn bị xóa');
  p.saveForgotProgress({ scope: 's', step: 'password', identifier: 'x', ticket: 'k'.repeat(30) }, T0);
  assert.ok(p.loadForgotProgress('s', T0 + 10 * MIN));
  assert.equal(p.loadForgotProgress('s', T0 + 10 * MIN + 1), null);
  assert.equal(store.data.size, 0);
});

test('bản ghi hỏng, thiếu phiếu ở bước mật khẩu, bước lạ hoặc ghi giờ ở tương lai đều bị bỏ và xóa', () => {
  const store = fakeStorage();
  const p = loadProgress(store);
  const put = (v) => store.data.set('donga_forgot_progress', typeof v === 'string' ? v : JSON.stringify(v));
  for (const bad of [
    '{không phải json',
    { scope: 's', step: 'password', identifier: 'x', at: T0 },
    { scope: 's', step: 'password', identifier: 'x', ticket: '', at: T0 },
    { scope: 's', step: 'ask', identifier: 'x', at: T0 },
    { scope: 's', step: 'code', identifier: '', at: T0 },
    { scope: 's', step: 'code', identifier: 'x', at: 'hôm qua' },
    { scope: 's', step: 'code', identifier: 'x', at: T0 + 30 * MIN },
    { step: 'code', identifier: 'x', at: T0 },
    null,
    [],
  ]) {
    put(bad);
    assert.equal(p.loadForgotProgress('s', T0), null, JSON.stringify(bad));
    assert.equal(store.data.size, 0, `đã xóa: ${JSON.stringify(bad)}`);
  }
});

test('chỉ lưu cổng, bước, tên tài khoản, phiếu và giờ; không bao giờ lưu mã OTP hay mật khẩu', () => {
  const store = fakeStorage();
  const p = loadProgress(store);
  // dù người gọi lỡ truyền thêm otp hay password, chúng cũng không được ghi xuống
  p.saveForgotProgress({ scope: 's', step: 'password', identifier: 'gv.an', ticket: 'k'.repeat(30), otp: '123456', password: 'Mat-khau-9' }, T0);
  const raw = store.data.get('donga_forgot_progress');
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), ['at', 'identifier', 'scope', 'step', 'ticket']);
  assert.ok(!raw.includes('123456') && !raw.includes('Mat-khau-9'));
  // bước nhập mã chưa có phiếu thì không ghi trường ticket
  p.saveForgotProgress({ scope: 's', step: 'code', identifier: 'gv.an' }, T0);
  assert.deepEqual(Object.keys(JSON.parse(store.data.get('donga_forgot_progress'))).sort(), ['at', 'identifier', 'scope', 'step']);
});

test('xóa tiến độ; trình duyệt chặn hoặc không có sessionStorage thì không báo lỗi và chỉ mất khả năng khôi phục', () => {
  const store = fakeStorage();
  const p = loadProgress(store);
  p.saveForgotProgress({ scope: 's', step: 'code', identifier: 'x' }, T0);
  p.clearForgotProgress();
  assert.equal(store.data.size, 0);
  assert.equal(p.loadForgotProgress('s', T0), null);
  // không có sessionStorage (ứng dụng di động)
  const none = loadProgress(undefined);
  assert.doesNotThrow(() => none.saveForgotProgress({ scope: 's', step: 'code', identifier: 'x' }));
  assert.equal(none.loadForgotProgress('s'), null);
  assert.doesNotThrow(() => none.clearForgotProgress());
  // truy cập lưu trữ ném lỗi (chế độ riêng tư, bị chặn, đầy)
  const boom = () => { throw new Error('bị chặn'); };
  const blocked = loadProgress(fakeStorage({ getItem: boom, setItem: boom, removeItem: boom }));
  assert.doesNotThrow(() => blocked.saveForgotProgress({ scope: 's', step: 'code', identifier: 'x' }));
  assert.equal(blocked.loadForgotProgress('s'), null);
  assert.doesNotThrow(() => blocked.clearForgotProgress());
});

test('hộp quên mật khẩu của giáo viên, học sinh, quản trị trường: mở lại đúng bước khi tải lại; lưu khi có mã và khi mã đúng; xóa khi xong, đóng, xin mã mới', () => {
  const src = read('components', 'auth.tsx');
  assert.match(src, /import \{ clearForgotProgress, loadForgotProgress, saveForgotProgress \} from '@\/lib\/forgot-progress';/);
  assert.match(src, /const scope = `school:\$\{school\?\.school_code \?\? 'portal'\}`;/);
  assert.match(src, /const \[forgot, setForgot\] = useState\(\(\) => loadForgotProgress\(scope\) !== null\);/);
  assert.match(src, /<ForgotPasswordSheet scope=\{scope\} /);
  const start = src.indexOf('const ForgotPasswordSheet:');
  const sheet = src.slice(start, src.indexOf('// ----------------------------------------------------------------------', start));
  assert.match(sheet, /const \[saved\] = useState\(\(\) => loadForgotProgress\(scope\)\);/);
  assert.match(sheet, /useState<'ask' \| 'code' \| 'password'>\(saved\?\.step \?\? 'ask'\)/);
  assert.match(sheet, /useState\(saved\?\.ticket \?\? ''\)/);
  assert.match(sheet, /saveForgotProgress\(\{ scope, step: 'code', identifier: identifier\.trim\(\) \}\);\s*setStep\('code'\);/);
  assert.match(sheet, /saveForgotProgress\(\{ scope, step: 'password', identifier: identifier\.trim\(\), ticket: res\.reset_token \}\);/);
  assert.match(sheet, /clearForgotProgress\(\);\s*onDone\(\);/);
  assert.match(sheet, /const restart = \(\) => \{ clearForgotProgress\(\);/);
  assert.match(sheet, /const close = \(\) => \{ clearForgotProgress\(\); onClose\(\); \};/);
  assert.match(sheet, /onClose=\{close\}/);
  assert.match(sheet, /title="Đóng" tone="giay" onPress=\{close\}/);
  assert.match(sheet, /setDead\(true\); clearForgotProgress\(\);/);
  // không lưu mật khẩu hay mã người dùng gõ
  assert.doesNotMatch(sheet, /saveForgotProgress\([^)]*(otp|next|confirm)\b/);
});

test('quản trị tổng: mở lại đúng màn (nhập mã hoặc mật khẩu mới) khi tải lại; lưu, xóa ở đúng chỗ', () => {
  const src = read('components', 'admin', 'AdminLogin.tsx');
  assert.match(src, /import \{ clearForgotProgress, loadForgotProgress, saveForgotProgress \} from '@\/lib\/forgot-progress';/);
  assert.match(src, /const scope = `admin:\$\{portal\}`;/);
  assert.match(src, /const \[restored\] = useState\(\(\) => loadForgotProgress\(scope\)\);/);
  assert.match(src, /useState<Step>\(restored \? \(restored\.step === 'code' \? 'reset' : 'password'\) : 'login'\)/);
  assert.match(src, /useState\(restored\?\.identifier \?\? ''\)/);
  assert.match(src, /useState\(restored\?\.ticket \?\? ''\)/);
  assert.match(src, /saveForgotProgress\(\{ scope, step: 'code', identifier: id \}\);\s*setIdentifier\(id\);/);
  assert.match(src, /saveForgotProgress\(\{ scope, step: 'password', identifier, ticket: t \}\);/);
  assert.match(src, /clearForgotProgress\(\);\s*setFlash\('Đã đặt lại mật khẩu/);
  assert.match(src, /const restart = \(\) => \{\s*clearForgotProgress\(\);\s*setView\('forgot'\);/);
  assert.equal([...src.matchAll(/onRequestNew=\{restart\}/g)].length, 2);
  assert.match(src, /onBack=\{\(\) => \{\s*clearForgotProgress\(\);\s*setView\('login'\);/);
  assert.match(src, /setDead\(true\); clearForgotProgress\(\);/);
});
