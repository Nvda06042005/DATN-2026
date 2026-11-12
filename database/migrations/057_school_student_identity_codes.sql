-- Mã học sinh: HS + viết tắt trường + năm nhập yy + ngày sinh ddmmyyyy + STT.
-- Giữ id, username, phiên, lớp, tiến độ; không đoán ngày sinh bị thiếu.
ALTER TABLE public.app_users ADD COLUMN student_code_serial INTEGER CHECK(student_code_serial>0);
ALTER TABLE public.app_users ADD COLUMN student_code_year SMALLINT CHECK(student_code_year BETWEEN 0 AND 99);
CREATE TABLE public.app_student_code_counters (
  school_id INTEGER PRIMARY KEY REFERENCES public.app_schools(id) ON DELETE CASCADE,
  last_serial INTEGER NOT NULL CHECK(last_serial>0)
);
ALTER TABLE public.app_student_code_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_student_code_counters FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.app_student_code_counters TO dong_a_school_scope,dong_a_workspace_scope;
CREATE POLICY school_scope ON public.app_student_code_counters FOR ALL TO dong_a_school_scope,dong_a_workspace_scope
  USING(school_id=NULLIF(current_setting('app.school_id',true),'')::integer)
  WITH CHECK(school_id=NULLIF(current_setting('app.school_id',true),'')::integer);

CREATE FUNCTION public.app_student_identity(school_name TEXT, code_year INTEGER, born DATE, serial INTEGER) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
  SELECT CASE WHEN born IS NOT NULL THEN 'HS' || public.app_school_initials(school_name)
    || lpad(code_year::text,2,'0') || to_char(born,'DDMMYYYY')
    || CASE WHEN serial<1000 THEN lpad(serial::text,3,'0') ELSE serial::text END END
$$;
REVOKE ALL ON FUNCTION public.app_student_identity(TEXT,INTEGER,DATE,INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_student_identity(TEXT,INTEGER,DATE,INTEGER) TO dong_a_school_scope,dong_a_workspace_scope;

-- Chỉ trả số, không trả thông tin tài khoản khác. Kiểm tra toàn hệ thống để hai
-- trường trùng viết tắt/ngày sinh/năm không sinh trùng mã; xem trước không cấp số.
CREATE FUNCTION public.app_next_student_serial(target_school INTEGER, code_year INTEGER, born DATE, requested INTEGER DEFAULT NULL) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE school_name TEXT; candidate INTEGER; scope INTEGER;
BEGIN
  scope:=NULLIF(current_setting('app.school_id',true),'')::integer;
  IF (current_setting('role',true) IN ('dong_a_school_scope','dong_a_workspace_scope') AND scope IS NULL)
     OR (scope IS NOT NULL AND scope<>target_school) THEN
    RAISE EXCEPTION 'Không được xem mã trường khác' USING ERRCODE='42501';
  END IF;
  IF code_year NOT BETWEEN 0 AND 99 OR requested<1 THEN
    RAISE EXCEPTION 'Tham số mã không hợp lệ' USING ERRCODE='22023';
  END IF;
  SELECT name INTO STRICT school_name FROM public.app_schools WHERE id=target_school;
  SELECT greatest(coalesce((SELECT last_serial FROM public.app_student_code_counters WHERE school_id=target_school),0)+1,coalesce(requested,1)) INTO candidate;
  WHILE born IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.app_users WHERE lower(user_code)=lower(public.app_student_identity(school_name,code_year,born,candidate))
  ) LOOP
    candidate:=candidate+1;
  END LOOP;
  RETURN candidate;
END $$;
REVOKE ALL ON FUNCTION public.app_next_student_serial(INTEGER,INTEGER,DATE,INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_next_student_serial(INTEGER,INTEGER,DATE,INTEGER) TO dong_a_school_scope,dong_a_workspace_scope;

-- Cấp STT ổn định cho dữ liệu đang có theo thời điểm tạo; tránh cả mã đã tồn tại.
DO $$ DECLARE r RECORD; n INTEGER; y INTEGER; BEGIN
  PERFORM pg_advisory_xact_lock(7412026);
  FOR r IN SELECT u.id,u.school_id,u.birth_date,u.created_at,s.name FROM public.app_users u
    JOIN public.app_schools s ON s.id=u.school_id WHERE u.role='student' ORDER BY u.created_at,u.id LOOP
    y:=extract(year FROM (r.created_at::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh'))::integer%100;
    n:=public.app_next_student_serial(r.school_id,y,r.birth_date,NULL);
    INSERT INTO public.app_student_code_counters(school_id,last_serial) VALUES(r.school_id,n)
      ON CONFLICT(school_id) DO UPDATE SET last_serial=EXCLUDED.last_serial;
    UPDATE public.app_users SET student_code_serial=n,student_code_year=y,
      user_code=CASE WHEN r.birth_date IS NOT NULL THEN public.app_student_identity(r.name,y,r.birth_date,n) ELSE user_code END,
      search_text=coalesce(search_text,'') || CASE WHEN r.birth_date IS NOT NULL THEN ' ' || lower(public.app_student_identity(r.name,y,r.birth_date,n)) ELSE '' END
      WHERE id=r.id;
  END LOOP;
END $$;
CREATE UNIQUE INDEX app_student_serial_school_key ON public.app_users(school_id,student_code_serial) WHERE role='student' AND student_code_serial IS NOT NULL;

CREATE FUNCTION public.app_fill_student_identity() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE school_name TEXT; next_serial INTEGER; requested INTEGER; base TEXT;
BEGIN
  IF NEW.role<>'student' OR NEW.school_id IS NULL THEN RETURN NEW; END IF;
  SELECT name INTO STRICT school_name FROM public.app_schools WHERE id=NEW.school_id;
  IF TG_OP='INSERT' OR OLD.role<>'student' OR OLD.school_id IS DISTINCT FROM NEW.school_id OR OLD.student_code_serial IS NULL THEN
    PERFORM pg_advisory_xact_lock(7412026);
    NEW.student_code_year:=extract(year FROM (now() AT TIME ZONE 'Asia/Ho_Chi_Minh'))::integer%100;
    base:=public.app_student_identity(school_name,NEW.student_code_year,NEW.birth_date,1);
    base:=left(base,length(base)-3);
    IF base IS NOT NULL AND left(NEW.user_code,length(base))=base AND substring(NEW.user_code FROM length(base)+1) ~ '^[0-9]{3,9}$' THEN
      requested:=substring(NEW.user_code FROM length(base)+1)::integer;
    END IF;
    next_serial:=public.app_next_student_serial(NEW.school_id,NEW.student_code_year,NEW.birth_date,requested);
    NEW.student_code_serial:=next_serial;
    INSERT INTO public.app_student_code_counters(school_id,last_serial) VALUES(NEW.school_id,next_serial)
      ON CONFLICT(school_id) DO UPDATE SET last_serial=EXCLUDED.last_serial;
  ELSE
    NEW.student_code_serial:=OLD.student_code_serial;
    NEW.student_code_year:=OLD.student_code_year;
  END IF;
  IF NEW.birth_date IS NOT NULL THEN
    NEW.user_code:=public.app_student_identity(school_name,NEW.student_code_year,NEW.birth_date,NEW.student_code_serial);
    NEW.search_text:=coalesce(NEW.search_text,'') || ' ' || lower(NEW.user_code);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.app_fill_student_identity() FROM PUBLIC;
CREATE TRIGGER fill_student_identity BEFORE INSERT OR UPDATE OF role,school_id,birth_date,user_code,student_code_serial,student_code_year
  ON public.app_users FOR EACH ROW EXECUTE FUNCTION public.app_fill_student_identity();
DO $$ DECLARE r TEXT; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON public.app_student_code_counters FROM %I',r);
      EXECUTE format('REVOKE ALL ON FUNCTION public.app_student_identity(TEXT,INTEGER,DATE,INTEGER),public.app_next_student_serial(INTEGER,INTEGER,DATE,INTEGER),public.app_fill_student_identity() FROM %I',r);
    END IF;
  END LOOP;
END $$;
SELECT public.app_install_delete_archives();
