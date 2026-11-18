-- 18/11/2026, theo lựa chọn của người dùng ("Lưu để quản trị xem được"): quản trị tổng xem được mật khẩu hiện tại của tài khoản các trường (quản trị trường,
-- giáo viên, học sinh) ở mục "Mật khẩu tài khoản", kể cả khi người dùng đã tự đổi. Từ nay mỗi lần người dùng đặt mật khẩu (đổi mật khẩu, quên mật khẩu),
-- máy chủ lưu thêm bản MÃ HÓA (AES-256-GCM, khóa từ bí mật của máy chủ, như cột initial_password_enc của migration 060) vào cột mới này.
-- Mật khẩu đã đổi trước migration này chỉ có dạng băm một chiều nên không khôi phục được: cột để trống. Không lưu cho tài khoản quản trị tổng.
-- Trigger: đổi băm mật khẩu mà không kèm bản mã hóa mới (ví dụ quản trị cấp lại) thì xóa bản cũ để không bao giờ hiện mật khẩu đã hết hiệu lực.
ALTER TABLE public.app_users ADD COLUMN password_view_enc TEXT;

CREATE FUNCTION public.app_forget_password_view() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash AND NEW.password_view_enc IS NOT DISTINCT FROM OLD.password_view_enc THEN
    NEW.password_view_enc := NULL;
  END IF;
  IF NEW.role = 'root_admin' THEN
    NEW.password_view_enc := NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.app_forget_password_view() FROM PUBLIC;

CREATE TRIGGER app_users_forget_password_view
  BEFORE UPDATE OF password_hash, password_view_enc, role ON public.app_users
  FOR EACH ROW EXECUTE FUNCTION public.app_forget_password_view();

COMMENT ON COLUMN public.app_users.password_view_enc IS 'Bản mã hóa (AES-256-GCM, khóa từ bí mật máy chủ) của mật khẩu do người dùng tự đặt từ 18/11/2026, chỉ quản trị tổng xem ở mục Mật khẩu tài khoản; NULL với quản trị tổng và mật khẩu đặt trước đó. Bị xóa khi mật khẩu đổi mà không kèm bản mới.';
