/**
 * Cảnh nhập vai khám phá: làng, doanh trại, bến sông, thềm điện, bãi đóng cọc thời Trần nhìn từ trên xuống, có chồng lớp theo chiều sâu (cảm giác 2.5D).
 * Người chơi đi bằng WASD / phím mũi tên hoặc chạm để đi; có vật cản, người, vật nhặt được và vùng kích hoạt; phím E (hoặc nút trên màn hình) để tương tác.
 * Cảnh chỉ lo di chuyển, va chạm và hoạt ảnh. Mọi điều kiện nhiệm vụ do máy chủ quyết định: cảnh báo cho giao diện "đang đứng cạnh ai", "đã bước vào vùng nào".
 */
import Phaser from 'phaser';
import type { ExploreEvent, ExploreView, XY } from '@/types/saga';
import type { GameBridge } from './bridge';
import { GROUND_OF, LOOKS, makeChar, makeTiles, PROP_OF, TILE } from './pixel';

const S = 2;
const T = TILE * S;
const COLS = 22;
const ROWS = 13;
const WALK = '.,=_:+';
const SPEED = 118;
export const EXPLORE_SIZE = { width: COLS * T, height: ROWS * T };

const NEAREST = 1 as unknown as Phaser.Textures.FilterMode;
const tileOf = (px: number): number => Math.floor(px / T);
const centerOf = (t: number): number => t * T + T / 2;

export class ExploreScene extends Phaser.Scene {
  private view!: ExploreView;
  private player!: Phaser.GameObjects.Sprite;
  private shadow!: Phaser.GameObjects.Image;
  private marker!: Phaser.GameObjects.Image;
  private blocked: boolean[][] = [];
  private readonly npcs = new Map<string, Phaser.GameObjects.Sprite>();
  private readonly items = new Map<string, Phaser.GameObjects.Image>();
  private readonly zones = new Map<string, Phaser.GameObjects.Rectangle>();
  private waters: Phaser.GameObjects.Image[] = [];
  private path: XY[] = [];
  private pending: string | null = null;
  private near: string | null = null;
  private zoneIn: string | null = null;
  private locked = false;
  private facing: 'down' | 'up' | 'side' = 'down';
  private walkTime = 0;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D' | 'E' | 'ENTER', Phaser.Input.Keyboard.Key>;
  private offs: Array<() => void> = [];

  constructor(private readonly bridge: GameBridge) { super('explore'); }

  create(): void {
    this.view = this.bridge.get<ExploreView>('explore:view')!;
    makeTiles(this);
    for (const key of new Set(['player', ...this.view.npcs.map((n) => n.sprite)])) makeChar(this, `ch_${key}`, LOOKS[key] ?? LOOKS.villager);
    for (const key of this.textures.getTextureKeys()) this.textures.get(key).setFilter(NEAREST);

    // nền, vật cản và lưới va chạm
    this.blocked = this.view.grid.map((row) => [...row].map((ch) => !WALK.includes(ch)));
    this.view.grid.forEach((row, y) => [...row].forEach((ch, x) => {
      const ground = this.add.image(x * T, y * T, 'tiles', GROUND_OF[ch] ?? 'grass').setOrigin(0).setScale(S).setDepth(0);
      if (ch === '~' || ch === 'b') this.waters.push(ground);
      const prop = PROP_OF[ch];
      if (prop) this.add.image(centerOf(x), (y + 1) * T, prop).setOrigin(0.5, 1).setScale(S).setDepth((y + 1) * T - 1);
    }));
    this.time.addEvent({ delay: 520, loop: true, callback: () => this.waters.forEach((w, i) => w.setFrame((Math.floor(this.time.now / 520) + i) % 2 ? 'water' : 'water2')) });

    for (const z of this.view.zones) {
      const [x, y, w, h] = z.rect;
      const color = z.kind === 'enemy' ? 0xef4040 : 0xffd23f;
      const rect = this.add.rectangle(x * T, y * T, w * T, h * T, color, 0.22).setOrigin(0).setStrokeStyle(2, color, 0.9).setDepth(1).setVisible(false);
      this.tweens.add({ targets: rect, alpha: { from: 0.35, to: 1 }, duration: 700, yoyo: true, repeat: -1 });
      this.zones.set(z.id, rect);
    }
    for (const n of this.view.npcs) {
      this.blocked[n.at[1]][n.at[0]] = true;
      this.add.image(centerOf(n.at[0]), (n.at[1] + 1) * T - 2, 'shadow').setScale(S).setDepth(2);
      const sprite = this.add.sprite(centerOf(n.at[0]), (n.at[1] + 1) * T - 3, `ch_${n.sprite}`, 0).setOrigin(0.5, 1).setScale(S).setDepth((n.at[1] + 1) * T);
      this.tweens.add({ targets: sprite, y: sprite.y - 2, duration: 620 + (n.at[0] * 37) % 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      sprite.setInteractive({ useHandCursor: true });
      this.npcs.set(n.id, sprite);
    }
    this.marker = this.add.image(0, 0, 'marker').setScale(S).setOrigin(0.5, 1).setDepth(9000).setVisible(false);
    this.tweens.add({ targets: this.marker, scale: S * 1.18, duration: 480, yoyo: true, repeat: -1 });

    const [sx, sy] = this.view.spawn;
    this.shadow = this.add.image(centerOf(sx), (sy + 1) * T - 2, 'shadow').setScale(S).setDepth(2);
    this.player = this.add.sprite(centerOf(sx), (sy + 1) * T - 4, 'ch_player', 0).setOrigin(0.5, 1).setScale(S);

    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    // phím chữ không chặn mặc định để vẫn gõ được vào ô nhập (ô hỏi Tiểu Tướng) khi game đang mở
    this.wasd = Object.fromEntries((['W', 'A', 'S', 'D', 'E', 'ENTER'] as const).map((k) => [k, kb.addKey(k, false)])) as ExploreScene['wasd'];
    this.wasd.E.on('down', () => this.interact());
    this.wasd.ENTER.on('down', () => this.interact());
    this.cursors.space?.on('down', () => this.interact());
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.tap(p.worldX, p.worldY));
    this.time.addEvent({ delay: 140, loop: true, callback: () => this.scan() });

    this.offs = [
      this.bridge.on('explore:view', (v: ExploreView) => this.sync(v)),
      this.bridge.on('explore:lock', (b: boolean) => { this.locked = b; if (b) { this.path = []; this.pending = null; } }),
      this.bridge.on('explore:press', () => this.interact()),
      this.bridge.on('explore:events', (events: ExploreEvent[]) => this.react(events)),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.offs.forEach((off) => off()); this.offs = []; });
    this.locked = Boolean(this.bridge.get<boolean>('explore:lock'));
    this.sync(this.view);
    this.bridge.emit('explore:ready');
  }

  /** Trạng thái mới từ máy chủ: vật đã nhặt biến mất, dấu chỉ đường và vùng đang cần tới đổi theo bước nhiệm vụ */
  private sync(v: ExploreView): void {
    const stepChanged = v.progress.step !== this.view.progress.step;
    this.view = v;
    const live = new Set(v.items.map((i) => i.id));
    for (const [id, img] of this.items) if (!live.has(id)) { const cell = this.cellOf(`item:${id}`); if (cell) this.blocked[cell[1]][cell[0]] = false; img.destroy(); this.items.delete(id); }
    for (const it of v.items) {
      if (this.items.has(it.id)) continue;
      this.blocked[it.at[1]][it.at[0]] = true;
      const img = this.add.image(centerOf(it.at[0]), (it.at[1] + 1) * T - 6, `it_${it.sprite}`).setOrigin(0.5, 1).setScale(S).setDepth((it.at[1] + 1) * T).setData('at', it.at);
      if (!this.textures.exists(`it_${it.sprite}`)) img.setTexture('it_scroll');
      this.tweens.add({ targets: img, y: img.y - 5, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.items.set(it.id, img);
    }
    const mark = v.current?.marker ?? null;
    for (const [id, rect] of this.zones) rect.setVisible(mark === `zone:${id}`);
    const at = mark ? this.cellOf(mark) : null;
    this.marker.setVisible(Boolean(at) && !mark!.startsWith('zone:'));
    if (at) this.marker.setPosition(centerOf(at[0]), at[1] * T - 14);
    // sang bước mới thì vùng đang đứng được báo lại (bước mới có thể cần đúng vùng này); cùng một bước thì không báo lặp
    if (stepChanged) this.zoneIn = null;
  }

  private cellOf(target: string): XY | null {
    const [kind, id] = target.split(':');
    if (kind === 'npc') return this.view.npcs.find((n) => n.id === id)?.at ?? null;
    if (kind === 'item') return (this.items.get(id)?.getData('at') as XY | undefined) ?? this.view.items.find((i) => i.id === id)?.at ?? null;
    const z = this.view.zones.find((x) => x.id === id);
    return z ? [z.rect[0] + Math.floor(z.rect[2] / 2), z.rect[1] + Math.floor(z.rect[3] / 2)] : null;
  }

  private react(events: ExploreEvent[]): void {
    for (const e of events) {
      const npc = e.who ? this.view.npcs.find((n) => n.name === e.who) : undefined;
      const sprite = npc ? this.npcs.get(npc.id) : undefined;
      if (sprite) this.tweens.add({ targets: sprite, scaleY: S * 1.12, duration: 110, yoyo: true, repeat: 1 });
      if (e.t === 'got' || e.t === 'gave' || e.t === 'right') this.tweens.add({ targets: this.player, scaleY: S * 1.15, duration: 120, yoyo: true });
      if (e.t === 'wrong' && !this.bridge.get<boolean>('game:calm')) this.cameras.main.shake(140, 0.004);
    }
  }

  private free(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < COLS && y < ROWS && !this.blocked[y][x]; }

  /** Đường ngắn nhất trên lưới (4 hướng) tới ô đích, hoặc tới ô trống cạnh đích khi đích là người / vật */
  private route(to: XY, adjacent: boolean): XY[] {
    const start: XY = [tileOf(this.player.x), tileOf(this.player.y - 6)];
    const goal = (x: number, y: number): boolean => (adjacent ? Math.max(Math.abs(x - to[0]), Math.abs(y - to[1])) <= 1 && this.free(x, y) : x === to[0] && y === to[1]);
    if (goal(start[0], start[1])) return [];
    const prev = new Map<string, string | null>([[`${start[0]},${start[1]}`, null]]);
    const queue: XY[] = [start];
    while (queue.length) {
      const [cx, cy] = queue.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = cx + dx, y = cy + dy, k = `${x},${y}`;
        if (prev.has(k) || !this.free(x, y)) continue;
        prev.set(k, `${cx},${cy}`);
        if (goal(x, y)) {
          const out: XY[] = [];
          for (let at: string | null = k; at && prev.get(at) !== null; at = prev.get(at) ?? null) out.unshift(at.split(',').map(Number) as XY);
          return out;
        }
        queue.push([x, y]);
      }
    }
    return [];
  }

  private tap(wx: number, wy: number): void {
    if (this.locked) return;
    const cell: XY = [tileOf(wx), tileOf(wy)];
    const hit = [...this.view.npcs.map((n) => ({ target: `npc:${n.id}`, at: n.at })), ...this.view.items.map((i) => ({ target: `item:${i.id}`, at: i.at }))]
      .find((o) => o.at[0] === cell[0] && (o.at[1] === cell[1] || o.at[1] === cell[1] + 1));
    if (hit) {
      this.pending = hit.target;
      this.path = this.route(hit.at, true);
      if (!this.path.length) this.interact();
      return;
    }
    this.pending = null;
    if (this.free(cell[0], cell[1])) this.path = this.route(cell, false);
  }

  /** Người / vật gần nhất trong tầm với (ô kề, kể cả chéo) và vùng đang đứng: chỉ báo cho giao diện khi có thay đổi */
  private scan(): void {
    const px = tileOf(this.player.x), py = tileOf(this.player.y - 6);
    let best: { target: string; name: string; d: number } | null = null;
    const consider = (target: string, name: string, at: XY): void => {
      const d = Math.max(Math.abs(at[0] - px), Math.abs(at[1] - py));
      if (d <= 1 && (!best || d < best.d || target === this.view.current?.marker)) best = { target, name, d };
    };
    for (const n of this.view.npcs) consider(`npc:${n.id}`, n.name, n.at);
    for (const i of this.view.items) consider(`item:${i.id}`, i.name, i.at);
    const found = best as { target: string; name: string } | null;
    if ((found?.target ?? null) !== this.near) {
      this.near = found?.target ?? null;
      this.bridge.emit('explore:near', found ? { target: found.target, name: found.name } : null);
    }
    const zone = this.view.zones.find((z) => px >= z.rect[0] && px < z.rect[0] + z.rect[2] && py >= z.rect[1] && py < z.rect[1] + z.rect[3])?.id ?? null;
    // chỉ ghi nhận "đã báo" khi thật sự báo được: đang khóa (đang đọc lời thoại) thì chờ mở khóa rồi báo, mỗi lần bước vào vùng chỉ báo một lần
    if (!zone) this.zoneIn = null;
    else if (zone !== this.zoneIn && !this.locked) { this.zoneIn = zone; this.bridge.emit('explore:zone', zone); }
  }

  private interact(): void {
    if (this.locked) return;
    const typing = typeof document !== 'undefined' && ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? '');
    if (typing) return;
    const target = this.pending ?? this.near;
    this.pending = null;
    if (!target) return;
    const at = this.cellOf(target);
    if (at) { const dx = centerOf(at[0]) - this.player.x; this.facing = Math.abs(dx) > T / 2 ? 'side' : at[1] * T < this.player.y - T ? 'up' : 'down'; this.player.setFlipX(dx < 0 && this.facing === 'side'); }
    this.bridge.emit('explore:interact', { target });
  }

  private canStand(x: number, y: number): boolean {
    // hộp va chạm ở bàn chân: rộng 14, cao 8 điểm ảnh
    for (const [ox, oy] of [[-7, -8], [7, -8], [-7, -1], [7, -1]]) if (!this.free(tileOf(x + ox), tileOf(y + oy))) return false;
    return true;
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    let vx = 0, vy = 0;
    if (!this.locked) {
      const typing = typeof document !== 'undefined' && ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? '');
      if (!typing) {
        if (this.cursors.left.isDown || this.wasd.A.isDown) vx -= 1;
        if (this.cursors.right.isDown || this.wasd.D.isDown) vx += 1;
        if (this.cursors.up.isDown || this.wasd.W.isDown) vy -= 1;
        if (this.cursors.down.isDown || this.wasd.S.isDown) vy += 1;
      }
      if (vx || vy) { this.path = []; this.pending = null; }
      else if (this.path.length) {
        const [tx, ty] = this.path[0];
        const dx = centerOf(tx) - this.player.x, dy = (ty + 1) * T - 4 - this.player.y;
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) { this.path.shift(); if (!this.path.length && this.pending) this.interact(); }
        else { vx = Math.abs(dx) < 2 ? 0 : Math.sign(dx); vy = Math.abs(dy) < 2 ? 0 : Math.sign(dy); }
      }
    }
    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      const len = Math.hypot(vx, vy);
      const nx = this.player.x + (vx / len) * SPEED * dt, ny = this.player.y + (vy / len) * SPEED * dt;
      if (this.canStand(nx, this.player.y)) this.player.x = nx;
      if (this.canStand(this.player.x, ny)) this.player.y = ny;
      this.facing = vx !== 0 ? 'side' : vy < 0 ? 'up' : 'down';
      if (vx !== 0) this.player.setFlipX(vx < 0);
      this.walkTime += delta;
    } else this.walkTime = 0;
    const base = this.facing === 'down' ? 0 : this.facing === 'up' ? 3 : 6;
    this.player.setFrame(base + (moving ? 1 + (Math.floor(this.walkTime / 150) % 2) : 0));
    this.player.setDepth(this.player.y);
    this.shadow.setPosition(this.player.x, this.player.y + 2);
  }
}
