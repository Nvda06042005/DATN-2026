import { ApiError, apiRequest } from '@/api/client';
import type { AuthSession, AuthUser } from '@/types/auth';

function requireRootAdmin(user: AuthUser | null | undefined): AuthUser {
  if (!user || user.role !== 'root_admin') throw new ApiError(403, 'Tài khoản không có quyền đăng nhập cổng quản trị tổng.');
  return user;
}

function requireSession(session: AuthSession): AuthSession {
  requireRootAdmin(session?.user);
  if (!session.token || typeof session.token !== 'string') throw new ApiError(502, 'Máy chủ chưa trả về phiên đăng nhập hợp lệ.');
  return session;
}

export async function loginToPortal(username: string, password: string, portal: 'root_admin') {
  return requireSession(await apiRequest<AuthSession>('/api/auth/login', { body: { username, password, portal } }));
}

export async function getMe(token: string) {
  return requireRootAdmin(await apiRequest<AuthUser>('/api/auth/me', { token }));
}

export const requestPasswordReset = (identifier: string) => apiRequest<{ ok: boolean }>('/api/auth/forgot-password', { body: { identifier } });

export const resetPassword = (identifier: string, otp: string, newPassword: string) =>
  apiRequest<{ ok: boolean }>('/api/auth/reset-password', { body: { identifier, otp, new_password: newPassword } });

export async function changePassword(token: string, currentPassword: string, newPassword: string) {
  return requireSession(await apiRequest<AuthSession>('/api/auth/change-password', { token, body: { current_password: currentPassword, new_password: newPassword } }));
}

export const logout = (token: string) => apiRequest<{ ok: boolean }>('/api/auth/logout', { token, body: {} });
