-- Luyện binh riêng ôn giãn cách (26/11/2026, bản vẽ "Binh thư Sát Thát" màn 10 "Luyện binh riêng – xếp dòng thời gian": "Ôn lại sau 3 ngày").
-- Câu trả lời sai vào hàng ôn và tới hạn ngay (ô 0). Ở Luyện binh riêng, trả lời đúng một câu đã tới hạn lần thứ nhất thì hẹn ôn lại sau 3 ngày (ô 1);
-- đúng thêm lần nữa khi tới hạn thì câu ra khỏi hàng ôn (cleared_at như trước). Máy chủ chỉ đếm / ưu tiên câu đã tới hạn (due_at rỗng hoặc đã qua).
-- Dòng cũ giữ nguyên: box = 0, due_at rỗng nghĩa là tới hạn ngay – không đổi dữ liệu học sinh. Bảng đã có RLS từ migration 065.

ALTER TABLE public.hk_saga_review ADD COLUMN IF NOT EXISTS box SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE public.hk_saga_review ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hk_saga_review_box_check' AND conrelid = 'public.hk_saga_review'::regclass) THEN
        ALTER TABLE public.hk_saga_review ADD CONSTRAINT hk_saga_review_box_check CHECK (box BETWEEN 0 AND 2);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS hk_saga_review_due_idx ON public.hk_saga_review (user_id, due_at) WHERE cleared_at IS NULL;

COMMENT ON COLUMN public.hk_saga_review.box IS 'Ôn giãn cách: 0 = vừa sai (tới hạn ngay), 1 = đã đúng một lần, hẹn ôn lại; đúng lần nữa khi tới hạn thì cleared_at';
COMMENT ON COLUMN public.hk_saga_review.due_at IS 'Thời điểm câu tới hạn ôn; rỗng = tới hạn ngay';
