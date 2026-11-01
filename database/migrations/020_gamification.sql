-- HK Sprint 5 (trò chơi hóa): nhân vật và lớp nhân vật, tim, vàng, cấp độ, chuỗi ngày học và mục tiêu hằng ngày, huy hiệu, thẻ nhân vật, cửa hàng và vật phẩm,
-- nhiệm vụ hằng ngày/tuần, quà hằng ngày, bảng xếp hạng và giải đấu tuần, sự kiện/giải đấu cấp trường, cấu hình mặc định và cấu hình của trường/lớp.
-- Chỉ backend (chủ bảng) đọc/ghi; mọi bảng bật RLS và không cấp quyền cho vai trò theo trường hay công khai. Nội dung khởi tạo nằm ở migration kế tiếp.

-- Điểm (XP) còn được cộng khi hoàn thành nhiệm vụ, đạt mục tiêu ngày, nhận quà và thắng giải đấu cấp trường
ALTER TABLE public.hk_points DROP CONSTRAINT IF EXISTS hk_points_reason_check;
ALTER TABLE public.hk_points ADD CONSTRAINT hk_points_reason_check CHECK (reason IN ('node', 'lesson', 'practice', 'quest', 'goal', 'gift', 'contest'));

-- Cấu hình trò chơi hóa mặc định (HK.AD.054, HK.AD.066): một dòng khóa 'game' chứa JSON, giá trị thiếu lấy từ mặc định trong mã
CREATE TABLE public.hk_settings (
    key TEXT PRIMARY KEY CHECK (key ~ '^[a-z_]{2,40}$'),
    value JSONB NOT NULL CHECK (jsonb_typeof(value) = 'object'),
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ba lớp nhân vật (HK.HS.011, HK.AD.052): chỉ số và kỹ năng; kỹ năng dùng được ở Sprint 7
CREATE TABLE public.hk_character_classes (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z_]{2,30}$'),
    name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 60),
    description TEXT CHECK (description IS NULL OR length(description) <= 600),
    icon TEXT NOT NULL DEFAULT 'swords' CHECK (icon ~ '^[a-z_]{2,20}$'),
    color TEXT NOT NULL DEFAULT '#b91c1c' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
    stats JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(stats) = 'object'),
    skills JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(skills) = 'array'),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Bảng mốc điểm lên cấp và phần thưởng vàng (HK.AD.050)
CREATE TABLE public.hk_levels (
    level INTEGER PRIMARY KEY CHECK (level BETWEEN 1 AND 100),
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 60),
    xp_required INTEGER NOT NULL UNIQUE CHECK (xp_required >= 0),
    reward_gold INTEGER NOT NULL DEFAULT 0 CHECK (reward_gold BETWEEN 0 AND 10000)
);

-- Huy hiệu (HK.AD.049, HK.QT.046): của hệ thống (có quy tắc tự trao) hoặc của trường (giáo viên trao tay)
CREATE TABLE public.hk_badges (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9_-]{2,60}$'),
    scope TEXT NOT NULL DEFAULT 'system' CHECK (scope IN ('system', 'school')),
    school_id INTEGER REFERENCES public.app_schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 80),
    description TEXT CHECK (description IS NULL OR length(description) <= 300),
    icon TEXT NOT NULL DEFAULT 'award' CHECK (icon ~ '^[a-z_]{2,20}$'),
    color TEXT NOT NULL DEFAULT '#ff9600' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
    -- {type:'campaign_complete'|'streak_days'|'correct_answers'|'nodes_completed'|'level'|'cards_collected'|'perfect_quizzes'|'xp_total', value, campaign_id}; rỗng = trao tay
    rule JSONB CHECK (rule IS NULL OR jsonb_typeof(rule) = 'object'),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((scope = 'system') = (school_id IS NULL))
);

CREATE TABLE public.hk_user_badges (
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    badge_id INTEGER NOT NULL REFERENCES public.hk_badges(id) ON DELETE CASCADE,
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    awarded_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, badge_id)
);

-- Thẻ nhân vật lịch sử (HK.HS.068, HK.AD.048): độ hiếm, trọng số rơi, gắn với nhân vật trong kho lịch sử
CREATE TABLE public.hk_cards (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9_-]{2,60}$'),
    name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 80),
    rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'legendary')),
    drop_weight INTEGER NOT NULL DEFAULT 10 CHECK (drop_weight BETWEEN 1 AND 1000),
    figure_id INTEGER REFERENCES public.hist_figures(id) ON DELETE SET NULL,
    flavor_quote TEXT CHECK (flavor_quote IS NULL OR length(flavor_quote) <= 300),
    image_url TEXT CHECK (image_url IS NULL OR (image_url ~ '^https://' AND length(image_url) <= 500)),
    min_level INTEGER NOT NULL DEFAULT 1 CHECK (min_level BETWEEN 1 AND 100),
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE public.hk_user_cards (
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    card_id INTEGER NOT NULL REFERENCES public.hk_cards(id) ON DELETE CASCADE,
    copies INTEGER NOT NULL DEFAULT 1 CHECK (copies >= 1),
    first_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, card_id)
);

-- Thẻ rơi chờ lật: máy chủ chọn thẻ ngay khi rơi, học sinh chỉ lật để xem
CREATE TABLE public.hk_card_drops (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    card_id INTEGER NOT NULL REFERENCES public.hk_cards(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('node', 'campaign', 'level')),
    node_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    flipped_at TIMESTAMPTZ,
    duplicate BOOLEAN
);
CREATE INDEX hk_card_drops_user_idx ON public.hk_card_drops (user_id, flipped_at);

-- Cửa hàng (HK.HS.070, HK.AD.051)
CREATE TABLE public.hk_shop_items (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9_-]{2,60}$'),
    kind TEXT NOT NULL CHECK (kind IN ('outfit', 'weapon', 'banner', 'streak_freeze', 'heart', 'hint')),
    name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 80),
    description TEXT CHECK (description IS NULL OR length(description) <= 300),
    icon TEXT NOT NULL DEFAULT 'shirt' CHECK (icon ~ '^[a-z_]{2,20}$'),
    color TEXT NOT NULL DEFAULT '#58cc02' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
    -- Giá 0 và cấp yêu cầu: mở khóa miễn phí khi đạt cấp (HK.HS.063)
    price INTEGER NOT NULL DEFAULT 0 CHECK (price BETWEEN 0 AND 100000),
    min_level INTEGER NOT NULL DEFAULT 1 CHECK (min_level BETWEEN 1 AND 100),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE public.hk_inventory (
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES public.hk_shop_items(id) ON DELETE CASCADE,
    qty INTEGER NOT NULL DEFAULT 1 CHECK (qty >= 0),
    PRIMARY KEY (user_id, item_id)
);

-- Người chơi: lớp nhân vật, tim (hồi theo thời gian), vàng, cấp, chuỗi ngày, ngoại hình, quà, giải đấu
CREATE TABLE public.hk_players (
    user_id INTEGER PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE,
    class_id INTEGER REFERENCES public.hk_character_classes(id) ON DELETE SET NULL,
    hearts INTEGER NOT NULL DEFAULT 5 CHECK (hearts >= 0),
    hearts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    gold INTEGER NOT NULL DEFAULT 0 CHECK (gold >= 0),
    xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
    level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
    daily_goal INTEGER NOT NULL DEFAULT 50 CHECK (daily_goal IN (50, 100, 200)),
    streak_current INTEGER NOT NULL DEFAULT 0 CHECK (streak_current >= 0),
    streak_longest INTEGER NOT NULL DEFAULT 0 CHECK (streak_longest >= 0),
    streak_last_day DATE,
    freezes INTEGER NOT NULL DEFAULT 0 CHECK (freezes >= 0),
    appearance JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(appearance) = 'object'),
    last_gift_day DATE,
    gift_streak INTEGER NOT NULL DEFAULT 0 CHECK (gift_streak >= 0),
    league_tier SMALLINT NOT NULL DEFAULT 0 CHECK (league_tier BETWEEN 0 AND 3),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sổ vàng: mỗi khoản có khóa duy nhất theo (học sinh, lý do, đối tượng) nên một việc chỉ được thưởng một lần
CREATE TABLE public.hk_gold_ledger (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    delta INTEGER NOT NULL CHECK (delta <> 0),
    reason TEXT NOT NULL CHECK (reason IN ('node', 'quest', 'goal', 'gift', 'level', 'card', 'shop', 'contest', 'badge')),
    ref_key TEXT NOT NULL CHECK (length(ref_key) <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, reason, ref_key)
);
CREATE INDEX hk_gold_ledger_user_idx ON public.hk_gold_ledger (user_id, created_at DESC);

-- Điểm theo ngày (mục tiêu hằng ngày, HK.HS.014; chuỗi ngày, HK.HS.064)
CREATE TABLE public.hk_daily (
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
    goal INTEGER NOT NULL CHECK (goal > 0),
    reached BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (user_id, day)
);

-- Mẫu nhiệm vụ hằng ngày / tuần (HK.AD.053) và nhiệm vụ đã giao (HK.HS.024)
CREATE TABLE public.hk_quest_templates (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9_-]{2,60}$'),
    period TEXT NOT NULL CHECK (period IN ('daily', 'weekly')),
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 120),
    metric TEXT NOT NULL CHECK (metric IN ('correct_answers', 'nodes_completed', 'battles_completed', 'lessons_completed', 'xp_earned', 'perfect_quizzes')),
    target INTEGER NOT NULL CHECK (target BETWEEN 1 AND 1000),
    reward_xp INTEGER NOT NULL DEFAULT 0 CHECK (reward_xp BETWEEN 0 AND 10000),
    reward_gold INTEGER NOT NULL DEFAULT 0 CHECK (reward_gold BETWEEN 0 AND 10000),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE public.hk_user_quests (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    template_id INTEGER NOT NULL REFERENCES public.hk_quest_templates(id) ON DELETE CASCADE,
    period_key TEXT NOT NULL CHECK (length(period_key) <= 12),
    title TEXT NOT NULL,
    metric TEXT NOT NULL,
    target INTEGER NOT NULL CHECK (target >= 1),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
    reward_xp INTEGER NOT NULL DEFAULT 0,
    reward_gold INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ,
    UNIQUE (user_id, template_id, period_key)
);
CREATE INDEX hk_user_quests_user_idx ON public.hk_user_quests (user_id, period_key);

-- Hàng đợi chúc mừng trong ứng dụng: lên cấp, huy hiệu, thẻ rơi, đạt mục tiêu, xong nhiệm vụ, quà, giải đấu
CREATE TABLE public.hk_celebrations (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('level_up', 'badge', 'card', 'goal', 'quest', 'gift', 'league', 'contest')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    seen_at TIMESTAMPTZ
);
CREATE INDEX hk_celebrations_user_idx ON public.hk_celebrations (user_id, seen_at, id);

-- Giải đấu tuần (HK.HS.077, HK.SYS.006): nhóm cùng hạng, điểm tuần; tuần được chốt một lần
CREATE TABLE public.hk_league_weeks (
    week_key TEXT PRIMARY KEY CHECK (week_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
    closed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.hk_league_members (
    week_key TEXT NOT NULL CHECK (week_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    tier SMALLINT NOT NULL CHECK (tier BETWEEN 0 AND 3),
    group_no INTEGER NOT NULL CHECK (group_no >= 1),
    xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
    PRIMARY KEY (week_key, user_id)
);
CREATE INDEX hk_league_members_group_idx ON public.hk_league_members (week_key, tier, group_no);

-- Cấu hình của trường (HK.QT.044) và của lớp (cơ chế tim, HK.HS.047)
CREATE TABLE public.hk_school_settings (
    school_id INTEGER PRIMARY KEY REFERENCES public.app_schools(id) ON DELETE CASCADE,
    leaderboard_enabled BOOLEAN NOT NULL DEFAULT true,
    leaderboard_scope TEXT NOT NULL DEFAULT 'school' CHECK (leaderboard_scope IN ('grade', 'school')),
    leaderboard_period TEXT NOT NULL DEFAULT 'week' CHECK (leaderboard_period IN ('week', 'month')),
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.hk_class_settings (
    class_id INTEGER PRIMARY KEY REFERENCES public.app_classes(id) ON DELETE CASCADE,
    hearts_enabled BOOLEAN NOT NULL DEFAULT true,
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sự kiện / giải đấu cấp trường (HK.QT.045): thời gian, lớp tham gia, phần thưởng, bảng xếp hạng riêng
CREATE TABLE public.hk_contests (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES public.app_schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 120),
    description TEXT CHECK (description IS NULL OR length(description) <= 600),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    -- {first, second, third, participation} vàng; participation cho mọi học sinh có điểm trong thời gian diễn ra
    rewards JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(rewards) = 'object'),
    badge_id INTEGER REFERENCES public.hk_badges(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at)
);
CREATE INDEX hk_contests_school_idx ON public.hk_contests (school_id, starts_at DESC);

CREATE TABLE public.hk_contest_classes (
    contest_id INTEGER NOT NULL REFERENCES public.hk_contests(id) ON DELETE CASCADE,
    class_id INTEGER NOT NULL REFERENCES public.app_classes(id) ON DELETE CASCADE,
    PRIMARY KEY (contest_id, class_id)
);

ALTER TABLE public.hk_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_character_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_user_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_card_drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_gold_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_quest_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_user_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_celebrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_league_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_class_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_contest_classes ENABLE ROW LEVEL SECURITY;
