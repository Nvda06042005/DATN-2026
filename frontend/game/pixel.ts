/**
 * Hình pixel của Hành trình Đông A, vẽ bằng mã ngay khi game khởi động (không dùng tệp ảnh ngoài): nhân vật thời Trần, gạch nền làng – doanh trại – bến sông,
 * thuyền chiến, voi, ngựa, cọc gỗ. Toàn bộ là hình tạm do dự án tự vẽ, thay được bằng bộ sprite chính thức sau này mà không đổi mã màn chơi (chỉ cần giữ tên texture).
 * Phong cách tham khảo ý tưởng nhân vật pixel của Claude-Office; không dùng mã hay hình của dự án đó.
 */
import type PhaserNS from 'phaser';

type Ctx = CanvasRenderingContext2D;
const px = (c: Ctx, color: string, x: number, y: number, w = 1, h = 1): void => { c.fillStyle = color; c.fillRect(x, y, w, h); };

// ---------------------------------------------------------------------- nhân vật (16 × 22, 3 hướng × 3 khung)
export const CHAR_W = 16;
export const CHAR_H = 22;
export type Dir = 'down' | 'up' | 'side';
export interface Look { skin: string; hair: string; robe: string; trim: string; belt: string; hat: 'bun' | 'band' | 'helmet' | 'non' | 'crown' | 'cap' | 'fur' | 'scarf'; hatColor: string; beard?: string; small?: boolean }

const SKIN = '#f6c9a0';
export const LOOKS: Record<string, Look> = {
  player: { skin: SKIN, hair: '#1f1a17', robe: '#d8322f', trim: '#f6c445', belt: '#2a3a6b', hat: 'band', hatColor: '#f6c445', small: true },
  youth: { skin: SKIN, hair: '#1f1a17', robe: '#2f7fd8', trim: '#ffffff', belt: '#b3261e', hat: 'band', hatColor: '#d8322f', small: true },
  boy: { skin: SKIN, hair: '#1f1a17', robe: '#8a6a3f', trim: '#c9a66b', belt: '#5b4326', hat: 'bun', hatColor: '#1f1a17', small: true },
  soldier: { skin: SKIN, hair: '#1f1a17', robe: '#8b5a2b', trim: '#c9a66b', belt: '#3b2a1a', hat: 'non', hatColor: '#d9b36a' },
  scout: { skin: SKIN, hair: '#1f1a17', robe: '#3f6b3a', trim: '#8fbf6a', belt: '#2a3a1f', hat: 'scarf', hatColor: '#2f4a2a' },
  general: { skin: SKIN, hair: '#1f1a17', robe: '#b3261e', trim: '#f6c445', belt: '#3b2a1a', hat: 'helmet', hatColor: '#c9a227', beard: '#1f1a17' },
  commander: { skin: SKIN, hair: '#1f1a17', robe: '#7a1f1a', trim: '#f6c445', belt: '#f6c445', hat: 'helmet', hatColor: '#f6c445', beard: '#2b2622' },
  king: { skin: SKIN, hair: '#1f1a17', robe: '#f2b90f', trim: '#b3261e', belt: '#b3261e', hat: 'crown', hatColor: '#f6c445' },
  scholar: { skin: SKIN, hair: '#1f1a17', robe: '#2f5fa8', trim: '#dfe8f7', belt: '#1c2f5a', hat: 'cap', hatColor: '#1c1c22' },
  elder: { skin: '#eebf96', hair: '#e8e4dc', robe: '#7a6a58', trim: '#d9cdb8', belt: '#4a3f33', hat: 'bun', hatColor: '#e8e4dc', beard: '#f0ede6' },
  villager: { skin: SKIN, hair: '#1f1a17', robe: '#6b4b2f', trim: '#a9825a', belt: '#3b2a1a', hat: 'scarf', hatColor: '#5b3a22' },
  woman: { skin: SKIN, hair: '#1f1a17', robe: '#7a3b5e', trim: '#e7c6d6', belt: '#f6c445', hat: 'scarf', hatColor: '#3b2a1a' },
  enemy: { skin: '#e9b98a', hair: '#1f1a17', robe: '#3f5a7a', trim: '#9fb4c9', belt: '#1f2f44', hat: 'fur', hatColor: '#6b5846', beard: '#1f1a17' },
};

function drawChar(c: Ctx, ox: number, oy: number, k: Look, dir: Dir, frame: number): void {
  const top = k.small ? 2 : 0;
  const y0 = oy + top;
  const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  // chân và bàn chân (bước: một chân nhấc, một chân duỗi)
  const legY = oy + 17, legH = 4;
  px(c, '#3a2a1f', ox + 5, legY + (step > 0 ? -1 : 0), 2, legH + (step > 0 ? 0 : 0));
  px(c, '#3a2a1f', ox + 9, legY + (step < 0 ? -1 : 0), 2, legH);
  px(c, '#1f1612', ox + 4 + (dir === 'side' ? 1 : 0), oy + 21 + (step > 0 ? -1 : 0), 3, 1);
  px(c, '#1f1612', ox + 9, oy + 21 + (step < 0 ? -1 : 0), 3, 1);
  // thân áo, viền và đai
  const bodyY = y0 + 10, bodyH = oy + 18 - bodyY;
  px(c, k.robe, ox + 4, bodyY, 8, bodyH);
  px(c, k.trim, ox + 7, bodyY, 2, bodyH - 2);
  px(c, k.belt, ox + 4, bodyY + Math.max(2, bodyH - 4), 8, 1);
  // tay (đánh tay theo bước chân)
  if (dir === 'side') { px(c, k.robe, ox + 7, bodyY + 1 + step, 3, 4); px(c, k.skin, ox + 8, bodyY + 5 + step, 2, 1); }
  else { px(c, k.robe, ox + 2, bodyY + 1 + step, 2, 4); px(c, k.robe, ox + 12, bodyY + 1 - step, 2, 4); px(c, k.skin, ox + 2, bodyY + 5 + step, 2, 1); px(c, k.skin, ox + 12, bodyY + 5 - step, 2, 1); }
  // đầu
  const hx = ox + (dir === 'side' ? 5 : 4), hw = dir === 'side' ? 7 : 8, hy = y0 + 3;
  px(c, k.skin, hx, hy, hw, 7);
  if (dir === 'up') px(c, k.hair, hx, hy, hw, 6);
  else {
    px(c, k.hair, hx, hy, hw, 2);
    if (dir === 'down') { px(c, '#1f1612', hx + 2, hy + 3, 1, 2); px(c, '#1f1612', hx + 5, hy + 3, 1, 2); px(c, '#e58a7a', hx + 1, hy + 5, 1, 1); px(c, '#e58a7a', hx + 6, hy + 5, 1, 1); }
    else { px(c, '#1f1612', hx + 5, hy + 3, 1, 2); px(c, k.hair, hx, hy + 2, 2, 3); }
    if (k.beard) px(c, k.beard, hx + (dir === 'side' ? 3 : 2), hy + 6, dir === 'side' ? 4 : 4, 2);
  }
  // mũ, khăn
  const hat = k.hatColor;
  if (k.hat === 'bun') px(c, hat, hx + 3, hy - 2, 2, 2);
  else if (k.hat === 'band') { px(c, k.hair, hx + 3, hy - 2, 2, 2); px(c, hat, hx - 0, hy + 1, hw, 1); if (dir !== 'down') px(c, hat, hx - 1, hy + 2, 1, 2); }
  else if (k.hat === 'scarf') { px(c, hat, hx, hy - 1, hw, 2); px(c, hat, hx + hw - 1, hy + 1, 1, 2); }
  else if (k.hat === 'non') { px(c, hat, hx - 2, hy, hw + 4, 1); px(c, hat, hx, hy - 1, hw, 1); px(c, hat, hx + 2, hy - 2, hw - 4, 1); px(c, '#b08a44', hx - 2, hy + 1, hw + 4, 1); }
  else if (k.hat === 'helmet') { px(c, hat, hx, hy - 1, hw, 3); px(c, '#b3261e', hx + 3, hy - 3, 2, 2); px(c, hat, hx - 1, hy + 2, 1, 3); px(c, hat, hx + hw, hy + 2, 1, 3); }
  else if (k.hat === 'crown') { px(c, hat, hx, hy - 1, hw, 2); px(c, hat, hx + 1, hy - 2, 1, 1); px(c, hat, hx + 3, hy - 3, 2, 2); px(c, hat, hx + hw - 2, hy - 2, 1, 1); px(c, '#b3261e', hx + 3, hy - 1, 2, 1); }
  else if (k.hat === 'cap') { px(c, hat, hx, hy - 1, hw, 3); px(c, hat, hx - 2, hy, 2, 1); px(c, hat, hx + hw, hy, 2, 1); }
  else if (k.hat === 'fur') { px(c, hat, hx - 1, hy - 1, hw + 2, 3); px(c, '#8a745e', hx - 1, hy + 2, 1, 3); px(c, '#8a745e', hx + hw, hy + 2, 1, 3); px(c, '#b3261e', hx + 3, hy - 2, 2, 1); }
}

/** Khung hình của một nhân vật: 0–2 nhìn xuống, 3–5 nhìn lên, 6–8 nhìn ngang (đứng, bước A, bước B) */
export function makeChar(scene: PhaserNS.Scene, key: string, look: Look): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, CHAR_W * 9, CHAR_H)!;
  const c = tex.getContext();
  (['down', 'up', 'side'] as Dir[]).forEach((dir, d) => { for (let f = 0; f < 3; f++) drawChar(c, (d * 3 + f) * CHAR_W, 0, look, dir, f); });
  for (let i = 0; i < 9; i++) tex.add(i, 0, i * CHAR_W, 0, CHAR_W, CHAR_H);
  tex.refresh();
}

// ---------------------------------------------------------------------- gạch nền và vật cản (16 × 16; vật cao 16 × 24)
export const TILE = 16;
const rnd = (seed: number): (() => number) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

function ground(c: Ctx, ox: number, base: string, specks: string[], seed: number, n = 14): void {
  px(c, base, ox, 0, TILE, TILE);
  const r = rnd(seed);
  for (let i = 0; i < n; i++) px(c, specks[Math.floor(r() * specks.length)], ox + Math.floor(r() * TILE), Math.floor(r() * TILE), 1, 1);
}

/** Ký hiệu trên bản đồ cảnh -> gạch nền bên dưới và vật đặt lên trên */
export const GROUND_OF: Record<string, string> = {
  '.': 'grass', ',': 'flower', '=': 'path', '_': 'stone', ':': 'sand', '+': 'plank', '~': 'water', '%': 'rice',
  T: 'grass', B: 'grass', H: 'grass', h: 'grass', '#': 'grass', R: 'grass', b: 'water', D: 'grass', f: 'grass', c: 'grass', W: 'grass', P: 'stone', w: 'stone', L: 'grass', S: 'sand', F: 'grass',
};
export const PROP_OF: Record<string, string> = { T: 'tree', B: 'bamboo', H: 'house', h: 'tent', '#': 'fence', R: 'rock', b: 'boat', D: 'drum', f: 'banner', c: 'sacks', W: 'well', P: 'pillar', w: 'hall', L: 'logs', S: 'stakes', F: 'fire' };

export function makeTiles(scene: PhaserNS.Scene): void {
  if (scene.textures.exists('tiles')) return;
  const names = ['grass', 'flower', 'path', 'stone', 'sand', 'plank', 'water', 'water2', 'rice'];
  const tex = scene.textures.createCanvas('tiles', TILE * names.length, TILE)!;
  const c = tex.getContext();
  names.forEach((name, i) => {
    const ox = i * TILE;
    if (name === 'grass') ground(c, ox, '#8fce6a', ['#7fbf5c', '#a3db7c', '#79b858'], 11);
    else if (name === 'flower') { ground(c, ox, '#8fce6a', ['#7fbf5c', '#a3db7c'], 12); px(c, '#fff3b0', ox + 3, 4, 2, 2); px(c, '#ffd6e7', ox + 10, 9, 2, 2); px(c, '#ffffff', ox + 7, 12, 1, 1); }
    else if (name === 'path') ground(c, ox, '#d9b77e', ['#c9a56a', '#e6c891', '#bf9a5e'], 13, 18);
    else if (name === 'stone') { ground(c, ox, '#cfc8bb', ['#bdb6a8', '#ddd7cb'], 14, 8); px(c, '#b3ac9e', ox, 0, TILE, 1); px(c, '#b3ac9e', ox, 0, 1, TILE); px(c, '#b3ac9e', ox + 8, 8, 8, 1); }
    else if (name === 'sand') ground(c, ox, '#f0dca0', ['#e3cc8a', '#f8eab8'], 15, 12);
    else if (name === 'plank') { px(c, '#a8743c', ox, 0, TILE, TILE); for (let y = 0; y < TILE; y += 4) px(c, '#7f5529', ox, y, TILE, 1); px(c, '#c08a4c', ox + 3, 1, 1, 2); px(c, '#c08a4c', ox + 11, 9, 1, 2); }
    else if (name === 'water' || name === 'water2') { px(c, '#3f9be0', ox, 0, TILE, TILE); const s = name === 'water' ? 0 : 4; px(c, '#7cc4f2', ox + 2 + s, 4, 5, 1); px(c, '#7cc4f2', ox + 9 - s / 2, 11, 4, 1); px(c, '#2f86cc', ox + 6, 8 - s / 2, 6, 1); }
    else { px(c, '#7fbf5c', ox, 0, TILE, TILE); for (let x = 1; x < TILE; x += 3) { px(c, '#d7e36a', ox + x, 3, 1, 4); px(c, '#d7e36a', ox + x + 1, 10, 1, 4); } px(c, '#5ea3c9', ox, 15, TILE, 1); }
  });
  names.forEach((name, i) => tex.add(name, 0, i * TILE, 0, TILE, TILE));
  tex.refresh();

  // vật đặt trên nền: mỗi vật một texture riêng để sắp xếp chồng lớp theo tọa độ y
  const prop = (key: string, w: number, h: number, draw: (c: Ctx) => void): void => { const t = scene.textures.createCanvas(key, w, h)!; draw(t.getContext()); t.refresh(); };
  prop('tree', 16, 26, (c2) => { px(c2, '#6b4423', 7, 16, 2, 9); px(c2, '#2f8a3e', 2, 4, 12, 12); px(c2, '#3fa84f', 3, 2, 10, 10); px(c2, '#58c26a', 5, 3, 5, 4); px(c2, '#256f31', 2, 13, 12, 3); });
  prop('bamboo', 16, 26, (c2) => { for (const x of [3, 8, 12]) { px(c2, '#5aa646', x, 2, 2, 23); for (let y = 6; y < 24; y += 5) px(c2, '#3f7f33', x, y, 2, 1); } px(c2, '#7fcf5a', 1, 3, 4, 2); px(c2, '#7fcf5a', 9, 1, 5, 2); px(c2, '#7fcf5a', 5, 7, 4, 2); });
  prop('house', 16, 26, (c2) => { px(c2, '#c9a56a', 2, 12, 12, 13); px(c2, '#8a5a2b', 6, 17, 4, 8); px(c2, '#d8b46a', 0, 6, 16, 7); px(c2, '#b8903f', 1, 4, 14, 3); px(c2, '#9a7630', 3, 2, 10, 2); px(c2, '#6b4423', 2, 12, 12, 1); });
  prop('tent', 16, 24, (c2) => { px(c2, '#e8dcc0', 2, 8, 12, 15); px(c2, '#cfbf9a', 0, 14, 16, 9); px(c2, '#b3261e', 3, 6, 10, 3); px(c2, '#8a1d17', 6, 3, 4, 3); px(c2, '#5b4326', 7, 15, 2, 8); px(c2, '#f6c445', 7, 1, 2, 2); });
  prop('fence', 16, 22, (c2) => { for (const x of [0, 4, 8, 12]) { px(c2, '#8a5a2b', x, 4, 3, 17); px(c2, '#6b4423', x, 4, 3, 1); px(c2, '#a8743c', x + 1, 2, 1, 2); } px(c2, '#6b4423', 0, 10, 16, 2); px(c2, '#6b4423', 0, 16, 16, 2); });
  prop('rock', 16, 16, (c2) => { px(c2, '#8f8a82', 2, 6, 12, 9); px(c2, '#a8a39a', 4, 4, 8, 4); px(c2, '#bdb8ae', 5, 5, 4, 2); px(c2, '#6f6a63', 2, 13, 12, 2); });
  prop('boat', 16, 20, (c2) => { px(c2, '#7a4a22', 1, 12, 14, 5); px(c2, '#5b3516', 2, 16, 12, 2); px(c2, '#a8743c', 2, 11, 12, 1); px(c2, '#5b3516', 7, 2, 1, 10); px(c2, '#d8322f', 8, 3, 5, 6); px(c2, '#f6c445', 9, 5, 3, 2); });
  prop('drum', 16, 20, (c2) => { px(c2, '#b3261e', 3, 8, 10, 9); px(c2, '#8a1d17', 3, 15, 10, 2); px(c2, '#f0dca0', 3, 6, 10, 3); px(c2, '#f6c445', 3, 10, 10, 1); px(c2, '#5b4326', 2, 17, 2, 3); px(c2, '#5b4326', 12, 17, 2, 3); });
  prop('banner', 16, 28, (c2) => { px(c2, '#5b4326', 3, 2, 1, 25); px(c2, '#d8322f', 4, 3, 10, 9); px(c2, '#b3261e', 4, 11, 10, 1); px(c2, '#f6c445', 7, 5, 4, 5); px(c2, '#d8322f', 8, 6, 2, 3); px(c2, '#f6c445', 2, 1, 3, 2); });
  prop('sacks', 16, 18, (c2) => { px(c2, '#d9c08a', 1, 8, 7, 9); px(c2, '#d9c08a', 8, 9, 7, 8); px(c2, '#e8d4a3', 4, 3, 8, 7); px(c2, '#b89a5e', 1, 15, 14, 2); px(c2, '#8a6a3f', 7, 4, 2, 1); px(c2, '#8a6a3f', 3, 9, 2, 1); });
  prop('well', 16, 20, (c2) => { px(c2, '#8f8a82', 2, 10, 12, 9); px(c2, '#2f86cc', 4, 11, 8, 3); px(c2, '#6f6a63', 2, 17, 12, 2); px(c2, '#6b4423', 3, 2, 1, 9); px(c2, '#6b4423', 12, 2, 1, 9); px(c2, '#8a5a2b', 2, 1, 12, 2); });
  prop('pillar', 16, 28, (c2) => { px(c2, '#b3261e', 5, 3, 6, 23); px(c2, '#8a1d17', 9, 3, 2, 23); px(c2, '#f6c445', 4, 1, 8, 3); px(c2, '#8f8a82', 3, 25, 10, 3); });
  prop('hall', 16, 24, (c2) => { px(c2, '#b3261e', 0, 10, 16, 14); px(c2, '#8a1d17', 0, 20, 16, 4); px(c2, '#3f6b5a', 0, 2, 16, 8); px(c2, '#2f5246', 0, 8, 16, 2); px(c2, '#f6c445', 0, 10, 16, 1); for (let x = 2; x < 16; x += 4) px(c2, '#4f8270', x, 3, 1, 5); });
  prop('logs', 16, 16, (c2) => { for (const [x, y] of [[1, 9], [6, 9], [11, 9], [3, 4], [8, 4]]) { px(c2, '#8a5a2b', x, y, 5, 5); px(c2, '#c9a56a', x + 1, y + 1, 3, 3); px(c2, '#6b4423', x + 2, y + 2, 1, 1); } });
  prop('stakes', 16, 24, (c2) => { for (const [x, h] of [[2, 18], [6, 21], [10, 19], [13, 16]]) { px(c2, '#6b4423', x, 24 - h + 3, 2, h - 3); px(c2, '#8a5a2b', x, 24 - h + 1, 2, 2); px(c2, '#a8743c', x, 24 - h, 1, 1); } });
  prop('fire', 16, 18, (c2) => { px(c2, '#5b4326', 2, 14, 12, 3); px(c2, '#6f6a63', 1, 15, 2, 2); px(c2, '#6f6a63', 13, 15, 2, 2); px(c2, '#f58a1f', 5, 7, 6, 8); px(c2, '#ffd23f', 6, 9, 4, 6); px(c2, '#f58a1f', 7, 4, 2, 3); px(c2, '#fff3b0', 7, 11, 2, 3); });
  // vật nhặt được
  prop('it_plank', 16, 16, (c2) => { px(c2, '#a8743c', 1, 6, 14, 5); px(c2, '#7f5529', 1, 10, 14, 1); px(c2, '#c08a4c', 3, 7, 4, 1); px(c2, '#5b3516', 12, 7, 1, 2); });
  prop('it_rice', 16, 16, (c2) => { px(c2, '#e8d4a3', 3, 4, 10, 11); px(c2, '#b89a5e', 3, 13, 10, 2); px(c2, '#8a6a3f', 6, 2, 4, 2); px(c2, '#b3261e', 6, 8, 4, 3); });
  prop('it_flag', 16, 16, (c2) => { px(c2, '#5b4326', 3, 1, 1, 14); px(c2, '#d8322f', 4, 2, 9, 7); px(c2, '#f6c445', 6, 4, 4, 3); });
  prop('it_scroll', 16, 16, (c2) => { px(c2, '#f8eab8', 3, 4, 10, 9); px(c2, '#b3261e', 2, 3, 12, 2); px(c2, '#b3261e', 2, 12, 12, 2); px(c2, '#8a6a3f', 5, 7, 6, 1); px(c2, '#8a6a3f', 5, 9, 4, 1); });
  prop('it_token', 16, 16, (c2) => { px(c2, '#f6c445', 4, 3, 8, 11); px(c2, '#c9a227', 4, 12, 8, 2); px(c2, '#b3261e', 6, 6, 4, 4); px(c2, '#5b4326', 7, 1, 2, 2); });
  prop('it_torch', 16, 16, (c2) => { px(c2, '#6b4423', 7, 7, 2, 8); px(c2, '#f58a1f', 5, 2, 6, 6); px(c2, '#ffd23f', 6, 3, 4, 4); });
  prop('it_horn', 16, 16, (c2) => { px(c2, '#e8dcc0', 3, 8, 8, 4); px(c2, '#cfbf9a', 10, 6, 4, 6); px(c2, '#8a6a3f', 2, 9, 1, 2); px(c2, '#b3261e', 6, 8, 1, 4); });
  prop('it_stake', 16, 16, (c2) => { px(c2, '#6b4423', 2, 7, 11, 3); px(c2, '#8a5a2b', 2, 7, 11, 1); px(c2, '#a8743c', 13, 8, 2, 1); px(c2, '#3b2a1a', 2, 7, 1, 3); });
  // dấu chỉ đường và bóng
  prop('marker', 12, 12, (c2) => { px(c2, '#ffd23f', 2, 1, 8, 5); px(c2, '#ffd23f', 3, 6, 6, 2); px(c2, '#ffd23f', 4, 8, 4, 2); px(c2, '#ffd23f', 5, 10, 2, 1); px(c2, '#b8860b', 2, 0, 8, 1); });
  prop('shadow', 12, 4, (c2) => { px(c2, 'rgba(0,0,0,0.28)', 1, 1, 10, 2); px(c2, 'rgba(0,0,0,0.28)', 3, 0, 6, 4); });
}

// ---------------------------------------------------------------------- đơn vị trận đánh và thuyền (32 × 32)
export const UNIT = 32;
type Paint = (c: Ctx) => void;

function soldier(c: Ctx, ox: number, oy: number, look: Look, weapon: 'spear' | 'bow' | 'sword' | 'none', flip = false): void {
  const tmp = { ...look };
  drawChar(c, ox, oy, tmp, 'side', 0);
  const wx = flip ? ox + 1 : ox + 11;
  if (weapon === 'spear') { px(c, '#6b4423', wx + 1, oy - 2, 1, 22); px(c, '#cfd6dc', wx, oy - 5, 3, 4); }
  else if (weapon === 'bow') { px(c, '#8a5a2b', wx + 2, oy + 6, 1, 10); px(c, '#8a5a2b', wx + 1, oy + 5, 1, 1); px(c, '#8a5a2b', wx + 1, oy + 16, 1, 1); px(c, '#e8dcc0', wx, oy + 6, 1, 10); }
  else if (weapon === 'sword') { px(c, '#cfd6dc', wx + 1, oy + 4, 1, 9); px(c, '#f6c445', wx, oy + 13, 3, 1); }
}

function boat(c: Ctx, hull: string, dark: string, sail: string, emblem: string | null, big: boolean): void {
  const w = big ? 28 : 22, x = (UNIT - w) / 2, y = 21;
  px(c, hull, x, y, w, 6); px(c, dark, x + 2, y + 5, w - 4, 2); px(c, dark, x, y, w, 1);
  px(c, hull, x - 1, y - 1, 3, 2); px(c, hull, x + w - 2, y - 1, 3, 2);
  px(c, '#4a3320', UNIT / 2 - 1, 3, 2, 18);
  if (big) { for (let i = 0; i < 4; i++) { px(c, sail, x + 4, 4 + i * 4, w - 9, 3); px(c, dark, x + 4, 7 + i * 4, w - 9, 1); } px(c, sail, x + w - 8, 9, 6, 9); }
  else { px(c, sail, UNIT / 2 + 1, 5, 9, 12); px(c, dark, UNIT / 2 + 1, 16, 9, 1); if (emblem) { px(c, emblem, UNIT / 2 + 3, 8, 5, 6); px(c, sail, UNIT / 2 + 4, 10, 3, 2); } }
  px(c, '#f6c445', UNIT / 2 - 1, 1, 4, 2);
}

const E: Look = LOOKS.enemy;
const UNIT_ART: Record<string, Paint> = {
  bo: (c) => { soldier(c, 3, 8, LOOKS.soldier, 'spear'); soldier(c, 13, 9, LOOKS.soldier, 'spear'); },
  cung: (c) => { soldier(c, 3, 8, LOOKS.scout, 'bow'); soldier(c, 13, 9, LOOKS.scout, 'bow'); },
  tuong: (c) => { soldier(c, 8, 8, LOOKS.general, 'sword'); px(c, '#5b4326', 5, 2, 1, 26); px(c, '#d8322f', 6, 3, 7, 6); px(c, '#f6c445', 8, 5, 3, 2); },
  vua: (c) => { soldier(c, 8, 9, LOOKS.king, 'none'); px(c, '#5b4326', 23, 3, 1, 26); px(c, '#f6c445', 15, 1, 15, 3); px(c, '#b3261e', 15, 4, 15, 1); },
  ky: (c) => { px(c, '#8a5a2b', 5, 17, 20, 7); px(c, '#6b4423', 6, 24, 3, 6); px(c, '#6b4423', 20, 24, 3, 6); px(c, '#8a5a2b', 23, 11, 5, 8); px(c, '#3b2a1a', 26, 13, 1, 1); px(c, '#3b2a1a', 3, 16, 3, 5); soldier(c, 8, 0, LOOKS.soldier, 'spear'); },
  voi: (c) => { px(c, '#8d8f96', 4, 12, 20, 13); px(c, '#7a7c83', 4, 22, 20, 3); px(c, '#8d8f96', 22, 9, 8, 10); px(c, '#8d8f96', 27, 18, 3, 9); px(c, '#f4f1e8', 24, 19, 3, 2); px(c, '#3b2a1a', 26, 12, 1, 1); for (const x of [6, 11, 16, 20]) px(c, '#6f7178', x, 25, 3, 5); px(c, '#b3261e', 7, 8, 13, 5); px(c, '#f6c445', 7, 12, 13, 1); soldier(c, 7, -6, LOOKS.soldier, 'spear'); },
  thuyen: (c) => boat(c, '#8a5a2b', '#5b3516', '#d8322f', '#f6c445', false),
  thuyen_nhe: (c) => { px(c, '#a8743c', 6, 22, 20, 4); px(c, '#7a4a22', 8, 25, 16, 2); px(c, '#4a3320', 15, 9, 1, 13); px(c, '#d8322f', 16, 10, 7, 8); px(c, '#f6c445', 18, 12, 3, 3); soldier(c, 3, 3, LOOKS.soldier, 'none'); },
  luong: (c) => { boat(c, '#7a5a3a', '#4a3320', '#c9b08a', null, true); px(c, '#e8d4a3', 8, 17, 5, 4); px(c, '#e8d4a3', 14, 17, 5, 4); px(c, '#e8d4a3', 20, 17, 4, 4); },
  e_bo: (c) => { soldier(c, 3, 8, E, 'spear'); soldier(c, 13, 9, E, 'sword'); },
  e_cung: (c) => { soldier(c, 3, 8, E, 'bow'); soldier(c, 13, 9, E, 'bow'); },
  e_tuong: (c) => { soldier(c, 8, 8, { ...E, robe: '#2a3a5a', trim: '#c9a227', hat: 'helmet', hatColor: '#9fb4c9' }, 'sword'); px(c, '#5b4326', 5, 2, 1, 26); px(c, '#2a3a5a', 6, 3, 7, 6); px(c, '#c9a227', 8, 5, 3, 2); },
  e_ky: (c) => { px(c, '#5a4636', 5, 17, 20, 7); px(c, '#3b2a1a', 6, 24, 3, 6); px(c, '#3b2a1a', 20, 24, 3, 6); px(c, '#5a4636', 23, 11, 5, 8); px(c, '#1f1612', 26, 13, 1, 1); px(c, '#1f1612', 3, 16, 3, 5); soldier(c, 8, 0, E, 'bow'); },
  e_thuyen: (c) => boat(c, '#5a4636', '#3b2a1a', '#b9a37e', null, true),
  e_luong: (c) => { boat(c, '#6a5a4a', '#3b2a1a', '#a89878', null, true); px(c, '#d9c08a', 8, 17, 5, 4); px(c, '#d9c08a', 14, 17, 5, 4); px(c, '#d9c08a', 20, 17, 4, 4); },
};

/** Dòng điểm ảnh trên cùng có hình của từng đơn vị (ô vẽ 32×32 nhưng lính bộ thấp hơn voi, thuyền): dùng để đặt thanh sinh lực sát ngay trên đầu hình */
const UNIT_TOP = new Map<string, number>();
export const unitTop = (key: string): number => UNIT_TOP.get(key) ?? 0;

export function makeUnits(scene: PhaserNS.Scene): void {
  for (const [key, paint] of Object.entries(UNIT_ART)) {
    if (scene.textures.exists(`u_${key}`)) continue;
    const tex = scene.textures.createCanvas(`u_${key}`, UNIT, UNIT)!;
    paint(tex.getContext());
    tex.refresh();
    const data = tex.getContext().getImageData(0, 0, UNIT, UNIT).data;
    let top = 0;
    scan: for (let y = 0; y < UNIT; y += 1) for (let x = 0; x < UNIT; x += 1) if (data[(y * UNIT + x) * 4 + 3] > 0) { top = y; break scan; }
    UNIT_TOP.set(`u_${key}`, top);
  }
  const fx = (key: string, w: number, h: number, draw: Paint): void => { if (scene.textures.exists(key)) return; const t = scene.textures.createCanvas(key, w, h)!; draw(t.getContext()); t.refresh(); };
  fx('fx_arrow', 10, 3, (c) => { px(c, '#5b4326', 0, 1, 8, 1); px(c, '#cfd6dc', 7, 0, 3, 3); px(c, '#b3261e', 0, 0, 2, 3); });
  fx('fx_flame', 10, 12, (c) => { px(c, '#f58a1f', 2, 3, 6, 9); px(c, '#ffd23f', 3, 6, 4, 6); px(c, '#f58a1f', 4, 0, 2, 3); px(c, '#fff3b0', 4, 8, 2, 3); });
  fx('fx_shield', 12, 12, (c) => { px(c, '#2f7fd8', 1, 1, 10, 7); px(c, '#2f7fd8', 2, 8, 8, 2); px(c, '#2f7fd8', 4, 10, 4, 2); px(c, '#bfe0ff', 3, 3, 3, 3); });
  fx('fx_star', 9, 9, (c) => { px(c, '#ffd23f', 4, 0, 1, 9); px(c, '#ffd23f', 0, 4, 9, 1); px(c, '#ffd23f', 2, 2, 5, 5); px(c, '#fff3b0', 3, 3, 3, 3); });
  fx('fx_alert', 6, 14, (c) => { px(c, '#e23d3d', 1, 0, 4, 9); px(c, '#e23d3d', 1, 11, 4, 3); px(c, '#ffffff', 2, 1, 1, 6); });
  fx('fx_stake', 6, 14, (c) => { px(c, '#6b4423', 2, 3, 3, 11); px(c, '#8a5a2b', 2, 2, 2, 2); px(c, '#a8743c', 2, 0, 1, 2); px(c, '#3b2a1a', 4, 5, 1, 9); });
  fx('fx_raft', 16, 12, (c) => { px(c, '#8a5a2b', 1, 8, 14, 3); px(c, '#6b4423', 1, 10, 14, 1); px(c, '#f58a1f', 4, 2, 8, 6); px(c, '#ffd23f', 6, 4, 4, 4); });
  fx('fx_ring', 16, 16, (c) => { c.strokeStyle = '#ffd23f'; c.lineWidth = 2; c.strokeRect(1, 1, 14, 14); });
}
