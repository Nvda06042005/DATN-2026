/**
 * Các khối của trang chủ công khai: bố cục kiểu Papumba (chữ trắng khổng lồ ở giữa, nav viên thuốc trắng, khối màu bão hòa xen kẽ, khung máy tính bảng,
 * gallery chiến dịch xoay dạng barrel, thẻ lời ông cha nhiều màu) nhưng hình ảnh và màu sắc lấy từ cuộc kháng chiến chống quân Nguyên – Mông thời Trần:
 * cảnh thành Thăng Long – thuyền chiến – bãi cọc Bạch Đằng, đỏ son, vàng, lam sông, giấy dó, họa tiết sóng nước và ấn đỏ.
 * Nội dung lịch sử đối chiếu Wikipedia tiếng Việt "Chiến tranh Nguyên Mông – Đại Việt" và ba bài chi tiết từng lần; số liệu lấy thẳng từ dữ liệu game.
 * Khối luôn tối/sáng cố định dùng màu `trang`/`dem`; thẻ và chữ dùng màu đổi theo chế độ sáng/tối. Chỉ chân trang có một liên kết "Trang quản lý" tới /admin; không có liên kết tới /school-manager-admin.
 */
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Animated, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowDown, ArrowRight, CalendarDays, Check, Compass, Joystick, Landmark, LogIn, MapPin, MessageSquareText, Milestone, Quote, School, Sword, Swords,
  Trophy, Users, X, ZoomIn, ArrowUp, ArrowUpRight, FileSpreadsheet, Plus, Menu,
} from 'lucide-react-native';
import {
  BattleBackdrop, BrandLogo, CloudBank, EnemyBadge, FilmBackdrop, HeroMedallion, KahootShape, Mascot, PatternOverlay, VietnamFlag,
} from '@/components/art';
import { Chip, Txt } from '@/components/ui';
import { HomeVideo } from '@/components/home-video';
import { HeroGallery } from '@/components/hero-gallery';
import { ClosingTitle, HeroTitle } from '@/components/hero-title';
import { SectionHeading } from '@/components/section-heading';
import { HistoryShowcase } from '@/components/history-showcase';
import { CloudPair, SectionCloud } from '@/components/section-cloud';
import { ThreadedWaveBand } from '@/components/threaded-wave-band';
import { PhaseGallery } from '@/components/phase-gallery';
import { CAMPAIGNS, PHASES, PHASE_REAL } from '@/constants/campaigns';
import { FAQ_HOME } from '@/constants/faq';
import { ENEMIES } from '@/constants/game';
import { HERO_BY_ID } from '@/constants/heroes';
import { ANSWER_STYLES, type Palette } from '@/constants/theme';
import { Lift, Reveal, useScrollY } from '@/components/motion';
import { usePopIn, useReduceMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import type { IconType } from '@/types/game';

export const MAX_W = 1120;
const WEB = Platform.OS === 'web';
/** Chiều cao thanh điều hướng nổi (64) cộng khoảng cách trên (16); khối đầu trang chừa chỗ này */
export const HEADER_SPACE = 80;

/** Đích cuộn của liên kết neo chừa chỗ cho thanh điều hướng cố định */
const ANCHOR = (WEB ? { scrollMarginTop: 88 } : null) as unknown as ViewStyle;

/** Làm mờ phía sau lớp kính (chỉ web) */
const GLASS = (WEB ? { backdropFilter: 'blur(10px)' } : null) as unknown as ViewStyle;

/** Các phần có neo: label dùng ở chân trang, short là nhãn ngắn trên thanh điều hướng (thứ tự phải trùng thứ tự trên trang để mục đang xem đúng) */
export const NAV = [
  { id: 'kham-pha', label: 'Tính năng', short: 'Tính năng' },
  { id: 'khang-chien', label: 'Ba lần kháng chiến', short: 'Kháng chiến' },
  { id: 'danh-tuong', label: 'Danh tướng', short: 'Danh tướng' },
  { id: 'cach-hoat-dong', label: 'Cách hoạt động', short: 'Cách hoạt động' },
  { id: 'cau-hoi', label: 'Câu hỏi thường gặp', short: 'Câu hỏi thường gặp' },
] as const;

// ---------------------------------------------------------------------- dữ liệu nội dung
/**
 * Thông tin tóm tắt mỗi cuộc kháng chiến, viết theo Wikipedia tiếng Việt: hộp thông tin và nội dung của ba bài "Chiến tranh Nguyên Mông – Đại Việt lần 1/2/3".
 * Lần 1 là quân Mông Cổ (nhà Nguyên lập sau, năm 1271); hai lần sau là quân Nguyên. Số quân là ước tính trong hộp thông tin, các bài và sách sử chép khác nhau.
 */
const CAMPAIGN_FACTS: Record<1 | 2 | 3, { time: string; enemy: string; lead: string; force: string; key: string; result: string }> = {
  1: {
    time: 'Từ tháng 12/1257 đến tháng 1/1258',
    enemy: 'Quân Mông Cổ do Ngột Lương Hợp Thai chỉ huy cùng con trai là A Truật và tướng Triệt Triệt Đô, có hàng binh Đại Lý đi trước',
    lead: 'Vua Trần Thái Tông cùng Thái tử Trần Hoảng (sau là vua Trần Thánh Tông), Thái sư Trần Thủ Độ; các tướng Lê Phụ Trần, Hà Bổng',
    force: 'Đại Việt khoảng 60.000 quân; Mông Cổ khoảng 30.000 quân (khoảng 10.000 kỵ binh Mông Cổ và 20.000 quân Đại Lý)',
    key: 'Quân Trần thất lợi ở Bình Lệ Nguyên (17/1/1258) và Phù Lỗ (18/1), chủ động rút khỏi Thăng Long theo kế vườn không nhà trống; đêm 28/1/1258 phản công, đánh bại quân Mông Cổ ở Đông Bộ Đầu; quân Mông Cổ tháo chạy về Vân Nam và bị Hà Bổng tập kích ở Quy Hóa',
    result: 'Đại Việt chiến thắng; quân Mông Cổ rút về Vân Nam',
  },
  2: {
    time: 'Từ tháng 1 đến tháng 6/1285',
    enemy: 'Quân Nguyên chia ba đạo: đạo chủ lực do Thoát Hoan (Trấn Nam vương) và A Lý Hải Nha chỉ huy, vào qua Lạng Sơn; đạo của Nasirud Din từ Vân Nam; đạo của Toa Đô từ Chiêm Thành đánh lên từ phía nam; các tướng khác có Ô Mã Nhi, Lý Hằng',
    lead: 'Thượng hoàng Trần Thánh Tông, vua Trần Nhân Tông, Quốc công Tiết chế Trần Quốc Tuấn; các tướng Trần Quang Khải, Trần Nhật Duật, Trần Bình Trọng, Phạm Ngũ Lão',
    force: 'Đại Việt khoảng 200.000 – 300.000 quân và dân phu; quân Nguyên khoảng 500.000 quân và dân phu',
    key: 'Sau Hội nghị Bình Than và Hội nghị Diên Hồng, quân Nguyên vượt biên giới (27/1/1285) và chiếm Thăng Long sau trận 17 – 18/2; Trần Bình Trọng chặn giặc ở Đà Mạc; vua Trần rút vào Thanh Hóa rồi phản công: thắng ở Hàm Tử, Chương Dương, giải phóng Thăng Long, diệt quân Toa Đô ở Tây Kết (24/6/1285)',
    result: 'Quân Đại Việt chiến thắng, quân Nguyên phải rút lui',
  },
  3: {
    time: 'Từ tháng 12/1287 đến tháng 4/1288',
    enemy: 'Quân Nguyên do Thoát Hoan làm tổng tư lệnh, chia ba cánh: cánh của Ái Lỗ từ Vân Nam, cánh chủ lực của Thoát Hoan từ phía đông bắc, thủy quân của Ô Mã Nhi và Phàn Tiếp cùng đoàn thuyền lương của Trương Văn Hổ',
    lead: 'Thượng hoàng Trần Thánh Tông, vua Trần Nhân Tông, Quốc công Tiết chế Trần Quốc Tuấn; các tướng Trần Khánh Dư, Trần Nhật Duật, Phạm Ngũ Lão, Nguyễn Khoái, Đỗ Hành',
    force: 'Đại Việt khoảng 200.000 – 300.000 quân chính quy và dân binh; quân Nguyên khoảng 300.000 – 500.000 (James A. Anderson ước tính 170.000 quân chính quy)',
    key: 'Đoàn thuyền lương của Trương Văn Hổ bị tiêu diệt ở Vân Đồn (cuối 12/1287 – đầu 1/1288), quân Nguyên thiếu lương nên Thoát Hoan rút khỏi Thăng Long rồi quyết định rút quân; sáng 9/4/1288 thủy quân Ô Mã Nhi vào sông Bạch Đằng, vấp cọc ngầm và bị tiêu diệt',
    result: 'Quân Đại Việt toàn thắng, quân Mông Nguyên phải rút lui; đến 19/4/1288 bộ binh Thoát Hoan mới thoát khỏi biên giới về Tư Minh',
  },
};

/** Khối ba lần kháng chiến dùng cùng bảng màu logo với khối "Nơi học sinh khám phá lịch sử": giấy kem, mực xanh, đỏ cờ và vàng cổ; cố định ở cả hai chế độ sáng/tối */
export const INK_SOFT = 'rgba(35, 56, 47, 0.78)';
export const INK_LINE = 'rgba(35, 56, 47, 0.16)';
export const PAPER_CARD = { backgroundColor: 'rgba(255, 255, 255, 0.74)', borderColor: INK_LINE, boxShadow: '0 10px 30px rgba(35, 56, 47, 0.10)' } as unknown as ViewStyle;

/** Mô tả ngắn trên thẻ chọn: không ghi số quân Nguyên lần 2 vì sử liệu chép khác nhau (Toàn thư 50 vạn, Nguyên sử 30 vạn kể cả dân phu) */
const CAMPAIGN_BLURB: Record<1 | 2 | 3, string> = {
  1: 'Từ Bình Lệ Nguyên đến Đông Bộ Đầu',
  2: 'Phá gọng kìm Bắc – Nam, giải phóng Thăng Long',
  3: 'Từ Vân Đồn đến Bạch Đằng',
};

/** Ba trận đại thắng của nhà Trần */
const VICTORIES = [
  { war: 'Lần 1 · quân Mông Cổ', year: '1258', place: 'Đông Bộ Đầu', result: 'Quân Mông Cổ bỏ Thăng Long, rút về nước' },
  { war: 'Lần 2 · quân Nguyên', year: '1285', place: 'Hàm Tử – Chương Dương', result: 'Giải phóng Thăng Long, diệt quân Toa Đô ở Tây Kết' },
  { war: 'Lần 3 · quân Nguyên', year: '1288', place: 'Bạch Đằng', result: 'Thủy quân Nguyên bị tiêu diệt, sáng 9/4/1288' },
] as const;

/** Lời ông cha, như trong dữ liệu game; riêng câu của Trần Thủ Độ (lần 1) và "Đánh!" (lần 2) viết theo Wikipedia, dẫn từ Đại Việt sử ký toàn thư */
const QUOTES = [
  { text: 'Ta thà làm quỷ nước Nam, chứ không thèm làm vương đất Bắc!', who: 'Trần Bình Trọng', note: 'khi bị giặc bắt và dụ hàng, 1285' },
  { text: 'Đầu thần chưa rơi xuống đất, bệ hạ đừng lo gì khác.', who: 'Trần Thủ Độ', note: 'khi vua hỏi kế sau trận Bình Lệ Nguyên, 1258' },
  { text: 'Phá cường địch, báo hoàng ân', who: 'Trần Quốc Toản', note: 'sáu chữ vàng thêu trên lá cờ của ông, 1285' },
  { text: 'Đánh!', who: 'Các phụ lão', note: 'cùng đáp “như từ một miệng” ở Hội nghị Diên Hồng' },
] as const;

// ---------------------------------------------------------------------- nền tảng giao diện
/** Cỡ biểu tượng theo cỡ chữ đi kèm (1,25 lần) để biểu tượng và chữ luôn đồng bộ */
const iconPx = (text: number) => Math.round(text * 1.25);
/** Chiều cao một dòng chữ của Txt thường */
const lineH = (text: number) => Math.round(text * 1.45);

const shadow = (c: Palette, level: 'sm' | 'lg') =>
  ({ boxShadow: level === 'sm' ? `0 1px 2px ${c.bong}, 0 8px 24px ${c.bong}` : `0 28px 64px ${c.bong}, 0 8px 24px ${c.bong}` }) as unknown as ViewStyle;

/** Biểu tượng nét mảnh 1,75 nằm trong ô cao bằng một dòng chữ nên luôn thẳng hàng với dòng đầu */
const Ico: React.FC<{ icon: IconType; text: number; color: string }> = ({ icon: Icon, text, color }) => (
  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: lineH(text), justifyContent: 'center' }}>
    <Icon size={iconPx(text)} color={color} strokeWidth={1.75} />
  </View>
);

/** Vòng tròn màu chứa biểu tượng lớn (kiểu huy hiệu của Papumba); cỡ biểu tượng bằng 0,45 cỡ vòng */
const Badge: React.FC<{ icon: IconType; color: string; size?: number; fg?: string; ring?: string }> = ({ icon: Icon, color, size = 104, fg, ring }) => {
  const { c } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: ring ?? c.trang }, shadow(c, 'sm')]}
    >
      <Icon size={Math.round(size * 0.45)} color={fg ?? c.trang} strokeWidth={1.75} />
    </View>
  );
};

/** Nhãn viên thuốc nghiêng nhẹ, chữ trắng đậm cỡ lớn (như nhãn "Play", "Explore" của Papumba) */
const Tag: React.FC<{ text: string; bg: string; fg?: string; rotate?: number; size?: number; center?: boolean }> = ({ text, bg, fg, rotate = -3, size = 20, center = false }) => {
  const { c } = useTheme();
  return (
    <View style={{ alignSelf: center ? 'center' : 'flex-start', paddingHorizontal: 22, paddingVertical: 8, borderRadius: 999, backgroundColor: bg, transform: [{ rotate: `${rotate}deg` }] }}>
      <Txt f="heavy" size={size} color={fg ?? c.trang} style={{ lineHeight: Math.round(size * 1.25) }}>
        {text}
      </Txt>
    </View>
  );
};

/** Ô biểu tượng nền nhạt; cỡ biểu tượng theo cỡ chữ tiêu đề đi kèm */
const IconTile: React.FC<{ icon: IconType; text?: number; size?: number; bg?: string; fg?: string }> = ({ icon: Icon, text = 18, size = 44, bg, fg }) => {
  const { c } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.34), backgroundColor: bg ?? c.troi5, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon size={iconPx(text)} color={fg ?? c.nhan} strokeWidth={1.75} />
    </View>
  );
};

/** Thẻ bo tròn lớn, viền mảnh, bóng nhẹ */
const Panel: React.FC<{ children: React.ReactNode; pad?: number; style?: StyleProp<ViewStyle> }> = ({ children, pad = 24, style }) => {
  const { c } = useTheme();
  return <View style={[{ backgroundColor: c.the, borderRadius: 28, borderWidth: 1, borderColor: c.bienXanh, padding: pad }, shadow(c, 'sm'), style]}>{children}</View>;
};

/** den/trang dùng trên nền màu (nút đen, nút trắng như huy hiệu cửa hàng); son/xanh dùng trên thẻ */
type CtaTone = 'den' | 'trang' | 'son' | 'xanh' | 'muc' | 'logo';

/** Nút viên thuốc bo tròn, cao tối thiểu 44 */
export const Cta: React.FC<{ title: string; onPress: () => void; tone?: CtaTone; icon?: IconType; arrow?: boolean; lg?: boolean; label?: string; testID?: string }> = ({
  title, onPress, tone = 'den', icon, arrow = false, lg = false, label, testID,
}) => {
  const { c } = useTheme();
  const t = {
    den: { bg: c.den, fg: c.trang, bd: c.kinhVien },
    trang: { bg: c.trang, fg: c.dem, bd: c.trang },
    son: { bg: c.son, fg: c.trang, bd: c.son },
    xanh: { bg: c.xanhMuc, fg: c.the, bd: c.xanhMuc },
    muc: { bg: c.logoInk, fg: c.logoPaper, bd: c.logoInk },
    logo: { bg: c.logoRed, fg: c.logoPaper, bd: c.logoRed },
  }[tone];
  const text = lg ? 18 : 15;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      testID={testID}
      style={(s) => {
        const { pressed, hovered } = s as typeof s & { hovered?: boolean };
        return [
          {
            alignSelf: 'flex-start', minHeight: lg ? 60 : 44, paddingHorizontal: lg ? 30 : 20, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
            backgroundColor: t.bg, borderWidth: 1.5, borderColor: t.bd, opacity: pressed ? 0.9 : 1, transform: [{ translateY: pressed ? 1 : hovered ? -2 : 0 }],
          },
          shadow(c, 'sm'),
        ];
      }}
    >
      {icon && <Ico icon={icon} text={text} color={t.fg} />}
      <Txt f="heavy" size={text} color={t.fg}>
        {title}
      </Txt>
      {arrow && <Ico icon={ArrowRight} text={text} color={t.fg} />}
    </Pressable>
  );
};

/** Dải toàn chiều rộng; cloudTop/cloudBottom = màu khối liền kề để vẽ dải sóng/mây chuyển; padTop thay khoảng đệm phía trên (trang thông tin chừa chỗ cho thanh điều hướng nổi) */
export const Band: React.FC<{
  id?: string; bg?: string; cloudTop?: string; cloudBottom?: string; wide: boolean; gap?: number; padTop?: number; onSection?: (id: string, y: number) => void; decor?: React.ReactNode; children: React.ReactNode;
}> = ({ id, bg, cloudTop, cloudBottom, wide, gap = 32, padTop, onSection, decor, children }) => {
  const { c } = useTheme();
  return (
    <View id={id} onLayout={id && onSection ? (e) => onSection(id, e.nativeEvent.layout.y) : undefined} style={[{ width: '100%', backgroundColor: bg, overflow: 'hidden' }, id ? ANCHOR : null]}>
      <PatternOverlay opacity={bg === c.logoInk ? 0.065 : bg === c.logoPaper ? 0.075 : undefined} />
      {decor}
      {cloudTop && <CloudBank color={cloudTop} flip />}
      <View
        style={{
          width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, gap,
          paddingTop: padTop ?? (wide ? 88 : 56) + (cloudTop ? 24 : 0), paddingBottom: (wide ? 88 : 56) + (cloudBottom ? 40 : 0),
        }}
      >
        {children}
      </View>
      {cloudBottom && <CloudBank color={cloudBottom} />}
    </View>
  );
};

// ---------------------------------------------------------------------- thanh điều hướng
/** Các mục trên thanh điều hướng: "Trang chủ" cuộn về đầu trang, còn lại cuộn tới phần có id tương ứng */
const NAV_ITEMS = [{ id: 'home', short: 'Trang chủ' }, ...NAV.map((n) => ({ id: n.id, short: n.short }))];

/**
 * Thanh điều hướng cố định: logo bên trái, cờ và nút "Vào học ngay" bên phải; co thành viên thuốc kính khi cuộn.
 * Trang chủ chỉ hiện menu sau khi cuộn. Màn hẹp dùng nút mở menu với đầy đủ liên kết.
 */
export const Header: React.FC<{
  width: number; scrollY: Animated.Value; stuck: boolean; active: string; go: (id: string) => void;
  /** Các mục menu; trang chủ dùng mặc định (sáu phần của trang), trang điều khoản và câu hỏi thường gặp truyền mục riêng */
  items?: ReadonlyArray<{ id: string; short: string }>;
  /** Nền phía sau thanh ở đầu trang là giấy kem (không phải ảnh tối): logo dùng chữ tối thay vì chữ trắng */
  paper?: boolean;
  /** Trang chủ giữ phần đầu thoáng: chỉ hiện điều hướng khi thanh đã co lại sau khi cuộn */
  revealOnScroll?: boolean;
}> = ({
  width, scrollY, stuck, active, go, items = NAV_ITEMS, paper = false, revealOnScroll = false,
}) => {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const wide = WEB && width >= (items.length > 4 ? 1100 : 1000);
  const showNavigation = !revealOnScroll || stuck;
  const compactNav = width < 1240;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuVisible = menuOpen && showNavigation && !wide;
  const menuButton = useRef<ComponentRef<typeof Pressable>>(null);
  useEffect(() => { if (wide || !showNavigation) setMenuOpen(false); }, [wide, showNavigation]);
  useEffect(() => {
    if (!WEB || !menuOpen) return undefined;
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [menuOpen]);
  const closeMenu = () => {
    setMenuOpen(false);
    menuButton.current?.focus();
  };
  const navigate = (id: string) => {
    closeMenu();
    go(id);
  };
  /** Thu gọn khoảng cách giữa các nút khi màn hình hẹp. */
  const small = width < 430;
  const clamp = { extrapolate: 'clamp' } as const;
  const maxWidth = scrollY.interpolate({ inputRange: [0, 120], outputRange: [1240, 1180], ...clamp });
  const height = scrollY.interpolate({ inputRange: [0, 80], outputRange: [64, 56], ...clamp });
  const marginTop = scrollY.interpolate({ inputRange: [0, 80], outputRange: [16, 8], ...clamp });
  const bg = scrollY.interpolate({ inputRange: [0, 60], outputRange: ['rgba(255,255,255,0)', c.kinhDac], ...clamp });
  const border = scrollY.interpolate({ inputRange: [0, 60], outputRange: ['rgba(255,255,255,0)', c.bienXanh], ...clamp });
  const navBg = scrollY.interpolate({ inputRange: [0, 60], outputRange: [c.the, c.kinhDac], ...clamp });
  const roundBg = stuck ? 'rgba(255,255,255,0)' : c.the;
  const ring = stuck ? c.bienXanh : c.the;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, bottom: menuVisible ? 0 : undefined, left: 0, right: 0, zIndex: 40, alignItems: 'center', paddingHorizontal: 12, paddingTop: insets.top }}>
      {menuVisible && <Pressable accessibilityRole="button" accessibilityLabel="Đóng menu điều hướng" onPress={closeMenu} style={StyleSheet.absoluteFill} />}
      <Animated.View
        testID="home-header"
        style={[
          { width: '100%', maxWidth, height, marginTop, borderRadius: 999, borderWidth: 1, borderColor: border, backgroundColor: bg, paddingLeft: 10, paddingRight: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
          stuck ? GLASS : null,
        ]}
      >
        <Pressable onPress={() => navigate('home')} accessibilityRole="link" accessibilityLabel="Về đầu trang" hitSlop={4} style={{ minHeight: 44, justifyContent: 'center' }}>
          <BrandLogo compact={width < 430} light={!stuck && !paper} paper={!stuck && paper} />
        </Pressable>
        {showNavigation && wide && (
          <Animated.View testID="home-nav-desktop" role="navigation" accessibilityLabel="Điều hướng chính" style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, backgroundColor: navBg, paddingHorizontal: 8, height: 50 }}>
            {items.map((n) => {
              const on = n.id === active;
              return (
                <Pressable
                  key={n.id}
                  accessibilityRole="link"
                  accessibilityLabel={n.short}
                  accessibilityState={{ selected: on }}
                  aria-current={on ? 'location' : undefined}
                  onPress={() => go(n.id)}
                  style={{ minHeight: 44, paddingHorizontal: compactNav ? 8 : 12, justifyContent: 'center' }}
                >
                  <Txt f="bold" size={compactNav ? 13.5 : 14.5} color={on ? c.sonChu : c.xanhMuc}>
                    {n.short}
                  </Txt>
                </Pressable>
              );
            })}
          </Animated.View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: small ? 6 : 8 }}>
          {width >= 340 && (
            <View style={{ borderRadius: 6, borderWidth: 1, borderColor: ring, padding: 1, backgroundColor: roundBg }}>
              <VietnamFlag width={small ? 30 : 34} />
            </View>
          )}
          <Cta title={width >= 560 ? 'Vào học ngay' : ''} label="Đăng nhập học tập" icon={width >= 560 ? undefined : LogIn} onPress={() => router.push('/portal')} testID="home-login" />
          {showNavigation && !wide && (
            <Pressable ref={menuButton} testID="home-menu-toggle" accessibilityRole="button" accessibilityLabel={menuOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'} accessibilityState={{ expanded: menuOpen }} aria-expanded={menuOpen} aria-controls="home-nav-panel" onPress={() => setMenuOpen((open) => !open)} style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: c.the, alignItems: 'center', justifyContent: 'center' }}>
              {menuOpen ? <X size={22} color={c.logoInk} /> : <Menu size={22} color={c.logoInk} />}
            </Pressable>
          )}
        </View>
      </Animated.View>
      {menuVisible && (
        <View id="home-nav-panel" testID="home-nav-panel" role="navigation" accessibilityLabel="Điều hướng chính" style={[{ width: '100%', maxWidth: 520, alignSelf: 'flex-end', marginTop: 8, padding: 8, borderRadius: 20, borderWidth: 1, borderColor: c.bienXanh, backgroundColor: c.the }, shadow(c, 'sm')]}>
          <ScrollView style={{ maxHeight: Math.max(44, windowHeight - insets.top - insets.bottom - 120) }}>
            {items.map((n) => (
              <Pressable key={n.id} accessibilityRole="link" accessibilityLabel={n.short} accessibilityState={{ selected: n.id === active }} aria-current={n.id === active ? 'location' : undefined} onPress={() => navigate(n.id)} style={{ minHeight: 44, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center', borderRadius: 12, backgroundColor: n.id === active ? c.logoPaper : 'transparent' }}>
                <Txt f="bold" size={15} color={n.id === active ? c.sonChu : c.xanhMuc}>{n.short}</Txt>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

/** Nút lên đầu trang ở góc phải dưới, hiện dần khi đã cuộn xuống */
export const BackToTop: React.FC<{ scrollY: Animated.Value; visible: boolean; onPress: () => void }> = ({ scrollY, visible, onPress }) => {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const opacity = scrollY.interpolate({ inputRange: [420, 620], outputRange: [0, 1], extrapolate: 'clamp' });
  return (
    <Animated.View pointerEvents={visible ? 'box-none' : 'none'} style={{ position: 'absolute', right: 20, bottom: 20 + insets.bottom, opacity, zIndex: 40 }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Lên đầu trang"
        testID="home-top"
        style={({ pressed }) => [
          { width: 52, height: 52, borderRadius: 26, backgroundColor: c.den, borderWidth: 1, borderColor: c.kinhVien, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 },
          shadow(c, 'sm'),
        ]}
      >
        <ArrowDown size={iconPx(15)} color={c.trang} strokeWidth={2} style={{ transform: [{ rotate: '180deg' }] }} />
      </Pressable>
    </Animated.View>
  );
};

// ---------------------------------------------------------------------- hero
/**
 * Hero: ảnh bìa điện ảnh ghép tám khung hình minh họa thành một cảnh chuyển động (xem FilmBackdrop),
 * tiêu đề Hào Khí Đông A và ba mốc năm bấm được. Màn hẹp dùng bản ảnh dọc phủ kín khung.
 */
const HeroSection: React.FC<{ wide: boolean; go: (id: string) => void }> = ({ wide, go }) => {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const minH = Math.min(Math.max(wide ? 780 : 700, height), wide ? 1000 : 900);
  const reduce = useReduceMotion();
  const scrollY = useScrollY();
  const on = !!scrollY && !reduce;
  const clampOpt = { extrapolate: 'clamp' } as const;
  /** Cảnh phóng nhẹ khi cuộn (luôn phủ kín 100% khung, không bị hụt mép); chữ mờ dần, bay lên và thu nhỏ khi lướt qua */
  const sceneFx = on ? { transform: [{ scale: scrollY.interpolate({ inputRange: [0, 800], outputRange: [1, 1.06], ...clampOpt }) }] } : null;
  const textFx = on
    ? {
        opacity: scrollY.interpolate({ inputRange: [0, 120, 440], outputRange: [1, 1, 0], ...clampOpt }),
        transform: [
          { translateY: scrollY.interpolate({ inputRange: [0, 440], outputRange: [0, -84], ...clampOpt }) },
          { scale: scrollY.interpolate({ inputRange: [0, 440], outputRange: [1, 0.95], ...clampOpt }) },
        ],
      }
    : null;
  const shade = { textShadowColor: 'rgba(0, 0, 0, 0.55)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 22 } as const;
  return (
    <View testID="home-hero-section" style={{ width: '100%', minHeight: minH, backgroundColor: c.dem, overflow: 'hidden' }}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, sceneFx]}>
        <FilmBackdrop wide={wide} scrim />
      </Animated.View>
      <Animated.View style={[{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingTop: insets.top + HEADER_SPACE + (wide ? 36 : 16), alignItems: 'center', gap: 20 }, textFx]}>
        <HeroTitle wide={wide} />
        <Txt f="bold" size={wide ? 24 : 18} color={c.trang} center style={[{ lineHeight: wide ? 32 : 25, maxWidth: 780 }, shade]}>
          Nền tảng học tập game hóa về ba lần kháng chiến chống quân Nguyên – Mông thời Trần
        </Txt>
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: 0, right: 0, bottom: wide ? 32 : 14, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: wide ? 18 : 8, paddingHorizontal: 12 }, textFx]}>
        {VICTORIES.map((v) => (
          <Pressable
            key={v.year}
            onPress={() => go('khang-chien')}
            accessibilityRole="button"
            accessibilityLabel={`${v.war}, năm ${v.year}: ${v.place}`}
            style={({ pressed }) => [
              { minHeight: 48, paddingHorizontal: wide ? 20 : 14, paddingVertical: 6, borderRadius: 999, backgroundColor: c.kinh, borderWidth: 1, borderColor: c.kinhVien, flexDirection: 'row', alignItems: 'center', gap: wide ? 12 : 6, opacity: pressed ? 0.8 : 1 },
              GLASS,
            ]}
          >
            <Txt f="heavy" size={wide ? 22 : 17} color={c.vang}>
              {v.year}
            </Txt>
            {wide && (
              <Txt f="semibold" size={14} color={c.trang}>
                {v.place}
              </Txt>
            )}
          </Pressable>
        ))}
      </Animated.View>
    </View>
  );
};

// ---------------------------------------------------------------------- chín màn chiến dịch
/** Gallery 3D lấy cảm hứng từ Barrel của Motion; mỗi màn mở cửa sổ đọc riêng. */
const PhaseCampaignGallery: React.FC<{ wide: boolean; onSection: (id: string, y: number) => void }> = ({ wide, onSection }) => {
  const { c } = useTheme();
  const { height } = useWindowDimensions();
  const [selected, setSelected] = useState<string | null>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const closeButton = useRef<ComponentRef<typeof View>>(null);
  const reduce = useReduceMotion();
  const colors = [c.son, c.vang, c.logoInk];
  const chosen = selected ? PHASE_REAL[selected] : null;
  const phase = PHASES.find(p => p.id === selected);
  const close = useCallback(() => setSelected(null), []);
  useEffect(() => {
    if (!WEB || !selected) return undefined;
    // Also accept Escape while the fade-in is still running, before the native modal activates.
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
    document.addEventListener('keydown', escape, true);
    return () => document.removeEventListener('keydown', escape, true);
  }, [selected, close]);
  const items = PHASES.map((p, i) => {
    const r = PHASE_REAL[p.id];
    const fg = p.campaign === 2 ? c.dem : c.trang;
    return { id: p.id, title: r.title, content: (
      <View style={[{ width: '100%', height: '100%', borderRadius: 28, overflow: 'hidden', backgroundColor: c.the }, shadow(c, 'sm')]}>
        <View style={{ backgroundColor: colors[p.campaign - 1], padding: 18, gap: 5, minHeight: wide ? 170 : 148 }}>
          <Txt f="bold" size={12} color={fg} upper>{`Màn ${i + 1} · Lần ${p.campaign}`}</Txt>
          <Txt f="heavy" size={14} color={fg}>{r.date}</Txt>
          <Txt f="heavy" size={wide ? 23 : 20} numberOfLines={3} color={fg} style={{ lineHeight: wide ? 29 : 25 }}>{r.title}</Txt>
        </View>
        <View style={{ padding: 18, flex: 1, justifyContent: 'space-between', gap: 12 }}>
          <Txt size={14} numberOfLines={4} color={c.logoInk} style={{ lineHeight: 22 }}>{r.text}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Txt f="bold" size={14} color={c.logoRed}>Đọc chi tiết</Txt><ArrowUpRight size={17} color={c.logoRed} /></View>
        </View>
      </View>
    ) };
  });
  return (
    <View id="chin-man" onLayout={e => onSection('chin-man', e.nativeEvent.layout.y)} style={{ width: '100%', backgroundColor: c.xam, paddingVertical: wide ? 80 : 48, gap: 20, overflow: 'hidden' }}>
      <PatternOverlay />
      <View style={{ paddingHorizontal: 16 }}>
        <SectionHeading eyebrow="Theo dấu chiến dịch" title="Chín màn" accent="chiến dịch" description="Mỗi màn là một trận đánh có thật, từ Bình Lệ Nguyên đến Bạch Đằng." wide={wide} singleLine testID="phases-heading" />
      </View>
      <PhaseGallery items={items} wide={wide} paused={!!selected} onSelect={id => { if (WEB) lastFocus.current = document.activeElement as HTMLElement; setSelected(id); }} />
      <Modal visible={!!selected} transparent animationType={reduce ? 'none' : 'fade'} onRequestClose={close} onShow={() => { if (WEB) closeButton.current?.focus(); }} onDismiss={() => { if (WEB) lastFocus.current?.focus({ preventScroll: true }); }}>
        <View role="dialog" aria-modal accessibilityViewIsModal aria-label={chosen ? `Chi tiết ${chosen.title}` : 'Chi tiết chiến dịch'} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: wide ? 32 : 14 }}>
          <Pressable testID="phase-detail-backdrop" onPress={close} accessibilityRole="button" accessibilityLabel="Đóng chi tiết chiến dịch" style={[StyleSheet.absoluteFill, { backgroundColor: c.den, opacity: 0.75 }]} />
          <View testID="phase-detail" style={{ width: '100%', maxWidth: 640, maxHeight: height - 70, backgroundColor: c.logoPaper, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: c.logoGold }}>
            <View style={{ padding: 24, paddingRight: 74, gap: 6, backgroundColor: phase ? colors[phase.campaign - 1] : c.logoInk }}>
              <Txt f="bold" size={13} color={phase?.campaign === 2 ? c.dem : c.trang}>{chosen?.date}</Txt>
              <Txt f="heavy" size={wide ? 28 : 23} color={phase?.campaign === 2 ? c.dem : c.trang} accessibilityRole="header">{chosen?.title}</Txt>
            </View>
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 24 }}><Txt size={wide ? 17 : 16} color={c.logoInk} style={{ lineHeight: 28 }}>{chosen?.text}</Txt></ScrollView>
            <Pressable ref={closeButton} testID="phase-detail-close" onPress={close} accessibilityRole="button" accessibilityLabel="Đóng cửa sổ chi tiết" style={{ position: 'absolute', top: 12, right: 12, height: 44, width: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.logoPaper }}><X size={23} color={c.logoInk} /></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ---------------------------------------------------------------------- khám phá lịch sử theo màu logo
type ShowId = 'choi' | 'kham-pha' | 'hoi-dap' | 'on-tap';

const SHOWCASE: Array<{ id: ShowId; label: string; icon: IconType; color: 'logoRed' | 'logoGold' | 'logoInk' | 'logoPaper'; text: string }> = [
  { id: 'choi', label: 'Chơi', icon: Joystick, color: 'logoRed', text: 'Thu lương thảo ở Điền Trang, chiêu mộ danh tướng rồi bày trận đánh các màn chiến dịch – mỗi sức mạnh đều đến từ một câu trả lời đúng.' },
  { id: 'kham-pha', label: 'Khám phá', icon: Compass, color: 'logoGold', text: 'Khám phá cuộc kháng chiến chống quân Mông Cổ năm 1258 qua các địa danh Phù Lỗ, Thăng Long và Đông Bộ Đầu. Mũi tên đỏ chỉ quân Đại Việt, mũi tên đen chỉ quân Mông Cổ.' },
  { id: 'hoi-dap', label: 'Hỏi đáp', icon: MessageSquareText, color: 'logoInk', text: 'Hỏi Quân Sư AI bất cứ điều gì về ba lần kháng chiến; câu trả lời dựa trên kho kiến thức sử liệu của đề tài.' },
  { id: 'on-tap', label: 'Ôn tập', icon: School, color: 'logoPaper', text: 'Tháp Khảo Thí 10 tầng và thẻ Sử Ký giúp ôn từ nhận biết đến vận dụng; hệ thống ghi nhận mức nắm vững để gợi ý câu hỏi tiếp theo.' },
];

/** Màn chơi minh họa: sông Bạch Đằng, tướng ta bên trái, tướng giặc bên phải, bảng câu hỏi bốn ô màu (đỏ ▲, lam ◆, vàng ●, lục ■ như trong game) ở dưới */
const MockPlay: React.FC = () => {
  const { c, dark } = useTheme();
  const mine = ['tran_hung_dao', 'tran_khanh_du', 'yet_kieu'].map((id) => HERO_BY_ID[id]).filter(Boolean);
  const options = ['Trần Hưng Đạo', 'Ngô Quyền', 'Lê Lợi', 'Quang Trung'];
  return (
    <View style={{ flex: 1 }}>
      <BattleBackdrop bg="river" tide="dung" dark={dark} stakes />
      <View style={{ position: 'absolute', top: 14, left: 14 }}>
        <Chip text="Chiến dịch 3 · Bạch Đằng" icon={Swords} bg={c.trang} fg={c.dem} />
      </View>
      <View style={{ position: 'absolute', top: 14, right: 14 }}>
        <Chip text="Ví dụ" bg={c.dem} fg={c.trang} />
      </View>
      <View style={{ position: 'absolute', left: 14, bottom: 168, flexDirection: 'row', gap: 8 }}>
        {mine.map((h) => (
          <HeroMedallion key={h.id} hero={h} size={64} />
        ))}
      </View>
      <View style={{ position: 'absolute', right: 14, bottom: 168, flexDirection: 'row', gap: 8 }}>
        <EnemyBadge enemy={ENEMIES.chien_thuyen} size={56} />
        <EnemyBadge enemy={ENEMIES.o_ma_nhi} size={64} />
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.the, padding: 12, gap: 8 }}>
        <Txt f="bold" size={14} color={c.xanhMuc} center>
          Trận Bạch Đằng năm 1288 do ai chỉ huy?
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {ANSWER_STYLES.map((a, i) => (
            <View key={a.label} style={{ width: '49%', minHeight: 40, borderRadius: 12, backgroundColor: a.bg, borderBottomWidth: 3, borderBottomColor: a.shadow, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10 }}>
              <KahootShape shape={a.shape} size={16} color={a.fg} />
              <Txt f="bold" size={13} color={a.fg} style={{ flex: 1 }} numberOfLines={1}>
                {options[i]}
              </Txt>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

/** Bản đồ cuộc kháng chiến lần thứ nhất và ba địa danh được ghi trên chính bản đồ. */
const MockExplore: React.FC<{ wide: boolean }> = ({ wide }) => {
  const { c } = useTheme();
  const places = [
    { name: 'Phù Lỗ', date: '18/1/1258', detail: 'Quân Trần tiếp tục rút lui.' },
    { name: 'Thăng Long', date: PHASE_REAL.m1p2.date, detail: 'Vườn không nhà trống.' },
    { name: PHASE_REAL.m1p3.title, date: PHASE_REAL.m1p3.date, detail: 'Quân Trần phản công.' },
  ] as const;
  return (
    <View testID="showcase-explore" style={{ flex: 1, flexDirection: 'row', backgroundColor: c.logoPaper }}>
      <View style={{ flex: wide ? 1.2 : 1, padding: wide ? 12 : 10, justifyContent: 'center' }}>
        <Image
          testID="showcase-explore-map"
          source={CAMPAIGN_MAP[1].src}
          resizeMode="contain"
          alt="Bản đồ cuộc kháng chiến chống quân Mông Cổ lần thứ nhất năm 1258"
          style={{ width: '100%', height: '100%' }}
        />
      </View>
      {wide && (
        <View testID="showcase-explore-facts" style={{ flex: 1, paddingVertical: 18, paddingLeft: 4, paddingRight: 18, gap: 12, justifyContent: 'center' }}>
          <View style={{ gap: 5 }}>
            <Txt f="heavy" size={20} color={c.logoInk} style={{ lineHeight: 26 }}>
              Kháng chiến lần thứ nhất
            </Txt>
            <Txt f="semibold" size={12} color={c.logoRed}>Chống quân Mông Cổ · 1258</Txt>
          </View>
          {places.map((p) => (
            <View key={p.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <IconTile icon={MapPin} text={15} size={36} bg={c.logoGold} fg={c.logoInk} />
              <View style={{ flex: 1 }}>
                <Txt f="bold" size={15} color={c.logoInk} style={{ lineHeight: 20 }}>
                  {p.name}
                </Txt>
                <Txt f="semibold" size={12} color={c.logoRed}>
                  {p.date}
                </Txt>
                <Txt size={11} color={c.logoInk} style={{ lineHeight: 16 }}>{p.detail}</Txt>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

/** Cuộc trò chuyện minh họa với Quân Sư AI (câu trả lời khớp bài Wikipedia về trận Bạch Đằng 1288) */
const MockAsk: React.FC = () => {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.xam, padding: 18, justifyContent: 'center', gap: 14 }}>
      <View style={{ alignSelf: 'flex-end', maxWidth: '82%', backgroundColor: c.bau, borderRadius: 22, borderBottomRightRadius: 6, paddingHorizontal: 16, paddingVertical: 12 }}>
        <Txt f="semibold" size={15} color={c.trang}>
          Vì sao thuyền giặc thua ở Bạch Đằng?
        </Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end', maxWidth: '92%' }}>
        <Mascot size={48} mood="happy" accessory="scholar" title="Quân Sư AI" />
        <View style={{ flex: 1, backgroundColor: c.the, borderRadius: 22, borderBottomLeftRadius: 6, paddingHorizontal: 16, paddingVertical: 12 }}>
          <Txt size={14} color={c.xanhMuc} style={{ lineHeight: 21 }}>
            Quân Trần bố trí trận địa cọc ngầm dưới sông Bạch Đằng, cho thuyền giả thua để nhử giặc vào. Thuyền Nguyên đuổi theo, va phải cọc ngầm, bị chặn lại rồi bị quân Trần đổ ra đánh tiêu diệt.
          </Txt>
        </View>
      </View>
      <View style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: 8 }}>
        <Chip text="Ví dụ" bg={c.dem} fg={c.trang} />
        <Chip text="Quân Sư AI" icon={MessageSquareText} bg={c.troi5} fg={c.nhan} />
      </View>
    </View>
  );
};

/** Câu hỏi ôn tập minh họa */
const MockReview: React.FC = () => {
  const { c } = useTheme();
  const options = ['Trần Hưng Đạo', 'Ngô Quyền', 'Lê Lợi', 'Quang Trung'];
  return (
    <View style={{ flex: 1, backgroundColor: c.the, padding: 18, justifyContent: 'center', gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Chip text="Tháp Khảo Thí · tầng 8" icon={Landmark} bg={c.troi5} fg={c.nhan} />
        <Chip text="Ví dụ" bg={c.dem} fg={c.trang} />
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: c.troi5 }}>
        <View style={{ width: '60%', height: 6, borderRadius: 3, backgroundColor: c.bau }} />
      </View>
      <Txt f="bold" size={18} color={c.xanhMuc} style={{ lineHeight: 25 }}>
        Trận Bạch Đằng năm 1288 do ai chỉ huy?
      </Txt>
      <View style={{ gap: 7 }}>
        {options.map((o, i) => {
          const right = i === 0;
          return (
            <View
              key={o}
              style={{ minHeight: 42, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderColor: right ? c.ngoc : c.bienXanh, backgroundColor: right ? c.ngocNhat : c.the }}
            >
              <Txt f="bold" size={13} color={right ? c.ngocChu : c.xanhMuc2} style={{ width: 14 }}>
                {'ABCD'[i]}
              </Txt>
              <Txt f={right ? 'bold' : 'medium'} size={14} color={right ? c.ngocChu : c.xanhMuc} style={{ flex: 1 }}>
                {o}
              </Txt>
              {right && <Ico icon={Check} text={14} color={c.ngocChu} />}
            </View>
          );
        })}
      </View>
    </View>
  );
};

/** Nội dung bốn tính năng đặt trong cảnh cuộn: tiêu đề → khung trống → màn hình đầy đủ. */
const ShowcaseSection: React.FC<{ wide: boolean; onSection: (id: string, y: number) => void }> = ({ wide, onSection }) => {
  const { c } = useTheme();
  const [tab, setTab] = useState<ShowId>('choi');
  const cur = SHOWCASE.find((s) => s.id === tab) ?? SHOWCASE[0];
  const color = c[cur.color];
  const pop = usePopIn(tab);
  return (
    <HistoryShowcase wide={wide} onSection={onSection} tabs={(interactive, compact) => (
      <View accessibilityRole="tablist" accessibilityLabel="Chọn tính năng" style={{ flexDirection: 'row', justifyContent: 'center', gap: wide ? 28 : 14 }}>
        {SHOWCASE.map((s) => {
          const on = s.id === tab;
          return (
            <Pressable
              key={s.id}
              onPress={() => setTab(s.id)}
              accessibilityRole="tab"
              accessibilityLabel={s.label}
              accessibilityState={{ selected: on }}
              aria-selected={on}
              disabled={!interactive}
              tabIndex={interactive ? 0 : -1}
              style={{ alignItems: 'center', gap: 8, minWidth: 64, opacity: on ? 1 : 0.78 }}
            >
              <View style={[{ transform: [{ scale: on ? 1.12 : 1 }] }]}>
                <Badge icon={s.icon} color={c[s.color]} size={wide ? compact ? 54 : 64 : 58} fg={s.color === 'logoGold' || s.color === 'logoPaper' ? c.logoInk : c.logoPaper} />
              </View>
              <Txt f="heavy" size={14} color={c.logoInk} center>
                {s.label}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    )} description={(
      <>
        <Tag center text={cur.label} bg={color} fg={cur.color === 'logoGold' || cur.color === 'logoPaper' ? c.logoInk : c.logoPaper} size={20} />
        <Txt f="medium" size={16} color={c.logoInk} center style={{ lineHeight: 23 }}>{cur.text}</Txt>
      </>
    )}>
          <Animated.View style={[{ flex: 1 }, pop]}>
            {tab === 'choi' && <MockPlay />}
            {tab === 'kham-pha' && <MockExplore wide={wide} />}
            {tab === 'hoi-dap' && <MockAsk />}
            {tab === 'on-tap' && <MockReview />}
          </Animated.View>
    </HistoryShowcase>
  );
};

// ---------------------------------------------------------------------- ba lần kháng chiến (đối chiếu Wikipedia)
const FactRow: React.FC<{ icon: IconType; label: string; text: string; color: string }> = ({ icon, label, text, color }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Ico icon={icon} text={15} color={color} />
      <Txt size={15} color={INK_SOFT} style={{ flex: 1 }}>
        <Txt f="bold" size={15} color={c.logoInk}>
          {label}:{' '}
        </Txt>
        {text}
      </Txt>
    </View>
  );
};

/** Bản đồ ba cuộc kháng chiến lấy từ Wikipedia tiếng Việt (Wikimedia Commons, phạm vi công cộng, tác giả Lưu Ly; trên trang không ghi dòng nguồn theo yêu cầu); ratio = rộng / cao của tệp */
const CAMPAIGN_MAP: Record<1 | 2 | 3, { src: ImageSourcePropType; ratio: number }> = {
  1: { src: require('../assets/ban-do-khang-chien-1.webp'), ratio: 1500 / 1052 },
  2: { src: require('../assets/ban-do-khang-chien-2.webp'), ratio: 1000 / 1458 },
  3: { src: require('../assets/ban-do-khang-chien-3.webp'), ratio: 1300 / 974 },
};

/** Bản đồ của cuộc kháng chiến đang chọn; bấm để mở khung phóng to (điện thoại kéo ngang để xem hết) */
const CampaignMap: React.FC<{ id: 1 | 2 | 3; name: string; wide: boolean }> = ({ id, name, wide }) => {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const m = CAMPAIGN_MAP[id];
  const label = `Bản đồ ${name.toLowerCase()}`;
  const fit = Math.min(width - 32, 1280, (height - 150) * m.ratio);
  const bigW = wide ? fit : Math.max(fit, 760);
  /** Khung có tỉ lệ cố định, ảnh phủ kín khung (nếu để ảnh tự co thì nó lấy chiều cao gốc của tệp) */
  const picture = (w: number, radius = 0, alt = '') => (
    <View style={{ width: w, aspectRatio: m.ratio, borderRadius: radius, overflow: 'hidden', backgroundColor: '#ffffff' }}>
      <Image source={m.src} resizeMode="contain" alt={alt} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
    </View>
  );
  return (
    <Panel pad={0} style={[{ width: wide ? 440 : '100%', overflow: 'hidden' }, PAPER_CARD]}>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${label}, bấm để phóng to`} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
        {picture(wide ? 438 : width - 34)}
        <View pointerEvents="none" style={{ position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: 'rgba(35,56,47,0.86)' }}>
          <ZoomIn size={15} color={c.logoPaper} strokeWidth={2} />
          <Txt f="bold" size={12.5} color={c.logoPaper}>
            Phóng to
          </Txt>
        </View>
      </Pressable>
      <View style={{ padding: 14, gap: 4 }}>
        <Txt f="bold" size={14} color={c.logoInk}>
          {label}
        </Txt>
        <Txt size={12.5} color={INK_SOFT} style={{ lineHeight: 18 }}>
          Mũi tên đỏ là quân Đại Việt, mũi tên đen là quân Mông Nguyên (tiến quân, rút chạy); chú thích đầy đủ nằm trong bản đồ.
        </Txt>
      </View>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(8,14,12,0.92)' }}>
          <Pressable onPress={() => setOpen(false)} accessibilityLabel="Đóng bản đồ" style={StyleSheet.absoluteFill} />
          <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16, paddingTop: 64, gap: 12 }} pointerEvents="box-none">
            {wide ? picture(bigW, 12, label) : (
              <ScrollView horizontal showsHorizontalScrollIndicator style={{ width: '100%', flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 8 }}>
                {picture(bigW, 12, label)}
              </ScrollView>
            )}
            <Txt size={13} color="rgba(250,244,231,0.75)" center>
              {label}. {wide ? 'Bấm ra ngoài hoặc nhấn Esc để đóng.' : 'Kéo ngang để xem hết, bấm ra ngoài để đóng.'}
            </Txt>
          </ScrollView>
          <Pressable
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Đóng bản đồ"
            style={{ position: 'absolute', top: 16, right: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(250,244,231,0.16)' }}
          >
            <X size={22} color={c.trang} strokeWidth={2.2} />
          </Pressable>
        </View>
      </Modal>
    </Panel>
  );
};

const CampaignExplorer: React.FC<{ wide: boolean }> = ({ wide }) => {
  const { c } = useTheme();
  const router = useRouter();
  const [sel, setSel] = useState<1 | 2 | 3>(1);
  const camp = CAMPAIGNS[sel - 1];
  const facts = CAMPAIGN_FACTS[sel];
  const look = { accent: c.logoRed, soft: 'rgba(181, 53, 32, 0.08)' };
  const phases = PHASES.filter((p) => p.campaign === sel);
  return (
    <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'flex-start', gap: 24 }}>
      <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 16 }}>
        <View style={{ gap: 10 }}>
          {CAMPAIGNS.map((k) => {
            const on = k.id === sel;
            return (
              <Pressable
                key={k.id}
                onPress={() => setSel(k.id)}
                accessibilityRole="button"
                accessibilityLabel={`${k.name}, ${k.years}. ${CAMPAIGN_BLURB[k.id]}`}
                accessibilityState={{ selected: on }}
                style={({ pressed }) => ({
                  minHeight: 72, padding: 16, borderRadius: 22, borderWidth: 2, flexDirection: 'row', alignItems: 'center', gap: 16,
                  borderColor: on ? look.accent : INK_LINE, backgroundColor: on ? look.soft : 'rgba(255, 255, 255, 0.7)', opacity: pressed ? 0.9 : 1,
                })}
              >
                {wide && (
                  <Txt f="heavy" size={22} color={on ? look.accent : c.logoInk} style={{ minWidth: 104, letterSpacing: -0.4 }}>
                    {k.years.replace(' – ', '–')}
                  </Txt>
                )}
                <View style={{ flex: 1 }}>
                  {!wide && (
                    <Txt f="heavy" size={18} color={on ? look.accent : c.logoInk} style={{ letterSpacing: -0.3 }}>
                      {k.years.replace(' – ', '–')}
                    </Txt>
                  )}
                  <Txt f="bold" size={16} color={c.logoInk}>
                    {k.name}
                  </Txt>
                  <Txt size={14} color={INK_SOFT}>
                    {CAMPAIGN_BLURB[k.id]}
                  </Txt>
                </View>
                <Ico icon={ArrowRight} text={15} color={on ? look.accent : INK_SOFT} />
              </Pressable>
            );
          })}
        </View>
        <Panel pad={24} style={[{ gap: 14 }, PAPER_CARD]}>
          <Txt f="heavy" size={22} color={c.logoInk} accessibilityRole="header" style={{ lineHeight: 28, letterSpacing: -0.3 }}>
            {camp.name} · {camp.years}
          </Txt>
          <FactRow icon={CalendarDays} label="Thời gian" text={facts.time} color={look.accent} />
          <FactRow icon={Sword} label="Đối phương" text={facts.enemy} color={look.accent} />
          <FactRow icon={Landmark} label="Lãnh đạo" text={facts.lead} color={look.accent} />
          <FactRow icon={Users} label="Lực lượng" text={facts.force} color={look.accent} />
          <FactRow icon={Milestone} label="Diễn biến chính" text={facts.key} color={look.accent} />
          <FactRow icon={Trophy} label="Kết quả" text={facts.result} color={look.accent} />
          <View style={{ gap: 10, paddingTop: 14, borderTopWidth: 1, borderTopColor: INK_LINE }}>
            <Txt f="bold" size={13} color={INK_SOFT} upper>
              {phases.length} màn chơi
            </Txt>
            {phases.map((p) => (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ height: lineH(15), justifyContent: 'center' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: look.accent }} />
                </View>
                <Txt size={15} color={c.logoInk} style={{ flex: 1 }}>
                  <Txt f="bold" size={15} color={look.accent}>
                    {PHASE_REAL[p.id].date}
                  </Txt>
                  {'  '}
                  {PHASE_REAL[p.id].title}
                </Txt>
              </View>
            ))}
          </View>
          <Cta title="Chơi chiến dịch này" tone="muc" arrow onPress={() => router.push('/portal')} />
        </Panel>
      </View>
      <CampaignMap id={sel} name={camp.name} wide={wide} />
    </View>
  );
};

/** Hai vòng tròn vàng mảnh ở hai góc nền, giống khối "Nơi học sinh khám phá lịch sử" */
export const GoldRings: React.FC = () => {
  const { c } = useTheme();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={{ position: 'absolute', width: 440, height: 440, borderRadius: 220, borderWidth: 1, borderColor: c.logoGold, opacity: 0.3, right: -260, top: 40 }} />
      <View style={{ position: 'absolute', width: 300, height: 300, borderRadius: 150, borderWidth: 1, borderColor: c.logoGold, opacity: 0.3, left: -190, bottom: 60 }} />
    </View>
  );
};

const ExplorerSection: React.FC<{ wide: boolean; onSection: (id: string, y: number) => void }> = ({ wide, onSection }) => {
  const { c } = useTheme();
  return (
    <Band
      id="khang-chien"
      bg={c.logoPaper}
      wide={wide}
      onSection={onSection}
      decor={<GoldRings />}
    >
      <SectionHeading eyebrow="Dấu ấn lịch sử" title="Ba lần kháng chiến" accent={`chống Nguyên\u00A0–\u2060\u00A0Mông`} description="Chọn một cuộc kháng chiến để xem bản đồ, diễn biến chính và các màn chơi." wide={wide} testID="campaigns-heading" />
      <Reveal>
        <CampaignExplorer wide={wide} />
      </Reveal>
    </Band>
  );
};

// ---------------------------------------------------------------------- danh tướng và lời ông cha
/** Khối danh tướng với tiêu đề theo yêu cầu, dùng màu logo và hiển thị ngay khi cuộn tới. */
const CastSection: React.FC<{ wide: boolean; onSection: (id: string, y: number) => void }> = ({ wide, onSection }) => {
  const { c } = useTheme();
  return (
    <Band id="danh-tuong" bg={c.logoPaper} wide={wide} onSection={onSection} decor={<GoldRings />}>
      <SectionHeading eyebrow="Gương mặt lịch sử" title="Các vị vua" accent="thời Trần" wide={wide} singleLine testID="generals-heading" />
      <HeroGallery wide={wide} />
    </Band>
  );
};

/** Bốn thẻ lời ông cha theo bảng màu logo như khối "Nơi học sinh khám phá lịch sử" (đỏ cờ, vàng cổ, mực xanh, giấy kem); chỉ dùng lời có trong dữ liệu game và sử liệu */
const QuotesSection: React.FC<{ wide: boolean; onSection: (id: string, y: number) => void }> = ({ wide, onSection }) => {
  const { c } = useTheme();
  const tones = [
    { bg: c.logoRed, fg: c.logoPaper },
    { bg: c.logoGold, fg: c.logoInk },
    { bg: c.logoInk, fg: c.logoPaper },
    { bg: 'rgba(255, 255, 255, 0.86)', fg: c.logoInk },
  ];
  return (
    <Band id="loi-ong-cha" bg={c.logoPaper} wide={wide} onSection={onSection} decor={<GoldRings />}>
      <SectionHeading eyebrow="Hào khí Đông A" title="Lời ông cha" accent="còn vang mãi" description="Những câu nói làm nên hào khí Đông A, có trong từng màn chơi của game." wide={wide} singleLine testID="quotes-heading" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18, justifyContent: 'center' }}>
        {QUOTES.map((q, i) => (
          <Reveal key={q.who} delay={i * 80} style={{ width: wide ? 258 : '100%' }}>
          <Lift tilt={wide ? (i % 2 ? 1.5 : -1.5) : 0} style={{ width: '100%' }}>
          <View
            accessible
            accessibilityLabel={`${q.text} – ${q.who}, ${q.note}`}
            style={[{ width: '100%', minHeight: wide ? 270 : undefined, borderRadius: 28, backgroundColor: tones[i].bg, padding: 22, gap: 12 }, i === 3 ? { borderWidth: 1, borderColor: INK_LINE } : null, shadow(c, 'sm')]}
          >
            <Quote size={34} color={i === 3 ? c.logoRed : tones[i].fg} strokeWidth={2.2} />
            <Txt f="heavy" size={q.text.length < 12 ? 44 : 21} color={tones[i].fg} style={{ lineHeight: q.text.length < 12 ? 50 : 28, flex: 1 }}>
              {q.text}
            </Txt>
            <View>
              <Txt f="heavy" size={16} color={tones[i].fg}>
                {q.who}
              </Txt>
              <Txt size={13} color={tones[i].fg} style={{ lineHeight: 18 }}>
                {q.note}
              </Txt>
            </View>
          </View>
          </Lift>
          </Reveal>
        ))}
      </View>
    </Band>
  );
};

// ---------------------------------------------------------------------- cách hoạt động và câu hỏi thường gặp
const STEPS: Array<{ icon: IconType; title: string; text: string }> = [
  { icon: FileSpreadsheet, title: 'Nhà trường cấp tài khoản', text: 'Quản trị trường nhập file Excel mẫu một lần là có tài khoản cho giáo viên và học sinh; mật khẩu ban đầu được gửi qua thư điện tử.' },
  { icon: Users, title: 'Giáo viên lập lớp', text: 'Giáo viên xin mở lớp, được nhà trường duyệt rồi mời học sinh vào bằng mã lớp.' },
  { icon: Joystick, title: 'Học sinh vào trận', text: 'Thu lương thảo, chiêu mộ danh tướng và đánh các màn chiến dịch; mỗi sức mạnh đều đến từ một câu trả lời đúng. Cần gợi ý thì hỏi Quân Sư AI.' },
  { icon: Trophy, title: 'Cả lớp cùng tiến bộ', text: 'Giáo viên theo dõi tiến độ và mức nắm vững của từng em, rồi mở phòng thi đấu bằng mã PIN để cả lớp thi trên điện thoại.' },
];

/** Bốn bước từ lúc nhà trường cấp tài khoản đến khi cả lớp ra trận */
const HowSection: React.FC<{ wide: boolean; onSection: (id: string, y: number) => void }> = ({ wide, onSection }) => {
  const { c } = useTheme();
  return (
    <Band id="cach-hoat-dong" bg={c.logoPaper} wide={wide} onSection={onSection} decor={<GoldRings />}>
      <SectionHeading eyebrow="Hướng dẫn tham gia" title="Cách" accent="hoạt động" description="Từ lúc nhà trường cấp tài khoản đến khi cả lớp cùng ra trận, chỉ bốn bước." wide={wide} singleLine testID="how-heading" />
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16, alignItems: 'stretch' }}>
        {STEPS.map((s, i) => (
          <Reveal key={s.title} delay={i * 90} style={{ flex: wide ? 1 : undefined }}>
            <Lift fill={wide} style={{ flex: wide ? 1 : undefined }}>
              <View style={[{ flex: wide ? 1 : undefined, borderRadius: 28, borderWidth: 1, padding: 22, gap: 12 }, PAPER_CARD]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.logoRed, alignItems: 'center', justifyContent: 'center' }}>
                    <s.icon size={iconPx(18)} color={c.logoPaper} strokeWidth={1.8} />
                  </View>
                  <Txt f="heavy" size={40} color={c.logoGold} style={{ lineHeight: 44 }}>
                    {String(i + 1).padStart(2, '0')}
                  </Txt>
                </View>
                <Txt f="heavy" size={19} color={c.logoInk} style={{ lineHeight: 25 }}>
                  {s.title}
                </Txt>
                <Txt size={14.5} color={INK_SOFT} style={{ lineHeight: 22 }}>
                  {s.text}
                </Txt>
              </View>
            </Lift>
          </Reveal>
        ))}
      </View>
    </Band>
  );
};

/**
 * Câu hỏi thường gặp, bố cục hai cột: bên trái là nhãn nhỏ, tiêu đề, một dòng giới thiệu và nút mở/thu gọn tất cả; bên phải là danh sách các câu
 * ngăn bằng đường kẻ mảnh, bấm để mở/đóng từng câu (có thể mở nhiều câu cùng lúc, mở sẵn câu đầu). Không có hiệu ứng trượt hay hiện dần.
 * Nút "Xem tất cả câu hỏi" mở trang đầy đủ /cau-hoi-thuong-gap (components/faq-page.tsx); sáu câu ở đây lấy từ constants/faq.ts.
 */
const FaqSection: React.FC<{ wide: boolean; onSection: (id: string, y: number) => void }> = ({ wide, onSection }) => {
  const { c } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const two = width >= 1000; // hai cột cần đủ chỗ: hẹp hơn thì xếp dọc
  const [open, setOpen] = useState<number[]>([0]);
  const toggle = (i: number) => setOpen((o) => (o.includes(i) ? o.filter((x) => x !== i) : [...o, i]));
  const h = wide ? 42 : 32;
  return (
    <Band id="cau-hoi" bg={c.logoPaper} wide={wide} onSection={onSection} decor={<GoldRings />}>
      <View style={{ flexDirection: two ? 'row' : 'column', alignItems: 'flex-start', gap: two ? 56 : 32 }}>
        <View style={{ width: two ? 420 : '100%', gap: 16 }}>
          <Txt f="bold" size={12.5} color={c.logoRed} upper style={{ letterSpacing: 1.6 }}>
            Có thể bạn đang tò mò
          </Txt>
          <Txt f="heavy" size={h} color={c.logoInk} accessibilityRole="header" style={{ lineHeight: h + 7, letterSpacing: -1 }}>
            Một vài điều{'\n'}
            <Txt f="serifItalic" size={h} color={c.logoRed} style={{ lineHeight: h + 9, letterSpacing: -0.5 }}>
              trước khi bắt đầu.
            </Txt>
          </Txt>
          <Txt f="medium" size={16} color={INK_SOFT} style={{ lineHeight: 24 }}>
            Hiểu thêm về Đông A và cách tham gia.
          </Txt>
          <Cta title="Xem tất cả câu hỏi" tone="logo" arrow onPress={() => router.push('/cau-hoi-thuong-gap')} testID="faq-all" />
        </View>
        <View style={{ flex: two ? 1 : undefined, width: two ? undefined : '100%', borderTopWidth: 1, borderTopColor: INK_LINE }}>
          {FAQ_HOME.map((f, i) => {
            const on = open.includes(i);
            return (
              <View key={f.q} style={{ borderBottomWidth: 1, borderBottomColor: INK_LINE }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: on }}
                  aria-expanded={on}
                  onPress={() => toggle(i)}
                  style={({ pressed }) => ({ minHeight: 64, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', gap: 16, opacity: pressed ? 0.8 : 1 })}
                >
                  <Txt f="heavy" size={wide ? 18 : 16.5} color={on ? c.logoRed : c.logoInk} style={{ flex: 1, lineHeight: 25 }}>
                    {f.q}
                  </Txt>
                  {on ? <X size={20} color={c.logoRed} strokeWidth={2.2} /> : <Plus size={20} color={INK_SOFT} strokeWidth={2.2} />}
                </Pressable>
                {on ? (
                  <View style={{ paddingBottom: 22, paddingRight: 36 }}>
                    <Txt size={15.5} color={INK_SOFT} style={{ lineHeight: 25 }}>
                      {f.a}
                    </Txt>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
    </Band>
  );
};

// ---------------------------------------------------------------------- kêu gọi cuối trang và chân trang
/** Khối tối cuối trang: cảnh bình minh Bạch Đằng, mây trắng nối từ khối trên (kiểu khối ảnh tối + mây của Papumba) */
const ClosingSection: React.FC<{ wide: boolean }> = ({ wide }) => {
  const { c } = useTheme();
  const router = useRouter();
  return (
    <View testID="home-closing-section" style={{ width: '100%', backgroundColor: c.dem, overflow: 'hidden' }}>
      <FilmBackdrop wide={wide} only={[7]} dim={0.12} scrim />
      <View style={{ width: '100%', maxWidth: 860, alignSelf: 'center', paddingHorizontal: 16, paddingTop: wide ? 190 : 150, paddingBottom: wide ? 130 : 90 }}>
      <Reveal from="scale">
      <View style={{ alignItems: 'center', gap: 22 }}>
        <ClosingTitle wide={wide} />
        <View style={{ alignSelf: 'center' }}>
          <Cta title="Vào học ngay" tone="trang" arrow lg onPress={() => router.push('/portal')} testID="home-portal-bottom" />
        </View>
      </View>
      </Reveal>
      </View>
    </View>
  );
};

/** Liên kết cột "Khám phá" ở chân trang, theo thứ tự trên trang */
const FOOT_LINKS: Array<{ id: string; label: string }> = [
  { id: 'home', label: 'Về Đông A' },
  { id: 'kham-pha', label: 'Tính năng' },
  { id: 'khang-chien', label: 'Ba lần kháng chiến' },
  { id: 'danh-tuong', label: 'Danh tướng' },
  { id: 'cach-hoat-dong', label: 'Cách hoạt động' },
  { id: 'cau-hoi', label: 'Câu hỏi thường gặp' },
];

const FOOT_TEXT = 'rgba(250, 244, 231, 0.78)';

const FootLink: React.FC<{ label: string; onPress: () => void; arrow?: boolean }> = ({ label, onPress, arrow = false }) => {
  const { c } = useTheme();
  const [hover, setHover] = useState(false), [focus, setFocus] = useState(false);
  const active = hover || focus;
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}>
      <Txt f="medium" size={15} color={active ? c.logoGold : c.logoPaper} style={{ textDecorationLine: active ? 'underline' : 'none' }}>
        {label}
      </Txt>
      {arrow ? <ArrowUpRight size={16} color={c.logoGold} strokeWidth={2.2} /> : null}
    </Pressable>
  );
};

/** Chân trang: dải sóng đỏ vàng, rồi nền mực xanh của logo với logo và mô tả, cột "Khám phá", cột "Khám phá lịch sử thời Trần" kèm liên kết "Trang quản lý" và thanh bản quyền có "Về đầu trang" */
export const FooterSection: React.FC<{ wide: boolean; go: (id: string) => void; onTop?: () => void }> = ({ wide, go, onTop = () => go('home') }) => {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const head = (text: string) => (
    <Txt f="heavy" size={16} color={c.logoGold} accessibilityRole="header" style={{ marginBottom: 6 }}>
      {text}
    </Txt>
  );
  return (
    <View style={{ width: '100%', backgroundColor: c.logoInk, overflow: 'hidden' }}>
      <PatternOverlay opacity={0.05} />
      <ThreadedWaveBand testID="footer-wave-band" />
      <View style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingTop: wide ? 56 : 40, paddingBottom: insets.bottom + 20, gap: 30 }}>
        <View style={{ flexDirection: wide ? 'row' : 'column', justifyContent: 'space-between', gap: wide ? 40 : 32 }}>
          <View style={{ width: wide ? 340 : '100%', gap: 16 }}>
            <BrandLogo light />
            <Txt size={14.5} color={FOOT_TEXT} style={{ lineHeight: 23 }}>
              Nền tảng học tập game hóa hỗ trợ khám phá lịch sử ba lần kháng chiến chống Nguyên – Mông thời Trần.
            </Txt>
          </View>
          {WEB && (
            <View testID="footer-explore-column" style={{ minWidth: wide ? 220 : undefined }}>
              {head('Khám phá')}
              {FOOT_LINKS.map((l) => (
                <FootLink key={l.id} label={l.label} onPress={() => go(l.id)} />
              ))}
            </View>
          )}
          <View testID="footer-history-column" style={{ width: wide ? 300 : '100%' }}>
            {head('Khám phá lịch sử thời Trần')}
            <FootLink label="Điều khoản sử dụng" arrow onPress={() => router.push('/dieu-khoan-su-dung')} />
            <FootLink label="Trang quản lý" arrow onPress={() => router.push('/admin')} />
            <FootLink label="Thông tin hình ảnh" onPress={() => router.push('/thong-tin-hinh-anh')} />
          </View>
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(250, 244, 231, 0.18)', paddingTop: 18, flexDirection: wide ? 'row' : 'column', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Txt size={13} color={FOOT_TEXT} center={!wide}>
            © 2026 · Đông A
          </Txt>
          <Txt size={13} color={FOOT_TEXT} center>
            Học Sử vui như chơi game
          </Txt>
          <Pressable accessibilityRole="link" accessibilityLabel="Về đầu trang" onPress={onTop} style={({ pressed }) => ({ minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed ? 0.7 : 1 })}>
            <Txt size={13} color={FOOT_TEXT}>
              Về đầu trang
            </Txt>
            <ArrowUp size={18} color={c.logoGold} strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>
    </View>
  );
};

/** Toàn bộ nội dung trang chủ, theo thứ tự từ trên xuống (onSection báo vị trí các phần có neo cho thanh điều hướng) */
export const HomeSections: React.FC<{ wide: boolean; go: (id: string) => void; onSection: (id: string, y: number) => void; onVideoImmersiveChange: (on: boolean) => void }> = ({ wide, go, onSection, onVideoImmersiveChange }) => {
  const { c } = useTheme();
  return (
  <>
    <HeroSection wide={wide} go={go} />
    <View style={{ backgroundColor: c.xam }}>
      <ThreadedWaveBand testID="hero-wave-band" />
    </View>
    <PhaseCampaignGallery wide={wide} onSection={onSection} />
    <CloudPair upper={c.xam} lower={c.logoPaper} wide={wide} variant={1} />
    <HomeVideo wide={wide} onImmersiveChange={onVideoImmersiveChange} />
    <SectionCloud color={c.logoPaper} rim wide={wide} direction="up" variant={1} />
    <ShowcaseSection wide={wide} onSection={onSection} />
    <CloudPair upper={c.logoPaper} lower={c.logoPaper} wide={wide} variant={1} />
    <ExplorerSection wide={wide} onSection={onSection} />
    <CloudPair upper={c.logoPaper} lower={c.logoPaper} wide={wide} variant={1} />
    <CastSection wide={wide} onSection={onSection} />
    <CloudPair upper={c.logoPaper} lower={c.logoPaper} wide={wide} variant={1} />
    <QuotesSection wide={wide} onSection={onSection} />
    <CloudPair upper={c.logoPaper} lower={c.logoPaper} wide={wide} variant={0} />
    <HowSection wide={wide} onSection={onSection} />
    <CloudPair upper={c.logoPaper} lower={c.logoPaper} wide={wide} variant={2} />
    <FaqSection wide={wide} onSection={onSection} />
    <SectionCloud color={c.logoPaper} rim wide={wide} variant={2} />
    <ClosingSection wide={wide} />
    <FooterSection wide={wide} go={go} />
  </>
  );
};
