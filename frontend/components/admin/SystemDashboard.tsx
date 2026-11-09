import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Activity, Building2, CalendarDays, GraduationCap, RefreshCw, TrendingUp, UserRound } from 'lucide-react-native';
import * as api from '@/api/analyticsApi';
import { ErrorNote, useLoad } from '@/components/admin/kit';
import { DashboardGauge, type GaugeLevel } from '@/components/admin/DashboardGauge';
import { DashboardMetric as Metric } from '@/components/admin/DashboardMetric';
import { AiCard, BLUE, ContentCard, GOLD, GREEN, PURPLE, RolesCard, UsageCard, contentTotals } from '@/components/admin/DashboardPanels';
import { TrendChart, type TrendPoint } from '@/components/admin/TrendChart';
import type { Session } from '@/components/auth';
import { shortDay } from '@/components/charts';
import { Btn, Card, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { calendarBuckets, rollingAverage } from '@/lib/dashboard-trend';
import { fmt } from '@/lib/format';

export const dateText = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
export type Tab = 'users' | 'learning' | 'ai';
export const TABS: Array<{ value: Tab; label: string }> = [{ value: 'users', label: 'Người dùng' }, { value: 'learning', label: 'Học tập' }, { value: 'ai', label: 'Tiểu Tướng' }];
export const grade = (value: number | null, good: number, ok: number): GaugeLevel => (value == null ? 'none' : value >= good ? 'good' : value >= ok ? 'ok' : 'low');

/** Nút nhỏ dạng thẻ chọn (khoảng thời gian, tab biểu đồ) */
export function Pill({ testID, label, on, onPress, accessibilityLabel }: { testID: string; label: string; on: boolean; onPress: () => void; accessibilityLabel?: string }) {
  const { c } = useTheme();
  return <Pressable testID={testID} accessibilityRole="tab" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ selected: on }} onPress={onPress}
    style={{ minHeight: 32, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: on ? c.son : c.adminLine, backgroundColor: on ? c.sonNhat : c.the }}>
    <Txt f={on ? 'bold' : 'medium'} size={12} color={on ? c.son : c.muc2}>{label}</Txt>
  </Pressable>;
}

/**
 * Trang "Thống kê hệ thống": tổng quan toàn hệ thống trong một màn hình, không cuộn trên cửa sổ máy tính thông thường.
 * Hàng chỉ số, biểu đồ chuyển tab (người dùng, học tập, Tiểu Tướng) kèm ba đồng hồ, rồi bốn thẻ cơ cấu người dùng, nội dung, sử dụng và trợ lý AI.
 * Cửa sổ quá nhỏ thì các hàng xếp chồng và trang cuộn như thường. Số thực từ API, biểu đồ ngày theo lịch của máy chủ.
 */
export function SystemDashboard({ session }: { session: Session }) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const wide = width >= 1240;
  const [days, setDays] = useState<7 | 14 | 30>(30);
  const [tab, setTab] = useState<Tab>('users');
  const [refreshKey, setRefreshKey] = useState(0);
  const [chartArea, setChartArea] = useState(0);
  const [gaugeArea, setGaugeArea] = useState(0);
  const { token, expired } = session;
  const overview = useLoad(() => api.systemOverview(token), [token, refreshKey], expired);
  const content = useLoad(() => api.systemContent(token), [token, refreshKey], expired);
  const usage = useLoad(() => api.usage(token, 'day', days), [token, days, refreshKey], expired);
  const ai = useLoad(() => api.aiUsage(token, days), [token, days, refreshKey], expired);
  const d = overview.data;
  const roles = d?.users_by_role ?? {};
  const totalUsers = Object.values(roles).reduce((sum, n) => sum + n, 0);

  const usersTrend = useMemo(() => {
    const source = d?.series ?? [];
    const average = rollingAverage(source.map((p) => p.users));
    return source.map((p, i): TrendPoint => ({ key: p.day, label: shortDay(p.day), detail: dateText(p.day), values: { users: p.users, average: average[i] } })).slice(-days);
  }, [d, days]);
  const learningTrend = useMemo(() => {
    const u = usage.data;
    if (!u) return [];
    const byKey = new Map(u.items.map((item) => [item.bucket, item]));
    const calendar = calendarBuckets(d?.as_of, u.granularity, u.days);
    return (calendar.length ? calendar : u.items.map((item) => item.bucket)).map((key): TrendPoint => {
      const p = byKey.get(key);
      return { key, label: shortDay(key), detail: dateText(key), values: { lessons: p?.lessons ?? 0, quizzes: p?.quizzes ?? 0, battles: p?.battles ?? 0, rooms: p?.rooms ?? 0 } };
    });
  }, [usage.data, d?.as_of]);
  const aiTrend = useMemo(() => {
    const a = ai.data;
    if (!a) return [];
    const byDay = new Map(a.series.map((point) => [point.day, point.questions]));
    const calendar = calendarBuckets(d?.as_of, 'day', a.days);
    return (calendar.length ? calendar : a.series.map((p) => p.day)).map((key): TrendPoint => ({ key, label: shortDay(key), detail: dateText(key), values: { questions: byDay.get(key) ?? 0 } }));
  }, [ai.data, d?.as_of]);

  const published = content.data ? contentTotals(content.data) : null;
  const activity = totalUsers > 0 && d ? Math.min(100, (d.mau / totalUsers) * 100) : null;
  const publishedPct = published && published.total > 0 ? (published.published / published.total) * 100 : null;
  const answeredPct = ai.data && ai.data.refusal_rate != null ? Math.max(0, 100 - ai.data.refusal_rate) : null;
  const share = (part: number | undefined, whole: number) => (part != null && whole > 0 ? Math.min(100, (part / whole) * 100) : null);
  // đồng hồ: hàng đầu luôn có; hàng thứ hai chỉ hiện khi ô đủ cao (màn hình lớn) để không phải cuộn ở cửa sổ thấp
  const gauges = [
    { id: 'activity', label: 'Mức hoạt động', value: activity, good: 50, ok: 25, texts: ['Sôi nổi', 'Khá', 'Cần thúc đẩy'], hint: `${fmt(d?.mau ?? 0)} / ${fmt(totalUsers)} tài khoản\nhoạt động 30 ngày` },
    { id: 'content', label: 'Nội dung xuất bản', value: publishedPct, good: 80, ok: 50, texts: ['Tốt', 'Khá', 'Cần xuất bản'], hint: published ? `${fmt(published.published)} / ${fmt(published.total)} nội dung` : 'Đang tải…' },
    { id: 'ai', label: 'Tiểu Tướng trả lời', value: answeredPct, good: 90, ok: 75, texts: ['Ổn định', 'Khá', 'Thiếu tư liệu'], hint: ai.data ? `${fmt(ai.data.answers - ai.data.refused)} / ${fmt(ai.data.answers)} câu · ${days} ngày` : 'Đang tải…' },
    { id: 'schools', label: 'Trường hoạt động', value: share(d?.schools, d?.schools_total ?? 0), good: 90, ok: 70, texts: ['Ổn định', 'Khá', 'Cần rà soát'], hint: `${fmt(d?.schools ?? 0)} / ${fmt(d?.schools_total ?? 0)} trường` },
    { id: 'week', label: 'Hoạt động 7 ngày', value: share(d?.wau, totalUsers), good: 40, ok: 20, texts: ['Sôi nổi', 'Khá', 'Cần thúc đẩy'], hint: `${fmt(d?.wau ?? 0)} / ${fmt(totalUsers)} tài khoản` },
    { id: 'today', label: 'Hoạt động hôm nay', value: share(d?.dau, totalUsers), good: 15, ok: 5, texts: ['Sôi nổi', 'Khá', 'Cần thúc đẩy'], hint: `${fmt(d?.dau ?? 0)} / ${fmt(totalUsers)} tài khoản` },
  ];
  const gaugeNode = (g: (typeof gauges)[number]) => <DashboardGauge key={g.id} id={`dashboard-gauge-${g.id}`} label={g.label} value={g.value} level={grade(g.value, g.good, g.ok)}
    levelText={g.value == null ? 'Chưa có' : g.value >= g.good ? g.texts[0] : g.value >= g.ok ? g.texts[1] : g.texts[2]} hint={g.hint} />;
  const moreGauges = wide && gaugeArea >= 360;
  const errors = [...new Set([overview.error, content.error, usage.error, ai.error].filter((m): m is string => !!m))];
  const refresh = () => setRefreshKey((key) => key + 1);
  const busy = overview.loading || content.loading || usage.loading || ai.loading;
  // vùng chứa biểu đồ trừ dòng số liệu của mốc và hàng chú giải bên dưới
  const chartHeight = wide && chartArea ? Math.max(100, Math.min(380, chartArea - 66)) : 220;
  const chartTitle = tab === 'users' ? 'Người dùng hoạt động mỗi ngày' : tab === 'learning' ? 'Nhịp học tập' : 'Câu hỏi gửi Tiểu Tướng';
  const shown = tab === 'users' ? usersTrend : tab === 'learning' ? learningTrend : aiTrend;
  const range = shown.length ? `${dateText(shown[0].key)} – ${dateText(shown[shown.length - 1].key)}` : `${days} ngày gần nhất`;
  const rowGap = 8;

  return <ScrollView testID="system-dashboard" style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: 10, paddingBottom: 12, gap: rowGap, width: '100%', maxWidth: 1680, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <View style={{ flexShrink: 1, minWidth: 220 }}>
        <Txt f="displayHeavy" size={22} color={c.logoInk} accessibilityRole="header" style={{ lineHeight: 28 }}>Thống kê <Txt f="serifItalic" size={22} color={c.logoRed} style={{ lineHeight: 28 }}>hệ thống</Txt></Txt>
        <Txt size={12} color={c.muc3}>{d?.as_of ? `Số liệu đến ${dateText(d.as_of)} · Giờ Việt Nam · AI chỉ thống kê số lượng và chủ đề` : 'Trường học, người dùng, nội dung, sử dụng và trợ lý AI'}</Txt>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <View accessibilityRole="tablist" accessibilityLabel="Khoảng thời gian thống kê" style={{ flexDirection: 'row', gap: 6 }}>
          {([7, 14, 30] as const).map((n) => <Pill key={n} testID={`dashboard-range-${n}`} label={`${n} ngày`} on={days === n} onPress={() => setDays(n)} />)}
        </View>
        <Btn title="Làm mới" icon={RefreshCw} tone="giay" size="sm" onPress={refresh} loading={busy} testID="dashboard-refresh" />
      </View>
    </View>
    {errors.map((message) => <ErrorNote key={message} message={message} />)}
    {overview.loading && !d ? <Spinner label="Đang tải dashboard…" /> : null}
    {d ? <>
      <View testID="dashboard-metrics" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: rowGap }}>
        <Metric compact label="Trường hoạt động" value={d.schools} hint={`/ ${fmt(d.schools_total)}`} icon={Building2} color={c.son} background={c.sonNhat} />
        <Metric compact label="Học sinh" value={roles.student ?? 0} hint="" icon={GraduationCap} color={c.thuyChu} background={c.thuyNhat} />
        <Metric compact label="Giáo viên" value={roles.teacher ?? 0} hint="" icon={UserRound} color={c.thongChu} background={c.thongNhat} />
        <Metric compact label="Hoạt động hôm nay" value={d.dau} hint="người" icon={Activity} color={c.ngocChu} background={c.ngocNhat} />
        <Metric compact label="Hoạt động 7 ngày" value={d.wau} hint="người" icon={CalendarDays} color={c.vangChu} background={c.vangNhat} />
        <Metric compact label="Hoạt động 30 ngày" value={d.mau} hint="người" icon={TrendingUp} color={c.son} background={c.sonNhat} />
      </View>

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: rowGap, ...(wide ? { flexGrow: 1, flexShrink: 0, flexBasis: 236, maxHeight: 560 } : null) }}>
        <Card flat pad={12} style={{ flex: wide ? 2.2 : undefined, minWidth: 0, borderRadius: 12, gap: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 32 }}>
            <View style={{ flexShrink: 1 }}><Txt f="bold" size={14} accessibilityRole="header">{chartTitle}</Txt><Txt size={11} color={c.muc3}>{range}</Txt></View>
            <View accessibilityRole="tablist" accessibilityLabel="Loại biểu đồ" style={{ flexDirection: 'row', gap: 6 }}>
              {TABS.map((t) => <Pill key={t.value} testID={`dashboard-tab-${t.value}`} label={t.label} on={tab === t.value} onPress={() => setTab(t.value)} accessibilityLabel={`Biểu đồ ${t.label}`} />)}
            </View>
          </View>
          <View style={wide ? { flex: 1, minHeight: 0 } : undefined} onLayout={(event) => setChartArea(event.nativeEvent.layout.height)}>
            {tab === 'users' ? <TrendChart compact chartHeight={chartHeight} id="dashboard-users-trend" data={usersTrend} unit="người" summary="Người dùng hoạt động theo ngày và trung bình trượt 7 ngày"
              series={[{ key: 'users', label: 'Hoạt động mỗi ngày', color: BLUE }, { key: 'average', label: 'Trung bình 7 ngày', color: PURPLE, dashed: true }]} /> : null}
            {tab === 'learning' ? (usage.data ? <TrendChart compact chartHeight={chartHeight} id="dashboard-learning-trend" data={learningTrend} unit="lượt" summary="Hoạt động học tập theo thời gian"
              series={[{ key: 'lessons', label: 'Bài học', color: BLUE }, { key: 'quizzes', label: 'Quiz', color: PURPLE, dashed: true }, { key: 'battles', label: 'Trận đánh, mini-game', color: GOLD }, { key: 'rooms', label: 'Phòng thi đấu', color: GREEN, dashed: true }]} /> : <Spinner label="Đang tải hoạt động học tập…" />) : null}
            {tab === 'ai' ? (ai.data ? <TrendChart compact chartHeight={chartHeight} id="dashboard-ai-trend" data={aiTrend} unit="câu hỏi" summary="Số câu hỏi gửi Tiểu Tướng theo ngày"
              series={[{ key: 'questions', label: 'Câu hỏi Tiểu Tướng', color: PURPLE }]} /> : <Spinner label="Đang tải thống kê AI…" />) : null}
          </View>
        </Card>
        <Card flat pad={12} style={{ flex: wide ? 1.3 : undefined, minWidth: 0, borderRadius: 12, gap: 8 }} testID="dashboard-gauges">
          <Txt f="bold" size={14} accessibilityRole="header">Chỉ số tổng quan</Txt>
          <View style={wide ? { flex: 1, gap: 8 } : { gap: 8 }} onLayout={(event) => setGaugeArea(event.nativeEvent.layout.height)}>
            <View style={{ flex: wide ? 1 : undefined, flexDirection: 'row', flexWrap: wide ? 'nowrap' : 'wrap', alignItems: 'center', gap: 8 }}>{gauges.slice(0, 3).map(gaugeNode)}</View>
            {moreGauges || !wide ? <View style={{ flex: wide ? 1 : undefined, flexDirection: 'row', flexWrap: wide ? 'nowrap' : 'wrap', alignItems: 'center', gap: 8 }}>{gauges.slice(3).map(gaugeNode)}</View> : null}
          </View>
        </Card>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: rowGap, minHeight: 204 }}>
        {[
          <RolesCard key="roles" roles={roles} newUsers={d.new_users_30d} />,
          <ContentCard key="content" d={content.data} />,
          <UsageCard key="usage" d={usage.data} days={days} />,
          <AiCard key="ai" d={ai.data} days={days} topN={height >= 860 ? 3 : 2} />,
        ].map((card) => <View key={card.key} style={{ flexGrow: 1, flexBasis: wide ? 0 : 300, minWidth: wide ? 220 : 260 }}>{card}</View>)}
      </View>
    </> : null}
  </ScrollView>;
}
