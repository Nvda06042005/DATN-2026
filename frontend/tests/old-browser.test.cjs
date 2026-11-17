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
