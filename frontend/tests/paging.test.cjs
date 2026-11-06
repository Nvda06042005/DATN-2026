// Bảng quản trị chia trang bằng nút chuyển trang thay vì cuộn dài xuống: số dòng mỗi trang theo màn hình, nút Trước / số trang / Sau,
// bảng tự chia trang khi nhiều dòng, danh sách chia trang ở máy chủ dùng cùng số dòng. Phần tính toán chạy thật; giao diện kiểm tra mã nguồn.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const compiled = ts.transpileModule(read('lib', 'paging.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new vm.Script(`(function(module,exports){${compiled}\n})`).runInThisContext()(mod, mod.exports);
const { pageSizeFor, pageWindow, MIN_PAGE_SIZE, MAX_PAGE_SIZE, TABLE_MIN_WIDTH } = mod.exports;

test('số dòng mỗi trang theo chiều cao màn hình: màn máy tính 1030 px cao được 7 dòng, màn thấp không dưới 5, màn rất cao không quá 30', () => {
  assert.equal(pageSizeFor(1920, 1030), 7);
  assert.equal(pageSizeFor(1280, 900), 5);
  assert.equal(pageSizeFor(1280, 600), MIN_PAGE_SIZE);
  assert.equal(pageSizeFor(1920, 1440), 13);
  assert.equal(pageSizeFor(3840, 5000), MAX_PAGE_SIZE);
  // cao hơn thì nhiều dòng hơn, không bao giờ giảm
  let last = 0;
  for (let h = 600; h <= 2400; h += 50) { const n = pageSizeFor(1600, h); assert.ok(n >= last, `h=${h}`); last = n; }
});

test('màn hẹp (danh sách thẻ) mỗi trang 5 thẻ, đúng ngưỡng chuyển từ bảng sang thẻ', () => {
  assert.equal(TABLE_MIN_WIDTH, 1000);
  assert.equal(pageSizeFor(390, 844), 5);
  assert.equal(pageSizeFor(999, 2000), 5);
  assert.ok(pageSizeFor(1000, 2000) > 5);
});

test('dãy số trang: ít trang thì hiện hết; nhiều trang luôn có trang đầu, cuối, trang kề và dấu …', () => {
  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(2, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(pageWindow(1, 7), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(pageWindow(1, 20), [1, 2, '…', 20]);
  assert.deepEqual(pageWindow(10, 20), [1, '…', 9, 10, 11, '…', 20]);
  assert.deepEqual(pageWindow(20, 20), [1, '…', 19, 20]);
  assert.deepEqual(pageWindow(3, 9), [1, 2, 3, 4, '…', 9]);
  for (const [page, pages] of [[1, 8], [4, 8], [8, 8], [50, 100]]) {
    const w = pageWindow(page, pages);
    assert.ok(w.includes(page) && w.includes(1) && w.includes(pages));
    assert.ok(w.every((n, i) => n === '…' || i === 0 || w[i - 1] === '…' || n === w[i - 1] + 1), 'các số liền nhau không bị nhảy mà thiếu dấu …');
  }
});

test('nút chuyển trang có Trước, số trang, Sau; chỉ hiện khi nhiều hơn một trang', () => {
  const kit = read('components', 'admin', 'kit.tsx');
  assert.match(kit, /if \(total <= limit\) return <Txt size=\{13\} color=\{c\.muc3\}>\{total\} kết quả<\/Txt>;/);
  for (const id of ['pager-prev', 'pager-next', 'pager-page-${n}']) assert.ok(kit.includes(id), id);
  assert.match(kit, /Hiển thị \{from\}–\{to\} \/ \{total\} kết quả/);
  assert.match(kit, /label: 'Trang trước', disabled: page <= 1/);
  assert.match(kit, /label: 'Trang sau', disabled: page >= pages/);
});

test('bảng tự chia trang khi nhiều dòng hơn một trang (mặc định bật), kẹp số trang khi danh sách ngắn lại, có thể tắt', () => {
  const kit = read('components', 'admin', 'kit.tsx');
  assert.match(kit, /actionsWidth = 150, paginate = true \}/);
  assert.match(kit, /const paged = paginate && rows\.length > size;/);
  assert.match(kit, /useEffect\(\(\) => \{ if \(page > pages\) setPage\(pages\); \}, \[page, pages\]\);/);
  // hook đặt trước lệnh return sớm (lỗi React #310 từng làm sập trình soạn Quiz)
  const body = kit.slice(kit.indexOf('export function DataTable'));
  assert.ok(body.indexOf('useEffect(') < body.indexOf('if (!rows.length &&'));
  assert.equal((body.match(/\{pager\}/g) ?? []).length >= 2, true, 'cả bảng và danh sách thẻ đều có nút chuyển trang');
});

test('danh sách chia trang ở máy chủ dùng cùng số dòng của màn hình, nên bảng không chia trang lần nữa', () => {
  const need = {
    'RootAdmin.tsx': [/api\.listSchools\(token, \{[^}]*limit: size \}\)/, /api\.listUsers\(token, \{[\s\S]*?limit: size/, /<Pager page=\{page\} limit=\{size\} total=\{data\.total\}/],
    'SchoolPeople.tsx': [/limit: size \} as never\)/, /<Pager page=\{page\} limit=\{size\}/],
    'QuestionBank.tsx': [/page, limit: size \}\)/, /<Pager page=\{page\} limit=\{size\}/],
    'QuizManager.tsx': [/page, limit: size \}\)/, /<Pager page=\{page\} limit=\{size\}/],
    'PlatformOps.tsx': [/api\.allTickets\([^)]*limit: size/, /api\.auditLog\([^)]*limit: size/, /api\.loginLog\([^)]*limit: size/, /api\.errorLog\([^)]*limit: size/],
  };
  for (const [file, patterns] of Object.entries(need)) {
    const src = read('components', 'admin', file);
    assert.match(src, /const size = usePageSize\(\);/, file);
    for (const re of patterns) assert.match(src, re, `${file}: ${re}`);
    assert.doesNotMatch(src, /limit: 30 \}|limit=\{30\}|limit: 15 \}|limit=\{15\}/, `${file} còn số dòng cố định`);
  }
  // hộp chọn câu hỏi trong bảng trượt vẫn do máy chủ chia 10 dòng/trang: tắt chia trang của bảng để không có hai bộ nút
  assert.match(read('components', 'admin', 'ContentKit.tsx'), /<DataTable<QuestionItem> paginate=\{false\}/);
  assert.match(read('api', 'platformApi.ts'), /allTickets = \(token: string, q: \{[^}]*limit\?: number \}/);
});

test('máy chủ nhận số dòng mỗi trang của yêu cầu hỗ trợ (tối đa 100, mặc định 30)', () => {
  const server = path.join(root, '..', 'backend', 'src', 'platform');
  if (!fs.existsSync(server)) return;
  assert.match(fs.readFileSync(path.join(server, 'support.service.ts'), 'utf8'), /const limit = Math\.min\(100, Math\.max\(1, Number\(f\.limit\) \|\| 30\)\)/);
  assert.match(fs.readFileSync(path.join(server, 'platform.controller.ts'), 'utf8'), /limit: q\.limit \? Number\(q\.limit\) : undefined/);
});
