// Tab mở từ trước khi triển khai bản mới sập với "Unexpected token '<'" / "Requiring unknown module" (tệp mã cũ trả về HTML): hai nút Về trang chủ / Thử lại
// của trang lỗi phải tải lại cả trang, và lỗi kiểu này tự tải lại đúng một lần (không lặp vô hạn). Phần tính toán chạy thật bằng cách biên dịch TypeScript.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const compiled = ts.transpileModule(read('lib', 'stale-bundle.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new vm.Script(`(function(module,exports){${compiled}\n})`).runInThisContext()(mod, mod.exports);
const { isStaleBundleError, canAutoReload, reloadForNewVersion, AUTO_RELOAD_GAP_MS } = mod.exports;

test('nhận dạng lỗi do mã của bản cũ không tải được; lỗi nghiệp vụ thì không', () => {
  for (const m of [
    "SyntaxError: Unexpected token '<'", 'Requiring unknown module "757".', 'ChunkLoadError: Loading chunk 12 failed.', 'Loading chunk admin-a9dec failed',
    'Failed to fetch dynamically imported module: https://x/y.js', 'error loading dynamically imported module', 'Importing a module script failed.',
  ]) assert.equal(isStaleBundleError(m), true, m);
  for (const m of ['Cannot read properties of undefined (reading "map")', 'Network request failed', 'Không tìm thấy trường', '', null, undefined]) assert.equal(isStaleBundleError(m), false, String(m));
});

test('chỉ tự tải lại một lần trong 60 giây; đồng hồ lùi thì vẫn cho tải lại', () => {
  assert.equal(AUTO_RELOAD_GAP_MS, 60000);
  assert.equal(canAutoReload(0, 1_000_000), true);
  assert.equal(canAutoReload(1_000_000, 1_030_000), false);
  assert.equal(canAutoReload(1_000_000, 1_060_000), true);
  assert.equal(canAutoReload(2_000_000, 1_000_000), true);
});

test('tự tải lại: lần đầu tải lại, lần hai trong 60 giây thì thôi, sau đó lại được; sessionStorage bị chặn thì không tải lại (tránh lặp vô hạn); ngoài trình duyệt thì không làm gì', () => {
  const make = (blocked) => {
    const store = new Map();
    const state = { reloads: 0 };
    global.window = {
      location: { reload: () => { state.reloads += 1; } },
      sessionStorage: { getItem: (k) => { if (blocked) throw new Error('blocked'); return store.get(k) ?? null; }, setItem: (k, v) => { if (blocked) throw new Error('blocked'); store.set(k, v); } },
    };
    return state;
  };
  try {
    let s = make(false);
    assert.equal(reloadForNewVersion(1_000_000), true);
    assert.equal(reloadForNewVersion(1_020_000), false);
    assert.equal(reloadForNewVersion(1_059_999), false);
    assert.equal(reloadForNewVersion(1_061_000), true);
    assert.equal(s.reloads, 2);
    s = make(true);
    assert.equal(reloadForNewVersion(5_000_000), false);
    assert.equal(s.reloads, 0);
    delete global.window;
    assert.equal(reloadForNewVersion(9_000_000), false);
  } finally { delete global.window; }
});

test('trang lỗi: ErrorBoundary của ứng dụng bật tải lại thật cho hai nút; trang không tìm thấy và lỗi tải dữ liệu vẫn điều hướng mềm', () => {
  const page = read('components', 'error-page.tsx');
  assert.match(page, /reloadOnRecover\?: boolean/);
  assert.match(page, /const hardReload = !!reloadOnRecover && onWeb;/);
  assert.match(page, /const goHome = \(\) => \{ if \(hardReload\) window\.location\.assign\('\/'\); else router\.replace\('\/'\); \};/);
  assert.match(page, /const retry = \(\) => \{ if \(hardReload\) window\.location\.reload\(\); else onRetry\?\.\(\); \};/);
  assert.match(page, /if \(kind === 'crash' && hardReload && isStaleBundleError\(detail\)\) reloadForNewVersion\(\);/);
  assert.match(page, /onPress=\{goHome\} testID="error-home"/);
  assert.match(page, /onPress=\{retry\} testID="error-retry"/);
  assert.match(read('app', '_layout.tsx'), /<ErrorPage kind="crash" detail=\{error\?\.message\} onRetry=\{\(\) => \{ void retry\(\); \}\} reloadOnRecover \/>/);
  assert.doesNotMatch(read('app', '[school].tsx'), /reloadOnRecover/);
  assert.doesNotMatch(read('app', '+not-found.tsx'), /reloadOnRecover/);
});
