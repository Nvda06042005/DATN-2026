import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Btn, Txt } from '@/components/ui';
import { FONT } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface TrendPoint { key: string; label: string; detail: string; values: Record<string, number | null> }
export interface TrendSeries { key: string; label: string; color: string; dashed?: boolean }
const number = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 2 });

/** Đường liền/nét đứt, trục từ 0, chọn mốc bằng chuột/chạm hoặc nút trước/sau. */
export function TrendChart({ id, data, series, unit, summary }: {
  id: string; data: TrendPoint[]; series: TrendSeries[]; unit: string; summary: string;
}) {
  const { c } = useTheme();
  const [width, setWidth] = useState(600);
  const [selected, setSelected] = useState(data.length - 1);
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => { setSelected(data.length - 1); }, [data.length, data.at(-1)?.key]);
  const shown = series.filter(s => !hidden.includes(s.key));
  const max = Math.max(1, ...data.flatMap(p => shown.map(s => p.values[s.key] ?? 0)));
  const magnitude = 10 ** Math.floor(Math.log10(max / 4));
  const step = Math.max(1, [1, 2, 5, 10].map(n => n * magnitude).find(n => n >= max / 4) ?? 1);
  const top = Math.ceil(max / step) * step;
  const height = 300, left = 36, right = width < 400 ? 16 : 24, upper = 84, bottom = 38;
  const plotWidth = Math.max(1, width - left - right), plotHeight = height - upper - bottom;
  const x = (i: number) => left + (data.length > 1 ? (i / (data.length - 1)) * plotWidth : plotWidth / 2);
  const y = (v: number) => upper + (1 - v / top) * plotHeight;
  const current = Math.max(0, Math.min(selected, data.length - 1));
  const point = data[current];
  const tooltipWidth = Math.min(246, width - 4);
  const tooltipLeft = Math.max(0, Math.min(width - tooltipWidth, x(current) - tooltipWidth / 2));
  const every = Math.max(1, Math.ceil(data.length / (width < 420 ? 4 : 7)));
  const allZero = !data.some(p => series.some(s => (p.values[s.key] ?? 0) > 0));
  if (!data.length) return <Txt color={c.muc3} size={14}>Chưa có dữ liệu trong khoảng thời gian này.</Txt>;
  return <View testID={id} style={{ gap: 8 }}>
    <View onLayout={event => setWidth(Math.max(100, event.nativeEvent.layout.width))} style={{ height, position: 'relative' }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} accessible accessibilityRole="image" accessibilityLabel={`${summary}. ${data.length} mốc thời gian. Đơn vị: ${unit}.`}>
        {Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step).map(tick => <React.Fragment key={tick}>
          <Line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke={c.adminLine} strokeWidth={1} />
          <SvgText x={left - 8} y={y(tick) + 4} textAnchor="end" fontSize={10} fontFamily={FONT.body} fill={c.muc3}>{number(tick)}</SvgText>
        </React.Fragment>)}
        {data.map((p, i) => (i % every === 0 || i === data.length - 1) && (i === data.length - 1 || i <= data.length - 1 - every / 2) ? <SvgText key={p.key} x={x(i)} y={height - 13} textAnchor="middle" fontSize={10} fontFamily={FONT.body} fill={c.muc3}>{p.label}</SvgText> : null)}
        {point && <Line x1={x(current)} x2={x(current)} y1={upper - 6} y2={height - bottom} stroke={c.muc3} strokeDasharray="3 4" opacity={0.5} />}
        {shown.map(s => {
          let previous = false;
          const path = data.map((p, i) => {
            const v = p.values[s.key];
            if (v === null || v === undefined) { previous = false; return ''; }
            const command = `${previous ? 'L' : 'M'}${x(i)},${y(v)}`;
            previous = true;
            return command;
          }).join(' ');
          return <React.Fragment key={s.key}>
            <Path d={path} fill="none" stroke={s.color} strokeWidth={2.3} strokeDasharray={s.dashed ? '5 5' : undefined} strokeLinejoin="round" strokeLinecap="round" />
            {data.map((p, i) => p.values[s.key] == null ? null : <Circle key={p.key} cx={x(i)} cy={y(p.values[s.key]!)} r={i === selected ? 4.5 : 2.7} fill={s.color} stroke={c.the} strokeWidth={1.5} />)}
          </React.Fragment>;
        })}
      </Svg>
      {data.map((p, i) => {
        const half = plotWidth / Math.max(1, data.length - 1) / 2;
        const start = data.length === 1 ? left : Math.max(left, x(i) - half);
        const end = data.length === 1 ? width - right : Math.min(width - right, x(i) + half);
        return <Pressable key={p.key} testID={`${id}-point-${i}`} accessible={false} onHoverIn={() => setSelected(i)} onPress={() => setSelected(i)}
          style={{ position: 'absolute', top: upper - 6, height: plotHeight + 12, left: start, width: end - start }} />;
      })}
      {point && <View pointerEvents="none" testID={`${id}-tooltip`} accessibilityLiveRegion="polite" style={{ position: 'absolute', top: 0, left: tooltipLeft, width: tooltipWidth, backgroundColor: '#202b35', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 7, gap: 2 }}>
        <Txt size={11} f="bold" color="#ffffff">{point.detail}</Txt>
        {shown.map(s => <Txt key={s.key} size={11} color="#ffffff">{s.label}: <Txt f="bold" size={11} color="#ffffff">{point.values[s.key] == null ? 'Chưa đủ 7 ngày' : number(point.values[s.key]!)}{point.values[s.key] == null ? '' : ` ${unit}`}</Txt></Txt>)}
      </View>}
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      {series.map(s => <Pressable key={s.key} testID={`${id}-legend-${s.key}`} accessibilityRole="button" accessibilityLabel={`${s.label}, ${hidden.includes(s.key) ? 'đang ẩn' : 'đang hiện'}`} accessibilityState={{ selected: !hidden.includes(s.key) }}
        onPress={() => setHidden(v => v.includes(s.key) ? v.filter(k => k !== s.key) : shown.length > 1 ? [...v, s.key] : v)}
        style={{ minHeight: 44, paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: hidden.includes(s.key) ? 0.45 : 1 }}>
        <View style={{ width: 19, borderTopColor: s.color, borderTopWidth: 2, borderStyle: s.dashed ? 'dashed' : 'solid' }} />
        <Txt size={11} color={c.muc2}>{s.label}</Txt>
      </Pressable>)}
      <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 4 }}>
        <Btn label="Mốc trước" icon={ChevronLeft} tone="ghost" size="sm" disabled={selected <= 0} onPress={() => setSelected(i => Math.max(0, i - 1))} testID={`${id}-previous`} />
        <Btn label="Mốc sau" icon={ChevronRight} tone="ghost" size="sm" disabled={selected >= data.length - 1} onPress={() => setSelected(i => Math.min(data.length - 1, i + 1))} testID={`${id}-next`} />
      </View>
    </View>
    {allZero && <Txt size={12} color={c.muc3}>Chưa có hoạt động trong khoảng thời gian này.</Txt>}
  </View>;
}
