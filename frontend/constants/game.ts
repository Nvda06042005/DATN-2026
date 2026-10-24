/** Dữ liệu game: hệ quân, công trình Điền Trang, quân địch, chiêu mộ, cổ vật, nhiệm vụ ngày, Sử Ký, Tháp Khảo Thí, lược đồ */
import {
  BicepsFlexed, BookOpen, ChessKnight, Crosshair, Crown, Droplets, Feather, Flag, Flame, Footprints, Landmark, Leaf, Megaphone, MessageSquare, Mountain, Package, Sailboat, ScrollText, ShieldCheck, Ship, ShoppingBasket, Sparkles, Sprout, Stamp, Swords, Tent, Users, Utensils, Waves, Wheat,
} from 'lucide-react-native';
import type { Palette } from '@/constants/theme';
import type {
  BuildingDef, BuildingId, CardDef, DailyTaskDef, ElementId, EnemyDef, EnemyType, GameTab, HeroDef, IconType, IntentId, Lore, PlaceId, RecipeDef, RelicDef, TideState, Tier,
} from '@/types/game';

type ColorKey = keyof Palette;

// ---------------------------------------------------------------------- elements
export const ELEMENTS: Record<ElementId, { name: string; place: string; desc: string; Icon: IconType; fill: ColorKey; soft: ColorKey; text: ColorKey }> = {
  thuy: { name: 'Thủy', place: 'Thủy trại Vạn Kiếp – Bạch Đằng', desc: 'Đánh thuyền, phục kích đường sông', Icon: Droplets, fill: 'thuy', soft: 'thuyNhat', text: 'thuyChu' },
  moc: { name: 'Mộc', place: 'Mật khu Thiên Trường – Trường Yên', desc: 'Đánh kỵ binh nơi rừng rậm, đầm lầy', Icon: Leaf, fill: 'moc', soft: 'mocNhat', text: 'mocChu' },
  tho: { name: 'Thổ', place: 'Biên ải Nội Bàng – Chí Linh', desc: 'Thủ chỗ hiểm, chặn đường tiến', Icon: Mountain, fill: 'tho', soft: 'thoNhat', text: 'thoChu' },
  hoa: { name: 'Hỏa', place: 'Hội thề Bình Than – Diên Hồng', desc: 'Hào khí, tăng sĩ khí cả đội', Icon: Flame, fill: 'hoa', soft: 'hoaNhat', text: 'hoaChu' },
  thong: { name: 'Thống soái', place: 'Phủ đệ Hưng Đạo Vương', desc: 'Kế sách chiến lược, đổi thế trận', Icon: Crown, fill: 'thong', soft: 'thongNhat', text: 'thongChu' },
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

// ---------------------------------------------------------------------- buildings
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

// ---------------------------------------------------------------------- battle
export const INTENT_INFO: Record<IntentId, { name: string; desc: string; Icon: IconType; danger: boolean }> = {
  strike: { name: 'Đánh thường', desc: 'Tấn công một tướng', Icon: Swords, danger: false },
  charge: { name: 'Càn quét', desc: 'Đòn rất mạnh vào tướng yếu nhất', Icon: Footprints, danger: true },
  volley: { name: 'Mưa tên', desc: 'Bắn vào cả đội ta', Icon: Crosshair, danger: true },
  forage: { name: 'Cướp lương', desc: 'Hồi khí lực và sức bền – bị chặn khi ta bỏ trống làng mạc', Icon: Utensils, danger: false },
  roar: { name: 'Hò hét', desc: 'Làm một tướng hoảng sợ, mất lượt', Icon: Megaphone, danger: false },
  supply: { name: 'Tiếp lương', desc: 'Hồi phục cho cả quân địch', Icon: Package, danger: false },
  brace: { name: 'Thủ thế', desc: 'Tăng phòng thủ trong lượt tới', Icon: ShieldCheck, danger: false },
};

export const TIDE_CYCLE: TideState[] = ['len', 'len', 'dung', 'rut'];

export const TIDE_LABEL: Record<TideState, string> = { len: 'Triều lên', dung: 'Triều đứng', rut: 'Triều rút' };

// ---------------------------------------------------------------------- enemies
export const ENEMIES: Record<string, EnemyDef> = {
  ngot_luong_hop_thai: {
    id: 'ngot_luong_hop_thai',
    name: 'Ngột Lương Hợp Thai',
    type: 'ky',
    boss: true,
    base: { hp: 420, atk: 30, def: 10, spd: 13 },
    intents: ['charge', 'roar', 'forage', 'strike'],
    note: 'Tướng Mông Cổ chỉ huy cuộc xâm lược Đại Việt năm 1258.',
    defeatText: 'Ngột Lương Hợp Thai rút chạy khỏi Thăng Long',
  },
  thiet_ky: { id: 'thiet_ky', name: 'Thiết kỵ Mông Cổ', type: 'ky', base: { hp: 150, atk: 22, def: 7, spd: 14 }, intents: ['charge', 'strike', 'forage'], note: 'Kỵ binh tinh nhuệ của Mông Cổ.', defeatText: 'Thiết kỵ tan vỡ' },
  cung_thu: { id: 'cung_thu', name: 'Cung thủ Mông Cổ', type: 'bo', base: { hp: 115, atk: 18, def: 5, spd: 12 }, intents: ['volley', 'strike'], note: 'Bắn tên từ xa.', defeatText: 'Cung thủ bỏ chạy' },
  bo_binh: { id: 'bo_binh', name: 'Bộ binh Nguyên', type: 'bo', base: { hp: 160, atk: 20, def: 9, spd: 10 }, intents: ['strike', 'brace', 'forage'], note: 'Bộ binh đông đảo của quân Nguyên.', defeatText: 'Bộ binh tan vỡ' },
  giu_ben: { id: 'giu_ben', name: 'Quân Nguyên giữ bến', type: 'bo', boss: true, base: { hp: 320, atk: 25, def: 11, spd: 10 }, intents: ['strike', 'volley', 'brace'], note: 'Quân Nguyên đóng giữ các bến sông năm 1285.', defeatText: 'Quân Nguyên bỏ bến tháo chạy' },
  chien_thuyen: { id: 'chien_thuyen', name: 'Chiến thuyền Nguyên', type: 'thuyen', base: { hp: 190, atk: 21, def: 11, spd: 8 }, intents: ['strike', 'volley', 'brace'], note: 'Thuyền chiến lớn của thủy quân Nguyên.', defeatText: 'Chiến thuyền vỡ đắm' },
  thuyen_lon: { id: 'thuyen_lon', name: 'Đội thuyền lớn', type: 'thuyen', boss: true, base: { hp: 330, atk: 26, def: 12, spd: 8 }, intents: ['volley', 'strike', 'brace'], note: 'Đội thuyền chiến chủ lực của quân Nguyên.', defeatText: 'Đội thuyền lớn mắc cọc, vỡ tan' },
  thuyen_luong: { id: 'thuyen_luong', name: 'Thuyền lương', type: 'luong', base: { hp: 170, atk: 6, def: 7, spd: 6 }, intents: ['supply', 'brace'], note: 'Thuyền chở lương nuôi quân Nguyên.', defeatText: 'Thuyền lương bị đánh đắm' },
  truong_van_ho: {
    id: 'truong_van_ho',
    name: 'Trương Văn Hổ',
    type: 'luong',
    boss: true,
    base: { hp: 320, atk: 14, def: 9, spd: 8 },
    intents: ['supply', 'brace', 'strike'],
    note: 'Tướng Nguyên chỉ huy đoàn thuyền lương năm 1287 – 1288.',
    defeatText: 'Trương Văn Hổ bỏ chạy, đoàn thuyền lương bị đánh đắm',
    fleeAt: 0.35,
  },
  thoat_hoan: {
    id: 'thoat_hoan',
    name: 'Thoát Hoan',
    type: 'bo',
    boss: true,
    base: { hp: 460, atk: 30, def: 11, spd: 11 },
    intents: ['strike', 'roar', 'volley', 'charge'],
    note: 'Con trai Hốt Tất Liệt, chỉ huy quân Nguyên năm 1285 và 1287 – 1288.',
    defeatText: 'Thoát Hoan tháo chạy',
    fleeAt: 0.3,
  },
  toa_do: { id: 'toa_do', name: 'Toa Đô', type: 'bo', boss: true, base: { hp: 380, atk: 31, def: 10, spd: 12 }, intents: ['charge', 'strike', 'roar'], note: 'Tướng Nguyên đánh từ Chăm-pa lên phía Nam năm 1285.', defeatText: 'Toa Đô tử trận ở Tây Kết' },
  o_ma_nhi: { id: 'o_ma_nhi', name: 'Ô Mã Nhi', type: 'thuyen', boss: true, base: { hp: 440, atk: 28, def: 12, spd: 10 }, intents: ['volley', 'strike', 'brace'], note: 'Tướng chỉ huy thủy quân Nguyên.', defeatText: 'Ô Mã Nhi bị bắt sống', capture: true },
};

// ---------------------------------------------------------------------- recruit
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

// ---------------------------------------------------------------------- relics
export const RELICS: Record<string, RelicDef> = {
  hich: { id: 'hich', name: 'Hịch tướng sĩ', effect: 'Hồi đầy khí lực cho cả đội, 1 lần mỗi trận.', lore: 'chinh_su', story: 'Trần Quốc Tuấn viết Hịch tướng sĩ năm 1284, khích lệ tướng sĩ trước kháng chiến lần thứ hai.', how: 'Vượt tầng 5 Tháp Khảo Thí', Icon: ScrollText },
  co_sau_chu: { id: 'co_sau_chu', name: 'Cờ thêu sáu chữ vàng', effect: 'Hồi sinh 1 tướng với 50% khí lực, 1 lần mỗi trận.', lore: 'chinh_su', story: '“Phá cường địch, báo hoàng ân” – lá cờ của đội quân Trần Quốc Toản.', how: 'Hoàn thành Màn 1', Icon: Flag },
  tung_gia: { id: 'tung_gia', name: 'Thơ “Tụng giá hoàn kinh sư”', effect: 'Hành quân thần tốc: cả đội được hành động thêm một lượt, 1 lần mỗi trận.', lore: 'chinh_su', story: 'Trần Quang Khải làm bài thơ khi phò giá về kinh sau chiến thắng 1285: “Đoạt sáo Chương Dương độ, Cầm Hồ Hàm Tử quan”.', how: 'Hoàn thành Màn 2', Icon: Feather },
  binh_thu_relic: { id: 'binh_thu_relic', name: 'Binh thư yếu lược', effect: 'Thấy trước ý đồ của địch thêm một lượt.', lore: 'chinh_su', story: 'Sách binh pháp do Trần Quốc Tuấn biên soạn để dạy các tướng.', how: 'Vượt tầng 10 Tháp Khảo Thí', Icon: BookOpen },
  non_ma_loi: { id: 'non_ma_loi', name: 'Nón Ma Lôi', effect: 'Tướng hệ Thủy có 25% cơ hội né đòn.', lore: 'dan_gian', story: 'Nguồn phổ thông kể nón làng Ma Lôi được dùng trong thủy quân của Trần Khánh Dư. Chưa có tư liệu học thuật xác nhận – cần đối chiếu.', how: 'Nâng Bến Vân Đồn lên cấp 3', Icon: Sparkles },
};

// ---------------------------------------------------------------------- daily-tasks
export const DAILY_TASKS: DailyTaskDef[] = [
  { id: 'harvest', text: 'Thu hoạch Ruộng Ngụ Binh', target: 1, metric: 'harvest', reward: { luong: 40, quan: 3 }, Icon: Wheat },
  { id: 'correct5', text: 'Trả lời đúng 5 câu', target: 5, metric: 'correct', reward: { luong: 60, quan: 4 }, Icon: Stamp },
  { id: 'session', text: 'Hoàn thành 1 lượt khảo thí', target: 1, metric: 'session', reward: { luong: 50, quan: 3 }, Icon: Landmark },
  { id: 'battle', text: 'Đánh 1 trận chiến dịch', target: 1, metric: 'battle', reward: { luong: 60, quan: 5 }, Icon: Swords },
  { id: 'codex', text: 'Đọc 1 thẻ Sử Ký', target: 1, metric: 'codex', reward: { luong: 30, quan: 2 }, Icon: ScrollText },
  { id: 'ask', text: 'Hỏi Quân Sư 1 câu', target: 1, metric: 'ask', reward: { luong: 30, quan: 2 }, Icon: MessageSquare },
];

// ---------------------------------------------------------------------- codex
export const TIMELINE: Array<{ date: string; title: string; place?: PlaceId; units: string[] }> = [
  { date: 'Trước 1258', title: 'Mông Cổ âm mưu xâm lược, vua Trần bắt giam sứ giả', units: ['KC1_WHY_INVADE'] },
  { date: 'Tháng 1/1258', title: 'Trận Bình Lệ Nguyên – rút lui bảo toàn lực lượng', place: 'binh_le_nguyen', units: ['KC1_BINH_LE_NGUYEN', 'KC1_TRAN_THU_DO_QUOTE'] },
  { date: 'Tháng 1/1258', title: 'Vườn không nhà trống ở Thăng Long', place: 'thang_long', units: ['KC1_VUON_KHONG_NHA_TRONG'] },
  { date: '29/1/1258', title: 'Đại thắng Đông Bộ Đầu', place: 'dong_bo_dau', units: ['KC1_DONG_BO_DAU', 'KC1_OVERVIEW'] },
  { date: '10/1282', title: 'Hội nghị Bình Than – Trần Quốc Toản bóp nát quả cam', place: 'binh_than', units: ['BINH_THAN_CONFERENCE', 'TQT_WHY_ORANGE', 'TQT_SIX_GOLDEN_WORDS', 'TQT_OVERVIEW'] },
  { date: '1284', title: 'Hịch tướng sĩ – tinh thần Sát Thát', units: ['HICH_TUONG_SI', 'GAME_BINH_THU_YEU_LUOC', 'TRAN_HUNG_DAO_PORTRAIT'] },
  { date: 'Đầu năm 1285', title: 'Hội nghị Diên Hồng – “Đánh!”', place: 'thang_long', units: ['DIEN_HONG_CONFERENCE'] },
  { date: '1285', title: 'Thoát Hoan và Toa Đô đánh gọng kìm', units: ['KC2_OVERVIEW'] },
  { date: '2/1285', title: 'Trần Bình Trọng chặn giặc, giữ đường rút', units: ['KC2_TRAN_BINH_TRONG'] },
  { date: '5 – 6/1285', title: 'Tổng phản công: Hàm Tử, Chương Dương, Tây Kết', place: 'chuong_duong', units: ['KC2_HAM_TU_CHUONG_DUONG'] },
  { date: '6/1285', title: 'Thoát Hoan chui ống đồng tháo chạy', place: 'van_kiep', units: ['KC2_THOAT_HOAN_COPPER_PIPE'] },
  { date: 'Cuối 1287 – đầu 1288', title: 'Trần Khánh Dư phục kích ở Vân Đồn', place: 'van_don', units: ['KC3_VAN_DON', 'GAME_TRAN_KHANH_DU', 'KC3_OVERVIEW'] },
  { date: '4/1288', title: 'Đại thắng Bạch Đằng – bắt sống Ô Mã Nhi', place: 'bach_dang', units: ['KC3_BACH_DANG_HOW'] },
  { date: '1258 – 1288', title: 'Nguyên nhân thắng lợi và ý nghĩa lịch sử', units: ['ALL_3_WARS_SUMMARY', 'CAUSES_OF_VICTORY', 'HISTORICAL_SIGNIFICANCE'] },
];

// ---------------------------------------------------------------------- exam
export const CATEGORY_LABEL: Record<string, string> = {
  KHANG_CHIEN_LAN_1_1258: 'Kháng chiến lần thứ nhất (1258)',
  BINH_THAN_TRAN_QUOC_TOAN: 'Hội nghị Bình Than & Trần Quốc Toản',
  DIEN_HONG_HICH_TUONG_SI: 'Diên Hồng, Hịch tướng sĩ & Trần Hưng Đạo',
  KHANG_CHIEN_LAN_2_1285: 'Kháng chiến lần thứ hai (1285)',
  HAI_CHIEN_VAN_DON_1288: 'Trận Vân Đồn (1288)',
  DAI_THANG_BACH_DANG_1288: 'Đại thắng Bạch Đằng (1288)',
  NGUYEN_NHAN_Y_NGHIA: 'Nguyên nhân thắng lợi & ý nghĩa',
  DANH_TUONG_GIA_THAN: 'Danh tướng & gia tướng',
  NEN_TANG_QUAN_SU: 'Nền tảng quân sự Đại Việt',
};

export const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL);

export const TOWER_FLOORS = Array.from({ length: 10 }, (_, i) => {
  const floor = i + 1;
  const boss = floor % 5 === 0;
  return {
    floor,
    boss,
    count: boss ? 5 : 3,
    pass: boss ? 4 : 2,
    levels: floor <= 3 ? ['NHAN_BIET'] : floor <= 7 ? ['THONG_HIEU', 'NHAN_BIET'] : ['VAN_DUNG', 'THONG_HIEU'],
    levelText: floor <= 3 ? 'Nhận biết' : floor <= 7 ? 'Thông hiểu' : 'Vận dụng',
    relic: floor === 5 ? 'hich' : floor === 10 ? 'binh_thu_relic' : null,
    luong: 40 * floor,
  };
});

// ---------------------------------------------------------------------- places
export const MAP_PLACES: Record<PlaceId, { name: string; x: number; y: number; anchor?: 'start' | 'end' | 'middle'; dy?: number }> = {
  lang_son: { name: 'Lạng Sơn', x: 296, y: 58 },
  noi_bang: { name: 'Nội Bàng', x: 282, y: 128 },
  binh_le_nguyen: { name: 'Bình Lệ Nguyên', x: 132, y: 150, anchor: 'end' },
  thang_long: { name: 'Thăng Long', x: 178, y: 206, anchor: 'end' },
  dong_bo_dau: { name: 'Đông Bộ Đầu', x: 196, y: 186, anchor: 'end', dy: -10 },
  binh_than: { name: 'Bình Than', x: 246, y: 172, dy: -14 },
  van_kiep: { name: 'Vạn Kiếp', x: 278, y: 196 },
  yen_tu: { name: 'Yên Tử', x: 326, y: 168 },
  bach_dang: { name: 'Bạch Đằng', x: 334, y: 236 },
  van_don: { name: 'Vân Đồn', x: 392, y: 200, anchor: 'end', dy: -16 },
  chuong_duong: { name: 'Chương Dương', x: 190, y: 240, anchor: 'end' },
  ham_tu: { name: 'Hàm Tử', x: 222, y: 260 },
  tay_ket: { name: 'Tây Kết', x: 238, y: 282 },
  thien_truong: { name: 'Thiên Trường', x: 246, y: 322 },
  truong_yen: { name: 'Trường Yên', x: 192, y: 342, anchor: 'end' },
  thanh_hoa: { name: 'Thanh Hóa', x: 176, y: 404, anchor: 'end' },
  champa: { name: 'Chăm-pa', x: 246, y: 492 },
};

// ---------------------------------------------------------------------- tabs
export const GAME_TABS: Array<{ id: GameTab; label: string; Icon: IconType }> = [
  { id: 'farm', label: 'Điền Trang', Icon: Sprout },
  { id: 'barracks', label: 'Doanh Trại', Icon: Tent },
  { id: 'campaign', label: 'Chiến Dịch', Icon: Swords },
  { id: 'exam', label: 'Quốc Tử Giám', Icon: Landmark },
  { id: 'codex', label: 'Sử Ký', Icon: ScrollText },
];

// ---------------------------------------------------------------------- chỉ số tướng
/** Chỉ số tướng theo giai đoạn tiến hóa và cấp Doanh Trại */
export const heroStats = (hero: HeroDef, stage: number, doanhLevel: number) => {
  const m = 1 + (stage - 1) * 0.2;
  const hpBonus = 1 + (Math.max(1, doanhLevel) - 1) * 0.06;
  return {
    hp: Math.round(hero.base.hp * m * hpBonus),
    atk: Math.round(hero.base.atk * m),
    def: Math.round(hero.base.def * m),
    spd: hero.base.spd + (stage - 1),
  };
};

export const EVOLVE_BATTLES = [0, 2, 4];

export const evolveCost = (stage: number) => ({ luong: 150 * stage, gems: 30 * stage });

export const heroJoinHint = (hero: HeroDef) => {
  if (hero.join === 'story') return 'Gia nhập khi hoàn thành Màn 1 (Hội nghị Bình Than)';
  const r = RECIPES.find((x) => x.hero === hero.id);
  return r ? `Chiêu mộ ở Hội Quán: ${CARDS[r.inputs[0]].name} + ${CARDS[r.inputs[1]].name}` : 'Có sẵn từ đầu';
};
