import { View, useWindowDimensions } from 'react-native';
import { Card, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fmt } from '@/lib/format';
import type { IconType } from '@/types/game';

export function DashboardMetric({ label, value, hint, icon: Icon, color, background }: {
  label: string; value: number | string; hint: string; icon: IconType; color: string; background: string;
}) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const text = typeof value === 'number' ? fmt(value) : value;
  return <Card flat pad={18} style={{ flexGrow: 1, flexBasis: width < 650 ? '45%' : 190, minWidth: 130, borderRadius: 12, gap: 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <Txt size={12} f="semibold" color={c.muc2} style={{ flex: 1 }}>{label}</Txt>
      <View style={{ width: 37, height: 37, borderRadius: 10, backgroundColor: background, alignItems: 'center', justifyContent: 'center' }}><Icon size={19} color={color} /></View>
    </View>
    <View accessible accessibilityLabel={`${label}: ${text}. ${hint}`} style={{ gap: 3 }}>
      <Txt size={typeof value === 'string' ? 24 : 31} f="displayHeavy" color={c.muc}>{text}</Txt>
      <Txt size={11} color={c.muc3}>{hint}</Txt>
    </View>
  </Card>;
}
