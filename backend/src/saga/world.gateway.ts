/**
 * Kênh thời gian thực của thế giới khối (Socket.IO, cùng đường dẫn /api/live/ws với phòng thi đấu, namespace `/world`): bạn cùng lớp thấy nhau đi lại,
 * thấy khối vừa đặt / ô vừa thu hoạch ngay lập tức, gửi tín hiệu nhanh cho nhau. Đăng nhập bằng cùng token như API; chỉ học sinh đang ở trong lớp mới vào
 * được phòng của lớp đó (máy chủ kiểm tra lại, không tin mã phòng của trình duyệt).
 *  - Máy khách → máy chủ: `world:join` {class_id, campaign_no} (có ack), `world:move` {x, z, ry}, `world:say` {code}, `world:leave`.
 *  - Máy chủ → máy khách: `world:joined`, `world:left`, `world:moved`, `world:said`, `world:block` (khối đặt / gỡ), `world:node` (ô tài nguyên chờ mọc lại).
 * Mọi thay đổi có ảnh hưởng tới nhiệm vụ đi qua API HTTP của phiên chơi (mã lệnh + số thứ tự, máy chủ chấm); kênh này chỉ phát lại, nên mất kết nối vẫn chơi
 * một mình được. Tín hiệu nhanh là các câu có sẵn (không có ô chat tự do).
 */
import { OnModuleDestroy } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import type { Subscription } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { DatabaseService, UserRow } from '../database/database.service';
import { SagaService } from './saga.service';
import { WorldHub } from './world.hub';

type Ack = { ok: true; data?: unknown } | { ok: false; error: string; status: number };
const roomName = (id: number) => `world:${id}`;
/** Tín hiệu nhanh có sẵn để phối hợp (không cho gõ chữ tự do giữa học sinh) */
export const WORLD_SAY = ['come', 'need_wood', 'need_bamboo', 'need_rice', 'done', 'thanks', 'wait_tide', 'go'] as const;

@WebSocketGateway({ path: '/api/live/ws', namespace: 'world', cors: { origin: true }, pingInterval: 10_000, pingTimeout: 8_000 })
export class WorldGateway implements OnGatewayInit, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer() server!: Namespace;
  private sub?: Subscription;
  private readonly lastMove = new Map<string, number>();

  constructor(private readonly hub: WorldHub, private readonly saga: SagaService, private readonly auth: AuthService, private readonly db: DatabaseService) {}

  afterInit(server: Namespace): void {
    server.use(async (socket, next) => {
      try {
        const token = String(socket.handshake.auth?.token ?? '').trim();
        const user = token ? await this.auth.authenticate(token) : null;
        if (!user || user.must_change_password || user.role !== 'student') return next(new Error('Phiên đăng nhập không hợp lệ hoặc không phải tài khoản học sinh'));
        socket.data.user = user;
        next();
      } catch {
        next(new Error('Không xác thực được kết nối'));
      }
    });
    this.sub = this.hub.changes.subscribe((c) => { this.server.to(roomName(c.room)).emit(c.event, c.data); });
  }

  onModuleDestroy(): void { this.sub?.unsubscribe(); }

  handleDisconnect(client: Socket): void { this.leave(client); this.lastMove.delete(client.id); }

  private leave(client: Socket): void {
    const room = client.data.room as number | undefined;
    if (!room) return;
    const p = this.hub.leave(room, client.id);
    client.leave(roomName(room));
    client.data.room = undefined;
    if (p && !this.hub.players(room).some((x) => x.id === p.id)) client.to(roomName(room)).emit('world:left', { id: p.id });
  }

  @SubscribeMessage('world:join')
  async join(@ConnectedSocket() client: Socket, @MessageBody() body: { class_id?: unknown; campaign_no?: unknown }): Promise<Ack> {
    const user = client.data.user as UserRow;
    try {
      const classId = Number(body?.class_id), campaignNo = Number(body?.campaign_no);
      if (!Number.isInteger(classId) || !Number.isInteger(campaignNo)) return { ok: false, error: 'Thiếu lớp hoặc phần của hành trình', status: 400 };
      const info = await this.db.withWorkspace(user, () => this.saga.worldPresence(user, classId, campaignNo));
      this.leave(client);
      client.join(roomName(info.room));
      client.data.room = info.room;
      const now = this.saga.worldNow();
      const me = { sid: client.id, id: user.id, name: info.name, look: info.look, x: info.spawn[0], z: info.spawn[1], ry: 0, at: now };
      this.hub.join(info.room, me);
      client.to(roomName(info.room)).emit('world:joined', { id: me.id, name: me.name, look: me.look, x: me.x, z: me.z, ry: 0 });
      return { ok: true, data: { room: info.room, me: user.id, server_now: now, players: this.hub.players(info.room).filter((p) => p.id !== user.id).map(({ sid: _sid, at: _at, ...p }) => p), nodes: this.hub.nodes(info.room, now) } };
    } catch (e) {
      const status = (e as { getStatus?: () => number }).getStatus?.() ?? 500;
      return { ok: false, error: status < 500 ? String((e as Error).message) : 'Chưa vào được thế giới chung. Em vẫn chơi một mình được.', status };
    }
  }

  @SubscribeMessage('world:move')
  move(@ConnectedSocket() client: Socket, @MessageBody() body: { x?: unknown; z?: unknown; ry?: unknown }): void {
    const room = client.data.room as number | undefined;
    if (!room) return;
    const x = Number(body?.x), z = Number(body?.z), ry = Number(body?.ry ?? 0);
    if (![x, z, ry].every(Number.isFinite) || x < 0 || z < 0 || x > 200 || z > 200) return;
    const now = Date.now();
    if (now - (this.lastMove.get(client.id) ?? 0) < 70) return; // tối đa ~14 lần / giây mỗi kết nối
    this.lastMove.set(client.id, now);
    const p = this.hub.move(room, client.id, Math.round(x * 100) / 100, Math.round(z * 100) / 100, Math.round(ry * 100) / 100, now);
    if (p) client.to(roomName(room)).volatile.emit('world:moved', { id: p.id, x: p.x, z: p.z, ry: p.ry });
  }

  @SubscribeMessage('world:say')
  say(@ConnectedSocket() client: Socket, @MessageBody() body: { code?: unknown }): Ack {
    const room = client.data.room as number | undefined;
    const code = String(body?.code ?? '');
    if (!room || !(WORLD_SAY as readonly string[]).includes(code)) return { ok: false, error: 'Tín hiệu không hợp lệ', status: 400 };
    this.server.to(roomName(room)).emit('world:said', { id: (client.data.user as UserRow).id, code });
    return { ok: true };
  }

  @SubscribeMessage('world:leave')
  leaveRoom(@ConnectedSocket() client: Socket): Ack { this.leave(client); return { ok: true }; }
}
