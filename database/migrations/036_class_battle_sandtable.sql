-- HK ver0.2 Sprint 7 (phần còn lại): luật lớp có bật / tắt game trận đánh và giới hạn thời gian chơi mỗi ngày (HK.GV.060),
-- gắn cửa học với trận đánh trên bản đồ hành quân của lớp (HK.GV.083), Sa bàn 3D trận đánh (HK.HS.137, HK.GV.084).
-- Bảng mới chỉ backend (chủ bảng) đọc/ghi và bật RLS. Dữ liệu sa bàn là sơ đồ minh họa viết lại từ tóm tắt trận đã có, thuộc màn chơi nháp
-- nên học sinh chưa thấy cho tới khi quản trị tổng phát hành màn chơi sau khi giáo viên lịch sử kiểm chứng.

-- ------------------------------------------------------------------ luật lớp (HK.GV.060)
-- war_enabled: giáo viên tắt game trận đánh cho lớp; war_minutes: số phút tối đa mỗi ngày (NULL = theo cấu hình của trường và hệ thống). Cấp nào chặt hơn thì thắng
ALTER TABLE public.hk_class_settings
    ADD COLUMN war_enabled BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN war_minutes SMALLINT CHECK (war_minutes IS NULL OR war_minutes BETWEEN 5 AND 240);

-- ------------------------------------------------------------------ gắn cửa học với trận đánh của lớp (HK.GV.083)
-- gate_id: học sinh của lớp phải hoàn thành cửa này mới ra trận (NULL = không đòi hỏi); difficulty: độ khó thay cho độ khó gốc của màn (NULL = giữ nguyên);
-- skill_questions: false thì tuyệt kỹ phát huy đủ mà không cần trả lời câu hỏi
CREATE TABLE public.hk_class_battle_links (
    id SERIAL PRIMARY KEY,
    class_id INTEGER NOT NULL REFERENCES public.app_classes(id) ON DELETE CASCADE,
    stage_id INTEGER NOT NULL REFERENCES public.hk_stages(id) ON DELETE CASCADE,
    gate_id INTEGER REFERENCES public.hk_gates(id) ON DELETE SET NULL,
    difficulty SMALLINT CHECK (difficulty IS NULL OR difficulty BETWEEN 1 AND 3),
    skill_questions BOOLEAN NOT NULL DEFAULT true,
    created_by INTEGER REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (class_id, stage_id)
);
CREATE INDEX hk_class_battle_links_stage_idx ON public.hk_class_battle_links (stage_id);
ALTER TABLE public.hk_class_battle_links ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------ Sa bàn 3D (HK.HS.137, HK.GV.084)
-- {note, size:[rộng, sâu], hills:[{x,y,r,h,name}], rivers:[{name,points,width}], sea:[{x,y,w,h}], markers:[{id,kind,label,x,y}],
--  armies:[{id,side,label,kind,start}], steps:[{label,text,moves:[{army,to,mode}]}]}; tọa độ 0–100 (ngang) và 0–60 (sâu), phía trên là hướng bắc
ALTER TABLE public.hk_stages ADD COLUMN sandtable JSONB CHECK (sandtable IS NULL OR jsonb_typeof(sandtable) = 'object');

UPDATE public.hk_stages s SET sandtable = v.scene::jsonb
FROM public.hist_battles b, (VALUES
    ('dong-bo-dau', $j${
        "note": "Sơ đồ minh họa, không theo tỷ lệ và không phải bản đồ thật; vị trí chỉ để theo dõi hướng tiến – rút. Cần giáo viên lịch sử kiểm chứng trước khi dùng chính thức.",
        "size": [100, 60],
        "hills": [{"x": 14, "y": 10, "r": 12, "h": 5, "name": "Vùng đồi phía bắc"}, {"x": 88, "y": 48, "r": 10, "h": 3}],
        "rivers": [{"name": "Sông Hồng", "points": [[64, 0], [62, 18], [66, 36], [62, 60]], "width": 8}],
        "sea": [],
        "markers": [{"id": "city", "kind": "city", "label": "Kinh thành Thăng Long", "x": 42, "y": 30}, {"id": "wharf", "kind": "dock", "label": "Bến Đông Bộ Đầu", "x": 62, "y": 30}],
        "armies": [
            {"id": "nguyen", "side": "nguyen", "label": "Quân Mông Cổ", "kind": "cavalry", "start": [42, 30]},
            {"id": "tran", "side": "tran", "label": "Quân Trần", "kind": "foot", "start": [80, 30]}
        ],
        "steps": [
            {"label": "Quân Mông Cổ vào kinh thành", "text": "Quân Mông Cổ vào Thăng Long, thấy kinh thành trống không, thiếu lương và mệt mỏi.", "moves": [{"army": "nguyen", "to": [42, 30], "mode": "hold"}, {"army": "tran", "to": [84, 40], "mode": "retreat"}]},
            {"label": "Quân Trần chuẩn bị phản công", "text": "Quân Trần bảo toàn lực lượng rồi tiến tới bến sông để phản công.", "moves": [{"army": "tran", "to": [66, 31], "mode": "advance"}]},
            {"label": "Phản công ở Đông Bộ Đầu", "text": "Quân Trần đánh vào quân Mông Cổ; quân Mông Cổ bị đánh bại và rút khỏi kinh thành.", "moves": [{"army": "tran", "to": [56, 30], "mode": "advance"}, {"army": "nguyen", "to": [30, 6], "mode": "retreat"}]}
        ]
    }$j$),
    ('ham-tu', $j${
        "note": "Sơ đồ minh họa, không theo tỷ lệ và không phải bản đồ thật. Cần giáo viên lịch sử kiểm chứng trước khi dùng chính thức.",
        "size": [100, 60],
        "hills": [{"x": 20, "y": 48, "r": 12, "h": 4}, {"x": 86, "y": 12, "r": 10, "h": 4}],
        "rivers": [{"name": "Dòng sông", "points": [[0, 28], [30, 32], [60, 26], [100, 30]], "width": 9}],
        "sea": [],
        "markers": [{"id": "ham-tu", "kind": "fort", "label": "Hàm Tử", "x": 62, "y": 22}],
        "armies": [
            {"id": "nguyen", "side": "nguyen", "label": "Cánh quân của Toa Đô", "kind": "fleet", "start": [10, 30]},
            {"id": "tran", "side": "tran", "label": "Quân Trần", "kind": "foot", "start": [70, 12]}
        ],
        "steps": [
            {"label": "Cánh quân Toa Đô tiến lên", "text": "Thuyền chiến và bộ binh của Toa Đô tiến dọc theo sông.", "moves": [{"army": "nguyen", "to": [50, 29], "mode": "advance"}]},
            {"label": "Quân Trần phản công", "text": "Tháng 6 năm 1285, quân Trần phản công thắng lớn ở Hàm Tử.", "moves": [{"army": "tran", "to": [58, 25], "mode": "advance"}]},
            {"label": "Cánh quân bị đánh tan", "text": "Cánh quân của Toa Đô bị đánh tan.", "moves": [{"army": "nguyen", "to": [12, 30], "mode": "retreat"}, {"army": "tran", "to": [56, 28], "mode": "hold"}]}
        ]
    }$j$),
    ('chuong-duong', $j${
        "note": "Sơ đồ minh họa, không theo tỷ lệ và không phải bản đồ thật. Cần giáo viên lịch sử kiểm chứng trước khi dùng chính thức.",
        "size": [100, 60],
        "hills": [{"x": 16, "y": 50, "r": 13, "h": 4}, {"x": 90, "y": 8, "r": 9, "h": 3}],
        "rivers": [{"name": "Sông Hồng", "points": [[50, 0], [54, 20], [48, 40], [52, 60]], "width": 10}],
        "sea": [],
        "markers": [{"id": "chuong-duong", "kind": "dock", "label": "Bến Chương Dương", "x": 52, "y": 30}, {"id": "city", "kind": "city", "label": "Thăng Long", "x": 30, "y": 8}],
        "armies": [
            {"id": "nguyen", "side": "nguyen", "label": "Quân Nguyên", "kind": "foot", "start": [36, 30]},
            {"id": "tran", "side": "tran", "label": "Quân Trần", "kind": "foot", "start": [86, 34]}
        ],
        "steps": [
            {"label": "Quân Nguyên giữ bến sông", "text": "Bộ binh và thủy quân Nguyên đóng ở bến sông Chương Dương.", "moves": [{"army": "nguyen", "to": [44, 30], "mode": "hold"}]},
            {"label": "Quân Trần tổng phản công", "text": "Tháng 6 năm 1285, quân Trần tổng phản công vượt sông.", "moves": [{"army": "tran", "to": [58, 31], "mode": "advance"}]},
            {"label": "Mở đường về Thăng Long", "text": "Quân Trần thắng lớn ở Chương Dương, mở đường giải phóng Thăng Long.", "moves": [{"army": "nguyen", "to": [28, 12], "mode": "retreat"}, {"army": "tran", "to": [46, 30], "mode": "advance"}]}
        ]
    }$j$),
    ('tay-ket', $j${
        "note": "Sơ đồ minh họa, không theo tỷ lệ và không phải bản đồ thật. Cần giáo viên lịch sử kiểm chứng trước khi dùng chính thức.",
        "size": [100, 60],
        "hills": [{"x": 12, "y": 14, "r": 11, "h": 4}, {"x": 84, "y": 50, "r": 12, "h": 4}],
        "rivers": [{"name": "Dòng sông", "points": [[100, 10], [70, 22], [40, 26], [0, 38]], "width": 8}],
        "sea": [],
        "markers": [{"id": "tay-ket", "kind": "fort", "label": "Tây Kết", "x": 48, "y": 24}],
        "armies": [
            {"id": "nguyen", "side": "nguyen", "label": "Quân của Toa Đô", "kind": "foot", "start": [20, 34]},
            {"id": "tran", "side": "tran", "label": "Quân Trần", "kind": "foot", "start": [86, 14]}
        ],
        "steps": [
            {"label": "Quân Toa Đô hành quân", "text": "Mùa hè năm 1285, quân của Toa Đô hành quân dọc theo sông.", "moves": [{"army": "nguyen", "to": [42, 28], "mode": "advance"}]},
            {"label": "Quân Trần đón đánh", "text": "Quân Trần đánh vào đội hình của Toa Đô ở Tây Kết.", "moves": [{"army": "tran", "to": [54, 22], "mode": "advance"}]},
            {"label": "Toa Đô bị đánh bại", "text": "Quân Toa Đô bị đánh bại ở Tây Kết.", "moves": [{"army": "nguyen", "to": [14, 38], "mode": "retreat"}, {"army": "tran", "to": [48, 25], "mode": "hold"}]}
        ]
    }$j$),
    ('van-don', $j${
        "note": "Sơ đồ minh họa, không theo tỷ lệ và không phải bản đồ thật. Cần giáo viên lịch sử kiểm chứng trước khi dùng chính thức.",
        "size": [100, 60],
        "hills": [{"x": 30, "y": 36, "r": 8, "h": 5, "name": "Đảo"}, {"x": 52, "y": 44, "r": 7, "h": 4, "name": "Đảo"}, {"x": 72, "y": 34, "r": 9, "h": 5, "name": "Đảo"}, {"x": 6, "y": 6, "r": 12, "h": 3}],
        "rivers": [],
        "sea": [{"x": 0, "y": 18, "w": 100, "h": 42}],
        "markers": [{"id": "van-don", "kind": "fort", "label": "Vân Đồn", "x": 52, "y": 34}],
        "armies": [
            {"id": "nguyen", "side": "nguyen", "label": "Thuyền lương của Trương Văn Hổ", "kind": "fleet", "start": [94, 22]},
            {"id": "tran", "side": "tran", "label": "Quân của Trần Khánh Dư", "kind": "fleet", "start": [50, 42]}
        ],
        "steps": [
            {"label": "Thuyền lương đi qua vùng đảo", "text": "Đầu năm 1288, đoàn thuyền lương của quân Nguyên đi qua vùng biển Vân Đồn.", "moves": [{"army": "nguyen", "to": [66, 24], "mode": "advance"}]},
            {"label": "Quân Trần phục kích", "text": "Trần Khánh Dư phục kích đoàn thuyền lương từ phía các đảo.", "moves": [{"army": "tran", "to": [56, 30], "mode": "advance"}]},
            {"label": "Đoàn thuyền lương bị đánh tan", "text": "Đoàn thuyền lương bị đánh tan; quân Nguyên thiếu lương.", "moves": [{"army": "nguyen", "to": [90, 20], "mode": "retreat"}, {"army": "tran", "to": [56, 28], "mode": "hold"}]}
        ]
    }$j$),
    ('bach-dang', $j${
        "note": "Sơ đồ minh họa, không theo tỷ lệ và không phải bản đồ thật. Cần giáo viên lịch sử kiểm chứng trước khi dùng chính thức.",
        "size": [100, 60],
        "hills": [{"x": 16, "y": 8, "r": 13, "h": 6, "name": "Rừng núi hai bờ"}, {"x": 40, "y": 52, "r": 12, "h": 5}, {"x": 74, "y": 8, "r": 10, "h": 5}],
        "rivers": [{"name": "Sông Bạch Đằng", "points": [[8, 20], [30, 26], [50, 30], [70, 36], [92, 46]], "width": 9}],
        "sea": [{"x": 86, "y": 40, "w": 14, "h": 20}],
        "markers": [{"id": "stakes", "kind": "stakes", "label": "Bãi cọc ngầm", "x": 56, "y": 32}],
        "armies": [
            {"id": "nguyen", "side": "nguyen", "label": "Thủy quân Ô Mã Nhi", "kind": "fleet", "start": [92, 46]},
            {"id": "tran", "side": "tran", "label": "Thủy quân nhà Trần", "kind": "fleet", "start": [30, 14]}
        ],
        "steps": [
            {"label": "Nước triều lên, thuyền giặc tiến vào sông", "text": "Tháng 4 năm 1288, Trần Hưng Đạo cho đóng cọc nhọn dưới lòng sông; khi nước triều lên, thuyền giặc tiến vào sông.", "moves": [{"army": "nguyen", "to": [44, 29], "mode": "advance"}]},
            {"label": "Quân Trần nhử địch", "text": "Quân Trần nhử thuyền giặc đi sâu vào khúc sông có bãi cọc.", "moves": [{"army": "tran", "to": [34, 24], "mode": "retreat"}, {"army": "nguyen", "to": [34, 27], "mode": "advance"}]},
            {"label": "Nước rút, bãi cọc lộ ra", "text": "Khi nước triều rút, bãi cọc nhô lên làm thuyền giặc mắc kẹt.", "moves": [{"army": "tran", "to": [40, 26], "mode": "advance"}]},
            {"label": "Quân Trần đánh khi nước rút", "text": "Quân Trần đánh mạnh khi nước rút; thuyền giặc không thoát ra biển được.", "moves": [{"army": "nguyen", "to": [60, 34], "mode": "retreat"}, {"army": "tran", "to": [48, 29], "mode": "advance"}]}
        ]
    }$j$)
) AS v(slug, scene)
WHERE s.battle_id = b.id AND b.slug = v.slug;
