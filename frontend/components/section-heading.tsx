import { useState } from 'react';
import { View } from 'react-native';
import { Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

/** Six centered homepage headings: Manrope ink headline and a red Newsreader italic line. */
export function SectionHeading({ eyebrow, title, accent, description, wide, compact = false, singleLine = false, testID }: {
  eyebrow: string;
  title: string;
  accent: string;
  description?: string;
  wide: boolean;
  compact?: boolean;
  singleLine?: boolean;
  testID?: string;
}) {
  const { c } = useTheme();
  const [available, setAvailable] = useState(860);
  const base = wide && !compact ? 42 : 32;
  const size = singleLine ? Math.min(base, Math.max(14, Math.floor((available - 12) / ((title.length + accent.length + 1) * 0.62)))) : base;
  return (
    <View testID={testID} onLayout={e => setAvailable(e.nativeEvent.layout.width)} style={{ width: '100%', maxWidth: 860, alignSelf: 'center', alignItems: 'center', gap: 16 }}>
      <Txt f="bold" size={12.5} color={c.logoRed} upper center style={{ letterSpacing: 1.6, lineHeight: 18 }}>
        {eyebrow}
      </Txt>
      <Txt testID={testID ? `${testID}-text` : undefined} f="heavy" size={size} color={c.logoInk} center accessibilityRole="header" numberOfLines={singleLine ? 1 : undefined} adjustsFontSizeToFit={singleLine} style={{ width: '100%', lineHeight: size + 9, letterSpacing: -1 }}>
        {title}{singleLine ? ' ' : '\n'}
        <Txt f="serifItalic" size={size} color={c.logoRed} style={{ lineHeight: size + 9, letterSpacing: -0.5 }}>
          {accent}
        </Txt>
      </Txt>
      {description && (
        <Txt f="medium" size={16} color={c.logoInk} center style={{ width: '100%', lineHeight: 24, opacity: 0.78, maxWidth: 720 }}>
          {description}
        </Txt>
      )}
    </View>
  );
}
