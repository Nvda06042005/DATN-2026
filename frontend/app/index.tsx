/**
 * Trang chủ công khai, bố cục theo trang chủ VioEdu: thanh đề tài, đầu trang dính, hero, số liệu, ba lần kháng chiến (lược đồ),
 * lộ trình, danh tướng, vì sao chọn Đông A, về đề tài, nhà trường (file Excel mẫu), kêu gọi hành động, chân trang.
 * Số liệu lấy thẳng từ dữ liệu game nên không lệch. Không có liên kết tới hai cổng quản trị. expo-router bắt buộc tên index cho đường dẫn "/".
 */
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArchiveRestore, Bot, BrainCircuit, ChartColumn, Check, ChevronRight, Compass, Crown, Database, Download, FileSpreadsheet, Flag, Gamepad2, KeyRound, LogIn, Mail, Map as MapIcon,
  Monitor, Play, Radio, ShieldCheck, Ship, Smartphone, Sparkles, Stamp, Swords, Tablet, Target, Trophy, UserCheck, Users,
} from 'lucide-react-native';
import { BattleBackdrop, BrandLogo, GradeBadge, HeroMedallion, Mascot, SchematicMap } from '@/components/art';
import { useDocumentTitle } from '@/components/auth';
import { LoreChip } from '@/components/game/quiz';
import { TemplateGuide, downloadTemplate } from '@/components/provisioning';
import { Btn, Card, Chip, Inset, Screen, Segmented, Txt } from '@/components/ui';
import { CAMPAIGNS, CAMPAIGN_ROUTES, PHASES } from '@/constants/campaigns';
import { GAME_TABS, LORE_LABEL, TIER_INFO } from '@/constants/game';
import { HEROES } from '@/constants/heroes';
import { toneColors, type Palette, type Tone } from '@/constants/theme';
import { WORLD_QUESTS } from '@/constants/world';
import { useReduceMotion } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import { webHref } from '@/lib/format';
import type { IconType } from '@/types/game';

const MAX_W = 1120;
const WEB = Platform.OS === 'web';

/** Đầu trang dính khi cuộn (chỉ web) */
const STICKY = (WEB ? { position: 'sticky', top: 0 } : null) as unknown as ViewStyle;

/** Đích cuộn của liên kết neo chừa chỗ cho đầu trang dính */
const ANCHOR = (WEB ? { scrollMarginTop: 72 } : null) as unknown as ViewStyle;

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
    { icon: Gamepad2, title: 'Học như chơi game', text: 'Thu lương thảo, chiêu mộ và tiến hóa danh tướng, đánh các màn chiến dịch – mỗi sức mạnh đều đến từ một câu trả lời đúng.' },
    { icon: Bot, title: 'Quân Sư AI giải đáp', text: 'Hỏi bất cứ điều gì về ba lần kháng chiến; câu trả lời dựa trên kho kiến thức sử liệu của đề tài.' },
    { icon: Compass, title: 'Khám phá Hành Trình Đông A', text: 'Đi khắp làng pixel, trò chuyện với dân làng, thu cuộn sử và làm nhiệm vụ để hiểu chuyện xưa.' },
    { icon: Target, title: 'Ôn đúng chỗ còn yếu', text: 'Hệ thống ghi nhận mức nắm vững từng kiến thức sau mỗi câu trả lời và gợi ý câu hỏi tiếp theo.' },
  ],
  giao_vien: [
    { icon: ChartColumn, title: 'Theo dõi cả lớp', text: 'Tiến độ, câu sai nhiều nhất và mức nắm vững của từng em trên một màn hình.' },
    { icon: Trophy, title: 'Thi đấu trực tiếp', text: 'Mở phòng bằng mã PIN, cả lớp thi đấu thời gian thực kiểu Kahoot ngay trên điện thoại.' },
    { icon: Sparkles, title: 'Soạn đề bằng AI', text: 'Tạo nhanh câu hỏi ôn tập từ kho kiến thức của đề tài, tiết kiệm thời gian chuẩn bị bài.' },
    { icon: UserCheck, title: 'Quản lý lớp học', text: 'Xin mở lớp, được nhà trường duyệt rồi mời học sinh vào bằng mã lớp.' },
  ],
  nha_truong: [
    { icon: FileSpreadsheet, title: 'Cấp tài khoản hàng loạt', text: 'Điền file Excel mẫu, quản trị trường nhập một lần là có tài khoản giáo viên và học sinh.' },
    { icon: ShieldCheck, title: 'Dữ liệu tách theo trường', text: 'Mỗi trường chỉ thấy dữ liệu của mình nhờ phân quyền ngay ở tầng cơ sở dữ liệu.' },
    { icon: Mail, title: 'Gửi tài khoản qua thư', text: 'Mật khẩu ban đầu được gửi qua thư điện tử, không hiển thị công khai.' },
    { icon: ArchiveRestore, title: 'Xóa nhầm vẫn khôi phục', text: 'Tài khoản bị xóa nằm trong thùng rác 45 ngày trước khi xóa vĩnh viễn.' },
  ],
};

const TECH: Benefit[] = [
  { icon: Gamepad2, title: 'Game hóa', text: 'Điểm kinh nghiệm, Ấn Tín, tướng, nhiệm vụ và thi đấu' },
  { icon: BrainCircuit, title: 'BKT', text: 'Ước lượng mức nắm vững từng kiến thức' },
  { icon: Bot, title: 'RAG', text: 'Hỏi đáp dựa trên kho kiến thức sử liệu' },
  { icon: Radio, title: 'Thời gian thực', text: 'WebSocket cho phòng thi đấu cả lớp' },
  { icon: Smartphone, title: 'Đa nền tảng', text: 'Expo React Native: một mã nguồn cho web, Android, iOS' },
  { icon: Database, title: 'PostgreSQL + RLS', text: 'Dữ liệu bền vững, tách theo trường' },
];

const GOALS = [
  'Số hóa kiến thức ba lần kháng chiến (1258, 1285, 1287 – 1288) thành màn chơi, thẻ Sử Ký và câu hỏi có đáp án.',
  'Tạo động lực học bằng cơ chế game hóa: điểm kinh nghiệm, Ấn Tín, chiêu mộ và tiến hóa danh tướng, nhiệm vụ.',
  'Cá nhân hóa việc học bằng theo dõi mức nắm vững (BKT) và trợ lý hỏi đáp (RAG).',
  'Cung cấp công cụ để giáo viên và nhà trường tổ chức lớp, thi đấu và cấp tài khoản.',
];

// ---------------------------------------------------------------------- khối dùng chung
/** Dải toàn chiều rộng; nội dung bên trong giới hạn bề ngang và căn giữa */
const Band: React.FC<{ id?: string; bg?: string; gradient?: readonly [string, string]; wide: boolean; gap?: number; compact?: boolean; children: React.ReactNode }> = ({
  id, bg, gradient, wide, gap = 24, compact = false, children,
}) => (
  <View id={id} style={[{ width: '100%', backgroundColor: bg }, id ? ANCHOR : null]}>
    {gradient && <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} />}
    <View style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: compact ? 8 : wide ? 56 : 32, gap }}>{children}</View>
  </View>
);

const Head: React.FC<{ eyebrow: string; title: string; text?: string; wide: boolean }> = ({ eyebrow, title, text, wide }) => {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6, alignItems: 'center' }}>
      <Txt f="bold" size={13} color={c.dongChu} upper center>
        {eyebrow}
      </Txt>
      <Txt f="displayHeavy" size={wide ? 38 : 28} center accessibilityRole="header">
        {title}
      </Txt>
      {text && (
        <Txt size={16} color={c.muc2} center style={{ maxWidth: 760 }}>
          {text}
        </Txt>
      )}
    </View>
  );
};

/** Ô biểu tượng nền màu (chữ tối trên nền tươi, trắng trên nền đậm) */
const IconBox: React.FC<{ icon: IconType; tone: Tone; size?: number }> = ({ icon: Icon, tone, size = 56 }) => {
  const { c } = useTheme();
  const t = toneColors(c, tone);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4, borderBottomColor: t.edge }}
    >
      <Icon size={size * 0.52} color={t.fg} strokeWidth={2.2} />
    </View>
  );
};

const BenefitCard: React.FC<{ item: Benefit; tone: Tone }> = ({ item, tone }) => {
  const { c } = useTheme();
  return (
    <Card pad={20} style={{ flexGrow: 1, flexBasis: 240, gap: 12 }}>
      <IconBox icon={item.icon} tone={tone} />
      <Txt f="displayHeavy" size={20}>
        {item.title}
      </Txt>
      <Txt size={15} color={c.muc2}>
        {item.text}
      </Txt>
    </Card>
  );
};

const FootLink: React.FC<{ label: string; onPress: () => void }> = ({ label, onPress }) => {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      <Txt f="semibold" size={15} color={c.vien}>
        {label}
      </Txt>
    </Pressable>
  );
};

// ---------------------------------------------------------------------- đầu trang và hero
const Header: React.FC<{ width: number; go: (id: string) => void }> = ({ width, go }) => {
  const { c } = useTheme();
  const router = useRouter();
  return (
    <View style={[{ backgroundColor: c.the, borderBottomWidth: 2, borderBottomColor: c.vien, zIndex: 20 }, STICKY]}>
      <View style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <BrandLogo subtitle="Học Sử qua game" />
        {WEB && width >= 1000 && (
          <View accessibilityRole="menu" style={{ flexDirection: 'row', gap: 2 }}>
            {NAV.map((n) => (
              <Pressable
                key={n.id}
                accessibilityRole="link"
                accessibilityLabel={n.label}
                onPress={() => go(n.id)}
                style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 12, backgroundColor: pressed ? c.giay2 : 'transparent' })}
              >
                <Txt f="bold" size={15} color={c.muc2}>
                  {n.label}
                </Txt>
              </Pressable>
            ))}
          </View>
        )}
        <Btn tone="dong" size="sm" icon={LogIn} title={width >= 360 ? 'Đăng nhập' : undefined} label="Đăng nhập học tập" onPress={() => router.push('/portal')} testID="home-login" />
      </View>
    </View>
  );
};

/** Thẻ nổi nhỏ trên cảnh hero (minh họa cơ chế thưởng của game) */
const FloatTag: React.FC<{ icon: IconType; text: string; tone: Tone; style: StyleProp<ViewStyle> }> = ({ icon, text, tone, style }) => {
  const { c } = useTheme();
  return (
    <View
      style={[
        { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 6, paddingRight: 12, minHeight: 40, borderRadius: 14, backgroundColor: c.the, borderWidth: 2, borderColor: c.vien, borderBottomWidth: 4, borderBottomColor: c.vien2 },
        style,
      ]}
    >
      <IconBox icon={icon} tone={tone} size={28} />
      <Txt f="bold" size={13}>
        {text}
      </Txt>
    </View>
  );
};

const HeroScene: React.FC<{ wide: boolean }> = ({ wide }) => {
  const { c } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Rồng Con đội mũ trụ đứng bên bờ sông Bạch Đằng cắm đầy cọc"
      style={{ width: '100%', maxWidth: 460, aspectRatio: 400 / 290, borderRadius: 28, overflow: 'hidden', borderWidth: 3, borderColor: c.vien2, borderBottomWidth: 8 }}
    >
      <BattleBackdrop bg="river" tide="dung" dark={false} stakes />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 10, alignItems: 'center' }}>
        <Mascot size={wide ? 170 : 120} mood="excited" accessory="helmet" bob />
      </View>
      <FloatTag icon={Ship} tone="thuy" text="Bạch Đằng · 4/1288" style={{ top: 12, left: 12 }} />
      <FloatTag icon={Stamp} tone="vang" text="Thưởng Ấn Tín" style={{ top: wide ? 64 : 58, right: 12 }} />
      <FloatTag icon={Check} tone="ngoc" text="Trả lời đúng +XP" style={{ bottom: 14, left: 12 }} />
    </View>
  );
};

const Hero: React.FC<{ wide: boolean; go: (id: string) => void }> = ({ wide, go }) => {
  const { c } = useTheme();
  const router = useRouter();
  const portalHref = webHref('/portal');
  return (
    <Band gradient={[c.dongNhat, c.giay]} wide={wide} gap={0}>
      <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'center', gap: wide ? 40 : 24 }}>
        <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 16, alignItems: wide ? 'flex-start' : 'center' }}>
          <Chip text="Lịch sử và Địa lí THCS · Khối 6 – 9" bg={c.the} fg={c.dongChu} icon={Flag} style={{ alignSelf: wide ? 'flex-start' : 'center' }} />
          <Txt f="displayHeavy" size={wide ? 50 : 34} center={!wide} accessibilityRole="header">
            Học Sử game hóa{'\n'}
            <Txt f="displayHeavy" size={wide ? 50 : 34} color={c.sonChu}>
              ba lần kháng chiến chống Nguyên – Mông
            </Txt>
          </Txt>
          <Txt size={17} color={c.muc2} center={!wide} style={{ maxWidth: 560 }}>
            Hào Khí Đông A là nền tảng học tập game hóa: xây Điền Trang, chiêu mộ danh tướng nhà Trần và ra trận theo đúng kế sách của ông cha. Mỗi sức mạnh đều đến từ một câu trả lời đúng – có Quân Sư AI đồng hành, thầy cô theo dõi tiến độ cả lớp.
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: wide ? 'flex-start' : 'center' }}>
            <Btn title="Vào học ngay" icon={Play} tone="dong" size="lg" onPress={() => router.push('/portal')} testID="home-portal" />
            {WEB && <Btn title="Khám phá nội dung" icon={Compass} tone="giay" size="lg" onPress={() => go('ba-lan-khang-chien')} />}
          </View>
          <Txt f="semibold" size={13} color={c.muc2} center={!wide}>
            Tài khoản do nhà trường cấp · Học trên web, Android và iOS{portalHref ? ` · ${portalHref.replace(/^https?:\/\//, '')}` : ''}
          </Txt>
        </View>
        <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', alignItems: 'center' }}>
          <HeroScene wide={wide} />
        </View>
      </View>
    </Band>
  );
};

const Stats: React.FC<{ wide: boolean }> = ({ wide }) => {
  const { c } = useTheme();
  const items: Array<{ icon: IconType; tone: Tone; value: number; label: string }> = [
    { icon: Swords, tone: 'dong', value: CAMPAIGNS.length, label: 'lần kháng chiến: 1258, 1285 và 1287 – 1288' },
    { icon: MapIcon, tone: 'ngoc', value: PHASES.length, label: 'màn chiến dịch, từ Bình Lệ Nguyên đến Bạch Đằng' },
    { icon: Users, tone: 'thuy', value: HEROES.length, label: 'danh tướng và đội quân nhà Trần để chiêu mộ' },
    { icon: Compass, tone: 'thong', value: WORLD_QUESTS.length, label: 'nhiệm vụ khám phá trong Hành Trình Đông A' },
  ];
  return (
    <Band wide={wide} compact>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        {items.map((s) => (
          <Card key={s.label} pad={18} style={{ flexGrow: 1, flexBasis: 230, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <IconBox icon={s.icon} tone={s.tone} />
            <View style={{ flex: 1 }}>
              <Txt f="displayHeavy" size={38} accessibilityLabel={`${s.value} ${s.label}`}>
                {s.value}
              </Txt>
              <Txt size={13} color={c.muc2} accessibilityElementsHidden importantForAccessibility="no">
                {s.label}
              </Txt>
            </View>
          </Card>
        ))}
      </View>
    </Band>
  );
};

// ---------------------------------------------------------------------- ba lần kháng chiến
const campLook = (c: Palette, id: 1 | 2 | 3): { tone: Tone; soft: string; text: string } =>
  id === 1 ? { tone: 'dong', soft: c.dongNhat, text: c.dongChu } : id === 2 ? { tone: 'ngoc', soft: c.ngocNhat, text: c.ngocChu } : { tone: 'thuy', soft: c.thuyNhat, text: c.thuyChu };

const FactRow: React.FC<{ icon: IconType; label: string; text: string; color: string }> = ({ icon: Icon, label, text, color }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View style={{ marginTop: 2 }}>
        <Icon size={18} color={color} strokeWidth={2.4} />
      </View>
      <Txt size={15} color={c.muc2} style={{ flex: 1 }}>
        <Txt f="bold" size={15}>
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
  const look = campLook(c, sel);
  const phases = PHASES.filter((p) => p.campaign === sel);
  return (
    <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'flex-start', gap: 20 }}>
      <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 12 }}>
        {CAMPAIGNS.map((k) => {
          const kl = campLook(c, k.id);
          const t = toneColors(c, kl.tone);
          const on = k.id === sel;
          return (
            <Pressable
              key={k.id}
              onPress={() => setSel(k.id)}
              accessibilityRole="button"
              accessibilityLabel={`${k.name}, ${k.years}. ${k.desc}`}
              accessibilityState={{ selected: on }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, minHeight: 76, borderRadius: 20, borderWidth: 3, borderBottomWidth: 6,
                borderColor: on ? t.bg : c.vien, borderBottomColor: on ? t.edge : c.vien2, backgroundColor: on ? kl.soft : c.the, transform: [{ translateY: pressed ? 2 : 0 }],
              })}
            >
              <View style={{ minWidth: 88, minHeight: 52, paddingHorizontal: 8, borderRadius: 16, backgroundColor: t.bg, borderBottomWidth: 4, borderBottomColor: t.edge, alignItems: 'center', justifyContent: 'center' }}>
                <Txt f="displayHeavy" size={18} color={t.fg} center>
                  {k.years.replace(' – ', '–')}
                </Txt>
              </View>
              <View style={{ flex: 1 }}>
                <Txt f="displayHeavy" size={19}>
                  {k.name}
                </Txt>
                <Txt size={14} color={c.muc2}>
                  {k.desc}
                </Txt>
              </View>
              <ChevronRight size={22} color={on ? kl.text : c.muc3} />
            </Pressable>
          );
        })}
        <Card pad={18} style={{ gap: 12 }}>
          <Txt f="displayHeavy" size={22} accessibilityRole="header">
            {camp.name} · {camp.years}
          </Txt>
          <FactRow icon={Swords} label="Đối phương" text={facts.enemy} color={look.text} />
          <FactRow icon={Crown} label="Lãnh đạo" text={facts.lead} color={look.text} />
          <FactRow icon={Flag} label="Diễn biến chính" text={facts.key} color={look.text} />
          <Inset pad={12} style={{ gap: 6 }}>
            <Txt f="bold" size={13} color={c.muc2} upper>
              {phases.length} màn chơi
            </Txt>
            {phases.map((p) => (
              <Txt key={p.id} size={15}>
                <Txt f="bold" size={15} color={look.text}>
                  {p.date}
                </Txt>
                {'  '}
                {p.name}
              </Txt>
            ))}
          </Inset>
          <Btn title="Chơi chiến dịch này" icon={Play} tone={look.tone} onPress={() => router.push('/portal')} />
        </Card>
      </View>
      <Card pad={0} style={{ width: wide ? 400 : '100%', overflow: 'hidden' }}>
        <SchematicMap pins={[...new Set(phases.map((p) => p.place))]} routes={CAMPAIGN_ROUTES[sel]} title={`Lược đồ ${camp.name}`} />
        <Txt size={12} color={c.muc2} style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          Mũi tên đỏ: hướng tiến quân của giặc.
        </Txt>
      </Card>
    </View>
  );
};

// ---------------------------------------------------------------------- lộ trình
const Roadmap: React.FC<{ wide: boolean }> = ({ wide }) => {
  const { c } = useTheme();
  const steps: Array<{ icon: IconType; tone: Tone; title: string; text: string; extra?: React.ReactNode }> = [
    {
      icon: KeyRound, tone: 'dong', title: 'Vào lớp',
      text: 'Nhà trường cấp tài khoản, thầy cô phát mã lớp. Em đăng nhập là vào ngay Điền Trang của riêng mình.',
    },
    {
      icon: Gamepad2, tone: 'ngoc', title: 'Chơi để học',
      text: 'Mỗi câu trả lời đúng mở thêm lương thảo, quân và sức mạnh cho danh tướng nhà Trần.',
      extra: (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {GAME_TABS.map((t) => (
            <Chip key={t.id} text={t.label} icon={t.Icon} bg={c.ngocNhat} fg={c.ngocChu} />
          ))}
          <Chip text="Hành Trình Đông A" icon={Compass} bg={c.thuyNhat} fg={c.thuyChu} />
        </View>
      ),
    },
    {
      icon: Trophy, tone: 'thong', title: 'Thử thách và đồng hành',
      text: 'Thi đấu trực tiếp cùng cả lớp, hỏi Quân Sư AI khi chưa hiểu, và nhận gợi ý ôn đúng phần kiến thức còn yếu.',
    },
  ];
  return (
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16, alignItems: 'stretch' }}>
      {steps.map((s, i) => (
        <Card key={s.title} pad={20} style={{ flex: wide ? 1 : undefined, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <IconBox icon={s.icon} tone={s.tone} />
            <Txt f="displayHeavy" size={44} color={c.vien2} accessibilityElementsHidden importantForAccessibility="no">
              {`0${i + 1}`}
            </Txt>
          </View>
          <Txt f="displayHeavy" size={22} accessibilityRole="header">
            {`Bước ${i + 1}. ${s.title}`}
          </Txt>
          <Txt size={15} color={c.muc2}>
            {s.text}
          </Txt>
          {s.extra}
        </Card>
      ))}
    </View>
  );
};

// ---------------------------------------------------------------------- danh tướng
const HeroRoster: React.FC = () => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
      {HEROES.map((h) => (
        <Card key={h.id} flat pad={14} style={{ flexGrow: 1, flexBasis: 140, maxWidth: 220, alignItems: 'center', gap: 6 }}>
          <View accessible accessibilityRole="image" accessibilityLabel={`${h.name}, ${TIER_INFO[h.tier].name}`} style={{ alignItems: 'center', gap: 6 }}>
            <HeroMedallion hero={h} size={76} />
            <Txt f="displayHeavy" size={16} center>
              {h.name}
            </Txt>
            <Txt size={12} color={c.muc2} center>
              {TIER_INFO[h.tier].name}
            </Txt>
          </View>
        </Card>
      ))}
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
      <View style={{ backgroundColor: c.son }}>
        <View style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <View style={{ flexShrink: 0 }}>
            <Flag size={16} color="#ffffff" />
          </View>
          <Txt f="semibold" size={13} color="#ffffff" center style={{ flexShrink: 1 }}>
            Đề tài khóa luận · Nghiên cứu và phát triển nền tảng học tập game hóa hỗ trợ khám phá lịch sử ba lần kháng chiến chống Nguyên – Mông thời Trần
          </Txt>
        </View>
      </View>
      <Header width={width} go={go} />
      <Hero wide={wide} go={go} />
      <Stats wide={wide} />

      <Band id="ba-lan-khang-chien" wide={wide}>
        <Head eyebrow="Chương trình học" title="Ba lần kháng chiến chống Nguyên – Mông" text="Chọn một cuộc kháng chiến để xem lược đồ, diễn biến chính và các màn chơi tương ứng." wide={wide} />
        <CampaignExplorer wide={wide} />
      </Band>

      <Band id="lo-trinh" bg={c.giay2} wide={wide}>
        <Head eyebrow="Lộ trình học tập" title="Học qua ba bước, vui như chơi" text="Từ ngày đầu vào lớp đến lúc cùng cả lớp thi đấu, mọi hoạt động đều gắn với kiến thức lịch sử." wide={wide} />
        <Roadmap wide={wide} />
      </Band>

      <Band id="danh-tuong" wide={wide}>
        <Head eyebrow="Đội hình nhà Trần" title="Chiêu mộ danh tướng nhà Trần" text="Mỗi nhân vật gắn nhãn nguồn gốc để học sinh phân biệt chính sử với giai thoại và phần sáng tạo của game." wide={wide} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {Object.keys(LORE_LABEL).map((k) => (
            <LoreChip key={k} lore={k} />
          ))}
        </View>
        <HeroRoster />
      </Band>

      <Band id="vi-sao" bg={c.giay2} wide={wide}>
        <Head eyebrow="Vì sao chọn Đông A" title="Một nền tảng cho cả lớp học" text="Mỗi đối tượng đều có công cụ riêng, nhưng cùng chung một kho kiến thức lịch sử." wide={wide} />
        <View style={{ alignItems: 'center' }}>
          <Segmented
            label="Chọn đối tượng"
            value={who}
            onChange={setWho}
            options={[{ value: 'hoc_sinh', label: 'Học sinh' }, { value: 'giao_vien', label: 'Giáo viên' }, { value: 'nha_truong', label: 'Nhà trường' }]}
          />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          {AUDIENCE[who].map((b, i) => (
            <BenefitCard key={`${who}-${b.title}`} item={b} tone={(['dong', 'ngoc', 'thuy', 'thong'] as const)[i % 4]} />
          ))}
        </View>
      </Band>

      <Band id="de-tai" wide={wide}>
        <Head eyebrow="Về đề tài" title="Nghiên cứu và phát triển" wide={wide} />
        <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'stretch', gap: 16 }}>
          <Card pad={22} style={{ flex: wide ? 1 : undefined, gap: 14 }}>
            <Txt f="bold" size={13} color={c.sonChu} upper>
              Tên đề tài
            </Txt>
            <Txt f="serifBold" size={21} style={{ lineHeight: 30 }}>
              Nghiên cứu và phát triển nền tảng học tập game hóa hỗ trợ khám phá lịch sử ba lần kháng chiến chống Nguyên – Mông thời Trần
            </Txt>
            <Txt f="bold" size={13} color={c.muc2} upper>
              Mục tiêu
            </Txt>
            <View style={{ gap: 10 }}>
              {GOALS.map((g) => (
                <View key={g} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  <View style={{ marginTop: 3 }}>
                    <Check size={18} color={c.ngocChu} strokeWidth={3} />
                  </View>
                  <Txt size={15} color={c.muc2} style={{ flex: 1 }}>
                    {g}
                  </Txt>
                </View>
              ))}
            </View>
          </Card>
          <View style={{ flex: wide ? 1 : undefined, gap: 12 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {TECH.map((t, i) => (
                <Card key={t.title} flat pad={14} style={{ flexGrow: 1, flexBasis: 200, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <IconBox icon={t.icon} tone={(['dong', 'ngoc', 'thuy', 'thong', 'son', 'vang'] as const)[i]} size={44} />
                  <View style={{ flex: 1 }}>
                    <Txt f="displayHeavy" size={17}>
                      {t.title}
                    </Txt>
                    <Txt size={13} color={c.muc2}>
                      {t.text}
                    </Txt>
                  </View>
                </Card>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <Txt f="bold" size={14} color={c.muc2}>
                Học trên mọi thiết bị:
              </Txt>
              <Chip text="Trình duyệt web" icon={Monitor} bg={c.thuyNhat} fg={c.thuyChu} />
              <Chip text="Android" icon={Smartphone} bg={c.ngocNhat} fg={c.ngocChu} />
              <Chip text="iPhone, iPad" icon={Tablet} bg={c.thongNhat} fg={c.thongChu} />
            </View>
          </View>
        </View>
      </Band>

      <Band id="nha-truong" bg={c.giay2} wide={wide}>
        <Head eyebrow="Dành cho nhà trường" title="Cấp tài khoản hàng loạt bằng Excel" wide={wide} />
        <Card pad={22} style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <IconBox icon={FileSpreadsheet} tone="ngoc" />
            <View style={{ flex: 1, minWidth: 220 }}>
              <Txt f="displayHeavy" size={22} accessibilityRole="header">
                File Excel mẫu cấp tài khoản
              </Txt>
              <Txt size={14} color={c.muc2}>
                Nhà trường tải về (không cần đăng nhập), điền danh sách giáo viên, học sinh rồi gửi cho quản trị trường để cấp tài khoản hàng loạt.
              </Txt>
            </View>
            <Btn title="Tải file mẫu (.xlsx)" icon={Download} tone="ngoc" onPress={downloadTemplate} testID="home-template" />
          </View>
          <TemplateGuide />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {([6, 7, 8, 9] as const).map((g) => (
              <GradeBadge key={g} grade={g} size={30} showName />
            ))}
          </View>
        </Card>
      </Band>

      <Band gradient={[c.son, c.sonDam]} wide={wide}>
        <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: wide ? 32 : 16 }}>
          <Mascot size={wide ? 150 : 110} mood="love" accessory="crown" bob />
          <View style={{ flexShrink: 1, gap: 12, alignItems: wide ? 'flex-start' : 'center' }}>
            <Txt f="displayHeavy" size={wide ? 34 : 26} color="#ffffff" center={!wide} accessibilityRole="header">
              Sẵn sàng ra trận cùng quân dân nhà Trần?
            </Txt>
            <Txt size={16} color="#ffffff" center={!wide} style={{ maxWidth: 520 }}>
              Đăng nhập bằng tài khoản nhà trường cấp và bắt đầu từ Điền Trang của em.
            </Txt>
            <Btn title="Vào học ngay" icon={Play} tone="vang" size="lg" onPress={() => router.push('/portal')} testID="home-portal-bottom" />
          </View>
        </View>
      </Band>

      <View style={{ backgroundColor: c.muc, paddingBottom: insets.bottom }}>
        <View style={{ width: '100%', maxWidth: MAX_W, alignSelf: 'center', paddingHorizontal: 16, paddingTop: wide ? 40 : 28, paddingBottom: 16, gap: 24 }}>
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 40 : 24 }}>
            <View style={{ flex: wide ? 1.6 : undefined, gap: 12 }}>
              <BrandLogo subtitle="Học Sử qua game" light />
              <Txt size={14} color={c.vien} style={{ maxWidth: 440 }}>
                Đề tài khóa luận tốt nghiệp: nghiên cứu và phát triển nền tảng học tập game hóa hỗ trợ khám phá lịch sử ba lần kháng chiến chống Nguyên – Mông thời Trần.
              </Txt>
            </View>
            {WEB && (
              <View style={{ flex: wide ? 1 : undefined }}>
                <Txt f="displayHeavy" size={17} color="#ffffff" accessibilityRole="header">
                  Khám phá
                </Txt>
                {NAV.map((n) => (
                  <FootLink key={n.id} label={n.label} onPress={() => go(n.id)} />
                ))}
              </View>
            )}
            <View style={{ flex: wide ? 1 : undefined }}>
              <Txt f="displayHeavy" size={17} color="#ffffff" accessibilityRole="header">
                Truy cập
              </Txt>
              <FootLink label="Đăng nhập học tập" onPress={() => router.push('/portal')} />
              <FootLink label="Tải file Excel mẫu" onPress={downloadTemplate} />
            </View>
          </View>
          <Txt f="semibold" size={12} color={c.vien2} center style={{ borderTopWidth: 2, borderTopColor: c.dich, paddingTop: 14 }}>
            © Đông A EDU · Lịch sử và Địa lí – Ba lần kháng chiến chống quân xâm lược Mông – Nguyên
          </Txt>
        </View>
      </View>
    </Screen>
  );
}
