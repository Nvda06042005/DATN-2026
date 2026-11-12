/** Chỉ áp dụng cho mật khẩu người dùng tự đặt; không chặn đăng nhập mật khẩu cũ/tạm. */
export const PASSWORD_POLICY = /^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[^A-Za-z0-9])[\x21-\x7E]{6,72}(?![\s\S])/;
export const PASSWORD_MESSAGE = 'Mật khẩu cần ít nhất 6 ký tự, có chữ không dấu, số và ký tự đặc biệt; không có khoảng trắng.';
