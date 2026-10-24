/**
 * Gọi backend NestJS. Địa chỉ đặt bằng EXPO_PUBLIC_API_URL khi build (Vercel, EAS) hoặc trong frontend/.env khi chạy thử;
 * điện thoại chạy thử trên mạng LAN cần địa chỉ IP của máy tính (ví dụ http://192.168.1.10:8000), không dùng localhost.
 * Không bao giờ đặt chuỗi kết nối CSDL hay khóa bí mật vào biến EXPO_PUBLIC_*: chúng nằm công khai trong gói app.
 */
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

/** WebSocket phòng thi đấu cả lớp (token gửi trong tin nhắn đầu tiên, không đặt trên URL) */
export const LIVE_WS_URL = `${API_BASE_URL.replace(/^http/i, 'ws')}/api/live/ws`;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
  /** Hết thời gian chờ (gói miễn phí của Render cần ~1 phút để thức dậy) */
  timeoutMs?: number;
}

/** AbortSignal.timeout chưa có trên mọi bản React Native: tự hẹn giờ hủy */
const timeoutSignal = (ms: number) => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
};

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers: {
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: timeoutSignal(opts.timeoutMs ?? 75_000),
    });
  } catch {
    throw new ApiError(0, 'Không kết nối được máy chủ. Hãy kiểm tra mạng hoặc thử lại sau ít phút.');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? 'Dữ liệu chưa hợp lệ: ' + detail.map((d: { msg?: string }) => d.msg).join('; ')
          : `Máy chủ báo lỗi ${res.status}`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export const errorMessage = (err: unknown, fallback = 'Đã có lỗi xảy ra, thử lại sau') => (err instanceof Error && err.message ? err.message : fallback);
