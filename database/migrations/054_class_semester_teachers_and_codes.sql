-- Mã định danh tăng dần; giữ mã đã nhập trước đây và mã tham gia lớp 6 ký tự.
CREATE SEQUENCE public.app_teacher_code_seq MAXVALUE 99999999;
CREATE SEQUENCE public.app_student_code_seq MAXVALUE 99999999;
CREATE SEQUENCE public.app_class_code_seq MAXVALUE 99999999;
ALTER TABLE public.app_classes ADD COLUMN registration_code TEXT;

CREATE FUNCTION public.app_registration_code(kind TEXT, allocate BOOLEAN DEFAULT false) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE seq REGCLASS; prefix TEXT; n BIGINT; candidate TEXT; used BOOLEAN;
BEGIN
    CASE kind
        WHEN 'teacher' THEN seq:='public.app_teacher_code_seq'; prefix:='GV';
        WHEN 'student' THEN seq:='public.app_student_code_seq'; prefix:='HS';
        WHEN 'class' THEN seq:='public.app_class_code_seq'; prefix:='LH';
        ELSE RAISE EXCEPTION 'Loại mã không hợp lệ' USING ERRCODE='22023';
    END CASE;
    PERFORM pg_advisory_xact_lock(53001, CASE kind WHEN 'teacher' THEN 1 WHEN 'student' THEN 2 ELSE 3 END);
    EXECUTE format('SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM %s',seq) INTO n;
    LOOP
        IF n>99999999 THEN RAISE EXCEPTION 'Đã hết dải mã' USING ERRCODE='22003'; END IF;
        IF allocate THEN n:=nextval(seq); END IF;
        candidate:=prefix || lpad(n::text,8,'0');
        IF kind='class' THEN SELECT EXISTS(SELECT 1 FROM public.app_classes WHERE registration_code=candidate) INTO used;
        ELSE SELECT EXISTS(SELECT 1 FROM public.app_users WHERE lower(user_code)=lower(candidate)) INTO used;
        END IF;
        IF NOT used THEN RETURN candidate; END IF;
        n:=n+1;
    END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.app_registration_code(TEXT,BOOLEAN) FROM PUBLIC;

CREATE FUNCTION public.app_fill_registration_code() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
    IF TG_TABLE_NAME='app_classes' THEN
        IF NEW.registration_code IS NULL OR btrim(NEW.registration_code)='' THEN NEW.registration_code:=public.app_registration_code('class',true); END IF;
    ELSIF NEW.role IN ('teacher','student') AND (NEW.user_code IS NULL OR btrim(NEW.user_code)='') THEN
        NEW.user_code:=public.app_registration_code(NEW.role,true);
        NEW.search_text:=COALESCE(NEW.search_text,'') || ' ' || lower(NEW.user_code);
    END IF;
    RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.app_fill_registration_code() FROM PUBLIC;
CREATE TRIGGER fill_registration_code BEFORE INSERT ON public.app_classes FOR EACH ROW EXECUTE FUNCTION public.app_fill_registration_code();
CREATE TRIGGER fill_registration_code BEFORE INSERT ON public.app_users FOR EACH ROW EXECUTE FUNCTION public.app_fill_registration_code();
DO $$ DECLARE r RECORD; code TEXT; BEGIN
    FOR r IN SELECT id FROM public.app_classes ORDER BY id LOOP
        UPDATE public.app_classes SET registration_code=public.app_registration_code('class',true) WHERE id=r.id;
    END LOOP;
    FOR r IN SELECT id,role FROM public.app_users WHERE role IN ('teacher','student') AND (user_code IS NULL OR btrim(user_code)='') ORDER BY id LOOP
        code:=public.app_registration_code(r.role,true);
        UPDATE public.app_users SET user_code=code, search_text=COALESCE(search_text,'') || ' ' || lower(code) WHERE id=r.id;
    END LOOP;
END $$;
ALTER TABLE public.app_classes ALTER COLUMN registration_code SET NOT NULL;
ALTER TABLE public.app_classes ADD CONSTRAINT app_classes_registration_code_key UNIQUE(registration_code);

-- Một lớp cả năm, tối đa một giáo viên cho từng học kỳ. Không xóa phân công cũ.
ALTER TABLE public.app_classes ADD CONSTRAINT app_classes_id_school_key UNIQUE(id,school_id);
CREATE TABLE public.app_class_term_teachers (
    class_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL,
    semester SMALLINT NOT NULL CHECK(semester IN (1,2)),
    teacher_id INTEGER REFERENCES public.app_users(id) ON DELETE CASCADE,
    assigned_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY(class_id,semester),
    FOREIGN KEY(class_id,school_id) REFERENCES public.app_classes(id,school_id) ON DELETE CASCADE
);
CREATE INDEX app_class_term_teachers_teacher_idx ON public.app_class_term_teachers(teacher_id);
ALTER TABLE public.app_class_term_teachers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_class_term_teachers FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.app_class_term_teachers TO dong_a_school_scope,dong_a_workspace_scope;
CREATE POLICY school_scope ON public.app_class_term_teachers FOR ALL TO dong_a_school_scope,dong_a_workspace_scope
    USING(school_id=NULLIF(current_setting('app.school_id',true),'')::integer)
    WITH CHECK(school_id=NULLIF(current_setting('app.school_id',true),'')::integer);
CREATE FUNCTION public.app_check_class_term_teacher() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
    IF NEW.teacher_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.app_users WHERE id=NEW.teacher_id AND school_id=NEW.school_id AND role='teacher') THEN
        RAISE EXCEPTION 'Giáo viên không thuộc trường của lớp' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.app_check_class_term_teacher() FROM PUBLIC;
CREATE TRIGGER check_class_term_teacher BEFORE INSERT OR UPDATE OF teacher_id,school_id ON public.app_class_term_teachers
    FOR EACH ROW EXECUTE FUNCTION public.app_check_class_term_teacher();
INSERT INTO public.app_class_term_teachers(class_id,school_id,semester,teacher_id,assigned_by,assigned_at)
SELECT t.class_id,c.school_id,s.semester,t.teacher_id,t.assigned_by,t.assigned_at
FROM public.app_class_teachers t JOIN public.app_classes c ON c.id=t.class_id JOIN public.app_users u ON u.id=t.teacher_id AND u.school_id=c.school_id AND u.role='teacher'
CROSS JOIN (VALUES(1),(2)) s(semester)
WHERE (SELECT count(*) FROM public.app_class_teachers old WHERE old.class_id=t.class_id)=1;
-- Lớp cũ có nhiều giáo viên cần được quản trị trường chọn lại, không tự đoán hoặc xóa phân công.

CREATE FUNCTION public.app_class_semester(year_id INTEGER) RETURNS SMALLINT
LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
    SELECT CASE WHEN (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= term2_starts_on THEN 2 ELSE 1 END::smallint
    FROM public.app_school_years WHERE id=year_id
$$;
REVOKE ALL ON FUNCTION public.app_class_semester(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_class_semester(INTEGER) TO dong_a_school_scope,dong_a_workspace_scope;
GRANT EXECUTE ON FUNCTION public.app_registration_code(TEXT,BOOLEAN) TO dong_a_school_scope,dong_a_workspace_scope;
CREATE VIEW public.app_class_teacher_assignments WITH(security_invoker=true) AS
    SELECT t.class_id,t.semester,t.teacher_id,t.assigned_by,t.assigned_at
    FROM public.app_class_term_teachers t WHERE t.teacher_id IS NOT NULL
    UNION ALL
    SELECT t.class_id,s.n::smallint,t.teacher_id,t.assigned_by,t.assigned_at FROM public.app_class_teachers t CROSS JOIN (VALUES(1),(2)) s(n)
    WHERE NOT EXISTS(SELECT 1 FROM public.app_class_term_teachers n WHERE n.class_id=t.class_id);
CREATE VIEW public.app_current_class_teachers WITH(security_invoker=true) AS
    SELECT t.class_id,t.teacher_id,t.assigned_by,t.assigned_at FROM public.app_class_teacher_assignments t JOIN public.app_classes c ON c.id=t.class_id
    WHERE t.semester=COALESCE(public.app_class_semester(c.year_id),1);
REVOKE ALL ON public.app_class_teacher_assignments,public.app_current_class_teachers FROM PUBLIC;
REVOKE ALL ON SEQUENCE public.app_teacher_code_seq,public.app_student_code_seq,public.app_class_code_seq FROM PUBLIC;
GRANT SELECT ON public.app_class_teacher_assignments,public.app_current_class_teachers TO dong_a_school_scope,dong_a_workspace_scope;
DO $$ DECLARE r TEXT; fn TEXT; BEGIN
    FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
        IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
            EXECUTE format('REVOKE ALL ON public.app_class_term_teachers,public.app_class_teacher_assignments,public.app_current_class_teachers FROM %I',r);
            EXECUTE format('REVOKE ALL ON SEQUENCE public.app_teacher_code_seq,public.app_student_code_seq,public.app_class_code_seq FROM %I',r);
            FOREACH fn IN ARRAY ARRAY['app_registration_code(text,boolean)','app_fill_registration_code()','app_check_class_term_teacher()','app_class_semester(integer)'] LOOP
                EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM %I',fn,r);
            END LOOP;
        END IF;
    END LOOP;
END $$;
SELECT public.app_install_delete_archives();
