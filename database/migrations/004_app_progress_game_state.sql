-- Game "Hào Khí Đông A": trạng thái game của học sinh và các bộ đếm do server quản lý.
-- game_state:     bố cục điền trang, tướng, cổ vật, mốc thời gian (client lưu qua API, tối đa 16 KB JSON).
-- question_stats: số lần trả lời / trả lời sai theo từng câu hỏi (server ghi khi chấm).
-- day_gems:       Ấn Tín đã nhận trong ngày (trần thưởng mỗi ngày).
-- week_xp/week_key: XP theo tuần cho bảng xếp hạng lớp.
-- freeze_week:    tuần đã dùng "ngày nghỉ phép" của chuỗi ngày học.
ALTER TABLE public.app_progress
    ADD COLUMN IF NOT EXISTS game_state TEXT,
    ADD COLUMN IF NOT EXISTS question_stats TEXT,
    ADD COLUMN IF NOT EXISTS day_gems INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS week_xp INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS week_key TEXT,
    ADD COLUMN IF NOT EXISTS freeze_week TEXT;
