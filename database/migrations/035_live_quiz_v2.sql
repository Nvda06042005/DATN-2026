-- HK ver0.2 Sprint 8 (phần còn lại): soạn Quiz kiểu Kahoot (HK.GV.085–094) và thi đấu trực tiếp nâng cao (HK.GV.095–101, HK.HS.139–142, HK.SYS.023).
--  - Quiz: thời gian / điểm / ảnh bìa / giao diện cho bộ đề, loại điểm cho từng câu, bản nháp tự lưu, kho ảnh tải lên, video minh họa cho câu hỏi.
--  - Phòng thi: khóa phòng (tay và tự động), duyệt học sinh vào muộn, loại người chơi, chống tra cứu (ẩn nội dung trên thiết bị, xáo đáp án, cảnh báo chuyển tab),
--    chặn một tài khoản vào từ hai thiết bị, tên theo hồ sơ, chế độ "Đánh trùm cả lớp".
-- Bảng mới chỉ backend (chủ bảng) đọc/ghi; đều bật RLS, không cấp quyền cho vai trò theo trường hay công khai. Không tạo dữ liệu người dùng.

-- ------------------------------------------------------------------ ảnh tải lên cho câu hỏi và ảnh bìa (HK.GV.085, 092)
-- Ảnh nhỏ (tối đa 1,5 MB) lưu trong cơ sở dữ liệu; đường dẫn công khai chứa mã ngẫu nhiên 128 bit nên không đoán được
CREATE TABLE public.hk_media (
    id SERIAL PRIMARY KEY,
    token CHAR(32) NOT NULL UNIQUE CHECK (token ~ '^[0-9a-f]{32}$'),
    owner_id INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    mime TEXT NOT NULL CHECK (mime IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif')),
    name TEXT CHECK (name IS NULL OR length(name) <= 120),
    size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 1572864),
    data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hk_media_owner_idx ON public.hk_media (owner_id, created_at DESC);
ALTER TABLE public.hk_media ENABLE ROW LEVEL SECURITY;

-- Ảnh câu hỏi: ngoài liên kết https còn nhận đường dẫn tới ảnh đã tải lên
DO $mig$
DECLARE c RECORD;
BEGIN
    FOR c IN SELECT con.conname FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid JOIN pg_namespace n ON n.oid = rel.relnamespace
             WHERE n.nspname = 'public' AND rel.relname = 'hk_questions' AND con.contype = 'c' AND pg_get_constraintdef(con.oid) LIKE '%image_url%'
    LOOP
        EXECUTE format('ALTER TABLE public.hk_questions DROP CONSTRAINT %I', c.conname);
    END LOOP;
END
$mig$;
ALTER TABLE public.hk_questions ADD CONSTRAINT hk_questions_image_url_check
    CHECK (image_url IS NULL OR ((image_url ~ '^https://' OR image_url ~ '^/api/content/media/[0-9a-f]{32}$') AND length(image_url) <= 500));
ALTER TABLE public.hk_questions ADD COLUMN video_url TEXT CHECK (video_url IS NULL OR (video_url ~ '^https://' AND length(video_url) <= 500));

-- ------------------------------------------------------------------ bộ đề: ảnh bìa, giao diện, loại điểm của từng câu (HK.GV.085, 090, 093)
ALTER TABLE public.hk_quizzes
    ADD COLUMN cover_url TEXT CHECK (cover_url IS NULL OR ((cover_url ~ '^https://' OR cover_url ~ '^/api/content/media/[0-9a-f]{32}$') AND length(cover_url) <= 500)),
    -- {bg: mã nền, music: mã nhạc chờ}
    ADD COLUMN theme JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(theme) = 'object');
-- NULL: dùng điểm gốc của câu như trước; standard = 1000, double = 2000, none = không tính điểm (khi thi đấu trực tiếp)
ALTER TABLE public.hk_quiz_questions
    ADD COLUMN score_mode TEXT CHECK (score_mode IS NULL OR score_mode IN ('standard', 'double', 'none'));

-- Bản nháp của trình soạn Quiz: tự lưu khi đang soạn, chỉ chủ bản nháp thấy; lưu chính thức mới tạo câu hỏi và bộ đề
CREATE TABLE public.hk_quiz_drafts (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    quiz_id INTEGER REFERENCES public.hk_quizzes(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT '' CHECK (length(title) <= 200),
    payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hk_quiz_drafts_owner_idx ON public.hk_quiz_drafts (owner_id, updated_at DESC);
ALTER TABLE public.hk_quiz_drafts ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------ phòng thi (HK.GV.095–101)
DO $mig$
DECLARE c RECORD;
BEGIN
    FOR c IN SELECT con.conname FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid JOIN pg_namespace n ON n.oid = rel.relnamespace
             WHERE n.nspname = 'public' AND rel.relname = 'hk_live_rooms' AND con.contype = 'c' AND pg_get_constraintdef(con.oid) LIKE '%solo%'
    LOOP
        EXECUTE format('ALTER TABLE public.hk_live_rooms DROP CONSTRAINT %I', c.conname);
    END LOOP;
END
$mig$;
ALTER TABLE public.hk_live_rooms ADD CONSTRAINT hk_live_rooms_mode_check CHECK (mode IN ('solo', 'team', 'boss'));
ALTER TABLE public.hk_live_rooms
    -- khóa phòng: mã PIN không nhận người mới (HK.GV.095); lock_at là mốc tự khóa sau N giây kể từ lúc bắt đầu (HK.GV.096)
    ADD COLUMN locked BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN auto_lock_seconds INTEGER CHECK (auto_lock_seconds IS NULL OR auto_lock_seconds BETWEEN 0 AND 600),
    ADD COLUMN lock_at TIMESTAMPTZ,
    -- tên hiển thị lấy theo hồ sơ (HK.GV.098)
    ADD COLUMN profile_names BOOLEAN NOT NULL DEFAULT true,
    -- chống tra cứu (HK.GV.100, HK.HS.139)
    ADD COLUMN hide_on_device BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN shuffle_device BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN tab_alert BOOLEAN NOT NULL DEFAULT true,
    -- giao diện của bộ đề lúc tạo phòng (HK.GV.093)
    ADD COLUMN theme JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(theme) = 'object'),
    -- chế độ Đánh trùm cả lớp (HK.GV.101, HK.HS.142): {key, name, max_hp, hp, class_max_hp, class_hp, applied, log, outcome}
    ADD COLUMN boss JSONB CHECK (boss IS NULL OR jsonb_typeof(boss) = 'object');

ALTER TABLE public.hk_live_players
    -- bị giáo viên loại: không vào lại được phòng đó (HK.GV.099)
    ADD COLUMN kicked_at TIMESTAMPTZ,
    -- câu hỏi đầu tiên người chơi được làm (vào muộn được duyệt thì làm từ câu hiện tại, HK.HS.141)
    ADD COLUMN joined_q SMALLINT NOT NULL DEFAULT 0,
    -- mã thiết bị: một tài khoản chỉ vào từ một thiết bị cùng lúc (HK.GV.098)
    ADD COLUMN device_id TEXT CHECK (device_id IS NULL OR length(device_id) <= 64),
    ADD COLUMN tab_switches INTEGER NOT NULL DEFAULT 0;

-- Yêu cầu vào phòng đã khóa (HK.HS.141, HK.GV.097)
CREATE TABLE public.hk_live_requests (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES public.hk_live_rooms(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at TIMESTAMPTZ,
    UNIQUE (room_id, user_id)
);
CREATE INDEX hk_live_requests_room_idx ON public.hk_live_requests (room_id, status);
ALTER TABLE public.hk_live_requests ENABLE ROW LEVEL SECURITY;

-- Nhật ký sự kiện của phòng: chuyển tab, khóa / mở khóa, duyệt, loại (HK.SYS.023)
CREATE TABLE public.hk_live_events (
    id BIGSERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES public.hk_live_rooms(id) ON DELETE CASCADE,
    player_id INTEGER REFERENCES public.hk_live_players(id) ON DELETE SET NULL,
    kind TEXT NOT NULL CHECK (kind IN ('blur', 'lock', 'unlock', 'approve', 'reject', 'kick', 'request')),
    q_index SMALLINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hk_live_events_room_idx ON public.hk_live_events (room_id, id DESC);
ALTER TABLE public.hk_live_events ENABLE ROW LEVEL SECURITY;
