/**
 * Trang chủ công khai theo bố cục VioEdu nhưng giao diện hiện đại: nền bầu trời dựng lại bằng SVG, nút phẳng dạng viên thuốc, thẻ viền mảnh bóng nhẹ,
 * chữ Be Vietnam Pro, biểu tượng cùng nét mảnh và cỡ tính theo cỡ chữ đi kèm (xem iconPx).
 * Thanh điều hướng nổi hình viên thuốc co hẹp khi cuộn, có nút đổi sáng/tối (chỉ áp dụng cho trang chủ, nhớ lại ở lần sau) và cuộn mượt khi lăn chuột.
 * Dải luôn tối (hero, kêu gọi, chân trang) dùng màu cố định `trang`/`dem`; thẻ và chữ dùng màu đổi theo chế độ.
 * Số liệu lấy thẳng từ dữ liệu game nên không lệch. Không có liên kết tới hai cổng quản trị. expo-router bắt buộc tên index cho đường dẫn "/".
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated, Platform, Pressable, ScrollView, StyleSheet, View, useColorScheme, useWindowDimensions,
  type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance, type StyleProp, type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Activity, ArrowRight, Check, ChevronUp, Compass, Database, Download, FileSpreadsheet, GraduationCap, Joystick, Landmark, LayoutDashboard, Layers, LibraryBig, Lock, LogIn,
  Map as MapIcon, MapPinned, Medal, MessageSquareText, Milestone, Monitor, Moon, Puzzle, RadioTower, School, Send, ShieldCheck, ShieldHalf, Smartphone,
  Sun, Sword, Swords, Table2, Tablet, Target, TrendingUp, Trophy, Undo2, Users, WandSparkles, Zap,
} from 'lucide-react-native';
import { BrandLogo, CloudBank, EpicBackdrop, GradeBadge, SchematicMap, SkyBackdrop, VietnamFlag } from '@/components/art';
import { useDocumentTitle } from '@/components/auth';
import { LoreChip } from '@/components/game/quiz';
import { TemplateGuide, downloadTemplate } from '@/components/provisioning';
import { Chip, PaperBg, Txt } from '@/components/ui';
import { CAMPAIGNS, CAMPAIGN_ROUTES, PHASES } from '@/constants/campaigns';
import { ELEMENTS, GAME_TABS, LORE_LABEL, MAP_PLACES } from '@/constants/game';
import { HEROES } from '@/constants/heroes';
import { PALETTES, type Palette } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-motion';
import { useSmoothScroll } from '@/hooks/use-smooth-scroll';
import { ThemeContext, useTheme } from '@/hooks/use-theme';
import { readHomeTheme, saveHomeTheme, type HomeTheme } from '@/lib/storage';
import type { IconType } from '@/types/game';

const MAX_W = 1120;
const WEB = Platform.OS === 'web';
/** Chiều cao thanh điều hướng nổi (64) cộng khoảng cách trên (16); hero chừa chỗ này ở đầu */
const HEADER_SPACE = 80;

/** Đích cuộn của liên kết neo chừa chỗ cho đầu trang dính */
const ANCHOR = (WEB ? { scrollMarginTop: 88 } : null) as unknown as ViewStyle;

/** Các phần có neo: label dùng ở chân trang, short là nhãn ngắn trên thanh điều hướng */
const NAV = [
  { id: 'ba-lan-khang-chien', label: 'Ba lần kháng chiến', short: 'Kháng chiến' },
  { id: 'lo-trinh', label: 'Lộ trình', short: 'Lộ trình' },
  { id: 'danh-tuong', label: 'Danh tướng', short: 'Danh tướng' },
  { id: 'vi-sao', label: 'Dành cho ai', short: 'Dành cho ai' },
  { id: 'de-tai', label: 'Về đề tài', short: 'Về đề tài' },
] as const;

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

/** Ô biểu tượng nền nhạt; cỡ biểu tượng theo cỡ chữ tiêu đề đi kèm */
const IconTile: React.FC<{ icon: IconType; text?: number; size?: number; bg?: string; fg?: string }> = ({ icon: Icon, text = 18, size = 44, bg, fg }) => {
  const { c } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), backgroundColor: bg ?? c.troi5, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon size={iconPx(text)} color={fg ?? c.nhan} strokeWidth={1.75} />
    </View>
  );
};

/** Thẻ trắng viền mảnh, bóng nhẹ */
const Panel: React.FC<{ children: React.ReactNode; pad?: number; style?: StyleProp<ViewStyle> }> = ({ children, pad = 24, style }) => {
  const { c } = useTheme();
  return <View style={[{ backgroundColor: c.the, borderRadius: 20, borderWidth: 1, borderColor: c.bienXanh, padding: pad }, shadow(c, 'sm'), style]}>{children}</View>;
};

/** son/xanh/trang/vien dùng trên nền sáng; vang/sang dùng trên nền tối của hero */
type CtaTone = 'son' | 'xanh' | 'trang' | 'vien' | 'vang' | 'sang';

/** Nút phẳng dạng viên thuốc, cao tối thiểu 44 */
const Cta: React.FC<{ title: string; onPress: () => void; tone?: CtaTone; icon?: IconType; arrow?: boolean; lg?: boolean; label?: string; testID?: string }> = ({
  title, onPress, tone = 'son', icon, arrow = false, lg = false, label, testID,
}) => {
  const { c } = useTheme();
  const t = { son: { bg: c.son, fg: c.trang, bd: c.son }, xanh: { bg: c.xanhMuc, fg: c.the, bd: c.xanhMuc }, trang: { bg: c.trang, fg: c.dem, bd: c.trang }, vien: { bg: 'transparent', fg: c.xanhMuc, bd: c.xanhMuc2 },
    vang: { bg: c.vang, fg: c.dem, bd: c.vang }, sang: { bg: c.kinh, fg: c.trang, bd: c.troi3 } }[tone];
  const text = lg ? 16 : 15;
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
            alignSelf: 'flex-start', minHeight: lg ? 52 : 44, paddingHorizontal: lg ? 26 : 20, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            backgroundColor: t.bg, borderWidth: 1.5, borderColor: t.bd, opacity: pressed ? 0.9 : 1, transform: [{ translateY: pressed ? 1 : hovered ? -1 : 0 }],
          },
          tone === 'vien' || tone === 'sang' ? null : shadow(c, 'sm'),
          tone === 'sang' ? GLASS : null,
        ];
      }}
    >
      {icon && <Ico icon={icon} text={text} color={t.fg} />}
      <Txt f="bold" size={text} color={t.fg}>
        {title}
      </Txt>
      {arrow && <Ico icon={ArrowRight} text={text} color={t.fg} />}
    </Pressable>
  );
};

/** Dải toàn chiều rộng; nội dung bên trong giới hạn bề ngang và căn giữa. sky = nền bầu trời, cloudTop/cloudBottom = màu vùng liền kề để vẽ mây chuyển */
const Band: React.FC<{
  id?: string; bg?: string; sky?: 'blue' | 'night'; cloudTop?: string; cloudBottom?: string; wide: boolean; gap?: number; onSection?: (id: string, y: number) => void; children: React.ReactNode;
}> = ({ id, bg, sky, cloudTop, cloudBottom, wide, gap = 32, onSection, children }) => (
  <View id={id} onLayout={id && onSection ? (e) => onSection(id, e.nativeEvent.layout.y) : undefined} style={[{ width: '100%', backgroundColor: bg }, id ? ANCHOR : null]}>
    {sky && <SkyBackdrop variant={sky} />}
    {cloudTop && <CloudBank color={cloudTop} flip />}
    <View
      style={{
        width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, gap,
        paddingTop: (wide ? 80 : 52) + (cloudTop ? 24 : 0), paddingBottom: (wide ? 80 : 52) + (cloudBottom ? 40 : 0),
      }}
    >
      {children}
    </View>
    {cloudBottom && <CloudBank color={cloudBottom} />}
  </View>
);

const Head: React.FC<{ eyebrow: string; title: string; text?: string; wide: boolean; light?: boolean }> = ({ eyebrow, title, text, wide, light = false }) => {
  const { c } = useTheme();
  return (
    <View style={{ gap: 10, alignItems: 'center' }}>
      <Txt f="bold" size={13} color={light ? c.troi4 : c.sonChu} upper center>
        {eyebrow}
      </Txt>
      <Txt f="heavy" size={wide ? 40 : 26} color={light ? c.trang : c.xanhMuc} center accessibilityRole="header" style={{ lineHeight: wide ? 48 : 33, letterSpacing: -0.6 }}>
        {title}
      </Txt>
      {text && (
        <Txt size={17} color={light ? c.trang : c.xanhMuc2} center style={{ maxWidth: 720 }}>
          {text}
        </Txt>
      )}
    </View>
  );
};

/** Nhóm nút chọn dạng viên thuốc trong khung trắng */
function Tabs<T extends string>({ options, value, onChange, label }: { options: Array<{ value: T; label: string }>; value: T; onChange: (v: T) => void; label: string }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={[{ alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4, padding: 4, borderRadius: 999, backgroundColor: c.the, borderWidth: 1, borderColor: c.bienXanh }, shadow(c, 'sm')]}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{ minHeight: 44, paddingHorizontal: width >= 760 ? 22 : 14, borderRadius: 999, justifyContent: 'center', backgroundColor: on ? c.xanhMuc : 'transparent' }}
          >
            <Txt f="bold" size={15} color={on ? c.the : c.xanhMuc2}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const FootLink: React.FC<{ label: string; onPress: () => void }> = ({ label, onPress }) => {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      <Txt f="medium" size={15} color={c.troi4}>
        {label}
      </Txt>
    </Pressable>
  );
};

// ---------------------------------------------------------------------- đầu trang và hero
/** Các mục trên thanh điều hướng: "Trang chủ" cuộn về đầu trang, còn lại cuộn tới phần có id tương ứng */
const NAV_ITEMS = [{ id: 'home', short: 'Trang chủ' }, ...NAV.map((n) => ({ id: n.id, short: n.short }))];

/** Nút tròn viền mảnh chứa một biểu tượng (cỡ biểu tượng theo chữ 15; vùng chạm 46 kể cả hitSlop) */
const RoundBtn: React.FC<{ icon: IconType; label: string; onPress: () => void; color: string; border: string; testID?: string }> = ({ icon: Icon, label, onPress, color, border, testID }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    testID={testID}
    hitSlop={2}
    style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: border, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
  >
    <Icon size={iconPx(15)} color={color} strokeWidth={1.75} />
  </Pressable>
);

/**
 * Thanh điều hướng nổi hình viên thuốc, cố định phía trên cùng. Khi cuộn nó co hẹp lại, thấp xuống một chút và đổi từ kính mờ trên nền hero tối
 * sang kính sáng/tối theo chế độ; mục đang xem có chấm tròn đánh dấu. Có nút đổi sáng/tối, cờ Tiếng Việt và nút đăng nhập.
 */
const Header: React.FC<{ width: number; scrollY: Animated.Value; stuck: boolean; active: string; go: (id: string) => void; onToggleTheme: () => void }> = ({
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
  const bg = scrollY.interpolate({ inputRange: [0, 60], outputRange: [c.kinh, c.kinhDac], ...clamp });
  const border = scrollY.interpolate({ inputRange: [0, 60], outputRange: [c.kinhVien, c.bienXanh], ...clamp });
  const fg = stuck ? c.xanhMuc : c.trang;
  const muted = stuck ? c.xanhMuc2 : c.troi4;
  const accent = stuck ? c.sonChu : c.vang;
  const ring = stuck ? c.bienXanh : c.kinhVien;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40, alignItems: 'center', paddingHorizontal: 12, paddingTop: insets.top }}>
      <Animated.View
        style={[
          { width: '100%', maxWidth, height, marginTop, borderRadius: 999, borderWidth: 1, borderColor: border, backgroundColor: bg, paddingLeft: 10, paddingRight: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
          GLASS,
        ]}
      >
        <Pressable onPress={() => go('home')} accessibilityRole="link" accessibilityLabel="Về đầu trang" hitSlop={4} style={{ minHeight: 44, justifyContent: 'center' }}>
          <BrandLogo light={!stuck} compact={width < 380} />
        </Pressable>
        {WEB && wide && (
          <View accessibilityRole="menu" style={{ flexDirection: 'row', alignItems: 'center' }}>
            {NAV_ITEMS.map((n) => {
              const on = n.id === active;
              return (
                <Pressable
                  key={n.id}
                  accessibilityRole="link"
                  accessibilityLabel={n.short}
                  accessibilityState={{ selected: on }}
                  onPress={() => go(n.id)}
                  style={{ minHeight: 44, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent, opacity: on ? 1 : 0 }} />
                  <Txt f={on ? 'bold' : 'semibold'} size={14} color={on ? accent : muted}>
                    {n.short}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <RoundBtn
            icon={dark ? Moon : Sun}
            label={dark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
            onPress={onToggleTheme}
            color={fg}
            border={ring}
            testID="home-theme"
          />
          {width >= 340 && (
            <View style={{ borderRadius: 5, borderWidth: 1, borderColor: ring, padding: 1 }}>
              <VietnamFlag width={34} />
            </View>
          )}
          <Cta title={width >= 560 ? 'Đăng nhập' : ''} label="Đăng nhập học tập" icon={width >= 560 ? undefined : LogIn} onPress={() => router.push('/portal')} testID="home-login" />
        </View>
      </Animated.View>
    </View>
  );
};

/** Nút lên đầu trang ở góc phải dưới, hiện dần khi đã cuộn xuống */
const BackToTop: React.FC<{ scrollY: Animated.Value; visible: boolean; onPress: () => void }> = ({ scrollY, visible, onPress }) => {
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
          { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: c.bienXanh, backgroundColor: c.kinhDac, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 },
          shadow(c, 'sm'),
          GLASS,
        ]}
      >
        <ChevronUp size={iconPx(15)} color={c.xanhMuc} strokeWidth={1.75} />
      </Pressable>
    </Animated.View>
  );
};

/** Ba trận đại thắng của nhà Trần, hiện trong hero dưới dạng thẻ kính mờ */
const VICTORIES = [
  { war: 'Lần 1 · quân Mông Cổ', year: '1258', place: 'Đông Bộ Đầu', result: 'Quân Mông Cổ bỏ Thăng Long, rút về nước' },
  { war: 'Lần 2 · quân Nguyên', year: '1285', place: 'Hàm Tử – Chương Dương', result: 'Giải phóng Thăng Long, diệt quân Toa Đô ở Tây Kết' },
  { war: 'Lần 3 · quân Nguyên', year: '1288', place: 'Bạch Đằng', result: 'Thủy quân Nguyên bị tiêu diệt, sáng 9/4/1288' },
] as const;

/** Làm mờ phía sau thẻ kính (chỉ web) */
const GLASS = (WEB ? { backdropFilter: 'blur(10px)' } : null) as unknown as ViewStyle;

/** Lời nói bất hủ của Trần Bình Trọng (1285), nguyên văn như trong dữ liệu chiến dịch của game */
const Epigraph: React.FC<{ wide: boolean }> = ({ wide }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 16, maxWidth: 460 }}>
      <View style={{ width: 3, borderRadius: 2, backgroundColor: c.vang }} />
      <View style={{ flex: 1, gap: 10 }}>
        <Txt f="serifBold" size={wide ? 28 : 20} color={c.trang} style={{ lineHeight: wide ? 40 : 30 }}>
          “Ta thà làm quỷ nước Nam, chứ không thèm làm vương đất Bắc!”
        </Txt>
        <Txt f="bold" size={13} color={c.vang} upper>
          Trần Bình Trọng · 1285
        </Txt>
      </View>
    </View>
  );
};

/** Hero: cảnh bình minh Bạch Đằng, tiêu đề "Sống lại hào khí Đông A", ba trận đại thắng. Màn rộng: cảnh là nền; màn hẹp: chữ ở trên, cảnh ở dưới */
const Hero: React.FC<{ wide: boolean; go: (id: string) => void }> = ({ wide, go }) => {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ width: '100%', backgroundColor: c.dem, overflow: 'hidden' }}>
      {wide && <EpicBackdrop shade />}
      <View style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingTop: insets.top + HEADER_SPACE + (wide ? 72 : 40), paddingBottom: wide ? 176 : 32 }}>
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 48 }}>
          <View style={{ flex: wide ? 1.12 : undefined, width: wide ? undefined : '100%', gap: 22, alignItems: 'flex-start' }}>
            <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: c.kinh, borderWidth: 1, borderColor: c.kinhVien }, GLASS]}>
              <Ico icon={GraduationCap} text={13} color={c.vang} />
              <Txt f="semibold" size={13} color={c.trang}>
                Lịch sử và Địa lí THCS · Khối 6 – 9
              </Txt>
            </View>
            <Txt f="heavy" size={wide ? 62 : 40} color={c.trang} accessibilityRole="header" style={{ lineHeight: wide ? 68 : 46, letterSpacing: -1.2 }}>
              Sống lại{'\n'}
              <Txt f="heavy" size={wide ? 62 : 40} color={c.vang} style={{ lineHeight: wide ? 68 : 46, letterSpacing: -1.2 }}>
                hào khí Đông A
              </Txt>
            </Txt>
            <Txt size={18} color={c.troi4} style={{ maxWidth: 540, lineHeight: 28 }}>
              Nền tảng học tập game hóa về ba lần kháng chiến chống Nguyên – Mông thời Trần. Chiêu mộ danh tướng, bày trận Bạch Đằng – mỗi chiến thắng đều đến từ một câu trả lời đúng, có Quân Sư AI đồng hành.
            </Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <Cta title="Vào học ngay" tone="vang" arrow lg onPress={() => router.push('/portal')} testID="home-portal" />
              {WEB && <Cta title="Khám phá nội dung" tone="sang" icon={Compass} lg onPress={() => go('ba-lan-khang-chien')} />}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <Ico icon={ShieldCheck} text={13} color={c.troi3} />
              <Txt f="medium" size={13} color={c.troi4} style={{ flex: 1 }}>
                Tài khoản do nhà trường cấp · Học trên web, Android và iOS
              </Txt>
            </View>
            {!wide && <Epigraph wide={false} />}
            <View style={{ gap: 10 }}>
              <Txt f="bold" size={13} color={c.vang} upper>
                Ba lần đại thắng
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {VICTORIES.map((v) => (
                  <View
                    key={v.year}
                    accessible
                    accessibilityLabel={`${v.war}, năm ${v.year}: thắng ở ${v.place}. ${v.result}`}
                    style={[
                      { flexGrow: 1, flexBasis: 160, maxWidth: wide ? 190 : undefined, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: c.kinh, borderWidth: 1, borderColor: c.kinhVien, gap: 2 },
                      GLASS,
                    ]}
                  >
                    <Txt f="bold" size={11} color={c.troi3} upper>
                      {v.war}
                    </Txt>
                    <Txt f="heavy" size={26} color={c.vang} style={{ lineHeight: 32 }}>
                      {v.year}
                    </Txt>
                    <Txt f="bold" size={14} color={c.trang} style={{ lineHeight: 19 }}>
                      {v.place}
                    </Txt>
                    <Txt size={12} color={c.troi4} style={{ lineHeight: 17 }}>
                      {v.result}
                    </Txt>
                  </View>
                ))}
              </View>
            </View>
          </View>
          {wide && (
            <View style={{ flex: 0.88, alignItems: 'flex-end', paddingTop: 8 }}>
              <Epigraph wide />
            </View>
          )}
        </View>
      </View>
      {!wide && (
        <View style={{ width: '100%', aspectRatio: 1.1 }}>
          <EpicBackdrop fade />
        </View>
      )}
      <CloudBank color={c.the} height={72} />
    </View>
  );
};

/** Biểu tượng số liệu: ô bo tròn nền chuyển sắc xanh trời, biểu tượng trắng nét mảnh (cỡ theo chữ tiêu đề đi kèm) và bóng xanh nhẹ */
const StatIcon: React.FC<{ icon: IconType }> = ({ icon: Icon }) => {
  const { c } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: 52, height: 52, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, shadow(c, 'sm')]}
    >
      <LinearGradient colors={[c.troi2, c.troi]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {/* Bọc trong View: trên web, lớp nền đặt tuyệt đối sẽ che SVG nếu SVG không nằm trong phần tử có vị trí */}
      <View>
        <Icon size={iconPx(18)} color={c.trang} strokeWidth={1.75} />
      </View>
    </View>
  );
};

/**
 * Khung số liệu trắng nằm đè lên đáy hero. Mọi số lấy từ dữ liệu game; "đội quân" trong 14 là binh đoàn (Quân Thánh Dực, Quân Sát Thát),
 * "địa danh" là các điểm trên lược đồ Đại Việt thời Trần (có cả Chăm-pa ở phía nam).
 */
const Stats: React.FC<{ wide: boolean }> = ({ wide }) => {
  const { c } = useTheme();
  const items: Array<{ icon: IconType; value: number; title: string; text: string }> = [
    { icon: Swords, value: CAMPAIGNS.length, title: 'cuộc kháng chiến', text: '1258 · 1285 · 1287 – 1288' },
    { icon: Target, value: PHASES.length, title: 'màn chiến dịch', text: 'Từ Bình Lệ đến Bạch Đằng' },
    { icon: ShieldHalf, value: HEROES.length, title: 'tướng và binh đoàn', text: 'Chiêu mộ và tiến hóa' },
    { icon: MapPinned, value: Object.keys(MAP_PLACES).length, title: 'địa danh lịch sử', text: 'Lược đồ thời Trần' },
  ];
  return (
    <View style={{ width: '100%', marginTop: wide ? -84 : -72, zIndex: 5, paddingHorizontal: 16 }}>
      <Panel pad={0} style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', borderRadius: 24, flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden' }}>
        {items.map((s, i) => (
          <View
            key={s.title}
            accessible
            accessibilityLabel={`${s.value} ${s.title}. ${s.text}`}
            style={{
              flexGrow: 1, flexBasis: wide ? 240 : 280, padding: wide ? 20 : 24, flexDirection: 'row', alignItems: 'center', gap: 14,
              borderLeftWidth: wide && i > 0 ? 1 : 0, borderTopWidth: !wide && i > 0 ? 1 : 0, borderColor: c.bienXanh,
            }}
          >
            <StatIcon icon={s.icon} />
            <View style={{ flex: 1, gap: 1 }}>
              <Txt f="heavy" size={36} color={c.xanhMuc} style={{ lineHeight: 42, letterSpacing: -0.8 }}>
                {s.value}
              </Txt>
              <Txt f="bold" size={15} color={c.xanhMuc} style={{ lineHeight: 20 }}>
                {s.title}
              </Txt>
              <Txt size={13} color={c.xanhMuc2} style={{ lineHeight: 18 }}>
                {s.text}
              </Txt>
            </View>
          </View>
        ))}
      </Panel>
    </View>
  );
};

// ---------------------------------------------------------------------- ba lần kháng chiến
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
  const look = { accent: c.nhan, soft: c.troi5 };
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
                  minHeight: 72, padding: 16, borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 16,
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
                    {p.date}
                  </Txt>
                  {'  '}
                  {p.name}
                </Txt>
              </View>
            ))}
          </View>
          <Cta title="Chơi chiến dịch này" arrow onPress={() => router.push('/portal')} />
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

// ---------------------------------------------------------------------- lộ trình
const Roadmap: React.FC<{ wide: boolean }> = ({ wide }) => {
  const { c } = useTheme();
  const steps: Array<{ icon: IconType; title: string; text: string; extra?: React.ReactNode }> = [
    {
      icon: School, title: 'Vào lớp',
      text: 'Nhà trường cấp tài khoản, thầy cô phát mã lớp. Em đăng nhập là vào ngay Điền Trang của riêng mình.',
    },
    {
      icon: Puzzle, title: 'Chơi để học',
      text: 'Mỗi câu trả lời đúng mở thêm lương thảo, quân và sức mạnh cho danh tướng nhà Trần.',
      extra: (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {GAME_TABS.map((t) => (
            <Chip key={t.id} text={t.label} icon={t.Icon} bg={c.troi5} fg={c.nhan} />
          ))}
          <Chip text="Hành Trình Đông A" icon={Compass} bg={c.troi5} fg={c.nhan} />
        </View>
      ),
    },
    {
      icon: Medal, title: 'Thử thách và đồng hành',
      text: 'Thi đấu trực tiếp cùng cả lớp, hỏi Quân Sư AI khi chưa hiểu, và nhận gợi ý ôn đúng phần kiến thức còn yếu.',
    },
  ];
  return (
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16, alignItems: 'stretch' }}>
      {steps.map((s, i) => (
        <Panel key={s.title} pad={24} style={{ flex: wide ? 1 : undefined, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <IconTile icon={s.icon} text={18} size={48} />
            <Txt f="heavy" size={40} color={c.bienXanh} accessibilityElementsHidden importantForAccessibility="no" style={{ lineHeight: 46 }}>
              {`0${i + 1}`}
            </Txt>
          </View>
          <Txt f="heavy" size={21} color={c.xanhMuc} accessibilityRole="header" style={{ lineHeight: 27, letterSpacing: -0.3 }}>
            {`Bước ${i + 1}. ${s.title}`}
          </Txt>
          <Txt size={15} color={c.xanhMuc2}>
            {s.text}
          </Txt>
          {s.extra}
        </Panel>
      ))}
    </View>
  );
};

// ---------------------------------------------------------------------- danh tướng
const HeroRoster: React.FC<{ wide: boolean }> = ({ wide }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
      {HEROES.map((h) => {
        const el = ELEMENTS[h.element];
        return (
          <Panel key={h.id} pad={16} style={{ width: wide ? 262 : '100%', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c[el.soft], alignItems: 'center', justifyContent: 'center' }}
            >
              <h.symbol size={iconPx(16)} color={c[el.text]} strokeWidth={1.75} />
            </View>
            <View style={{ flex: 1, gap: 4, alignItems: 'flex-start' }}>
              <Txt f="bold" size={16} color={c.xanhMuc} style={{ lineHeight: 21 }}>
                {h.name}
              </Txt>
              <Txt size={13} color={c.xanhMuc2} style={{ lineHeight: 18 }}>
                {h.title}
              </Txt>
              <LoreChip lore={h.lore} />
            </View>
          </Panel>
        );
      })}
    </View>
  );
};

// ---------------------------------------------------------------------- trang chủ
/** Trang chủ tự quản lý chế độ sáng/tối rồi bọc nội dung trong ThemeContext riêng, nên các màn khác của app không bị ảnh hưởng */
export default function Home() {
  const system = useColorScheme();
  const [mode, setMode] = useState<HomeTheme>(() => readHomeTheme() ?? (system === 'dark' ? 'dark' : 'light'));
  const theme = useMemo(() => ({ c: PALETTES[mode], dark: mode === 'dark' }), [mode]);
  const toggleTheme = useCallback(() => {
    const next: HomeTheme = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    saveHomeTheme(next);
  }, [mode]);
  return (
    <ThemeContext.Provider value={theme}>
      <HomePage onToggleTheme={toggleTheme} />
    </ThemeContext.Provider>
  );
}

function HomePage({ onToggleTheme }: { onToggleTheme: () => void }) {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const [who, setWho] = useState<AudienceId>('hoc_sinh');
  useDocumentTitle('Đông A – Nền tảng học Sử game hóa');

  const scrollRef = useRef<ScrollViewInstance>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const sections = useRef<Record<string, number>>({});
  const [active, setActive] = useState('home');
  const [stuck, setStuck] = useState(false);
  const [showTop, setShowTop] = useState(false);

  const onSection = useCallback((id: string, y: number) => {
    sections.current[id] = y;
  }, []);

  /** Theo dõi vị trí cuộn: điều khiển thanh điều hướng (co hẹp, mục đang xem) và nút lên đầu trang */
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: false,
        listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const y = e.nativeEvent.contentOffset.y;
          setStuck(y > 40);
          setShowTop(y > 560);
          let current = 'home';
          for (const n of NAV) {
            const top = sections.current[n.id];
            if (top !== undefined && top - 180 <= y) current = n.id;
          }
          setActive(current);
        },
      }),
    [scrollY],
  );

  const getScrollNode = useCallback(() => (scrollRef.current as unknown as { getScrollableNode?: () => HTMLElement | null } | null)?.getScrollableNode?.() ?? null, []);
  useSmoothScroll(getScrollNode, WEB && !reduce);

  const go = (id: string) => {
    if (id === 'home') {
      scrollRef.current?.scrollTo({ y: 0, animated: !reduce });
      return;
    }
    if (WEB && typeof document !== 'undefined') document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <View style={{ flex: 1 }}>
      <PaperBg />
      <ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ flexGrow: 1 }}>
      <Hero wide={wide} go={go} />
      <Stats wide={wide} />

      <Band id="ba-lan-khang-chien" onSection={onSection} bg={c.the} wide={wide}>
        <Head eyebrow="Chương trình học" title="Ba lần kháng chiến chống Nguyên – Mông" text="Chọn một cuộc kháng chiến để xem lược đồ, diễn biến chính và các màn chơi." wide={wide} />
        <CampaignExplorer wide={wide} />
        <Txt size={13} color={c.xanhMuc2} center style={{ maxWidth: 760, alignSelf: 'center' }}>
          Đối chiếu theo Wikipedia tiếng Việt: “Chiến tranh Nguyên Mông – Đại Việt” và ba bài chi tiết từng lần. Sau ba lần thất bại, nhà Nguyên không còn đưa quân sang; Đại Việt giữ vững độc lập, trên danh nghĩa chịu làm nước chư hầu triều cống.
        </Txt>
      </Band>

      <Band id="lo-trinh" onSection={onSection} sky="blue" cloudTop={c.the} cloudBottom={c.the} wide={wide}>
        <Head light eyebrow="Lộ trình học tập" title="Học qua ba bước, vui như chơi" text="Từ ngày đầu vào lớp đến lúc cùng cả lớp thi đấu, mọi hoạt động đều gắn với kiến thức lịch sử." wide={wide} />
        <Roadmap wide={wide} />
      </Band>

      <Band id="danh-tuong" onSection={onSection} bg={c.the} wide={wide}>
        <Head eyebrow="Đội hình nhà Trần" title="Chiêu mộ danh tướng nhà Trần" text="Mỗi nhân vật gắn nhãn nguồn gốc để học sinh phân biệt chính sử với giai thoại và phần sáng tạo của game." wide={wide} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {Object.keys(LORE_LABEL).map((k) => (
            <LoreChip key={k} lore={k} />
          ))}
        </View>
        <HeroRoster wide={wide} />
      </Band>

      <Band id="vi-sao" onSection={onSection} bg={c.troi5} wide={wide}>
        <Head eyebrow="Vì sao chọn Đông A" title="Một nền tảng cho cả lớp học" text="Mỗi đối tượng đều có công cụ riêng, nhưng cùng chung một kho kiến thức lịch sử." wide={wide} />
        <Tabs
          label="Chọn đối tượng"
          value={who}
          onChange={setWho}
          options={[{ value: 'hoc_sinh', label: 'Học sinh' }, { value: 'giao_vien', label: 'Giáo viên' }, { value: 'nha_truong', label: 'Nhà trường' }]}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          {AUDIENCE[who].map((b) => (
            <Panel key={`${who}-${b.title}`} pad={24} style={{ flexGrow: 1, flexBasis: 240, gap: 14 }}>
              <IconTile icon={b.icon} text={18} />
              <Txt f="bold" size={19} color={c.xanhMuc} style={{ lineHeight: 25 }}>
                {b.title}
              </Txt>
              <Txt size={15} color={c.xanhMuc2}>
                {b.text}
              </Txt>
            </Panel>
          ))}
        </View>
      </Band>

      <Band id="de-tai" onSection={onSection} bg={c.the} wide={wide}>
        <Head eyebrow="Về đề tài" title="Nghiên cứu và phát triển" wide={wide} />
        <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'stretch', gap: 16 }}>
          <Panel pad={28} style={{ flex: wide ? 1 : undefined, gap: 16 }}>
            <Txt f="bold" size={13} color={c.sonChu} upper>
              Tên đề tài
            </Txt>
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <View style={{ width: 4, borderRadius: 2, backgroundColor: c.son }} />
              <Txt f="serifBold" size={21} color={c.xanhMuc} style={{ flex: 1, lineHeight: 31 }}>
                Nghiên cứu và phát triển nền tảng học tập game hóa hỗ trợ khám phá lịch sử ba lần kháng chiến chống Nguyên – Mông thời Trần
              </Txt>
            </View>
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
          <View style={{ flex: wide ? 1 : undefined, gap: 16 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {TECH.map((t) => (
                <Panel key={t.title} pad={16} style={{ flexGrow: 1, flexBasis: 200, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                  <IconTile icon={t.icon} text={16} size={44} />
                  <View style={{ flex: 1 }}>
                    <Txt f="bold" size={16} color={c.xanhMuc} style={{ lineHeight: 21 }}>
                      {t.title}
                    </Txt>
                    <Txt size={13} color={c.xanhMuc2} style={{ lineHeight: 18 }}>
                      {t.text}
                    </Txt>
                  </View>
                </Panel>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <Txt f="semibold" size={14} color={c.xanhMuc2}>
                Học trên mọi thiết bị:
              </Txt>
              <Chip text="Trình duyệt web" icon={Monitor} bg={c.troi5} fg={c.nhan} />
              <Chip text="Android" icon={Smartphone} bg={c.troi5} fg={c.nhan} />
              <Chip text="iPhone, iPad" icon={Tablet} bg={c.troi5} fg={c.nhan} />
            </View>
          </View>
        </View>
      </Band>

      <Band id="nha-truong" onSection={onSection} bg={c.troi5} wide={wide}>
        <Head eyebrow="Dành cho nhà trường" title="Cấp tài khoản hàng loạt bằng Excel" wide={wide} />
        <Panel pad={28} style={{ gap: 18 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
            <IconTile icon={FileSpreadsheet} text={18} size={52} />
            <View style={{ flex: 1, minWidth: 220 }}>
              <Txt f="bold" size={19} color={c.xanhMuc} accessibilityRole="header" style={{ lineHeight: 25 }}>
                File Excel mẫu cấp tài khoản
              </Txt>
              <Txt size={14} color={c.xanhMuc2}>
                Nhà trường tải về (không cần đăng nhập), điền danh sách giáo viên, học sinh rồi gửi cho quản trị trường để cấp tài khoản hàng loạt.
              </Txt>
            </View>
            <Cta title="Tải file mẫu (.xlsx)" tone="xanh" icon={Download} onPress={downloadTemplate} testID="home-template" />
          </View>
          <TemplateGuide />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            {([6, 7, 8, 9] as const).map((g) => (
              <GradeBadge key={g} grade={g} size={28} showName />
            ))}
          </View>
        </Panel>
      </Band>

      <Band sky="night" cloudTop={c.troi5} wide={wide} gap={16}>
        <View style={{ alignItems: 'center', gap: 16 }}>
          <Txt f="heavy" size={wide ? 40 : 28} color={c.trang} center accessibilityRole="header" style={{ lineHeight: wide ? 48 : 35, letterSpacing: -0.6 }}>
            Sẵn sàng ra trận cùng quân dân nhà Trần?
          </Txt>
          <Txt size={17} color={c.troi4} center style={{ maxWidth: 520 }}>
            Đăng nhập bằng tài khoản nhà trường cấp và bắt đầu từ Điền Trang của em.
          </Txt>
          <View style={{ alignSelf: 'center' }}>
            <Cta title="Vào học ngay" tone="trang" arrow lg onPress={() => router.push('/portal')} testID="home-portal-bottom" />
          </View>
        </View>
      </Band>

      <View style={{ backgroundColor: c.dem, paddingBottom: insets.bottom }}>
        <View style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingTop: wide ? 24 : 8, paddingBottom: 20, gap: 24 }}>
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 40 : 24 }}>
            <View style={{ flex: wide ? 1.6 : undefined, gap: 12 }}>
              <BrandLogo subtitle="Học Sử qua game" light />
              <Txt size={14} color={c.troi4} style={{ maxWidth: 440 }}>
                Đề tài khóa luận tốt nghiệp: nghiên cứu và phát triển nền tảng học tập game hóa hỗ trợ khám phá lịch sử ba lần kháng chiến chống Nguyên – Mông thời Trần.
              </Txt>
            </View>
            {WEB && (
              <View style={{ flex: wide ? 1 : undefined }}>
                <Txt f="bold" size={16} color={c.trang} accessibilityRole="header">
                  Khám phá
                </Txt>
                {NAV.map((n) => (
                  <FootLink key={n.id} label={n.label} onPress={() => go(n.id)} />
                ))}
              </View>
            )}
            <View style={{ flex: wide ? 1 : undefined }}>
              <Txt f="bold" size={16} color={c.trang} accessibilityRole="header">
                Truy cập
              </Txt>
              <FootLink label="Đăng nhập học tập" onPress={() => router.push('/portal')} />
              <FootLink label="Tải file Excel mẫu" onPress={downloadTemplate} />
            </View>
          </View>
          <Txt f="medium" size={12} color={c.troi3} center style={{ borderTopWidth: 1, borderTopColor: c.kinhVien, paddingTop: 16 }}>
            © Đông A EDU · Lịch sử và Địa lí – Ba lần kháng chiến chống quân xâm lược Mông – Nguyên
          </Txt>
        </View>
      </View>
      </ScrollView>
      <Header width={width} scrollY={scrollY} stuck={stuck} active={active} go={go} onToggleTheme={onToggleTheme} />
      <BackToTop scrollY={scrollY} visible={showTop} onPress={() => go('home')} />
    </View>
  );
}
