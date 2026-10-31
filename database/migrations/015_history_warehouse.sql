-- HK.AD.028–042 (Mục tiêu 1 của đề cương): kho dữ liệu lịch sử có cấu trúc cho ba lần kháng chiến chống Nguyên – Mông.
-- Mỗi bản ghi có vòng đời Nháp → Đã kiểm chứng → Công bố (chỉ nội dung Công bố được học sinh thấy và được AI dùng), mỗi lần
-- thêm/sửa/đổi trạng thái đều lưu một phiên bản (hist_versions) để xem lại, so sánh và khôi phục. Chỉ backend (chủ bảng) đọc/ghi;
-- bảng bật RLS và không cấp quyền cho vai trò theo trường hay vai trò công khai. Nội dung khởi tạo nằm ở migration kế tiếp.

-- ------------------------------------------------------------------ cuộc kháng chiến
CREATE TABLE public.hist_campaigns (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 160),
    year_label TEXT NOT NULL CHECK (length(btrim(year_label)) BETWEEN 1 AND 40),
    start_year SMALLINT CHECK (start_year IS NULL OR start_year BETWEEN 1000 AND 1500),
    end_year SMALLINT CHECK (end_year IS NULL OR end_year BETWEEN 1000 AND 1500),
    summary TEXT CHECK (summary IS NULL OR length(summary) <= 4000),
    image_url TEXT CHECK (image_url IS NULL OR (image_url ~ '^https://' AND length(image_url) <= 500)),
    sort_order INTEGER NOT NULL DEFAULT 0,
    search_text TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'verified', 'published')),
    version_no INTEGER NOT NULL DEFAULT 1,
    verified_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    published_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_year IS NULL OR start_year IS NULL OR end_year >= start_year)
);

-- ------------------------------------------------------------------ địa điểm (tọa độ chọn trực tiếp trên bản đồ)
CREATE TABLE public.hist_places (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
    name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 160),
    old_name TEXT CHECK (old_name IS NULL OR length(old_name) <= 160),
    province TEXT CHECK (province IS NULL OR length(province) <= 80),
    lat NUMERIC(9, 6) CHECK (lat IS NULL OR lat BETWEEN -90 AND 90),
    lng NUMERIC(9, 6) CHECK (lng IS NULL OR lng BETWEEN -180 AND 180),
    description TEXT CHECK (description IS NULL OR length(description) <= 4000),
    image_url TEXT CHECK (image_url IS NULL OR (image_url ~ '^https://' AND length(image_url) <= 500)),
    search_text TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'verified', 'published')),
    version_no INTEGER NOT NULL DEFAULT 1,
    verified_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    published_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((lat IS NULL) = (lng IS NULL))
);

-- ------------------------------------------------------------------ nhân vật (vua Trần, tướng lĩnh, quan lại, người khác)
CREATE TABLE public.hist_figures (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
    name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 120),
    honorific TEXT CHECK (honorific IS NULL OR length(honorific) <= 200),
    figure_group TEXT NOT NULL DEFAULT 'other' CHECK (figure_group IN ('king', 'general', 'official', 'other')),
    birth_year SMALLINT CHECK (birth_year IS NULL OR birth_year BETWEEN 0 AND 2100),
    death_year SMALLINT CHECK (death_year IS NULL OR death_year BETWEEN 0 AND 2100),
    role_text TEXT CHECK (role_text IS NULL OR length(role_text) <= 400),
    biography TEXT CHECK (biography IS NULL OR length(biography) <= 6000),
    famous_quote TEXT CHECK (famous_quote IS NULL OR length(famous_quote) <= 600),
    image_url TEXT CHECK (image_url IS NULL OR (image_url ~ '^https://' AND length(image_url) <= 500)),
    source_note TEXT CHECK (source_note IS NULL OR length(source_note) <= 600),
    search_text TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'verified', 'published')),
    version_no INTEGER NOT NULL DEFAULT 1,
    verified_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    published_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (death_year IS NULL OR birth_year IS NULL OR death_year >= birth_year)
);

-- ------------------------------------------------------------------ sự kiện (cũng là các mốc của dòng thời gian, sắp theo sort_order)
CREATE TABLE public.hist_events (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
    name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 200),
    year_from SMALLINT NOT NULL CHECK (year_from BETWEEN 1000 AND 1500),
    year_to SMALLINT CHECK (year_to IS NULL OR year_to BETWEEN 1000 AND 1500),
    date_text TEXT CHECK (date_text IS NULL OR length(date_text) <= 60),
    description TEXT CHECK (description IS NULL OR length(description) <= 6000),
    significance TEXT CHECK (significance IS NULL OR length(significance) <= 3000),
    campaign_id INTEGER REFERENCES public.hist_campaigns(id) ON DELETE RESTRICT,
    place_id INTEGER REFERENCES public.hist_places(id) ON DELETE RESTRICT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    search_text TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'verified', 'published')),
    version_no INTEGER NOT NULL DEFAULT 1,
    verified_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    published_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (year_to IS NULL OR year_to >= year_from)
);
CREATE INDEX hist_events_timeline_idx ON public.hist_events (campaign_id, sort_order, year_from);

-- ------------------------------------------------------------------ trận đánh
CREATE TABLE public.hist_battles (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
    name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 160),
    year SMALLINT NOT NULL CHECK (year BETWEEN 1000 AND 1500),
    date_text TEXT CHECK (date_text IS NULL OR length(date_text) <= 60),
    context TEXT CHECK (context IS NULL OR length(context) <= 4000),
    forces TEXT CHECK (forces IS NULL OR length(forces) <= 3000),
    course TEXT CHECK (course IS NULL OR length(course) <= 6000),
    result TEXT CHECK (result IS NULL OR length(result) <= 3000),
    campaign_id INTEGER REFERENCES public.hist_campaigns(id) ON DELETE RESTRICT,
    place_id INTEGER REFERENCES public.hist_places(id) ON DELETE RESTRICT,
    event_id INTEGER REFERENCES public.hist_events(id) ON DELETE RESTRICT,
    -- Khóa kịch bản mô phỏng trận đánh (Sprint 6) sẽ đọc để nối mini-game với trận đánh
    minigame_key TEXT CHECK (minigame_key IS NULL OR minigame_key ~ '^[a-z0-9_]{2,60}$'),
    sort_order INTEGER NOT NULL DEFAULT 0,
    search_text TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'verified', 'published')),
    version_no INTEGER NOT NULL DEFAULT 1,
    verified_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    published_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------ tư liệu gốc
CREATE TABLE public.hist_sources (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 200),
    kind TEXT NOT NULL DEFAULT 'su_lieu' CHECK (kind IN ('su_lieu', 'tho_van', 'hich', 'hinh_anh', 'ban_do_co')),
    original_text TEXT CHECK (original_text IS NULL OR length(original_text) <= 12000),
    transliteration TEXT CHECK (transliteration IS NULL OR length(transliteration) <= 12000),
    translation TEXT CHECK (translation IS NULL OR length(translation) <= 12000),
    annotation TEXT CHECK (annotation IS NULL OR length(annotation) <= 6000),
    citation TEXT CHECK (citation IS NULL OR length(citation) <= 600),
    attachment_url TEXT CHECK (attachment_url IS NULL OR (attachment_url ~ '^https://' AND length(attachment_url) <= 500)),
    search_text TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'verified', 'published')),
    version_no INTEGER NOT NULL DEFAULT 1,
    verified_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    published_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------ từ điển thuật ngữ
CREATE TABLE public.hist_terms (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
    term TEXT NOT NULL CHECK (length(btrim(term)) BETWEEN 2 AND 120),
    definition TEXT NOT NULL CHECK (length(btrim(definition)) BETWEEN 2 AND 3000),
    search_text TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'verified', 'published')),
    version_no INTEGER NOT NULL DEFAULT 1,
    verified_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    published_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------ liên kết nhiều-nhiều (đã chuẩn hóa a_type < b_type)
-- Cặp hợp lệ: trận đánh–nhân vật/tư liệu, cuộc kháng chiến–nhân vật/tư liệu, sự kiện–nhân vật/tư liệu, nhân vật–tư liệu, địa điểm–tư liệu.
-- Quan hệ một-nhiều (sự kiện/trận đánh thuộc cuộc kháng chiến, diễn ra ở địa điểm) dùng khóa ngoại trên chính bảng đó.
CREATE TABLE public.hist_links (
    a_type TEXT NOT NULL,
    a_id INTEGER NOT NULL,
    b_type TEXT NOT NULL,
    b_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (a_type, a_id, b_type, b_id),
    CHECK ((a_type, b_type) IN (
        ('battle', 'figure'), ('battle', 'source'), ('campaign', 'figure'), ('campaign', 'source'),
        ('event', 'figure'), ('event', 'source'), ('figure', 'source'), ('place', 'source')
    ))
);
CREATE INDEX hist_links_b_idx ON public.hist_links (b_type, b_id);

-- ------------------------------------------------------------------ lịch sử chỉnh sửa (HK.AD.032, HK.AD.042): chỉ thêm, không sửa/xóa
CREATE TABLE public.hist_versions (
    id BIGSERIAL PRIMARY KEY,
    entity TEXT NOT NULL CHECK (entity IN ('campaign', 'figure', 'event', 'place', 'battle', 'source', 'term')),
    entity_id INTEGER NOT NULL,
    version_no INTEGER NOT NULL CHECK (version_no >= 1),
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'status', 'restore', 'import', 'reorder')),
    snapshot JSONB NOT NULL,
    links JSONB NOT NULL DEFAULT '{}'::jsonb,
    note TEXT CHECK (note IS NULL OR length(note) <= 300),
    changed_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (entity, entity_id, version_no)
);

ALTER TABLE public.hist_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hist_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hist_figures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hist_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hist_battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hist_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hist_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hist_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hist_versions ENABLE ROW LEVEL SECURITY;
