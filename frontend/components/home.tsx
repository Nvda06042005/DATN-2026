/**
 * Các khối của trang chủ công khai: bố cục kiểu Papumba (chữ trắng khổng lồ ở giữa, nav viên thuốc trắng, khối màu bão hòa xen kẽ, khung máy tính bảng,
 * dải thẻ nghiêng chạy ngang, thẻ lời ông cha nhiều màu) nhưng hình ảnh và màu sắc lấy từ cuộc kháng chiến chống quân Nguyên – Mông thời Trần:
 * cảnh thành Thăng Long – thuyền chiến – bãi cọc Bạch Đằng, đỏ son, vàng, lam sông, giấy dó, họa tiết sóng nước và ấn đỏ.
 * Nội dung lịch sử đối chiếu Wikipedia tiếng Việt "Chiến tranh Nguyên Mông – Đại Việt" và ba bài chi tiết từng lần; số liệu lấy thẳng từ dữ liệu game.
 * Khối luôn tối/sáng cố định dùng màu `trang`/`dem`; thẻ và chữ dùng màu đổi theo chế độ sáng/tối. Không có liên kết tới hai cổng quản trị.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Activity, ArrowDown, ArrowRight, ArrowUpRight, Check, Compass, Database, Download, FileSpreadsheet, Joystick, Landmark, LayoutDashboard, Layers, LibraryBig, Lock,
  LogIn, Map as MapIcon, MapPin, MessageSquareText, Milestone, Moon, Quote, RadioTower, School, Send, Smartphone, Sun, Sword, Swords, Table2,
  TrendingUp, Trophy, Undo2, Users, WandSparkles, Zap,
} from 'lucide-react-native';
import {
  BattleBackdrop, BrandLogo, CloudBank, EnemyBadge, FilmBackdrop, GradeBadge, HeroMedallion, KahootShape, Mascot, SchematicMap, Seal, VietnamFlag, WaveBand,
  type MascotAccessory,
} from '@/components/art';
import { LoreChip } from '@/components/game/quiz';
import { TemplateGuide, downloadTemplate } from '@/components/provisioning';
import { Chip, Txt } from '@/components/ui';
import { HomeVideo } from '@/components/home-video';
import { CAMPAIGNS, CAMPAIGN_ROUTES, PHASES, PHASE_REAL } from '@/constants/campaigns';
import { ELEMENTS, ENEMIES, LORE_LABEL, MAP_PLACES } from '@/constants/game';
import { HEROES, HERO_BY_ID } from '@/constants/heroes';
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
  { id: 'khang-chien', label: 'Ba lần kháng chiến', short: 'Kháng chiến' },
  { id: 'danh-tuong', label: 'Danh tướng', short: 'Danh tướng' },
  { id: 'vi-sao', label: 'Dành cho ai', short: 'Dành cho ai' },
  { id: 'de-tai', label: 'Về đề tài', short: 'Về đề tài' },
] as const;

// ---------------------------------------------------------------------- dữ liệu nội dung
/**
 * Thông tin tóm tắt mỗi cuộc kháng chiến, đối chiếu Wikipedia tiếng Việt: "Chiến tranh Nguyên Mông – Đại Việt" và ba bài "… lần 1/2/3".
 * Lần 1 là quân Mông Cổ (nhà Nguyên lập sau, năm 1271); hai lần sau là quân Nguyên.
 */
const CAMPAIGN_FACTS: Record<1 | 2 | 3, { enemy: string; lead: string; key: string }> = {
  1: {
    enemy: 'Quân Mông Cổ (kèm quân Đại Lý) do Ngột Lương Hợp Thai và con trai là Aju chỉ huy',
    lead: 'Vua Trần Thái Tông cùng Thái tử Trần Hoảng, Thái sư Trần Thủ Độ',
    key: 'Thua ở Bình Lệ Nguyên (17/1) và Phù Lỗ (18/1), bỏ Thăng Long với "vườn không nhà trống"; đêm 28/1/1258 phản công, thắng ở Đông Bộ Đầu',
  },
  2: {
    enemy: 'Quân Nguyên (Hốt Tất Liệt ra lệnh): Thoát Hoan đánh từ phía Bắc, Toa Đô từ Chiêm Thành đánh ra',
    lead: 'Thượng hoàng Trần Thánh Tông, vua Trần Nhân Tông, Quốc công tiết chế Trần Hưng Đạo',
    key: 'Hội nghị Bình Than, Diên Hồng; rút về Thanh Hóa rồi phản công: thắng Hàm Tử, Chương Dương, giải phóng Thăng Long, diệt quân Toa Đô ở Tây Kết (24/6/1285)',
  },
  3: {
    enemy: 'Quân Nguyên chia ba cánh vào Đại Việt: Thoát Hoan chỉ huy chung, Ô Mã Nhi chỉ huy thủy quân',
    lead: 'Thượng hoàng Trần Thánh Tông, vua Trần Nhân Tông, Quốc công tiết chế Trần Hưng Đạo',
    key: 'Tập kích đoàn thuyền lương ở Vân Đồn (đầu 1288); sáng 9/4/1288 thủy quân Nguyên vào sông Bạch Đằng, mắc cọc ngầm và bị tiêu diệt',
  },
};

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

/** Lời ông cha, nguyên văn như trong dữ liệu game (riêng "Đánh!" theo Đại Việt sử ký toàn thư, Wikipedia dẫn lại) */
const QUOTES = [
  { text: 'Ta thà làm quỷ nước Nam, chứ không thèm làm vương đất Bắc!', who: 'Trần Bình Trọng', note: 'khi bị giặc bắt và dụ hàng, 1285', bg: '#f6b8a8' },
  { text: 'Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo!', who: 'Trần Thủ Độ', note: 'trước thế giặc mạnh, 1258', bg: '#ffd84d' },
  { text: 'Phá cường địch, báo hoàng ân', who: 'Trần Quốc Toản', note: 'sáu chữ vàng thêu trên lá cờ của ông, 1285', bg: '#bfe3a4' },
  { text: 'Đánh!', who: 'Các bô lão', note: 'cùng đáp “như từ một miệng” ở Hội nghị Diên Hồng', bg: '#a9d4ee' },
] as const;

type AudienceId = 'hoc_sinh' | 'giao_vien' | 'nha_truong';
interface Benefit {
  icon: IconType;
  title: string;
  text: string;
}
const AUDIENCE: Record<AudienceId, Benefit[]> = {
  hoc_sinh: [
    { icon: Joystick, title: 'Học như chơi game', text: 'Thu lương thảo, chiêu mộ và tiến hóa danh tướng, đánh các màn chiến dịch – mỗi sức mạnh đều đến từ một câu trả lời đúng.' },
    { icon: MessageSquareText, title: 'Quân Sư AI giải đáp', text: 'Hỏi bất cứ điều gì về ba lần kháng chiến; câu trả lời dựa trên kho kiến thức sử liệu của đề tài.' },
    { icon: MapIcon, title: 'Khám phá Hành Trình Đông A', text: 'Đi khắp làng pixel, trò chuyện với dân làng, thu cuộn sử và làm nhiệm vụ để hiểu chuyện xưa.' },
    { icon: TrendingUp, title: 'Ôn đúng chỗ còn yếu', text: 'Hệ thống ghi nhận mức nắm vững từng kiến thức sau mỗi câu trả lời và gợi ý câu hỏi tiếp theo.' },
  ],
  giao_vien: [
    { icon: LayoutDashboard, title: 'Theo dõi cả lớp', text: 'Tiến độ, câu sai nhiều nhất và mức nắm vững của từng em trên một màn hình.' },
    { icon: Zap, title: 'Thi đấu trực tiếp', text: 'Mở phòng bằng mã PIN, cả lớp thi đấu thời gian thực kiểu Kahoot ngay trên điện thoại.' },
    { icon: WandSparkles, title: 'Soạn đề bằng AI', text: 'Tạo nhanh câu hỏi ôn tập từ kho kiến thức của đề tài, tiết kiệm thời gian chuẩn bị bài.' },
    { icon: Users, title: 'Quản lý lớp học', text: 'Xin mở lớp, được nhà trường duyệt rồi mời học sinh vào bằng mã lớp.' },
  ],
  nha_truong: [
    { icon: Table2, title: 'Cấp tài khoản hàng loạt', text: 'Điền file Excel mẫu, quản trị trường nhập một lần là có tài khoản giáo viên và học sinh.' },
    { icon: Lock, title: 'Dữ liệu tách theo trường', text: 'Mỗi trường chỉ thấy dữ liệu của mình nhờ phân quyền ngay ở tầng cơ sở dữ liệu.' },
    { icon: Send, title: 'Gửi tài khoản qua thư', text: 'Mật khẩu ban đầu được gửi qua thư điện tử, không hiển thị công khai.' },
    { icon: Undo2, title: 'Xóa nhầm vẫn khôi phục', text: 'Tài khoản bị xóa nằm trong thùng rác 45 ngày trước khi xóa vĩnh viễn.' },
  ],
};

const TECH: Benefit[] = [
  { icon: Trophy, title: 'Game hóa', text: 'Điểm kinh nghiệm, Ấn Tín, tướng, nhiệm vụ và thi đấu' },
  { icon: Activity, title: 'BKT', text: 'Ước lượng mức nắm vững từng kiến thức' },
  { icon: LibraryBig, title: 'RAG', text: 'Hỏi đáp dựa trên kho kiến thức sử liệu' },
  { icon: RadioTower, title: 'Thời gian thực', text: 'WebSocket cho phòng thi đấu cả lớp' },
  { icon: Layers, title: 'Đa nền tảng', text: 'Expo React Native: một mã nguồn cho web, Android, iOS' },
  { icon: Database, title: 'PostgreSQL + RLS', text: 'Dữ liệu bền vững, tách theo trường' },
];

const GOALS = [
  'Số hóa kiến thức ba lần kháng chiến (1258, 1285, 1287 – 1288) thành màn chơi, thẻ Sử Ký và câu hỏi có đáp án.',
  'Tạo động lực học bằng cơ chế game hóa: điểm kinh nghiệm, Ấn Tín, chiêu mộ và tiến hóa danh tướng, nhiệm vụ.',
  'Cá nhân hóa việc học bằng theo dõi mức nắm vững (BKT) và trợ lý hỏi đáp (RAG).',
  'Cung cấp công cụ để giáo viên và nhà trường tổ chức lớp, thi đấu và cấp tài khoản.',
];

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
type CtaTone = 'den' | 'trang' | 'son' | 'xanh';

/** Nút viên thuốc bo tròn, cao tối thiểu 44 */
const Cta: React.FC<{ title: string; onPress: () => void; tone?: CtaTone; icon?: IconType; arrow?: boolean; lg?: boolean; label?: string; testID?: string }> = ({
  title, onPress, tone = 'den', icon, arrow = false, lg = false, label, testID,
}) => {
  const { c } = useTheme();
  const t = {
    den: { bg: c.den, fg: c.trang, bd: c.kinhVien },
    trang: { bg: c.trang, fg: c.dem, bd: c.trang },
    son: { bg: c.son, fg: c.trang, bd: c.son },
    xanh: { bg: c.xanhMuc, fg: c.the, bd: c.xanhMuc },
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

/** Dải toàn chiều rộng; cloudTop/cloudBottom = màu khối liền kề để vẽ dải sóng/mây chuyển */
const Band: React.FC<{
  id?: string; bg?: string; cloudTop?: string; cloudBottom?: string; wide: boolean; gap?: number; onSection?: (id: string, y: number) => void; children: React.ReactNode;
}> = ({ id, bg, cloudTop, cloudBottom, wide, gap = 32, onSection, children }) => (
  <View id={id} onLayout={id && onSection ? (e) => onSection(id, e.nativeEvent.layout.y) : undefined} style={[{ width: '100%', backgroundColor: bg }, id ? ANCHOR : null]}>
    {cloudTop && <CloudBank color={cloudTop} flip />}
    <View
      style={{
        width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, gap,
        paddingTop: (wide ? 88 : 56) + (cloudTop ? 24 : 0), paddingBottom: (wide ? 88 : 56) + (cloudBottom ? 40 : 0),
      }}
    >
      {children}
    </View>
    {cloudBottom && <CloudBank color={cloudBottom} />}
  </View>
);

const Head: React.FC<{ title: string; text?: string; wide: boolean; light?: boolean }> = ({ title, text, wide, light = false }) => {
  const { c } = useTheme();
  return (
    <Reveal>
      <View style={{ gap: 12, alignItems: 'center' }}>
        <Txt f="heavy" size={wide ? 52 : 32} color={light ? c.trang : c.xanhMuc} center accessibilityRole="header" style={{ lineHeight: wide ? 58 : 38, letterSpacing: wide ? -1.6 : -0.8, maxWidth: 860 }}>
          {title}
        </Txt>
        {text && (
          <Txt f="medium" size={wide ? 20 : 17} color={light ? c.trang : c.xanhMuc2} center style={{ maxWidth: 720, lineHeight: wide ? 29 : 25 }}>
            {text}
          </Txt>
        )}
      </View>
    </Reveal>
  );
};

/**
 * Dải thẻ chạy ngang liên tục (nhân đôi nội dung để nối liền); rê chuột vào thì dừng để đọc, bỏ chuột ra chạy tiếp từ chỗ đang dừng.
 * Giảm chuyển động thì chuyển thành dải cuộn ngang bằng tay.
 */
const Marquee: React.FC<{ children: React.ReactNode; speed?: number }> = ({ children, speed = 34 }) => {
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const [hold, setHold] = useState(false);
  const x = useRef(new Animated.Value(0)).current;
  const at = useRef(0);
  useEffect(() => {
    if (!w || reduce || hold) return undefined;
    let alive = true;
    const run = () => {
      Animated.timing(x, { toValue: -w, duration: ((w + at.current) / speed) * 1000, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }).start(({ finished }) => {
        if (finished && alive) {
          x.setValue(0);
          at.current = 0;
          run();
        }
      });
    };
    run();
    return () => {
      alive = false;
      x.stopAnimation((v) => {
        at.current = v;
      });
    };
  }, [w, reduce, hold, speed, x]);
  if (reduce) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ paddingHorizontal: 16 }}>
        {children}
      </ScrollView>
    );
  }
  return (
    <Pressable focusable={false} accessible={false} onHoverIn={() => setHold(true)} onHoverOut={() => setHold(false)} style={{ width: '100%', overflow: 'hidden' }}>
      <Animated.View style={{ flexDirection: 'row', transform: [{ translateX: x }] }}>
        <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ flexDirection: 'row' }}>
          {children}
        </View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row' }}>
          {children}
        </View>
      </Animated.View>
    </Pressable>
  );
};

/** Khung máy tính bảng viền đen bo tròn (kiểu Papumba) đựng màn hình minh họa */
const Tablet: React.FC<{ children: React.ReactNode; wide: boolean }> = ({ children, wide }) => {
  const { c } = useTheme();
  return (
    <View style={[{ width: '100%', maxWidth: 780, aspectRatio: wide ? 4 / 3 : 0.92, borderRadius: wide ? 44 : 32, backgroundColor: c.den, padding: wide ? 14 : 10 }, shadow(c, 'lg')]}>
      <View style={{ flex: 1, borderRadius: wide ? 32 : 24, overflow: 'hidden', backgroundColor: c.the }}>{children}</View>
      <View style={{ position: 'absolute', top: wide ? 4 : 3, alignSelf: 'center', width: 6, height: 6, borderRadius: 3, backgroundColor: '#2a3140' }} />
    </View>
  );
};

// ---------------------------------------------------------------------- thanh điều hướng
/** Các mục trên thanh điều hướng: "Trang chủ" cuộn về đầu trang, còn lại cuộn tới phần có id tương ứng */
const NAV_ITEMS = [{ id: 'home', short: 'Trang chủ' }, ...NAV.map((n) => ({ id: n.id, short: n.short }))];

/** Nút tròn chứa một biểu tượng (cỡ biểu tượng theo chữ 15; vùng chạm 46 kể cả hitSlop) */
const RoundBtn: React.FC<{ icon: IconType; label: string; onPress: () => void; color: string; bg: string; border: string; testID?: string }> = ({
  icon: Icon, label, onPress, color, bg, border, testID,
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    testID={testID}
    hitSlop={2}
    style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: border, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
  >
    <Icon size={iconPx(15)} color={color} strokeWidth={1.75} />
  </Pressable>
);

/**
 * Thanh điều hướng cố định phía trên cùng. Ở đầu trang: logo trắng bên trái, viên thuốc trắng chứa các mục ở giữa (mục đang xem màu cam),
 * nút đen "Vào học ngay" bên phải. Khi cuộn, cả thanh co hẹp lại thành một viên thuốc kính sáng/tối. Có nút đổi sáng/tối và cờ Tiếng Việt.
 */
export const Header: React.FC<{ width: number; scrollY: Animated.Value; stuck: boolean; active: string; go: (id: string) => void; onToggleTheme: () => void }> = ({
  width, scrollY, stuck, active, go, onToggleTheme,
}) => {
  const { c, dark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const wide = width >= 1100;
  const clamp = { extrapolate: 'clamp' } as const;
  const maxWidth = scrollY.interpolate({ inputRange: [0, 120], outputRange: [MAX_W, 1010], ...clamp });
  const height = scrollY.interpolate({ inputRange: [0, 80], outputRange: [64, 56], ...clamp });
  const marginTop = scrollY.interpolate({ inputRange: [0, 80], outputRange: [16, 8], ...clamp });
  const bg = scrollY.interpolate({ inputRange: [0, 60], outputRange: ['rgba(255,255,255,0)', c.kinhDac], ...clamp });
  const border = scrollY.interpolate({ inputRange: [0, 60], outputRange: ['rgba(255,255,255,0)', c.bienXanh], ...clamp });
  const navBg = scrollY.interpolate({ inputRange: [0, 60], outputRange: [c.the, c.kinhDac], ...clamp });
  const fg = stuck ? c.xanhMuc : dark ? c.trang : c.dem;
  const roundBg = stuck ? 'rgba(255,255,255,0)' : c.the;
  const ring = stuck ? c.bienXanh : c.the;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40, alignItems: 'center', paddingHorizontal: 12, paddingTop: insets.top }}>
      <Animated.View
        style={[
          { width: '100%', maxWidth, height, marginTop, borderRadius: 999, borderWidth: 1, borderColor: border, backgroundColor: bg, paddingLeft: 10, paddingRight: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
          stuck ? GLASS : null,
        ]}
      >
        <Pressable onPress={() => go('home')} accessibilityRole="link" accessibilityLabel="Về đầu trang" hitSlop={4} style={{ minHeight: 44, justifyContent: 'center' }}>
          <BrandLogo light={!stuck} compact={width < 380} />
        </Pressable>
        {WEB && wide && (
          <Animated.View accessibilityRole="menu" style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, backgroundColor: navBg, paddingHorizontal: 8, height: 50 }}>
            {NAV_ITEMS.map((n) => {
              const on = n.id === active;
              return (
                <Pressable
                  key={n.id}
                  accessibilityRole="link"
                  accessibilityLabel={n.short}
                  accessibilityState={{ selected: on }}
                  onPress={() => go(n.id)}
                  style={{ minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' }}
                >
                  <Txt f="bold" size={15} color={on ? c.sonChu : c.xanhMuc}>
                    {n.short}
                  </Txt>
                </Pressable>
              );
            })}
          </Animated.View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <RoundBtn
            icon={dark ? Moon : Sun}
            label={dark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
            onPress={onToggleTheme}
            color={fg}
            bg={roundBg}
            border={ring}
            testID="home-theme"
          />
          {width >= 340 && (
            <View style={{ borderRadius: 6, borderWidth: 1, borderColor: ring, padding: 1, backgroundColor: roundBg }}>
              <VietnamFlag width={34} />
            </View>
          )}
          <Cta title={width >= 560 ? 'Vào học ngay' : ''} label="Đăng nhập học tập" icon={width >= 560 ? undefined : LogIn} onPress={() => router.push('/portal')} testID="home-login" />
        </View>
      </Animated.View>
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
  const h1 = wide ? 96 : 50;
  /** Cụm Đông A: chữ nghiêng có chân (Newsreader) màu đỏ son, cùng cỡ với chữ không chân đậm Hào Khí */
  const accent = h1;
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
    <View style={{ width: '100%', minHeight: minH, backgroundColor: c.dem, overflow: 'hidden' }}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, sceneFx]}>
        <FilmBackdrop wide={wide} scrim />
      </Animated.View>
      <Animated.View style={[{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingTop: insets.top + HEADER_SPACE + (wide ? 36 : 16), alignItems: 'center', gap: 20 }, textFx]}>
        <Txt f="heavy" size={h1} color={c.trang} center accessibilityRole="header" style={[{ lineHeight: wide ? 100 : 54, letterSpacing: wide ? -3.6 : -1.8 }, shade]}>
          Hào Khí{' '}
          <Txt f="serifItalic" size={accent} color={c.sonSang} style={[{ lineHeight: wide ? 108 : 58, letterSpacing: wide ? -2 : -1 }, shade]}>
            Đông A
          </Txt>
        </Txt>
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
/** Màn rộng: dải tự chạy (dừng khi rê chuột). Màn hẹp (điện thoại, không có chuột để dừng): dải vuốt ngang bằng tay */
const PhaseTrack: React.FC<{ auto: boolean; children: React.ReactNode }> = ({ auto, children }) =>
  auto ? (
    <Marquee speed={40}>{children}</Marquee>
  ) : (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 16 }} accessibilityLabel="Chín màn chiến dịch, vuốt ngang để xem">
      {children}
    </ScrollView>
  );

/** Dải thẻ nghiêng chạy ngang: chín màn chiến dịch, mỗi thẻ là một trận đánh thật với ngày tháng và diễn biến theo Wikipedia (xem PHASE_REAL) */
const PhaseMarquee: React.FC<{ wide: boolean; onSection: (id: string, y: number) => void }> = ({ wide, onSection }) => {
  const { c } = useTheme();
  const colors = [c.son, c.vang, c.thuy];
  return (
    <View id="chin-man" onLayout={(e) => onSection('chin-man', e.nativeEvent.layout.y)} style={{ width: '100%', backgroundColor: c.xam, paddingVertical: wide ? 80 : 48, gap: 20 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <Head title="Chín màn chiến dịch" text="Mỗi màn là một trận đánh có thật, từ Bình Lệ Nguyên đến Bạch Đằng." wide={wide} />
      </View>
      <PhaseTrack auto={wide}>
        {PHASES.map((p, i) => {
          const r = PHASE_REAL[p.id];
          const fg = p.campaign === 2 ? c.dem : c.trang;
          return (
            <View
              key={p.id}
              accessible
              accessibilityLabel={`Màn ${i + 1}, lần ${p.campaign}, ${r.date}. ${r.title}. ${r.text}`}
              style={[{ width: wide ? 320 : 290, marginRight: 22, marginVertical: 22, borderRadius: 28, overflow: 'hidden', backgroundColor: c.the, transform: [{ rotate: i % 2 ? '1.6deg' : '-1.6deg' }] }, shadow(c, 'sm')]}
            >
              <View style={{ backgroundColor: colors[p.campaign - 1], paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14, gap: 3 }}>
                <Txt f="bold" size={12} color={fg} upper>
                  {`Màn ${i + 1} · Lần ${p.campaign}`}
                </Txt>
                <Txt f="heavy" size={15} color={fg}>
                  {r.date}
                </Txt>
                <Txt f="heavy" size={wide ? 23 : 21} color={fg} style={{ lineHeight: wide ? 28 : 26 }}>
                  {r.title}
                </Txt>
              </View>
              <View style={{ padding: 18, flex: 1 }}>
                <Txt size={14} color={c.xanhMuc2} style={{ lineHeight: 22 }}>
                  {r.text}
                </Txt>
              </View>
            </View>
          );
        })}
      </PhaseTrack>
    </View>
  );
};

// ---------------------------------------------------------------------- khối xanh: khám phá mọi lúc, mọi nơi
type ShowId = 'choi' | 'kham-pha' | 'hoi-dap' | 'on-tap';

const SHOWCASE: Array<{ id: ShowId; label: string; icon: IconType; color: 'son' | 'vang' | 'moc' | 'trang'; text: string }> = [
  { id: 'choi', label: 'Chơi', icon: Joystick, color: 'son', text: 'Thu lương thảo ở Điền Trang, chiêu mộ danh tướng rồi bày trận đánh các màn chiến dịch – mỗi sức mạnh đều đến từ một câu trả lời đúng.' },
  { id: 'kham-pha', label: 'Khám phá', icon: Compass, color: 'vang', text: 'Đi khắp làng pixel của Hành Trình Đông A, trò chuyện với dân làng, thu cuộn sử và lần theo lược đồ Đại Việt thời Trần.' },
  { id: 'hoi-dap', label: 'Hỏi đáp', icon: MessageSquareText, color: 'moc', text: 'Hỏi Quân Sư AI bất cứ điều gì về ba lần kháng chiến; câu trả lời dựa trên kho kiến thức sử liệu của đề tài.' },
  { id: 'on-tap', label: 'Ôn tập', icon: School, color: 'trang', text: 'Tháp Khảo Thí 10 tầng và thẻ Sử Ký giúp ôn từ nhận biết đến vận dụng; hệ thống ghi nhận mức nắm vững để gợi ý câu hỏi tiếp theo.' },
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

/** Lược đồ Đại Việt và ba địa danh của lần kháng chiến thứ nhất */
const MockExplore: React.FC<{ wide: boolean }> = ({ wide }) => {
  const { c, dark } = useTheme();
  const places = [
    { id: 'binh_le_nguyen', date: '17/1/1258' },
    { id: 'dong_bo_dau', date: 'Đêm 28/1/1258' },
    { id: 'thang_long', date: 'Kinh đô Đại Việt' },
  ] as const;
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: c.the }}>
      <View style={{ flex: wide ? 0.9 : 1, justifyContent: 'center' }}>
        <SchematicMap dark={dark} pins={['binh_le_nguyen', 'dong_bo_dau', 'thang_long']} routes={CAMPAIGN_ROUTES[1]} title="Lược đồ Đại Việt thời Trần" />
      </View>
      {wide && (
        <View style={{ flex: 1.1, padding: 24, gap: 14, justifyContent: 'center' }}>
          <Txt f="heavy" size={22} color={c.xanhMuc} style={{ lineHeight: 28 }}>
            Lược đồ Đại Việt thời Trần
          </Txt>
          {places.map((p) => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconTile icon={MapPin} text={15} size={40} />
              <View style={{ flex: 1 }}>
                <Txt f="bold" size={16} color={c.xanhMuc} style={{ lineHeight: 21 }}>
                  {MAP_PLACES[p.id].name}
                </Txt>
                <Txt size={13} color={c.xanhMuc2}>
                  {p.date}
                </Txt>
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
            Quân Trần cắm cọc nhọn ngầm dưới sông Bạch Đằng rồi nhử thuyền giặc vào. Thuyền Nguyên va phải cọc ngầm, bị chặn lại và bị tiêu diệt.
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

/** Khối xanh "nơi học sinh khám phá lịch sử mọi lúc, mọi nơi": bốn vòng tròn màu chọn tính năng, máy tính bảng minh họa và mô tả */
const ShowcaseSection: React.FC<{ wide: boolean; onSection: (id: string, y: number) => void }> = ({ wide, onSection }) => {
  const { c } = useTheme();
  const [tab, setTab] = useState<ShowId>('choi');
  const cur = SHOWCASE.find((s) => s.id === tab) ?? SHOWCASE[0];
  const color = c[cur.color];
  const pop = usePopIn(tab);
  return (
    <Band id="kham-pha" bg={c.bau} cloudTop={c.xam} cloudBottom={c.the} wide={wide} onSection={onSection}>
      <Head light title="Nơi học sinh khám phá lịch sử mọi lúc, mọi nơi!" wide={wide} />
      <Reveal>
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
              style={{ alignItems: 'center', gap: 8, minWidth: 64, opacity: on ? 1 : 0.78 }}
            >
              <View style={[{ transform: [{ scale: on ? 1.12 : 1 }] }]}>
                <Badge icon={s.icon} color={c[s.color]} size={wide ? 84 : 62} fg={s.color === 'vang' || s.color === 'trang' ? c.dem : undefined} />
              </View>
              <Txt f="heavy" size={wide ? 17 : 14} color={c.trang} center>
                {s.label}
              </Txt>
            </Pressable>
          );
        })}
      </View>
      </Reveal>
      <Reveal from="scale">
      <View style={{ alignItems: 'center' }}>
        <Tablet wide={wide}>
          <Animated.View style={[{ flex: 1 }, pop]}>
            {tab === 'choi' && <MockPlay />}
            {tab === 'kham-pha' && <MockExplore wide={wide} />}
            {tab === 'hoi-dap' && <MockAsk />}
            {tab === 'on-tap' && <MockReview />}
          </Animated.View>
        </Tablet>
      </View>
      </Reveal>
      <Reveal>
      <Animated.View style={[{ alignItems: 'center', gap: 12 }, pop]}>
        <Tag center text={cur.label} bg={color} fg={cur.color === 'vang' || cur.color === 'trang' ? c.dem : c.trang} size={wide ? 26 : 20} />
        <Txt f="medium" size={wide ? 20 : 17} color={c.trang} center style={{ maxWidth: 640, lineHeight: wide ? 29 : 25 }}>
          {cur.text}
        </Txt>
      </Animated.View>
      </Reveal>
    </Band>
  );
};

// ---------------------------------------------------------------------- ba lần kháng chiến (đối chiếu Wikipedia)
const FactRow: React.FC<{ icon: IconType; label: string; text: string; color: string }> = ({ icon, label, text, color }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Ico icon={icon} text={15} color={color} />
      <Txt size={15} color={c.xanhMuc2} style={{ flex: 1 }}>
        <Txt f="bold" size={15} color={c.xanhMuc}>
          {label}:{' '}
        </Txt>
        {text}
      </Txt>
    </View>
  );
};

const CampaignExplorer: React.FC<{ wide: boolean }> = ({ wide }) => {
  const { c, dark } = useTheme();
  const router = useRouter();
  const [sel, setSel] = useState<1 | 2 | 3>(1);
  const camp = CAMPAIGNS[sel - 1];
  const facts = CAMPAIGN_FACTS[sel];
  const look = { accent: c.sonChu, soft: c.sonNhat };
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
                  borderColor: on ? look.accent : c.bienXanh, backgroundColor: on ? look.soft : c.the, opacity: pressed ? 0.9 : 1,
                })}
              >
                {wide && (
                  <Txt f="heavy" size={22} color={on ? look.accent : c.xanhMuc} style={{ minWidth: 104, letterSpacing: -0.4 }}>
                    {k.years.replace(' – ', '–')}
                  </Txt>
                )}
                <View style={{ flex: 1 }}>
                  {!wide && (
                    <Txt f="heavy" size={18} color={on ? look.accent : c.xanhMuc} style={{ letterSpacing: -0.3 }}>
                      {k.years.replace(' – ', '–')}
                    </Txt>
                  )}
                  <Txt f="bold" size={16} color={c.xanhMuc}>
                    {k.name}
                  </Txt>
                  <Txt size={14} color={c.xanhMuc2}>
                    {CAMPAIGN_BLURB[k.id]}
                  </Txt>
                </View>
                <Ico icon={ArrowRight} text={15} color={on ? look.accent : c.xanhMuc2} />
              </Pressable>
            );
          })}
        </View>
        <Panel pad={24} style={{ gap: 14 }}>
          <Txt f="heavy" size={22} color={c.xanhMuc} accessibilityRole="header" style={{ lineHeight: 28, letterSpacing: -0.3 }}>
            {camp.name} · {camp.years}
          </Txt>
          <FactRow icon={Sword} label="Đối phương" text={facts.enemy} color={look.accent} />
          <FactRow icon={Landmark} label="Lãnh đạo" text={facts.lead} color={look.accent} />
          <FactRow icon={Milestone} label="Diễn biến chính" text={facts.key} color={look.accent} />
          <View style={{ gap: 10, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.bienXanh }}>
            <Txt f="bold" size={13} color={c.xanhMuc2} upper>
              {phases.length} màn chơi
            </Txt>
            {phases.map((p) => (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ height: lineH(15), justifyContent: 'center' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: look.accent }} />
                </View>
                <Txt size={15} color={c.xanhMuc} style={{ flex: 1 }}>
                  <Txt f="bold" size={15} color={look.accent}>
                    {PHASE_REAL[p.id].date}
                  </Txt>
                  {'  '}
                  {PHASE_REAL[p.id].title}
                </Txt>
              </View>
            ))}
          </View>
          <Cta title="Chơi chiến dịch này" tone="den" arrow onPress={() => router.push('/portal')} />
        </Panel>
      </View>
      <Panel pad={0} style={{ width: wide ? 400 : '100%', overflow: 'hidden' }}>
        <SchematicMap dark={dark} pins={[...new Set(phases.map((p) => p.place))]} routes={CAMPAIGN_ROUTES[sel]} title={`Lược đồ ${camp.name}`} />
        <Txt size={12} color={c.xanhMuc2} style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
          Mũi tên đỏ: hướng tiến quân của giặc.
        </Txt>
      </Panel>
    </View>
  );
};

const ExplorerSection: React.FC<{ wide: boolean; onSection: (id: string, y: number) => void }> = ({ wide, onSection }) => {
  const { c } = useTheme();
  return (
    <Band id="khang-chien" bg={c.the} wide={wide} onSection={onSection}>
      <Head title={`Ba lần kháng chiến chống Nguyên\u00A0–\u2060\u00A0Mông`} text="Chọn một cuộc kháng chiến để xem lược đồ, diễn biến chính và các màn chơi." wide={wide} />
      <Reveal>
        <CampaignExplorer wide={wide} />
      </Reveal>
      <Reveal>
        <Txt size={13} color={c.xanhMuc2} center style={{ maxWidth: 760, alignSelf: 'center' }}>
          Đối chiếu theo Wikipedia tiếng Việt: “Chiến tranh Nguyên Mông – Đại Việt” và ba bài chi tiết từng lần. Sau ba lần thất bại, nhà Nguyên không còn đưa quân sang; Đại Việt giữ vững độc lập, trên danh nghĩa chịu làm nước chư hầu triều cống.
        </Txt>
      </Reveal>
    </Band>
  );
};

// ---------------------------------------------------------------------- danh tướng và lời ông cha
const CAST: Array<{ accessory: MascotAccessory; mood: 'happy' | 'excited' | 'love' | 'thinking' }> = [
  { accessory: 'helmet', mood: 'excited' },
  { accessory: 'conical', mood: 'happy' },
  { accessory: 'crown', mood: 'love' },
  { accessory: 'scholar', mood: 'thinking' },
];

/** Thẻ màu của từng danh tướng theo hệ (màu nền lấy từ hệ Thủy/Mộc/Thổ/Hỏa/Thống soái của game) */
const CastSection: React.FC<{ wide: boolean; onSection: (id: string, y: number) => void }> = ({ wide, onSection }) => {
  const { c } = useTheme();
  return (
    <Band id="danh-tuong" bg={c.xam} wide={wide} onSection={onSection}>
      <Reveal from="scale">
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: wide ? 12 : 4 }} pointerEvents="none">
          {CAST.map((m, i) => (
            <Mascot key={m.accessory} size={wide ? 112 : 70} accessory={m.accessory} mood={m.mood} bob={i % 2 === 0} title={`Rồng Con ${m.accessory}`} />
          ))}
        </View>
      </Reveal>
      <Head title="Gặp gỡ danh tướng nhà Trần" text="Mỗi nhân vật gắn nhãn nguồn gốc để học sinh phân biệt chính sử với giai thoại và phần sáng tạo của game." wide={wide} />
      <Reveal>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {Object.keys(LORE_LABEL).map((k) => (
            <LoreChip key={k} lore={k} />
          ))}
        </View>
      </Reveal>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
        {HEROES.map((h, i) => {
          const el = ELEMENTS[h.element];
          return (
            <Reveal key={h.id} delay={(i % 4) * 70} style={{ width: wide ? 262 : '100%' }}>
            <Lift style={{ width: '100%' }}>
            <View style={[{ width: '100%', borderRadius: 28, backgroundColor: c[el.fill], padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }, shadow(c, 'sm')]}>
              <HeroMedallion hero={h} size={72} />
              <View style={{ flex: 1, gap: 4, alignItems: 'flex-start' }}>
                <Txt f="heavy" size={18} color={c.trang} style={{ lineHeight: 22 }}>
                  {h.name}
                </Txt>
                <Txt size={13} color={c.trang} style={{ lineHeight: 18 }}>
                  {h.title}
                </Txt>
                <LoreChip lore={h.lore} />
              </View>
            </View>
            </Lift>
            </Reveal>
          );
        })}
      </View>
    </Band>
  );
};

/** Bốn thẻ lời ông cha nhiều màu (thay cho thẻ nhận xét của Papumba; chỉ dùng lời có trong dữ liệu game và sử liệu) */
const QuotesSection: React.FC<{ wide: boolean; onSection: (id: string, y: number) => void }> = ({ wide, onSection }) => {
  const { c } = useTheme();
  return (
    <Band id="loi-ong-cha" bg={c.the} wide={wide} onSection={onSection}>
      <Head title="Lời ông cha còn vang mãi" text="Những câu nói làm nên hào khí Đông A, có trong từng màn chơi của game." wide={wide} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18, justifyContent: 'center' }}>
        {QUOTES.map((q, i) => (
          <Reveal key={q.who} delay={i * 80} style={{ width: wide ? 258 : '100%' }}>
          <Lift tilt={wide ? (i % 2 ? 1.5 : -1.5) : 0} style={{ width: '100%' }}>
          <View
            accessible
            accessibilityLabel={`${q.text} – ${q.who}, ${q.note}`}
            style={[{ width: '100%', minHeight: wide ? 270 : undefined, borderRadius: 28, backgroundColor: q.bg, padding: 22, gap: 12 }, shadow(c, 'sm')]}
          >
            <Quote size={34} color="#16253f" strokeWidth={2.2} />
            <Txt f="heavy" size={q.text.length < 12 ? 44 : 21} color="#16253f" style={{ lineHeight: q.text.length < 12 ? 50 : 28, flex: 1 }}>
              {q.text}
            </Txt>
            <View>
              <Txt f="heavy" size={16} color="#16253f">
                {q.who}
              </Txt>
              <Txt size={13} color="#16253f" style={{ lineHeight: 18 }}>
                {q.note}
              </Txt>
            </View>
          </View>
          </Lift>
          </Reveal>
        ))}
      </View>
      <Reveal style={{ maxWidth: 860, width: '100%', alignSelf: 'center' }}>
      <Panel pad={24} style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'center', gap: 20, width: '100%' }}>
        <Seal text={'ĐÔNG\nA'} size={wide ? 96 : 72} />
        <View style={{ flex: wide ? 1 : undefined, gap: 6 }}>
          <Txt f="heavy" size={22} color={c.xanhMuc} center={!wide} style={{ lineHeight: 28 }}>
            Hào khí Đông A là gì?
          </Txt>
          <Txt size={15} color={c.xanhMuc2} center={!wide} style={{ lineHeight: 23 }}>
            Là khí phách hào hùng, lòng tự hào dân tộc và sự đồng lòng từ vua đến dân của thời Trần. Tên gọi còn được giải thích bằng cách chiết tự chữ “Trần” thành “Đông” và “A”.
          </Txt>
        </View>
      </Panel>
      </Reveal>
    </Band>
  );
};

// ---------------------------------------------------------------------- dành cho ai, đề tài, nhà trường
const AUDIENCE_CARDS: Array<{ id: AudienceId; title: string; tag: string; color: 'son' | 'thuy' | 'moc'; cta: string }> = [
  { id: 'hoc_sinh', title: 'Dành cho học sinh', tag: 'Học sinh', color: 'son', cta: 'Vào học ngay' },
  { id: 'giao_vien', title: 'Dành cho giáo viên', tag: 'Giáo viên', color: 'thuy', cta: 'Đăng nhập giáo viên' },
  { id: 'nha_truong', title: 'Dành cho nhà trường', tag: 'Nhà trường', color: 'moc', cta: 'Tải file Excel mẫu' },
];

/** Ba thẻ lớn trên nền đồi cỏ (kiểu "Resources for Parents/Teachers" của Papumba) */
const AudienceSection: React.FC<{ wide: boolean; onSection: (id: string, y: number) => void }> = ({ wide, onSection }) => {
  const { c } = useTheme();
  const router = useRouter();
  return (
    <Band id="vi-sao" bg={c.son} cloudTop={c.the} wide={wide} onSection={onSection}>
      <View style={{ position: 'absolute', right: wide ? '8%' : 8, top: wide ? 20 : 4 }} pointerEvents="none">
        <Mascot size={wide ? 120 : 76} accessory="none" mood="happy" bob title="Rồng Con" />
      </View>
      <Head light title="Một nền tảng cho cả lớp học" text="Mỗi đối tượng đều có công cụ riêng, nhưng cùng chung một kho kiến thức lịch sử." wide={wide} />
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 18, alignItems: 'stretch' }}>
        {AUDIENCE_CARDS.map((a, i) => (
          <Reveal key={a.id} delay={i * 90} style={{ flex: wide ? 1 : undefined }}>
          <Lift fill={wide} style={{ flex: wide ? 1 : undefined }}>
          <View style={[{ flex: wide ? 1 : undefined, backgroundColor: c.the, borderRadius: 32, padding: 24, gap: 16 }, shadow(c, 'lg')]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Tag text={a.tag} bg={c[a.color]} size={18} rotate={-2} />
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.den, alignItems: 'center', justifyContent: 'center' }}>
                <ArrowUpRight size={iconPx(15)} color={c.trang} strokeWidth={2} />
              </View>
            </View>
            <Txt f="heavy" size={26} color={c.xanhMuc} style={{ lineHeight: 31, letterSpacing: -0.5 }}>
              {a.title}
            </Txt>
            <View style={{ gap: 10, flex: 1 }}>
              {AUDIENCE[a.id].map((b) => (
                <View key={b.title} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  <Ico icon={Check} text={15} color={c.ngocChu} />
                  <Txt f="medium" size={15} color={c.xanhMuc2} style={{ flex: 1 }}>
                    {b.title}
                  </Txt>
                </View>
              ))}
            </View>
            <Cta title={a.cta} tone="den" arrow onPress={a.id === 'nha_truong' ? downloadTemplate : () => router.push('/portal')} />
          </View>
          </Lift>
          </Reveal>
        ))}
      </View>
    </Band>
  );
};

const ThesisSection: React.FC<{ wide: boolean; onSection: (id: string, y: number) => void }> = ({ wide, onSection }) => {
  const { c } = useTheme();
  const tones = [c.son, c.thuy, c.moc, c.hoa, c.son, c.thuy];
  return (
    <Band id="de-tai" bg={c.xam} wide={wide} onSection={onSection}>
      <Head title="Về đề tài nghiên cứu" wide={wide} />
      <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'stretch', gap: 18 }}>
        <Reveal from="left" style={{ flex: wide ? 1 : undefined }}>
        <Panel pad={28} style={{ flex: wide ? 1 : undefined, gap: 16 }}>
          <Tag text="Tên đề tài" bg={c.son} size={16} rotate={-2} />
          <Txt f="serifBold" size={22} color={c.xanhMuc} style={{ lineHeight: 32 }}>
            Nghiên cứu và phát triển nền tảng học tập game hóa hỗ trợ khám phá lịch sử ba lần kháng chiến chống Nguyên – Mông thời Trần
          </Txt>
          <Txt f="bold" size={13} color={c.xanhMuc2} upper>
            Mục tiêu
          </Txt>
          <View style={{ gap: 12 }}>
            {GOALS.map((g) => (
              <View key={g} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <Ico icon={Check} text={15} color={c.ngocChu} />
                <Txt size={15} color={c.xanhMuc2} style={{ flex: 1 }}>
                  {g}
                </Txt>
              </View>
            ))}
          </View>
        </Panel>
        </Reveal>
        <View style={{ flex: wide ? 1 : undefined, gap: 16 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {TECH.map((t, i) => (
              <Reveal key={t.title} from="right" delay={(i % 2) * 60 + Math.floor(i / 2) * 40} style={{ flexGrow: 1, flexBasis: 200 }}>
              <Panel pad={16} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: tones[i], alignItems: 'center', justifyContent: 'center' }}>
                  <t.icon size={iconPx(16)} color={c.trang} strokeWidth={1.75} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt f="heavy" size={16} color={c.xanhMuc} style={{ lineHeight: 21 }}>
                    {t.title}
                  </Txt>
                  <Txt size={13} color={c.xanhMuc2} style={{ lineHeight: 18 }}>
                    {t.text}
                  </Txt>
                </View>
              </Panel>
              </Reveal>
            ))}
          </View>
          <Reveal>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Txt f="semibold" size={14} color={c.xanhMuc2}>
              Học trên mọi thiết bị:
            </Txt>
            <Chip text="Trình duyệt web" icon={Compass} bg={c.the} fg={c.nhan} />
            <Chip text="Android" icon={Smartphone} bg={c.the} fg={c.nhan} />
            <Chip text="iPhone, iPad" icon={Smartphone} bg={c.the} fg={c.nhan} />
          </View>
          </Reveal>
        </View>
      </View>
    </Band>
  );
};

const SchoolSection: React.FC<{ wide: boolean; onSection: (id: string, y: number) => void }> = ({ wide, onSection }) => {
  const { c } = useTheme();
  return (
    <Band id="nha-truong" bg={c.the} wide={wide} onSection={onSection}>
      <Head title="Cấp tài khoản hàng loạt bằng Excel" text="Dành cho nhà trường: điền một file mẫu, quản trị trường nhập là có tài khoản cho cả khối." wide={wide} />
      <Reveal>
      <Panel pad={28} style={{ gap: 18 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
          <IconTile icon={FileSpreadsheet} text={18} size={52} />
          <View style={{ flex: 1, minWidth: 220 }}>
            <Txt f="heavy" size={19} color={c.xanhMuc} accessibilityRole="header" style={{ lineHeight: 25 }}>
              File Excel mẫu cấp tài khoản
            </Txt>
            <Txt size={14} color={c.xanhMuc2}>
              Nhà trường tải về (không cần đăng nhập), điền danh sách giáo viên, học sinh rồi gửi cho quản trị trường để cấp tài khoản hàng loạt.
            </Txt>
          </View>
          <Cta title="Tải file mẫu (.xlsx)" tone="den" icon={Download} onPress={downloadTemplate} testID="home-template" />
        </View>
        <TemplateGuide />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          {([6, 7, 8, 9] as const).map((g) => (
            <GradeBadge key={g} grade={g} size={28} showName />
          ))}
        </View>
      </Panel>
      </Reveal>
    </Band>
  );
};

// ---------------------------------------------------------------------- kêu gọi cuối trang và chân trang
/** Khối tối cuối trang: cảnh bình minh Bạch Đằng, mây trắng nối từ khối trên (kiểu khối ảnh tối + mây của Papumba) */
const ClosingSection: React.FC<{ wide: boolean }> = ({ wide }) => {
  const { c } = useTheme();
  const router = useRouter();
  return (
    <View style={{ width: '100%', backgroundColor: c.dem, overflow: 'hidden' }}>
      <FilmBackdrop wide={wide} only={[7]} dim={0.12} scrim />
      <CloudBank color={c.the} flip height={90} />
      <View style={{ width: '100%', maxWidth: 860, alignSelf: 'center', paddingHorizontal: 16, paddingTop: wide ? 190 : 150, paddingBottom: wide ? 130 : 90 }}>
      <Reveal from="scale">
      <View style={{ alignItems: 'center', gap: 22 }}>
        <Txt f="heavy" size={wide ? 64 : 36} color={c.trang} center accessibilityRole="header" style={{ lineHeight: wide ? 70 : 42, letterSpacing: wide ? -2 : -1 }}>
          Cùng cả lớp ra trận{'\n'}với <Txt f="heavy" size={wide ? 64 : 36} color={c.vang} style={{ lineHeight: wide ? 70 : 42, letterSpacing: wide ? -2 : -1 }}>Đông A</Txt>!
        </Txt>
        <Txt f="medium" size={wide ? 20 : 17} color={c.troi4} center style={{ maxWidth: 560, lineHeight: wide ? 29 : 25 }}>
          Đăng nhập bằng tài khoản nhà trường cấp và bắt đầu từ Điền Trang của em.
        </Txt>
        <View style={{ alignSelf: 'center' }}>
          <Cta title="Vào học ngay" tone="trang" arrow lg onPress={() => router.push('/portal')} testID="home-portal-bottom" />
        </View>
      </View>
      </Reveal>
      </View>
    </View>
  );
};

const FootLink: React.FC<{ label: string; onPress: () => void }> = ({ label, onPress }) => {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      <Txt f="bold" size={16} color={c.trang}>
        {label}
      </Txt>
    </Pressable>
  );
};

/** Chân trang: dải sóng nước đỏ vàng, ấn đỏ "Đông A", nhãn vàng "Đến giờ học Sử rồi!", các cột liên kết, bốn Rồng Con, dải trắng với logo */
const FooterSection: React.FC<{ wide: boolean; go: (id: string) => void }> = ({ wide, go }) => {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ width: '100%', backgroundColor: c.dem }}>
      <WaveBand bg={c.son} line={c.vang} />
      <View style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingTop: wide ? 64 : 44, paddingBottom: wide ? 36 : 24, gap: 28 }}>
        <Reveal from="scale">
          <View style={{ alignItems: 'center', gap: 16 }}>
            <Seal text={'ĐÔNG\nA'} size={wide ? 84 : 64} />
            <Tag center text="Đến giờ học Sử rồi!" bg={c.vang} fg={c.dem} size={wide ? 44 : 28} rotate={-2} />
          </View>
        </Reveal>
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 48 : 12, justifyContent: 'center', alignItems: wide ? 'flex-start' : 'center' }}>
          {WEB && (
            <View style={{ alignItems: wide ? 'flex-start' : 'center' }}>
              {NAV.map((n) => (
                <FootLink key={n.id} label={n.label} onPress={() => go(n.id)} />
              ))}
            </View>
          )}
          <View style={{ alignItems: wide ? 'flex-start' : 'center' }}>
            <FootLink label="Đăng nhập học tập" onPress={() => router.push('/portal')} />
            <FootLink label="Tải file Excel mẫu" onPress={downloadTemplate} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: wide ? 24 : 6 }} pointerEvents="none">
          {CAST.map((m, i) => (
            <Reveal key={m.accessory} delay={i * 80}>
              <Mascot size={wide ? 140 : 76} accessory={m.accessory} mood={m.mood} bob={i % 2 === 1} title={`Rồng Con ${m.accessory}`} />
            </Reveal>
          ))}
        </View>
      </View>
      <WaveBand bg={c.son} line={c.vang} height={24} />
      <View style={{ backgroundColor: c.the, paddingBottom: insets.bottom }}>
        <View style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 18, flexDirection: wide ? 'row' : 'column', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <BrandLogo />
          <Txt f="medium" size={13} color={c.xanhMuc2} center={!wide} style={{ flexShrink: 1, maxWidth: 640 }}>
            Đề tài khóa luận tốt nghiệp: nghiên cứu và phát triển nền tảng học tập game hóa hỗ trợ khám phá lịch sử ba lần kháng chiến chống Nguyên – Mông thời Trần.
          </Txt>
        </View>
      </View>
    </View>
  );
};

/** Toàn bộ nội dung trang chủ, theo thứ tự từ trên xuống (onSection báo vị trí các phần có neo cho thanh điều hướng) */
export const HomeSections: React.FC<{ wide: boolean; go: (id: string) => void; onSection: (id: string, y: number) => void; onVideoImmersiveChange: (on: boolean) => void }> = ({ wide, go, onSection, onVideoImmersiveChange }) => (
  <>
    <HeroSection wide={wide} go={go} />
    <PhaseMarquee wide={wide} onSection={onSection} />
    <HomeVideo wide={wide} onImmersiveChange={onVideoImmersiveChange} />
    <ShowcaseSection wide={wide} onSection={onSection} />
    <ExplorerSection wide={wide} onSection={onSection} />
    <CastSection wide={wide} onSection={onSection} />
    <QuotesSection wide={wide} onSection={onSection} />
    <AudienceSection wide={wide} onSection={onSection} />
    <ThesisSection wide={wide} onSection={onSection} />
    <SchoolSection wide={wide} onSection={onSection} />
    <ClosingSection wide={wide} />
    <FooterSection wide={wide} go={go} />
  </>
);
