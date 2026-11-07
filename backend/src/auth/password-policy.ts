/** Chỉ áp dụng cho mật khẩu người dùng tự đặt; không chặn đăng nhập mật khẩu cũ/tạm. */
export const PASSWORD_POLICY = /^(?=.*\p{Lu})(?=.*\p{Ll})(?=.*\p{N})(?=.*[\p{P}\p{S}])[^\p{C}]{12,72}$/u;
export const PASSWORD_MESSAGE = 'Mật khẩu cần ít nhất 12 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.';
