-- Sprint 9 (HaoKhiDongA ver0.2): AI Tutor "Tiểu Tướng" trả lời dựa trên kho tư liệu đã công bố (RAG).
-- Đoạn tư liệu (chunk) lưu kèm vector nhúng dạng REAL[] (không cần tiện ích pgvector nên chạy được trên Supabase và PostgreSQL thử nghiệm);
-- khi chưa cấu hình mô hình nhúng, truy xuất dùng xếp hạng từ khóa BM25 trên chính các đoạn này. Khóa API chỉ lưu dạng mã hóa AES-256-GCM (khóa dẫn xuất từ AUTH_SECRET_KEY).
-- Mọi bảng chứa dữ liệu người dùng bật RLS: chỉ máy chủ đọc/ghi.

-- ------------------------------------------------------------------ cấu hình (một dòng duy nhất)
CREATE TABLE public.hk_ai_settings (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    provider TEXT NOT NULL DEFAULT 'none' CHECK (provider IN ('none', 'anthropic', 'openai')),
    base_url TEXT CHECK (base_url IS NULL OR (base_url ~ '^https?://[^\s]+$' AND length(base_url) <= 300)),
    chat_model TEXT CHECK (chat_model IS NULL OR length(chat_model) <= 100),
    embed_model TEXT CHECK (embed_model IS NULL OR length(embed_model) <= 100),
    api_key_enc TEXT,
    temperature NUMERIC(3, 2) NOT NULL DEFAULT 0.30 CHECK (temperature BETWEEN 0 AND 1),
    max_tokens INTEGER NOT NULL DEFAULT 700 CHECK (max_tokens BETWEEN 100 AND 4000),
    top_k INTEGER NOT NULL DEFAULT 5 CHECK (top_k BETWEEN 1 AND 12),
    -- ngưỡng liên quan tối thiểu (0–1, điểm đã chuẩn hóa) để coi câu hỏi nằm trong phạm vi tư liệu
    min_score NUMERIC(4, 3) NOT NULL DEFAULT 0.40 CHECK (min_score BETWEEN 0 AND 1),
    system_prompt TEXT NOT NULL CHECK (length(system_prompt) BETWEEN 20 AND 4000),
    refusal_message TEXT NOT NULL CHECK (length(refusal_message) BETWEEN 5 AND 600),
    banned_terms TEXT[] NOT NULL DEFAULT '{}',
    index_kinds TEXT[] NOT NULL DEFAULT ARRAY['campaign', 'place', 'figure', 'event', 'battle', 'source', 'term', 'lesson'],
    daily_per_user INTEGER NOT NULL DEFAULT 20 CHECK (daily_per_user BETWEEN 1 AND 500),
    daily_per_school INTEGER NOT NULL DEFAULT 500 CHECK (daily_per_school BETWEEN 1 AND 100000),
    last_index_at TIMESTAMPTZ,
    last_index_ms INTEGER,
    last_index_error TEXT,
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.hk_ai_settings (id, system_prompt, refusal_message) VALUES (
    1,
    'Bạn là "Tiểu Tướng", trợ lý học lịch sử thời Trần (ba lần kháng chiến chống Nguyên – Mông 1258, 1285, 1287–1288) cho học sinh THCS. '
    'Chỉ trả lời dựa trên các đoạn TƯ LIỆU được cung cấp; không tự bịa số liệu, ngày tháng hay tên người. '
    'Nếu tư liệu không đủ để trả lời, hãy nói rõ là chưa có trong tư liệu và gợi ý em hỏi giáo viên. '
    'Viết tiếng Việt, câu ngắn gọn, thân thiện, dễ hiểu với học sinh 12–15 tuổi; gạch đầu dòng khi liệt kê. '
    'Khi dùng ý của một đoạn tư liệu, ghi số của đoạn đó trong ngoặc vuông, ví dụ [1]. '
    'Từ chối lịch sự mọi câu hỏi ngoài phạm vi lịch sử thời Trần hoặc không phù hợp lứa tuổi.',
    'Tiểu Tướng chỉ trả lời các câu hỏi về lịch sử thời Trần và ba lần kháng chiến chống Nguyên – Mông có trong tư liệu của lớp học. Em thử hỏi về một nhân vật, trận đánh hoặc sự kiện cụ thể nhé!'
);

-- Hạn mức riêng cho từng trường (ghi đè mặc định ở trên)
CREATE TABLE public.hk_ai_school_limits (
    school_id INTEGER PRIMARY KEY REFERENCES public.app_schools(id) ON DELETE CASCADE,
    daily_per_user INTEGER CHECK (daily_per_user IS NULL OR daily_per_user BETWEEN 1 AND 500),
    daily_per_school INTEGER CHECK (daily_per_school IS NULL OR daily_per_school BETWEEN 1 AND 100000),
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------ tài liệu tải lên và các đoạn đã lập chỉ mục
CREATE TABLE public.hk_ai_docs (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 200),
    filename TEXT CHECK (filename IS NULL OR length(filename) <= 200),
    file_kind TEXT NOT NULL CHECK (file_kind IN ('pdf', 'docx', 'txt', 'text')),
    char_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'indexed' CHECK (status IN ('indexed', 'error', 'disabled')),
    error TEXT CHECK (error IS NULL OR length(error) <= 500),
    uploaded_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.hk_ai_chunks (
    id BIGSERIAL PRIMARY KEY,
    source_kind TEXT NOT NULL CHECK (source_kind IN ('campaign', 'place', 'figure', 'event', 'battle', 'source', 'term', 'lesson', 'doc')),
    source_id INTEGER NOT NULL,
    chunk_no INTEGER NOT NULL CHECK (chunk_no >= 0),
    title TEXT NOT NULL CHECK (length(title) <= 240),
    content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 4000),
    content_hash TEXT NOT NULL,
    embedding REAL[],
    embed_model TEXT,
    embedded_at TIMESTAMPTZ,
    indexed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source_kind, source_id, chunk_no)
);
CREATE INDEX hk_ai_chunks_source_idx ON public.hk_ai_chunks (source_kind, source_id);

-- ------------------------------------------------------------------ hội thoại, tin nhắn, báo cáo
CREATE TABLE public.hk_ai_conversations (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (length(title) <= 160),
    mode TEXT NOT NULL DEFAULT 'tutor' CHECK (mode IN ('tutor', 'roleplay', 'teacher', 'explain', 'summary', 'questions', 'plan')),
    figure_id INTEGER REFERENCES public.hist_figures(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- học sinh "xóa" thì ẩn khỏi danh sách của em; bản ghi ẩn danh còn lại để quản trị kiểm tra báo cáo sai
    deleted_at TIMESTAMPTZ
);
CREATE INDEX hk_ai_conversations_user_idx ON public.hk_ai_conversations (user_id, updated_at DESC);

CREATE TABLE public.hk_ai_messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES public.hk_ai_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL CHECK (length(content) <= 8000),
    citations JSONB NOT NULL DEFAULT '[]'::jsonb,
    followups JSONB NOT NULL DEFAULT '[]'::jsonb,
    refused BOOLEAN NOT NULL DEFAULT false,
    refusal_reason TEXT CHECK (refusal_reason IS NULL OR refusal_reason IN ('out_of_scope', 'unsafe', 'quota', 'not_configured')),
    -- 'llm': mô hình sinh văn bản; 'extractive': trích nguyên văn tư liệu khi chưa nối mô hình
    answer_mode TEXT CHECK (answer_mode IS NULL OR answer_mode IN ('llm', 'extractive')),
    model TEXT,
    tokens_in INTEGER NOT NULL DEFAULT 0,
    tokens_out INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    top_score NUMERIC(5, 3),
    admin_label TEXT CHECK (admin_label IS NULL OR admin_label IN ('correct', 'incorrect')),
    admin_note TEXT CHECK (admin_note IS NULL OR length(admin_note) <= 500),
    labeled_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    labeled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hk_ai_messages_conv_idx ON public.hk_ai_messages (conversation_id, id);
CREATE INDEX hk_ai_messages_created_idx ON public.hk_ai_messages (created_at);

CREATE TABLE public.hk_ai_reports (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES public.hk_ai_messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 500),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
    resolution TEXT CHECK (resolution IS NULL OR length(resolution) <= 500),
    handled_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    handled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (message_id, user_id)
);
CREATE INDEX hk_ai_reports_status_idx ON public.hk_ai_reports (status, created_at DESC);

ALTER TABLE public.hk_ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_ai_school_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_ai_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_ai_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_ai_reports ENABLE ROW LEVEL SECURITY;
