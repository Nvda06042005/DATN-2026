-- HK.*.005/006/009/010 (hồ sơ cá nhân) và HK.*.005 (quên mật khẩu bằng OTP): bổ sung cột hồ sơ cho mọi vai trò,
-- đếm số lần nhập sai OTP, chỉ mục tra cứu đăng nhập bằng email / mã người dùng. Dữ liệu hiện có giữ nguyên (cột mới cho phép NULL).
ALTER TABLE public.app_users
    ADD COLUMN phone TEXT CHECK (phone IS NULL OR phone ~ '^[0-9+() .-]{8,20}$'),
    ADD COLUMN avatar_url TEXT CHECK (avatar_url IS NULL OR (avatar_url ~ '^https://' AND length(avatar_url) <= 500)),
    ADD COLUMN bio TEXT CHECK (bio IS NULL OR length(bio) <= 300),
    ADD COLUMN nickname TEXT CHECK (nickname IS NULL OR length(btrim(nickname)) BETWEEN 2 AND 24),
    ADD COLUMN gender TEXT CHECK (gender IS NULL OR gender IN ('male', 'female', 'other')),
    ADD COLUMN subject TEXT CHECK (subject IS NULL OR length(subject) <= 60),
    ADD COLUMN parent_email TEXT CHECK (parent_email IS NULL OR length(parent_email) <= 254);

-- Mã OTP 6 chữ số chỉ có 10^6 khả năng nên mỗi mã chỉ được thử một số lần giới hạn trước khi bị vô hiệu.
ALTER TABLE public.app_password_resets ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0);

CREATE INDEX app_users_email_lower_idx ON public.app_users (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX app_users_code_lower_idx ON public.app_users (lower(user_code)) WHERE user_code IS NOT NULL;
