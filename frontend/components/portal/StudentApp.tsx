/**
 * Trang học sinh (/hoc-sinh), Sprint 3–7: trang chủ ba cuộc kháng chiến, bản đồ nhiệm vụ (kể cả bản đồ rẽ nhánh), đọc bài, làm bài, thư viện lịch sử, dòng thời gian,
 * bản đồ tương tác, kho tư liệu, nhiệm vụ, lịch sử làm bài, lớp học (đội, bài tập, kỹ năng, thông báo). Mọi tính điểm và mở khóa do máy chủ quyết định.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, useColorScheme, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as api from '@/api/learningApi';
import * as analyticsApi from '@/api/analyticsApi';
import * as game from '@/api/gameApi';
import * as classroom from '@/api/classroomApi';
import * as platform from '@/api/platformApi';
import type { BktRecommendationItem } from '@/types/ai';
import { errorMessage } from '@/api/client';
import { TopBar, type Session } from '@/components/auth';
import { AnimationScreen, BattleScreen, BattlesTab } from '@/components/portal/BattleKit';
import { CelebrationHost, CharacterSetup, ShareSheet } from '@/components/portal/Celebrations';
import { ClassTab, type ClassSection } from '@/components/portal/ClassTab';
import { HelpCenter } from '@/components/portal/HelpCenter';
import { NoticeBell, SettingsButton } from '@/components/portal/NoticeCenter';
import { SurveyCenter } from '@/components/portal/SurveyCenter';
import { LivePlay } from '@/components/portal/LivePlay';
import { LiveTab } from '@/components/portal/LiveTab';
import { CharacterTab, CollectionTab, RankingTab, ShopTab } from '@/components/portal/GameTabs';
import { HudBar } from '@/components/portal/GameKit';
import { LearningPathTab, PracticeTab } from '@/components/portal/LearningPath';
import { DetailSheet, LibraryTab, MapTab, SourcesTab, TimelineTab } from '@/components/portal/Library';
import { LessonReader, Overlay } from '@/components/portal/LessonReader';
import { LessonCelebrationView } from '@/components/portal/LessonCelebrationView';
import { LessonSteps, ListenPlayer } from '@/components/portal/LessonSteps';
import { MiniScreen } from '@/components/portal/MiniGames';
import { MyTab, QuestsTab } from '@/components/portal/Progress';
import { QuizPlayer, ReviewScreen } from '@/components/portal/QuizPlayer';
import { CampaignMapView, HomeTab, type NodeActions } from '@/components/portal/QuestMap';
import { StudentNav, NAV_MAIN, NAV_MORE, TEMP_HIDDEN_STUDENT_TABS, type Dots, type Tab } from '@/components/portal/StudentNav';
import { AiHubDashboard } from '@/components/ai/AiHubDashboard';
import { DuolingoRightPanel } from '@/components/portal/DuolingoRightPanel';
import { StudyPlanTab } from '@/components/portal/StudyPlan';
import { ExplainSheet } from '@/components/portal/TieuTuong';
import { WarCardsTab } from '@/components/portal/WarCards';
import { BattlesHub, MarchTab, StageIntroSheet, TruthSheet, WarBattleScreen, WarReplaySheet } from '@/components/portal/WarPlay';
import { afterSheet, PaperBg, Segmented, Spinner, useToast } from '@/components/ui';
import { PALETTES } from '@/constants/theme';
import { ThemeContext, useTheme } from '@/hooks/use-theme';
import { usePortalTab } from '@/hooks/use-portal-tab';
import { accuracyTagFor, type QuestDeltaItem } from '@/lib/learning-celebration';
import { useQuestSnapshot } from '@/lib/use-lesson-celebration';
import type { MyAssignment } from '@/types/classroom';
import type { NoticeItem, PlatformConfig, Prefs } from '@/types/platform';
import type { Hud } from '@/types/gamification';
import type { AttemptState, AttemptSummary, MenuDots, NodeResult } from '@/types/learning';
import type { BattleView } from '@/types/war';

const VIEW_EVENT: Partial<Record<Tab, string>> = { library: 'view_library', timeline: 'view_timeline', map: 'view_map' };
/** Màn hình có bố cục sidebar từ chiều rộng này */
const WIDE = 900;
const DUO_WIDE = 1100;

type Overlayed =
  | { kind: 'lesson'; nodeId: number; title: string; assignmentId?: number; scroll?: boolean }
  | { kind: 'listen'; nodeId: number; title: string }
  | { kind: 'quiz'; attempt: AttemptState; title: string; nodeId: number | null; assignmentId?: number }
  | { kind: 'review'; id: number }
  | { kind: 'battle'; scenarioId: number; title: string; restart?: boolean; backToStage?: number }
  | { kind: 'anim'; scenarioId: number; title: string }
  | { kind: 'mini'; id: number; title: string; restart?: boolean; assignmentId?: number }
  | { kind: 'live'; roomId: number; title: string }
  | { kind: 'war'; battle: BattleView };

const StudentShell: React.FC<{ session: Session; prefs: Prefs | null; onPrefs: (p: Prefs) => void; cfg: PlatformConfig | null }> = ({ session, prefs, onPrefs, cfg }) => {
  const { c } = useTheme();
  const toast = useToast();
  const { token } = session;
  // Mã QR của phòng thi mở trang này kèm ?pin=…: vào thẳng tab Thi đấu với mã đã điền sẵn
  const params = useLocalSearchParams<{ pin?: string; campaign?: string; focus_node?: string; march_campaign?: string; march_point?: string }>();
  const linkPin = params.pin;
  const positive = (value: string | undefined) => value && /^\d+$/.test(value) && Number(value) > 0 ? Number(value) : null;
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const showRightPanel = wide && width >= DUO_WIDE;
  const [dots, setDots] = useState<MenuDots>({ practice: 0, live: 0 });
  const [campaignId, setCampaignId] = useState<number | null>(positive(params.campaign));
  const [classSection, setClassSection] = useState<ClassSection>('classes');
  const [focusNode, setFocusNode] = useState<number | null>(positive(params.focus_node));
  const [refreshKey, setRefreshKey] = useState(0);
  const [overlay, setOverlay] = useState<Overlayed | null>(null);
  const [detail, setDetail] = useState<{ type: string; id: number } | null>(null);
  const [done, setDone] = useState<{
    result: NodeResult;
    title: string;
    isChest: boolean;
    questDeltas: QuestDeltaItem[];
    ackIds: number[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [hud, setHud] = useState<Hud | null>(null);
  const [share, setShare] = useState<{ badges: number; cards: number } | null>(null);
  // Game thẻ tướng (ver0.2): chế độ hiển thị của các tab, màn đang xem giới thiệu và “Sự thật lịch sử”
  // Tính năng bị quản trị tắt hoặc nhóm thử nghiệm của lớp không có (Sprint 11–12): ẩn mục menu tương ứng, máy chủ vẫn kiểm tra lại
  const gam = cfg?.features.gamification !== false, ai = cfg?.features.ai !== false, flag = (k: string): boolean => cfg?.flags[k] !== false;
  const warOn = gam && flag('war_game');
  const hidden = useMemo<Tab[]>(() => [
    ...TEMP_HIDDEN_STUDENT_TABS,
    ...(gam ? [] : ['collection', 'ranking', 'quests', 'shop', 'character'] as Tab[]), ...(flag('shop') ? [] : ['shop'] as Tab[]),
    ...(ai && flag('ai_tutor') ? [] : ['ai'] as Tab[]), ...(ai && flag('recommendations') ? [] : ['study'] as Tab[]), ...(flag('live_quiz') ? [] : ['live'] as Tab[]),
  ], [gam, ai, cfg]); // eslint-disable-line react-hooks/exhaustive-deps
  const [tab, setTab] = usePortalTab<Tab>(typeof linkPin === 'string' && /^\d{6}$/.test(linkPin) ? 'live' : 'learn', [...NAV_MAIN, ...NAV_MORE].map(item => item.id).filter(id => !hidden.includes(id)));
  const [homeMode, setHomeMode] = useState<'march' | 'quest'>(warOn ? 'march' : 'quest');
  const [collMode, setCollMode] = useState<'war' | 'badges'>(warOn ? 'war' : 'badges');
  const [stageId, setStageId] = useState<number | null>(null);
  // "Ra trận" từ lộ trình học (HK.HS.124): bản đồ hành quân dừng ở đúng điểm trận đánh
  const [marchFocus, setMarchFocus] = useState<{ campaign_id: number; point_id: number } | null>(positive(params.march_campaign) && positive(params.march_point) ? { campaign_id: positive(params.march_campaign)!, point_id: positive(params.march_point)! } : null);
  const [replayId, setReplayId] = useState<number | null>(null);
  // màn giới thiệu đang tạm đóng để nhường chỗ cho bản phát lại (hai hộp thoại không mở chồng nhau)
  const [replayBack, setReplayBack] = useState<number | null>(null);
  const [truthId, setTruthId] = useState<number | null>(null);
  // Hỏi Tiểu Tướng vì sao một câu làm sai (HK.HS.089)
  const [explain, setExplain] = useState<{ attemptId: number; questionId: number } | null>(null);
  const bump =useCallback(() => setRefreshKey((k) => k + 1), []);
  const loadHud = useCallback(() => { game.gameMe(token).then(setHud).catch(() => undefined); }, [token]);
  const { captureAfter, acknowledge } = useQuestSnapshot(token, !gam, refreshKey);

  useEffect(() => { const e = VIEW_EVENT[tab]; if (e) api.viewEvent(token, e); }, [tab, token]);
  useEffect(() => { if (tab !== 'home') setMarchFocus(null); }, [tab]);
  useEffect(() => { loadHud(); }, [loadHud, refreshKey]);
  useEffect(() => { api.menuDots(token).then(setDots).catch(() => undefined); }, [token, refreshKey, tab]);

  const openShare = async () => {
    const counts = await guarded(async () => { const [b, c] = await Promise.all([game.gameBadges(token), game.gameCards(token)]); return { badges: b.filter((x) => x.earned).length, cards: c.owned }; });
    if (counts) setShare(counts);
  };

  // Từ hồ sơ trận đánh đi thẳng vào chơi (HK.HS.033): màn thẻ tướng, mô phỏng quyết định, mini-game
  const open = (type: string, id: number) => {
    if (type === 'stage') { setDetail(null); setStageId(id); return; }
    if (type === 'scenario') { setDetail(null); setOverlay({ kind: 'battle', scenarioId: id, title: 'Mô phỏng quyết định của chỉ huy' }); return; }
    if (type === 'minigame') { setDetail(null); setOverlay({ kind: 'mini', id, title: 'Mini-game lịch sử' }); return; }
    setDetail({ type, id });
  };
  const guarded = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    try { return await fn(); } catch (e) { toast(errorMessage(e)); return undefined; } finally { setBusy(false); }
  }, [toast]);

  const startQuiz = useCallback(async (nodeId: number, title: string) => {
    const attempt = await guarded(() => api.startNodeQuiz(token, nodeId));
    if (attempt) setOverlay({ kind: 'quiz', attempt, title, nodeId });
  }, [guarded, token]);

  const select = (t: Tab) => { setTab(t, { campaign: undefined, focus_node: undefined, march_campaign: undefined, march_point: undefined }); if (t === 'home') { setCampaignId(null); setFocusNode(null); } };
  // Chấm đỏ của thanh menu: câu cần luyện lại, thẻ chưa lật, phòng thi đang mở
  const navDots: Dots = { practice: dots.practice, collection: hud?.pending_drops ?? 0, live: dots.live };

  const actions: NodeActions = {
    onLesson: (n) => setOverlay({ kind: 'lesson', nodeId: n.id, title: n.title }),
    onQuiz: (n) => startQuiz(n.id, n.title),
    onRead: async (n) => {
      open(n.kind, n.refId);
      if (!n.done) {
        const out = await guarded(async () => {
          const res = await api.completeNode(token, n.id);
          const snap = await captureAfter();
          return { res, snap };
        });
        if (out) {
          setDone({ result: out.res, title: n.title, isChest: false, questDeltas: out.snap.questDeltas, ackIds: out.snap.ackIds });
          bump();
        }
      }
    },
    onOpenDetail: open,
    onSim: (n) => setOverlay({ kind: 'battle', scenarioId: n.scenarioId, title: n.title }),
    onListen: (n) => setOverlay({ kind: 'listen', nodeId: n.id, title: n.title }),
    // Mở rương: máy chủ trao vàng và Binh thư một lần rồi mở nút kế tiếp
    onChest: async (n) => {
      const out = await guarded(async () => {
        const res = await api.completeNode(token, n.id);
        const snap = await captureAfter();
        return { res, snap };
      });
      if (out) {
        setDone({ result: out.res, title: n.title, isChest: true, questDeltas: out.snap.questDeltas, ackIds: out.snap.ackIds });
        bump();
      }
    },
    onStage: (id, march) => {
      if (march && warOn) { setMarchFocus(march); setHomeMode('march'); setCampaignId(null); setFocusNode(null); setTab('home', { march_campaign: String(march.campaign_id), march_point: String(march.point_id), campaign: undefined, focus_node: undefined }); return; }
      setStageId(id);
    },
  };

  // Bài tập của lớp (HK.HS.101): máy chủ tính lượt và hạn nộp; bộ đề mở lượt làm, mini-game và bài học tự xin dữ liệu khi mở
  const startAssignment = useCallback(async (a: MyAssignment) => {
    if (a.kind === 'minigame' && a.minigame_id) { setOverlay({ kind: 'mini', id: a.minigame_id, title: a.title, assignmentId: a.id }); return; }
    if (a.kind === 'lesson') { setOverlay({ kind: 'lesson', nodeId: 0, title: a.title, assignmentId: a.id }); return; }
    const started = await guarded(() => classroom.startAssignment(token, a.id));
    if (started?.kind === 'quiz') setOverlay({ kind: 'quiz', attempt: started.attempt, title: a.title, nodeId: null, assignmentId: a.id });
  }, [guarded, token]);

  // Từ thông báo đi tới đúng mục của lớp học
  const goNotice = (n: NoticeItem) => {
    if (n.kind === 'survey') { setTab('survey'); return; }
    if (n.kind === 'support') { setTab('help'); return; }
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

  const handleAiStartPractice = async (rec: BktRecommendationItem) => {
    const topic = rec.topic_type && rec.topic_id ? { type: rec.topic_type, id: rec.topic_id } : undefined;
    const attempt = await guarded(() => (
      rec.action_kind === 'practice_wrong' && !topic
        ? api.startPractice(token)
        : analyticsApi.personalPractice(token, topic)
    ));
    if (attempt) setOverlay({ kind: 'quiz', attempt, title: `Ôn tập: ${rec.topic}`, nodeId: null });
  };

  return (
    <View style={{ flex: 1 }}>
      <PaperBg />
      <TopBar session={session} subtitle="Học lịch sử cùng Hào Khí Đông A" />
      {hud && !hud.has_character ? <CharacterSetup session={session} onDone={(next) => { setHud(next); bump(); }} /> : (
      <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column' }}>
        {wide ? <StudentNav tab={tab} wide dots={navDots} onSelect={select} hidden={hidden} /> : null}
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {/* Cột chính ở giữa */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.the2, borderBottomWidth: 1, borderBottomColor: c.vien }}>
              <View style={{ flex: 1 }}>{!showRightPanel ? <HudBar hud={hud} /> : null}</View>
              <SettingsButton session={session} prefs={prefs} onSaved={onPrefs} />
              <NoticeBell session={session} refreshKey={refreshKey} onGo={goNotice} />
            </View>
            {tab === 'learn' ? <LearningPathTab session={session} refreshKey={refreshKey} actions={actions} /> :
             tab === 'ai' ? (
               <AiHubDashboard
                 session={session}
                 onOpenSource={(id) => open('source', typeof id === 'number' ? id : parseInt(String(id), 10) || 1)}
                 onStartPractice={handleAiStartPractice}
                 onGoLearn={(nodeId) => { if (nodeId) setFocusNode(nodeId); setTab('learn'); }}
               />
             ) : (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 56, maxWidth: 880, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
              {tab === 'practice' ? <PracticeTab session={session} refreshKey={refreshKey} onPractice={startPractice} onGoLearn={() => setTab('learn')} /> : null}
              {tab === 'shop' ? <ShopTab session={session} hud={hud} refreshKey={refreshKey} onChanged={bump} /> : null}
              {tab === 'home' && campaignId === null ? (
                <View style={{ gap: 14 }}>
                  {warOn ? <Segmented<'march' | 'quest'> label="Kiểu chiến dịch" value={homeMode} onChange={setHomeMode} options={[{ value: 'march', label: 'Hành quân' }, { value: 'quest', label: 'Bản đồ nhiệm vụ' }]} /> : null}
                  {homeMode === 'march' && warOn
                    ? <MarchTab session={session} refreshKey={refreshKey} focus={marchFocus} onFocusDone={() => setMarchFocus(null)} onStage={setStageId} onSource={(id) => open('source', id)} onChanged={bump} />
                    : <HomeTab session={session} refreshKey={refreshKey} onOpenCampaign={(id) => setTab('home', { campaign: String(id), focus_node: undefined })} onPractice={startPractice} onNode={(cid, nid) => setTab('home', { campaign: String(cid), focus_node: String(nid) })} />}
                </View>
              ) : null}
              {tab === 'home' && campaignId !== null ? <CampaignMapView session={session} campaignId={campaignId} refreshKey={refreshKey} focusNode={focusNode} actions={actions} onBack={() => setTab('home', { campaign: undefined, focus_node: undefined })} /> : null}
              {tab === 'library' ? <LibraryTab session={session} onOpen={open} /> : null}
              {tab === 'timeline' ? <TimelineTab session={session} onOpen={open} /> : null}
              {tab === 'map' ? <MapTab session={session} onOpen={open} /> : null}
              {tab === 'sources' ? <SourcesTab session={session} refreshKey={refreshKey} onOpen={open} /> : null}
              {tab === 'quests' ? <QuestsTab session={session} refreshKey={refreshKey} onGo={(cid, nid) => setTab('home', { campaign: String(cid), focus_node: String(nid) })} /> : null}
              {tab === 'class' ? <ClassTab session={session} hud={hud} refreshKey={refreshKey} section={classSection} onChanged={bump} onStart={startAssignment} /> : null}
              {tab === 'live' ? <LiveTab session={session} refreshKey={refreshKey} initialPin={typeof linkPin === 'string' ? linkPin : undefined} onPlay={(roomId, title) => setOverlay({ kind: 'live', roomId, title })} /> : null}
              {tab === 'battles' ? (
                <BattlesHub session={session} refreshKey={refreshKey} onIntro={setStageId}
                  decision={<BattlesTab session={session} refreshKey={refreshKey} onPlay={(id, title, restart) => setOverlay({ kind: 'battle', scenarioId: id, title, restart })} onAnimation={(id, title) => setOverlay({ kind: 'anim', scenarioId: id, title })} onMini={(id, title, restart) => setOverlay({ kind: 'mini', id, title, restart })} onOpenLink={open} />} />
              ) : null}
              {tab === 'character' ? <CharacterTab session={session} hud={hud} refreshKey={refreshKey} onChanged={bump} onShare={openShare} /> : null}
              {tab === 'collection' ? (
                <View style={{ gap: 14 }}>
                  {warOn ? <Segmented<'war' | 'badges'> label="Bộ sưu tập" value={collMode} onChange={setCollMode} options={[{ value: 'war', label: 'Thẻ tướng' }, { value: 'badges', label: 'Huy hiệu và thẻ rơi' }]} /> : null}
                  {collMode === 'war' && warOn ? <WarCardsTab session={session} refreshKey={refreshKey} onChanged={bump} /> : <CollectionTab session={session} hud={hud} refreshKey={refreshKey} onChanged={bump} />}
                </View>
              ) : null}
              {tab === 'ranking' ? <RankingTab session={session} hud={hud} refreshKey={refreshKey} onChanged={bump} /> : null}
              {tab === 'survey' ? <SurveyCenter session={session} refreshKey={refreshKey} /> : null}
              {tab === 'help' ? <HelpCenter session={session} /> : null}
              {tab === 'study' ? <StudyPlanTab session={session} refreshKey={refreshKey} actions={{ onTab: setTab, onAttempt: (attempt, title) => setOverlay({ kind: 'quiz', attempt, title, nodeId: null }) }} /> : null}
              {tab === 'mine' ? <MyTab session={session} refreshKey={refreshKey} onPractice={startPractice} onReview={(id) => setOverlay({ kind: 'review', id })} onOpen={open} /> : null}
            </ScrollView>
            )}
          </View>

          {/* Cột thứ 3 bên phải theo chuẩn Duolingo */}
          {showRightPanel ? (
            <DuolingoRightPanel session={session} hud={hud} refreshKey={refreshKey} onGoTab={select} />
          ) : null}
        </View>
        {!wide ? <StudentNav tab={tab} wide={false} dots={navDots} onSelect={select} hidden={hidden} /> : null}
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
          onDone={async (res) => {
            const listenTitle = overlay.title;
            const snap = await captureAfter();
            setOverlay(null);
            setDone({ result: res, title: listenTitle, isChest: false, questDeltas: snap.questDeltas, ackIds: snap.ackIds });
            bump();
          }} />
      ) : null}
      {overlay?.kind === 'quiz' ? (
        <Overlay title={overlay.title} onBack={() => { setOverlay(null); bump(); }}>
          <QuizPlayer session={session} initial={overlay.attempt} title={overlay.title} onOpenLink={open} onClose={finishQuiz} hints={hud?.hints ?? 0} onGameChanged={loadHud} onExplain={(attemptId, questionId) => setExplain({ attemptId, questionId })}
            onRetry={overlay.nodeId ? () => startQuiz(overlay.nodeId!, overlay.title) : overlay.assignmentId ? () => { const id = overlay.assignmentId!; const name = overlay.title; setOverlay(null); void startAssignment({ id, kind: 'quiz', title: name } as MyAssignment); } : undefined} />
        </Overlay>
      ) : null}
      {overlay?.kind === 'battle' ? (
        <Overlay title={overlay.title} onBack={() => { const back = overlay.backToStage; setOverlay(null); bump(); if (back) setStageId(back); }}>
          <BattleScreen session={session} scenarioId={overlay.scenarioId} restart={overlay.restart} onClose={() => { const back = overlay.backToStage; setOverlay(null); bump(); if (back) setStageId(back); }} onAnimation={() => setOverlay({ kind: 'anim', scenarioId: overlay.scenarioId, title: overlay.title })} onOpenLink={open} />
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
            onRestart={(id) => { setOverlay(null); setStageId(id); }} onReplay={setReplayId} />
        </Overlay>
      ) : null}
      {overlay?.kind === 'review' ? (
        <Overlay title="Xem lại bài đã làm" onBack={() => setOverlay(null)}><ReviewScreen session={session} id={overlay.id} onOpenLink={open} onExplain={(attemptId, questionId) => setExplain({ attemptId, questionId })} /></Overlay>
      ) : null}
      {stageId !== null ? <StageIntroSheet key={stageId} session={session} id={stageId} onClose={() => setStageId(null)} onChanged={() => { bump(); loadHud(); }} onTruth={setTruthId} onStart={(battle) => { setStageId(null); setOverlay({ kind: 'war', battle }); }}
        onDecision={(scenarioId, title) => { const back = stageId; setStageId(null); setOverlay({ kind: 'battle', scenarioId, title, backToStage: back ?? undefined }); }}
        onReplay={(battleId) => { setReplayBack(stageId); setStageId(null); afterSheet(() => setReplayId(battleId)); }} /> : null}
      {replayId !== null ? <WarReplaySheet key={replayId} session={session} id={replayId} onClose={() => { const back = replayBack; setReplayId(null); setReplayBack(null); if (back !== null) afterSheet(() => setStageId(back)); }} /> : null}
      {explain ? <ExplainSheet session={session} attemptId={explain.attemptId} questionId={explain.questionId} onClose={() => setExplain(null)} onOpen={open} /> : null}
      {truthId !== null ? <TruthSheet session={session} id={truthId} onClose={() => setTruthId(null)} onSource={(id) => { setTruthId(null); open('source', id); }} /> : null}
      {detail ? <DetailSheet key={`${detail.type}${detail.id}`} session={session} type={detail.type} id={detail.id} onClose={() => setDetail(null)} onOpen={open} onChanged={bump} /> : null}
      {done ? (
        <LessonCelebrationView
          skipSummary={done.isChest}
          summary={{
            headline: done.isChest ? 'Mở rương nhận thưởng!' : 'Hoàn thành hoạt động!',
            subtitle: done.title,
            xpEarned: done.result.points_awarded,
            accuracyPercent: 100,
            accuracyTag: accuracyTagFor(100, true),
            stars: done.result.stars,
            passed: true,
            nextNodeTitle: done.result.next_node?.title ?? null,
            journeyCompleted: done.result.journey_completed,
          }}
          questDeltas={done.questDeltas}
          nodeResult={done.result}
          onOpenLink={(type, id) => {
            acknowledge(done.ackIds);
            setDone(null);
            open(type, id);
          }}
          onDone={() => {
            acknowledge(done.ackIds);
            setDone(null);
          }}
        />
      ) : null}
      {share && hud ? <ShareSheet hud={hud} badges={share.badges} cards={share.cards} onClose={() => setShare(null)} /> : null}
      {hud?.has_character && !overlay && !done && !detail ? <CelebrationHost session={session} refreshKey={refreshKey} onChanged={loadHud} /> : null}
      {busy ? <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: c.scrim }}><Spinner label="Đang xử lý…" /></View> : null}
    </View>
  );
};

/** Trang học sinh: tải cài đặt giao diện (sáng / tối / theo thiết bị) và cấu hình tính năng của tài khoản rồi dựng khung học tập */
export const StudentApp: React.FC<{ session: Session }> = ({ session }) => {
  const system = useColorScheme();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [cfg, setCfg] = useState<PlatformConfig | null>(null);
  useEffect(() => {
    platform.prefs(session.token).then(setPrefs).catch(() => undefined);
    platform.config(session.token).then(setCfg).catch(() => undefined);
  }, [session.token]);
  const dark = prefs?.theme === 'dark' || (prefs?.theme === 'system' && system === 'dark');
  const value = useMemo(() => ({ c: dark ? PALETTES.dark : PALETTES.light, dark: Boolean(dark) }), [dark]);
  return (
    <ThemeContext.Provider value={value}>
      <StudentShell session={session} prefs={prefs} onPrefs={setPrefs} cfg={cfg} />
    </ThemeContext.Provider>
  );
};

