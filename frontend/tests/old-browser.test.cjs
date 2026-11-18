/**
 * 17/11/2026: "máy tôi chạy mượt, máy người khác thiếu chức năng / mất luôn". Bộ điều hướng (expo-router / React Navigation) gọi Array.prototype.toSpliced,
 * findLast, findLastIndex – không có trên Chrome 109 (Windows 7/8.1) và iPhone chưa lên iOS 16, nên bấm Quay lại là văng lỗi, trang trắng, menu chết.
 * Kiểm tra: polyfill nạp đầu tiên ở app/_layout.tsx và chạy đúng trong một môi trường JavaScript đã xóa các hàm đó; trang đánh thức máy chủ khi mở,
 * câu báo lỗi kết nối nói rõ máy chủ có thể đang khởi động; AI chờ đủ lâu.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');

test('polyfill nạp đầu tiên trong bố cục gốc, trước mọi import khác', () => {
  const layout = read('app', '_layout.tsx');
  const imports = layout.split('\n').filter((l) => l.startsWith('import '));
  assert.equal(imports[0].trim(), "import '@/lib/polyfills';");
});

test('polyfill bổ sung đúng các hàm thiếu trên trình duyệt cũ và không đè hàm có sẵn', () => {
  const js = ts.transpileModule(read('lib', 'polyfills.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
  const ctx = vm.createContext({ exports: {}, module: { exports: {} } });
  // mô phỏng Chrome 109: xóa các hàm mới trong "trình duyệt" riêng của vm
  vm.runInContext("for (const k of ['toSpliced','findLast','findLastIndex','at','toSorted','toReversed','with']) delete Array.prototype[k]; delete String.prototype.at; delete Object.hasOwn;", ctx);
  assert.equal(vm.runInContext('typeof [].toSpliced', ctx), 'undefined');
  vm.runInContext(js, ctx);
  const check = (expr) => JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, ctx));
  assert.deepEqual(check('[1,2,3,4].toSpliced(1, 2, "x")'), [1, 'x', 4]);
  assert.deepEqual(check('(() => { const a = [1,2,3]; const b = a.toSpliced(0, 1); return [a, b]; })()'), [[1, 2, 3], [2, 3]]);
  assert.deepEqual(check('[1,2,3].toSpliced(1)'), [1]);
  assert.deepEqual(check('[1,2,3].toSpliced()'), [1, 2, 3]);
  assert.equal(check('[1,2,3,4].findLast((x) => x % 2 === 1)'), 3);
  assert.equal(check('[1,2,3,4].findLastIndex((x) => x < 3)'), 1);
  assert.equal(check('[1,2,3].findLastIndex((x) => x > 9)'), -1);
  assert.equal(check('[5,6,7].at(-1)'), 7);
  assert.deepEqual(check('[3,1,2].toSorted()'), [1, 2, 3]);
  assert.deepEqual(check('[1,2,3].toReversed()'), [3, 2, 1]);
  assert.deepEqual(check('[1,2,3].with(-1, 9)'), [1, 2, 9]);
  assert.equal(check('"abc".at(-1)'), 'c');
  assert.equal(check('Object.hasOwn({ a: 1 }, "a")'), true);
  // Safari cũ: không có requestIdleCallback; crypto.randomUUID có thể là thuộc tính mang giá trị undefined
  const ctx2 = vm.createContext({ exports: {}, module: { exports: {} }, setTimeout, clearTimeout });
  vm.runInContext("globalThis.crypto = { randomUUID: undefined, getRandomValues: (a) => { for (let i = 0; i < a.length; i += 1) a[i] = (i * 37 + 11) & 255; return a; } };", ctx2);
  vm.runInContext(js, ctx2);
  assert.equal(vm.runInContext('typeof requestIdleCallback + "/" + typeof cancelIdleCallback', ctx2), 'function/function');
  assert.match(vm.runInContext('crypto.randomUUID()', ctx2), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(vm.runInContext('typeof Promise.withResolvers', ctx2), 'function');
  // không liệt kê trong for…in (giống hàm gốc)
  assert.deepEqual(check('(() => { const keys = []; for (const k in [1]) keys.push(k); return keys; })()'), ['0']);
});

test('đánh thức máy chủ khi mở trang; báo lỗi kết nối rõ ràng; yêu cầu chỉ đọc tự thử lại; AI chờ đủ lâu', () => {
  const client = read('api', 'client.ts');
  assert.match(client, /export function wakeServer\(\): void \{/);
  assert.match(client, /fetch\(`\$\{API_BASE_URL\}\/api\/health`/);
  assert.match(client, /if \(method !== 'GET' \|\| isAbort\(e\)\) throw/);
  assert.match(client, /\[502, 503, 504\]\.includes\(res\.status\) \? WAKING/);
  assert.match(client, /đang khởi động lại sau thời gian nghỉ/);
  assert.match(read('app', '_layout.tsx'), /useEffect\(\(\) => \{ wakeServer\(\); \}, \[\]\);/);
  assert.match(read('api', 'aiApi.ts'), /`\$\{base\}\/ask`, \{ token, body, timeoutMs: 120_000 \}/);
  const tutor = fs.readFileSync(path.join(__dirname, '..', '..', 'backend', 'src', 'ai', 'ai-tutor.service.ts'), 'utf8');
  assert.match(tutor, /const ENGINE_WAIT_MS = 25_000;/);
  assert.match(tutor, /const ready = await this\.engineReady\(ENGINE_WAIT_MS\);/);
  assert.match(tutor, /throw new ServiceUnavailableException\('Tiểu Tướng đang khởi động mô hình/);
});

test('bộ kiểm tra bản build (CI) bắt cú pháp và hàm mới mà trình duyệt cũ không chạy được', () => {
  const { spawnSync } = require('node:child_process');
  const os = require('node:os');
  const script = path.join(__dirname, '..', 'scripts', 'check-browser-support.cjs');
  const run = (code) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'donga-browsers-'));
    fs.mkdirSync(path.join(dir, '_expo'), { recursive: true });
    fs.writeFileSync(path.join(dir, '_expo', 'a.js'), code);
    const r = spawnSync(process.execPath, [script, dir], { encoding: 'utf8' });
    fs.rmSync(dir, { recursive: true, force: true });
    return { status: r.status, out: r.stdout + r.stderr };
  };
  const ok = run('const a = [3, 1].toSorted(); const b = x?.y ?? 1; class K { f = 1; static s = 2 } requestIdleCallback(() => 0);');
  assert.equal(ok.status, 0, ok.out);
  for (const [code, hint] of [
    ['class K { #p = 1; get() { return this.#p; } }', 'tên riêng'],
    ['class K { static { init(); } }', 'static'],
    ['const r = /(?<=a)b/;', 'nhìn lùi'],
    ['const c = structuredClone({});', 'structuredClone'],
    ['const g = Object.groupBy([], (x) => x);', 'groupBy'],
    ['const x = a ||= {', 'cú pháp'],
  ]) {
    const bad = run(code);
    assert.equal(bad.status, 1, code);
    assert.match(bad.out, new RegExp(hint), code);
  }
  assert.match(read('package.json'), /"check:browsers": "node scripts\/check-browser-support\.cjs dist"/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'ci.yml'), 'utf8'), /run: npm run check:browsers/);
});

test('lịch giữ máy chủ thức: GitHub Actions gọi /api/health?warm=ai mỗi 10 phút, không dùng bí mật', () => {
  const wf = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'keep-alive.yml'), 'utf8');
  assert.match(wf, /cron: '\*\/10 \* \* \* \*'/);
  assert.match(wf, /https:\/\/dong-a-api\.onrender\.com\/api\/health\?warm=ai/);
  assert.match(wf, /permissions: \{\}/);
  assert.doesNotMatch(wf, /\$\{\{\s*secrets\.|Authorization:|-u\s+\S+:/);
});
