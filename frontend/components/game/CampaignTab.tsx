/**
 * Chiến Dịch: ba màn kháng chiến (1258, 1285, 1287 – 1288) trên lược đồ, chọn 3 tướng, trận đánh theo lượt.
 * Kế sách của tướng và kế sách lịch sử của mỗi trận (vườn không nhà trống, Vân Đồn, cọc Bạch Đằng...) chỉ tung được khi trả lời câu hỏi.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowDown, ArrowUp, BookOpen, Check, ChevronRight, Eye, Flame, Heart, Lock, LogOut, Minus, RotateCcw, ScrollText, Shield, Sparkles, Swords, Trophy, Users, Utensils, Waves, X,
} from 'lucide-react-native';
import { BattleBackdrop, EnemyBadge, HeroMedallion, Mascot, SchematicMap } from '@/components/art';
import { LoreChip, QuestionCard, QuizSheet } from '@/components/game/quiz';
import { Bar, Btn, Card, Chip, InfoNote, InlineSheet, Inset, SectionTitle, Segmented, Sheet, Stars, Txt, afterSheet } from '@/components/ui';
import { CAMPAIGNS, CAMPAIGN_ROUTES, PHASES } from '@/constants/campaigns';
import { ELEMENTS, ENEMIES, ENEMY_TYPES, INTENT_INFO, MAP_PLACES, RELICS, TIDE_CYCLE, TIDE_LABEL } from '@/constants/game';
import { HEROES, HERO_BY_ID } from '@/constants/heroes';
import { ON_BRIGHT, PALETTES } from '@/constants/theme';
import { useGame } from '@/hooks/use-game';
import { useFloatUp, useReduceMotion, useShake } from '@/hooks/use-motion';
import { ThemeContext, useTheme } from '@/hooks/use-theme';
import { allyAct, applyPhaseStrat, applyRelic, createBattle, enemyTurnSteps, starsOf } from '@/lib/battle-engine';
import { fmt } from '@/lib/format';
import { campaignDone, campaignStars, phaseUnlocked } from '@/lib/game-state';
import type { ServedQuestion } from '@/types/api';
import type { BattleFx, BattleState, Fighter, GameState, GameTab, HeroState, PhaseDef, TideState } from '@/types/game';

export const CampaignTab: React.FC<{ onGoto: (tab: GameTab, sub?: string) => void }> = ({ onGoto }) => {
  const { state, update, dark, reward, bumpDaily, finishSession, toast, sound } = useGame();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const firstOpen = ([1, 2, 3] as const).find((x) => !campaignDone(state, x)) ?? 3;
  const [sel, setSel] = useState<1 | 2 | 3>(firstOpen);
  const [prep, setPrep] = useState<PhaseDef | null>(null);
  const [fight, setFight] = useState<{ phase: PhaseDef; team: string[] } | null>(null);
  const [story, setStory] = useState<null | { title: string; text: string; heroes: string[] }>(null);
  const [finale, setFinale] = useState(false);
  const allDone = campaignDone(state, 3);

  const onExit = (b: BattleState | null, team: string[]) => {
    setFight(null);
    if (!b) return;
    const phase = b.phase;
    const stars = starsOf(b);
    const before = state.campaign[phase.id] ?? 0;
    finishSession('battle', b.correct, Math.max(1, b.answered));
    bumpDaily('battle');
    const bumpHeroes = (s: GameState) =>
      Object.fromEntries(Object.entries(s.heroes).map(([id, h]) => [id, team.includes(id) ? { ...h, battles: h.battles + 1 } : h])) as Record<string, HeroState>;
    if (b.result !== 'win') {
      update((s) => ({ ...s, stats: { ...s.stats, battles: s.stats.battles + 1 }, heroes: bumpHeroes(s) }));
      return;
    }
    const k = before === 0 ? 1 : 0.3;
    const gotLuong = Math.round(phase.reward.luong * k);
    const gotQuan = Math.round(phase.reward.quan * k);
    const campaignAfter = { ...state.campaign, [phase.id]: Math.max(before, stars) };
    const done = (n: 1 | 2) => PHASES.filter((p) => p.campaign === n).every((p) => (campaignAfter[p.id] ?? 0) > 0);
    const unlock1 = done(1) && !state.relics.includes('co_sau_chu');
    const unlock2 = done(2) && !state.relics.includes('tung_gia');
    const joined = unlock1 ? (CAMPAIGNS[1].joinHeroes ?? []).filter((id) => !state.heroes[id]) : [];
    update((s) => {
      let next: GameState = {
        ...s,
        campaign: { ...s.campaign, [phase.id]: Math.max(s.campaign[phase.id] ?? 0, stars) },
        codex: [...new Set([...s.codex, ...phase.units])],
        stats: { ...s.stats, battles: s.stats.battles + 1, wins: s.stats.wins + 1 },
        heroes: bumpHeroes(s),
      };
      if (unlock1 && !next.relics.includes('co_sau_chu')) {
        next = {
          ...next,
          heroes: { ...next.heroes, ...Object.fromEntries(joined.filter((id) => !next.heroes[id]).map((id) => [id, { stage: 1 as const, battles: 0 }])) },
          relics: [...next.relics, 'co_sau_chu'],
          cards: { ...next.cards, tuong_hoang_toc: (next.cards.tuong_hoang_toc ?? 0) + 1, binh_than: (next.cards.binh_than ?? 0) + 1 },
        };
      }
      if (unlock2 && !next.relics.includes('tung_gia')) next = { ...next, relics: [...next.relics, 'tung_gia'] };
      return next;
    });
    reward(gotLuong, gotQuan);
    if (stars > before) sound('win');
    if (unlock1)
      afterSheet(() =>
        setStory({
          title: 'Hội nghị Bình Than (10/1282)',
          text: 'Vua Trần Nhân Tông họp vương hầu, trăm quan bàn kế đánh giặc và cử Trần Quốc Tuấn làm Quốc công Tiết chế. Các tướng mới gia nhập. Em nhận thẻ Tướng hoàng tộc, thẻ Hội nghị Bình Than và cổ vật Cờ thêu sáu chữ vàng.',
          heroes: joined,
        }),
      );
    else if (unlock2) afterSheet(() => setStory({ title: 'Kháng chiến lần thứ hai thắng lợi!', text: 'Em nhận cổ vật Thơ “Tụng giá hoàn kinh sư” của Trần Quang Khải.', heroes: [] }));
    else toast(`Nhận ${fmt(gotLuong)} Lương Thảo, ${gotQuan} Quân Lực`);
  };

  const phases = PHASES.filter((p) => p.campaign === sel);
  return (
    <View style={{ gap: 14 }}>
      <SectionTitle title="Chiến Dịch" subtitle="Ba lần kháng chiến chống quân Mông – Nguyên (1258 – 1288)" />
      <View style={{ flexDirection: width >= 1024 ? 'row' : 'column', gap: 16, alignItems: 'flex-start' }}>
        <Card pad={0} style={{ flex: 1, width: '100%', overflow: 'hidden' }}>
          <SchematicMap
            dark={dark}
            pins={[...new Set(phases.map((p) => p.place))]}
            highlight={phases.find((p) => phaseUnlocked(state, p) && !(state.campaign[p.id] ?? 0))?.place ?? null}
            routes={CAMPAIGN_ROUTES[sel]}
            title={`Lược đồ ${CAMPAIGNS[sel - 1].name}`}
          />
          <Txt size={12} color={c.muc2} style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            Mũi tên đỏ: hướng tiến quân của giặc (minh họa).
          </Txt>
        </Card>
        <View style={{ flex: 1, width: '100%', gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="tablist" accessibilityLabel="Chọn màn">
            {CAMPAIGNS.map((cp) => {
              const locked = cp.id > 1 && !campaignDone(state, (cp.id - 1) as 1 | 2);
              const on = sel === cp.id;
              return (
                <Pressable
                  key={cp.id}
                  onPress={() => setSel(cp.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`Màn ${cp.id}, ${cp.years}${locked ? ', chưa mở' : `, ${campaignStars(state, cp.id)}/9 sao`}`}
                  style={{ flex: 1, minHeight: 88, padding: 10, borderRadius: 18, borderWidth: 2, borderColor: on ? c.son : c.vien, backgroundColor: on ? c.sonNhat : c.the, opacity: locked ? 0.7 : 1 }}
                >
                  <Txt f="bold" size={12} color={c.dongChu}>
                    Màn {cp.id}
                  </Txt>
                  <Txt f="displayHeavy" size={16}>
                    {cp.years}
                  </Txt>
                  {locked ? <Lock size={16} color={c.muc3} /> : <Stars n={Math.round(campaignStars(state, cp.id) / 3)} size={14} label={`${campaignStars(state, cp.id)}/9 sao`} />}
                </Pressable>
              );
            })}
          </View>
          <Inset>
            <Txt f="displayHeavy" size={18}>
              {CAMPAIGNS[sel - 1].name}
            </Txt>
            <Txt size={14} color={c.muc2}>
              {CAMPAIGNS[sel - 1].desc}
            </Txt>
          </Inset>
          {phases.map((p, i) => {
            const open = phaseUnlocked(state, p);
            const stars = state.campaign[p.id] ?? 0;
            return (
              <Card key={p.id} pad={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: open ? 1 : 0.7 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: stars ? c.ngoc : open ? c.son : c.giay2 }}>
                  {open ? (
                    <Txt f="displayHeavy" size={18} color={stars ? ON_BRIGHT : '#ffffff'}>
                      {i + 1}
                    </Txt>
                  ) : (
                    <Lock size={20} color={c.muc3} accessibilityLabel="Chưa mở" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Txt f="displayHeavy" size={16}>
                    {p.name}
                  </Txt>
                  <Txt size={12} color={c.muc2}>
                    {p.date} · {MAP_PLACES[p.place].name}
                  </Txt>
                  <Stars n={stars} size={15} />
                </View>
                <Btn title={stars ? 'Đánh lại' : 'Xuất trận'} iconRight={ChevronRight} tone={stars ? 'giay' : 'son'} size="sm" disabled={!open} onPress={() => setPrep(p)} label={`${stars ? 'Đánh lại' : 'Xuất trận'}: ${p.name}`} />
              </Card>
            );
          })}
          {sel > 1 && !campaignDone(state, (sel - 1) as 1 | 2) && <InfoNote>Hoàn thành Màn {sel - 1} để mở màn này.</InfoNote>}
          {allDone && (
            <Card flat style={{ borderColor: c.dong, backgroundColor: c.dongNhat, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
              <Trophy size={32} color={c.dongChu} />
              <View style={{ flex: 1, minWidth: 180 }}>
                <Txt f="displayHeavy" size={18}>
                  Tổng kết: Hào Khí Đông A
                </Txt>
                <Txt size={14}>Trả lời 5 câu về nguyên nhân thắng lợi và ý nghĩa lịch sử của ba lần kháng chiến.</Txt>
              </View>
              <Btn title="Làm bài tổng kết" tone="dong" onPress={() => setFinale(true)} />
            </Card>
          )}
        </View>
      </View>
      {prep && (
        <TeamPicker
          phase={prep}
          onClose={() => setPrep(null)}
          onStart={(team) => {
            const phase = prep;
            setPrep(null);
            afterSheet(() => setFight({ phase, team }));
          }}
        />
      )}
      {fight && <BattleScreen phase={fight.phase} team={fight.team} onExit={(b) => onExit(b, fight.team)} />}
      <Sheet open={!!story} onClose={() => setStory(null)} title={story?.title ?? ''} subtitle="Sự kiện lịch sử mở khóa">
        {story && (
          <>
            <Txt>{story.text}</Txt>
            {story.heroes.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {story.heroes.map((id) => (
                  <Card key={id} flat pad={8} style={{ flexGrow: 1, flexBasis: 150, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <HeroMedallion hero={HERO_BY_ID[id]} size={42} />
                    <Txt f="display" size={14} style={{ flex: 1 }}>
                      {HERO_BY_ID[id].name}
                    </Txt>
                  </Card>
                ))}
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn title="Đóng" tone="giay" full style={{ flex: 1 }} onPress={() => setStory(null)} />
              <Btn
                title="Xem Doanh Trại"
                icon={Users}
                tone="ngoc"
                full
                style={{ flex: 1 }}
                onPress={() => {
                  setStory(null);
                  onGoto('barracks', 'heroes');
                }}
              />
            </View>
          </>
        )}
      </Sheet>
      <QuizSheet
        open={finale}
        onClose={() => setFinale(false)}
        title="Tổng kết: Hào Khí Đông A"
        subtitle="Nguyên nhân thắng lợi và ý nghĩa lịch sử"
        request={{ units: ['ALL_3_WARS_SUMMARY', 'CAUSES_OF_VICTORY', 'HISTORICAL_SIGNIFICANCE'], count: 5 }}
        passMark={4}
        timer
        sessionKind="practice"
        finishLabel="Hoàn thành"
        onFinish={(sum) => {
          if (sum.passed) {
            update((s) => ({ ...s, codex: [...new Set([...s.codex, 'ALL_3_WARS_SUMMARY', 'CAUSES_OF_VICTORY', 'HISTORICAL_SIGNIFICANCE'])] }));
            toast('Em đã hoàn thành chiến dịch Hào Khí Đông A!');
          }
        }}
      />
    </View>
  );
};

// ---------------------------------------------------------------------- chọn đội
const TeamPicker: React.FC<{ phase: PhaseDef; onStart: (team: string[]) => void; onClose: () => void }> = ({ phase, onStart, onClose }) => {
  const { state, update } = useGame();
  const { c } = useTheme();
  const owned = HEROES.filter((h) => state.heroes[h.id]);
  const recommended = phase.recommended.filter((id) => state.heroes[id]);
  const suggested = () => {
    const t = [...recommended];
    for (const h of owned) if (t.length < 3 && !t.includes(h.id)) t.push(h.id);
    return t.slice(0, 3);
  };
  const [team, setTeam] = useState<string[]>(suggested);
  const toggle = (id: string) => setTeam((t) => (t.includes(id) ? t.filter((x) => x !== id) : t.length >= 3 ? t : [...t, id]));
  const cost = 5;
  const canStart = team.length === 3 && state.quan >= cost;
  return (
    <Sheet
      open
      onClose={onClose}
      wide
      title={`Xuất trận: ${phase.name}`}
      subtitle={`${phase.date} · ${MAP_PLACES[phase.place].name}`}
      footer={
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Chip text={`Cần ${cost} Quân Lực (có ${state.quan})`} icon={Shield} bg={state.quan >= cost ? c.giay2 : c.sonNhat} fg={state.quan >= cost ? c.muc : c.sonChu} />
          <Btn
            title="Bắt đầu trận"
            icon={Swords}
            size="lg"
            disabled={!canStart}
            style={{ marginLeft: 'auto' }}
            onPress={() => {
              update((s) => ({ ...s, quan: s.quan - cost }));
              onStart(team);
            }}
          />
        </View>
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
        <View style={{ flexGrow: 1, flexBasis: 300, gap: 12 }}>
          <Inset pad={16} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Eye size={20} color={c.dongChu} />
              <Txt f="display" size={18}>
                Tình báo
              </Txt>
            </View>
            <Txt>{phase.story}</Txt>
            <Txt f="semibold">Mục tiêu: {phase.objective}</Txt>
          </Inset>
          <Txt f="display" size={16}>
            Quân địch
          </Txt>
          {phase.enemies.map((e, i) => {
            const d = ENEMIES[e.id];
            const t = ENEMY_TYPES[d.type];
            return (
              <Card key={i} flat pad={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <EnemyBadge enemy={d} size={42} />
                <View style={{ flex: 1 }}>
                  <Txt f="display" size={15}>
                    {d.name}
                  </Txt>
                  <Txt size={12} color={c.muc2}>
                    {t.name} · bị khắc bởi {t.weak.map((w) => ELEMENTS[w].name).join(', ')}
                  </Txt>
                </View>
              </Card>
            );
          })}
          <InfoNote>{ENEMY_TYPES[ENEMIES[phase.enemies[0].id].type].lesson}</InfoNote>
        </View>
        <View style={{ flexGrow: 1, flexBasis: 300, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Txt f="display" size={16}>
              Chọn 3 tướng ({team.length}/3)
            </Txt>
            {recommended.length > 0 && <Btn title="Đội hình gợi ý" tone="ghost" size="sm" onPress={() => setTeam(suggested())} />}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {owned.map((h) => {
              const on = team.includes(h.id);
              const rec = phase.recommended.includes(h.id);
              return (
                <Pressable
                  key={h.id}
                  onPress={() => toggle(h.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${h.name}${rec ? ', gợi ý' : ''}`}
                  style={{ flexGrow: 1, flexBasis: 110, maxWidth: 170, padding: 8, borderRadius: 16, borderWidth: 2, borderColor: on ? c.son : c.vien, backgroundColor: on ? c.sonNhat : c.the, alignItems: 'center', gap: 4 }}
                >
                  <HeroMedallion hero={h} stage={state.heroes[h.id]?.stage} size={48} />
                  <Txt f="display" size={13} center>
                    {h.name}
                  </Txt>
                  {rec && <Chip text="Gợi ý" bg={c.dongNhat} fg={c.dongChu} style={{ alignSelf: 'center' }} />}
                </Pressable>
              );
            })}
          </View>
          {phase.recommended.some((id) => !state.heroes[id]) && (
            <InfoNote>
              Đội hình gợi ý còn thiếu: {phase.recommended.filter((id) => !state.heroes[id]).map((id) => HERO_BY_ID[id].name).join(', ')}. Chiêu mộ ở Hội Quán Vạn Kiếp.
            </InfoNote>
          )}
          <Card flat pad={12} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Sparkles size={20} color={c.dongChu} />
              <View style={{ flex: 1 }}>
                <Txt f="semibold">Cổ vật mang theo</Txt>
                <Txt size={14} color={c.muc2}>
                  {state.relic ? RELICS[state.relic].name : 'Chưa chọn (chọn trong Doanh Trại → Cổ vật)'}
                </Txt>
              </View>
            </View>
            {state.relics.length > 0 && (
              <Segmented
                label="Chọn cổ vật mang theo"
                options={[{ value: '', label: 'Không mang' }, ...state.relics.map((r) => ({ value: r, label: RELICS[r].name }))]}
                value={state.relic ?? ''}
                onChange={(v) => update((s) => ({ ...s, relic: v || null }))}
              />
            )}
          </Card>
        </View>
      </View>
    </Sheet>
  );
};

// ---------------------------------------------------------------------- trận đánh
const BattleScreen: React.FC<{ phase: PhaseDef; team: string[]; onExit: (b: BattleState | null) => void }> = (props) => {
  const { dark } = useGame();
  const theme = dark ? { c: PALETTES.dark, dark: true } : { c: PALETTES.light, dark: false };
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => undefined} statusBarTranslucent>
      <ThemeContext.Provider value={theme}>
        <BattleBody {...props} />
      </ThemeContext.Provider>
    </Modal>
  );
};

const BattleBody: React.FC<{ phase: PhaseDef; team: string[]; onExit: (b: BattleState | null) => void }> = ({ phase, team, onExit }) => {
  const { state, dark, fetchQuestions, toast } = useGame();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
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
    let timer: ReturnType<typeof setTimeout>;
    const delay = reduce ? 160 : 650;
    const play = () => {
      setB(steps[i]);
      i += 1;
      if (i < steps.length) timer = setTimeout(play, delay);
    };
    timer = setTimeout(play, reduce ? 120 : 450);
    return () => clearTimeout(timer);
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

  return (
    <View style={{ flex: 1, backgroundColor: c.giay, paddingTop: insets.top }} accessibilityViewIsModal role="dialog" aria-label={`Trận ${phase.name}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: c.vien, backgroundColor: c.the }}>
        <Btn tone="ghost" icon={LogOut} label="Rời trận" onPress={() => (b.result ? onExit(b) : setConfirmExit(true))} />
        <View style={{ flex: 1 }}>
          <Txt f="displayHeavy" size={17} numberOfLines={1}>
            {phase.name}
          </Txt>
          <Txt size={12} color={c.muc2}>
            {phase.date} · Lượt {b.round}
          </Txt>
        </View>
        {b.tide && <TideMeter tide={b.tide} round={b.round} />}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
        <View style={{ minHeight: 300, overflow: 'hidden' }}>
          <BattleBackdrop bg={phase.bg} tide={b.tide} dark={dark} stakes={!!phase.rules.tide} />
          <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 8, paddingTop: 22, paddingBottom: 12, gap: 22 }}>
            <View style={{ flexDirection: 'row', gap: 8 }} accessibilityLabel="Quân địch">
              {b.enemies.map((e) => (
                <FighterCard key={e.uid} f={e} fx={b.fx} targeted={target === e.uid} onTarget={b.turn === 'ally' ? () => setTarget(e.uid) : undefined} showIntents={showIntents} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }} accessibilityLabel="Đội ta">
              {b.allies.map((a, i) => (
                <FighterCard key={a.uid} f={a} fx={b.fx} active={b.turn === 'ally' && i === b.active} showIntents={0} />
              ))}
            </View>
          </View>
        </View>

        <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', padding: 12, gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Txt f="display" size={14} color={c.muc2}>
              Hào Khí
            </Txt>
            <View style={{ flexDirection: 'row', gap: 4 }} accessible accessibilityRole="image" accessibilityLabel={`Hào Khí ${b.haoKhi}/3`}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: i < b.haoKhi ? c.son : c.giay2, borderColor: i < b.haoKhi ? c.sonDam : c.vien2 }}>
                  <Flame size={13} color={i < b.haoKhi ? '#ffffff' : c.muc3} />
                </View>
              ))}
            </View>
            {relic && (
              <Btn
                title={b.relicUsed ? 'Đã dùng cổ vật' : relic.name}
                icon={relic.Icon}
                tone="giay"
                size="sm"
                disabled={!relicUsable}
                label={`Dùng cổ vật ${relic.name}: ${relic.effect}`}
                onPress={() => setB((cur) => applyRelic(cur))}
                style={{ marginLeft: 'auto' }}
              />
            )}
          </View>

          {b.result ? null : me && hero ? (
            <Card pad={12} style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }} accessibilityLiveRegion="polite">
                <HeroMedallion hero={hero} size={36} />
                <Txt f="displayHeavy">Lượt của {me.name}</Txt>
                <Txt size={12} color={c.muc2} style={{ marginLeft: 'auto' }}>
                  Chạm quân địch để chọn mục tiêu
                </Txt>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Btn title={`${hero.basic.name} · Đánh thường`} icon={Swords} tone="giay" style={{ flexGrow: 1, flexBasis: 180 }} full onPress={() => setB((cur) => allyAct(cur, 'basic', target))} />
                <Btn title={`${hero.strat.name} · 1 câu hỏi`} icon={Sparkles} tone="ngoc" style={{ flexGrow: 1, flexBasis: 180 }} full disabled={busy} loading={busy} onPress={() => startAsk('strat')} />
                <Btn
                  title={b.haoKhi < 3 ? `${hero.ult.name} · cần ${3 - b.haoKhi} Hào Khí` : `${hero.ult.name} · Tuyệt chiêu`}
                  icon={Flame}
                  style={{ flexGrow: 1, flexBasis: 180 }}
                  full
                  disabled={b.haoKhi < 3}
                  onPress={() => setB((cur) => allyAct(cur, 'ult', target))}
                />
              </View>
              <Txt size={12} color={c.muc2}>
                {hero.strat.desc} Trả lời đúng: mạnh gấp rưỡi và +1 Hào Khí; chưa đúng: còn nửa sức, không mất lượt.
              </Txt>
            </Card>
          ) : (
            <Card flat pad={12}>
              <Txt f="semibold" color={c.muc2} center accessibilityLiveRegion="polite">
                Quân giặc đang hành động…
              </Txt>
            </Card>
          )}

          <Card flat style={{ borderColor: c.dong, backgroundColor: c.dongNhat, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <ScrollText size={24} color={c.dongChu} />
            <View style={{ flex: 1, minWidth: 180 }}>
              <Txt f="displayHeavy" size={16}>
                Kế sách: {phase.strat.name}
              </Txt>
              <Txt size={14}>{phase.strat.desc}</Txt>
              {retreatLeft > 0 && (
                <Txt f="semibold" size={14} color={c.sonChu}>
                  Cầm cự thêm {retreatLeft} lượt nữa.
                </Txt>
              )}
              {b.tide && phase.strat.effect === 'bach_dang' && !b.stratUsed && (
                <Txt f="semibold" size={14} color={b.tide === 'rut' ? c.ngocChu : c.muc2}>
                  {b.tide === 'rut' ? 'Triều đang rút – thời cơ đã đến!' : 'Chờ thủy triều rút…'}
                </Txt>
              )}
            </View>
            <Btn title={b.stratUsed ? 'Đã dùng' : 'Dùng (1 câu hỏi)'} icon={b.stratUsed ? Check : Sparkles} tone="dong" disabled={stratDisabled} onPress={() => startAsk('phase')} />
          </Card>

          <Inset style={{ gap: 4 }}>
            <View accessibilityLiveRegion="polite" accessibilityLabel="Diễn biến trận đánh" style={{ gap: 4 }}>
              {b.log.slice(-3).map((l) => (
                <Txt key={l.id} size={14} f={l.tone === 'good' ? 'semibold' : 'body'} color={l.tone === 'good' ? c.ngocChu : l.tone === 'bad' || l.tone === 'enemy' ? c.sonChu : l.tone === 'info' ? c.muc2 : c.muc}>
                  {l.text}
                </Txt>
              ))}
            </View>
          </Inset>
        </View>
      </ScrollView>

      <InlineSheet open={!!ask} onClose={() => undefined} persistent wide title={ask?.kind === 'phase' ? `Kế sách: ${phase.strat.name}` : (hero?.strat.name ?? 'Kế sách')} subtitle="Trả lời để tung kế sách">
        {ask && (
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
        )}
      </InlineSheet>
      {b.result && <BattleResult b={b} onDone={() => onExit(b)} />}
      <InlineSheet open={confirmExit} onClose={() => setConfirmExit(false)} title="Rời trận?" subtitle="Trận đánh sẽ không được tính, Quân Lực đã dùng không được hoàn lại.">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn title="Ở lại" tone="giay" full style={{ flex: 1 }} onPress={() => setConfirmExit(false)} />
          <Btn title="Rời trận" full style={{ flex: 1 }} onPress={() => onExit(null)} />
        </View>
      </InlineSheet>
    </View>
  );
};

const FX_NATIVE = Platform.OS !== 'web';

const FighterCard: React.FC<{ f: Fighter; active?: boolean; targeted?: boolean; onTarget?: () => void; showIntents: number; fx: BattleFx[] }> = ({ f, active = false, targeted = false, onTarget, showIntents, fx }) => {
  const { c } = useTheme();
  const reduce = useReduceMotion();
  const out = f.st.ko || f.st.fled || f.st.captured;
  const myFx = fx.filter((x) => x.uid === f.uid);
  const hit = myFx.find((x) => x.kind === 'hit');
  const heal = myFx.find((x) => x.kind === 'heal' || x.kind === 'buff');
  const actFx = myFx.find((x) => x.kind === 'act');
  const miss = myFx.find((x) => x.kind === 'miss');
  const shake = useShake(hit ? hit.seq : null);
  const floatHit = useFloatUp(hit?.amount !== undefined ? hit.seq : null);
  const floatHeal = useFloatUp(heal?.amount ? heal.seq : null);
  const floatMiss = useFloatUp(miss ? miss.seq : null);
  const lunge = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!actFx || reduce) return;
    lunge.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(lunge, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: FX_NATIVE }),
      Animated.timing(lunge, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: FX_NATIVE }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [actFx?.seq, reduce, lunge, actFx]);
  const def = f.side === 'enemy' ? ENEMIES[f.ref] : null;
  const hero = f.side === 'ally' ? HERO_BY_ID[f.ref] : null;
  const status: Array<{ key: string; text: string; bg: string; fg: string }> = [];
  if (f.st.atkUp > 0) status.push({ key: 'atk', text: `Tấn công +${Math.round(f.st.atkUp * 100)}%`, bg: c.sonNhat, fg: c.sonChu });
  if (f.st.defUp > 0) status.push({ key: 'def', text: 'Phòng thủ tăng', bg: c.thuyNhat, fg: c.thuyChu });
  if (f.st.taunt > 0) status.push({ key: 'taunt', text: 'Khiêu khích', bg: c.hoaNhat, fg: c.hoaChu });
  if (f.st.shield > 0) status.push({ key: 'shield', text: `Khiên ${f.st.shield}`, bg: c.ngocNhat, fg: c.ngocChu });
  if (f.st.evade > 0) status.push({ key: 'evade', text: 'Né đòn', bg: c.ngocNhat, fg: c.ngocChu });
  if (f.st.fear) status.push({ key: 'fear', text: 'Hoảng sợ', bg: c.thongNhat, fg: c.thongChu });
  if (f.st.stun > 0) status.push({ key: 'stun', text: 'Bị chặn', bg: c.dongNhat, fg: c.dongChu });
  if (f.st.weaken > 0) status.push({ key: 'weak', text: 'Yếu thế', bg: c.dongNhat, fg: c.dongChu });
  if (f.st.exhausted) status.push({ key: 'tired', text: 'Kiệt sức', bg: c.dongNhat, fg: c.dongChu });
  const pickable = !!onTarget && !out;
  const borderColor = out ? c.vien : active ? c.dong : targeted ? c.son : c.vien;
  return (
    <Animated.View
      style={[
        { flex: 1 },
        shake,
        { transform: [...shake.transform, { translateY: lunge.interpolate({ inputRange: [0, 1], outputRange: [0, f.side === 'ally' ? -10 : 10] }) }] },
      ]}
    >
      <Pressable
        onPress={onTarget}
        disabled={!pickable}
        accessibilityRole={pickable ? 'button' : undefined}
        accessibilityState={pickable ? { selected: targeted } : undefined}
        accessibilityLabel={pickable ? `Chọn mục tiêu ${f.name}, binh lực ${f.hp}/${f.maxHp}` : `${f.name}, ${f.side === 'ally' ? 'khí lực' : 'binh lực'} ${f.hp}/${f.maxHp}`}
        style={{
          padding: 8, borderRadius: 18, backgroundColor: c.the, borderWidth: active || targeted ? 3 : 2, borderColor, opacity: out ? 0.45 : 1,
        }}
      >
        {f.side === 'enemy' && !out && f.intents.length > 0 && (
          <View style={{ position: 'absolute', top: -14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 4, zIndex: 2 }}>
            {f.intents.slice(0, showIntents).map((intent, i) => {
              const info = INTENT_INFO[intent];
              const Icon = info.Icon;
              return (
                <View
                  key={i}
                  accessible
                  accessibilityLabel={`${i === 0 ? 'Ý đồ lượt tới' : 'Ý đồ lượt sau'}: ${info.name} – ${info.desc}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, borderWidth: 2, opacity: i > 0 ? 0.7 : 1, backgroundColor: info.danger ? c.son : c.the, borderColor: info.danger ? c.sonDam : c.vien }}
                >
                  <Icon size={13} color={info.danger ? '#ffffff' : c.muc} />
                  <Txt f="bold" size={11} color={info.danger ? '#ffffff' : c.muc} numberOfLines={1}>
                    {info.name}
                  </Txt>
                </View>
              );
            })}
          </View>
        )}
        <View style={{ alignItems: 'center', gap: 4, marginTop: 4 }}>
          {hero ? <HeroMedallion hero={hero} size={44} /> : def ? <EnemyBadge enemy={def} size={44} /> : null}
          <Txt f="display" size={13} center numberOfLines={2} style={{ minHeight: 32 }}>
            {f.name}
          </Txt>
        </View>
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Heart size={12} color={f.side === 'ally' ? c.ngocChu : c.sonChu} />
            <Bar value={f.hp} max={f.maxHp} fill={f.side === 'ally' ? c.ngoc : c.son} height={8} style={{ flex: 1 }} />
          </View>
          <Txt f="bold" size={11} color={c.muc2} center>
            {f.hp}/{f.maxHp}
          </Txt>
          {f.side === 'enemy' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessible accessibilityLabel={`Sức bền ${f.name}: ${Math.round(f.stamina)}%`}>
              <Utensils size={12} color={c.dongChu} />
              <Bar value={f.stamina} max={100} fill={c.dong} height={6} style={{ flex: 1 }} />
            </View>
          )}
        </View>
        {out ? (
          <Chip text={f.st.captured ? 'Bị bắt sống' : f.st.fled ? 'Tháo chạy' : f.side === 'ally' ? 'Lui về hậu tuyến' : 'Bị đánh tan'} bg={c.giay2} fg={c.muc2} style={{ alignSelf: 'center', marginTop: 4 }} />
        ) : (
          status.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 2, marginTop: 4 }}>
              {status.slice(0, 2).map((s) => (
                <View key={s.key} style={{ paddingHorizontal: 6, borderRadius: 999, backgroundColor: s.bg }}>
                  <Txt f="bold" size={10} color={s.fg}>
                    {s.text}
                  </Txt>
                </View>
              ))}
            </View>
          )
        )}
        {hit?.amount !== undefined && (
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -6, right: 8 }, floatHit]}>
            <Txt f="displayHeavy" size={18} color={c.sonChu}>
              −{hit.amount}
            </Txt>
          </Animated.View>
        )}
        {heal?.amount ? (
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -6, left: 8 }, floatHeal]}>
            <Txt f="displayHeavy" size={18} color={c.ngocChu}>
              +{heal.amount}
            </Txt>
          </Animated.View>
        ) : null}
        {miss && (
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -6, left: 0, right: 0, alignItems: 'center' }, floatMiss]}>
            <Txt f="displayHeavy" size={14} color={c.thuyChu}>
              Né!
            </Txt>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
};

const TideMeter: React.FC<{ tide: TideState; round: number }> = ({ tide, round }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessible accessibilityLabel={`Thủy triều: ${TIDE_LABEL[tide]}`}>
      <Waves size={20} color={c.thuyChu} />
      {TIDE_CYCLE.map((t, i) => {
        const cur = (round - 1) % TIDE_CYCLE.length === i;
        const Icon = t === 'len' ? ArrowUp : t === 'rut' ? ArrowDown : Minus;
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: cur ? (t === 'rut' ? c.ngoc : c.thuy) : c.giay2 }}>
            <Icon size={12} color={cur ? (t === 'rut' ? ON_BRIGHT : '#ffffff') : c.muc3} />
            {cur && (
              <Txt f="bold" size={11} color={t === 'rut' ? ON_BRIGHT : '#ffffff'}>
                {TIDE_LABEL[t]}
              </Txt>
            )}
          </View>
        );
      })}
    </View>
  );
};

const BattleResult: React.FC<{ b: BattleState; onDone: () => void }> = ({ b, onDone }) => {
  const { state } = useGame();
  const { c } = useTheme();
  const stars = starsOf(b);
  const prevStars = state.campaign[b.phase.id] ?? 0;
  const win = b.result === 'win';
  const accurate = b.answered > 0 && b.correct / b.answered >= 0.8;
  const Line: React.FC<{ ok: boolean; text: string }> = ({ ok, text }) => (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
      {ok ? <Check size={16} color={c.ngocChu} style={{ marginTop: 2 }} /> : <X size={16} color={c.muc2} style={{ marginTop: 2 }} />}
      <Txt size={14} f={ok ? 'semibold' : 'body'} color={ok ? c.ngocChu : c.muc2} style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
  return (
    <InlineSheet open persistent onClose={onDone} wide title={win ? 'Chiến thắng!' : 'Lui quân'} subtitle={b.endText}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
        <View style={{ flexGrow: 1, flexBasis: 280, alignItems: 'center', gap: 10 }}>
          <Mascot size={110} mood={win ? 'excited' : 'sad'} accessory={win ? 'helmet' : 'none'} bob={win} />
          {win && <Stars n={stars} size={34} label={`Đạt ${stars}/3 sao`} />}
          <View style={{ alignSelf: 'stretch', gap: 6 }}>
            <Line ok={win} text="Thắng trận" />
            <Line ok={b.stratGood} text={`Kế sách “${b.phase.strat.name}”: ${b.phase.strat.starHint.charAt(0).toLowerCase() + b.phase.strat.starHint.slice(1)}`} />
            <Line ok={accurate} text={`Trả lời đúng từ 80% (${b.correct}/${b.answered})`} />
          </View>
          {win && stars > prevStars && <Chip text="Kỷ lục mới của màn này!" bg={c.dongNhat} fg={c.dongChu} style={{ alignSelf: 'center' }} />}
        </View>
        <View style={{ flexGrow: 1, flexBasis: 280, gap: 10 }}>
          <Inset pad={16} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <BookOpen size={20} color={c.ngocChu} />
              <Txt f="display" size={16} style={{ flex: 1 }}>
                Sử Ký: {b.phase.name} ({b.phase.date})
              </Txt>
            </View>
            <Txt>{b.phase.history}</Txt>
            <LoreChip lore="chinh_su" />
          </Inset>
          {b.phase.id === 'm2p1' && win && (
            <Card flat style={{ borderColor: c.hoa, backgroundColor: c.hoaNhat, gap: 4 }}>
              <Txt f="display" size={16} color={c.hoaChu}>
                Tưởng nhớ Trần Bình Trọng
              </Txt>
              <Txt size={14}>Ông đã hy sinh để triều đình rút lui an toàn. Câu nói “Ta thà làm quỷ nước Nam, chứ không thèm làm vương đất Bắc!” còn vang mãi.</Txt>
            </Card>
          )}
          {!win && <InfoNote>Mỗi câu sai trong trận đều có giải thích. Em ôn lại chủ đề của màn ở Quốc Tử Giám rồi đánh lại nhé – không mất gì ngoài lượt chơi.</InfoNote>}
          <Btn title={win ? 'Nhận thưởng' : 'Về bản đồ chiến dịch'} icon={win ? Trophy : RotateCcw} tone={win ? 'ngoc' : 'son'} size="lg" full onPress={onDone} />
        </View>
      </View>
    </InlineSheet>
  );
};
