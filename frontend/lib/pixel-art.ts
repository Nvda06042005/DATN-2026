/**
 * Hình pixel của Hành Trình Đông A. Mỗi ô bản đồ là 16×16 điểm ảnh: hình vẽ vào bộ đệm điểm ảnh (vẽ sau đè vẽ trước)
 * rồi gộp các khối cùng màu thành một Path mỗi màu, để react-native-svg vẽ nhanh trên Android, iOS và web.
 * Bản đồ có 2 lớp: mặt đất (dưới nhân vật) và lớp che (tán cây, mái nhà – vẽ đè lên nhân vật đi phía sau).
 * Ban đêm (chế độ tối) mọi màu ngả xanh tối; màu viết "ngày|đêm" (cửa sổ, đèn lồng) thì sáng lên khi đêm xuống.
 */
import { STRUCTURE_SIZE } from '@/constants/world';
import type { CharacterId, CharacterLook, CropId, StructureKind, WorldDir, WorldMapDef } from '@/types/game';

export interface PixelPaths {
  w: number;
  h: number;
  list: Array<{ fill: string; d: string }>;
}

export const TILE_PX = 16;

// ---------------------------------------------------------------------- màu
const P = {
  ink: '#2a1d14',
  grass: '#8ccc63',
  grassDark: '#6cab4b',
  grassLight: '#a9de7f',
  tall: '#76b653',
  tallDark: '#55923a',
  tallLight: '#9ad26f',
  pink: '#f392b5',
  white: '#fff6dc',
  yellow: '#f8d15a',
  dirt: '#dcb47d',
  dirtDark: '#bf9460',
  dirtLight: '#ecd09f',
  stone: '#d6cbb5',
  stoneDark: '#b4a78d',
  stoneLight: '#ebe3d2',
  sand: '#eedca6',
  sandDark: '#d6be86',
  sandLight: '#f8edc9',
  water: '#4ea4d4',
  waterDark: '#3d8cbf',
  waterLight: '#93d3f0',
  foam: '#e6f6fc',
  paddy: '#7bc0cc',
  paddyLight: '#a8dce5',
  dike: '#b08a5c',
  rice: '#5fae4c',
  riceDark: '#43893a',
  riceLight: '#8fd06a',
  riceGold: '#e8b93c',
  riceGoldDark: '#c99424',
  soil: '#8d5d38',
  soilDark: '#6c4427',
  soilLight: '#a7714a',
  wood: '#a8733f',
  woodDark: '#7a4f27',
  woodLight: '#c88f55',
  trunk: '#7a4f27',
  trunkDark: '#583619',
  leaf: '#3f8a45',
  leafDark: '#2d6b36',
  leafLight: '#5fae55',
  leafShine: '#88cb6a',
  leafEdge: '#24502b',
  bamboo: '#8ab447',
  bambooDark: '#5f8a2e',
  bambooLeaf: '#4c8f3a',
  bambooLeafLight: '#8cc35a',
  rock: '#a39d92',
  rockDark: '#78726a',
  rockLight: '#c9c3b7',
  rockEdge: '#5c564f',
  thatch: '#d9a54c',
  thatchDark: '#b7832f',
  thatchDeep: '#8f6424',
  thatchLight: '#ecc06c',
  wall: '#ecd7ac',
  wallDark: '#cfb27e',
  tile: '#a63e20',
  tileDark: '#7c2d12',
  tileLight: '#c8572f',
  pillar: '#b91c1c',
  pillarDark: '#7f1d1d',
  gold: '#e0a526',
  goldLight: '#f8d36b',
  door: '#5a3a1c',
  doorDark: '#3f2812',
  window: '#6b4a2b|#ffd27a',
  lantern: '#c0392b|#ffb347',
  canvas: '#eadfc4',
  canvasDark: '#cdbb92',
  paper: '#f6ecd2',
  text: '#57534e',
  red: '#c62828',
  redDark: '#8e1b1b',
  orange: '#f59e0b',
  orangeLight: '#fcd34d',
  straw: '#dcb35a',
  strawDark: '#b98f3a',
  hull: '#46403b',
  hullDark: '#2c2723',
  sail: '#57504a',
  metal: '#c9ced6',
  metalDark: '#8b929c',
  taro: '#8e6aa8',
  shadow: 'rgba(30,20,10,0.22)',
  bubble: '#fffdf7|#fffdf7',
  bubbleInk: '#2a1d14|#2a1d14',
  markGold: '#e0a526|#f8c13a',
  markTeal: '#0f766e|#2dd4bf',
  markRed: '#c62828|#f87171',
};

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

/** Bóng đổ: tối màu ban ngày, giữ màu đêm (đèn) */
const darker = (color: string, k: number) => {
  const [day, night] = color.split('|');
  if (!day.startsWith('#')) return color;
  const [r, g, b] = rgb(day);
  const d = toHex(r * k, g * k, b * Math.min(1, k * 1.05));
  return night ? `${d}|${night}` : d;
};

const NIGHT = [16, 30, 64];

const colorFor = (color: string, night: boolean) => {
  const [day, glow] = color.split('|');
  if (!night) return day;
  if (glow) return glow;
  if (!day.startsWith('#')) return day;
  const [r, g, b] = rgb(day);
  return toHex(r * 0.42 + NIGHT[0] * 0.55, g * 0.45 + NIGHT[1] * 0.55, b * 0.52 + NIGHT[2] * 0.6);
};

/** Số ngẫu nhiên cố định theo vị trí (bản đồ lần nào vẽ cũng giống nhau) */
const rand = (x: number, y: number, k: number) => {
  let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 7, 668265263) ^ Math.imul(k + 13, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

const pick = (x: number, y: number, k: number, n: number) => Math.floor(rand(x, y, k) * n);

// ---------------------------------------------------------------------- bộ đệm điểm ảnh
interface Paint {
  rect(x: number, y: number, w: number, h: number, color: string): void;
}

class Raster implements Paint {
  readonly w: number;
  readonly h: number;
  readonly data: Uint16Array;
  private colors: string[] = [];
  private index = new Map<string, number>();

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint16Array(w * h);
  }

  private id(color: string) {
    let i = this.index.get(color);
    if (i === undefined) {
      this.colors.push(color);
      i = this.colors.length;
      this.index.set(color, i);
    }
    return i;
  }

  rect(x: number, y: number, w: number, h: number, color: string) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.floor(x + w));
    const y1 = Math.min(this.h, Math.floor(y + h));
    if (x1 <= x0 || y1 <= y0) return;
    const c = this.id(color);
    for (let yy = y0; yy < y1; yy++) this.data.fill(c, yy * this.w + x0, yy * this.w + x1);
  }

  /** Đổ bóng lên phần đã vẽ */
  shade(x: number, y: number, w: number, h: number, k = 0.8) {
    for (let yy = Math.max(0, y); yy < Math.min(this.h, y + h); yy++)
      for (let xx = Math.max(0, x); xx < Math.min(this.w, x + w); xx++) {
        const c = this.data[yy * this.w + xx];
        if (c) this.data[yy * this.w + xx] = this.id(darker(this.colors[c - 1], k));
      }
  }

  /** Gộp điểm ảnh cùng màu thành khối chữ nhật (theo hàng, nối dọc khi trùng khớp), mỗi màu một Path */
  paths(night: boolean): PixelPaths {
    const { w, h, data } = this;
    const counts = new Uint32Array(this.colors.length + 1);
    for (let i = 0; i < data.length; i++) counts[data[i]]++;
    let bg = 0;
    for (let c = 1; c < counts.length; c++) if (counts[c] > counts[bg] || bg === 0) bg = c;
    // Màu phổ biến nhất vẽ một lần làm nền (chỉ khi không có điểm trong suốt)
    const full = bg && counts[0] === 0 ? bg : 0;
    const segs: string[][] = this.colors.map(() => []);
    type Open = { x: number; y: number; w: number; h: number; c: number };
    const emit = (o: Open) => segs[o.c - 1].push(`M${o.x} ${o.y}h${o.w}v${o.h}h${-o.w}z`);
    let open = new Map<number, Open>();
    for (let y = 0; y < h; y++) {
      const next = new Map<number, Open>();
      let x = 0;
      while (x < w) {
        const c = data[y * w + x];
        let len = 1;
        while (x + len < w && data[y * w + x + len] === c) len++;
        if (c !== 0 && c !== full) {
          const key = (x * 1024 + len) * 1024 + c;
          const o = open.get(key);
          if (o) {
            o.h++;
            open.delete(key);
            next.set(key, o);
          } else next.set(key, { x, y, w: len, h: 1, c });
        }
        x += len;
      }
      for (const o of open.values()) emit(o);
      open = next;
    }
    for (const o of open.values()) emit(o);
    const list: PixelPaths['list'] = [];
    if (full) list.push({ fill: colorFor(this.colors[full - 1], night), d: `M0 0h${w}v${h}h${-w}z` });
    this.colors.forEach((color, i) => {
      if (segs[i].length) list.push({ fill: colorFor(color, night), d: segs[i].join('') });
    });
    return { w, h, list };
  }
}

/** Vẽ công trình, cây: phần nằm trong nền (footprint) vào mặt đất, phần nhô ra (mái, tán, cờ) vào lớp che */
class Split implements Paint {
  private ground: Raster;
  private over: Raster;
  private fx: number;
  private fy: number;
  private fw: number;
  private fh: number;

  constructor(ground: Raster, over: Raster, fx: number, fy: number, fw: number, fh: number) {
    this.ground = ground;
    this.over = over;
    this.fx = fx;
    this.fy = fy;
    this.fw = fw;
    this.fh = fh;
  }

  rect(x: number, y: number, w: number, h: number, color: string) {
    const ix0 = Math.max(x, this.fx);
    const iy0 = Math.max(y, this.fy);
    const ix1 = Math.min(x + w, this.fx + this.fw);
    const iy1 = Math.min(y + h, this.fy + this.fh);
    if (ix1 <= ix0 || iy1 <= iy0) return this.over.rect(x, y, w, h, color);
    this.ground.rect(ix0, iy0, ix1 - ix0, iy1 - iy0, color);
    if (iy0 > y) this.over.rect(x, y, w, iy0 - y, color);
    if (y + h > iy1) this.over.rect(x, iy1, w, y + h - iy1, color);
    if (ix0 > x) this.over.rect(x, iy0, ix0 - x, iy1 - iy0, color);
    if (x + w > ix1) this.over.rect(ix1, iy0, x + w - ix1, iy1 - iy0, color);
  }
}

const grid = (p: Paint, rows: string[], pal: Record<string, string>, ox: number, oy: number, flip = false) =>
  rows.forEach((row, y) => {
    for (let i = 0; i < row.length; i++) {
      const ch = flip ? row[row.length - 1 - i] : row[i];
      if (ch !== '.' && pal[ch]) p.rect(ox + i, oy + y, 1, 1, pal[ch]);
    }
  });

// ---------------------------------------------------------------------- địa hình
const GRASSY = new Set(['.', ',', ';', 'T', 't', 'r', 'R', 'p']);
const WATERY = new Set(['~', 'B', 'd']);

const TREE = [
  '.....oooooo.....',
  '...oolllgggoo...',
  '..ollLllggggGo..',
  '.olllllgggggGGo.',
  '.ollLlggggggGGo.',
  'olllllgggggggGGo',
  'ollllggggggGgGGo',
  'olllgggggggggGGo',
  'ogllggggggggGGGo',
  'ogggggggggGgGGGo',
  '.oggggggggGGGGo.',
  '.oGgggggGGGGGGo.',
  '..oGGGGGGGGGGo..',
  '...ooGGGGGGoo...',
  '......oTTo......',
  '......tttT......',
  '......tttT......',
  '......tttT......',
  '.....ttttTT.....',
  '....ttttttTT....',
];
const TREE_PAL = { o: P.leafEdge, l: P.leafLight, L: P.leafShine, g: P.leaf, G: P.leafDark, t: P.trunk, T: P.trunkDark };

const ROCK = [
  '................',
  '................',
  '................',
  '.....oooooo.....',
  '...oollllllo....',
  '..olllLLllllo...',
  '..ollLllllllo...',
  '.oollllllllddo..',
  '.olllllllldddo..',
  '.oldllllldddddo.',
  '..oddddddddddo..',
  '...oooooooooo...',
  '................',
  '................',
  '................',
  '................',
];
const ROCK_PAL = { o: P.rockEdge, l: P.rock, L: P.rockLight, d: P.rockDark };

const tuft = (g: Paint, x: number, y: number, dark: string, light: string) => {
  g.rect(x, y + 1, 1, 1, dark);
  g.rect(x + 1, y, 1, 1, dark);
  g.rect(x + 2, y + 1, 1, 1, dark);
  g.rect(x + 1, y + 1, 1, 1, light);
};

const flower = (g: Paint, x: number, y: number, petal: string, heart: string) => {
  g.rect(x - 1, y, 3, 1, petal);
  g.rect(x, y - 1, 1, 3, petal);
  g.rect(x, y, 1, 1, heart);
  g.rect(x + 1, y + 2, 1, 1, P.grassDark);
};

const paintGrass = (g: Raster, X: number, Y: number, tx: number, ty: number) => {
  g.rect(X, Y, 16, 16, P.grass);
  for (let k = 0; k < 2; k++) if (rand(tx, ty, k) < 0.8) tuft(g, X + 2 + pick(tx, ty, k + 10, 11), Y + 3 + pick(tx, ty, k + 20, 10), P.grassDark, P.grassLight);
  if (rand(tx, ty, 5) < 0.35) g.rect(X + 1 + pick(tx, ty, 6, 14), Y + 1 + pick(tx, ty, 7, 14), 1, 1, P.grassLight);
};

const landAt = (map: WorldMapDef, x: number, y: number) => {
  const ch = map.rows[y]?.[x];
  return ch !== undefined && !WATERY.has(ch);
};

const paintWater = (g: Raster, map: WorldMapDef, X: number, Y: number, tx: number, ty: number) => {
  g.rect(X, Y, 16, 16, P.water);
  for (let k = 0; k < 2; k++) g.rect(X + 1 + pick(tx, ty, k + 30, 11), Y + 2 + pick(tx, ty, k + 40, 12), 3, 1, P.waterLight);
  if (rand(tx, ty, 9) < 0.5) g.rect(X + 2 + pick(tx, ty, 11, 10), Y + 2 + pick(tx, ty, 12, 12), 2, 1, P.waterDark);
  if (landAt(map, tx, ty - 1)) {
    g.rect(X, Y, 16, 1, P.foam);
    g.rect(X, Y + 1, 16, 1, P.waterLight);
  }
  if (landAt(map, tx, ty + 1)) {
    g.rect(X, Y + 15, 16, 1, P.foam);
    g.rect(X, Y + 14, 16, 1, P.waterLight);
  }
  if (landAt(map, tx - 1, ty)) {
    g.rect(X, Y, 1, 16, P.foam);
    g.rect(X + 1, Y, 1, 16, P.waterLight);
  }
  if (landAt(map, tx + 1, ty)) {
    g.rect(X + 15, Y, 1, 16, P.foam);
    g.rect(X + 14, Y, 1, 16, P.waterLight);
  }
};

const paintTile = (g: Raster, o: Raster, map: WorldMapDef, ch: string, tx: number, ty: number) => {
  const X = tx * 16;
  const Y = ty * 16;
  const at = (dx: number, dy: number) => map.rows[ty + dy]?.[tx + dx];
  switch (ch) {
    case ',':
      paintGrass(g, X, Y, tx, ty);
      flower(g, X + 4 + pick(tx, ty, 1, 3), Y + 4 + pick(tx, ty, 2, 3), rand(tx, ty, 3) < 0.5 ? P.pink : P.white, P.yellow);
      flower(g, X + 10 + pick(tx, ty, 4, 3), Y + 10 + pick(tx, ty, 5, 3), rand(tx, ty, 6) < 0.5 ? P.white : P.yellow, rand(tx, ty, 6) < 0.5 ? P.yellow : P.white);
      return;
    case ';':
      g.rect(X, Y, 16, 16, P.tall);
      for (let k = 0; k < 7; k++) {
        const bx = X + 1 + pick(tx, ty, k + 50, 14);
        const by = Y + 3 + pick(tx, ty, k + 60, 11);
        g.rect(bx, by, 1, 3, P.tallDark);
        g.rect(bx, by - 1, 1, 1, P.tallLight);
      }
      return;
    case ':': {
      g.rect(X, Y, 16, 16, P.dirt);
      for (let k = 0; k < 3; k++) g.rect(X + 1 + pick(tx, ty, k + 70, 14), Y + 1 + pick(tx, ty, k + 80, 14), 1, 1, P.dirtDark);
      for (let k = 0; k < 2; k++) g.rect(X + 1 + pick(tx, ty, k + 90, 14), Y + 1 + pick(tx, ty, k + 95, 14), 2, 1, P.dirtLight);
      const edge = (n: string | undefined) => n !== undefined && GRASSY.has(n);
      if (edge(at(0, -1))) g.rect(X, Y, 16, 1, P.dirtDark);
      if (edge(at(0, 1))) g.rect(X, Y + 15, 16, 1, P.dirtDark);
      if (edge(at(-1, 0))) g.rect(X, Y, 1, 16, P.dirtDark);
      if (edge(at(1, 0))) g.rect(X + 15, Y, 1, 16, P.dirtDark);
      return;
    }
    case '=':
      g.rect(X, Y, 16, 16, P.stone);
      g.rect(X, Y, 16, 1, P.stoneDark);
      g.rect(X, Y + 8, 16, 1, P.stoneDark);
      g.rect(X + (tx % 2 ? 8 : 0), Y + 1, 1, 7, P.stoneDark);
      g.rect(X + (tx % 2 ? 0 : 8), Y + 1, 1, 7, P.stoneDark);
      g.rect(X + 4, Y + 9, 1, 7, P.stoneDark);
      g.rect(X + 12, Y + 9, 1, 7, P.stoneDark);
      g.rect(X + 2, Y + 2, 2, 1, P.stoneLight);
      g.rect(X + 9 + pick(tx, ty, 1, 4), Y + 11, 2, 1, P.stoneLight);
      return;
    case 's':
      g.rect(X, Y, 16, 16, P.sand);
      for (let k = 0; k < 4; k++) g.rect(X + pick(tx, ty, k + 100, 16), Y + pick(tx, ty, k + 110, 16), 1, 1, P.sandDark);
      for (let k = 0; k < 3; k++) g.rect(X + pick(tx, ty, k + 120, 15), Y + pick(tx, ty, k + 130, 16), 2, 1, P.sandLight);
      return;
    case '~':
      paintWater(g, map, X, Y, tx, ty);
      return;
    case 'B':
      paintWater(g, map, X, Y, tx, ty);
      g.rect(X, Y + 2, 16, 12, P.wood);
      for (let i = 0; i < 4; i++) g.rect(X + i * 4, Y + 2, 1, 12, P.woodDark);
      g.rect(X, Y + 1, 16, 2, P.woodDark);
      g.rect(X, Y + 1, 16, 1, P.woodLight);
      g.rect(X, Y + 13, 16, 2, P.woodDark);
      g.rect(X + 1, Y, 2, 3, P.trunkDark);
      g.rect(X + 1, Y + 13, 2, 3, P.trunkDark);
      g.rect(X, Y + 15, 16, 1, P.waterDark);
      return;
    case 'd':
      paintWater(g, map, X, Y, tx, ty);
      g.rect(X + 1, Y, 14, 16, P.wood);
      for (let i = 0; i < 4; i++) g.rect(X + 1, Y + 3 + i * 4, 14, 1, P.woodDark);
      g.rect(X + 1, Y, 1, 16, P.woodDark);
      g.rect(X + 14, Y, 1, 16, P.woodDark);
      g.rect(X + 15, Y, 1, 16, P.waterDark);
      if (WATERY.has(at(0, 1) ?? '') && at(0, 1) !== 'd') {
        g.rect(X + 1, Y + 14, 2, 2, P.trunkDark);
        g.rect(X + 13, Y + 14, 2, 2, P.trunkDark);
      }
      return;
    case 'T':
      paintGrass(g, X, Y, tx, ty);
      g.shade(X + 3, Y + 12, 11, 3, 0.78);
      grid(new Split(g, o, X, Y, 16, 16), TREE, TREE_PAL, X, Y - 4);
      return;
    case 't': {
      paintGrass(g, X, Y, tx, ty);
      g.shade(X, Y + 12, 16, 4, 0.8);
      const p = new Split(g, o, X, Y, 16, 16);
      [1, 5, 9, 12].forEach((sx, i) => {
        const top = Y - 7 + pick(tx, ty, i + 140, 6);
        p.rect(X + sx, top, 2, Y + 15 - top, P.bamboo);
        p.rect(X + sx + 1, top, 1, Y + 15 - top, P.bambooDark);
        for (let ny = top + 3; ny < Y + 14; ny += 5) p.rect(X + sx, ny, 2, 1, P.bambooDark);
      });
      for (let k = 0; k < 11; k++) {
        const lx = X - 1 + pick(tx, ty, k + 150, 15);
        const ly = Y - 8 + pick(tx, ty, k + 170, 15);
        const c = k % 2 ? P.bambooLeaf : P.bambooLeafLight;
        p.rect(lx, ly, 3, 1, c);
        p.rect(k % 3 ? lx + 2 : lx - 1, ly + 1, 2, 1, P.bambooLeaf);
      }
      return;
    }
    case 'r':
      paintGrass(g, X, Y, tx, ty);
      g.shade(X + 2, Y + 11, 12, 2, 0.8);
      grid(g, ROCK, ROCK_PAL, X, Y);
      return;
    case 'R': {
      g.rect(X, Y, 16, 16, P.paddy);
      g.rect(X + 3 + pick(tx, ty, 1, 8), Y + 13, 3, 1, P.paddyLight);
      const off = ty % 2 ? 2 : 0;
      for (const [rx, ry] of [[3, 5], [8, 5], [13, 5], [3, 11], [8, 11], [13, 11]]) {
        const x = X + ((rx + off) % 16);
        const y = Y + ry;
        g.rect(x, y, 1, 3, P.riceDark);
        g.rect(x - 1, y - 1, 1, 2, P.rice);
        g.rect(x + 1, y - 1, 1, 2, P.rice);
        g.rect(x, y - 2, 1, 1, P.riceLight);
      }
      if (at(0, -1) !== 'R') {
        g.rect(X, Y, 16, 2, P.dike);
        g.rect(X, Y, 16, 1, P.grassDark);
      }
      if (at(0, 1) !== 'R') g.rect(X, Y + 14, 16, 2, P.dike);
      if (at(-1, 0) !== 'R') g.rect(X, Y, 2, 16, P.dike);
      if (at(1, 0) !== 'R') g.rect(X + 14, Y, 2, 16, P.dike);
      return;
    }
    case 'p':
      g.rect(X, Y, 16, 16, P.soil);
      for (const fy of [3, 7, 11]) {
        g.rect(X + 1, Y + fy, 14, 1, P.soilDark);
        g.rect(X + 1, Y + fy + 1, 14, 1, P.soilLight);
      }
      g.rect(X, Y, 16, 1, P.soilDark);
      g.rect(X, Y + 15, 16, 1, P.soilDark);
      g.rect(X, Y, 1, 16, P.soilDark);
      g.rect(X + 15, Y, 1, 16, P.soilDark);
      return;
    default:
      paintGrass(g, X, Y, tx, ty);
  }
};

// ---------------------------------------------------------------------- công trình
interface RoofStyle {
  base: string;
  dark: string;
  light: string;
  trim: string;
  pillar: string;
  pillarDark: string;
}

const DINH: RoofStyle = { base: P.tile, dark: P.tileDark, light: P.tileLight, trim: P.woodDark, pillar: P.pillar, pillarDark: P.pillarDark };
const PAVILION: RoofStyle = { base: '#93301b', dark: '#6a1f12', light: '#b5442a', trim: P.gold, pillar: P.pillar, pillarDark: P.pillarDark };

const paintHouse = (g: Raster, p: Paint, X: number, Y: number) => {
  g.shade(X + 1, Y + 29, 46, 3, 0.75);
  p.rect(X + 3, Y + 8, 42, 21, P.wall);
  p.rect(X + 3, Y + 26, 42, 3, P.wallDark);
  p.rect(X + 3, Y + 10, 42, 2, P.wallDark);
  for (const px of [X + 3, X + 15, X + 31, X + 43]) p.rect(px, Y + 8, 2, 21, P.woodDark);
  p.rect(X + 19, Y + 12, 10, 1, P.woodDark);
  p.rect(X + 20, Y + 13, 8, 16, P.door);
  p.rect(X + 23, Y + 13, 2, 16, P.doorDark);
  for (const wx of [X + 7, X + 34]) {
    p.rect(wx - 1, Y + 13, 9, 8, P.woodDark);
    p.rect(wx, Y + 14, 7, 6, P.window);
    p.rect(wx + 2, Y + 14, 1, 6, P.woodDark);
    p.rect(wx + 4, Y + 14, 1, 6, P.woodDark);
  }
  p.rect(X + 18, Y + 29, 12, 2, P.stone);
  const top = Y - 12;
  const rowW = (r: number) => 30 + Math.round((r * 24) / 21);
  for (let r = 0; r <= 21; r++) {
    const w = rowW(r);
    const c = r < 2 || r >= 20 ? P.thatchDeep : r % 4 === 1 ? P.thatchDark : P.thatch;
    p.rect(X + 24 - Math.floor(w / 2), top + r, w, 1, c);
  }
  for (let k = 0; k < 26; k++) {
    const r = 3 + pick(X, Y, k, 15);
    const w = rowW(r);
    const sx = X + 24 - Math.floor(w / 2) + 2 + pick(X, Y, k + 40, w - 4);
    p.rect(sx, top + r, 1, 2, P.thatchLight);
  }
};

const paintHall = (g: Raster, p: Paint, X: number, Y: number, s: RoofStyle, banners: boolean) => {
  g.shade(X + 2, Y + 48, 76, 2, 0.8);
  p.rect(X, Y + 40, 80, 8, P.stone);
  p.rect(X, Y + 40, 80, 1, P.stoneLight);
  p.rect(X, Y + 47, 80, 1, P.stoneDark);
  p.rect(X + 32, Y + 44, 16, 4, P.stoneLight);
  p.rect(X + 32, Y + 46, 16, 1, P.stoneDark);
  p.rect(X + 3, Y + 15, 74, 25, P.woodDark);
  const pillars = [3, 17, 31, 47, 61, 75];
  pillars.slice(0, -1).forEach((px, i) => {
    const x0 = X + px + 2;
    const w = pillars[i + 1] - px - 2;
    if (i === 2) {
      p.rect(x0, Y + 19, w, 21, P.doorDark);
      return;
    }
    p.rect(x0, Y + 19, w, 21, P.wood);
    for (let lx = x0 + 1; lx < x0 + w; lx += 3) p.rect(lx, Y + 19, 1, 21, P.woodDark);
    p.rect(x0, Y + 25, w, 1, P.woodDark);
    p.rect(x0, Y + 32, w, 1, P.woodDark);
  });
  for (const px of pillars) {
    p.rect(X + px, Y + 15, 2, 25, s.pillar);
    p.rect(X + px + 1, Y + 15, 1, 25, s.pillarDark);
  }
  for (const lx of [X + 21, X + 57]) {
    p.rect(lx + 1, Y + 16, 1, 2, P.ink);
    p.rect(lx, Y + 18, 3, 4, P.lantern);
  }
  const top = Y - 14;
  for (let r = 0; r <= 29; r++) {
    const w = 60 + Math.round((r * 32) / 29);
    const left = X + 40 - Math.floor(w / 2);
    p.rect(left, top + r, w, 1, r % 6 === 0 ? s.light : r >= 27 ? s.dark : s.base);
    if (r % 6 !== 0 && r < 27) for (let lx = left + 1 + (r % 2); lx < left + w; lx += 3) p.rect(lx, top + r, 1, 1, s.dark);
  }
  p.rect(X - 6, Y + 15, 92, 1, s.trim);
  for (const [cx, dir] of [[X - 6, -1], [X + 85, 1]] as const) {
    p.rect(cx + (dir < 0 ? -2 : 1), Y + 11, 2, 4, s.dark);
    p.rect(cx + (dir < 0 ? -3 : 2), Y + 8, 2, 3, s.dark);
    p.rect(cx + (dir < 0 ? -3 : 3), Y + 6, 1, 2, s.dark);
  }
  p.rect(X + 8, Y - 17, 64, 3, s.dark);
  p.rect(X + 5, Y - 20, 3, 4, s.dark);
  p.rect(X + 72, Y - 20, 3, 4, s.dark);
  p.rect(X + 36, Y - 22, 8, 5, P.gold);
  p.rect(X + 38, Y - 23, 4, 1, P.goldLight);
  if (banners)
    for (const bx of [X - 3, X + 80]) {
      p.rect(bx, Y + 14, 3, 24, P.red);
      p.rect(bx, Y + 14, 3, 1, P.gold);
      p.rect(bx, Y + 37, 3, 1, P.gold);
      p.rect(bx + 1, Y + 18, 1, 14, P.goldLight);
    }
};

const paintStructure = (g: Raster, o: Raster, kind: StructureKind, X: number, Y: number) => {
  const [w, h] = STRUCTURE_SIZE[kind];
  const p = new Split(g, o, X, Y, w * 16, h * 16);
  switch (kind) {
    case 'house':
      return paintHouse(g, p, X, Y);
    case 'dinh':
      return paintHall(g, p, X, Y, DINH, false);
    case 'pavilion':
      return paintHall(g, p, X, Y, PAVILION, true);
    case 'well':
      g.shade(X + 2, Y + 13, 13, 2, 0.75);
      p.rect(X + 2, Y + 6, 12, 8, P.stone);
      p.rect(X + 2, Y + 6, 12, 1, P.stoneLight);
      p.rect(X + 2, Y + 13, 12, 1, P.stoneDark);
      p.rect(X + 6, Y + 8, 1, 5, P.stoneDark);
      p.rect(X + 10, Y + 8, 1, 5, P.stoneDark);
      p.rect(X + 3, Y + 3, 10, 4, P.stoneDark);
      p.rect(X + 4, Y + 4, 8, 2, '#2c5f80');
      p.rect(X + 2, Y - 5, 1, 11, P.woodDark);
      p.rect(X + 13, Y - 5, 1, 11, P.woodDark);
      p.rect(X + 1, Y - 6, 14, 2, P.wood);
      p.rect(X + 8, Y - 4, 1, 6, P.paper);
      p.rect(X + 7, Y + 2, 3, 2, P.woodDark);
      return;
    case 'tent':
      g.shade(X + 1, Y + 29, 30, 3, 0.75);
      for (let r = 0; r <= 25; r++) {
        const w = 4 + Math.round((r * 28) / 25);
        const left = X + 16 - Math.floor(w / 2);
        p.rect(left, Y + 4 + r, Math.floor(w / 2), 1, P.canvas);
        p.rect(left + Math.floor(w / 2), Y + 4 + r, w - Math.floor(w / 2), 1, P.canvasDark);
      }
      for (let r = 0; r <= 11; r++) p.rect(X + 16 - Math.floor((2 + r) / 2), Y + 18 + r, 2 + r, 1, P.door);
      p.rect(X, Y + 29, 32, 1, P.woodDark);
      p.rect(X + 2, Y + 27, 28, 1, P.red);
      p.rect(X + 15, Y - 8, 1, 13, P.woodDark);
      p.rect(X + 16, Y - 8, 7, 4, P.red);
      p.rect(X + 16, Y - 4, 5, 1, P.redDark);
      return;
    case 'tower':
      g.shade(X + 2, Y + 29, 28, 3, 0.75);
      for (let i = 0; i < 10; i++) {
        p.rect(X + 6 + i * 2, Y + 6 + i * 2, 2, 1, P.wood);
        p.rect(X + 24 - i * 2, Y + 6 + i * 2, 2, 1, P.wood);
      }
      p.rect(X + 4, Y + 1, 2, 29, P.woodDark);
      p.rect(X + 26, Y + 1, 2, 29, P.woodDark);
      p.rect(X + 2, Y - 2, 28, 4, P.wood);
      p.rect(X + 2, Y + 1, 28, 1, P.woodDark);
      p.rect(X + 2, Y - 8, 28, 1, P.woodDark);
      for (const rx of [X + 2, X + 9, X + 16, X + 23, X + 29]) p.rect(rx, Y - 8, 1, 6, P.woodDark);
      p.rect(X + 15, Y - 6, 2, 2, P.lantern);
      for (let r = 0; r < 8; r++) {
        const w = 10 + r * 3;
        p.rect(X + 16 - Math.floor(w / 2), Y - 17 + r, w, 1, r % 3 === 0 ? P.thatchDark : P.thatch);
      }
      return;
    case 'logs':
      g.shade(X + 1, Y + 13, 30, 3, 0.75);
      for (let i = 0; i < 3; i++) {
        const y = Y + 5 + i * 3;
        p.rect(X + 3, y, 25, 3, P.wood);
        p.rect(X + 3, y + 2, 25, 1, P.woodDark);
        p.rect(X + 28, y + 1, 2, 1, P.wood);
        p.rect(X + 30, y + 1, 1, 1, P.woodLight);
        p.rect(X + 1, y, 2, 3, P.woodLight);
        p.rect(X + 1, y + 1, 1, 1, P.woodDark);
      }
      p.rect(X + 8, Y + 2, 16, 3, P.wood);
      p.rect(X + 8, Y + 4, 16, 1, P.woodDark);
      p.rect(X + 24, Y + 3, 2, 1, P.woodLight);
      return;
    case 'dummy':
      g.shade(X + 4, Y + 13, 8, 2, 0.75);
      p.rect(X + 7, Y + 3, 2, 12, P.woodDark);
      p.rect(X + 2, Y + 6, 12, 2, P.wood);
      p.rect(X + 4, Y + 5, 8, 7, P.straw);
      p.rect(X + 4, Y + 8, 8, 1, P.strawDark);
      p.rect(X + 4, Y + 11, 8, 1, P.strawDark);
      p.rect(X + 5, Y - 1, 6, 6, P.straw);
      p.rect(X + 5, Y + 4, 6, 1, P.strawDark);
      p.rect(X + 7, Y + 1, 2, 2, P.red);
      return;
    case 'hay':
      g.shade(X + 1, Y + 13, 14, 3, 0.75);
      p.rect(X + 7, Y - 3, 2, 5, P.woodDark);
      for (let r = 0; r <= 12; r++) {
        const w = Math.min(14, 4 + r * 2);
        p.rect(X + 8 - Math.floor(w / 2), Y + 1 + r, w, 1, r % 3 === 0 ? P.strawDark : P.straw);
      }
      return;
    case 'boat':
      g.shade(X + 2, Y + 12, 28, 2, 0.85);
      p.rect(X + 2, Y + 7, 28, 4, P.woodDark);
      p.rect(X + 4, Y + 11, 24, 2, P.trunkDark);
      p.rect(X + 1, Y + 5, 2, 3, P.woodDark);
      p.rect(X + 29, Y + 5, 2, 3, P.woodDark);
      p.rect(X + 3, Y + 6, 26, 1, P.wood);
      for (let r = 0; r < 5; r++) {
        const w = 10 + r * 2;
        p.rect(X + 16 - Math.floor(w / 2), Y + 1 + r, w, 1, r % 2 ? P.thatchDark : P.thatch);
      }
      return;
  }
};

const mapRasters = new Map<string, { ground: Raster; over: Raster }>();
const mapPaths = new Map<string, { ground: PixelPaths; over: PixelPaths }>();

/** Ảnh tĩnh của một vùng: lớp mặt đất và lớp che (tính một lần, có bản ngày và đêm) */
export const worldMapArt = (map: WorldMapDef, night: boolean) => {
  const key = `${map.id}:${night ? 1 : 0}`;
  const hit = mapPaths.get(key);
  if (hit) return hit;
  let r = mapRasters.get(map.id);
  if (!r) {
    const W = map.rows[0].length * 16;
    const H = map.rows.length * 16;
    r = { ground: new Raster(W, H), over: new Raster(W, H) };
    const { ground, over } = r;
    map.rows.forEach((row, ty) => [...row].forEach((ch, tx) => paintTile(ground, over, map, ch, tx, ty)));
    const order = [...map.structures].sort((a, b) => a.y + STRUCTURE_SIZE[a.kind][1] - (b.y + STRUCTURE_SIZE[b.kind][1]));
    for (const s of order) paintStructure(ground, over, s.kind, s.x * 16, s.y * 16);
    mapRasters.set(map.id, r);
  }
  const out = { ground: r.ground.paths(night), over: r.over.paths(night) };
  mapPaths.set(key, out);
  return out;
};

// ---------------------------------------------------------------------- nhân vật
const LOOKS: Record<CharacterId, CharacterLook> = {
  player: { hair: '#2b1d14', skin: '#f1c79a', cloth: '#9a5b2e', clothDark: '#6e3f1f', accent: '#e0a526', pants: '#efe4cc', hat: 'band', hatColor: '#c62828', item: 'none' },
  elder: { hair: '#f1efe8', skin: '#e9bf92', cloth: '#4b6a88', clothDark: '#344d66', accent: '#c9b27c', pants: '#3a4f66', hat: 'white', item: 'staff' },
  farmer: { hair: '#2b1d14', skin: '#e2b07f', cloth: '#8a6a43', clothDark: '#664c2e', accent: '#5a3a1c', pants: '#4a3a2a', hat: 'non_la', hatColor: '#e6c97f', item: 'hoe' },
  soldier: { hair: '#2b1d14', skin: '#f1c79a', cloth: '#8a3b2b', clothDark: '#5e2a1e', accent: '#e0a526', pants: '#3b2a1a', hat: 'band', hatColor: '#c62828', item: 'spear' },
  messenger: { hair: '#2b1d14', skin: '#f1c79a', cloth: '#b45309', clothDark: '#7c3a06', accent: '#c62828', pants: '#3b2a1a', hat: 'band', hatColor: '#e0a526', item: 'scroll' },
  scholar: { hair: '#2b1d14', skin: '#f1c79a', cloth: '#2f4f7f', clothDark: '#22395c', accent: '#d9c27a', pants: '#22395c', hat: 'khan', hatColor: '#1f1f1f', item: 'scroll' },
  boatman: { hair: '#2b1d14', skin: '#d9a273', cloth: '#5b7f8f', clothDark: '#3f5f6e', accent: '#c9b27c', pants: '#e8dcc0', hat: 'non_la', hatColor: '#e6c97f', item: 'oar' },
  scout: { hair: '#3b2a1a', skin: '#e2b07f', cloth: '#3f3f46', clothDark: '#27272a', accent: '#a16207', pants: '#27272a', hat: 'fur', hatColor: '#6b4a2b', item: 'bow' },
  carpenter: { hair: '#2b1d14', skin: '#d9a273', cloth: '#7a5a3a', clothDark: '#5a4028', accent: '#3b2a1a', pants: '#4a3a2a', hat: 'band', hatColor: '#e0a526', item: 'hammer' },
  weaver: { hair: '#2b1d14', skin: '#e2b07f', cloth: '#9c7b4f', clothDark: '#7a5c36', accent: '#5a3a1c', pants: '#4a3a2a', hat: 'non_la', hatColor: '#d9b870', item: 'basket' },
  veteran: { hair: '#d6d3cc', skin: '#e2b07f', cloth: '#7f1d1d', clothDark: '#5c1414', accent: '#e0a526', pants: '#3b2a1a', hat: 'white', item: 'spear' },
};

const BODY_DOWN = [
  '................',
  '.....kkkkkk.....',
  '....khhhhhhk....',
  '...khhhhhhhhk...',
  '...khhsssshhk...',
  '...khsesseshk...',
  '...kssssssssk...',
  '....kssssssk....',
  '...kcaaaaaack...',
  '..kdccccccccdk..',
  '..kdccccccccdk..',
  '..ksaaaaaaaask..',
  '...kcccccccck...',
  '...kpppkkpppk...',
  '....kpk..kpk....',
  '...kffk..kffk...',
];

const BODY_UP = [
  '................',
  '.....kkkkkk.....',
  '....khhhhhhk....',
  '...khhhhhhhhk...',
  '...khhhhhhhhk...',
  '...khhhhhhhhk...',
  '...kshhhhhhsk...',
  '....kssssssk....',
  '...kcccccccck...',
  '..kdccccccccdk..',
  '..kdccccccccdk..',
  '..ksaaaaaaaask..',
  '...kcccccccck...',
  '...kpppkkpppk...',
  '....kpk..kpk....',
  '...kffk..kffk...',
];

const BODY_SIDE = [
  '................',
  '......kkkkk.....',
  '.....khhhhhk....',
  '....khhhhhhhk...',
  '....khhhhsssk...',
  '....khhhssesk...',
  '....khhsssssk...',
  '.....kssssk.....',
  '.....kcaaak.....',
  '....kccccccdk...',
  '....kcccdccck...',
  '....kaaasaaak...',
  '.....kcccccck...',
  '.....kppppk.....',
  '.....kppk.......',
  '.....kfffk......',
];

/** Chân khi bước (hàng 14–15): 0 đứng, 1 và 2 hai nhịp bước */
const LEGS: Record<'front' | 'side', [string, string][]> = {
  front: [
    ['....kpk..kpk....', '...kffk..kffk...'],
    ['....kfk..kpk....', '.........kffk...'],
    ['....kpk..kfk....', '...kffk.........'],
  ],
  side: [
    ['.....kppk.......', '.....kfffk......'],
    ['....kpk.kpk.....', '...kffk.kffk....'],
    ['.....kppk.......', '.....kfffk......'],
  ],
};

type HatRows = Partial<Record<'down' | 'up' | 'side', Record<number, string>>>;

const HATS: Record<CharacterLook['hat'], HatRows> = {
  none: {},
  band: {
    down: { 3: '...kbbbbbbbbkb..', 4: '...khhsssshhkbb.' },
    up: { 3: '...kbbbbbbbbk...', 4: '...khhhbbhhhk...', 5: '...khhhbbhhhk...' },
    side: { 3: '....kbbbbbbbk...', 4: '...bkhhhhsssk...' },
  },
  non_la: { down: { 0: '.......kk.......', 1: '......knnk......', 2: '.....knnnnk.....', 3: '....knnnnnnk....', 4: '..kkNNNNNNNNkk..' } },
  khan: { down: { 1: '.....kkkkkk.....', 2: '....kKKKKKKk....', 3: '...kKKKKKKKKk...', 4: '...kKKKKKKKKk...' } },
  fur: { down: { 0: '.......kk.......', 1: '.....kFFFFk.....', 2: '....kFFFFFFk....', 3: '...kGGGGGGGGk...', 4: '...kGhsssshGk...' } },
  white: { down: { 0: '.......kk.......', 7: '....kswwwwsk....', 8: '...kcawwwwack...', 9: '..kdccwwwwccdk..', 10: '..kdcccwwcccdk..' } },
};

/** Vật cầm tay (vẽ bên phải nhân vật khi quay mặt xuống): [x, y, ký hiệu] */
const ITEMS: Record<CharacterLook['item'], Array<[number, number, string]>> = {
  none: [],
  spear: [[14, 0, 'm'], [14, 1, 'm'], [13, 2, 'M'], [14, 2, 'm'], [15, 2, 'M'], ...Array.from({ length: 13 }, (_, i) => [14, 3 + i, 'J'] as [number, number, string])],
  staff: [[14, 3, 'j'], [15, 3, 'j'], [15, 4, 'j'], ...Array.from({ length: 11 }, (_, i) => [14, 4 + i, 'J'] as [number, number, string])],
  oar: [...Array.from({ length: 10 }, (_, i) => [14, 1 + i, 'J'] as [number, number, string]), ...[11, 12, 13, 14].flatMap((y) => [[13, y, 'j'], [14, y, 'j'], [15, y, 'j']] as Array<[number, number, string]>)],
  bow: [[14, 3, 'J'], [15, 4, 'J'], [15, 5, 'J'], [15, 6, 'J'], [15, 7, 'J'], [15, 8, 'J'], [15, 9, 'J'], [15, 10, 'J'], [14, 11, 'J'], ...[4, 5, 6, 7, 8, 9, 10].map((y) => [14, y, 'q'] as [number, number, string])],
  hammer: [...[8, 9, 10, 11, 12, 13, 14].map((y) => [14, y, 'J'] as [number, number, string]), [13, 6, 'M'], [14, 6, 'm'], [15, 6, 'M'], [13, 7, 'M'], [14, 7, 'm'], [15, 7, 'M']],
  scroll: [[13, 10, 'J'], [14, 10, 'q'], [15, 10, 'J'], [13, 11, 'J'], [14, 11, 'q'], [15, 11, 'J'], [13, 12, 'J'], [14, 12, 'r'], [15, 12, 'J']],
  basket: [[12, 11, 'U'], [13, 11, 'U'], [14, 11, 'U'], [15, 11, 'U'], [12, 12, 'u'], [13, 12, 'U'], [14, 12, 'u'], [15, 12, 'U'], [12, 13, 'U'], [13, 13, 'u'], [14, 13, 'U'], [15, 13, 'u'], [13, 14, 'U'], [14, 14, 'U']],
  hoe: [...Array.from({ length: 12 }, (_, i) => [14, 2 + i, 'J'] as [number, number, string]), [12, 14, 'M'], [13, 14, 'm'], [14, 14, 'm'], [12, 15, 'M'], [13, 15, 'M']],
};

const setChar = (row: string, x: number, ch: string) => row.slice(0, x) + ch + row.slice(x + 1);

const spriteCache = new Map<string, PixelPaths>();

const cached = (key: string, w: number, h: number, draw: (r: Raster) => void, night: boolean) => {
  const full = `${key}:${night ? 1 : 0}`;
  const hit = spriteCache.get(full);
  if (hit) return hit;
  const r = new Raster(w, h);
  draw(r);
  const out = r.paths(night);
  spriteCache.set(full, out);
  return out;
};

/** Nhân vật 16×16 theo hướng và nhịp bước */
export const characterArt = (id: CharacterId, dir: WorldDir, frame: 0 | 1 | 2, night: boolean) =>
  cached(`char:${id}:${dir}:${frame}`, 16, 16, (r) => {
    const look = LOOKS[id];
    const view = dir === 'left' || dir === 'right' ? 'side' : dir;
    const rows = [...(view === 'up' ? BODY_UP : view === 'down' ? BODY_DOWN : BODY_SIDE)];
    const [l14, l15] = LEGS[view === 'side' ? 'side' : 'front'][frame];
    rows[14] = l14;
    rows[15] = l15;
    for (const [i, row] of Object.entries(HATS[look.hat][view] ?? {})) rows[Number(i)] = row;
    if (dir === 'down') for (const [x, y, ch] of ITEMS[look.item]) rows[y] = setChar(rows[y], x, ch);
    const hat = look.hatColor ?? look.hair;
    const pal: Record<string, string> = {
      k: P.ink, h: look.hair, s: look.skin, e: '#1c1410', c: look.cloth, d: look.clothDark, a: look.accent, p: look.pants, f: '#3b2a1a',
      b: hat, n: hat, N: darker(hat, 0.8), K: hat, F: hat, G: '#efe4cc', w: '#f4f1ea',
      j: P.woodLight, J: P.woodDark, m: P.metal, M: P.metalDark, q: P.paper, r: P.red, u: P.straw, U: P.strawDark,
    };
    r.rect(4, 15, 8, 1, P.shadow);
    grid(r, rows, pal, 0, 0, dir === 'left');
  }, night);

// ---------------------------------------------------------------------- vật trên bản đồ
export type ObjectArtKind = 'post' | 'board' | 'orange' | 'flag' | 'scroll' | 'stake' | 'stake_done' | 'portal' | 'portal_locked' | 'ferry';

/** Bảng, cây cam, cờ, cuộn sử, cọc, cổng (mũi tên hướng phải – xoay khi vẽ), đò */
export const objectArt = (kind: ObjectArtKind, night: boolean) =>
  cached(`obj:${kind}`, 16, 16, (r) => {
    switch (kind) {
      case 'post':
        r.rect(5, 15, 6, 1, P.shadow);
        r.rect(7, 9, 2, 6, P.woodDark);
        r.rect(2, 3, 12, 7, P.woodDark);
        r.rect(3, 4, 10, 5, P.wood);
        r.rect(4, 5, 6, 1, P.woodDark);
        r.rect(4, 7, 8, 1, P.woodDark);
        return;
      case 'board':
        r.rect(1, 15, 14, 1, P.shadow);
        r.rect(1, 0, 14, 1, P.tile);
        r.rect(0, 1, 16, 2, P.tileDark);
        r.rect(2, 12, 2, 4, P.woodDark);
        r.rect(12, 12, 2, 4, P.woodDark);
        r.rect(1, 3, 14, 9, P.woodDark);
        r.rect(2, 4, 12, 7, P.paper);
        r.rect(3, 5, 8, 1, P.text);
        r.rect(3, 7, 9, 1, P.text);
        r.rect(3, 9, 6, 1, P.text);
        r.rect(11, 8, 2, 2, P.red);
        return;
      case 'orange':
        r.rect(3, 14, 10, 2, P.shadow);
        r.rect(7, 10, 2, 5, P.trunk);
        r.rect(5, 1, 6, 1, P.leafEdge);
        r.rect(3, 2, 10, 1, P.leaf);
        r.rect(2, 3, 12, 6, P.leaf);
        r.rect(3, 9, 10, 1, P.leafDark);
        r.rect(5, 10, 6, 1, P.leafDark);
        r.rect(3, 3, 3, 2, P.leafLight);
        for (const [ox, oy] of [[4, 5], [9, 3], [11, 6], [6, 8], [10, 8], [7, 5]]) {
          r.rect(ox, oy, 2, 2, P.orange);
          r.rect(ox, oy, 1, 1, P.orangeLight);
        }
        return;
      case 'flag':
        r.rect(1, 14, 6, 2, P.stone);
        r.rect(3, 0, 1, 1, P.gold);
        r.rect(3, 1, 1, 14, P.woodDark);
        r.rect(4, 1, 10, 7, P.red);
        r.rect(13, 2, 1, 6, P.redDark);
        r.rect(4, 7, 9, 1, P.redDark);
        for (const [gx, gy] of [[6, 3], [8, 3], [10, 3], [6, 5], [8, 5], [10, 5]]) r.rect(gx, gy, 1, 1, P.goldLight);
        return;
      case 'scroll':
        r.rect(3, 13, 10, 1, P.shadow);
        r.rect(4, 6, 8, 5, P.paper);
        r.rect(5, 7, 5, 1, P.text);
        r.rect(5, 9, 4, 1, P.text);
        r.rect(3, 5, 1, 7, P.woodDark);
        r.rect(12, 5, 1, 7, P.woodDark);
        r.rect(7, 6, 2, 5, P.red);
        r.rect(13, 2, 1, 1, P.goldLight);
        r.rect(2, 3, 1, 1, P.goldLight);
        r.rect(12, 13, 1, 1, P.goldLight);
        return;
      case 'stake':
        r.rect(2, 13, 12, 1, P.waterLight);
        r.rect(4, 12, 8, 1, P.foam);
        r.rect(7, 4, 1, 9, '#b45309');
        r.rect(8, 4, 4, 3, P.red);
        r.rect(8, 7, 2, 1, P.redDark);
        return;
      case 'stake_done':
        for (const [sx, top] of [[3, 6], [7, 3], [11, 7]]) {
          r.rect(sx - 1, 13, 4, 1, P.foam);
          r.rect(sx, top, 2, 13 - top, P.woodDark);
          r.rect(sx, top, 1, 13 - top, P.wood);
          r.rect(sx, top - 1, 1, 1, P.woodDark);
        }
        return;
      case 'portal': {
        const arrow = (r2: Raster, ox: number) => {
          for (let i = 0; i < 4; i++) {
            r2.rect(ox + i, 4 + i, 2, 1, P.gold);
            r2.rect(ox + i, 11 - i, 2, 1, P.gold);
          }
          r2.rect(ox + 1, 4, 1, 1, P.goldLight);
          r2.rect(ox + 1, 11, 1, 1, P.goldLight);
        };
        arrow(r, 3);
        arrow(r, 8);
        return;
      }
      case 'portal_locked':
        r.rect(1, 14, 14, 1, P.shadow);
        r.rect(2, 4, 2, 11, P.woodDark);
        r.rect(12, 4, 2, 11, P.woodDark);
        r.rect(1, 6, 14, 2, P.red);
        r.rect(1, 10, 14, 2, P.red);
        for (const x of [4, 9]) r.rect(x, 6, 2, 2, P.paper);
        for (const x of [6, 11]) r.rect(x, 10, 2, 2, P.paper);
        return;
      case 'ferry':
        r.rect(2, 12, 12, 1, P.waterDark);
        r.rect(2, 8, 12, 3, P.woodDark);
        r.rect(3, 11, 10, 1, P.trunkDark);
        r.rect(1, 7, 2, 2, P.woodDark);
        r.rect(13, 7, 2, 2, P.woodDark);
        r.rect(5, 4, 6, 4, P.thatch);
        r.rect(5, 4, 6, 1, P.thatchDark);
        r.rect(5, 6, 6, 1, P.thatchDark);
        return;
    }
  }, night);

/** Đội thuyền giặc 32×32 */
export const bossArt = (night: boolean) =>
  cached('boss', 32, 32, (r) => {
    r.rect(3, 28, 27, 2, 'rgba(10,20,40,0.25)');
    r.rect(11, 2, 2, 18, P.woodDark);
    r.rect(13, 1, 7, 3, P.redDark);
    r.rect(4, 4, 15, 12, P.sail);
    for (const y of [7, 10, 13]) r.rect(4, y, 15, 1, P.hullDark);
    r.rect(4, 4, 1, 12, P.hullDark);
    r.rect(18, 13, 10, 6, P.hull);
    r.rect(18, 13, 10, 1, P.metalDark);
    r.rect(20, 15, 2, 2, P.lantern);
    r.rect(24, 15, 2, 2, P.lantern);
    r.rect(2, 19, 28, 2, P.woodDark);
    for (let i = 0; i < 7; i++) r.rect(1 + i, 21 + i, 30 - i * 2, 1, i < 2 ? P.hull : P.hullDark);
    for (const x of [5, 10, 15, 20, 25]) r.rect(x, 22, 2, 2, P.metalDark);
    r.rect(0, 17, 3, 3, P.hull);
  }, night);

/** Cây trên luống đất: 0 hạt, 1 mầm, 2 đang lớn, 3 chín */
export const cropArt = (crop: CropId, stage: number, night: boolean) =>
  cached(`crop:${crop}:${stage}`, 16, 16, (r) => {
    const spots = [[4, 6], [10, 6], [4, 12], [10, 12]];
    if (stage === 3 && crop === 'lua') {
      for (const x of [3, 7, 11]) {
        r.rect(x, 5, 1, 10, P.riceDark);
        r.rect(x + 1, 3, 1, 4, P.riceGold);
        r.rect(x + 2, 5, 1, 3, P.riceGoldDark);
        r.rect(x - 1, 5, 1, 3, P.riceGold);
        r.rect(x, 2, 1, 2, P.riceGold);
      }
      return;
    }
    if (stage === 3 && crop === 'khoai') {
      for (const [x, y] of [[5, 11], [11, 11]]) {
        r.rect(x - 2, y, 4, 2, P.taro);
        r.rect(x - 1, y - 4, 2, 4, P.riceDark);
        r.rect(x - 4, y - 8, 8, 4, P.leafDark);
        r.rect(x - 3, y - 9, 6, 1, P.leaf);
        r.rect(x - 3, y - 7, 3, 1, P.leafLight);
      }
      return;
    }
    for (const [x, y] of spots) {
      if (stage === 0) {
        r.rect(x, y, 2, 1, P.soilLight);
        r.rect(x + 1, y - 1, 1, 1, '#e6d3a3');
      } else if (stage === 1) {
        r.rect(x + 1, y - 1, 1, 2, P.rice);
        r.rect(x, y - 2, 1, 1, P.riceLight);
        r.rect(x + 2, y - 2, 1, 1, P.riceLight);
      } else if (stage === 2) {
        r.rect(x + 1, y - 4, 1, 5, P.riceDark);
        r.rect(x - 1, y - 3, 2, 1, P.rice);
        r.rect(x + 2, y - 2, 2, 1, P.rice);
        r.rect(x + 1, y - 5, 1, 1, P.riceLight);
      } else {
        r.rect(x - 1, y - 4, 4, 4, P.leaf);
        r.rect(x, y - 5, 2, 1, P.leafLight);
        r.rect(x + 2, y - 2, 1, 2, '#a3d977');
        r.rect(x - 1, y - 1, 1, 2, '#a3d977');
      }
    }
  }, night);

/** Bong bóng trên đầu: việc chính (!), việc phụ (…), cảnh giác (!) đỏ, cây chín */
export const markerArt = (kind: 'quest' | 'side' | 'alert' | 'ripe') =>
  cached(`mark:${kind}`, 12, 12, (r) => {
    if (kind === 'ripe') {
      r.rect(5, 1, 2, 10, P.markGold);
      r.rect(1, 5, 10, 2, P.markGold);
      r.rect(3, 3, 6, 6, P.markGold);
      r.rect(5, 5, 2, 2, P.bubble);
      return;
    }
    r.rect(2, 0, 8, 1, P.bubbleInk);
    r.rect(1, 1, 10, 8, P.bubbleInk);
    r.rect(2, 9, 8, 1, P.bubbleInk);
    r.rect(5, 10, 2, 2, P.bubbleInk);
    r.rect(2, 1, 8, 8, P.bubble);
    r.rect(5, 9, 2, 1, P.bubble);
    if (kind === 'side') {
      for (const x of [2, 5, 8]) r.rect(x, 4, 2, 2, P.markTeal);
      return;
    }
    const c = kind === 'alert' ? P.markRed : P.markGold;
    r.rect(5, 2, 2, 4, c);
    r.rect(5, 7, 2, 1, c);
  }, false);
