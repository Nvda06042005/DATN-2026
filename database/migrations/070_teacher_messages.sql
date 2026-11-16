-- Thư của giáo viên (16/11/2026, mục "Nội dung đã gửi"): giáo viên chọn người nhận trong danh sách cùng trường (quản trị viên trường, giáo viên,
-- học sinh), soạn tiêu đề và nội dung, có thể đính kèm câu hỏi / bộ đề / hành trình (gửi quản trị trường duyệt vào kho chung, liên kết hk_shares).
-- Người nhận được thông báo ở chuông / mục Thông báo (app_notifications). Hai bảng theo trường, bật RLS, không cấp quyền công khai, có kho dữ liệu đã xóa.
CREATE TABLE public.hk_messages (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES public.app_schools(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    subject TEXT NOT NULL CHECK (length(btrim(subject)) BETWEEN 1 AND 150),
    body TEXT CHECK (body IS NULL OR length(body) <= 2000),
    entity TEXT CHECK (entity IS NULL OR entity IN ('question', 'quiz', 'journey')),
    entity_id INTEGER,
    share_id INTEGER REFERENCES public.hk_shares(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((entity IS NULL) = (entity_id IS NULL))
);
CREATE INDEX hk_messages_sender_idx ON public.hk_messages (sender_id, created_at DESC);
CREATE INDEX hk_messages_school_idx ON public.hk_messages (school_id, created_at DESC);

CREATE TABLE public.hk_message_recipients (
    message_id INTEGER NOT NULL REFERENCES public.hk_messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    school_id INTEGER NOT NULL REFERENCES public.app_schools(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ,
    PRIMARY KEY (message_id, user_id)
);
CREATE INDEX hk_message_recipients_user_idx ON public.hk_message_recipients (user_id, message_id DESC);

ALTER TABLE public.hk_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_message_recipients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hk_messages, public.hk_message_recipients FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hk_messages, public.hk_message_recipients TO dong_a_school_scope, dong_a_workspace_scope;
GRANT USAGE, SELECT ON SEQUENCE public.hk_messages_id_seq TO dong_a_school_scope, dong_a_workspace_scope;
CREATE POLICY school_scope ON public.hk_messages FOR ALL TO dong_a_school_scope, dong_a_workspace_scope
    USING (school_id = NULLIF(current_setting('app.school_id', true), '')::integer)
    WITH CHECK (school_id = NULLIF(current_setting('app.school_id', true), '')::integer);
CREATE POLICY school_scope ON public.hk_message_recipients FOR ALL TO dong_a_school_scope, dong_a_workspace_scope
    USING (school_id = NULLIF(current_setting('app.school_id', true), '')::integer)
    WITH CHECK (school_id = NULLIF(current_setting('app.school_id', true), '')::integer);

COMMENT ON TABLE public.hk_messages IS 'Thư giáo viên gửi người cùng trường (quản trị trường, giáo viên, học sinh); đính kèm nội dung thì kèm yêu cầu duyệt hk_shares';

SELECT public.app_install_delete_archives();
