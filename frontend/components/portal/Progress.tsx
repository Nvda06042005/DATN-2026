/**
 * Nhiệm vụ và hồ sơ học tập của học sinh (HK.HS.023, 037, 042, 048, 049): danh sách nhiệm vụ (mỗi nút của hành trình là một nhiệm vụ),
 * luyện lại câu đã sai, lịch sử làm bài và xem lại từng câu, ghi chú và tư liệu yêu thích, lớp học.
 */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Heart, NotebookPen, RotateCcw } from 'lucide-react-native';
import * as api from '@/api/learningApi';
import * as gameApi from '@/api/gameApi';
import { ErrorNote, Pager, useLoad, usePageSize } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import type { OpenDetail } from '@/components/portal/Library';
import { ClassesPanel } from '@/components/portal/LearnerHome';
import { Bar, Btn, Card, Chip, EmptyState, Segmented, Spinner, Stars, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
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

/** Nhiệm vụ ngày và tuần (HK.HS.024): máy chủ giao theo ngày/tuần, tự cộng thưởng khi đủ tiến độ */
const GameQuestRow: React.FC<{ quest: GameQuest }> = ({ quest }) => {
  const { c } = useTheme();
  const done = Boolean(quest.completed_at);
  return (
    <Card flat pad={12} style={{ gap: 6, borderColor: done ? c.ngoc : c.vien }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Txt f="bold" size={15} style={{ flex: 1, minWidth: 160 }}>{quest.title}</Txt>
        {done ? <Chip text="Đã xong" bg={c.ngocNhat} fg={c.ngocChu} /> : null}
      </View>
      <Bar value={Math.min(quest.progress, quest.target)} max={quest.target} height={10} fill={done ? c.ngoc : c.dong} label={`${quest.title}: ${Math.min(quest.progress, quest.target)} trên ${quest.target}`} />
      <Txt size={13} color={c.muc2}>{Math.min(quest.progress, quest.target)}/{quest.target} · Thưởng {[quest.reward_xp ? `${quest.reward_xp} điểm` : '', quest.reward_gold ? `${quest.reward_gold} vàng` : ''].filter(Boolean).join(' và ')}</Txt>
    </Card>
  );
};

const GameQuestsPanel: React.FC<{ session: Session; refreshKey: number }> = ({ session, refreshKey }) => {
  const { c } = useTheme();
  const quests = useLoad(() => gameApi.gameQuests(session.token), [session.token, refreshKey], session.expired);
  if (!quests.data) return quests.error ? <ErrorNote message={quests.error} /> : null;
  // Máy chủ trả mốc làm mới là ngày theo giờ Việt Nam (0 giờ của ngày đó)
  const left = (day: string) => { const h = Math.max(0, Math.round((new Date(`${day}T00:00:00+07:00`).getTime() - Date.now()) / 3_600_000)); return h >= 48 ? `${Math.round(h / 24)} ngày` : `${h} giờ`; };
  return (
    <View style={{ gap: 10 }}>
      <Txt f="bold" size={16}>Nhiệm vụ hôm nay <Txt size={13} color={c.muc3}>(làm mới sau {left(quests.data.resets.daily)})</Txt></Txt>
      {quests.data.daily.map((q) => <GameQuestRow key={q.id} quest={q} />)}
      <Txt f="bold" size={16}>Nhiệm vụ tuần này <Txt size={13} color={c.muc3}>(làm mới sau {left(quests.data.resets.weekly)})</Txt></Txt>
      {quests.data.weekly.map((q) => <GameQuestRow key={q.id} quest={q} />)}
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
