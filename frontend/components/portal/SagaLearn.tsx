/**
 * Hành trình Đông A – học, luyện tập và tổng kết một chặng:
 *   - Thẻ kiến thức ngắn (ai, ở đâu, khi nào, vì sao, diễn biến), mỗi thẻ có nút "Xem nguồn".
 *   - Năm mẫu minigame dùng lại cho mọi chặng: trắc nghiệm, quyết định chiến thuật, xếp trình tự (bấm nút lên / xuống, không cần kéo thả), lật thẻ ghép cặp,
 *     chọn địa điểm trên bản đồ. Máy chủ chấm từng câu; giao diện không giữ đáp án và chỉ nhận giải thích sau khi đã trả lời.
 *   - Tổng kết: kết quả, diễn biến lịch sử đã kiểm chứng kèm nguồn, ghi chú phần sáng tạo, phần thưởng (trao một lần) và chặng tiếp theo.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { ArrowDown, ArrowUp, BookOpen, Check, ChevronLeft, ChevronRight, Coins, Footprints, Lightbulb, Map as MapIcon, Play, Puzzle, RotateCcw, ScrollText, Sparkles, Swords, Target, X } from 'lucide-react-native';
import * as saga from '@/api/sagaApi';
import { errorMessage } from '@/api/client';
import type { Session } from '@/components/auth';
import {
  Chunky, Confetti, Flash, GameBtn, LoadState, Medal, Meter, Overlay, Panel, Pill, Portrait, RARITY, SG, ScreenHead, SkyBg, SourceLine, StarRow, Sunburst, TONE, TieuTuongArt, artIcon, mapSource, num, useFlash, useKeys,
  useLoad, useSaga, type SagaNav,
} from '@/components/portal/SagaKit';
import { Txt } from '@/components/ui';
import { useReduceMotion, useShake } from '@/hooks/use-motion';
import { play } from '@/lib/saga-sound';
import type { AnswerOutcome, Choice, Completion, LessonView, PracticeFinished, PracticeItem, PracticeSession, SagaMapInfo, StageSummary } from '@/types/saga';

// ---------------------------------------------------------------------- thẻ kiến thức
const KIND_TONE: Record<string, [string, string]> = { who: [SG.purple, '#efe4ff'], where: [SG.green, '#e2f7e6'], when: [SG.blue, '#e3f2ff'], why: [SG.orange, '#fff0db'], how: [SG.red, '#ffe3e3'] };

export const LessonScreen: React.FC<{ session: Session; nav: SagaNav; stageId: number; campaignNo: number }> = ({ session, nav, stageId, campaignNo }) => {
  const s = useSaga();
  const data = useLoad<LessonView>(session, (t) => saga.lesson(t, stageId), [stageId]);
  const [i, setI] = useState(0);
  const [source, setSource] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useFlash();
  const view = data.data;
  const total = view?.cards.length ?? 0;
  const card = view?.cards[Math.min(i, Math.max(0, total - 1))];
  const back = (): void => nav.back('chien-dich', { c: campaignNo, s: stageId, v: null });
  const move = (d: number): void => { setSource(false); setI((n) => Math.max(0, Math.min(total - 1, n + d))); play('step'); };
  const finish = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const out = await saga.completeLesson(session.token, stageId);
      if (out.xp) nav.refresh();
      nav.go('chien-dich', { c: campaignNo, s: stageId, v: 'luyen' }, 'replace');
    } catch (e) {
      if ((e as { status?: number }).status === 401) session.expired();
      setFlash(errorMessage(e));
    } finally { setBusy(false); }
  };
  useKeys((k) => { if (k === 'ArrowRight' && i < total - 1) move(1); else if (k === 'ArrowLeft' && i > 0) move(-1); }, Boolean(view));
  const tone = KIND_TONE[card?.kind ?? 'how'] ?? KIND_TONE.how;
  const Art = artIcon(card?.art ?? null);
  return (
    <View style={{ flex: 1, backgroundColor: s.dark ? '#101a33' : '#eef6ff' }} testID="saga-lesson">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 760, gap: 14 }}>
          <ScreenHead title={view ? view.stage.title : 'Học kiến thức'} subtitle={view ? `${view.stage.place} · ${view.stage.date_label}` : undefined} onBack={back} backLabel="Về bảng thông tin chặng" />
          {!view || !card ? <LoadState loading={data.loading} error={data.error} onRetry={data.reload} /> : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Meter value={(i + 1) / total} fill={SG.green} label={`Thẻ ${i + 1} trên ${total}`} style={{ flex: 1 }} />
                <Txt f="heavy" size={14} color={s.ink}>Thẻ {i + 1}/{total}</Txt>
              </View>
              <Panel pad={0} tone={tone[0]} style={{ overflow: 'hidden' }} testID={`lesson-card-${i}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: s.dark ? s.card2 : tone[1] }}>
                  <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: tone[0], alignItems: 'center', justifyContent: 'center' }}><Art size={30} color="#ffffff" strokeWidth={2.3} /></View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Pill text={card.kind_label} bg={tone[0]} size={12} />
                    <Txt f="heavy" size={21} color={s.ink} accessibilityRole="header">{card.title}</Txt>
                  </View>
                </View>
                <View style={{ padding: 16, gap: 12 }}>
                  <Txt size={17} color={s.ink} style={{ lineHeight: 27 }}>{card.body}</Txt>
                  {card.facts.length ? (
                    <View style={{ gap: 6 }}>
                      {card.facts.map((f) => (
                        <View key={f.label} style={{ flexDirection: 'row', gap: 10, backgroundColor: s.card2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
                          <Txt f="bold" size={14} color={s.sub} style={{ width: 110 }}>{f.label}</Txt>
                          <Txt f="heavy" size={14} color={s.ink} style={{ flex: 1 }}>{f.value}</Txt>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {card.objective_text ? (
                    <View style={{ flexDirection: 'row', gap: 8 }}><Target size={16} color={SG.red} strokeWidth={2.6} style={{ marginTop: 3 }} /><Txt size={14} color={s.sub} style={{ flex: 1 }}>Mục tiêu: {card.objective_text}</Txt></View>
                  ) : null}
                  {card.source ? (
                    <View style={{ gap: 8 }}>
                      <GameBtn title={source ? 'Ẩn nguồn' : 'Xem nguồn'} icon={ScrollText} tone="white" size="sm" onPress={() => setSource((v) => !v)} testID="lesson-source" />
                      {source ? <View style={{ backgroundColor: s.card2, borderRadius: 14, padding: 12 }}><SourceLine source={card.source} /></View> : null}
                    </View>
                  ) : null}
                </View>
              </Panel>
              <Flash text={flash} />
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <GameBtn title="Trước" icon={ChevronLeft} tone="white" disabled={i === 0} onPress={() => move(-1)} testID="lesson-prev" />
                <View style={{ flex: 1 }} />
                {i < total - 1
                  ? <GameBtn title="Tiếp" iconRight={ChevronRight} tone="green" size="lg" onPress={() => move(1)} testID="lesson-next" />
                  : <GameBtn title={view.done ? 'Sang luyện tập' : 'Học xong · Luyện tập'} icon={Puzzle} tone="orange" size="lg" loading={busy} onPress={() => { void finish(); }} testID="lesson-finish" />}
              </View>
              <Txt size={13} color={s.sub} center>Trên máy tính có thể dùng phím ← → để lật thẻ.</Txt>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

// ---------------------------------------------------------------------- các mẫu minigame
export type ItemSkin = 'light' | 'quiz';
interface BodyProps { session: Session; item: PracticeItem; outcome: AnswerOutcome | null; step: AnswerOutcome | null; busy: boolean; onAnswer: (answer: Record<string, unknown>) => void; skin: ItemSkin }

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const OPTION_TONES: Array<[string, string, string]> = [[SG.quizA, '#c23a25', '#ffffff'], [SG.quizB, '#1c5fbd', '#ffffff'], [SG.quizC, '#c98300', '#3b2a00'], [SG.quizD, '#7a3fc0', '#ffffff']];

const Options: React.FC<{ options: Choice[]; grid: boolean; disabled: boolean; correctId: string | null; chosenId: string | null; reveal: boolean; onPick: (id: string) => void }> = ({ options, grid, disabled, correctId, chosenId, reveal, onPick }) => (
  <View style={{ flexDirection: grid ? 'row' : 'column', flexWrap: grid ? 'wrap' : 'nowrap', gap: 10 }}>
    {options.map((o, i) => {
      const right = reveal && o.id === correctId, wrong = reveal && o.id === chosenId && o.id !== correctId;
      const [bg, edge, fg] = right ? [SG.green, SG.greenEdge, '#ffffff'] : wrong ? [SG.red, SG.redEdge, '#ffffff'] : OPTION_TONES[i % 4];
      return (
        <Chunky key={o.id} bg={bg} edge={edge} onPress={() => onPick(o.id)} disabled={disabled} silent testID={`option-${LETTERS[i]}`}
          label={`Phương án ${LETTERS[i]}: ${o.text}${right ? ' (đáp án đúng)' : wrong ? ' (em đã chọn, chưa đúng)' : ''}`} selected={o.id === chosenId}
          style={[grid ? { flexBasis: '47%', flexGrow: 1 } : { alignSelf: 'stretch' }, { opacity: reveal && !right && !wrong ? 0.45 : 1 }]}>
          <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}><Txt f="heavy" size={15} color={edge}>{LETTERS[i]}</Txt></View>
            <Txt f="heavy" size={16} color={fg} style={{ flex: 1 }}>{o.text}</Txt>
            {right ? <Check size={22} color="#ffffff" strokeWidth={3.4} /> : wrong ? <X size={22} color="#ffffff" strokeWidth={3.4} /> : null}
          </View>
        </Chunky>
      );
    })}
  </View>
);

const ChoiceBody: React.FC<BodyProps> = ({ item, outcome, busy, onAnswer, skin }) => {
  const s = useSaga();
  const { width } = useWindowDimensions();
  const options = item.kind === 'quiz' || item.kind === 'tactic' ? item.options : [];
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => setPicked(null), [item.id]);
  const pick = (id: string): void => { if (outcome || busy) return; setPicked(id); onAnswer({ choice: id }); };
  useKeys((k) => {
    const i = /^[1-4]$/.test(k) ? Number(k) - 1 : 'abcd'.indexOf(k.toLowerCase());
    if (i >= 0 && options[i]) pick(options[i].id);
  }, !outcome && !busy);
  return (
    <View style={{ gap: 12 }}>
      {item.kind === 'tactic' ? (
        <View style={{ backgroundColor: skin === 'quiz' ? 'rgba(255,255,255,0.16)' : s.card2, borderRadius: 14, padding: 12, flexDirection: 'row', gap: 8 }}>
          <Swords size={18} color={skin === 'quiz' ? '#ffffff' : SG.red} strokeWidth={2.6} style={{ marginTop: 2 }} />
          <Txt size={15} color={skin === 'quiz' ? '#ffffff' : s.ink} style={{ flex: 1 }}>{item.situation}</Txt>
        </View>
      ) : null}
      <Options options={options} grid={item.kind === 'quiz' && width >= 600} disabled={Boolean(outcome) || busy} reveal={Boolean(outcome)}
        correctId={(outcome?.detail.correct_id as string | undefined) ?? null} chosenId={(outcome?.detail.chosen as string | undefined) ?? picked} onPick={pick} />
    </View>
  );
};

const SequenceBody: React.FC<BodyProps> = ({ item, outcome, busy, onAnswer, skin }) => {
  const s = useSaga();
  const source = item.kind === 'sequence' ? item.items : [];
  const [order, setOrder] = useState<Choice[]>(source);
  useEffect(() => setOrder(source), [item.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const swap = (i: number, d: number): void => setOrder((list) => { const j = i + d; if (j < 0 || j >= list.length) return list; const next = [...list]; [next[i], next[j]] = [next[j], next[i]]; play('step'); return next; });
  const right = (outcome?.detail.right as boolean[] | undefined) ?? null;
  const truth = (outcome?.detail.order as Array<{ id: string; text: string; when: string | null }> | undefined) ?? null;
  const ink = skin === 'quiz' ? '#1e2a4a' : s.ink;
  return (
    <View style={{ gap: 10 }}>
      <Txt f="semibold" size={14} color={skin === 'quiz' ? '#ffffff' : s.sub}>Xếp từ sớm nhất (trên) tới muộn nhất (dưới) bằng nút mũi tên, rồi bấm Kiểm tra.</Txt>
      {order.map((o, i) => (
        <View key={o.id} testID={`seq-row-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: right ? (right[i] ? '#e2f7e6' : '#ffe3e3') : skin === 'quiz' ? '#ffffff' : s.card, borderRadius: 14, borderWidth: 2, borderColor: right ? (right[i] ? SG.green : SG.red) : s.line, padding: 8 }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: SG.navy, alignItems: 'center', justifyContent: 'center' }}><Txt f="heavy" size={14} color="#ffffff">{i + 1}</Txt></View>
          <Txt f="bold" size={15} color={right ? '#1e2a4a' : ink} style={{ flex: 1 }}>{o.text}</Txt>
          {right ? (right[i] ? <Check size={20} color={SG.greenEdge} strokeWidth={3.2} /> : <X size={20} color={SG.redEdge} strokeWidth={3.2} />) : (
            <>
              <Pressable accessibilityRole="button" accessibilityLabel={`Đưa “${o.text}” lên trên`} disabled={i === 0 || busy} onPress={() => swap(i, -1)} testID={`seq-up-${i}`}
                style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#e3f2ff', alignItems: 'center', justifyContent: 'center', opacity: i === 0 ? 0.35 : 1 }}><ArrowUp size={20} color={SG.blueEdge} strokeWidth={3} /></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Đưa “${o.text}” xuống dưới`} disabled={i === order.length - 1 || busy} onPress={() => swap(i, 1)} testID={`seq-down-${i}`}
                style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#e3f2ff', alignItems: 'center', justifyContent: 'center', opacity: i === order.length - 1 ? 0.35 : 1 }}><ArrowDown size={20} color={SG.blueEdge} strokeWidth={3} /></Pressable>
            </>
          )}
        </View>
      ))}
      {!outcome ? <GameBtn title="Kiểm tra thứ tự" icon={Check} tone="green" loading={busy} onPress={() => onAnswer({ order: order.map((o) => o.id) })} testID="seq-submit" /> : null}
      {truth ? (
        <View style={{ gap: 4, backgroundColor: skin === 'quiz' ? 'rgba(255,255,255,0.16)' : s.card2, borderRadius: 14, padding: 12 }}>
          <Txt f="heavy" size={14} color={skin === 'quiz' ? '#ffffff' : s.ink}>Thứ tự đúng</Txt>
          {truth.map((t, i) => <Txt key={t.id} size={14} color={skin === 'quiz' ? '#ffffff' : s.ink}>{i + 1}. {t.text}{t.when ? ` (${t.when})` : ''}</Txt>)}
        </View>
      ) : null}
    </View>
  );
};

/** Một thẻ của trò lật thẻ ghép cặp: lúc đầu úp, tự lật ngửa lần lượt (bỏ hoạt ảnh khi người dùng chọn giảm chuyển động) rồi mới chọn được */
const PairCard: React.FC<{ text: string; state: 'idle' | 'picked' | 'matched' | 'wrong'; onPress: () => void; disabled: boolean; side: 'left' | 'right'; testID: string; delay: number }> = ({ text, state, onPress, disabled, side, testID, delay }) => {
  const shake = useShake(state === 'wrong' ? text : null);
  const reduce = useReduceMotion();
  const [up, setUp] = useState(reduce);
  const turn = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduce) { setUp(true); return undefined; }
    let live = true;
    const t = setTimeout(() => {
      Animated.timing(turn, { toValue: 0.04, duration: 120, useNativeDriver: false }).start(() => {
        if (!live) return;
        setUp(true);
        Animated.timing(turn, { toValue: 1, duration: 140, useNativeDriver: false }).start();
      });
    }, delay);
    return () => { live = false; clearTimeout(t); };
  }, [delay, reduce, turn]);
  if (!up) {
    return (
      <Animated.View style={{ transform: [{ scaleX: turn }] }} accessible accessibilityLabel="Thẻ đang úp, sắp lật" testID={`${testID}-back`}>
        <View style={{ minHeight: 58, borderRadius: 14, backgroundColor: SG.navy, borderBottomWidth: 4, borderBottomColor: SG.navyEdge, alignItems: 'center', justifyContent: 'center' }}><Txt f="heavy" size={22} color={SG.yellow}>?</Txt></View>
      </Animated.View>
    );
  }
  const [bg, edge, fg] = state === 'matched' ? [SG.green, SG.greenEdge, '#ffffff'] : state === 'wrong' ? [SG.red, SG.redEdge, '#ffffff'] : state === 'picked' ? [SG.yellow, SG.yellowEdge, SG.onYellow] : side === 'left' ? ['#ffffff', '#b9c8e6', '#1e2a4a'] : ['#eaf3ff', '#b9c8e6', '#1e2a4a'];
  return (
    <Animated.View style={shake}>
      <Animated.View style={{ transform: [{ scaleX: turn }] }}>
      <Chunky bg={bg} edge={edge} onPress={onPress} disabled={disabled || state === 'matched'} silent selected={state === 'picked'} testID={testID} radius={14} depth={4}
        label={`${text}${state === 'matched' ? ' (đã ghép đúng)' : state === 'picked' ? ' (đang chọn)' : ''}`} style={{ alignSelf: 'stretch', opacity: 1 }}>
        <View style={{ minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Txt f="heavy" size={14} color={fg} style={{ flex: 1 }}>{text}</Txt>
          {state === 'matched' ? <Check size={18} color="#ffffff" strokeWidth={3.4} /> : null}
        </View>
      </Chunky>
      </Animated.View>
    </Animated.View>
  );
};

const PairsBody: React.FC<BodyProps> = ({ item, outcome, step, busy, onAnswer, skin }) => {
  const s = useSaga();
  const cards = item.kind === 'pairs' ? item.cards : [];
  const [left, setLeft] = useState<string | null>(null);
  const [right, setRight] = useState<string | null>(null);
  const [wrong, setWrong] = useState<[string, string] | null>(null);
  const sent = useRef<string | null>(null);
  useEffect(() => { setLeft(null); setRight(null); setWrong(null); sent.current = null; }, [item.id]);
  // đủ một thẻ mỗi vế thì gửi cặp cho máy chủ kiểm tra
  useEffect(() => {
    if (!left || !right || busy || sent.current === `${left}|${right}`) return;
    sent.current = `${left}|${right}`;
    onAnswer({ left, right });
  }, [left, right, busy, onAnswer]);
  // kết quả của cặp vừa lật: sai thì rung đỏ rồi úp lại, đúng thì giữ màu xanh
  useEffect(() => {
    const last = outcome ?? step;
    if (!last || !last.detail.left) return undefined;
    const pair: [string, string] = [String(last.detail.left), String(last.detail.right)];
    play(last.detail.match ? 'right' : 'wrong');
    if (last.detail.match) { setLeft(null); setRight(null); sent.current = null; return undefined; }
    setWrong(pair);
    const t = setTimeout(() => { setWrong(null); setLeft(null); setRight(null); sent.current = null; }, 750);
    return () => clearTimeout(t);
  }, [step, outcome]);
  const stateOf = (token: string, matched: boolean): 'idle' | 'picked' | 'matched' | 'wrong' => (matched ? 'matched' : wrong?.includes(token) ? 'wrong' : token === left || token === right ? 'picked' : 'idle');
  const column = (side: 'left' | 'right', label: string): React.ReactElement => (
    <View style={{ flex: 1, gap: 8 }}>
      <Txt f="heavy" size={13} color={skin === 'quiz' ? '#ffffff' : s.sub} center>{label.toUpperCase()}</Txt>
      {cards.filter((c) => c.side === side).map((c, i) => (
        <PairCard key={c.token} text={c.text} side={side} state={stateOf(c.token, c.matched)} disabled={busy || Boolean(wrong) || Boolean(outcome)} testID={`pair-${c.token}`} delay={250 + (i * 2 + (side === 'left' ? 0 : 1)) * 110}
          onPress={() => { play('tap'); if (side === 'left') setLeft((v) => (v === c.token ? null : c.token)); else setRight((v) => (v === c.token ? null : c.token)); }} />
      ))}
    </View>
  );
  const misses = item.kind === 'pairs' ? item.misses : 0;
  return (
    <View style={{ gap: 10 }}>
      <Txt f="semibold" size={14} color={skin === 'quiz' ? '#ffffff' : s.sub}>Các thẻ lật ngửa lần lượt. Chọn một thẻ ở mỗi cột để ghép thành cặp đúng; ghép sai quá 2 lần sẽ bị trừ điểm.</Txt>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {column('left', item.kind === 'pairs' ? item.left_label : '')}
        {column('right', item.kind === 'pairs' ? item.right_label : '')}
      </View>
      <Txt f="bold" size={13} color={skin === 'quiz' ? '#ffffff' : s.sub}>Đã ghép {cards.filter((c) => c.matched).length / 2}/{item.kind === 'pairs' ? item.pairs_total : 0} cặp · ghép sai {misses} lần</Txt>
    </View>
  );
};

const MAP_RATIO: Record<number, [number, number]> = { 1: [1500, 1052], 2: [1000, 1458], 3: [1300, 974] };
const MAP_CACHE = new Map<number, SagaMapInfo>();
/** Ảnh và kích thước bản đồ của một cuộc kháng chiến (lấy theo cấu hình quản trị; dùng ảnh có sẵn khi chưa tải được) */
function useMapInfo(session: Session, no: number): Pick<SagaMapInfo, 'image_key' | 'image_url' | 'image_w' | 'image_h'> {
  const [info, setInfo] = useState<SagaMapInfo | null>(MAP_CACHE.get(no) ?? null);
  useEffect(() => {
    const hit = MAP_CACHE.get(no);
    if (hit) { setInfo(hit); return undefined; }
    let live = true;
    saga.campaign(session.token, no).then((c) => { MAP_CACHE.set(no, c.map); if (live) setInfo(c.map); }).catch(() => undefined);
    return () => { live = false; };
  }, [no, session.token]);
  const [w, h] = MAP_RATIO[no] ?? MAP_RATIO[1];
  return info ?? { image_key: `ban-do-khang-chien-${no}`, image_url: null, image_w: w, image_h: h };
}

const LocateBody: React.FC<BodyProps> = ({ session, item, outcome, busy, onAnswer, skin }) => {
  const s = useSaga();
  const no = item.kind === 'locate' ? item.campaign_no : 1;
  const spots = item.kind === 'locate' ? item.spots : [];
  const map = useMapInfo(session, no);
  const [boxW, setBoxW] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => setPicked(null), [item.id]);
  const ratio = map.image_w / Math.max(1, map.image_h);
  const w = Math.min(boxW, 520 * ratio), h = w / ratio;
  const correct = (outcome?.detail.correct_id as string | undefined) ?? null;
  const chosen = (outcome?.detail.chosen as string | undefined) ?? picked;
  const labels = new Map(((outcome?.detail.labels as Array<{ id: string; label: string }> | undefined) ?? []).map((l) => [l.id, l.label]));
  const pick = (id: string): void => { if (outcome || busy) return; setPicked(id); onAnswer({ choice: id }); };
  const toneOf = (id: string): [string, string] => (outcome ? (id === correct ? [SG.green, SG.greenEdge] : id === chosen ? [SG.red, SG.redEdge] : ['#9aa5bd', '#6f7b95']) : id === picked ? [SG.yellow, SG.yellowEdge] : [SG.red, SG.redEdge]);
  return (
    <View style={{ gap: 10 }}>
      <View onLayout={(e) => setBoxW(e.nativeEvent.layout.width)} style={{ alignItems: 'center' }}>
        {boxW > 0 ? (
          <View style={{ width: w, height: h, borderRadius: 16, overflow: 'hidden', borderWidth: 3, borderColor: TONE[no]?.main ?? SG.blue }}>
            <Image source={mapSource(map)} style={{ width: w, height: h }} resizeMode="stretch" accessibilityLabel="Bản đồ của cuộc kháng chiến, có các điểm đánh chữ để chọn" />
            {spots.map((p) => {
              const [bg, edge] = toneOf(p.id);
              return (
                <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Điểm ${p.letter}${labels.get(p.id) ? `: ${labels.get(p.id)}` : ''}`} disabled={Boolean(outcome) || busy} onPress={() => pick(p.id)} testID={`spot-${p.letter}`} hitSlop={6}
                  style={{ position: 'absolute', left: p.x * w - 20, top: p.y * h - 20, width: 40, height: 44, borderRadius: 20, backgroundColor: edge }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: bg, borderWidth: 3, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}><Txt f="heavy" size={17} color="#ffffff">{p.letter}</Txt></View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {spots.map((p) => {
          const [bg, edge] = toneOf(p.id);
          return (
            <Chunky key={p.id} bg={bg} edge={edge} onPress={() => pick(p.id)} disabled={Boolean(outcome) || busy} silent label={`Chọn điểm ${p.letter}${labels.get(p.id) ? `: ${labels.get(p.id)}` : ''}`} testID={`spot-btn-${p.letter}`} radius={14} depth={4}>
              <View style={{ minHeight: 44, minWidth: 64, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }}><Txt f="heavy" size={15} color={bg === SG.yellow ? SG.onYellow : '#ffffff'}>{p.letter}{labels.get(p.id) ? ` · ${labels.get(p.id)}` : ''}</Txt></View>
            </Chunky>
          );
        })}
      </View>
      <Txt size={12} color={skin === 'quiz' ? 'rgba(255,255,255,0.85)' : s.sub} center>Bấm vào điểm trên bản đồ hoặc vào nút chữ bên dưới.</Txt>
    </View>
  );
};

/** Thân của một câu luyện tập theo đúng mẫu minigame của nó */
export const ItemBody: React.FC<BodyProps> = (p) =>
  p.item.kind === 'sequence' ? <SequenceBody {...p} /> : p.item.kind === 'pairs' ? <PairsBody {...p} /> : p.item.kind === 'locate' ? <LocateBody {...p} /> : <ChoiceBody {...p} />;

/** Phản hồi sau khi trả lời: đúng / sai, giải thích, mục tiêu kiến thức và nguồn (máy chủ chỉ gửi sau khi đã chấm) */
export const Feedback: React.FC<{ outcome: AnswerOutcome; kind: PracticeItem['kind']; onNext: () => void; nextLabel: string; skin: ItemSkin }> = ({ outcome, kind, onNext, nextLabel, skin }) => {
  const s = useSaga();
  const half = outcome.score > 0 && outcome.score < 1;
  const [bg, edge, title] = outcome.timeout ? ['#ffe3e3', SG.red, 'Hết giờ!'] : outcome.score >= 1 ? ['#e2f7e6', SG.green, kind === 'tactic' ? 'Quyết định tốt nhất!' : 'Chính xác!'] : half ? ['#fff0db', SG.orange, kind === 'pairs' ? 'Ghép xong, nhưng sai hơi nhiều' : 'Tạm được, còn cách tốt hơn'] : ['#ffe3e3', SG.red, kind === 'pairs' ? 'Ghép xong, nhưng sai quá nhiều lần' : 'Chưa đúng'];
  const feedback = outcome.detail.feedback as string | null | undefined, best = outcome.detail.best_feedback as string | undefined;
  const pairs = outcome.detail.pairs as Array<{ id: string; left: string; right: string }> | undefined;
  useKeys((k) => { if (k === 'Enter') onNext(); });
  return (
    <View accessibilityLiveRegion="polite" testID="item-feedback" style={{ backgroundColor: s.dark && skin === 'light' ? s.card2 : bg, borderRadius: 18, borderWidth: 3, borderColor: edge, padding: 14, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {outcome.score >= 1 ? <Check size={22} color={SG.greenEdge} strokeWidth={3.4} /> : <Lightbulb size={22} color={half ? SG.orangeEdge : SG.redEdge} strokeWidth={2.8} />}
        <Txt f="heavy" size={18} color={s.dark && skin === 'light' ? s.ink : '#1e2a4a'} style={{ flex: 1 }}>{title}</Txt>
        {outcome.xp ? <Pill text={`+${outcome.xp} điểm`} icon={Sparkles} bg={SG.purple} /> : null}
      </View>
      {feedback ? <Txt size={15} color={s.dark && skin === 'light' ? s.ink : '#1e2a4a'}>{feedback}</Txt> : null}
      {best && outcome.score < 1 ? <Txt size={15} color={s.dark && skin === 'light' ? s.ink : '#1e2a4a'}>Phương án tốt nhất: {best}</Txt> : null}
      {pairs && outcome.score < 1 ? <Txt size={14} color={s.dark && skin === 'light' ? s.ink : '#1e2a4a'}>Các cặp đúng: {pairs.map((p) => `${p.left} – ${p.right}`).join('; ')}.</Txt> : null}
      {outcome.explanation ? <Txt size={15} color={s.dark && skin === 'light' ? s.ink : '#1e2a4a'}>{outcome.explanation}</Txt> : null}
      {outcome.objective_text ? <Txt size={13} color={s.dark && skin === 'light' ? s.sub : '#4a5672'}>Mục tiêu: {outcome.objective_text}{outcome.stage_title ? ` (chặng ${outcome.stage_title})` : ''}</Txt> : null}
      {outcome.source ? <SourceLine source={outcome.source} light={s.dark && skin === 'light'} /> : null}
      <GameBtn title={nextLabel} iconRight={ChevronRight} tone="green" onPress={onNext} testID="item-next" style={{ alignSelf: 'flex-end' }} />
    </View>
  );
};

// ---------------------------------------------------------------------- lượt luyện tập của chặng
export const PracticeScreen: React.FC<{ session: Session; nav: SagaNav; stageId: number; campaignNo: number }> = ({ session, nav, stageId, campaignNo }) => {
  const s = useSaga();
  const [sess, setSess] = useState<PracticeSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(0);
  const [outcome, setOutcome] = useState<AnswerOutcome | null>(null);
  const [step, setStep] = useState<AnswerOutcome | null>(null);
  const [finished, setFinished] = useState<PracticeFinished | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useFlash();
  const [round, setRound] = useState(0);
  const restart = useRef(false);
  const expired = useRef(session.expired);
  expired.current = session.expired;
  const scroller = useRef<ScrollViewInstance | null>(null);
  useEffect(() => {
    if (!outcome) return undefined;
    const t = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(t);
  }, [outcome]);

  useEffect(() => {
    let live = true;
    setLoading(true); setError(null); setOutcome(null); setStep(null); setFinished(null); setShowResult(false);
    saga.startPractice(session.token, stageId, restart.current).then((p) => { if (!live) return; restart.current = false; setSess(p); setCursor(Math.min(p.index, p.total - 1)); setLoading(false); }).catch((e) => {
      if (!live) return;
      if ((e as { status?: number }).status === 401) expired.current();
      setError(errorMessage(e)); setLoading(false);
    });
    return () => { live = false; };
  }, [session.token, stageId, round]);

  const item = sess?.items[cursor] ?? null;
  const answer = async (a: Record<string, unknown>): Promise<void> => {
    if (!sess || !item || busy) return;
    setBusy(true);
    try {
      const res = await saga.act<PracticeSession, AnswerOutcome, PracticeFinished>(session.token, sess.session_id, sess.seq, { type: 'answer', item_id: item.id, answer: a });
      setSess(res.view);
      if (res.outcome.done) { setOutcome(res.outcome); if (item.kind !== 'pairs') play(res.outcome.correct ? 'right' : 'wrong'); } else setStep(res.outcome);
      if (res.finished) { setFinished(res.finished); if (res.finished.xp) nav.refresh(); }
      if (res.completion?.first) nav.setReward({ stageId, completion: res.completion });
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 401) session.expired();
      else if (status === 409) setRound((n) => n + 1); // phiên đã đổi ở thẻ khác: tải lại trạng thái chuẩn
      setFlash(errorMessage(e));
    } finally { setBusy(false); }
  };
  const next = (): void => {
    if (!sess) return;
    setOutcome(null); setStep(null);
    if (finished) { setShowResult(true); play(finished.passed ? 'win' : 'lose'); return; }
    const i = sess.items.findIndex((it) => !it.done);
    setCursor(i < 0 ? sess.total - 1 : i);
  };
  const back = (): void => nav.back('chien-dich', { c: campaignNo, s: stageId, v: null });
  const doneCount = sess?.items.filter((it) => it.done).length ?? 0;
  return (
    <View style={{ flex: 1, backgroundColor: s.dark ? '#101a33' : '#fff7e6' }} testID="saga-practice">
      <ScrollView ref={scroller} contentContainerStyle={{ padding: 16, paddingBottom: 48, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 820, gap: 14 }}>
          <ScreenHead title={sess?.stage ? `Luyện tập: ${sess.stage.title}` : 'Luyện tập'} subtitle={sess ? `Cần đạt ${sess.pass_percent ?? 70}% để mở phần nhập vai` : undefined} onBack={back} backLabel="Về bảng thông tin chặng" />
          {!sess || !item ? <LoadState loading={loading} error={error} onRetry={() => setRound((n) => n + 1)} /> : showResult && finished ? (
            <Panel style={{ alignItems: 'center', gap: 10, overflow: 'hidden' }} testID="practice-result">
              {finished.passed ? <Confetti /> : null}
              <TieuTuongArt size={96} cheer={finished.passed} />
              <Txt f="heavy" size={26} color={finished.passed ? SG.greenEdge : SG.redEdge} accessibilityRole="header">{finished.passed ? 'Đạt rồi!' : 'Chưa đạt'}</Txt>
              <StarRow n={finished.stars} size={34} />
              <Txt f="heavy" size={40} color={s.ink}>{finished.percent}%</Txt>
              <Txt f="semibold" size={15} color={s.sub} center>Đúng trọn vẹn {finished.right}/{finished.total} câu · ngưỡng đạt {finished.pass_percent}% · tốt nhất của em {finished.best}%</Txt>
              {finished.xp ? <Pill text={`+${finished.xp} điểm kinh nghiệm`} icon={Sparkles} bg={SG.purple} style={{ alignSelf: 'center' }} /> : null}
              {!finished.passed ? <Txt size={14} color={s.sub} center>Xem lại thẻ kiến thức rồi luyện lại. Các câu em trả lời sai đã được đưa vào mục Câu hỏi để ôn.</Txt> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 6 }}>
                {finished.passed ? <GameBtn title="Nhập vai khám phá" icon={Footprints} tone="red" size="lg" onPress={() => nav.go('chien-dich', { c: campaignNo, s: stageId, v: 'kham-pha' }, 'replace')} testID="practice-to-explore" /> : <GameBtn title="Xem lại thẻ kiến thức" icon={BookOpen} tone="green" size="lg" onPress={() => nav.go('chien-dich', { c: campaignNo, s: stageId, v: 'hoc' }, 'replace')} testID="practice-to-lesson" />}
                <GameBtn title="Luyện lại" icon={RotateCcw} tone="white" size="lg" onPress={() => { restart.current = true; setRound((n) => n + 1); }} testID="practice-retry" />
              </View>
            </Panel>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Pill text={`Câu ${cursor + 1}/${sess.total}`} bg={SG.navy} />
                <Meter value={doneCount / sess.total} fill={SG.orange} label={`Đã làm ${doneCount} trên ${sess.total} câu`} style={{ flex: 1 }} />
                <Pill text={item.kind_label} icon={item.kind === 'locate' ? MapIcon : item.kind === 'tactic' ? Swords : Puzzle} bg={s.card2} fg={s.ink} />
              </View>
              <Panel testID={`practice-item-${item.kind}`}><Txt f="heavy" size={19} color={s.ink} accessibilityRole="header">{item.prompt}</Txt></Panel>
              <ItemBody session={session} item={item} outcome={outcome} step={step} busy={busy} onAnswer={(a) => { void answer(a); }} skin="light" />
              <Flash text={flash} />
              {outcome ? <Feedback outcome={outcome} kind={item.kind} onNext={next} nextLabel={finished ? 'Xem kết quả' : 'Câu tiếp'} skin="light" /> : null}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

// ---------------------------------------------------------------------- tổng kết chặng và phần thưởng
const RewardOverlay: React.FC<{ completion: Completion; title: string; onClose: () => void }> = ({ completion, title, onClose }) => {
  const r = completion.rewards;
  useEffect(() => { play('reward'); }, []);
  return (
    <Overlay label="Phần thưởng hoàn thành chặng" testID="reward-overlay" maxWidth={480}>
      <View style={{ borderRadius: 26, overflow: 'hidden', borderWidth: 4, borderColor: SG.yellow }}>
        <Sunburst color="#8f1d2a" ray="#a82634" size={900} />
        <Confetti />
        <ScrollView contentContainerStyle={{ alignItems: 'center', padding: 20, gap: 10 }}>
          <Txt f="heavy" size={15} color={SG.yellow}>HOÀN THÀNH CHẶNG</Txt>
          <Txt f="heavy" size={26} color="#ffffff" center accessibilityRole="header">{title}</Txt>
          <StarRow n={completion.stars} size={36} dim="rgba(255,255,255,0.3)" />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {r.xp ? <Pill text={`+${num(r.xp)} điểm`} icon={Sparkles} bg={SG.purple} size={15} /> : null}
            {r.gold ? <Pill text={`+${num(r.gold)} vàng`} icon={Coins} bg={SG.yellow} fg={SG.onYellow} size={15} /> : null}
          </View>
          {r.card ? (
            <View style={{ alignItems: 'center', gap: 4, backgroundColor: RARITY[r.card.rarity]?.main ?? SG.blue, borderRadius: 18, padding: 10, borderWidth: 3, borderColor: '#ffffff' }}>
              <Txt f="heavy" size={12} color="#ffffff">THẺ NHÂN VẬT MỚI!</Txt>
              <Portrait code={r.card.portrait} size={120} />
              <Txt f="heavy" size={17} color="#ffffff">{r.card.name}</Txt>
              <Txt f="bold" size={12} color="#ffffff">{RARITY[r.card.rarity]?.label ?? ''} · {r.card.title}</Txt>
            </View>
          ) : null}
          {r.badge ? <View style={{ alignItems: 'center' }}><Medal code={r.badge.code ?? ''} size={64} /><Txt f="heavy" size={14} color="#ffffff">Huy hiệu: {r.badge.name}</Txt></View> : null}
          {r.docs.length ? <Txt f="semibold" size={14} color="#ffe9a8" center>Mở trong Kho tư liệu: {r.docs.map((d) => d.title).join(', ')}</Txt> : null}
          {completion.campaign_done ? <Txt f="heavy" size={15} color={SG.yellow} center>Em đã đi hết cuộc kháng chiến này!</Txt> : null}
          <GameBtn title="Nhận thưởng" icon={Check} tone="yellow" size="lg" onPress={onClose} testID="reward-claim" style={{ alignSelf: 'center', marginTop: 6 }} />
        </ScrollView>
      </View>
    </Overlay>
  );
};

export const SummaryScreen: React.FC<{ session: Session; nav: SagaNav; stageId: number; campaignNo: number }> = ({ session, nav, stageId, campaignNo }) => {
  const s = useSaga();
  const data = useLoad<StageSummary>(session, (t) => saga.summary(t, stageId), [stageId]);
  const sum = data.data;
  const reward = nav.reward?.stageId === stageId ? nav.reward.completion : null;
  const stats = useMemo(() => (sum ? [
    { label: 'Hiểu kiến thức', value: `${sum.result.knowledge_percent}%`, note: `${sum.result.practice_tries} lượt luyện tập` },
    { label: 'Nhập vai', value: `${sum.result.explore_hints + sum.result.explore_mistakes}`, note: `${sum.result.explore_hints} lần xem gợi ý, ${sum.result.explore_mistakes} lần sai` },
    ...(sum.result.battle ? [{ label: 'Trận đánh', value: `${num(sum.result.battle.score)} điểm`, note: `${sum.result.battle.stars} sao sau ${sum.result.battle.tries} lượt` }] : []),
  ] : []), [sum]);
  return (
    <View style={{ flex: 1 }} testID="saga-summary">
      <SkyBg hill={false} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 820, gap: 14 }}>
          <ScreenHead title={sum ? `Tổng kết: ${sum.stage.title}` : 'Tổng kết chặng'} subtitle={sum ? `${sum.stage.place} · ${sum.stage.date_label}` : undefined}
            onBack={() => nav.back('chien-dich', { c: campaignNo, s: null, v: null })} backLabel="Về bản đồ chiến dịch" />
          {!sum ? <LoadState loading={data.loading} error={data.error} onRetry={data.reload} /> : (
            <>
              <Panel style={{ alignItems: 'center', gap: 8 }}>
                <StarRow n={sum.result.stars} size={36} />
                <Txt f="semibold" size={14} color={s.sub}>Sao kiến thức tính theo phần luyện tập, tách riêng với điểm trận đánh.</Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', alignSelf: 'stretch' }}>
                  {stats.map((st) => (
                    <View key={st.label} style={{ flexGrow: 1, flexBasis: 150, backgroundColor: s.card2, borderRadius: 14, padding: 10, alignItems: 'center' }}>
                      <Txt f="bold" size={13} color={s.sub}>{st.label}</Txt>
                      <Txt f="heavy" size={22} color={s.ink}>{st.value}</Txt>
                      <Txt size={12} color={s.sub} center>{st.note}</Txt>
                    </View>
                  ))}
                </View>
              </Panel>

              <Panel style={{ gap: 10 }} testID="summary-debrief">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><ScrollText size={20} color={SG.red} strokeWidth={2.4} /><Txt f="heavy" size={19} color={s.ink} accessibilityRole="header" style={{ flex: 1 }}>{sum.debrief.title}</Txt></View>
                {sum.debrief.paragraphs.map((p, i) => <Txt key={i} f="serif" size={18} color={s.ink} style={{ lineHeight: 29 }}>{p}</Txt>)}
                <Txt f="heavy" size={14} color={s.sub}>NGUỒN THAM KHẢO</Txt>
                {sum.debrief.sources.map((src) => <SourceLine key={src.key} source={src} />)}
              </Panel>

              <Panel style={{ flexDirection: 'row', gap: 10 }} tone={SG.orange}>
                <Lightbulb size={20} color={SG.orangeEdge} strokeWidth={2.6} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Txt f="heavy" size={15} color={s.ink}>Phần sáng tạo trong trò chơi</Txt>
                  <Txt size={14} color={s.sub}>{sum.debrief.fiction}</Txt>
                </View>
              </Panel>

              {sum.weak_objectives.length ? (
                <Panel style={{ gap: 8 }}>
                  <Txt f="heavy" size={16} color={s.ink} accessibilityRole="header">Nên ôn lại</Txt>
                  {sum.weak_objectives.map((w) => (
                    <View key={w.objective} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <Target size={16} color={SG.red} strokeWidth={2.6} /><Txt size={14} color={s.ink} style={{ flex: 1 }}>{w.text}</Txt><Txt f="heavy" size={14} color={SG.orangeEdge}>{w.percent}% đúng</Txt>
                    </View>
                  ))}
                  <GameBtn title="Ôn câu hỏi" icon={RotateCcw} tone="purple" size="sm" onPress={() => nav.go('cau-hoi', { c: null, s: null, v: null })} testID="summary-review" />
                </Panel>
              ) : null}

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                {sum.next ? <GameBtn title={`Chặng tiếp theo: ${sum.next.title}`} icon={Play} tone="yellow" size="lg" onPress={() => nav.go('chien-dich', { c: sum.next!.campaign_no, s: sum.next!.id, v: null }, 'replace')} testID="summary-next" /> : null}
                <GameBtn title="Về bản đồ" icon={MapIcon} tone="white" size="lg" onPress={() => nav.go('chien-dich', { c: campaignNo, s: null, v: null }, 'replace')} testID="summary-map" />
              </View>
            </>
          )}
        </View>
      </ScrollView>
      {reward && sum ? <RewardOverlay completion={reward} title={sum.stage.title} onClose={() => { nav.setReward(null); nav.refresh(); }} /> : null}
    </View>
  );
};
