-- Giáo viên đang phụ trách đề nghị thay đổi; quản trị trường duyệt mới có hiệu lực.
CREATE TABLE public.app_class_teacher_change_requests (
    id BIGSERIAL PRIMARY KEY,
    class_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL,
    semester SMALLINT NOT NULL CHECK(semester IN (1,2)),
    from_teacher_id INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    to_teacher_id INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    requested_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    note TEXT CHECK(length(note)<=1000),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_note TEXT CHECK(length(review_note)<=1000),
    FOREIGN KEY(class_id,school_id) REFERENCES public.app_classes(id,school_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX app_class_teacher_change_pending_key ON public.app_class_teacher_change_requests(class_id,semester) WHERE status='pending';
CREATE INDEX app_class_teacher_change_school_idx ON public.app_class_teacher_change_requests(school_id,status,requested_at DESC);
ALTER TABLE public.app_class_teacher_change_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_class_teacher_change_requests FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.app_class_teacher_change_requests TO dong_a_school_scope,dong_a_workspace_scope;
GRANT USAGE,SELECT ON SEQUENCE public.app_class_teacher_change_requests_id_seq TO dong_a_school_scope,dong_a_workspace_scope;
CREATE POLICY school_scope ON public.app_class_teacher_change_requests FOR ALL TO dong_a_school_scope,dong_a_workspace_scope
    USING(school_id=NULLIF(current_setting('app.school_id',true),'')::integer)
    WITH CHECK(school_id=NULLIF(current_setting('app.school_id',true),'')::integer);
DO $$ DECLARE r TEXT; BEGIN
    FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
        IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
            EXECUTE format('REVOKE ALL ON public.app_class_teacher_change_requests FROM %I',r);
            EXECUTE format('REVOKE ALL ON SEQUENCE public.app_class_teacher_change_requests_id_seq FROM %I',r);
        END IF;
    END LOOP;
END $$;
SELECT public.app_install_delete_archives();
