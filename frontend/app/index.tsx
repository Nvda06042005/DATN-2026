/** Trang chủ: chọn vai trò (học sinh, giáo viên, quản trị). expo-router bắt buộc tên index cho đường dẫn "/". */
import { View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { GraduationCap, Presentation, ShieldCheck } from 'lucide-react-native';
import { BrandLogo, Mascot } from '@/components/art';
import { PORTAL_PATH, useDocumentTitle } from '@/components/auth';
import { Btn, Card, Screen, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { webHref } from '@/lib/format';
import type { IconType } from '@/types/game';

const PortalCard: React.FC<{ title: string; text: string; cta: string; icon: IconType; color: string; edge: string; tone: 'son' | 'ngoc'; onPress: () => void; path: string }> = ({
  title, text, cta, icon: Icon, color, edge, tone, onPress, path,
}) => {
  const { c } = useTheme();
  const href = webHref(path);
  return (
    <Card pad={22} style={{ flex: 1, minWidth: 260, gap: 14 }}>
      <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: color, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 5, borderBottomColor: edge }}>
        <Icon size={36} color="#ffffff" />
      </View>
      <View style={{ gap: 4 }}>
        <Txt f="displayHeavy" size={24}>
          {title}
        </Txt>
        <Txt color={c.muc2}>{text}</Txt>
      </View>
      <Btn title={cta} tone={tone} full onPress={onPress} />
      {href && (
        <Txt f="semibold" size={12} color={c.muc2} center>
          {href.replace(/^https?:\/\//, '')}
        </Txt>
      )}
    </Card>
  );
};

export default function HomeChooser() {
  const { c } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  useDocumentTitle('Đông A – Học Sử vui như chơi');
  return (
    <Screen maxWidth={980}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <BrandLogo subtitle="Học Sử qua game" />
        <Btn tone="giay" size="sm" icon={ShieldCheck} title={wide ? 'Quản trị' : undefined} label="Trang quản trị" onPress={() => router.push(PORTAL_PATH.admin)} />
      </View>
      <View style={{ flexDirection: wide ? 'row' : 'column-reverse', alignItems: 'center', gap: 16, paddingTop: wide ? 24 : 0 }}>
        <View style={{ flex: wide ? 1 : undefined, gap: 10 }}>
          <Txt f="bold" size={13} color={c.sonChu} upper center={!wide}>
            Lịch sử 7 · 1258 – 1288
          </Txt>
          <Txt f="displayHeavy" size={wide ? 56 : 40} center={!wide} accessibilityRole="header">
            Hào Khí Đông A
          </Txt>
          <Txt size={17} color={c.muc2} center={!wide}>
            Xây Điền Trang, chiêu mộ danh tướng nhà Trần và ra trận theo đúng kế sách của ông cha – mỗi sức mạnh đều đến từ một câu trả lời đúng.
          </Txt>
        </View>
        <Mascot size={wide ? 180 : 150} accessory="helmet" mood="excited" bob />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <PortalCard
          title="Học sinh"
          text="Vào Điền Trang: thu lương thảo, chiêu mộ tướng, đánh 3 màn chiến dịch và hỏi Quân Sư AI."
          cta="Vào trang học sinh"
          icon={GraduationCap}
          color={c.son}
          edge={c.sonDam}
          tone="son"
          path={PORTAL_PATH.student}
          onPress={() => router.push(PORTAL_PATH.student)}
        />
        <PortalCard
          title="Giáo viên"
          text="Theo dõi tiến độ, câu sai nhiều nhất và mức nắm vững của cả lớp; tổ chức thi đấu và soạn đề bằng AI."
          cta="Vào trang giáo viên"
          icon={Presentation}
          color={c.ngoc}
          edge={c.ngocDam}
          tone="ngoc"
          path={PORTAL_PATH.teacher}
          onPress={() => router.push(PORTAL_PATH.teacher)}
        />
      </View>
      <Btn tone="ghost" icon={ShieldCheck} title="Quản trị viên nhà trường? Vào trang quản trị" onPress={() => router.push(PORTAL_PATH.admin)} style={{ alignSelf: 'center' }} />
      <Txt f="semibold" size={12} color={c.muc2} center style={{ borderTopWidth: 2, borderTopColor: c.vien, paddingTop: 14 }}>
        © Đông A EDU · Lịch sử và Địa lí 7 – Ba lần kháng chiến chống quân xâm lược Mông – Nguyên
      </Txt>
    </Screen>
  );
}
