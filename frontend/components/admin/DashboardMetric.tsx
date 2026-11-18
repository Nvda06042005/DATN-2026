import { ChevronRight } from 'lucide-react-native';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Card, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fmt } from '@/lib/format';
import type { IconType } from '@/types/game';

export function DashboardMetric({ label, value, hint, icon: Icon, color, background, compact = false, onPress, testID, fill = false }: {
  label: string; value: number | string; hint: string; icon: IconType; color: string; background: string;
  /** Ô gọn một hàng ngang (trang tổng quan vừa một màn hình): nhãn, số lớn và chú thích ngắn cạnh số */
  compact?: boolean;
  /** Bấm ô để xem danh sách cụ thể (18/11/2026) */
  onPress?: () => void;
  testID?: string;
  /** (nội bộ) thẻ nằm trong nút bấm: chỉ lấp đầy nút, không đặt flexBasis (trong nút là chiều dọc) */
  fill?: boolean;
}) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const text = typeof value === 'number' ? fmt(value) : value;
  if (compact) {
    const showIcon = width >= 1400 || width < 1240;
    if (onPress) return <Pressable onPress={onPress} testID={testID} accessibilityRole="button" accessibilityLabel={`${label}: ${text}. ${hint}. Bấm để xem danh sách`}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({ flexGrow: 1, flexBasis: width >= 1240 ? 150 : width >= 650 ? 230 : '45%', minWidth: 130, opacity: pressed ? 0.85 : 1, transform: [{ translateY: hovered ? -1 : 0 }] })}>
      <DashboardMetric label={label} value={value} hint={hint} icon={Icon} color={color} background={background} compact fill />
    </Pressable>;
    return <Card flat pad={9} style={{ ...(fill ? { flexGrow: 1 } : { flexGrow: 1, flexBasis: width >= 1240 ? 150 : width >= 650 ? 230 : '45%', minWidth: 130 }), borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {showIcon ? <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: background, alignItems: 'center', justifyContent: 'center' }}><Icon size={18} color={color} /></View> : null}
      <View accessible accessibilityLabel={`${label}: ${text}. ${hint}`} style={{ flex: 1, minWidth: 0 }}>
        <Txt size={11} f="semibold" color={c.muc2} numberOfLines={width < 650 ? 2 : 1}>{label}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
          <Txt size={22} f="displayHeavy" color={c.muc} style={{ lineHeight: 28 }}>{text}</Txt>
          {hint ? <Txt size={11} color={c.muc3} numberOfLines={1} style={{ flexShrink: 1 }}>{hint}</Txt> : null}
        </View>
      </View>
      {fill ? <ChevronRight size={16} color={c.muc3} /> : null}
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
