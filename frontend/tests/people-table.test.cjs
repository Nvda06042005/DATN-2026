// Bảng Giáo viên và Học sinh của quản trị trường: mã luôn nằm trên một dòng, hai bảng dùng cùng độ rộng cột để thẳng hàng khi chuyển qua lại.
// Đọc định nghĩa cột trong mã nguồn (SchoolPeople.tsx) và cách DataTable (kit.tsx) áp dụng độ rộng tối thiểu.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

/** Các cột của một bảng: tên khóa, tỉ lệ flex (mặc định 1), độ rộng tối thiểu (mặc định 0), và dòng mã nguồn của cột */
function parseColumns(block) {
  return block.split('\n').filter((line) => /^\s*\{ key: '/.test(line)).map((line) => ({
    key: /key: '([^']+)'/.exec(line)[1],
    flex: Number((/flex: ([0-9.]+)/.exec(line) || [, '1'])[1]),
    minWidth: Number((/minWidth: ([0-9A-Z_]+)/.exec(line) || [, '0'])[1]) || (/minWidth: CODE_MIN_WIDTH/.test(line) ? 'CODE' : 0),
    line,
  }));
}

function tables() {
  const src = read('components', 'admin', 'SchoolPeople.tsx');
  const start = src.indexOf('columns={teacher ? [');
  const split = src.indexOf('] : [', start);
  const end = src.indexOf(']} />', split);
  assert.ok(start > 0 && split > start && end > split, 'không tìm thấy hai danh sách cột');
  return { src, teacher: parseColumns(src.slice(start, split)), student: parseColumns(src.slice(split, end)) };
}

test('mã giáo viên và mã học sinh: cột mã có độ rộng tối thiểu chung và chữ không xuống dòng', () => {
  const { src, teacher, student } = tables();
  assert.match(src, /export const CODE_MIN_WIDTH = \d+;/);
  assert.ok(Number(/CODE_MIN_WIDTH = (\d+)/.exec(src)[1]) >= 160, 'đủ cho mã 20 ký tự cỡ chữ 13');
  for (const [name, cols] of [['giáo viên', teacher], ['học sinh', student]]) {
    const code = cols.find((c) => c.key === 'code');
    assert.ok(code, `bảng ${name} có cột mã`);
    assert.equal(code.minWidth, 'CODE', `bảng ${name}: cột mã dùng CODE_MIN_WIDTH`);
    assert.match(code.line, /<Txt f="semibold" size=\{13\} numberOfLines=\{1\}>\{u\.user_code \|\| '—'\}<\/Txt>/, `bảng ${name}: mã chỉ một dòng`);
  }
});

test('hai bảng dùng cùng tỉ lệ và độ rộng tối thiểu cho các cột chung, và cùng tổng tỉ lệ để thẳng hàng', () => {
  const { teacher, student } = tables();
  const shared = ['stt', 'code', 'name', 'gender', 'phone', 'email', 'birth'];
  assert.deepEqual(teacher.slice(0, 7).map((c) => c.key), shared);
  assert.deepEqual(student.slice(0, 7).map((c) => c.key), shared);
  for (const key of shared) {
    const t = teacher.find((c) => c.key === key), s = student.find((c) => c.key === key);
    assert.equal(t.flex, s.flex, `${key}: cùng flex`);
    assert.equal(t.minWidth, s.minWidth, `${key}: cùng độ rộng tối thiểu`);
  }
  const sum = (cols) => Math.round(cols.reduce((n, c) => n + c.flex, 0) * 100) / 100;
  assert.equal(sum(teacher), sum(student), 'tổng tỉ lệ bằng nhau');
  assert.equal(sum(teacher), 13.8);
  // số điện thoại 10 chữ số, ngày sinh dd/mm/yyyy và tiêu đề "Số thứ tự" có chỗ đủ để không bị bẻ giữa chừng
  for (const [key, min] of [['stt', 62], ['gender', 58], ['phone', 88], ['birth', 82]]) assert.ok(teacher.find((c) => c.key === key).minWidth >= min, key);
});

test('nhãn trạng thái dài ("Chưa đổi mật khẩu") xuống dòng trong khung của ô bảng, không tràn ra mép bảng', () => {
  const kit = read('components', 'admin', 'kit.tsx');
  assert.match(kit, /<Chip text=\{text\} bg=\{map\[kind\]\[0\]\} fg=\{map\[kind\]\[1\]\} wrap style=\{\{ alignSelf: 'flex-start', maxWidth: '100%' \}\} \/>/);
  const ui = read('components', 'ui.tsx');
  assert.match(ui, /wrap\?: boolean \}> = \(\{ text, bg, fg, icon: Icon, style, wrap = false \}\)/);
  assert.match(ui, /numberOfLines=\{wrap \? undefined : 1\} style=\{wrap \? \{ flexShrink: 1 \} : undefined\}/);
  // các nơi khác dùng Chip không đổi hành vi: một dòng như trước
  assert.match(ui, /wrap = false/);
  const { student } = tables();
  const status = student.find((c) => c.key === 'status');
  assert.ok(status.minWidth >= 88, 'cột trạng thái của bảng học sinh có chỗ tối thiểu');
});

test('DataTable áp dụng minWidth của cột cho cả tiêu đề và ô, mặc định 0 như trước', () => {
  const kit = read('components', 'admin', 'kit.tsx');
  assert.match(kit, /\/\*\* Độ rộng tối thiểu \(px\)[^\n]*\*\/\s*minWidth\?: number;/);
  assert.equal([...kit.matchAll(/flex: col\.flex \?\? 1, minWidth: col\.minWidth \?\? 0/g)].length, 2, 'tiêu đề và ô dữ liệu');
  assert.doesNotMatch(kit, /flex: col\.flex \?\? 1, minWidth: 0[,\s}]/, 'không còn chỗ nào ép minWidth: 0');
});
