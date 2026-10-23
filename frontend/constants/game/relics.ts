import { BookOpen, Feather, Flag, ScrollText, Sparkles } from 'lucide-react';
import type { RelicDef } from '@/types/gameType';

export const RELICS: Record<string, RelicDef> = {
  hich: { id: 'hich', name: 'Hịch tướng sĩ', effect: 'Hồi đầy khí lực cho cả đội, 1 lần mỗi trận.', lore: 'chinh_su', story: 'Trần Quốc Tuấn viết Hịch tướng sĩ năm 1284, khích lệ tướng sĩ trước kháng chiến lần thứ hai.', how: 'Vượt tầng 5 Tháp Khảo Thí', Icon: ScrollText },
  co_sau_chu: { id: 'co_sau_chu', name: 'Cờ thêu sáu chữ vàng', effect: 'Hồi sinh 1 tướng với 50% khí lực, 1 lần mỗi trận.', lore: 'chinh_su', story: '“Phá cường địch, báo hoàng ân” – lá cờ của đội quân Trần Quốc Toản.', how: 'Hoàn thành Màn 1', Icon: Flag },
  tung_gia: { id: 'tung_gia', name: 'Thơ “Tụng giá hoàn kinh sư”', effect: 'Hành quân thần tốc: cả đội được hành động thêm một lượt, 1 lần mỗi trận.', lore: 'chinh_su', story: 'Trần Quang Khải làm bài thơ khi phò giá về kinh sau chiến thắng 1285: “Đoạt sáo Chương Dương độ, Cầm Hồ Hàm Tử quan”.', how: 'Hoàn thành Màn 2', Icon: Feather },
  binh_thu_relic: { id: 'binh_thu_relic', name: 'Binh thư yếu lược', effect: 'Thấy trước ý đồ của địch thêm một lượt.', lore: 'chinh_su', story: 'Sách binh pháp do Trần Quốc Tuấn biên soạn để dạy các tướng.', how: 'Vượt tầng 10 Tháp Khảo Thí', Icon: BookOpen },
  non_ma_loi: { id: 'non_ma_loi', name: 'Nón Ma Lôi', effect: 'Tướng hệ Thủy có 25% cơ hội né đòn.', lore: 'dan_gian', story: 'Nguồn phổ thông kể nón làng Ma Lôi được dùng trong thủy quân của Trần Khánh Dư. Chưa có tư liệu học thuật xác nhận – cần đối chiếu.', how: 'Nâng Bến Vân Đồn lên cấp 3', Icon: Sparkles },
};
