-- 078 (19/11/2026, yêu cầu người dùng):
-- (1) STT trong mã theo quy ước (giáo viên GOT2613101989003, học sinh HSGOT2613102008001) không dừng ở 3 chữ số mà lên tới 1 tỷ: mã vẫn đệm đủ 3 chữ số,
--     từ 1000 trở lên ghi đủ số (đã có từ 056/057); nay nhận STT gõ sẵn trong mã tới 10 chữ số (trước đây tối đa 9 chữ số). STT lưu INTEGER (tới 2.147.483.647).
-- (2) Sửa thông tin giáo viên / học sinh (họ tên, ngày sinh, email, SĐT, giới tính) KHÔNG đổi mã đã cấp: trước đây sửa ngày sinh thì phần ngày sinh trong mã
--     đổi theo. Mã chỉ được cấp khi tạo tài khoản, khi chuyển trường, hoặc lần đầu bổ sung ngày sinh cho tài khoản cũ còn mã tạm (GV… / HS… chưa có ngày sinh).
--     Gửi user_code khác cũng không đổi được mã.
-- (3) Mã tạm GV / HS / LH (mã lớp) cấp theo dãy: nâng giới hạn từ 99.999.999 lên 9.999.999.999, đủ 8 chữ số thì ghi đủ số (không cắt).
-- Không đổi dữ liệu đang có, không đổi quyền (CREATE OR REPLACE giữ quyền đã cấp).

ALTER SEQUENCE public.app_teacher_code_seq MAXVALUE 9999999999;
ALTER SEQUENCE public.app_student_code_seq MAXVALUE 9999999999;
ALTER SEQUENCE public.app_class_code_seq MAXVALUE 9999999999;

CREATE OR REPLACE FUNCTION public.app_registration_code(kind TEXT, allocate BOOLEAN DEFAULT false) RETURNS TEXT
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
        IF n>9999999999 THEN RAISE EXCEPTION 'Đã hết dải mã' USING ERRCODE='22003'; END IF;
        IF allocate THEN n:=nextval(seq); END IF;
        candidate:=prefix || CASE WHEN n<100000000 THEN lpad(n::text,8,'0') ELSE n::text END;
        IF kind='class' THEN SELECT EXISTS(SELECT 1 FROM public.app_classes WHERE registration_code=candidate) INTO used;
        ELSE SELECT EXISTS(SELECT 1 FROM public.app_users WHERE lower(user_code)=lower(candidate)) INTO used;
        END IF;
        IF NOT used THEN RETURN candidate; END IF;
        n:=n+1;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.app_fill_teacher_identity() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE school_name TEXT; next_serial INTEGER; requested INTEGER; base TEXT; fresh BOOLEAN;
BEGIN
    IF NEW.role<>'teacher' OR NEW.school_id IS NULL THEN RETURN NEW; END IF;
    SELECT name INTO STRICT school_name FROM public.app_schools WHERE id=NEW.school_id;
    fresh:=TG_OP='INSERT' OR OLD.role<>'teacher' OR OLD.school_id IS DISTINCT FROM NEW.school_id OR OLD.teacher_code_serial IS NULL;
    IF fresh THEN
        PERFORM pg_advisory_xact_lock(7412026);
        SELECT coalesce((SELECT last_serial FROM public.app_teacher_code_counters WHERE school_id=NEW.school_id),0)+1 INTO next_serial;
        NEW.teacher_code_year:=extract(year FROM (now() AT TIME ZONE 'Asia/Ho_Chi_Minh'))::integer%100;
        base:=public.app_teacher_identity(school_name,NEW.teacher_code_year,NEW.birth_date,1);
        -- Excel đánh STT theo dòng: nhận số hợp lệ còn trống (tới 10 chữ số), không lùi/bốc lại số đã cấp.
        base:=left(base,length(base)-3);
        IF base IS NOT NULL AND left(NEW.user_code,length(base))=base AND substring(NEW.user_code FROM length(base)+1) ~ '^[0-9]{3,10}$'
           AND substring(NEW.user_code FROM length(base)+1)::bigint<=2147483647 THEN
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
    IF NOT fresh AND OLD.birth_date IS NOT NULL AND OLD.user_code IS NOT NULL THEN
        -- mã đã cấp theo quy ước: sửa thông tin không đổi mã
        NEW.user_code:=OLD.user_code;
    ELSIF NEW.birth_date IS NOT NULL THEN
        NEW.user_code:=public.app_teacher_identity(school_name,NEW.teacher_code_year,NEW.birth_date,NEW.teacher_code_serial);
        NEW.search_text:=coalesce(NEW.search_text,'') || ' ' || lower(NEW.user_code);
    END IF;
    RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.app_fill_student_identity() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE school_name TEXT; next_serial INTEGER; requested INTEGER; base TEXT; fresh BOOLEAN;
BEGIN
  IF NEW.role<>'student' OR NEW.school_id IS NULL THEN RETURN NEW; END IF;
  SELECT name INTO STRICT school_name FROM public.app_schools WHERE id=NEW.school_id;
  fresh:=TG_OP='INSERT' OR OLD.role<>'student' OR OLD.school_id IS DISTINCT FROM NEW.school_id OR OLD.student_code_serial IS NULL;
  IF fresh THEN
    PERFORM pg_advisory_xact_lock(7412026);
    NEW.student_code_year:=extract(year FROM (now() AT TIME ZONE 'Asia/Ho_Chi_Minh'))::integer%100;
    base:=public.app_student_identity(school_name,NEW.student_code_year,NEW.birth_date,1);
    base:=left(base,length(base)-3);
    IF base IS NOT NULL AND left(NEW.user_code,length(base))=base AND substring(NEW.user_code FROM length(base)+1) ~ '^[0-9]{3,10}$'
       AND substring(NEW.user_code FROM length(base)+1)::bigint<=2147483647 THEN
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
  IF NOT fresh AND OLD.birth_date IS NOT NULL AND OLD.user_code IS NOT NULL THEN
    -- mã đã cấp theo quy ước: sửa thông tin không đổi mã
    NEW.user_code:=OLD.user_code;
  ELSIF NEW.birth_date IS NOT NULL THEN
    NEW.user_code:=public.app_student_identity(school_name,NEW.student_code_year,NEW.birth_date,NEW.student_code_serial);
    NEW.search_text:=coalesce(NEW.search_text,'') || ' ' || lower(NEW.user_code);
  END IF;
  RETURN NEW;
END $$;
