/** Địa chỉ API công khai do người vận hành cấu hình khi build. */
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, options: { body?: unknown; token?: string; timeoutMs?: number } = {}): Promise<T> {
  if (!API_BASE_URL) throw new ApiError(0, 'Chức năng đăng nhập chưa được kết nối máy chủ. Vui lòng liên hệ quản trị hệ thống.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 75_000);
  try {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        method: options.body === undefined ? 'GET' : 'POST',
        headers: {
          ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch {
      throw new ApiError(0, 'Không kết nối được máy chủ. Hãy kiểm tra mạng hoặc thử lại sau ít phút.');
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ApiError(response.status, typeof data?.detail === 'string' ? data.detail : `Máy chủ báo lỗi ${response.status}`);
    }
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

export const errorMessage = (error: unknown, fallback = 'Đã có lỗi xảy ra. Hãy thử lại sau.') => error instanceof Error ? error.message : fallback;
