// HK.HS.125 – thanh menu chính của học sinh: đọc thẳng mã nguồn `StudentNav.tsx` (tệp dùng thành phần React Native nên không nạp được trong Node)
// và kiểm tra các mục theo đặc tả đều có, không trùng, vào được trên cả máy tính lẫn điện thoại, thanh dưới điện thoại không quá dài.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'components', 'portal', 'StudentNav.tsx'), 'utf8');

/** Lấy các cặp id – nhãn trong một mảng khai báo kiểu `export const NAME: NavItem[] = [ { id: 'x', label: 'Y', ... }, ... ];` */
function items(name) {
  const start = source.indexOf(`${name}: NavItem[] = [`);
  assert.ok(start >= 0, `không thấy ${name}`);
  const body = source.slice(start, source.indexOf('\n];', start));
  return [...body.matchAll(/id: '([a-z]+)', label: '([^']+)'/g)].map((m) => ({ id: m[1], label: m[2] }));
}

const main = items('NAV_MAIN');
const more = items('NAV_MORE');
const all = [...main, ...more];
const phoneMain = [...source.slice(source.indexOf('PHONE_MAIN: Tab[] = ['), source.indexOf('];', source.indexOf('PHONE_MAIN: Tab[] = ['))).matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
const tabUnion = [...source.slice(source.indexOf('export type Tab ='), source.indexOf(';', source.indexOf('export type Tab ='))).matchAll(/'([a-z]+)'/g)].map((m) => m[1]);

test('đủ các mục đặc tả HS.125: Học, Chiến dịch, Bộ thẻ, Luyện tập, Bảng xếp hạng, Nhiệm vụ, Cửa hàng, Hồ sơ, mỗi mục đúng một lần', () => {
  const spec = { learn: 'Học', home: 'Chiến dịch', collection: 'Bộ thẻ', practice: 'Luyện tập', ranking: 'Bảng xếp hạng', quests: 'Nhiệm vụ', shop: 'Cửa hàng', mine: 'Hồ sơ' };
  for (const [id, label] of Object.entries(spec)) {
    const found = all.filter((i) => i.id === id);
    assert.equal(found.length, 1, `mục ${id} phải có đúng một lần`);
    assert.equal(found[0].label, label);
  }
});

test('mọi mục có mã khai báo trong kiểu Tab, mã và nhãn không trùng nhau', () => {
  assert.ok(all.length >= 8);
  assert.equal(new Set(all.map((i) => i.id)).size, all.length);
  assert.equal(new Set(all.map((i) => i.label)).size, all.length);
  for (const i of all) assert.ok(tabUnion.includes(i.id), `${i.id} chưa có trong kiểu Tab`);
});

test('thanh dưới điện thoại: tối đa 5 mục chính cộng ô "Xem thêm"; mọi mục còn lại vào được qua "Xem thêm" (không mục nào bị mất)', () => {
  assert.ok(phoneMain.length >= 1 && phoneMain.length <= 5);
  for (const id of phoneMain) assert.ok(main.some((i) => i.id === id), `${id} ở thanh dưới phải nằm trong NAV_MAIN`);
  assert.match(source, /tile\('more', 'Xem thêm'/);
  const reachableOnPhone = new Set([...phoneMain, ...main.filter((i) => !phoneMain.includes(i.id)).map((i) => i.id), ...more.map((i) => i.id)]);
  for (const i of all) assert.ok(reachableOnPhone.has(i.id), `${i.id} không vào được trên điện thoại`);
});

test('máy tính: thanh bên hiện các mục chính, rồi nhóm "Xem thêm" với các mục còn lại; chấm đỏ báo việc mới cho từng mục', () => {
  assert.match(source, /Menu chính/);
  assert.match(source, /\{main\.map\(row\)\}/);
  assert.match(source, /\{extra\.map\(row\)\}/);
  assert.match(source, /<Dot n=\{dots\[it\.id\]\} \/>/);
});
