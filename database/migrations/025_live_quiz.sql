-- HK Sprint 8 (HK.HS.079–085, HK.GV.051–058, HK.SYS.016): thi đấu trực tiếp kiểu Kahoot. Giáo viên tạo phòng từ bộ đề, học sinh vào bằng mã PIN 6 số,
-- máy chủ giữ trạng thái trận (phòng chờ, câu hỏi, kết quả câu, bục vinh quang), chấm điểm theo độ đúng và tốc độ, lưu lịch sử và báo cáo.
-- Chỉ backend (chủ bảng) đọc/ghi; bảng mới bật RLS, không cấp quyền cho vai trò theo trường hay công khai. Không tạo dữ liệu người dùng.

-- Điểm thi đấu cộng vào tài khoản học sinh có lý do riêng ('live'); giữ nguyên các lý do cũ
ALTER TABLE public.hk_points DROP CONSTRAINT IF EXISTS hk_points_reason_check;
ALTER TABLE public.hk_points ADD CONSTRAINT hk_points_reason_check CHECK (reason IN ('node', 'lesson', 'practice', 'quest', 'goal', 'gift', 'contest', 'battle', 'minigame', 'assignment', 'teacher', 'live'));

-- Phòng thi: bản chụp bộ câu hỏi (plan) lúc tạo nên sửa bộ đề giữa chừng không làm hỏng trận đang diễn ra
CREATE TABLE public.hk_live_rooms (
    id SERIAL PRIMARY KEY,
    class_id INTEGER NOT NULL REFERENCES public.app_classes(id) ON DELETE CASCADE,
    host_id INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    quiz_id INTEGER REFERENCES public.hk_quizzes(id) ON DELETE SET NULL,
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 120),
    mode TEXT NOT NULL DEFAULT 'solo' CHECK (mode IN ('solo', 'team')),
    pin CHAR(6) NOT NULL CHECK (pin ~ '^[0-9]{6}$'),
    -- lobby: phòng chờ; question: đang trả lời; results: kết quả của câu; ended: bục vinh quang và báo cáo
    state TEXT NOT NULL DEFAULT 'lobby' CHECK (state IN ('lobby', 'question', 'results', 'ended')),
    q_index SMALLINT NOT NULL DEFAULT -1,
    total SMALLINT NOT NULL CHECK (total BETWEEN 1 AND 60),
    plan JSONB NOT NULL CHECK (jsonb_typeof(plan) = 'array'),
    question_started_at TIMESTAMPTZ,
    deadline TIMESTAMPTZ,
    -- có giá trị khi giáo viên tạm dừng giữa câu: số mili giây còn lại
    paused_remaining_ms INTEGER CHECK (paused_remaining_ms IS NULL OR paused_remaining_ms >= 0),
    skipped SMALLINT[] NOT NULL DEFAULT '{}',
    ended_early BOOLEAN NOT NULL DEFAULT false,
    awarded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ
);
-- Mã PIN chỉ phải duy nhất giữa các phòng chưa kết thúc (mã được dùng lại sau khi phòng kết thúc)
CREATE UNIQUE INDEX hk_live_rooms_pin_open ON public.hk_live_rooms (pin) WHERE state <> 'ended';
CREATE INDEX hk_live_rooms_class ON public.hk_live_rooms (class_id, created_at DESC);
CREATE INDEX hk_live_rooms_host ON public.hk_live_rooms (host_id, created_at DESC);

CREATE TABLE public.hk_live_players (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES public.hk_live_rooms(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL CHECK (length(btrim(nickname)) BETWEEN 2 AND 20),
    avatar TEXT NOT NULL DEFAULT 'star' CHECK (avatar ~ '^[a-z_]{2,20}$'),
    team_id INTEGER REFERENCES public.hk_teams(id) ON DELETE SET NULL,
    score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),
    correct_count SMALLINT NOT NULL DEFAULT 0,
    answered_count SMALLINT NOT NULL DEFAULT 0,
    online BOOLEAN NOT NULL DEFAULT false,
    xp_awarded INTEGER NOT NULL DEFAULT 0,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (room_id, user_id)
);
-- Biệt danh không trùng trong cùng một phòng (không phân biệt hoa thường)
CREATE UNIQUE INDEX hk_live_players_nickname ON public.hk_live_players (room_id, lower(nickname));
CREATE INDEX hk_live_players_user ON public.hk_live_players (user_id, joined_at DESC);

-- Mỗi người chơi chỉ một câu trả lời cho mỗi câu; điểm tính ngay khi nhận (độ đúng và tốc độ)
CREATE TABLE public.hk_live_answers (
    room_id INTEGER NOT NULL REFERENCES public.hk_live_rooms(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES public.hk_live_players(id) ON DELETE CASCADE,
    q_index SMALLINT NOT NULL,
    answer JSONB,
    correct BOOLEAN NOT NULL,
    points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
    elapsed_ms INTEGER NOT NULL DEFAULT 0 CHECK (elapsed_ms >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (room_id, player_id, q_index)
);
CREATE INDEX hk_live_answers_question ON public.hk_live_answers (room_id, q_index);

ALTER TABLE public.hk_live_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_live_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_live_answers ENABLE ROW LEVEL SECURITY;
