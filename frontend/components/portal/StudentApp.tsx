/**
 * Trang học sinh (/hoc-sinh), Sprint 3–7: trang chủ ba cuộc kháng chiến, bản đồ nhiệm vụ (kể cả bản đồ rẽ nhánh), đọc bài, làm bài, thư viện lịch sử, dòng thời gian,
 * bản đồ tương tác, kho tư liệu, nhiệm vụ, lịch sử làm bài, lớp học (đội, bài tập, kỹ năng, thông báo). Mọi tính điểm và mở khóa do máy chủ quyết định.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { BookMarked } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import * as api from '@/api/learningApi';
import * as game from '@/api/gameApi';
import * as classroom from '@/api/classroomApi';
import { errorMessage } from '@/api/client';
import { TopBar, type Session } from '@/components/auth';
import { AnimationScreen, BattleScreen, BattlesTab } from '@/components/portal/BattleKit';
import { CelebrationHost, CharacterSetup, ShareSheet } from '@/components/portal/Celebrations';
import { ClassTab, NoticeBell, type ClassSection } from '@/components/portal/ClassTab';
import { LivePlay } from '@/components/portal/LivePlay';
import { LiveTab } from '@/components/portal/LiveTab';
import { CharacterTab, CollectionTab, RankingTab, ShopTab } from '@/components/portal/GameTabs';
import { HudBar } from '@/components/portal/GameKit';
import { LearningPathTab, PracticeTab } from '@/components/portal/LearningPath';
import { DetailSheet, LibraryTab, MapTab, SourcesTab, TimelineTab } from '@/components/portal/Library';
import { LessonReader, Overlay } from '@/components/portal/LessonReader';
import { LessonSteps, ListenPlayer, Rewards } from '@/components/portal/LessonSteps';
import { MiniScreen } from '@/components/portal/MiniGames';
import { MyTab, QuestsTab } from '@/components/portal/Progress';
import { QuizPlayer, ReviewScreen } from '@/components/portal/QuizPlayer';
import { CampaignMapView, HomeTab, type NodeActions } from '@/components/portal/QuestMap';
import { StudentNav, type Dots, type Tab } from '@/components/portal/StudentNav';
import { ExplainSheet, TieuTuongTab } from '@/components/portal/TieuTuong';
import { WarCardsTab } from '@/components/portal/WarCards';
import { BattlesHub, MarchTab, StageIntroSheet, TruthSheet, WarBattleScreen } from '@/components/portal/WarPlay';
import { Btn, PaperBg, Segmented, Sheet, Spinner, Stars, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { MyAssignment, Notice } from '@/types/classroom';
import type { Hud } from '@/types/gamification';
import type { AttemptState, AttemptSummary, MenuDots, NodeResult } from '@/types/learning';
import type { BattleView } from '@/types/war';

const VIEW_EVENT: Partial<Record<Tab, string>> = { library: 'view_library', timeline: 'view_timeline', map: 'view_map' };
/** Màn hình có bố cục sidebar từ chiều rộng này */
const WIDE = 900;

type Overlayed =
  | { kind: 'lesson'; nodeId: number; title: string; assignmentId?: number; scroll?: boolean }
  | { kind: 'listen'; nodeId: number; title: string }
  | { kind: 'quiz'; attempt: AttemptState; title: string; nodeId: number | null; assignmentId?: number }
  | { kind: 'review'; id: number }
  | { kind: 'battle'; scenarioId: number; title: string; restart?: boolean }
  | { kind: 'anim'; scenarioId: number; title: string }
  | { kind: 'mini'; id: number; title: string; restart?: boolean; assignmentId?: number }
  | { kind: 'live'; roomId: number; title: string }
  | { kind: 'war'; battle: BattleView };

export const StudentApp: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const toast = useToast();
  const { token } = session;
  // Mã QR của phòng thi mở trang này kèm ?pin=…: vào thẳng tab Thi đấu với mã đã điền sẵn
  const { pin: linkPin } = useLocalSearchParams<{ pin?: string }>();
  const [tab, setTab] = useState<Tab>(typeof linkPin === 'string' && /^\d{6}$/.test(linkPin) ? 'live' : 'learn');
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const [dots, setDots] = useState<MenuDots>({ practice: 0, live: 0 });
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [classSection, setClassSection] = useState<ClassSection>('classes');
  const [focusNode, setFocusNode] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [overlay, setOverlay] = useState<Overlayed | null>(null);
  const [detail, setDetail] = useState<{ type: string; id: number } | null>(null);
  const [done, setDone] = useState<NodeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [hud, setHud] = useState<Hud | null>(null);
  const [share, setShare] = useState<{ badges: number; cards: number } | null>(null);
  // Game thẻ tướng (ver0.2): chế độ hiển thị của các tab, màn đang xem giới thiệu và “Sự thật lịch sử”
  const [homeMode, setHomeMode] = useState<'march' | 'quest'>('march');
  const [collMode, setCollMode] = useState<'war' | 'badges'>('war');
  const [stageId, setStageId] = useState<number | null>(null);
  const [truthId, setTruthId] = useState<number | null>(null);
  // Hỏi Tiểu Tướng vì sao một câu làm sai (HK.HS.089)
  const [explain, setExplain] = useState<{ attemptId: number; questionId: number } | null>(null);
  const bump =useCallback(() => setRefreshKey((k) => k + 1), []);
  const loadHud = useCallback(() => { game.gameMe(token).then(setHud).catch(() => undefined); }, [token]);

  useEffect(() => { const e = VIEW_EVENT[tab]; if (e) api.viewEvent(token, e); }, [tab, token]);
  useEffect(() => { loadHud(); }, [loadHud, refreshKey]);
  useEffect(() => { api.menuDots(token).then(setDots).catch(() => undefined); }, [token, refreshKey, tab]);

  const openShare = async () => {
    const counts = await guarded(async () => { const [b, c] = await Promise.all([game.gameBadges(token), game.gameCards(token)]); return { badges: b.filter((x) => x.earned).length, cards: c.owned }; });
    if (counts) setShare(counts);
  };

  const open = (type: string, id: number) => setDetail({ type, id });
  const guarded = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    try { return await fn(); } catch (e) { toast(errorMessage(e)); return undefined; } finally { setBusy(false); }
  }, [toast]);

  const startQuiz = useCallback(async (nodeId: number, title: string) => {
    const attempt = await guarded(() => api.startNodeQuiz(token, nodeId));
    if (attempt) setOverlay({ kind: 'quiz', attempt, title, nodeId });
  }, [guarded, token]);

  const select = (t: Tab) => { setTab(t); if (t === 'home') { setCampaignId(null); setFocusNode(null); } };
  // Chấm đỏ của thanh menu: câu cần luyện lại, thẻ chưa lật, phòng thi đang mở
  const navDots: Dots = { practice: dots.practice, collection: hud?.pending_drops ?? 0, live: dots.live };

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
    onSim: (n) => setOverlay({ kind: 'battle', scenarioId: n.scenarioId, title: n.title }),
    onListen: (n) => setOverlay({ kind: 'listen', nodeId: n.id, title: n.title }),
    // Mở rương: máy chủ trao vàng và Binh thư một lần rồi mở nút kế tiếp
    onChest: async (n) => {
      const res = await guarded(() => api.completeNode(token, n.id));
      if (res) { setDone(res); bump(); }
    },
    onStage: setStageId,
  };

  // Bài tập của lớp (HK.HS.101): máy chủ tính lượt và hạn nộp; bộ đề mở lượt làm, mini-game và bài học tự xin dữ liệu khi mở
  const startAssignment = useCallback(async (a: MyAssignment) => {
    if (a.kind === 'minigame' && a.minigame_id) { setOverlay({ kind: 'mini', id: a.minigame_id, title: a.title, assignmentId: a.id }); return; }
    if (a.kind === 'lesson') { setOverlay({ kind: 'lesson', nodeId: 0, title: a.title, assignmentId: a.id }); return; }
    const started = await guarded(() => classroom.startAssignment(token, a.id));
    if (started?.kind === 'quiz') setOverlay({ kind: 'quiz', attempt: started.attempt, title: a.title, nodeId: null, assignmentId: a.id });
  }, [guarded, token]);

  // Từ thông báo đi tới đúng mục của lớp học
  const goNotice = (n: Notice) => {
    setTab('class');
    setClassSection(n.kind === 'assignment' || n.kind === 'reminder' ? 'assignments' : n.kind === 'skill' ? 'skills' : 'classes');
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
      {hud && !hud.has_character ? <CharacterSetup session={session} onDone={(next) => { setHud(next); bump(); }} /> : (
      <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column' }}>
      {wide ? <StudentNav tab={tab} wide dots={navDots} onSelect={select} /> : null}
      <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.the2 }}>
        <View style={{ flex: 1 }}><HudBar hud={hud} /></View>
        <NoticeBell session={session} refreshKey={refreshKey} onGo={goNotice} />
      </View>
      {tab === 'learn' ? <LearningPathTab session={session} refreshKey={refreshKey} actions={actions} /> : (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 56, maxWidth: 880, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        {tab === 'practice' ? <PracticeTab session={session} refreshKey={refreshKey} onPractice={startPractice} onGoLearn={() => setTab('learn')} onGoBattles={() => setTab('battles')} /> : null}
        {tab === 'shop' ? <ShopTab session={session} hud={hud} refreshKey={refreshKey} onChanged={bump} /> : null}
        {tab === 'home' && campaignId === null ? (
          <View style={{ gap: 14 }}>
            <Segmented<'march' | 'quest'> label="Kiểu chiến dịch" value={homeMode} onChange={setHomeMode} options={[{ value: 'march', label: 'Hành quân' }, { value: 'quest', label: 'Bản đồ nhiệm vụ' }]} />
            {homeMode === 'march'
              ? <MarchTab session={session} refreshKey={refreshKey} onStage={setStageId} onSource={(id) => open('source', id)} onChanged={bump} />
              : <HomeTab session={session} refreshKey={refreshKey} onOpenCampaign={(id) => { setCampaignId(id); setFocusNode(null); }} onPractice={startPractice} onNode={(cid, nid) => { setCampaignId(cid); setFocusNode(nid); }} />}
          </View>
        ) : null}
        {tab === 'home' && campaignId !== null ? <CampaignMapView session={session} campaignId={campaignId} refreshKey={refreshKey} focusNode={focusNode} actions={actions} onBack={() => { setCampaignId(null); setFocusNode(null); }} /> : null}
        {tab === 'library' ? <LibraryTab session={session} onOpen={open} /> : null}
        {tab === 'timeline' ? <TimelineTab session={session} onOpen={open} /> : null}
        {tab === 'map' ? <MapTab session={session} onOpen={open} /> : null}
        {tab === 'sources' ? <SourcesTab session={session} refreshKey={refreshKey} onOpen={open} /> : null}
        {tab === 'quests' ? <QuestsTab session={session} refreshKey={refreshKey} onGo={(cid, nid) => { setTab('home'); setCampaignId(cid); setFocusNode(nid); }} /> : null}
        {tab === 'class' ? <ClassTab session={session} hud={hud} refreshKey={refreshKey} section={classSection} onChanged={bump} onStart={startAssignment} /> : null}
        {tab === 'live' ? <LiveTab session={session} refreshKey={refreshKey} initialPin={typeof linkPin === 'string' ? linkPin : undefined} onPlay={(roomId, title) => setOverlay({ kind: 'live', roomId, title })} /> : null}
        {tab === 'battles' ? (
          <BattlesHub session={session} refreshKey={refreshKey} onIntro={setStageId}
            decision={<BattlesTab session={session} refreshKey={refreshKey} onPlay={(id, title, restart) => setOverlay({ kind: 'battle', scenarioId: id, title, restart })} onAnimation={(id, title) => setOverlay({ kind: 'anim', scenarioId: id, title })} onMini={(id, title, restart) => setOverlay({ kind: 'mini', id, title, restart })} onOpenLink={open} />} />
        ) : null}
        {tab === 'character' ? <CharacterTab session={session} hud={hud} refreshKey={refreshKey} onChanged={bump} onShare={openShare} /> : null}
        {tab === 'collection' ? (
          <View style={{ gap: 14 }}>
            <Segmented<'war' | 'badges'> label="Bộ sưu tập" value={collMode} onChange={setCollMode} options={[{ value: 'war', label: 'Thẻ tướng' }, { value: 'badges', label: 'Huy hiệu và thẻ rơi' }]} />
            {collMode === 'war' ? <WarCardsTab session={session} refreshKey={refreshKey} onChanged={bump} /> : <CollectionTab session={session} hud={hud} refreshKey={refreshKey} onChanged={bump} />}
          </View>
        ) : null}
        {tab === 'ranking' ? <RankingTab session={session} hud={hud} refreshKey={refreshKey} onChanged={bump} /> : null}
        {tab === 'ai' ? <TieuTuongTab session={session} onOpen={open} onChanged={bump} /> : null}
        {tab === 'mine' ? <MyTab session={session} refreshKey={refreshKey} onPractice={startPractice} onReview={(id) => setOverlay({ kind: 'review', id })} onOpen={open} /> : null}
      </ScrollView>
      )}
      </View>
      {!wide ? <StudentNav tab={tab} wide={false} dots={navDots} onSelect={select} /> : null}
      </View>
      )}

      {overlay?.kind === 'lesson' && (overlay.assignmentId || overlay.scroll) ? (
        <LessonReader session={session} nodeId={overlay.nodeId} assignmentId={overlay.assignmentId} title={overlay.title} onOpenLink={open} onClose={(changed) => { setOverlay(null); if (changed) bump(); }} />
      ) : null}
      {overlay?.kind === 'lesson' && !overlay.assignmentId && !overlay.scroll ? (
        <LessonSteps session={session} nodeId={overlay.nodeId} title={overlay.title} onOpenLink={open} onGameChanged={loadHud}
          onScrollMode={() => setOverlay({ ...overlay, scroll: true })} onClose={(changed) => { setOverlay(null); if (changed) bump(); }} />
      ) : null}
      {overlay?.kind === 'listen' ? (
        <ListenPlayer session={session} nodeId={overlay.nodeId} title={overlay.title} onClose={(changed) => { setOverlay(null); if (changed) bump(); }}
          onQuiz={() => { const { nodeId, title } = overlay; setOverlay(null); void startQuiz(nodeId, title); }}
          onDone={(res) => { setOverlay(null); setDone(res); bump(); }} />
      ) : null}
      {overlay?.kind === 'quiz' ? (
        <Overlay title={overlay.title} onBack={() => { setOverlay(null); bump(); }}>
          <QuizPlayer session={session} initial={overlay.attempt} title={overlay.title} onOpenLink={open} onClose={finishQuiz} hints={hud?.hints ?? 0} onGameChanged={loadHud} onExplain={(attemptId, questionId) => setExplain({ attemptId, questionId })}
            onRetry={overlay.nodeId ? () => startQuiz(overlay.nodeId!, overlay.title) : overlay.assignmentId ? () => { const id = overlay.assignmentId!; const name = overlay.title; setOverlay(null); void startAssignment({ id, kind: 'quiz', title: name } as MyAssignment); } : undefined} />
        </Overlay>
      ) : null}
      {overlay?.kind === 'battle' ? (
        <Overlay title={overlay.title} onBack={() => { setOverlay(null); bump(); }}>
          <BattleScreen session={session} scenarioId={overlay.scenarioId} restart={overlay.restart} onClose={() => { setOverlay(null); bump(); }} onAnimation={() => setOverlay({ kind: 'anim', scenarioId: overlay.scenarioId, title: overlay.title })} onOpenLink={open} />
        </Overlay>
      ) : null}
      {overlay?.kind === 'anim' ? (
        <Overlay title={`Diễn biến: ${overlay.title}`} onBack={() => setOverlay(null)}><AnimationScreen session={session} scenarioId={overlay.scenarioId} onClose={() => setOverlay(null)} /></Overlay>
      ) : null}
      {overlay?.kind === 'mini' ? (
        <Overlay title={overlay.title} onBack={() => { setOverlay(null); bump(); }}><MiniScreen session={session} id={overlay.id} restart={overlay.restart} assignmentId={overlay.assignmentId} onClose={() => { setOverlay(null); bump(); }} /></Overlay>
      ) : null}
      {overlay?.kind === 'live' ? (
        <Overlay title={overlay.title} onBack={() => { setOverlay(null); bump(); }}><LivePlay session={session} roomId={overlay.roomId} /></Overlay>
      ) : null}
      {overlay?.kind === 'war' ? (
        <Overlay title={overlay.battle.stage.title} onBack={() => { setOverlay(null); bump(); }}>
          <WarBattleScreen session={session} battleId={overlay.battle.id} initial={overlay.battle} onClose={() => { setOverlay(null); bump(); }} onTruth={setTruthId}
            onRestart={(id) => { setOverlay(null); setStageId(id); }} />
        </Overlay>
      ) : null}
      {overlay?.kind === 'review' ? (
        <Overlay title="Xem lại bài đã làm" onBack={() => setOverlay(null)}><ReviewScreen session={session} id={overlay.id} onOpenLink={open} onExplain={(attemptId, questionId) => setExplain({ attemptId, questionId })} /></Overlay>
      ) : null}
      {stageId !== null ? <StageIntroSheet key={stageId} session={session} id={stageId} onClose={() => setStageId(null)} onChanged={() => { bump(); loadHud(); }} onTruth={setTruthId} onStart={(battle) => { setStageId(null); setOverlay({ kind: 'war', battle }); }} /> : null}
      {explain ? <ExplainSheet session={session} attemptId={explain.attemptId} questionId={explain.questionId} onClose={() => setExplain(null)} onOpen={open} /> : null}
      {truthId !== null ? <TruthSheet session={session} id={truthId} onClose={() => setTruthId(null)} onSource={(id) => { setTruthId(null); open('source', id); }} /> : null}
      {detail ? <DetailSheet key={`${detail.type}${detail.id}`} session={session} type={detail.type} id={detail.id} onClose={() => setDetail(null)} onOpen={open} onChanged={bump} /> : null}
      {done ? <NodeDoneSheet result={done} onOpen={(id) => { setDone(null); open('source', id); }} onClose={() => setDone(null)} /> : null}
      {share && hud ? <ShareSheet hud={hud} badges={share.badges} cards={share.cards} onClose={() => setShare(null)} /> : null}
      {hud?.has_character && !overlay && !done && !detail ? <CelebrationHost session={session} refreshKey={refreshKey} onChanged={loadHud} /> : null}
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
        <Rewards node={result} />
        {result.next_node ? <Txt size={14} color={c.muc2} center>Nút tiếp theo đã mở: {result.next_node.title}</Txt> : null}
        {result.journey_completed ? <Txt f="bold" size={15} color={c.ngocChu} center>Em đã hoàn thành cả hành trình!</Txt> : null}
      </View>
    </Sheet>
  );
};

