-- Hòm báu trên bản đồ Hành trình Đông A (17/11/2026): giữa hai chặng liền nhau và ở cuối mỗi phần có một hòm báu; học sinh xong chặng trước
-- (hoặc xong cả phần) thì mở hòm nhận vàng / điểm. Phần thưởng ghi vào sổ cái có sẵn (hk_gold_ledger, hk_points) với ref_key `hq:chest:<mã hòm>`
-- nên mỗi hòm chỉ trao một lần (ràng buộc duy nhất của sổ cái). Migration này chỉ thêm lý do 'chest' vào ràng buộc kiểm tra của hai sổ cái;
-- giữ nguyên các lý do cũ, không đổi dữ liệu, không đổi quyền.
ALTER TABLE public.hk_points DROP CONSTRAINT IF EXISTS hk_points_reason_check;
ALTER TABLE public.hk_points ADD CONSTRAINT hk_points_reason_check CHECK (reason IN ('node', 'lesson', 'practice', 'quest', 'goal', 'gift', 'contest', 'battle', 'minigame', 'assignment', 'teacher', 'live', 'chest'));
ALTER TABLE public.hk_gold_ledger DROP CONSTRAINT IF EXISTS hk_gold_ledger_reason_check;
ALTER TABLE public.hk_gold_ledger ADD CONSTRAINT hk_gold_ledger_reason_check CHECK (reason IN ('node', 'quest', 'goal', 'gift', 'level', 'card', 'shop', 'contest', 'badge', 'battle', 'minigame', 'assignment', 'teacher', 'chest'));
