-- HK Sprint 5 theo ver0.2 (HK.HS.117–125, HK.AD.080): lộ trình học dạng đường đi kiểu Duolingo.
-- Hành trình chia thành các Cửa (chủ đề); mỗi cuộc kháng chiến là một Phần. Thêm bốn loại nút mới: luyện tập, nghe kể chuyện, rương và kiểm tra cuối cửa.
-- Thêm "Binh thư": tài nguyên học tập dùng nâng cấp thẻ tướng ở Sprint 6 (sổ cái riêng như vàng, mỗi khoản thưởng chỉ được ghi một lần).
-- Chỉ backend (chủ bảng) đọc/ghi; bảng mới bật RLS, không cấp quyền cho vai trò theo trường hay công khai. Nội dung khởi tạo (bản nháp) nằm ở migration kế tiếp.

-- ------------------------------------------------------------------ Cửa của hành trình (HK.AD.080)
CREATE TABLE public.hk_gates (
    id SERIAL PRIMARY KEY,
    journey_id INTEGER NOT NULL REFERENCES public.hk_journeys(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position >= 1),
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 120),
    summary TEXT CHECK (summary IS NULL OR length(summary) <= 400),
    -- Ghi chú thêm của biên soạn hiện cuối Cẩm nang; phần còn lại của Cẩm nang tự tạo từ kho dữ liệu lịch sử (HK.HS.123)
    guide_note TEXT CHECK (guide_note IS NULL OR length(guide_note) <= 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (journey_id, position) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX hk_gates_journey_idx ON public.hk_gates (journey_id, position);

-- Nút: thuộc một Cửa; nút nghe kể chuyện có âm thanh (đường dẫn https) và/hoặc lời kể làm phụ đề; rương và nút khác có thể thưởng Binh thư
-- (NULL = dùng mức mặc định theo loại nút trong cấu hình trò chơi hóa)
ALTER TABLE public.hk_nodes
    ADD COLUMN gate_id INTEGER REFERENCES public.hk_gates(id) ON DELETE SET NULL,
    ADD COLUMN audio_url TEXT CHECK (audio_url IS NULL OR (audio_url ~ '^https://' AND length(audio_url) <= 500)),
    ADD COLUMN transcript TEXT CHECK (transcript IS NULL OR length(transcript) <= 4000),
    ADD COLUMN reward_binh_thu INTEGER CHECK (reward_binh_thu IS NULL OR reward_binh_thu BETWEEN 0 AND 1000);
CREATE INDEX hk_nodes_gate_idx ON public.hk_nodes (gate_id) WHERE gate_id IS NOT NULL;

-- Luyện tập, rương: không cần nội dung đi kèm. Kiểm tra cuối cửa: có bộ câu hỏi riêng hoặc tự lấy câu hỏi từ các nút trong cửa.
-- Nghe kể chuyện: cần âm thanh hoặc lời kể; bộ câu hỏi (nếu có) hỏi về nội dung vừa nghe.
ALTER TABLE public.hk_nodes DROP CONSTRAINT IF EXISTS hk_nodes_kind_check;
ALTER TABLE public.hk_nodes DROP CONSTRAINT IF EXISTS hk_nodes_check;
ALTER TABLE public.hk_nodes ADD CONSTRAINT hk_nodes_kind_check CHECK (kind IN ('lesson', 'quiz', 'battle', 'source', 'final', 'practice', 'listen', 'chest', 'gate_test'));
ALTER TABLE public.hk_nodes ADD CONSTRAINT hk_nodes_content_check CHECK (
    (kind = 'lesson' AND lesson_id IS NOT NULL) OR (kind = 'quiz' AND quiz_id IS NOT NULL) OR
    (kind = 'battle' AND battle_id IS NOT NULL) OR (kind = 'source' AND source_id IS NOT NULL) OR
    (kind = 'final' AND quiz_id IS NOT NULL) OR kind IN ('practice', 'chest', 'gate_test') OR
    (kind = 'listen' AND (transcript IS NOT NULL OR audio_url IS NOT NULL))
);

-- ------------------------------------------------------------------ Binh thư
ALTER TABLE public.hk_players ADD COLUMN binh_thu INTEGER NOT NULL DEFAULT 0 CHECK (binh_thu >= 0);

CREATE TABLE public.hk_binh_thu_ledger (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    delta INTEGER NOT NULL CHECK (delta <> 0),
    reason TEXT NOT NULL CHECK (reason IN ('node', 'chest', 'battle', 'upgrade', 'teacher')),
    ref_key TEXT NOT NULL CHECK (length(ref_key) <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, reason, ref_key)
);
CREATE INDEX hk_binh_thu_ledger_user_idx ON public.hk_binh_thu_ledger (user_id, created_at DESC);

ALTER TABLE public.hk_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hk_binh_thu_ledger ENABLE ROW LEVEL SECURITY;
