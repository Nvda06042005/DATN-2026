-- 18/11/2026 (theo lựa chọn của người dùng):
-- (1) Năm học có "Bắt đầu lúc" = thời điểm quản trị trường bấm kích hoạt, đối xứng với "Kết thúc lúc" (ended_at). Năm học đã kích hoạt từ trước lấy
--     thời điểm kích hoạt thành công sớm nhất trong nhật ký kiểm toán; không có nhật ký thì để trống, không bịa ngày.
-- (2) Kho dữ liệu đã xóa (migration 052) nhận thêm loại "replaced": thông tin bị thay thế khi quản trị trường đổi người liên hệ của trường
--     (người liên hệ cũ và danh tính tài khoản quản trị viên trường trước khi cấp lại đăng nhập) được lưu một năm như dữ liệu đã xóa.
--     Vẫn không lưu mật khẩu: máy chủ đưa dữ liệu qua app_archive_redact trước khi ghi.
ALTER TABLE public.app_school_years ADD COLUMN activated_at TIMESTAMPTZ;

UPDATE public.app_school_years y
SET activated_at = (
    SELECT min(e.created_at) FROM public.app_audit_events e
    WHERE e.success AND e.action LIKE 'POST %/school-years/:id/activate' AND e.target_id = y.id::text
)
WHERE y.status IN ('active', 'ended');

COMMENT ON COLUMN public.app_school_years.activated_at IS 'Bắt đầu lúc: thời điểm năm học được kích hoạt. Năm kích hoạt trước migration 076 lấy từ nhật ký kiểm toán hoặc để trống.';

ALTER TABLE public.app_deleted_records DROP CONSTRAINT IF EXISTS app_deleted_records_delete_kind_check;
ALTER TABLE public.app_deleted_records ADD CONSTRAINT app_deleted_records_delete_kind_check
    CHECK (delete_kind IN ('delete', 'soft_delete', 'legacy_soft_delete', 'replaced'));
