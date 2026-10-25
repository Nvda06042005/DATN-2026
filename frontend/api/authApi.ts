import { apiRequest } from '@/api/client';
import type { AppNotification, AuthSession, AuthUser, Portal } from '@/types/api';

/** Đăng nhập tại một trang; server kiểm tra vai trò khớp với trang ("app" = /portal: giáo viên hoặc học sinh) */
export const loginToPortal = (username: string, password: string, portal: Portal | 'app') =>
  apiRequest<AuthSession>('/api/auth/login', { body: { username, password, portal } });

/** Thông báo trong app (duyệt lớp, yêu cầu mở lớp...) */
export const getNotifications = (token: string) => apiRequest<{ unread: number; items: AppNotification[] }>('/api/auth/notifications', { token });

export const markNotificationsRead = (token: string) => apiRequest<{ ok: boolean }>('/api/auth/notifications/read', { token, body: {} });

/** Tài khoản của phiên đang lưu */
export const getMe = (token: string) => apiRequest<AuthUser>('/api/auth/me', { token });

/** Đổi mật khẩu; server trả phiên mới (token cũ hết hiệu lực) */
export const changePassword = (token: string, currentPassword: string, newPassword: string) =>
  apiRequest<AuthSession>('/api/auth/change-password', { token, body: { current_password: currentPassword, new_password: newPassword } });
