/**
 * Báo cáo và thống kê cho quản trị (Sprint 10): quản trị trường xem tổng quan (HK.QT.006), mức độ sử dụng theo ngày (HK.QT.007), kết quả theo khối / lớp / giáo viên (HK.QT.008, 047),
 * thống kê AI (HK.QT.009), hồ sơ học sinh (HK.QT.033) và xuất báo cáo (HK.QT.048). Quản trị tổng xem toàn hệ thống (HK.AD.006–009) ; thuật toán gợi ý chỉ chạy nội bộ trên máy chủ.
 * Số liệu về câu hỏi của học sinh luôn ẩn danh (chỉ đếm số lượng và chủ đề).
 */
import React, { useMemo, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { BookOpen, Brain, GraduationCap, MessageCircleQuestion, Swords, Trophy } from 'lucide-react-native';
import * as adminApi from '@/api/adminApi';
import * as api from '@/api/analyticsApi';
import { ClassAnalytics, ResultsDashboard } from '@/components/admin/AnalyticsTeacher';
import { DashboardGauge } from '@/components/admin/DashboardGauge';
import { DashboardMetric as Metric } from '@/components/admin/DashboardMetric';
import { AiCard, BLUE, GOLD, GREEN, PURPLE, RED, UsageCard } from '@/components/admin/DashboardPanels';
import { ErrorNote, useLoad } from '@/components/admin/kit';
import { BarRow, CardRow, Panel, ReportActions, ReportShell, SlowNote, vnToday } from '@/components/admin/ReportKit';
import { SchoolDashboard } from '@/components/admin/SchoolDashboard';
import { SystemDashboard } from '@/components/admin/SystemDashboard';
import { dateText, grade, Pill, TABS, type Tab } from '@/components/admin/SystemDashboard';
import { TrendChart, type TrendPoint } from '@/components/admin/TrendChart';
import type { Session } from '@/components/auth';
import { shortDay } from '@/components/charts';
import { InfoNote, Segmented, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { calendarBuckets, rollingAverage } from '@/lib/dashboard-trend';
import { fmt } from '@/lib/format';

const WEEKDAYS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];

// ---------------------------------------------------------------------- sử dụng và trợ lý AI (HK.QT.007, HK.QT.009): một dashboard (yêu cầu 14/11/2026 gộp hai tab Sử dụng và AI)
/**
 * Hàng chỉ số (học tập và Tiểu Tướng), biểu đồ chuyển tab người học / học tập / Tiểu Tướng, ba đồng hồ, rồi các thẻ hoạt động học tập, nhịp học theo thứ trong tuần,
 * trợ lý AI (tư liệu được hỏi nhiều) và chất lượng trả lời. Xuất Excel / PDF theo bố cục chính thức. Tải lâu (máy chủ khởi động) thì báo rõ và cho thử lại.
 */
export const UsageAiDashboard: React.FC<{ session: Session; schoolName?: string }> = ({ session, schoolName }) => {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 1240;
  const { token, expired } = session;
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [tab, setTab] = useState<Tab>('users');
  const [refresh, setRefresh] = useState(0);
  const usage = useLoad(() => api.usage(token, 'day', days), [token, days, refresh], expired);
  const ai = useLoad(() => api.aiUsage(token, days), [token, days, refresh], expired);
  const u = usage.data, a = ai.data;
  const asOf = vnToday();
  const calendar = useMemo(() => calendarBuckets(asOf, 'day', days), [asOf, days]);
  const byDay = useMemo(() => new Map((u?.items ?? []).map((i) => [i.bucket, i])), [u]);
  const aiByDay = useMemo(() => new Map((a?.series ?? []).map((s) => [s.day, s.questions])), [a]);
  const usersTrend = useMemo(() => {
    const values = calendar.map((k) => byDay.get(k)?.users ?? 0);
    const avg = rollingAverage(values);
    return calendar.map((k, i): TrendPoint => ({ key: k, label: shortDay(k), detail: dateText(k), values: { users: values[i], average: avg[i] } }));
  }, [calendar, byDay]);
  const learningTrend = useMemo(() => calendar.map((k): TrendPoint => {
    const p = byDay.get(k);
    return { key: k, label: shortDay(k), detail: dateText(k), values: { lessons: p?.lessons ?? 0, quizzes: p?.quizzes ?? 0, battles: p?.battles ?? 0, rooms: p?.rooms ?? 0 } };
  }), [calendar, byDay]);
  const aiTrend = useMemo(() => calendar.map((k): TrendPoint => ({ key: k, label: shortDay(k), detail: dateText(k), values: { questions: aiByDay.get(k) ?? 0 } })), [calendar, aiByDay]);
  // nhịp học theo thứ trong tuần: tổng lượt học tập (bài học, quiz, trận đánh, thi đấu) của từng thứ trong kỳ
  const weekdays = useMemo(() => {
    const sum = Array(7).fill(0) as number[];
    for (const k of calendar) {
      const p = byDay.get(k);
      if (p) sum[(new Date(`${k}T00:00:00Z`).getUTCDay() + 6) % 7] += p.lessons + p.quizzes + p.battles + p.rooms;
    }
    return sum;
  }, [calendar, byDay]);
  const weekdayMax = Math.max(1, ...weekdays);
  const busiest = weekdays.some((n) => n > 0) ? WEEKDAYS[weekdays.indexOf(Math.max(...weekdays))] : '–';
  const peak = usersTrend.reduce<TrendPoint | null>((best, p) => ((p.values.users ?? 0) > (best?.values.users ?? 0) ? p : best), null);
  const perDay = usersTrend.length ? Math.round(usersTrend.reduce((n, p) => n + (p.values.users ?? 0), 0) / usersTrend.length) : 0;
  const activeDays = calendar.filter((k) => (byDay.get(k)?.users ?? 0) > 0).length;
  const answered = a ? a.answers - a.refused : 0;
  const answeredPct = a && a.answers > 0 ? Math.round((answered / a.answers) * 100) : null;
  const quotaPct = a?.quota && a.quota.limit > 0 ? Math.round((a.quota.remaining / a.quota.limit) * 100) : null;
  const shown = tab === 'users' ? usersTrend : tab === 'learning' ? learningTrend : aiTrend;
  const range = shown.length ? `${dateText(shown[0].key)} – ${dateText(shown[shown.length - 1].key)}` : `${days} ngày gần nhất`;
  const reload = () => setRefresh((n) => n + 1);
  const errors = [...new Set([usage.error, ai.error].filter((m): m is string => !!m))];
  const gauge = (id: string, label: string, value: number | null, good: number, ok: number, texts: [string, string, string], hint: string) =>
    <DashboardGauge key={id} id={id} label={label} value={value} level={grade(value, good, ok)} levelText={value == null ? 'Chưa có' : value >= good ? texts[0] : value >= ok ? texts[1] : texts[2]} hint={hint} />;

  return (
    <ReportShell testID="usage-dashboard" title="Sử dụng và AI" subtitle={`${schoolName ? `${schoolName} · ` : ''}${days} ngày gần nhất (${range}) · Giờ Việt Nam · AI chỉ thống kê số lượng và chủ đề`}
      actions={<ReportActions idPrefix="usage" filename={`bao-cao-su-dung-va-ai-${days}-ngay`} excel={() => api.exportUsage(token, days, 'xlsx')} pdf={() => api.exportUsage(token, days, 'pdf')} onRefresh={reload} busy={usage.loading || ai.loading} />}
      filters={<View accessibilityRole="tablist" accessibilityLabel="Khoảng thời gian" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <Txt size={12} f="semibold" color={c.muc2}>Thời gian:</Txt>
        {([7, 30, 90] as const).map((n) => <Pill key={n} testID={`usage-range-${n}`} label={`${n} ngày`} on={days === n} onPress={() => setDays(n)} />)}
      </View>}>
      {errors.map((m) => <ErrorNote key={m} message={m} />)}
      <SlowNote loading={(usage.loading && !u) || (ai.loading && !a)} onRetry={reload} />
      {!u && !a && (usage.loading || ai.loading) ? <Spinner label="Đang tải thống kê sử dụng và AI…" /> : null}
      {u || a ? <>
        <View testID="usage-metrics" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Metric compact label="Bài học hoàn thành" value={u ? u.totals.lessons : '…'} hint="" icon={BookOpen} color={c.thuyChu} background={c.thuyNhat} />
          <Metric compact label="Lượt làm quiz" value={u ? u.totals.quizzes : '…'} hint="" icon={GraduationCap} color={c.thongChu} background={c.thongNhat} />
          <Metric compact label="Trận đánh, mini-game" value={u ? u.totals.battles : '…'} hint="" icon={Swords} color={c.son} background={c.sonNhat} />
          <Metric compact label="Phòng thi đấu" value={u ? u.totals.rooms : '…'} hint="" icon={Trophy} color={c.vangChu} background={c.vangNhat} />
          <Metric compact label="Câu hỏi Tiểu Tướng" value={a ? a.questions : '…'} hint={a ? `${fmt(a.users)} người hỏi` : ''} icon={MessageCircleQuestion} color={c.thongChu} background={c.thongNhat} />
          <Metric compact label="Trả lời được" value={answeredPct == null ? '–' : `${answeredPct}%`} hint={a ? `${fmt(answered)}/${fmt(a.answers)} câu` : ''} icon={Brain} color={c.ngocChu} background={c.ngocNhat} />
        </View>

        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 8 }}>
          <Panel title={tab === 'users' ? 'Người học hoạt động mỗi ngày' : tab === 'learning' ? 'Nhịp học tập' : 'Câu hỏi gửi Tiểu Tướng'} style={{ flex: wide ? 2.2 : undefined }} testID="usage-trend-card"
            right={<View accessibilityRole="tablist" accessibilityLabel="Loại biểu đồ" style={{ flexDirection: 'row', gap: 6 }}>
              {TABS.map((t) => <Pill key={t.value} testID={`usage-tab-${t.value}`} label={t.value === 'users' ? 'Người học' : t.label} on={tab === t.value} onPress={() => setTab(t.value)} accessibilityLabel={`Biểu đồ ${t.label}`} />)}
            </View>}>
            <Txt size={11} color={c.muc3}>{range}</Txt>
            {tab === 'users' ? (u ? <TrendChart compact chartHeight={236} id="usage-users-trend" data={usersTrend} unit="người" summary="Người học hoạt động theo ngày và trung bình trượt 7 ngày"
              series={[{ key: 'users', label: 'Hoạt động mỗi ngày', color: BLUE }, { key: 'average', label: 'Trung bình 7 ngày', color: PURPLE, dashed: true }]} /> : <Spinner label="Đang tải hoạt động…" />) : null}
            {tab === 'learning' ? (u ? <TrendChart compact chartHeight={236} id="usage-learning-trend" data={learningTrend} unit="lượt" summary="Hoạt động học tập theo ngày"
              series={[{ key: 'lessons', label: 'Bài học', color: BLUE }, { key: 'quizzes', label: 'Quiz', color: PURPLE, dashed: true }, { key: 'battles', label: 'Trận đánh, mini-game', color: GOLD }, { key: 'rooms', label: 'Phòng thi đấu', color: GREEN, dashed: true }]} /> : <Spinner label="Đang tải hoạt động học tập…" />) : null}
            {tab === 'ai' ? (a ? <TrendChart compact chartHeight={236} id="usage-ai-trend" data={aiTrend} unit="câu hỏi" summary="Số câu hỏi gửi Tiểu Tướng theo ngày"
              series={[{ key: 'questions', label: 'Câu hỏi Tiểu Tướng', color: PURPLE }]} /> : <Spinner label="Đang tải thống kê AI…" />) : null}
          </Panel>
          <Panel title="Chỉ số sử dụng" note={`${days} ngày`} style={{ flex: wide ? 1.3 : undefined }} testID="usage-gauges">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {gauge('usage-gauge-days', 'Ngày có người học', u ? Math.round((activeDays / days) * 100) : null, 70, 40, ['Đều đặn', 'Khá', 'Thưa'], `${activeDays} / ${days} ngày`)}
              {gauge('usage-gauge-ai', 'Tiểu Tướng trả lời', answeredPct, 90, 75, ['Ổn định', 'Khá', 'Thiếu tư liệu'], a ? `${fmt(answered)} / ${fmt(a.answers)} câu` : 'Đang tải…')}
              {gauge('usage-gauge-quota', 'Hạn mức AI còn lại', quotaPct, 50, 20, ['Còn nhiều', 'Vừa', 'Sắp hết'], a?.quota ? `${fmt(a.quota.remaining)} / ${fmt(a.quota.limit)} lượt hôm nay` : 'Chưa có hạn mức')}
            </View>
            <View testID="usage-summary" style={{ borderTopWidth: 1, borderTopColor: c.adminLine, paddingTop: 8, gap: 6 }}>
              {[
                ['Người học trung bình mỗi ngày', u ? `${fmt(perDay)} người` : '…'],
                ['Ngày đông người học nhất', u ? (peak ? `${dateText(peak.key)} · ${fmt(peak.values.users ?? 0)} người` : '–') : '…'],
                ['Thứ học nhiều nhất trong tuần', u ? busiest : '…'],
                ['Câu trả lời bị báo sai', a ? `${fmt(a.reported)} câu` : '…'],
              ].map(([label, value]) => <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Txt size={12} color={c.muc2} style={{ flexShrink: 1 }}>{label}</Txt><Txt f="bold" size={12}>{value}</Txt></View>)}
            </View>
          </Panel>
        </View>

        <CardRow wide={wide}>
          <UsageCard d={u} days={days} />
          <Panel title="Nhịp học theo thứ" note="tổng lượt học tập" testID="usage-weekdays">
            {!u ? <Txt size={12} color={c.muc3}>Đang tải…</Txt> : WEEKDAYS.map((label, i) => <BarRow key={label} label={label} value={weekdays[i]} max={weekdayMax} suffix="" color={BLUE} highlight={weekdays[i] === weekdayMax && weekdays[i] > 0 ? true : undefined} />)}
          </Panel>
          <AiCard d={a} days={days} topN={5} money={false} />
          <Panel title="Chất lượng trả lời" note="Tiểu Tướng" testID="usage-ai-quality">
            {!a ? <Txt size={12} color={c.muc3}>Đang tải…</Txt> : <>
              <BarRow label="Trả lời được" value={answered} max={Math.max(1, a.answers)} suffix=" câu" color={GREEN} />
              <BarRow label="Ngoài phạm vi, từ chối" value={a.refused} max={Math.max(1, a.answers)} suffix=" câu" color={GOLD} />
              <BarRow label="Bị báo sai" value={a.reported} max={Math.max(1, a.answers)} suffix=" câu" color={RED} />
              <Txt size={11} color={c.muc3}>Câu bị báo sai cần giáo viên, quản trị xem lại tư liệu. Số câu hỏi chỉ được đếm, không hiện nội dung.</Txt>
            </>}
          </Panel>
        </CardRow>
        <InfoNote><Txt size={13}>Chỉ thống kê số lượng và chủ đề; nội dung câu hỏi của từng học sinh không hiển thị ở đây và không có trong file xuất.</Txt></InfoNote>
      </> : null}
    </ReportShell>
  );
};

// ---------------------------------------------------------------------- quản trị trường (HK.QT.006–009, 033, 047–048)
type SchoolPart = 'overview' | 'classes' | 'results' | 'usage';
const SCHOOL_PARTS: Array<{ value: SchoolPart; label: string }> = [{ value: 'overview', label: 'Tổng quan' }, { value: 'classes', label: 'Lớp và học sinh' }, { value: 'results', label: 'Kết quả' }, { value: 'usage', label: 'Sử dụng và AI' }];
/**
 * "Thống kê trường" gộp với "Báo cáo" (yêu cầu 13/11/2026). Yêu cầu 14/11/2026: mỗi phần là một dashboard (Tổng quan, Lớp và học sinh, Kết quả, Sử dụng và AI — hai tab Sử dụng
 * và AI gộp làm một); khoảng thời gian chọn nhanh theo học kỳ / năm học của trường; xuất Excel, PDF theo bố cục chính thức như file xuất Giáo viên, Học sinh, Lớp học.
 */
export const SchoolReports: React.FC<{ session: Session; schoolName?: string }> = ({ session, schoolName }) => {
  const [part, setPart] = useState<SchoolPart>('overview');
  const years = useLoad(() => adminApi.listYears(session.token), [session.token], session.expired);
  // năm học: đang tải → undefined (chờ để không tải số liệu hai lần); lỗi → null (chọn theo số ngày)
  const yearList = years.data ?? (years.loading ? undefined : null);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 10, paddingTop: 10 }} testID="school-report-tabs"><Segmented<SchoolPart> label="Thống kê và báo cáo" value={part} onChange={setPart} options={SCHOOL_PARTS} /></View>
      {part === 'overview' ? <SchoolDashboard session={session} schoolName={schoolName} />
        : part === 'classes' ? <ClassAnalytics session={session} years={yearList} />
        : part === 'results' ? <ResultsDashboard session={session} years={yearList} schoolName={schoolName} />
        : <UsageAiDashboard session={session} schoolName={schoolName} />}
    </View>
  );
};

// ---------------------------------------------------------------------- quản trị tổng (HK.AD.006–009, 063)
export const SystemStats: React.FC<{ session: Session }> = ({ session }) => <SystemDashboard session={session} />; // trang tổng quan tự có tiêu đề và vừa một màn hình, không đặt trong Page cuộn
