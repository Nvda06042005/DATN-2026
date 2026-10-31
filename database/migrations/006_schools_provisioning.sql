-- Nhiều trường và hai cấp quản trị (quản trị tổng, quản trị trường), cấp tài khoản từ file Excel mẫu có chữ ký,
-- nhật ký dòng thiếu thông tin (vector cho RAG Smart Delta Dispatch), hàng đợi email, lớp học chờ duyệt, thông báo,
-- thùng rác 45 ngày, chỉ mục lọc nhanh. Quản trị trường chỉ thấy dữ liệu trường mình nhờ Row-Level Security.

-- ------------------------------------------------------------------ trường học
CREATE TABLE IF NOT EXISTS public.app_schools (
    id SERIAL PRIMARY KEY,
    school_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    region TEXT,
    city TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_schools ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------ tài khoản: vai trò mới và hồ sơ theo file mẫu
-- Bỏ ràng buộc vai trò cũ (tên ràng buộc có thể khác nhau giữa các CSDL đã nhập trước đây)
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'public.app_users'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%role%'
    LOOP
        EXECUTE format('ALTER TABLE public.app_users DROP CONSTRAINT %I', r.conname);
    END LOOP;
END $$;

UPDATE public.app_users SET role = 'root_admin' WHERE role = 'admin';

ALTER TABLE public.app_users
    ADD CONSTRAINT app_users_role_check CHECK (role IN ('root_admin', 'school_admin', 'teacher', 'student'));

ALTER TABLE public.app_users
    ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES public.app_schools(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS user_code TEXT,
    ADD COLUMN IF NOT EXISTS school_code TEXT,
    ADD COLUMN IF NOT EXISTS region TEXT,
    ADD COLUMN IF NOT EXISTS city TEXT,
    ADD COLUMN IF NOT EXISTS birth_date DATE,
    ADD COLUMN IF NOT EXISTS school_year TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS grade SMALLINT CHECK (grade BETWEEN 6 AND 9),
    ADD COLUMN IF NOT EXISTS search_text TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS purge_at TIMESTAMPTZ;

-- Chống trùng tuyệt đối theo (mã người dùng, mã trường, email)
CREATE UNIQUE INDEX IF NOT EXISTS app_users_identity_key ON public.app_users (user_code, school_code, email);
CREATE INDEX IF NOT EXISTS app_users_filter_idx ON public.app_users (school_id, role, grade, school_year) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS app_users_place_idx ON public.app_users (region, city) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS app_users_purge_idx ON public.app_users (purge_at) WHERE purge_at IS NOT NULL;

-- Tìm kiếm tức thời (search_text không dấu do backend ghi): chỉ mục trigram; thiếu pg_trgm thì vẫn tìm được, chỉ chậm hơn
-- (tiện ích có thể nằm ở schema khác public, ví dụ extensions trên Supabase: tham chiếu theo đúng schema)
DO $$
DECLARE
    ext_schema TEXT;
BEGIN
    BEGIN
        CREATE EXTENSION IF NOT EXISTS pg_trgm;
        SELECT n.nspname INTO ext_schema FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_trgm';
        EXECUTE format('CREATE INDEX IF NOT EXISTS app_users_search_idx ON public.app_users USING gin (search_text %I.gin_trgm_ops)', ext_schema);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Không tạo được chỉ mục trigram (%)', SQLERRM;
    END;
END $$;

-- ------------------------------------------------------------------ lớp học: giáo viên gửi yêu cầu, quản trị duyệt, học sinh vào bằng mã + mật khẩu
CREATE TABLE IF NOT EXISTS public.app_classes (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES public.app_schools(id) ON DELETE CASCADE,
    teacher_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    class_code TEXT NOT NULL,
    school_year TEXT NOT NULL,
    name TEXT NOT NULL,
    join_password_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    review_note TEXT,
    reviewed_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (school_id, school_year, class_code)
);

CREATE INDEX IF NOT EXISTS app_classes_status_idx ON public.app_classes (school_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS app_classes_teacher_idx ON public.app_classes (teacher_id);

CREATE TABLE IF NOT EXISTS public.app_class_members (
    class_id INTEGER NOT NULL REFERENCES public.app_classes(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (class_id, user_id)
);

CREATE INDEX IF NOT EXISTS app_class_members_user_idx ON public.app_class_members (user_id);

-- ------------------------------------------------------------------ thông báo trong app
CREATE TABLE IF NOT EXISTS public.app_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    school_id INTEGER REFERENCES public.app_schools(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_notifications_user_idx ON public.app_notifications (user_id, created_at DESC);

-- ------------------------------------------------------------------ nhập file Excel mẫu
CREATE TABLE IF NOT EXISTS public.app_import_batches (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.app_schools(id) ON DELETE CASCADE,
    uploaded_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    template_id TEXT,
    total_rows INTEGER NOT NULL DEFAULT 0,
    created_count INTEGER NOT NULL DEFAULT 0,
    delta_count INTEGER NOT NULL DEFAULT 0,
    existing_count INTEGER NOT NULL DEFAULT 0,
    incomplete_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    -- Kết quả từng dòng (không chứa mật khẩu)
    report JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_import_batches_school_idx ON public.app_import_batches (school_id, created_at DESC);

-- Dòng thiếu thông tin: chưa cấp tài khoản, chờ bổ sung; vector dùng để đối chiếu khi nhập lại
CREATE TABLE IF NOT EXISTS public.app_incomplete_import_logs (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.app_schools(id) ON DELETE CASCADE,
    batch_id INTEGER REFERENCES public.app_import_batches(id) ON DELETE SET NULL,
    row_number INTEGER NOT NULL,
    user_code TEXT,
    email TEXT,
    full_name TEXT,
    school_code TEXT,
    missing_fields TEXT[] NOT NULL DEFAULT '{}',
    row_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    embedding REAL[],
    resolved_at TIMESTAMPTZ,
    resolved_user_id INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_incomplete_open_idx ON public.app_incomplete_import_logs (school_id) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS app_incomplete_code_idx ON public.app_incomplete_import_logs (school_code, user_code);

-- ------------------------------------------------------------------ hàng đợi email (gửi thông tin đăng nhập, thông báo duyệt lớp)
CREATE TABLE IF NOT EXISTS public.app_email_outbox (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES public.app_schools(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES public.app_users(id) ON DELETE CASCADE,
    batch_id INTEGER REFERENCES public.app_import_batches(id) ON DELETE SET NULL,
    kind TEXT NOT NULL CHECK (kind IN ('bulk', 'delta', 'class')),
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    -- Nội dung mã hóa AES-256-GCM (có mật khẩu mặc định), xóa ngay sau khi gửi xong
    body_encrypted TEXT,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'cancelled')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_email_outbox_queue_idx ON public.app_email_outbox (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS app_email_outbox_school_idx ON public.app_email_outbox (school_id, created_at DESC);

ALTER TABLE public.app_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_incomplete_import_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_email_outbox ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------ pgvector (Supabase có sẵn): tìm dòng thiếu tương tự theo vector
-- Không có pgvector (PostgreSQL thử nghiệm) thì bỏ qua: backend tính độ tương đồng cosine trên cột embedding.
DO $$
DECLARE
    ext_schema TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
        BEGIN
            CREATE EXTENSION IF NOT EXISTS vector;
            SELECT n.nspname INTO ext_schema FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'vector';
            EXECUTE format(
                'ALTER TABLE public.app_incomplete_import_logs ADD COLUMN IF NOT EXISTS embedding_vec %1$I.vector(128) GENERATED ALWAYS AS (embedding::%1$I.vector(128)) STORED',
                ext_schema
            );
            EXECUTE format(
                'CREATE INDEX IF NOT EXISTS app_incomplete_embedding_idx ON public.app_incomplete_import_logs USING hnsw (embedding_vec %I.vector_cosine_ops)',
                ext_schema
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Không bật được pgvector (%); backend dùng cosine trên cột embedding', SQLERRM;
        END;
    END IF;
END $$;

-- ------------------------------------------------------------------ Row-Level Security theo trường
-- Truy vấn của quản trị trường chạy với vai trò dong_a_school_scope và app.school_id lấy từ token (SET LOCAL),
-- nên dù thiếu điều kiện WHERE cũng không đọc/ghi được dữ liệu trường khác. Không cấp quyền cho anon/authenticated.
DO $$
BEGIN
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dong_a_school_scope') THEN
            CREATE ROLE dong_a_school_scope NOLOGIN;
        END IF;
        EXECUTE format('GRANT dong_a_school_scope TO %I', current_user);
        GRANT USAGE ON SCHEMA public TO dong_a_school_scope;
        GRANT SELECT ON public.app_schools, public.app_progress TO dong_a_school_scope;
        GRANT SELECT, INSERT, UPDATE, DELETE ON
            public.app_users, public.app_classes, public.app_class_members, public.app_notifications,
            public.app_import_batches, public.app_incomplete_import_logs, public.app_email_outbox
            TO dong_a_school_scope;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dong_a_school_scope;

        DROP POLICY IF EXISTS school_scope ON public.app_schools;
        CREATE POLICY school_scope ON public.app_schools FOR SELECT TO dong_a_school_scope
            USING (id = NULLIF(current_setting('app.school_id', true), '')::integer);

        DROP POLICY IF EXISTS school_scope ON public.app_users;
        CREATE POLICY school_scope ON public.app_users FOR ALL TO dong_a_school_scope
            USING (school_id = NULLIF(current_setting('app.school_id', true), '')::integer)
            WITH CHECK (school_id = NULLIF(current_setting('app.school_id', true), '')::integer);

        DROP POLICY IF EXISTS school_scope ON public.app_progress;
        CREATE POLICY school_scope ON public.app_progress FOR SELECT TO dong_a_school_scope
            USING (user_id IN (SELECT id FROM public.app_users));

        DROP POLICY IF EXISTS school_scope ON public.app_classes;
        CREATE POLICY school_scope ON public.app_classes FOR ALL TO dong_a_school_scope
            USING (school_id = NULLIF(current_setting('app.school_id', true), '')::integer)
            WITH CHECK (school_id = NULLIF(current_setting('app.school_id', true), '')::integer);

        DROP POLICY IF EXISTS school_scope ON public.app_class_members;
        CREATE POLICY school_scope ON public.app_class_members FOR ALL TO dong_a_school_scope
            USING (class_id IN (SELECT id FROM public.app_classes))
            WITH CHECK (class_id IN (SELECT id FROM public.app_classes));

        DROP POLICY IF EXISTS school_scope ON public.app_notifications;
        CREATE POLICY school_scope ON public.app_notifications FOR ALL TO dong_a_school_scope
            USING (school_id = NULLIF(current_setting('app.school_id', true), '')::integer)
            WITH CHECK (school_id = NULLIF(current_setting('app.school_id', true), '')::integer);

        DROP POLICY IF EXISTS school_scope ON public.app_import_batches;
        CREATE POLICY school_scope ON public.app_import_batches FOR ALL TO dong_a_school_scope
            USING (school_id = NULLIF(current_setting('app.school_id', true), '')::integer)
            WITH CHECK (school_id = NULLIF(current_setting('app.school_id', true), '')::integer);

        DROP POLICY IF EXISTS school_scope ON public.app_incomplete_import_logs;
        CREATE POLICY school_scope ON public.app_incomplete_import_logs FOR ALL TO dong_a_school_scope
            USING (school_id = NULLIF(current_setting('app.school_id', true), '')::integer)
            WITH CHECK (school_id = NULLIF(current_setting('app.school_id', true), '')::integer);

        DROP POLICY IF EXISTS school_scope ON public.app_email_outbox;
        CREATE POLICY school_scope ON public.app_email_outbox FOR ALL TO dong_a_school_scope
            USING (school_id = NULLIF(current_setting('app.school_id', true), '')::integer)
            WITH CHECK (school_id = NULLIF(current_setting('app.school_id', true), '')::integer);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Không bật được RLS theo trường (%); backend vẫn lọc theo school_id trong truy vấn', SQLERRM;
    END;
END $$;
