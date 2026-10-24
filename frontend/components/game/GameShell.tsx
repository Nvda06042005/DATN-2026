/**
 * Game học sinh "Hào Khí Đông A": tải tiến độ + trạng thái game từ server, tự lưu (gom thay đổi 1,2 giây), thanh HUD,
 * 5 tab (Điền Trang, Doanh Trại, Chiến Dịch, Quốc Tử Giám, Sử Ký), thế giới 2D Hành Trình Đông A, hồ sơ – cài đặt, hướng dẫn, thi đấu cả lớp.
 * XP và Ấn Tín chỉ do server cộng khi chấm câu trả lời; trạng thái game (công trình, tướng, sao chiến dịch) lưu qua PUT /api/student/game.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, Pressable, ScrollView, View, useColorScheme, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft, ChevronRight, Flame, Gamepad2, HelpCircle, KeyRound, LogOut, Medal, Monitor, Moon, RefreshCw, Shield, Sparkles, Stamp, Sun, Timer, Volume2, VolumeX, Wheat } from 'lucide-react-native';
import * as studentApi from '@/api/studentApi';
import { ApiError, errorMessage } from '@/api/client';
import { BrandLogo, Mascot, type MascotAccessory, type MascotMood } from '@/components/art';
import type { Session } from '@/components/auth';
import { BarracksTab } from '@/components/game/BarracksTab';
import { CampaignTab } from '@/components/game/CampaignTab';
import { CodexTab } from '@/components/game/CodexTab';
import { ExamTab } from '@/components/game/ExamTab';
import { FarmTab } from '@/components/game/FarmTab';
import { LiveArena } from '@/components/game/LiveArena';
import { WorldScreen } from '@/components/game/WorldScreen';
import { Avatar, Bar, Btn, Card, HudPill, PaperBg, Segmented, Sheet, Spinner, ToggleRow, Txt, useToast } from '@/components/ui';
import { PHASES } from '@/constants/campaigns';
import { GAME_TABS, qtgFood, storeCap, troopCap } from '@/constants/game';
import { HEROES } from '@/constants/heroes';
import { PALETTES } from '@/constants/theme';
import { GameContext, useGame } from '@/hooks/use-game';
import { ReduceMotionContext, useReduceMotion } from '@/hooks/use-motion';
import { ThemeContext, useTheme } from '@/hooks/use-theme';
import { fmt, shortName } from '@/lib/format';
import { finalizeUpgrades, levelOf, levelXp, restoreGameState, todayKey } from '@/lib/game-state';
import { playTone } from '@/lib/sound';
import { readLiveRoom } from '@/lib/storage';
import type { AnswerPayload, CodexEntry, LeaderboardEntry, LearnerProgress, QuestionRequest, QuestionsResponse, ServedQuestion } from '@/types/api';
import type { DailyTaskDef, GameCtx, GameSettings, GameState, GameTab } from '@/types/game';

interface Initial {
  progress: LearnerProgress;
  state: GameState;
  codex: CodexEntry[];
}

/** Tải dữ liệu game rồi mới vào Điền Trang */
export const GameShell: React.FC<{ session: Session; initialPin: string | null }> = ({ session, initialPin }) => {
  const { token, expired } = session;
  const [data, setData] = useState<Initial | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([studentApi.getProgress(token), studentApi.getGameState(token), studentApi.getCodex(token).catch(() => [] as CodexEntry[])])
      .then(([progress, game, codex]) => setData({ progress, state: restoreGameState(game.state), codex }))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) expired();
        else setError(errorMessage(err, 'Không tải được dữ liệu game'));
      });
  }, [token, expired]);

  useEffect(() => {
    load();
  }, [load]);

  if (error || !data)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 }}>
        <PaperBg />
        <Mascot size={error ? 120 : 130} mood={error ? 'sad' : 'happy'} accessory={error ? 'none' : 'conical'} bob={!error} />
        {error ? (
          <>
            <Txt f="display" size={20} center>
              {error}
            </Txt>
            <Btn title="Thử lại" icon={RefreshCw} tone="ngoc" onPress={load} />
          </>
        ) : (
          <Spinner label="Đang mở Điền Trang Đông A…" />
        )}
      </View>
    );
  return <GameApp session={session} initial={data} initialPin={initialPin} />;
};

const GameApp: React.FC<{ session: Session; initial: Initial; initialPin: string | null }> = ({ session, initial, initialPin }) => {
  const { token, user, expired } = session;
  const toast = useToast();
  const systemScheme = useColorScheme();
  const systemReduce = useReduceMotion();
  const [state, setState] = useState<GameState>(initial.state);
  const [progress, setProgress] = useState<LearnerProgress>(initial.progress);
  const [tab, setTabRaw] = useState<GameTab>('farm');
  const [sub, setSub] = useState<Record<string, string>>({ barracks: 'heroes', codex: 'timeline' });
  const [pendingAsk, setPendingAsk] = useState<string | null>(null);
  const [profile, setProfile] = useState(false);
  const [tutorial, setTutorial] = useState(!initial.state.tutorial);
  const [live, setLive] = useState<{ pin: string | null; resume: boolean } | null>(() => (initialPin ? { pin: initialPin, resume: false } : readLiveRoom() ? { pin: null, resume: true } : null));
  const [worldOpen, setWorldOpen] = useState(false);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const firstSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(state);
  const saveFailed = useRef(false);
  const dirty = useRef(false);

  const dark = state.settings.theme === 'dark' || (state.settings.theme === 'system' && systemScheme === 'dark');
  const theme = useMemo(() => ({ c: dark ? PALETTES.dark : PALETTES.light, dark }), [dark]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', dark ? '#0b1220' : '#fbf6ea');
    document.body.style.background = dark ? '#0b1220' : '';
    return () => {
      document.body.style.background = '';
      meta?.setAttribute('content', '#fbf6ea');
    };
  }, [dark]);

  const setTab = useCallback((t: GameTab, s?: string) => {
    setTabRaw(t);
    if (s) setSub((cur) => ({ ...cur, [t]: s }));
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const update = useCallback((fn: (s: GameState) => GameState) => setState((s) => fn(s)), []);

  // Sang ngày mới: làm mới nhiệm vụ ngày; hoàn tất công trình đã thi công xong
  useEffect(() => {
    const tick = () =>
      setState((s) => {
        let next = finalizeUpgrades(s, Date.now());
        if (next.daily.day !== todayKey()) next = { ...next, daily: { day: todayKey(), progress: {}, claimed: [] } };
        return next;
      });
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const flush = useCallback(
    () =>
      studentApi.putGameState(token, latest.current).then(
        () => {
          dirty.current = false;
          saveFailed.current = false;
        },
        (err) => {
          if (err instanceof ApiError && err.status === 401) expired();
          else if (!saveFailed.current) toast('Chưa lưu được tiến độ game – sẽ tự thử lại khi có thay đổi');
          saveFailed.current = true;
        },
      ),
    [token, expired, toast],
  );

  // Tự lưu trạng thái game lên server (gom thay đổi trong 1,2 giây)
  useEffect(() => {
    latest.current = state;
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    dirty.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 1200);
  }, [state, flush]);

  // Ra nền / đóng tab: lưu nốt thay đổi chưa kịp gửi
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' && dirty.current) flush();
    });
    const onHide = () => {
      if (document.visibilityState === 'hidden' && dirty.current) flush();
    };
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', onHide);
    return () => {
      sub.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', onHide);
      if (dirty.current) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        flush();
      }
    };
  }, [flush]);

  /** Gọi API bằng phiên của học sinh; hết phiên (401) thì đưa về màn đăng nhập */
  const request = useCallback(
    async <T,>(call: (token: string) => Promise<T>) => {
      try {
        return await call(token);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) expired();
        throw err;
      }
    },
    [token, expired],
  );

  const seenRef = useRef(state.seen);
  useEffect(() => {
    seenRef.current = state.seen;
  }, [state.seen]);

  const fetchQuestions = useCallback(
    async (req: QuestionRequest): Promise<QuestionsResponse> => {
      if (req.ai) return request((t) => studentApi.getAiQuestions(t, req.units?.[0] ?? null, req.count));
      const params: Record<string, string> = { count: String(req.count), mode: req.mode ?? 'mixed' };
      if (req.units?.length) params.units = req.units.join(',');
      if (req.types?.length) params.types = req.types.join(',');
      if (req.levels?.length) params.levels = req.levels.join(',');
      if (seenRef.current.length) params.exclude = seenRef.current.slice(-40).join(',');
      return request((t) => studentApi.getQuestions(t, params));
    },
    [request],
  );

  const submitAnswer = useCallback(
    async (q: ServedQuestion, payload: AnswerPayload) => {
      try {
        const r = await request((t) => studentApi.submitAnswer(t, q.id, payload));
        setProgress(r.progress);
        setState((s) => {
          const food = r.correct ? qtgFood(s.buildings.qtg.level) : 0;
          return {
            ...s,
            luong: Math.min(storeCap(s.buildings.kho.level), s.luong + food),
            seen: [...s.seen.filter((x) => x !== q.id), q.id].slice(-60),
            codex: r.correct && !s.codex.includes(q.unit_id) ? [...s.codex, q.unit_id] : s.codex,
            daily: r.correct ? { ...s.daily, progress: { ...s.daily.progress, correct: (s.daily.progress.correct ?? 0) + 1 } } : s.daily,
          };
        });
        return r;
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 401)) toast(errorMessage(err, 'Không gửi được câu trả lời'));
        return null;
      }
    },
    [request, toast],
  );

  const finishSession = useCallback(
    (kind: 'practice' | 'battle' | 'recruit' | 'tower' | 'raid', correct: number, total: number) => {
      if (total > 0)
        request((t) => studentApi.completeQuiz(t, Math.min(correct, total), total))
          .then((r) => setProgress(r.progress))
          .catch(() => undefined);
      setState((s) => ({
        ...s,
        raid: kind === 'raid' ? s.raid : { ...s.raid, sessions: s.raid.sessions + 1 },
        stats: { ...s.stats, sessions: s.stats.sessions + 1 },
        daily: kind === 'practice' || kind === 'tower' ? { ...s.daily, progress: { ...s.daily.progress, session: (s.daily.progress.session ?? 0) + 1 } } : s.daily,
      }));
    },
    [request],
  );

  const spendGems = useCallback(
    async (amount: number, reason: string) => {
      if (amount <= 0) return true;
      if (progress.gems < amount) {
        toast('Chưa đủ Ấn Tín – trả lời đúng ở Quốc Tử Giám để nhận thêm');
        return false;
      }
      try {
        setProgress(await request((t) => studentApi.spendGems(t, amount, reason.slice(0, 80))));
        return true;
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 401)) toast(errorMessage(err, 'Không tiêu được Ấn Tín'));
        return false;
      }
    },
    [progress.gems, request, toast],
  );

  const reward = useCallback(
    (luong: number, quan: number) =>
      setState((s) => ({
        ...s,
        luong: Math.min(storeCap(s.buildings.kho.level), s.luong + Math.max(0, luong)),
        quan: Math.min(troopCap(s.buildings.trai.level), s.quan + Math.max(0, quan)),
      })),
    [],
  );

  const bumpDaily = useCallback(
    (metric: DailyTaskDef['metric'], n = 1) => setState((s) => ({ ...s, daily: { ...s.daily, progress: { ...s.daily.progress, [metric]: (s.daily.progress[metric] ?? 0) + n } } })),
    [],
  );

  const askAdvisor = useCallback(
    (question: string) => {
      setPendingAsk(question);
      setTab('codex', 'advisor');
    },
    [setTab],
  );

  const openLive = useCallback((pin?: string) => setLive({ pin: pin ?? null, resume: false }), []);
  const openWorld = useCallback(() => setWorldOpen(true), []);
  const closeLive = useCallback(() => {
    setLive(null);
    // Câu trả lời trong trận đã được server cộng XP, Ấn Tín: tải lại tiến độ
    request(studentApi.getProgress)
      .then(setProgress)
      .catch(() => undefined);
  }, [request]);

  const soundOn = state.settings.sound;
  const sound = useCallback((kind: 'ok' | 'bad' | 'win') => soundOn && playTone(kind), [soundOn]);

  const ctx: GameCtx = {
    user, progress, state, codex: initial.codex, dark, update, request, toast, fetchQuestions, submitAnswer, finishSession, spendGems, reward, bumpDaily, askAdvisor, openLive, openWorld,
    sound: (kind) => {
      sound(kind);
    },
  };

  return (
    <GameContext.Provider value={ctx}>
      <ThemeContext.Provider value={theme}>
        <ReduceMotionContext.Provider value={systemReduce || state.settings.reduceMotion}>
          <StatusBar style={dark ? 'light' : 'dark'} />
          <GameLayout tab={tab} onTab={setTab} scrollRef={scrollRef} onProfile={() => setProfile(true)}>
            {tab === 'farm' && <FarmTab onGoto={setTab} />}
            {tab === 'barracks' && <BarracksTab sub={sub.barracks} onSub={(s) => setSub((cur) => ({ ...cur, barracks: s }))} />}
            {tab === 'campaign' && <CampaignTab onGoto={setTab} />}
            {tab === 'exam' && <ExamTab />}
            {tab === 'codex' && <CodexTab sub={sub.codex} onSub={(s) => setSub((cur) => ({ ...cur, codex: s }))} pendingQuestion={pendingAsk} onConsumed={() => setPendingAsk(null)} />}
          </GameLayout>
          <ProfileSheet
            open={profile}
            onClose={() => setProfile(false)}
            onLogout={() => {
              setProfile(false);
              session.logout();
            }}
            onChangePassword={() => {
              setProfile(false);
              session.changePassword();
            }}
            onTutorial={() => {
              setProfile(false);
              setTimeout(() => setTutorial(true), Platform.OS === 'ios' ? 450 : 0);
            }}
          />
          {tutorial && !live && !worldOpen && (
            <Tutorial
              onDone={() => {
                setTutorial(false);
                update((s) => ({ ...s, tutorial: true }));
              }}
            />
          )}
          {worldOpen && !live && <WorldScreen onClose={() => setWorldOpen(false)} />}
          {live && <LiveArena token={token} initialPin={live.pin} resume={live.resume} onClose={closeLive} onExpired={expired} />}
        </ReduceMotionContext.Provider>
      </ThemeContext.Provider>
    </GameContext.Provider>
  );
};

// ---------------------------------------------------------------------- bố cục: HUD, nội dung, thanh tab
const GameLayout: React.FC<{ tab: GameTab; onTab: (t: GameTab) => void; scrollRef: React.Ref<React.ComponentRef<typeof ScrollView>>; onProfile: () => void; children: React.ReactNode }> = ({
  tab, onTab, scrollRef, onProfile, children,
}) => {
  const { user, progress, state, openWorld } = useGame();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const rail = width >= 1024;
  const lvl = levelOf(progress.xp);
  const lvlFrom = levelXp(lvl);
  const lvlTo = levelXp(lvl + 1);
  return (
    <View style={{ flex: 1 }}>
      <PaperBg />
      <View style={{ paddingTop: insets.top, borderBottomWidth: 2, borderBottomColor: c.vien, backgroundColor: c.the }}>
        <View style={{ width: '100%', maxWidth: 1180, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
          <Pressable
            onPress={onProfile}
            accessibilityRole="button"
            accessibilityLabel={`Hồ sơ của ${user.full_name}, cấp ${lvl}`}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingRight: 8, borderRadius: 16, backgroundColor: pressed ? c.giay2 : 'transparent' })}
          >
            <Avatar name={user.full_name} size={40} />
            {width >= 640 && (
              <View>
                <Txt f="display" size={15} numberOfLines={1} style={{ maxWidth: 160 }}>
                  {shortName(user.full_name)}
                </Txt>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Txt f="semibold" size={12} color={c.muc2}>
                    Cấp {lvl}
                  </Txt>
                  <Bar value={progress.xp - lvlFrom} max={lvlTo - lvlFrom} fill={c.dong} height={6} style={{ width: 64 }} label="XP tới cấp tiếp theo" />
                </View>
              </View>
            )}
          </Pressable>
          <Pressable
            onPress={openWorld}
            accessibilityRole="button"
            accessibilityLabel="Hành Trình Đông A – phiêu lưu 2D"
            style={({ pressed }) => ({
              minHeight: 44, minWidth: 44, paddingHorizontal: width >= 760 ? 14 : 0, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              backgroundColor: pressed ? c.ngocDam : c.ngoc, borderBottomWidth: 3, borderBottomColor: c.ngocDam,
            })}
          >
            <Gamepad2 size={20} color="#ffffff" />
            {width >= 760 && (
              <Txt f="display" size={14} color="#ffffff">
                Hành Trình
              </Txt>
            )}
          </Pressable>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginLeft: 'auto', flexGrow: 0 }} contentContainerStyle={{ gap: 6, alignItems: 'center' }}>
            <HudPill icon={Wheat} value={fmt(state.luong)} label="Lương Thảo" tone={c.dong} />
            <HudPill icon={Shield} value={fmt(state.quan)} label="Quân Lực" tone={c.son} />
            <HudPill icon={Stamp} value={fmt(progress.gems)} label="Ấn Tín" tone={c.ngoc} />
            {width >= 420 && <HudPill icon={Flame} value={String(progress.streak)} label="Chuỗi ngày học" tone={c.hoa} />}
          </ScrollView>
        </View>
      </View>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {rail && (
          <View style={{ width: 224, padding: 12, gap: 6, borderRightWidth: 2, borderRightColor: c.vien, backgroundColor: c.the }} accessibilityRole="tablist" accessibilityLabel="Điều hướng game">
            <View style={{ paddingHorizontal: 6, paddingVertical: 8, marginBottom: 6 }}>
              <BrandLogo subtitle="Hào Khí Đông A" />
            </View>
            {GAME_TABS.map((t) => {
              const on = tab === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => onTab(t.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => ({
                    minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, borderRadius: 16,
                    backgroundColor: on ? c.son : pressed ? c.giay2 : 'transparent', borderBottomWidth: on ? 3 : 0, borderBottomColor: c.sonDam,
                  })}
                >
                  <t.Icon size={20} color={on ? '#ffffff' : c.muc2} />
                  <Txt f="display" size={15} color={on ? '#ffffff' : c.muc2}>
                    {t.label}
                  </Txt>
                </Pressable>
              );
            })}
            <View style={{ marginTop: 'auto', backgroundColor: c.giay2, borderRadius: 16, padding: 12 }}>
              <Txt size={12} color={c.muc2}>
                Lịch sử 7 · Ba lần kháng chiến chống quân xâm lược Mông – Nguyên
              </Txt>
            </View>
          </View>
        )}
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: rail ? 32 : 24, width: '100%', maxWidth: 1180, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </View>
      {!rail && (
        <View style={{ borderTopWidth: 2, borderTopColor: c.vien, backgroundColor: c.the, paddingBottom: insets.bottom, paddingTop: 4 }} accessibilityRole="tablist" accessibilityLabel="Điều hướng game">
          <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', flexDirection: 'row', paddingHorizontal: 4 }}>
            {GAME_TABS.map((t) => {
              const on = tab === t.id;
              return (
                <Pressable key={t.id} onPress={() => onTab(t.id)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label} style={{ flex: 1, minHeight: 60, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <View style={{ width: 44, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.son : 'transparent' }}>
                    <t.Icon size={20} color={on ? '#ffffff' : c.muc2} />
                  </View>
                  <Txt f={on ? 'heavy' : 'semibold'} size={11} color={on ? c.sonChu : c.muc2} center numberOfLines={1} maxFontSizeMultiplier={1.2}>
                    {t.label}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
};

// ---------------------------------------------------------------------- hồ sơ & cài đặt
const ProfileSheet: React.FC<{ open: boolean; onClose: () => void; onLogout: () => void; onChangePassword: () => void; onTutorial: () => void }> = ({ open, onClose, onLogout, onChangePassword, onTutorial }) => {
  const { user, progress, state, update, request } = useGame();
  const { c } = useTheme();
  const [tab, setTab] = useState<'rank' | 'settings'>('rank');
  const [board, setBoard] = useState<LeaderboardEntry[] | null>(null);
  const lvl = levelOf(progress.xp);
  const heroes = Object.keys(state.heroes).length;
  const stars = PHASES.reduce((s, p) => s + (state.campaign[p.id] ?? 0), 0);

  useEffect(() => {
    if (!open || tab !== 'rank') return;
    let alive = true;
    setBoard(null);
    request(studentApi.getLeaderboard)
      .then((b) => alive && setBoard(b))
      .catch(() => alive && setBoard([]));
    return () => {
      alive = false;
    };
  }, [open, tab, request]);

  const setSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => update((s) => ({ ...s, settings: { ...s.settings, [key]: value } }));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      title={user.full_name}
      subtitle={`${user.username}${user.class_name ? ` · Lớp ${user.class_name}` : ''}`}
      icon={<Avatar name={user.full_name} size={48} />}
      footer={
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Btn title="Đổi mật khẩu" icon={KeyRound} tone="giay" onPress={onChangePassword} />
          <Btn title="Đăng xuất" icon={LogOut} onPress={onLogout} style={{ marginLeft: 'auto' }} />
        </View>
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[
          { label: 'Cấp độ', value: `Cấp ${lvl}` },
          { label: 'XP tuần này', value: fmt(progress.week_xp) },
          { label: 'Sao chiến dịch', value: `${stars}/27` },
          { label: 'Tướng', value: `${heroes}/${HEROES.length}` },
        ].map((x) => (
          <Card key={x.label} flat pad={12} style={{ flexGrow: 1, flexBasis: 130 }}>
            <Txt f="semibold" size={12} color={c.muc2}>
              {x.label}
            </Txt>
            <Txt f="displayHeavy" size={18}>
              {x.value}
            </Txt>
          </Card>
        ))}
      </View>
      <Segmented
        label="Hồ sơ"
        options={[
          { value: 'rank' as const, label: 'Bảng xếp hạng tuần' },
          { value: 'settings' as const, label: 'Cài đặt' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'rank' ? (
        board === null ? (
          <Spinner />
        ) : board.length === 0 ? (
          <Txt size={14} color={c.muc2}>
            Chưa có dữ liệu xếp hạng của lớp.
          </Txt>
        ) : (
          <View style={{ gap: 8 }}>
            {board.map((e, i) => (
              <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 10, borderWidth: 2, borderColor: e.is_me ? c.dong : c.vien, backgroundColor: e.is_me ? c.dongNhat : c.the }}>
                <View style={{ width: 32, alignItems: 'center' }}>
                  {i < 3 ? (
                    <Medal size={20} color={c.dongChu} accessibilityLabel={`Hạng ${i + 1}`} />
                  ) : (
                    <Txt f="displayHeavy" color={c.muc2}>
                      {i + 1}
                    </Txt>
                  )}
                </View>
                <Avatar name={e.full_name} size={36} />
                <Txt f="semibold" numberOfLines={1} style={{ flex: 1 }}>
                  {e.full_name}
                  {e.is_me ? <Txt size={12} color={c.dongChu}> (em)</Txt> : null}
                </Txt>
                <View style={{ alignItems: 'flex-end' }}>
                  <Txt f="displayHeavy">{fmt(e.week_xp)} XP</Txt>
                  <Txt size={12} color={c.muc2}>
                    tổng {fmt(e.xp)}
                  </Txt>
                </View>
              </View>
            ))}
          </View>
        )
      ) : (
        <Card flat pad={14} style={{ gap: 6 }}>
          <Txt f="semibold">Giao diện</Txt>
          <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Chế độ màu">
            {(
              [
                ['system', 'Theo máy', Monitor],
                ['light', 'Giấy dó', Sun],
                ['dark', 'Đêm Bạch Đằng', Moon],
              ] as const
            ).map(([id, label, Icon]) => {
              const on = state.settings.theme === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setSetting('theme', id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={label}
                  style={{ flex: 1, minHeight: 64, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center', gap: 4, borderColor: on ? c.son : c.vien, backgroundColor: on ? c.sonNhat : c.the }}
                >
                  <Icon size={20} color={on ? c.sonChu : c.muc2} />
                  <Txt f="semibold" size={13} color={on ? c.sonChu : c.muc2} center>
                    {label}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
          <ToggleRow icon={Timer} label="Đồng hồ đếm giờ khi trả lời" desc="Tắt nếu em cần đọc chậm" checked={state.settings.timer} onChange={(v) => setSetting('timer', v)} />
          <ToggleRow icon={state.settings.sound ? Volume2 : VolumeX} label={Platform.OS === 'web' ? 'Âm thanh' : 'Âm thanh & rung'} desc="Mặc định tắt khi học trên lớp" checked={state.settings.sound} onChange={(v) => setSetting('sound', v)} />
          <ToggleRow icon={Sparkles} label="Giảm chuyển động" desc="Tắt rung, hạt và hiệu ứng chuyển động" checked={state.settings.reduceMotion} onChange={(v) => setSetting('reduceMotion', v)} />
          <Pressable onPress={onTutorial} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.giay2, alignItems: 'center', justifyContent: 'center' }}>
              <HelpCircle size={20} color={c.muc2} />
            </View>
            <Txt f="semibold" style={{ flex: 1 }}>
              Xem lại hướng dẫn chơi
            </Txt>
            <ChevronRight size={20} color={c.muc3} />
          </Pressable>
        </Card>
      )}
    </Sheet>
  );
};

// ---------------------------------------------------------------------- hướng dẫn
const TUTORIAL: Array<{ title: string; text: string; mood: MascotMood; acc: MascotAccessory }> = [
  { title: 'Chào mừng đến Điền Trang Đông A!', text: 'Ta là Rồng Con. Thời bình, quân dân làm ruộng tích lương thảo; có giặc thì ra trận – đó là chính sách “ngụ binh ư nông”.', mood: 'excited', acc: 'conical' },
  { title: 'Kiến thức là vũ khí', text: 'Muốn nâng cấp công trình, chiêu mộ hay tung kế sách, em phải trả lời đúng câu hỏi lịch sử. Ấn Tín chỉ có khi em trả lời đúng.', mood: 'thinking', acc: 'scholar' },
  { title: 'Chiêu mộ tướng ở Doanh Trại', text: 'Ghép một thẻ Nhân lực với một thẻ Sự kiện ở Hội Quán Vạn Kiếp để mời danh tướng nhà Trần gia nhập.', mood: 'happy', acc: 'helmet' },
  { title: 'Ra trận theo đúng kế sách', text: 'Ba màn chiến dịch: 1258, 1285, 1287 – 1288. Rút lui đúng lúc, bỏ trống làng mạc, cắt nguồn lương, chờ thủy triều rút… như ông cha ta!', mood: 'love', acc: 'crown' },
  { title: 'Phiêu lưu Hành Trình Đông A', text: 'Bấm nút tay cầm “Hành Trình” để vào thế giới 2D: đi khắp làng, nghe người dân kể chuyện xưa, giải đố để mở đường sang vùng đất mới, gieo trồng và đuổi thám báo.', mood: 'excited', acc: 'helmet' },
];

const Tutorial: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { c } = useTheme();
  const [step, setStep] = useState(0);
  const s = TUTORIAL[step];
  return (
    <Sheet open onClose={onDone} title={s.title} subtitle={`Hướng dẫn ${step + 1}/${TUTORIAL.length}`}>
      <View style={{ alignItems: 'center', gap: 14 }}>
        <Mascot size={130} mood={s.mood} accessory={s.acc} bob />
        <Txt size={17} center>
          {s.text}
        </Txt>
        <View style={{ flexDirection: 'row', gap: 6 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {TUTORIAL.map((_, i) => (
            <View key={i} style={{ height: 8, width: i === step ? 24 : 8, borderRadius: 4, backgroundColor: i === step ? c.son : c.vien2 }} />
          ))}
        </View>
        <View style={{ alignSelf: 'stretch', flexDirection: 'row', gap: 8 }}>
          <Btn title="Bỏ qua" tone="ghost" onPress={onDone} />
          <Btn tone="giay" icon={ChevronLeft} label="Quay lại" disabled={step === 0} onPress={() => setStep(step - 1)} style={{ marginLeft: 'auto' }} />
          <Btn title={step + 1 < TUTORIAL.length ? 'Tiếp theo' : 'Bắt đầu chơi'} iconRight={ChevronRight} onPress={() => (step + 1 < TUTORIAL.length ? setStep(step + 1) : onDone())} />
        </View>
      </View>
    </Sheet>
  );
};
