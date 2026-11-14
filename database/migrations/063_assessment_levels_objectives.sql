-- Nâng cấp Ngân hàng câu hỏi, Bộ đề và Bài học (yêu cầu 14/11/2026, tham khảo các nền tảng giáo dục trong và ngoài nước):
-- 1) Mức độ nhận thức của câu hỏi theo hướng dẫn kiểm tra, đánh giá (Công văn 7991/BGDĐT-GDTrH): 1 Biết, 2 Hiểu, 3 Vận dụng.
--    Dùng cho ma trận đề (chọn số câu theo chủ đề × mức độ) và bảng ma trận của bộ đề. Câu hỏi hiện có lấy giá trị ban đầu theo độ khó
--    (Dễ → Biết, Vừa → Hiểu, Khó → Vận dụng); câu tạo mới không ghi mức độ thì trigger cũng lấy theo độ khó. Không đổi cột nào khác.
-- 2) Mục tiêu bài học (yêu cầu cần đạt), hiện ở đầu bài cho học sinh. Cột mới cho phép NULL.
ALTER TABLE public.hk_questions ADD COLUMN cognitive_level SMALLINT;
UPDATE public.hk_questions SET cognitive_level = difficulty WHERE cognitive_level IS NULL;
ALTER TABLE public.hk_questions ALTER COLUMN cognitive_level SET NOT NULL;
ALTER TABLE public.hk_questions ADD CONSTRAINT hk_questions_cognitive_level_check CHECK (cognitive_level BETWEEN 1 AND 3);
CREATE INDEX hk_questions_matrix_idx ON public.hk_questions (campaign_id, cognitive_level);

CREATE FUNCTION public.app_question_level_default() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.cognitive_level IS NULL THEN
    NEW.cognitive_level := LEAST(GREATEST(COALESCE(NEW.difficulty, 2), 1), 3);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.app_question_level_default() FROM PUBLIC;

CREATE TRIGGER hk_questions_level_default
  BEFORE INSERT ON public.hk_questions
  FOR EACH ROW EXECUTE FUNCTION public.app_question_level_default();

ALTER TABLE public.hk_lessons ADD COLUMN objectives TEXT CHECK (objectives IS NULL OR length(objectives) <= 1000);
