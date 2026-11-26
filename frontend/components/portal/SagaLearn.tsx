/**
 * Các bước học trong một chặng và các màn ôn của "Binh thư Sát Thát" (25/11/2026, theo bản vẽ người dùng gửi):
 *   - Thám sử (bước 2/5): bản đồ cảnh của chặng có các điểm sáng; chạm một điểm mở thẻ Binh thư (Nhân vật, Địa thế, Thời cơ, Thế trận, Kế sách) kèm nguồn.
 *     "Nhận thẻ" thì thẻ vào sổ Binh thư; nhặt đủ thẻ thì Hội đồng quân sự mở (máy chủ ghi `hk_saga_progress.lore`).
 *   - Hội đồng quân sự (bước 3/5): năm mẫu câu hỏi (trắc nghiệm, quyết định chiến thuật, xếp trình tự, lật thẻ ghép cặp, chọn địa điểm) do máy chủ chấm;
 *     "Gợi ý chiến thuật" (mua ở Chợ phiên) gạch bỏ một phương án sai. Đạt ngưỡng thì sang Xuất trận.
 *   - Sử quan tổng kết (bước 5/5): sao, bảng so sánh lựa chọn của em với lịch sử, nhận xét của Tiểu Tướng, diễn biến đã kiểm chứng kèm nguồn, phần thưởng (một lần).
 *   - Luyện binh riêng: lượt ôn tính giờ theo gợi ý của Tiểu Tướng (ưu tiên câu em hay sai); đồng hồ do máy chủ giữ, chỉ chạy khi câu được mở.
 *   - Binh thư: sổ thẻ đã nhặt chia ba ngăn Nhân vật / Kế sách / Địa danh, cùng thẻ nhân vật nhận khi xong chặng.
 * Máy chủ giữ đáp án, chấm điểm và trao thưởng; giao diện chỉ nhận giải thích sau khi đã trả lời.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Pressable, View, useWindowDimensions, type ImageSourcePropType, type ScrollViewInstance } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import {
  ArrowDown, ArrowUp, BookOpen, Box, Check, ChevronRight, Clock, Compass, Hourglass, Lightbulb, Lock, MapPin, MessageSquareText, RotateCcw, Store, Swords, Target, Users, X,
} from 'lucide-react-native';
import * as saga from '@/lib/saga-api';
import { errorMessage } from '@/api/client';
import type { Session } from '@/components/auth';
import { Flash, LoadState, Medal, OptionButton, Portrait, RARITY, SourceLine, StarRow, mapSource, num, useFlash, useKeys, useLoad, type OptionMark, type SagaNav, type SagaStep } from '@/components/portal/SagaKit';
import { HALL_ART } from '@/components/portal/HallMedia';
import { askTieuTuong } from '@/components/portal/SagaAsk';
import { BtBar, BtButton, BtCard, BtPage, Columns, Eyebrow, Pill, SegTabs, SerifTitle, StatTile, StepHeader, TtSays, useBT } from '@/components/portal/StudentDesign';
import { Sheet, Txt, useToast } from '@/components/ui';
import { useReduceMotion, useShake } from '@/hooks/use-motion';
import { play } from '@/lib/saga-sound';
import type { IconType } from '@/types/game';
import type {
  AnswerOutcome, CardAlbum, Choice, Completion, HintOutcome, LessonCard, LessonView, LoreCard, LoreCollect, LoreShelf, LoreView, PracticeFinished, PracticeItem, PracticeSession, ReviewFinished, ReviewInfo,
  SagaCard, SagaMapInfo, StageDetail, StageSummary,
} from '@/types/saga';

type StageProps = { session: Session; nav: SagaNav; stageId: number; campaignNo: number };
const statusOf = (e: unknown): number | undefined => (e as { status?: number }).status;
/** Chuyển sang một bước khác của cùng chặng (thay màn hiện tại để nút Back quay về Chiến dịch) */
const stepTo = (nav: SagaNav, grade: number, stageId: number, v: SagaStep | null): void => nav.go('chien-dich', { c: grade, s: stageId, v }, 'replace');

// ---------------------------------------------------------------------- năm mẫu câu hỏi (dùng cho Hội đồng quân sự và Luyện binh riêng)
interface BodyProps { session: Session; item: PracticeItem; outcome: AnswerOutcome | null; step: AnswerOutcome | null; busy: boolean; onAnswer: (answer: Record<string, unknown>) => void }
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

const ChoiceBody: React.FC<BodyProps> = ({ item, outcome, busy, onAnswer }) => {
  const t = useBT();
  const { width } = useWindowDimensions();
  const options = item.kind === 'quiz' || item.kind === 'tactic' ? item.options : [];
  const removed = new Set(item.removed ?? []);
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => setPicked(null), [item.id]);
  const pick = (id: string): void => { if (outcome || busy || removed.has(id)) return; setPicked(id); onAnswer({ choice: id }); };
  useKeys((k) => {
    const i = /^[1-4]$/.test(k) ? Number(k) - 1 : 'abcd'.indexOf(k.toLowerCase());
    if (i >= 0 && options[i]) pick(options[i].id);
  }, !outcome && !busy);
  const correctId = (outcome?.detail.correct_id as string | undefined) ?? null;
  const chosenId = (outcome?.detail.chosen as string | undefined) ?? picked;
  const grid = item.kind === 'quiz' && width >= 700;
  return (
    <View style={{ gap: 12 }}>
      {item.kind === 'tactic' ? (
        <BtCard tone="sunk" style={{ flexDirection: 'row', gap: 8 }}>
          <Swords size={17} color={t.accent} style={{ marginTop: 2 }} />
          <Txt size={15} color={t.ink} style={{ flex: 1, lineHeight: 22 }}>{item.situation}</Txt>
        </BtCard>
      ) : null}
      <View style={{ flexDirection: grid ? 'row' : 'column', flexWrap: grid ? 'wrap' : 'nowrap', gap: 8 }}>
        {options.map((o, i) => {
          const gone = removed.has(o.id) && !outcome;
          const mark: OptionMark = outcome ? (o.id === correctId ? 'right' : o.id === chosenId ? 'wrong' : 'dim') : gone ? 'dim' : o.id === chosenId ? 'picked' : 'idle';
          return (
            <OptionButton key={o.id} badge={gone ? '–' : LETTERS[i]} text={gone ? `${o.text} (đã gạch bỏ)` : o.text} mark={mark} disabled={Boolean(outcome) || busy || gone} onPress={() => pick(o.id)} testID={`option-${LETTERS[i]}`}
              label={`Phương án ${LETTERS[i]}: ${o.text}${gone ? ', đã gạch bỏ nhờ Gợi ý chiến thuật' : mark === 'right' ? ' (đáp án đúng)' : mark === 'wrong' ? ' (em đã chọn, chưa đúng)' : ''}`} style={grid ? { flexBasis: '48%', flexGrow: 1 } : undefined} />
          );
        })}
      </View>
    </View>
  );
};

const SequenceBody: React.FC<BodyProps> = ({ item, outcome, busy, onAnswer }) => {
  const t = useBT();
  const source = item.kind === 'sequence' ? item.items : [];
  const [order, setOrder] = useState<Choice[]>(source);
  useEffect(() => setOrder(source), [item.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const swap = (i: number, d: number): void => setOrder((list) => { const j = i + d; if (j < 0 || j >= list.length) return list; const next = [...list]; [next[i], next[j]] = [next[j], next[i]]; play('step'); return next; });
  const right = (outcome?.detail.right as boolean[] | undefined) ?? null;
  const truth = (outcome?.detail.order as Array<{ id: string; text: string; when: string | null }> | undefined) ?? null;
  return (
    <View style={{ gap: 8 }}>
      <Txt size={14} color={t.muted}>Xếp từ sớm nhất (trên) tới muộn nhất (dưới) bằng nút mũi tên, rồi bấm Kiểm tra.</Txt>
      {order.map((o, i) => {
        const ok = right ? right[i] : null;
        return (
          <View key={o.id} testID={`seq-row-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 12, borderWidth: 1,
            borderColor: ok === null ? t.line : ok ? t.green : t.danger, backgroundColor: ok === null ? t.card : ok ? t.greenSoft : t.dangerSoft }}>
            <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: t.card2, alignItems: 'center', justifyContent: 'center' }}><Txt f="heavy" size={14} color={t.muted}>{i + 1}</Txt></View>
            <Txt f="semibold" size={15} color={t.ink} style={{ flex: 1 }}>{o.text}</Txt>
            {ok !== null ? (ok ? <Check size={20} color={t.green} strokeWidth={2.6} /> : <X size={20} color={t.danger} strokeWidth={2.6} />) : (
              <>
                <BtButton icon={ArrowUp} tone="ghost" size="sm" label={`Đưa “${o.text}” lên trên`} disabled={i === 0 || busy} onPress={() => swap(i, -1)} testID={`seq-up-${i}`} />
                <BtButton icon={ArrowDown} tone="ghost" size="sm" label={`Đưa “${o.text}” xuống dưới`} disabled={i === order.length - 1 || busy} onPress={() => swap(i, 1)} testID={`seq-down-${i}`} />
              </>
            )}
          </View>
        );
      })}
      {!outcome ? <BtButton title="Kiểm tra thứ tự" icon={Check} loading={busy} onPress={() => onAnswer({ order: order.map((o) => o.id) })} testID="seq-submit" /> : null}
      {truth ? (
        <BtCard tone="sunk" style={{ gap: 4 }}>
          <Txt f="heavy" size={14} color={t.ink}>Thứ tự đúng</Txt>
          {truth.map((x, i) => <Txt key={x.id} size={14} color={t.ink}>{i + 1}. {x.text}{x.when ? ` (${x.when})` : ''}</Txt>)}
        </BtCard>
      ) : null}
    </View>
  );
};

/** Một thẻ của trò lật thẻ ghép cặp: lúc đầu úp, tự lật ngửa lần lượt (bỏ hoạt ảnh khi người dùng chọn giảm chuyển động) rồi mới chọn được */
const PairCard: React.FC<{ text: string; state: 'idle' | 'picked' | 'matched' | 'wrong'; onPress: () => void; disabled: boolean; testID: string; delay: number }> = ({ text, state, onPress, disabled, testID, delay }) => {
  const t = useBT();
  const shake = useShake(state === 'wrong' ? text : null);
  const reduce = useReduceMotion();
  const [up, setUp] = useState(reduce);
  const turn = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduce) { setUp(true); return undefined; }
    let live = true;
    const tm = setTimeout(() => {
      Animated.timing(turn, { toValue: 0.04, duration: 120, useNativeDriver: false }).start(() => {
        if (!live) return;
        setUp(true);
        Animated.timing(turn, { toValue: 1, duration: 140, useNativeDriver: false }).start();
      });
    }, delay);
    return () => { live = false; clearTimeout(tm); };
  }, [delay, reduce, turn]);
  if (!up) {
    return (
      <Animated.View style={{ transform: [{ scaleX: turn }] }} accessible accessibilityLabel="Thẻ đang úp, sắp lật" testID={`${testID}-back`}>
        <View style={{ minHeight: 54, borderRadius: 12, backgroundColor: t.night, alignItems: 'center', justifyContent: 'center' }}><Txt f="serifBold" size={20} color={t.gold}>?</Txt></View>
      </Animated.View>
    );
  }
  const k = state === 'matched' ? { line: t.green, bg: t.greenSoft } : state === 'wrong' ? { line: t.danger, bg: t.dangerSoft } : state === 'picked' ? { line: t.accent, bg: t.goldSoft } : { line: t.line, bg: t.card };
  return (
    <Animated.View style={shake}>
      <Animated.View style={{ transform: [{ scaleX: turn }] }}>
        <Pressable onPress={() => { play('tap'); onPress(); }} disabled={disabled || state === 'matched'} testID={testID} accessibilityRole="button" accessibilityState={{ disabled: disabled || state === 'matched', selected: state === 'picked' }}
          accessibilityLabel={`${text}${state === 'matched' ? ' (đã ghép đúng)' : state === 'picked' ? ' (đang chọn)' : ''}`}
          style={({ pressed }) => ({ minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: state === 'idle' ? 1 : 2, borderColor: k.line,
            backgroundColor: pressed && state === 'idle' ? t.card2 : k.bg })}>
          <Txt f="semibold" size={14} color={t.ink} style={{ flex: 1 }}>{text}</Txt>
          {state === 'matched' ? <Check size={18} color={t.green} strokeWidth={2.6} /> : null}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
};

const PairsBody: React.FC<BodyProps> = ({ item, outcome, step, busy, onAnswer }) => {
  const t = useBT();
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
  // kết quả của cặp vừa lật: sai thì rung đỏ rồi bỏ chọn, đúng thì giữ màu xanh
  useEffect(() => {
    const last = outcome ?? step;
    if (!last || !last.detail.left) return undefined;
    const pair: [string, string] = [String(last.detail.left), String(last.detail.right)];
    play(last.detail.match ? 'right' : 'wrong');
    if (last.detail.match) { setLeft(null); setRight(null); sent.current = null; return undefined; }
    setWrong(pair);
    const tm = setTimeout(() => { setWrong(null); setLeft(null); setRight(null); sent.current = null; }, 750);
    return () => clearTimeout(tm);
  }, [step, outcome]);
  const stateOf = (token: string, matched: boolean): 'idle' | 'picked' | 'matched' | 'wrong' => (matched ? 'matched' : wrong?.includes(token) ? 'wrong' : token === left || token === right ? 'picked' : 'idle');
  const column = (side: 'left' | 'right', label: string): React.ReactElement => (
    <View style={{ flex: 1, gap: 8 }}>
      <Eyebrow text={label} color={t.muted} />
      {cards.filter((x) => x.side === side).map((x, i) => (
        <PairCard key={x.token} text={x.text} state={stateOf(x.token, x.matched)} disabled={busy || Boolean(wrong) || Boolean(outcome)} testID={`pair-${x.token}`} delay={250 + (i * 2 + (side === 'left' ? 0 : 1)) * 110}
          onPress={() => { if (side === 'left') setLeft((v) => (v === x.token ? null : x.token)); else setRight((v) => (v === x.token ? null : x.token)); }} />
      ))}
    </View>
  );
  const misses = item.kind === 'pairs' ? item.misses : 0;
  return (
    <View style={{ gap: 10 }}>
      <Txt size={14} color={t.muted}>Các thẻ lật ngửa lần lượt. Chọn một thẻ ở mỗi cột để ghép thành cặp đúng; ghép sai quá 2 lần sẽ bị trừ điểm.</Txt>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {column('left', item.kind === 'pairs' ? item.left_label : '')}
        {column('right', item.kind === 'pairs' ? item.right_label : '')}
      </View>
      <Txt f="semibold" size={13} color={t.muted}>Đã ghép {cards.filter((x) => x.matched).length / 2}/{item.kind === 'pairs' ? item.pairs_total : 0} cặp · ghép sai {misses} lần</Txt>
    </View>
  );
};

/**
 * Xếp dòng thời gian (bản vẽ màn 10, 26/11/2026): các mốc thời gian theo thứ tự trên một đường dọc; em chọn một thẻ sự kiện rồi chạm vào mốc của nó.
 * Máy chủ chấm ngay từng lần đặt: đúng thì thẻ nằm lại ở mốc (xanh), sai thì thẻ hiện đỏ một lúc và Tiểu Tướng gợi ý sự kiện xảy ra sớm hơn hay muộn hơn.
 * Không cần kéo thả (bấm được bằng bàn phím, trình đọc màn hình).
 */
const TimelineBody: React.FC<BodyProps> = ({ item, outcome, step, busy, onAnswer }) => {
  const t = useBT();
  const slots = item.kind === 'sequence' ? item.slots ?? [] : [];
  const cards = item.kind === 'sequence' ? item.items : [];
  const placed = new Set(slots.map((s) => s.card?.id).filter((x): x is string => Boolean(x)));
  const tray = cards.filter((c) => !placed.has(c.id));
  const [pick, setPick] = useState<string | null>(null);
  const [miss, setMiss] = useState<{ slot: number; card: string; hint: string | null } | null>(null);
  useEffect(() => { setPick(null); setMiss(null); }, [item.id]);
  // kết quả của lần đặt vừa rồi: sai thì thẻ đỏ hiện ở mốc đó một lúc kèm lời gợi ý (lời gợi ý giữ tới lần đặt sau); đúng thì bỏ chọn
  useEffect(() => {
    const d = (outcome ?? step)?.detail as { place?: { card: string; slot: number }; ok?: boolean; hint?: string | null } | undefined;
    if (!d?.place) return undefined;
    const at = d.place;
    play(d.ok ? 'right' : 'wrong');
    setPick(null);
    if (d.ok) { setMiss(null); return undefined; }
    setMiss({ slot: at.slot, card: at.card, hint: d.hint ?? null });
    const tm = setTimeout(() => setMiss((m) => (m && m.slot === at.slot && m.card === at.card ? { ...m, slot: -1 } : m)), 1500);
    return () => clearTimeout(tm);
  }, [step, outcome]);
  const done = Boolean(outcome);
  const textOf = (id: string): string => cards.find((c) => c.id === id)?.text ?? '';
  const place = (slot: number): void => { if (pick && !busy && !done) onAnswer({ place: { card: pick, slot } }); };
  const truth = (outcome?.detail.order as Array<{ id: string; text: string; when: string | null }> | undefined) ?? null;
  const allPlaced = slots.length > 0 && slots.every((s) => s.card);
  return (
    <View style={{ gap: 12 }} testID="timeline">
      {!done ? <Txt size={14} color={t.muted}>{pick ? `Chạm vào mốc thời gian của “${textOf(pick)}”.` : 'Chọn một thẻ bên dưới rồi chạm vào mốc thời gian của nó.'}</Txt> : null}
      <BtCard style={{ gap: 10 }}>
        <View pointerEvents="none" style={{ position: 'absolute', left: 14 + 66 + 10 + 5, top: 24, bottom: 24, width: 3, borderRadius: 2, backgroundColor: t.line2 }} />
        {slots.map((s) => {
          const card = s.card;
          const wrong = !card && miss && miss.slot === s.i;
          const target = !card && Boolean(pick) && !done;
          const label = s.when ?? `Mốc ${s.i + 1}`;
          return (
            <View key={s.i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Txt f="heavy" size={12} color={t.ink} style={{ width: 66, textAlign: 'right' }}>{label}</Txt>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: card ? t.green : wrong ? t.danger : t.card, borderWidth: card || wrong ? 0 : 2, borderColor: target ? t.accent : t.line2 }} />
              <Pressable onPress={() => place(s.i)} disabled={Boolean(card) || !pick || busy || done} accessibilityRole="button" testID={`timeline-slot-${s.i}`}
                accessibilityLabel={`${label}: ${card ? `${card.text}, đã đặt đúng` : pick ? `trống, bấm để đặt “${textOf(pick)}”` : 'trống'}`}
                style={({ pressed }) => ({ flex: 1, minHeight: 46, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, justifyContent: 'center', opacity: pressed ? 0.85 : 1,
                  backgroundColor: card ? t.greenSoft : wrong ? t.dangerSoft : target ? t.goldSoft : 'transparent',
                  borderWidth: card || wrong ? 1 : 2, borderStyle: card || wrong ? 'solid' : 'dashed', borderColor: card ? t.green : wrong ? t.danger : target ? t.accent : t.line2 })}>
                <Txt f={card || wrong ? 'heavy' : 'semibold'} size={13} color={card ? t.green : wrong ? t.danger : target ? t.accent : t.muted}>
                  {card ? `${card.text} ✓` : wrong ? `${textOf(miss!.card)} ✗` : target ? 'Đặt vào đây' : 'Trống'}
                </Txt>
              </Pressable>
            </View>
          );
        })}
      </BtCard>
      {miss?.hint && !done ? <TtSays tone="warn" testID="timeline-hint"><Txt size={13} color={t.ink} style={{ lineHeight: 19 }}>{miss.hint}</Txt></TtSays> : null}
      {!done && tray.length ? (
        <View style={{ gap: 6 }}>
          <Txt f="heavy" size={12} color={t.ink}>Thẻ cần xếp</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {tray.map((c, k) => {
              const on = pick === c.id;
              return (
                <Pressable key={c.id} onPress={() => setPick(on ? null : c.id)} disabled={busy} accessibilityRole="button" accessibilityState={{ selected: on }} testID={`timeline-card-${c.id}`}
                  accessibilityLabel={`Thẻ ${c.text}${on ? ', đang chọn' : ''}`}
                  style={({ pressed }) => ({ flexGrow: 1, flexBasis: 140, minHeight: 52, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, justifyContent: 'center',
                    backgroundColor: ['#2F5563', '#7E1616', '#5B4632'][k % 3], borderWidth: 3, borderColor: on ? t.gold : 'transparent', opacity: pressed ? 0.9 : 1, transform: [{ rotate: on ? '-2deg' : '0deg' }] })}>
                  <Txt f="heavy" size={13} color="#FFF6E5">{c.text}</Txt>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
      {!done && item.kind === 'sequence' && (item.misses ?? 0) > 0 ? <Txt size={12} color={t.muted}>Đã đặt sai {item.misses} lần · đặt đúng hết ngay lần đầu mới trọn điểm.</Txt> : null}
      {done && truth && !allPlaced ? (
        <BtCard tone="sunk" style={{ gap: 4 }}>
          <Txt f="heavy" size={14} color={t.ink}>Dòng thời gian đúng</Txt>
          {truth.map((x, i) => <Txt key={x.id} size={14} color={t.ink}>{x.when ?? `Mốc ${i + 1}`}: {x.text}</Txt>)}
        </BtCard>
      ) : null}
    </View>
  );
};

const MAP_RATIO: Record<number, [number, number]> = { 1: [1500, 1052], 2: [1000, 1458], 3: [1300, 974] };
const MAP_CACHE = new Map<number, SagaMapInfo>();
/** Ảnh và kích thước bản đồ của một cuộc kháng chiến (dùng ảnh có sẵn khi chưa tải được) */
function useMapInfo(session: Session, no: number): Pick<SagaMapInfo, 'image_key' | 'image_url' | 'image_w' | 'image_h'> {
  const [info, setInfo] = useState<SagaMapInfo | null>(MAP_CACHE.get(no) ?? null);
  useEffect(() => {
    const hit = MAP_CACHE.get(no);
    if (hit) { setInfo(hit); return undefined; }
    let live = true;
    saga.campaign(session.token, no).then((m) => { MAP_CACHE.set(no, m.map); if (live) setInfo(m.map); }).catch(() => undefined);
    return () => { live = false; };
  }, [no, session.token]);
  const [w, h] = MAP_RATIO[no] ?? MAP_RATIO[1];
  return info ?? { image_key: `ban-do-khang-chien-${no}`, image_url: null, image_w: w, image_h: h };
}

const LocateBody: React.FC<BodyProps> = ({ session, item, outcome, busy, onAnswer }) => {
  const t = useBT();
  const no = item.kind === 'locate' ? item.campaign_no : 1;
  const spots = item.kind === 'locate' ? item.spots : [];
  const removed = new Set(item.removed ?? []);
  const map = useMapInfo(session, no);
  const [boxW, setBoxW] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => setPicked(null), [item.id]);
  const ratio = map.image_w / Math.max(1, map.image_h);
  const w = Math.min(boxW, 520 * ratio), h = w / ratio;
  const correct = (outcome?.detail.correct_id as string | undefined) ?? null;
  const chosen = (outcome?.detail.chosen as string | undefined) ?? picked;
  const labels = new Map(((outcome?.detail.labels as Array<{ id: string; label: string }> | undefined) ?? []).map((l) => [l.id, l.label]));
  const pick = (id: string): void => { if (outcome || busy || removed.has(id)) return; setPicked(id); onAnswer({ choice: id }); };
  const markOf = (id: string): OptionMark => (outcome ? (id === correct ? 'right' : id === chosen ? 'wrong' : 'dim') : removed.has(id) ? 'dim' : id === picked ? 'picked' : 'idle');
  const fill = (m: OptionMark): string => (m === 'right' ? t.green : m === 'wrong' || m === 'picked' ? t.accent : m === 'dim' ? t.muted : '#2A1D14');
  return (
    <View style={{ gap: 10 }}>
      <View onLayout={(e) => setBoxW(e.nativeEvent.layout.width)} style={{ alignItems: 'center' }}>
        {boxW > 0 ? (
          <View style={{ width: w, height: h, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: t.line }}>
            <Image source={mapSource(map)} style={{ width: w, height: h }} resizeMode="stretch" accessibilityLabel="Bản đồ của cuộc kháng chiến, có các điểm đánh chữ để chọn" />
            {spots.map((p) => {
              const m = markOf(p.id);
              const gone = removed.has(p.id) && !outcome;
              return (
                <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Điểm ${p.letter}${labels.get(p.id) ? `: ${labels.get(p.id)}` : ''}${gone ? ', đã gạch bỏ' : ''}`} disabled={Boolean(outcome) || busy || gone} onPress={() => pick(p.id)} testID={`spot-${p.letter}`} hitSlop={6}
                  style={{ position: 'absolute', left: p.x * w - 20, top: p.y * h - 20, width: 40, height: 40, borderRadius: 20, backgroundColor: fill(m), borderWidth: 2, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center', opacity: gone ? 0.45 : 1 }}>
                  <Txt f="heavy" size={16} color="#ffffff">{gone ? '–' : p.letter}</Txt>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {spots.map((p) => (
          <OptionButton key={p.id} badge={p.letter} text={labels.get(p.id) ?? (removed.has(p.id) && !outcome ? `Điểm ${p.letter} (đã gạch bỏ)` : `Điểm ${p.letter}`)} mark={markOf(p.id)} disabled={Boolean(outcome) || busy || (removed.has(p.id) && !outcome)} onPress={() => pick(p.id)} testID={`spot-btn-${p.letter}`}
            label={`Chọn điểm ${p.letter}${labels.get(p.id) ? `: ${labels.get(p.id)}` : ''}`} style={{ flexGrow: 1, flexBasis: 150 }} />
        ))}
      </View>
      <Txt size={12} color={t.muted} center>Bấm vào điểm trên bản đồ hoặc vào ô chữ bên dưới.</Txt>
    </View>
  );
};

/** Thân của một câu theo đúng mẫu của nó */
export const ItemBody: React.FC<BodyProps> = (p) =>
  p.item.kind === 'sequence' ? (p.item.slots ? <TimelineBody {...p} /> : <SequenceBody {...p} />) : p.item.kind === 'pairs' ? <PairsBody {...p} /> : p.item.kind === 'locate' ? <LocateBody {...p} /> : <ChoiceBody {...p} />;

/** Phản hồi sau khi trả lời: đúng / sai, giải thích, mục tiêu kiến thức và nguồn (máy chủ chỉ gửi sau khi đã chấm) */
export const Feedback: React.FC<{ outcome: AnswerOutcome; kind: PracticeItem['kind']; onNext: () => void; nextLabel: string }> = ({ outcome, kind, onNext, nextLabel }) => {
  const t = useBT();
  const half = outcome.score > 0 && outcome.score < 1;
  const [line, ink, title] = outcome.timeout ? [t.danger, t.danger, 'Hết giờ!'] : outcome.score >= 1 ? [t.green, t.green, kind === 'tactic' ? 'Quyết định tốt nhất!' : 'Chính xác!']
    : half ? [t.bronze, t.goldInk, kind === 'pairs' ? 'Ghép xong, nhưng sai hơi nhiều' : kind === 'sequence' ? 'Xếp xong, nhưng có lần đặt sai' : 'Tạm được, còn cách tốt hơn']
    : [t.danger, t.danger, kind === 'pairs' ? 'Ghép xong, nhưng sai quá nhiều lần' : kind === 'sequence' ? 'Xếp xong, nhưng đặt sai nhiều lần' : 'Chưa đúng'];
  const feedback = outcome.detail.feedback as string | null | undefined, best = outcome.detail.best_feedback as string | undefined;
  const pairs = outcome.detail.pairs as Array<{ id: string; left: string; right: string }> | undefined;
  useKeys((k) => { if (k === 'Enter') onNext(); });
  const gain = [outcome.xp ? `+${outcome.xp} KN` : '', outcome.gold ? `+${outcome.gold} vàng` : ''].filter(Boolean).join(' · ');
  return (
    <View accessibilityLiveRegion="polite" testID="item-feedback">
      <BtCard style={{ borderLeftWidth: 4, borderLeftColor: line }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {outcome.score >= 1 ? <Check size={20} color={line} strokeWidth={2.6} /> : <Lightbulb size={20} color={line} />}
          <Txt f="heavy" size={17} color={ink} style={{ flex: 1 }}>{title}</Txt>
          {gain ? <Pill text={gain} bg={t.goldSoft} fg={t.goldInk} strong /> : null}
        </View>
        {feedback ? <Txt size={15} color={t.ink} style={{ lineHeight: 22 }}>{feedback}</Txt> : null}
        {best && outcome.score < 1 ? <Txt size={15} color={t.ink} style={{ lineHeight: 22 }}>Phương án tốt nhất: {best}</Txt> : null}
        {pairs && outcome.score < 1 ? <Txt size={14} color={t.ink}>Các cặp đúng: {pairs.map((p) => `${p.left} – ${p.right}`).join('; ')}.</Txt> : null}
        {outcome.explanation ? <Txt size={15} color={t.ink} style={{ lineHeight: 22 }}>{outcome.explanation}</Txt> : null}
        {outcome.objective_text ? <Txt size={13} color={t.muted}>Mục tiêu: {outcome.objective_text}{outcome.stage_title ? ` (chặng ${outcome.stage_title})` : ''}</Txt> : null}
        {outcome.source ? <SourceLine source={outcome.source} /> : null}
        <BtButton title={nextLabel} iconRight={ChevronRight} onPress={onNext} testID="item-next" style={{ alignSelf: 'flex-end' }} />
      </BtCard>
    </View>
  );
};

// ---------------------------------------------------------------------- Thám sử (bước 2/5)
const KIND_ICON: Record<LessonCard['kind'], IconType> = { who: Users, where: MapPin, when: Hourglass, why: Compass, how: Swords };
/** Vị trí các điểm sáng trên cảnh (tỉ lệ 0–1), lần lượt cho thẻ 1, 2, 3… */
const SPOTS: Array<[number, number]> = [[0.16, 0.3], [0.48, 0.2], [0.82, 0.32], [0.3, 0.7], [0.68, 0.68], [0.5, 0.47], [0.1, 0.62], [0.9, 0.62]];

/** Vòng sáng nhịp nhàng quanh điểm chưa nhặt (đứng yên khi bật giảm chuyển động) */
const Pulse: React.FC<{ color: string; size: number }> = ({ color, size }) => {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let live = true;
    let a: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!live || reduce) return;
      a = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: false }));
      a.start();
    }).catch(() => undefined);
    return () => { live = false; a?.stop(); };
  }, [v]);
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: color,
      opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }] }} />
  );
};

/** Cảnh bản đồ của chặng (vẽ bằng màu của giao diện): sông, núi, thành; mỗi thẻ Binh thư là một điểm sáng */
const LoreScene: React.FC<{ cards: LessonCard[]; have: Set<string>; onOpen: (i: number) => void }> = ({ cards, have, onOpen }) => {
  const t = useBT();
  const [w, setW] = useState(0);
  const h = Math.min(330, Math.max(200, w * 0.58));
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} testID="lore-scene" style={{ width: '100%', height: w ? h : 220, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: t.line2, backgroundColor: t.card2 }}>
      {w > 0 ? (
        <>
          <Svg width={w} height={h} viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', left: 0, top: 0 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Rect x={0} y={0} width={320} height={180} fill={t.card2} />
            {[40, 80, 120, 160].map((y) => <Path key={`h${y}`} d={`M0 ${y} L320 ${y}`} stroke={t.line} strokeWidth={0.6} strokeDasharray="3 4" />)}
            {[64, 128, 192, 256].map((x) => <Path key={`v${x}`} d={`M${x} 0 L${x} 180`} stroke={t.line} strokeWidth={0.6} strokeDasharray="3 4" />)}
            <Path d="M0 64 L34 26 L58 52 L92 16 L128 60 L146 44 L170 70 L0 70 Z" fill={t.line2} opacity={0.75} />
            <Path d="M180 70 L212 38 L236 58 L262 30 L300 68 Z" fill={t.line2} opacity={0.55} />
            <Path d="M-10 118 C 50 96, 100 150, 160 126 S 270 88, 330 108 L 330 146 C 270 128, 200 168, 150 158 S 40 132, -10 150 Z" fill={t.tealSoft} stroke={t.teal} strokeWidth={1.2} />
            {[118, 130, 142, 154].map((x, i) => <Path key={`s${x}`} d={`M${x} ${128 + (i % 2) * 6} L${x + 3} ${118 + (i % 2) * 6}`} stroke={t.ink} strokeWidth={1.6} strokeLinecap="round" opacity={0.55} />)}
            <Rect x={236} y={86} width={46} height={22} rx={2} fill={t.bronze} opacity={0.85} />
            <Path d="M230 88 L259 72 L288 88 Z" fill={t.accent} opacity={0.85} />
          </Svg>
          {cards.map((c, i) => {
            const [sx, sy] = SPOTS[i % SPOTS.length];
            const got = have.has(c.id);
            const Icon = KIND_ICON[c.kind] ?? BookOpen;
            const size = 46;
            return (
              <View key={c.id} pointerEvents="box-none" style={{ position: 'absolute', left: sx * w - 60, top: sy * h - size / 2, width: 120, alignItems: 'center' }}>
                {!got ? <View pointerEvents="none" style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', position: 'absolute' }}><Pulse color={t.gold} size={size} /></View> : null}
                <Pressable onPress={() => onOpen(i)} accessibilityRole="button" testID={`lore-spot-${c.id}`} hitSlop={4}
                  accessibilityLabel={`Thẻ ${i + 1}: ${c.tag}, ${c.title}${got ? ', đã nhận' : ', chưa nhận'}`}
                  style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: got ? t.green : t.accent,
                    borderWidth: 3, borderColor: got ? t.greenSoft : t.gold, opacity: pressed ? 0.85 : 1 })}>
                  {got ? <Check size={20} color="#FFFFFF" strokeWidth={3} /> : <Icon size={20} color={t.onAccent} strokeWidth={2.4} />}
                </Pressable>
                <View pointerEvents="none" style={{ marginTop: 3, backgroundColor: t.card, borderRadius: 6, borderWidth: 1, borderColor: t.line, paddingHorizontal: 6 }}>
                  <Txt f="heavy" size={10.5} color={got ? t.green : t.ink} numberOfLines={1}>{c.tag}</Txt>
                </View>
              </View>
            );
          })}
        </>
      ) : null}
    </View>
  );
};

/** Hộp một thẻ Binh thư: nội dung, dữ kiện, mục tiêu, nguồn; nhận thẻ, hỏi Tiểu Tướng, sang thẻ kế */
const LoreSheet: React.FC<{ card: LessonCard; got: boolean; busy: boolean; onClose: () => void; onCollect: () => void; onNext: (() => void) | null; onAsk: () => void }> = ({ card, got, busy, onClose, onCollect, onNext, onAsk }) => {
  const t = useBT();
  return (
    <Sheet open onClose={onClose} title={card.title} subtitle={`${card.tag} · ${card.kind_label}`}
      footer={(
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {got ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, flexGrow: 1 }}><Check size={16} color={t.green} /><Txt f="heavy" size={14} color={t.green}>Đã có trong Binh thư</Txt></View>
            : <BtButton title="Nhận thẻ vào Binh thư" icon={BookOpen} onPress={onCollect} loading={busy} style={{ flexGrow: 1 }} testID="lore-collect" />}
          {onNext ? <BtButton title="Thẻ kế" tone="ghost" iconRight={ChevronRight} onPress={onNext} disabled={busy} testID="lore-next" /> : null}
        </View>
      )}>
      <View style={{ gap: 12 }} testID="lore-sheet">
        <Txt size={15.5} color={t.ink} style={{ lineHeight: 24 }}>{card.body}</Txt>
        {card.facts.length ? (
          <View style={{ borderRadius: 12, borderWidth: 1, borderColor: t.line, overflow: 'hidden' }}>
            {card.facts.map((f, i) => (
              <View key={`${f.label}${i}`} style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: t.line, backgroundColor: i % 2 ? t.card : t.card2 }}>
                <Txt f="heavy" size={13} color={t.muted} style={{ width: 110 }}>{f.label}</Txt>
                <Txt size={13.5} color={t.ink} style={{ flex: 1 }}>{f.value}</Txt>
              </View>
            ))}
          </View>
        ) : null}
        {card.objective_text ? <View style={{ flexDirection: 'row', gap: 8 }}><Target size={15} color={t.accent} style={{ marginTop: 3 }} /><Txt size={13.5} color={t.soft} style={{ flex: 1 }}>{card.objective_text}</Txt></View> : null}
        {card.source ? <SourceLine source={card.source} /> : null}
        <BtButton title="Hỏi Tiểu Tướng về thẻ này" icon={MessageSquareText} tone="ghost" size="sm" onPress={onAsk} style={{ alignSelf: 'flex-start' }} testID="lore-ask" />
      </View>
    </Sheet>
  );
};

/** Thám sử: nhặt đủ thẻ Binh thư của chặng trên cảnh bản đồ (hoặc trong danh sách thẻ bên dưới) để mở Hội đồng quân sự */
export const ThamSuScreen: React.FC<StageProps> = ({ session, nav, stageId, campaignNo }) => {
  const t = useBT();
  const toast = useToast();
  const data = useLoad<LessonView>(session, (tk) => saga.lesson(tk, stageId), [stageId]);
  const [have, setHave] = useState<Set<string> | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const view = data.data;
  const grade = view?.stage.grade ?? campaignNo;
  const owned = have ?? new Set(view?.lore ?? []);
  const total = view?.cards.length ?? 0;
  const done = Boolean(view) && (view!.done || (total > 0 && view!.cards.every((c) => owned.has(c.id))));
  const back = (): void => nav.back('chien-dich', { c: grade, s: stageId, v: 'quan-lenh' });
  const collect = async (i: number): Promise<void> => {
    const card = view?.cards[i];
    if (!card || busy) return;
    setBusy(true);
    try {
      const res: LoreCollect = await saga.collectLore(session.token, stageId, card.id);
      setHave(new Set(res.lore));
      play('reward');
      if (res.first_done) { toast(`Đủ ${res.total} thẻ!${res.xp ? ` +${res.xp} KN.` : ''} Hội đồng quân sự đã mở.`); nav.refresh(); }
      else if (res.fresh) toast(`Đã nhận thẻ “${card.title}” (${res.lore.length}/${res.total})`);
      const nextI = view!.cards.findIndex((c, k) => k !== i && !res.lore.includes(c.id));
      setOpen(nextI >= 0 ? nextI : null);
    } catch (e) {
      if (statusOf(e) === 401) session.expired();
      toast(errorMessage(e));
    } finally { setBusy(false); }
  };
  const ask = (card: LessonCard): void => { askTieuTuong(`Giải thích thêm cho em về “${card.title}” trong chặng ${view?.stage.title ?? ''}.`); setOpen(null); nav.go('tieu-tuong'); };
  const head = <StepHeader eyebrow="Bước 2/5 · Thám sử" title={view?.stage.title ?? 'Thám sử'} onBack={back} backLabel="Về Quân lệnh của chặng" right={view ? <Pill text={`${owned.size}/${total} thẻ`} bg={done ? t.greenSoft : t.goldSoft} fg={done ? t.green : t.goldInk} strong testID="lore-count" /> : null} />;
  if (!view) return <BtPage testID="saga-lesson" tabBar={false} max={1080}>{head}<LoadState loading={data.loading} error={data.error} onRetry={data.reload} /></BtPage>;
  const card = open !== null ? view.cards[open] : null;
  const nextOf = (i: number): number | null => { const k = view.cards.findIndex((c, j) => j > i && !owned.has(c.id)); if (k >= 0) return k; const k2 = view.cards.findIndex((c, j) => j !== i && !owned.has(c.id)); return k2 >= 0 ? k2 : i + 1 < total ? i + 1 : null; };
  return (
    <BtPage testID="saga-lesson" tabBar={false} max={1180}>
      {head}
      <Columns split={1.5} left={(
        <>
          <Txt size={13.5} color={t.soft} style={{ lineHeight: 20 }}>Chạm vào các điểm sáng trên bản đồ để đọc thẻ Binh thư. Nhận đủ {total} thẻ thì Hội đồng quân sự mở.</Txt>
          <LoreScene cards={view.cards} have={owned} onOpen={setOpen} />
          <BtBar value={total ? owned.size / total : 0} color={t.green} label={`Đã nhận ${owned.size}/${total} thẻ Binh thư`} />
          <View style={{ gap: 8 }} testID="lore-list">
            {view.cards.map((c, i) => {
              const got = owned.has(c.id);
              const Icon = KIND_ICON[c.kind] ?? BookOpen;
              return (
                <Pressable key={c.id} onPress={() => setOpen(i)} accessibilityRole="button" testID={`lore-card-${c.id}`} accessibilityLabel={`${c.tag}: ${c.title}${got ? ', đã nhận' : ', chưa nhận'}`}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: got ? t.green : t.line, backgroundColor: got ? t.greenSoft : t.card, opacity: pressed ? 0.88 : 1 })}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: got ? t.green : t.goldSoft }}>
                    {got ? <Check size={18} color="#FFFFFF" strokeWidth={3} /> : <Icon size={18} color={t.goldInk} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Eyebrow text={c.tag} color={got ? t.green : t.accent} />
                    <Txt f="heavy" size={14.5} color={t.ink} numberOfLines={2}>{c.title}</Txt>
                  </View>
                  <ChevronRight size={18} color={t.muted} />
                </Pressable>
              );
            })}
          </View>
        </>
      )} right={(
        <>
          <BtCard testID="lesson-objectives">
            <Txt f="heavy" size={15} color={t.ink}>Mục tiêu của chặng</Txt>
            {view.objectives.map((o) => <View key={o.id} style={{ flexDirection: 'row', gap: 8 }}><Target size={15} color={t.accent} style={{ marginTop: 3 }} /><Txt size={14} color={t.ink} style={{ flex: 1, lineHeight: 20 }}>{o.text}</Txt></View>)}
          </BtCard>
          {done ? (
            <BtCard tone="hero" testID="lesson-done">
              <Eyebrow text="Đủ thẻ Binh thư" color={t.gold} />
              <SerifTitle size={20} color={t.onHero}>Hội đồng quân sự đang chờ em</SerifTitle>
              <Txt size={13} color={t.onHeroMuted}>Dùng các thẻ vừa nhặt để trả lời câu hỏi của hội đồng.</Txt>
              <BtButton title="Vào Hội đồng quân sự" tone="gold" iconRight={ChevronRight} onPress={() => stepTo(nav, grade, stageId, 'hoi-dong')} testID="lesson-to-practice" />
            </BtCard>
          ) : <TtSays><Txt size={13} color={t.ink} style={{ lineHeight: 19 }}>Mỗi thẻ ghi rõ nguồn sử liệu. Đọc kỹ phần “Dữ kiện”: hội đồng sẽ hỏi đúng những điều đó.</Txt></TtSays>}
          {view.world ? <BtButton title="Khám phá bối cảnh trong thế giới 3D" icon={Box} tone="ghost" onPress={() => stepTo(nav, grade, stageId, 'kham-pha')} testID="lesson-world" /> : null}
          {view.sources.length ? (
            <BtCard tone="sunk">
              <Eyebrow text="Nguồn của chặng" color={t.muted} />
              {view.sources.map((s) => <SourceLine key={s.key} source={s} />)}
            </BtCard>
          ) : null}
        </>
      )} />
      {card && open !== null ? (
        <LoreSheet card={card} got={owned.has(card.id)} busy={busy} onClose={() => setOpen(null)} onCollect={() => { void collect(open); }}
          onNext={nextOf(open) !== null ? () => setOpen(nextOf(open)) : null} onAsk={() => ask(card)} />
      ) : null}
    </BtPage>
  );
};

// ---------------------------------------------------------------------- Hội đồng quân sự (bước 3/5)
/** Hội đồng quân sự: lượt câu hỏi của chặng (máy chủ chấm từng câu); Gợi ý chiến thuật gạch một phương án sai; đạt ngưỡng thì sang Xuất trận */
export const HoiDongScreen: React.FC<StageProps> = ({ session, nav, stageId, campaignNo }) => {
  const t = useBT();
  const toast = useToast();
  const detail = useLoad<StageDetail>(session, (tk) => saga.stage(tk, stageId), [stageId]);
  // thẻ Binh thư em đã nhặt ở Thám sử – "vũ khí" khi bàn ở Hội đồng (bản vẽ màn 6)
  const lessonView = useLoad<LessonView>(session, (tk) => saga.lesson(tk, stageId), [stageId]);
  const [sess, setSess] = useState<PracticeSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(0);
  const [outcome, setOutcome] = useState<AnswerOutcome | null>(null);
  const [step, setStep] = useState<AnswerOutcome | null>(null);
  const [finished, setFinished] = useState<PracticeFinished | null>(null);
  const [completed, setCompleted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hints, setHints] = useState<number | null>(null);
  const [flash, setFlash] = useFlash();
  const [round, setRound] = useState(0);
  const restart = useRef(false);
  const expired = useRef(session.expired);
  expired.current = session.expired;
  const scroller = useRef<ScrollViewInstance | null>(null);
  useEffect(() => {
    if (!outcome) return undefined;
    const tm = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(tm);
  }, [outcome]);
  useEffect(() => {
    let live = true;
    setLoading(true); setError(null); setOutcome(null); setStep(null); setFinished(null); setShowResult(false);
    saga.startPractice(session.token, stageId, restart.current).then((p) => { if (!live) return; restart.current = false; setSess(p); setCursor(Math.min(p.index, p.total - 1)); setLoading(false); }).catch((e) => {
      if (!live) return;
      if (statusOf(e) === 401) expired.current();
      setError(errorMessage(e)); setLoading(false);
    });
    return () => { live = false; };
  }, [session.token, stageId, round]);
  const grade = detail.data?.grade ?? sess?.stage?.grade ?? campaignNo;
  const hintsLeft = hints ?? nav.home?.hints ?? 0;
  const item = sess?.items[cursor] ?? null;
  const answer = async (a: Record<string, unknown>): Promise<void> => {
    if (!sess || !item || busy) return;
    setBusy(true);
    try {
      const res = await saga.act<PracticeSession, AnswerOutcome, PracticeFinished>(session.token, sess.session_id, sess.seq, { type: 'answer', item_id: item.id, answer: a });
      setSess(res.view);
      if (res.outcome.done) { setOutcome(res.outcome); if (item.kind !== 'pairs' && item.kind !== 'sequence') play(res.outcome.correct ? 'right' : 'wrong'); } else setStep(res.outcome);
      if (res.finished) { setFinished(res.finished); nav.refresh(); }
      if (res.completion) setCompleted(true);
      if (res.completion?.first) nav.setReward({ stageId, completion: res.completion });
    } catch (e) {
      const status = statusOf(e);
      if (status === 401) session.expired();
      else if (status === 409) setRound((n) => n + 1); // phiên đã đổi ở thẻ khác: tải lại trạng thái chuẩn
      setFlash(errorMessage(e));
    } finally { setBusy(false); }
  };
  const hint = async (): Promise<void> => {
    if (!sess || !item || busy) return;
    setBusy(true);
    try {
      const res = await saga.act<PracticeSession, HintOutcome, PracticeFinished>(session.token, sess.session_id, sess.seq, { type: 'hint', item_id: item.id });
      setSess(res.view);
      setHints(res.outcome.hints_left);
      toast(`Đã gạch bỏ một phương án sai · còn ${res.outcome.hints_left} Gợi ý`);
      nav.refresh();
    } catch (e) {
      if (statusOf(e) === 401) session.expired();
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
  const doneCount = sess?.items.filter((it) => it.done).length ?? 0;
  const d = detail.data;
  const hasBattle = d ? Boolean(d.battle) : true;
  const ownedLore = (lessonView.data?.cards ?? []).filter((c) => lessonView.data!.lore.includes(c.id) || lessonView.data!.done);
  const canHint = Boolean(item && item.hintable && !outcome && !(item.removed ?? []).length && (item.kind === 'quiz' || item.kind === 'tactic' || item.kind === 'locate'));
  return (
    <BtPage testID="saga-practice" tabBar={false} max={920} scrollRef={scroller}>
      <StepHeader eyebrow="Bước 3/5 · Hội đồng quân sự" title={sess?.stage?.title ?? d?.title ?? 'Hội đồng quân sự'} onBack={() => nav.back('chien-dich', { c: grade, s: stageId, v: 'quan-lenh' })} backLabel="Về Quân lệnh của chặng"
        right={sess && !showResult ? <Pill text={`Câu ${cursor + 1}/${sess.total}`} bg={t.goldSoft} fg={t.goldInk} strong /> : null} />
      {!sess || !item ? <LoadState loading={loading} error={error} onRetry={() => setRound((n) => n + 1)} /> : showResult && finished ? (
        <BtCard tone={finished.passed ? 'gold' : 'sunk'} pad={20} style={{ alignItems: 'center' }} testID="practice-result">
          <SerifTitle size={26} color={finished.passed ? t.green : t.danger} center>{finished.passed ? 'Hội đồng tán thành!' : 'Hội đồng chưa đồng ý'}</SerifTitle>
          <StarRow n={finished.stars} size={30} />
          <Txt f="serifBold" size={40} color={t.ink}>{finished.percent}%</Txt>
          <Txt size={14} color={t.muted} center>Đúng trọn vẹn {finished.right}/{finished.total} câu · cần {finished.pass_percent}% · tốt nhất của em {finished.best}%</Txt>
          {finished.xp || finished.gold ? <Pill text={[finished.xp ? `+${finished.xp} KN` : '', finished.gold ? `+${finished.gold} vàng` : ''].filter(Boolean).join(' · ')} bg={t.goldSoft} fg={t.goldInk} strong /> : null}
          {!finished.passed ? <Txt size={14} color={t.muted} center>Xem lại thẻ Binh thư rồi bàn lại. Các câu sai đã vào Luyện binh riêng.</Txt> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 6 }}>
            {finished.passed
              ? hasBattle && !completed ? <BtButton title="Xuất trận" icon={Swords} onPress={() => stepTo(nav, grade, stageId, 'xuat-tran')} testID="practice-to-battle" />
                : <BtButton title="Sử quan tổng kết" icon={BookOpen} onPress={() => stepTo(nav, grade, stageId, 'su-quan')} testID="practice-to-summary" />
              : <BtButton title="Xem lại thẻ Binh thư" icon={BookOpen} onPress={() => stepTo(nav, grade, stageId, 'tham-su')} testID="practice-to-lesson" />}
            <BtButton title="Bàn lại" icon={RotateCcw} tone="ghost" onPress={() => { restart.current = true; setRound((n) => n + 1); }} testID="practice-retry" />
            {finished.passed && d?.steps.world && d.steps.world !== 'none' ? <BtButton title="Khám phá thêm 3D" icon={Box} tone="ghost" onPress={() => stepTo(nav, grade, stageId, 'kham-pha')} testID="practice-to-world" /> : null}
          </View>
        </BtCard>
      ) : (
        <>
          <BtBar value={doneCount / sess.total} color={t.accent} label={`Đã trả lời ${doneCount} trên ${sess.total} câu`} />
          <BtCard tone="night" pad={16} testID={`practice-item-${item.kind}`}>
            <Eyebrow text={`Hội đồng hỏi · ${item.kind_label}`} color={t.gold} />
            <Txt f="serifBold" size={19} color={t.onNight} accessibilityRole="header" style={{ lineHeight: 27 }}>{item.prompt}</Txt>
          </BtCard>
          <ItemBody session={session} item={item} outcome={outcome} step={step} busy={busy} onAnswer={(a) => { void answer(a); }} />
          {canHint ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }} testID="hint-row">
              <BtButton title={hintsLeft > 0 ? `Gợi ý chiến thuật (còn ${hintsLeft})` : 'Hết Gợi ý chiến thuật'} icon={Lightbulb} tone="ghost" size="sm" disabled={hintsLeft < 1 || busy} onPress={() => { void hint(); }} testID="practice-hint" />
              {hintsLeft < 1 ? <BtButton title="Mua ở Chợ phiên" icon={Store} tone="muted" size="sm" onPress={() => nav.go('cua-hang')} testID="practice-buy-hint" /> : null}
            </View>
          ) : null}
          <Flash text={flash} />
          {outcome ? <Feedback outcome={outcome} kind={item.kind} onNext={next} nextLabel={finished ? 'Xem kết quả' : 'Câu tiếp'} /> : null}
          {ownedLore.length ? (
            <View style={{ gap: 6 }} testID="practice-lore">
              <Txt f="heavy" size={12.5} color={t.ink}>Thẻ Binh thư em đang có ({ownedLore.length})</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {ownedLore.map((c, k) => (
                  <Pressable key={c.id} onPress={() => stepTo(nav, grade, stageId, 'tham-su')} accessibilityRole="button" accessibilityLabel={`Thẻ ${c.tag}: ${c.title}. Bấm để đọc lại ở Thám sử`}
                    style={({ pressed }) => ({ flexGrow: 1, flexBasis: 100, maxWidth: 220, minHeight: 52, borderRadius: 10, padding: 8, backgroundColor: ['#2F5563', '#7E1616', '#5B4632'][k % 3], opacity: pressed ? 0.85 : 1 })}>
                    <Txt f="heavy" size={10.5} color="#F2C66D">{c.tag}</Txt>
                    <Txt f="semibold" size={11.5} color="#FFF6E5" numberOfLines={2}>{c.title}</Txt>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          <BtButton title="Xem lại thẻ Binh thư" icon={BookOpen} tone="muted" size="sm" onPress={() => stepTo(nav, grade, stageId, 'tham-su')} style={{ alignSelf: 'flex-start' }} testID="practice-lesson" />
        </>
      )}
    </BtPage>
  );
};

// ---------------------------------------------------------------------- Sử quan tổng kết (bước 5/5)
const RewardSheet: React.FC<{ completion: Completion; title: string; onClose: () => void }> = ({ completion, title, onClose }) => {
  const t = useBT();
  const r = completion.rewards;
  useEffect(() => { play('reward'); }, []);
  return (
    <Sheet open persistent onClose={onClose} title="Hoàn thành chặng" subtitle={title} footer={<BtButton title="Nhận thưởng" icon={Check} full onPress={onClose} testID="reward-claim" />}>
      <View style={{ gap: 14 }} testID="reward-overlay" accessibilityLabel="Phần thưởng hoàn thành chặng">
        <View style={{ alignItems: 'center', gap: 6 }}>
          <StarRow n={completion.stars} size={32} />
          <Txt size={13} color={t.muted}>Sao của chặng</Txt>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {r.xp ? <Pill text={`+${num(r.xp)} KN`} bg={t.goldSoft} fg={t.accent} strong /> : null}
          {r.gold ? <Pill text={`+${num(r.gold)} vàng`} bg={t.goldSoft} fg={t.goldInk} strong /> : null}
        </View>
        {completion.rank_up ? (
          <BtCard tone="hero" style={{ alignItems: 'center' }} testID="reward-rank-up">
            <Eyebrow text="Khoa bảng" color={t.gold} />
            <SerifTitle size={22} color={t.onHero} center>Em đã đỗ {completion.rank_up.to}!</SerifTitle>
            <Txt size={13} color={t.onHeroMuted} center>Từ {completion.rank_up.from} lên {completion.rank_up.to}.</Txt>
          </BtCard>
        ) : null}
        {r.card ? (
          <BtCard tone="sunk" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Portrait code={r.card.portrait} size={88} />
            <View style={{ flex: 1, gap: 4 }}>
              <Eyebrow text="Thẻ nhân vật mới" color={t.muted} />
              <SerifTitle size={20}>{r.card.name}</SerifTitle>
              <Txt size={13} color={t.muted}>{r.card.title} · {RARITY[r.card.rarity]?.label ?? ''}</Txt>
            </View>
          </BtCard>
        ) : null}
        {r.badge ? (
          <BtCard tone="sunk" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Medal code={r.badge.code ?? ''} size={52} />
            <View style={{ flex: 1 }}><Eyebrow text="Huy hiệu" color={t.muted} /><Txt f="heavy" size={16} color={t.ink}>{r.badge.name}</Txt></View>
          </BtCard>
        ) : null}
        {completion.grade_done ? <TtSays><Txt size={13.5} color={t.ink}>Em đã xong chiến dịch Khối {completion.grade}! Mở hòm báu cuối chiến dịch trên bản Chiến dịch.</Txt></TtSays> : null}
      </View>
    </Sheet>
  );
};

/** Sử quan tổng kết: sao, bảng so sánh với lịch sử, nhận xét của Tiểu Tướng, diễn biến có nguồn, phần sáng tạo, phần thưởng, chặng tiếp */
export const SuQuanScreen: React.FC<StageProps> = ({ session, nav, stageId, campaignNo }) => {
  const t = useBT();
  const data = useLoad<StageSummary>(session, (tk) => saga.summary(tk, stageId), [stageId]);
  const sum = data.data;
  const grade = sum?.stage.grade ?? campaignNo;
  const reward = nav.reward?.stageId === stageId ? nav.reward.completion : null;
  const head = <StepHeader eyebrow="Bước 5/5 · Sử quan tổng kết" title={sum?.stage.title ?? 'Sử quan tổng kết'} onBack={() => nav.back('chien-dich', { c: grade })} backLabel="Về Chiến dịch" />;
  if (!sum) return <BtPage testID="saga-summary" tabBar={false} max={1080}>{head}<LoadState loading={data.loading} error={data.error} onRetry={data.reload} /></BtPage>;
  const b = sum.result.battle;
  return (
    <BtPage testID="saga-summary" tabBar={false} max={1180}>
      {head}
      <Columns left={(
        <>
          <BtCard tone="hero" pad={18} testID="summary-stars">
            <Eyebrow text={`${sum.stage.place} · ${sum.stage.date_label}`} color={t.gold} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <StarRow n={sum.result.stars} size={30} />
              <SerifTitle size={20} color={t.onHero}>{sum.result.stars >= 3 ? 'Toàn thắng!' : sum.result.stars === 2 ? 'Thắng lợi' : 'Hoàn thành'}</SerifTitle>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <StatTile value={`${sum.result.knowledge_percent}%`} label="Hội đồng" />
              {b ? <StatTile value={`${b.stars} sao`} label={b.title} /> : null}
              <StatTile value={sum.rank.name} label="Khoa bảng" />
            </View>
            {sum.battle_text ? <Txt size={13.5} color={t.onHeroMuted} style={{ lineHeight: 20 }}>{sum.battle_text}</Txt> : null}
          </BtCard>
          {sum.compare.length ? (
            <BtCard pad={0} style={{ overflow: 'hidden', gap: 0 }} testID="summary-compare">
              <View style={{ padding: 12, paddingBottom: 8 }}><Txt f="heavy" size={15} color={t.ink}>Em và lịch sử</Txt></View>
              {sum.compare.map((r, i) => (
                <View key={`${r.label}${i}`} style={{ padding: 12, gap: 6, borderTopWidth: 1, borderTopColor: t.line }} accessible accessibilityLabel={`${r.label}. Em: ${r.mine}. Lịch sử: ${r.history}. ${r.ok ? 'Giống lịch sử' : 'Khác lịch sử'}`}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Eyebrow text={r.label} color={t.muted} />
                    <View style={{ flex: 1 }} />
                    <Pill text={r.ok ? 'Giống lịch sử' : 'Khác lịch sử'} bg={r.ok ? t.greenSoft : t.dangerSoft} fg={r.ok ? t.green : t.danger} strong />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1, gap: 2 }}><Txt f="heavy" size={11.5} color={t.accent}>EM</Txt><Txt size={13.5} color={t.ink} style={{ lineHeight: 19 }}>{r.mine}</Txt></View>
                    <View style={{ flex: 1, gap: 2 }}><Txt f="heavy" size={11.5} color={t.teal}>LỊCH SỬ</Txt><Txt size={13.5} color={t.ink} style={{ lineHeight: 19 }}>{r.history}</Txt></View>
                  </View>
                </View>
              ))}
            </BtCard>
          ) : null}
          <TtSays testID="summary-comment">
            <Txt f="heavy" size={13} color={t.teal}>Tiểu Tướng nhận xét</Txt>
            <Txt size={14} color={t.ink} style={{ lineHeight: 21 }}>{sum.comment}</Txt>
            {sum.comment_source ? <Txt size={11.5} color={t.muted}>{sum.comment_source}</Txt> : null}
          </TtSays>
          <BtCard testID="summary-debrief">
            <Eyebrow text="Sử quan chép" />
            <SerifTitle size={20}>{sum.debrief.title}</SerifTitle>
            {sum.debrief.paragraphs.map((p, i) => <Txt key={i} f="serif" size={16.5} color={t.ink} style={{ lineHeight: 26 }}>{p}</Txt>)}
            <Eyebrow text="Nguồn tham khảo" color={t.muted} />
            {sum.debrief.sources.map((src) => <SourceLine key={src.key} source={src} />)}
          </BtCard>
        </>
      )} right={(
        <>
          <BtCard tone="sunk" testID="summary-rewards">
            <Txt f="heavy" size={14} color={t.ink}>Phần thưởng của chặng</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Pill text={`+${sum.rewards.xp} KN`} bg={t.goldSoft} fg={t.accent} strong />
              <Pill text={`+${sum.rewards.gold} vàng`} bg={t.goldSoft} fg={t.goldInk} strong />
            </View>
            {sum.rewards.card ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Portrait code={sum.rewards.card.portrait} size={48} locked={Boolean(sum.rewards.card.hidden)} />
                <Txt size={13} color={t.ink} style={{ flex: 1 }}>Thẻ nhân vật: {sum.rewards.card.name}</Txt>
              </View>
            ) : null}
            <Txt size={11.5} color={t.muted}>Phần thưởng chỉ trao một lần, lần đầu xong chặng.</Txt>
          </BtCard>
          {sum.weak_objectives.length ? (
            <BtCard testID="summary-weak">
              <Txt f="heavy" size={14} color={t.ink}>Nên ôn lại</Txt>
              {sum.weak_objectives.map((w) => (
                <View key={w.objective} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Txt size={13.5} color={t.ink} style={{ flex: 1 }}>{w.text}</Txt><Txt f="heavy" size={13} color={t.danger}>{w.percent}% đúng</Txt>
                </View>
              ))}
              <BtButton title="Luyện binh riêng" icon={RotateCcw} tone="ghost" size="sm" onPress={() => nav.go('luyen-binh')} testID="summary-review" />
            </BtCard>
          ) : null}
          <TtSays tone="light"><Txt size={12.5} color={t.soft} style={{ lineHeight: 18 }}>Phần sáng tạo trong trò chơi: {sum.debrief.fiction}</Txt></TtSays>
          <View style={{ gap: 8 }}>
            {sum.next ? <BtButton title={`Chặng tiếp: ${sum.next.title}`} iconRight={ChevronRight} size="lg" onPress={() => nav.go('chien-dich', { c: sum.next!.grade ?? grade, s: sum.next!.id, v: 'quan-lenh' }, 'replace')} full testID="summary-next" /> : null}
            {b && b.stars < 3 ? <BtButton title="Đánh lại lấy 3 sao" icon={Swords} tone="ghost" onPress={() => stepTo(nav, grade, stageId, 'xuat-tran')} full testID="summary-replay" /> : null}
            <BtButton title="Về Chiến dịch" tone="ghost" onPress={() => nav.go('chien-dich', { c: grade }, 'replace')} full testID="summary-map" />
          </View>
        </>
      )} />
      {reward ? <RewardSheet completion={reward} title={sum.stage.title} onClose={() => { nav.setReward(null); nav.refresh(); }} /> : null}
    </BtPage>
  );
};

// ---------------------------------------------------------------------- Luyện binh riêng
/**
 * Lượt Luyện binh riêng (bản vẽ màn 10): nút đóng + thanh tiến độ "3/6", dòng "LUYỆN BINH RIÊNG · TIỂU TƯỚNG ĐỀ XUẤT", câu hỏi làm tiêu đề, lý do Tiểu Tướng chọn lượt này,
 * thân câu (câu xếp trình tự là dòng thời gian đặt từng thẻ), cuối màn ghi cách thưởng và lịch ôn lại. Đồng hồ do máy chủ giữ, chỉ chạy khi câu được mở.
 */
const ReviewQuiz: React.FC<{ session: Session; nav: SagaNav; initial: PracticeSession; reason: string | null; gapDays: number; onExit: () => void }> = ({ session, nav, initial, reason, gapDays, onExit }) => {
  const t = useBT();
  const [sess, setSess] = useState(initial);
  const [cursor, setCursor] = useState(Math.min(initial.index, initial.total - 1));
  const [outcome, setOutcome] = useState<AnswerOutcome | null>(null);
  const [step, setStep] = useState<AnswerOutcome | null>(null);
  const [finished, setFinished] = useState<ReviewFinished | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const [flash, setFlash] = useFlash();
  const deadline = useRef<number | null>(null);
  const scroller = useRef<ScrollViewInstance | null>(null);
  useEffect(() => {
    if (!outcome) return undefined;
    const tm = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(tm);
  }, [outcome]);
  const live = useRef({ sess, busy, outcome, session, nav });
  live.current = { sess, busy, outcome, session, nav };
  const item = sess.items[cursor];
  const act = async (action: Record<string, unknown>, timedOut = false): Promise<void> => {
    const cur = live.current;
    if (cur.busy) return;
    setBusy(true); live.current.busy = true;
    try {
      const res = await saga.act<PracticeSession, AnswerOutcome & { ready?: boolean }, ReviewFinished>(cur.session.token, cur.sess.session_id, cur.sess.seq, action);
      setSess(res.view);
      if (res.outcome.ready) return;
      // xếp dòng thời gian: mỗi lần đặt một thẻ là một bước, câu chưa xong thì đồng hồ vẫn chạy
      if (!res.outcome.done) { setStep(res.outcome); return; }
      deadline.current = null; setLeft(null);
      setOutcome({ ...res.outcome, timeout: res.outcome.timeout || timedOut });
      if (item?.kind !== 'sequence') play(res.outcome.correct ? 'right' : 'wrong');
      if (res.finished) { setFinished(res.finished); cur.nav.refresh(); }
    } catch (e) {
      if (statusOf(e) === 401) cur.session.expired();
      else if (statusOf(e) === 409) onExit();
      setFlash(errorMessage(e));
    } finally { setBusy(false); live.current.busy = false; }
  };
  // mở câu: báo máy chủ bắt đầu tính giờ (thời gian đọc lời giải thích của câu trước không bị trừ)
  useEffect(() => {
    if (outcome || showResult || !item || item.done) return;
    if (sess.timer) { deadline.current = Date.now() + sess.timer.left_ms; setLeft(Math.ceil(sess.timer.left_ms / 1000)); } else void act({ type: 'ready' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, sess.timer?.limit_s, Boolean(sess.timer), outcome === null, showResult]);
  useEffect(() => {
    const tm = setInterval(() => {
      if (deadline.current === null || live.current.outcome) return;
      const ms = deadline.current - Date.now();
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
      if (ms <= 0 && !live.current.busy) { deadline.current = null; void act({ type: 'answer', item_id: live.current.sess.items.find((it) => !it.done)?.id, answer: {} }, true); }
    }, 250);
    return () => clearInterval(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const next = (): void => {
    setOutcome(null); setStep(null);
    if (finished) { setShowResult(true); play('win'); return; }
    const i = sess.items.findIndex((it) => !it.done);
    setCursor(i < 0 ? sess.total - 1 : i);
  };
  const streak = outcome?.streak ?? sess.streak ?? 0;
  const urgent = left !== null && left <= 5;
  const doneCount = sess.items.filter((it) => it.done).length;
  const sched = outcome?.review ?? null;
  return (
    <BtPage testID="saga-review-quiz" tabBar={false} max={920} scrollRef={scroller}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={onExit} accessibilityRole="button" accessibilityLabel="Dừng lượt luyện, về Luyện binh riêng (có thể tiếp tục sau)" testID="review-close" hitSlop={4}
          style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
          <X size={19} color={t.ink} strokeWidth={2.4} />
        </Pressable>
        <BtBar value={sess.total ? doneCount / sess.total : 0} color={t.green} height={10} label={`Đã làm ${doneCount}/${sess.total} câu`} style={{ flex: 1 }} />
        <Txt f="heavy" size={13} color={t.ink}>{doneCount}/{sess.total}</Txt>
      </View>
      {showResult && finished ? (
        <BtCard tone="gold" pad={20} style={{ alignItems: 'center' }} testID="review-result">
          <SerifTitle size={26} color={t.green} center>Xong lượt luyện!</SerifTitle>
          <Txt f="serifBold" size={40} color={t.ink}>{finished.right}/{finished.total}</Txt>
          <Txt size={14} color={t.muted} center>Đúng {finished.percent}% · chuỗi đúng dài nhất {finished.best_streak} câu</Txt>
          {finished.xp || finished.gold ? <Pill text={[finished.xp ? `+${finished.xp} KN` : '', finished.gold ? `+${finished.gold} vàng` : ''].filter(Boolean).join(' · ')} bg={t.goldSoft} fg={t.goldInk} strong /> : null}
          <Txt size={14} color={t.muted} center>Câu trả lời đúng được hẹn ôn lại sau {gapDays} ngày; đúng thêm lần nữa là nhớ chắc. Câu còn sai sẽ được hỏi lại ở lượt sau.</Txt>
          <BtButton title="Xong" icon={Check} onPress={onExit} testID="review-done" />
        </BtCard>
      ) : item ? (
        <>
          <View style={{ gap: 3 }} testID={`review-item-${item.kind}`}>
            <Eyebrow text={`Luyện binh riêng · Tiểu Tướng đề xuất · ${item.kind_label}`} color={t.teal} />
            <SerifTitle size={20}>{item.prompt}</SerifTitle>
            {item.stage_title ? <View style={{ alignSelf: 'flex-start' }}><Pill text={`Chặng ${item.stage_title}`} /></View> : null}
            {cursor === 0 || !reason ? <Txt size={12.5} color={t.muted} style={{ lineHeight: 18 }}>{reason ?? 'Tiểu Tướng chọn các câu em hay nhầm và câu tới ngày ôn lại.'}</Txt> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <View accessible accessibilityRole="timer" accessibilityLabel={left === null ? 'Đồng hồ đang dừng' : `Còn ${left} giây`} testID="review-timer"
              style={{ minWidth: 76, height: 40, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: urgent ? t.danger : t.line, backgroundColor: urgent ? t.dangerSoft : t.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Clock size={16} color={urgent ? t.danger : t.muted} />
              <Txt f="heavy" size={16} color={urgent ? t.danger : t.ink}>{left === null ? '–' : `${left}s`}</Txt>
            </View>
            <Pill text={`Chuỗi đúng: ${streak}`} bg={t.goldSoft} fg={t.goldInk} strong />
          </View>
          <ItemBody session={session} item={item} outcome={outcome} step={step} busy={busy} onAnswer={(a) => { void act({ type: 'answer', item_id: item.id, answer: a }); }} />
          <Flash text={flash} />
          {outcome ? <Feedback outcome={outcome} kind={item.kind} onNext={next} nextLabel={finished ? 'Xem kết quả' : 'Câu tiếp'} /> : null}
          {sched ? (
            <Pill testID="review-schedule" text={sched.next === 'done' ? 'Đã nhớ chắc – câu này ra khỏi hàng ôn' : sched.next === 'later' ? `Hẹn ôn lại sau ${sched.days ?? gapDays} ngày` : 'Câu này sẽ được hỏi lại ở lượt sau'}
              bg={sched.next === 'again' ? t.dangerSoft : t.greenSoft} fg={sched.next === 'again' ? t.danger : t.green} strong />
          ) : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <Txt size={12} color={t.muted}>Đúng mỗi câu (lần đầu trong ngày): +10 KN +2 vàng</Txt>
            <Txt size={12} color={t.muted}>Câu đúng hẹn ôn lại sau {gapDays} ngày</Txt>
          </View>
          <BtButton title="Dừng lượt luyện" tone="muted" size="sm" onPress={onExit} style={{ alignSelf: 'flex-start' }} testID="review-exit" label="Dừng lượt luyện, có thể tiếp tục sau" />
        </>
      ) : null}
    </BtPage>
  );
};

/** Luyện binh riêng: Tiểu Tướng gom các câu em hay sai thành lượt 6 câu tính giờ; đúng mỗi câu +10 KN +2 vàng (mỗi câu một lần mỗi ngày) */
export const LuyenBinhScreen: React.FC<{ session: Session; nav: SagaNav }> = ({ session, nav }) => {
  const t = useBT();
  const [round, setRound] = useState(0);
  const info = useLoad<ReviewInfo>(session, saga.review, [round]);
  const [quiz, setQuiz] = useState<PracticeSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useFlash();
  const start = async (restart: boolean): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try { setQuiz(await saga.startReview(session.token, restart)); play('tap'); } catch (e) { if (statusOf(e) === 401) session.expired(); setFlash(errorMessage(e)); } finally { setBusy(false); }
  };
  const d = info.data;
  if (quiz) return <ReviewQuiz session={session} nav={nav} initial={quiz} reason={d?.suggest?.text ?? null} gapDays={d?.later?.gap_days ?? 3} onExit={() => { setQuiz(null); setRound((n) => n + 1); nav.refresh(); }} />;
  const head = <StepHeader eyebrow="Luyện binh riêng" title="Ôn những câu em hay nhầm" onBack={() => nav.back('doanh-trai')} backLabel="Về Doanh trại" />;
  if (!d) return <BtPage testID="saga-review" tabBar={false} max={1080}>{head}<LoadState loading={info.loading} error={info.error} onRetry={info.reload} /></BtPage>;
  return (
    <BtPage testID="saga-review" tabBar={false} max={1080}>
      {head}
      <Columns left={(
        <>
          <TtSays testID="review-suggest">
            <Txt f="heavy" size={13} color={t.teal}>Tiểu Tướng gợi ý</Txt>
            <Txt size={14} color={t.ink} style={{ lineHeight: 21 }}>{d.suggest?.text ?? (d.can_start ? 'Em chưa sai câu nào. Làm một lượt để nhớ chắc các chặng đã học nhé.' : 'Hãy qua Hội đồng quân sự của ít nhất một chặng; các câu của chặng đó sẽ có ở đây.')}</Txt>
            {d.suggest?.stages.length ? <Txt size={12} color={t.muted}>Chặng: {d.suggest.stages.join(', ')}</Txt> : null}
          </TtSays>
          <Flash text={flash} />
          {d.can_start ? (
            <View style={{ gap: 8 }}>
              <BtButton title={d.active_session_id ? 'Tiếp tục lượt đang dở' : `Bắt đầu luyện ${d.size} câu`} size="lg" iconRight={ChevronRight} loading={busy} onPress={() => { void start(false); }} full testID="review-start" />
              {d.active_session_id ? <BtButton title="Lượt mới" icon={RotateCcw} tone="ghost" disabled={busy} onPress={() => { void start(true); }} full testID="review-restart" /> : null}
              <Txt size={12} color={t.muted}>Mỗi câu có đồng hồ (20–45 giây) chỉ chạy khi câu được mở. Đúng mỗi câu +10 KN +2 vàng, mỗi câu một lần trong ngày.</Txt>
            </View>
          ) : <BtButton title="Mở Chiến dịch" iconRight={ChevronRight} onPress={() => nav.go('chien-dich')} testID="review-to-map" />}
          {d.later && d.later.count ? (
            <TtSays tone="light" testID="review-later">
              <Txt size={13} color={t.ink} style={{ lineHeight: 19 }}>{d.later.count} câu em đã trả lời đúng đang được hẹn ôn lại{d.later.next_at ? ` (sớm nhất ngày ${new Date(d.later.next_at).toLocaleDateString('vi-VN')})` : ''}. Đúng thêm một lần nữa khi tới hạn là nhớ chắc.</Txt>
            </TtSays>
          ) : null}
          {d.due.length ? (
            <BtCard testID="review-due">
              <Txt f="heavy" size={15} color={t.ink}>Câu từng trả lời sai ({d.due.length})</Txt>
              {d.due.slice(0, 12).map((q) => (
                <View key={q.item_id} style={{ gap: 2, paddingVertical: 6, borderTopWidth: 1, borderTopColor: t.line }}>
                  <Txt size={13.5} color={t.ink} numberOfLines={2}>{q.prompt}</Txt>
                  <Txt size={12} color={t.muted}>{q.kind_label} · {q.stage_title} · sai {q.wrong_count} lần</Txt>
                </View>
              ))}
            </BtCard>
          ) : null}
        </>
      )} right={(
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatTile value={String(d.due.length)} label="Câu cần ôn" color={t.danger} />
            <StatTile value={`${d.stats.percent}%`} label="Tỉ lệ đúng" color={t.green} />
            <StatTile value={String(d.pool)} label="Câu trong kho" />
          </View>
          {d.weak_objectives.length ? (
            <BtCard testID="review-weak">
              <Txt f="heavy" size={15} color={t.ink}>Mục tiêu còn yếu</Txt>
              {d.weak_objectives.map((w) => (
                <View key={`${w.stage_id}${w.objective}`} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <Txt size={13.5} color={t.ink} style={{ flex: 1 }}>{w.text}</Txt>
                    <Txt f="heavy" size={13} color={t.danger}>{w.percent}%</Txt>
                  </View>
                  <BtBar value={w.percent / 100} color={t.danger} height={6} label={`${w.text}: đúng ${w.percent}%`} />
                  <Txt size={12} color={t.muted}>Chặng {w.stage_title} · {w.answers} lượt trả lời</Txt>
                </View>
              ))}
            </BtCard>
          ) : null}
        </>
      )} />
    </BtPage>
  );
};

// ---------------------------------------------------------------------- Binh thư
/** Tranh minh họa nhân vật (bộ ảnh gốc của nhóm trong assets/student-hall; tranh cách điệu, không phải chân dung lịch sử); nhân vật khác dùng hình vẽ của dự án */
const HERO_ART: Record<string, ImageSourcePropType> = {
  'tran-hung-dao': HALL_ART.tranHungDao, 'tran-nhan-tong': HALL_ART.tranNhanTong, 'tran-thu-do': HALL_ART.tranThuDo,
  'tran-quang-khai': HALL_ART.tranQuangKhai, 'tran-khanh-du': HALL_ART.tranKhanhDu, 'tran-nhat-duat': HALL_ART.tranNhatDuat,
};
const HeroFace: React.FC<{ card: Pick<SagaCard, 'code' | 'portrait' | 'name' | 'owned'>; size: number }> = ({ card, size }) => {
  const t = useBT();
  const art = HERO_ART[card.code];
  if (art && card.owned) return <Image source={art} style={{ width: size, height: size, borderRadius: 14, backgroundColor: t.card2 }} resizeMode="cover" accessibilityLabel={`Tranh minh họa ${card.name}`} />;
  return <Portrait code={card.portrait} size={size} locked={!card.owned} />;
};
type BinhTab = LoreShelf;
const SHELF_TEXT: Record<LoreShelf, { label: string; empty: string }> = {
  'nhan-vat': { label: 'Nhân vật', empty: 'Nhặt thẻ “Nhân vật” ở bước Thám sử, xong chặng để nhận thẻ danh tướng.' },
  'ke-sach': { label: 'Kế sách', empty: 'Thẻ “Thời cơ”, “Thế trận”, “Kế sách” nhặt ở bước Thám sử sẽ vào ngăn này.' },
  'dia-danh': { label: 'Địa danh', empty: 'Thẻ “Địa thế” nhặt ở bước Thám sử sẽ vào ngăn này.' },
};

/** Binh thư: sổ thẻ của em – ba ngăn Nhân vật / Kế sách / Địa danh; thẻ chưa nhặt hiện mờ kèm chặng có thẻ đó */
export const BinhThuScreen: React.FC<{ session: Session; nav: SagaNav }> = ({ session, nav }) => {
  const t = useBT();
  const lore = useLoad<LoreView>(session, (tk) => saga.lore(tk), []);
  const album = useLoad<CardAlbum>(session, (tk) => saga.cards(tk), []);
  const [tab, setTab] = useState<BinhTab>('nhan-vat');
  const [card, setCard] = useState<LoreCard | null>(null);
  const [hero, setHero] = useState<SagaCard | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const v = lore.data;
  const list = (v?.cards ?? []).filter((c) => c.shelf === tab);
  const shelfCount = (s: LoreShelf) => v?.shelves[s] ?? { owned: 0, total: 0 };
  const loreGrid = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }} testID={`binh-thu-${tab}`}>
      {list.map((c) => (
        <Pressable key={c.key} onPress={() => (c.owned ? setCard(c) : nav.go('chien-dich', { c: c.grade ?? null, s: c.stage_id, v: 'tham-su' }))} accessibilityRole="button" testID={`lore-${c.key}`}
          accessibilityLabel={c.owned ? `${c.tag}: ${c.title}` : `${c.tag} chưa nhặt, ở chặng ${c.stage_title}`}
          style={({ pressed }) => ({ flexGrow: 1, flexBasis: 220, maxWidth: 380, minHeight: 96, borderRadius: 14, padding: 12, gap: 4, borderWidth: 1, borderStyle: c.owned ? 'solid' : 'dashed',
            borderColor: c.owned ? t.line2 : t.line, backgroundColor: c.owned ? t.card : t.card2, opacity: pressed ? 0.88 : 1 })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Eyebrow text={c.tag} color={c.owned ? t.accent : t.muted} />
            <View style={{ flex: 1 }} />
            {c.owned ? null : <Lock size={13} color={t.muted} />}
          </View>
          <Txt f="heavy" size={14.5} color={c.owned ? t.ink : t.muted} numberOfLines={2}>{c.owned ? c.title : 'Thẻ chưa nhặt'}</Txt>
          <Txt size={12} color={t.muted} numberOfLines={1}>{c.grade ? `Khối ${c.grade} · ` : ''}{c.stage_title}</Txt>
        </Pressable>
      ))}
      {!list.length ? <Txt size={13} color={t.muted}>{SHELF_TEXT[tab].empty}</Txt> : null}
    </View>
  );
  const heroes = album.data;
  // thẻ nổi bật (bản vẽ màn 11): thẻ em đang xem, mặc định thẻ mới nhận gần đây nhất
  const featured = heroes ? heroes.cards.find((h) => h.code === (focus ?? heroes.latest_code)) ?? heroes.cards.find((h) => h.owned) ?? heroes.cards[0] ?? null : null;
  return (
    <BtPage testID="saga-binh-thu" max={1180}>
      <View style={{ gap: 2 }}>
        <Eyebrow text="Binh thư" />
        <SerifTitle size={24}>Sổ binh thư của em</SerifTitle>
        <Txt size={13} color={t.muted}>{v ? `Đã nhặt ${v.owned}/${v.total} thẻ Binh thư${heroes ? ` · ${heroes.owned}/${heroes.total} thẻ danh tướng` : ''}.` : 'Thẻ nhặt ở bước Thám sử của mỗi chặng.'}</Txt>
      </View>
      <SegTabs options={(['nhan-vat', 'ke-sach', 'dia-danh'] as LoreShelf[]).map((s) => ({ value: s, label: SHELF_TEXT[s].label, sub: v ? `${shelfCount(s).owned}/${shelfCount(s).total}` : undefined }))} value={tab} onChange={setTab} label="Ngăn Binh thư" testID="binh-thu-tab" />
      {!v ? <LoadState loading={lore.loading} error={lore.error} onRetry={lore.reload} /> : (
        <>
          {tab === 'nhan-vat' ? (
            <BtCard testID="binh-thu-heroes">
              <Txt f="heavy" size={15} color={t.ink}>Thẻ danh tướng</Txt>
              {!heroes ? <LoadState loading={album.loading} error={album.error} onRetry={album.reload} /> : (
                <>
                  {featured ? (
                    <BtCard tone="night" testID="binh-thu-featured" style={{ flexDirection: 'row', gap: 14 }}>
                      <View style={{ alignItems: 'center', gap: 6 }}>
                        <HeroFace card={featured} size={96} />
                        <Pill text={featured.owned ? RARITY[featured.rarity]?.label ?? '' : 'Chưa mở'} bg="rgba(255,255,255,0.14)" fg={t.gold} strong />
                      </View>
                      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                        <SerifTitle size={19} color={t.onNight}>{featured.name}</SerifTitle>
                        <Txt size={12.5} color={t.onNightMuted} style={{ lineHeight: 18 }} numberOfLines={6}>
                          {featured.owned ? featured.intro || featured.title : `Thẻ còn khóa${featured.stage_title ? `: xong chặng “${featured.stage_title}” để mở` : ''}.`}
                        </Txt>
                        {featured.stage_title ? <Txt size={11.5} color={t.gold}>Mở ở chặng: {featured.stage_title}</Txt> : null}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          {featured.owned ? <BtButton title="Xem đầy đủ" size="sm" tone="gold" onPress={() => setHero(featured)} testID="hero-open" /> : null}
                          <BtButton title="Hỏi Tiểu Tướng" size="sm" tone="glass" onPress={() => { askTieuTuong(`Kể cho em nghe về ${featured.name} trong các cuộc kháng chiến.`); nav.go('tieu-tuong'); }} testID="hero-ask" />
                        </View>
                      </View>
                    </BtCard>
                  ) : null}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {heroes.cards.map((h) => {
                      const on = featured?.code === h.code;
                      return (
                        <Pressable key={h.code} onPress={() => setFocus(h.code)} accessibilityRole="button" accessibilityState={{ selected: on }} testID={`hero-${h.code}`}
                          accessibilityLabel={h.owned ? `Thẻ ${h.name}, ${h.title}${on ? ', đang xem' : ''}` : `Thẻ ${h.name} chưa mở${h.stage_title ? `: xong chặng ${h.stage_title}` : ''}`}
                          style={({ pressed }) => ({ flexGrow: 1, flexBasis: 96, maxWidth: 170, alignItems: 'center', gap: 4, padding: 8, borderRadius: 12, borderWidth: on ? 2 : 1,
                            borderStyle: h.owned ? 'solid' : 'dashed', borderColor: on ? t.accent : h.owned ? t.line : t.line2, backgroundColor: on ? t.goldSoft : h.owned ? t.card : t.card2, opacity: pressed ? 0.85 : 1 })}>
                          <HeroFace card={h} size={52} />
                          <Txt f="heavy" size={11.5} color={h.owned ? t.ink : t.muted} center numberOfLines={2}>{h.name}</Txt>
                          <Txt size={10.5} color={on ? t.accent : t.muted} center numberOfLines={1}>{on ? 'Đang xem' : h.owned ? h.title : h.stage_title ? `Mở ở ${h.stage_title}` : 'Chưa mở'}</Txt>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
              <Txt size={11.5} color={t.muted}>Tranh nhân vật là hình minh họa cách điệu, không phải chân dung lịch sử.</Txt>
            </BtCard>
          ) : null}
          {loreGrid}
        </>
      )}
      {card ? (
        <Sheet open onClose={() => setCard(null)} title={card.title} subtitle={`${card.tag} · ${card.stage_title}`}>
          <View style={{ gap: 12 }} testID="binh-thu-card">
            {card.body ? <Txt size={15.5} color={t.ink} style={{ lineHeight: 24 }}>{card.body}</Txt> : null}
            {(card.facts ?? []).map((f, i) => (
              <View key={`${f.label}${i}`} style={{ flexDirection: 'row', gap: 10 }}>
                <Txt f="heavy" size={13} color={t.muted} style={{ width: 110 }}>{f.label}</Txt>
                <Txt size={13.5} color={t.ink} style={{ flex: 1 }}>{f.value}</Txt>
              </View>
            ))}
            {card.source ? <SourceLine source={card.source} /> : null}
            <BtButton title="Hỏi Tiểu Tướng về thẻ này" icon={MessageSquareText} tone="ghost" size="sm" style={{ alignSelf: 'flex-start' }} testID="binh-thu-ask"
              onPress={() => { askTieuTuong(`Giải thích thêm cho em về “${card.title}”.`); setCard(null); nav.go('tieu-tuong'); }} />
          </View>
        </Sheet>
      ) : null}
      {hero ? (
        <Sheet open onClose={() => setHero(null)} title={hero.name} subtitle={`${hero.title}${hero.years ? ` · ${hero.years}` : ''}`}>
          <View style={{ gap: 12 }} testID="hero-detail">
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              <HeroFace card={hero} size={110} />
              <View style={{ flex: 1, gap: 6 }}>
                <Pill text={hero.owned ? RARITY[hero.rarity]?.label ?? '' : 'Chưa mở'} bg={hero.owned ? t.goldSoft : t.card2} fg={hero.owned ? t.goldInk : t.muted} strong />
                {hero.stage_title ? <Txt size={13} color={t.muted}>{hero.owned ? 'Mở ở chặng' : 'Xong chặng'} “{hero.stage_title}”{hero.owned ? '' : ' để mở thẻ'}</Txt> : null}
              </View>
            </View>
            {hero.owned ? (
              <>
                {hero.intro ? <Txt size={15} color={t.ink} style={{ lineHeight: 22 }}>{hero.intro}</Txt> : null}
                {hero.role_text ? <BtCard tone="sunk"><Eyebrow text="Trong cuộc kháng chiến" color={t.muted} /><Txt size={14.5} color={t.ink} style={{ lineHeight: 21 }}>{hero.role_text}</Txt></BtCard> : null}
                {hero.quote ? <View style={{ borderLeftWidth: 3, borderLeftColor: t.accent, paddingLeft: 12, gap: 2 }}><Txt f="serifItalic" size={17} color={t.ink}>“{hero.quote.replace(/ \/ /g, '\n')}”</Txt>{hero.quote_source ? <Txt size={12} color={t.muted}>{hero.quote_source}</Txt> : null}</View> : null}
                {hero.source ? <SourceLine source={{ title: hero.source, publisher: 'Tranh trên thẻ là hình minh họa cách điệu, không phải chân dung lịch sử', url: hero.source_url ?? null, note: null }} /> : null}
              </>
            ) : <Txt size={14.5} color={t.ink}>Thẻ này còn khóa. Phần giới thiệu nhân vật mở cùng thẻ khi em xong chặng.</Txt>}
          </View>
        </Sheet>
      ) : null}
    </BtPage>
  );
};
