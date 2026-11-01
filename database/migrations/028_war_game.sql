-- HK Sprint 6 theo ver0.2 (HK.HS.113–116, 124, 126–138, HK.QT.056, HK.AD.048, 081–086, HK.SYS.021–022): game mô phỏng trận đánh bằng thẻ tướng.
-- Thẻ tướng nâng cấp (độ hiếm Sử thi, binh chủng, chỉ số theo cấp và sao, mảnh thẻ, thẻ chiến thuật), chiêu thức có giai thoại, đội hình ra trận,
-- sổ tay chỉ huy đối phương, màn chơi (đợt quân địch, địa hình, phần thưởng), lượt đánh do máy chủ xử lý, bản đồ hành quân kèm hội thoại cốt truyện,
-- thư viện tài nguyên game và kiểm soát giờ chơi. Chỉ backend (chủ bảng) đọc/ghi; mọi bảng mới bật RLS, không cấp quyền cho vai trò theo trường hay công khai.
-- Nội dung khởi tạo (bản nháp) nằm ở migration kế tiếp.

-- ------------------------------------------------------------------ thẻ tướng (HK.AD.048, HK.HS.068/069/126/127/129)
ALTER TABLE public.hk_cards DROP CONSTRAINT IF EXISTS hk_cards_rarity_check;
ALTER TABLE public.hk_cards ADD CONSTRAINT hk_cards_rarity_check CHECK (rarity IN ('common', 'rare', 'epic', 'legendary'));
ALTER TABLE public.hk_cards
    ADD COLUMN kind TEXT NOT NULL DEFAULT 'general' CHECK (kind IN ('general', 'tactic')),
    -- binh chủng: bộ, thủy, kỵ (thẻ chiến thuật không có)
    ADD COLUMN branch TEXT CHECK (branch IS NULL OR branch IN ('bo', 'thuy', 'ky')),
    -- chỉ số ở cấp 1, 1 sao: công (atk), thủ (def), máu (hp), tốc (spd); tăng theo cấp và sao ở máy chủ
    ADD COLUMN base_stats JSONB NOT NULL DEFAULT '{"atk": 100, "def": 60, "hp": 800, "spd": 10}'::jsonb CHECK (jsonb_typeof(base_stats) = 'object'),
    -- số mảnh để ghép thành thẻ khi chưa có; sau khi có thẻ thì mảnh dùng để thăng sao
    ADD COLUMN fragments_needed SMALLINT NOT NULL DEFAULT 5 CHECK (fragments_needed BETWEEN 1 AND 50),
    ADD COLUMN source_text TEXT CHECK (source_text IS NULL OR length(source_text) <= 300),
    -- thẻ chiến thuật – sự kiện lịch sử: {effect, value, turns, text}; dùng một lần mỗi trận
    ADD COLUMN tactic JSONB CHECK (tactic IS NULL OR jsonb_typeof(tactic) = 'object');

ALTER TABLE public.hk_user_cards
    ADD COLUMN level SMALLINT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 100),
    ADD COLUMN stars SMALLINT NOT NULL DEFAULT 1 CHECK (stars BETWEEN 1 AND 5);

CREATE TABLE public.hk_card_fragments (
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    card_id INTEGER NOT NULL REFERENCES public.hk_cards(id) ON DELETE CASCADE,
    qty INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),
    PRIMARY KEY (user_id, card_id)
);

-- Chiêu thức của tướng (HK.AD.083): đòn thường, chiêu chủ động, tuyệt kỹ, nội tại; mỗi loại tối đa một chiêu mỗi thẻ
CREATE TABLE public.hk_card_moves (
    id SERIAL PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES public.hk_cards(id) ON DELETE CASCADE,
    slot TEXT NOT NULL CHECK (slot IN ('normal', 'active', 'ultimate', 'passive')),
    name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 80),
    description TEXT CHECK (description IS NULL OR length(description) <= 400),
    -- giai thoại lịch sử giải thích chiêu (hiện ở mặt sau thẻ)
    anecdote TEXT CHECK (anecdote IS NULL OR length(anecdote) <= 600),
    target TEXT NOT NULL DEFAULT 'enemy_one' CHECK (target IN ('enemy_one', 'enemy_all', 'ally_one', 'ally_all', 'self')),
    -- hệ số sát thương hoặc trị liệu so với công (hoặc máu tối đa khi trị liệu)
    power NUMERIC(4, 2) NOT NULL DEFAULT 1 CHECK (power BETWEEN 0 AND 5),
    -- hiệu ứng kèm theo: {type: stun|shield|atk_up|def_up|atk_down|heal|drain|burn|hunger, value, turns}
    effect JSONB CHECK (effect IS NULL OR jsonb_typeof(effect) = 'object'),
    rage_cost SMALLINT NOT NULL DEFAULT 0 CHECK (rage_cost BETWEEN 0 AND 100),
    cooldown SMALLINT NOT NULL DEFAULT 0 CHECK (cooldown BETWEEN 0 AND 10),
    anim TEXT CHECK (anim IS NULL OR anim ~ '^[a-z_]{2,20}$'),
    UNIQUE (card_id, slot)
);

-- Đội hình ra trận (HK.HS.128): tối đa 3 đội hình, mỗi đội tối đa 5 thẻ (hàng tiên phong và hậu quân), kèm một thẻ chiến thuật
CREATE TABLE public.hk_formations (
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    slot SMALLINT NOT NULL CHECK (slot BETWEEN 1 AND 3),
    name TEXT NOT NULL DEFAULT 'Đội hình' CHECK (length(btrim(name)) BETWEEN 1 AND 40),
    front INTEGER[] NOT NULL DEFAULT '{}',
    back INTEGER[] NOT NULL DEFAULT '{}',
    tactic_card_id INTEGER REFERENCES public.hk_cards(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, slot),
    CHECK (cardinality(front) + cardinality(back) <= 5)
);

-- ------------------------------------------------------------------ chỉ huy đối phương (HK.HS.130)
CREATE TABLE public.hk_commanders (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9_-]{2,60}$'),
    name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 80),
    role_text TEXT CHECK (role_text IS NULL OR length(role_text) <= 400),
    forces TEXT CHECK (forces IS NULL OR length(forces) <= 400),
    tactics TEXT CHECK (tactics IS NULL OR length(tactics) <= 600),
    outcome TEXT CHECK (outcome IS NULL OR length(outcome) <= 600),
    source_id INTEGER REFERENCES public.hist_sources(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Hồ sơ chỉ mở sau khi học sinh đã chạm trán
CREATE TABLE public.hk_commanders_seen (
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    commander_id INTEGER NOT NULL REFERENCES public.hk_commanders(id) ON DELETE CASCADE,
    first_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, commander_id)
);

-- ------------------------------------------------------------------ màn chơi và quân địch (HK.AD.084)
CREATE TABLE public.hk_stages (
    id SERIAL PRIMARY KEY,
    battle_id INTEGER NOT NULL UNIQUE REFERENCES public.hist_battles(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 160),
    summary TEXT CHECK (summary IS NULL OR length(summary) <= 800),
    objective TEXT CHECK (objective IS NULL OR length(objective) <= 400),
    background_url TEXT CHECK (background_url IS NULL OR (background_url ~ '^https://' AND length(background_url) <= 500)),
    difficulty SMALLINT NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 3),
    max_turns SMALLINT NOT NULL DEFAULT 15 CHECK (max_turns BETWEEN 3 AND 30),
    -- thắng trong số lượt này thì được sao thứ ba
    star_turns SMALLINT NOT NULL DEFAULT 10 CHECK (star_turns BETWEEN 1 AND 30),
    -- địa hình và chiến thuật lịch sử: {tide:{cycle}, stakes:{pct}, water_bonus:{thuy}, hunger:{pct, from_turn}}
    terrain JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(terrain) = 'object'),
    -- các đợt quân địch: [{label, units:[{name, branch, level, hp, atk, def, spd, commander?}]}]
    waves JSONB NOT NULL CHECK (jsonb_typeof(waves) = 'array'),
    -- phần thưởng lần thắng đầu: {gold, binh_thu, xp, fragments:[{card_code, qty}], card_code}
    rewards JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(rewards) = 'object'),
    commander_id INTEGER REFERENCES public.hk_commanders(id) ON DELETE SET NULL,
    -- bộ câu hỏi dùng cho tuyệt kỹ; để trống thì tuyệt kỹ phát huy đủ mà không cần trả lời
    quiz_id INTEGER REFERENCES public.hk_quizzes(id) ON DELETE SET NULL,
    -- những điểm ván chơi khác với lịch sử thật (hiện ở "Sự thật lịch sử")
    differences JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(differences) = 'array'),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    published_at TIMESTAMPTZ,
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lượt đánh (HK.SYS.022): trạng thái và nhật ký trận do máy chủ giữ, số ngẫu nhiên có hạt giống để phát lại và kiểm tra
CREATE TABLE public.hk_war_battles (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    stage_id INTEGER NOT NULL REFERENCES public.hk_stages(id) ON DELETE CASCADE,
    -- play: ghi tiến độ và thưởng; preview: người soạn thử; balance: máy tự đánh để cân bằng (không lưu)
    mode TEXT NOT NULL DEFAULT 'play' CHECK (mode IN ('play', 'preview')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost')),
    seed INTEGER NOT NULL,
    formation JSONB NOT NULL,
    state JSONB NOT NULL,
    turns SMALLINT NOT NULL DEFAULT 0,
    stars SMALLINT NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 3),
    result JSONB,
    last_action_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX hk_war_battles_active ON public.hk_war_battles (user_id, stage_id) WHERE status = 'active';
CREATE INDEX hk_war_battles_user ON public.hk_war_battles (user_id, started_at DESC);

CREATE TABLE public.hk_stage_progress (
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    stage_id INTEGER NOT NULL REFERENCES public.hk_stages(id) ON DELETE CASCADE,
    best_stars SMALLINT NOT NULL DEFAULT 0 CHECK (best_stars BETWEEN 0 AND 3),
    best_turns SMALLINT,
    clears INTEGER NOT NULL DEFAULT 0 CHECK (clears >= 0),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    first_clear_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, stage_id)
);

-- ------------------------------------------------------------------ bản đồ hành quân (HK.AD.081, HK.HS.113–116)
CREATE TABLE public.hk_march_maps (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL UNIQUE REFERENCES public.hist_campaigns(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 160),
    background_url TEXT CHECK (background_url IS NULL OR (background_url ~ '^https://' AND length(background_url) <= 500)),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.hk_march_points (
    id SERIAL PRIMARY KEY,
    map_id INTEGER NOT NULL REFERENCES public.hk_march_maps(id) ON DELETE CASCADE,
    code TEXT NOT NULL CHECK (code ~ '^[a-z0-9_-]{2,40}$'),
    name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 80),
    description TEXT CHECK (description IS NULL OR length(description) <= 400),
    -- vị trí theo phần trăm chiều rộng / cao của bản đồ
    x NUMERIC(5, 2) NOT NULL CHECK (x BETWEEN 0 AND 100),
    y NUMERIC(5, 2) NOT NULL CHECK (y BETWEEN 0 AND 100),
    -- start: điểm xuất phát; story: hội thoại; card: nhận thẻ / mảnh; quiz: thử thách câu hỏi; source: mở tư liệu; battle: vào trận; chest: rương
    kind TEXT NOT NULL CHECK (kind IN ('start', 'story', 'card', 'quiz', 'source', 'battle', 'chest')),
    -- {dialog_id, card_code, qty, quiz_id, source_id, stage_id, gold, binh_thu}
    payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
    sort_order INTEGER NOT NULL DEFAULT 0,
    UNIQUE (map_id, code)
);
CREATE INDEX hk_march_points_map_idx ON public.hk_march_points (map_id, sort_order);

CREATE TABLE public.hk_march_edges (
    map_id INTEGER NOT NULL REFERENCES public.hk_march_maps(id) ON DELETE CASCADE,
    from_point INTEGER NOT NULL REFERENCES public.hk_march_points(id) ON DELETE CASCADE,
    to_point INTEGER NOT NULL REFERENCES public.hk_march_points(id) ON DELETE CASCADE,
    PRIMARY KEY (from_point, to_point),
    CHECK (from_point <> to_point)
);

-- Hội thoại cốt truyện (HK.AD.082): lời thoại có nhân vật nói, thứ tự, lựa chọn trả lời; phải gắn tư liệu nguồn đã công bố trước khi phát hành
CREATE TABLE public.hk_dialogs (
    id SERIAL PRIMARY KEY,
    point_id INTEGER REFERENCES public.hk_march_points(id) ON DELETE SET NULL,
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 160),
    -- [{speaker, figure_id?, text, choices?:[{text, reply}]}]
    lines JSONB NOT NULL CHECK (jsonb_typeof(lines) = 'array'),
    source_ids INTEGER[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.hk_march_state (
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    map_id INTEGER NOT NULL REFERENCES public.hk_march_maps(id) ON DELETE CASCADE,
    point_id INTEGER REFERENCES public.hk_march_points(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, map_id)
);
CREATE TABLE public.hk_march_visits (
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    point_id INTEGER NOT NULL REFERENCES public.hk_march_points(id) ON DELETE CASCADE,
    visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- sự kiện của điểm đã hoàn thành (nhận thưởng, trả lời đúng câu hỏi thử thách...)
    done_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, point_id)
);
-- Nhật ký hành quân: các đoạn hội thoại đã xem, xem lại được
CREATE TABLE public.hk_dialog_log (
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    dialog_id INTEGER NOT NULL REFERENCES public.hk_dialogs(id) ON DELETE CASCADE,
    seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, dialog_id)
);

-- ------------------------------------------------------------------ tài nguyên game (HK.AD.085) và kiểm soát giờ chơi (HK.QT.056)
CREATE TABLE public.hk_game_assets (
    id SERIAL PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('sprite', 'animation', 'effect', 'music', 'sfx', 'background', 'model3d')),
    name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 120),
    url TEXT NOT NULL CHECK (url ~ '^https://' AND length(url) <= 500),
    -- nguồn và giấy phép của từng tài nguyên (bắt buộc ghi)
    source TEXT NOT NULL CHECK (length(btrim(source)) BETWEEN 2 AND 300),
    license TEXT NOT NULL CHECK (length(btrim(license)) BETWEEN 2 AND 120),
    note TEXT CHECK (note IS NULL OR length(note) <= 400),
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hk_school_settings
    ADD COLUMN war_enabled BOOLEAN NOT NULL DEFAULT true,
    -- khối lớp được chơi; rỗng là mọi khối
    ADD COLUMN war_grades SMALLINT[] NOT NULL DEFAULT '{}',
    ADD COLUMN war_from TIME,
    ADD COLUMN war_to TIME,
    ADD COLUMN war_minutes SMALLINT CHECK (war_minutes IS NULL OR war_minutes BETWEEN 5 AND 600);

-- Thời gian chơi game mỗi ngày (giờ Việt Nam) để áp giới hạn
CREATE TABLE public.hk_war_play (
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    seconds INTEGER NOT NULL DEFAULT 0 CHECK (seconds >= 0),
    PRIMARY KEY (user_id, day)
);

ALTER TABLE public.hk_card_fragments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_card_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_formations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_commanders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_commanders_seen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_war_battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_stage_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_march_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_march_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_march_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_dialogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_march_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_march_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_dialog_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_game_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_war_play ENABLE ROW LEVEL SECURITY;
