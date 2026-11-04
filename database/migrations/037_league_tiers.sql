-- Giải đấu tuần: số hạng cấu hình được (HK.AD.054). Trước đây hạng bị khóa cứng trong khoảng 0–3 (đúng 4 hạng Đồng / Bạc / Vàng / Kim cương);
-- quản trị tổng nay đặt từ 2 đến 8 hạng và tên từng hạng trong cấu hình trò chơi hóa, nên cột hạng được nới lên 0–9 (chừa chỗ, mã nguồn giới hạn ở 8 hạng).
-- Chỉ nới ràng buộc: mọi giá trị hiện có (0–3) vẫn hợp lệ, không đổi dữ liệu nào. Ngày chốt bảng và danh sách tên hạng nằm trong `hk_settings`
-- (khóa `game` và `league_schedule`), do backend ghi qua API có kiểm tra, nên không cần cột mới.

ALTER TABLE public.hk_players DROP CONSTRAINT IF EXISTS hk_players_league_tier_check;
ALTER TABLE public.hk_players ADD CONSTRAINT hk_players_league_tier_check CHECK (league_tier BETWEEN 0 AND 9);

ALTER TABLE public.hk_league_members DROP CONSTRAINT IF EXISTS hk_league_members_tier_check;
ALTER TABLE public.hk_league_members ADD CONSTRAINT hk_league_members_tier_check CHECK (tier BETWEEN 0 AND 9);
