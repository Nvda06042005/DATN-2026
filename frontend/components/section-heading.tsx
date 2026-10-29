import { View } from 'react-native';
import { Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

/** Shared with the homepage's FAQ typography: Manrope ink headline and a red Newsreader italic line. */
export function SectionHeading({ eyebrow, title, accent, description, wide, compact = false, testID }: {
  eyebrow: string;
  title: string;
  accent: string;
  description?: string;
  wide: boolean;
  compact?: boolean;
  testID?: string;
}) {
  const { c } = useTheme();
  const size = wide && !compact ? 42 : 32;
  return (
    <View testID={testID} style={{ width: '100%', maxWidth: 860, alignSelf: 'flex-start', gap: 16 }}>
      <Txt f="bold" size={12.5} color={c.logoRed} upper style={{ letterSpacing: 1.6, lineHeight: 18 }}>
        {eyebrow}
      </Txt>
      <Txt f="heavy" size={size} color={c.logoInk} accessibilityRole="header" style={{ lineHeight: size + 7, letterSpacing: -1 }}>
        {title}{'\n'}
        <Txt f="serifItalic" size={size} color={c.logoRed} style={{ lineHeight: size + 9, letterSpacing: -0.5 }}>
          {accent}
        </Txt>
      </Txt>
      {description && (
        <Txt f="medium" size={16} color={c.logoInk} style={{ lineHeight: 24, opacity: 0.78, maxWidth: 720 }}>
          {description}
        </Txt>
      )}
    </View>
  );
}
