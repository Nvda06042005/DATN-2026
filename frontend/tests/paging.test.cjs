// Bảng quản trị chia trang bằng nút chuyển trang thay vì cuộn dài xuống: số dòng mỗi trang do người dùng chọn (5 / 10 / 25 / 30 / 50) ở ô chọn cạnh nút chuyển trang,
// nút Trước / số trang / Sau, bảng tự chia trang khi nhiều dòng, danh sách chia trang ở máy chủ dùng cùng số dòng. Phần tính toán chạy thật; giao diện kiểm tra mã nguồn.
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
const { PAGE_SIZES, DEFAULT_PAGE_SIZE, parsePageSize, getPageSize, setPageSize, subscribePageSize, pageWindow, TABLE_MIN_WIDTH } = mod.exports;

test('số dòng mỗi trang chọn trong 5 / 10 / 25 / 30 / 50, mặc định 10; giá trị lạ quay về 10', () => {
  assert.deepEqual([...PAGE_SIZES], [5, 10, 25, 30, 50]);
  assert.equal(DEFAULT_PAGE_SIZE, 10);
  for (const n of PAGE_SIZES) assert.equal(parsePageSize(n), n);
  for (const bad of [0, 7, 15, 100, -10, NaN, null, undefined, 'abc', '']) assert.equal(parsePageSize(bad), 10, String(bad));
  assert.equal(parsePageSize('5'), 5);
  assert.equal(parsePageSize('50'), 50);
  assert.equal(parsePageSize('25'), 25, 'giá trị đọc từ bộ nhớ trình duyệt là chuỗi');
  assert.equal(TABLE_MIN_WIDTH, 1000);
});

test('đổi số dòng báo cho mọi bảng đang mở cùng lúc; chọn lại đúng mức đang dùng thì không báo thừa', () => {
  assert.equal(getPageSize(), 10);
  let calls = 0;
  const off = subscribePageSize(() => { calls += 1; });
  setPageSize(25);
  assert.equal(getPageSize(), 25);
  assert.equal(calls, 1);
  setPageSize(25);
  assert.equal(calls, 1, 'không đổi thì không báo');
  setPageSize(30);
  assert.equal(getPageSize(), 30);
  assert.equal(calls, 2);
  setPageSize(5);
  assert.equal(getPageSize(), 5);
  setPageSize(50);
  assert.equal(getPageSize(), 50);
  calls = 2;
  setPageSize(7);
  assert.equal(getPageSize(), 10, 'mức không có trong danh sách quay về mặc định');
  assert.equal(calls, 3);
  off();
  setPageSize(25);
  assert.equal(calls, 3, 'đã hủy đăng ký thì không nhận thông báo');
  setPageSize(10);
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

test('nút chuyển trang luôn hiện đủ Trước, số trang, Sau và ô chọn số dòng 5 / 10 / 25 / 30 / 50, kể cả khi chỉ có một trang hoặc chưa có kết quả', () => {
  const kit = read('components', 'admin', 'kit.tsx');
  assert.doesNotMatch(kit, /if \(total <= limit\)/, 'không còn rút gọn khi chỉ có một trang');
  assert.match(kit, /const sizeSelect = <PageSizeSelect onChanged=\{\(\) => onPage\(1\)\} \/>;/);
  assert.match(kit, /const from = total \? \(page - 1\) \* limit \+ 1 : 0/);
  assert.match(kit, /total \? `Hiển thị \$\{from\}–\$\{to\} \/ \$\{total\} kết quả` : 'Không có kết quả'/);
  for (const id of ['pager-prev', 'pager-next', 'pager-page-${n}', 'page-size-select']) assert.ok(kit.includes(id), id);
  assert.match(kit, /label: 'Trang trước', disabled: page <= 1/);
  assert.match(kit, /label: 'Trang sau', disabled: page >= pages/);
  // ô chọn số dòng: đổi thì mọi bảng và danh sách đổi theo và quay về trang 1
  assert.match(kit, /onChange=\{\(n\) => \{ setPageSize\(n\); onChanged\(\); \}\}/);
  assert.match(kit, /export const usePageSize = \(\): number => useSyncExternalStore\(subscribePageSize, getPageSize, \(\) => DEFAULT_PAGE_SIZE\);/);
});

test('bảng luôn có thanh chuyển trang (mặc định bật) và tự chia trang khi nhiều dòng, kẹp số trang khi danh sách ngắn lại, có thể tắt', () => {
  const kit = read('components', 'admin', 'kit.tsx');
  assert.match(kit, /actionsWidth = 150, paginate = true \}/);
  assert.match(kit, /const paged = paginate && rows\.length > size;/);
  assert.match(kit, /const pager = paginate \? <Pager page=\{current\} limit=\{size\} total=\{rows\.length\} onPage=\{setPage\} \/> : null;/);
  assert.match(kit, /useEffect\(\(\) => \{ if \(page > pages\) setPage\(pages\); \}, \[page, pages\]\);/);
  // hook đặt trước lệnh return sớm (lỗi React #310 từng làm sập trình soạn Quiz)
  const body = kit.slice(kit.indexOf('export function DataTable'));
  assert.ok(body.indexOf('useEffect(') < body.indexOf('if (!rows.length &&'));
  assert.equal((body.match(/\{pager\}/g) ?? []).length >= 2, true, 'cả bảng và danh sách thẻ đều có nút chuyển trang');
});

test('danh sách chia trang ở máy chủ dùng cùng số dòng đang chọn, nên bảng không chia trang lần nữa', () => {
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
  // bảng đã chia trang ở máy chủ có nút Pager riêng nên tắt chia trang của bảng: không thì ô chọn số dòng hiện hai lần
  for (const file of ['RootAdmin.tsx', 'SchoolPeople.tsx', 'QuestionBank.tsx', 'QuizManager.tsx', 'PlatformOps.tsx']) {
    const src = read('components', 'admin', file);
    const pagers = (src.match(/<Pager /g) ?? []).length;
    assert.equal((src.match(/<DataTable(<[^>\n]*>)? paginate=\{false\}/g) ?? []).length, pagers, `${file}: mỗi bảng có Pager riêng phải tắt chia trang của bảng`);
  }
  // hộp chọn câu hỏi trong bảng trượt cũng do máy chủ chia trang theo số dòng đang chọn: tắt chia trang của bảng để không có hai bộ nút
  const picker = read('components', 'admin', 'ContentKit.tsx');
  assert.match(picker, /<DataTable<QuestionItem> paginate=\{false\}/);
  assert.match(picker, /limit: size \}\), \[session\.token, store, term, qtype, page, size\]/);
  assert.match(picker, /<Pager page=\{page\} limit=\{size\} total=\{list\.data\.total\}/);
  assert.doesNotMatch(picker, /limit: 10 \}|limit=\{10\}/);
  assert.match(read('api', 'platformApi.ts'), /allTickets = \(token: string, q: \{[^}]*limit\?: number \}/);
});

test('máy chủ nhận số dòng mỗi trang của yêu cầu hỗ trợ (tối đa 100, mặc định 30)', () => {
  const server = path.join(root, '..', 'backend', 'src', 'platform');
  if (!fs.existsSync(server)) return;
  assert.match(fs.readFileSync(path.join(server, 'support.service.ts'), 'utf8'), /const limit = Math\.min\(100, Math\.max\(1, Number\(f\.limit\) \|\| 30\)\)/);
  assert.match(fs.readFileSync(path.join(server, 'platform.controller.ts'), 'utf8'), /limit: q\.limit \? Number\(q\.limit\) : undefined/);
});

test('cổng học sinh dùng cùng ô chọn số dòng và thanh chuyển trang: lịch sử làm bài (máy chủ chia trang), thư viện, tư liệu gốc, thông báo (chia trang trên máy)', () => {
  const kit = read('components', 'admin', 'kit.tsx');
  assert.match(kit, /export function usePaged<T>\(items: T\[\], resetKey: string \| number = ''\)/);
  assert.match(kit, /pager: <Pager page=\{current\} limit=\{size\} total=\{items\.length\} onPage=\{setPage\} \/>/);
  assert.match(kit, /useEffect\(\(\) => \{ setPage\(1\); \}, \[resetKey\]\);/);
  const progress = read('components', 'portal', 'Progress.tsx');
  assert.match(progress, /api\.attemptHistory\(session\.token, \{ page, limit: size \}\), \[session\.token, page, size, refreshKey\]/);
  assert.match(progress, /<Pager page=\{page\} limit=\{size\} total=\{history\.data\.total\} onPage=\{setPage\} \/>/);
  const library = read('components', 'portal', 'Library.tsx');
  for (const name of ['pagedSearch', 'pagedFigures', 'pagedPlaces', 'pagedTerms', 'pagedSources']) {
    assert.match(library, new RegExp(`const ${name} = usePaged\\(`), name);
    assert.match(library, new RegExp(`${name}\\.shown\\.map\\(`), `${name} hiện đúng các phần tử của trang`);
    assert.match(library, new RegExp(`\\? ${name}\\.pager : null`), `${name} có thanh chuyển trang`);
  }
  const notices = read('components', 'portal', 'NoticeCenter.tsx');
  assert.match(notices, /const paged = usePaged\(items, category\);/);
  assert.match(notices, /\{paged\.shown\.map\(\(n\) => \(/);
  assert.match(notices, /\{items\.length \? paged\.pager : null\}/);
});
