-- Giáo viên đang phụ trách lớp (16/11/2026): trước đây chỉ lấy phân công của đúng học kỳ hiện tại (tính theo ngày). Lớp mới phân công HK1 mà ngày đã
-- sang HK2 (ví dụ năm học cũ vẫn đang hoạt động, hoặc đầu HK2 quản trị trường chưa kịp phân công) thì không ai phụ trách: trang giáo viên
-- (Lớp học, Thống kê lớp) trống dù quản trị trường thấy lớp đã có giáo viên. Nay: học kỳ hiện tại chưa có phân công thì giáo viên của học kỳ
-- gần nhất trước đó tiếp tục phụ trách cho tới khi có phân công mới. Học kỳ hiện tại đã có giáo viên thì giữ đúng như cũ. Không đổi dữ liệu,
-- không đổi quyền (view giữ security_invoker, cột và quyền như migration 054).
CREATE OR REPLACE VIEW public.app_current_class_teachers WITH (security_invoker = true) AS
    SELECT t.class_id, t.teacher_id, t.assigned_by, t.assigned_at
    FROM public.app_classes c
    JOIN public.app_class_teacher_assignments t ON t.class_id = c.id
    WHERE t.semester = (
        SELECT max(a.semester) FROM public.app_class_teacher_assignments a
        WHERE a.class_id = c.id AND a.semester <= COALESCE(public.app_class_semester(c.year_id), 1)
    );

COMMENT ON VIEW public.app_current_class_teachers IS 'Giáo viên đang phụ trách: phân công của học kỳ hiện tại, chưa có thì của học kỳ gần nhất trước đó';
