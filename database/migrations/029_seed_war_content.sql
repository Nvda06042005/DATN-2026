-- HK Sprint 6 theo ver0.2: nội dung khởi tạo (bản nháp) cho game thẻ tướng: chỉ số và chiêu thức của 13 thẻ tướng, 4 thẻ chiến thuật, 5 chỉ huy đối phương,
-- 6 màn chơi (mỗi trận đánh trong kho lịch sử một màn) và 3 bản đồ hành quân kèm hội thoại cốt truyện. Màn chơi, bản đồ, hội thoại và chỉ huy đều ở trạng thái Nháp;
-- hội thoại được dựng lại theo tinh thần sử sách, cần gắn tư liệu nguồn và được giáo viên Lịch sử kiểm chứng trước khi phát hành. Chạy lại không tạo trùng.

-- ------------------------------------------------------------------ chỉ số thẻ tướng (độ hiếm Sử thi cho hai tướng giữ vai trò then chốt)
UPDATE public.hk_cards c SET
    branch = v.branch, rarity = v.rarity, base_stats = jsonb_build_object('atk', v.atk, 'def', v.def, 'hp', v.hp, 'spd', v.spd), fragments_needed = v.frag,
    source_text = $t$Rơi sau trận đánh, trong rương và trên bản đồ hành quân$t$
FROM (VALUES
    ('tran-hung-dao', 'bo', 'legendary', 140, 90, 1200, 12, 6),
    ('tran-nhan-tong', 'bo', 'legendary', 120, 100, 1300, 11, 6),
    ('tran-quoc-toan', 'ky', 'rare', 130, 55, 800, 15, 4),
    ('tran-binh-trong', 'bo', 'rare', 105, 120, 1150, 8, 4),
    ('tran-quang-khai', 'bo', 'epic', 125, 85, 1000, 12, 5),
    ('tran-khanh-du', 'thuy', 'epic', 120, 75, 950, 13, 5),
    ('tran-nhat-duat', 'ky', 'rare', 115, 70, 900, 14, 4),
    ('tran-thai-tong', 'thuy', 'common', 100, 70, 900, 10, 3),
    ('tran-thanh-tong', 'bo', 'common', 95, 80, 950, 9, 3),
    ('pham-ngu-lao', 'ky', 'common', 110, 65, 850, 13, 3),
    ('yet-kieu', 'thuy', 'common', 105, 50, 750, 15, 3),
    ('le-phu-tran', 'ky', 'common', 100, 75, 900, 11, 3),
    ('tran-thu-do', 'bo', 'common', 95, 100, 1000, 8, 3)
) AS v(code, branch, rarity, atk, def, hp, spd, frag)
WHERE c.code = v.code AND c.kind = 'general';

-- ------------------------------------------------------------------ chiêu thức kèm giai thoại (HK.AD.083)
INSERT INTO public.hk_card_moves (card_id, slot, name, description, anecdote, target, power, effect, rage_cost, cooldown)
SELECT c.id, v.slot, v.name, v.description, v.anecdote, v.target, v.power, v.effect::jsonb, v.rage, v.cd
FROM (VALUES
    ('tran-hung-dao', 'active', 'Hịch tướng sĩ', 'Khích lệ cả đội, tăng công trong 2 lượt.', $t$Trần Hưng Đạo viết Hịch tướng sĩ để khích lệ tướng sĩ trước cuộc kháng chiến chống Nguyên.$t$, 'ally_all', 0, '{"type":"atk_up","value":0.2,"turns":2}', 40, 3),
    ('tran-hung-dao', 'ultimate', 'Bãi cọc Bạch Đằng', 'Giáng đòn lên toàn bộ quân địch và làm choáng một lượt.', $t$Năm 1288, ông cho đóng cọc nhọn dưới lòng sông Bạch Đằng, đợi nước triều rút để đánh tan thủy quân nhà Nguyên.$t$, 'enemy_all', 1.6, '{"type":"stun","turns":1}', 100, 0),
    ('tran-hung-dao', 'passive', 'Quốc công Tiết chế', 'Cả đội tăng thủ.', $t$Năm 1283, Trần Quốc Tuấn được phong Quốc công Tiết chế, thống lĩnh quân đội.$t$, 'ally_all', 0, '{"type":"def_up","value":0.1}', 0, 0),
    ('tran-nhan-tong', 'active', 'Hội nghị Diên Hồng', 'Hồi một phần sinh lực cho cả đội.', $t$Nhà Trần mời các bô lão đến Diên Hồng hỏi ý kiến nên đánh hay hòa; tất cả đồng thanh hô "Đánh!".$t$, 'ally_all', 0, '{"type":"heal","value":0.2}', 40, 3),
    ('tran-nhan-tong', 'ultimate', 'Hào khí Đông A', 'Đánh toàn bộ quân địch và làm giảm công của chúng.', NULL, 'enemy_all', 1.4, '{"type":"atk_down","value":0.2,"turns":2}', 100, 0),
    ('tran-nhan-tong', 'passive', 'Quân dân một lòng', 'Cả đội tăng công nhẹ.', NULL, 'ally_all', 0, '{"type":"atk_up","value":0.05}', 0, 0),
    ('tran-quoc-toan', 'active', 'Xung phong cờ thêu', 'Lao vào một tên địch với sức mạnh lớn.', $t$Trần Quốc Toản cho thêu lên cờ sáu chữ "Phá cường địch, báo hoàng ân".$t$, 'enemy_one', 1.9, NULL, 40, 2),
    ('tran-quoc-toan', 'ultimate', 'Phá cường địch', 'Xung kích toàn bộ quân địch.', NULL, 'enemy_all', 1.5, NULL, 100, 0),
    ('tran-quoc-toan', 'passive', 'Phá cường địch, báo hoàng ân', 'Lá cờ thêu sáu chữ làm cả đội tăng công.', $t$Tại Bình Than năm 1282, Trần Quốc Toản vì không được dự bàn việc nước mà bóp nát quả cam trong tay, rồi chiêu mộ quân sĩ đánh giặc.$t$, 'ally_all', 0, '{"type":"atk_up","value":0.1}', 0, 0),
    ('tran-binh-trong', 'active', 'Cố thủ Đà Mạc', 'Tự củng cố phòng thủ rất mạnh trong 2 lượt.', $t$Năm 1285, Trần Bình Trọng chặn quân Nguyên ở Đà Mạc, bị bắt mà không chịu hàng.$t$, 'self', 0, '{"type":"def_up","value":0.4,"turns":2}', 40, 3),
    ('tran-binh-trong', 'ultimate', 'Làm quỷ nước Nam', 'Một đòn quyết tử lên một tên địch.', $t$Khi bị giặc dụ làm vương đất Bắc, ông đáp: "Ta thà làm quỷ nước Nam chứ không thèm làm vương đất Bắc."$t$, 'enemy_one', 2.6, NULL, 100, 0),
    ('tran-binh-trong', 'passive', 'Kiên cường', 'Tự tăng thủ.', NULL, 'self', 0, '{"type":"def_up","value":0.15}', 0, 0),
    ('tran-quang-khai', 'active', 'Chương Dương độ', 'Tấn công toàn bộ quân địch.', $t$Tháng 6 năm 1285, quân Trần thắng lớn ở Chương Dương; Trần Quang Khải được sử sách ghi bài thơ "Tụng giá hoàn kinh sư".$t$, 'enemy_all', 1.1, NULL, 40, 2),
    ('tran-quang-khai', 'ultimate', 'Đoạt sáo Chương Dương', 'Đánh toàn bộ quân địch và làm giảm công của chúng.', $t$Thơ ông có câu: "Đoạt sáo Chương Dương độ, Cầm Hồ Hàm Tử quan".$t$, 'enemy_all', 1.7, '{"type":"atk_down","value":0.2,"turns":2}', 100, 0),
    ('tran-khanh-du', 'active', 'Phục kích Vân Đồn', 'Tập kích một mục tiêu và gây bỏng cháy.', $t$Đầu năm 1288, Trần Khánh Dư phục kích ở Vân Đồn, đánh tan đoàn thuyền lương của giặc.$t$, 'enemy_one', 2.0, '{"type":"burn","value":0.05,"turns":2}', 40, 2),
    ('tran-khanh-du', 'ultimate', 'Cắt đường lương', 'Đánh toàn bộ quân địch và làm chúng thiếu lương nhiều lượt.', $t$Quân Nguyên mất lương thực nên buộc phải rút khỏi Thăng Long.$t$, 'enemy_all', 1.4, '{"type":"hunger","value":0.06,"turns":3}', 100, 0),
    ('tran-nhat-duat', 'active', 'Hàm Tử quan', 'Tấn công mạnh một mục tiêu.', $t$Tháng 6 năm 1285, quân Trần thắng lớn ở Hàm Tử.$t$, 'enemy_one', 1.8, NULL, 40, 2),
    ('tran-nhat-duat', 'ultimate', 'Phá giặc Hàm Tử', 'Đánh toàn bộ quân địch và làm choáng một lượt.', NULL, 'enemy_all', 1.5, '{"type":"stun","turns":1}', 100, 0),
    ('tran-thai-tong', 'active', 'Phản công Đông Bộ Đầu', 'Phản công mạnh một mục tiêu.', $t$Ngày 29/1/1258, quân Trần phản công thắng lợi ở Đông Bộ Đầu.$t$, 'enemy_one', 1.8, NULL, 40, 2),
    ('tran-thai-tong', 'ultimate', 'Quét sạch bờ cõi', 'Tấn công toàn bộ quân địch.', NULL, 'enemy_all', 1.4, NULL, 100, 0),
    ('tran-thanh-tong', 'active', 'Giữ nước yên dân', 'Hồi sinh lực cho cả đội.', NULL, 'ally_all', 0, '{"type":"heal","value":0.2}', 40, 3),
    ('tran-thanh-tong', 'ultimate', 'Triều đại hưng thịnh', 'Cả đội tăng công mạnh trong 3 lượt.', NULL, 'ally_all', 0, '{"type":"atk_up","value":0.2,"turns":3}', 100, 0),
    ('pham-ngu-lao', 'active', 'Xung trận', 'Xông vào một mục tiêu.', NULL, 'enemy_one', 1.8, NULL, 40, 2),
    ('pham-ngu-lao', 'ultimate', 'Hổ tướng', 'Đánh toàn bộ quân địch.', NULL, 'enemy_all', 1.4, NULL, 100, 0),
    ('yet-kieu', 'active', 'Đục thuyền giặc', 'Phá hoại một mục tiêu và gây bỏng cháy.', $t$Theo truyền thuyết, Yết Kiêu là người giỏi lặn, từng lặn xuống đục thuyền giặc.$t$, 'enemy_one', 1.8, '{"type":"burn","value":0.04,"turns":2}', 40, 2),
    ('yet-kieu', 'ultimate', 'Lặn đục thuyền', 'Đánh toàn bộ quân địch.', NULL, 'enemy_all', 1.5, NULL, 100, 0),
    ('le-phu-tran', 'active', 'Dẫn quân xung kích', 'Tấn công một mục tiêu.', NULL, 'enemy_one', 1.7, NULL, 40, 2),
    ('le-phu-tran', 'ultimate', 'Hộ giá', 'Cả đội tăng thủ mạnh trong 3 lượt.', NULL, 'ally_all', 0, '{"type":"def_up","value":0.3,"turns":3}', 100, 0),
    ('tran-thu-do', 'active', 'Che chở', 'Dựng khiên bảo vệ cả đội trong 2 lượt.', $t$Thái sư Trần Thủ Độ nói: "Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo."$t$, 'ally_all', 0, '{"type":"shield","value":0.6,"turns":2}', 40, 3),
    ('tran-thu-do', 'ultimate', 'Vườn không nhà trống', 'Đánh toàn bộ quân địch và làm chúng thiếu lương.', $t$Năm 1258 nhà Trần rút lui, đem dân và của đi nơi khác để giặc không cướp được lương thực.$t$, 'enemy_all', 0.8, '{"type":"hunger","value":0.08,"turns":3}', 100, 0),
    ('tran-thu-do', 'passive', 'Bảo vệ ngai vàng', 'Cả đội tăng thủ nhẹ.', NULL, 'ally_all', 0, '{"type":"def_up","value":0.05}', 0, 0)
) AS v(code, slot, name, description, anecdote, target, power, effect, rage, cd)
JOIN public.hk_cards c ON c.code = v.code
ON CONFLICT (card_id, slot) DO NOTHING;

-- ------------------------------------------------------------------ thẻ chiến thuật – sự kiện lịch sử (HK.HS.129)
INSERT INTO public.hk_cards (code, name, rarity, drop_weight, kind, fragments_needed, source_text, tactic)
VALUES
    ('hich-tuong-si', 'Hịch tướng sĩ', 'rare', 6, 'tactic', 4, $t$Phần thưởng trận đánh và rương$t$, '{"effect":"atk_up","value":0.2,"turns":3,"text":"Tăng sĩ khí, cả đội tăng công 3 lượt."}'),
    ('hoi-nghi-dien-hong', 'Hội nghị Diên Hồng', 'rare', 6, 'tactic', 4, $t$Phần thưởng trận đánh và rương$t$, '{"effect":"def_up","value":0.2,"turns":3,"text":"Toàn dân một lòng, cả đội tăng thủ 3 lượt."}'),
    ('vuon-khong-nha-trong', 'Vườn không nhà trống', 'epic', 6, 'tactic', 5, $t$Phần thưởng trận đánh và rương$t$, '{"effect":"hunger","value":0.06,"turns":3,"text":"Giặc thiếu lương, mất dần sinh lực mỗi lượt."}'),
    ('coc-go-bach-dang', 'Cọc gỗ Bạch Đằng', 'epic', 6, 'tactic', 5, $t$Phần thưởng trận đánh và rương$t$, '{"effect":"stakes","value":0.25,"text":"Cọc nhọn làm hư hại thuyền chiến của giặc."}')
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------------ chỉ huy đối phương (HK.HS.130): chỉ để tra cứu, không dùng làm thẻ ra trận
INSERT INTO public.hk_commanders (code, name, role_text, forces, tactics, outcome)
VALUES
    ('ngot-luong-hop-thai', 'Ngột Lương Hợp Thai', $t$Tướng Mông Cổ chỉ huy cuộc xâm lược Đại Việt đầu năm 1258.$t$, $t$Khoảng 3 vạn quân, chủ yếu là kỵ binh.$t$, $t$Kỵ binh cơ động, đánh nhanh và cướp lương thực của dân.$t$, $t$Quân Mông Cổ thiếu lương và mệt mỏi, bị quân Trần phản công ở Đông Bộ Đầu ngày 29/1/1258 rồi phải rút khỏi bờ cõi.$t$),
    ('thoat-hoan', 'Thoát Hoan', $t$Hoàng tử nhà Nguyên, thống lĩnh quân xâm lược Đại Việt năm 1285 và năm 1287 – 1288.$t$, $t$Quân đánh từ phía Bắc, phối hợp với cánh quân phía Nam và thủy quân.$t$, $t$Dựa vào ưu thế quân số, tiến chiếm Thăng Long nhưng bị thiếu lương.$t$, $t$Thất bại cả hai lần và phải rút chạy về nước.$t$),
    ('toa-do', 'Toa Đô', $t$Tướng nhà Nguyên chỉ huy cánh quân đánh từ phía Nam lên trong cuộc xâm lược năm 1285.$t$, $t$Cánh quân đi từ phía Nam, phối hợp với Thoát Hoan từ phía Bắc.$t$, $t$Đánh hai gọng kìm vào Đại Việt.$t$, $t$Bị quân Trần đánh bại trong chiến dịch mùa hè năm 1285 và tử trận.$t$),
    ('o-ma-nhi', 'Ô Mã Nhi', $t$Tướng chỉ huy thủy quân nhà Nguyên trong cuộc xâm lược năm 1287 – 1288.$t$, $t$Đoàn thuyền chiến lớn trên sông.$t$, $t$Dùng thủy quân tiến sâu vào sông Bạch Đằng.$t$, $t$Bị quân Trần nhử vào bãi cọc ngầm và bị bắt trong trận Bạch Đằng năm 1288.$t$),
    ('truong-van-ho', 'Trương Văn Hổ', $t$Người chỉ huy đoàn thuyền chở lương của quân Nguyên năm 1287 – 1288.$t$, $t$Đoàn thuyền lương cùng thuyền hộ tống.$t$, $t$Chở lương thực tiếp tế cho quân Nguyên ở Thăng Long.$t$, $t$Đoàn thuyền lương bị Trần Khánh Dư đánh tan ở Vân Đồn, quân Nguyên thiếu lương phải rút lui.$t$)
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------------ màn chơi (HK.AD.084): mỗi trận đánh trong kho lịch sử một màn
INSERT INTO public.hk_stages (battle_id, title, summary, objective, difficulty, max_turns, star_turns, terrain, waves, rewards, commander_id, quiz_id, differences)
SELECT b.id, v.title, v.summary, v.objective, v.difficulty, 15, v.star_turns, v.terrain::jsonb, v.waves::jsonb, v.rewards::jsonb, (SELECT k.id FROM public.hk_commanders k WHERE k.code = v.commander),
       (SELECT n.quiz_id FROM public.hk_nodes n WHERE n.battle_id = b.id AND n.quiz_id IS NOT NULL ORDER BY n.id LIMIT 1), v.diffs::jsonb
FROM (VALUES
    ('dong-bo-dau', 'Phản công Đông Bộ Đầu', $t$Đầu năm 1258, quân Mông Cổ vào Thăng Long thấy kinh thành trống không, thiếu lương và mệt mỏi. Quân Trần chuẩn bị phản công.$t$, $t$Đánh bại quân Mông Cổ và chỉ huy Ngột Lương Hợp Thai.$t$, 1, 9,
        '{"hunger":{"pct":0.04,"from_turn":3}}',
        '[{"label":"Quân Mông Cổ tiền phong","units":[{"name":"Kỵ binh Mông Cổ","branch":"ky","hp":650,"atk":105,"def":40,"spd":10},{"name":"Kỵ binh Mông Cổ","branch":"ky","hp":650,"atk":105,"def":40,"spd":10},{"name":"Cung thủ Mông Cổ","branch":"ky","hp":550,"atk":120,"def":30,"spd":12}]},{"label":"Chủ lực của Ngột Lương Hợp Thai","units":[{"name":"Kỵ binh Mông Cổ","branch":"ky","hp":750,"atk":115,"def":45,"spd":10},{"name":"Ngột Lương Hợp Thai","branch":"ky","hp":2030,"atk":145,"def":60,"spd":9,"commander":true}]}]',
        '{"gold":40,"binh_thu":6,"xp":120,"fragments":[{"card_code":"tran-thai-tong","qty":2}]}', 'ngot-luong-hop-thai',
        '["Trong lịch sử, quân Trần chủ yếu rút lui để bảo toàn lực lượng rồi mới phản công ngày 29/1/1258; ván chơi cho phép giao chiến ngay từ đầu.","Việc giặc thiếu lương nhờ kế vườn không nhà trống là có thật; trong ván chơi nó được thể hiện bằng việc quân địch mất dần sinh lực mỗi vòng."]'),
    ('ham-tu', 'Chiến thắng Hàm Tử', $t$Tháng 6 năm 1285, quân Trần phản công thắng lớn ở Hàm Tử.$t$, $t$Đánh tan cánh quân của Toa Đô.$t$, 2, 9,
        '{"water_bonus":{"thuy":0.2}}',
        '[{"label":"Thuyền chiến Nguyên","units":[{"name":"Thuyền chiến Nguyên","branch":"thuy","hp":910,"atk":120,"def":50,"spd":10},{"name":"Thuyền chiến Nguyên","branch":"thuy","hp":910,"atk":120,"def":50,"spd":10},{"name":"Bộ binh Nguyên","branch":"bo","hp":840,"atk":120,"def":55,"spd":9}]},{"label":"Cánh quân của Toa Đô","units":[{"name":"Bộ binh Nguyên","branch":"bo","hp":980,"atk":125,"def":60,"spd":9},{"name":"Toa Đô","branch":"bo","hp":2380,"atk":145,"def":70,"spd":10,"commander":true}]}]',
        '{"gold":60,"binh_thu":8,"xp":160,"fragments":[{"card_code":"tran-nhat-duat","qty":2}]}', 'toa-do',
        '["Ván chơi rút gọn trận Hàm Tử thành hai đợt giao chiến; diễn biến thật còn gắn với nhiều trận đánh khác trong cùng mùa hè năm 1285."]'),
    ('chuong-duong', 'Chiến thắng Chương Dương', $t$Tháng 6 năm 1285, quân Trần tổng phản công và thắng lớn ở Chương Dương, mở đường giải phóng Thăng Long.$t$, $t$Đánh bại hai đợt quân Nguyên trên bến sông Chương Dương.$t$, 2, 10,
        '{"water_bonus":{"thuy":0.2}}',
        '[{"label":"Bộ binh Nguyên","units":[{"name":"Bộ binh Nguyên","branch":"bo","hp":980,"atk":125,"def":60,"spd":9},{"name":"Bộ binh Nguyên","branch":"bo","hp":980,"atk":125,"def":60,"spd":9},{"name":"Cung thủ Nguyên","branch":"bo","hp":780,"atk":140,"def":45,"spd":11}]},{"label":"Thủy quân Nguyên","units":[{"name":"Thuyền chiến Nguyên","branch":"thuy","hp":1060,"atk":135,"def":60,"spd":10},{"name":"Tướng Nguyên","branch":"bo","hp":2660,"atk":155,"def":75,"spd":10,"commander":true}]}]',
        '{"gold":70,"binh_thu":10,"xp":200,"fragments":[{"card_code":"tran-quang-khai","qty":2}]}', NULL,
        '["Ván chơi không nêu tên chỉ huy của đối phương ở Chương Dương vì cần kiểm chứng thêm với tư liệu."]'),
    ('tay-ket', 'Chiến thắng Tây Kết', $t$Mùa hè năm 1285, Toa Đô bị quân Trần đánh bại ở Tây Kết.$t$, $t$Đánh bại quân Toa Đô.$t$, 2, 10,
        '{"hunger":{"pct":0.03,"from_turn":4}}',
        '[{"label":"Bộ binh Nguyên","units":[{"name":"Bộ binh Nguyên","branch":"bo","hp":950,"atk":125,"def":58,"spd":9},{"name":"Bộ binh Nguyên","branch":"bo","hp":950,"atk":125,"def":58,"spd":9},{"name":"Cung thủ Nguyên","branch":"bo","hp":760,"atk":140,"def":45,"spd":11}]},{"label":"Quân của Toa Đô","units":[{"name":"Thuyền chiến Nguyên","branch":"thuy","hp":1040,"atk":135,"def":60,"spd":10},{"name":"Toa Đô","branch":"bo","hp":2520,"atk":150,"def":72,"spd":10,"commander":true}]}]',
        '{"gold":60,"binh_thu":8,"xp":160,"fragments":[{"card_code":"tran-binh-trong","qty":2}]}', 'toa-do',
        '["Ván chơi thu gọn diễn biến thành hai đợt; lịch sử ghi nhận Toa Đô tử trận trong chiến dịch này."]'),
    ('van-don', 'Đại phá thuyền lương ở Vân Đồn', $t$Đầu năm 1288, Trần Khánh Dư phục kích đoàn thuyền lương của quân Nguyên ở Vân Đồn.$t$, $t$Đánh tan đoàn thuyền lương của Trương Văn Hổ.$t$, 3, 10,
        '{"water_bonus":{"thuy":0.25},"hunger":{"pct":0.05,"from_turn":2}}',
        '[{"label":"Thuyền lương Nguyên","units":[{"name":"Thuyền lương Nguyên","branch":"thuy","hp":1050,"atk":115,"def":45,"spd":9},{"name":"Thuyền lương Nguyên","branch":"thuy","hp":1050,"atk":115,"def":45,"spd":9},{"name":"Thuyền lương Nguyên","branch":"thuy","hp":1050,"atk":115,"def":45,"spd":9}]},{"label":"Thuyền hộ tống","units":[{"name":"Thuyền hộ tống","branch":"thuy","hp":1400,"atk":165,"def":65,"spd":11},{"name":"Thuyền hộ tống","branch":"thuy","hp":1400,"atk":165,"def":65,"spd":11},{"name":"Trương Văn Hổ","branch":"thuy","hp":3500,"atk":180,"def":70,"spd":10,"commander":true}]}]',
        '{"gold":80,"binh_thu":12,"xp":240,"fragments":[{"card_code":"tran-khanh-du","qty":3}]}', 'truong-van-ho',
        '["Ván chơi biểu diễn việc cắt đường lương bằng sinh lực quân địch giảm dần mỗi vòng; trong lịch sử, hậu quả là quân Nguyên thiếu lương và phải rút khỏi Thăng Long."]'),
    ('bach-dang', 'Đại thắng Bạch Đằng', $t$Tháng 4 năm 1288, Trần Hưng Đạo cho đóng cọc nhọn dưới lòng sông Bạch Đằng, nhử thuyền giặc vào khi nước triều lên rồi đánh khi nước rút.$t$, $t$Đánh bại thủy quân của Ô Mã Nhi trên sông Bạch Đằng.$t$, 3, 11,
        '{"tide":{"cycle":4},"stakes":{"pct":0.12},"water_bonus":{"thuy":0.2}}',
        '[{"label":"Thuyền chiến Nguyên","units":[{"name":"Thuyền chiến Nguyên","branch":"thuy","hp":1680,"atk":195,"def":60,"spd":10},{"name":"Thuyền chiến Nguyên","branch":"thuy","hp":1680,"atk":195,"def":60,"spd":10},{"name":"Thuyền chiến Nguyên","branch":"thuy","hp":1680,"atk":195,"def":60,"spd":10}]},{"label":"Hạm đội chủ lực","units":[{"name":"Thuyền chiến Nguyên","branch":"thuy","hp":1890,"atk":215,"def":70,"spd":11},{"name":"Thuyền chiến Nguyên","branch":"thuy","hp":1890,"atk":215,"def":70,"spd":11},{"name":"Ô Mã Nhi","branch":"thuy","hp":5460,"atk":245,"def":80,"spd":11,"commander":true}]}]',
        '{"gold":150,"binh_thu":20,"xp":400,"card_code":"tran-hung-dao"}', 'o-ma-nhi',
        '["Trong lịch sử, bãi cọc ngầm quyết định trận đánh vì thuyền giặc bị nhử vào lúc nước triều lên rồi mắc cạn khi nước rút; ván chơi thể hiện điều đó bằng sát thương cọc ngầm khi nước rút.","Ván chơi không bao quát toàn bộ lực lượng và diễn biến chi tiết của trận Bạch Đằng."]')
) AS v(slug, title, summary, objective, difficulty, star_turns, terrain, waves, rewards, commander, diffs)
JOIN public.hist_battles b ON b.slug = v.slug
ON CONFLICT (battle_id) DO NOTHING;

-- ------------------------------------------------------------------ bản đồ hành quân và hội thoại (HK.AD.081, 082)
DO $seed$
DECLARE
    maps jsonb := $j$[
      {"rank": 0, "title": "Hành quân kháng chiến chống Mông Cổ lần thứ nhất", "points": [
        {"code": "thang-long", "name": "Kinh thành Thăng Long", "description": "Nơi vua tôi nhà Trần bàn kế chống giặc.", "x": 50, "y": 30, "kind": "start", "payload": {}},
        {"code": "phu-thai-su", "name": "Phủ Thái sư", "description": "Thái sư Trần Thủ Độ giúp vua việc triều chính.", "x": 22, "y": 52, "kind": "story", "payload": {},
         "dialog": {"title": "Đầu thần chưa rơi xuống đất", "sources": [], "lines": [
            {"speaker": "Trần Thái Tông", "fig": "tran-thai-tong", "text": "Quân Mông Cổ đã tiến vào bờ cõi, thế giặc rất mạnh. Trẫm lo cho xã tắc."},
            {"speaker": "Trần Thủ Độ", "fig": "tran-thu-do", "text": "Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo."},
            {"speaker": "Trần Thủ Độ", "fig": "tran-thu-do", "text": "Ta rút lui bảo toàn lực lượng, đem dân và của đi nơi khác, không để giặc cướp được lương thực.", "choices": [{"text": "Vì sao phải rút lui?", "reply": "Thế giặc đang mạnh; giữ được lực lượng và làm giặc thiếu lương thì mới phản công được."}]}]}},
        {"code": "binh-le-nguyen", "name": "Bình Lệ Nguyên", "description": "Nơi quân Trần chặn giặc lần đầu.", "x": 28, "y": 20, "kind": "story", "payload": {},
         "dialog": {"title": "Chặn giặc ở Bình Lệ Nguyên", "sources": [], "lines": [
            {"speaker": "Người dẫn chuyện", "text": "Đầu năm 1258, khoảng ba vạn quân Mông Cổ do tướng Ngột Lương Hợp Thai chỉ huy tiến vào Đại Việt."},
            {"speaker": "Người dẫn chuyện", "text": "Quân Trần chặn giặc ở Bình Lệ Nguyên nhưng thế giặc mạnh nên phải rút lui để bảo toàn lực lượng."}]}},
        {"code": "hoi-quan", "name": "Hội quân bàn kế", "description": "Thử thách câu hỏi: nhắc lại điều em đã học.", "x": 62, "y": 18, "kind": "quiz", "payload": {"quiz": "auto", "gold": 8, "binh_thu": 3}},
        {"code": "kho-luong", "name": "Kho lương cất giấu", "description": "Lương thực được cất đi để giặc không cướp được.", "x": 40, "y": 74, "kind": "chest", "payload": {"gold": 15, "binh_thu": 4, "fragments": [{"card_code": "tran-thu-do", "qty": 2}]}},
        {"code": "dong-bo-dau", "name": "Đông Bộ Đầu", "description": "Bến sông nơi quân Trần phản công.", "x": 78, "y": 58, "kind": "battle", "payload": {"stage": "dong-bo-dau"}}],
       "edges": [["thang-long", "phu-thai-su"], ["thang-long", "binh-le-nguyen"], ["binh-le-nguyen", "hoi-quan"], ["phu-thai-su", "kho-luong"], ["hoi-quan", "dong-bo-dau"], ["kho-luong", "dong-bo-dau"]]},
      {"rank": 1, "title": "Hành quân kháng chiến chống Nguyên lần thứ hai", "points": [
        {"code": "thang-long", "name": "Kinh thành Thăng Long", "description": "Nơi vua tôi nhà Trần bàn kế chống giặc.", "x": 48, "y": 26, "kind": "start", "payload": {}},
        {"code": "binh-than", "name": "Bến Bình Than", "description": "Hội nghị bàn kế đánh giặc năm 1282.", "x": 20, "y": 40, "kind": "story", "payload": {},
         "dialog": {"title": "Bóp nát quả cam", "sources": [], "lines": [
            {"speaker": "Người dẫn chuyện", "text": "Năm 1282, nhà Trần mở Hội nghị Bình Than bàn kế đánh giặc."},
            {"speaker": "Trần Quốc Toản", "fig": "tran-quoc-toan", "text": "Giặc đến mà em không được dự bàn việc nước! Em xin được đánh giặc."},
            {"speaker": "Người dẫn chuyện", "text": "Vì quá giận, Trần Quốc Toản bóp nát quả cam trong tay lúc nào không biết, rồi chiêu mộ quân sĩ, thêu lên cờ sáu chữ: Phá cường địch, báo hoàng ân."}]}},
        {"code": "dien-hong", "name": "Điện Diên Hồng", "description": "Nơi các bô lão được hỏi ý kiến nên đánh hay hòa.", "x": 60, "y": 38, "kind": "story", "payload": {},
         "dialog": {"title": "Hội nghị Diên Hồng", "sources": [], "lines": [
            {"speaker": "Trần Nhân Tông", "fig": "tran-nhan-tong", "text": "Giặc mạnh như thế, nên đánh hay nên hòa?"},
            {"speaker": "Các bô lão", "text": "Đánh!"},
            {"speaker": "Người dẫn chuyện", "text": "Nhà Trần mời các bô lão đến Diên Hồng hỏi ý kiến; tất cả đồng thanh hô Đánh!, chọn con đường kháng chiến."}]}},
        {"code": "dai-ban-doanh", "name": "Đại bản doanh", "description": "Nơi tập hợp các tướng sĩ trẻ tuổi.", "x": 34, "y": 62, "kind": "card", "payload": {"card_code": "tran-quoc-toan", "qty": 2}},
        {"code": "da-mac", "name": "Đà Mạc", "description": "Nơi Trần Bình Trọng chặn giặc.", "x": 74, "y": 56, "kind": "story", "payload": {},
         "dialog": {"title": "Thà làm quỷ nước Nam", "sources": [], "lines": [
            {"speaker": "Người dẫn chuyện", "text": "Năm 1285, Trần Bình Trọng chặn quân Nguyên ở Đà Mạc, bị giặc bắt."},
            {"speaker": "Trần Bình Trọng", "fig": "tran-binh-trong", "text": "Ta thà làm quỷ nước Nam chứ không thèm làm vương đất Bắc."}]}},
        {"code": "ham-tu", "name": "Hàm Tử", "description": "Trận phản công mùa hè năm 1285.", "x": 56, "y": 78, "kind": "battle", "payload": {"stage": "ham-tu"}},
        {"code": "chuong-duong", "name": "Chương Dương", "description": "Trận tổng phản công mở đường về Thăng Long.", "x": 82, "y": 80, "kind": "battle", "payload": {"stage": "chuong-duong"}},
        {"code": "tay-ket", "name": "Tây Kết", "description": "Nơi Toa Đô bị đánh bại.", "x": 24, "y": 84, "kind": "battle", "payload": {"stage": "tay-ket"}}],
       "edges": [["thang-long", "binh-than"], ["thang-long", "dien-hong"], ["binh-than", "dai-ban-doanh"], ["dien-hong", "da-mac"], ["da-mac", "ham-tu"], ["dai-ban-doanh", "tay-ket"], ["ham-tu", "chuong-duong"]]},
      {"rank": 2, "title": "Hành quân kháng chiến chống Nguyên lần thứ ba", "points": [
        {"code": "thang-long", "name": "Kinh thành Thăng Long", "description": "Nơi vua tôi nhà Trần bàn kế chống giặc.", "x": 46, "y": 24, "kind": "start", "payload": {}},
        {"code": "hop-tuong", "name": "Hội các tướng", "description": "Trần Hưng Đạo khích lệ tướng sĩ.", "x": 22, "y": 42, "kind": "story", "payload": {},
         "dialog": {"title": "Hịch tướng sĩ", "sources": ["hich-tuong-si-trich-doan"], "lines": [
            {"speaker": "Trần Hưng Đạo", "fig": "tran-hung-dao", "text": "Ta thường tới bữa quên ăn, nửa đêm vỗ gối, ruột đau như cắt, nước mắt đầm đìa."},
            {"speaker": "Trần Hưng Đạo", "fig": "tran-hung-dao", "text": "Chỉ căm tức chưa xả thịt lột da, nuốt gan uống máu quân thù."}]}},
        {"code": "tuong-tri", "name": "Trại kiểm tra quân sĩ", "description": "Thử thách câu hỏi trước khi ra quân.", "x": 64, "y": 38, "kind": "quiz", "payload": {"quiz": "auto", "gold": 8, "binh_thu": 3}},
        {"code": "van-don", "name": "Vân Đồn", "description": "Nơi đoàn thuyền lương của giặc bị đánh tan.", "x": 80, "y": 62, "kind": "battle", "payload": {"stage": "van-don"}},
        {"code": "chien-loi-pham", "name": "Chiến lợi phẩm", "description": "Lương thực thu được sau trận Vân Đồn.", "x": 40, "y": 70, "kind": "chest", "payload": {"gold": 20, "binh_thu": 6, "fragments": [{"card_code": "tran-khanh-du", "qty": 2}]}},
        {"code": "bach-dang", "name": "Sông Bạch Đằng", "description": "Bãi cọc ngầm quyết định trận đánh.", "x": 62, "y": 84, "kind": "battle", "payload": {"stage": "bach-dang"}}],
       "edges": [["thang-long", "hop-tuong"], ["thang-long", "tuong-tri"], ["tuong-tri", "van-don"], ["hop-tuong", "chien-loi-pham"], ["van-don", "bach-dang"], ["chien-loi-pham", "bach-dang"]]}
    ]$j$::jsonb;
    m jsonb;
    p record;
    e jsonb;
    camp integer;
    mid integer;
    pid integer;
    payload jsonb;
    lines jsonb;
BEGIN
    FOR m IN SELECT * FROM jsonb_array_elements(maps) LOOP
        SELECT id INTO camp FROM public.hist_campaigns ORDER BY sort_order, id OFFSET (m->>'rank')::integer LIMIT 1;
        CONTINUE WHEN camp IS NULL;
        CONTINUE WHEN EXISTS (SELECT 1 FROM public.hk_march_maps WHERE campaign_id = camp);
        INSERT INTO public.hk_march_maps (campaign_id, title) VALUES (camp, m->>'title') RETURNING id INTO mid;
        FOR p IN SELECT t.val AS val, t.ord AS ord FROM jsonb_array_elements(m->'points') WITH ORDINALITY AS t(val, ord) LOOP
            payload := p.val->'payload';
            IF payload ? 'stage' THEN
                payload := (payload - 'stage') || jsonb_build_object('stage_id', (SELECT s.id FROM public.hk_stages s JOIN public.hist_battles b ON b.id = s.battle_id WHERE b.slug = payload->>'stage'));
            END IF;
            IF payload ? 'quiz' THEN
                payload := (payload - 'quiz') || jsonb_build_object('quiz_id', (
                    SELECT n.quiz_id FROM public.hk_nodes n JOIN public.hk_journeys j ON j.id = n.journey_id
                    WHERE j.campaign_id = camp AND j.scope = 'system' AND n.quiz_id IS NOT NULL AND n.kind IN ('quiz', 'final') ORDER BY (n.kind = 'quiz') DESC, n.position LIMIT 1));
            END IF;
            INSERT INTO public.hk_march_points (map_id, code, name, description, x, y, kind, payload, sort_order)
            VALUES (mid, p.val->>'code', p.val->>'name', p.val->>'description', (p.val->>'x')::numeric, (p.val->>'y')::numeric, p.val->>'kind', payload, p.ord::integer) RETURNING id INTO pid;
            IF p.val ? 'dialog' THEN
                -- thay mã nhân vật trong lời thoại bằng id trong kho lịch sử
                SELECT jsonb_agg(CASE WHEN l ? 'fig' THEN (l - 'fig') || jsonb_build_object('figure_id', (SELECT f.id FROM public.hist_figures f WHERE f.slug = l->>'fig')) ELSE l END ORDER BY o)
                INTO lines FROM jsonb_array_elements(p.val->'dialog'->'lines') WITH ORDINALITY AS d(l, o);
                INSERT INTO public.hk_dialogs (point_id, title, lines, source_ids)
                VALUES (pid, p.val->'dialog'->>'title', lines, COALESCE((SELECT array_agg(s.id) FROM public.hist_sources s WHERE s.slug IN (SELECT jsonb_array_elements_text(p.val->'dialog'->'sources'))), '{}'));
            END IF;
        END LOOP;
        FOR e IN SELECT * FROM jsonb_array_elements(m->'edges') LOOP
            INSERT INTO public.hk_march_edges (map_id, from_point, to_point)
            VALUES (mid, (SELECT id FROM public.hk_march_points WHERE map_id = mid AND code = e->>0), (SELECT id FROM public.hk_march_points WHERE map_id = mid AND code = e->>1));
        END LOOP;
    END LOOP;
END
$seed$;
