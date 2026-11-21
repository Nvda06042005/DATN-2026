/** Original 2D illustrations for local play maps, not geographic reconstructions. */
import type PhaserNS from 'phaser';
import type { Look } from './pixel';

type Ctx = CanvasRenderingContext2D;
type Painter = (c: Ctx) => void;
export const ART_SCALE = 4;
export const mapUnitTop = (): number => 1;
const palette = { ink: '#423d2d', grass: '#78845b', earth: '#b2a076', water: '#668e98', red: '#963e32', blue: '#4f6470', gold: '#d1b66c' };
const random = (seed: number): (() => number) => { let n = seed; return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; }; };
const path = (c: Ctx, d: number[][], fill: string, stroke = palette.ink, width = 0.35): void => {
  c.beginPath(); d.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
};
const ellipse = (c: Ctx, x: number, y: number, rx: number, ry: number, fill: string, stroke = ''): void => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = 0.3; c.stroke(); } };
const line = (c: Ctx, points: number[][], color: string, width = 0.5): void => { c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.strokeStyle = color; c.lineWidth = width; c.stroke(); };
function texture(scene: PhaserNS.Scene, key: string, width: number, height: number, paint: Painter, scale = ART_SCALE): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, width * scale, height * scale)!;
  const c = tex.getContext(); c.scale(scale, scale); c.lineCap = 'round'; c.lineJoin = 'round'; paint(c); tex.refresh();
}

function person(c: Ctx, x: number, foot: number, size: number, look: Look, dir: 'down' | 'up' | 'side' = 'side', step = 0, armed = true): void {
  c.save(); c.translate(x, foot); c.scale(size, size);
  const dark = '#343b32', robe = look.robe, skin = '#c8a17b', gold = '#bba16a';
  ellipse(c, 0, 0.1, 4.4, 1.2, '#27342b30');
  for (const side of [-1, 1]) {
    const bend = step * side;
    line(c, [[side * 1.2, -9], [side * 1.3 + bend, -4.5], [side * 1.6 - bend, -0.4]], dark, 1.5);
    line(c, [[side * 1.6 - bend, -0.4], [side * 1.6 - bend + (dir === 'side' ? 1.3 : 0.7), -0.2]], '#302e26', 1.4);
  }
  path(c, [[-2.5, -16.8], [2.5, -16.8], [3.1, -9.1], [0, -7.8], [-3.2, -9.1]], robe);
  c.fillStyle = '#9f917b'; c.fillRect(-2, -16.4, 4, 6.5);
  for (let y = -16; y < -10; y += 1.3) line(c, [[-1.9, y], [2, y]], '#3d4842', 0.35);
  line(c, [[0, -16.3], [0, -10]], '#d4bd8b', 0.4);
  line(c, [[-2.9, -9.5], [2.9, -9.5]], '#43372a', 1.1);
  for (const side of [-1, 1]) { line(c, [[side * 2.6, -16], [side * 3.7, -12.6], [side * 3.5 + step * 0.3, -10.3]], robe, 1.6); ellipse(c, side * 3.5 + step * 0.3, -10, 0.65, 0.9, skin); }
  line(c, [[0, -18], [0, -16.8]], skin, 1.5);
  ellipse(c, 0, -20, 1.8, 2.2, dir === 'up' ? '#3e352b' : skin, '#5b4735');
  if (dir !== 'up') { ellipse(c, dir === 'side' ? 0.8 : -0.55, -20.2, 0.2, 0.22, '#302d25'); if (dir === 'down') ellipse(c, 0.65, -20.2, 0.2, 0.22, '#302d25'); }
  if (look.beard) path(c, [[-1.1, -18.8], [1.2, -18.8], [0.3, -17]], look.beard, '', 0);
  if (['non', 'fur', 'helmet', 'crown'].includes(look.hat)) {
    const hat = look.hat === 'fur' ? '#665541' : look.hat === 'non' ? '#b7aa7d' : gold;
    path(c, [[-2.6, -21.3], [-1.7, -23], [0, -24.3], [1.7, -23], [2.6, -21.3]], hat);
    line(c, [[-2.4, -21.1], [2.4, -21.1]], '#514c3b', 0.5);
    if (look.hat === 'helmet' || look.hat === 'crown') line(c, [[0, -24], [0.4, -26]], palette.red, 1);
  } else { path(c, [[-1.8, -20.9], [-1.5, -22.4], [1.3, -22.5], [1.9, -21.1]], '#3e342a'); line(c, [[-1.9, -21.6], [1.9, -21.6]], gold, 0.6); }
  if (armed) { line(c, [[4.4, -1], [4.4, -25]], '#65553a', 0.65); path(c, [[3.7, -25], [4.4, -28], [5.1, -25]], '#c2c4b0'); ellipse(c, -3.7, -11.8, 2.1, 3.2, '#8b7050', '#453f31'); ellipse(c, -3.7, -11.8, 0.8, 1.3, gold); }
  c.restore();
}
function horse(c: Ctx, x: number, foot: number, size: number, look: Look): void {
  c.save(); c.translate(x, foot); c.scale(size, size);
  ellipse(c, 0, 0.2, 12.2, 1.7, '#30382c30');
  for (const [lx, bend] of [[-7, 1], [-4, -1], [5, -1], [8, 1]]) line(c, [[lx, -6], [lx + bend, -2.8], [lx + bend * 2, 0]], '#51452f', 1.4);
  ellipse(c, -0.4, -8.5, 9.8, 4.5, '#796446', '#423c2e');
  path(c, [[5.2, -8.7], [6, -16.5], [8.8, -19.1], [11.9, -17.7], [13.4, -13.7], [10.6, -12], [8.3, -7]], '#796446');
  path(c, [[6.3, -17.8], [6, -11.3], [4.5, -9.5], [5.3, -16]], '#3d382c');
  line(c, [[-9, -9], [-12, -7], [-12.8, -3]], '#443b29', 1.5);
  line(c, [[11.8, -15], [2, -11.5]], '#bdac7a', 0.4);
  path(c, [[-5.3, -11], [3.3, -11], [4.2, -5], [-5.5, -5]], look.robe);
  person(c, -1, -9, 0.53, look, 'side', 0, true);
  ellipse(c, 10.4, -16.2, 0.35, 0.35, '#272c24');
  c.restore();
}
function ship(c: Ctx, enemy: boolean, supply = false): void {
  const cloth = enemy ? '#b6aa86' : '#a54e3b';
  ellipse(c, 16, 27.5, 15, 2, '#304c5438');
  path(c, [[1, 21], [4, 24], [28, 24], [31, 20], [28, 27], [6, 28], [3, 25]], '#77563b');
  path(c, [[3, 21], [7, 19], [25, 19], [30, 20.5], [27, 23], [7, 24]], '#ae8b59');
  for (let y = 24; y < 27; y++) line(c, [[6, y], [27, y]], '#453b2b', 0.3);
  for (let x = 5; x < 28; x += 3.5) line(c, [[x, 22], [x + 2, 29]], '#ae9571', 0.7);
  line(c, [[15, 22], [15, 2]], '#544735', 0.7);
  path(c, [[15.8, 4], [27.5, 6], [26.8, 19], [15.8, 18]], cloth, '#544735', 0.35);
  for (let y = 7; y < 19; y += 3) line(c, [[16, y], [27.5 - (y - 7) * 0.08, y + 0.5]], '#6c584044', 0.4);
  line(c, [[15, 3], [4, 22]], '#7c735c', 0.3); line(c, [[15, 3], [29, 21]], '#7c735c', 0.3);
  path(c, [[15.5, 2], [21, 3.2], [15.5, 4.3]], palette.red, '', 0);
  if (supply) for (const x of [7, 12, 20]) ellipse(c, x, 20, 2.2, 2.8, '#c0b182', '#645940');
  else person(c, 8, 22, 0.35, { robe: enemy ? palette.blue : palette.red, hat: 'helmet' } as Look, 'side', 0, false);
}
export function makeMapChar(scene: PhaserNS.Scene, key: string, look: Look): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, 16 * 9 * ART_SCALE, 30 * ART_SCALE)!; const c = tex.getContext(); c.scale(ART_SCALE, ART_SCALE);
  (['down', 'up', 'side'] as const).forEach((dir, d) => { for (let frame = 0; frame < 3; frame++) person(c, d * 48 + frame * 16 + 8, 29, 0.95, look, dir, frame === 1 ? 0.6 : frame === 2 ? -0.6 : 0, !['villager', 'woman', 'elder', 'boy', 'scholar'].includes(key.replace('ch_', ''))); });
  for (let i = 0; i < 9; i++) tex.add(i, 0, i * 16 * ART_SCALE, 0, 16 * ART_SCALE, 30 * ART_SCALE); tex.refresh();
}
export function makeMapUnits(scene: PhaserNS.Scene, looks: Record<string, Look>): void {
  for (const name of ['bo', 'cung', 'tuong', 'vua', 'ky', 'voi', 'thuyen', 'thuyen_nhe', 'luong', 'e_bo', 'e_cung', 'e_tuong', 'e_ky', 'e_thuyen', 'e_luong']) {
    const enemy = name.startsWith('e_'), type = name.replace('e_', ''), look = enemy ? looks.enemy : type === 'vua' ? looks.king : type === 'tuong' ? looks.general : looks.soldier;
    texture(scene, `map_u_${name}`, 32, 32, c => {
      if (['thuyen', 'thuyen_nhe', 'luong'].includes(type)) ship(c, enemy, type === 'luong');
      else if (type === 'ky') for (const [x, y] of [[8, 15], [23, 17], [8, 29], [23, 31]]) horse(c, x, y, 0.53, look);
      else if (type === 'voi') {
        ellipse(c, 16, 29, 13, 2, '#30382c35');
        for (const x of [7, 12, 20, 25]) line(c, [[x, 20], [x, 29]], '#676e67', 3);
        ellipse(c, 15, 18, 11, 7.2, '#879080', '#4e5c51'); ellipse(c, 25, 15, 5.3, 5.2, '#879080', '#4e5c51');
        line(c, [[29, 17], [29, 25], [27, 27]], '#879080', 3); line(c, [[27, 19], [25, 22]], '#e1d7b5', 1.2);
        path(c, [[8, 12], [20, 12], [20, 20], [8, 20]], palette.red); person(c, 14, 14, 0.45, looks.general);
      } else if (['vua', 'tuong'].includes(type)) { person(c, 15, 31, 1.02, look, 'side', 0, type !== 'vua'); line(c, [[26, 30], [26, 2]], '#645438', 0.6); path(c, [[26, 3], [31, 4], [31, 11], [26, 10]], enemy ? palette.blue : palette.red); }
      else for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) { const x = 5.5 + col * 10, y = 12 + row * 9; person(c, x, y, 0.40, type === 'cung' ? { ...look, robe: '#667554' } : look, 'side', 0, type !== 'cung'); if (type === 'cung') { c.beginPath(); c.arc(x + 1.9, y - 5, 2.1, -1.3, 1.3); c.strokeStyle = '#55462d'; c.lineWidth = 0.4; c.stroke(); line(c, [[x + 2.4, y - 7], [x + 2.4, y - 3]], '#d9cda4', 0.25); } }
    });
  }
}
function roof(c: Ctx, x: number, y: number, w: number, h: number): void {
  path(c, [[x - 1, y + h], [x + 2, y + h * 0.4], [x + w / 2, y], [x + w - 2, y + h * 0.4], [x + w + 1, y + h], [x + w / 2, y + h * 0.8]], '#735e46');
  for (let i = 2; i < w; i += 1.7) line(c, [[x + w / 2, y + 0.4], [x + i, y + h * 0.92]], '#b0a07b', 0.22);
  line(c, [[x - 1, y + h], [x + w + 1, y + h]], '#493f30', 0.7);
}
function prop(c: Ctx, kind: string): void {
  ellipse(c, 12, 34, 10, 2, '#2f3b2b2b');
  if (kind === 'tree' || kind === 'bamboo') {
    if (kind === 'tree') {
      line(c, [[12, 34], [11, 14]], '#6c5b3e', 1.8); line(c, [[11, 23], [6, 15]], '#6c5b3e', 0.9);
      for (let i = 0; i < 12; i++) { const x = 12 + Math.sin(i * 2.4) * 6.2, y = 8 + (i % 4) * 4.3; ellipse(c, x, y, 5.2, 4.2, ['#4c6040', '#64764b', '#82905d'][i % 3], '#526143'); }
    } else for (const x of [6, 11, 16]) { line(c, [[x, 34], [x + 1, 5]], '#6d8050', 1.1); for (let y = 8; y < 30; y += 5) { line(c, [[x, y], [x + 5, y - 3]], '#526747', 0.7); line(c, [[x, y + 2], [x - 5, y - 1]], '#526747', 0.7); } }
  } else if (kind === 'house' || kind === 'hall') {
    path(c, [[3, 19], [21, 19], [21, 33], [3, 33]], '#bba783');
    c.fillStyle = '#5f503a'; c.fillRect(10, 23, 5, 10); for (const x of [5, 18]) { c.fillRect(x, 22, 2, 5); line(c, [[x + 1, 19], [x + 1, 33]], '#7b6447', 0.5); }
    roof(c, 2, 10, 20, 11); if (kind === 'hall') roof(c, 5, 3, 14, 10);
  } else if (kind === 'tent') { path(c, [[2, 32], [11, 12], [22, 31]], '#c4b894'); path(c, [[11, 12], [14, 31], [22, 31]], '#a29374'); path(c, [[8, 32], [11, 19], [14, 31]], '#554d39'); line(c, [[11, 12], [11, 7]], '#62543b'); }
  else if (kind === 'fence') { for (const x of [2, 7, 12, 17, 22]) { line(c, [[x, 34], [x, 20]], '#7c6645', 1.4); path(c, [[x - 0.7, 20], [x, 17], [x + 0.7, 20]], '#ae9770', '', 0); } for (const y of [24, 30]) line(c, [[0, y], [24, y]], '#695b41', 1); }
  else if (kind === 'rock') { path(c, [[2, 32], [4, 24], [12, 21], [20, 25], [23, 33]], '#8d927f'); path(c, [[4, 24], [11, 22], [13, 28], [2, 32]], '#b2b09a', '', 0); }
  else if (kind === 'boat') { c.save(); c.translate(0, 4); c.scale(0.75, 0.9); ship(c, false); c.restore(); }
  else if (kind === 'banner') { line(c, [[6, 34], [6, 3]], '#64553b', 0.9); path(c, [[6.5, 5], [21, 6], [20, 19], [6.5, 18]], palette.red); line(c, [[8, 7], [18, 8], [17, 16], [8, 15], [8, 7]], palette.gold, 0.6); }
  else if (kind === 'well') { ellipse(c, 12, 30, 8, 4, '#7c8071', '#4c5545'); c.fillStyle = '#93947e'; c.fillRect(4, 25, 16, 5); ellipse(c, 12, 25, 8, 4, '#b1ac91', '#515941'); ellipse(c, 12, 25, 5.5, 2.4, '#496575'); line(c, [[5, 25], [5, 14], [19, 14], [19, 25]], '#6c5b3c', 1); roof(c, 3, 8, 18, 7); }
  else if (kind === 'pillar') { c.fillStyle = '#8c8e7a'; c.fillRect(7, 30, 10, 4); c.fillStyle = palette.red; c.fillRect(10, 8, 4, 23); c.fillStyle = palette.gold; c.fillRect(8, 7, 8, 2); }
  else if (kind === 'logs' || kind === 'stakes') { for (let i = 0; i < 5; i++) { const x = 4 + i * 4, y = 30 - (i % 2) * 5; line(c, [[x, y], [x - 1, y - (kind === 'stakes' ? 16 : 7)]], '#6e593b', 2.5); if (kind === 'stakes') path(c, [[x - 2.2, y - 15], [x - 1.3, y - 20], [x + 0.3, y - 15]], '#b3a079'); else ellipse(c, x, y, 1.3, 1, '#bb9e6b'); } }
  else if (kind === 'fire') { line(c, [[4, 33], [21, 31]], '#65543b', 2); line(c, [[5, 31], [20, 34]], '#65543b', 2); path(c, [[6, 30], [8, 22], [11, 25], [13, 17], [18, 30]], '#bd713d', '', 0); path(c, [[10, 31], [13, 23], [16, 30]], '#e1ba65', '', 0); }
  else if (kind === 'drum') { for (const x of [5, 19]) line(c, [[x, 34], [x + (x < 10 ? 2 : -2), 21]], '#67573c', 1); c.fillStyle = palette.red; c.fillRect(5, 23, 14, 7); ellipse(c, 12, 23, 7, 3, '#b7a780', '#62583c'); ellipse(c, 12, 30, 7, 3, palette.red, '#62583c'); }
  else { for (const [x, y] of [[7, 29], [17, 30], [12, 22]]) { ellipse(c, x, y, 4.8, 5.5, '#bbad82', '#77664a'); line(c, [[x - 1, y - 5], [x + 1, y - 5]], '#635638', 0.8); } }
}
export function makeMapProps(scene: PhaserNS.Scene): void {
  for (const kind of ['tree', 'bamboo', 'house', 'tent', 'fence', 'rock', 'boat', 'drum', 'banner', 'sacks', 'well', 'pillar', 'hall', 'logs', 'stakes', 'fire']) texture(scene, `map_${kind}`, 24, 36, c => prop(c, kind));
  texture(scene, 'map_shadow', 12, 4, c => ellipse(c, 6, 2, 5.8, 1.7, '#26372b3d'));
  texture(scene, 'map_marker', 12, 12, c => { path(c, [[6, 1], [10, 5], [6, 11], [2, 5]], '#e5cd86', '#6c5a30', 0.5); });
  texture(scene, 'map_fence_v', 24, 36, c => { line(c, [[11, 2], [11, 34]], '#6c5b3d', 2); for (let y = 4; y < 36; y += 7) { line(c, [[9, y], [13, y - 2]], '#947b50', 2); ellipse(c, 11, y - 3, 1.7, 1.2, '#c2ac77', '#746044'); } });
  for (const kind of ['plank', 'rice', 'flag', 'scroll', 'token', 'torch', 'horn', 'stake']) texture(scene, `map_it_${kind}`, 16, 16, c => {
    ellipse(c, 8, 14, 6, 1.3, '#273a2f28');
    if (kind === 'scroll') { path(c, [[3, 4], [13, 4], [13, 12], [3, 12]], '#d6c69b'); for (const y of [4, 12]) line(c, [[2, y], [14, y]], '#8a4c37', 1.1); for (const y of [6, 8, 10]) line(c, [[5, y], [11, y]], '#77603c', 0.4); }
    else if (kind === 'token') { path(c, [[5, 3], [11, 3], [12, 12], [4, 12]], '#b0985e'); c.fillStyle = palette.red; c.fillRect(6, 6, 4, 4); line(c, [[8, 1], [8, 3]], '#8d7449', 0.6); }
    else if (kind === 'flag') { line(c, [[3, 14], [3, 1]], '#675235', 0.7); path(c, [[4, 2], [14, 3], [12, 10], [4, 9]], palette.red); line(c, [[6, 4], [11, 5], [10, 8], [6, 7]], palette.gold, 0.5); }
    else if (kind === 'rice') { ellipse(c, 8, 9, 4.5, 5.3, '#c8b988', '#77644a'); line(c, [[6, 4], [10, 4]], '#6c5c3c', 1); }
    else if (kind === 'horn') { c.beginPath(); c.moveTo(2, 11); c.quadraticCurveTo(9, 12, 13, 4); c.strokeStyle = '#d1c199'; c.lineWidth = 2.2; c.stroke(); ellipse(c, 13, 4, 1.9, 0.9, '#786748'); }
    else if (kind === 'torch') { line(c, [[8, 15], [8, 6]], '#7d603e', 1.7); path(c, [[5, 7], [6, 3], [8, 1], [11, 7]], '#cb873d'); path(c, [[7, 7], [8, 3], [9, 7]], '#e5c57a', '', 0); }
    else if (kind === 'stake') { line(c, [[3, 12], [12, 4]], '#6e5536', 2.2); path(c, [[11, 3], [15, 1], [13, 5]], '#c3a778'); }
    else { path(c, [[1, 6], [14, 4], [15, 9], [2, 11]], '#a68a58'); line(c, [[4, 7], [12, 6]], '#74603d', 0.5); }
  });
}

/** One continuous drawing. The server's cells remain collision data, never tile borders. */
export function makeExploreMap(scene: PhaserNS.Scene, grid: string[], width: number, height: number): void {
  texture(scene, 'cartographic-ground', width, height, c => {
    const rng = random(1258), tile = width / grid[0].length;
    const ground = c.createLinearGradient(0, 0, width, height); ground.addColorStop(0, '#9c9b70'); ground.addColorStop(0.5, '#899461'); ground.addColorStop(1, '#77865b'); c.fillStyle = ground; c.fillRect(0, 0, width, height);
    for (let i = 0; i < 7000; i++) { c.fillStyle = i % 2 ? '#d1c59a18' : '#364d2e13'; const size = 0.4 + rng() * 2; c.fillRect(rng() * width, rng() * height, size, size * 0.5); }
    grid.forEach((row, y) => [...row].forEach((ch, x) => {
      const px = x * tile, py = y * tile;
      if (',=_:+'.includes(ch)) { c.fillStyle = ch === '_' ? '#b7b29b' : ch === '+' ? '#96835b' : '#c5b181'; c.fillRect(px, py, tile + 0.5, tile + 0.5); }
      if ('~b'.includes(ch)) { c.fillStyle = palette.water; c.fillRect(px, py, tile + 0.5, tile + 0.5); for (let i = 0; i < 4; i++) { const wx = px + 3 + rng() * (tile - 10), wy = py + 3 + rng() * (tile - 6); line(c, [[wx, wy], [wx + 6, wy - 0.4], [wx + 10, wy]], '#c0ccba75', 0.6); } }
      if (ch === '%') for (let i = 0; i < 8; i++) { const yy = py + 3 + i * 3.5; line(c, [[px + 1, yy], [px + tile - 1, yy]], '#a2a167', 1.4); }
      if (ch === 'w') { c.fillStyle = '#827e66'; c.fillRect(px, py, tile, tile); }
    }));
    grid.forEach((row, y) => [...row].forEach((ch, x) => {
      if (!'~b'.includes(ch)) return;
      const px = x * tile, py = y * tile;
      for (const [dx, dy, edge] of [[-1, 0, [[px, py], [px, py + tile]]], [1, 0, [[px + tile, py], [px + tile, py + tile]]], [0, -1, [[px, py], [px + tile, py]]], [0, 1, [[px, py + tile], [px + tile, py + tile]]]] as Array<[number, number, number[][]]>) if (!'~b'.includes(grid[y + dy]?.[x + dx] ?? '~')) line(c, edge, '#c0b083', 4);
    }));
    if (grid[0].includes('w')) { roof(c, width * 0.3, 0, width * 0.4, tile * 0.9); for (const x of [width * 0.1, width * 0.9]) { c.fillStyle = '#8b4836'; c.fillRect(x - 3, 5, 6, tile * 1.7); } }
    c.strokeStyle = '#3c4b3370'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, width - 3, height - 3);
  }, 2);
}
export function makeTacticalMap(scene: PhaserNS.Scene, width: number, height: number, mode: 'land' | 'river' | 'shore'): void {
  texture(scene, 'cartographic-battle', width, height, c => {
    const rng = random(1285); c.fillStyle = '#a4a379'; c.fillRect(0, 0, width, height);
    const shade = c.createRadialGradient(width * 0.5, height * 0.6, 10, width * 0.5, height * 0.5, width * 0.7); shade.addColorStop(0, '#c7bb8e'); shade.addColorStop(1, '#718359'); c.fillStyle = shade; c.fillRect(0, 0, width, height);
    for (let i = 0; i < 15000; i++) { c.fillStyle = i % 2 ? '#ebe0b51a' : '#3f56341d'; c.fillRect(rng() * width, rng() * height, 0.5 + rng() * 3, 0.5 + rng() * 1.3); }
    for (let i = 0; i < 10; i++) { c.beginPath(); c.moveTo(-15, 38 + i * 13); c.bezierCurveTo(width * 0.25, 4 + i * 12, width * 0.65, 55 + i * 14, width + 20, 22 + i * 12); c.strokeStyle = '#5b6b3c25'; c.lineWidth = 1.3; c.stroke(); }
    if (mode !== 'land') {
      c.beginPath(); c.moveTo(-10, mode === 'river' ? 60 : 340); c.bezierCurveTo(width * 0.35, mode === 'river' ? 42 : 318, width * 0.65, mode === 'river' ? 79 : 350, width + 10, mode === 'river' ? 60 : 335); c.lineTo(width + 10, height + 10); c.lineTo(-10, height + 10); c.closePath(); c.fillStyle = '#73949b'; c.fill(); c.strokeStyle = '#c6ba92'; c.lineWidth = 8; c.stroke();
      for (let i = 0; i < 150; i++) { const x = rng() * width, y = (mode === 'river' ? 75 : 360) + rng() * (height - (mode === 'river' ? 75 : 360)); line(c, [[x, y], [x + 14, y - 1], [x + 24, y]], '#c5d4c06b', 0.7); }
    }
    for (let i = 0; i < 50; i++) { const x = rng() * width, y = mode !== 'land' || i % 2 ? 25 + rng() * 30 : height - rng() * 30; c.save(); c.translate(x - 12, y - 30); prop(c, i % 7 ? 'tree' : 'rock'); c.restore(); }
    c.strokeStyle = '#4c583e80'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, width - 3, height - 3);
  }, 1.5);
}
