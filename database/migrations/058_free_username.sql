-- Tên đăng nhập là duy nhất trên toàn hệ thống (app_users.username UNIQUE), nhưng thao tác của quản trị trường
-- chạy trong vai trò dong_a_school_scope nên RLS chỉ cho thấy tài khoản của trường mình. Khi tạo giáo viên/học sinh
-- (tên theo quy ước GV/HS + tên + 4 số cuối SĐT + ngày sinh, yêu cầu 11/11/2026) có thể trùng với tài khoản trường khác
-- mà backend không thấy, dẫn tới lỗi trùng khóa. Hàm này kiểm tra trên toàn bảng và chỉ trả về tên còn trống
-- (base, base2, base3, ...); không trả thông tin nào khác của tài khoản. Không đổi dữ liệu.
CREATE FUNCTION public.app_free_username(base TEXT) RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE stem TEXT; candidate TEXT; n INTEGER := 2;
BEGIN
  stem := lower(btrim(base));
  IF stem IS NULL OR length(stem) NOT BETWEEN 1 AND 64 OR stem ~ '\s' THEN
    RAISE EXCEPTION 'Tên đăng nhập gốc không hợp lệ' USING ERRCODE='22023';
  END IF;
  candidate := stem;
  WHILE EXISTS(SELECT 1 FROM public.app_users WHERE username=candidate) LOOP
    candidate := stem || n::text;
    n := n+1;
  END LOOP;
  RETURN candidate;
END $$;
REVOKE ALL ON FUNCTION public.app_free_username(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_free_username(TEXT) TO dong_a_school_scope,dong_a_workspace_scope;
