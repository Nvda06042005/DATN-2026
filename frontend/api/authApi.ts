import { ApiError, apiRequest } from '@/api/client';
import { forgetVerifiedUser, rememberVerifiedUser, verifyUser } from '@/lib/verified-session';
import type { AuthSession, AuthUser, ClassItem, Portal, ProfileData, ProfilePatch, SchoolLinkInfo } from '@/types/api';
import type { TwoFactorChallenge } from '@/types/platform';

/** Phiên server trả về phải có token và đúng vai trò của trang đăng nhập (trang quản trị không nhận phiên của vai trò khác) */
function checkSession(session: AuthSession, portal: Portal | 'app'): AuthSession {
  if (!session?.user) throw new ApiError(502, 'Máy chủ chưa trả về phiên đăng nhập hợp lệ.');
  const allowed = portal === 'app' ? ['teacher', 'student'] : [portal];
  if (!allowed.includes(session.user.role)) throw new ApiError(403, 'Tài khoản không có quyền đăng nhập trang này.');
  if (!session.token || typeof session.token !== 'string') throw new ApiError(502, 'Máy chủ chưa trả về phiên đăng nhập hợp lệ.');
  rememberVerifiedUser(session.token, session.user);
  return session;
}

/** Đăng nhập tại một trang; server kiểm tra vai trò khớp với trang ("app" = /portal: giáo viên hoặc học sinh) */
export const loginToPortal = async (username: string, password: string, portal: Portal | 'app') =>
  checkSession(await apiRequest<AuthSession>('/api/auth/login', { body: { username, password, portal } }), portal);

/** Đăng nhập theo vai trò đã chọn; quản trị bật hai lớp phải hoàn tất thử thách trước khi có phiên. */
export const loginWithPassword = async (username: string, password: string, portal: Portal, schoolCode?: string): Promise<AuthSession | TwoFactorChallenge> => {
  const res = await apiRequest<AuthSession | TwoFactorChallenge>('/api/auth/login', { body: { username, password, portal, ...(schoolCode ? { school_code: schoolCode } : {}) } });
  return 'two_factor' in res ? res : checkSession(res, portal);
};
export const loginAdmin = loginWithPassword;
/** Gửi lại mã email của bước hai khi mã đã hết hạn: đổi phiếu cũ (trong 30 phút) lấy phiếu mới và thư mới, không cần nhập lại mật khẩu */
export const resendTwoFactor = (challenge: string, portal: Portal) => apiRequest<TwoFactorChallenge>('/api/auth/2fa/resend', { body: { challenge, portal } });
export const verifyTwoFactor = async (challenge: string, code: string, portal: Portal) => checkSession(await apiRequest<AuthSession>('/api/auth/2fa/verify', { body: { challenge, code, portal } }), portal);

/** Google dùng đúng vai trò đã chọn và vẫn yêu cầu hai lớp nếu tài khoản đã bật. */
export const loginWithGoogle = async (idToken: string, portal: Portal = 'student', schoolCode?: string): Promise<AuthSession | TwoFactorChallenge> => {
  const res = await apiRequest<AuthSession | TwoFactorChallenge>('/api/auth/google', { body: { id_token: idToken, portal, ...(schoolCode ? { school_code: schoolCode } : {}) } });
  return 'two_factor' in res ? res : checkSession(res, portal);
};

/** Trang đăng nhập riêng của trường (đường dẫn donga_<mã>_<tên>_<khu vực>): tên, khu vực và logo công khai của trường */
export const getSchoolLink = (slug: string) => apiRequest<SchoolLinkInfo>(`/api/auth/school-link/${encodeURIComponent(slug)}`);

/** Tài khoản của phiên đang lưu */
export const getMe = (token: string, force = false) => verifyUser(token, () => apiRequest<AuthUser>('/api/auth/me', { token }), force);

/** Quên mật khẩu (mọi vai trò): server gửi mã OTP 6 chữ số (hiệu lực 5 phút) tới email của tài khoản; luôn trả ok để không lộ tài khoản nào có thật */
export const requestPasswordReset = (identifier: string) => apiRequest<{ ok: boolean }>('/api/auth/forgot-password', { body: { identifier } });

/** Quên mật khẩu, bước nhập mã: mã đúng thì máy chủ cấp phiếu đổi mật khẩu có hạn 10 phút (sai quá 5 lần thì mã bị vô hiệu). Chưa đổi mật khẩu ở bước này. */
export const verifyResetCode = (identifier: string, otp: string) => apiRequest<{ reset_token: string; expires_in: number }>('/api/auth/verify-reset-code', { body: { identifier, otp } });

/** Quên mật khẩu, bước đặt mật khẩu: dùng phiếu của bước nhập mã (dùng một lần) */
export const resetPasswordWithTicket = (resetToken: string, newPassword: string) =>
  apiRequest<{ ok: boolean }>('/api/auth/reset-password', { body: { reset_token: resetToken, new_password: newPassword } });

/** Đặt mật khẩu mới bằng mã OTP trong thư ngay trong một bước (cách cũ, giao diện không còn dùng; dùng một lần, sai quá 5 lần thì vô hiệu) */
export const resetPassword = (identifier: string, otp: string, newPassword: string) =>
  apiRequest<{ ok: boolean }>('/api/auth/reset-password', { body: { identifier, otp, new_password: newPassword } });

/** Hồ sơ cá nhân: thông tin, trường, lớp và các trường vai trò được tự sửa */
export const getProfile = (token: string) => apiRequest<ProfileData>('/api/auth/profile', { token });

export const updateProfile = (token: string, body: ProfilePatch) => apiRequest<ProfileData>('/api/auth/profile', { token, method: 'PATCH', body });

/** Học sinh xác nhận hồ sơ ở lần đăng nhập đầu tiên (HK.HS.004) */
export const confirmProfile = (token: string, email?: string | null) => apiRequest<ProfileData>('/api/auth/confirm-profile', { token, body: { email: email || undefined } });

/** Ảnh đại diện tải lên (mọi vai trò): chỉ nhận ảnh PNG, JPEG, WEBP, GIF tối đa 1,5 MB; trả lại hồ sơ đã cập nhật. Bỏ ảnh: updateProfile({ avatar_url: null }) */
export const uploadAvatar = (token: string, body: { data: string }) => apiRequest<ProfileData>('/api/auth/avatar', { token, body });

/** Đổi mật khẩu; server trả phiên mới (token cũ hết hiệu lực) */
export const changePassword = async (token: string, currentPassword: string, newPassword: string) => {
  const session = await apiRequest<AuthSession>('/api/auth/change-password', { token, body: { current_password: currentPassword, new_password: newPassword } });
  if (!session?.token || typeof session.token !== 'string' || !session.user) throw new ApiError(502, 'Máy chủ chưa trả về phiên đăng nhập hợp lệ.');
  forgetVerifiedUser(token);
  rememberVerifiedUser(session.token, session.user);
  return session;
};

/** Revoke the current access token on the server before clearing the local session. */
export const logout = async (token: string) => {
  const result = await apiRequest<{ ok: boolean }>('/api/auth/logout', { token, body: {} });
  forgetVerifiedUser(token);
  return result;
};

/** Học sinh tham gia lớp bằng mã 6 ký tự (HK.HS.008) và xem các lớp đã tham gia */
export const joinClass = (token: string, code: string) => apiRequest<ClassItem>('/api/student/join-class', { token, body: { code } });
export const myClasses = (token: string) =>
  apiRequest<Array<{ id: number; name: string; grade: number | null; school_year: string; is_active: boolean; teachers: string[]; members: number }>>('/api/student/classes', { token });
