const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const THREE = require('three');
const gameRoot = path.join(__dirname, '../game');

// This is an engine unit test, not a simulated browser: real Three geometry,
// raycasting and bridge messages, with only the GPU/DOM lifecycle replaced.
function environment() {
  let now = 0, frame = null;
  const elements = new Set();
  class Element {
    constructor() { this.style = {}; this.handlers = new Map(); this.parent = null; elements.add(this); }
    addEventListener(type, fn) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type).add(fn); }
    removeEventListener(type, fn) { this.handlers.get(type)?.delete(fn); }
    fire(type, data = {}) { for (const fn of this.handlers.get(type) ?? []) fn({ preventDefault() {}, ...data }); }
    setAttribute() {} focus() {} setPointerCapture() {} hasPointerCapture() { return false; }
    getBoundingClientRect() { return { left: 77, top: 133, width: 960, height: 540 }; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); }
    getContext() { return { fillRect() {}, createRadialGradient() { return { addColorStop() {} }; }, beginPath() {}, moveTo() {}, lineTo() {}, bezierCurveTo() {}, stroke() {} }; }
  }
  const document = new Element(); document.createElement = () => new Element(); document.activeElement = null; document.hidden = false;
  const window = new Element(); window.devicePixelRatio = 1;
  class Renderer {
    constructor() { this.domElement = new Element(); this.shadowMap = {}; this.disposed = false; }
    setPixelRatio() {} setSize() {}
    render(scene, camera) { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); }
    dispose() { this.disposed = true; } forceContextLoss() {}
  }
  const modules = new Map();
  function load(name) {
    if (modules.has(name)) return modules.get(name);
    const exports = {}; modules.set(name, exports);
    const source = fs.readFileSync(path.join(gameRoot, `${name}.ts`), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
    vm.runInNewContext(code, { exports, document, window, performance: { now: () => now }, requestAnimationFrame(fn) { frame = fn; return 1; }, cancelAnimationFrame() { frame = null; }, require: id => id === 'three' ? { ...THREE, WebGLRenderer: Renderer } : load(id.replace('./', '')) });
    return exports;
  }
  const parent = { children: [], clientWidth: 960, clientHeight: 540, appendChild(element) { this.children.push(element); element.parent = this; } };
  const { GameBridge } = load('bridge'), bridge = new GameBridge();
  const { HistoricalGame } = load('historical-game');
  return { bridge, document, parent, load, make: kind => new HistoricalGame(parent, kind, bridge), tick(ms = 50) { now += ms; const fn = frame; if (fn) fn(now); }, listenerCount: () => [...elements].reduce((sum, e) => sum + [...e.handlers.values()].reduce((n, list) => n + list.size, 0), 0) };
}
function exploreView() {
  return { scene: 'camp', title: 'Trại quân', grid: Array.from({ length: 13 }, (_, y) => y === 0 || y === 12 ? '#'.repeat(22) : '#' + '.'.repeat(20) + '#'), spawn: [3, 5], npcs: [{ id: 'officer', name: 'Hiệu úy', sprite: 'general', at: [5, 5] }], items: [{ id: 'food', name: 'Quân lương', sprite: 'sacks', at: [7, 5] }], zones: [{ id: 'gate', rect: [2, 4, 2, 3], kind: 'goal' }], progress: { step: 0, total: 3, done: false, inventory: [] }, current: { marker: 'npc:officer' } };
}
function unit(id, side) { return { id, side, cls: 'bo', sprite: side === 'ally' ? 'bo' : 'e_bo', row: 'front', hp: 16, max_hp: 16, alive: true, guard: false, burn: 0, fx: [], ranged: false }; }
function tacticsView() { return { mode: 'tactics', units: [unit('a', 'ally'), unit('b', 'enemy')], actor: { id: 'a' }, status: 'active' }; }
function riverView() { return { mode: 'bachdang', phase: 'prepare', status: 'active', grid: { w: 12, h: 5, cells: Array(5).fill('w'.repeat(12)), revealed: false }, tide: { level: 2 }, stakes: [[4, 2]], trail: [], units: [{ id: 'boat', name: 'Thuyền', side: 'ally', x: 2, y: 2, role: 'bait', hp: 8, max_hp: 8, state: 'free', sprite: 'thuyen' }], options: { stakeable: [[5, 2]], removable: [[4, 2]] } }; }
function pointerAt(engine, position) { const p = position.clone().project(engine.camera); return { clientX: 77 + (p.x + 1) * 480, clientY: 133 + (1 - p.y) * 270, button: 0, pointerId: 1 }; }

test('3D navigation preserves every authoritative cell and routes around water and occupied NPCs', () => {
  const e = environment(), logic = e.load('historical-logic');
  for (let y = 0; y < 13; y++) for (let x = 0; x < 22; x++) { const at = logic.worldCell([x, y], 22, 13, 2.4); assert.deepEqual(Array.from(logic.gridCell(...at, 22, 13, 2.4)), [x, y]); }
  const blocked = logic.walkGrid(['#######', '#..~..#', '#..~..#', '#.....#', '#######'], [[5, 1]]);
  const route = logic.routeTo(blocked, [1, 1], [5, 1], true);
  assert.ok(route.length > 0); assert.ok(route.every(([x, y]) => !blocked[y][x])); assert.ok(route.some(([, y]) => y === 3));
  const last = route[route.length - 1]; assert.equal(Math.max(Math.abs(last[0] - 5), Math.abs(last[1] - 1)), 1);
  assert.equal(logic.routeTo(blocked, [1, 1], [3, 1]).length, 0);
});

test('exploration requires adjacency, respects dialog lock, re-emits a zone on the next objective and cleans all listeners', () => {
  const e = environment(), v = exploreView(); e.bridge.set('explore:view', v);
  const messages = []; for (const type of ['explore:interact', 'explore:zone']) e.bridge.on(type, data => messages.push([type, data]));
  const game = e.make('explore'); e.tick(); e.bridge.emit('explore:press');
  assert.equal(messages.filter(x => x[0] === 'explore:interact').length, 0);
  game.player.position.copy(game.point([4, 5])); e.bridge.emit('explore:press');
  assert.equal(messages.at(-1)[1].target, 'npc:officer');
  e.bridge.set('explore:lock', true); const count = messages.length; e.bridge.emit('explore:press'); assert.equal(messages.length, count);
  e.bridge.set('explore:lock', false); game.player.position.copy(game.point([3, 5])); game.scan();
  const zones = () => messages.filter(x => x[0] === 'explore:zone').length;
  const before = zones(); game.scan(); assert.equal(zones(), before);
  e.bridge.set('explore:view', { ...v, progress: { ...v.progress, step: 1 } }); game.scan(); assert.equal(zones(), before + 1);
  e.bridge.set('explore:view', { ...v, items: [] }); assert.equal(game.items.size, 0); assert.equal(game.blocked[5][7], false);
  e.document.activeElement = { closest: () => true }; e.bridge.emit('explore:press'); assert.equal(messages.filter(x => x[0] === 'explore:interact').length, 1);
  game.destroy(); assert.equal(e.parent.children.length, 0); assert.equal(e.listenerCount(), 0); assert.equal(game.renderer.disposed, true);
});

test('tactics raycasting uses the current scrolled canvas bounds, picks only server targets and finishes with server HP', async () => {
  const e = environment(), v = tacticsView(); e.bridge.set('tactics:view', v); e.bridge.set('game:calm', true);
  const game = e.make('tactics'); e.tick(); const picked = []; e.bridge.on('tactics:pick', id => picked.push(id));
  e.bridge.emit('tactics:targets', ['b']);
  const at = game.pieces.get('b').object.position.clone().add(new THREE.Vector3(0, 1.1, 0)), event = pointerAt(game, at);
  game.renderer.domElement.fire('pointerdown', event); game.renderer.domElement.fire('pointerup', event); assert.deepEqual(picked, ['b']);
  let played = 0; e.bridge.on('tactics:played', () => played++);
  const final = { ...v, units: [v.units[0], { ...v.units[1], hp: 9 }] };
  await game.playTactics([{ t: 'attack', unit: 'a', target: 'b', dmg: 7, hp: 9 }], final);
  assert.equal(played, 1); assert.equal(game.pieces.get('b').unit.hp, 9); assert.equal(game.pieces.get('b').bar.scale.x, 9 / 16); assert.equal(game.playing, false);
  game.destroy();
});

test('river grid selection, tide and movement events use server cells and never lose the final state', async () => {
  const e = environment(), v = riverView(); e.bridge.set('bd:view', v); e.bridge.set('game:calm', true); e.bridge.set('bd:mode', { kind: 'stake' });
  const game = e.make('bachdang'); e.tick(); const cells = []; e.bridge.on('bd:cell', data => cells.push(data));
  const event = pointerAt(game, game.point([5, 2], true)); game.renderer.domElement.fire('pointerdown', event); game.renderer.domElement.fire('pointerup', event);
  assert.equal(cells[0].x, 5); assert.equal(cells[0].y, 2); assert.equal(cells[0].unit, null);
  let played = 0; e.bridge.on('bd:played', () => played++);
  const final = { ...v, tide: { level: 0 }, units: [{ ...v.units[0], x: 4 }] };
  await game.playRiver([{ t: 'move', unit: 'boat', path: [[3, 2], [4, 2]] }, { t: 'tide', level: 0 }], final);
  assert.equal(played, 1); assert.equal(game.pieces.get('boat').object.position.x, game.point([4, 2], true).x); assert.equal(game.river.tide.level, 0);
  game.destroy(); assert.equal(e.listenerCount(), 0);
});

test('leaving during playback cancels GPU work and never commits a stale animation', async () => {
  const e = environment(); const v = tacticsView(); e.bridge.set('tactics:view', v); const game = e.make('tactics');
  let played = 0; e.bridge.on('tactics:played', () => played++);
  const pending = game.playTactics([{ t: 'attack', unit: 'a', target: 'b', hp: 9, dmg: 7 }], v);
  game.destroy(); await pending; assert.equal(played, 0); assert.equal(e.parent.children.length, 0); assert.equal(e.listenerCount(), 0); assert.equal(game.tweens.size, 0);
});

test('palace tiles form one building and vertical fences follow the occupied boundary', () => {
  const e = environment(), { createLandscape } = e.load('historical-landscape'), scene = new THREE.Scene(), placed = [];
  const landscape = createLandscape(scene, 'explore', { width: 22 * 2.4, depth: 13 * 2.4, grid: ['w'.repeat(22), 'w'.repeat(9) + '____' + 'w'.repeat(9), ...Array(10).fill('#' + '.'.repeat(20) + '#'), '#'.repeat(22)], prop(kind) { const object = new THREE.Group(); placed.push({ kind, object }); return object; } });
  assert.equal(placed.filter(p => p.kind === 'hall').length, 1);
  assert.ok(placed.some(p => p.kind === 'fence' && p.object.rotation.y === Math.PI / 2));
  landscape.dispose(); assert.equal(scene.children.length, 0);
});

test('mixed battles put ships in the river and infantry on shore, with finite shared model geometry', () => {
  const e = environment(), v = tacticsView(); v.units.push({ ...unit('ship', 'ally'), cls: 'thuyen', sprite: 'thuyen' }); e.bridge.set('tactics:view', v);
  const game = e.make('tactics');
  assert.ok(game.pieces.get('ship').home.z >= 6); assert.ok(game.pieces.get('a').home.z < 2); assert.ok(game.landscape.water.length > 0);
  const kinds = ['scroll', 'token', 'horn', 'banner', 'logs', 'stakes'];
  for (const kind of kinds) { const object = game.models.prop(kind); const bounds = new THREE.Box3().setFromObject(object); assert.equal(bounds.isEmpty(), false, kind); assert.ok(bounds.min.toArray().concat(bounds.max.toArray()).every(Number.isFinite), kind); }
  game.destroy();
});

test('clicking a sail selects its boat even at an oblique camera angle', () => {
  const e = environment(), v = riverView(); v.units[0].role = 'fleet'; v.units[0].flagship = true; e.bridge.set('bd:view', v);
  const game = e.make('bachdang'); game.pitch = 0.65; game.cameraPose(); e.tick(); const selected = []; e.bridge.on('bd:cell', data => selected.push(data));
  const boat = game.pieces.get('boat').object;
  const sail = boat.children[0].children.find(m => m.material?.color?.getHexString() === 'c8bba0');
  assert.ok(sail, 'large boat has a linen sail');
  const positions = sail.geometry.getAttribute('position'); let at = new THREE.Vector3(), area = -1;
  for (let i = 0; i < positions.count; i += 3) { const a = new THREE.Vector3().fromBufferAttribute(positions, i), b = new THREE.Vector3().fromBufferAttribute(positions, i + 1), c = new THREE.Vector3().fromBufferAttribute(positions, i + 2), center = a.clone().add(b).add(c).divideScalar(3), size = b.clone().sub(a).cross(c.clone().sub(a)).length(); if (center.y > 1.5 && size > area) { area = size; at = center; } }
  assert.ok(area > 0); sail.localToWorld(at);
  const event = pointerAt(game, at); game.renderer.domElement.fire('pointerdown', event); game.renderer.domElement.fire('pointerup', event);
  assert.equal(selected[0]?.unit, 'boat'); assert.equal(selected[0]?.x, 2); assert.equal(selected[0]?.y, 2); game.destroy();
});
