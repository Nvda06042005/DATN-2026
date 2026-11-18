-- 18/11/2026: ngày kết thúc hoạt động của trường (ngày quản trị tổng vô hiệu hóa) hiện cạnh ngày tạo ở danh sách Trường học.
-- Bật lại trường thì xóa ngày kết thúc. Trường đang vô hiệu hóa từ trước: lấy gần đúng thời điểm của lần sửa trường thành công gần nhất
-- trong nhật ký kiểm toán (nhật ký không lưu nội dung sửa nên đây là giá trị xấp xỉ); không có nhật ký thì để trống, không bịa ngày.
ALTER TABLE public.app_schools ADD COLUMN deactivated_at TIMESTAMPTZ;

UPDATE public.app_schools s
SET deactivated_at = (
    SELECT max(e.created_at) FROM public.app_audit_events e
    WHERE e.target_type = 'school' AND e.target_id = s.id::text AND e.success AND e.action LIKE 'PATCH %/schools/:id'
)
WHERE NOT s.is_active;

ALTER TABLE public.app_schools ADD CONSTRAINT app_schools_deactivated_only_inactive CHECK (NOT is_active OR deactivated_at IS NULL);

COMMENT ON COLUMN public.app_schools.deactivated_at IS 'Ngày kết thúc hoạt động: lúc trường bị vô hiệu hóa; NULL khi trường đang hoạt động. Trường đã vô hiệu hóa trước migration 073 lấy xấp xỉ từ nhật ký kiểm toán hoặc để trống.';
