-- HK Sprint 5 theo ver0.2: nội dung khởi tạo (bản nháp) cho lộ trình dạng đường đi. Chia ba hành trình mẫu của hệ thống (Lần I, II, III) thành các Cửa và thêm các nút
-- nghe kể chuyện, luyện tập, rương, kiểm tra cuối cửa. Lời kể chỉ dùng lại các sự kiện đã có trong bài học mẫu (019), chưa thêm chi tiết mới; vẫn là bản nháp cần giáo viên lịch sử kiểm tra.
-- Chỉ động vào hành trình mẫu còn là bản nháp, chưa có học sinh học và chưa chia Cửa; hành trình đã phát hành hoặc đã chỉnh tay được giữ nguyên.

DO $seed$
DECLARE
    spec jsonb := $j$[
      {"title": "Hành trình Lần I – Vườn không nhà trống", "expected": 4, "gates": [
        {"title": "Bình Lệ Nguyên và kế Vườn không nhà trống", "summary": "Vì sao nhà Trần chọn lui để bảo toàn lực lượng.", "steps": [
          {"n": 1},
          {"kind": "listen", "title": "Nghe kể: Vườn không nhà trống", "icon": "headphones", "objective": "Nghe lại diễn biến những ngày đầu năm 1258.", "points": 30,
           "transcript": "Đầu năm 1258, khoảng ba vạn quân Mông Cổ do tướng Ngột Lương Hợp Thai chỉ huy tiến vào Đại Việt.\nQuân Trần chặn giặc ở Bình Lệ Nguyên nhưng thế giặc mạnh nên phải rút lui để bảo toàn lực lượng.\nVua tôi nhà Trần rời Thăng Long, đem dân và của đi nơi khác, không để giặc cướp được lương thực. Đó là kế Vườn không nhà trống.\nQuân Mông Cổ vào Thăng Long chỉ thấy kinh thành trống không, thiếu lương và mệt mỏi."},
          {"n": 2},
          {"kind": "practice", "title": "Luyện tập cửa 1", "icon": "dumbbell", "objective": "Ôn lại các câu em đã học trong cửa.", "points": 20, "pass": 1},
          {"kind": "chest", "title": "Rương Bình Lệ Nguyên", "icon": "chest", "objective": "Mở rương nhận thưởng.", "points": 20, "gold": 10, "binh_thu": 5},
          {"kind": "gate_test", "title": "Kiểm tra cuối cửa 1", "icon": "trophy", "objective": "Đạt từ 70% để qua cửa.", "points": 80, "pass": 70}
        ]},
        {"title": "Đông Bộ Đầu – phản công", "summary": "Trận phản công ngày 29/1/1258.", "steps": [
          {"n": 3},
          {"kind": "chest", "title": "Rương Đông Bộ Đầu", "icon": "chest", "objective": "Mở rương nhận thưởng.", "points": 20, "gold": 10, "binh_thu": 8},
          {"n": 4}
        ]}
      ]},
      {"title": "Hành trình Lần II – Hào khí Chương Dương", "expected": 6, "gates": [
        {"title": "Từ Bình Than đến Diên Hồng", "summary": "Nhà Trần chuẩn bị kháng chiến lần thứ hai.", "steps": [
          {"n": 1},
          {"kind": "listen", "title": "Nghe kể: Từ Bình Than đến Diên Hồng", "icon": "headphones", "objective": "Nghe lại những quyết định lớn năm 1282 – 1283.", "points": 30,
           "transcript": "Trước nguy cơ bị xâm lược, năm 1282 nhà Trần mở Hội nghị Bình Than bàn kế đánh giặc.\nNăm 1283, Trần Quốc Tuấn, tức Trần Hưng Đạo, được phong Quốc công Tiết chế, thống lĩnh quân đội.\nNhà Trần còn mời các bô lão đến Diên Hồng hỏi ý kiến nên đánh hay hòa.\nTất cả đồng thanh hô: Đánh!"},
          {"n": 2},
          {"kind": "practice", "title": "Luyện tập cửa 1", "icon": "dumbbell", "objective": "Ôn lại các câu em đã học trong cửa.", "points": 20, "pass": 1},
          {"kind": "chest", "title": "Rương Bình Than", "icon": "chest", "objective": "Mở rương nhận thưởng.", "points": 20, "gold": 10, "binh_thu": 5},
          {"kind": "gate_test", "title": "Kiểm tra cuối cửa 1", "icon": "trophy", "objective": "Đạt từ 70% để qua cửa.", "points": 80, "pass": 70}
        ]},
        {"title": "Hàm Tử – Chương Dương", "summary": "Cuộc tổng phản công mùa hè 1285.", "steps": [
          {"n": 3},
          {"n": 4},
          {"n": 5},
          {"kind": "chest", "title": "Rương Chương Dương", "icon": "chest", "objective": "Mở rương nhận thưởng.", "points": 20, "gold": 15, "binh_thu": 10},
          {"n": 6}
        ]}
      ]},
      {"title": "Hành trình Lần III – Bạch Đằng giang", "expected": 4, "gates": [
        {"title": "Vân Đồn – cắt đường lương", "summary": "Đánh tan đoàn thuyền lương của giặc đầu năm 1288.", "steps": [
          {"n": 1},
          {"kind": "listen", "title": "Nghe kể: Vân Đồn cắt đường lương", "icon": "headphones", "objective": "Nghe lại diễn biến cuối năm 1287 – đầu năm 1288.", "points": 30,
           "transcript": "Cuối năm 1287, Thoát Hoan lại đem quân xâm lược Đại Việt, đi cùng đoàn thuyền lương và thủy quân do Ô Mã Nhi chỉ huy.\nĐầu năm 1288, Phó đô tướng quân Trần Khánh Dư phục kích ở Vân Đồn, đánh tan đoàn thuyền lương của giặc.\nQuân Nguyên thiếu lương thực, buộc phải rút khỏi Thăng Long."},
          {"n": 2},
          {"kind": "practice", "title": "Luyện tập cửa 1", "icon": "dumbbell", "objective": "Ôn lại các câu em đã học trong cửa.", "points": 20, "pass": 1},
          {"kind": "chest", "title": "Rương Vân Đồn", "icon": "chest", "objective": "Mở rương nhận thưởng.", "points": 20, "gold": 10, "binh_thu": 5},
          {"kind": "gate_test", "title": "Kiểm tra cuối cửa 1", "icon": "trophy", "objective": "Đạt từ 70% để qua cửa.", "points": 80, "pass": 70}
        ]},
        {"title": "Bạch Đằng giang", "summary": "Bãi cọc ngầm và trận thủy chiến tháng 4/1288.", "steps": [
          {"n": 3},
          {"kind": "chest", "title": "Rương Bạch Đằng", "icon": "chest", "objective": "Mở rương nhận thưởng.", "points": 20, "gold": 15, "binh_thu": 10},
          {"n": 4}
        ]}
      ]}
    ]$j$::jsonb;
    s jsonb;
    g jsonb;
    st jsonb;
    jid integer;
    gid integer;
    nid integer;
    gpos integer;
    temp integer;
    order_ids integer[];
BEGIN
    FOR s IN SELECT * FROM jsonb_array_elements(spec) LOOP
        SELECT id INTO jid FROM public.hk_journeys WHERE scope = 'system' AND status = 'draft' AND title = s->>'title';
        CONTINUE WHEN jid IS NULL;
        CONTINUE WHEN EXISTS (SELECT 1 FROM public.hk_gates WHERE journey_id = jid);
        CONTINUE WHEN EXISTS (SELECT 1 FROM public.hk_node_progress p JOIN public.hk_nodes n ON n.id = p.node_id WHERE n.journey_id = jid);
        CONTINUE WHEN (SELECT count(*) FROM public.hk_nodes WHERE journey_id = jid) <> (s->>'expected')::integer;

        order_ids := '{}';
        gpos := 0;
        temp := 1000;
        FOR g IN SELECT * FROM jsonb_array_elements(s->'gates') LOOP
            gpos := gpos + 1;
            INSERT INTO public.hk_gates (journey_id, position, title, summary) VALUES (jid, gpos, g->>'title', g->>'summary') RETURNING id INTO gid;
            FOR st IN SELECT * FROM jsonb_array_elements(g->'steps') LOOP
                IF st ? 'n' THEN
                    UPDATE public.hk_nodes SET gate_id = gid WHERE journey_id = jid AND position = (st->>'n')::integer RETURNING id INTO nid;
                ELSE
                    temp := temp + 1;
                    INSERT INTO public.hk_nodes (journey_id, position, kind, title, icon, objective, pass_percent, reward_points, reward_gold, reward_binh_thu, transcript, gate_id)
                    VALUES (jid, temp, st->>'kind', st->>'title', st->>'icon', st->>'objective', (st->>'pass')::smallint, COALESCE((st->>'points')::integer, 20),
                            COALESCE((st->>'gold')::integer, 0), (st->>'binh_thu')::integer, st->>'transcript', gid) RETURNING id INTO nid;
                END IF;
                order_ids := order_ids || nid;
            END LOOP;
        END LOOP;
        -- Đánh số lại vị trí theo thứ tự Cửa → nút (ràng buộc duy nhất vị trí được kiểm tra khi kết thúc giao dịch)
        UPDATE public.hk_nodes n SET position = o.ord FROM unnest(order_ids) WITH ORDINALITY AS o(id, ord) WHERE n.id = o.id;
    END LOOP;
END
$seed$;
