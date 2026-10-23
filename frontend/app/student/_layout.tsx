import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Flame, RefreshCw, Shield, Stamp, Wheat } from 'lucide-react';
import * as studentApi from '@/api/studentApi';
import { BarracksTab } from '@/app/student/(tabs)/barracks';
import { CampaignTab } from '@/app/student/(tabs)/campaign';
import { CodexTab } from '@/app/student/(tabs)/codex';
import { ExamTab } from '@/app/student/(tabs)/exam';
import { FarmTab } from '@/app/student/(tabs)/index';
import { LiveArena } from '@/app/student/live/index';
import { BrandLogo } from '@/components/customs/BrandLogo';
import { ProfileSheet } from '@/components/customs/game/ProfileSheet';
import { TutorialOverlay } from '@/components/customs/game/TutorialOverlay';
import { Mascot } from '@/components/customs/Mascot';
import { GBtn } from '@/components/ui/button';
import { HudPill } from '@/components/ui/hud-pill';
import { Bar } from '@/components/ui/progress-bar';
import { Spinner } from '@/components/ui/spinner';
import { qtgFood, storeCap, troopCap } from '@/constants/game/buildings';
import { GAME_TABS } from '@/constants/game/tabs';
import { playTone } from '@/lib/sound';
import { GameContext } from '@/providers/GameContext';
import { finalizeUpgrades, levelOf, levelXp, restoreGameState, todayKey } from '@/store/game.store';
import { readLiveRoom, readPinFromUrl, stripPinFromUrl } from '@/store/live-room.store';
import type { AuthUser } from '@/types/authType';
import type { DailyTaskDef, GameCtx, GameState, GameTab } from '@/types/gameType';
import type { AnswerPayload, CodexEntry, LearnerProgress, QuestionRequest, QuestionsResponse, ServedQuestion } from '@/types/learningType';
import { avatarColor, fmt, initialsOf, shortName } from '@/utils/format';
import { ApiError } from '@/utils/http';

const readGameTab = (): GameTab => {
  try {
    const saved = sessionStorage.getItem('donga_game_tab');
    return GAME_TABS.some((t) => t.id === saved) ? (saved as GameTab) : 'farm';
  } catch {
    return 'farm';
  }
};

interface StudentViewProps {
  token: string;
  user: AuthUser;
  onShowToast: (msg: string) => void;
  onSessionExpired: () => void;
  onLogout: () => void;
  onChangePassword: () => void;
}

export const StudentView: React.FC<StudentViewProps> = (props) => {
  const { token, onSessionExpired } = props;
  const [data, setData] = useState<{ progress: LearnerProgress; state: GameState; codex: CodexEntry[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([
      studentApi.getProgress(token),
      studentApi.getGameState(token),
      studentApi.getCodex(token).catch(() => [] as CodexEntry[]),
    ])
      .then(([progress, game, codex]) => setData({ progress, state: restoreGameState(game.state), codex }))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) onSessionExpired();
        else setError(err instanceof Error ? err.message : 'Không tải được dữ liệu game');
      });
  }, [token, onSessionExpired]);

  useEffect(() => {
    load();
  }, [load]);

  if (error)
    return (
      <div className="paper-bg min-h-[100dvh] flex flex-col items-center justify-center text-center p-6 gap-3">
        <Mascot size={120} mood="sad" />
        <p className="font-display font-bold text-xl">{error}</p>
        <GBtn variant="ngoc" onClick={load}>
          <RefreshCw className="w-4 h-4" aria-hidden={true} /> Thử lại
        </GBtn>
      </div>
    );
  if (!data)
    return (
      <div className="paper-bg min-h-[100dvh] flex flex-col items-center justify-center gap-3">
        <Mascot size={130} mood="happy" accessory="conical" bob />
        <Spinner label="Đang mở Điền Trang Đông A…" />
      </div>
    );
  return <GameApp {...props} initial={data} />;
};

const GameApp: React.FC<StudentViewProps & { initial: { progress: LearnerProgress; state: GameState; codex: CodexEntry[] } }> = ({ token, user, onShowToast, onSessionExpired, onLogout, onChangePassword, initial }) => {
  const [state, setState] = useState<GameState>(initial.state);
  const [progress, setProgress] = useState<LearnerProgress>(initial.progress);
  const [tab, setTabRaw] = useState<GameTab>(readGameTab);
  const [sub, setSub] = useState<Record<string, string>>({ barracks: 'heroes', codex: 'timeline' });
  const [pendingAsk, setPendingAsk] = useState<string | null>(null);
  const [profile, setProfile] = useState(false);
  const [tutorial, setTutorial] = useState(!initial.state.tutorial);
  // Thi đấu cả lớp: mở từ đường link có ?pin=, hoặc vào lại phòng đang chơi sau khi tải lại trang
  const [live, setLive] = useState<{ pin: string | null; resume: boolean } | null>(() => {
    const pin = readPinFromUrl();
    if (pin) return { pin, resume: false };
    return readLiveRoom() ? { pin: null, resume: true } : null;
  });
  const [systemDark, setSystemDark] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  const mainRef = useRef<HTMLElement>(null);
  const firstSave = useRef(true);
  const saveTimer = useRef(0);
  const latest = useRef(state);
  const saveFailed = useRef(false);
  const dirty = useRef(false);

  const dark = state.settings.theme === 'dark' || (state.settings.theme === 'system' && systemDark);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const on = () => setSystemDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
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
    try {
      sessionStorage.setItem('donga_game_tab', t);
    } catch {
      // bỏ qua
    }
    mainRef.current?.scrollTo({ top: 0 });
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
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, []);

  const putState = useCallback((s: GameState, keepalive = false) => studentApi.putGameState(token, s, keepalive), [token]);

  // Tự lưu trạng thái game lên server (gom thay đổi trong 1,2 giây)
  useEffect(() => {
    latest.current = state;
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    dirty.current = true;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      putState(latest.current)
        .then((res) => {
          if (res.status === 401) onSessionExpired();
          else if (!res.ok) throw new Error(String(res.status));
          dirty.current = false;
          saveFailed.current = false;
        })
        .catch(() => {
          if (!saveFailed.current) onShowToast('Chưa lưu được tiến độ game – sẽ tự thử lại khi có thay đổi');
          saveFailed.current = true;
        });
    }, 1200);
  }, [state, putState, onSessionExpired, onShowToast]);

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden') putState(latest.current, true).catch(() => undefined);
    };
    document.addEventListener('visibilitychange', flush);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      // Rời game (đăng xuất, đổi mật khẩu): lưu nốt thay đổi chưa kịp gửi
      if (dirty.current) {
        window.clearTimeout(saveTimer.current);
        putState(latest.current, true).catch(() => undefined);
      }
    };
  }, [putState]);

  /** Gọi API bằng phiên của học sinh; hết phiên (401) thì đưa về màn đăng nhập */
  const request = useCallback(
    async <T,>(call: (token: string) => Promise<T>) => {
      try {
        return await call(token);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) onSessionExpired();
        throw err;
      }
    },
    [token, onSessionExpired]
  );

  const seenRef = useRef(state.seen);
  useEffect(() => {
    seenRef.current = state.seen;
  }, [state.seen]);

  const fetchQuestions = useCallback(
    async (req: QuestionRequest): Promise<QuestionsResponse> => {
      if (req.ai) return request((t) => studentApi.getAiQuestions(t, req.units?.[0] ?? null, req.count));
      const params = new URLSearchParams({ count: String(req.count), mode: req.mode ?? 'mixed' });
      if (req.units?.length) params.set('units', req.units.join(','));
      if (req.types?.length) params.set('types', req.types.join(','));
      if (req.levels?.length) params.set('levels', req.levels.join(','));
      if (seenRef.current.length) params.set('exclude', seenRef.current.slice(-40).join(','));
      return request((t) => studentApi.getQuestions(t, params));
    },
    [request]
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
        if (!(err instanceof ApiError && err.status === 401)) onShowToast(err instanceof Error ? err.message : 'Không gửi được câu trả lời');
        return null;
      }
    },
    [request, onShowToast]
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
    [request]
  );

  const spendGems = useCallback(
    async (amount: number, reason: string) => {
      if (amount <= 0) return true;
      if (progress.gems < amount) {
        onShowToast('Chưa đủ Ấn Tín – trả lời đúng ở Quốc Tử Giám để nhận thêm');
        return false;
      }
      try {
        const p = await request((t) => studentApi.spendGems(t, amount, reason.slice(0, 80)));
        setProgress(p);
        return true;
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 401)) onShowToast(err instanceof Error ? err.message : 'Không tiêu được Ấn Tín');
        return false;
      }
    },
    [progress.gems, request, onShowToast]
  );

  const reward = useCallback(
    (luong: number, quan: number) =>
      setState((s) => ({
        ...s,
        luong: Math.min(storeCap(s.buildings.kho.level), s.luong + Math.max(0, luong)),
        quan: Math.min(troopCap(s.buildings.trai.level), s.quan + Math.max(0, quan)),
      })),
    []
  );

  const bumpDaily = useCallback(
    (metric: DailyTaskDef['metric'], n = 1) => setState((s) => ({ ...s, daily: { ...s.daily, progress: { ...s.daily.progress, [metric]: (s.daily.progress[metric] ?? 0) + n } } })),
    []
  );

  const askAdvisor = useCallback(
    (question: string) => {
      setPendingAsk(question);
      setTab('codex', 'advisor');
    },
    [setTab]
  );

  useEffect(() => {
    stripPinFromUrl();
  }, []);
  const openLive = useCallback((pin?: string) => setLive({ pin: pin ?? null, resume: false }), []);
  const closeLive = useCallback(() => {
    setLive(null);
    // Câu trả lời trong trận đã được server cộng XP, Ấn Tín: tải lại tiến độ
    request(studentApi.getProgress)
      .then(setProgress)
      .catch(() => undefined);
  }, [request]);

  const soundOn = state.settings.sound;
  const sound = useCallback(
    (kind: 'ok' | 'bad' | 'win') => {
      if (soundOn) playTone(kind);
    },
    [soundOn]
  );

  const ctx: GameCtx = {
    user,
    progress,
    state,
    codex: initial.codex,
    dark,
    update,
    request,
    toast: onShowToast,
    fetchQuestions,
    submitAnswer,
    finishSession,
    spendGems,
    reward,
    bumpDaily,
    askAdvisor,
    openLive,
    sound,
  };

  const lvl = levelOf(progress.xp);
  const lvlFrom = levelXp(lvl);
  const lvlTo = levelXp(lvl + 1);

  return (
    <GameContext.Provider value={ctx}>
      <div className={`paper-bg h-[100dvh] flex flex-col text-muc ${dark ? 'theme-dark' : ''} ${state.settings.reduceMotion ? 'reduce-motion' : ''}`}>
        <header className="shrink-0 border-b-2 border-vien bg-the/95 backdrop-blur z-30" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-3">
            <button type="button" onClick={() => setProfile(true)} className="flex items-center gap-2 min-h-[44px] rounded-2xl pr-2 hover:bg-giay-2" aria-label={`Hồ sơ của ${user.full_name}, cấp ${lvl}`}>
              <span className="w-10 h-10 rounded-full text-white font-display font-extrabold flex items-center justify-center shrink-0" style={{ background: avatarColor(user.username) }}>
                {initialsOf(user.full_name)}
              </span>
              <span className="hidden sm:block text-left leading-tight">
                <span className="block font-display font-bold max-w-[160px] truncate">{shortName(user.full_name)}</span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-muc-2">
                  Cấp {lvl}
                  <span className="w-16">
                    <Bar value={progress.xp - lvlFrom} max={lvlTo - lvlFrom} fill="bg-dong" className="!h-1.5" label="XP tới cấp tiếp theo" />
                  </span>
                </span>
              </span>
            </button>
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
              <HudPill Icon={Wheat} value={fmt(state.luong)} label="Lương Thảo" tone="bg-dong" />
              <HudPill Icon={Shield} value={fmt(state.quan)} label="Quân Lực" tone="bg-son" />
              <HudPill Icon={Stamp} value={fmt(progress.gems)} label="Ấn Tín" tone="bg-ngoc" hint="Ấn Tín – chỉ nhận khi trả lời đúng" />
              <span className="hidden min-[420px]:inline-flex">
                <HudPill Icon={Flame} value={`${progress.streak}`} label="Chuỗi ngày học" tone="bg-hoa" />
              </span>
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 flex">
          <nav className="hidden lg:flex flex-col gap-1 w-56 shrink-0 border-r-2 border-vien bg-the/70 p-3" aria-label="Điều hướng game">
            <BrandLogo subtitle="Hào Khí Đông A" className="px-2 py-2 mb-2" />
            {GAME_TABS.map((t) => (
              <button key={t.id} type="button" className="g-rail-item" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
                <t.Icon className="w-5 h-5" aria-hidden={true} /> {t.label}
              </button>
            ))}
            <div className="mt-auto g-inset p-3 text-xs text-muc-2 leading-relaxed">Lịch sử 7 · Ba lần kháng chiến chống quân xâm lược Mông – Nguyên</div>
          </nav>
          <main ref={mainRef} className="flex-1 min-w-0 overflow-y-auto pb-24 lg:pb-8" id="game-main">
            {tab === 'farm' && <FarmTab onGoto={setTab} />}
            {tab === 'barracks' && <BarracksTab sub={sub.barracks} onSub={(s) => setSub((c) => ({ ...c, barracks: s }))} />}
            {tab === 'campaign' && <CampaignTab onGoto={setTab} />}
            {tab === 'exam' && <ExamTab />}
            {tab === 'codex' && <CodexTab sub={sub.codex} onSub={(s) => setSub((c) => ({ ...c, codex: s }))} pendingQuestion={pendingAsk} onConsumed={() => setPendingAsk(null)} />}
          </main>
        </div>

        <nav className="g-nav lg:hidden fixed bottom-0 inset-x-0 z-40" aria-label="Điều hướng game">
          <div className="grid grid-cols-5 gap-1 px-1.5 pt-1.5 pb-1 max-w-xl mx-auto">
            {GAME_TABS.map((t) => (
              <button key={t.id} type="button" className="g-nav-item" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
                <span className="g-nav-ico">
                  <t.Icon className="w-5 h-5" aria-hidden={true} />
                </span>
                <span className="text-center">{t.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <ProfileSheet
          open={profile}
          onClose={() => setProfile(false)}
          onLogout={onLogout}
          onChangePassword={onChangePassword}
          onTutorial={() => {
            setProfile(false);
            setTutorial(true);
          }}
        />
        {tutorial && !live && (
          <TutorialOverlay
            onDone={() => {
              setTutorial(false);
              update((s) => ({ ...s, tutorial: true }));
            }}
          />
        )}
        {live && <LiveArena token={token} initialPin={live.pin} resume={live.resume} onClose={closeLive} onSessionExpired={onSessionExpired} />}
      </div>
    </GameContext.Provider>
  );
};
