import { useRef } from 'react';
import { Linking, Pressable, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { Band, GoldRings, PAPER_CARD } from '@/components/home';
import { InfoShell } from '@/components/info-page';
import { SectionHeading } from '@/components/section-heading';
import { Txt } from '@/components/ui';
import { MAP_IMAGE_CREDITS } from '@/constants/map-credits';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useTheme } from '@/hooks/use-theme';

/** Trang ghi công riêng, dùng cùng nền, phông chữ, header và footer với Điều khoản sử dụng. */
export function ImageCreditsPage() {
  const scroll = useRef<ScrollViewInstance>(null);
  useDocumentTitle('Thông tin hình ảnh – Đông A');
  return (
    <InfoShell active="credits" scrollRef={scroll}>
      <ImageCredits />
    </InfoShell>
  );
}

function ImageCredits() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  return (
    <Band id="thong-tin-hinh-anh" bg={c.logoPaper} wide={wide} padTop={wide ? 136 : 108} decor={<GoldRings />}>
      <SectionHeading eyebrow="Nguồn tư liệu" title="Thông tin" accent="hình ảnh" description="Nguồn, tác giả và giấy phép của các bản đồ và hình ảnh được sử dụng trên Đông A." wide={wide} singleLine testID="image-credits-heading" />
      <View style={{ gap: 24 }}>
        <View testID="atlas-image-credit" style={[{ gap: 8, padding: wide ? 28 : 20, borderWidth: 1, borderRadius: 28 }, PAPER_CARD]}>
          <Txt f="heavy" size={wide ? 24 : 20} color={c.logoInk} accessibilityRole="header">Bản đồ địa hình Á–Âu trong đoạn dẫn nhập</Txt>
          <Txt color={c.logoInk}>Made with Natural Earth · Tom Patterson, Nathaniel Vaughn Kelso và cộng tác viên · Public domain. Nền Cross-blended Hypsometric Tints with Shaded Relief and Water được cắt theo kinh/vĩ độ và chuyển WebP.</Txt>
          <Txt color={c.logoInk}>Các lớp tô màu, đường tiến quân và ký hiệu quân là minh họa khái quát do Đông A tạo; không phải biên giới hoặc quân số được khảo chứng. Không sử dụng ảnh từ video tham khảo.</Txt>
          <Pressable accessibilityRole="link" accessibilityLabel="Nguồn bản đồ Natural Earth" onPress={()=>void Linking.openURL('https://www.naturalearthdata.com/downloads/50m-raster-data/50m-cross-blend-hypso/')} style={{minHeight:44,justifyContent:'center'}}><Txt color={c.logoRed} style={{textDecorationLine:'underline'}}>Nguồn địa hình Natural Earth</Txt></Pressable>
        </View>
        <View testID="map-image-credits" style={[{ gap: 8, padding: wide ? 28 : 20, borderWidth: 1, borderRadius: 28 }, PAPER_CARD]}>
          <Txt f="heavy" size={wide ? 24 : 20} color={c.logoInk} accessibilityRole="header">Bản đồ ba lần kháng chiến</Txt>
          <Txt color={c.logoInk}>Tác giả: Lưu Ly · Phạm vi công cộng. Trang học sinh dùng bản gốc (thu nhỏ, chuyển WebP); trang chủ dùng tranh minh họa vẽ lại theo ba bản đồ này, giữ địa danh và hướng tiến quân, không theo tỉ lệ.</Txt>
          {MAP_IMAGE_CREDITS.map((map) => (
            <Pressable key={map.id} accessibilityRole="link" accessibilityLabel={`Nguồn bản đồ kháng chiến lần ${map.id} trên Wikipedia`} onPress={() => { void Linking.openURL(map.url); }} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Txt color={c.logoRed} style={{ textDecorationLine: 'underline' }}>Bản đồ kháng chiến lần {map.id} ({map.years}) · Wikipedia ↗</Txt>
            </Pressable>
          ))}
        </View>
        <View testID="hall-art-credit" style={[{ gap: 8, padding: wide ? 28 : 20, borderWidth: 1, borderRadius: 28 }, PAPER_CARD]}>
          <Txt f="heavy" size={wide ? 24 : 20} color={c.logoInk} accessibilityRole="header">Tranh minh họa nhân vật, danh hiệu và Bảng vàng</Txt>
          <Txt color={c.logoInk}>Tranh chibi nhân vật thời Trần, tranh năm bậc Khoa bảng, cảnh Hoàng thành, khung Bảng vàng và tranh bàn kế trận Bạch Đằng là bộ minh họa của nhóm Đông A (nhánh giao diện học sinh). Đây là hình cách điệu, không phải chân dung thật: không có chân dung đương thời nào của các nhân vật này còn lại.</Txt>
        </View>
      </View>
    </Band>
  );
}
