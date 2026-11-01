-- Sprint 10 (HaoKhiDongA): gợi ý học tập cá nhân hóa, thống kê và báo cáo.
-- Báo cáo đọc từ dữ liệu có sẵn (lượt làm bài, tiến độ nút, sự kiện học tập, thi đấu, hội thoại AI) nên chỉ thêm: cấu hình thuật toán gợi ý, các gợi ý đã sinh kèm phản hồi,
-- nhật ký thư nhận xét giáo viên gửi, giá token để ước tính chi phí AI và loại thư "nhận xét" cho hàng đợi email. Mọi bảng mới bật RLS (chỉ máy chủ đọc/ghi).

-- ------------------------------------------------------------------ cấu hình thuật toán gợi ý (HK.AD.063), một dòng duy nhất
CREATE TABLE public.hk_reco_settings (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    -- điểm gợi ý = trọng số điểm yếu × mức yếu + trọng số thời gian × độ lâu chưa ôn + trọng số độ khó × độ phù hợp độ khó
    weight_weak NUMERIC(4, 2) NOT NULL DEFAULT 3 CHECK (weight_weak BETWEEN 0 AND 10),
    weight_time NUMERIC(4, 2) NOT NULL DEFAULT 1 CHECK (weight_time BETWEEN 0 AND 10),
    weight_difficulty NUMERIC(4, 2) NOT NULL DEFAULT 1 CHECK (weight_difficulty BETWEEN 0 AND 10),
    -- chủ đề có tỉ lệ đúng dưới ngưỡng (phần trăm) và đã trả lời đủ số câu tối thiểu thì coi là điểm yếu
    weak_threshold SMALLINT NOT NULL DEFAULT 60 CHECK (weak_threshold BETWEEN 10 AND 95),
    min_answers SMALLINT NOT NULL DEFAULT 3 CHECK (min_answers BETWEEN 1 AND 50),
    -- gợi ý được tính lại khi đã quá số giờ này (và theo lịch nền)
    refresh_hours SMALLINT NOT NULL DEFAULT 6 CHECK (refresh_hours BETWEEN 1 AND 168),
    max_items SMALLINT NOT NULL DEFAULT 3 CHECK (max_items BETWEEN 1 AND 6),
    practice_size SMALLINT NOT NULL DEFAULT 8 CHECK (practice_size BETWEEN 3 AND 20),
    -- học sinh bấm "không hữu ích" cho một loại gợi ý thì loại đó bị giảm điểm theo hệ số này (0–1)
    penalty_not_helpful NUMERIC(3, 2) NOT NULL DEFAULT 0.5 CHECK (penalty_not_helpful BETWEEN 0 AND 1),
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.hk_reco_settings (id) VALUES (1);

-- ------------------------------------------------------------------ gợi ý đã sinh (HK.HS.094, 098; HK.SYS.012)
CREATE TABLE public.hk_recommendations (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('continue', 'weak_topic', 'review', 'assignment', 'streak')),
    title TEXT NOT NULL CHECK (length(title) <= 200),
    reason TEXT NOT NULL CHECK (length(reason) <= 400),
    -- nơi dẫn tới: nút hành trình, chủ đề cần luyện, bài tập của lớp
    ref_type TEXT CHECK (ref_type IS NULL OR ref_type IN ('node', 'campaign', 'figure', 'event', 'place', 'battle', 'source', 'assignment')),
    ref_id INTEGER,
    campaign_id INTEGER,
    score NUMERIC(8, 3) NOT NULL DEFAULT 0,
    generation TIMESTAMPTZ NOT NULL,
    feedback TEXT CHECK (feedback IS NULL OR feedback IN ('helpful', 'not_helpful')),
    feedback_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hk_recommendations_user_idx ON public.hk_recommendations (user_id, generation DESC, score DESC);

-- ------------------------------------------------------------------ thư nhận xét học tập giáo viên gửi (HK.GV.072)
CREATE TABLE public.hk_feedback_mails (
    id BIGSERIAL PRIMARY KEY,
    teacher_id INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    student_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    school_id INTEGER REFERENCES public.app_schools(id) ON DELETE SET NULL,
    recipient TEXT NOT NULL CHECK (recipient IN ('student', 'parent')),
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL CHECK (length(subject) <= 200),
    body TEXT NOT NULL CHECK (length(body) <= 4000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hk_feedback_mails_student_idx ON public.hk_feedback_mails (student_id, created_at DESC);

-- loại thư mới trong hàng đợi email: nhận xét học tập
ALTER TABLE public.app_email_outbox DROP CONSTRAINT IF EXISTS app_email_outbox_kind_check;
ALTER TABLE public.app_email_outbox ADD CONSTRAINT app_email_outbox_kind_check CHECK (kind IN ('bulk', 'delta', 'class', 'feedback'));

-- ------------------------------------------------------------------ giá token để ước tính chi phí AI (HK.AD.008), đơn vị USD cho 1 triệu token
ALTER TABLE public.hk_ai_settings ADD COLUMN price_in NUMERIC(10, 4) NOT NULL DEFAULT 0 CHECK (price_in >= 0);
ALTER TABLE public.hk_ai_settings ADD COLUMN price_out NUMERIC(10, 4) NOT NULL DEFAULT 0 CHECK (price_out >= 0);

ALTER TABLE public.hk_reco_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_feedback_mails ENABLE ROW LEVEL SECURITY;
