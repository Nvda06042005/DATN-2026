-- HK Sprint 7 (HK.HS.071/072/076/099–105, HK.GV.007–017, 022–029, 045–050, 059–065): quản lý lớp học của giáo viên, chia đội, giao bài tập, lớp học của tôi, thưởng/phạt điểm kiểu Classcraft,
-- sự kiện may rủi, hộp quà lớp, kỹ năng nhân vật, thông báo trong lớp, và trình thiết kế bản đồ nhiệm vụ nâng cao (vị trí nút, nhánh rẽ, điều kiện mở khóa, phần thưởng, lịch giao).
-- Chỉ backend (chủ bảng) đọc/ghi; bảng mới bật RLS, không cấp quyền cho vai trò theo trường hay công khai. Dữ liệu cũ giữ nguyên: hành trình đã có chạy theo thứ tự nút như trước
-- (chỉ hành trình có nhánh rẽ mới dùng bảng nối nút).

-- Điểm: giáo viên có thể trừ điểm; vàng: thưởng/phạt của giáo viên và thưởng bài tập
ALTER TABLE public.hk_points DROP CONSTRAINT IF EXISTS hk_points_reason_check;
ALTER TABLE public.hk_points ADD CONSTRAINT hk_points_reason_check CHECK (reason IN ('node', 'lesson', 'practice', 'quest', 'goal', 'gift', 'contest', 'battle', 'minigame', 'assignment', 'teacher'));
ALTER TABLE public.hk_points DROP CONSTRAINT IF EXISTS hk_points_points_check;
ALTER TABLE public.hk_points ADD CONSTRAINT hk_points_points_check CHECK (points <> 0);
ALTER TABLE public.hk_gold_ledger DROP CONSTRAINT IF EXISTS hk_gold_ledger_reason_check;
ALTER TABLE public.hk_gold_ledger ADD CONSTRAINT hk_gold_ledger_reason_check CHECK (reason IN ('node', 'quest', 'goal', 'gift', 'level', 'card', 'shop', 'contest', 'badge', 'battle', 'minigame', 'assignment', 'teacher'));

-- ------------------------------------------------------------------ lớp học (HK.GV.009–011, 060)
ALTER TABLE public.app_classes ADD COLUMN cover_url TEXT CHECK (cover_url IS NULL OR (cover_url ~ '^https://' AND length(cover_url) <= 500));

-- Luật lớp (HK.GV.060): danh sách hành vi và mức thưởng/phạt, HP tối đa, bật/tắt tim, bật/tắt xếp hạng, duyệt kỹ năng, mục tiêu điểm của đội mỗi tuần
ALTER TABLE public.hk_class_settings
    ADD COLUMN leaderboard_enabled BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN hearts_max SMALLINT CHECK (hearts_max IS NULL OR hearts_max BETWEEN 1 AND 10),
    ADD COLUMN skill_approval BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN team_goal_per_member INTEGER NOT NULL DEFAULT 100 CHECK (team_goal_per_member BETWEEN 10 AND 2000),
    ADD COLUMN rules JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(rules) = 'array');

-- ------------------------------------------------------------------ đội (HK.GV.016, HK.HS.071/076/103)
CREATE TABLE public.hk_teams (
    id SERIAL PRIMARY KEY,
    class_id INTEGER NOT NULL REFERENCES public.app_classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 40),
    icon TEXT NOT NULL DEFAULT 'shield' CHECK (icon ~ '^[a-z_]{2,20}$'),
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (class_id, name)
);
-- Mỗi học sinh chỉ ở một đội trong một lớp
CREATE TABLE public.hk_team_members (
    team_id INTEGER NOT NULL REFERENCES public.hk_teams(id) ON DELETE CASCADE,
    class_id INTEGER NOT NULL REFERENCES public.app_classes(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    PRIMARY KEY (class_id, user_id)
);
CREATE INDEX hk_team_members_team_idx ON public.hk_team_members (team_id);

-- Yêu cầu rời lớp (HK.HS.105, HK.GV.017): dữ liệu học vẫn được lưu
CREATE TABLE public.hk_leave_requests (
    id SERIAL PRIMARY KEY,
    class_id INTEGER NOT NULL REFERENCES public.app_classes(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    reason TEXT CHECK (reason IS NULL OR length(reason) <= 300),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    decided_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX hk_leave_pending_key ON public.hk_leave_requests (class_id, user_id) WHERE status = 'pending';

-- ------------------------------------------------------------------ thông báo (HK.HS.104): dùng bảng có sẵn, thêm lớp, dữ liệu kèm và người gửi
ALTER TABLE public.app_notifications
    ADD COLUMN class_id INTEGER REFERENCES public.app_classes(id) ON DELETE SET NULL,
    ADD COLUMN ref JSONB,
    ADD COLUMN created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL;
CREATE INDEX app_notifications_unread_idx ON public.app_notifications (user_id) WHERE read_at IS NULL;

-- ------------------------------------------------------------------ thưởng/phạt, sự kiện, hộp quà (HK.GV.059, 062, 065)
CREATE TABLE public.hk_adjustments (
    id BIGSERIAL PRIMARY KEY,
    class_id INTEGER NOT NULL REFERENCES public.app_classes(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES public.hk_teams(id) ON DELETE SET NULL,
    kind TEXT NOT NULL CHECK (kind IN ('reward', 'penalty', 'event', 'goal')),
    label TEXT NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 120),
    xp INTEGER NOT NULL DEFAULT 0,
    gold INTEGER NOT NULL DEFAULT 0,
    hp INTEGER NOT NULL DEFAULT 0,
    -- Phần thật sự áp dụng sau khi chặn các giới hạn (điểm, vàng không âm; tim từ 0 đến tối đa)
    applied JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hk_adjustments_class_idx ON public.hk_adjustments (class_id, created_at DESC);
CREATE INDEX hk_adjustments_user_idx ON public.hk_adjustments (user_id, created_at DESC);

CREATE TABLE public.hk_class_goals (
    id SERIAL PRIMARY KEY,
    class_id INTEGER NOT NULL REFERENCES public.app_classes(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 120),
    target_xp INTEGER NOT NULL CHECK (target_xp BETWEEN 10 AND 1000000),
    reward_gold INTEGER NOT NULL DEFAULT 20 CHECK (reward_gold BETWEEN 0 AND 1000),
    reward_xp INTEGER NOT NULL DEFAULT 0 CHECK (reward_xp BETWEEN 0 AND 1000),
    since TIMESTAMPTZ NOT NULL DEFAULT now(),
    opened_at TIMESTAMPTZ,
    opened_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hk_class_goals_class_idx ON public.hk_class_goals (class_id, created_at DESC);

-- ------------------------------------------------------------------ bài tập (HK.GV.045–050, HK.HS.100–102)
CREATE TABLE public.hk_assignments (
    id SERIAL PRIMARY KEY,
    class_id INTEGER NOT NULL REFERENCES public.app_classes(id) ON DELETE CASCADE,
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 160),
    description TEXT CHECK (description IS NULL OR length(description) <= 1000),
    kind TEXT NOT NULL CHECK (kind IN ('quiz', 'minigame', 'lesson')),
    quiz_id INTEGER REFERENCES public.hk_quizzes(id) ON DELETE RESTRICT,
    minigame_id INTEGER REFERENCES public.hk_minigames(id) ON DELETE RESTRICT,
    lesson_id INTEGER REFERENCES public.hk_lessons(id) ON DELETE RESTRICT,
    audience TEXT NOT NULL DEFAULT 'class' CHECK (audience IN ('class', 'team', 'students')),
    team_ids INTEGER[] NOT NULL DEFAULT '{}',
    student_ids INTEGER[] NOT NULL DEFAULT '{}',
    due_at TIMESTAMPTZ NOT NULL,
    max_attempts SMALLINT NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
    bonus_points INTEGER NOT NULL DEFAULT 0 CHECK (bonus_points BETWEEN 0 AND 500),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (
        (kind = 'quiz' AND quiz_id IS NOT NULL AND minigame_id IS NULL AND lesson_id IS NULL) OR
        (kind = 'minigame' AND minigame_id IS NOT NULL AND quiz_id IS NULL AND lesson_id IS NULL) OR
        (kind = 'lesson' AND lesson_id IS NOT NULL AND quiz_id IS NULL AND minigame_id IS NULL)
    )
);
CREATE INDEX hk_assignments_class_idx ON public.hk_assignments (class_id, due_at DESC);

-- Mỗi học sinh một dòng cho mỗi bài tập: số lần làm, kết quả tốt nhất, nộp đúng hạn hay muộn, điểm và nhận xét của giáo viên
CREATE TABLE public.hk_submissions (
    assignment_id INTEGER NOT NULL REFERENCES public.hk_assignments(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    best_percent SMALLINT NOT NULL DEFAULT 0 CHECK (best_percent BETWEEN 0 AND 100),
    submitted_at TIMESTAMPTZ,
    on_time BOOLEAN,
    last_at TIMESTAMPTZ,
    teacher_score SMALLINT CHECK (teacher_score IS NULL OR teacher_score BETWEEN 0 AND 100),
    feedback TEXT CHECK (feedback IS NULL OR length(feedback) <= 1000),
    graded_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    graded_at TIMESTAMPTZ,
    reminded_at TIMESTAMPTZ,
    PRIMARY KEY (assignment_id, user_id)
);

-- Lượt làm bài và lượt chơi mini-game gắn với bài tập
ALTER TABLE public.hk_attempts DROP CONSTRAINT IF EXISTS hk_attempts_mode_check;
ALTER TABLE public.hk_attempts ADD CONSTRAINT hk_attempts_mode_check CHECK (mode IN ('node', 'practice', 'preview', 'assignment'));
ALTER TABLE public.hk_attempts ADD COLUMN assignment_id INTEGER REFERENCES public.hk_assignments(id) ON DELETE SET NULL;
CREATE INDEX hk_attempts_assignment_idx ON public.hk_attempts (assignment_id, user_id) WHERE assignment_id IS NOT NULL;
ALTER TABLE public.hk_game_runs ADD COLUMN assignment_id INTEGER REFERENCES public.hk_assignments(id) ON DELETE SET NULL;
CREATE INDEX hk_game_runs_assignment_idx ON public.hk_game_runs (assignment_id, user_id) WHERE assignment_id IS NOT NULL;

-- ------------------------------------------------------------------ kỹ năng nhân vật (HK.HS.072, HK.GV.063)
-- Điểm hành động hồi đầy mỗi ngày; hiệu ứng chờ dùng (xung phong, hộ giáp) lưu trong `buffs`
ALTER TABLE public.hk_players
    ADD COLUMN ap SMALLINT NOT NULL DEFAULT 3 CHECK (ap >= 0),
    ADD COLUMN ap_day DATE,
    ADD COLUMN buffs JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(buffs) = 'object');

CREATE TABLE public.hk_skill_uses (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    class_id INTEGER REFERENCES public.app_classes(id) ON DELETE SET NULL,
    skill TEXT NOT NULL CHECK (skill ~ '^[a-z_]{2,30}$'),
    target_user_id INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    cost SMALLINT NOT NULL DEFAULT 0 CHECK (cost >= 0),
    status TEXT NOT NULL DEFAULT 'done' CHECK (status IN ('done', 'pending', 'rejected')),
    note TEXT CHECK (note IS NULL OR length(note) <= 300),
    decided_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hk_skill_uses_class_idx ON public.hk_skill_uses (class_id, status, created_at DESC);
CREATE INDEX hk_skill_uses_user_idx ON public.hk_skill_uses (user_id, created_at DESC);

-- ------------------------------------------------------------------ trình thiết kế bản đồ nâng cao (HK.GV.022–027)
-- Vị trí nút (phần trăm chiều rộng/cao của bản đồ), điều kiện mở khóa và phần thưởng riêng của nút
ALTER TABLE public.hk_nodes
    ADD COLUMN pos_x NUMERIC(5, 2) CHECK (pos_x IS NULL OR pos_x BETWEEN 0 AND 100),
    ADD COLUMN pos_y NUMERIC(5, 2) CHECK (pos_y IS NULL OR pos_y BETWEEN 0 AND 100),
    ADD COLUMN opens_at TIMESTAMPTZ,
    ADD COLUMN min_percent SMALLINT CHECK (min_percent IS NULL OR min_percent BETWEEN 1 AND 100),
    ADD COLUMN min_stars SMALLINT CHECK (min_stars IS NULL OR min_stars BETWEEN 1 AND 3),
    ADD COLUMN reward_gold INTEGER NOT NULL DEFAULT 0 CHECK (reward_gold BETWEEN 0 AND 1000),
    ADD COLUMN reward_card_id INTEGER REFERENCES public.hk_cards(id) ON DELETE SET NULL,
    ADD COLUMN reward_badge_id INTEGER REFERENCES public.hk_badges(id) ON DELETE SET NULL;

-- Đường nối giữa các nút (nhánh rẽ). Hành trình không có đường nối nào chạy theo thứ tự nút như trước.
CREATE TABLE public.hk_node_edges (
    journey_id INTEGER NOT NULL REFERENCES public.hk_journeys(id) ON DELETE CASCADE,
    from_node INTEGER NOT NULL REFERENCES public.hk_nodes(id) ON DELETE CASCADE,
    to_node INTEGER NOT NULL REFERENCES public.hk_nodes(id) ON DELETE CASCADE,
    PRIMARY KEY (from_node, to_node),
    CHECK (from_node <> to_node)
);
CREATE INDEX hk_node_edges_journey_idx ON public.hk_node_edges (journey_id);
CREATE INDEX hk_node_edges_to_idx ON public.hk_node_edges (to_node);

-- Lịch giao hành trình cho lớp (HK.GV.026): chỉ chạy trong khoảng thời gian đã đặt
ALTER TABLE public.hk_class_journeys ADD COLUMN starts_at TIMESTAMPTZ, ADD COLUMN ends_at TIMESTAMPTZ;
ALTER TABLE public.hk_class_journeys ADD CONSTRAINT hk_class_journeys_window_check CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at);

ALTER TABLE public.hk_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_class_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_skill_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_node_edges ENABLE ROW LEVEL SECURITY;
