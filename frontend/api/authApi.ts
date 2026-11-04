import { ApiError, apiRequest } from '@/api/client';
import type { AuthSession, AuthUser, ClassItem, Portal, ProfileData, ProfilePatch } from '@/types/api';
import type { TwoFactorChallenge } from '@/types/platform';

/** Phiên server trả về phải có token và đúng vai trò của trang đăng nhập (trang quản trị không nhận phiên của vai trò khác) */
function checkSession(session: AuthSession, portal: Portal | 'app'): AuthSession {
  if (!session?.user) throw new ApiError(502, 'Máy chủ chưa trả về phiên đăng nhập hợp lệ.');
  const allowed = portal === 'app' ? ['teacher', 'student'] : [portal];
  if (!allowed.includes(session.user.role)) throw new ApiError(403, 'Tài khoản không có quyền đăng nhập trang này.');
  if (!session.token || typeof session.token !== 'string') throw new ApiError(502, 'Máy chủ chưa trả về phiên đăng nhập hợp lệ.');
  return session;
}

/** Đăng nhập tại một trang; server kiểm tra vai trò khớp với trang ("app" = /portal: giáo viên hoặc học sinh) */
export const loginToPortal = async (username: string, password: string, portal: Portal | 'app') =>
  checkSession(await apiRequest<AuthSession>('/api/auth/login', { body: { username, password, portal } }), portal);

/** Đăng nhập theo vai trò đã chọn; quản trị bật hai lớp phải hoàn tất thử thách trước khi có phiên. */
export const loginWithPassword = async (username: string, password: string, portal: Portal): Promise<AuthSession | TwoFactorChallenge> => {
  const res = await apiRequest<AuthSession | TwoFactorChallenge>('/api/auth/login', { body: { username, password, portal } });
  return 'two_factor' in res ? res : checkSession(res, portal);
};
export const loginAdmin = loginWithPassword;
export const verifyTwoFactor = async (challenge: string, code: string, portal: Portal) => checkSession(await apiRequest<AuthSession>('/api/auth/2fa/verify', { body: { challenge, code, portal } }), portal);

/** Đăng nhập Google (HK.HS.002): chỉ học sinh có email Google trùng email trong hồ sơ */
export const loginWithGoogle = async (idToken: string) => checkSession(await apiRequest<AuthSession>('/api/auth/google', { body: { id_token: idToken, portal: 'student' } }), 'student');

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
export const changePassword = async (token: string, currentPassword: string, newPassword: string) => {
  const session = await apiRequest<AuthSession>('/api/auth/change-password', { token, body: { current_password: currentPassword, new_password: newPassword } });
  if (!session?.token || typeof session.token !== 'string' || !session.user) throw new ApiError(502, 'Máy chủ chưa trả về phiên đăng nhập hợp lệ.');
  return session;
};

/** Revoke the current access token on the server before clearing the local session. */
export const logout = (token: string) => apiRequest<{ ok: boolean }>('/api/auth/logout', { token, body: {} });

/** Học sinh tham gia lớp bằng mã 6 ký tự (HK.HS.008) và xem các lớp đã tham gia */
export const joinClass = (token: string, code: string) => apiRequest<ClassItem>('/api/student/join-class', { token, body: { code } });
export const myClasses = (token: string) =>
  apiRequest<Array<{ id: number; name: string; grade: number | null; school_year: string; is_active: boolean; teachers: string[]; members: number }>>('/api/student/classes', { token });
