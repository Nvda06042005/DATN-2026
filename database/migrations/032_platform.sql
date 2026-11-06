-- Sprint 11 (HaoKhiDongA): thông báo, hỗ trợ, hướng dẫn, nhật ký, cấu hình hệ thống, phân quyền, 2FA, sao lưu, giao diện sáng / tối.
-- Bảng mới đều bật RLS (chỉ backend đọc ghi). Không có khóa, mật khẩu hay dữ liệu tài khoản thật trong migration; dữ liệu khởi tạo chỉ là
-- ma trận phân quyền theo đặc tả, cờ tính năng (mặc định bật hết) và bộ hướng dẫn / câu hỏi thường gặp theo vai trò.

-- ------------------------------------------------------------------ tùy chọn của người dùng (HK.HS.015, HK.HS.016)
CREATE TABLE public.hk_user_prefs (
    user_id INTEGER PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE,
    theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system')),
    reminder_enabled BOOLEAN NOT NULL DEFAULT false,
    -- giờ nhắc học trong ngày theo giờ hệ thống (múi giờ cấu hình ở hk_system_settings)
    reminder_hour SMALLINT NOT NULL DEFAULT 19 CHECK (reminder_hour BETWEEN 0 AND 23),
    reminder_channel TEXT NOT NULL DEFAULT 'web' CHECK (reminder_channel IN ('web', 'email', 'both')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------ thông báo hàng loạt: lớp, trường, toàn hệ thống (HK.GV.076, HK.QT.043, HK.AD.069)
CREATE TABLE public.hk_broadcasts (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('teacher', 'school_admin', 'root_admin')),
    school_id INTEGER REFERENCES public.app_schools(id) ON DELETE CASCADE,
    -- phạm vi gửi: lớp (class_ids), khối (grades) hoặc cả trường (school) / hệ thống (system); roles giới hạn vai trò nhận
    scope TEXT NOT NULL CHECK (scope IN ('class', 'grade', 'school', 'system')),
    class_ids INTEGER[] NOT NULL DEFAULT '{}',
    grades SMALLINT[] NOT NULL DEFAULT '{}',
    school_ids INTEGER[] NOT NULL DEFAULT '{}',
    roles TEXT[] NOT NULL DEFAULT '{}',
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 160),
    body TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 1000),
    send_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'cancelled')),
    recipients INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hk_broadcasts_due_idx ON public.hk_broadcasts (send_at) WHERE status = 'scheduled';
CREATE INDEX hk_broadcasts_school_idx ON public.hk_broadcasts (school_id, created_at DESC);

-- mỗi thông báo trong ứng dụng biết nó thuộc lần gửi nào (để sửa / thu hồi cả đợt) và có khóa chống gửi trùng cho thông báo tự động
ALTER TABLE public.app_notifications
    ADD COLUMN broadcast_id INTEGER REFERENCES public.hk_broadcasts(id) ON DELETE CASCADE,
    ADD COLUMN dedupe_key TEXT;
CREATE UNIQUE INDEX app_notifications_dedupe_idx ON public.app_notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX app_notifications_broadcast_idx ON public.app_notifications (broadcast_id) WHERE broadcast_id IS NOT NULL;

-- loại thư mới trong hàng đợi email: thông báo / nhắc học (HK.SYS.017)
ALTER TABLE public.app_email_outbox DROP CONSTRAINT IF EXISTS app_email_outbox_kind_check;
ALTER TABLE public.app_email_outbox ADD CONSTRAINT app_email_outbox_kind_check CHECK (kind IN ('bulk', 'delta', 'class', 'feedback', 'notice'));

-- ------------------------------------------------------------------ yêu cầu hỗ trợ / báo lỗi (HK.HS.111, HK.GV.081, HK.QT.052, HK.AD.073, HK.AD.074)
CREATE TABLE public.hk_support_tickets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    school_id INTEGER REFERENCES public.app_schools(id) ON DELETE SET NULL,
    role TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'bug' CHECK (category IN ('bug', 'feedback', 'question', 'account')),
    subject TEXT NOT NULL CHECK (length(btrim(subject)) BETWEEN 3 AND 160),
    body TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 5 AND 3000),
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'processing', 'done')),
    -- ảnh chụp màn hình (tối đa 1,5 MB, png / jpeg / webp) lưu trong cơ sở dữ liệu cùng yêu cầu
    attachment_name TEXT,
    attachment_mime TEXT CHECK (attachment_mime IS NULL OR attachment_mime IN ('image/png', 'image/jpeg', 'image/webp')),
    attachment BYTEA,
    page TEXT,
    handled_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hk_support_tickets_user_idx ON public.hk_support_tickets (user_id, created_at DESC);
CREATE INDEX hk_support_tickets_status_idx ON public.hk_support_tickets (status, created_at DESC);

CREATE TABLE public.hk_support_messages (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES public.hk_support_tickets(id) ON DELETE CASCADE,
    author_id INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    author_role TEXT NOT NULL,
    body TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 3000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hk_support_messages_ticket_idx ON public.hk_support_messages (ticket_id, id);

-- ------------------------------------------------------------------ hướng dẫn sử dụng và câu hỏi thường gặp theo vai trò (HK.HS.110, GV.080, QT.054, AD.067)
CREATE TABLE public.hk_faq (
    id SERIAL PRIMARY KEY,
    audience TEXT NOT NULL CHECK (audience IN ('student', 'teacher', 'school_admin', 'all')),
    category TEXT NOT NULL CHECK (length(btrim(category)) BETWEEN 1 AND 60),
    question TEXT NOT NULL CHECK (length(btrim(question)) BETWEEN 3 AND 200),
    answer TEXT NOT NULL CHECK (length(btrim(answer)) BETWEEN 3 AND 4000),
    image_url TEXT CHECK (image_url IS NULL OR image_url ~ '^https://'),
    video_url TEXT CHECK (video_url IS NULL OR video_url ~ '^https://'),
    position INTEGER NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT true,
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hk_faq_audience_idx ON public.hk_faq (audience, position, id);

-- ------------------------------------------------------------------ cấu hình chung và giới hạn tần suất (HK.AD.065, HK.SYS.018, HK.SYS.019)
CREATE TABLE public.hk_system_settings (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    system_name TEXT NOT NULL DEFAULT 'Hào Khí Đông A' CHECK (length(btrim(system_name)) BETWEEN 2 AND 80),
    logo_url TEXT CHECK (logo_url IS NULL OR logo_url ~ '^https://'),
    -- địa chỉ gửi thư; để trống thì dùng biến môi trường MAIL_FROM
    mail_from TEXT CHECK (mail_from IS NULL OR length(mail_from) <= 200),
    language TEXT NOT NULL DEFAULT 'vi' CHECK (language IN ('vi')),
    timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh' CHECK (length(timezone) BETWEEN 3 AND 60),
    -- giới hạn gọi API mỗi phút; NULL = dùng mặc định của máy chủ (biến môi trường hoặc 600 / 300 / 20)
    rate_ip_per_min INTEGER CHECK (rate_ip_per_min IS NULL OR rate_ip_per_min BETWEEN 10 AND 100000),
    rate_user_per_min INTEGER CHECK (rate_user_per_min IS NULL OR rate_user_per_min BETWEEN 10 AND 100000),
    rate_ai_per_min INTEGER CHECK (rate_ai_per_min IS NULL OR rate_ai_per_min BETWEEN 1 AND 1000),
    backup_enabled BOOLEAN NOT NULL DEFAULT true,
    backup_hour SMALLINT NOT NULL DEFAULT 2 CHECK (backup_hour BETWEEN 0 AND 23),
    backup_keep SMALLINT NOT NULL DEFAULT 7 CHECK (backup_keep BETWEEN 1 AND 30),
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.hk_system_settings (id) VALUES (1);

-- ------------------------------------------------------------------ cờ bật / tắt tính năng (HK.AD.071)
CREATE TABLE public.hk_feature_flags (
    key TEXT PRIMARY KEY CHECK (key ~ '^[a-z_]{2,40}$'),
    label TEXT NOT NULL,
    description TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    position INTEGER NOT NULL DEFAULT 0,
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.hk_feature_flags (key, label, description, position) VALUES
    ('leagues', 'Giải đấu xếp hạng', 'Hạng giải đấu và bảng xếp hạng theo tuần của học sinh.', 1),
    ('hearts', 'Cơ chế tim', 'Mất tim khi làm sai và chờ hồi tim; tắt thì học sinh không bị giới hạn bởi tim.', 2),
    ('roleplay', 'Trò chuyện nhập vai', 'Nhập vai nhân vật lịch sử với Tiểu Tướng.', 3),
    ('ai_tutor', 'AI Tutor Tiểu Tướng', 'Toàn bộ hỏi đáp, giải thích, tóm tắt và công cụ AI của giáo viên.', 4),
    ('live_quiz', 'Thi đấu trực tiếp', 'Phòng thi đấu kiểu Kahoot của giáo viên và học sinh.', 5),
    ('war_game', 'Game thẻ tướng', 'Bản đồ hành quân, bộ thẻ tướng và trận đánh theo lượt.', 6),
    ('shop', 'Cửa hàng', 'Mua vật phẩm bằng vàng.', 7),
    ('recommendations', 'Gợi ý học tập', 'Gợi ý "nên học gì hôm nay", luyện tập cá nhân hóa và lộ trình ôn tập.', 8);

-- ------------------------------------------------------------------ mẫu thư (HK.AD.068): chỉ lưu bản đã chỉnh; bản mặc định nằm trong mã nguồn
CREATE TABLE public.hk_message_templates (
    key TEXT PRIMARY KEY CHECK (key IN ('otp', 'temp_password', 'reminder', 'achievement')),
    subject TEXT NOT NULL CHECK (length(btrim(subject)) BETWEEN 3 AND 160),
    body TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 5 AND 3000),
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------ giới hạn theo trường (HK.AD.017)
ALTER TABLE public.app_schools ADD COLUMN max_students INTEGER CHECK (max_students IS NULL OR max_students BETWEEN 1 AND 100000);
ALTER TABLE public.hk_ai_school_limits ADD COLUMN ai_enabled BOOLEAN NOT NULL DEFAULT true;

-- ------------------------------------------------------------------ ma trận phân quyền (HK.AD.026)
CREATE TABLE public.hk_permission_features (
    key TEXT PRIMARY KEY CHECK (key ~ '^[a-z_]{2,40}$'),
    position INTEGER NOT NULL,
    label TEXT NOT NULL,
    note TEXT,
    -- tính năng đã nối vào kiểm tra quyền của máy chủ; các dòng khác phản ánh quyền cố định trong mã nguồn (chỉ xem)
    enforced BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE public.hk_permissions (
    feature_key TEXT NOT NULL REFERENCES public.hk_permission_features(key) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'school_admin', 'root_admin')),
    -- allowed: quyền hiện hành; baseline: quyền theo đặc tả ban đầu (chỉ được thu hẹp, không được cấp thêm quá baseline)
    allowed BOOLEAN NOT NULL,
    baseline BOOLEAN NOT NULL,
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (feature_key, role)
);

INSERT INTO public.hk_permission_features (key, position, label, note, enforced) VALUES
    ('auth', 1, 'Đăng nhập / quên mật khẩu / đổi mật khẩu / đăng xuất', NULL, false),
    ('self_register', 2, 'Tự đăng ký tài khoản', 'Chỉ học sinh tự học (không thuộc trường)', false),
    ('join_class', 3, 'Tham gia lớp bằng mã lớp', NULL, false),
    ('learn_map', 4, 'Học theo bản đồ chiến dịch, bài học, dòng thời gian, bản đồ tương tác', 'Giáo viên xem trước dưới góc nhìn học sinh', false),
    ('learn_path', 5, 'Học theo lộ trình dạng đường đi (kiểu Duolingo), xem Cẩm nang cửa học', 'Giáo viên xem trước dưới góc nhìn học sinh', false),
    ('practice_play', 6, 'Làm câu hỏi ôn tập, mô phỏng trận đánh, mini-game', 'Giáo viên chơi thử để kiểm tra nội dung', false),
    ('march_cards', 7, 'Di chuyển trên bản đồ hành quân, sưu tầm – nâng cấp thẻ tướng, xếp đội hình', 'Giáo viên chỉ xem trước bản đồ (HK.GV.025)', false),
    ('war_battle', 8, 'Chơi trận đánh theo lượt bằng thẻ tướng (2D / Sa bàn 3D)', 'Giáo viên chơi thử và trình chiếu Sa bàn 3D trên lớp', false),
    ('rewards', 9, 'Nhận điểm / cấp độ / huy hiệu / thẻ, cửa hàng, nhân vật', NULL, false),
    ('leaderboard', 10, 'Xem bảng xếp hạng', 'Học sinh chỉ thấy biệt danh', false),
    ('live_join', 11, 'Tham gia phòng thi đấu trực tiếp', NULL, false),
    ('live_host', 12, 'Tổ chức phòng thi đấu trực tiếp', NULL, true),
    ('quiz_author', 13, 'Soạn Quiz tương tác kiểu Kahoot (loại câu, thời gian, điểm, ảnh sử liệu)', 'Câu hỏi lưu chung ngân hàng câu hỏi và bộ đề của giáo viên', false),
    ('live_control', 14, 'Khóa / mở khóa phòng thi, duyệt vào muộn, loại người chơi, chống tra cứu đáp án', 'Chỉ giáo viên tạo phòng', false),
    ('ai_tutor', 15, 'Hỏi đáp với AI Tutor', 'Theo hạn mức của trường', true),
    ('reco', 16, 'Gợi ý học tập cá nhân hóa', 'Giáo viên xem gợi ý theo lớp', true),
    ('sources', 17, 'Tra cứu kho tư liệu gốc', NULL, false),
    ('class_manage', 18, 'Quản lý lớp của mình (tạo lớp, mã lớp, chia đội)', NULL, false),
    ('journey_design', 19, 'Thiết kế hành trình học (quest map) cho lớp', NULL, false),
    ('journey_templates', 20, 'Quản lý hành trình học mẫu', 'QTV trường: mẫu của trường; QTV tổng: mẫu hệ thống', false),
    ('question_bank', 21, 'Ngân hàng câu hỏi và bộ đề', 'Giáo viên: của mình; QTV trường: duyệt kho trường; QTV tổng: kho hệ thống', false),
    ('assignments', 22, 'Giao bài tập, chấm điểm, nhận xét', NULL, false),
    ('reward_penalty', 23, 'Thưởng / phạt điểm, luật lớp, sự kiện ngẫu nhiên', NULL, false),
    ('game_toggle', 24, 'Bật / tắt game mô phỏng, giới hạn thời gian chơi', 'Giáo viên: theo lớp; QTV trường: toàn trường; QTV tổng: bật / tắt tính năng toàn hệ thống', false),
    ('reports', 25, 'Xem báo cáo tiến độ học tập', 'Theo phạm vi: lớp / trường / toàn hệ thống', true),
    ('people_manage', 26, 'Quản lý giáo viên, học sinh, lớp của trường', NULL, false),
    ('school_info', 27, 'Quản lý thông tin trường, năm học, khối', NULL, false),
    ('announce', 28, 'Gửi thông báo', 'Giáo viên: lớp; QTV trường: toàn trường; QTV tổng: toàn hệ thống', true),
    ('survey', 29, 'Khảo sát đánh giá trải nghiệm', 'Học sinh / giáo viên trả lời; QTV trường tạo và gửi; QTV tổng quản lý mẫu', true),
    ('schools_manage', 30, 'Quản lý trường học trên hệ thống', NULL, false),
    ('users_rbac', 31, 'Quản lý người dùng toàn hệ thống, phân quyền (RBAC)', NULL, false),
    ('history_warehouse', 32, 'Quản lý kho dữ liệu lịch sử (vua, nhân vật, sự kiện, địa điểm, trận đánh, dòng thời gian, tư liệu)', 'Kiểm chứng và công bố nội dung', false),
    ('game_content', 33, 'Quản lý nội dung trò chơi (kịch bản trận đánh, thẻ, huy hiệu, cửa hàng, cấp độ)', NULL, false),
    ('war_content', 34, 'Quản lý nội dung game mô phỏng (Phần – Cửa của lộ trình, bản đồ hành quân, hội thoại, chiêu thức, màn chơi, tài nguyên 2D / 3D)', 'Hội thoại, giai thoại chiêu thức phải gắn tư liệu đã kiểm chứng', false),
    ('ai_manage', 35, 'Quản lý AI (nguồn tri thức RAG, mô hình, prompt, hạn mức)', NULL, false),
    ('system_config', 36, 'Cấu hình hệ thống, FAQ, mẫu email, sao lưu', NULL, false),
    ('support', 37, 'Yêu cầu hỗ trợ / báo lỗi', 'QTV tổng xử lý; các vai trò khác gửi yêu cầu', true),
    ('audit_log', 38, 'Xem nhật ký hoạt động (audit log)', 'QTV trường: trong trường; QTV tổng: toàn hệ thống', true);

-- Mỗi dòng: (khóa, học sinh, giáo viên, quản trị trường, quản trị tổng) theo sheet "Phân quyền" của đặc tả ver0.2
INSERT INTO public.hk_permissions (feature_key, role, allowed, baseline)
SELECT m.key, r.role, r.flag, r.flag
FROM (VALUES
    ('auth', true, true, true, true), ('self_register', true, false, false, false), ('join_class', true, false, false, false),
    ('learn_map', true, true, false, false), ('learn_path', true, true, false, false), ('practice_play', true, true, false, false),
    ('march_cards', true, false, false, false), ('war_battle', true, true, false, false), ('rewards', true, false, false, false),
    ('leaderboard', true, true, true, true), ('live_join', true, false, false, false), ('live_host', false, true, false, false),
    ('quiz_author', false, true, false, false), ('live_control', false, true, false, false), ('ai_tutor', true, true, false, false),
    ('reco', true, true, false, false), ('sources', true, true, true, true), ('class_manage', false, true, true, false),
    ('journey_design', false, true, false, false), ('journey_templates', false, false, true, true), ('question_bank', false, true, true, true),
    ('assignments', false, true, false, false), ('reward_penalty', false, true, false, false), ('game_toggle', false, true, true, true),
    ('reports', false, true, true, true), ('people_manage', false, false, true, true), ('school_info', false, false, true, true),
    ('announce', false, true, true, true), ('survey', true, true, true, true), ('schools_manage', false, false, false, true),
    ('users_rbac', false, false, false, true), ('history_warehouse', false, false, false, true), ('game_content', false, false, false, true),
    ('war_content', false, false, false, true), ('ai_manage', false, false, false, true), ('system_config', false, false, false, true),
    ('support', true, true, true, true), ('audit_log', false, false, true, true)
) AS m(key, s, t, q, a)
CROSS JOIN LATERAL (VALUES ('student', m.s), ('teacher', m.t), ('school_admin', m.q), ('root_admin', m.a)) AS r(role, flag);

-- ------------------------------------------------------------------ xác thực hai lớp cho tài khoản quản trị (HK.AD.002)
CREATE TABLE public.hk_two_factor (
    user_id INTEGER PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE,
    method TEXT NOT NULL CHECK (method IN ('email', 'totp')),
    -- bí mật TOTP luôn lưu dạng mã hóa AES-256-GCM (khóa dẫn xuất từ AUTH_SECRET_KEY), không bao giờ trả lại giao diện sau khi bật
    totp_secret_enc TEXT,
    enabled BOOLEAN NOT NULL DEFAULT false,
    -- mã dự phòng dùng một lần, chỉ lưu băm
    backup_hashes TEXT[] NOT NULL DEFAULT '{}',
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.hk_two_factor_codes (
    user_id INTEGER PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------ nhật ký đăng nhập có thiết bị và địa chỉ IP (HK.AD.027), nhật ký lỗi (HK.AD.076, HK.SYS.020)
ALTER TABLE public.app_login_events ADD COLUMN ip TEXT, ADD COLUMN user_agent TEXT;
ALTER TABLE public.app_login_events DROP CONSTRAINT IF EXISTS app_login_events_reason_check;
ALTER TABLE public.app_login_events ADD CONSTRAINT app_login_events_reason_check CHECK (reason IN ('success', 'credentials', 'locked', 'deleted', 'portal', 'rate_limit', 'two_factor'));

CREATE TABLE public.hk_error_log (
    id BIGSERIAL PRIMARY KEY,
    source TEXT NOT NULL CHECK (source IN ('api', 'ai', 'email', 'job', 'db')),
    message TEXT NOT NULL,
    route TEXT,
    status INTEGER,
    user_id INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    school_id INTEGER REFERENCES public.app_schools(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hk_error_log_time_idx ON public.hk_error_log (created_at DESC, id DESC);
CREATE INDEX hk_error_log_source_idx ON public.hk_error_log (source, created_at DESC);

-- nhịp chạy của các việc nền, phục vụ giám sát tình trạng hệ thống (HK.AD.010)
CREATE TABLE public.hk_job_heartbeats (
    job TEXT PRIMARY KEY,
    last_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_ok BOOLEAN NOT NULL DEFAULT true,
    last_error TEXT,
    runs BIGINT NOT NULL DEFAULT 1
);

-- ------------------------------------------------------------------ sao lưu (HK.AD.072, HK.SYS.019)
CREATE TABLE public.hk_backups (
    id SERIAL PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('manual', 'auto', 'pre_restore')),
    label TEXT,
    size_bytes BIGINT NOT NULL,
    table_count INTEGER NOT NULL,
    row_count BIGINT NOT NULL,
    schema_version INTEGER NOT NULL,
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- nội dung: JSON nén gzip của mọi bảng nghiệp vụ (không gồm bản sao lưu khác, lịch sử migration và mã thu hồi)
    data BYTEA NOT NULL
);
CREATE INDEX hk_backups_time_idx ON public.hk_backups (created_at DESC);

ALTER TABLE public.hk_user_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_faq ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_permission_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_two_factor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_two_factor_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_error_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_job_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_backups ENABLE ROW LEVEL SECURITY;
