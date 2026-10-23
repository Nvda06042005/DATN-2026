import { BicepsFlexed, BookOpen, Crown, Flame, Sailboat, ScrollText, ShoppingBasket, Users, Waves } from 'lucide-react';
import type { CardDef, RecipeDef } from '@/types/gameType';

export const CARDS: Record<string, CardDef> = {
  dan_binh: { id: 'dan_binh', name: 'Dân binh Ngụ Binh', kind: 'nhan_luc', desc: 'Thời bình làm ruộng, có giặc thì ra trận.', lore: 'chinh_su', how: 'Gọi ở Trại Ngụ Binh', Icon: Users },
  thuy_binh: { id: 'thuy_binh', name: 'Thủy binh', kind: 'nhan_luc', desc: 'Quân giỏi đánh trên sông nước.', lore: 'chinh_su', how: 'Gọi ở Bến Vân Đồn', Icon: Sailboat },
  quan_sat_that: { id: 'quan_sat_that', name: 'Quân Sát Thát', kind: 'nhan_luc', desc: 'Quân sĩ thích chữ “Sát Thát” lên cánh tay.', lore: 'chinh_su', how: 'Huấn luyện ở Trại Ngụ Binh (sau khi chiêu mộ Quân Sát Thát)', Icon: BicepsFlexed },
  tuong_hoang_toc: { id: 'tuong_hoang_toc', name: 'Tướng hoàng tộc', kind: 'nhan_luc', desc: 'Vương hầu nhà Trần cùng nhau gánh vác việc nước.', lore: 'chinh_su', how: 'Phần thưởng khi hoàn thành Màn 1', Icon: Crown },
  hich_tuong_si: { id: 'hich_tuong_si', name: 'Hịch tướng sĩ', kind: 'su_kien', desc: 'Lời kêu gọi tướng sĩ của Trần Quốc Tuấn (1284).', lore: 'chinh_su', unit: 'HICH_TUONG_SI', how: 'Trả lời đúng câu hỏi về Hịch tướng sĩ', Icon: ScrollText },
  binh_than: { id: 'binh_than', name: 'Hội nghị Bình Than', kind: 'su_kien', desc: 'Vương hầu, trăm quan bàn kế đánh giặc (10/1282).', lore: 'chinh_su', unit: 'BINH_THAN_CONFERENCE', how: 'Trả lời đúng câu hỏi về Hội nghị Bình Than', Icon: Users },
  nguoi_buon_than: { id: 'nguoi_buon_than', name: 'Người buôn than Chí Linh', kind: 'su_kien', desc: 'Trần Khánh Dư từng sống bằng nghề buôn than.', lore: 'chinh_su', unit: 'GAME_TRAN_KHANH_DU', how: 'Trả lời đúng câu hỏi về Trần Khánh Dư', Icon: Flame },
  binh_thu: { id: 'binh_thu', name: 'Binh thư yếu lược', kind: 'su_kien', desc: 'Sách binh pháp của Trần Quốc Tuấn.', lore: 'chinh_su', unit: 'GAME_BINH_THU_YEU_LUOC', how: 'Trả lời đúng câu hỏi về Binh thư yếu lược', Icon: BookOpen },
  sot_tre: { id: 'sot_tre', name: 'Sọt tre bên đường', kind: 'su_kien', desc: 'Phạm Ngũ Lão ngồi đan sọt mải nghĩ việc nước.', lore: 'giai_thoai', unit: 'PHAM_NGU_LAO', how: 'Trả lời đúng câu hỏi về Phạm Ngũ Lão', Icon: ShoppingBasket },
  song_sau: { id: 'song_sau', name: 'Sông sâu', kind: 'su_kien', desc: 'Người giỏi bơi lặn có thể lặn sâu dưới sông.', lore: 'giai_thoai', unit: 'YET_KIEU_DA_TUONG', how: 'Trả lời đúng câu hỏi về Yết Kiêu', Icon: Waves },
};

export const RECIPES: RecipeDef[] = [
  { id: 'r_sat_that', hero: 'quan_sat_that', inputs: ['dan_binh', 'hich_tuong_si'], gems: 20, luong: 80, waitSec: 45, questions: 1, units: ['HICH_TUONG_SI'], lesson: 'Hịch tướng sĩ khích lệ quân sĩ thích chữ “Sát Thát” trước kháng chiến lần thứ hai.' },
  { id: 'r_yet_kieu', hero: 'yet_kieu', inputs: ['thuy_binh', 'song_sau'], gems: 20, luong: 100, waitSec: 45, questions: 1, units: ['YET_KIEU_DA_TUONG'], lesson: 'Yết Kiêu giỏi bơi lặn, theo truyền thuyết lặn đục thuyền giặc.' },
  { id: 'r_quoc_toan', hero: 'tran_quoc_toan', inputs: ['quan_sat_that', 'binh_than'], gems: 40, luong: 160, waitSec: 90, questions: 2, units: ['TQT_WHY_ORANGE', 'TQT_SIX_GOLDEN_WORDS'], lesson: 'Không được dự Hội nghị Bình Than, Trần Quốc Toản bóp nát quả cam rồi lập đội quân riêng.' },
  { id: 'r_ngu_lao', hero: 'pham_ngu_lao', inputs: ['dan_binh', 'sot_tre'], gems: 40, luong: 160, waitSec: 90, questions: 2, units: ['PHAM_NGU_LAO'], lesson: 'Phạm Ngũ Lão đan sọt mải nghĩ việc nước nên được Trần Hưng Đạo trọng dụng.' },
  { id: 'r_khanh_du', hero: 'tran_khanh_du', inputs: ['thuy_binh', 'nguoi_buon_than'], gems: 60, luong: 220, waitSec: 150, questions: 2, units: ['GAME_TRAN_KHANH_DU', 'KC3_VAN_DON'], lesson: 'Từ người buôn than ở Chí Linh, Trần Khánh Dư lập công lớn ở Vân Đồn.' },
  { id: 'r_hung_dao', hero: 'tran_hung_dao', inputs: ['tuong_hoang_toc', 'binh_thu'], gems: 80, luong: 280, waitSec: 240, questions: 3, units: ['TRAN_HUNG_DAO_PORTRAIT', 'HICH_TUONG_SI', 'GAME_BINH_THU_YEU_LUOC'], lesson: 'Quốc công Tiết chế Trần Quốc Tuấn, tác giả Hịch tướng sĩ và Binh thư yếu lược.' },
];
