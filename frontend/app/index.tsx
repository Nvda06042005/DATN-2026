/**
 * Trang chủ công khai theo bố cục VioEdu nhưng giao diện hiện đại: nền bầu trời dựng lại bằng SVG, nút phẳng dạng viên thuốc, thẻ trắng viền mảnh bóng nhẹ,
 * chữ Be Vietnam Pro, biểu tượng cùng nét mảnh và cỡ tính theo cỡ chữ đi kèm (xem iconPx).
 * Số liệu lấy thẳng từ dữ liệu game nên không lệch. Không có liên kết tới hai cổng quản trị. expo-router bắt buộc tên index cho đường dẫn "/".
 */
import { useState } from 'react';
import { Platform, Pressable, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Activity, ArrowRight, Castle, Check, Compass, Database, Download, FileSpreadsheet, GraduationCap, Joystick, Landmark, LayoutDashboard, Layers, LibraryBig, Lock,
  Map as MapIcon, Medal, MessageSquareText, Milestone, Monitor, MonitorSmartphone, Puzzle, RadioTower, Route, School, ScrollText, Send, Shield, ShieldCheck, Smartphone,
  Stamp, Sword, Table2, Tablet, TrendingUp, Trophy, Undo2, Users, WandSparkles, Zap,
} from 'lucide-react-native';
import { BrandLogo, CloudBank, GradeBadge, SchematicMap, SkyBackdrop } from '@/components/art';
import { useDocumentTitle } from '@/components/auth';
import { LoreChip } from '@/components/game/quiz';
import { TemplateGuide, downloadTemplate } from '@/components/provisioning';
import { Chip, Screen, Txt } from '@/components/ui';
import { CAMPAIGNS, CAMPAIGN_ROUTES, PHASES } from '@/constants/campaigns';
import { ELEMENTS, GAME_TABS, LORE_LABEL } from '@/constants/game';
import { HEROES } from '@/constants/heroes';
import type { Palette } from '@/constants/theme';
import { WORLD_QUESTS } from '@/constants/world';
import { useReduceMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import { webHref } from '@/lib/format';
import type { IconType } from '@/types/game';

const MAX_W = 1120;
const WEB = Platform.OS === 'web';
/** Chiều cao thanh điều hướng nổi (64) cộng khoảng cách trên (12) */
const HEADER_SPACE = 76;

/** Đầu trang dính khi cuộn (chỉ web) */
const STICKY = (WEB ? { position: 'sticky', top: 0 } : null) as unknown as ViewStyle;

/** Đích cuộn của liên kết neo chừa chỗ cho đầu trang dính */
const ANCHOR = (WEB ? { scrollMarginTop: 88 } : null) as unknown as ViewStyle;

const NAV = [
  { id: 'ba-lan-khang-chien', label: 'Ba lần kháng chiến' },
  { id: 'lo-trinh', label: 'Lộ trình' },
  { id: 'danh-tuong', label: 'Danh tướng' },
  { id: 'vi-sao', label: 'Dành cho ai' },
  { id: 'de-tai', label: 'Về đề tài' },
] as const;

/** Thông tin tóm tắt mỗi cuộc kháng chiến (đối chiếu sách giáo khoa Lịch sử 7 và kho kiến thức của game) */
const CAMPAIGN_FACTS: Record<1 | 2 | 3, { enemy: string; lead: string; key: string }> = {
  1: { enemy: 'Quân Mông Cổ do Ngột Lương Hợp Thai chỉ huy', lead: 'Vua Trần Thái Tông, Thái sư Trần Thủ Độ', key: 'Vườn không nhà trống; phản công thắng lợi ở Đông Bộ Đầu (29/1/1258)' },
  2: { enemy: 'Quân Nguyên do Thoát Hoan và Toa Đô chỉ huy', lead: 'Vua Trần Nhân Tông, Quốc công tiết chế Trần Hưng Đạo', key: 'Hội nghị Diên Hồng; thắng Hàm Tử, Chương Dương, Tây Kết; thu phục Thăng Long (6/1285)' },
  3: { enemy: 'Quân Nguyên do Thoát Hoan và Ô Mã Nhi chỉ huy', lead: 'Vua Trần Nhân Tông, Quốc công tiết chế Trần Hưng Đạo', key: 'Đánh đoàn thuyền lương ở Vân Đồn; trận Bạch Đằng (4/1288)' },
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
      <Icon size={iconPx(text)} color={fg ?? c.troi} strokeWidth={1.75} />
    </View>
  );
};

/** Thẻ trắng viền mảnh, bóng nhẹ */
const Panel: React.FC<{ children: React.ReactNode; pad?: number; style?: StyleProp<ViewStyle> }> = ({ children, pad = 24, style }) => {
  const { c } = useTheme();
  return <View style={[{ backgroundColor: c.the, borderRadius: 20, borderWidth: 1, borderColor: c.bienXanh, padding: pad }, shadow(c, 'sm'), style]}>{children}</View>;
};

type CtaTone = 'son' | 'xanh' | 'trang' | 'vien';

/** Nút phẳng dạng viên thuốc, cao tối thiểu 44 */
const Cta: React.FC<{ title: string; onPress: () => void; tone?: CtaTone; icon?: IconType; arrow?: boolean; lg?: boolean; label?: string; testID?: string }> = ({
  title, onPress, tone = 'son', icon, arrow = false, lg = false, label, testID,
}) => {
  const { c } = useTheme();
  const t = { son: { bg: c.son, fg: c.the, bd: c.son }, xanh: { bg: c.xanhMuc, fg: c.the, bd: c.xanhMuc }, trang: { bg: c.the, fg: c.xanhMuc, bd: c.the }, vien: { bg: 'transparent', fg: c.xanhMuc, bd: c.xanhMuc2 } }[tone];
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
          tone === 'vien' ? null : shadow(c, 'sm'),
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
  id?: string; bg?: string; sky?: 'blue' | 'night'; cloudTop?: string; cloudBottom?: string; wide: boolean; gap?: number; children: React.ReactNode;
}> = ({ id, bg, sky, cloudTop, cloudBottom, wide, gap = 32, children }) => (
  <View id={id} style={[{ width: '100%', backgroundColor: bg }, id ? ANCHOR : null]}>
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
      <Txt f="heavy" size={wide ? 40 : 26} color={light ? c.the : c.xanhMuc} center accessibilityRole="header" style={{ lineHeight: wide ? 48 : 33, letterSpacing: -0.6 }}>
        {title}
      </Txt>
      {text && (
        <Txt size={17} color={light ? c.the : c.xanhMuc2} center style={{ maxWidth: 720 }}>
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
/** Thanh điều hướng nổi, dính khi cuộn; kéo hero lên dưới nó bằng lề âm */
const Header: React.FC<{ width: number; go: (id: string) => void }> = ({ width, go }) => {
  const { c } = useTheme();
  const router = useRouter();
  return (
    <View pointerEvents="box-none" style={[{ zIndex: 30, paddingHorizontal: 12, paddingTop: 12, marginBottom: -HEADER_SPACE }, STICKY]}>
      <View
        style={[
          { width: '100%', maxWidth: MAX_W, alignSelf: 'center', height: 64, borderRadius: 20, backgroundColor: c.the, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
          shadow(c, 'sm'),
        ]}
      >
        <BrandLogo subtitle="Học Sử qua game" />
        {WEB && width >= 1000 && (
          <View accessibilityRole="menu" style={{ flexDirection: 'row', gap: 2 }}>
            {NAV.map((n) => (
              <Pressable
                key={n.id}
                accessibilityRole="link"
                accessibilityLabel={n.label}
                onPress={() => go(n.id)}
                style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 12, backgroundColor: pressed ? c.troi5 : 'transparent' })}
              >
                <Txt f="semibold" size={15} color={c.xanhMuc}>
                  {n.label}
                </Txt>
              </Pressable>
            ))}
          </View>
        )}
        <Cta title={width >= 360 ? 'Đăng nhập' : ''} label="Đăng nhập học tập" icon={width >= 360 ? undefined : ArrowRight} onPress={() => router.push('/portal')} testID="home-login" />
      </View>
    </View>
  );
};

/** Ví dụ một câu hỏi trong game (minh họa giao diện làm bài) */
const QuizPreview: React.FC<{ wide: boolean }> = ({ wide }) => {
  const { c } = useTheme();
  const options = ['Trần Hưng Đạo', 'Ngô Quyền', 'Lê Lợi', 'Quang Trung'];
  return (
    <View style={{ width: '100%', maxWidth: 440 }}>
      <View
        accessible
        accessibilityLabel="Ví dụ một câu hỏi trong game: Trận Bạch Đằng năm 1288 do ai chỉ huy? Đáp án đúng là Trần Hưng Đạo."
        style={[{ backgroundColor: c.the, borderRadius: 24, borderWidth: 1, borderColor: c.bienXanh, padding: 20, gap: 14 }, shadow(c, 'lg')]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Chip text="Chiến dịch 3 · Bạch Đằng" icon={Castle} bg={c.troi5} fg={c.troi} />
          <Txt size={12} color={c.xanhMuc2}>
            Ví dụ
          </Txt>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: c.troi5 }}>
          <View style={{ width: '60%', height: 6, borderRadius: 3, backgroundColor: c.troi2 }} />
        </View>
        <Txt f="bold" size={19} color={c.xanhMuc} style={{ lineHeight: 27 }}>
          Trận Bạch Đằng năm 1288 do ai chỉ huy?
        </Txt>
        <View style={{ gap: 8 }}>
          {options.map((o, i) => {
            const right = i === 0;
            return (
              <View
                key={o}
                style={{
                  minHeight: 48, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
                  borderColor: right ? c.ngoc : c.bienXanh, backgroundColor: right ? c.ngocNhat : c.the,
                }}
              >
                <Txt f="bold" size={14} color={right ? c.ngocChu : c.xanhMuc2} style={{ width: 16 }}>
                  {'ABCD'[i]}
                </Txt>
                <Txt f={right ? 'bold' : 'medium'} size={15} color={right ? c.ngocChu : c.xanhMuc} style={{ flex: 1 }}>
                  {o}
                </Txt>
                {right && <Ico icon={Check} text={15} color={c.ngocChu} />}
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Chip text="Điểm kinh nghiệm" icon={Zap} bg={c.ngocNhat} fg={c.ngocChu} />
          <Chip text="Ấn Tín" icon={Stamp} bg={c.vangNhat} fg={c.vangChu} />
        </View>
      </View>
      {wide && (
        <View style={[{ position: 'absolute', right: -20, bottom: -28, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingRight: 16, borderRadius: 16, backgroundColor: c.the, borderWidth: 1, borderColor: c.bienXanh }, shadow(c, 'sm')]}>
          <IconTile icon={Zap} text={14} size={36} bg={c.sonNhat} fg={c.sonChu} />
          <View>
            <Txt f="bold" size={14} color={c.xanhMuc}>
              Thi đấu trực tiếp
            </Txt>
            <Txt size={12} color={c.xanhMuc2}>
              Cả lớp cùng chơi
            </Txt>
          </View>
        </View>
      )}
    </View>
  );
};

const Hero: React.FC<{ wide: boolean; go: (id: string) => void }> = ({ wide, go }) => {
  const { c } = useTheme();
  const router = useRouter();
  const portalHref = webHref('/portal');
  const trust: Array<{ icon: IconType; text: string }> = [
    { icon: ShieldCheck, text: 'Tài khoản do nhà trường cấp' },
    { icon: MonitorSmartphone, text: 'Web, Android, iOS' },
    { icon: MessageSquareText, text: 'Có Quân Sư AI hỏi đáp' },
  ];
  return (
    <View style={{ width: '100%', backgroundColor: c.troi4 }}>
      <SkyBackdrop variant="hero" />
      <CloudBank color={c.the} flip height={96} />
      <View style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingTop: HEADER_SPACE + (wide ? 72 : 36), paddingBottom: wide ? 168 : 132 }}>
        <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'center', gap: wide ? 48 : 52 }}>
          <View style={{ flex: wide ? 1.12 : undefined, width: wide ? undefined : '100%', gap: 20, alignItems: wide ? 'flex-start' : 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: c.the, borderWidth: 1, borderColor: c.bienXanh }}>
              <Ico icon={GraduationCap} text={13} color={c.troi} />
              <Txt f="semibold" size={13} color={c.xanhMuc}>
                Lịch sử và Địa lí THCS · Khối 6 – 9
              </Txt>
            </View>
            <Txt f="heavy" size={wide ? 48 : 32} color={c.xanhMuc} center={!wide} accessibilityRole="header" style={{ lineHeight: wide ? 57 : 39, letterSpacing: -1 }}>
              Học Sử game hóa{'\n'}
              {/* U+00A0 + U+2060: dấu "–" cho phép ngắt dòng ngay sau nó, nên cần thêm ký tự nối từ để "Nguyên – Mông" không bị tách */}
              <Txt f="heavy" size={wide ? 48 : 32} color={c.sonChu} style={{ lineHeight: wide ? 57 : 39, letterSpacing: -1 }}>
                {`ba lần kháng chiến${wide ? '\n' : ' '}chống Nguyên –⁠ Mông`}
              </Txt>
            </Txt>
            <Txt size={18} color={c.xanhMuc2} center={!wide} style={{ maxWidth: 560, lineHeight: 28 }}>
              Hào Khí Đông A là nền tảng học tập game hóa: xây Điền Trang, chiêu mộ danh tướng nhà Trần và ra trận theo đúng kế sách của ông cha. Mỗi sức mạnh đều đến từ một câu trả lời đúng – có Quân Sư AI đồng hành, thầy cô theo dõi tiến độ cả lớp.
            </Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: wide ? 'flex-start' : 'center' }}>
              <Cta title="Vào học ngay" arrow lg onPress={() => router.push('/portal')} testID="home-portal" />
              {WEB && <Cta title="Khám phá nội dung" tone="vien" icon={Compass} lg onPress={() => go('ba-lan-khang-chien')} />}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, columnGap: 20, justifyContent: wide ? 'flex-start' : 'center' }}>
              {trust.map((t) => (
                <View key={t.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ico icon={t.icon} text={14} color={c.troi} />
                  <Txt f="semibold" size={14} color={c.xanhMuc2}>
                    {t.text}
                  </Txt>
                </View>
              ))}
            </View>
            {portalHref && (
              <Txt f="medium" size={13} color={c.xanhMuc2}>
                {portalHref.replace(/^https?:\/\//, '')}
              </Txt>
            )}
          </View>
          <View style={{ flex: wide ? 0.88 : undefined, width: wide ? undefined : '100%', alignItems: 'center' }}>
            <QuizPreview wide={wide} />
          </View>
        </View>
      </View>
    </View>
  );
};

/** Khung số liệu trắng nằm đè lên đáy hero */
const Stats: React.FC<{ wide: boolean }> = ({ wide }) => {
  const { c } = useTheme();
  const items: Array<{ icon: IconType; value: number; label: string }> = [
    { icon: Castle, value: CAMPAIGNS.length, label: 'lần kháng chiến: 1258, 1285 và 1287 – 1288' },
    { icon: Route, value: PHASES.length, label: 'màn chiến dịch, từ Bình Lệ Nguyên đến Bạch Đằng' },
    { icon: Shield, value: HEROES.length, label: 'danh tướng và đội quân nhà Trần để chiêu mộ' },
    { icon: ScrollText, value: WORLD_QUESTS.length, label: 'nhiệm vụ khám phá trong Hành Trình Đông A' },
  ];
  return (
    <View style={{ width: '100%', marginTop: wide ? -84 : -72, zIndex: 5, paddingHorizontal: 16 }}>
      <Panel pad={0} style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', borderRadius: 24, flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden' }}>
        {items.map((s, i) => (
          <View
            key={s.label}
            style={{
              flexGrow: 1, flexBasis: wide ? 240 : 280, padding: 24, flexDirection: 'row', alignItems: 'center', gap: 16,
              borderLeftWidth: wide && i > 0 ? 1 : 0, borderTopWidth: !wide && i > 0 ? 1 : 0, borderColor: c.bienXanh,
            }}
          >
            <IconTile icon={s.icon} text={18} size={48} />
            <View style={{ flex: 1 }}>
              <Txt f="heavy" size={34} color={c.xanhMuc} accessibilityLabel={`${s.value} ${s.label}`} style={{ lineHeight: 40, letterSpacing: -0.5 }}>
                {s.value}
              </Txt>
              <Txt size={13} color={c.xanhMuc2} accessibilityElementsHidden importantForAccessibility="no">
                {s.label}
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
  const { c } = useTheme();
  const router = useRouter();
  const [sel, setSel] = useState<1 | 2 | 3>(1);
  const camp = CAMPAIGNS[sel - 1];
  const facts = CAMPAIGN_FACTS[sel];
  const look = { accent: c.troi, soft: c.troi5 };
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
                accessibilityLabel={`${k.name}, ${k.years}. ${k.desc}`}
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
                    {k.desc}
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
        <SchematicMap pins={[...new Set(phases.map((p) => p.place))]} routes={CAMPAIGN_ROUTES[sel]} title={`Lược đồ ${camp.name}`} />
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
            <Chip key={t.id} text={t.label} icon={t.Icon} bg={c.troi5} fg={c.troi} />
          ))}
          <Chip text="Hành Trình Đông A" icon={Compass} bg={c.troi5} fg={c.troi} />
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
            <Txt f="heavy" size={40} color={c.troi4} accessibilityElementsHidden importantForAccessibility="no" style={{ lineHeight: 46 }}>
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
export default function Home() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const [who, setWho] = useState<AudienceId>('hoc_sinh');
  useDocumentTitle('Đông A – Nền tảng học Sử game hóa');

  const go = (id: string) => {
    if (WEB && typeof document !== 'undefined') document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <Screen maxWidth={100000} pad={0} edges={['top']} contentStyle={{ gap: 0 }}>
      <View style={{ backgroundColor: c.xanhMuc }}>
        <View style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <View style={{ flexShrink: 0 }}>
            <Ico icon={GraduationCap} text={13} color={c.troi3} />
          </View>
          <Txt f="medium" size={13} color={c.the} center style={{ flexShrink: 1 }}>
            Đề tài khóa luận · Nghiên cứu và phát triển nền tảng học tập game hóa hỗ trợ khám phá lịch sử ba lần kháng chiến chống Nguyên – Mông thời Trần
          </Txt>
        </View>
      </View>
      <Header width={width} go={go} />
      <Hero wide={wide} go={go} />
      <Stats wide={wide} />

      <Band id="ba-lan-khang-chien" bg={c.the} wide={wide}>
        <Head eyebrow="Chương trình học" title="Ba lần kháng chiến chống Nguyên – Mông" text="Chọn một cuộc kháng chiến để xem lược đồ, diễn biến chính và các màn chơi." wide={wide} />
        <CampaignExplorer wide={wide} />
      </Band>

      <Band id="lo-trinh" sky="blue" cloudTop={c.the} cloudBottom={c.the} wide={wide}>
        <Head light eyebrow="Lộ trình học tập" title="Học qua ba bước, vui như chơi" text="Từ ngày đầu vào lớp đến lúc cùng cả lớp thi đấu, mọi hoạt động đều gắn với kiến thức lịch sử." wide={wide} />
        <Roadmap wide={wide} />
      </Band>

      <Band id="danh-tuong" bg={c.the} wide={wide}>
        <Head eyebrow="Đội hình nhà Trần" title="Chiêu mộ danh tướng nhà Trần" text="Mỗi nhân vật gắn nhãn nguồn gốc để học sinh phân biệt chính sử với giai thoại và phần sáng tạo của game." wide={wide} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {Object.keys(LORE_LABEL).map((k) => (
            <LoreChip key={k} lore={k} />
          ))}
        </View>
        <HeroRoster wide={wide} />
      </Band>

      <Band id="vi-sao" bg={c.troi5} wide={wide}>
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

      <Band id="de-tai" bg={c.the} wide={wide}>
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
              <Chip text="Trình duyệt web" icon={Monitor} bg={c.troi5} fg={c.troi} />
              <Chip text="Android" icon={Smartphone} bg={c.troi5} fg={c.troi} />
              <Chip text="iPhone, iPad" icon={Tablet} bg={c.troi5} fg={c.troi} />
            </View>
          </View>
        </View>
      </Band>

      <Band id="nha-truong" bg={c.troi5} wide={wide}>
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
          <Txt f="heavy" size={wide ? 40 : 28} color={c.the} center accessibilityRole="header" style={{ lineHeight: wide ? 48 : 35, letterSpacing: -0.6 }}>
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

      <View style={{ backgroundColor: c.xanhMuc, paddingBottom: insets.bottom }}>
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
                <Txt f="bold" size={16} color={c.the} accessibilityRole="header">
                  Khám phá
                </Txt>
                {NAV.map((n) => (
                  <FootLink key={n.id} label={n.label} onPress={() => go(n.id)} />
                ))}
              </View>
            )}
            <View style={{ flex: wide ? 1 : undefined }}>
              <Txt f="bold" size={16} color={c.the} accessibilityRole="header">
                Truy cập
              </Txt>
              <FootLink label="Đăng nhập học tập" onPress={() => router.push('/portal')} />
              <FootLink label="Tải file Excel mẫu" onPress={downloadTemplate} />
            </View>
          </View>
          <Txt f="medium" size={12} color={c.troi3} center style={{ borderTopWidth: 1, borderTopColor: c.xanhMuc2, paddingTop: 16 }}>
            © Đông A EDU · Lịch sử và Địa lí – Ba lần kháng chiến chống quân xâm lược Mông – Nguyên
          </Txt>
        </View>
      </View>
    </Screen>
  );
}
