/**
 * Nhiệm vụ và hồ sơ học tập của học sinh (HK.HS.023, 037, 042, 048, 049): danh sách nhiệm vụ (mỗi nút của hành trình là một nhiệm vụ),
 * luyện lại câu đã sai, lịch sử làm bài và xem lại từng câu, ghi chú và tư liệu yêu thích, lớp học.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Clock, Flame, Heart, NotebookPen, RotateCcw, Swords, Target, Zap } from 'lucide-react-native';
import * as api from '@/api/learningApi';
import * as gameApi from '@/api/gameApi';
import { ErrorNote, Pager, useLoad, usePageSize } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Mascot } from '@/components/art';
import type { OpenDetail } from '@/components/portal/Library';
import { ClassesPanel } from '@/components/portal/LearnerHome';
import { QuestChestBadge } from '@/components/portal/PathArt';
import { Btn, Card, Chip, EmptyState, Segmented, Spinner, Stars, Txt } from '@/components/ui';
import { ON_BRIGHT } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { monthlyChallengeInfo, timeLeftLabel } from '@/lib/learning-celebration';
import { activateDemoMode, useDemoLearningState } from '@/lib/learning-path-demo';
import type { GameQuest } from '@/types/gamification';
import type { Quest } from '@/types/learning';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const MODE_TEXT: Record<string, string> = { node: 'Nút hành trình', practice: 'Luyện tập', preview: 'Làm thử' };

const QuestCard: React.FC<{ quest: Quest; onGo?: () => void }> = ({ quest, onGo }) => {
  const { c } = useTheme();
  return (
    <Card flat pad={14} style={{ gap: 6, opacity: quest.state === 'locked' ? 0.8 : 1 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <Chip text={quest.kind_label} bg={c.thuyNhat} fg={c.thuyChu} />
        <Txt size={12} color={c.muc3}>{quest.campaign_title}</Txt>
      </View>
      <Txt f="bold" size={16}>{quest.title}</Txt>
      <Txt size={14} color={c.muc2}>{quest.condition}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Txt f="bold" size={14} color={c.dongChu}>Thưởng +{quest.reward_points} điểm</Txt>
        {quest.state === 'done' ? <Stars n={quest.stars} size={16} /> : null}
        {onGo ? <Btn title="Làm nhiệm vụ" tone="ngoc" size="sm" onPress={onGo} /> : null}
      </View>
    </Card>
  );
};

const QuestMetricIcon: React.FC<{ metric: string }> = ({ metric }) => {
  if (metric === 'xp_earned') return <Zap size={24} color="#ffc800" fill="#ffc800" />;
  if (metric === 'perfect_quizzes') return <Target size={24} color="#58cc02" />;
  if (metric === 'battles_completed') return <Swords size={24} color="#ff9600" />;
  if (metric === 'lessons_completed' || metric === 'correct_answers') {
    return <Mascot size={30} mood="happy" accessory="none" />;
  }
  return <Flame size={24} color="#ff9600" fill="#ff9600" />;
};

const MonthlyQuestBanner: React.FC<{ completedCount: number }> = ({ completedCount }) => {
  const { c, dark } = useTheme();
  const info = monthlyChallengeInfo(completedCount);
  const pct = Math.round((info.done / Math.max(1, info.target)) * 100);
  return (
    <View
      testID="monthly-quest-banner"
      style={{
        borderRadius: 20,
        padding: 18,
        gap: 14,
        backgroundColor: '#e94594',
        borderWidth: 2,
        borderColor: '#c93079',
        borderBottomWidth: 5,
      }}
    >
      <View style={{ gap: 6 }}>
        <View style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#ffffff' }}>
          <Txt f="displayHeavy" size={11} color="#c93079" upper>{info.monthLabel}</Txt>
        </View>
        <Txt f="displayHeavy" size={23} color="#ffffff" accessibilityRole="header">{info.title}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Clock size={14} color="rgba(255,255,255,0.92)" />
          <Txt f="bold" size={13} color="rgba(255,255,255,0.94)">Còn {info.daysLeft} ngày</Txt>
        </View>
      </View>

      <View
        style={{
          borderRadius: 16,
          padding: 14,
          gap: 10,
          backgroundColor: dark ? '#131f24' : '#ffffff',
          borderWidth: 2,
          borderColor: dark ? '#2a3748' : 'rgba(255,255,255,0.9)',
        }}
      >
        <Txt f="bold" size={15} color={c.muc}>Hoàn thành {info.target} nhiệm vụ</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: info.target, now: info.done }}
            style={{
              flex: 1,
              height: 22,
              borderRadius: 999,
              backgroundColor: dark ? '#263449' : '#fce7f3',
              overflow: 'hidden',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${pct}%`,
                borderRadius: 999,
                backgroundColor: '#ec4899',
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  left: 8,
                  right: 8,
                  top: 4,
                  height: 4,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.35)',
                }}
              />
            </View>
            <Txt f="bold" size={12} center color={pct > 45 ? '#ffffff' : c.muc2} style={{ zIndex: 1 }}>
              {info.done} / {info.target}
            </Txt>
          </View>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              borderWidth: 2,
              borderColor: '#ec4899',
              backgroundColor: dark ? '#1e293b' : '#fdf2f8',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Mascot size={32} mood="excited" accessory="crown" />
          </View>
        </View>
      </View>
    </View>
  );
};

/** Một dòng nhiệm vụ theo đúng phong cách Duolingo: biểu tượng trái, thanh tiến độ vàng dày và rương thưởng bên phải */
const GameQuestRow: React.FC<{ quest: GameQuest; tier: 0 | 1 | 2; first?: boolean }> = ({ quest, tier, first }) => {
  const { c, dark } = useTheme();
  const current = Math.min(quest.target, Math.max(0, quest.progress));
  const done = Boolean(quest.completed_at) || current >= quest.target;
  const pct = Math.round((current / Math.max(1, quest.target)) * 100);
  const rewardText = [quest.reward_gold ? `+${quest.reward_gold} vàng` : '', quest.reward_xp ? `+${quest.reward_xp} XP` : ''].filter(Boolean).join(' · ');

  return (
    <View
      testID={`quest-row-${quest.id}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderTopWidth: first ? 0 : 2,
        borderTopColor: c.vien,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: dark ? 'rgba(255,255,255,0.06)' : c.the2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <QuestMetricIcon metric={quest.metric} />
      </View>

      <View style={{ flex: 1, gap: 7 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <Txt f="bold" size={15} style={{ flex: 1, minWidth: 140 }}>{quest.title}</Txt>
          {done ? (
            <Chip text="Hoàn thành!" bg={c.ngocNhat} fg={c.ngocChu} />
          ) : rewardText ? (
            <Txt f="bold" size={12} color={c.dongChu}>{rewardText}</Txt>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={`${quest.title}: ${current} trên ${quest.target}`}
            accessibilityValue={{ min: 0, max: quest.target, now: current }}
            style={{
              flex: 1,
              height: 20,
              borderRadius: 999,
              backgroundColor: dark ? '#263449' : c.vien,
              overflow: 'hidden',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${pct}%`,
                borderRadius: 999,
                backgroundColor: '#ffc800',
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  left: 8,
                  right: 8,
                  top: 4,
                  height: 4,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.38)',
                }}
              />
            </View>
            <Txt f="bold" size={12} center color={pct > 45 ? ON_BRIGHT : c.muc2} style={{ zIndex: 1 }}>
              {current} / {quest.target}
            </Txt>
          </View>
          <QuestChestBadge tier={tier} done={done} highlight={done} size={32} />
        </View>
      </View>
    </View>
  );
};

const QuestGroupSection: React.FC<{ title: string; resetLabel: string; items: GameQuest[] }> = ({ title, resetLabel, items }) => {
  const { c } = useTheme();
  if (items.length === 0) return null;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <Txt f="displayHeavy" size={20} accessibilityRole="header">{title}</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Clock size={15} color="#ff9600" />
          <Txt f="bold" size={13} color="#ff9600">Còn {resetLabel}</Txt>
        </View>
      </View>
      <View
        style={{
          borderRadius: 18,
          borderWidth: 2,
          borderColor: c.vien,
          backgroundColor: c.the,
          overflow: 'hidden',
        }}
      >
        {items.map((q, idx) => (
          <GameQuestRow key={q.id} quest={q} tier={(idx % 3) as 0 | 1 | 2} first={idx === 0} />
        ))}
      </View>
    </View>
  );
};

const GameQuestsPanel: React.FC<{ session: Session; refreshKey: number }> = ({ session, refreshKey }) => {
  const { c } = useTheme();
  const demo = useDemoLearningState();
  const quests = useLoad(() => gameApi.gameQuests(session.token), [session.token, refreshKey], session.expired);

  const fallbackTomorrow = useMemo(() => new Date(Date.now() + 7 * 3600_000 + 86_400_000).toISOString().slice(0, 10), []);
  const fallbackNextWeek = useMemo(() => new Date(Date.now() + 7 * 3600_000 + 7 * 86_400_000).toISOString().slice(0, 10), []);

  const useDemo = __DEV__ && demo.active;

  if (quests.loading && !quests.data && !useDemo) {
    return <Spinner label="Đang tải nhiệm vụ…" />;
  }

  const daily = useDemo ? demo.dailyQuests : (quests.data?.daily ?? []);
  const weekly = useDemo ? [] : (quests.data?.weekly ?? []);
  const dailyDone = daily.filter((q) => Boolean(q.completed_at) || q.progress >= q.target).length;
  const monthlyDone = useDemo ? demo.monthlyDone : (quests.data?.monthly?.completed ?? dailyDone);
  const dailyReset = quests.data?.resets.daily ?? fallbackTomorrow;
  const weeklyReset = quests.data?.resets.weekly ?? fallbackNextWeek;

  return (
    <View style={{ gap: 18 }}>
      {quests.error && !useDemo ? <ErrorNote message={quests.error} /> : null}
      {__DEV__ && demo.active ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: c.the2, borderWidth: 1, borderColor: c.vien }}>
          <Txt size={13} color={c.muc2}>Đang hiển thị nhiệm vụ mẫu local (__DEV__).</Txt>
          <Btn title="Dùng dữ liệu máy chủ" tone="ghost" size="sm" onPress={() => activateDemoMode(false)} />
        </View>
      ) : null}

      <MonthlyQuestBanner completedCount={monthlyDone} />

      <QuestGroupSection title="Nhiệm vụ hôm nay" resetLabel={timeLeftLabel(dailyReset)} items={daily} />

      {__DEV__ && !demo.active && !quests.loading && daily.length === 0 ? (
        <View style={{ gap: 10, padding: 14, borderRadius: 16, borderWidth: 2, borderColor: c.vien, backgroundColor: c.the }}>
          <Txt f="bold" size={15}>Chưa có nhiệm vụ ngày từ máy chủ</Txt>
          <Txt size={13} color={c.muc2}>Em có thể bật chế độ mẫu local để thử hoàn thành nhiệm vụ và mở rương nhận thưởng.</Txt>
          <View style={{ alignSelf: 'flex-start' }}>
            <Btn title="Xem thử Nhiệm vụ mẫu (local)" tone="vang" size="sm" onPress={() => activateDemoMode(true)} />
          </View>
        </View>
      ) : null}

      <QuestGroupSection title="Nhiệm vụ tuần này" resetLabel={timeLeftLabel(weeklyReset)} items={weekly} />
    </View>
  );
};

export const QuestsTab: React.FC<{ session: Session; refreshKey: number; onGo: (campaignId: number, nodeId: number) => void }> = ({ session, refreshKey, onGo }) => {
  const quests = useLoad(() => api.playQuests(session.token), [session.token, refreshKey], session.expired);
  const [view, setView] = useState<'doing' | 'done' | 'locked'>('doing');
  const list = quests.data?.[view] ?? [];
  const counts = quests.data ? { doing: quests.data.doing.length, done: quests.data.done.length, locked: quests.data.locked.length } : null;
  return (
    <View style={{ gap: 14 }}>
      <Txt f="displayHeavy" size={24} accessibilityRole="header">Nhiệm vụ của em</Txt>
      <GameQuestsPanel session={session} refreshKey={refreshKey} />
      <Txt f="displayHeavy" size={20} accessibilityRole="header">Nhiệm vụ trên bản đồ hành trình</Txt>
      <Segmented<'doing' | 'done' | 'locked'> label="Trạng thái nhiệm vụ" value={view} onChange={setView}
        options={[{ value: 'doing', label: `Đang làm${counts ? ` (${counts.doing})` : ''}` }, { value: 'done', label: `Đã xong${counts ? ` (${counts.done})` : ''}` }, { value: 'locked', label: `Chưa mở${counts ? ` (${counts.locked})` : ''}` }]} />
      <ErrorNote message={quests.error} />
      {quests.loading && !quests.data ? <Spinner /> : null}
      {quests.data && list.length === 0 ? <EmptyState mood="thinking" title={view === 'doing' ? 'Chưa có nhiệm vụ đang mở' : view === 'done' ? 'Em chưa hoàn thành nhiệm vụ nào' : 'Không còn nhiệm vụ chờ mở'} text="Nhiệm vụ này lấy từ các nút trên bản đồ hành trình." /> : null}
      {list.map((q) => <QuestCard key={q.node_id} quest={q} onGo={view === 'doing' ? () => onGo(q.campaign_id, q.node_id) : undefined} />)}
    </View>
  );
};

type Mine = 'history' | 'notes' | 'classes';

export const MyTab: React.FC<{ session: Session; refreshKey: number; onPractice: () => void; onReview: (id: number) => void; onOpen: OpenDetail }> = ({ session, refreshKey, onPractice, onReview, onOpen }) => {
  const { c } = useTheme();
  const [tab, setTab] = useState<Mine>('history');
  const [page, setPage] = useState(1);
  const size = usePageSize();
  const history = useLoad(() => api.attemptHistory(session.token, { page, limit: size }), [session.token, page, size, refreshKey], session.expired);
  const practice = useLoad(() => api.practiceInfo(session.token), [session.token, refreshKey], session.expired);
  const notes = useLoad(() => api.listNotes(session.token), [session.token, refreshKey, tab], session.expired);
  const favorites = useLoad(() => api.learnSources(session.token, { favorites: 'true' }), [session.token, refreshKey, tab], session.expired);
  return (
    <View style={{ gap: 14 }}>
      <Txt f="displayHeavy" size={24} accessibilityRole="header">Của em</Txt>
      <Card flat pad={14} style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 200 }}>
            <Txt f="bold" size={16}>Luyện lại câu đã sai</Txt>
            <Txt size={14} color={c.muc2}>{practice.data ? (practice.data.length ? `Em có ${practice.data.length} câu cần luyện. Làm đúng sẽ được cộng điểm.` : 'Em chưa có câu nào cần luyện lại.') : 'Đang tải…'}</Txt>
          </View>
          <Btn icon={RotateCcw} title="Luyện tập" tone="dong" disabled={!practice.data?.length} onPress={onPractice} testID="practice-start" />
        </View>
      </Card>
      <Segmented<Mine> label="Mục của em" value={tab} onChange={setTab} options={[{ value: 'history', label: 'Lịch sử làm bài' }, { value: 'notes', label: 'Ghi chú và yêu thích' }, { value: 'classes', label: 'Lớp học' }]} />
      {tab === 'history' ? (
        <View style={{ gap: 10 }}>
          <ErrorNote message={history.error} />
          {history.loading && !history.data ? <Spinner /> : null}
          {history.data && history.data.items.length === 0 ? <EmptyState mood="thinking" title="Em chưa làm bài nào" text="Các lần làm bài ở nút hành trình và luyện tập sẽ được lưu tại đây." /> : null}
          {(history.data?.items ?? []).map((a) => (
            <Pressable key={a.id} accessibilityRole="button" accessibilityLabel={`Xem lại bài ${a.node_title ?? a.quiz_title ?? MODE_TEXT[a.mode]}, ${a.percent} phần trăm`} onPress={() => onReview(a.id)}
              style={({ pressed }) => ({ padding: 12, borderRadius: 14, borderWidth: 2, borderColor: c.vien, backgroundColor: pressed ? c.the2 : c.the, gap: 4 })}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip text={MODE_TEXT[a.mode] ?? a.mode} bg={c.thuyNhat} fg={c.thuyChu} />
                {a.passed !== null ? <Chip text={a.passed ? 'Đạt' : 'Chưa đạt'} bg={a.passed ? c.ngocNhat : c.sonNhat} fg={a.passed ? c.ngocChu : c.sonChu} /> : null}
                <Txt size={12} color={c.muc3}>{when(a.finished_at)}</Txt>
              </View>
              <Txt f="bold" size={16}>{a.node_title ?? a.quiz_title ?? 'Luyện lại câu đã sai'}</Txt>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <Txt f="displayHeavy" size={20}>{a.percent}%</Txt>
                <Txt size={13} color={c.muc2}>Đúng {a.correct_count}, sai {a.wrong_count} · {a.points} điểm{a.duration_ms ? ` · ${Math.max(1, Math.round(a.duration_ms / 1000))} giây` : ''}</Txt>
                {a.mode === 'node' ? <Stars n={a.stars} size={14} /> : null}
              </View>
            </Pressable>
          ))}
          {history.data ? <Pager page={page} limit={size} total={history.data.total} onPage={setPage} /> : null}
        </View>
      ) : null}
      {tab === 'notes' ? (
        <View style={{ gap: 12 }}>
          <ErrorNote message={notes.error ?? favorites.error} />
          <Txt f="bold" size={16}>Ghi chú</Txt>
          {notes.data && notes.data.length === 0 ? <EmptyState mood="thinking" title="Em chưa có ghi chú nào" text="Mở một bài học hoặc tư liệu đã mở khóa để ghi chú." /> : null}
          {(notes.data ?? []).map((n) => (
            <Pressable key={`${n.ref_type}${n.ref_id}`} accessibilityRole="button" disabled={n.ref_type !== 'source'} onPress={() => onOpen('source', n.ref_id)} style={{ padding: 12, borderRadius: 14, borderWidth: 2, borderColor: c.vien, backgroundColor: c.the, gap: 2 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><NotebookPen size={16} color={c.muc2} /><Txt f="bold" size={14} style={{ flex: 1 }}>{n.title ?? (n.ref_type === 'lesson' ? 'Bài học' : 'Tư liệu')}</Txt></View>
              <Txt size={15}>{n.body}</Txt>
            </Pressable>
          ))}
          <Txt f="bold" size={16}>Tư liệu yêu thích</Txt>
          {favorites.data && favorites.data.length === 0 ? <EmptyState mood="thinking" title="Chưa có tư liệu yêu thích" text="Bấm biểu tượng trái tim ở tư liệu đã mở khóa." /> : null}
          {(favorites.data ?? []).map((s) => (
            <Pressable key={s.id} accessibilityRole="button" onPress={() => onOpen('source', s.id)} style={{ minHeight: 52, padding: 12, borderRadius: 14, borderWidth: 2, borderColor: c.dong, backgroundColor: c.the, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Heart size={18} color={c.dongChu} /><Txt f="bold" size={15} style={{ flex: 1 }}>{s.title}</Txt>
            </Pressable>
          ))}
        </View>
      ) : null}
      {tab === 'classes' ? <ClassesPanel session={session} /> : null}
    </View>
  );
};
