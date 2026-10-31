import { apiRequest } from '@/api/client';
import type { AppNotification, AuthSession, AuthUser, Portal, ProfileData, ProfilePatch } from '@/types/api';

/** Đăng nhập tại một trang; server kiểm tra vai trò khớp với trang ("app" = /portal: giáo viên hoặc học sinh) */
export const loginToPortal = (username: string, password: string, portal: Portal | 'app') =>
  apiRequest<AuthSession>('/api/auth/login', { body: { username, password, portal } });

/** Thông báo trong app (duyệt lớp, yêu cầu mở lớp...) */
export const getNotifications = (token: string) => apiRequest<{ unread: number; items: AppNotification[] }>('/api/auth/notifications', { token });

export const markNotificationsRead = (token: string) => apiRequest<{ ok: boolean }>('/api/auth/notifications/read', { token, body: {} });

/** Tài khoản của phiên đang lưu */
export const getMe = (token: string) => apiRequest<AuthUser>('/api/auth/me', { token });

/** Quên mật khẩu (mọi vai trò): server gửi mã OTP 6 chữ số (hiệu lực 5 phút) tới email của tài khoản; luôn trả ok để không lộ tài khoản nào có thật */
export const requestPasswordReset = (identifier: string) => apiRequest<{ ok: boolean }>('/api/auth/forgot-password', { body: { identifier } });

/** Đặt mật khẩu mới bằng mã OTP trong thư (dùng một lần, sai quá 5 lần thì vô hiệu) */
export const resetPassword = (identifier: string, otp: string, newPassword: string) =>
  apiRequest<{ ok: boolean }>('/api/auth/reset-password', { body: { identifier, otp, new_password: newPassword } });

/** Hồ sơ cá nhân: thông tin, trường, lớp và các trường vai trò được tự sửa */
export const getProfile = (token: string) => apiRequest<ProfileData>('/api/auth/profile', { token });

export const updateProfile = (token: string, body: ProfilePatch) => apiRequest<ProfileData>('/api/auth/profile', { token, method: 'PATCH', body });

/** Đổi mật khẩu; server trả phiên mới (token cũ hết hiệu lực) */
export const changePassword = (token: string, currentPassword: string, newPassword: string) =>
  apiRequest<AuthSession>('/api/auth/change-password', { token, body: { current_password: currentPassword, new_password: newPassword } });

/** Revoke the current access token on the server before clearing the local session. */
export const logout = (token: string) => apiRequest<{ ok: boolean }>('/api/auth/logout', { token, body: {} });
