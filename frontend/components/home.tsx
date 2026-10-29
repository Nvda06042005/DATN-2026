/**
 * Các khối của trang chủ công khai: bố cục kiểu Papumba (chữ trắng khổng lồ ở giữa, nav viên thuốc trắng, khối màu bão hòa xen kẽ, khung máy tính bảng,
 * dải thẻ nghiêng chạy ngang, thẻ lời ông cha nhiều màu) nhưng hình ảnh và màu sắc lấy từ cuộc kháng chiến chống quân Nguyên – Mông thời Trần:
 * cảnh thành Thăng Long – thuyền chiến – bãi cọc Bạch Đằng, đỏ son, vàng, lam sông, giấy dó, họa tiết sóng nước và ấn đỏ.
 * Nội dung lịch sử đối chiếu Wikipedia tiếng Việt "Chiến tranh Nguyên Mông – Đại Việt" và ba bài chi tiết từng lần; số liệu lấy thẳng từ dữ liệu game.
 * Khối luôn tối/sáng cố định dùng màu `trang`/`dem`; thẻ và chữ dùng màu đổi theo chế độ sáng/tối. Không có liên kết tới hai cổng quản trị.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowDown, ArrowRight, CalendarDays, Check, Compass, Joystick, Landmark, LogIn, MapPin, MessageSquareText, Milestone, Moon, Quote, School, Sun, Sword, Swords,
  Trophy, Users, Volume2, VolumeX, X, ZoomIn,
} from 'lucide-react-native';
import {
  BattleBackdrop, BrandLogo, CloudBank, EnemyBadge, FilmBackdrop, HeroMedallion, KahootShape, Mascot, PatternOverlay, SchematicMap, Seal, VietnamFlag, WaveBand,
  type MascotAccessory,
} from '@/components/art';
import { LoreChip } from '@/components/game/quiz';
import { Chip, Txt } from '@/components/ui';
import { HomeVideo } from '@/components/home-video';
import { HeroGallery } from '@/components/hero-gallery';
import { HistoryShowcase } from '@/components/history-showcase';
import { CloudPair, SectionCloud } from '@/components/section-cloud';
import { CAMPAIGNS, CAMPAIGN_ROUTES, PHASES, PHASE_REAL } from '@/constants/campaigns';
import { ENEMIES, LORE_LABEL, MAP_PLACES } from '@/constants/game';
import { HERO_BY_ID } from '@/constants/heroes';
import { ANSWER_STYLES, type Palette } from '@/constants/theme';
import { Lift, Reveal, useScrollY } from '@/components/motion';
import { usePopIn, useReduceMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import { useSound } from '@/lib/sfx';
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
const INK_SOFT = 'rgba(35, 56, 47, 0.78)';
const INK_LINE = 'rgba(35, 56, 47, 0.16)';
const PAPER_CARD = { backgroundColor: 'rgba(255, 255, 255, 0.74)', borderColor: INK_LINE, boxShadow: '0 10px 30px rgba(35, 56, 47, 0.10)' } as unknown as ViewStyle;

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
type CtaTone = 'den' | 'trang' | 'son' | 'xanh' | 'muc';

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
    muc: { bg: c.logoInk, fg: c.logoPaper, bd: c.logoInk },
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
  id?: string; bg?: string; cloudTop?: string; cloudBottom?: string; wide: boolean; gap?: number; onSection?: (id: string, y: number) => void; decor?: React.ReactNode; children: React.ReactNode;
}> = ({ id, bg, cloudTop, cloudBottom, wide, gap = 32, onSection, decor, children }) => {
  const { c } = useTheme();
  return (
    <View id={id} onLayout={id && onSection ? (e) => onSection(id, e.nativeEvent.layout.y) : undefined} style={[{ width: '100%', backgroundColor: bg, overflow: 'hidden' }, id ? ANCHOR : null]}>
      <PatternOverlay opacity={bg === c.logoInk ? 0.065 : bg === c.logoPaper ? 0.075 : undefined} />
      {decor}
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
};

const Head: React.FC<{ title: string; text?: string; wide: boolean; light?: boolean; logo?: boolean }> = ({ title, text, wide, light = false, logo = false }) => {
  const { c } = useTheme();
  return (
    <Reveal>
      <View style={{ gap: 12, alignItems: 'center' }}>
        <Txt f="heavy" size={wide ? 52 : 32} color={logo ? c.logoInk : light ? c.trang : c.xanhMuc} center accessibilityRole="header" style={{ lineHeight: wide ? 58 : 38, letterSpacing: wide ? -1.6 : -0.8, maxWidth: 860 }}>
          {title}
        </Txt>
        {text && (
          <Txt f="medium" size={wide ? 20 : 17} color={logo ? INK_SOFT : light ? c.trang : c.xanhMuc2} center style={{ maxWidth: 720, lineHeight: wide ? 29 : 25 }}>
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

// ---------------------------------------------------------------------- thanh điều hướng
/** Các mục trên thanh điều hướng: "Trang chủ" cuộn về đầu trang, còn lại cuộn tới phần có id tương ứng */
const NAV_ITEMS = [{ id: 'home', short: 'Trang chủ' }, ...NAV.map((n) => ({ id: n.id, short: n.short }))];

/** Nút tròn chứa một biểu tượng (cỡ biểu tượng theo chữ 15; vùng chạm 46 kể cả hitSlop) */
const RoundBtn: React.FC<{ icon: IconType; label: string; onPress: () => void; color: string; bg: string; border: string; testID?: string; size?: number }> = ({
  icon: Icon, label, onPress, color, bg, border, testID, size = 42,
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    testID={testID}
    hitSlop={2}
    style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: border, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
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
  const [soundOn, toggleSound] = useSound();
  const wide = width >= 1100;
  /** Điện thoại hẹp: nút tròn nhỏ hơn và khoảng cách sít lại để đủ chỗ cho cả nút âm thanh */
  const small = width < 430;
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: small ? 6 : 8 }}>
          <RoundBtn
            size={small ? 38 : 42}
            icon={dark ? Moon : Sun}
            label={dark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
            onPress={onToggleTheme}
            color={fg}
            bg={roundBg}
            border={ring}
            testID="home-theme"
          />
          {WEB && (
            <RoundBtn
              size={small ? 38 : 42}
              icon={soundOn ? Volume2 : VolumeX}
              label={soundOn ? 'Tắt âm thanh hiệu ứng' : 'Bật âm thanh hiệu ứng'}
              onPress={toggleSound}
              color={fg}
              bg={roundBg}
              border={ring}
              testID="home-sound"
            />
          )}
          {width >= 340 && (
            <View style={{ borderRadius: 6, borderWidth: 1, borderColor: ring, padding: 1, backgroundColor: roundBg }}>
              <VietnamFlag width={small ? 30 : 34} />
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
  /** Đỏ son, vàng và xanh mực của logo (lần 3 dùng xanh lá đậm `logoInk`, không phải xanh dương) */
  const colors = [c.son, c.vang, c.logoInk];
  return (
    <View id="chin-man" onLayout={(e) => onSection('chin-man', e.nativeEvent.layout.y)} style={{ width: '100%', backgroundColor: c.xam, paddingVertical: wide ? 80 : 48, gap: 20, overflow: 'hidden' }}>
      <PatternOverlay />
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

// ---------------------------------------------------------------------- khám phá lịch sử theo màu logo
type ShowId = 'choi' | 'kham-pha' | 'hoi-dap' | 'on-tap';

const SHOWCASE: Array<{ id: ShowId; label: string; icon: IconType; color: 'logoRed' | 'logoGold' | 'logoInk' | 'logoPaper'; text: string }> = [
  { id: 'choi', label: 'Chơi', icon: Joystick, color: 'logoRed', text: 'Thu lương thảo ở Điền Trang, chiêu mộ danh tướng rồi bày trận đánh các màn chiến dịch – mỗi sức mạnh đều đến từ một câu trả lời đúng.' },
  { id: 'kham-pha', label: 'Khám phá', icon: Compass, color: 'logoGold', text: 'Đi khắp làng pixel của Hành Trình Đông A, trò chuyện với dân làng, thu cuộn sử và lần theo lược đồ Đại Việt thời Trần.' },
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

/** Bản đồ ba cuộc kháng chiến lấy từ Wikipedia tiếng Việt (Wikimedia Commons, phạm vi công cộng, tác giả Lưu Ly); ratio = rộng / cao của tệp */
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
          Mũi tên đỏ là quân Đại Việt, mũi tên đen là quân Mông Nguyên (tiến quân, rút chạy); chú thích đầy đủ nằm trong bản đồ. Nguồn: Wikipedia tiếng Việt, tác giả Lưu Ly (Wikimedia Commons, phạm vi công cộng).
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
const GoldRings: React.FC = () => {
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
      <Head logo title={`Ba lần kháng chiến chống Nguyên\u00A0–\u2060\u00A0Mông`} text="Chọn một cuộc kháng chiến để xem bản đồ, diễn biến chính và các màn chơi." wide={wide} />
      <Reveal>
        <CampaignExplorer wide={wide} />
      </Reveal>
      <Reveal>
        <Txt size={13} color={INK_SOFT} center style={{ maxWidth: 760, alignSelf: 'center' }}>
          Nội dung và bản đồ theo Wikipedia tiếng Việt: “Chiến tranh Nguyên Mông – Đại Việt” và ba bài chi tiết lần 1, 2, 3; số quân là ước tính, các nguồn chép khác nhau. Sau ba lần xâm lược thất bại, nhà Nguyên có kế hoạch đánh lần thứ tư nhưng không thực hiện được; Đại Việt giữ vững độc lập, trên danh nghĩa vẫn là nước chư hầu.
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

/** Danh tướng nhà Trần: cùng bảng màu logo với các khối phía trên (giấy kem, mực xanh, đỏ cờ), lưới tranh minh họa và khung sơ yếu lý lịch (xem components/hero-gallery.tsx) */
const CastSection: React.FC<{ wide: boolean; onSection: (id: string, y: number) => void }> = ({ wide, onSection }) => {
  const { c } = useTheme();
  return (
    <Band id="danh-tuong" bg={c.logoPaper} wide={wide} onSection={onSection} decor={<GoldRings />}>
      <Reveal from="scale">
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: wide ? 12 : 4 }} pointerEvents="none">
          {CAST.map((m, i) => (
            <Mascot key={m.accessory} size={wide ? 112 : 70} accessory={m.accessory} mood={m.mood} bob={i % 2 === 0} title={`Rồng Con ${m.accessory}`} />
          ))}
        </View>
      </Reveal>
      <Head logo title="Gặp gỡ danh tướng nhà Trần" text="Chọn một nhân vật để xem sơ yếu lý lịch và công trạng. Mỗi người gắn nhãn nguồn gốc để phân biệt chính sử với giai thoại và phần sáng tạo của game." wide={wide} />
      <Reveal>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {Object.keys(LORE_LABEL).map((k) => (
            <LoreChip key={k} lore={k} />
          ))}
        </View>
      </Reveal>
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
      <Head logo title="Lời ông cha còn vang mãi" text="Những câu nói làm nên hào khí Đông A, có trong từng màn chơi của game." wide={wide} />
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
      <Reveal style={{ maxWidth: 860, width: '100%', alignSelf: 'center' }}>
      <Panel pad={24} style={[{ flexDirection: wide ? 'row' : 'column', alignItems: 'center', gap: 20, width: '100%' }, PAPER_CARD]}>
        <Seal text={'ĐÔNG\nA'} size={wide ? 96 : 72} />
        <View style={{ flex: wide ? 1 : undefined, gap: 6 }}>
          <Txt f="heavy" size={22} color={c.logoInk} center={!wide} style={{ lineHeight: 28 }}>
            Hào khí Đông A là gì?
          </Txt>
          <Txt size={15} color={INK_SOFT} center={!wide} style={{ lineHeight: 23 }}>
            Là khí phách hào hùng, lòng tự hào dân tộc và sự đồng lòng từ vua đến dân của thời Trần. Tên gọi còn được giải thích bằng cách chiết tự chữ “Trần” thành “Đông” và “A”.
          </Txt>
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
      <View style={{ width: '100%', maxWidth: 860, alignSelf: 'center', paddingHorizontal: 16, paddingTop: wide ? 190 : 150, paddingBottom: wide ? 130 : 90 }}>
      <Reveal from="scale">
      <View style={{ alignItems: 'center', gap: 22 }}>
        <Txt f="heavy" size={wide ? 64 : 36} color={c.trang} center accessibilityRole="header" style={{ lineHeight: wide ? 70 : 42, letterSpacing: wide ? -2 : -1 }}>
          Cùng cả lớp ra trận{'\n'}với <Txt f="heavy" size={wide ? 64 : 36} color={c.vang} style={{ lineHeight: wide ? 70 : 42, letterSpacing: wide ? -2 : -1 }}>Đông A</Txt>!
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

/** Chân trang: dải sóng nước đỏ vàng nối khối cuối, rồi dải trắng với logo và tên đề tài */
const FooterSection: React.FC<{ wide: boolean }> = ({ wide }) => {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ width: '100%', backgroundColor: c.dem }}>
      <WaveBand bg={c.son} line={c.vang} height={24} />
      <View style={{ backgroundColor: c.the, paddingBottom: insets.bottom, overflow: 'hidden' }}>
        <PatternOverlay opacity={0.055} />
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
export const HomeSections: React.FC<{ wide: boolean; go: (id: string) => void; onSection: (id: string, y: number) => void; onVideoImmersiveChange: (on: boolean) => void }> = ({ wide, go, onSection, onVideoImmersiveChange }) => {
  const { c } = useTheme();
  return (
  <>
    <HeroSection wide={wide} go={go} />
    <PhaseMarquee wide={wide} onSection={onSection} />
    <CloudPair upper={c.xam} lower={c.logoPaper} wide={wide} variant={1} />
    <HomeVideo wide={wide} onImmersiveChange={onVideoImmersiveChange} />
    <SectionCloud color={c.logoPaper} sound wide={wide} direction="up" variant={1} />
    <ShowcaseSection wide={wide} onSection={onSection} />
    <CloudPair upper={c.logoPaper} lower={c.logoPaper} wide={wide} variant={1} />
    <ExplorerSection wide={wide} onSection={onSection} />
    <CloudPair upper={c.logoPaper} lower={c.logoPaper} wide={wide} variant={1} />
    <CastSection wide={wide} onSection={onSection} />
    <CloudPair upper={c.logoPaper} lower={c.logoPaper} wide={wide} variant={1} />
    <QuotesSection wide={wide} onSection={onSection} />
    <SectionCloud color={c.logoPaper} rim sound wide={wide} variant={2} />
    <ClosingSection wide={wide} />
    <FooterSection wide={wide} />
  </>
  );
};
