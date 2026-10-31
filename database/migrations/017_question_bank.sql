-- HK Sprint 4 (HK.GV.030–044, HK.QT.041, HK.AD.045): ngân hàng câu hỏi nhiều dạng, bộ đề, lịch sử chỉnh sửa, liên kết dữ liệu lịch sử
-- và quy trình chia sẻ/duyệt (giáo viên → kho trường → kho hệ thống). Mỗi nội dung thuộc một phạm vi: 'teacher' (của giáo viên),
-- 'school' (của trường), 'system' (của hệ thống). Chỉ backend (chủ bảng) đọc/ghi; bảng bật RLS, không cấp quyền cho vai trò theo trường.

CREATE TABLE public.hk_questions (
    id SERIAL PRIMARY KEY,
    scope TEXT NOT NULL CHECK (scope IN ('teacher', 'school', 'system')),
    school_id INTEGER REFERENCES public.app_schools(id) ON DELETE CASCADE,
    owner_id INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    -- single: 1 đáp án; multiple: nhiều đáp án; truefalse: đúng/sai; fill: điền khuyết; order: sắp xếp thứ tự; map: kéo thả địa danh lên bản đồ
    qtype TEXT NOT NULL CHECK (qtype IN ('single', 'multiple', 'truefalse', 'fill', 'order', 'map')),
    prompt TEXT NOT NULL CHECK (length(btrim(prompt)) BETWEEN 3 AND 1000),
    image_url TEXT CHECK (image_url IS NULL OR (image_url ~ '^https://' AND length(image_url) <= 500)),
    explanation TEXT CHECK (explanation IS NULL OR length(explanation) <= 2000),
    difficulty SMALLINT NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 3),
    campaign_id INTEGER REFERENCES public.hist_campaigns(id) ON DELETE SET NULL,
    -- Nội dung theo dạng (lựa chọn, đáp án đúng, thứ tự, tọa độ đích...); máy chủ kiểm tra cấu trúc trước khi ghi
    data JSONB NOT NULL CHECK (jsonb_typeof(data) = 'object'),
    search_text TEXT NOT NULL DEFAULT '',
    version_no INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((scope = 'system') = (school_id IS NULL))
);
CREATE INDEX hk_questions_owner_idx ON public.hk_questions (owner_id, updated_at DESC);
CREATE INDEX hk_questions_scope_idx ON public.hk_questions (scope, school_id, campaign_id);

-- Gắn câu hỏi với dữ liệu lịch sử để thống kê điểm yếu theo chủ đề (HK.GV.037) và dẫn tới tư liệu trong lời giải thích (HK.HS.046)
CREATE TABLE public.hk_question_links (
    question_id INTEGER NOT NULL REFERENCES public.hk_questions(id) ON DELETE CASCADE,
    ref_type TEXT NOT NULL CHECK (ref_type IN ('campaign', 'figure', 'event', 'place', 'battle', 'source')),
    ref_id INTEGER NOT NULL,
    PRIMARY KEY (question_id, ref_type, ref_id)
);
CREATE INDEX hk_question_links_ref_idx ON public.hk_question_links (ref_type, ref_id);

-- Lịch sử chỉnh sửa (HK.GV.033): chỉ thêm
CREATE TABLE public.hk_question_versions (
    id BIGSERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES public.hk_questions(id) ON DELETE CASCADE,
    version_no INTEGER NOT NULL CHECK (version_no >= 1),
    snapshot JSONB NOT NULL,
    changed_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (question_id, version_no)
);

CREATE TABLE public.hk_quizzes (
    id SERIAL PRIMARY KEY,
    scope TEXT NOT NULL CHECK (scope IN ('teacher', 'school', 'system')),
    school_id INTEGER REFERENCES public.app_schools(id) ON DELETE CASCADE,
    owner_id INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 160),
    description TEXT CHECK (description IS NULL OR length(description) <= 1000),
    campaign_id INTEGER REFERENCES public.hist_campaigns(id) ON DELETE SET NULL,
    -- Thời gian mỗi câu mặc định 20 giây (HK.HS.045); từng câu trong bộ đề có thể đặt riêng
    seconds_per_question SMALLINT NOT NULL DEFAULT 20 CHECK (seconds_per_question BETWEEN 5 AND 300),
    shuffle_questions BOOLEAN NOT NULL DEFAULT false,
    shuffle_options BOOLEAN NOT NULL DEFAULT false,
    -- Điểm tối thiểu (% tổng điểm gốc) để coi là đạt; nút trên bản đồ có thể yêu cầu cao hơn
    pass_percent SMALLINT NOT NULL DEFAULT 60 CHECK (pass_percent BETWEEN 1 AND 100),
    search_text TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((scope = 'system') = (school_id IS NULL))
);
CREATE INDEX hk_quizzes_owner_idx ON public.hk_quizzes (owner_id, updated_at DESC);
CREATE INDEX hk_quizzes_scope_idx ON public.hk_quizzes (scope, school_id);

CREATE TABLE public.hk_quiz_questions (
    quiz_id INTEGER NOT NULL REFERENCES public.hk_quizzes(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES public.hk_questions(id) ON DELETE RESTRICT,
    position INTEGER NOT NULL,
    points INTEGER NOT NULL DEFAULT 100 CHECK (points BETWEEN 10 AND 1000),
    seconds SMALLINT CHECK (seconds IS NULL OR seconds BETWEEN 5 AND 300),
    PRIMARY KEY (quiz_id, question_id)
);
CREATE INDEX hk_quiz_questions_question_idx ON public.hk_quiz_questions (question_id);

-- Chia sẻ và duyệt nội dung (HK.GV.039, HK.QT.041, HK.QT.042, HK.AD.045): giáo viên gửi vào kho trường, quản trị trường gửi lên kho hệ thống
CREATE TABLE public.hk_shares (
    id SERIAL PRIMARY KEY,
    entity TEXT NOT NULL CHECK (entity IN ('question', 'quiz', 'journey')),
    entity_id INTEGER NOT NULL,
    target TEXT NOT NULL CHECK (target IN ('school', 'system')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    -- Khi duyệt, nội dung được sao thành một bản mới trong kho đích (bản của người gửi giữ nguyên để họ tiếp tục sửa); result_id là bản sao đó
    result_id INTEGER,
    school_id INTEGER REFERENCES public.app_schools(id) ON DELETE CASCADE,
    requested_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    reviewed_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    review_note TEXT CHECK (review_note IS NULL OR length(review_note) <= 300),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    UNIQUE (entity, entity_id, target)
);
CREATE INDEX hk_shares_review_idx ON public.hk_shares (target, status, school_id);

ALTER TABLE public.hk_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_question_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_question_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_shares ENABLE ROW LEVEL SECURITY;
