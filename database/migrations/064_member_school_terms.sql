-- Ghi nhận năm học/học kỳ được chọn khi tạo hoặc nhập tài khoản giáo viên, học sinh.
-- Phân công giáo viên cho lớp vẫn do app_class_teacher_assignments quản lý riêng.
ALTER TABLE public.app_users ADD CONSTRAINT app_users_id_school_key UNIQUE (id, school_id);
ALTER TABLE public.app_school_years ADD CONSTRAINT app_school_years_id_school_key UNIQUE (id, school_id);

CREATE TABLE public.app_member_school_terms (
    user_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL,
    year_id INTEGER NOT NULL,
    semester SMALLINT NOT NULL CHECK (semester IN (1, 2)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, year_id, semester),
    FOREIGN KEY (user_id, school_id) REFERENCES public.app_users (id, school_id) ON DELETE CASCADE,
    FOREIGN KEY (year_id, school_id) REFERENCES public.app_school_years (id, school_id) ON DELETE CASCADE
);
CREATE INDEX app_member_school_terms_school_year_idx ON public.app_member_school_terms (school_id, year_id, semester);
ALTER TABLE public.app_member_school_terms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_member_school_terms FROM PUBLIC;
GRANT SELECT, INSERT, DELETE ON public.app_member_school_terms TO dong_a_school_scope, dong_a_workspace_scope;
CREATE POLICY school_scope ON public.app_member_school_terms FOR ALL TO dong_a_school_scope, dong_a_workspace_scope
    USING (school_id = NULLIF(current_setting('app.school_id', true), '')::integer)
    WITH CHECK (school_id = NULLIF(current_setting('app.school_id', true), '')::integer);

SELECT public.app_install_delete_archives();
