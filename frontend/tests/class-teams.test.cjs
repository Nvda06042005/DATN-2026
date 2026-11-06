// HK.GV.016 – chia đội thủ công: đặt tên và chọn biểu tượng cho đội, kéo thả học sinh vào đội (web), vẫn có ô chọn đội cho cảm ứng và bàn phím.
// Các thành phần dùng React Native nên không nạp được trong Node: đọc thẳng mã nguồn và kiểm tra các mắt xích nối nhau.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (...p) => fs.readFileSync(path.join(__dirname, '..', ...p), 'utf8');
const people = read('components', 'admin', 'ClassPeople.tsx');
const kit = read('components', 'portal', 'GameKit.tsx');
const listOf = (src, marker) => {
  const at = src.indexOf(marker);
  assert.ok(at >= 0, `không thấy ${marker}`);
  return [...src.slice(at, src.indexOf(']', at)).matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
};
const icons = listOf(people, 'export const TEAM_ICONS = [');

test('danh sách biểu tượng đội khớp máy chủ và mọi biểu tượng đều có hình trong bộ biểu tượng chung', () => {
  assert.equal(icons.length, 12);
  assert.equal(new Set(icons).size, icons.length);
  const serverFile = path.join(__dirname, '..', '..', 'backend', 'src', 'classroom', 'classroom.service.ts');
  if (fs.existsSync(serverFile)) assert.deepEqual(icons, listOf(fs.readFileSync(serverFile, 'utf8'), 'export const TEAM_ICONS = ['));
  const map = kit.slice(kit.indexOf('export const GAME_ICON'), kit.indexOf('export const iconOf'));
  for (const name of icons) assert.match(map, new RegExp(`\\b${name}:`), `${name} chưa có trong GAME_ICON`);
});

test('trình chia đội gửi biểu tượng đã chọn lên máy chủ và đội mới có biểu tượng mặc định khác nhau', () => {
  assert.match(people, /\.map\(\(d\) => \(\{ name: d\.name, icon: d\.icon, member_ids: d\.ids \}\)\)/);
  assert.match(people, /icon: defaultIcon\(ds\.length\)/);
  assert.match(people, /testID=\{`team-icon-\$\{i\}-\$\{name\}`\}/);
  assert.match(people, /accessibilityState=\{\{ selected: on \}\}/);
});

test('kéo thả (web): ô học sinh kéo được; mỗi đội và ô "Chưa có đội" nhận học sinh thả vào; ô chọn đội cho từng học sinh vẫn còn', () => {
  assert.match(people, /draggable: true, 'data-testid': `team-drag-\$\{id\}`/);
  assert.match(people, /e\.dataTransfer\.setData\('text\/plain', String\(id\)\)/);
  assert.match(people, /<DropTeam key=\{i\} testID=\{`team-drop-\$\{i\}`\} onDrop=\{\(id\) => assign\(id, i\)\}>/);
  assert.match(people, /<DropTeam testID="team-drop-free" onDrop=\{\(id\) => assign\(id, -1\)\}>/);
  assert.match(people, /if \(Platform\.OS !== 'web'\) return <>\{children\}<\/>/);
  assert.match(people, /<AdminSelect label="" value=\{String\(teamOf\(s\.id\)\)\}/);
});

test('thẻ đội ở tab Đội hiện biểu tượng của đội', () => {
  assert.match(people, /React\.createElement\(iconOf\(t\.icon\)/);
});
