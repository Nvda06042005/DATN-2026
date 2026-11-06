-- TM.SCH-CLASS / TM.T-CLASS: quản trị trường tạo khối và lớp, phân công giáo viên; giáo viên đặt mật khẩu và đóng/mở đăng ký lớp.
-- Lớp do quản trị trường tạo ban đầu chưa có giáo viên và chưa có mật khẩu gia nhập, nên hai cột này được phép NULL.
-- Lớp hiện có (giáo viên xin mở, quản trị duyệt) giữ nguyên dữ liệu và vẫn nhận học sinh như trước (join_open mặc định true).
ALTER TABLE public.app_classes
    ALTER COLUMN teacher_id DROP NOT NULL,
    ALTER COLUMN join_password_hash DROP NOT NULL,
    ADD COLUMN join_open BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN expected_size INTEGER CHECK (expected_size IS NULL OR expected_size BETWEEN 1 AND 100),
    ADD COLUMN created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    ADD COLUMN closed_at TIMESTAMPTZ;

-- Khối được bật theo trường và năm học; lớp do quản trị trường tạo phải thuộc một khối đang bật. Không xóa dòng, chỉ ngưng sử dụng.
CREATE TABLE public.app_school_grades (
    school_id INTEGER NOT NULL REFERENCES public.app_schools(id) ON DELETE CASCADE,
    school_year TEXT NOT NULL CHECK (school_year ~ '^[0-9]{4}-[0-9]{4}$'),
    grade SMALLINT NOT NULL CHECK (grade BETWEEN 6 AND 9),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (school_id, school_year, grade)
);
ALTER TABLE public.app_school_grades ENABLE ROW LEVEL SECURITY;

-- Lịch sử vòng đời lớp (chỉ thêm, không sửa/xóa): tạo, phân công, đổi/hủy giáo viên, chuyển học sinh, đóng/mở lớp, đổi mật khẩu/đăng ký.
-- Không lưu mật khẩu hay băm mật khẩu.
CREATE TABLE public.app_class_events (
    id BIGSERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES public.app_schools(id) ON DELETE CASCADE,
    class_id INTEGER NOT NULL REFERENCES public.app_classes(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('create', 'update', 'assign', 'change_teacher', 'unassign', 'transfer', 'close', 'reopen', 'join_password', 'join_open', 'join_closed')),
    actor_id INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    teacher_id INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    previous_teacher_id INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    related_class_id INTEGER REFERENCES public.app_classes(id) ON DELETE SET NULL,
    note TEXT CHECK (note IS NULL OR length(note) <= 300),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX app_class_events_class_idx ON public.app_class_events (class_id, id DESC);
CREATE INDEX app_class_events_school_idx ON public.app_class_events (school_id, created_at DESC);
ALTER TABLE public.app_class_events ENABLE ROW LEVEL SECURITY;

-- Quản trị trường chạy dưới RLS của trường mình (không đọc/ghi trường khác); lịch sử chỉ thêm và đọc.
GRANT SELECT, INSERT, UPDATE ON public.app_school_grades TO dong_a_school_scope;
GRANT SELECT, INSERT ON public.app_class_events TO dong_a_school_scope;
GRANT USAGE, SELECT ON SEQUENCE public.app_class_events_id_seq TO dong_a_school_scope;
CREATE POLICY school_scope ON public.app_school_grades FOR ALL TO dong_a_school_scope
    USING (school_id = NULLIF(current_setting('app.school_id', true), '')::integer)
    WITH CHECK (school_id = NULLIF(current_setting('app.school_id', true), '')::integer);
CREATE POLICY school_scope ON public.app_class_events FOR ALL TO dong_a_school_scope
    USING (school_id = NULLIF(current_setting('app.school_id', true), '')::integer)
    WITH CHECK (school_id = NULLIF(current_setting('app.school_id', true), '')::integer);
