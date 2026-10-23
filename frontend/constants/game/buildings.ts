import type { BuildingDef, BuildingId } from '@/types/gameType';

export const BUILDINGS: BuildingDef[] = [
  { id: 'qtg', name: 'Quốc Tử Giám', desc: 'Nơi khảo thí: trả lời đúng để nhận Ấn Tín và Lương Thảo.', unit: 'ALL_3_WARS_SUMMARY', maxLevel: 3, start: 1, buildCost: 0, pos: { x: 3, y: 2, w: 31, h: 29 }, levelText: (l) => `Mỗi câu đúng +${qtgFood(l)} Lương Thảo` },
  { id: 'hoiquan', name: 'Hội Quán Vạn Kiếp', desc: 'Chiêu mộ, kết nghĩa và tiến hóa tướng.', unit: 'BINH_THAN_CONFERENCE', maxLevel: 3, start: 1, buildCost: 0, pos: { x: 66, y: 2, w: 31, h: 29 }, levelText: (l) => `Thời gian triệu tập giảm ${(l - 1) * 25}%` },
  { id: 'doanh', name: 'Doanh Trại', desc: 'Nơi ở của tướng và quân năm hệ.', unit: 'ALL_3_WARS_SUMMARY', maxLevel: 3, start: 1, buildCost: 0, pos: { x: 36, y: 20, w: 28, h: 25 }, levelText: (l) => `Khí lực của tướng +${(l - 1) * 6}%` },
  { id: 'ruong', name: 'Ruộng Ngụ Binh', desc: 'Sinh Lương Thảo theo thời gian. Thời bình binh lính về đây làm ruộng.', unit: 'GAME_NGU_BINH_U_NONG', maxLevel: 5, start: 1, buildCost: 0, pos: { x: 3, y: 36, w: 33, h: 27 }, levelText: (l) => `${farmRate(l)} Lương Thảo mỗi giờ` },
  { id: 'trai', name: 'Trại Ngụ Binh', desc: 'Đổi Lương Thảo thành Quân Lực, gọi dân binh.', unit: 'GAME_NGU_BINH_U_NONG', maxLevel: 5, start: 1, buildCost: 0, pos: { x: 66, y: 36, w: 31, h: 26 }, levelText: (l) => `Quân Lực tối đa ${troopCap(l)}` },
  { id: 'kho', name: 'Kho Bí Mật', desc: 'Cất giữ Lương Thảo; khi giặc đến cướp lương có thể giấu hết vào kho.', unit: 'KC1_VUON_KHONG_NHA_TRONG', maxLevel: 5, start: 1, buildCost: 0, pos: { x: 38, y: 49, w: 24, h: 22 }, levelText: (l) => `Chứa tối đa ${storeCap(l)} Lương Thảo` },
  { id: 'xuong', name: 'Xưởng Cọc Bạch Đằng', desc: 'Đẽo cọc cho trận địa Bạch Đằng: cấp càng cao, Đại trận Bạch Đằng càng mạnh.', unit: 'KC3_BACH_DANG_HOW', maxLevel: 3, start: 0, buildCost: 150, pos: { x: 4, y: 68, w: 28, h: 26 }, levelText: (l) => ['Chưa xây', 'Cọc gỗ đẽo nhọn', 'Cọc gỗ đầu bịt sắt', 'Trận địa cọc kết hợp mai phục'][l] },
  { id: 'ben', name: 'Bến Vân Đồn', desc: 'Đóng thuyền, gọi thủy binh phục kích đoàn lương địch.', unit: 'KC3_VAN_DON', maxLevel: 3, start: 0, buildCost: 120, pos: { x: 63, y: 70, w: 34, h: 26 }, levelText: (l) => (l === 0 ? 'Chưa xây' : `Phục kích mạnh thêm ${(l - 1) * 20}%`) },
];

export const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b])) as Record<BuildingId, BuildingDef>;

/** Lương Thảo mỗi giờ của Ruộng Ngụ Binh */
export const farmRate = (level: number) => Math.round(60 * Math.pow(1.5, Math.max(0, level - 1)));

/** Trần Lương Thảo chưa thu trên ruộng: 8 giờ sản lượng */
export const farmCap = (level: number) => farmRate(level) * 8;

export const storeCap = (level: number) => Math.round(600 * Math.pow(1.5, Math.max(0, level - 1)));

export const troopCap = (level: number) => 30 + (level - 1) * 20;

export const qtgFood = (level: number) => [0, 5, 8, 12][Math.min(3, level)];

export const UPGRADE_SECONDS = [0, 0, 30, 120, 300, 600];

export const upgradeCost = (b: BuildingDef, toLevel: number) => ({
  luong: Math.round((b.buildCost || 80) * Math.pow(1.6, Math.max(0, toLevel - 1))),
  gems: toLevel >= 3 ? 20 * (toLevel - 2) : 0,
});
