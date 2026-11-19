-- 079 (19/11/2026, người dùng: "sửa lại mã tham gia này đúng theo quy ước"): mã tham gia lớp chỉ theo quy ước DongA + lớp + giáo viên phụ trách + HK + năm học
-- (migration 059). Từ nay lớp mới tạo (chỉ Lớp, Học kỳ, Khối, Sĩ số dự kiến) chưa có mã; phân công giáo viên xong máy chủ cấp mã theo quy ước.
-- Dữ liệu đang có: (1) lớp CHƯA TỪNG có giáo viên phụ trách mà còn mã 6 ký tự ngẫu nhiên kiểu cũ: bỏ mã (NULL) – học sinh đã vào lớp vẫn giữ nguyên;
-- (2) lớp đã có giáo viên mà còn mã ngẫu nhiên: đổi sang mã theo quy ước (giáo viên của học kỳ hiện tại, không có thì học kỳ gần nhất), trùng thì thêm -2, -3…
-- như app_free_join_code. Bỏ dấu tiếng Việt bằng bảng chữ cố định (cùng kết quả với plainAscii của máy chủ). Không đổi dữ liệu khác, không đổi quyền.
UPDATE public.app_classes c SET join_code = NULL
 WHERE c.join_code ~ '^[A-Z0-9]{6}$'
   AND NOT EXISTS (SELECT 1 FROM public.app_class_teacher_assignments t WHERE t.class_id = c.id);

DO $$
DECLARE r RECORD; words TEXT[]; teacher TEXT; base TEXT;
BEGIN
  FOR r IN
    SELECT c.id, c.name, c.school_year, a.semester, u.full_name
      FROM public.app_classes c
      JOIN LATERAL (SELECT t.semester, t.teacher_id FROM public.app_class_teacher_assignments t WHERE t.class_id = c.id
                     ORDER BY (t.semester = COALESCE(public.app_class_semester(c.year_id), 1)) DESC, t.semester DESC LIMIT 1) a ON true
      JOIN public.app_users u ON u.id = a.teacher_id
     WHERE c.join_code ~ '^[A-Z0-9]{6}$'
     ORDER BY c.id
  LOOP
    words := regexp_split_to_array(btrim(regexp_replace(translate(r.full_name, 'àÀáÁảẢãÃạẠăĂằẰắẮẳẲẵẴặẶâÂầẦấẤẩẨẫẪậẬèÈéÉẻẺẽẼẹẸêÊềỀếẾểỂễỄệỆìÌíÍỉỈĩĨịỊòÒóÓỏỎõÕọỌôÔồỒốỐổỔỗỖộỘơƠờỜớỚởỞỡỠợỢùÙúÚủỦũŨụỤưƯừỪứỨửỬữỮựỰỳỲýÝỷỶỹỸỵỴđĐ', 'aAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAeEeEeEeEeEeEeEeEeEeEeEiIiIiIiIiIoOoOoOoOoOoOoOoOoOoOoOoOoOoOoOoOoOuUuUuUuUuUuUuUuUuUuUuUyYyYyYyYyYdD'), '[^A-Za-z0-9 ]', ' ', 'g')), '\s+');
    teacher := replace(initcap(lower(CASE WHEN array_length(words, 1) > 1 THEN array_to_string(words[2:], ' ') ELSE words[1] END)), ' ', '');
    base := left('DongA' || regexp_replace(translate(r.name, 'àÀáÁảẢãÃạẠăĂằẰắẮẳẲẵẴặẶâÂầẦấẤẩẨẫẪậẬèÈéÉẻẺẽẼẹẸêÊềỀếẾểỂễỄệỆìÌíÍỉỈĩĨịỊòÒóÓỏỎõÕọỌôÔồỒốỐổỔỗỖộỘơƠờỜớỚởỞỡỠợỢùÙúÚủỦũŨụỤưƯừỪứỨửỬữỮựỰỳỲýÝỷỶỹỸỵỴđĐ', 'aAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAeEeEeEeEeEeEeEeEeEeEeEiIiIiIiIiIoOoOoOoOoOoOoOoOoOoOoOoOoOoOoOoOoOuUuUuUuUuUuUuUuUuUuUuUyYyYyYyYyYdD'), '[^A-Za-z0-9]', '', 'g') || teacher || 'HK' || r.semester || regexp_replace(r.school_year, '[^0-9-]', '', 'g'), 70);
    IF base ~ '^[A-Za-z0-9-]{6,70}$' THEN
      UPDATE public.app_classes SET join_code = public.app_free_join_code(base, r.id) WHERE id = r.id;
    END IF;
  END LOOP;
END $$;
