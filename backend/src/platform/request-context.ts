/**
 * Ngữ cảnh yêu cầu và giới hạn tần suất (Sprint 11, HK.SYS.018, HK.AD.027): ghi địa chỉ IP và thiết bị cho lịch sử đăng nhập mà không phải truyền qua mọi hàm,
 * chặn lạm dụng theo IP (trước khi xác thực) và đếm số yêu cầu cho trang giám sát. Bộ đếm nằm trong bộ nhớ một máy chủ (đủ cho quy mô hiện tại; nhiều máy chủ
 * thì mỗi máy đếm riêng, cần Redis nếu mở rộng). Cửa sổ cố định theo phút: đơn giản, rẻ và đủ để chặn việc gọi dồn dập.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

export interface ReqContext { ip: string; ua: string }
export const requestContext = new AsyncLocalStorage<ReqContext>();

/**
 * Địa chỉ máy khách: phía sau proxy của Render lấy mục bên phải nhất của X-Forwarded-For (do proxy tin cậy ghi thêm, khách không giả được);
 * không có proxy (chạy trên máy, kiểm thử) thì dùng địa chỉ kết nối.
 */
export function clientIp(req: Request): string {
  const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const ip = forwarded.length ? forwarded[forwarded.length - 1] : req.socket?.remoteAddress ?? '';
  return ip.replace(/^::ffff:/, '').slice(0, 64) || 'không rõ';
}

export const currentContext = (): ReqContext | undefined => requestContext.getStore();

type Counter = { total: number; client_errors: number; server_errors: number; rate_limited: number };

export class RateLimiter {
  private readonly windows = new Map<string, { minute: number; n: number }>();
  private readonly history = new Map<number, Counter>();
  private lastSweep = 0;

  /** Trả số giây phải chờ nếu vượt giới hạn, ngược lại 0 */
  hit(key: string, limit: number): number {
    const now = Date.now(), minute = Math.floor(now / 60_000);
    if (now - this.lastSweep > 120_000) this.sweep(minute);
    const w = this.windows.get(key);
    if (!w || w.minute !== minute) { this.windows.set(key, { minute, n: 1 }); return 0; }
    w.n += 1;
    return w.n > limit ? Math.max(1, 60 - Math.floor((now % 60_000) / 1000)) : 0;
  }

  private sweep(minute: number): void {
    this.lastSweep = Date.now();
    for (const [k, w] of this.windows) if (w.minute < minute) this.windows.delete(k);
    for (const m of this.history.keys()) if (m < minute - 30) this.history.delete(m);
  }

  record(status: number, limited = false): void {
    const minute = Math.floor(Date.now() / 60_000);
    const c = this.history.get(minute) ?? { total: 0, client_errors: 0, server_errors: 0, rate_limited: 0 };
    c.total += 1;
    if (limited) c.rate_limited += 1;
    else if (status >= 500) c.server_errors += 1;
    else if (status >= 400) c.client_errors += 1;
    this.history.set(minute, c);
  }

  /** Tổng số yêu cầu trong `windowMin` phút gần nhất */
  stats(windowMin = 15): Counter & { window_min: number } {
    const minute = Math.floor(Date.now() / 60_000);
    const out = { total: 0, client_errors: 0, server_errors: 0, rate_limited: 0, window_min: windowMin };
    for (const [m, c] of this.history) {
      if (m < minute - windowMin + 1) continue;
      out.total += c.total; out.client_errors += c.client_errors; out.server_errors += c.server_errors; out.rate_limited += c.rate_limited;
    }
    return out;
  }
}

export const limiter = new RateLimiter();

/** Mặc định khi cấu hình hệ thống để trống: biến môi trường, nếu không thì 600 / 300 / 20 mỗi phút */
const envInt = (name: string, fallback: number): number => { const v = Number(process.env[name]); return Number.isInteger(v) && v > 0 ? v : fallback; };
export const DEFAULT_RATE = { ip: () => envInt('RATE_IP_PER_MIN', 600), user: () => envInt('RATE_USER_PER_MIN', 300), ai: () => envInt('RATE_AI_PER_MIN', 20) };

/** Middleware: gắn ngữ cảnh, giới hạn theo IP và đếm yêu cầu; `ipLimit` đọc giới hạn hiện hành (cấu hình hệ thống hoặc mặc định) */
export function requestMiddleware(ipLimit: () => Promise<number>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ctx: ReqContext = { ip: clientIp(req), ua: String(req.headers['user-agent'] ?? '').slice(0, 200) };
    const skip = req.method === 'OPTIONS' || req.path === '/api/health' || req.path === '/' || req.path === '/api/database/health';
    res.on('finish', () => { if (!skip) limiter.record(res.statusCode, res.statusCode === 429 && res.getHeader('x-rate-limit') === 'ip'); });
    requestContext.run(ctx, () => {
      if (skip) { next(); return; }
      ipLimit().then((limit) => {
        const wait = limiter.hit(`ip:${ctx.ip}`, limit);
        if (wait > 0) {
          res.setHeader('Retry-After', String(wait));
          res.setHeader('x-rate-limit', 'ip');
          res.status(429).json({ detail: `Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau ${wait} giây.` });
          return;
        }
        next();
      }, () => next());
    });
  };
}
