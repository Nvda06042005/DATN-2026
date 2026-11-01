/**
 * Gợi ý học tập của học sinh (Sprint 10): "Hôm nay nên học gì" có lý do và đánh giá hữu ích / không hữu ích (HK.HS.094, 098), điểm mạnh và điểm yếu theo chủ đề (HK.HS.095),
 * luyện tập cá nhân hóa theo chủ đề yếu từ dễ đến khó (HK.HS.096) và lộ trình ôn tập trước bài kiểm tra do giáo viên giao (HK.HS.097).
 * Máy chủ tính gợi ý theo quy tắc minh bạch (cấu hình ở HK.AD.063), không gửi dữ liệu học tập ra ngoài.
 */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { CalendarClock, Dumbbell, Flame, GraduationCap, ListChecks, RefreshCw, ThumbsDown, ThumbsUp, Trophy } from 'lucide-react-native';
import * as api from '@/api/analyticsApi';
import { ErrorNote, useAction, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { StatGrid, StatTile, TopicBars, TypeBars } from '@/components/charts';
import type { Tab } from '@/components/portal/StudentNav';
import { Btn, Card, Chip, EmptyState, InfoNote, SectionTitle, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { ExamPlan, PlanTask, RecoItem, RecoKind, TopicRow } from '@/types/analytics';
import type { AttemptState } from '@/types/learning';

const KIND_ICON = { continue: GraduationCap, weak_topic: Dumbbell, review: RefreshCw, assignment: CalendarClock, streak: Flame } as const;
const WEEKDAY = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const dayText = (date: string): string => `${WEEKDAY[new Date(`${date}T00:00:00Z`).getUTCDay()]}, ${date.slice(8, 10)}/${date.slice(5, 7)}`;
const timeText = (iso: string | null): string => (iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) : '');

export interface StudyActions {
  /** Mở một nút của hành trình (học tiếp, ôn lại) */
  onNode: (campaignId: number | null, nodeId: number) => void;
  onTab: (tab: Tab) => void;
  /** Mở lượt luyện tập vừa được tạo */
  onAttempt: (attempt: AttemptState, title: string) => void;
}

const Rate: React.FC<{ item: RecoItem; onRate: (value: 'helpful' | 'not_helpful' | null) => void; busy: boolean }> = ({ item, onRate, busy }) => {
  const { c } = useTheme();
  const opt = (value: 'helpful' | 'not_helpful', label: string, Icon: typeof ThumbsUp) => {
    const on = item.feedback === value;
    return (
      <Pressable key={value} testID={`reco-${value}-${item.id}`} accessibilityRole="button" accessibilityState={{ selected: on, disabled: busy }} accessibilityLabel={`${label} (đánh giá gợi ý ${item.title})`} disabled={busy} onPress={() => onRate(on ? null : value)}
        style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: 2, borderColor: on ? (value === 'helpful' ? c.ngoc : c.son) : c.vien, backgroundColor: on ? (value === 'helpful' ? c.ngocNhat : c.sonNhat) : pressed ? c.the2 : c.the })}>
        <Icon size={16} color={on ? (value === 'helpful' ? c.ngocChu : c.sonChu) : c.muc2} />
        <Txt f="semibold" size={13} color={on ? (value === 'helpful' ? c.ngocChu : c.sonChu) : c.muc2}>{label}</Txt>
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <Txt size={12} color={c.muc3}>Gợi ý này</Txt>
      {opt('helpful', 'Hữu ích', ThumbsUp)}
      {opt('not_helpful', 'Chưa hữu ích', ThumbsDown)}
    </View>
  );
};

// ---------------------------------------------------------------------- hôm nay nên học gì (HK.HS.094, 098)
const Today: React.FC<{ session: Session; refreshKey: number; actions: StudyActions }> = ({ session, refreshKey, actions }) => {
  const { c } = useTheme();
  const { token } = session;
  const list = useLoad(() => api.recommendations(token), [token, refreshKey], session.expired);
  const { busy, run } = useAction(session.expired);
  const [rating, setRating] = useState<number | null>(null);

  const refresh = async () => { const next = await run(() => api.refreshRecommendations(token), 'Đã cập nhật gợi ý'); if (next) list.setData(next); };
  const rate = async (item: RecoItem, value: 'helpful' | 'not_helpful' | null) => {
    setRating(item.id);
    const ok = await run(() => api.rateRecommendation(token, item.id, value), value ? 'Cảm ơn em, mình sẽ ghi nhớ' : undefined);
    setRating(null);
    if (ok && list.data) list.setData({ ...list.data, items: list.data.items.map((i) => (i.id === item.id ? { ...i, feedback: value } : i)) });
  };
  const practice = async (item: RecoItem) => {
    if (!item.ref_type || !item.ref_id) return;
    const attempt = await run(() => api.personalPractice(token, { type: item.ref_type!, id: item.ref_id! }));
    if (attempt) actions.onAttempt(attempt, 'Luyện chủ đề yếu');
  };
  const act = (item: RecoItem): React.ReactNode => {
    const kind: RecoKind = item.kind;
    if (kind === 'weak_topic') return <Btn icon={Dumbbell} title="Luyện chủ đề này" tone="ngoc" loading={busy && rating === null} onPress={() => practice(item)} testID={`reco-go-${item.id}`} />;
    if (kind === 'continue' || kind === 'review') return <Btn icon={KIND_ICON[kind]} title={kind === 'continue' ? 'Học tiếp ngay' : 'Ôn lại nút này'} tone={kind === 'continue' ? 'ngoc' : 'thuy'} onPress={() => actions.onNode(item.campaign_id, item.ref_id!)} testID={`reco-go-${item.id}`} />;
    if (kind === 'assignment') return <Btn icon={ListChecks} title="Mở bài tập" tone="dong" onPress={() => actions.onTab('class')} testID={`reco-go-${item.id}`} />;
    return <Btn icon={Flame} title="Luyện nhanh vài câu" tone="dong" onPress={() => actions.onTab('practice')} testID={`reco-go-${item.id}`} />;
  };

  return (
    <View style={{ gap: 12 }}>
      <SectionTitle title="Hôm nay nên học gì?" subtitle={list.data?.generated_at ? `Cập nhật lúc ${timeText(list.data.generated_at)}, tự làm mới sau mỗi ${list.data.refresh_hours} giờ` : 'Gợi ý theo kết quả học của em'}
        action={<Btn icon={RefreshCw} label="Làm mới gợi ý" tone="giay" size="sm" loading={busy && rating === null} onPress={refresh} testID="reco-refresh" />} />
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner label="Đang chọn việc cho em…" /> : null}
      {list.data && !list.data.items.length ? <EmptyState mood="thinking" title="Chưa có gợi ý" text="Em hãy học một bài hoặc làm vài câu hỏi, mình sẽ gợi ý việc nên làm tiếp." /> : null}
      {list.data?.items.map((item, i) => {
        const Icon = KIND_ICON[item.kind];
        return (
          <Card key={item.id} pad={14} style={{ gap: 10, borderColor: i === 0 ? c.ngoc : undefined }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Chip text={item.kind_label} bg={i === 0 ? c.ngocNhat : c.the2} fg={i === 0 ? c.ngocChu : c.muc2} icon={Icon} />
              {i === 0 ? <Chip text="Nên làm trước" bg={c.vangNhat} fg={c.vangChu} icon={Trophy} /> : null}
            </View>
            <Txt f="bold" size={17} accessibilityRole="header">{item.title}</Txt>
            <Txt size={14} color={c.muc2} style={{ lineHeight: 21 }}>Vì sao gợi ý: {item.reason}</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
              {act(item)}
              <Rate item={item} busy={busy && rating === item.id} onRate={(v) => rate(item, v)} />
            </View>
          </Card>
        );
      })}
    </View>
  );
};

// ---------------------------------------------------------------------- điểm mạnh, điểm yếu và luyện tập (HK.HS.095, 096)
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
    <Today session={session} refreshKey={refreshKey} actions={actions} />
    <Strengths session={session} refreshKey={refreshKey} actions={actions} />
    <ExamPlans session={session} refreshKey={refreshKey} actions={actions} />
  </View>
);
