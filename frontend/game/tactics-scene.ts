/**
 * Chiến trường của trận đánh theo lượt: hai phe dàn hai hàng (trước / sau), quân ta bên trái. Cảnh dựng hoạt ảnh từ danh sách sự kiện máy chủ trả về
 * (tiến đánh, bắn tên, trúng đòn, số sát thương, phòng thủ, bốc cháy, bị loại) rồi mới khớp lại với trạng thái chuẩn. Người chơi bấm vào đơn vị để chọn mục tiêu.
 * Cảnh không tự tính sát thương hay thắng thua: mọi con số đều lấy từ sự kiện của máy chủ.
 */
import Phaser from 'phaser';
import type { TacticsEvent, TacticsUnit, TacticsView } from '@/types/saga';
import type { GameBridge } from './bridge';
import { makeUnits, UNIT, unitTop } from './pixel';

export const TACTICS_SIZE = { width: 960, height: 540 };
/** Tâm đội hình theo chiều dọc và khoảng cách tối đa giữa hai đơn vị cùng cột */
const MID_Y = 334;
const GAP = 118;
const NEAREST = 1 as unknown as Phaser.Textures.FilterMode;
const COL = { ally: { front: 345, back: 175 }, enemy: { front: 615, back: 785 } } as const;
const FONT = 'Manrope_800ExtraBold, "Segoe UI", sans-serif';

/** `top`: tọa độ y (so với chân đơn vị) của đỉnh hình vẽ, để thanh sinh lực và biểu tượng trạng thái nằm ngay trên đầu đơn vị */
interface Piece { unit: TacticsUnit; box: Phaser.GameObjects.Container; sprite: Phaser.GameObjects.Image; bar: Phaser.GameObjects.Graphics; ring: Phaser.GameObjects.Ellipse; icons: Phaser.GameObjects.Container; hp: number; x: number; y: number; top: number }

export class TacticsScene extends Phaser.Scene {
  private view!: TacticsView;
  private readonly pieces = new Map<string, Piece>();
  private targets = new Set<string>();
  /** Tỉ lệ phóng hình đơn vị: cột càng đông càng thu nhỏ để giữa hai đơn vị còn chỗ cho thanh sinh lực */
  private S = 2.5;
  private playing = false;
  private alive = true;
  private offs: Array<() => void> = [];

  constructor(private readonly bridge: GameBridge) { super('tactics'); }

  create(): void {
    this.view = this.bridge.get<TacticsView>('tactics:view')!;
    makeUnits(this);
    for (const key of this.textures.getTextureKeys()) this.textures.get(key).setFilter(NEAREST);
    this.backdrop();
    this.layout();
    this.offs = [
      this.bridge.on('tactics:view', (v: TacticsView) => { if (!this.playing) this.sync(v); }),
      this.bridge.on('tactics:targets', (ids: string[]) => { this.targets = new Set(ids); this.rings(); }),
      this.bridge.on('tactics:play', (p: { events: TacticsEvent[]; view: TacticsView }) => { void this.play(p.events, p.view); }),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.alive = false; this.offs.forEach((off) => off()); this.offs = []; });
    this.sync(this.view);
    this.bridge.emit('tactics:ready');
  }

  private backdrop(): void {
    const { width: w, height: h } = TACTICS_SIZE;
    const g = this.add.graphics();
    g.fillGradientStyle(0x8fd3ff, 0x8fd3ff, 0xd9f2ff, 0xd9f2ff, 1).fillRect(0, 0, w, 210);
    g.fillStyle(0xa8d5b5, 1);
    for (const [x, r] of [[120, 120], [330, 90], [560, 130], [800, 100], [930, 80]] as const) g.fillEllipse(x, 215, r * 2, r * 1.5);
    g.fillStyle(0x8fd46b, 1).fillRect(0, 200, w, h - 200);
    g.fillStyle(0x7cc65a, 1);
    for (let i = 0; i < 26; i++) g.fillRect((i * 137) % w, 230 + ((i * 71) % 290), 18, 4);
    g.fillStyle(0xd9b77e, 0.55).fillRoundedRect(430, 210, 100, 320, 30);
    g.fillStyle(0xffffff, 0.9);
    for (const [x, y] of [[150, 60], [470, 40], [760, 80]] as const) { g.fillEllipse(x, y, 90, 28); g.fillEllipse(x + 30, y - 12, 60, 26); }
  }

  /** Vị trí từng đơn vị: mỗi phe hai cột (hàng trước gần giữa sân), các đơn vị cùng cột giãn đều theo chiều dọc */
  private layout(): void {
    const count = (side: string, row: string): number => this.view.units.filter((u) => u.side === side && u.row === row).length;
    const most = Math.max(1, ...(['ally', 'enemy'] as const).flatMap((side) => (['front', 'back'] as const).map((row) => count(side, row))));
    const gap = Math.min(GAP, 250 / Math.max(1, most - 1));
    this.S = most >= 5 ? 1.75 : most === 4 ? 2 : 2.5;
    const S = this.S;
    for (const side of ['ally', 'enemy'] as const) for (const row of ['front', 'back'] as const) {
      const list = this.view.units.filter((u) => u.side === side && u.row === row);
      list.forEach((u, i) => {
        const x = COL[side][row], y = MID_Y + (i - (list.length - 1) / 2) * gap;
        const ring = this.add.ellipse(0, 4, 34 * S, 10 * S, 0xffd23f, 0).setStrokeStyle(4, 0xffd23f, 0);
        const shade = this.add.ellipse(0, 4, 28 * S, 7 * S, 0x000000, 0.22);
        const key = this.textures.exists(`u_${u.sprite}`) ? `u_${u.sprite}` : side === 'ally' ? 'u_bo' : 'u_e_bo';
        const sprite = this.add.image(0, 6, key).setOrigin(0.5, 1).setScale(S).setFlipX(side === 'enemy');
        const bar = this.add.graphics();
        const top = 6 - (UNIT - unitTop(key)) * S;
        const icons = this.add.container(0, top - 30);
        // không đặt kích thước cho container: vùng bấm bên dưới tính đúng theo gốc của đơn vị (chân hình), không bị Phaser dịch đi nửa kích thước
        const box = this.add.container(x, y, [ring, shade, sprite, bar, icons]).setDepth(y);
        box.setInteractive(new Phaser.Geom.Rectangle(-55, -(32 * S + 12), 110, 34 * S + 22), Phaser.Geom.Rectangle.Contains);
        box.on('pointerdown', () => this.bridge.emit(this.targets.has(u.id) ? 'tactics:pick' : 'tactics:inspect', u.id));
        box.on('pointerover', () => { this.input.setDefaultCursor(this.targets.has(u.id) ? 'crosshair' : 'pointer'); });
        box.on('pointerout', () => { this.input.setDefaultCursor('default'); });
        this.pieces.set(u.id, { unit: u, box, sprite, bar, ring, icons, hp: u.hp, x, y, top });
      });
    }
  }

  private drawBar(p: Piece): void {
    const w = 78, ratio = Math.max(0, p.hp / p.unit.max_hp);
    p.bar.clear();
    p.bar.fillStyle(0x1e2a4a, 0.9).fillRoundedRect(-w / 2 - 2, p.top - 16, w + 4, 12, 5);
    p.bar.fillStyle(ratio > 0.5 ? 0x34b354 : ratio > 0.25 ? 0xffc93c : 0xef4040, 1).fillRoundedRect(-w / 2, p.top - 14, Math.max(2, w * ratio), 8, 4);
  }

  private drawIcons(p: Piece): void {
    p.icons.removeAll(true);
    const list: string[] = [];
    if (p.unit.guard || p.unit.fx.includes('cover')) list.push('fx_shield');
    if (p.unit.burn > 0) list.push('fx_flame');
    if (p.unit.fx.includes('rally')) list.push('fx_star');
    if (p.unit.fx.includes('stun') || p.unit.fx.includes('weak')) list.push('fx_alert');
    list.forEach((key, i) => p.icons.add(this.add.image((i - (list.length - 1) / 2) * 22, 0, key).setScale(2)));
  }

  private rings(): void {
    const actor = this.view.actor?.id ?? null;
    for (const [id, p] of this.pieces) {
      const target = this.targets.has(id);
      p.ring.setStrokeStyle(4, target ? 0xef4040 : 0xffd23f, target || id === actor ? 1 : 0);
      this.tweens.killTweensOf(p.ring);
      p.ring.setScale(1);
      if (target) this.tweens.add({ targets: p.ring, scale: 1.14, duration: 420, yoyo: true, repeat: -1 });
    }
  }

  /** Khớp cảnh với trạng thái chuẩn của máy chủ (sau khi hoạt ảnh xong, hoặc khi tải lại giữa trận) */
  private sync(v: TacticsView): void {
    this.view = v;
    for (const u of v.units) {
      const p = this.pieces.get(u.id);
      if (!p) continue;
      p.unit = u;
      p.hp = u.hp;
      p.box.setVisible(u.alive).setAlpha(1).setPosition(p.x, p.y);
      p.sprite.setAngle(0).clearTint();
      this.drawBar(p);
      this.drawIcons(p);
    }
    this.rings();
  }

  private wait(ms: number): Promise<void> { return new Promise((resolve) => { this.time.delayedCall(ms, () => resolve()); }); }
  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> { return new Promise((resolve) => { this.tweens.add({ ...config, onComplete: () => resolve() }); }); }

  private float(p: Piece, label: string, color: string): void {
    const t = this.add.text(p.x, p.y + p.top - 30, label, { fontFamily: FONT, fontSize: '30px', color, stroke: '#1e2a4a', strokeThickness: 6 }).setOrigin(0.5).setDepth(9000);
    this.tweens.add({ targets: t, y: t.y - 46, alpha: 0, duration: 820, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  private async struck(p: Piece, dmg: number, hp: number, tone = '#ffffff'): Promise<void> {
    p.hp = hp;
    this.drawBar(p);
    p.sprite.setTint(0xff6b6b);
    if (dmg > 0) this.float(p, `-${dmg}`, tone);
    await this.tween({ targets: p.box, x: p.x + (p.unit.side === 'ally' ? -10 : 10), duration: 60, yoyo: true, repeat: 1 });
    p.sprite.clearTint();
  }

  private async one(e: TacticsEvent): Promise<void> {
    const a = e.unit ? this.pieces.get(e.unit) : undefined;
    const b = e.target ? this.pieces.get(e.target) : undefined;
    if (e.t === 'attack' && a && b) {
      if (a.unit.ranged) {
        const arrow = this.add.image(a.x, a.y - 60, 'fx_arrow').setScale(3).setDepth(9000).setFlipX(a.unit.side === 'enemy');
        await this.tween({ targets: arrow, x: b.x, y: b.y - 50, duration: 230, ease: 'Quad.easeIn' });
        arrow.destroy();
      } else {
        const dir = a.unit.side === 'ally' ? 1 : -1;
        await this.tween({ targets: a.box, x: b.x - dir * 96, y: b.y, duration: 190, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: a.box, x: a.x, y: a.y, duration: 240, delay: 90, ease: 'Quad.easeInOut' });
      }
      await this.struck(b, e.dmg ?? 0, e.hp ?? b.hp, e.adv ? '#ffd23f' : e.guarded ? '#bfe0ff' : '#ffffff');
      await this.wait(160);
    } else if (e.t === 'skill' && a) {
      const flash = this.add.image(a.x, a.y - 60, 'fx_star').setScale(7).setDepth(9000).setAlpha(0.95);
      this.tweens.add({ targets: flash, scale: 12, alpha: 0, angle: 90, duration: 420, onComplete: () => flash.destroy() });
      await this.tween({ targets: a.box, y: a.y - 16, duration: 120, yoyo: true });
      for (const hit of e.hits ?? []) {
        const p = this.pieces.get(hit.id);
        if (!p) continue;
        if (hit.heal) { p.hp = hit.hp; this.drawBar(p); this.float(p, `+${hit.heal}`, '#7ee28a'); }
        else if (hit.dmg > 0) void this.struck(p, hit.dmg, hit.hp, '#ffd23f');
        else if (hit.status) this.float(p, hit.status === 'rally' ? '▲' : hit.status === 'cover' ? '◆' : '✦', '#ffd23f');
        await this.wait(110);
      }
      await this.wait(260);
    } else if (e.t === 'defend' && a) {
      const shield = this.add.image(a.x, a.y - 60, 'fx_shield').setScale(5).setDepth(9000);
      await this.tween({ targets: shield, scale: 7, alpha: 0, duration: 380 });
      shield.destroy();
    } else if (e.t === 'fx' && a) {
      const icon = this.add.image(a.x, a.y - 60, e.status === 'burn' ? 'fx_flame' : 'fx_alert').setScale(4).setDepth(9000);
      this.tweens.add({ targets: icon, y: icon.y - 26, alpha: 0, duration: 520, onComplete: () => icon.destroy() });
      await this.struck(a, e.dmg ?? 0, e.hp ?? a.hp, '#ffb347');
    } else if (e.t === 'skip' && a) {
      this.float(a, '✦ ✦', '#ffd23f');
      await this.wait(320);
    } else if (e.t === 'down' && a) {
      await this.tween({ targets: a.sprite, angle: a.unit.side === 'ally' ? -80 : 80, duration: 260 });
      await this.tween({ targets: a.box, alpha: 0, duration: 260 });
      a.box.setVisible(false);
    } else if (e.t === 'stratagem') {
      if (!this.bridge.get<boolean>('game:calm')) this.cameras.main.flash(260, 255, 210, 63);
      await this.wait(300);
    } else if (e.t === 'round') await this.wait(220);
  }

  private async play(events: TacticsEvent[], view: TacticsView): Promise<void> {
    this.playing = true;
    this.targets = new Set();
    this.rings();
    for (const e of events) {
      if (!this.alive) return;
      this.bridge.emit('tactics:event', e);
      await this.one(e);
    }
    if (!this.alive) return;
    this.playing = false;
    this.sync(view);
    this.bridge.emit('tactics:played');
  }
}
