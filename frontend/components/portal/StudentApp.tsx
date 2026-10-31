/**
 * Trang học sinh (/hoc-sinh), Sprint 3–4: trang chủ ba cuộc kháng chiến, bản đồ nhiệm vụ, đọc bài, làm bài, thư viện lịch sử, dòng thời gian,
 * bản đồ tương tác, kho tư liệu, nhiệm vụ, lịch sử làm bài và lớp học. Mọi tính điểm và mở khóa do máy chủ quyết định.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { BookMarked, History as HistoryIcon, Library as LibraryIcon, ListChecks, Map as MapIcon, Route, ScrollText, UserRound } from 'lucide-react-native';
import * as api from '@/api/learningApi';
import { errorMessage } from '@/api/client';
import { TopBar, type Session } from '@/components/auth';
import { DetailSheet, LibraryTab, MapTab, SourcesTab, TimelineTab } from '@/components/portal/Library';
import { LessonReader, Overlay } from '@/components/portal/LessonReader';
import { MyTab, QuestsTab } from '@/components/portal/Progress';
import { QuizPlayer, ReviewScreen } from '@/components/portal/QuizPlayer';
import { CampaignMapView, HomeTab, type NodeActions } from '@/components/portal/QuestMap';
import { Btn, PaperBg, Sheet, Spinner, Stars, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { IconType } from '@/types/game';
import type { AttemptState, AttemptSummary, NodeResult } from '@/types/learning';

type Tab = 'home' | 'library' | 'timeline' | 'map' | 'sources' | 'quests' | 'mine';
const TABS: Array<{ id: Tab; label: string; icon: IconType }> = [
  { id: 'home', label: 'Hành trình', icon: Route },
  { id: 'library', label: 'Thư viện', icon: LibraryIcon },
  { id: 'timeline', label: 'Dòng thời gian', icon: HistoryIcon },
  { id: 'map', label: 'Bản đồ', icon: MapIcon },
  { id: 'sources', label: 'Tư liệu', icon: ScrollText },
  { id: 'quests', label: 'Nhiệm vụ', icon: ListChecks },
  { id: 'mine', label: 'Của em', icon: UserRound },
];
const VIEW_EVENT: Partial<Record<Tab, string>> = { library: 'view_library', timeline: 'view_timeline', map: 'view_map' };

type Overlayed =
  | { kind: 'lesson'; nodeId: number; title: string }
  | { kind: 'quiz'; attempt: AttemptState; title: string; nodeId: number | null }
  | { kind: 'review'; id: number };

export const StudentApp: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const toast = useToast();
  const { token } = session;
  const [tab, setTab] = useState<Tab>('home');
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [focusNode, setFocusNode] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [overlay, setOverlay] = useState<Overlayed | null>(null);
  const [detail, setDetail] = useState<{ type: string; id: number } | null>(null);
  const [done, setDone] = useState<NodeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const bump = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => { const e = VIEW_EVENT[tab]; if (e) api.viewEvent(token, e); }, [tab, token]);

  const open = (type: string, id: number) => setDetail({ type, id });
  const guarded = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    try { return await fn(); } catch (e) { toast(errorMessage(e)); return undefined; } finally { setBusy(false); }
  }, [toast]);

  const startQuiz = useCallback(async (nodeId: number, title: string) => {
    const attempt = await guarded(() => api.startNodeQuiz(token, nodeId));
    if (attempt) setOverlay({ kind: 'quiz', attempt, title, nodeId });
  }, [guarded, token]);

  const actions: NodeActions = {
    onLesson: (n) => setOverlay({ kind: 'lesson', nodeId: n.id, title: n.title }),
    onQuiz: (n) => startQuiz(n.id, n.title),
    onRead: async (n) => {
      open(n.kind, n.refId);
      if (!n.done) {
        const res = await guarded(() => api.completeNode(token, n.id));
        if (res) { setDone(res); bump(); }
      }
    },
    onOpenDetail: open,
  };

  const finishQuiz = (summary?: AttemptSummary) => {
    setOverlay(null);
    bump();
    if (summary?.node_result?.journey_completed) toast('Chúc mừng em đã hoàn thành cả hành trình!');
  };

  const startPractice = async () => {
    const attempt = await guarded(() => api.startPractice(token));
    if (attempt) setOverlay({ kind: 'quiz', attempt, title: 'Luyện lại các câu đã sai', nodeId: null });
  };

  return (
    <View style={{ flex: 1 }}>
      <PaperBg />
      <TopBar session={session} subtitle="Học lịch sử cùng Hào Khí Đông A" />
      <View accessibilityRole="tablist" accessibilityLabel="Các mục học tập" style={{ backgroundColor: c.the, borderBottomWidth: 2, borderBottomColor: c.vien }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}>
          {TABS.map((t) => {
            const on = t.id === tab, Icon = t.icon;
            return (
              <Pressable key={t.id} testID={`student-tab-${t.id}`} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { setTab(t.id); if (t.id === 'home') { setCampaignId(null); setFocusNode(null); } }}
                style={{ minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, borderWidth: 2, borderColor: on ? c.ngoc : c.vien, backgroundColor: on ? c.ngocNhat : c.the }}>
                <Icon size={18} color={on ? c.ngocChu : c.muc2} />
                <Txt f={on ? 'bold' : 'semibold'} size={14} color={on ? c.ngocChu : c.muc2}>{t.label}</Txt>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 56, maxWidth: 880, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        {tab === 'home' ? (
          campaignId === null
            ? <HomeTab session={session} refreshKey={refreshKey} onOpenCampaign={(id) => { setCampaignId(id); setFocusNode(null); }} onPractice={startPractice} onNode={(cid, nid) => { setCampaignId(cid); setFocusNode(nid); }} />
            : <CampaignMapView session={session} campaignId={campaignId} refreshKey={refreshKey} focusNode={focusNode} actions={actions} onBack={() => { setCampaignId(null); setFocusNode(null); }} />
        ) : null}
        {tab === 'library' ? <LibraryTab session={session} onOpen={open} /> : null}
        {tab === 'timeline' ? <TimelineTab session={session} onOpen={open} /> : null}
        {tab === 'map' ? <MapTab session={session} onOpen={open} /> : null}
        {tab === 'sources' ? <SourcesTab session={session} refreshKey={refreshKey} onOpen={open} /> : null}
        {tab === 'quests' ? <QuestsTab session={session} refreshKey={refreshKey} onGo={(cid, nid) => { setTab('home'); setCampaignId(cid); setFocusNode(nid); }} /> : null}
        {tab === 'mine' ? <MyTab session={session} refreshKey={refreshKey} onPractice={startPractice} onReview={(id) => setOverlay({ kind: 'review', id })} onOpen={open} /> : null}
      </ScrollView>

      {overlay?.kind === 'lesson' ? (
        <LessonReader session={session} nodeId={overlay.nodeId} title={overlay.title} onOpenLink={open} onClose={(changed) => { setOverlay(null); if (changed) bump(); }} />
      ) : null}
      {overlay?.kind === 'quiz' ? (
        <Overlay title={overlay.title} onBack={() => { setOverlay(null); bump(); }}>
          <QuizPlayer session={session} initial={overlay.attempt} title={overlay.title} onOpenLink={open} onClose={finishQuiz}
            onRetry={overlay.nodeId ? () => startQuiz(overlay.nodeId!, overlay.title) : undefined} />
        </Overlay>
      ) : null}
      {overlay?.kind === 'review' ? (
        <Overlay title="Xem lại bài đã làm" onBack={() => setOverlay(null)}><ReviewScreen session={session} id={overlay.id} onOpenLink={open} /></Overlay>
      ) : null}
      {detail ? <DetailSheet key={`${detail.type}${detail.id}`} session={session} type={detail.type} id={detail.id} onClose={() => setDetail(null)} onOpen={open} onChanged={bump} /> : null}
      {done ? <NodeDoneSheet result={done} onOpen={(id) => { setDone(null); open('source', id); }} onClose={() => setDone(null)} /> : null}
      {busy ? <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: c.scrim }}><Spinner label="Đang xử lý…" /></View> : null}
    </View>
  );
};

const NodeDoneSheet: React.FC<{ result: NodeResult; onClose: () => void; onOpen: (sourceId: number) => void }> = ({ result, onClose, onOpen }) => {
  const { c } = useTheme();
  return (
    <Sheet open onClose={onClose} title="Hoàn thành nút!" footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Btn title="Tiếp tục" tone="ngoc" onPress={onClose} /></View>}>
      <View style={{ gap: 10, alignItems: 'center' }}>
        <Stars n={result.stars} size={32} />
        {result.points_awarded > 0 ? <Txt f="displayHeavy" size={24} color={c.dongChu}>+{result.points_awarded} điểm</Txt> : null}
        {result.unlocked_sources.length ? (
          <View style={{ gap: 6, alignItems: 'center' }}>
            <Txt f="bold" size={15}>Tư liệu mới được mở khóa</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>{result.unlocked_sources.map((s) => <Btn key={s.id} icon={BookMarked} title={s.title} tone="dong" size="sm" onPress={() => onOpen(s.id)} />)}</View>
          </View>
        ) : null}
        {result.next_node ? <Txt size={14} color={c.muc2} center>Nút tiếp theo đã mở: {result.next_node.title}</Txt> : null}
        {result.journey_completed ? <Txt f="bold" size={15} color={c.ngocChu} center>Em đã hoàn thành cả hành trình!</Txt> : null}
      </View>
    </Sheet>
  );
};

