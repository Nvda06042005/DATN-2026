// Bảng Giáo viên và Học sinh của quản trị trường chia đều: mọi cột rộng bằng nhau, mã luôn một dòng (chữ tự co), màn hẹp thì cuộn ngang.
// Hàm tính cỡ chữ của mã chạy thật bằng cách biên dịch TypeScript; DataTable và hai bảng kiểm tra các mắt xích trong mã nguồn.
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

/** Các cột của bảng giáo viên và bảng học sinh trong SchoolPeople.tsx: tên khóa từng cột và dòng mã nguồn */
function tables() {
  const src = read('components', 'admin', 'SchoolPeople.tsx');
  const start = src.indexOf('columns={teacher ? [');
  const split = src.indexOf('] : [', start);
  const end = src.indexOf(']} />', split);
  assert.ok(start > 0 && split > start && end > split, 'không tìm thấy hai danh sách cột');
  const parse = (block) => block.split('\n').filter((line) => /^\s*\{ key: '/.test(line)).map((line) => ({ key: /key: '([^']+)'/.exec(line)[1], line }));
  return { src, teacher: parse(src.slice(start, split)), student: parse(src.slice(split, end)) };
}

test('cỡ chữ của mã co theo độ rộng ô: tối đa 13, tối thiểu 10, chưa đo được thì 13', () => {
  const { codeFontSize, CODE_FONT_MAX, CODE_FONT_MIN } = loadCodeFont();
  assert.equal(CODE_FONT_MAX, 13);
  assert.equal(CODE_FONT_MIN, 10);
  assert.equal(codeFontSize(0, 18), 13, 'chưa đo');
  assert.equal(codeFontSize(300, 18), 13, 'ô rộng: giữ cỡ tối đa');
  assert.equal(codeFontSize(130, 16), 12, 'mã giáo viên 16 ký tự trong ô 130px');
  assert.equal(codeFontSize(150, 20), 11, 'mã 20 ký tự trong ô 150px');
  assert.equal(codeFontSize(112, 18), 10, 'mã học sinh 18 ký tự trong cột hẹp nhất: cỡ nhỏ nhất');
  assert.equal(codeFontSize(60, 18), 10, 'không nhỏ hơn mức tối thiểu');
  assert.equal(codeFontSize(130, 0), 13);
  // mã thật ở cỡ 10 vẫn vừa cột hẹp nhất: 18 ký tự rộng 140px ở cỡ 13 (đo trên Chrome) tức khoảng 108px ở cỡ 10
  const kit = read('components', 'admin', 'kit.tsx');
  const min = Number(/export const EQUAL_COLUMN_MIN = (\d+);/.exec(kit)[1]);
  assert.ok((140 / 13) * 10 <= min, `cột hẹp nhất ${min}px chứa được mã 18 ký tự ở cỡ 10`);
});

test('DataTable chia đều: mọi cột cùng hệ số giãn, độ rộng cơ sở 0px và cùng độ rộng tối thiểu ở cả tiêu đề lẫn ô; hẹp thì cuộn ngang; bảng thường giữ nguyên', () => {
  const kit = read('components', 'admin', 'kit.tsx');
  assert.match(kit, /export const EQUAL_COLUMN_MIN = 112;/);
  assert.match(kit, /equal\?: boolean;/);
  assert.match(kit, /paginate = true, equal = false \}: \{/);
  // một công thức độ rộng cột dùng cho tiêu đề và ô: không thể lệch nhau
  assert.match(kit, /const cellStyle = \(col: Column<T>\) => \(equal \? \{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: EQUAL_COLUMN_MIN \} : \{ flex: col\.flex \?\? 1, minWidth: col\.minWidth \?\? 0 \}\);/);
  assert.equal([...kit.matchAll(/style=\{\[cellStyle\(col\), \{ flexDirection: 'row', alignItems: 'center', gap: 6 \}\]\}/g)].length, 1, 'tiêu đề');
  assert.equal([...kit.matchAll(/<View key=\{col\.key\} style=\{cellStyle\(col\)\}>\{col\.render\(row\)\}<\/View>/g)].length, 1, 'ô dữ liệu');
  // chỉ bảng chia đều có khung cuộn ngang, rộng ít nhất bằng tổng mức tối thiểu của các cột
  assert.match(kit, /const equalMin = columns\.length \* EQUAL_COLUMN_MIN \+ \(columns\.length - 1\) \* gap \+ 2 \* pad/);
  assert.match(kit, /\{equal \? \(\s*<ScrollView horizontal showsHorizontalScrollIndicator>\s*<View style=\{\{ width: Math\.max\(boxWidth - 2, equalMin\) \}\}>\{grid\}<\/View>\s*<\/ScrollView>\s*\) : grid\}/);
  // chiều rộng bảng là số cố định lấy từ khung chứa (onLayout), không để chữ trong ô làm bảng phình
  assert.match(kit, /const \[boxWidth, setBoxWidth\] = useState\(0\);/);
  assert.match(kit, /onLayout=\{equal \? \(e\) => setBoxWidth\(Math\.round\(e\.nativeEvent\.layout\.width\)\) : undefined\}/);
  // bảng thường vẫn lề 14 và khoảng cách 12 như trước
  assert.match(kit, /const pad = equal \? EQUAL_PAD : 14;/);
  assert.match(kit, /const gap = equal \? EQUAL_GAP : 12;/);
});

test('bảng Giáo viên và Học sinh dùng chế độ chia đều, mã dùng chữ tự co, không còn đặt độ rộng riêng từng cột', () => {
  const { src, teacher, student } = tables();
  assert.match(src, /<DataTable paginate=\{false\} equal rows=/);
  assert.deepEqual(teacher.map((c) => c.key), ['stt', 'code', 'name', 'gender', 'phone', 'email', 'birth', 'classes', 'status']);
  assert.deepEqual(student.map((c) => c.key), ['stt', 'code', 'name', 'gender', 'phone', 'email', 'birth', 'grade', 'classes', 'last', 'status']);
  for (const col of [...teacher, ...student]) {
    assert.doesNotMatch(col.line, /\bflex:|minWidth:/, `${col.key}: độ rộng do chế độ chia đều quyết định`);
  }
  for (const [name, cols] of [['giáo viên', teacher], ['học sinh', student]]) {
    assert.match(cols.find((c) => c.key === 'code').line, /<CodeText value=\{u\.user_code \|\| '—'\} \/>/, `bảng ${name}: mã dùng CodeText`);
    assert.match(cols.find((c) => c.key === 'email').line, /numberOfLines=\{3\}/, `bảng ${name}: email dài còn tới ba dòng trong cột hẹp`);
  }
  assert.match(src, /import \{ codeFontSize \} from '@\/lib\/code-font';/);
  assert.match(src, /size=\{codeFontSize\(width, value\.length\)\} numberOfLines=\{1\}/);
  assert.match(src, /onLayout=\{\(e\) => setWidth\(e\.nativeEvent\.layout\.width\)\}/);
});

test('nhãn trạng thái dài ("Chưa đổi mật khẩu") xuống dòng trong khung của ô bảng, không tràn ra mép bảng', () => {
  const kit = read('components', 'admin', 'kit.tsx');
  assert.match(kit, /<Chip text=\{text\} bg=\{map\[kind\]\[0\]\} fg=\{map\[kind\]\[1\]\} wrap style=\{\{ alignSelf: 'flex-start', maxWidth: '100%' \}\} \/>/);
  const ui = read('components', 'ui.tsx');
  assert.match(ui, /wrap\?: boolean \}> = \(\{ text, bg, fg, icon: Icon, style, wrap = false \}\)/);
  assert.match(ui, /numberOfLines=\{wrap \? undefined : 1\} style=\{wrap \? \{ flexShrink: 1 \} : undefined\}/);
});
