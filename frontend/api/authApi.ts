import type { AuthSession, AuthUser, Portal } from '@/types/authType';
import { apiRequest } from '@/utils/http';

/** Đăng nhập tại một trang (học sinh / giáo viên / quản trị); server kiểm tra vai trò khớp với trang */
export const loginToPortal = (username: string, password: string, portal: Portal) =>
  apiRequest<AuthSession>('/api/auth/login', { body: { username, password, portal } });

/** Tài khoản của phiên đang lưu */
export const getMe = (token: string) => apiRequest<AuthUser>('/api/auth/me', { token });

/** Đổi mật khẩu; server trả phiên mới (token cũ hết hiệu lực) */
export const changePassword = (token: string, currentPassword: string, newPassword: string) =>
  apiRequest<AuthSession>('/api/auth/change-password', {
    token,
    body: { current_password: currentPassword, new_password: newPassword },
  });
