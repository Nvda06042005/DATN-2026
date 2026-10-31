-- HK Sprint 1–2 (HK.HS.003/008, HK.QT.012/022/035–040, HK.AD.013–025): lý do khóa tài khoản, cấp quản trị tổng, xác nhận hồ sơ lần đầu,
-- đăng ký tự học bằng OTP, năm học thành thực thể, nhiều giáo viên mỗi lớp và mã tham gia lớp 6 ký tự (thay mật khẩu lớp).
-- Dữ liệu hiện có giữ nguyên: cột mới cho phép NULL hoặc có giá trị mặc định; bảng cũ không bị xóa.

-- ------------------------------------------------------------------ trường học
ALTER TABLE public.app_schools
    ADD COLUMN IF NOT EXISTS logo_url TEXT CHECK (logo_url IS NULL OR (logo_url ~ '^https://' AND length(logo_url) <= 500));

-- ------------------------------------------------------------------ tài khoản
ALTER TABLE public.app_users
    ADD COLUMN IF NOT EXISTS lock_reason TEXT CHECK (lock_reason IS NULL OR length(lock_reason) <= 300),
    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS locked_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    -- Quản trị tổng cấp 1 toàn quyền; cấp 2 (HK.AD.020) không được tạo, sửa, khóa hay xóa quản trị tổng khác và không xóa trường
    ADD COLUMN IF NOT EXISTS admin_level SMALLINT NOT NULL DEFAULT 1 CHECK (admin_level IN (1, 2)),
    -- Học sinh xác nhận hồ sơ ở lần đăng nhập đầu tiên (HK.HS.004)
    ADD COLUMN IF NOT EXISTS profile_confirmed_at TIMESTAMPTZ,
    -- Học sinh tự đăng ký chế độ tự học, không thuộc trường (HK.HS.003)
    ADD COLUMN IF NOT EXISTS self_registered BOOLEAN NOT NULL DEFAULT false;

-- Tài khoản đã đổi mật khẩu thì đã qua bước đăng nhập đầu tiên
UPDATE public.app_users SET profile_confirmed_at = now() WHERE must_change_password = 0 AND profile_confirmed_at IS NULL;
-- Tài khoản đang bị khóa từ trước chưa có lý do/thời điểm: giữ nguyên, hiển thị "chưa ghi lý do"
UPDATE public.app_users SET locked_at = now() WHERE is_active = 0 AND locked_at IS NULL AND deleted_at IS NULL;

-- Mã OTP xác thực email khi đăng ký tự học: chỉ lưu băm, hiệu lực 5 phút, thử sai quá 5 lần thì vô hiệu
CREATE TABLE IF NOT EXISTS public.app_signup_otps (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    otp_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_signup_otps_email_idx ON public.app_signup_otps (lower(email), created_at DESC);
ALTER TABLE public.app_signup_otps ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------ năm học (HK.QT.012)
CREATE TABLE IF NOT EXISTS public.app_school_years (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES public.app_schools(id) ON DELETE CASCADE,
    label TEXT NOT NULL CHECK (label ~ '^[0-9]{4}-[0-9]{4}$' AND right(label, 4)::integer = left(label, 4)::integer + 1),
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'ended')),
    ended_at TIMESTAMPTZ,
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_on > starts_on),
    UNIQUE (school_id, label)
);
-- Mỗi trường chỉ có một năm học đang hoạt động
CREATE UNIQUE INDEX IF NOT EXISTS app_school_years_one_active ON public.app_school_years (school_id) WHERE status = 'active';
ALTER TABLE public.app_school_years ENABLE ROW LEVEL SECURITY;

-- Năm học đã có trong dữ liệu (lớp, khối, tài khoản) trở thành bản ghi; năm mới nhất của mỗi trường đang hoạt động, các năm trước đã kết thúc
INSERT INTO public.app_school_years (school_id, label, starts_on, ends_on)
SELECT y.school_id, y.label, make_date(left(y.label, 4)::integer, 9, 5), make_date(right(y.label, 4)::integer, 5, 31)
FROM (
    SELECT school_id, school_year AS label FROM public.app_classes
    UNION SELECT school_id, school_year FROM public.app_school_grades
    UNION SELECT school_id, school_year FROM public.app_users WHERE school_id IS NOT NULL AND school_year IS NOT NULL
) y
WHERE y.label ~ '^[0-9]{4}-[0-9]{4}$' AND right(y.label, 4)::integer = left(y.label, 4)::integer + 1
ON CONFLICT (school_id, label) DO NOTHING;

UPDATE public.app_school_years y
SET status = CASE WHEN y.label = m.latest THEN 'active' ELSE 'ended' END,
    ended_at = CASE WHEN y.label = m.latest THEN NULL ELSE now() END
FROM (SELECT school_id, max(label) AS latest FROM public.app_school_years GROUP BY school_id) m
WHERE m.school_id = y.school_id;

-- ------------------------------------------------------------------ lớp học
ALTER TABLE public.app_classes
    ADD COLUMN IF NOT EXISTS year_id INTEGER REFERENCES public.app_school_years(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS join_code TEXT CHECK (join_code IS NULL OR join_code ~ '^[A-Z0-9]{6}$'),
    ADD COLUMN IF NOT EXISTS description TEXT CHECK (description IS NULL OR length(description) <= 300);

UPDATE public.app_classes c SET year_id = y.id
FROM public.app_school_years y WHERE y.school_id = c.school_id AND y.label = c.school_year AND c.year_id IS NULL;

-- Mã tham gia 6 ký tự (không có I, O, 0, 1 dễ nhầm), duy nhất toàn hệ thống; lớp cũ được cấp mã ngẫu nhiên
DO $$
DECLARE
    r record;
    code text;
    alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
BEGIN
    FOR r IN SELECT id FROM public.app_classes WHERE join_code IS NULL LOOP
        LOOP
            code := (SELECT string_agg(substr(alphabet, 1 + floor(random() * 32)::integer, 1), '') FROM generate_series(1, 6));
            EXIT WHEN NOT EXISTS (SELECT 1 FROM public.app_classes WHERE join_code = code);
        END LOOP;
        UPDATE public.app_classes SET join_code = code WHERE id = r.id;
    END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS app_classes_join_code_key ON public.app_classes (join_code) WHERE join_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS app_classes_year_idx ON public.app_classes (school_id, year_id, grade);

-- Xóa tài khoản giáo viên không được kéo theo xóa lớp: giữ lớp, bỏ liên kết giáo viên cũ
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'public.app_classes'::regclass AND contype = 'f' AND confrelid = 'public.app_users'::regclass
          AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.app_classes'::regclass AND attname = 'teacher_id')]
    LOOP
        EXECUTE format('ALTER TABLE public.app_classes DROP CONSTRAINT %I', r.conname);
    END LOOP;
    ALTER TABLE public.app_classes ADD CONSTRAINT app_classes_teacher_id_set_null FOREIGN KEY (teacher_id) REFERENCES public.app_users(id) ON DELETE SET NULL;
END $$;

-- Một lớp có nhiều giáo viên (HK.QT.022); cột teacher_id cũ chỉ còn để đọc dữ liệu trước đây, được chép sang bảng này
CREATE TABLE IF NOT EXISTS public.app_class_teachers (
    class_id INTEGER NOT NULL REFERENCES public.app_classes(id) ON DELETE CASCADE,
    teacher_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    assigned_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (class_id, teacher_id)
);
CREATE INDEX IF NOT EXISTS app_class_teachers_teacher_idx ON public.app_class_teachers (teacher_id);
ALTER TABLE public.app_class_teachers ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_class_teachers (class_id, teacher_id)
SELECT id, teacher_id FROM public.app_classes WHERE teacher_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------ Row-Level Security theo trường cho bảng mới
DO $$
BEGIN
    BEGIN
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_school_years, public.app_class_teachers, public.app_school_grades TO dong_a_school_scope;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dong_a_school_scope;

        DROP POLICY IF EXISTS school_scope ON public.app_school_years;
        CREATE POLICY school_scope ON public.app_school_years FOR ALL TO dong_a_school_scope
            USING (school_id = NULLIF(current_setting('app.school_id', true), '')::integer)
            WITH CHECK (school_id = NULLIF(current_setting('app.school_id', true), '')::integer);

        DROP POLICY IF EXISTS school_scope ON public.app_class_teachers;
        CREATE POLICY school_scope ON public.app_class_teachers FOR ALL TO dong_a_school_scope
            USING (class_id IN (SELECT id FROM public.app_classes))
            WITH CHECK (class_id IN (SELECT id FROM public.app_classes));
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Không bật được RLS theo trường cho bảng mới (%); backend vẫn lọc theo school_id trong truy vấn', SQLERRM;
    END;
END $$;

-- ------------------------------------------------------------------ lịch sử lớp: thêm các loại sự kiện mới (tham gia bằng mã, thêm/gỡ học sinh, đổi mã, đổi giáo viên, nhân bản)
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'public.app_class_events'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%kind%'
    LOOP
        EXECUTE format('ALTER TABLE public.app_class_events DROP CONSTRAINT %I', r.conname);
    END LOOP;
END $$;
ALTER TABLE public.app_class_events
    ADD CONSTRAINT app_class_events_kind_check CHECK (kind IN (
        'create', 'update', 'assign', 'change_teacher', 'unassign', 'transfer', 'close', 'reopen', 'join_password', 'join_open', 'join_closed',
        'join', 'member_add', 'member_remove', 'code', 'teachers', 'clone'
    ));
