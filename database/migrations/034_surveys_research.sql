-- Sprint 12 (HaoKhiDongA): khảo sát đánh giá trải nghiệm, nhóm thử nghiệm và dữ liệu nghiên cứu ẩn danh (mục tiêu nghiên cứu 5: hiệu quả trò chơi hóa và AI).
-- Bảng mới đều bật RLS (chỉ backend đọc ghi). Mẫu khảo sát khởi tạo chỉ là bộ câu hỏi chung (thang Likert 1–5, NPS 0–10, trắc nghiệm, ý kiến); không có dữ liệu thật.

-- ------------------------------------------------------------------ mẫu khảo sát dùng chung của hệ thống (HK.AD.070)
CREATE TABLE public.hk_survey_templates (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 160),
    description TEXT CHECK (description IS NULL OR length(description) <= 600),
    audience TEXT NOT NULL CHECK (audience IN ('student', 'teacher', 'both')),
    -- danh sách câu hỏi: [{id, type: likert5|nps|single|multi|text, text, options?, required}]
    questions JSONB NOT NULL CHECK (jsonb_typeof(questions) = 'array' AND jsonb_array_length(questions) BETWEEN 1 AND 30),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------ khảo sát của trường (HK.QT.049)
CREATE TABLE public.hk_surveys (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES public.app_schools(id) ON DELETE CASCADE,
    template_id INTEGER REFERENCES public.hk_survey_templates(id) ON DELETE SET NULL,
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 160),
    description TEXT CHECK (description IS NULL OR length(description) <= 600),
    audience TEXT NOT NULL CHECK (audience IN ('student', 'teacher', 'both')),
    -- bản chụp câu hỏi lúc tạo: sửa mẫu sau đó không làm đổi khảo sát đã gửi
    questions JSONB NOT NULL CHECK (jsonb_typeof(questions) = 'array' AND jsonb_array_length(questions) BETWEEN 1 AND 30),
    -- rỗng = cả trường; có giá trị = học sinh của các lớp đó và giáo viên phụ trách các lớp đó
    class_ids INTEGER[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
    opens_at TIMESTAMPTZ,
    closes_at TIMESTAMPTZ,
    notified_at TIMESTAMPTZ,
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (closes_at IS NULL OR opens_at IS NULL OR closes_at > opens_at)
);
CREATE INDEX hk_surveys_school_idx ON public.hk_surveys (school_id, created_at DESC);

-- ------------------------------------------------------------------ câu trả lời (HK.HS.109, HK.GV.079): mỗi người một lần; kết quả luôn ẩn danh
CREATE TABLE public.hk_survey_responses (
    id BIGSERIAL PRIMARY KEY,
    survey_id INTEGER NOT NULL REFERENCES public.hk_surveys(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    answers JSONB NOT NULL CHECK (jsonb_typeof(answers) = 'object'),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (survey_id, user_id)
);

-- ------------------------------------------------------------------ nhóm thử nghiệm (HK.AD.078)
CREATE TABLE public.hk_experiment_groups (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE CHECK (length(btrim(name)) BETWEEN 2 AND 80),
    description TEXT CHECK (description IS NULL OR length(description) <= 400),
    -- có trò chơi hóa (cửa hàng, xếp hạng, thẻ, huy hiệu, nhiệm vụ, quà) và có AI (Tiểu Tướng, gợi ý học tập) hay không
    gamification BOOLEAN NOT NULL DEFAULT true,
    ai BOOLEAN NOT NULL DEFAULT true,
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.hk_experiment_classes (
    class_id INTEGER PRIMARY KEY REFERENCES public.app_classes(id) ON DELETE CASCADE,
    group_id INTEGER NOT NULL REFERENCES public.hk_experiment_groups(id) ON DELETE CASCADE,
    assigned_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hk_experiment_classes_group_idx ON public.hk_experiment_classes (group_id);

ALTER TABLE public.hk_survey_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_experiment_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_experiment_classes ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------ mẫu khảo sát khởi tạo (bản nháp thiết kế, quản trị tổng sửa được ở HK.AD.070)
INSERT INTO public.hk_survey_templates (title, description, audience, questions) VALUES
('Trải nghiệm học lịch sử trên Hào Khí Đông A (học sinh)', 'Em thấy việc học lịch sử trên ứng dụng như thế nào? Khảo sát ẩn danh, không ảnh hưởng điểm số.', 'student', $q$[
  {"id":"q1","type":"likert5","text":"Học trên ứng dụng giúp em hiểu bài lịch sử hơn.","required":true},
  {"id":"q2","type":"likert5","text":"Em thấy các bài học và câu hỏi thú vị.","required":true},
  {"id":"q3","type":"likert5","text":"Ứng dụng dễ sử dụng, em tìm được thứ mình cần.","required":true},
  {"id":"q4","type":"likert5","text":"Em muốn tiếp tục học lịch sử bằng ứng dụng này.","required":true},
  {"id":"q5","type":"single","text":"Em dùng ứng dụng khoảng bao lâu mỗi tuần?","options":["Dưới 30 phút","30 phút đến 1 giờ","1 đến 2 giờ","Trên 2 giờ"],"required":true},
  {"id":"q6","type":"nps","text":"Em có giới thiệu ứng dụng cho bạn bè không? (0 = chắc chắn không, 10 = chắc chắn có)","required":true},
  {"id":"q7","type":"text","text":"Em thích nhất điều gì và muốn thay đổi điều gì?","required":false}
]$q$::jsonb),
('Trò chơi hóa và trợ lý AI Tiểu Tướng (học sinh)', 'Đánh giá tác động của điểm, huy hiệu, bảng xếp hạng, thẻ tướng và trợ lý AI đến việc học của em.', 'student', $q$[
  {"id":"q1","type":"likert5","text":"Điểm, cấp độ và huy hiệu khiến em muốn học đều hơn.","required":true},
  {"id":"q2","type":"likert5","text":"Bảng xếp hạng và thi đấu làm em hào hứng hơn.","required":true},
  {"id":"q3","type":"likert5","text":"Thẻ tướng và bản đồ hành quân giúp em nhớ các nhân vật, trận đánh.","required":true},
  {"id":"q4","type":"likert5","text":"Trợ lý AI Tiểu Tướng giúp em hiểu những chỗ em chưa rõ.","required":true},
  {"id":"q5","type":"likert5","text":"Em tin câu trả lời của Tiểu Tướng là đáng tin cậy.","required":true},
  {"id":"q6","type":"likert5","text":"Gợi ý \"nên học gì hôm nay\" phù hợp với em.","required":true},
  {"id":"q7","type":"multi","text":"Điều gì khiến em muốn quay lại học nhiều nhất? (chọn nhiều)","options":["Điểm và cấp độ","Huy hiệu","Bảng xếp hạng","Thẻ tướng","Thi đấu với bạn","Hỏi Tiểu Tướng","Nội dung bài học"],"required":true},
  {"id":"q8","type":"single","text":"Em hỏi Tiểu Tướng bao nhiêu lần mỗi tuần?","options":["Chưa bao giờ","1 đến 2 lần","3 đến 5 lần","Trên 5 lần"],"required":true},
  {"id":"q9","type":"text","text":"Em có góp ý gì cho trò chơi hóa và trợ lý AI?","required":false}
]$q$::jsonb),
('Trải nghiệm giảng dạy với Hào Khí Đông A (giáo viên)', 'Thầy cô đánh giá công cụ quản lý lớp, giao bài, báo cáo và trợ lý AI. Khảo sát ẩn danh.', 'teacher', $q$[
  {"id":"q1","type":"likert5","text":"Ứng dụng giúp thầy cô tiết kiệm thời gian chuẩn bị bài.","required":true},
  {"id":"q2","type":"likert5","text":"Báo cáo lớp giúp thầy cô nhận ra học sinh cần hỗ trợ.","required":true},
  {"id":"q3","type":"likert5","text":"Nội dung lịch sử và câu hỏi trong ứng dụng chính xác, phù hợp lớp.","required":true},
  {"id":"q4","type":"likert5","text":"Trợ lý AI hữu ích khi soạn câu hỏi và kịch bản tiết học.","required":true},
  {"id":"q5","type":"likert5","text":"Học sinh hứng thú hơn khi học và thi đấu trên ứng dụng.","required":true},
  {"id":"q6","type":"single","text":"Thầy cô dùng ứng dụng cùng lớp thường xuyên đến đâu?","options":["Chưa dùng","Thỉnh thoảng","Mỗi tuần một lần","Nhiều lần mỗi tuần"],"required":true},
  {"id":"q7","type":"nps","text":"Thầy cô có giới thiệu ứng dụng cho đồng nghiệp không? (0 = chắc chắn không, 10 = chắc chắn có)","required":true},
  {"id":"q8","type":"text","text":"Thầy cô muốn bổ sung hoặc cải thiện điều gì?","required":false}
]$q$::jsonb);
