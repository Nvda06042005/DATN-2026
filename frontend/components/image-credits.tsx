import { useRef } from 'react';
import { Linking, Pressable, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { HeroPhotoCredit } from '@/components/hero-photo';
import { Band, GoldRings, PAPER_CARD } from '@/components/home';
import { InfoShell } from '@/components/info-page';
import { SectionHeading } from '@/components/section-heading';
import { Txt } from '@/components/ui';
import { HEROES } from '@/constants/heroes';
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
        <View testID="map-image-credits" style={[{ gap: 8, padding: wide ? 28 : 20, borderWidth: 1, borderRadius: 28 }, PAPER_CARD]}>
          <Txt f="heavy" size={wide ? 24 : 20} color={c.logoInk} accessibilityRole="header">Bản đồ ba lần kháng chiến</Txt>
          <Txt color={c.logoInk}>Tác giả: Lưu Ly · Phạm vi công cộng · Bản hiển thị được thu nhỏ và chuyển WebP.</Txt>
          {MAP_IMAGE_CREDITS.map((map) => (
            <Pressable key={map.id} accessibilityRole="link" accessibilityLabel={`Nguồn bản đồ kháng chiến lần ${map.id} trên Wikipedia`} onPress={() => { void Linking.openURL(map.url); }} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Txt color={c.logoRed} style={{ textDecorationLine: 'underline' }}>Bản đồ kháng chiến lần {map.id} ({map.years}) · Wikipedia ↗</Txt>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
          {HEROES.map((hero) => (
            <View key={hero.id} style={[{ flexBasis: wide ? '47%' : '100%', flexGrow: 1, gap: 8, padding: wide ? 28 : 20, borderWidth: 1, borderRadius: 28 }, PAPER_CARD]}>
              <Txt f="bold" size={20} color={c.logoInk} accessibilityRole="header">{hero.name}</Txt>
              <HeroPhotoCredit id={hero.id} />
            </View>
          ))}
        </View>
      </View>
    </Band>
  );
}
