-- Thuật toán dùng một chính sách chung, chỉ chạy nội bộ; bỏ cấu hình và thẻ gợi ý khỏi giao diện.
-- Giữ các giá trị chung hiện có, không đặt lại hay tạo cấu hình riêng theo học sinh/trường.
COMMENT ON TABLE public.hk_reco_settings IS 'Chính sách gợi ý nội bộ chung toàn hệ thống (id=1); không có API chỉnh cấu hình.';
COMMENT ON TABLE public.hk_recommendations IS 'Kết quả tính nền nội bộ theo chính sách chung; không hiển thị thành thẻ gợi ý và không có API tự tính lại.';

-- Chỉ sửa đúng nội dung mẫu 033, giữ nguyên câu trả lời do quản trị đã biên tập.
UPDATE public.hk_faq SET answer='Mục "Lớp học" → "Bài tập" liệt kê các bài giáo viên giao kèm hạn nộp. Kế hoạch ôn tập trước hạn nằm trong "Kế hoạch học"; thông báo nhắc bài vẫn ở mục Thông báo.',updated_at=now()
 WHERE audience='student' AND question='Tôi thấy bài tập của lớp ở đâu?'
 AND answer='Mục "Lớp học" → "Bài tập" liệt kê các bài giáo viên giao kèm hạn nộp. Bài sắp đến hạn còn hiện trong "Gợi ý học tập" và có thông báo nhắc.';
