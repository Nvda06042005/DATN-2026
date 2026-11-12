import type { AuthUser } from '@/types/api';

// Chỉ chứa kết quả API đã xác thực trong bộ nhớ, không đọc user/quyền từ localStorage.
const users = new Map<string, { user: AuthUser; checkedAt: number }>();
const pending = new Map<string, Promise<AuthUser>>();
const FRESH_MS = 30_000;
const DISPLAY_MS = 5 * 60_000;

export function peekVerifiedUser(token: string): AuthUser | null {
  const entry = users.get(token);
  return entry && Date.now() - entry.checkedAt < DISPLAY_MS ? entry.user : null;
}

export function rememberVerifiedUser(token: string, user: AuthUser): void {
  pending.delete(token); // Kết quả cũ đang chờ không được ghi đè phiên/hồ sơ mới.
  users.delete(token);
  users.set(token, { user, checkedAt: Date.now() });
  if (users.size > 32) users.delete(users.keys().next().value!);
}

export function forgetVerifiedUser(token: string): void {
  users.delete(token);
  pending.delete(token); // Một phản hồi muộn sau logout/401 không được phục hồi cache.
}

/** Gộp các lần /me đồng thời; chỉ kiểm tra nền nếu phiên vừa được xác thực. */
export function verifyUser(token: string, load: () => Promise<AuthUser>, force = false): Promise<AuthUser> {
  const entry = users.get(token);
  if (!force && entry && Date.now() - entry.checkedAt < FRESH_MS) return Promise.resolve(entry.user);
  const running = pending.get(token);
  if (running) return running;
  const request = load().then(user => {
    if (pending.get(token) === request) rememberVerifiedUser(token, user);
    return user;
  }).finally(() => { if (pending.get(token) === request) pending.delete(token); });
  pending.set(token, request);
  return request;
}
