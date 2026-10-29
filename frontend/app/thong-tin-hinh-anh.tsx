import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useDocumentTitle } from '@/components/auth';
import { HeroPhotoCredit } from '@/components/hero-photo';
import { Txt } from '@/components/ui';
import { HEROES } from '@/constants/heroes';
import { useTheme } from '@/hooks/use-theme';

/** Image credits live here so the historical profiles stay focused on their content. */
export default function ImageInformation() {
  const { c } = useTheme();
  const router = useRouter();
  useDocumentTitle('Thông tin hình ảnh – Đông A');
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.logoPaper }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={{ width: '100%', maxWidth: 860, alignSelf: 'center', gap: 24 }}>
          <Pressable accessibilityRole="link" accessibilityLabel="Về trang chủ" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', opacity: pressed ? 0.7 : 1 })}>
            <Txt f="bold" color={c.logoRed}>← Về trang chủ</Txt>
          </Pressable>
          <Txt f="heavy" size={32} color={c.logoInk} accessibilityRole="header">Thông tin hình ảnh</Txt>
          <Txt color={c.logoInk} style={{ lineHeight: 24 }}>Tác giả, nguồn và giấy phép của các hình ảnh trong thư viện lịch sử.</Txt>
          {HEROES.map(hero => (
            <View key={hero.id} testID={`image-credit-${hero.id}`} style={{ gap: 8, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: c.logoGold, backgroundColor: c.the }}>
              <Txt f="bold" size={20} color={c.logoInk} accessibilityRole="header">{hero.name}</Txt>
              <HeroPhotoCredit id={hero.id} />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
