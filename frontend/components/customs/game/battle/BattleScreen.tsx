import React, { useEffect, useRef, useState } from 'react';
import { Check, Flame, LogOut, ScrollText, Sparkles, Swords } from 'lucide-react';
import { BattleBackdrop } from '@/components/customs/game/art/BattleBackdrop';
import { HeroMedallion } from '@/components/customs/game/art/HeroMedallion';
import { BattleResult } from '@/components/customs/game/battle/BattleResult';
import { FighterCard } from '@/components/customs/game/battle/FighterCard';
import { TideMeter } from '@/components/customs/game/battle/TideMeter';
import { QuestionCard } from '@/components/customs/game/QuestionCard';
import { GBtn } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { HERO_BY_ID } from '@/constants/game/heroes';
import { RELICS } from '@/constants/game/relics';
import { useGame } from '@/hooks/use-game';
import { allyAct, applyPhaseStrat, applyRelic, createBattle, enemyTurnSteps } from '@/lib/game/battle-engine';
import type { BattleState } from '@/types/battleType';
import type { PhaseDef } from '@/types/gameType';
import type { ServedQuestion } from '@/types/learningType';

export const BattleScreen: React.FC<{ phase: PhaseDef; team: string[]; onExit: (b: BattleState | null) => void }> = ({ phase, team, onExit }) => {
  const { state, dark, fetchQuestions, toast } = useGame();
  const [b, setB] = useState<BattleState>(() => createBattle(phase, team, state));
  const [target, setTarget] = useState<string | null>(null);
  const [ask, setAsk] = useState<null | { kind: 'strat' | 'phase'; q: ServedQuestion }>(null);
  const [busy, setBusy] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const pool = useRef<ServedQuestion[]>([]);
  const used = useRef<string[]>([]);
  const lastAnswer = useRef<boolean | null>(null);
  const bRef = useRef(b);
  useEffect(() => {
    bRef.current = b;
  });
  const reduce = state.settings.reduceMotion || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    let cancelled = false;
    fetchQuestions({ units: phase.units, count: 12 })
      .then((res) => {
        if (!cancelled) pool.current = res.questions;
      })
      .catch(() => toast('Không tải được câu hỏi cho trận đánh – kiểm tra kết nối'));
    return () => {
      cancelled = true;
    };
  }, [phase.units, fetchQuestions, toast]);

  // Lượt của quân địch: phát lần lượt từng bước
  useEffect(() => {
    const cur = bRef.current;
    if (cur.turn !== 'enemy' || cur.result) return;
    const steps = enemyTurnSteps(cur);
    let i = 0;
    let timer = 0;
    const delay = reduce ? 160 : 650;
    const play = () => {
      setB(steps[i]);
      i += 1;
      if (i < steps.length) timer = window.setTimeout(play, delay);
    };
    timer = window.setTimeout(play, reduce ? 120 : 450);
    return () => window.clearTimeout(timer);
  }, [b.turn, b.round, b.result, reduce]);

  const takeQuestion = async (): Promise<ServedQuestion | null> => {
    let q = pool.current.find((x) => !used.current.includes(x.id));
    if (!q) {
      try {
        const res = await fetchQuestions({ units: phase.units, count: 8 });
        pool.current = [...pool.current, ...res.questions];
        q = res.questions.find((x) => !used.current.includes(x.id)) ?? res.questions[0];
      } catch {
        toast('Không tải được câu hỏi');
        return null;
      }
    }
    if (q) used.current.push(q.id);
    return q ?? null;
  };

  const startAsk = async (kind: 'strat' | 'phase') => {
    setBusy(true);
    const q = await takeQuestion();
    setBusy(false);
    if (q) {
      lastAnswer.current = null;
      setAsk({ kind, q });
    }
  };

  const finishAsk = () => {
    if (!ask) return;
    const correct = lastAnswer.current === true;
    setB((cur) => (ask.kind === 'phase' ? applyPhaseStrat(cur, correct) : allyAct(cur, 'strat', target, correct)));
    setAsk(null);
  };

  const me = b.turn === 'ally' ? b.allies[b.active] : null;
  const hero = me ? HERO_BY_ID[me.ref] : null;
  const retreatPhase = phase.strat.effect === 'retreat' || phase.strat.effect === 'rear_guard';
  const retreatLeft = retreatPhase ? Math.max(0, (phase.rules.retreatAfter ?? 0) + 1 - b.round) : 0;
  const stratDisabled = b.stratUsed || b.turn !== 'ally' || retreatLeft > 0 || busy;
  const relic = b.relic ? RELICS[b.relic] : null;
  const relicUsable = !!relic && !b.relicUsed && b.turn === 'ally' && (b.relic === 'hich' || b.relic === 'tung_gia' || (b.relic === 'co_sau_chu' && b.allies.some((a) => a.st.ko)));
  const showIntents = b.relic === 'binh_thu_relic' ? 2 : 1;
  const lastLogs = b.log.slice(-3);

  return (
    <div className={`fixed inset-0 z-[60] flex flex-col bg-giay ${dark ? 'theme-dark' : ''}`} role="dialog" aria-modal="true" aria-label={`Trận ${phase.name}`}>
      <header className="flex items-center gap-2 px-3 py-2 border-b-2 border-vien bg-the">
        <GBtn variant="ghost" iconOnly onClick={() => (b.result ? onExit(b) : setConfirmExit(true))} aria-label="Rời trận">
          <LogOut className="w-5 h-5" aria-hidden={true} />
        </GBtn>
        <div className="min-w-0 flex-1">
          <p className="font-display font-extrabold leading-tight truncate">{phase.name}</p>
          <p className="text-xs text-muc-2">
            {phase.date} · Lượt {b.round}
          </p>
        </div>
        {b.tide && <TideMeter tide={b.tide} round={b.round} />}
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="relative">
          <div className="relative overflow-hidden" style={{ minHeight: 290 }}>
            <BattleBackdrop bg={phase.bg} tide={b.tide} dark={dark} stakes={!!phase.rules.tide} />
            <div className="relative mx-auto max-w-3xl px-2 sm:px-4 pt-5 pb-2 lg:pt-10 lg:pb-8 space-y-5 lg:space-y-8">
              <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-2" aria-label="Quân địch">
                {b.enemies.map((e) => (
                  <FighterCard key={e.uid} f={e} fx={b.fx} targeted={target === e.uid} onTarget={b.turn === 'ally' ? () => setTarget(e.uid) : undefined} showIntents={showIntents} />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Đội ta">
                {b.allies.map((a, i) => (
                  <FighterCard key={a.uid} f={a} fx={b.fx} active={b.turn === 'ally' && i === b.active} showIntents={0} />
                ))}
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-3xl px-3 sm:px-4 py-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display font-bold text-sm text-muc-2">Hào Khí</span>
              <span className="flex gap-1" role="img" aria-label={`Hào Khí ${b.haoKhi}/3`}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${i < b.haoKhi ? 'bg-son border-son-dam text-white' : 'bg-giay-2 border-vien-2 text-muc-3'}`}>
                    <Flame className="w-3.5 h-3.5" aria-hidden={true} />
                  </span>
                ))}
              </span>
              {relic && (
                <GBtn variant="giay" size="sm" className="ml-auto" disabled={!relicUsable} onClick={() => setB((cur) => applyRelic(cur))} aria-label={`Dùng cổ vật ${relic.name}: ${relic.effect}`}>
                  <relic.Icon className="w-4 h-4" aria-hidden={true} /> {b.relicUsed ? 'Đã dùng cổ vật' : relic.name}
                </GBtn>
              )}
            </div>

            {b.result ? null : me && hero ? (
              <div className="g-card p-3 space-y-2" aria-live="polite">
                <div className="flex items-center gap-2">
                  <HeroMedallion hero={hero} size={36} />
                  <p className="font-display font-extrabold">Lượt của {me.name}</p>
                  <span className="text-xs text-muc-2 ml-auto">Chạm quân địch để chọn mục tiêu</span>
                </div>
                <div className="grid sm:grid-cols-3 gap-2">
                  <GBtn variant="giay" className="!justify-start text-left" onClick={() => setB((cur) => allyAct(cur, 'basic', target))}>
                    <Swords className="w-5 h-5 shrink-0" aria-hidden={true} />
                    <span>
                      <span className="block">{hero.basic.name}</span>
                      <span className="block text-xs font-sans font-semibold text-muc-2">Đánh thường</span>
                    </span>
                  </GBtn>
                  <GBtn variant="ngoc" className="!justify-start text-left" disabled={busy} onClick={() => startAsk('strat')}>
                    <Sparkles className="w-5 h-5 shrink-0" aria-hidden={true} />
                    <span>
                      <span className="block">{hero.strat.name}</span>
                      <span className="block text-xs font-sans font-semibold opacity-90">Kế sách · 1 câu hỏi</span>
                    </span>
                  </GBtn>
                  <GBtn variant="son" className="!justify-start text-left" disabled={b.haoKhi < 3} onClick={() => setB((cur) => allyAct(cur, 'ult', target))}>
                    <Flame className="w-5 h-5 shrink-0" aria-hidden={true} />
                    <span>
                      <span className="block">{hero.ult.name}</span>
                      <span className="block text-xs font-sans font-semibold opacity-90">{b.haoKhi < 3 ? `Cần ${3 - b.haoKhi} Hào Khí` : 'Tuyệt chiêu'}</span>
                    </span>
                  </GBtn>
                </div>
                <p className="text-xs text-muc-2">
                  {hero.strat.desc} Trả lời đúng: mạnh gấp rưỡi và +1 Hào Khí; chưa đúng: còn nửa sức, không mất lượt.
                </p>
              </div>
            ) : (
              <div className="g-card-flat p-3 text-center font-semibold text-muc-2" aria-live="polite">
                Quân giặc đang hành động…
              </div>
            )}

            <div className="rounded-2xl border-2 border-dong bg-dong-nhat p-3 flex flex-wrap items-center gap-3">
              <ScrollText className="w-6 h-6 text-dong-chu shrink-0" aria-hidden={true} />
              <div className="flex-1 min-w-[180px]">
                <p className="font-display font-extrabold leading-tight">Kế sách: {phase.strat.name}</p>
                <p className="text-sm text-muc">{phase.strat.desc}</p>
                {retreatLeft > 0 && <p className="text-sm font-semibold text-son-chu">Cầm cự thêm {retreatLeft} lượt nữa.</p>}
                {b.tide && phase.strat.effect === 'bach_dang' && !b.stratUsed && (
                  <p className={`text-sm font-semibold ${b.tide === 'rut' ? 'text-ngoc-chu' : 'text-muc-2'}`}>{b.tide === 'rut' ? 'Triều đang rút – thời cơ đã đến!' : 'Chờ thủy triều rút…'}</p>
                )}
              </div>
              <GBtn variant="dong" disabled={stratDisabled} onClick={() => startAsk('phase')}>
                {b.stratUsed ? (
                  <>
                    <Check className="w-4 h-4" aria-hidden={true} /> Đã dùng
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" aria-hidden={true} /> Dùng (1 câu hỏi)
                  </>
                )}
              </GBtn>
            </div>

            <ul className="g-inset p-3 space-y-1 text-sm" aria-live="polite" aria-label="Diễn biến trận đánh">
              {lastLogs.map((l) => (
                <li key={l.id} className={l.tone === 'good' ? 'text-ngoc-chu font-semibold' : l.tone === 'bad' || l.tone === 'enemy' ? 'text-son-chu' : l.tone === 'info' ? 'text-muc-2' : 'text-muc'}>
                  {l.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {ask && (
        <Sheet open onClose={() => {}} persistent title={ask.kind === 'phase' ? `Kế sách: ${phase.strat.name}` : `${hero?.strat.name ?? 'Kế sách'}`} subtitle="Trả lời để tung kế sách" wide>
          <QuestionCard
            q={ask.q}
            index={0}
            total={1}
            timerSec={state.settings.timer ? 20 : null}
            onAnswered={(r) => {
              lastAnswer.current = r.correct;
            }}
            onNext={finishAsk}
            nextLabel="Tung kế sách"
          />
        </Sheet>
      )}
      {b.result && <BattleResult b={b} onDone={() => onExit(b)} />}
      <Sheet open={confirmExit} onClose={() => setConfirmExit(false)} title="Rời trận?" subtitle="Trận đánh sẽ không được tính, Quân Lực đã dùng không được hoàn lại.">
        <div className="flex gap-2">
          <GBtn variant="giay" className="flex-1" onClick={() => setConfirmExit(false)}>
            Ở lại
          </GBtn>
          <GBtn className="flex-1" onClick={() => onExit(null)}>
            Rời trận
          </GBtn>
        </div>
      </Sheet>
    </div>
  );
};
