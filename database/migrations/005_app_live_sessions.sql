-- Thi đấu cả lớp theo thời gian thực: giáo viên mở phòng, học sinh cùng lớp vào bằng mã PIN.
-- Phòng đang chơi chỉ nằm trong bộ nhớ backend; khi trận kết thúc, kết quả được lưu vào hai bảng dưới.
-- app_live_sessions: mỗi trận (giáo viên, lớp, tên trận, phạm vi câu hỏi, thống kê từng câu dạng JSON).
-- app_live_results:  kết quả từng học sinh trong trận (hạng, điểm, số câu trả lời / trả lời đúng).
CREATE TABLE IF NOT EXISTS public.app_live_sessions (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL REFERENCES public.app_users (id) ON DELETE CASCADE,
    class_name TEXT,
    title TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'all',
    question_count INTEGER NOT NULL DEFAULT 0,
    player_count INTEGER NOT NULL DEFAULT 0,
    question_stats TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS app_live_sessions_teacher_idx
    ON public.app_live_sessions (teacher_id, finished_at DESC);

CREATE TABLE IF NOT EXISTS public.app_live_results (
    session_id INTEGER NOT NULL REFERENCES public.app_live_sessions (id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES public.app_users (id) ON DELETE CASCADE,
    rank INTEGER NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    correct INTEGER NOT NULL DEFAULT 0,
    answered INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS app_live_results_user_idx ON public.app_live_results (user_id);

-- Chỉ backend (kết nối máy chủ) được đọc/ghi; không mở quyền cho anon/authenticated.
ALTER TABLE public.app_live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_live_results ENABLE ROW LEVEL SECURITY;
