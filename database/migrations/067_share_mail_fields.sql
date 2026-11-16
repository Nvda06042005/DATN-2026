-- Nội dung đã gửi của giáo viên trình bày như hộp thư (16/11/2026): mỗi yêu cầu gửi duyệt có thêm tiêu đề và lời nhắn
-- do người gửi soạn (như một thư gửi Ban Giám hiệu), nội dung câu hỏi / bộ đề / hành trình là phần đính kèm.
-- Hai cột tùy chọn; yêu cầu cũ để trống và vẫn hiển thị bằng tiêu đề tự đặt. Không đổi dữ liệu, không đổi quyền (bảng đã bật RLS).
ALTER TABLE public.hk_shares
    ADD COLUMN subject TEXT CHECK (subject IS NULL OR length(btrim(subject)) BETWEEN 1 AND 150),
    ADD COLUMN message TEXT CHECK (message IS NULL OR length(message) <= 2000);

COMMENT ON COLUMN public.hk_shares.subject IS 'Tiêu đề thư gửi duyệt do người gửi đặt (tùy chọn)';
COMMENT ON COLUMN public.hk_shares.message IS 'Lời nhắn gửi người duyệt (tùy chọn, tối đa 2000 ký tự)';
