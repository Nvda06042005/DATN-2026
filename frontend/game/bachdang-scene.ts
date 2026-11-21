/**
 * Khúc sông Bạch Đằng nhìn từ trên xuống, chia ô: lạch sâu, bãi cạn, cửa sông nhánh, ghềnh đá, hai bờ. Mặt nước đổi theo con nước (cao: bãi cạn và cọc chìm khuất;
 * thấp: bãi cạn lộ, cọc nhô lên). Cảnh vẽ thuyền, cọc, vệt nước của thuyền nhẹ, các ô đi được và "bóng" vị trí thuyền địch sau lượt đuổi (do máy chủ tính sẵn),
 * rồi dựng hoạt ảnh từ sự kiện của máy chủ. Người chơi bấm vào ô; ý nghĩa của cú bấm do giao diện quyết định theo giai đoạn.
 */
import Phaser from 'phaser';
import type { BdEvent, BdUnit, BdView, XY } from '@/types/saga';
import type { GameBridge } from './bridge';
import { LOOKS, makeUnits } from './pixel';
import { ART_SCALE, makeMapUnits } from './cartographic-art';

export const BACHDANG_SIZE = { width: 960, height: 520 };
const CELL = 72;
const OX = 48;
const OY = 80;
const FONT = 'Manrope_800ExtraBold, "Segoe UI", sans-serif';
const cx = (x: number): number => OX + x * CELL + CELL / 2;
const cy = (y: number): number => OY + y * CELL + CELL / 2;
const key = (x: number, y: number): string => `${x},${y}`;

export type BdMode = { kind: 'none' } | { kind: 'stake' } | { kind: 'lure' } | { kind: 'ally'; unit: string };
interface Boat { unit: BdUnit; box: Phaser.GameObjects.Container; sprite: Phaser.GameObjects.Image; bar: Phaser.GameObjects.Graphics; icon: Phaser.GameObjects.Image; hp: number }

export class BachDangScene extends Phaser.Scene {
  private view!: BdView;
  private mode: BdMode = { kind: 'none' };
  private water!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private stakeLayer!: Phaser.GameObjects.Container;
  private ghostLayer!: Phaser.GameObjects.Container;
  private readonly boats = new Map<string, Boat>();
  private hover: string | null = null;
  /** Ô đang chọn bằng bàn phím (mũi tên / W A S D di chuyển, phím E chọn); bỏ khi người chơi chuyển sang dùng chuột hoặc chạm */
  private cursor: XY | null = null;
  private playing = false;
  private alive = true;
  private offs: Array<() => void> = [];

  constructor(private readonly bridge: GameBridge) { super('bachdang'); }

  create(): void {
    this.view = this.bridge.get<BdView>('bd:view')!;
    this.mode = this.bridge.get<BdMode>('bd:mode') ?? { kind: 'none' };
    makeUnits(this);
    makeMapUnits(this, LOOKS);
    for (const k of this.textures.getTextureKeys()) if (k.startsWith('map_')) this.textures.get(k).setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.banks();
    this.water = this.add.graphics().setDepth(1);
    this.stakeLayer = this.add.container(0, 0).setDepth(3);
    this.overlay = this.add.graphics().setDepth(4);
    this.ghostLayer = this.add.container(0, 0).setDepth(6);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { const c = this.cellAt(p.worldX, p.worldY); if (c && !this.playing) this.bridge.emit('bd:cell', { x: c[0], y: c[1], unit: this.unitAt(c[0], c[1])?.id ?? null }); });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { const c = this.cellAt(p.worldX, p.worldY); const k = c ? key(c[0], c[1]) : null; if (k !== this.hover || this.cursor) { this.cursor = null; this.hover = k; this.highlight(); } });
    this.input.on('gameout', () => { if (this.cursor) return; this.hover = null; this.highlight(); });
    const kb = this.input.keyboard;
    if (kb) {
      // phím chữ không chặn mặc định (vẫn gõ được vào ô nhập); phím mũi tên chặn để trang không cuộn khi đang chọn ô
      for (const [name, dx, dy] of [['LEFT', -1, 0], ['RIGHT', 1, 0], ['UP', 0, -1], ['DOWN', 0, 1], ['A', -1, 0], ['D', 1, 0], ['W', 0, -1], ['S', 0, 1]] as const) kb.addKey(name, name.length > 1).on('down', () => this.step(dx, dy));
      kb.addKey('E', false).on('down', () => { if (this.cursor && !this.playing && !this.typing()) this.bridge.emit('bd:cell', { x: this.cursor[0], y: this.cursor[1], unit: this.unitAt(this.cursor[0], this.cursor[1])?.id ?? null }); });
    }
    this.offs = [
      this.bridge.on('bd:view', (v: BdView) => { if (!this.playing) this.sync(v); }),
      this.bridge.on('bd:mode', (m: BdMode) => { this.mode = m; this.highlight(); }),
      this.bridge.on('bd:play', (p: { events: BdEvent[]; view: BdView }) => { void this.play(p.events, p.view); }),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.alive = false; this.offs.forEach((off) => off()); this.offs = []; });
    this.sync(this.view);
    this.bridge.emit('bd:ready');
  }

  private cellAt(wx: number, wy: number): XY | null {
    const x = Math.floor((wx - OX) / CELL), y = Math.floor((wy - OY) / CELL);
    return x >= 0 && y >= 0 && x < this.view.grid.w && y < this.view.grid.h ? [x, y] : null;
  }
  private typing(): boolean { return typeof document !== 'undefined' && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName ?? ''); }
  /** Di chuyển ô chọn bằng bàn phím; lần đầu bắt đầu từ thuyền nhẹ của ta (hoặc giữa khúc sông) */
  private step(dx: number, dy: number): void {
    if (this.playing || this.typing()) return;
    const bait = this.view.units.find((u) => u.side === 'ally' && u.role === 'bait' && ['free', 'slow', 'stuck'].includes(u.state));
    const from: XY = this.cursor ?? (bait ? [bait.x - dx, bait.y - dy] : [Math.floor(this.view.grid.w / 2) - dx, Math.floor(this.view.grid.h / 2) - dy]);
    this.cursor = [Math.max(0, Math.min(this.view.grid.w - 1, from[0] + dx)), Math.max(0, Math.min(this.view.grid.h - 1, from[1] + dy))];
    this.hover = key(this.cursor[0], this.cursor[1]);
    this.highlight();
  }
  private unitAt(x: number, y: number): BdUnit | undefined { return this.view.units.find((u) => ['free', 'slow', 'stuck'].includes(u.state) && u.x === x && u.y === y); }

  private banks(): void {
    const { width: w, height: h } = BACHDANG_SIZE;
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x8b956b, 1).fillRect(0, 0, w, h);
    g.fillStyle(0x7c8960, 1);
    for (let i = 0; i < 40; i++) g.fillRect((i * 97) % w, i % 2 ? 8 + ((i * 13) % 52) : h - 64 + ((i * 17) % 52), 16, 4);
    g.fillStyle(0x596f4c, 1);
    for (const [x, y, r] of [[90, 34, 26], [300, 22, 20], [560, 30, 24], [820, 26, 22], [180, 492, 24], [470, 500, 20], [720, 488, 26], [910, 498, 18]] as const) { g.fillCircle(x, y, r); g.fillCircle(x + r * 0.8, y + 4, r * 0.75); }
    // mũi tên hướng ra biển và hướng địch tới
    g.fillStyle(0x1e2a4a, 0.55).fillTriangle(930, 250, 912, 238, 912, 262);
  }

  /** Mặt nước theo con nước: nước càng thấp bãi cạn càng lộ; chưa từng thấy nước ròng thì mọi ô nước trông như nhau */
  private drawWater(): void {
    const g = this.water.clear();
    const level = this.view.tide.level;
    const sand = [0.86, 0.5, 0.14][level];
    this.view.grid.cells.forEach((row, y) => [...row].forEach((ch, x) => {
      const px = OX + x * CELL, py = OY + y * CELL;
      if (ch === 'b') { g.fillStyle(0x8b956b, 1).fillRect(px, py, CELL, CELL); g.fillStyle(0xc3b384, 1).fillRect(px, y < 2 ? py + CELL - 8 : py, CELL, 8); return; }
      g.fillStyle(ch === 'd' ? 0x5d8490 : 0x72959b, 1).fillRect(px, py, CELL, CELL);
      if (ch === 's' || ch === 'm') { g.fillStyle(0xcdbb8e, sand).fillRoundedRect(px + 4, py + 4, CELL - 8, CELL - 8, 14); g.fillStyle(0xac9b70, sand * 0.9); for (let i = 0; i < 5; i++) g.fillRect(px + 12 + ((i * 23 + x * 7) % 44), py + 14 + ((i * 17 + y * 11) % 40), 8, 3); }
      if (ch === 'm') { g.fillStyle(0x72959b, 1).fillRect(px + 20, y < 2 ? py - 80 : py + CELL, CELL - 40, 80); g.lineStyle(3, 0xe6ce87, 0.95).strokeRoundedRect(px + 5, py + 5, CELL - 10, CELL - 10, 12); }
      if (ch === 'r') { g.fillStyle(0x8f8a82, 1).fillCircle(px + 26, py + 40, 18).fillCircle(px + 48, py + 30, 16); g.fillStyle(0xbdb8ae, 1).fillCircle(px + 24, py + 34, 8); }
      g.lineStyle(1, 0xe2e2c9, ch === 'd' ? 0.25 : 0.4);
      for (let i = 0; i < 2; i++) { const wx = px + 10 + ((i * 31 + x * 13 + y * 5) % 40), wy = py + 16 + i * 30; g.lineBetween(wx, wy, wx + 18, wy); }
    }));
    if (this.view.grid.revealed) {
      const [a, b] = this.view.zone;
      g.lineStyle(3, 0xffffff, 0.75).strokeRoundedRect(OX + a * CELL + 2, OY + 2, (b - a + 1) * CELL - 4, this.view.grid.h * CELL - 4, 18);
    }
  }

  private drawStakes(): void {
    this.stakeLayer.removeAll(true);
    const level = this.view.tide.level;
    for (const [x, y] of this.view.stakes) for (const [dx, dy] of [[-18, -8], [0, 10], [18, -6], [-8, 20], [10, -22]]) {
      // nước cao: cọc chìm, chỉ người bày trận còn nhớ chỗ (hiện mờ); nước thấp: cọc nhô hẳn lên
      this.stakeLayer.add(this.add.image(cx(x) + dx, cy(y) + dy + (level === 2 ? 8 : 0), 'fx_stake').setScale(level === 0 ? 3 : 2.4).setAlpha(level === 2 ? 0.32 : level === 1 ? 0.8 : 1).setTint(level === 2 ? 0x9fd0ff : 0xffffff));
    }
  }

  private boat(u: BdUnit): Boat {
    const sprite = this.add.image(0, 14, this.textures.exists(`map_u_${u.sprite}`) ? `map_u_${u.sprite}` : 'map_u_thuyen').setOrigin(0.5, 0.75).setScale(2.1 / ART_SCALE).setFlipX(u.side === 'ally');
    const bar = this.add.graphics();
    const icon = this.add.image(18, -30, 'fx_alert').setScale(2).setVisible(false);
    const ring = this.add.ellipse(0, 22, 60, 18, 0x000000, 0.18);
    const box = this.add.container(cx(u.x), cy(u.y), [ring, sprite, bar, icon]).setDepth(10 + u.y);
    const b: Boat = { unit: u, box, sprite, bar, icon, hp: u.hp };
    this.boats.set(u.id, b);
    return b;
  }

  private dress(b: Boat): void {
    const u = b.unit, w = 46, ratio = Math.max(0, b.hp / u.max_hp);
    b.bar.clear();
    b.bar.fillStyle(0x1e2a4a, 0.9).fillRoundedRect(-w / 2 - 2, -34, w + 4, 9, 4);
    b.bar.fillStyle(u.side === 'ally' ? 0x34b354 : 0xef4040, 1).fillRoundedRect(-w / 2, -32, Math.max(2, w * ratio), 5, 2);
    if (u.flagship || u.key) b.bar.fillStyle(0xffd23f, 1).fillTriangle(-6, -44, 6, -44, 0, -36);
    b.sprite.setAngle(u.state === 'stuck' ? (u.side === 'enemy' ? -16 : 0) : 0).setTint(u.state === 'slow' ? 0xd9c58a : u.acted && u.side === 'ally' ? 0xb8c4d6 : 0xffffff);
    b.icon.setTexture(u.burn > 0 ? 'fx_flame' : 'fx_alert').setVisible(u.state === 'stuck' || u.burn > 0 || (u.chasing && this.view.phase === 'lure'));
  }

  private sync(v: BdView): void {
    this.view = v;
    this.drawWater();
    this.drawStakes();
    for (const u of v.units) {
      const on = ['free', 'slow', 'stuck'].includes(u.state);
      let b = this.boats.get(u.id);
      if (!on) { b?.box.setVisible(false); continue; }
      if (!b) b = this.boat(u);
      b.unit = u;
      b.hp = u.hp;
      b.box.setVisible(true).setAlpha(1).setPosition(cx(u.x), cy(u.y)).setDepth(10 + u.y);
      this.dress(b);
    }
    this.highlight();
  }

  /** Ô bấm được theo giai đoạn, vệt nước và bóng vị trí thuyền địch nếu thuyền nhẹ đi tới ô đang trỏ */
  private highlight(): void {
    const g = this.overlay.clear();
    this.ghostLayer.removeAll(true);
    const v = this.view;
    for (const [x, y] of v.trail) g.fillStyle(0xffffff, 0.75).fillCircle(cx(x), cy(y) + 24, 5);
    if (this.cursor && !this.playing && v.status === 'active') g.lineStyle(4, 0x1e2a4a, 1).strokeRect(OX + this.cursor[0] * CELL + 2, OY + this.cursor[1] * CELL + 2, CELL - 4, CELL - 4).lineStyle(2, 0xffffff, 1).strokeRect(OX + this.cursor[0] * CELL + 5, OY + this.cursor[1] * CELL + 5, CELL - 10, CELL - 10);
    if (this.playing || v.status !== 'active' || !v.options) return;
    const box = (x: number, y: number, color: number, alpha = 0.9, fill = 0.16): void => { g.fillStyle(color, fill).fillRoundedRect(OX + x * CELL + 6, OY + y * CELL + 6, CELL - 12, CELL - 12, 12); g.lineStyle(3, color, alpha).strokeRoundedRect(OX + x * CELL + 6, OY + y * CELL + 6, CELL - 12, CELL - 12, 12); };
    const ghosts = (list: Array<{ id: string; x: number; y: number }>): void => {
      for (const e of list) {
        const on = v.stakes.some(([sx, sy]) => sx === e.x && sy === e.y);
        const cur = v.units.find((u) => u.id === e.id);
        if (cur && cur.x === e.x && cur.y === e.y) continue;
        this.ghostLayer.add(this.add.image(cx(e.x), cy(e.y) + 14, 'map_u_e_thuyen').setOrigin(0.5, 0.75).setScale(2.1 / ART_SCALE).setAlpha(0.5).setTint(on ? 0x7ee28a : 0xffffff));
        this.ghostLayer.add(this.add.ellipse(cx(e.x), cy(e.y) + 22, 62, 20).setStrokeStyle(3, on ? 0x34b354 : 0xffffff, 0.95));
      }
    };
    if (this.mode.kind === 'stake' && 'stakeable' in v.options) {
      for (const [x, y] of v.options.stakeable) box(x, y, 0x34b354, this.hover === key(x, y) ? 1 : 0.55, this.hover === key(x, y) ? 0.3 : 0.08);
      for (const [x, y] of v.options.removable) if (this.hover === key(x, y)) box(x, y, 0xef4040, 1, 0.25);
    } else if (this.mode.kind === 'lure' && 'moves' in v.options) {
      for (const m of v.options.moves) box(m.to[0], m.to[1], m.hit ? 0xef4040 : 0xffd23f, this.hover === key(m.to[0], m.to[1]) ? 1 : 0.6, this.hover === key(m.to[0], m.to[1]) ? 0.32 : 0.1);
      const picked = v.options.moves.find((m) => key(m.to[0], m.to[1]) === this.hover);
      ghosts((picked ?? v.options.wait).enemies);
    } else if (this.mode.kind === 'ally' && 'allies' in v.options) {
      const unit = this.mode.unit;
      const mine = v.options.allies.find((a) => a.unit === unit);
      const self = v.units.find((u) => u.id === unit);
      for (const m of mine?.moves ?? []) if (!self || m.to[0] !== self.x || m.to[1] !== self.y) box(m.to[0], m.to[1], m.attack.length ? 0xff9a1f : 0xffd23f, this.hover === key(m.to[0], m.to[1]) ? 1 : 0.6, m.attack.length ? 0.22 : 0.1);
      if (self) { g.lineStyle(4, 0xffffff, 1).strokeCircle(cx(self.x), cy(self.y), 34); }
    }
  }

  private wait(ms: number): Promise<void> { return new Promise((resolve) => { this.time.delayedCall(ms, () => resolve()); }); }
  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> { return new Promise((resolve) => { this.tweens.add({ ...config, onComplete: () => resolve() }); }); }
  private float(x: number, y: number, label: string, color: string): void {
    const t = this.add.text(x, y - 40, label, { fontFamily: FONT, fontSize: '26px', color, stroke: '#1e2a4a', strokeThickness: 6 }).setOrigin(0.5).setDepth(9000);
    this.tweens.add({ targets: t, y: t.y - 40, alpha: 0, duration: 820, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }
  private hurt(b: Boat, dmg: number, hp: number): void { b.hp = hp; this.dress(b); if (dmg > 0) this.float(b.box.x, b.box.y, `-${dmg}`, '#ffffff'); this.tweens.add({ targets: b.box, x: b.box.x + 6, duration: 50, yoyo: true, repeat: 2 }); }

  private async one(e: BdEvent): Promise<void> {
    const a = e.unit ? this.boats.get(e.unit) : undefined;
    const b = e.target ? this.boats.get(e.target) : undefined;
    if (e.t === 'move' && a && e.path) {
      for (const [x, y] of e.path) { a.sprite.setFlipX(a.unit.side === 'ally' ? cx(x) >= a.box.x : cx(x) > a.box.x); await this.tween({ targets: a.box, x: cx(x), y: cy(y), duration: 150, ease: 'Linear' }); a.box.setDepth(10 + y); }
    } else if (e.t === 'spawn' && e.unit && e.at) {
      const unit = this.view.units.find((u) => u.id === e.unit);
      const made = a ?? (unit ? this.boat({ ...unit, x: e.at[0], y: e.at[1], state: 'free' }) : undefined);
      if (made) { made.box.setPosition(cx(e.at[0]), cy(e.at[1])).setVisible(true).setAlpha(0); this.dress(made); await this.tween({ targets: made.box, alpha: 1, duration: 260 }); }
    } else if (e.t === 'attack' && a && b) {
      const ox = a.box.x, oy = a.box.y;
      await this.tween({ targets: a.box, x: ox + (b.box.x - ox) * 0.45, y: oy + (b.box.y - oy) * 0.45, duration: 130, yoyo: true });
      this.hurt(b, e.dmg ?? 0, e.hp ?? b.hp);
      await this.wait(240);
    } else if (e.t === 'stuck' && a) {
      a.unit = { ...a.unit, state: 'stuck' };
      this.hurt(a, e.dmg ?? 0, e.hp ?? a.hp);
      if (!this.bridge.get<boolean>('game:calm')) this.cameras.main.shake(160, 0.004);
      await this.wait(380);
    } else if (e.t === 'slow' && a) {
      a.unit = { ...a.unit, state: 'slow' };
      this.dress(a);
      await this.wait(160);
    } else if (e.t === 'refloat' && a) {
      a.unit = { ...a.unit, state: 'free' };
      this.dress(a);
    } else if (e.t === 'fire' && a && b) {
      const raft = this.add.image(a.box.x, a.box.y, 'fx_raft').setScale(3).setDepth(9000);
      await this.tween({ targets: raft, x: e.ok ? b.box.x : b.box.x + 60, y: e.ok ? b.box.y : b.box.y + 40, duration: 420, ease: 'Quad.easeIn' });
      if (e.ok) { this.hurt(b, e.dmg ?? 0, e.hp ?? b.hp); b.unit = { ...b.unit, burn: 2 }; this.dress(b); }
      await this.tween({ targets: raft, alpha: 0, duration: 260 });
      raft.destroy();
    } else if ((e.t === 'burn' || e.t === 'arrows') && (a ?? b)) {
      const t = (a ?? b)!;
      if (e.t === 'arrows') for (const dy of [-150, 150]) { const arrow = this.add.image(t.box.x - 20, t.box.y + dy, 'fx_arrow').setScale(3).setDepth(9000).setAngle(dy < 0 ? 80 : -80); this.tweens.add({ targets: arrow, y: t.box.y, duration: 200, onComplete: () => arrow.destroy() }); }
      await this.wait(e.t === 'arrows' ? 200 : 60);
      this.hurt(t, e.dmg ?? 0, e.hp ?? t.hp);
      await this.wait(200);
    } else if (e.t === 'sunk' && a) {
      await this.tween({ targets: a.box, alpha: 0, y: a.box.y + 18, angle: 20, duration: 420 });
      a.box.setVisible(false).setAngle(0);
    } else if (e.t === 'escape' && a) {
      await this.tween({ targets: a.box, x: BACHDANG_SIZE.width + 60, alpha: 0, duration: 520 });
      a.box.setVisible(false);
    } else if (e.t === 'provoke' && a) {
      for (const id of e.units ?? []) { const t = this.boats.get(id); if (!t) continue; const arrow = this.add.image(a.box.x, a.box.y - 10, 'fx_arrow').setScale(3).setDepth(9000).setFlipX(true); this.tweens.add({ targets: arrow, x: t.box.x, y: t.box.y - 10, duration: 260, onComplete: () => arrow.destroy() }); t.icon.setTexture('fx_alert').setVisible(true); }
      await this.wait(340);
    } else if (e.t === 'stake' && e.at) {
      this.view = { ...this.view, stakes: [...this.view.stakes, e.at] };
      this.drawStakes();
      await this.wait(120);
    } else if (e.t === 'unstake' && e.at) {
      this.view = { ...this.view, stakes: this.view.stakes.filter(([x, y]) => x !== e.at![0] || y !== e.at![1]) };
      this.drawStakes();
    } else if (e.t === 'tide' && e.level !== undefined) {
      this.view = { ...this.view, tide: { ...this.view.tide, level: e.level, label: e.label ?? this.view.tide.label } };
      this.drawWater();
      this.drawStakes();
      if (!this.bridge.get<boolean>('game:calm')) this.cameras.main.flash(180, 120, 190, 255);
      await this.wait(420);
    } else if (e.t === 'reveal') {
      this.view = { ...this.view, grid: { ...this.view.grid, revealed: true } };
    } else if (e.t === 'phase') await this.wait(200);
  }

  private async play(events: BdEvent[], view: BdView): Promise<void> {
    this.playing = true;
    this.highlight();
    // địa hình lộ ra ngay khi máy chủ báo đã thấy nước ròng (ô nước lúc trước chỉ là "w")
    if (view.grid.revealed && !this.view.grid.revealed) this.view = { ...this.view, grid: view.grid };
    for (const e of events) {
      if (!this.alive) return;
      this.bridge.emit('bd:event', e);
      await this.one(e);
    }
    if (!this.alive) return;
    this.playing = false;
    this.sync(view);
    this.bridge.emit('bd:played');
  }
}
