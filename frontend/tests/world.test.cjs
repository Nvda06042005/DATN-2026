// 21/11/2026: thế giới khối vuông của bước Nhập vai (người dùng chọn 3D nhìn chéo, chỉ thay bước Nhập vai, làm trọn bản đồ phần 3 trước, bạn cùng lớp chơi chung).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const load = (file) => {
  const out = ts.transpileModule(read(...file.split('/')), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new vm.Script(`(function(module,exports,require){${out}\n})`).runInThisContext()(mod, mod.exports, () => ({}));
  return mod.exports;
};
const wm = load('lib/world-map.ts');

const map = {
  title: 'thử', w: 6, h: 5, spawn: [0, 0], note: '', labels: [],
  rows: ['..T...', '.~~,,.', '.~~,,.', 'r.....', '..B...'],
  npcs: [{ id: 'a', name: 'A', role: 'r', at: [5, 0], fictional: true, look: { robe: '#000000', hat: 'none', beard: false } }],
  stations: [{ id: 'ban', name: 'Bàn', at: [5, 4] }],
  zones: [{ id: 'baicoc', name: 'Bãi', rect: [3, 1, 2, 2], kind: 'build', accepts: ['coc'], on: ',', cap: 3, tide: 'low' }],
};
const terrain = {
  '.': { name: 'cỏ', walk: true, res: null }, ',': { name: 'bãi bồi', walk: true, res: null }, '~': { name: 'nước', walk: false, res: null },
  T: { name: 'cây', walk: false, res: 'go' }, B: { name: 'tre', walk: false, res: 'tre' }, r: { name: 'lúa', walk: true, res: 'lua' },
};

test('tìm đường tránh nước / cây / người / khối đã đặt; đứng cạnh mục tiêu trong tầm với', () => {
  const blocked = wm.blockedFn(map, terrain, [{ x: 3, z: 1, block: 'coc', zone: 'baicoc' }]);
  assert.equal(blocked(1, 1), true); // nước sâu
  assert.equal(blocked(2, 0), true); // cây
  assert.equal(blocked(5, 0), true); // người
  assert.equal(blocked(3, 1), true); // cọc đã đóng
  assert.equal(blocked(4, 1), false); // bãi bồi đi được
  const p = wm.findPath(map, blocked, [0, 0], [4, 2]);
  assert.ok(p && p.length >= 6, JSON.stringify(p));
  for (const [x, z] of p) assert.equal(blocked(x, z), false);
  assert.equal(wm.findPath(map, blocked, [0, 0], [1, 1]), null);
  const near = wm.standNear(map, blocked, [2, 0], [0, 4]); // tới cạnh cây
  assert.ok(near && wm.chebyshev(near.cell, [2, 0]) <= 1 && !blocked(...near.cell));
  assert.equal(wm.reachable([0, 0], [2, 2]), true);
  assert.equal(wm.reachable([0, 0], [3, 0]), false); // máy chủ chỉ nhận cách tối đa 2 ô
});

test('con nước tính đúng như máy chủ (chu kỳ 80 giây: 40 giây rút, 40 giây lên)', () => {
  assert.deepEqual(wm.tideAt(0), { state: 'low', leftMs: 40000, phase: 0 });
  assert.equal(wm.tideAt(39999).state, 'low');
  assert.equal(wm.tideAt(40000).state, 'high');
  assert.equal(wm.tideAt(80000).state, 'low');
  const server = read('..', 'backend', 'src', 'saga', 'world.ts');
  assert.match(server, /export const TIDE_PERIOD_MS = 80_000;/);
  assert.match(read('lib', 'world-map.ts'), /export const TIDE_PERIOD_MS = 80_000;/);
  assert.match(server, /return phase < half \? \{ state: 'low'/);
});

test('vùng xây dựng, tổng của cả lớp, thay đổi khối từ kênh thời gian thực, mũi tên chỉ mục tiêu', () => {
  assert.equal(wm.buildZoneAt(map, 3, 2, 'coc').id, 'baicoc');
  assert.equal(wm.buildZoneAt(map, 3, 2, 'rao'), null);
  assert.equal(wm.buildZoneAt(map, 0, 3, 'coc'), null);
  const blocks = [{ x: 3, z: 1, block: 'coc', zone: 'baicoc' }, { x: 4, z: 1, block: 'coc', zone: 'baicoc' }];
  assert.deepEqual(wm.zoneTotals(blocks), { baicoc: 2 });
  // vùng đầy: khối cũ nhất dời sang ô mới
  const next = wm.applyBlockChange(blocks, { placed: { x: 3, z: 2, block: 'coc', zone: 'baicoc', by: 7 }, removed: { x: 3, z: 1 } }, 7);
  assert.deepEqual(next.map((b) => [b.x, b.z, Boolean(b.mine)]), [[4, 1, false], [3, 2, true]]);
  assert.deepEqual(wm.markerCells('npc:a', map, terrain, [0, 0]), [[5, 0]]);
  assert.deepEqual(wm.markerCells('station:*', map, terrain, [0, 0]), [[5, 4]]);
  assert.deepEqual(wm.markerCells('res:lua', map, terrain, [5, 4]), [[0, 3]]);
  assert.deepEqual(wm.markerCells('res:lua', map, terrain, [5, 4], () => true), []); // ô vừa gặt chưa mọc lại
  assert.deepEqual(wm.markerCells('zone:baicoc', map, terrain, [0, 0]), [[4, 2]]);
});

test('three.js chỉ nạp động trong game/world3d.ts; cảnh Phaser 2D và intro không gọi three; bản điện thoại gốc không nạp three', () => {
  const view = read('components', 'portal', 'WorldViewport.web.tsx');
  assert.match(view, /import\('@\/game\/world3d'\)\.then\(\(\{ createWorld \}\) =>/);
  assert.match(view, /world\?\.destroy\(\);/);
  assert.doesNotMatch(read('components', 'portal', 'WorldViewport.tsx'), /from ['"]three['"]|@\/game\/world3d/);
  assert.doesNotMatch(read('game', 'index.ts'), /from ['"]three['"]|world3d/);
  const world = read('game', 'world3d.ts');
  assert.match(world, /import \* as THREE from 'three';/);
  for (const name of ['renderer.dispose()', 'cancelAnimationFrame(this.frame)', 'this.resize?.disconnect()']) assert.ok(world.includes(name), name);
  // chữ tiếng Việt là phần tử DOM, không vẽ vào canvas; không dùng tài nguyên / kết cấu bên ngoài
  assert.doesNotMatch(world, /fillText|TextureLoader|GLTFLoader|https?:\/\//);
  for (const dir of ['components', 'lib', 'app', 'hooks']) {
    const walk = (d) => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []));
    for (const f of walk(dir)) assert.doesNotMatch(read(f), /from ['"]@\/game\/world3d['"]/, f); // chỉ nạp động
  }
  for (const f of [['components', 'portal', 'WorldScreen.tsx'], ['components', 'portal', 'WorldViewport.web.tsx'], ['lib', 'world-map.ts'], ['lib', 'world-socket.ts']]) assert.doesNotMatch(read(...f), /from ['"]three['"]/, f.join('/'));
});

test('màn thế giới khối: lệnh đi qua phiên chơi của máy chủ; tín hiệu nhanh và lựa chọn nhân vật khớp danh sách máy chủ; không có ô chat tự do', () => {
  const screen = read('components', 'portal', 'WorldScreen.tsx');
  assert.match(screen, /saga\.act<WorldSession, \{ events: WorldEvent\[\] \}, ExploreFinished>/);
  assert.doesNotMatch(screen, /<Field |<TextInput|localStorage|awardXp|addGold/);
  for (const id of ['world-goal', 'world-tide', 'world-online', 'world-bag', 'world-team', 'world-craft', 'world-look-sheet', 'world-done', 'world-summary', 'world-fight']) assert.ok(screen.includes(`testID="${id}"`), id);
  assert.match(screen, /title="Mở trang sử"/);
  const sock = read('lib', 'world-socket.ts');
  const gateway = read('..', 'backend', 'src', 'saga', 'world.gateway.ts');
  const codes = [...sock.matchAll(/\{ code: '([a-z_]+)'/g)].map((m) => m[1]).sort();
  const server = gateway.match(/WORLD_SAY = \[([^\]]+)\]/)[1].match(/'([a-z_]+)'/g).map((s) => s.slice(1, -1)).sort();
  assert.deepEqual(codes, server);
  assert.match(sock, /io\(`\$\{API_BASE_URL\}\/world`, \{ path: '\/api\/live\/ws'/);
  const service = read('..', 'backend', 'src', 'saga', 'saga.service.ts');
  for (const field of ['robe', 'skin']) {
    const front = screen.match(new RegExp(`${field}: \\[([^\\]]+)\\]`))[1].match(/#[0-9a-f]{6}/g);
    const back = service.match(new RegExp(`${field}: \\[([^\\]]+)\\]`))[1].match(/#[0-9a-f]{6}/g);
    assert.deepEqual(front, back, field);
  }
  // bước Nhập vai: chặng có nhiệm vụ khối mở WorldScreen, chặng khác giữ cảnh 2D; vào phòng của lớp em đang học
  const play = read('components', 'portal', 'SagaPlay.tsx');
  assert.match(play, /saga\.startExplore\(session\.token, stageId, restart\.current, ctx\.current\.nav\.classId\)/);
  assert.match(play, /if \(isWorldSession\(v\)\) \{ setWorld\(v\);/);
  assert.match(play, /<GameViewport kind="explore"/);
  assert.match(read('components', 'portal', 'StudentApp.tsx'), /const classId = cls\?\.id \?\? entered;/);
});
