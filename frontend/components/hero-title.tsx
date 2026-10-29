/** Static native title; the web variant adds the Metallic Paint canvas. */
import { Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

export function HeroTitle({ wide }: { wide: boolean }) {
  const { c } = useTheme();
  const size = wide ? 96 : 50;
  return (
    <Txt testID="hero-title" f="heavy" size={size} color={c.trang} center accessibilityRole="header" style={{ lineHeight: wide ? 108 : 58, letterSpacing: wide ? -3.6 : -1.8, textShadowColor: c.den, textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 22 }}>
      Hào Khí{' '}
      <Txt f="serifItalic" size={size} color={c.sonSang} style={{ lineHeight: wide ? 108 : 58, letterSpacing: wide ? -2 : -1 }}>Đông A</Txt>
    </Txt>
  );
}

/** Native giữ chữ tĩnh; màu và phông trùng với lời mời có ánh kim trên web. */
export function ClosingTitle({ wide }: { wide: boolean }) {
  const { c } = useTheme();
  const size = wide ? 64 : 36;
  return (
    <Txt testID="closing-title" f="heavy" size={size} color={c.trang} center accessibilityRole="header" style={{ lineHeight: wide ? 70 : 42, letterSpacing: wide ? -2 : -1, textShadowColor: c.den, textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 22 }}>
      Cùng cả lớp ra trận{'\n'}với <Txt testID="closing-title-accent" f="serifItalic" size={size} color={c.sonSang} style={{ lineHeight: wide ? 70 : 42, letterSpacing: wide ? -2 : -1 }}>Đông A</Txt>!
    </Txt>
  );
}
