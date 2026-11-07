/** Quy tắc mật khẩu mới; giữ đồng bộ với backend/src/auth/password-policy.ts. */
export const PASSWORD_POLICY = /^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9])[\x21-\x7E]{6,72}(?![\s\S])/;
export const PASSWORD_MESSAGE = 'Mật khẩu cần ít nhất 6 ký tự, có chữ không dấu, số và ký tự đặc biệt; không có khoảng trắng.';
export const PASSWORD_HINT = 'Từ 6 ký tự, có chữ không dấu, số và ký tự đặc biệt (@, #, !), không có khoảng trắng.';

/** Chỉ nhận ASCII hiển thị; không tự bỏ dấu, trim hay cắt mật khẩu người dùng. */
export function newPasswordError(password: string): string | null {
  return PASSWORD_POLICY.test(password) ? null : PASSWORD_MESSAGE;
}
