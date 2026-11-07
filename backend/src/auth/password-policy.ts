/** Chỉ áp dụng cho mật khẩu người dùng tự đặt; không chặn đăng nhập mật khẩu cũ/tạm. */
export const PASSWORD_POLICY = /^(?=.*\p{L})(?=.*\p{N})(?=.*[\p{P}\p{S}])[^\p{C}]{6,72}$/u;
export const PASSWORD_MESSAGE = 'Mật khẩu cần ít nhất 6 ký tự, có chữ, số và ký tự đặc biệt.';
