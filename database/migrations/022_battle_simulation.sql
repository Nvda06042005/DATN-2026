-- HK Sprint 6 (HK.HS.028, 051–061, HK.AD.046–047): mô phỏng trận đánh theo lượt nhập vai chỉ huy và các mini-game (ghép thẻ, sắp xếp dòng thời gian, ô chữ).
-- Kịch bản trận đánh lưu dạng JSON (các bước quyết định / bố trí lực lượng, phản hồi lịch sử, điểm, điều kiện thắng, hoạt ảnh diễn biến) để engine đọc;
-- máy chủ giữ đáp án, chấm điểm và đồng hồ. Mỗi lượt chơi giữ bản chụp nội dung lúc bắt đầu nên sửa kịch bản giữa chừng không làm hỏng lượt đang chơi.
-- Chỉ backend (chủ bảng) đọc/ghi; bảng bật RLS, không cấp quyền cho vai trò theo trường hay công khai. Nội dung khởi tạo (bản nháp) nằm ở migration kế tiếp.

-- Điểm và vàng còn được cộng khi hoàn thành mô phỏng trận đánh và mini-game
ALTER TABLE public.hk_points DROP CONSTRAINT IF EXISTS hk_points_reason_check;
ALTER TABLE public.hk_points ADD CONSTRAINT hk_points_reason_check CHECK (reason IN ('node', 'lesson', 'practice', 'quest', 'goal', 'gift', 'contest', 'battle', 'minigame'));
ALTER TABLE public.hk_gold_ledger DROP CONSTRAINT IF EXISTS hk_gold_ledger_reason_check;
ALTER TABLE public.hk_gold_ledger ADD CONSTRAINT hk_gold_ledger_reason_check CHECK (reason IN ('node', 'quest', 'goal', 'gift', 'level', 'card', 'shop', 'contest', 'badge', 'battle', 'minigame'));

-- Kịch bản mô phỏng trận đánh (HK.AD.046): mỗi trận đánh trong kho lịch sử có tối đa một kịch bản
CREATE TABLE public.hk_scenarios (
    id SERIAL PRIMARY KEY,
    battle_id INTEGER NOT NULL UNIQUE REFERENCES public.hist_battles(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 160),
    summary TEXT CHECK (summary IS NULL OR length(summary) <= 600),
    difficulty SMALLINT NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 3),
    -- {intro, map, steps[], animation, pass_percent, bonus_points}; máy chủ kiểm tra cấu trúc trước khi ghi
    content JSONB NOT NULL CHECK (jsonb_typeof(content) = 'object'),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    published_at TIMESTAMPTZ,
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mini-game khác (HK.AD.047): ghép thẻ, sắp xếp dòng thời gian, ô chữ; tham số theo từng dạng nằm trong `params`
CREATE TABLE public.hk_minigames (
    id SERIAL PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('match', 'timeline', 'crossword')),
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 160),
    description TEXT CHECK (description IS NULL OR length(description) <= 600),
    campaign_id INTEGER REFERENCES public.hist_campaigns(id) ON DELETE SET NULL,
    lesson_id INTEGER REFERENCES public.hk_lessons(id) ON DELETE SET NULL,
    params JSONB NOT NULL CHECK (jsonb_typeof(params) = 'object'),
    seconds SMALLINT NOT NULL DEFAULT 120 CHECK (seconds BETWEEN 10 AND 1800),
    points INTEGER NOT NULL DEFAULT 100 CHECK (points BETWEEN 0 AND 1000),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    published_at TIMESTAMPTZ,
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hk_minigames_kind_idx ON public.hk_minigames (kind, status);

-- Lượt chơi (HK.HS.053–061): trạng thái được lưu sau từng bước nên đăng nhập lại vẫn chơi tiếp được (HK.HS.061)
CREATE TABLE public.hk_game_runs (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('battle', 'match', 'timeline', 'crossword')),
    scenario_id INTEGER REFERENCES public.hk_scenarios(id) ON DELETE CASCADE,
    minigame_id INTEGER REFERENCES public.hk_minigames(id) ON DELETE CASCADE,
    node_id INTEGER REFERENCES public.hk_nodes(id) ON DELETE SET NULL,
    -- play: ghi vào tiến độ; preview: người soạn chơi thử, không ghi điểm hay tiến độ
    mode TEXT NOT NULL DEFAULT 'play' CHECK (mode IN ('play', 'preview')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done')),
    snapshot JSONB NOT NULL,
    state JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deadline TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),
    max_score INTEGER NOT NULL DEFAULT 0 CHECK (max_score >= 0),
    bonus INTEGER NOT NULL DEFAULT 0 CHECK (bonus >= 0),
    percent SMALLINT NOT NULL DEFAULT 0 CHECK (percent BETWEEN 0 AND 100),
    stars SMALLINT NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 3),
    passed BOOLEAN,
    timed_out BOOLEAN NOT NULL DEFAULT false,
    duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
    result JSONB,
    CHECK ((kind = 'battle' AND scenario_id IS NOT NULL AND minigame_id IS NULL) OR (kind <> 'battle' AND minigame_id IS NOT NULL AND scenario_id IS NULL))
);
CREATE INDEX hk_game_runs_user_idx ON public.hk_game_runs (user_id, started_at DESC);
CREATE INDEX hk_game_runs_scenario_idx ON public.hk_game_runs (scenario_id, user_id) WHERE scenario_id IS NOT NULL;
CREATE INDEX hk_game_runs_minigame_idx ON public.hk_game_runs (minigame_id, user_id) WHERE minigame_id IS NOT NULL;
-- Mỗi học sinh chỉ có một lượt đang chơi dở cho mỗi trận đánh / mini-game
CREATE UNIQUE INDEX hk_game_runs_active_scenario_key ON public.hk_game_runs (user_id, scenario_id) WHERE status = 'active' AND mode = 'play' AND scenario_id IS NOT NULL;
CREATE UNIQUE INDEX hk_game_runs_active_minigame_key ON public.hk_game_runs (user_id, minigame_id) WHERE status = 'active' AND mode = 'play' AND minigame_id IS NOT NULL;

ALTER TABLE public.hk_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_minigames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_game_runs ENABLE ROW LEVEL SECURITY;
