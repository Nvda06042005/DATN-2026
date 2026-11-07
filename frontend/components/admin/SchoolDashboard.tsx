import { useMemo, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { Activity, CalendarDays, GraduationCap, RefreshCw, Route, UserRound, Users } from 'lucide-react-native';
import * as api from '@/api/analyticsApi';
import { ErrorNote, useLoad } from '@/components/admin/kit';
import { DashboardGauge } from '@/components/admin/DashboardGauge';
import { DashboardMetric as Metric } from '@/components/admin/DashboardMetric';
import { AiCard, BLUE, GOLD, GREEN, PURPLE, ResultsCard, RolesCard, UsageCard } from '@/components/admin/DashboardPanels';
import { dateText, grade, Pill, TABS, type Tab } from '@/components/admin/SystemDashboard';
import { TrendChart, type TrendPoint } from '@/components/admin/TrendChart';
import type { Session } from '@/components/auth';
import { shortDay } from '@/components/charts';
import { Btn, Card, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { calendarBuckets, rollingAverage } from '@/lib/dashboard-trend';
import { fmt } from '@/lib/format';
import { splitTitle } from '@/lib/title-split';

/** Ngày hôm nay theo giờ Việt Nam (UTC+7), dạng YYYY-MM-DD, làm mốc cuối của biểu đồ theo ngày */
const todayVn = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

/**
 * Trang "Thống kê trường": tổng quan của một trường trong một màn hình, không cuộn trên cửa sổ máy tính thông thường, cùng bố cục với "Thống kê hệ thống" của quản trị tổng.
 * Hàng chỉ số, biểu đồ chuyển tab (người học, học tập, Tiểu Tướng) kèm các đồng hồ nửa vòng, rồi bốn thẻ cơ cấu người dùng, kết quả theo khối, sử dụng và trợ lý AI.
 * Số thực từ bốn API có sẵn (tổng quan trường, sử dụng, AI, kết quả theo khối); máy chủ chỉ trả số liệu của đúng trường của quản trị viên. Cửa sổ nhỏ thì các hàng xếp chồng và trang cuộn.
 */
export function SchoolDashboard({ session, schoolName }: { session: Session; schoolName?: string }) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const wide = width >= 1240;
  const [days, setDays] = useState<7 | 14 | 30>(30);
  const [tab, setTab] = useState<Tab>('users');
  const [refreshKey, setRefreshKey] = useState(0);
  const [chartArea, setChartArea] = useState(0);
  const [gaugeArea, setGaugeArea] = useState(0);
  const { token, expired } = session;
  const overview = useLoad(() => api.schoolOverview(token), [token, refreshKey], expired);
  const usage = useLoad(() => api.usage(token, 'day', days), [token, days, refreshKey], expired);
  const ai = useLoad(() => api.aiUsage(token, days), [token, days, refreshKey], expired);
  const results = useLoad(() => api.results(token, 'grade'), [token, refreshKey], expired);
  const o = overview.data;
  const people = o ? o.teachers + o.students : 0;
  const asOf = todayVn();

  const usersTrend = useMemo(() => {
    const u = usage.data;
    if (!u) return [];
    const byKey = new Map(u.items.map((item) => [item.bucket, item.users]));
    const keys = calendarBuckets(asOf, u.granularity, u.days);
    const source = keys.length ? keys : u.items.map((item) => item.bucket);
    const values = source.map((key) => byKey.get(key) ?? 0);
    const average = rollingAverage(values);
    return source.map((key, i): TrendPoint => ({ key, label: shortDay(key), detail: dateText(key), values: { users: values[i], average: average[i] } }));
  }, [usage.data, asOf]);
  const learningTrend = useMemo(() => {
    const u = usage.data;
    if (!u) return [];
    const byKey = new Map(u.items.map((item) => [item.bucket, item]));
    const calendar = calendarBuckets(asOf, u.granularity, u.days);
    return (calendar.length ? calendar : u.items.map((item) => item.bucket)).map((key): TrendPoint => {
      const p = byKey.get(key);
      return { key, label: shortDay(key), detail: dateText(key), values: { lessons: p?.lessons ?? 0, quizzes: p?.quizzes ?? 0, battles: p?.battles ?? 0, rooms: p?.rooms ?? 0 } };
    });
  }, [usage.data, asOf]);
  const aiTrend = useMemo(() => {
    const a = ai.data;
    if (!a) return [];
    const byDay = new Map(a.series.map((point) => [point.day, point.questions]));
    const calendar = calendarBuckets(asOf, 'day', a.days);
    return (calendar.length ? calendar : a.series.map((p) => p.day)).map((key): TrendPoint => ({ key, label: shortDay(key), detail: dateText(key), values: { questions: byDay.get(key) ?? 0 } }));
  }, [ai.data, asOf]);

  const groups = results.data?.groups ?? [];
  const studentsInGroups = groups.reduce((sum, g) => sum + g.students, 0);
  const activeInGroups = groups.reduce((sum, g) => sum + g.active_students, 0);
  /** Trung bình theo số học sinh của từng khối, bỏ khối chưa có số liệu */
  const weighted = (pick: (g: (typeof groups)[number]) => number | null) => {
    const rows = groups.filter((g) => pick(g) != null && g.students > 0);
    const total = rows.reduce((sum, g) => sum + g.students, 0);
    return total > 0 ? rows.reduce((sum, g) => sum + (pick(g) as number) * g.students, 0) / total : null;
  };
  const share = (part: number | undefined, whole: number) => (part != null && whole > 0 ? Math.min(100, (part / whole) * 100) : null);
  const answeredPct = ai.data && ai.data.refusal_rate != null ? Math.max(0, 100 - ai.data.refusal_rate) : null;
  const participation = share(activeInGroups, studentsInGroups);
  const averageScore = weighted((g) => g.avg_percent);
  const accuracy = weighted((g) => g.accuracy);
  // đồng hồ: hàng đầu luôn có; hàng thứ hai chỉ hiện khi ô đủ cao (màn hình lớn) để không phải cuộn ở cửa sổ thấp
  const gauges = [
    { id: 'week', label: 'Hoạt động 7 ngày', value: share(o?.active_week, people), good: 50, ok: 25, texts: ['Sôi nổi', 'Khá', 'Cần thúc đẩy'], hint: `${fmt(o?.active_week ?? 0)} / ${fmt(people)} người` },
    { id: 'today', label: 'Hoạt động hôm nay', value: share(o?.active_today, people), good: 20, ok: 8, texts: ['Sôi nổi', 'Khá', 'Cần thúc đẩy'], hint: `${fmt(o?.active_today ?? 0)} / ${fmt(people)} người` },
    { id: 'ai', label: 'Tiểu Tướng trả lời', value: answeredPct, good: 90, ok: 75, texts: ['Ổn định', 'Khá', 'Thiếu tư liệu'], hint: ai.data ? `${fmt(ai.data.answers - ai.data.refused)} / ${fmt(ai.data.answers)} câu · ${days} ngày` : 'Đang tải…' },
    { id: 'participation', label: 'Học sinh tham gia', value: participation, good: 70, ok: 40, texts: ['Tốt', 'Khá', 'Cần thúc đẩy'], hint: results.data ? `${fmt(activeInGroups)} / ${fmt(studentsInGroups)} học sinh` : 'Đang tải…' },
    { id: 'score', label: 'Điểm trung bình', value: averageScore, good: 70, ok: 50, texts: ['Tốt', 'Khá', 'Cần ôn tập'], hint: 'trung bình các khối' },
    { id: 'accuracy', label: 'Tỉ lệ làm đúng', value: accuracy, good: 75, ok: 55, texts: ['Tốt', 'Khá', 'Cần ôn tập'], hint: 'các câu hỏi đã làm' },
  ];
  const gaugeNode = (g: (typeof gauges)[number]) => <DashboardGauge key={g.id} id={`school-gauge-${g.id}`} label={g.label} value={g.value} level={grade(g.value, g.good, g.ok)}
    levelText={g.value == null ? 'Chưa có' : g.value >= g.good ? g.texts[0] : g.value >= g.ok ? g.texts[1] : g.texts[2]} hint={g.hint} />;
  const moreGauges = wide && gaugeArea >= 360;
  const errors = [...new Set([overview.error, usage.error, ai.error, results.error].filter((m): m is string => !!m))];
  const refresh = () => setRefreshKey((key) => key + 1);
  const busy = overview.loading || usage.loading || ai.loading || results.loading;
  const chartHeight = wide && chartArea ? Math.max(100, Math.min(380, chartArea - 66)) : 220;
  const chartTitle = tab === 'users' ? 'Người học hoạt động mỗi ngày' : tab === 'learning' ? 'Nhịp học tập' : 'Câu hỏi gửi Tiểu Tướng';
  const shown = tab === 'users' ? usersTrend : tab === 'learning' ? learningTrend : aiTrend;
  const range = shown.length ? `${dateText(shown[0].key)} – ${dateText(shown[shown.length - 1].key)}` : `${days} ngày gần nhất`;
  const rowGap = 8;
  const [titleHead, titleTail] = splitTitle('Thống kê trường');

  return <ScrollView testID="school-dashboard" style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: 10, paddingBottom: 12, gap: rowGap, width: '100%', maxWidth: 1680, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <View style={{ flexShrink: 1, minWidth: 220 }}>
        <Txt f="displayHeavy" size={22} color={c.logoInk} accessibilityRole="header" style={{ lineHeight: 28 }}>{titleHead} <Txt f="serifItalic" size={22} color={c.logoRed} style={{ lineHeight: 28 }}>{titleTail}</Txt></Txt>
        <Txt size={12} color={c.muc3}>{`${schoolName ? `${schoolName} · ` : ''}Số liệu đến ${dateText(asOf)} · Giờ Việt Nam · AI chỉ thống kê số lượng và chủ đề`}</Txt>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <View accessibilityRole="tablist" accessibilityLabel="Khoảng thời gian thống kê" style={{ flexDirection: 'row', gap: 6 }}>
          {([7, 14, 30] as const).map((n) => <Pill key={n} testID={`school-range-${n}`} label={`${n} ngày`} on={days === n} onPress={() => setDays(n)} />)}
        </View>
        <Btn title="Làm mới" icon={RefreshCw} tone="giay" size="sm" onPress={refresh} loading={busy} testID="school-refresh" />
      </View>
    </View>
    {errors.map((message) => <ErrorNote key={message} message={message} />)}
    {overview.loading && !o ? <Spinner label="Đang tải thống kê trường…" /> : null}
    {o ? <>
      <View testID="school-metrics" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: rowGap }}>
        <Metric compact label="Lớp đang hoạt động" value={o.classes} hint="" icon={Users} color={c.son} background={c.sonNhat} />
        <Metric compact label="Giáo viên" value={o.teachers} hint="" icon={UserRound} color={c.thongChu} background={c.thongNhat} />
        <Metric compact label="Học sinh" value={o.students} hint="" icon={GraduationCap} color={c.thuyChu} background={c.thuyNhat} />
        <Metric compact label="Hành trình đang chạy" value={o.journeys_running} hint="" icon={Route} color={c.vangChu} background={c.vangNhat} />
        <Metric compact label="Hoạt động hôm nay" value={o.activities_today} hint={`${fmt(o.active_today)} người`} icon={Activity} color={c.ngocChu} background={c.ngocNhat} />
        <Metric compact label="Người học 7 ngày" value={o.active_week} hint="người" icon={CalendarDays} color={c.son} background={c.sonNhat} />
      </View>

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: rowGap, ...(wide ? { flexGrow: 1, flexShrink: 0, flexBasis: 236, maxHeight: 560 } : null) }}>
        <Card flat pad={12} style={{ flex: wide ? 2.2 : undefined, minWidth: 0, borderRadius: 12, gap: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 32 }}>
            <View style={{ flexShrink: 1 }}><Txt f="bold" size={14} accessibilityRole="header">{chartTitle}</Txt><Txt size={11} color={c.muc3}>{range}</Txt></View>
            <View accessibilityRole="tablist" accessibilityLabel="Loại biểu đồ" style={{ flexDirection: 'row', gap: 6 }}>
              {TABS.map((t) => <Pill key={t.value} testID={`school-tab-${t.value}`} label={t.value === 'users' ? 'Người học' : t.label} on={tab === t.value} onPress={() => setTab(t.value)} accessibilityLabel={`Biểu đồ ${t.label}`} />)}
            </View>
          </View>
          <View style={wide ? { flex: 1, minHeight: 0 } : undefined} onLayout={(event) => setChartArea(event.nativeEvent.layout.height)}>
            {tab === 'users' ? (usage.data ? <TrendChart compact chartHeight={chartHeight} id="school-users-trend" data={usersTrend} unit="người" summary="Người học hoạt động theo ngày và trung bình trượt 7 ngày"
              series={[{ key: 'users', label: 'Hoạt động mỗi ngày', color: BLUE }, { key: 'average', label: 'Trung bình 7 ngày', color: PURPLE, dashed: true }]} /> : <Spinner label="Đang tải hoạt động…" />) : null}
            {tab === 'learning' ? (usage.data ? <TrendChart compact chartHeight={chartHeight} id="school-learning-trend" data={learningTrend} unit="lượt" summary="Hoạt động học tập theo thời gian"
              series={[{ key: 'lessons', label: 'Bài học', color: BLUE }, { key: 'quizzes', label: 'Quiz', color: PURPLE, dashed: true }, { key: 'battles', label: 'Trận đánh, mini-game', color: GOLD }, { key: 'rooms', label: 'Phòng thi đấu', color: GREEN, dashed: true }]} /> : <Spinner label="Đang tải hoạt động học tập…" />) : null}
            {tab === 'ai' ? (ai.data ? <TrendChart compact chartHeight={chartHeight} id="school-ai-trend" data={aiTrend} unit="câu hỏi" summary="Số câu hỏi gửi Tiểu Tướng theo ngày"
              series={[{ key: 'questions', label: 'Câu hỏi Tiểu Tướng', color: PURPLE }]} /> : <Spinner label="Đang tải thống kê AI…" />) : null}
          </View>
        </Card>
        <Card flat pad={12} style={{ flex: wide ? 1.3 : undefined, minWidth: 0, borderRadius: 12, gap: 8 }} testID="school-gauges">
          <Txt f="bold" size={14} accessibilityRole="header">Chỉ số tổng quan</Txt>
          <View style={wide ? { flex: 1, gap: 8 } : { gap: 8 }} onLayout={(event) => setGaugeArea(event.nativeEvent.layout.height)}>
            <View style={{ flex: wide ? 1 : undefined, flexDirection: 'row', flexWrap: wide ? 'nowrap' : 'wrap', alignItems: 'center', gap: 8 }}>{gauges.slice(0, 3).map(gaugeNode)}</View>
            {moreGauges || !wide ? <View style={{ flex: wide ? 1 : undefined, flexDirection: 'row', flexWrap: wide ? 'nowrap' : 'wrap', alignItems: 'center', gap: 8 }}>{gauges.slice(3).map(gaugeNode)}</View> : null}
          </View>
        </Card>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: rowGap, minHeight: 204 }}>
        {[
          <RolesCard key="roles" roles={{ student: o.students, teacher: o.teachers }} only={['student', 'teacher']} />,
          <ResultsCard key="results" groups={results.data ? groups : null} />,
          <UsageCard key="usage" d={usage.data} days={days} />,
          <AiCard key="ai" d={ai.data} days={days} topN={height >= 860 ? 3 : 2} money={false} />,
        ].map((card) => <View key={card.key} style={{ flexGrow: 1, flexBasis: wide ? 0 : 300, minWidth: wide ? 220 : 260 }}>{card}</View>)}
      </View>
    </> : null}
  </ScrollView>;
}
