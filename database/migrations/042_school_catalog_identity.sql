-- Mã Đông A tự sinh độc lập với mã tham chiếu trong danh mục trường.
-- Giữ nguyên mã trường, tài khoản và đường dẫn đã có.
ALTER TABLE public.app_schools ADD COLUMN directory_code text;
ALTER TABLE public.app_schools ADD CONSTRAINT app_schools_directory_code_length
  CHECK (directory_code IS NULL OR length(directory_code) BETWEEN 1 AND 80);
CREATE UNIQUE INDEX app_schools_directory_code_unique ON public.app_schools(directory_code)
  WHERE directory_code IS NOT NULL;
COMMENT ON COLUMN public.app_schools.directory_code IS
  'Khóa tham chiếu danh mục trường; không dùng làm mã đăng nhập hay phân quyền.';

CREATE SEQUENCE public.app_school_registration_code_seq MINVALUE 1 MAXVALUE 99999999 NO CYCLE;
REVOKE ALL ON SEQUENCE public.app_school_registration_code_seq FROM PUBLIC;

CREATE FUNCTION public.next_school_registration_code() RETURNS text
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE candidate text;
BEGIN
  LOOP
    candidate := lpad(nextval('public.app_school_registration_code_seq')::text, 8, '0');
    IF NOT EXISTS (SELECT 1 FROM public.app_schools WHERE school_code = candidate) THEN
      RETURN candidate;
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.next_school_registration_code() FROM PUBLIC;
