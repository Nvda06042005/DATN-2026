/** Điểm mạnh/yếu, luyện tập và kế hoạch ôn tập. Gợi ý tự động chỉ được tính nền trên máy chủ, không hiển thị thành thẻ. */
import React, { useState } from 'react';
import { View } from 'react-native';
import { Dumbbell, ListChecks, RefreshCw } from 'lucide-react-native';
import * as api from '@/api/analyticsApi';
import { ErrorNote, useAction, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { StatGrid, StatTile, TopicBars, TypeBars } from '@/components/charts';
import type { Tab } from '@/components/portal/StudentNav';
import { Btn, Card, Chip, EmptyState, InfoNote, SectionTitle, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { ExamPlan, PlanTask, TopicRow } from '@/types/analytics';
import type { AttemptState } from '@/types/learning';

const WEEKDAY = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const dayText = (date: string): string => `${WEEKDAY[new Date(`${date}T00:00:00Z`).getUTCDay()]}, ${date.slice(8, 10)}/${date.slice(5, 7)}`;

export interface StudyActions {
  onTab: (tab: Tab) => void;
  /** Mở lượt luyện tập vừa được tạo */
  onAttempt: (attempt: AttemptState, title: string) => void;
}

const Strengths: React.FC<{ session: Session; refreshKey: number; actions: StudyActions }> = ({ session, refreshKey, actions }) => {
  const { c } = useTheme();
  const { token } = session;
  const data = useLoad(() => api.strengths(token), [token, refreshKey], session.expired);
  const { busy, run } = useAction(session.expired);
  const [target, setTarget] = useState<string | null>(null);
  const d = data.data;
  const go = async (topic?: TopicRow) => {
    setTarget(topic ? `${topic.type}:${topic.id}` : 'all');
    const attempt = await run(() => api.personalPractice(token, topic ? { type: topic.type, id: topic.id } : undefined));
    setTarget(null);
    if (attempt) actions.onAttempt(attempt, topic ? `Luyện: ${topic.name}` : 'Luyện các chủ đề yếu');
  };
  return (
    <View style={{ gap: 12 }}>
      <SectionTitle title="Điểm mạnh và điểm yếu" subtitle="Tỉ lệ trả lời đúng theo từng chủ đề, tính từ các câu em đã làm" />
      <ErrorNote message={data.error} />
      {data.loading && !d ? <Spinner /> : null}
      {d ? (
        <>
          <StatGrid>
            <StatTile label="Câu đã làm" value={d.overall.answered} />
            <StatTile label="Trả lời đúng" value={d.overall.accuracy === null ? null : `${d.overall.accuracy}%`} hint={`${d.overall.correct}/${d.overall.answered} câu`} tone={d.overall.accuracy !== null && d.overall.accuracy >= d.weak_threshold ? 'ngoc' : 'son'} />
            <StatTile label="Chủ đề cần ôn" value={d.weak.length} hint={`dưới ${d.weak_threshold}%`} tone={d.weak.length ? 'son' : 'ngoc'} />
          </StatGrid>
          <Card pad={14} style={{ gap: 12 }}>
            <Txt f="bold" size={16} accessibilityRole="header">Theo loại chủ đề</Txt>
            <TypeBars rows={d.by_type} />
          </Card>
          <Card pad={14} style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
              <Txt f="bold" size={16} accessibilityRole="header">Chủ đề em cần ôn thêm</Txt>
              {d.weak.length ? <Btn icon={Dumbbell} title="Luyện tất cả chủ đề yếu" tone="ngoc" size="sm" loading={busy && target === 'all'} onPress={() => go()} testID="practice-all-weak" /> : null}
            </View>
            <TopicBars rows={d.weak} empty={d.topics.length ? 'Em chưa có chủ đề nào dưới ngưỡng. Cứ giữ nhịp học đều nhé!' : `Hãy làm thêm vài câu hỏi (mỗi chủ đề từ ${d.min_answers} câu) để mình nhận ra điểm mạnh, điểm yếu của em.`}
              action={(t) => <Btn icon={Dumbbell} title="Luyện" label={`Luyện chủ đề ${t.name}`} tone="thuy" size="sm" loading={busy && target === `${t.type}:${t.id}`} onPress={() => go(t)} testID={`practice-${t.type}-${t.id}`} />} />
          </Card>
          <Card pad={14} style={{ gap: 12 }}>
            <Txt f="bold" size={16} accessibilityRole="header">Chủ đề em làm tốt</Txt>
            <TopicBars rows={d.strong} empty="Khi em đạt từ 85% ở một chủ đề, chủ đề đó sẽ hiện ở đây." />
          </Card>
          <Txt size={12} color={c.muc3}>Chủ đề cần từ {d.min_answers} câu trả lời mới được xếp mạnh hay yếu để kết quả đáng tin.</Txt>
        </>
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------------------- lộ trình ôn tập (HK.HS.097)
const TASK_TONE: Record<PlanTask['kind'], 'ngoc' | 'thuy' | 'dong' | 'vang' | 'giay'> = { practice: 'ngoc', wrong: 'dong', review: 'thuy', exam: 'vang', rest: 'giay' };
const TASK_TEXT: Record<PlanTask['kind'], string> = { practice: 'Luyện tập', wrong: 'Làm lại câu sai', review: 'Ôn bài', exam: 'Ngày làm bài', rest: 'Nghỉ ngơi' };

const ExamCard: React.FC<{ plan: ExamPlan; actions: StudyActions; onPractice: (t: PlanTask) => void; busy: boolean }> = ({ plan, actions, onPractice, busy }) => {
  const { c } = useTheme();
  return (
    <Card pad={14} style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Txt f="bold" size={17} accessibilityRole="header">{plan.title}</Txt>
        <Txt size={13} color={c.muc2}>Lớp {plan.class_name} · còn {plan.days_left} ngày</Txt>
        {plan.weak_topics.length ? <Txt size={13} color={c.sonChu}>Cần chú ý: {plan.weak_topics.map((t) => `${t.name} (${t.percent}%)`).join(', ')}</Txt> : null}
      </View>
      {plan.days.map((d, i) => (
        <View key={d.date} style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ width: 92 }}>
            <Txt f="bold" size={13} color={i === plan.days.length - 1 ? c.vangChu : c.muc}>{dayText(d.date)}</Txt>
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            {d.tasks.map((t, j) => (
              <View key={j} style={{ gap: 6, padding: 10, borderRadius: 12, backgroundColor: t.kind === 'exam' ? c.vangNhat : c.the2 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Chip text={TASK_TEXT[t.kind]} bg={c.the} fg={c.muc2} />
                  <Txt size={12} color={c.muc3}>{t.minutes} phút</Txt>
                </View>
                <Txt f="semibold" size={14}>{t.title}</Txt>
                {t.kind === 'practice' && t.topic_type && t.topic_id ? <Btn icon={Dumbbell} title="Luyện ngay" label={`Luyện ngay: ${t.title}`} tone={TASK_TONE[t.kind]} size="sm" loading={busy} onPress={() => onPractice(t)} /> : null}
                {t.kind === 'wrong' ? <Btn icon={RefreshCw} title="Mở mục luyện tập" tone={TASK_TONE[t.kind]} size="sm" onPress={() => actions.onTab('practice')} /> : null}
                {t.kind === 'exam' ? <Btn icon={ListChecks} title="Mở bài tập của lớp" tone={TASK_TONE[t.kind]} size="sm" onPress={() => actions.onTab('class')} /> : null}
              </View>
            ))}
          </View>
        </View>
      ))}
    </Card>
  );
};

const ExamPlans: React.FC<{ session: Session; refreshKey: number; actions: StudyActions }> = ({ session, refreshKey, actions }) => {
  const { token } = session;
  const data = useLoad(() => api.examPlan(token), [token, refreshKey], session.expired);
  const { busy, run } = useAction(session.expired);
  const practice = async (t: PlanTask) => {
    const attempt = await run(() => api.personalPractice(token, { type: t.topic_type!, id: t.topic_id! }));
    if (attempt) actions.onAttempt(attempt, t.title);
  };
  return (
    <View style={{ gap: 12 }}>
      <SectionTitle title="Lộ trình ôn tập" subtitle="Kế hoạch từng ngày trước các bài giáo viên giao cho lớp" />
      <ErrorNote message={data.error} />
      {data.loading && !data.data ? <Spinner /> : null}
      {data.data && !data.data.exams.length ? <EmptyState mood="happy" title="Chưa có bài kiểm tra sắp đến" text="Khi giáo viên giao bài có hạn trong 3 tuần tới, kế hoạch ôn tập sẽ hiện ở đây." /> : null}
      {data.data?.exams.map((p) => <ExamCard key={p.assignment_id} plan={p} actions={actions} busy={busy} onPractice={practice} />)}
      {data.data?.exams.length ? <InfoNote><Txt size={13}>{data.data.note}</Txt></InfoNote> : null}
    </View>
  );
};

export const StudyPlanTab: React.FC<{ session: Session; refreshKey: number; actions: StudyActions }> = ({ session, refreshKey, actions }) => (
  <View style={{ gap: 26 }}>
    <Strengths session={session} refreshKey={refreshKey} actions={actions} />
    <ExamPlans session={session} refreshKey={refreshKey} actions={actions} />
  </View>
);
