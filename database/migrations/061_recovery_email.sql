-- Email khôi phục cho quản trị tổng và quản trị trường (yêu cầu 13/11/2026): một email phụ cùng email chính quản lý tài khoản.
-- Khi quên mật khẩu, mã xác thực được gửi tới cả email chính và email khôi phục; gõ email khôi phục ở bước "xin mã" cũng tìm ra tài khoản.
-- Cột mới cho phép NULL, không đổi dữ liệu hiện có. Máy chủ kiểm tra định dạng, khác email chính và không trùng email của tài khoản khác.
ALTER TABLE public.app_users
    ADD COLUMN recovery_email TEXT CHECK (recovery_email IS NULL OR length(recovery_email) <= 254);

CREATE INDEX app_users_recovery_email_lower_idx ON public.app_users (lower(recovery_email)) WHERE recovery_email IS NOT NULL;
