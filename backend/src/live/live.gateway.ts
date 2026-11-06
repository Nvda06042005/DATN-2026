/**
 * Kênh thời gian thực của phòng thi đấu (Socket.IO, đường dẫn /api/live/ws; HK.SYS.016): đăng nhập bằng cùng token như API, phát câu hỏi, nhận đáp án,
 * cập nhật bảng điểm cho toàn phòng. Mọi lệnh có phản hồi (ack) và đều có API HTTP tương đương, nên mất WebSocket vẫn chơi tiếp được.
 *  - Máy chủ → máy khách: `live:state` (trạng thái riêng cho từng người xem), `live:answered` (số người đã trả lời).
 *  - Máy khách → máy chủ: `room:subscribe` (kèm `device_id`: một tài khoản chỉ vào từ một thiết bị), `room:leave`, `player:answer`, `player:profile`, `player:blur`, `host:command`.
 *  - Người bị loại nhận `live:kicked` và bị đưa ra khỏi kênh của phòng; phòng đã khóa không nhận kết nối mới của người chưa ở trong phòng (HK.SYS.023).
 * Trạng thái thật nằm trong PostgreSQL; gateway chỉ phát lại, nên khi kết nối lại máy khách gọi `room:subscribe` để nhận trạng thái mới nhất.
 */
import { HttpException } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { OnModuleDestroy } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import type { Subscription } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { UserRow } from '../database/database.service';
import { LiveService } from './live.service';

type Ack = { ok: true; data?: unknown } | { ok: false; error: string; status: number };
const roomName = (id: number) => `live:${id}`;

@WebSocketGateway({ path: '/api/live/ws', cors: { origin: true }, pingInterval: 10_000, pingTimeout: 8_000 })
export class LiveGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer() server!: Server;
  private sub?: Subscription;
  private readonly pendingState = new Map<number, NodeJS.Timeout>();
  private readonly pendingAnswered = new Map<number, NodeJS.Timeout>();

  constructor(private readonly live: LiveService, private readonly auth: AuthService) {}

  afterInit(server: Server): void {
    // Đăng nhập trước khi kết nối được chấp nhận để lệnh đầu tiên luôn có người dùng
    server.use(async (socket, next) => {
      try {
        const token = String(socket.handshake.auth?.token ?? '').trim();
        const user = token ? await this.auth.authenticate(token) : null;
        if (!user || user.must_change_password) return next(new Error('Phiên đăng nhập không hợp lệ hoặc đã hết hạn'));
        socket.data.user = user;
        socket.data.rooms = new Set<number>();
        next();
      } catch {
        next(new Error('Không xác thực được kết nối'));
      }
    });
    this.sub = this.live.changes.subscribe((c) => (c.kind === 'kick' ? void this.kick(c.roomId, c.userId ?? -1).catch(() => undefined) : this.schedule(c.roomId, c.kind)));
  }

  onModuleDestroy(): void {
    this.sub?.unsubscribe();
    for (const t of [...this.pendingState.values(), ...this.pendingAnswered.values()]) clearTimeout(t);
  }

  handleConnection(): void { /* việc xác thực đã làm ở middleware */ }

  async handleDisconnect(client: Socket): Promise<void> {
    const user = client.data.user as UserRow | undefined;
    const rooms = (client.data.rooms as Set<number> | undefined) ?? new Set<number>();
    if (!user) return;
    for (const id of rooms) {
      const others = (await this.server.in(roomName(id)).fetchSockets()).filter((s) => s.id !== client.id && (s.data.user as UserRow).id === user.id);
      if (!others.length) await this.live.setOnline(id, user.id, false).catch(() => undefined);
    }
  }

  private async kick(roomId: number, userId: number): Promise<void> {
    for (const s of await this.server.in(roomName(roomId)).fetchSockets()) {
      if ((s.data.user as UserRow).id !== userId) continue;
      s.emit('live:kicked', { room_id: roomId });
      s.leave(roomName(roomId));
    }
  }

  /** Gộp nhiều thay đổi dồn dập (cả lớp cùng vào phòng hay cùng trả lời) thành một lần phát */
  private schedule(roomId: number, kind: 'state' | 'answered'): void {
    const pending = kind === 'state' ? this.pendingState : this.pendingAnswered;
    if (pending.has(roomId)) return;
    const timer = setTimeout(() => {
      pending.delete(roomId);
      void (kind === 'state' ? this.broadcast(roomId) : this.broadcastAnswered(roomId)).catch(() => undefined);
    }, kind === 'state' ? 40 : 120);
    timer.unref?.();
    pending.set(roomId, timer);
  }

  private async broadcast(roomId: number): Promise<void> {
    const sockets = await this.server.in(roomName(roomId)).fetchSockets();
    if (!sockets.length) return;
    const views = await this.live.views(roomId, [...new Set(sockets.map((s) => (s.data.user as UserRow).id))]);
    for (const s of sockets) {
      const view = views.get((s.data.user as UserRow).id);
      if (view) s.emit('live:state', view);
    }
  }

  private async broadcastAnswered(roomId: number): Promise<void> {
    this.server.to(roomName(roomId)).emit('live:answered', { room_id: roomId, ...(await this.live.answeredCount(roomId)) });
  }

  private async guard(fn: () => Promise<unknown>): Promise<Ack> {
    try {
      return { ok: true, data: await fn() };
    } catch (e) {
      if (e instanceof HttpException) {
        const body = e.getResponse() as { detail?: unknown; message?: unknown } | string;
        const message = typeof body === 'string' ? body : String(body.detail ?? body.message ?? e.message);
        return { ok: false, error: message, status: e.getStatus() };
      }
      return { ok: false, error: 'Lỗi máy chủ, thử lại sau', status: 500 };
    }
  }

  private roomId(body: { room_id?: unknown }): number {
    const id = Number(body?.room_id);
    return Number.isInteger(id) ? id : -1;
  }

  @SubscribeMessage('room:subscribe')
  subscribe(@ConnectedSocket() client: Socket, @MessageBody() body: { room_id?: number; device_id?: string }): Promise<Ack> {
    return this.guard(async () => {
      const user = client.data.user as UserRow;
      const id = this.roomId(body);
      const role = await this.live.role(user, id);
      if (!role) throw new HttpException(await this.live.denial(user, id), 404);
      const device = typeof body.device_id === 'string' ? body.device_id.slice(0, 64) : '';
      if (device && role === 'player') {
        const others = (await this.server.in(roomName(id)).fetchSockets()).filter((s) => s.id !== client.id && (s.data.user as UserRow).id === user.id && s.data.device && s.data.device !== device);
        if (others.length) throw new HttpException('Tài khoản này đang tham gia phòng từ thiết bị khác. Hãy đóng thiết bị kia rồi thử lại sau vài giây', 409);
      }
      client.data.device = device;
      await client.join(roomName(id));
      (client.data.rooms as Set<number>).add(id);
      if (role === 'player') await this.live.setOnline(id, user.id, true);
      return (await this.live.views(id, [user.id])).get(user.id);
    });
  }

  @SubscribeMessage('room:leave')
  leave(@ConnectedSocket() client: Socket, @MessageBody() body: { room_id?: number }): Promise<Ack> {
    return this.guard(async () => {
      const user = client.data.user as UserRow;
      const id = this.roomId(body);
      await client.leave(roomName(id));
      (client.data.rooms as Set<number>).delete(id);
      const others = (await this.server.in(roomName(id)).fetchSockets()).filter((s) => (s.data.user as UserRow).id === user.id);
      if (!others.length) await this.live.setOnline(id, user.id, false);
      return { left: true };
    });
  }

  @SubscribeMessage('player:answer')
  answer(@ConnectedSocket() client: Socket, @MessageBody() body: { room_id?: number; q_index?: number; answer?: unknown }): Promise<Ack> {
    return this.guard(() => this.live.answer(client.data.user as UserRow, this.roomId(body), { answer: body.answer, q_index: body.q_index }));
  }

  @SubscribeMessage('player:profile')
  profile(@ConnectedSocket() client: Socket, @MessageBody() body: { room_id?: number; nickname?: string; avatar?: string }): Promise<Ack> {
    return this.guard(() => this.live.setProfile(client.data.user as UserRow, this.roomId(body), { nickname: body.nickname, avatar: body.avatar }));
  }

  /** Học sinh chuyển tab / thu nhỏ trình duyệt khi đang trả lời: giáo viên thấy cảnh báo trên màn hình điều khiển */
  @SubscribeMessage('player:blur')
  blur(@ConnectedSocket() client: Socket, @MessageBody() body: { room_id?: number; q_index?: number }): Promise<Ack> {
    return this.guard(() => this.live.blur(client.data.user as UserRow, this.roomId(body), body.q_index));
  }

  @SubscribeMessage('host:command')
  command(@ConnectedSocket() client: Socket, @MessageBody() body: { room_id?: number; action?: string }): Promise<Ack> {
    return this.guard(() => this.live.command(client.data.user as UserRow, this.roomId(body), String(body.action ?? '')));
  }
}
