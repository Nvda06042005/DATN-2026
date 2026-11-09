// Nút "Sao chép" (đường dẫn của trường, mật khẩu tạm) và thông báo "Đã sao chép".
// Lỗi từng gặp: ToastProvider không được gắn ở app/_layout.tsx nên mọi toast() im lặng, người dùng bấm xong không thấy gì và tưởng nút hỏng.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

function loadCopyText(env) {
  const compiled = ts.transpileModule(read('lib', 'clipboard.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new vm.Script(`(function(module,exports,navigator,document){${compiled}\n})`).runInThisContext()(module, module.exports, env.navigator, env.document);
  return module.exports.copyText;
}

function fakeDocument({ execResult = true, throwOnExec = false } = {}) {
  const log = { appended: [], removed: 0, selected: false, copied: null };
  const host = { appendChild: (el) => log.appended.push(el), removeChild: () => { log.removed += 1; } };
  const document = {
    activeElement: { parentElement: host },
    body: host,
    execCommand: (cmd) => { if (throwOnExec) throw new Error('bị chặn'); log.copied = cmd; return execResult; },
    createElement: () => ({ style: {}, setAttribute() {}, focus() {}, select() { log.selected = true; }, setSelectionRange() {} }),
  };
  return { document, log };
}

test('Clipboard API chép được thì dùng luôn, không đụng tới cách dự phòng', async () => {
  const written = [];
  const { document, log } = fakeDocument();
  const copyText = loadCopyText({ navigator: { clipboard: { writeText: async (t) => { written.push(t); } } }, document });
  assert.equal(await copyText('https://donga.example/donga_79765507_phumy_binhthanh'), true);
  assert.deepEqual(written, ['https://donga.example/donga_79765507_phumy_binhthanh']);
  assert.equal(log.appended.length, 0);
});

test('Clipboard API bị từ chối hoặc không có thì chép bằng ô nhập tạm và dọn ô đó đi', async () => {
  for (const navigator of [{ clipboard: { writeText: async () => { throw new Error('NotAllowedError'); } } }, {}]) {
    const { document, log } = fakeDocument();
    const copyText = loadCopyText({ navigator, document });
    assert.equal(await copyText('abc'), true);
    assert.equal(log.copied, 'copy');
    assert.equal(log.selected, true);
    assert.equal(log.appended.length, 1);
    assert.equal(log.removed, 1);
  }
});

test('không chép được bằng cách nào thì trả false (không ném lỗi) để giao diện báo cho người dùng', async () => {
  assert.equal(await loadCopyText({ navigator: {}, document: fakeDocument({ execResult: false }).document })('abc'), false);
  assert.equal(await loadCopyText({ navigator: {}, document: fakeDocument({ throwOnExec: true }).document })('abc'), false);
  assert.equal(await loadCopyText({ navigator: undefined, document: undefined })('abc'), false);
});

test('thông báo toàn ứng dụng: ToastProvider bao quanh Stack ở bố cục gốc', () => {
  const layout = read('app', '_layout.tsx');
  assert.match(layout, /import \{ ToastProvider \} from '@\/components\/ui';/);
  assert.match(layout, /<ToastProvider>\s*<Stack screenOptions=\{\{ headerShown: false[^\n]*\/>\s*<\/ToastProvider>/);
  // ToastProvider nằm trong ThemeContext để vẽ được màu và linh vật, trong SafeAreaProvider để tính lề
  assert.ok(layout.indexOf('<ThemeContext.Provider') < layout.indexOf('<ToastProvider>') && layout.indexOf('<SafeAreaProvider>') < layout.indexOf('<ToastProvider>'));
});

test('hai nút Sao chép dùng chung hàm chép, đổi nhãn ngay tại nút và báo khi không chép được', () => {
  const brand = read('components', 'school-brand.tsx');
  assert.match(brand, /const ok = await copyText\(link\.url\);/);
  assert.match(brand, /title=\{copy === 'done' \? 'Đã sao chép' : 'Sao chép'\} icon=\{copy === 'done' \? Check : Copy\}/);
  assert.match(brand, /copy === 'failed' \? <Txt[^>]*testID="school-link-copy-failed"/);
  assert.doesNotMatch(brand, /navigator\.clipboard/);
  const kit = read('components', 'admin', 'kit.tsx');
  assert.match(kit, /const ok = await copyText\(`Tên đăng nhập: \$\{account\.username\}/);
  assert.match(kit, /title=\{copied \? 'Đã sao chép' : 'Sao chép'\}[^\n]*testID="credential-copy"/);
  assert.doesNotMatch(kit, /navigator\.clipboard/);
});
