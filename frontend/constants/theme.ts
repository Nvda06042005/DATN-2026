import { Platform } from 'react-native';

/**
 * Hệ thiết kế Đông A: chất liệu thời Trần – giấy dó, sơn son, men ngọc, đồng thếp vàng.
 * Màu chữ/nền đã kiểm tra tương phản WCAG ≥ 4.5:1 ở cả chế độ sáng ("Giấy dó") và tối ("Đêm Bạch Đằng").
 */
const light = {
  giay: '#fbf6ea',
  giay2: '#f3ead7',
  the: '#fffdf7',
  the2: '#fbf3e2',
  muc: '#1c1917',
  muc2: '#57534e',
  muc3: '#6b6560',
  vien: '#e7d9bc',
  vien2: '#d6c39b',
  son: '#b91c1c',
  sonDam: '#7f1d1d',
  sonNhat: '#fee2e2',
  sonChu: '#b91c1c',
  ngoc: '#0f766e',
  ngocDam: '#134e4a',
  ngocNhat: '#ccfbf1',
  ngocChu: '#0f766e',
  dong: '#d97706',
  dongDam: '#92400e',
  dongNhat: '#fef3c7',
  dongChu: '#92400e',
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
  ngocDam: '#0b3d3a',
  ngocNhat: '#0f2f2c',
  ngocChu: '#2dd4bf',
  dong: '#f59e0b',
  dongDam: '#b45309',
  dongNhat: '#3a2a0c',
  dongChu: '#fbbf24',
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
};

/** Chế độ tối chỉ dùng trong game học sinh; trang giáo viên và quản trị luôn dùng giao diện sáng */
export const PALETTES = { light, dark };

/** Phông chữ: Baloo 2 cho tiêu đề và nút, Be Vietnam Pro cho nội dung, Noto Serif cho trích sử liệu */
export const FONT = {
  displayMedium: 'Baloo2_600SemiBold',
  display: 'Baloo2_700Bold',
  displayHeavy: 'Baloo2_800ExtraBold',
  body: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
  heavy: 'BeVietnamPro_800ExtraBold',
  serif: 'NotoSerif_400Regular',
  serifBold: 'NotoSerif_700Bold',
  /** Tên đăng nhập, mật khẩu tạm, mã PIN */
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'Consolas, "Courier New", monospace' }),
} as const;

export type FontName = keyof typeof FONT;

export const RADIUS = { sm: 12, md: 16, lg: 22, pill: 999 } as const;

/** Màu nút: nền, viền đáy (tạo khối 3D) và chữ */
export type Tone = 'son' | 'ngoc' | 'dong' | 'thuy' | 'thong' | 'giay' | 'ghost' | 'dark';

export const toneColors = (c: Palette, tone: Tone): { bg: string; edge: string; fg: string; border?: string } => {
  switch (tone) {
    case 'ngoc':
      return { bg: c.ngoc, edge: c.ngocDam, fg: '#ffffff' };
    case 'dong':
      return { bg: c.dong, edge: c.dongDam, fg: '#1c1917' };
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
