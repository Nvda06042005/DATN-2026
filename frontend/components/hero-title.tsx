/** Static native title; the web variant adds the Metallic Paint canvas. */
import { Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { View } from 'react-native';
import { BrandWordmark } from '@/components/brand-wordmark';

export function HeroTitle({ wide }: { wide: boolean }) {
  const { c } = useTheme();
  const size = wide ? 96 : 50;
  return (
    <View testID="hero-title" accessible accessibilityRole="header" accessibilityLabel="Hào Khí Đông A" style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
      <Txt f="heavy" size={size} color={c.trang} style={{ lineHeight: wide ? 108 : 58, letterSpacing: wide ? -3.6 : -1.8 }}>Hào Khí</Txt>
      <BrandWordmark height={wide ? 106 : 58} color={c.sonSang} edu={false} testID="hero-title-brand" />
    </View>
  );
}

/** Native giữ chữ tĩnh; màu và phông trùng với lời mời có ánh kim trên web. */
export function ClosingTitle({ wide }: { wide: boolean }) {
  const { c } = useTheme();
  const size = wide ? 64 : 36;
  return (
    <View testID="closing-title" accessible accessibilityRole="header" accessibilityLabel="Cùng cả lớp ra trận với Đông A!" style={{ alignItems: 'center' }}>
      <Txt f="heavy" size={size} color={c.trang} center>Cùng cả lớp ra trận</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Txt f="heavy" size={size} color={c.trang}>với</Txt><BrandWordmark height={wide ? 70 : 42} color={c.sonSang} edu={false} testID="closing-title-accent" /><Txt f="heavy" size={size} color={c.trang}>!</Txt></View>
    </View>
  );
}
