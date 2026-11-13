-- Danh sách mật khẩu cho quản trị trường và quản trị tổng (yêu cầu 13/11/2026). Mật khẩu người dùng tự đặt vẫn chỉ lưu dạng băm một chiều,
-- không ai xem được. Riêng mật khẩu ban đầu / mật khẩu do quản trị cấp lại được lưu MÃ HÓA (AES-256-GCM, khóa từ bí mật của máy chủ) để
-- quản trị xem lại cho đến khi người dùng tự đổi; người dùng đổi mật khẩu thì trigger xóa ngay bản lưu. Không đổi dữ liệu cũ.
ALTER TABLE public.app_users ADD COLUMN initial_password_enc TEXT;

CREATE FUNCTION public.app_forget_initial_password() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.must_change_password = 0 THEN
    NEW.initial_password_enc := NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.app_forget_initial_password() FROM PUBLIC;

CREATE TRIGGER app_users_forget_initial_password
  BEFORE UPDATE OF password_hash, must_change_password ON public.app_users
  FOR EACH ROW EXECUTE FUNCTION public.app_forget_initial_password();
