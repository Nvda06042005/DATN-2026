import { apiRequest } from '@/api/client';
import type { AuthSession, AuthUser, ClassItem, Portal, ProfileData, ProfilePatch } from '@/types/api';

/** Đăng nhập tại một trang; server kiểm tra vai trò khớp với trang ("app" = /portal: giáo viên hoặc học sinh) */
export const loginToPortal = (username: string, password: string, portal: Portal | 'app') =>
  apiRequest<AuthSession>('/api/auth/login', { body: { username, password, portal } });

/** Đăng nhập Google (HK.HS.002): chỉ học sinh có email Google trùng email trong hồ sơ */
export const loginWithGoogle = (idToken: string) => apiRequest<AuthSession>('/api/auth/google', { body: { id_token: idToken, portal: 'student' } });

/** Đăng ký tự học (HK.HS.003): bước 1 gửi OTP tới email, bước 2 nhập OTP + họ tên + mật khẩu */
export const requestSignup = (email: string) => apiRequest<{ ok: boolean }>('/api/auth/register/request', { body: { email } });
export const completeSignup = (body: { email: string; otp: string; full_name: string; nickname?: string; password: string }) =>
  apiRequest<AuthSession>('/api/auth/register/verify', { body });

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

/** Học sinh xác nhận hồ sơ ở lần đăng nhập đầu tiên (HK.HS.004) */
export const confirmProfile = (token: string, email?: string | null) => apiRequest<ProfileData>('/api/auth/confirm-profile', { token, body: { email: email || undefined } });

/** Đổi mật khẩu; server trả phiên mới (token cũ hết hiệu lực) */
export const changePassword = (token: string, currentPassword: string, newPassword: string) =>
  apiRequest<AuthSession>('/api/auth/change-password', { token, body: { current_password: currentPassword, new_password: newPassword } });

/** Revoke the current access token on the server before clearing the local session. */
export const logout = (token: string) => apiRequest<{ ok: boolean }>('/api/auth/logout', { token, body: {} });

/** Học sinh tham gia lớp bằng mã 6 ký tự (HK.HS.008) và xem các lớp đã tham gia */
export const joinClass = (token: string, code: string) => apiRequest<ClassItem>('/api/student/join-class', { token, body: { code } });
export const myClasses = (token: string) =>
  apiRequest<Array<{ id: number; name: string; grade: number | null; school_year: string; is_active: boolean; teachers: string[]; members: number }>>('/api/student/classes', { token });
