import { ChessKnight, Crown, Droplets, Flame, Leaf, Mountain, Package, Ship, Swords } from 'lucide-react';
import type { ElementId, EnemyType, IconType, Lore, Tier } from '@/types/gameType';

export const ELEMENTS: Record<ElementId, { name: string; place: string; desc: string; Icon: IconType; fill: string; soft: string; text: string }> = {
  thuy: { name: 'Thủy', place: 'Thủy trại Vạn Kiếp – Bạch Đằng', desc: 'Đánh thuyền, phục kích đường sông', Icon: Droplets, fill: 'bg-thuy', soft: 'bg-thuy-nhat', text: 'text-thuy-chu' },
  moc: { name: 'Mộc', place: 'Mật khu Thiên Trường – Trường Yên', desc: 'Đánh kỵ binh nơi rừng rậm, đầm lầy', Icon: Leaf, fill: 'bg-moc', soft: 'bg-moc-nhat', text: 'text-moc-chu' },
  tho: { name: 'Thổ', place: 'Biên ải Nội Bàng – Chí Linh', desc: 'Thủ chỗ hiểm, chặn đường tiến', Icon: Mountain, fill: 'bg-tho', soft: 'bg-tho-nhat', text: 'text-tho-chu' },
  hoa: { name: 'Hỏa', place: 'Hội thề Bình Than – Diên Hồng', desc: 'Hào khí, tăng sĩ khí cả đội', Icon: Flame, fill: 'bg-hoa', soft: 'bg-hoa-nhat', text: 'text-hoa-chu' },
  thong: { name: 'Thống soái', place: 'Phủ đệ Hưng Đạo Vương', desc: 'Kế sách chiến lược, đổi thế trận', Icon: Crown, fill: 'bg-thong', soft: 'bg-thong-nhat', text: 'text-thong-chu' },
};

export const LORE_LABEL: Record<Lore, string> = {
  chinh_su: 'Chính sử',
  giai_thoai: 'Giai thoại – truyền thuyết',
  sang_tao: 'Sáng tạo của game',
  dan_gian: 'Dân gian – cần đối chiếu',
};

export const TIER_INFO: Record<Tier, { name: string; stars: number }> = {
  hiem: { name: 'Hiếm', stars: 1 },
  su_thi: { name: 'Sử thi', stars: 2 },
  huyen_thoai: { name: 'Huyền thoại', stars: 3 },
  tiet_che: { name: 'Tiết Chế', stars: 4 },
};

/** Loại quân địch – điểm mạnh, hệ khắc chế và bài học lịch sử */
export const ENEMY_TYPES: Record<EnemyType, { name: string; strong: string; weak: ElementId[]; lesson: string; Icon: IconType }> = {
  ky: { name: 'Thiết kỵ', strong: 'Tốc độ, càn quét đồng bằng', weak: ['moc', 'tho'], lesson: 'Kỵ binh khó xoay trở nơi rừng núi, sông nước; thiếu lương thì kiệt sức.', Icon: ChessKnight },
  bo: { name: 'Bộ binh', strong: 'Quân đông, đánh thành', weak: ['tho', 'hoa'], lesson: 'Giữ chỗ hiểm và giữ vững sĩ khí thì quân đông cũng khó tiến.', Icon: Swords },
  thuyen: { name: 'Chiến thuyền', strong: 'Thuyền lớn, quân đông', weak: ['thuy'], lesson: 'Bạch Đằng 1288: thuyền giặc mắc cọc khi thủy triều rút.', Icon: Ship },
  luong: { name: 'Đoàn lương', strong: 'Nuôi cả đạo quân (hồi phục mỗi lượt)', weak: ['thuy'], lesson: 'Vân Đồn: mất thuyền lương, quân Nguyên lâm vào cảnh thiếu đói.', Icon: Package },
};
