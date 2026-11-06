-- HK Sprint 3 (HK.HS.017–042, HK.GV.018–021, HK.AD.043–044, HK.SYS.007, HK.SYS.014) và phần làm bài của Sprint 4 (HK.HS.043–050):
-- bài học, hành trình học (quest map) gồm các nút nối tiếp, tiến độ và sao của học sinh, mở khóa tư liệu, lượt làm bài chấm ở máy chủ,
-- câu đã sai để luyện lại, điểm, ghi chú, tư liệu yêu thích và nhật ký sự kiện học tập. Chỉ backend (chủ bảng) đọc/ghi; bảng bật RLS,
-- không cấp quyền cho vai trò theo trường hay công khai. Nội dung khởi tạo (bản nháp) nằm ở migration kế tiếp.

-- ------------------------------------------------------------------ bài học (quản trị tổng soạn, HK.AD.044)
CREATE TABLE public.hk_lessons (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 160),
    summary TEXT CHECK (summary IS NULL OR length(summary) <= 600),
    campaign_id INTEGER REFERENCES public.hist_campaigns(id) ON DELETE SET NULL,
    -- Các khối nội dung theo thứ tự: {type:'text'|'image'|'video'|'map', ...}; máy chủ kiểm tra từng khối trước khi ghi
    blocks JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(blocks) = 'array'),
    read_minutes SMALLINT NOT NULL DEFAULT 3 CHECK (read_minutes BETWEEN 1 AND 120),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    search_text TEXT NOT NULL DEFAULT '',
    published_at TIMESTAMPTZ,
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hk_lessons_campaign_idx ON public.hk_lessons (campaign_id, status);

-- Gắn bài học với dữ liệu lịch sử (nhân vật, sự kiện, địa điểm, trận đánh, tư liệu, thuật ngữ)
CREATE TABLE public.hk_lesson_links (
    lesson_id INTEGER NOT NULL REFERENCES public.hk_lessons(id) ON DELETE CASCADE,
    ref_type TEXT NOT NULL CHECK (ref_type IN ('campaign', 'figure', 'event', 'place', 'battle', 'source', 'term')),
    ref_id INTEGER NOT NULL,
    PRIMARY KEY (lesson_id, ref_type, ref_id)
);

-- Câu hỏi kiểm tra nhanh cuối bài (HK.HS.030): trả lời đúng hết mới đánh dấu hoàn thành
CREATE TABLE public.hk_lesson_checks (
    lesson_id INTEGER NOT NULL REFERENCES public.hk_lessons(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES public.hk_questions(id) ON DELETE RESTRICT,
    position INTEGER NOT NULL,
    PRIMARY KEY (lesson_id, question_id)
);
CREATE INDEX hk_lesson_checks_question_idx ON public.hk_lesson_checks (question_id);

-- ------------------------------------------------------------------ hành trình học (HK.GV.018–021, HK.AD.043)
CREATE TABLE public.hk_journeys (
    id SERIAL PRIMARY KEY,
    scope TEXT NOT NULL CHECK (scope IN ('teacher', 'school', 'system')),
    school_id INTEGER REFERENCES public.app_schools(id) ON DELETE CASCADE,
    owner_id INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 160),
    description TEXT CHECK (description IS NULL OR length(description) <= 1000),
    campaign_id INTEGER NOT NULL REFERENCES public.hist_campaigns(id) ON DELETE RESTRICT,
    background_url TEXT CHECK (background_url IS NULL OR (background_url ~ '^https://' AND length(background_url) <= 500)),
    -- Hành trình mặc định của hệ thống cho một cuộc kháng chiến: học sinh chưa được giáo viên giao hành trình nào sẽ học theo hành trình này
    is_default BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    copied_from INTEGER REFERENCES public.hk_journeys(id) ON DELETE SET NULL,
    search_text TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((scope = 'system') = (school_id IS NULL)),
    CHECK (NOT is_default OR scope = 'system')
);
CREATE UNIQUE INDEX hk_journeys_default_key ON public.hk_journeys (campaign_id) WHERE is_default;
CREATE INDEX hk_journeys_owner_idx ON public.hk_journeys (owner_id, updated_at DESC);
CREATE INDEX hk_journeys_scope_idx ON public.hk_journeys (scope, school_id, campaign_id);

-- Nút trên bản đồ: bài học, bộ câu hỏi, trận đánh (đọc hồ sơ trận đánh, có thể kèm bộ câu hỏi), tư liệu, trận "Quyết chiến" cuối chiến dịch.
-- Nút mở khóa theo thứ tự: hoàn thành nút trước mới mở nút sau (nhánh rẽ và điều kiện tùy chỉnh thuộc Sprint 7).
CREATE TABLE public.hk_nodes (
    id SERIAL PRIMARY KEY,
    journey_id INTEGER NOT NULL REFERENCES public.hk_journeys(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position >= 1),
    kind TEXT NOT NULL CHECK (kind IN ('lesson', 'quiz', 'battle', 'source', 'final')),
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 120),
    icon TEXT CHECK (icon IS NULL OR icon ~ '^[a-z_]{2,20}$'),
    objective TEXT CHECK (objective IS NULL OR length(objective) <= 400),
    lesson_id INTEGER REFERENCES public.hk_lessons(id) ON DELETE RESTRICT,
    quiz_id INTEGER REFERENCES public.hk_quizzes(id) ON DELETE RESTRICT,
    source_id INTEGER REFERENCES public.hist_sources(id) ON DELETE RESTRICT,
    battle_id INTEGER REFERENCES public.hist_battles(id) ON DELETE RESTRICT,
    -- NULL: dùng ngưỡng đạt của bộ câu hỏi; trận Quyết chiến mặc định 70% (HK.HS.050)
    pass_percent SMALLINT CHECK (pass_percent IS NULL OR pass_percent BETWEEN 1 AND 100),
    reward_points INTEGER NOT NULL DEFAULT 50 CHECK (reward_points BETWEEN 0 AND 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (
        (kind = 'lesson' AND lesson_id IS NOT NULL) OR (kind = 'quiz' AND quiz_id IS NOT NULL) OR
        (kind = 'battle' AND battle_id IS NOT NULL) OR (kind = 'source' AND source_id IS NOT NULL) OR
        (kind = 'final' AND quiz_id IS NOT NULL)
    ),
    UNIQUE (journey_id, position) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX hk_nodes_lesson_idx ON public.hk_nodes (lesson_id) WHERE lesson_id IS NOT NULL;
CREATE INDEX hk_nodes_quiz_idx ON public.hk_nodes (quiz_id) WHERE quiz_id IS NOT NULL;

-- Tư liệu được mở khóa khi hoàn thành nút (HK.HS.041, HK.SYS.007); nút loại "tư liệu" tự mở chính tư liệu của nó
CREATE TABLE public.hk_node_unlocks (
    node_id INTEGER NOT NULL REFERENCES public.hk_nodes(id) ON DELETE CASCADE,
    source_id INTEGER NOT NULL REFERENCES public.hist_sources(id) ON DELETE CASCADE,
    PRIMARY KEY (node_id, source_id)
);
CREATE INDEX hk_node_unlocks_source_idx ON public.hk_node_unlocks (source_id);

-- Hành trình được giao cho lớp (xếp lịch và nhiều hành trình cùng lúc nằm ở Sprint 7)
CREATE TABLE public.hk_class_journeys (
    class_id INTEGER NOT NULL REFERENCES public.app_classes(id) ON DELETE CASCADE,
    journey_id INTEGER NOT NULL REFERENCES public.hk_journeys(id) ON DELETE CASCADE,
    assigned_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (class_id, journey_id)
);
CREATE INDEX hk_class_journeys_journey_idx ON public.hk_class_journeys (journey_id);

-- ------------------------------------------------------------------ tiến độ học sinh
CREATE TABLE public.hk_node_progress (
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    node_id INTEGER NOT NULL REFERENCES public.hk_nodes(id) ON DELETE CASCADE,
    best_percent SMALLINT NOT NULL DEFAULT 0 CHECK (best_percent BETWEEN 0 AND 100),
    stars SMALLINT NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 3),
    best_points INTEGER NOT NULL DEFAULT 0 CHECK (best_points >= 0),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, node_id)
);
CREATE INDEX hk_node_progress_node_idx ON public.hk_node_progress (node_id, completed_at);

CREATE TABLE public.hk_unlocked_sources (
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    source_id INTEGER NOT NULL REFERENCES public.hist_sources(id) ON DELETE CASCADE,
    node_id INTEGER REFERENCES public.hk_nodes(id) ON DELETE SET NULL,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, source_id)
);

CREATE TABLE public.hk_lesson_progress (
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    lesson_id INTEGER NOT NULL REFERENCES public.hk_lessons(id) ON DELETE CASCADE,
    read_percent SMALLINT NOT NULL DEFAULT 0 CHECK (read_percent BETWEEN 0 AND 100),
    check_attempts INTEGER NOT NULL DEFAULT 0 CHECK (check_attempts >= 0),
    first_try_correct BOOLEAN,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, lesson_id)
);

-- ------------------------------------------------------------------ lượt làm bài (HK.HS.043–050): máy chủ giữ đề, đồng hồ và đáp án
CREATE TABLE public.hk_attempts (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    quiz_id INTEGER REFERENCES public.hk_quizzes(id) ON DELETE CASCADE,
    node_id INTEGER REFERENCES public.hk_nodes(id) ON DELETE SET NULL,
    -- node: làm bài ở nút trên bản đồ; practice: luyện lại câu sai; preview: giáo viên làm thử bộ đề (không lưu vào tiến độ)
    mode TEXT NOT NULL CHECK (mode IN ('node', 'practice', 'preview')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done')),
    -- Danh sách câu đã chốt khi bắt đầu: [{question_id, points, seconds, seed}] theo đúng thứ tự phát cho học sinh
    plan JSONB NOT NULL CHECK (jsonb_typeof(plan) = 'array'),
    position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
    served_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    pass_percent SMALLINT NOT NULL DEFAULT 60 CHECK (pass_percent BETWEEN 1 AND 100),
    base_points INTEGER NOT NULL DEFAULT 0,
    bonus_points INTEGER NOT NULL DEFAULT 0,
    max_points INTEGER NOT NULL DEFAULT 0,
    percent SMALLINT NOT NULL DEFAULT 0 CHECK (percent BETWEEN 0 AND 100),
    stars SMALLINT NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 3),
    correct_count INTEGER NOT NULL DEFAULT 0,
    wrong_count INTEGER NOT NULL DEFAULT 0,
    passed BOOLEAN,
    duration_ms INTEGER,
    -- Kết quả khi kết thúc lượt ở nút trên bản đồ (điểm thưởng, tư liệu mở khóa, nút kế tiếp...) để màn hình kết quả hiện lại đúng sau khi tải lại trang
    result JSONB
);
CREATE INDEX hk_attempts_user_idx ON public.hk_attempts (user_id, started_at DESC);
CREATE INDEX hk_attempts_node_idx ON public.hk_attempts (node_id, user_id);
CREATE INDEX hk_attempts_quiz_idx ON public.hk_attempts (quiz_id);

CREATE TABLE public.hk_attempt_answers (
    attempt_id BIGINT NOT NULL REFERENCES public.hk_attempts(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES public.hk_questions(id) ON DELETE RESTRICT,
    position INTEGER NOT NULL,
    answer JSONB,
    correct BOOLEAN NOT NULL,
    timed_out BOOLEAN NOT NULL DEFAULT false,
    base_points INTEGER NOT NULL DEFAULT 0,
    bonus_points INTEGER NOT NULL DEFAULT 0,
    time_ms INTEGER NOT NULL DEFAULT 0 CHECK (time_ms >= 0),
    answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (attempt_id, question_id)
);
CREATE INDEX hk_attempt_answers_question_idx ON public.hk_attempt_answers (question_id, correct);

-- Câu đã sai để luyện tập lại (HK.HS.048); làm đúng thì ghi cleared_at
CREATE TABLE public.hk_wrong_questions (
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES public.hk_questions(id) ON DELETE CASCADE,
    wrong_count INTEGER NOT NULL DEFAULT 1 CHECK (wrong_count >= 1),
    last_wrong_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    cleared_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, question_id)
);

-- Sổ điểm: mỗi khoản cộng có khóa duy nhất theo (học sinh, lý do, đối tượng) nên một việc chỉ được thưởng một lần
CREATE TABLE public.hk_points (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    points INTEGER NOT NULL CHECK (points > 0),
    reason TEXT NOT NULL CHECK (reason IN ('node', 'lesson', 'practice')),
    ref_key TEXT NOT NULL CHECK (length(ref_key) <= 80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, reason, ref_key)
);
CREATE INDEX hk_points_user_idx ON public.hk_points (user_id);

-- ------------------------------------------------------------------ ghi chú, tư liệu yêu thích
CREATE TABLE public.hk_notes (
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    ref_type TEXT NOT NULL CHECK (ref_type IN ('lesson', 'source')),
    ref_id INTEGER NOT NULL,
    body TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, ref_type, ref_id)
);

CREATE TABLE public.hk_favorites (
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    source_id INTEGER NOT NULL REFERENCES public.hist_sources(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, source_id)
);

-- ------------------------------------------------------------------ sự kiện học tập (HK.SYS.014): chỉ thêm, làm dữ liệu cho báo cáo và AI ở các sprint sau
CREATE TABLE public.hk_events (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    school_id INTEGER REFERENCES public.app_schools(id) ON DELETE SET NULL,
    event TEXT NOT NULL CHECK (event ~ '^[a-z_]{3,40}$'),
    ref_type TEXT CHECK (ref_type IS NULL OR ref_type ~ '^[a-z_]{2,20}$'),
    ref_id INTEGER,
    node_id INTEGER,
    value JSONB,
    duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hk_events_user_idx ON public.hk_events (user_id, created_at DESC);
CREATE INDEX hk_events_kind_idx ON public.hk_events (event, created_at DESC);

ALTER TABLE public.hk_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_lesson_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_lesson_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_node_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_class_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_node_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_unlocked_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_wrong_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_events ENABLE ROW LEVEL SECURITY;
