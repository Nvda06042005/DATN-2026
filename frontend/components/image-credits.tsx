import { Linking, Pressable, View } from 'react-native';
import { HeroPhotoCredit } from '@/components/hero-photo';
import { Band } from '@/components/home';
import { Txt } from '@/components/ui';
import { HEROES } from '@/constants/heroes';
import { MAP_IMAGE_CREDITS } from '@/constants/map-credits';
import { useTheme } from '@/hooks/use-theme';

/** Ghi công hình ảnh được giữ trong trang điều khoản khi bỏ trang thông tin riêng. */
export function ImageCredits() {
  const { c } = useTheme();
  return (
    <Band id="thong-tin-hinh-anh" bg={c.logoPaper} wide={false}>
      <View style={{ gap: 24 }}>
        <Txt f="heavy" size={28} color={c.logoInk} accessibilityRole="header">Thông tin hình ảnh</Txt>
        <View testID="map-image-credits" style={{ gap: 8 }}>
          <Txt f="bold" size={20} color={c.logoInk}>Bản đồ ba lần kháng chiến</Txt>
          <Txt color={c.logoInk}>Tác giả: Lưu Ly · Phạm vi công cộng · Bản hiển thị được thu nhỏ và chuyển WebP.</Txt>
          {MAP_IMAGE_CREDITS.map((map) => (
            <Pressable key={map.id} accessibilityRole="link" accessibilityLabel={`Nguồn bản đồ kháng chiến lần ${map.id} trên Wikipedia`} onPress={() => { void Linking.openURL(map.url); }} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Txt color={c.logoRed} style={{ textDecorationLine: 'underline' }}>Bản đồ kháng chiến lần {map.id} ({map.years}) · Wikipedia ↗</Txt>
            </Pressable>
          ))}
        </View>
        {HEROES.map((hero) => (
          <View key={hero.id} style={{ gap: 8 }}>
            <Txt f="bold" size={20} color={c.logoInk}>{hero.name}</Txt>
            <HeroPhotoCredit id={hero.id} />
          </View>
        ))}
      </View>
    </Band>
  );
}
