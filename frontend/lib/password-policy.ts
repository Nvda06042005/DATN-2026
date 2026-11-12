/** Quy tắc mật khẩu mới; giữ đồng bộ với backend/src/auth/password-policy.ts. */
export const PASSWORD_POLICY = /^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9])[\x21-\x7E]{6,72}(?![\s\S])/;
export const PASSWORD_MESSAGE = 'Mật khẩu cần ít nhất 6 ký tự, có chữ không dấu, số và ký tự đặc biệt; không có khoảng trắng.';
export const PASSWORD_HINT = 'Từ 6 ký tự, có chữ không dấu, số và ký tự đặc biệt (@, #, !), không có khoảng trắng.';

/** Chỉ nhận ASCII hiển thị; không tự bỏ dấu, trim hay cắt mật khẩu người dùng. */
export function newPasswordError(password: string): string | null {
  if (PASSWORD_POLICY.test(password)) return null;
  const missing: string[] = [];
  if (password.length < 6) missing.push(`ít nhất 6 ký tự (hiện có ${password.length})`);
  if (password.length > 72) missing.push('không quá 72 ký tự');
  if (/\s/u.test(password)) missing.push('không có khoảng trắng');
  if (/[^\x00-\x7F]/.test(password)) missing.push('chỉ dùng chữ không dấu và ký tự bàn phím');
  if (/[\x00-\x1F\x7F]/.test(password)) missing.push('không có ký tự điều khiển');
  if (!/[A-Za-z]/.test(password)) missing.push('có chữ không dấu');
  if (!/[0-9]/.test(password)) missing.push('có số');
  if (!/[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]/.test(password)) missing.push('có ký tự đặc biệt như @, #, !');
  return `Mật khẩu cần: ${missing.join('; ')}.`;
}
