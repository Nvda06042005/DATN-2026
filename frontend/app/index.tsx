/**
 * Trang chủ công khai: giới thiệu, đăng nhập học tập (/portal) cho giáo viên và học sinh, tải file Excel mẫu cấp tài khoản (không cần đăng nhập).
 * Không có liên kết tới hai cổng quản trị. expo-router bắt buộc tên index cho đường dẫn "/".
 */
import { View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Download, FileSpreadsheet, GraduationCap, LogIn, Presentation } from 'lucide-react-native';
import { BrandLogo, GradeBadge, Mascot } from '@/components/art';
import { useDocumentTitle } from '@/components/auth';
import { TemplateGuide, downloadTemplate } from '@/components/provisioning';
import { Btn, Card, Screen, Txt } from '@/components/ui';
import { onFill } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { webHref } from '@/lib/format';
import type { IconType } from '@/types/game';

const RoleCard: React.FC<{ title: string; text: string; icon: IconType; color: string; edge: string }> = ({ title, text, icon: Icon, color, edge }) => {
  const { c } = useTheme();
  return (
    <Card pad={22} style={{ flex: 1, minWidth: 260, gap: 12 }}>
      <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: color, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 5, borderBottomColor: edge }}>
        <Icon size={36} color={onFill(c, color)} />
      </View>
      <Txt f="displayHeavy" size={24}>
        {title}
      </Txt>
      <Txt color={c.muc2}>{text}</Txt>
    </Card>
  );
};

export default function Home() {
  const { c } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const portalHref = webHref('/portal');
  useDocumentTitle('Đông A – Học Sử vui như chơi');
  return (
    <Screen maxWidth={980}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <BrandLogo subtitle="Học Sử qua game" />
        <Btn tone="giay" size="sm" icon={LogIn} title={wide ? 'Đăng nhập' : undefined} label="Đăng nhập học tập" onPress={() => router.push('/portal')} />
      </View>
      <View style={{ flexDirection: wide ? 'row' : 'column-reverse', alignItems: 'center', gap: 16, paddingTop: wide ? 24 : 0 }}>
        <View style={{ flex: wide ? 1 : undefined, gap: 10, alignItems: wide ? 'flex-start' : 'center' }}>
          <Txt f="bold" size={13} color={c.dongChu} upper center={!wide}>
            Lịch sử và Địa lí THCS · Khối 6 – 9
          </Txt>
          <Txt f="displayHeavy" size={wide ? 56 : 40} center={!wide} accessibilityRole="header">
            Hào Khí Đông A
          </Txt>
          <Txt size={17} color={c.muc2} center={!wide}>
            Xây Điền Trang, chiêu mộ danh tướng nhà Trần và ra trận theo đúng kế sách của ông cha – mỗi sức mạnh đều đến từ một câu trả lời đúng.
          </Txt>
          <Btn title="Đăng nhập học tập" icon={LogIn} tone="dong" size="lg" onPress={() => router.push('/portal')} testID="home-portal" />
          {portalHref && (
            <Txt f="semibold" size={12} color={c.muc2}>
              {portalHref.replace(/^https?:\/\//, '')}
            </Txt>
          )}
        </View>
        <Mascot size={wide ? 180 : 150} accessory="helmet" mood="excited" bob />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <RoleCard
          title="Học sinh"
          text="Vào Điền Trang: thu lương thảo, chiêu mộ tướng, đánh 3 màn chiến dịch, đi Hành Trình Đông A và hỏi Quân Sư AI. Vào lớp bằng mã lớp thầy cô phát."
          icon={GraduationCap}
          color={c.son}
          edge={c.sonDam}
        />
        <RoleCard
          title="Giáo viên"
          text="Theo dõi tiến độ, câu sai nhiều nhất và mức nắm vững của cả lớp; xin mở lớp, tổ chức thi đấu trực tiếp và soạn đề bằng AI."
          icon={Presentation}
          color={c.ngoc}
          edge={c.ngocDam}
        />
      </View>
      <Card pad={22} style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: c.ngoc, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 5, borderBottomColor: c.ngocDam }}>
            <FileSpreadsheet size={30} color={onFill(c, c.ngoc)} />
          </View>
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
      <Txt f="semibold" size={12} color={c.muc2} center style={{ borderTopWidth: 2, borderTopColor: c.vien, paddingTop: 14 }}>
        © Đông A EDU · Lịch sử và Địa lí – Ba lần kháng chiến chống quân xâm lược Mông – Nguyên
      </Txt>
    </Screen>
  );
}
