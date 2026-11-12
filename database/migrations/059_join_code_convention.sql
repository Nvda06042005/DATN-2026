-- Mã tham gia lớp theo quy ước (yêu cầu 12/11/2026): DongA + lớp + giáo viên phụ trách + học kỳ + năm học,
-- ví dụ DongA6A5DucAnhHK12025-2026, tạo khi quản trị trường nhập file xếp lớp thành công. Mã cũ 6 ký tự ngẫu nhiên vẫn hợp lệ.
-- Nới ràng buộc độ dài (chữ hoa, chữ thường, số, dấu gạch), thêm chỉ mục duy nhất theo dạng chuẩn hóa (bỏ ký tự khác chữ số, viết hoa)
-- để học sinh gõ hoa/thường hay bỏ dấu gạch đều khớp đúng một lớp. Không đổi dữ liệu.
DO $$ DECLARE c RECORD; BEGIN
  FOR c IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'public.app_classes'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%join_code%' LOOP
    EXECUTE format('ALTER TABLE public.app_classes DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.app_classes ADD CONSTRAINT app_classes_join_code_format
  CHECK (join_code IS NULL OR join_code ~ '^[A-Za-z0-9-]{6,80}$');
CREATE UNIQUE INDEX app_classes_join_code_norm_key ON public.app_classes (upper(regexp_replace(join_code, '[^A-Za-z0-9]', '', 'g')))
  WHERE join_code IS NOT NULL;

-- Mã còn trống trên toàn hệ thống (base, base-2, base-3, ...), không tính chính lớp đang đặt mã (nhập lại cùng lớp giữ nguyên mã). Quản trị trường chạy dưới RLS nên không thấy lớp trường khác;
-- hàm SECURITY DEFINER chỉ trả mã còn trống, không trả thông tin lớp nào.
CREATE FUNCTION public.app_free_join_code(base TEXT, exclude_class INTEGER DEFAULT NULL) RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE stem TEXT; candidate TEXT; n INTEGER := 2;
BEGIN
  stem := btrim(base);
  IF stem IS NULL OR stem !~ '^[A-Za-z0-9-]{6,70}$' THEN
    RAISE EXCEPTION 'Mã tham gia gốc không hợp lệ' USING ERRCODE='22023';
  END IF;
  candidate := stem;
  WHILE EXISTS(SELECT 1 FROM public.app_classes
               WHERE join_code IS NOT NULL AND (exclude_class IS NULL OR id <> exclude_class) AND upper(regexp_replace(join_code, '[^A-Za-z0-9]', '', 'g')) = upper(regexp_replace(candidate, '[^A-Za-z0-9]', '', 'g'))) LOOP
    candidate := stem || '-' || n::text;
    n := n + 1;
  END LOOP;
  RETURN candidate;
END $$;
REVOKE ALL ON FUNCTION public.app_free_join_code(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_free_join_code(TEXT, INTEGER) TO dong_a_school_scope, dong_a_workspace_scope;
