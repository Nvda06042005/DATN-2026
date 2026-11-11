// Bảng Giáo viên và Học sinh của quản trị trường: mỗi cột có độ rộng ưu tiên, bảng hẹp thì cùng co (không cuộn ngang), mỗi ô một dòng nên hàng thẳng;
// học sinh không còn cột Đăng nhập cuối. Hàm cỡ chữ của mã chạy thật bằng cách biên dịch TypeScript; phần còn lại kiểm tra mã nguồn.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

function loadCodeFont() {
  const out = ts.transpileModule(read('lib', 'code-font.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(out, { module: mod, exports: mod.exports });
  return mod.exports;
}

/** Cột của bảng giáo viên và học sinh: khóa, độ rộng ưu tiên, hệ số nhận phần thừa, độ rộng tối thiểu, dòng mã nguồn */
function tables() {
  const src = read('components', 'admin', 'SchoolPeople.tsx');
  const start = src.indexOf('columns={teacher ? [');
  const split = src.indexOf('] : [', start);
  const end = src.indexOf(']} />', split);
  assert.ok(start > 0 && split > start && end > split, 'không tìm thấy hai danh sách cột');
  const num = (line, key) => Number((new RegExp(`\\b${key}: ([0-9.]+)`).exec(line) || [, 'NaN'])[1]);
  const parse = (block) => block.split('\n').filter((line) => /^\s*\{ key: '/.test(line)).map((line) => ({
    key: /key: '([^']+)'/.exec(line)[1], width: num(line, 'width'), grow: num(line, 'grow'), minWidth: num(line, 'minWidth'), line,
  }));
  return { src, teacher: parse(src.slice(start, split)), student: parse(src.slice(split, end)) };
}

test('mã giáo viên và mã học sinh cùng cỡ chữ 12 trong cột mã 140px; chỉ mã quá dài mới co (thấp nhất 10)', () => {
  const { codeFontSize, CODE_FONT_MAX, CODE_FONT_MIN } = loadCodeFont();
  assert.equal(CODE_FONT_MAX, 12);
  assert.equal(CODE_FONT_MIN, 10);
  assert.equal(codeFontSize(0, 18), 12, 'chưa đo');
  // cùng trường: mã giáo viên 16 ký tự (GOT2609102000002), mã học sinh 18 ký tự (HSGOT2612122008001) => cùng cỡ
  assert.equal(codeFontSize(140, 16), 12);
  assert.equal(codeFontSize(140, 18), 12);
  assert.equal(codeFontSize(300, 18), 12, 'ô rộng cũng không to hơn 12');
  assert.equal(codeFontSize(140, 20), 10, 'tên trường viết tắt dài: co để vẫn một dòng');
  assert.equal(codeFontSize(60, 18), 10);
  // mã 18 ký tự rộng 140px ở cỡ 13 (đo trên Chrome) tức khoảng 129px ở cỡ 12: vừa cột 140px
  assert.ok((140 / 13) * 12 <= 140);
});

test('học sinh bỏ cột Đăng nhập cuối; hai bảng cùng bảy cột đầu như file Excel', () => {
  const { src, teacher, student } = tables();
  const shared = ['stt', 'code', 'name', 'gender', 'phone', 'email', 'birth'];
  assert.deepEqual(teacher.map((c) => c.key), [...shared, 'classes', 'status']);
  assert.deepEqual(student.map((c) => c.key), [...shared, 'grade', 'classes', 'status']);
  assert.doesNotMatch(src, /Đăng nhập cuối|last_login_at|dateText/);
});

test('mỗi cột có độ rộng ưu tiên; bảy cột đầu của hai bảng giống hệt nhau; chỉ Họ tên, Email và Lớp nhận phần rộng thừa', () => {
  const { teacher, student } = tables();
  for (const col of [...teacher, ...student]) assert.ok(col.width > 0, `${col.key}: có độ rộng ưu tiên`);
  for (const key of ['stt', 'code', 'name', 'gender', 'phone', 'email', 'birth']) {
    const t = teacher.find((c) => c.key === key), s = student.find((c) => c.key === key);
    assert.deepEqual([t.width, t.grow, t.minWidth], [s.width, s.grow, s.minWidth], `${key}: hai bảng như nhau`);
  }
  const growing = (cols) => cols.filter((c) => c.grow > 0).map((c) => c.key);
  assert.deepEqual(growing(teacher), ['name', 'email', 'classes']);
  assert.deepEqual(growing(student), ['name', 'email', 'classes']);
  // tổng độ rộng ưu tiên vừa phần nội dung của trang quản trị (khoảng 1086px trừ lề và khoảng cách cột): co ít, không cuộn ngang
  const sum = (cols) => cols.reduce((n, c) => n + c.width, 0);
  assert.ok(sum(teacher) <= 1000 && sum(student) <= 1040, `${sum(teacher)} / ${sum(student)}`);
  // tên lớp kèm năm học (6A5 (2025-2026)) hiện đủ
  assert.ok(student.find((c) => c.key === 'classes').minWidth >= 116);
  // "Số thứ tự" và nhãn "Chưa đổi mật khẩu" không bị co tới mức xuống dòng hay mất chữ
  assert.ok(student.find((c) => c.key === 'stt').minWidth >= 58);
  assert.ok(student.find((c) => c.key === 'status').minWidth >= 140, 'đủ cho chấm màu và chữ Chưa đổi mật khẩu');
  // mã, số điện thoại và ngày sinh không co tới mức mất chữ (mã 18 ký tự ở cỡ 10 rộng khoảng 108px)
  for (const [key, min] of [['code', 140], ['phone', 84], ['birth', 76]]) for (const cols of [teacher, student]) assert.ok(cols.find((c) => c.key === key).minWidth >= min, key);
  // khoảng cách cột của hai bảng này nhỏ hơn mặc định để tên và email có thêm chỗ
  assert.match(tables().src, /<DataTable paginate=\{false\} gap=\{10\} rows=/);
});

test('mỗi ô một dòng (dài thì hiện …): tên kèm tên đăng nhập, số thẳng cột, trạng thái dạng chấm màu; mã tự co chữ', () => {
  const { src, teacher, student } = tables();
  assert.match(src, /const NUM = \{ fontVariant: \['tabular-nums' as const\] \};/);
  assert.match(src, /const Line: React\.FC<\{ text: string; muted\?: boolean; num\?: boolean \}>/);
  assert.match(src, /<Txt size=\{13\} numberOfLines=\{1\} color=\{muted \? c\.muc3 : undefined\} style=\{num \? NUM : undefined\}>\{text\}<\/Txt>/);
  assert.match(src, /<Txt f="semibold" size=\{14\} numberOfLines=\{1\}>\{name\}<\/Txt>\s*<Txt size=\{12\} color=\{c\.muc3\} numberOfLines=\{1\}>\{username\}<\/Txt>/);
  assert.match(src, /size=\{codeFontSize\(width, value\.length\)\} numberOfLines=\{1\} style=\{NUM\}>/);
  for (const cols of [teacher, student]) {
    assert.match(cols.find((c) => c.key === 'code').line, /<CodeText value=\{u\.user_code \|\| '—'\} \/>/);
    assert.match(cols.find((c) => c.key === 'name').line, /<NameCell name=\{u\.full_name\} username=\{u\.username\} \/>/);
    for (const key of ['stt', 'phone', 'birth']) assert.match(cols.find((c) => c.key === key).line, /<Line [^>]*\bnum \/>/, `${key}: số thẳng cột`);
    assert.match(cols.find((c) => c.key === 'status').line, /<StatusDot kind=/);
    assert.doesNotMatch(cols.map((c) => c.line).join('\n'), /numberOfLines=\{[2-9]\}|<Cell |StatusChip/);
  }
});

test('DataTable: cột có width co theo tỉ lệ và cột có grow nhận phần thừa; không còn chế độ cuộn ngang; hàng sáng nhẹ khi rê chuột', () => {
  const kit = read('components', 'admin', 'kit.tsx');
  assert.match(kit, /width\?: number;/);
  assert.match(kit, /grow\?: number;/);
  assert.match(kit, /const cellStyle = \(col: Column<T>\) => \(col\.width != null\s*\? \{ flexGrow: col\.grow \?\? 0, flexShrink: 1, flexBasis: col\.width, minWidth: col\.minWidth \?\? 0 \}\s*: \{ flex: col\.flex \?\? 1, minWidth: col\.minWidth \?\? 0 \}\);/);
  assert.equal([...kit.matchAll(/style=\{\[cellStyle\(col\), \{ flexDirection: 'row', alignItems: 'center', gap: 6 \}\]\}/g)].length, 1, 'tiêu đề');
  assert.equal([...kit.matchAll(/<View key=\{col\.key\} style=\{cellStyle\(col\)\}>\{col\.render\(row\)\}<\/View>/g)].length, 1, 'ô dữ liệu');
  assert.doesNotMatch(kit, /EQUAL_COLUMN_MIN|equal\?: boolean|ScrollView horizontal showsHorizontalScrollIndicator>/);
  assert.match(kit, /const hovered = Boolean\(onRowPress\) && Boolean\(\(state as \{ hovered\?: boolean \}\)\.hovered\);/);
  assert.match(kit, /export const StatusDot: React\.FC</);
});

test('nhãn trạng thái dạng thẻ (StatusChip) ở các bảng khác vẫn xuống dòng trong khung của ô thay vì tràn ra mép bảng', () => {
  const kit = read('components', 'admin', 'kit.tsx');
  assert.match(kit, /<Chip text=\{text\} bg=\{map\[kind\]\[0\]\} fg=\{map\[kind\]\[1\]\} wrap style=\{\{ alignSelf: 'flex-start', maxWidth: '100%' \}\} \/>/);
});
