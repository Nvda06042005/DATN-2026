-- Đề kiểm tra giữa kỳ / cuối kỳ (16/11/2026): giáo viên chọn bộ đề trong Thư viện học liệu, gửi quản trị trường duyệt; được duyệt thì giáo viên
-- "Tổ chức thi" (đặt mật khẩu, giờ mở, giờ đóng), hệ thống tạo bài thi (hk_assignments, một lượt làm) cho lớp và báo học sinh; học sinh nhập
-- mật khẩu giáo viên cung cấp để vào làm. Mật khẩu chỉ lưu dạng băm. Bảng theo trường có RLS, không cấp quyền công khai, có kho dữ liệu đã xóa.
CREATE TABLE public.hk_exams (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES public.app_schools(id) ON DELETE CASCADE,
    class_id INTEGER NOT NULL REFERENCES public.app_classes(id) ON DELETE CASCADE,
    teacher_id INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    quiz_id INTEGER NOT NULL REFERENCES public.hk_quizzes(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('midterm', 'final')),
    semester SMALLINT NOT NULL CHECK (semester IN (1, 2)),
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 150),
    note TEXT CHECK (note IS NULL OR length(note) <= 1000),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'scheduled')),
    reviewed_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    review_note TEXT CHECK (review_note IS NULL OR length(review_note) <= 300),
    reviewed_at TIMESTAMPTZ,
    password_hash TEXT,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    assignment_id INTEGER UNIQUE REFERENCES public.hk_assignments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
    CHECK (status <> 'scheduled' OR (password_hash IS NOT NULL AND starts_at IS NOT NULL AND ends_at IS NOT NULL))
);
-- mỗi lớp chỉ một đề giữa kỳ / cuối kỳ của mỗi học kỳ đang chờ duyệt hoặc đã duyệt (bị từ chối thì gửi đề khác được)
CREATE UNIQUE INDEX hk_exams_class_kind_key ON public.hk_exams (class_id, kind, semester) WHERE status <> 'rejected';
CREATE INDEX hk_exams_school_status_idx ON public.hk_exams (school_id, status, created_at DESC);
CREATE INDEX hk_exams_teacher_idx ON public.hk_exams (teacher_id, created_at DESC);

ALTER TABLE public.hk_exams ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hk_exams FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hk_exams TO dong_a_school_scope, dong_a_workspace_scope;
GRANT USAGE, SELECT ON SEQUENCE public.hk_exams_id_seq TO dong_a_school_scope, dong_a_workspace_scope;
CREATE POLICY school_scope ON public.hk_exams FOR ALL TO dong_a_school_scope, dong_a_workspace_scope
    USING (school_id = NULLIF(current_setting('app.school_id', true), '')::integer)
    WITH CHECK (school_id = NULLIF(current_setting('app.school_id', true), '')::integer);

COMMENT ON TABLE public.hk_exams IS 'Đề kiểm tra giữa kỳ / cuối kỳ: giáo viên gửi, quản trị trường duyệt, giáo viên tổ chức thi có mật khẩu (băm)';

SELECT public.app_install_delete_archives();
