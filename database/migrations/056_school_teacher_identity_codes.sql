-- Mã giáo viên: viết tắt trường + năm nhập (yy) + ngày sinh (ddmmyyyy) + STT.
-- Chỉ đổi mã hiển thị, giữ id/tên đăng nhập, mật khẩu, lớp và dữ liệu học tập.
ALTER TABLE public.app_users ADD COLUMN teacher_code_serial INTEGER CHECK(teacher_code_serial>0);
ALTER TABLE public.app_users ADD COLUMN teacher_code_year SMALLINT CHECK(teacher_code_year BETWEEN 0 AND 99);
CREATE TABLE public.app_teacher_code_counters (
    school_id INTEGER PRIMARY KEY REFERENCES public.app_schools(id) ON DELETE CASCADE,
    last_serial INTEGER NOT NULL CHECK(last_serial>0)
);
ALTER TABLE public.app_teacher_code_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_teacher_code_counters FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.app_teacher_code_counters TO dong_a_school_scope,dong_a_workspace_scope;
CREATE POLICY school_scope ON public.app_teacher_code_counters FOR ALL TO dong_a_school_scope,dong_a_workspace_scope
    USING(school_id=NULLIF(current_setting('app.school_id',true),'')::integer)
    WITH CHECK(school_id=NULLIF(current_setting('app.school_id',true),'')::integer);

CREATE FUNCTION public.app_school_initials(school_name TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
    WITH plain AS (
        SELECT trim(regexp_replace(lower(translate(regexp_replace(
          normalize(regexp_replace(school_name,'\([^)]*\)','', 'g'),NFD),
          U&'[\0300-\036f]','','g'),'đĐ','dD')),'[^a-z0-9]+',' ','g')) AS name
    ), words AS (
        SELECT word,n FROM plain,regexp_split_to_table(regexp_replace(name,'^(truong )?(trung hoc co so|trung hoc pho thong|tieu hoc|thcs|thpt|th)( |$)',''),' +') WITH ORDINALITY AS w(word,n)
    ) SELECT coalesce(nullif(left(upper(string_agg(left(word,1),'' ORDER BY n)),12),''),'GV') FROM words
$$;
CREATE FUNCTION public.app_teacher_identity(school_name TEXT, code_year INTEGER, born DATE, serial INTEGER) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
    SELECT CASE WHEN born IS NOT NULL THEN public.app_school_initials(school_name)
      || lpad(code_year::text,2,'0') || to_char(born,'DDMMYYYY')
      || CASE WHEN serial<1000 THEN lpad(serial::text,3,'0') ELSE serial::text END END
$$;
REVOKE ALL ON FUNCTION public.app_school_initials(TEXT),public.app_teacher_identity(TEXT,INTEGER,DATE,INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_school_initials(TEXT),public.app_teacher_identity(TEXT,INTEGER,DATE,INTEGER) TO dong_a_school_scope,dong_a_workspace_scope;

-- Đánh STT ổn định cho tài khoản hiện có theo thứ tự tạo; không đoán ngày sinh bị thiếu.
WITH numbered AS (
  SELECT id,row_number() OVER(PARTITION BY school_id ORDER BY created_at,id)::integer AS serial
  FROM public.app_users WHERE role='teacher' AND school_id IS NOT NULL
) UPDATE public.app_users u SET teacher_code_serial=n.serial,
    teacher_code_year=extract(year FROM (u.created_at::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh'))::integer%100
  FROM numbered n WHERE u.id=n.id;
INSERT INTO public.app_teacher_code_counters(school_id,last_serial)
SELECT school_id,max(teacher_code_serial) FROM public.app_users WHERE teacher_code_serial IS NOT NULL GROUP BY school_id;
UPDATE public.app_users u SET user_code=public.app_teacher_identity(s.name,u.teacher_code_year,u.birth_date,u.teacher_code_serial)
FROM public.app_schools s WHERE u.school_id=s.id AND u.role='teacher' AND u.birth_date IS NOT NULL;
UPDATE public.app_users SET search_text=search_text || ' ' || lower(user_code)
WHERE role='teacher' AND teacher_code_serial IS NOT NULL AND birth_date IS NOT NULL;
CREATE UNIQUE INDEX app_teacher_serial_school_key ON public.app_users(school_id,teacher_code_serial) WHERE role='teacher' AND teacher_code_serial IS NOT NULL;

CREATE FUNCTION public.app_fill_teacher_identity() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE school_name TEXT; next_serial INTEGER; requested INTEGER; base TEXT;
BEGIN
    IF NEW.role<>'teacher' OR NEW.school_id IS NULL THEN RETURN NEW; END IF;
    SELECT name INTO STRICT school_name FROM public.app_schools WHERE id=NEW.school_id;
    IF TG_OP='INSERT' OR OLD.role<>'teacher' OR OLD.school_id IS DISTINCT FROM NEW.school_id OR OLD.teacher_code_serial IS NULL THEN
        PERFORM pg_advisory_xact_lock(7412026);
        SELECT coalesce((SELECT last_serial FROM public.app_teacher_code_counters WHERE school_id=NEW.school_id),0)+1 INTO next_serial;
        NEW.teacher_code_year:=extract(year FROM (now() AT TIME ZONE 'Asia/Ho_Chi_Minh'))::integer%100;
        base:=public.app_teacher_identity(school_name,NEW.teacher_code_year,NEW.birth_date,1);
        -- Excel đánh STT theo dòng: nhận số hợp lệ còn trống, không lùi/bốc lại số đã cấp.
        base:=left(base,length(base)-3);
        IF base IS NOT NULL AND left(NEW.user_code,length(base))=base AND substring(NEW.user_code FROM length(base)+1) ~ '^[0-9]{3,9}$' THEN
            requested:=substring(NEW.user_code FROM length(base)+1)::integer;
            next_serial:=greatest(next_serial,requested);
        END IF;
        NEW.teacher_code_serial:=next_serial;
        INSERT INTO public.app_teacher_code_counters(school_id,last_serial) VALUES(NEW.school_id,next_serial)
          ON CONFLICT(school_id) DO UPDATE SET last_serial=EXCLUDED.last_serial;
    ELSE
        NEW.teacher_code_serial:=OLD.teacher_code_serial;
        NEW.teacher_code_year:=OLD.teacher_code_year;
    END IF;
    IF NEW.birth_date IS NOT NULL THEN
        NEW.user_code:=public.app_teacher_identity(school_name,NEW.teacher_code_year,NEW.birth_date,NEW.teacher_code_serial);
        NEW.search_text:=coalesce(NEW.search_text,'') || ' ' || lower(NEW.user_code);
    END IF;
    RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.app_fill_teacher_identity() FROM PUBLIC;
CREATE TRIGGER fill_teacher_identity BEFORE INSERT OR UPDATE OF role,school_id,birth_date,user_code,teacher_code_serial,teacher_code_year
  ON public.app_users FOR EACH ROW EXECUTE FUNCTION public.app_fill_teacher_identity();
DO $$ DECLARE r TEXT; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON public.app_teacher_code_counters FROM %I',r);
      EXECUTE format('REVOKE ALL ON FUNCTION public.app_school_initials(TEXT),public.app_teacher_identity(TEXT,INTEGER,DATE,INTEGER),public.app_fill_teacher_identity() FROM %I',r);
    END IF;
  END LOOP;
END $$;
SELECT public.app_install_delete_archives();
