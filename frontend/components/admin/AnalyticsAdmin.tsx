/**
 * Báo cáo và thống kê cho quản trị (Sprint 10): quản trị trường xem tổng quan (HK.QT.006), mức độ sử dụng theo ngày / tuần / tháng (HK.QT.007), kết quả theo khối / lớp / giáo viên (HK.QT.008, 047),
 * thống kê AI (HK.QT.009), hồ sơ học sinh (HK.QT.033) và xuất báo cáo (HK.QT.048). Quản trị tổng xem toàn hệ thống (HK.AD.006–009) ; thuật toán gợi ý chỉ chạy nội bộ trên máy chủ.
 * Chi phí AI là ước tính theo giá quản trị tổng nhập ở mục Mô hình; số liệu về câu hỏi của học sinh luôn ẩn danh.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import * as api from '@/api/analyticsApi';
import { ClassAnalytics, ResultsPanel } from '@/components/admin/AnalyticsTeacher';
import { SystemDashboard } from '@/components/admin/SystemDashboard';
import { ErrorNote, Page, PageHeader, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { ColumnChart, fmtPct, shortDay, StatGrid, StatTile } from '@/components/charts';
import { Card, InfoNote, Segmented, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fmt } from '@/lib/format';
import type { Usage } from '@/types/analytics';

// ---------------------------------------------------------------------- mức độ sử dụng theo thời gian (HK.QT.007, HK.AD.007)
export const UsagePanel: React.FC<{ session: Session }> = ({ session }) => {
  const [gran, setGran] = useState<Usage['granularity']>('day');
  const data = useLoad(() => api.usage(session.token, gran), [session.token, gran], session.expired);
  const d = data.data;
  return (
    <View style={{ gap: 12 }}>
      <Segmented<Usage['granularity']> label="Đơn vị thời gian" value={gran} onChange={setGran} options={[{ value: 'day', label: 'Theo ngày (30 ngày)' }, { value: 'week', label: 'Theo tuần (90 ngày)' }, { value: 'month', label: 'Theo tháng (12 tháng)' }]} />
      <ErrorNote message={data.error} />
      {data.loading && !d ? <Spinner /> : null}
      {d ? (
        <>
          <StatGrid>
            <StatTile label="Bài học hoàn thành" value={fmt(d.totals.lessons)} tone="ngoc" />
            <StatTile label="Bài quiz đã làm" value={fmt(d.totals.quizzes)} tone="thuy" />
            <StatTile label="Trận đánh, mini-game" value={fmt(d.totals.battles)} tone="vang" />
            <StatTile label="Phòng thi đấu" value={fmt(d.totals.rooms)} />
          </StatGrid>
          <Card pad={14} style={{ gap: 10 }}>
            <Txt f="bold" size={16} accessibilityRole="header">Hoạt động học tập</Txt>
            <ColumnChart height={150} unit="lượt" summary={`Biểu đồ hoạt động học tập ${gran === 'day' ? 'theo ngày' : gran === 'week' ? 'theo tuần' : 'theo tháng'}`}
              data={d.items.map((i) => ({ label: shortDay(i.bucket), values: { lessons: i.lessons, quizzes: i.quizzes, battles: i.battles, rooms: i.rooms } }))}
              series={[{ key: 'lessons', label: 'Bài học' }, { key: 'quizzes', label: 'Quiz' }, { key: 'battles', label: 'Trận đánh, mini-game' }, { key: 'rooms', label: 'Phòng thi đấu' }]} />
          </Card>
        </>
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------------------- sử dụng AI (HK.QT.009, HK.AD.008)
export const AiUsagePanel: React.FC<{ session: Session; money?: boolean }> = ({ session, money }) => {
  const { c } = useTheme();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const data = useLoad(() => api.aiUsage(session.token, days), [session.token, days], session.expired);
  const d = data.data;
  return (
    <View style={{ gap: 12 }}>
      <Segmented<7 | 30 | 90> label="Khoảng thời gian" value={days} onChange={setDays} options={[{ value: 7, label: '7 ngày' }, { value: 30, label: '30 ngày' }, { value: 90, label: '90 ngày' }]} />
      <ErrorNote message={data.error} />
      {data.loading && !d ? <Spinner /> : null}
      {d ? (
        <>
          <StatGrid>
            <StatTile label="Câu hỏi Tiểu Tướng" value={fmt(d.questions)} hint={`${d.users} học sinh, giáo viên`} tone="thuy" />
            <StatTile label="Câu bị từ chối" value={fmtPct(d.refusal_rate)} hint={`${d.refused}/${d.answers} câu trả lời`} tone={d.refusal_rate !== null && d.refusal_rate > 40 ? 'son' : undefined} />
            <StatTile label="Token đã dùng" value={fmt(d.tokens_in + d.tokens_out)} hint={`${fmt(d.tokens_in)} vào · ${fmt(d.tokens_out)} ra`} />
            <StatTile label="Câu bị báo sai" value={d.reported} tone={d.reported ? 'son' : 'ngoc'} />
            {money ? <StatTile label="Chi phí ước tính" value={d.price.price_in || d.price.price_out ? `${d.cost_usd.toLocaleString('vi-VN', { maximumFractionDigits: 4 })} USD` : 'Chưa nhập giá'} hint={d.price.price_in || d.price.price_out ? `${d.llm_answers} câu do mô hình viết` : 'Nhập giá token ở mục Trợ lý AI → Mô hình'} /> : null}
            {d.quota ? <StatTile label="Lượt còn lại hôm nay" value={d.quota.remaining} hint={`đã dùng ${d.quota.used_today}/${d.quota.limit} của trường`} tone={d.quota.remaining < d.quota.limit * 0.1 ? 'son' : 'ngoc'} /> : null}
          </StatGrid>
          <Card pad={14} style={{ gap: 10 }}>
            <Txt f="bold" size={16} accessibilityRole="header">Câu hỏi theo ngày</Txt>
            <ColumnChart height={120} unit="câu hỏi" summary="Biểu đồ số câu hỏi gửi Tiểu Tướng theo ngày" data={d.series.map((s) => ({ label: shortDay(s.day), values: { questions: s.questions } }))} series={[{ key: 'questions', label: 'Câu hỏi' }]} />
          </Card>
          <Card pad={14} style={{ gap: 6 }}>
            <Txt f="bold" size={16} accessibilityRole="header">Tư liệu được hỏi nhiều nhất</Txt>
            {d.topics.length ? d.topics.map((t, i) => <Txt key={`${t.kind}${t.id}`} size={14}>{i + 1}. {t.title} <Txt size={12} color={c.muc3}>({t.asked} lượt)</Txt></Txt>) : <Txt size={14} color={c.muc2}>Chưa có câu hỏi nào được trả lời bằng tư liệu.</Txt>}
          </Card>
          <InfoNote><Txt size={13}>Chỉ thống kê số lượng và chủ đề; nội dung câu hỏi của từng học sinh không hiển thị ở đây.</Txt></InfoNote>
        </>
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------------------- quản trị trường (HK.QT.006–009, 033, 047–048)
type SchoolPart = 'overview' | 'classes' | 'results' | 'usage' | 'ai';
export const SchoolReports: React.FC<{ session: Session }> = ({ session }) => {
  const [part, setPart] = useState<SchoolPart>('overview');
  const overview = useLoad(() => api.schoolOverview(session.token), [session.token], session.expired);
  const o = overview.data;
  return (
    <Page>
      <PageHeader title="Báo cáo của trường" subtitle="Tổng quan, kết quả học tập, mức độ sử dụng và thống kê AI của trường" />
      <Segmented<SchoolPart> label="Báo cáo" value={part} onChange={setPart} options={[{ value: 'overview', label: 'Tổng quan' }, { value: 'classes', label: 'Lớp và học sinh' }, { value: 'results', label: 'Kết quả' }, { value: 'usage', label: 'Sử dụng' }, { value: 'ai', label: 'AI' }]} />
      {part === 'overview' ? (
        <>
          <ErrorNote message={overview.error} />
          {overview.loading && !o ? <Spinner /> : null}
          {o ? (
            <>
              <StatGrid>
                <StatTile label="Lớp đang hoạt động" value={o.classes} />
                <StatTile label="Giáo viên" value={o.teachers} />
                <StatTile label="Học sinh" value={o.students} />
                <StatTile label="Hành trình đang chạy" value={o.journeys_running} tone="thuy" />
                <StatTile label="Hoạt động hôm nay" value={o.activities_today} hint={`${o.active_today} người học hôm nay`} tone="ngoc" />
                <StatTile label="Người học trong 7 ngày" value={o.active_week} hint="học sinh và giáo viên có hoạt động" />
              </StatGrid>
              <InfoNote><Txt size={13}>Mở mục “Sử dụng” để xem biểu đồ hoạt động theo ngày, tuần, tháng; mục “Kết quả” để so sánh khối, lớp và giáo viên và xuất báo cáo.</Txt></InfoNote>
            </>
          ) : null}
        </>
      ) : null}
      {part === 'classes' ? <ClassAnalytics session={session} /> : null}
      {part === 'results' ? <ResultsPanel session={session} by={['class', 'grade', 'teacher']} exportable /> : null}
      {part === 'usage' ? <UsagePanel session={session} /> : null}
      {part === 'ai' ? <AiUsagePanel session={session} /> : null}
    </Page>
  );
};

// ---------------------------------------------------------------------- quản trị tổng (HK.AD.006–009, 063)
export const SystemStats: React.FC<{ session: Session }> = ({ session }) => <SystemDashboard session={session} />; // trang tổng quan tự có tiêu đề và vừa một màn hình, không đặt trong Page cuộn
