-- HK Sprint 5 (nội dung khởi tạo cho trò chơi hóa): bảng cấp độ, ba lớp nhân vật, vật phẩm cửa hàng, mẫu nhiệm vụ, huy hiệu và thẻ nhân vật.
-- Đây là giá trị mặc định về cơ chế trò chơi (không phải nhận định lịch sử): quản trị tổng chỉnh trong trang quản trị. Độ hiếm của thẻ là thiết kế trò chơi,
-- tiểu sử và câu nói trên thẻ lấy từ hồ sơ nhân vật đã Công bố trong kho lịch sử. Chạy lại không tạo trùng (ON CONFLICT). Không chứa dữ liệu tài khoản.

INSERT INTO public.hk_levels (level, title, xp_required, reward_gold) VALUES
    (1, 'Lính mới', 0, 0), (2, 'Dân binh', 100, 20), (3, 'Tráng đinh', 250, 30), (4, 'Binh sĩ', 450, 40), (5, 'Đội trưởng', 700, 50),
    (6, 'Chỉ huy', 1000, 60), (7, 'Quản quân', 1400, 80), (8, 'Tướng trẻ', 1900, 100), (9, 'Đại tướng', 2500, 120), (10, 'Anh hùng Đông A', 3200, 150)
ON CONFLICT (level) DO NOTHING;

INSERT INTO public.hk_character_classes (code, name, description, icon, color, stats, skills, sort_order) VALUES
    ('tuong_quan', 'Tướng quân', 'Xung trận đi đầu: nhiều sinh lực, thưởng điểm lớn khi trả lời nhanh.', 'swords', '#b91c1c',
        '{"hp": 120, "attack": 90, "wisdom": 40, "support": 30}'::jsonb,
        '[{"code": "xung_phong", "name": "Xung phong", "description": "Tăng điểm thưởng tốc độ trong một câu", "cost": 3}, {"code": "ho_giap", "name": "Hộ giáp", "description": "Bỏ qua một lần mất tim", "cost": 4}]'::jsonb, 1),
    ('quan_su', 'Quân sư', 'Mưu lược: giỏi suy luận, có kỹ năng gợi ý đáp án.', 'scroll', '#0369a1',
        '{"hp": 90, "attack": 50, "wisdom": 100, "support": 50}'::jsonb,
        '[{"code": "muu_ke", "name": "Mưu kế", "description": "Loại bớt đáp án sai ở một câu trắc nghiệm", "cost": 3}, {"code": "tran_do", "name": "Trận đồ", "description": "Xem lại tư liệu liên quan đến câu hỏi", "cost": 2}]'::jsonb, 2),
    ('luong_y', 'Lương y', 'Chăm lo quân sĩ: hồi tim cho mình và đồng đội.', 'heart', '#15803d',
        '{"hp": 100, "attack": 40, "wisdom": 60, "support": 100}'::jsonb,
        '[{"code": "hoi_sinh", "name": "Hồi sinh", "description": "Hồi tim cho một đồng đội", "cost": 4}, {"code": "thuoc_quy", "name": "Thuốc quý", "description": "Hồi một tim cho bản thân", "cost": 3}]'::jsonb, 3)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.hk_shop_items (code, kind, name, description, icon, color, price, min_level, sort_order) VALUES
    ('ao-dan-binh', 'outfit', 'Áo dân binh', 'Trang phục mặc định của mọi nhân vật.', 'shirt', '#8d6e63', 0, 1, 1),
    ('giap-da', 'outfit', 'Giáp da', 'Mở khóa miễn phí khi đạt cấp 3.', 'shield', '#a1887f', 0, 3, 2),
    ('giap-sat', 'outfit', 'Giáp sắt', 'Giáp nặng của bộ binh.', 'shield', '#607d8b', 150, 1, 3),
    ('chien-bao-do', 'outfit', 'Chiến bào đỏ Đông A', 'Chiến bào sắc đỏ của quân Đông A.', 'shirt', '#b91c1c', 300, 5, 4),
    ('chien-bao-vang', 'outfit', 'Chiến bào vàng', 'Mở khóa miễn phí khi đạt cấp 8.', 'shirt', '#d4a500', 0, 8, 5),
    ('gay-tre', 'weapon', 'Gậy tre', 'Vũ khí mặc định.', 'swords', '#8d6e63', 0, 1, 1),
    ('kiem-sat', 'weapon', 'Kiếm sắt', 'Thanh kiếm sắt sắc bén.', 'swords', '#607d8b', 100, 1, 2),
    ('cung-no', 'weapon', 'Cung nỏ', 'Cung nỏ tầm xa.', 'target', '#6d4c41', 200, 4, 3),
    ('co-dong-a', 'banner', 'Cờ Đông A', 'Cờ hiệu mặc định.', 'flag', '#b91c1c', 0, 1, 1),
    ('co-sat-that', 'banner', 'Cờ “Sát Thát”', 'Cờ hiệu mang hai chữ “Sát Thát” – quyết đánh giặc Nguyên Mông.', 'flag', '#0f3d5e', 120, 1, 2),
    ('co-pha-cuong-dich', 'banner', 'Cờ “Phá cường địch”', 'Cờ hiệu theo lá cờ của Trần Quốc Toản.', 'flag', '#d4a500', 150, 3, 3),
    ('dong-bang-chuoi', 'streak_freeze', 'Đóng băng chuỗi ngày', 'Giữ chuỗi ngày học khi em nghỉ một ngày (tối đa 2 cái).', 'snowflake', '#0369a1', 100, 1, 10),
    ('hoi-tim', 'heart', 'Hồi đầy tim', 'Hồi lại toàn bộ tim ngay lập tức.', 'heart', '#dc2626', 50, 1, 11),
    ('goi-y-50-50', 'hint', 'Gợi ý 50/50', 'Loại bớt đáp án sai ở một câu một đáp án (tối đa 10 cái).', 'lightbulb', '#ff9600', 30, 1, 12)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.hk_quest_templates (code, period, title, metric, target, reward_xp, reward_gold, sort_order) VALUES
    ('ngay-10-cau-dung', 'daily', 'Trả lời đúng 10 câu', 'correct_answers', 10, 30, 10, 1),
    ('ngay-1-nut', 'daily', 'Hoàn thành 1 nút trên bản đồ', 'nodes_completed', 1, 20, 5, 2),
    ('ngay-100-diem', 'daily', 'Kiếm 100 điểm học tập', 'xp_earned', 100, 0, 10, 3),
    ('ngay-hoan-hao', 'daily', 'Đạt 100% một bài làm', 'perfect_quizzes', 1, 30, 10, 4),
    ('tuan-1-tran', 'weekly', 'Hoàn thành 1 trận đánh', 'battles_completed', 1, 60, 30, 1),
    ('tuan-50-cau', 'weekly', 'Trả lời đúng 50 câu', 'correct_answers', 50, 100, 40, 2),
    ('tuan-3-bai', 'weekly', 'Hoàn thành 3 bài học', 'lessons_completed', 3, 60, 25, 3),
    ('tuan-5-nut', 'weekly', 'Hoàn thành 5 nút trên bản đồ', 'nodes_completed', 5, 80, 30, 4)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.hk_badges (code, name, description, icon, color, rule, sort_order) VALUES
    ('lan-1-chien-thang', 'Chiến thắng Đông Bộ Đầu', 'Hoàn thành hành trình kháng chiến lần thứ nhất.', 'crown', '#d4a500',
        jsonb_build_object('type', 'campaign_complete', 'campaign_id', (SELECT id FROM public.hist_campaigns WHERE slug = 'khang-chien-lan-1-1258')), 1),
    ('lan-2-chien-thang', 'Hào khí Chương Dương', 'Hoàn thành hành trình kháng chiến lần thứ hai.', 'crown', '#b91c1c',
        jsonb_build_object('type', 'campaign_complete', 'campaign_id', (SELECT id FROM public.hist_campaigns WHERE slug = 'khang-chien-lan-2-1285')), 2),
    ('lan-3-chien-thang', 'Bạch Đằng giang', 'Hoàn thành hành trình kháng chiến lần thứ ba.', 'crown', '#0369a1',
        jsonb_build_object('type', 'campaign_complete', 'campaign_id', (SELECT id FROM public.hist_campaigns WHERE slug = 'khang-chien-lan-3-1287-1288')), 3),
    ('bay-ngay-lien-tiep', 'Bảy ngày bền bỉ', 'Giữ chuỗi học 7 ngày liên tiếp.', 'flame', '#c2410c', '{"type": "streak_days", "value": 7}'::jsonb, 4),
    ('ba-muoi-ngay', 'Ba mươi ngày kiên trì', 'Giữ chuỗi học 30 ngày liên tiếp.', 'flame', '#7e22ce', '{"type": "streak_days", "value": 30}'::jsonb, 5),
    ('tram-cau-dung', 'Trăm câu đúng', 'Trả lời đúng 100 câu hỏi.', 'target', '#15803d', '{"type": "correct_answers", "value": 100}'::jsonb, 6),
    ('diem-tuyet-doi', 'Điểm tuyệt đối', 'Đạt 100% một bài làm.', 'sparkles', '#ff9600', '{"type": "perfect_quizzes", "value": 1}'::jsonb, 7),
    ('chan-hoc', 'Chăm học', 'Hoàn thành 10 nút trên bản đồ.', 'star', '#0369a1', '{"type": "nodes_completed", "value": 10}'::jsonb, 8),
    ('cap-5', 'Đội trưởng', 'Đạt cấp 5.', 'award', '#58cc02', '{"type": "level", "value": 5}'::jsonb, 9),
    ('cap-10', 'Anh hùng Đông A', 'Đạt cấp 10.', 'crown', '#b91c1c', '{"type": "level", "value": 10}'::jsonb, 10),
    ('nha-suu-tam', 'Nhà sưu tầm', 'Sưu tầm 5 thẻ nhân vật khác nhau.', 'gem', '#7e22ce', '{"type": "cards_collected", "value": 5}'::jsonb, 11),
    ('hoc-gia', 'Học giả', 'Tích lũy 1000 điểm.', 'award', '#d4a500', '{"type": "xp_total", "value": 1000}'::jsonb, 12)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.hk_cards (code, name, rarity, drop_weight, figure_id, min_level)
SELECT v.code, v.name, v.rarity, v.weight, (SELECT id FROM public.hist_figures WHERE slug = v.slug), 1
FROM (VALUES
    ('tran-hung-dao', 'Trần Hưng Đạo', 'legendary', 10, 'tran-hung-dao'),
    ('tran-nhan-tong', 'Trần Nhân Tông', 'legendary', 10, 'tran-nhan-tong'),
    ('tran-quoc-toan', 'Trần Quốc Toản', 'rare', 10, 'tran-quoc-toan'),
    ('tran-binh-trong', 'Trần Bình Trọng', 'rare', 10, 'tran-binh-trong'),
    ('tran-quang-khai', 'Trần Quang Khải', 'rare', 10, 'tran-quang-khai'),
    ('tran-khanh-du', 'Trần Khánh Dư', 'rare', 10, 'tran-khanh-du'),
    ('tran-nhat-duat', 'Trần Nhật Duật', 'rare', 10, 'tran-nhat-duat'),
    ('tran-thai-tong', 'Trần Thái Tông', 'common', 10, 'tran-thai-tong'),
    ('tran-thanh-tong', 'Trần Thánh Tông', 'common', 10, 'tran-thanh-tong'),
    ('pham-ngu-lao', 'Phạm Ngũ Lão', 'common', 10, 'pham-ngu-lao'),
    ('yet-kieu', 'Yết Kiêu', 'common', 10, 'yet-kieu'),
    ('le-phu-tran', 'Lê Phụ Trần', 'common', 10, 'le-phu-tran'),
    ('tran-thu-do', 'Trần Thủ Độ', 'common', 10, 'tran-thu-do')
) AS v(code, name, rarity, weight, slug)
ON CONFLICT (code) DO NOTHING;
