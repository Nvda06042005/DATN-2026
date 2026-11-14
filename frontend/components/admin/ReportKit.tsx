/**
 * Thành phần chung của các dashboard báo cáo (yêu cầu 14/11/2026): Thống kê trường (Lớp và học sinh, Kết quả, Sử dụng và AI) và Thống kê lớp của giáo viên.
 * Cùng bố cục với trang Tổng quan (SchoolDashboard): tiêu đề hai nửa, nút xuất và làm mới bên phải; một hàng lọc phía trên các biểu đồ; thẻ bo góc phẳng.
 * Khoảng thời gian chọn nhanh theo năm học đang chạy của trường (Học kỳ 1, Học kỳ 2, Cả năm học) hoặc số ngày gần nhất; "Tùy chọn" mở hai ô lịch.
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import type { Period } from '@/api/analyticsApi';
import { CalendarInput, DownloadButton } from '@/components/admin/kit';
import { Pill } from '@/components/admin/SystemDashboard';
import { Btn, Card, InfoNote, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { splitTitle } from '@/lib/title-split';
import type { YearItem } from '@/types/api';

/** Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD */
export const vnToday = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => new Date(Date.parse(day) + n * 86_400_000).toISOString().slice(0, 10);
/** 2026-09-05 → 05/09/2026 */
export const dmy = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;

export type PresetId = 'term1' | 'term2' | 'year' | 'd30' | 'd90' | 'all' | 'custom';
interface Preset { id: PresetId; label: string; from?: string; to?: string }

/** Năm học dùng cho mốc chọn nhanh: năm đang hoạt động, nếu không có thì năm chứa ngày hôm nay */
export const currentYear = (years: YearItem[] | null | undefined): YearItem | null => {
  if (!years?.length) return null;
  const today = vnToday();
  return years.find((y) => y.status === 'active') ?? years.find((y) => y.starts_on <= today && today <= y.ends_on) ?? null;
};

/**
 * Bộ chọn khoảng thời gian. `years`: danh sách năm học của trường (`undefined` là đang tải, `null` là không có quyền xem năm học, ví dụ giáo viên).
 * `ready` chỉ bật khi đã biết các mốc, để số liệu không tải hai lần (lần đầu "Tất cả", lần sau "Cả năm học").
 */
export function usePeriodPicker(years: YearItem[] | null | undefined, idPrefix: string) {
  const { c } = useTheme();
  const today = vnToday();
  const year = currentYear(years);
  const presets: Preset[] = [];
  if (year?.term1_starts_on && year.term1_ends_on) presets.push({ id: 'term1', label: 'Học kỳ 1', from: year.term1_starts_on, to: year.term1_ends_on });
  if (year?.term2_starts_on && year.term2_ends_on) presets.push({ id: 'term2', label: 'Học kỳ 2', from: year.term2_starts_on, to: year.term2_ends_on });
  if (year) presets.push({ id: 'year', label: 'Cả năm học', from: year.starts_on, to: year.ends_on });
  presets.push({ id: 'd30', label: '30 ngày', from: addDays(today, -29), to: today }, { id: 'd90', label: '90 ngày', from: addDays(today, -89), to: today }, { id: 'all', label: 'Tất cả' });
  const [picked, setPicked] = useState<PresetId | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const ready = years !== undefined;
  const id: PresetId = picked ?? (year ? 'year' : 'all');
  const preset = presets.find((p) => p.id === id) ?? presets[presets.length - 1];
  const badRange = id === 'custom' && !!from && !!to && from > to;
  const period: Period = id === 'custom' ? (badRange ? {} : { from: from || undefined, to: to || undefined }) : { from: preset.from, to: preset.to };
  const named = preset.id === 'year' && year ? `Năm học ${year.label}` : (preset.id === 'term1' || preset.id === 'term2') && year ? `${preset.label} · năm học ${year.label}` : `${preset.label} gần nhất`;
  const label = id === 'custom'
    ? (period.from || period.to ? `Từ ${period.from ? dmy(period.from) : '…'} đến ${period.to ? dmy(period.to) : 'nay'}` : 'Tất cả thời gian')
    : preset.from && preset.to ? `${named} (${dmy(preset.from)} – ${dmy(preset.to)})` : 'Tất cả thời gian';
  const bar = (
    <View style={{ gap: 8 }}>
      <View accessibilityRole="tablist" accessibilityLabel="Khoảng thời gian" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <Txt size={12} f="semibold" color={c.muc2}>Thời gian:</Txt>
        {presets.map((p) => <Pill key={p.id} testID={`${idPrefix}-period-${p.id}`} label={p.label} on={id === p.id} onPress={() => setPicked(p.id)} accessibilityLabel={p.from ? `${p.label}, ${dmy(p.from)} đến ${dmy(p.to!)}` : p.label} />)}
        <Pill testID={`${idPrefix}-period-custom`} label="Tùy chọn" on={id === 'custom'} onPress={() => setPicked('custom')} accessibilityLabel="Chọn khoảng thời gian trên lịch" />
      </View>
      {id === 'custom' ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <View style={{ flexBasis: 200, flexGrow: 0 }}><CalendarInput def={{ name: `${idPrefix}-from`, label: 'Từ ngày', type: 'date', max: to || today }} label="Từ ngày" value={from} error={badRange ? 'Từ ngày phải trước Đến ngày' : null} onChange={setFrom} /></View>
          <View style={{ flexBasis: 200, flexGrow: 0 }}><CalendarInput def={{ name: `${idPrefix}-to`, label: 'Đến ngày', type: 'date', min: from || undefined }} label="Đến ngày" value={to} error={null} onChange={setTo} /></View>
        </View>
      ) : null}
    </View>
  );
  return { period, label, bar, ready, id };
}

/** Khung một trang dashboard: tiêu đề hai nửa (như Thống kê trường), dòng mô tả, nút bên phải; một hàng lọc; nội dung cuộn */
export function ReportShell({ testID, title, subtitle, actions, filters, children }: { testID: string; title: string; subtitle: string; actions?: React.ReactNode; filters?: React.ReactNode; children: React.ReactNode }) {
  const { c } = useTheme();
  const [head, tail] = splitTitle(title);
  return (
    <ScrollView testID={testID} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: 10, paddingBottom: 16, gap: 8, width: '100%', maxWidth: 1680, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flexShrink: 1, minWidth: 220 }}>
          <Txt f="displayHeavy" size={22} color={c.logoInk} accessibilityRole="header" style={{ lineHeight: 28 }}>{head} {tail ? <Txt f="serifItalic" size={22} color={c.logoRed} style={{ lineHeight: 28 }}>{tail}</Txt> : null}</Txt>
          <Txt size={12} color={c.muc3}>{subtitle}</Txt>
        </View>
        {actions ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>{actions}</View> : null}
      </View>
      {filters ? <Card flat pad={10} style={{ borderRadius: 12, gap: 8 }}>{filters}</Card> : null}
      {children}
    </ScrollView>
  );
}

/** Hai nút xuất báo cáo (bố cục chính thức như file xuất Giáo viên / Học sinh / Lớp học) và nút làm mới */
export function ReportActions({ excel, pdf, filename, onRefresh, busy, idPrefix }: { excel?: () => Promise<Blob>; pdf?: () => Promise<Blob>; filename: string; onRefresh: () => void; busy: boolean; idPrefix: string }) {
  return <>
    {excel ? <DownloadButton title="Xuất Excel" fetchBlob={excel} filename={`${filename}.xlsx`} /> : null}
    {pdf ? <DownloadButton title="Xuất PDF" fetchBlob={pdf} filename={`${filename}.pdf`} /> : null}
    <Btn title="Làm mới" icon={RefreshCw} tone="giay" size="sm" onPress={onRefresh} loading={busy} testID={`${idPrefix}-refresh`} />
  </>;
}

/** Thẻ của dashboard: tiêu đề nhỏ, ghi chú bên phải */
export function Panel({ title, note, right, children, testID, style }: { title: string; note?: string; right?: React.ReactNode; children: React.ReactNode; testID?: string; style?: object }) {
  const { c } = useTheme();
  return (
    <Card flat pad={12} style={{ borderRadius: 12, gap: 8, minWidth: 0, ...style }} testID={testID}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: 8 }}>
        <Txt f="bold" size={14} accessibilityRole="header" style={{ flexShrink: 0 }}>{title}</Txt>
        {right ?? (note ? <Txt size={11} color={c.muc3} numberOfLines={1} style={{ flexShrink: 1 }}>{note}</Txt> : null)}
      </View>
      {children}
    </Card>
  );
}

/** Hàng thẻ chia đều (màn hình rộng) hoặc xuống dòng (màn hình hẹp) */
export function CardRow({ wide, children, basis = 300 }: { wide: boolean; children: React.ReactNode; basis?: number }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {React.Children.toArray(children).map((child, i) => <View key={i} style={{ flexGrow: 1, flexBasis: wide ? 0 : basis, minWidth: wide ? 220 : 260 }}>{child}</View>)}
  </View>;
}

/**
 * Thanh ngang so sánh (0–100%): nhãn, thanh mảnh bo đầu, số bên phải. Màu chỉ để nhận dạng, số luôn ghi bằng chữ.
 * `highlight`: dòng đang xem (chữ đậm, thanh màu đậm hơn).
 */
export function BarRow({ label, sub, value, color, highlight, max = 100, suffix = '%', testID }: { label: string; sub?: string; value: number | null; color: string; highlight?: boolean; max?: number; suffix?: string; testID?: string }) {
  const { c } = useTheme();
  const w = value == null ? 0 : Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <View testID={testID} accessible accessibilityLabel={`${label}${sub ? `, ${sub}` : ''}: ${value == null ? 'chưa có số liệu' : `${value}${suffix}`}`} style={{ gap: 3 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Txt size={12} f={highlight ? 'bold' : 'medium'} color={highlight ? c.muc : c.muc2} numberOfLines={1} style={{ flex: 1 }}>{label}{sub ? <Txt size={11} color={c.muc3}> · {sub}</Txt> : null}</Txt>
        <Txt f="bold" size={13}>{value == null ? '–' : `${value}${suffix}`}</Txt>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: c.adminLine }}>
        {w > 0 ? <View style={{ width: `${w}%`, height: 6, borderRadius: 3, backgroundColor: color, opacity: highlight === false ? 0.55 : 1 }} /> : null}
      </View>
    </View>
  );
}

/** Lâu chưa tải xong (máy chủ miễn phí khởi động lại sau khi nghỉ): báo rõ và cho thử lại thay vì chỉ hiện "Đang tải…" */
export function SlowNote({ loading, onRetry, after = 10_000 }: { loading: boolean; onRetry: () => void; after?: number }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!loading) { setSlow(false); return undefined; }
    const t = setTimeout(() => setSlow(true), after);
    return () => clearTimeout(t);
  }, [loading, after]);
  if (!slow) return null;
  return (
    <InfoNote>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <Txt size={13} style={{ flex: 1, minWidth: 220 }}>Máy chủ đang khởi động hoặc đang bận (máy chủ tạm nghỉ khi ít người dùng, lần mở đầu tiên có thể mất 30–60 giây). Số liệu sẽ tự hiện khi tải xong.</Txt>
        <Btn title="Thử lại" icon={RefreshCw} tone="giay" size="sm" onPress={onRetry} testID="report-retry" />
      </View>
    </InfoNote>
  );
}
