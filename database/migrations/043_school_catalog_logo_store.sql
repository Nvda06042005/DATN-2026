-- Danh mục tham chiếu công khai, không phải trường đã đăng ký hay tài khoản.
-- Chỉ backend đọc; không mở quyền PostgREST/anon/authenticated.
CREATE TABLE public.app_school_logo_assets (
  sha256 text PRIMARY KEY CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  image_data bytea NOT NULL CHECK (octet_length(image_data) BETWEEN 16 AND 81920),
  mime_type text NOT NULL DEFAULT 'image/webp' CHECK (mime_type = 'image/webp'),
  width integer NOT NULL CHECK (width BETWEEN 1 AND 160),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 160),
  CHECK (encode(sha256(image_data), 'hex') = sha256),
  CHECK (substring(image_data FROM 1 FOR 4) = decode('52494646','hex') AND substring(image_data FROM 9 FOR 4) = decode('57454250','hex'))
);
CREATE TABLE public.app_school_directory (
  code text PRIMARY KEY CHECK (length(code) BETWEEN 1 AND 80),
  name text NOT NULL,
  city text NOT NULL,
  region text NOT NULL,
  address text,
  website text,
  source_url text NOT NULL,
  source_date date NOT NULL,
  note text,
  previous_codes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(previous_codes) = 'array'),
  logo_sha256 text REFERENCES public.app_school_logo_assets(sha256),
  logo_source_url text,
  checked_at date,
  CHECK (logo_sha256 IS NULL OR logo_source_url IS NOT NULL)
);
CREATE INDEX app_school_directory_logo_idx ON public.app_school_directory(logo_sha256) WHERE logo_sha256 IS NOT NULL;
ALTER TABLE public.app_school_logo_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_school_directory ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_school_logo_assets, public.app_school_directory FROM PUBLIC;
COMMENT ON TABLE public.app_school_logo_assets IS 'WebP tối đa 160px, một bản cho mỗi nội dung SHA-256; nhiều trường có thể tham chiếu cùng ảnh khi đã xác minh.';
COMMENT ON TABLE public.app_school_directory IS 'Danh mục gợi ý, không tự tạo tenant/tài khoản. Dữ liệu gốc 2020, chỉ cập nhật sáp nhập/địa chỉ có nguồn xác minh.';
