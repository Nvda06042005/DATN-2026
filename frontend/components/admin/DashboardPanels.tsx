import { useMemo, useState, type ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Banknote, BookCheck, BookOpen, BrainCircuit, CircleHelp, FileQuestion, GraduationCap, MessageSquare, ShieldAlert, Swords, Trophy } from 'lucide-react-native';
import * as api from '@/api/analyticsApi';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { DashboardMetric as Metric } from '@/components/admin/DashboardMetric';
import { ErrorNote, useLoad } from '@/components/admin/kit';
import { TrendChart, type TrendPoint } from '@/components/admin/TrendChart';
import type { Session } from '@/components/auth';
import { shortDay } from '@/components/charts';
import { Card, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { calendarBuckets } from '@/lib/dashboard-trend';
import { fmt } from '@/lib/format';
import type { ContentRow, Usage } from '@/types/analytics';

const BLUE = '#3474d9', PURPLE = '#aa42ad', GOLD = '#b77c18', GREEN = '#258575';
type Props = { session: Session; refreshKey: number; asOf?: string };
const detail = (day: string) => day.length === 7 ? `Tháng ${day.slice(5, 7)}/${day.slice(0, 4)}` : `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
const grid = { flexDirection: 'row', flexWrap: 'wrap', gap: 14 } as const;

function Heading({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  const { c } = useTheme();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center', paddingTop: 10 }}>
    <View style={{ flex: 1, minWidth: 200, gap: 4 }}><Txt f="bold" size={20} accessibilityRole="header">{title}</Txt><Txt size={12} color={c.muc3}>{subtitle}</Txt></View>
    {action}
  </View>;
}

function ContentBreakdown({ title, rows, children }: { title: string; rows: ContentRow[]; children?: ReactNode }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const statuses = [{ key: 'draft' as const, label: 'Bản nháp', color: GOLD }, { key: 'verified' as const, label: 'Đã kiểm duyệt', color: BLUE }, { key: 'published' as const, label: 'Đã xuất bản', color: GREEN }];
  return <Card flat pad={20} style={{ flex: width >= 1150 ? 1 : undefined, minWidth: 0, borderRadius: 12, gap: 18 }}>
    <Txt f="bold" size={16}>{title}</Txt>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{statuses.map(s => <View key={s.key} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: s.color }} /><Txt size={10} color={c.muc3}>{s.label}</Txt></View>)}</View>
    {!rows.length && <Txt size={12} color={c.muc3}>Chưa có nội dung.</Txt>}
    {rows.map(row => <View key={row.key} accessible accessibilityLabel={`${row.label}: tổng ${row.total}, ${row.draft} bản nháp, ${row.verified} đã kiểm duyệt, ${row.published} đã xuất bản`} style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><Txt f="semibold" size={13} style={{ flex: 1 }}>{row.label}</Txt><Txt size={12} f="bold">{fmt(row.total)}</Txt></View>
      <View style={{ flexDirection: 'row', height: 7, borderRadius: 4, backgroundColor: c.adminLine, overflow: 'hidden' }}>
        {statuses.map(s => row[s.key] > 0 ? <View key={s.key} style={{ width: `${100 * row[s.key] / Math.max(1, row.total)}%`, backgroundColor: s.color }} /> : null)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{statuses.map(s => <Txt key={s.key} size={10} color={c.muc3}>{s.label}: {fmt(row[s.key])}</Txt>)}</View>
    </View>)}
    {children}
  </Card>;
}

export function DashboardContent({ session, refreshKey }: Props) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const load = useLoad(() => api.systemContent(session.token), [session.token, refreshKey], session.expired);
  const d = load.data;
  const rows = d ? [...d.history, ...d.learning] : [];
  const published = rows.reduce((n, row) => n + row.published, 0);
  return <View testID="dashboard-content" style={{ gap: 16 }}>
    <Heading title="Nội dung" subtitle="Kho lịch sử, nội dung học tập và ngân hàng câu hỏi trên toàn hệ thống" />
    <ErrorNote message={load.error} />
    {load.loading && !d ? <Spinner label="Đang tải thống kê nội dung…" /> : null}
    {d && <>
      <View style={grid}>
        <Metric label="Nội dung đã xuất bản" value={published} hint={`${fmt(rows.reduce((n, row) => n + row.total, 0))} nội dung trong kho`} icon={BookCheck} color={c.ngocChu} background={c.ngocNhat} />
        <Metric label="Câu hỏi" value={d.questions.total} hint="Ngân hàng câu hỏi" icon={CircleHelp} color={c.thuyChu} background={c.thuyNhat} />
        <Metric label="Bộ đề" value={d.quizzes} hint="Bộ đề trên hệ thống" icon={FileQuestion} color={c.thongChu} background={c.thongNhat} />
        <Metric label="Đoạn tư liệu AI" value={d.ai_chunks} hint="Tư liệu cho Tiểu Tướng" icon={BrainCircuit} color={c.vangChu} background={c.vangNhat} />
      </View>
      <View style={{ flexDirection: width >= 1150 ? 'row' : 'column', alignItems: width >= 1150 ? 'flex-start' : 'stretch', gap: 16 }}>
        <ContentBreakdown title="Kho lịch sử" rows={d.history} />
        <ContentBreakdown title="Nội dung học tập" rows={d.learning}>
          <View style={{ borderTopWidth: 1, borderTopColor: c.adminLine, paddingTop: 16, gap: 10 }}>
            <Txt f="bold" size={13}>Phạm vi ngân hàng câu hỏi</Txt>
            {[['system', 'Hệ thống'], ['school', 'Trường học'], ['teacher', 'Giáo viên']].map(([key, label]) => <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt size={12} color={c.muc2}>{label}</Txt><Txt size={12} f="bold">{fmt(d.questions.by_scope[key] ?? 0)}</Txt></View>)}
          </View>
        </ContentBreakdown>
      </View>
    </>}
  </View>;
}

export function DashboardUsage({ session, refreshKey, asOf }: Props) {
  const { c } = useTheme();
  const [granularity, setGranularity] = useState<Usage['granularity']>('day');
  const span = granularity === 'day' ? 30 : granularity === 'week' ? 90 : 365;
  const load = useLoad(() => api.usage(session.token, granularity, span), [session.token, granularity, refreshKey], session.expired);
  const d = load.data;
  const points = useMemo(() => {
    if (!d) return [];
    const byKey = new Map(d.items.map(item => [item.bucket, item]));
    const calendar = calendarBuckets(asOf, d.granularity, d.days);
    return (calendar.length ? calendar : d.items.map(item => item.bucket)).map((key): TrendPoint => {
      const p = byKey.get(key);
      return { key, label: shortDay(key), detail: `${d.granularity === 'week' ? 'Tuần từ ' : ''}${detail(key)}`, values: { lessons: p?.lessons ?? 0, quizzes: p?.quizzes ?? 0, battles: p?.battles ?? 0, rooms: p?.rooms ?? 0 } };
    });
  }, [d, asOf]);
  return <View testID="dashboard-usage" style={{ gap: 16 }}>
    <Heading title="Sử dụng" subtitle={`Hoạt động học tập trong ${span} ngày gần nhất`} action={<View style={{ minWidth: 200 }}><AdminSelect label="Đơn vị thời gian" testID="dashboard-usage-period" value={granularity} onChange={setGranularity} options={[{ value: 'day', label: 'Theo ngày · 30 ngày' }, { value: 'week', label: 'Theo tuần · 90 ngày' }, { value: 'month', label: 'Theo tháng · 365 ngày' }]} /></View>} />
    <ErrorNote message={load.error} />
    {load.loading && !d ? <Spinner label="Đang tải hoạt động học tập…" /> : null}
    {d && <>
      <View style={grid}>
        <Metric label="Bài học hoàn thành" value={d.totals.lessons} hint="Trong khoảng thời gian đã chọn" icon={BookOpen} color={c.thuyChu} background={c.thuyNhat} />
        <Metric label="Lượt làm quiz" value={d.totals.quizzes} hint="Trong khoảng thời gian đã chọn" icon={GraduationCap} color={c.thongChu} background={c.thongNhat} />
        <Metric label="Trận đánh, mini-game" value={d.totals.battles} hint="Trong khoảng thời gian đã chọn" icon={Swords} color={c.son} background={c.sonNhat} />
        <Metric label="Phòng thi đấu" value={d.totals.rooms} hint="Trong khoảng thời gian đã chọn" icon={Trophy} color={c.vangChu} background={c.vangNhat} />
      </View>
      <Card flat pad={20} style={{ borderRadius: 12, gap: 14 }}>
        <Txt f="bold" size={16}>Nhịp học tập</Txt>
        <TrendChart id="dashboard-learning-trend" data={points} unit="lượt" summary="Hoạt động học tập theo thời gian" series={[{ key: 'lessons', label: 'Bài học hoàn thành', color: BLUE }, { key: 'quizzes', label: 'Lượt làm quiz', color: PURPLE, dashed: true }, { key: 'battles', label: 'Trận đánh, mini-game', color: GOLD }, { key: 'rooms', label: 'Phòng thi đấu', color: GREEN, dashed: true }]} />
      </Card>
    </>}
  </View>;
}

export function DashboardAi({ session, refreshKey, asOf }: Props) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const load = useLoad(() => api.aiUsage(session.token, days), [session.token, days, refreshKey], session.expired);
  const d = load.data;
  const points = useMemo(() => {
    if (!d) return [];
    const byDay = new Map(d.series.map(point => [point.day, point.questions]));
    const calendar = calendarBuckets(asOf, 'day', d.days);
    return (calendar.length ? calendar : d.series.map(p => p.day)).map((key): TrendPoint => ({ key, label: shortDay(key), detail: detail(key), values: { questions: byDay.get(key) ?? 0 } }));
  }, [d, asOf]);
  const priced = d && (d.price.price_in > 0 || d.price.price_out > 0);
  const top = Math.max(1, ...(d?.topics ?? []).map(topic => topic.asked));
  return <View testID="dashboard-ai" style={{ gap: 16 }}>
    <Heading title="Trợ lý AI" subtitle="Mức sử dụng Tiểu Tướng, chất lượng phản hồi và chi phí ước tính" action={<View style={{ minWidth: 180 }}><AdminSelect label="Thời gian thống kê AI" testID="dashboard-ai-period" value={days} onChange={setDays} options={[{ value: 7, label: '7 ngày gần nhất' }, { value: 30, label: '30 ngày gần nhất' }, { value: 90, label: '90 ngày gần nhất' }]} /></View>} />
    <ErrorNote message={load.error} />
    {load.loading && !d ? <Spinner label="Đang tải thống kê AI…" /> : null}
    {d && <>
      <View style={grid}>
        <Metric label="Câu hỏi Tiểu Tướng" value={d.questions} hint={`${fmt(d.users)} người dùng AI`} icon={MessageSquare} color={c.thuyChu} background={c.thuyNhat} />
        <Metric label="Tỉ lệ từ chối" value={d.refusal_rate == null ? '—' : `${d.refusal_rate}%`} hint={`${fmt(d.refused)}/${fmt(d.answers)} câu trả lời`} icon={ShieldAlert} color={c.son} background={c.sonNhat} />
        <Metric label="Token đã dùng" value={d.tokens_in + d.tokens_out} hint={`${fmt(d.tokens_in)} vào · ${fmt(d.tokens_out)} ra`} icon={BrainCircuit} color={c.thongChu} background={c.thongNhat} />
        <Metric label="Chi phí ước tính" value={priced ? `${d.cost_usd.toLocaleString('vi-VN', { maximumFractionDigits: 4 })} USD` : 'Chưa có giá'} hint={priced ? `${fmt(d.llm_answers)} câu do mô hình viết` : 'Chưa có dữ liệu giá để ước tính'} icon={Banknote} color={c.vangChu} background={c.vangNhat} />
      </View>
      <Card flat pad={14} style={{ borderRadius: 12 }}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
        {[['Người dùng AI', d.users], ['Câu trả lời', d.answers], ['Do mô hình viết', d.llm_answers], ['Câu bị báo sai', d.reported]].map(([label, value]) => <View key={label} style={{ flex: 1, minWidth: 120, gap: 4 }}><Txt size={11} color={c.muc3}>{label}</Txt><Txt size={16} f="bold">{fmt(Number(value))}</Txt></View>)}
      </View></Card>
      <View style={{ flexDirection: width >= 1250 ? 'row' : 'column', gap: 16 }}>
        <Card flat pad={20} style={{ flex: width >= 1250 ? 2 : undefined, minWidth: 0, borderRadius: 12, gap: 14 }}>
          <Txt f="bold" size={16}>Câu hỏi theo ngày</Txt>
          <TrendChart id="dashboard-ai-trend" data={points} unit="câu hỏi" summary="Số câu hỏi gửi Tiểu Tướng theo ngày" series={[{ key: 'questions', label: 'Câu hỏi Tiểu Tướng', color: PURPLE }]} />
        </Card>
        <Card flat pad={20} style={{ flex: width >= 1250 ? 1 : undefined, minWidth: 0, borderRadius: 12, gap: 16 }}>
          <Txt f="bold" size={16}>Tư liệu được hỏi nhiều</Txt>
          {!d.topics.length && <Txt size={12} color={c.muc3}>Chưa có câu hỏi được trả lời bằng tư liệu.</Txt>}
          {d.topics.map((topic, i) => <View key={`${topic.kind}-${topic.id}`} style={{ gap: 6 }}><View style={{ flexDirection: 'row', gap: 8 }}><Txt size={12} color={c.muc2} style={{ flex: 1 }}>{i + 1}. {topic.title}</Txt><Txt f="bold" size={12}>{fmt(topic.asked)}</Txt></View><View style={{ height: 5, borderRadius: 3, backgroundColor: c.adminLine }}><View style={{ width: `${topic.asked / top * 100}%`, height: 5, borderRadius: 3, backgroundColor: PURPLE }} /></View></View>)}
        </Card>
      </View>
      <Txt size={11} color={c.muc3}>Chỉ thống kê số lượng và chủ đề; không hiển thị nội dung câu hỏi riêng của học sinh.</Txt>
    </>}
  </View>;
}
