/**
 * Trạng thái tạm thời của các phòng thế giới khối (mỗi phòng = một lớp × một cuộc kháng chiến), giữ trong bộ nhớ của tiến trình:
 *  - ai đang ở trong phòng, đứng ở đâu (chỉ để vẽ bạn cùng lớp; không dùng để chấm điểm);
 *  - ô tài nguyên vừa bị thu hoạch, mọc lại sau REGROW_MS (máy chủ khởi động lại thì mọi ô mọc lại ngay – không mất tiến độ của ai).
 * Khối đã đặt, túi đồ và tiến độ nhiệm vụ nằm trong PostgreSQL (hk_world_blocks, hk_saga_sessions). Dịch vụ gọi `publish` SAU KHI giao dịch đã ghi xong,
 * gateway phát lại cho cả phòng.
 */
import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { REGROW_MS } from './world';

export interface WorldPlayer { sid: string; id: number; name: string; look: Record<string, unknown>; x: number; z: number; ry: number; at: number }
export interface WorldChange { room: number; event: string; data: unknown }

@Injectable()
export class WorldHub {
  readonly changes = new Subject<WorldChange>();
  private readonly taken = new Map<number, Map<string, number>>();
  private readonly rooms = new Map<number, Map<string, WorldPlayer>>();

  nodeReady(room: number, x: number, z: number, now: number): boolean {
    const until = this.taken.get(room)?.get(`${x},${z}`);
    return !until || until <= now;
  }

  take(room: number, x: number, z: number, now: number): number {
    if (!this.taken.has(room)) this.taken.set(room, new Map());
    const until = now + REGROW_MS;
    this.taken.get(room)!.set(`${x},${z}`, until);
    return until;
  }

  /** Các ô còn đang chờ mọc lại (gửi kèm khi vào phòng); dọn luôn ô đã mọc */
  nodes(room: number, now: number): Array<{ x: number; z: number; until: number }> {
    const map = this.taken.get(room);
    if (!map) return [];
    const out: Array<{ x: number; z: number; until: number }> = [];
    for (const [key, until] of map) {
      if (until <= now) { map.delete(key); continue; }
      const [x, z] = key.split(',').map(Number);
      out.push({ x, z, until });
    }
    return out;
  }

  publish(room: number, event: string, data: unknown): void { this.changes.next({ room, event, data }); }

  join(room: number, p: WorldPlayer): void {
    if (!this.rooms.has(room)) this.rooms.set(room, new Map());
    this.rooms.get(room)!.set(p.sid, p);
  }

  leave(room: number, sid: string): WorldPlayer | null {
    const map = this.rooms.get(room);
    const p = map?.get(sid) ?? null;
    map?.delete(sid);
    if (map && !map.size) this.rooms.delete(room);
    return p;
  }

  move(room: number, sid: string, x: number, z: number, ry: number, now: number): WorldPlayer | null {
    const p = this.rooms.get(room)?.get(sid);
    if (!p) return null;
    Object.assign(p, { x, z, ry, at: now });
    return p;
  }

  players(room: number): WorldPlayer[] {
    // một học sinh mở hai thẻ chỉ hiện một nhân vật (lần cập nhật mới nhất)
    const best = new Map<number, WorldPlayer>();
    for (const p of this.rooms.get(room)?.values() ?? []) if (!best.has(p.id) || best.get(p.id)!.at < p.at) best.set(p.id, p);
    return [...best.values()];
  }

  online(room: number): number { return this.players(room).length; }
}
