-- Gemma 4 E4B chạy bằng Ollama trên GPU của máy giáo viên (27/11/2026, thay cho gọi API mô hình ngôn ngữ; API cũ thành phương án dự phòng).
-- Bật suy luận (thinking): lưu phần suy luận của câu trả lời và thời gian suy nghĩ để trang hỏi đáp hiện thu gọn dưới câu trả lời
-- ("Tiểu Tướng đã suy nghĩ N giây", bấm mới mở xem). Hai cột tùy chọn: câu trả lời cũ và câu trả lời không qua Gemma để trống.
-- Bảng đã bật RLS từ migration 030 và có kho dữ liệu đã xóa (052, lưu cả dòng) – không đổi quyền, không đổi dữ liệu cũ.

ALTER TABLE public.hk_ai_messages ADD COLUMN IF NOT EXISTS thinking TEXT;
ALTER TABLE public.hk_ai_messages ADD COLUMN IF NOT EXISTS thinking_ms INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hk_ai_messages_thinking_check' AND conrelid = 'public.hk_ai_messages'::regclass) THEN
        ALTER TABLE public.hk_ai_messages ADD CONSTRAINT hk_ai_messages_thinking_check
            CHECK ((thinking IS NULL OR length(thinking) <= 20000) AND (thinking_ms IS NULL OR thinking_ms >= 0));
    END IF;
END $$;

COMMENT ON COLUMN public.hk_ai_messages.thinking IS 'Phần suy luận (thinking) của Gemma 4 cho câu trả lời này; rỗng khi câu trả lời không qua Gemma';
COMMENT ON COLUMN public.hk_ai_messages.thinking_ms IS 'Thời gian suy nghĩ (mili giây) tới chữ đầu tiên của câu trả lời';
