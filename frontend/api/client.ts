/**
 * Gọi backend NestJS. Địa chỉ đặt bằng EXPO_PUBLIC_API_URL khi build (Vercel, EAS) hoặc trong frontend/.env khi chạy thử;
 * điện thoại chạy thử trên mạng LAN cần địa chỉ IP của máy tính (ví dụ http://192.168.1.10:8000), không dùng localhost.
 * Không bao giờ đặt chuỗi kết nối CSDL hay khóa bí mật vào biến EXPO_PUBLIC_*: chúng nằm công khai trong gói app.
 */
import { forgetVerifiedUser } from '@/lib/verified-session';

const DEV_API = typeof __DEV__ !== 'undefined' && __DEV__ ? 'http://localhost:8000' : '';
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || DEV_API).trim().replace(/\/+$/, '');

/** Bản chính thức không đoán địa chỉ máy chủ: thiếu cấu hình thì báo lỗi rõ ràng và không gửi thông tin đăng nhập đi đâu cả */
const NOT_CONFIGURED = 'Chức năng đăng nhập chưa được kết nối máy chủ. Vui lòng liên hệ quản trị hệ thống.';
const requireBase = (): void => {
  if (!API_BASE_URL) throw new ApiError(0, NOT_CONFIGURED);
};

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

const OFFLINE = 'Không kết nối được máy chủ. Hãy kiểm tra mạng hoặc thử lại sau ít phút.';

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  requireBase();
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
    throw new ApiError(0, OFFLINE);
  }
  return readResponse<T>(res, opts.token);
}

/** File người dùng chọn (expo-document-picker): web có đối tượng File, điện thoại có uri */
export interface PickedFile {
  name: string;
  mimeType: string;
  uri: string;
  size?: number;
  file?: Blob;
}

/** Gửi một file dạng multipart (trường "file"), ví dụ file Excel mẫu đã điền */
export async function apiUpload<T>(path: string, file: PickedFile, token: string, timeoutMs = 150_000): Promise<T> {
  requireBase();
  const form = new FormData();
  if (file.file) form.append('file', file.file, file.name);
  else form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form, signal: timeoutSignal(timeoutMs) });
  } catch {
    throw new ApiError(0, OFFLINE);
  }
  return readResponse<T>(res, token);
}

/** Nội dung văn bản của một API cần đăng nhập (ví dụ danh sách tài khoản CSV) */
export async function apiText(path: string, token: string): Promise<string> {
  requireBase();
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: timeoutSignal(60_000) });
  } catch {
    throw new ApiError(0, OFFLINE);
  }
  if (!res.ok) await readResponse(res, token);
  return res.text();
}

/** Authenticated file download: keep access tokens in headers, never put them in download URLs. */
export async function apiBlob(path:string,token:string,body?:unknown):Promise<Blob> {
  requireBase();
  let res:Response;
  try { res=await fetch(`${API_BASE_URL}${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:timeoutSignal(75_000)}); }
  catch { throw new ApiError(0,OFFLINE); }
  if(!res.ok) await readResponse(res, token);
  return res.blob();
}

async function readResponse<T>(res: Response, token?: string | null): Promise<T> {
  if (res.status === 401 && token) forgetVerifiedUser(token);
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
