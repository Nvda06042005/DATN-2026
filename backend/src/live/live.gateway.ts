import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { WebSocket, WebSocketServer } from 'ws';
import { AuthService } from '../auth/auth.service';
import { DatabaseService } from '../database/database.service';
import { Conn, ERRORS, LiveHub } from './live.hub';

const AUTH_TIMEOUT_MS = 10_000;
const MAX_MESSAGE_CHARS = 4096;

/**
 * WebSocket /api/live/ws cho phòng thi đấu cả lớp.
 * Tin nhắn đầu tiên phải là {"type": "auth", "token": ...} – token không đặt trên URL để không lộ trong log truy cập.
 */
@Injectable()
export class LiveGateway implements OnApplicationBootstrap, OnApplicationShutdown {
  private wss: WebSocketServer | null = null;

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly hub: LiveHub,
    private readonly auth: AuthService,
    private readonly db: DatabaseService,
  ) {}

  onApplicationBootstrap(): void {
    this.wss = new WebSocketServer({ server: this.adapterHost.httpAdapter.getHttpServer(), path: '/api/live/ws', maxPayload: 16 * 1024 });
    this.wss.on('connection', (ws) => this.onConnection(ws));
  }

  onApplicationShutdown(): void {
    for (const client of this.wss?.clients ?? []) client.terminate();
    this.wss?.close();
  }

  private reject(ws: WebSocket, code: 'auth' | 'role', closeCode: number): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'error', code, message: ERRORS[code] }));
    ws.close(closeCode);
  }

  private onConnection(ws: WebSocket): void {
    let conn: Conn | null = null;
    let authenticating = false;
    let sessionToken: string | null = null;
    const timer = setTimeout(() => !conn && this.reject(ws, 'auth', 4401), AUTH_TIMEOUT_MS);
    ws.on('error', () => undefined);
    ws.on('close', () => {
      clearTimeout(timer);
      if (conn) this.hub.detach(conn);
    });
    ws.on('message', async (data, isBinary) => {
      const text = isBinary ? '' : data.toString();
      if (!text || text.length > MAX_MESSAGE_CHARS) return;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(text);
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return;
      if (conn) {
        const fresh = sessionToken ? await this.auth.authenticate(sessionToken).catch(() => null) : null;
        if (!fresh || fresh.role !== conn.user.role || fresh.class_name !== conn.user.class_name) return this.reject(ws, 'auth', 4401);
        if (fresh.role === 'teacher' && fresh.school_id && msg.type === 'create') {
          const available = await this.db.query("SELECT 1 FROM app_classes WHERE teacher_id=$1 AND school_id=$2 AND class_code=$3 AND status='APPROVED' AND is_active",[fresh.id,fresh.school_id,fresh.class_name]);
          if (!available.length) { ws.send(JSON.stringify({type:'error',code:'no_class',message:'Lớp chưa được duyệt hoặc đã tạm ngưng.'})); return; }
        }
        return this.hub.handle(conn, msg);
      }
      if (authenticating) return;
      authenticating = true;
      const token = msg.type === 'auth' && typeof msg.token === 'string' && msg.token.length < 2048 ? msg.token : null;
      const user = token && this.db.ready ? await this.auth.authenticate(token).catch(() => null) : null;
      clearTimeout(timer);
      if (!user) return this.reject(ws, 'auth', 4401);
      if (user.role !== 'teacher' && user.role !== 'student') return this.reject(ws, 'role', 4403);
      if (ws.readyState !== WebSocket.OPEN) return;
      sessionToken = token;
      conn = new Conn(ws, user);
      this.hub.attach(conn);
    });
  }
}
