-- Hành trình Đông A (trang học sinh dựng lại ngày 15/11/2026): 13 chặng của ba lần kháng chiến trên bản đồ, mỗi chặng gồm học ngắn – luyện tập – nhập vai khám phá – trận đánh.
-- Nội dung (bản đồ, chặng, câu luyện tập, thẻ nhân vật, tư liệu) là mẫu hệ thống chỉ đọc trong không gian của trường; quản trị tổng chỉnh qua API, không sửa mã nguồn.
-- Dữ liệu của học sinh (tiến độ, phiên chơi, hành động, câu trả lời, danh sách ôn, thẻ đã mở) thuộc về tài khoản và chịu RLS theo trường như các bảng hk_* khác.
-- Không tạo dữ liệu người dùng, không đổi bảng cũ. Điểm, vàng, chuỗi ngày, huy hiệu và bảng xếp hạng dùng lại sổ cái sẵn có (hk_points, hk_gold_ledger, hk_user_badges).

-- ---------------------------------------------------------------------- nội dung (mẫu hệ thống)
CREATE TABLE public.hk_saga_maps (
    campaign_no SMALLINT PRIMARY KEY CHECK (campaign_no BETWEEN 1 AND 3),
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 120),
    short_title TEXT NOT NULL CHECK (length(btrim(short_title)) BETWEEN 2 AND 40),
    years TEXT NOT NULL CHECK (length(years) BETWEEN 4 AND 20),
    enemy TEXT NOT NULL CHECK (length(enemy) BETWEEN 2 AND 40),
    places TEXT NOT NULL CHECK (length(places) <= 80),
    summary TEXT NOT NULL CHECK (length(summary) <= 600),
    -- Ảnh nền bản đồ: khóa của ảnh có sẵn trong ứng dụng, hoặc liên kết https do quản trị tổng đặt (khi đó image_w/image_h là kích thước ảnh mới)
    image_key TEXT NOT NULL CHECK (image_key ~ '^[a-z0-9-]{2,40}$'),
    image_url TEXT CHECK (image_url IS NULL OR (image_url ~ '^https://' AND length(image_url) <= 500)),
    image_w INTEGER NOT NULL CHECK (image_w BETWEEN 100 AND 12000),
    image_h INTEGER NOT NULL CHECK (image_h BETWEEN 100 AND 12000),
    credit TEXT NOT NULL CHECK (length(credit) <= 300),
    credit_url TEXT CHECK (credit_url IS NULL OR (credit_url ~ '^https://' AND length(credit_url) <= 500)),
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.hk_saga_stages (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9-]{3,40}$'),
    campaign_no SMALLINT NOT NULL REFERENCES public.hk_saga_maps(campaign_no) ON DELETE RESTRICT,
    -- Thứ tự mở khóa trên toàn hành trình (1..13): chặng sau chỉ mở khi chặng trước hoàn thành
    position SMALLINT NOT NULL UNIQUE CHECK (position BETWEEN 1 AND 99),
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 80),
    place TEXT NOT NULL CHECK (length(btrim(place)) BETWEEN 2 AND 60),
    date_label TEXT NOT NULL CHECK (length(btrim(date_label)) BETWEEN 2 AND 60),
    kind TEXT NOT NULL CHECK (kind IN ('battle', 'council', 'strategy', 'prepare')),
    icon TEXT NOT NULL DEFAULT 'swords' CHECK (icon ~ '^[a-z_]{2,20}$'),
    summary TEXT NOT NULL CHECK (length(summary) <= 500),
    -- Vị trí điểm trên ảnh bản đồ theo tỉ lệ 0–1 so với ảnh gốc; anchor là vị trí địa danh thật khi điểm phải đặt lệch để không chồng nhau
    map_x NUMERIC(6,5) NOT NULL CHECK (map_x BETWEEN 0 AND 1),
    map_y NUMERIC(6,5) NOT NULL CHECK (map_y BETWEEN 0 AND 1),
    anchor_x NUMERIC(6,5) CHECK (anchor_x IS NULL OR anchor_x BETWEEN 0 AND 1),
    anchor_y NUMERIC(6,5) CHECK (anchor_y IS NULL OR anchor_y BETWEEN 0 AND 1),
    -- Quy tắc mở khóa: mã chặng phải hoàn thành trước; rỗng = mở sẵn (chặng đầu của mỗi cuộc kháng chiến). Quản trị đổi được mà không sửa mã nguồn
    unlock_after TEXT CHECK (unlock_after IS NULL OR unlock_after ~ '^[a-z0-9-]{3,40}$'),
    pass_percent SMALLINT NOT NULL DEFAULT 70 CHECK (pass_percent BETWEEN 40 AND 100),
    reward_xp INTEGER NOT NULL DEFAULT 100 CHECK (reward_xp BETWEEN 0 AND 2000),
    reward_gold INTEGER NOT NULL DEFAULT 30 CHECK (reward_gold BETWEEN 0 AND 1000),
    card_code TEXT CHECK (card_code IS NULL OR card_code ~ '^[a-z0-9-]{3,40}$'),
    badge_code TEXT CHECK (badge_code IS NULL OR badge_code ~ '^[a-z0-9_-]{2,60}$'),
    -- Mục tiêu học, thẻ kiến thức, nguồn, cảnh khám phá, kịch bản trận đánh và phần tổng kết lịch sử; máy chủ kiểm tra cấu trúc khi lưu
    content JSONB NOT NULL CHECK (jsonb_typeof(content) = 'object'),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'published')),
    review_note TEXT CHECK (review_note IS NULL OR length(review_note) <= 600),
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hk_saga_stages_campaign_idx ON public.hk_saga_stages(campaign_no, position);

-- Bản lưu các phiên bản nội dung trước khi quản trị sửa
CREATE TABLE public.hk_saga_stage_versions (
    stage_id INTEGER NOT NULL REFERENCES public.hk_saga_stages(id) ON DELETE CASCADE,
    version INTEGER NOT NULL CHECK (version >= 1),
    content JSONB NOT NULL,
    status TEXT NOT NULL,
    saved_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (stage_id, version)
);

-- Câu luyện tập và ôn tập: mỗi câu gắn một mục tiêu kiến thức và một nguồn của chặng. Cột data chứa đáp án, không bao giờ gửi nguyên cho học sinh.
CREATE TABLE public.hk_saga_items (
    id SERIAL PRIMARY KEY,
    stage_id INTEGER NOT NULL REFERENCES public.hk_saga_stages(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9-]{3,60}$'),
    position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 99),
    kind TEXT NOT NULL CHECK (kind IN ('quiz', 'pairs', 'sequence', 'locate', 'tactic')),
    usage TEXT NOT NULL DEFAULT 'both' CHECK (usage IN ('practice', 'review', 'both')),
    objective TEXT NOT NULL CHECK (objective ~ '^[a-z0-9-]{1,20}$'),
    prompt TEXT NOT NULL CHECK (length(btrim(prompt)) BETWEEN 5 AND 400),
    data JSONB NOT NULL CHECK (jsonb_typeof(data) = 'object'),
    explanation TEXT NOT NULL CHECK (length(btrim(explanation)) BETWEEN 5 AND 600),
    source TEXT NOT NULL CHECK (source ~ '^[a-z0-9-]{1,30}$'),
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (stage_id, position)
);

-- Thẻ nhân vật mở bằng kết quả học: có giới thiệu, vai trò và nguồn
CREATE TABLE public.hk_saga_cards (
    code TEXT PRIMARY KEY CHECK (code ~ '^[a-z0-9-]{3,40}$'),
    name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 60),
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 80),
    rarity TEXT NOT NULL CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
    years TEXT CHECK (years IS NULL OR length(years) <= 30),
    intro TEXT NOT NULL CHECK (length(intro) <= 700),
    role_text TEXT NOT NULL CHECK (length(role_text) <= 500),
    quote TEXT CHECK (quote IS NULL OR length(quote) <= 300),
    quote_source TEXT CHECK (quote_source IS NULL OR length(quote_source) <= 160),
    source TEXT NOT NULL CHECK (length(source) <= 300),
    source_url TEXT CHECK (source_url IS NULL OR (source_url ~ '^https://' AND length(source_url) <= 500)),
    portrait TEXT NOT NULL CHECK (portrait ~ '^[a-z0-9-]{2,40}$'),
    sort_order SMALLINT NOT NULL DEFAULT 0
);

-- Kho tư liệu: văn bản gốc và mốc niên biểu (nhân vật lấy từ thẻ, bản đồ lấy từ hk_saga_maps)
CREATE TABLE public.hk_saga_docs (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9-]{3,60}$'),
    kind TEXT NOT NULL CHECK (kind IN ('text', 'timeline')),
    campaign_no SMALLINT REFERENCES public.hk_saga_maps(campaign_no) ON DELETE SET NULL,
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 120),
    subtitle TEXT CHECK (subtitle IS NULL OR length(subtitle) <= 200),
    body JSONB NOT NULL CHECK (jsonb_typeof(body) = 'object'),
    source TEXT NOT NULL CHECK (length(source) <= 300),
    source_url TEXT CHECK (source_url IS NULL OR (source_url ~ '^https://' AND length(source_url) <= 500)),
    -- Mã chặng phải hoàn thành để mở tư liệu; rỗng = mở sẵn
    unlock_stage TEXT CHECK (unlock_stage IS NULL OR unlock_stage ~ '^[a-z0-9-]{3,40}$'),
    sort_order SMALLINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published'))
);

-- ---------------------------------------------------------------------- dữ liệu của học sinh
-- Tiến độ từng chặng: tách mức hiểu kiến thức (practice_best) khỏi điểm trận đánh (battle_best)
CREATE TABLE public.hk_saga_progress (
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    stage_id INTEGER NOT NULL REFERENCES public.hk_saga_stages(id) ON DELETE CASCADE,
    lesson_done_at TIMESTAMPTZ,
    practice_best SMALLINT NOT NULL DEFAULT 0 CHECK (practice_best BETWEEN 0 AND 100),
    practice_tries INTEGER NOT NULL DEFAULT 0 CHECK (practice_tries >= 0),
    practice_passed_at TIMESTAMPTZ,
    explore_done_at TIMESTAMPTZ,
    explore_hints INTEGER NOT NULL DEFAULT 0 CHECK (explore_hints >= 0),
    explore_mistakes INTEGER NOT NULL DEFAULT 0 CHECK (explore_mistakes >= 0),
    battle_best INTEGER NOT NULL DEFAULT 0 CHECK (battle_best >= 0),
    battle_stars SMALLINT NOT NULL DEFAULT 0 CHECK (battle_stars BETWEEN 0 AND 3),
    battle_tries INTEGER NOT NULL DEFAULT 0 CHECK (battle_tries >= 0),
    battle_won_at TIMESTAMPTZ,
    stars SMALLINT NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 3),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, stage_id)
);
CREATE INDEX hk_saga_progress_stage_idx ON public.hk_saga_progress(stage_id) WHERE completed_at IS NOT NULL;

-- Phiên chơi: máy chủ giữ trạng thái chuẩn (state) và số thứ tự hành động (seq). Mỗi học sinh chỉ có một phiên đang mở cho mỗi chặng và mỗi loại.
CREATE TABLE public.hk_saga_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    stage_id INTEGER REFERENCES public.hk_saga_stages(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('practice', 'explore', 'battle', 'review')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'abandoned')),
    seq INTEGER NOT NULL DEFAULT 0 CHECK (seq >= 0),
    state JSONB NOT NULL CHECK (jsonb_typeof(state) = 'object'),
    result JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX hk_saga_sessions_active_key ON public.hk_saga_sessions(user_id, COALESCE(stage_id, 0), kind) WHERE status = 'active';
CREATE INDEX hk_saga_sessions_user_idx ON public.hk_saga_sessions(user_id, started_at DESC);

-- Nhật ký hành động: (phiên, seq) giữ thứ tự lượt; (phiên, action_id) để yêu cầu gửi lặp hoặc kết nối lại nhận đúng kết quả cũ, không xử lý lần hai
CREATE TABLE public.hk_saga_actions (
    session_id BIGINT NOT NULL REFERENCES public.hk_saga_sessions(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL CHECK (seq >= 1),
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    action_id TEXT NOT NULL CHECK (action_id ~ '^[A-Za-z0-9_-]{8,64}$'),
    action JSONB NOT NULL,
    outcome JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (session_id, seq),
    UNIQUE (session_id, action_id)
);

-- Mỗi câu trả lời đã chấm: dùng cho mức hiểu theo mục tiêu, danh sách ôn và thống kê "học sinh thường sai" của giáo viên
CREATE TABLE public.hk_saga_answers (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES public.hk_saga_items(id) ON DELETE CASCADE,
    stage_id INTEGER NOT NULL REFERENCES public.hk_saga_stages(id) ON DELETE CASCADE,
    session_id BIGINT REFERENCES public.hk_saga_sessions(id) ON DELETE SET NULL,
    mode TEXT NOT NULL CHECK (mode IN ('practice', 'review')),
    correct BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hk_saga_answers_user_idx ON public.hk_saga_answers(user_id, stage_id);
CREATE INDEX hk_saga_answers_item_idx ON public.hk_saga_answers(item_id);

-- Câu đã sai chờ ôn lại: trả lời đúng trong lượt ôn thì đóng (cleared_at)
CREATE TABLE public.hk_saga_review (
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES public.hk_saga_items(id) ON DELETE CASCADE,
    wrong_count INTEGER NOT NULL DEFAULT 1 CHECK (wrong_count >= 1),
    last_wrong_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    cleared_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, item_id)
);

CREATE TABLE public.hk_saga_user_cards (
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    card_code TEXT NOT NULL REFERENCES public.hk_saga_cards(code) ON DELETE CASCADE,
    stage_id INTEGER REFERENCES public.hk_saga_stages(id) ON DELETE SET NULL,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, card_code)
);

-- ---------------------------------------------------------------------- quyền và RLS
-- Không cấp quyền cho PUBLIC / anon / authenticated. Vai trò theo trường chỉ đọc nội dung mẫu; dữ liệu học sinh chỉ đọc/ghi được trong trường của mình (hoặc của chính tài khoản tự học).
DO $$
DECLARE t TEXT; own TEXT; rule TEXT; r TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['hk_saga_maps', 'hk_saga_stages', 'hk_saga_stage_versions', 'hk_saga_items', 'hk_saga_cards', 'hk_saga_docs',
        'hk_saga_progress', 'hk_saga_sessions', 'hk_saga_actions', 'hk_saga_answers', 'hk_saga_review', 'hk_saga_user_cards']
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', t);
        FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON public.%I FROM %I', t, r); END IF;
        END LOOP;
    END LOOP;

    FOREACH t IN ARRAY ARRAY['hk_saga_maps', 'hk_saga_stages', 'hk_saga_items', 'hk_saga_cards', 'hk_saga_docs']
    LOOP
        EXECUTE format('GRANT SELECT ON public.%I TO dong_a_workspace_scope', t);
        EXECUTE format('CREATE POLICY workspace_read ON public.%I FOR SELECT TO dong_a_workspace_scope USING (true)', t);
    END LOOP;

    FOREACH t IN ARRAY ARRAY['hk_saga_progress', 'hk_saga_sessions', 'hk_saga_actions', 'hk_saga_answers', 'hk_saga_review', 'hk_saga_user_cards']
    LOOP
        own := format('public.app_workspace_owner(%L::regclass, to_jsonb(%I))', 'public.' || t, t);
        rule := format('((public.app_workspace_school() IS NOT NULL AND %s = public.app_workspace_school()) OR %s = -NULLIF(current_setting(''app.user_id'', true), '''')::integer)', own, own);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO dong_a_workspace_scope', t);
        EXECUTE format('CREATE POLICY workspace_read ON public.%I FOR SELECT TO dong_a_workspace_scope USING (%s)', t, rule);
        EXECUTE format('CREATE POLICY workspace_insert ON public.%I FOR INSERT TO dong_a_workspace_scope WITH CHECK (%s)', t, rule);
        EXECUTE format('CREATE POLICY workspace_update ON public.%I FOR UPDATE TO dong_a_workspace_scope USING (%s) WITH CHECK (%s)', t, rule, rule);
        EXECUTE format('CREATE POLICY workspace_delete ON public.%I FOR DELETE TO dong_a_workspace_scope USING (%s)', t, rule);
    END LOOP;

    FOR t IN SELECT s.oid::regclass::text FROM pg_class s JOIN pg_depend d ON d.objid = s.oid JOIN pg_class c ON c.oid = d.refobjid JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE s.relkind = 'S' AND n.nspname = 'public' AND c.relname IN ('hk_saga_sessions', 'hk_saga_answers')
    LOOP
        EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO dong_a_workspace_scope', t);
        FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM %I', t, r); END IF;
        END LOOP;
    END LOOP;
END $$;

-- Khóa ngoại của PostgreSQL bỏ qua RLS khi kiểm tra tồn tại: gắn trigger của migration 039 để một tài khoản không trỏ được phiên / câu trả lời sang dữ liệu của trường khác
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['hk_saga_progress', 'hk_saga_sessions', 'hk_saga_actions', 'hk_saga_answers', 'hk_saga_review', 'hk_saga_user_cards']
    LOOP
        EXECUTE format('CREATE TRIGGER workspace_refs BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.app_workspace_check_refs()', t);
    END LOOP;
END $$;

-- Kho dữ liệu đã xóa (migration 052): bảng nghiệp vụ mới phải được gắn trigger lưu trước khi xóa
SELECT public.app_install_delete_archives();
