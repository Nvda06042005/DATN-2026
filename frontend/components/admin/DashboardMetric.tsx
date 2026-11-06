import { View, useWindowDimensions } from 'react-native';
import { Card, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fmt } from '@/lib/format';
import type { IconType } from '@/types/game';

export function DashboardMetric({ label, value, hint, icon: Icon, color, background, compact = false }: {
  label: string; value: number | string; hint: string; icon: IconType; color: string; background: string;
  /** Ô gọn một hàng ngang (trang tổng quan vừa một màn hình): nhãn, số lớn và chú thích ngắn cạnh số */
  compact?: boolean;
}) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const text = typeof value === 'number' ? fmt(value) : value;
  if (compact) {
    return <Card flat pad={9} style={{ flexGrow: 1, flexBasis: width >= 1240 ? 150 : width >= 650 ? 230 : '45%', minWidth: 130, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: background, alignItems: 'center', justifyContent: 'center' }}><Icon size={18} color={color} /></View>
      <View accessible accessibilityLabel={`${label}: ${text}. ${hint}`} style={{ flex: 1, minWidth: 0 }}>
        <Txt size={11} f="semibold" color={c.muc2} numberOfLines={1}>{label}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
          <Txt size={22} f="displayHeavy" color={c.muc} style={{ lineHeight: 28 }}>{text}</Txt>
          {hint ? <Txt size={11} color={c.muc3} numberOfLines={1} style={{ flexShrink: 1 }}>{hint}</Txt> : null}
        </View>
      </View>
    </Card>;
  }
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
