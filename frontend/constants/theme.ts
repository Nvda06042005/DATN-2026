import { Platform } from 'react-native';

/**
 * Hệ thiết kế Đông A theo phong cách game học tập (Duolingo, Classcraft): nền kem sáng #FFFDF7, cam hổ phách #FF9600,
 * xanh ngọc lục bảo #58CC02, vàng huy hiệu #FFC800; sơn son giữ cho ấn triện và cảnh báo.
 * Nền màu tươi luôn đi với chữ tối; màu chữ/nền đã kiểm tra tương phản WCAG ≥ 4.5:1 ở cả chế độ sáng và tối ("Đêm Bạch Đằng").
 */
const light = {
  giay: '#fffdf7',
  giay2: '#fbf1dc',
  the: '#ffffff',
  the2: '#fff8e8',
  muc: '#1c1917',
  muc2: '#57534e',
  muc3: '#6b6560',
  vien: '#efe0bf',
  vien2: '#dcc797',
  son: '#b91c1c',
  sonDam: '#7f1d1d',
  sonNhat: '#fee2e2',
  sonChu: '#b91c1c',
  ngoc: '#58cc02',
  ngocDam: '#3f9a00',
  ngocNhat: '#e7f8d6',
  ngocChu: '#2b6b00',
  dong: '#ff9600',
  dongDam: '#c97500',
  dongNhat: '#fff0d4',
  dongChu: '#8f4a00',
  vang: '#ffc800',
  vangDam: '#d4a500',
  vangNhat: '#fff7cc',
  vangChu: '#7a5a00',
  thuy: '#0369a1',
  thuyNhat: '#e0f2fe',
  thuyChu: '#0369a1',
  moc: '#15803d',
  mocNhat: '#dcfce7',
  mocChu: '#15803d',
  tho: '#a16207',
  thoNhat: '#fef9c3',
  thoChu: '#854d0e',
  hoa: '#c2410c',
  hoaNhat: '#ffedd5',
  hoaChu: '#c2410c',
  thong: '#7e22ce',
  thongNhat: '#f3e8ff',
  thongChu: '#7e22ce',
  dich: '#44403c',
  dichNhat: '#f5f5f4',
  /** Lớp phủ sau hộp thoại */
  scrim: 'rgba(28, 25, 23, 0.55)',
  /** Trang chủ công khai (nền bầu trời): trời đậm (chữ trắng ≥ 5:1), trời, chân mây, trời nhạt, gần trắng */
  troi: '#0b6cc0',
  troi2: '#19a0ee',
  troi3: '#8ad1fc',
  troi4: '#c8efff',
  troi5: '#eaf8ff',
  /** Chữ xanh mực (tiêu đề, nền chân trang), chữ phụ xanh xám, viền thẻ xanh nhạt, bóng đổ */
  xanhMuc: '#16253f',
  xanhMuc2: '#475a76',
  bienXanh: '#d9e6f2',
  /** Viền ô nhập trên nền trắng (tương phản ≥ 3:1 với nền) */
  bienDam: '#7a8ca8',
  bong: 'rgba(22, 37, 63, 0.10)',
  /** Kính mờ trên nền tối của hero: nền và viền trắng trong suốt */
  kinh: 'rgba(255, 255, 255, 0.10)',
  kinhVien: 'rgba(255, 255, 255, 0.28)',
  /** Không đổi theo chế độ sáng/tối: trắng (chữ trên nền tối) và xanh đêm (nền hero, dải kêu gọi, chân trang) */
  trang: '#ffffff',
  dem: '#16253f',
  /** Đỏ son sáng cho chữ nghiêng nhấn trên ảnh bìa tối (không đổi theo chế độ sáng/tối); đỏ son thường `son` quá tối trên nền cảnh */
  sonSang: '#ff6a5a',
  /** Màu nhấn trên thẻ (biểu tượng, chữ nổi bật) và nền kính của thanh điều hướng khi đã cuộn */
  nhan: '#0b6cc0',
  kinhDac: 'rgba(255, 255, 255, 0.86)',
  /** Trang chủ theo cuộc kháng chiến chống Nguyên – Mông: xanh lam sông (đỉnh, mặt nước; chữ trắng ≥ 4,5:1), giấy dó, nút đen mực; màu nhấn lấy từ son, vàng, thuy, moc */
  bau: '#0f3d5e',
  bau2: '#2f7fa8',
  xam: '#fbf1dc',
  den: '#0e1116',
  /** Màu cố định từ logo Đông A: mực xanh, cờ đỏ, vàng cổ và giấy kem (khung video giới thiệu). */
  logoInk: '#23382f',
  logoRed: '#b53520',
  logoGold: '#dfb66f',
  logoPaper: '#faf4e7',
  /** Giao diện quản trị: nền trung tính, đường kẻ mảnh và hàng tiêu đề bảng. */
  adminCanvas: '#f5f5f8',
  adminLine: '#e8e6eb',
  adminTint: '#fcf6f6',
  /** Chất liệu mây vàng be nhạt, giữ cùng tông logo ở cả hai chế độ. */
  cloudGoldTip: '#efdcae',
  cloudGoldBase: '#f9f0d9',
  cloudGoldEdge: '#dcc48f',
  cloudGoldShadow: '#5a3d10',
};

export type Palette = typeof light;

const dark: Palette = {
  ...light,
  giay: '#0b1220',
  giay2: '#162033',
  the: '#131c2e',
  the2: '#1a2539',
  muc: '#f5efe0',
  muc2: '#a8a29e',
  muc3: '#9a948d',
  vien: '#2a3650',
  vien2: '#3a4a68',
  son: '#dc2626',
  sonDam: '#991b1b',
  sonNhat: '#3b1416',
  sonChu: '#f87171',
  ngocDam: '#2f7300',
  ngocNhat: '#16300a',
  ngocChu: '#7ee03a',
  dongDam: '#b56a00',
  dongNhat: '#3a2608',
  dongChu: '#ffb347',
  vangDam: '#b38b00',
  vangNhat: '#332a05',
  vangChu: '#ffd84d',
  thuyNhat: '#0c2a3d',
  thuyChu: '#38bdf8',
  mocNhat: '#0f2e1c',
  mocChu: '#4ade80',
  thoNhat: '#33290b',
  thoChu: '#facc15',
  hoaNhat: '#3a1d0c',
  hoaChu: '#fb923c',
  thongNhat: '#2a1640',
  thongChu: '#c084fc',
  dich: '#57534e',
  dichNhat: '#1f2937',
  scrim: 'rgba(2, 6, 23, 0.7)',
  /** Chế độ tối của trang chủ: chữ sáng trên thẻ tối; bầu trời (troi, troi2…) và các màu cố định giữ nguyên */
  xanhMuc: '#eaf1fb',
  xanhMuc2: '#9fb0c8',
  bienXanh: '#243352',
  bienDam: '#4a5c7a',
  troi5: '#0f1a30',
  nhan: '#5eb6ff',
  bong: 'rgba(0, 0, 0, 0.45)',
  kinhDac: 'rgba(19, 28, 46, 0.86)',
  bau: '#0a2238',
  bau2: '#14405f',
  xam: '#10151f',
};

/** Chế độ tối chỉ dùng trong game học sinh; trang giáo viên và quản trị luôn dùng giao diện sáng */
export const PALETTES = { light, dark };

/**
 * Phông chữ: Manrope (không chân, hình học) cho mọi tiêu đề, nút, nhãn và nội dung ở trang chủ, đăng nhập, học sinh, giáo viên và quản trị;
 * Newsreader (có chân, dáng báo chí) cho trích sử liệu, đoạn đọc dài và chữ nghiêng nhấn ở tiêu đề ảnh bìa. Cả hai có đủ chữ tiếng Việt.
 * Các khóa display* giữ nguyên tên cũ để không phải sửa nơi dùng: nay cũng là Manrope, chỉ khác độ đậm.
 */
export const FONT = {
  displayMedium: 'Manrope_600SemiBold',
  display: 'Manrope_700Bold',
  displayHeavy: 'Manrope_800ExtraBold',
  body: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  heavy: 'Manrope_800ExtraBold',
  serif: 'Newsreader_400Regular',
  serifBold: 'Newsreader_700Bold',
  serifItalic: 'Newsreader_700Bold_Italic',
  /** Tên đăng nhập, mật khẩu tạm, mã PIN */
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'Consolas, "Courier New", monospace' }),
} as const;

export type FontName = keyof typeof FONT;

export const RADIUS = { sm: 12, md: 16, lg: 22, pill: 999 } as const;

/** Chữ, biểu tượng đặt trên nền xanh lục bảo / cam / vàng (chữ trắng không đủ tương phản trên các màu tươi này) */
export const ON_BRIGHT = '#102b00';

/** Màu chữ/biểu tượng trên một nền màu của bảng màu: tối trên nền tươi, trắng trên nền đậm */
export const onFill = (c: Palette, bg: string): string => ([c.ngoc, c.dong, c.vang].includes(bg) ? ON_BRIGHT : '#ffffff');

/** Màu nút: nền, viền đáy (tạo khối 3D) và chữ */
export type Tone = 'son' | 'ngoc' | 'dong' | 'vang' | 'thuy' | 'thong' | 'giay' | 'ghost' | 'dark';

export const toneColors = (c: Palette, tone: Tone): { bg: string; edge: string; fg: string; border?: string } => {
  switch (tone) {
    case 'ngoc':
      return { bg: c.ngoc, edge: c.ngocDam, fg: ON_BRIGHT };
    case 'dong':
      return { bg: c.dong, edge: c.dongDam, fg: '#1c1917' };
    case 'vang':
      return { bg: c.vang, edge: c.vangDam, fg: '#1c1917' };
    case 'thuy':
      return { bg: c.thuy, edge: '#075985', fg: '#ffffff' };
    case 'thong':
      return { bg: c.thong, edge: '#6b21a8', fg: '#ffffff' };
    case 'giay':
      return { bg: c.the, edge: c.vien2, fg: c.muc, border: c.vien };
    case 'ghost':
      return { bg: 'transparent', edge: 'transparent', fg: c.muc2 };
    case 'dark':
      return { bg: '#292524', edge: '#0c0a09', fg: '#ffffff' };
    default:
      return { bg: c.son, edge: c.sonDam, fg: '#ffffff' };
  }
};

export type AnswerShape = 'triangle' | 'diamond' | 'circle' | 'square';

/** Bảng màu + hình đáp án chuẩn Kahoot (Đỏ ▲, Lam ◆, Vàng ●, Lục ■); fg là màu chữ đạt tương phản trên nền ô */
export const ANSWER_STYLES: Array<{ shape: AnswerShape; bg: string; shadow: string; fg: string; label: string }> = [
  { shape: 'triangle', bg: '#e21b3c', shadow: '#b0142f', fg: '#ffffff', label: 'Đỏ' },
  { shape: 'diamond', bg: '#1368ce', shadow: '#0e4fa0', fg: '#ffffff', label: 'Lam' },
  { shape: 'circle', bg: '#d89e00', shadow: '#a87b00', fg: '#1f1600', label: 'Vàng' },
  { shape: 'square', bg: '#26890c', shadow: '#1c6609', fg: '#ffffff', label: 'Lục' },
];

/** Nền phòng thi đấu (men ngọc đậm) */
export const LIVE_BG = ['#115e59', '#0b3d3a', '#082b29'] as const;

/** Huy hiệu bang hội Khối 6–9: màu nền, viền đáy, chữ (chữ tối trên nền tươi) */
export const GRADE_STYLE: Record<6 | 7 | 8 | 9, { name: string; bg: string; edge: string; fg: string }> = {
  6: { name: 'Bang Mầm Non Sông', bg: '#58cc02', edge: '#3f9a00', fg: '#102b00' },
  7: { name: 'Bang Hào Khí', bg: '#1cb0f6', edge: '#1287c2', fg: '#05253a' },
  8: { name: 'Bang Trí Dũng', bg: '#ce82ff', edge: '#a05ad1', fg: '#2a0b3d' },
  9: { name: 'Bang Rồng Vàng', bg: '#ffc800', edge: '#d4a500', fg: '#3a2a00' },
};
