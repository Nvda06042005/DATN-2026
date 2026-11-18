-- 077: khối 6, 7, 8, 9 luôn có và đang bật ở mọi năm học chưa kết thúc (18/11/2026).
-- Người dùng yêu cầu bỏ mục "Khối lớp" (bật / tắt / xóa khối) khỏi trang Trường và năm học: "khi bật năm học là auto có khối 6, 7, 8, 9".
-- Từ nay máy chủ tự thêm và bật đủ bốn khối khi tạo / kích hoạt năm học; migration này làm điều tương tự cho dữ liệu đang có để không còn khối
-- bị tắt hoặc bị xóa mà giao diện không bật lại được (tạo lớp ở khối tắt bị chặn). Năm học đã kết thúc giữ nguyên (không sửa dữ liệu năm đã khóa).
-- Chỉ thêm dòng còn thiếu và đổi is_active = false thành true; không xóa dữ liệu, không đổi lớp, không đổi quyền.
INSERT INTO public.app_school_grades (school_id, school_year, grade, is_active)
SELECT y.school_id, y.label, g::smallint, true
  FROM public.app_school_years y
 CROSS JOIN generate_series(6, 9) g
 WHERE y.status <> 'ended'
   AND y.label ~ '^[0-9]{4}-[0-9]{4}$'
ON CONFLICT (school_id, school_year, grade) DO UPDATE
   SET is_active = true, updated_at = now()
 WHERE NOT public.app_school_grades.is_active;
