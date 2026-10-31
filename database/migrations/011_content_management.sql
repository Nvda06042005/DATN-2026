-- TM.SA-CONTENT: quản lý nội dung và cấu hình của quản trị tổng.
-- Chương trình lịch sử, ngân hàng câu hỏi chung, kho sử liệu AI, thẻ danh tướng, luật EXP và lịch sử cập nhật của chúng.
-- Các bảng chỉ truy cập qua kết nối tin cậy của backend: bật RLS, không có policy và không cấp quyền cho dong_a_school_scope,
-- nên quản trị trường, anon và authenticated không đọc hoặc ghi được trực tiếp.

-- ------------------------------------------------------------------ lịch sử cập nhật dùng chung (mỗi lần lưu một ảnh chụp)
CREATE TABLE public.app_content_history (
    id BIGSERIAL PRIMARY KEY,
    entity TEXT NOT NULL CHECK (entity IN ('curriculum', 'question', 'ai_source', 'hero_card', 'exp_rules')),
    entity_id TEXT NOT NULL,
    version INTEGER NOT NULL CHECK (version > 0),
    action TEXT NOT NULL,
    snapshot JSONB NOT NULL,
    actor_id INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    actor_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX app_content_history_entity_idx ON public.app_content_history (entity, entity_id, id DESC);
CREATE INDEX app_content_history_time_idx ON public.app_content_history (created_at DESC, id DESC);

-- ------------------------------------------------------------------ chương trình: cuộc kháng chiến > chương > bài > ải > trận đánh
CREATE TABLE public.app_curriculum_nodes (
    id SERIAL PRIMARY KEY,
    parent_id INTEGER REFERENCES public.app_curriculum_nodes(id) ON DELETE RESTRICT,
    kind TEXT NOT NULL CHECK (kind IN ('campaign', 'chapter', 'lesson', 'stage', 'battle')),
    code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Za-z0-9_.-]{2,40}$'),
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 160),
    summary TEXT NOT NULL DEFAULT '' CHECK (length(summary) <= 2000),
    period TEXT CHECK (period IS NULL OR length(period) <= 60),
    sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((kind = 'campaign') = (parent_id IS NULL)),
    CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE INDEX app_curriculum_parent_idx ON public.app_curriculum_nodes (parent_id, sort_order, id);

-- ------------------------------------------------------------------ ngân hàng câu hỏi dùng chung: lớp chỉnh sửa chồng lên ngân hàng gốc trong ai/data/game_content.json
-- origin 'file': ghi đè hoặc ẩn một câu gốc; origin 'admin': câu do quản trị tạo. Câu gốc chưa chỉnh sửa không có dòng ở đây.
CREATE TABLE public.app_question_bank (
    id TEXT PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_.-]{3,60}$'),
    origin TEXT NOT NULL CHECK (origin IN ('file', 'admin')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'hidden')),
    payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND payload->>'id' = id),
    review_note TEXT CHECK (review_note IS NULL OR length(review_note) <= 300),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX app_question_bank_status_idx ON public.app_question_bank (status, updated_at DESC);

-- ------------------------------------------------------------------ kho sử liệu AI: tư liệu phải được duyệt trước khi dùng để tìm kiếm
CREATE TABLE public.app_ai_sources (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
    citation TEXT NOT NULL CHECK (length(btrim(citation)) BETWEEN 3 AND 500),
    kind TEXT NOT NULL DEFAULT 'chinh_su' CHECK (kind IN ('chinh_su', 'giai_thoai', 'tham_khao')),
    unit_id TEXT CHECK (unit_id IS NULL OR length(unit_id) <= 80),
    file_name TEXT CHECK (file_name IS NULL OR length(file_name) <= 200),
    content TEXT NOT NULL CHECK (length(content) BETWEEN 20 AND 200000),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
    review_note TEXT CHECK (review_note IS NULL OR length(review_note) <= 300),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    uploaded_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    reviewed_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX app_ai_sources_status_idx ON public.app_ai_sources (status, created_at DESC);

-- ------------------------------------------------------------------ danh mục thẻ danh tướng (độ hiếm và loại nội dung dùng cùng mã với game)
CREATE TABLE public.app_hero_cards (
    code TEXT PRIMARY KEY CHECK (code ~ '^[a-z0-9_]{3,40}$'),
    name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 80),
    title TEXT CHECK (title IS NULL OR length(title) <= 120),
    role TEXT CHECK (role IS NULL OR length(role) <= 40),
    rarity TEXT NOT NULL CHECK (rarity IN ('hiem', 'su_thi', 'huyen_thoai', 'tiet_che')),
    kind TEXT NOT NULL CHECK (kind IN ('chinh_su', 'giai_thoai', 'sang_tao', 'dan_gian')),
    summary TEXT NOT NULL DEFAULT '' CHECK (length(summary) <= 1500),
    source TEXT NOT NULL CHECK (length(btrim(source)) BETWEEN 3 AND 500),
    unlock_condition TEXT NOT NULL CHECK (length(btrim(unlock_condition)) BETWEEN 3 AND 300),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    updated_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX app_hero_cards_status_idx ON public.app_hero_cards (status, sort_order, code);

-- ------------------------------------------------------------------ luật EXP, cấp bậc, huy hiệu: mỗi lần đổi là một phiên bản mới; không tính lại kết quả đã ghi nhận
CREATE TABLE public.app_exp_rules (
    version INTEGER PRIMARY KEY CHECK (version > 0),
    config JSONB NOT NULL CHECK (jsonb_typeof(config) = 'object'),
    is_active BOOLEAN NOT NULL DEFAULT false,
    note TEXT CHECK (note IS NULL OR length(note) <= 300),
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX app_exp_rules_active_idx ON public.app_exp_rules (is_active) WHERE is_active;

ALTER TABLE public.app_content_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_curriculum_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_ai_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_hero_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_exp_rules ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------ dữ liệu gốc (sinh từ nội dung game hiện có, không thêm tên người dùng hay tài khoản thật)
-- Chương trình hiện có của game: 3 cuộc kháng chiến và 9 ải (tên, thời gian, diễn biến lấy từ PHASE_REAL/CAMPAIGNS trong frontend/constants/campaigns.ts).
INSERT INTO public.app_curriculum_nodes (kind, code, title, summary, period, sort_order, status, parent_id) VALUES
    ('campaign', 'KC1', 'Kháng chiến lần thứ nhất', 'Từ Bình Lệ Nguyên đến Đông Bộ Đầu', '1258', 1, 'published', NULL),
    ('campaign', 'KC2', 'Kháng chiến lần thứ hai', 'Phá gọng kìm 50 vạn quân', '1285', 2, 'published', NULL),
    ('campaign', 'KC3', 'Kháng chiến lần thứ ba', 'Vân Đồn và Bạch Đằng', '1287 – 1288', 3, 'published', NULL);
INSERT INTO public.app_curriculum_nodes (kind, code, title, summary, period, sort_order, status, parent_id) VALUES
    ('stage', 'KC1.A1', 'Bình Lệ Nguyên', 'Vua Trần Thái Tông thân chinh chỉ huy quân Đại Việt đón đánh quân Mông Cổ của Ngột Lương Hợp Thai. Quân Mông Cổ bắn tên vào mắt voi trận, voi hoảng sợ quay lại dày xéo đội hình quân Trần. Quân Trần thất lợi nhưng chủ động rút lui, bảo toàn lực lượng; tướng Lê Tần (tức Lê Phụ Trần) lấy ván thuyền che tên cho vua.', '17/1/1258', 1, 'published', (SELECT id FROM public.app_curriculum_nodes WHERE code = 'KC1')),
    ('stage', 'KC1.A2', 'Rút khỏi Thăng Long, vườn không nhà trống', 'Sau trận Phù Lỗ (18/1), quân Trần lại chủ động rút khỏi Thăng Long, đem đi hết lương thực trong thành. Quân Mông Cổ chiếm kinh đô chỉ sau hai trận nhưng kho tàng trống rỗng, thiếu lương; theo Nguyên sử, chúng chỉ ở lại 9 ngày.', '18 – 28/1/1258', 2, 'published', (SELECT id FROM public.app_curriculum_nodes WHERE code = 'KC1')),
    ('stage', 'KC1.A3', 'Đông Bộ Đầu', 'Nửa đêm, vua Trần Thái Tông cùng Thái tử Trần Hoảng ngự lâu thuyền ngược sông, bất ngờ đánh vào quân Mông Cổ đang chủ quan. Giặc thua to, bỏ Thăng Long tháo chạy về Vân Nam; trên đường rút, chúng bị chủ trại Quy Hóa là Hà Bổng tập kích dữ dội.', 'Đêm 28/1/1258', 3, 'published', (SELECT id FROM public.app_curriculum_nodes WHERE code = 'KC1')),
    ('stage', 'KC2.A1', 'Bãi Đà Mạc: chặn giặc cho triều đình rút', 'Sau trận Thăng Long (17 – 18/2), vua tôi nhà Trần rút theo sông Hồng. Trần Bình Trọng chỉ huy 600 quân Thánh Dực chặn quân Nguyên ở bãi Đà Mạc, kiềm chân mấy nghìn quân địch qua sáu đợt tấn công rồi bị bắt và hy sinh.', 'Tháng 2 – 3/1285', 1, 'published', (SELECT id FROM public.app_curriculum_nodes WHERE code = 'KC2')),
    ('stage', 'KC2.A2', 'Hàm Tử – Chương Dương', 'Quân Trần tổng phản công: Trần Nhật Duật đánh bại quân Nguyên ở Hàm Tử; Trần Quang Khải cùng Phạm Ngũ Lão và Trần Quốc Toản đánh tan quân Nguyên ở Chương Dương, đốt cháy hoặc chiếm phần lớn chiến thuyền địch, rồi giải phóng Thăng Long.', 'Tháng 5 – 6/1285', 2, 'published', (SELECT id FROM public.app_curriculum_nodes WHERE code = 'KC2')),
    ('stage', 'KC2.A3', 'Tây Kết và đường rút chạy của Thoát Hoan', 'Quân Nguyên rút chạy về phía Vạn Kiếp, bị chặn đánh ở sông Như Nguyệt, sông Sách và Vĩnh Bình; tương truyền quân Nguyên phải giấu Thoát Hoan trong ống đồng để chạy trốn. Ngày 24/6, quân Trần đánh tan đạo quân của Toa Đô ở Tây Kết, Toa Đô tử trận.', '10 – 24/6/1285', 3, 'published', (SELECT id FROM public.app_curriculum_nodes WHERE code = 'KC2')),
    ('stage', 'KC3.A1', 'Vân Đồn: tiêu diệt đoàn thuyền lương', 'Thủy quân Ô Mã Nhi đi trước, đoàn thuyền lương của Trương Văn Hổ theo sau thì bị Trần Khánh Dư tập kích ở Vân Đồn và nhanh chóng bị tiêu diệt. Văn Hổ đổ thóc xuống biển rồi bỏ chạy; các đoàn lương khác gặp bão hoặc đi lạc. Quân Nguyên mất nguồn lương: đây là bước ngoặt của cuộc chiến.', 'Cuối 12/1287 – đầu 1/1288', 1, 'published', (SELECT id FROM public.app_curriculum_nodes WHERE code = 'KC3')),
    ('stage', 'KC3.A2', 'Bạch Đằng: trận địa cọc ngầm', 'Thoát Hoan rút quân vì thiếu lương; thủy quân Ô Mã Nhi bị chặn đánh liên tục rồi phải vào sông Bạch Đằng. Quân Trần bố trí cọc ngầm, cho bộ binh mai phục hai bờ và thủy quân ẩn trong các nhánh sông; thuyền Nguyên đuổi đánh đội thuyền giả thua, va phải cọc, nước triều rút làm nhiều thuyền hư hại thêm.', 'Sáng 9/4/1288', 2, 'published', (SELECT id FROM public.app_curriculum_nodes WHERE code = 'KC3')),
    ('stage', 'KC3.A3', 'Bắt Ô Mã Nhi, diệt thủy quân Nguyên', 'Quân Trần từ các nhánh sông và hai bờ đổ ra đánh; đến chiều toàn bộ cánh quân thủy của Nguyên bị tiêu diệt, Đỗ Hành bắt được Ô Mã Nhi. Bộ binh của Thoát Hoan rút theo đường Lạng Sơn, bị phục kích ở Nội Bàng; đến 19/4 mới thoát khỏi biên giới về Tư Minh.', 'Chiều 9/4/1288', 3, 'published', (SELECT id FROM public.app_curriculum_nodes WHERE code = 'KC3'));
INSERT INTO public.app_content_history (entity, entity_id, version, action, snapshot, actor_name)
SELECT 'curriculum', id::text, 1, 'seed', to_jsonb(n), 'Hệ thống (migration 011)' FROM public.app_curriculum_nodes n;

-- Thẻ danh tướng hiện có trong game (frontend/constants/heroes.ts); độ hiếm = tier, loại nội dung = lore, nguồn = cụm tri thức của kho Đông A.
INSERT INTO public.app_hero_cards (code, name, title, role, rarity, kind, summary, source, unlock_condition, status, sort_order) VALUES
    ('tran_thai_tong', 'Trần Thái Tông', 'Vua Trần Thái Tông', 'Chỉ huy', 'huyen_thoai', 'chinh_su', 'Vị vua đầu tiên của nhà Trần. Năm 1258, vua trực tiếp chỉ huy kháng chiến: chặn giặc ở Bình Lệ Nguyên, rút lui bảo toàn lực lượng rồi phản công thắng lợi ở Đông Bộ Đầu.', 'Kho tri thức Đông A – cụm KC1_OVERVIEW, KC1_WHY_INVADE, KC1_DONG_BO_DAU', 'Có sẵn từ đầu', 'published', 1),
    ('tran_thu_do', 'Trần Thủ Độ', 'Thái sư', 'Mưu sĩ', 'su_thi', 'chinh_su', 'Thái sư nhà Trần. Năm 1258, khi vua Trần Thái Tông lo lắng hỏi kế, ông khẳng khái: “Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo!”.', 'Kho tri thức Đông A – cụm KC1_TRAN_THU_DO_QUOTE, KC1_OVERVIEW', 'Có sẵn từ đầu', 'published', 2),
    ('le_phu_tran', 'Lê Phụ Trần', 'Tướng Lê Tần', 'Hộ vệ', 'hiem', 'chinh_su', 'Tại trận Bình Lệ Nguyên (1/1258), ông lấy ván thuyền che tên cho vua Trần Thái Tông và khuyên vua rút lui để bảo toàn lực lượng.', 'Kho tri thức Đông A – cụm KC1_BINH_LE_NGUYEN', 'Có sẵn từ đầu', 'published', 3),
    ('thanh_duc', 'Quân Thánh Dực', 'Cấm quân nhà Trần', 'Bộ binh', 'hiem', 'chinh_su', 'Một đơn vị cấm quân bảo vệ kinh thành Thăng Long thời Trần – lực lượng nòng cốt trong các cuộc kháng chiến.', 'Kho tri thức Đông A – cụm ALL_3_WARS_SUMMARY, CAUSES_OF_VICTORY', 'Có sẵn từ đầu', 'published', 4),
    ('tran_nhan_tong', 'Trần Nhân Tông', 'Vua Trần Nhân Tông', 'Chỉ huy', 'huyen_thoai', 'chinh_su', 'Sinh cuối năm 1258, sau kháng chiến lần thứ nhất. Lên ngôi năm 1278, triệu tập Hội nghị Bình Than (1282), cùng Thượng hoàng Trần Thánh Tông lãnh đạo hai cuộc kháng chiến chống quân Nguyên. Năm 1299 xuất gia ở Yên Tử, sáng lập Thiền phái Trúc Lâm.', 'Kho tri thức Đông A – cụm GAME_TRAN_NHAN_TONG, BINH_THAN_CONFERENCE', 'Gia nhập khi hoàn thành Màn 1 (Hội nghị Bình Than)', 'published', 5),
    ('tran_hung_dao', 'Trần Hưng Đạo', 'Hưng Đạo Đại vương Trần Quốc Tuấn', 'Tổng chỉ huy', 'tiet_che', 'chinh_su', 'Quốc công Tiết chế – tổng chỉ huy quân đội trong hai lần kháng chiến 1285 và 1287 – 1288; tác giả Hịch tướng sĩ và Binh thư yếu lược; chỉ huy đại thắng Bạch Đằng năm 1288.', 'Kho tri thức Đông A – cụm BINH_THAN_CONFERENCE, HICH_TUONG_SI, KC3_BACH_DANG_HOW', 'Chiêu mộ ở Hội Quán Vạn Kiếp bằng công thức thẻ', 'published', 6),
    ('tran_quang_khai', 'Trần Quang Khải', 'Thượng tướng Thái sư', 'Xung phong', 'huyen_thoai', 'chinh_su', 'Thượng tướng Thái sư nhà Trần, chỉ huy trận Chương Dương (1285) mở đường giải phóng Thăng Long; tác giả bài thơ “Tụng giá hoàn kinh sư”.', 'Kho tri thức Đông A – cụm KC2_OVERVIEW, KC2_HAM_TU_CHUONG_DUONG', 'Gia nhập khi hoàn thành Màn 1 (Hội nghị Bình Than)', 'published', 7),
    ('tran_binh_trong', 'Trần Bình Trọng', 'Bảo Nghĩa vương', 'Hộ vệ', 'su_thi', 'chinh_su', 'Năm 1285, ông chặn đánh quân Nguyên để hai vua Trần rút lui an toàn. Bị bắt và dụ hàng, ông khẳng khái: “Ta thà làm quỷ nước Nam, chứ không thèm làm vương đất Bắc!” rồi anh dũng hy sinh.', 'Kho tri thức Đông A – cụm KC2_TRAN_BINH_TRONG', 'Gia nhập khi hoàn thành Màn 1 (Hội nghị Bình Than)', 'published', 8),
    ('tran_nhat_duat', 'Trần Nhật Duật', 'Chiêu Văn vương', 'Chiến lược', 'su_thi', 'chinh_su', 'Chiêu Văn vương Trần Nhật Duật chỉ huy trận thắng lớn ở Hàm Tử trong cuộc tổng phản công năm 1285.', 'Kho tri thức Đông A – cụm KC2_OVERVIEW, KC2_HAM_TU_CHUONG_DUONG', 'Gia nhập khi hoàn thành Màn 1 (Hội nghị Bình Than)', 'published', 9),
    ('tran_quoc_toan', 'Trần Quốc Toản', 'Hoài Văn hầu', 'Xung phong', 'su_thi', 'chinh_su', 'Thiếu niên anh hùng của hoàng tộc nhà Trần. Không được dự Hội nghị Bình Than vì còn nhỏ tuổi, ông bóp nát quả cam vua ban, rồi về chiêu mộ hơn 1.000 gia nô, thân tộc dưới lá cờ “Phá cường địch, báo hoàng ân”.', 'Kho tri thức Đông A – cụm TQT_WHY_ORANGE, TQT_SIX_GOLDEN_WORDS, TQT_OVERVIEW', 'Chiêu mộ ở Hội Quán Vạn Kiếp bằng công thức thẻ', 'published', 10),
    ('tran_khanh_du', 'Trần Khánh Dư', 'Nhân Huệ vương', 'Phục kích', 'huyen_thoai', 'chinh_su', 'Từng bị tước quan tước, về Chí Linh sống bằng nghề buôn than. Năm 1282 được tha tội để lập công. Trong kháng chiến lần thứ ba, ông phục kích ở Vân Đồn, đánh đắm và thu giữ đoàn thuyền lương của Trương Văn Hổ.', 'Kho tri thức Đông A – cụm GAME_TRAN_KHANH_DU, KC3_VAN_DON', 'Chiêu mộ ở Hội Quán Vạn Kiếp bằng công thức thẻ', 'published', 11),
    ('yet_kieu', 'Yết Kiêu', 'Gia tướng của Trần Hưng Đạo', 'Đặc nhiệm', 'hiem', 'giai_thoai', 'Gia tướng trung thành của Trần Hưng Đạo, giỏi bơi lặn. Theo truyền thuyết, ông lặn xuống đục thủng thuyền giặc và trung kiên giữ thuyền chờ chủ tướng ở bãi Tân Hưng.', 'Kho tri thức Đông A – cụm YET_KIEU_DA_TUONG', 'Chiêu mộ ở Hội Quán Vạn Kiếp bằng công thức thẻ', 'published', 12),
    ('pham_ngu_lao', 'Phạm Ngũ Lão', 'Danh tướng nhà Trần', 'Xung phong', 'su_thi', 'giai_thoai', 'Ngồi đan sọt bên đường, mải nghĩ việc nước đến mức bị giáo đâm vào đùi cũng không hay. Được Trần Hưng Đạo trọng dụng, ông lập công lớn ở Vạn Kiếp, Bạch Đằng.', 'Kho tri thức Đông A – cụm PHAM_NGU_LAO', 'Chiêu mộ ở Hội Quán Vạn Kiếp bằng công thức thẻ', 'published', 13),
    ('quan_sat_that', 'Quân Sát Thát', 'Dân binh thích chữ Sát Thát', 'Bộ binh', 'hiem', 'chinh_su', 'Hưởng ứng Hịch tướng sĩ, quân sĩ nhà Trần tự nguyện thích hai chữ “Sát Thát” (giết giặc Mông Cổ) lên cánh tay, thề sống chết với non sông.', 'Kho tri thức Đông A – cụm HICH_TUONG_SI, KC2_OVERVIEW', 'Chiêu mộ ở Hội Quán Vạn Kiếp bằng công thức thẻ', 'published', 14);
INSERT INTO public.app_content_history (entity, entity_id, version, action, snapshot, actor_name)
SELECT 'hero_card', code, 1, 'seed', to_jsonb(h), 'Hệ thống (migration 011)' FROM public.app_hero_cards h;

-- Luật EXP phiên bản 1: đúng giá trị đang dùng (10/2 XP, 10/15 Ấn Tín, trần 300/ngày, mốc cấp theo (cấp − 1)² × 40).
INSERT INTO public.app_exp_rules (version, config, is_active, note) VALUES (1, '{"xp_correct":10,"xp_wrong":2,"gems_correct":10,"gems_weak":15,"daily_gem_cap":300,"weak_threshold":0.6,"levels":[{"level":1,"name":"Cấp 1","min_xp":0},{"level":2,"name":"Cấp 2","min_xp":40},{"level":3,"name":"Cấp 3","min_xp":160},{"level":4,"name":"Cấp 4","min_xp":360},{"level":5,"name":"Cấp 5","min_xp":640},{"level":6,"name":"Cấp 6","min_xp":1000},{"level":7,"name":"Cấp 7","min_xp":1440},{"level":8,"name":"Cấp 8","min_xp":1960},{"level":9,"name":"Cấp 9","min_xp":2560},{"level":10,"name":"Cấp 10","min_xp":3240}],"badges":[]}'::jsonb, true, 'Giá trị đang dùng trước khi có trang cấu hình');
INSERT INTO public.app_content_history (entity, entity_id, version, action, snapshot, actor_name)
SELECT 'exp_rules', version::text, 1, 'seed', config, 'Hệ thống (migration 011)' FROM public.app_exp_rules WHERE version = 1;
