/**
 * Biểu đồ đơn giản dùng chung cho thống kê (Sprint 10): ô số liệu, thanh tỉ lệ theo chủ đề, cột theo thời gian, bảng cột xếp chồng.
 * Không phụ thuộc thư viện vẽ: chỉ dùng View nên chạy giống nhau trên web và điện thoại. Mọi biểu đồ có nhãn đọc được bằng trình đọc màn hình
 * và hiện cả con số lẫn chữ (không chỉ dựa vào màu) để người khiếm sắc vẫn đọc được.
 */
import React from 'react';
import { View } from 'react-native';
import { Card, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { LEVEL_TEXT, TOPIC_TYPE_LABEL, type TopicLevel, type TopicRow, type TypeRow } from '@/types/analytics';

/** Ô số liệu: số lớn, nhãn, chú thích */
export const StatTile: React.FC<{ label: string; value: string | number | null; hint?: string; tone?: 'ngoc' | 'son' | 'thuy' | 'vang' }> = ({ label, value, hint, tone }) => {
  const { c } = useTheme();
  const color = tone === 'ngoc' ? c.ngocChu : tone === 'son' ? c.sonChu : tone === 'thuy' ? c.thuyChu : tone === 'vang' ? c.vangChu : c.muc;
  return (
    <Card flat pad={12} style={{ flexGrow: 1, flexBasis: 150, minWidth: 140, gap: 2 }}>
      <View accessible accessibilityLabel={`${label}: ${value ?? 'chưa có'}${hint ? `. ${hint}` : ''}`}>
        <Txt size={12} f="bold" color={c.muc3}>{label}</Txt>
        <Txt f="displayHeavy" size={26} color={color}>{value ?? '–'}</Txt>
        {hint ? <Txt size={12} color={c.muc3}>{hint}</Txt> : null}
      </View>
    </Card>
  );
};

export const StatGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{children}</View>;

export const levelColors = (c: ReturnType<typeof useTheme>['c'], level: TopicLevel): { fill: string; bg: string; fg: string } => (
  level === 'strong' ? { fill: c.ngoc, bg: c.ngocNhat, fg: c.ngocChu }
    : level === 'ok' ? { fill: c.thuy, bg: c.thuyNhat, fg: c.thuyChu }
    : level === 'weak' ? { fill: c.son, bg: c.sonNhat, fg: c.sonChu }
    : { fill: c.muc3, bg: c.the2, fg: c.muc2 });

/** Thanh tỉ lệ đúng của từng chủ đề; có chữ mức (Mạnh, Khá, Cần ôn…) bên cạnh con số */
export const TopicBars: React.FC<{ rows: TopicRow[]; empty: string; action?: (t: TopicRow) => React.ReactNode; showType?: boolean }> = ({ rows, empty, action, showType = true }) => {
  const { c } = useTheme();
  if (!rows.length) return <Txt size={14} color={c.muc2}>{empty}</Txt>;
  return (
    <View style={{ gap: 10 }} accessibilityRole="list">
      {rows.map((t) => {
        const col = levelColors(c, t.level);
        return (
          <View key={`${t.type}:${t.id}`} accessible={!action} accessibilityRole="progressbar" accessibilityLabel={`${t.name}, ${TOPIC_TYPE_LABEL[t.type]}: đúng ${t.percent}% trên ${t.answered} câu. ${LEVEL_TEXT[t.level]}`}
            accessibilityValue={{ min: 0, max: 100, now: t.percent }} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <Txt f="semibold" size={14} style={{ flexShrink: 1 }}>{t.name}</Txt>
              {showType ? <Txt size={12} color={c.muc3}>{TOPIC_TYPE_LABEL[t.type]}</Txt> : null}
              <View style={{ flex: 1 }} />
              <Txt f="bold" size={13} color={col.fg}>{t.percent}% · {LEVEL_TEXT[t.level]}</Txt>
            </View>
            <View style={{ height: 12, borderRadius: 6, backgroundColor: c.vien, overflow: 'hidden' }}>
              <View style={{ width: `${Math.max(2, t.percent)}%`, height: '100%', backgroundColor: col.fill, borderRadius: 6 }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Txt size={12} color={c.muc3} style={{ flexShrink: 1 }}>{t.correct}/{t.answered} câu đúng</Txt>
              {action ? <View style={{ flexDirection: 'row', gap: 6 }}>{action(t)}</View> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
};

/** Tỉ lệ đúng theo loại chủ đề (cuộc kháng chiến, nhân vật, sự kiện…): mỗi loại một thanh */
export const TypeBars: React.FC<{ rows: TypeRow[] }> = ({ rows }) => {
  const { c } = useTheme();
  const shown = rows.filter((r) => r.answered > 0);
  if (!shown.length) return <Txt size={14} color={c.muc2}>Chưa có câu trả lời nào được gắn với chủ đề.</Txt>;
  return (
    <View style={{ gap: 10 }} accessibilityRole="list">
      {shown.map((r) => {
        const level: TopicLevel = (r.percent ?? 0) >= 85 ? 'strong' : (r.percent ?? 0) >= 60 ? 'ok' : 'weak';
        const col = levelColors(c, level);
        return (
          <View key={r.type} accessible accessibilityRole="progressbar" accessibilityLabel={`${r.label}: đúng ${r.percent}% trên ${r.answered} câu, ${r.topics} chủ đề`} accessibilityValue={{ min: 0, max: 100, now: r.percent ?? 0 }} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Txt f="semibold" size={14} style={{ flex: 1 }}>{r.label}</Txt>
              <Txt f="bold" size={13} color={col.fg}>{r.percent}%</Txt>
              <Txt size={12} color={c.muc3}>{r.correct}/{r.answered} câu · {r.topics} chủ đề</Txt>
            </View>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: c.vien, overflow: 'hidden' }}>
              <View style={{ width: `${Math.max(2, r.percent ?? 0)}%`, height: '100%', backgroundColor: col.fill, borderRadius: 5 }} />
            </View>
          </View>
        );
      })}
    </View>
  );
};

export interface Series { key: string; label: string; color?: string }
/** Biểu đồ cột theo thời gian: mỗi mốc là một cột (hoặc nhiều cột chồng nhau nếu có nhiều chuỗi); trục nhãn thưa dần khi nhiều mốc */
export const ColumnChart: React.FC<{ data: Array<{ label: string; values: Record<string, number> }>; series: Series[]; height?: number; unit?: string; summary: string }> = ({ data, series, height = 120, unit = '', summary }) => {
  const { c } = useTheme();
  const palette = [c.ngoc, c.thuy, c.dong, c.son];
  const sum = (d: { values: Record<string, number> }) => series.reduce((n, s) => n + (d.values[s.key] ?? 0), 0);
  const max = Math.max(1, ...data.map(sum));
  const step = Math.max(1, Math.ceil(data.length / 8));
  const total = data.reduce((n, d) => n + sum(d), 0);
  if (!data.length || total === 0) return <Txt size={14} color={c.muc2}>Chưa có hoạt động nào trong khoảng thời gian này.</Txt>;
  return (
    <View style={{ gap: 8 }}>
      <View accessible accessibilityRole="image" accessibilityLabel={`${summary}. Tổng cộng ${total}${unit ? ` ${unit}` : ''} trong ${data.length} mốc, mốc cao nhất ${max}.`}
        style={{ flexDirection: 'row', alignItems: 'flex-end', gap: data.length > 40 ? 1 : 3, height, borderBottomWidth: 1, borderBottomColor: c.vien }}>
        {data.map((d) => {
          const t = sum(d);
          return (
            <View key={d.label} style={{ flex: 1, minWidth: 2, height: '100%', justifyContent: 'flex-end' }}>
              <View style={{ height: `${(t / max) * 100}%`, minHeight: t ? 3 : 0, width: '100%', maxWidth: 48, alignSelf: 'center', borderTopLeftRadius: 3, borderTopRightRadius: 3, overflow: 'hidden', justifyContent: 'flex-end' }}>
                {series.map((s, i) => {
                  const v = d.values[s.key] ?? 0;
                  return v ? <View key={s.key} style={{ flexGrow: v, backgroundColor: s.color ?? palette[i % palette.length] }} /> : null;
                })}
              </View>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: data.length > 40 ? 1 : 3 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {data.map((d, i) => <View key={d.label} style={{ flex: 1, minWidth: 2, alignItems: 'center' }}>{i % step === 0 ? <Txt size={10} color={c.muc3} numberOfLines={1} style={{ width: 40, textAlign: 'center' }}>{d.label}</Txt> : null}</View>)}
      </View>
      {series.length > 1 ? (
        <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
          {series.map((s, i) => (
            <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: s.color ?? palette[i % palette.length] }} />
              <Txt size={12} color={c.muc2}>{s.label}</Txt>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

/** Phân bố học sinh theo khoảng tiến độ: thanh ngang mỗi khoảng, kèm số học sinh */
export const Distribution: React.FC<{ rows: Array<{ label: string; count: number }> }> = ({ rows }) => {
  const { c } = useTheme();
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <View style={{ gap: 8 }} accessibilityRole="list">
      {rows.map((r) => (
        <View key={r.label} accessible accessibilityLabel={`Tiến độ ${r.label}: ${r.count} học sinh`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Txt size={13} color={c.muc2} style={{ width: 70 }}>{r.label}</Txt>
          <View style={{ flex: 1, height: 16, borderRadius: 8, backgroundColor: c.vien, overflow: 'hidden' }}>
            <View style={{ width: `${(r.count / max) * 100}%`, height: '100%', backgroundColor: c.thuy, borderRadius: 8 }} />
          </View>
          <Txt f="bold" size={13} style={{ width: 28, textAlign: 'right' }}>{r.count}</Txt>
        </View>
      ))}
    </View>
  );
};

/** Nhãn ngày tháng ngắn "dd/mm" từ chuỗi YYYY-MM-DD hoặc YYYY-MM */
export const shortDay = (s: string): string => (s.length === 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : s.length === 7 ? `${s.slice(5, 7)}/${s.slice(2, 4)}` : s);
export const fmtPct = (v: number | null | undefined): string => (v === null || v === undefined ? '–' : `${v}%`);
export const ago = (iso: string | null): string => {
  if (!iso) return 'chưa lần nào';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? 'hôm nay' : d === 1 ? 'hôm qua' : `${d} ngày trước`;
};
