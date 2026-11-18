/**
 * Giữ máy chủ Render luôn thức (18/11/2026, theo yêu cầu của người dùng). Gói miễn phí của Render cho dịch vụ ngủ sau 15 phút không có yêu cầu
 * từ bên ngoài; người vào lúc đó chờ khoảng 1 phút và AI phải nạp lại mô hình. Khi chạy trên Render (biến RENDER_EXTERNAL_URL do Render tự đặt),
 * máy chủ tự gọi địa chỉ công khai của chính mình `/api/health?warm=ai` mỗi 10 phút (lần đầu sau 1 phút): yêu cầu đi qua cổng công khai nên được tính
 * là có người dùng, đồng thời nạp lại mô hình AI nếu đang tắt. Lịch GitHub Actions `keep-alive.yml` là lớp dự phòng đánh thức máy chủ nếu nó lỡ ngủ
 * (lịch của GitHub không đảm bảo giờ chạy). Dùng gần hết 750 giờ miễn phí / tháng của tài khoản Render. Tắt bằng KEEP_ALIVE=off.
 */
import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';

export const KEEP_ALIVE_FIRST_MS = 60_000;
/** Trạng thái hiện ở /api/health (keep_alive) để kiểm chứng máy chủ đang tự gọi */
const state: { enabled: boolean; last_at: string | null; last_status: number | null } = { enabled: false, last_at: null, last_status: null };
export const keepAliveState = () => ({ ...state });
export const KEEP_ALIVE_MS = 10 * 60_000;

/** Địa chỉ tự gọi; null khi không chạy trên Render, đã tắt, hoặc địa chỉ không phải https hợp lệ */
export function keepAliveUrl(env: Record<string, string | undefined> = process.env): string | null {
  if ((env.KEEP_ALIVE ?? '').toLowerCase() === 'off') return null;
  const base = (env.RENDER_EXTERNAL_URL ?? '').trim().replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(base)) return null;
  return `${base}/api/health?warm=ai`;
}

@Injectable()
export class KeepAlive implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('KeepAlive');
  private first: NodeJS.Timeout | null = null;
  private timer: NodeJS.Timeout | null = null;

  onApplicationBootstrap(): void {
    const url = keepAliveUrl();
    if (!url) return;
    state.enabled = true;
    this.logger.log(`Tự gọi ${url} mỗi ${KEEP_ALIVE_MS / 60_000} phút để máy chủ không ngủ`);
    this.first = setTimeout(() => void this.ping(url), KEEP_ALIVE_FIRST_MS);
    this.timer = setInterval(() => void this.ping(url), KEEP_ALIVE_MS);
    this.first.unref?.();
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
  }

  /** Một lần gọi; trả mã HTTP hoặc null khi lỗi mạng (chỉ ghi cảnh báo, không làm dừng máy chủ) */
  async ping(url: string): Promise<number | null> {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { 'User-Agent': 'dong-a-keep-alive' } });
      if (res.status !== 200) this.logger.warn(`Tự gọi ${url}: HTTP ${res.status}`);
      Object.assign(state, { last_at: new Date().toISOString(), last_status: res.status });
      return res.status;
    } catch (e) {
      this.logger.warn(`Tự gọi ${url} lỗi: ${(e as Error).message}`);
      Object.assign(state, { last_at: new Date().toISOString(), last_status: null });
      return null;
    }
  }
}
