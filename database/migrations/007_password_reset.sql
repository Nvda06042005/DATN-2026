-- Quên mật khẩu (TM.AUTH.007): mã đặt lại mật khẩu gửi qua email. Chỉ lưu băm SHA-256 của mã (không lưu mã gốc),
-- mã hết hạn sau ít phút và chỉ dùng được một lần. Bảng chứa dữ liệu người dùng nên bật Row-Level Security và không
-- cấp quyền cho vai trò nào ngoài chủ bảng (backend); vai trò dong_a_school_scope không đọc/ghi được bảng này.

CREATE TABLE IF NOT EXISTS public.app_password_resets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_password_resets_user_idx ON public.app_password_resets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS app_password_resets_expiry_idx ON public.app_password_resets (expires_at);

ALTER TABLE public.app_password_resets ENABLE ROW LEVEL SECURITY;
