import { useState } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

export type GaugeLevel = 'good' | 'ok' | 'low' | 'none';
const ARC = { good: '#258575', ok: '#b77c18', low: '#bd342b', none: '#b8bfc6' } as const;
const PIPS = 5;
const percent = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 1 });

/** Điểm trên đường tròn, góc tính từ trục ngang bên phải, ngược chiều kim đồng hồ (SVG có trục y hướng xuống). */
const point = (cx: number, cy: number, r: number, angle: number) => `${(cx + r * Math.cos(angle)).toFixed(2)} ${(cy - r * Math.sin(angle)).toFixed(2)}`;

/** Cung nửa vòng từ trái sang phải qua đỉnh, tô tới `fraction` (0–1). */
export const gaugeArc = (cx: number, cy: number, r: number, fraction: number): string => {
  const f = Math.max(0, Math.min(1, fraction));
  if (f <= 0) return '';
  return `M ${point(cx, cy, r, Math.PI)} A ${r} ${r} 0 0 1 ${point(cx, cy, r, Math.PI * (1 - f))}`;
};

/** Số ô nhỏ tô đậm trong nhãn mức (5 ô), làm tròn theo tỉ lệ. */
export const gaugePips = (value: number | null): number => (value == null ? 0 : Math.max(0, Math.min(PIPS, Math.round((value / 100) * PIPS))));

/**
 * Đồng hồ nửa vòng kèm số lớn và nhãn mức (cùng kiểu thẻ "Điểm phù hợp kỹ năng"): nhãn chữ hoa nhỏ phía trên, cung xám là nền,
 * cung màu thể hiện tỉ lệ, số lớn bên dưới, nhãn mức có 5 ô nhỏ. `value` là phần trăm 0–100; `null` là chưa có dữ liệu.
 */
export function DashboardGauge({ id, label, value, level, levelText, hint }: {
  id: string; label: string; value: number | null; level: GaugeLevel; levelText: string; hint?: string;
}) {
  const { c } = useTheme();
  const [width, setWidth] = useState(140);
  const size = Math.max(96, Math.min(190, width));
  const stroke = Math.round(size * 0.11), r = Math.round(size * 0.4), cx = size / 2, cy = r + stroke / 2 + 1;
  const tone = { good: [c.mocNhat, c.mocChu], ok: [c.vangNhat, c.vangChu], low: [c.sonNhat, c.sonChu], none: [c.dichNhat, c.dich] }[level];
  const pips = gaugePips(value);
  const text = value == null ? '—' : percent(value);
  return (
    <View testID={id} accessible accessibilityRole="image" accessibilityLabel={`${label}: ${value == null ? 'chưa có dữ liệu' : `${text} phần trăm`}. ${levelText}.${hint ? ` ${hint}` : ''}`}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ flex: 1, minWidth: 96, alignItems: 'center', gap: 4 }}>
      <Txt f="bold" size={10} color={c.muc3} center upper style={{ letterSpacing: 0.6 }} numberOfLines={2}>{label}</Txt>
      <Svg width={size} height={cy + stroke / 2 + 1} viewBox={`0 0 ${size} ${cy + stroke / 2 + 1}`}>
        <Path d={gaugeArc(cx, cy, r, 1)} fill="none" stroke={c.adminLine} strokeWidth={stroke} strokeLinecap="round" />
        {value != null && value > 0 ? <Path d={gaugeArc(cx, cy, r, value / 100)} fill="none" stroke={ARC[level]} strokeWidth={stroke} strokeLinecap="round" /> : null}
      </Svg>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <Txt f="displayHeavy" size={size >= 130 ? 28 : 24} color={c.muc} style={{ lineHeight: 32 }}>{text}</Txt>
        {value != null ? <Txt size={12} color={c.muc3}>%</Txt> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, backgroundColor: tone[0], maxWidth: '100%' }}>
        {width >= 130 ? <View style={{ flexDirection: 'row', gap: 2 }}>{Array.from({ length: PIPS }, (_, i) => <View key={i} style={{ width: 5, height: 9, borderRadius: 2, backgroundColor: i < pips ? tone[1] : c.adminLine }} />)}</View> : null}
        <Txt f="semibold" size={11} color={tone[1]} numberOfLines={1} style={{ flexShrink: 1 }}>{levelText}</Txt>
      </View>
      {hint ? <Txt size={10} color={c.muc3} center numberOfLines={2} style={Platform.OS === 'web' ? ({ textWrap: 'balance' } as object) : undefined}>{hint}</Txt> : null}
    </View>
  );
}
