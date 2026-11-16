/**
 * Hành trình Đông A – học, luyện tập và tổng kết một chặng (giao diện chung với các cổng quản trị: thẻ viền mảnh, nút đỏ son / nút giấy, nhãn trạng thái):
 *   - Thẻ kiến thức ngắn (ai, ở đâu, khi nào, vì sao, diễn biến), mỗi thẻ có nút "Xem nguồn".
 *   - Năm mẫu minigame dùng lại cho mọi chặng: trắc nghiệm, quyết định chiến thuật, xếp trình tự (bấm nút lên / xuống, không cần kéo thả), lật thẻ ghép cặp,
 *     chọn địa điểm trên bản đồ. Máy chủ chấm từng câu; giao diện không giữ đáp án và chỉ nhận giải thích sau khi đã trả lời.
 *   - Tổng kết: kết quả, diễn biến lịch sử đã kiểm chứng kèm nguồn, ghi chú phần sáng tạo, phần thưởng (trao một lần) và chặng tiếp theo.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { ArrowDown, ArrowUp, BookOpen, Check, ChevronLeft, ChevronRight, Coins, Footprints, Lightbulb, Map as MapIcon, Play, Puzzle, RotateCcw, ScrollText, Sparkles, Swords, Target, X } from 'lucide-react-native';
import * as saga from '@/lib/saga-api';
import { errorMessage } from '@/api/client';
import { DashboardMetric as Metric } from '@/components/admin/DashboardMetric';
import type { Session } from '@/components/auth';
import {
  BlockTitle, Flash, LoadState, Medal, Meter, OptionButton, Portrait, RARITY, SagaHeader, SagaPage, SourceLine, StarRow, artIcon, mapSource, num, useFlash, useKeys, useLoad, type OptionMark, type SagaNav,
} from '@/components/portal/SagaKit';
import { Btn, Card, Chip, InfoNote, Inset, Sheet, Txt } from '@/components/ui';
import { useReduceMotion, useShake } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import { play } from '@/lib/saga-sound';
import type { AnswerOutcome, Choice, Completion, LessonView, PracticeFinished, PracticeItem, PracticeSession, SagaMapInfo, StageSummary } from '@/types/saga';

type StageProps = { session: Session; nav: SagaNav; stageId: number; campaignNo: number };
const backToStage = (nav: SagaNav, campaignNo: number, stageId: number) => ({ label: 'Thông tin chặng', hint: 'Về bảng thông tin chặng', onPress: () => nav.back('chien-dich', { c: campaignNo, s: stageId, v: null }) });

// ---------------------------------------------------------------------- thẻ kiến thức
export const LessonScreen: React.FC<StageProps> = ({ session, nav, stageId, campaignNo }) => {
  const { c } = useTheme();
  const data = useLoad<LessonView>(session, (t) => saga.lesson(t, stageId), [stageId]);
  const [i, setI] = useState(0);
  const [source, setSource] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useFlash();
  const view = data.data;
  const total = view?.cards.length ?? 0;
  const card = view?.cards[Math.min(i, Math.max(0, total - 1))];
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
  const tone = ({ who: [c.thongNhat, c.thongChu], where: [c.mocNhat, c.mocChu], when: [c.thuyNhat, c.thuyChu], why: [c.hoaNhat, c.hoaChu], how: [c.sonNhat, c.sonChu] } as Record<string, [string, string]>)[card?.kind ?? 'how'] ?? [c.sonNhat, c.sonChu];
  const Art = artIcon(card?.art ?? null);
  return (
    <SagaPage testID="saga-lesson" max={860}>
      <SagaHeader title={view ? view.stage.title : 'Học kiến thức'} subtitle={view ? `Học kiến thức ngắn · ${view.stage.place} · ${view.stage.date_label}` : 'Học kiến thức ngắn'} back={backToStage(nav, campaignNo, stageId)} />
      {!view || !card ? <LoadState loading={data.loading} error={data.error} onRetry={data.reload} /> : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Meter value={(i + 1) / total} label={`Thẻ ${i + 1} trên ${total}`} style={{ flex: 1 }} />
            <Txt f="bold" size={13}>Thẻ {i + 1}/{total}</Txt>
          </View>
          <Card flat pad={0} style={{ borderRadius: 12, overflow: 'hidden' }} testID={`lesson-card-${i}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: c.adminLine }}>
              <View style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: tone[0], alignItems: 'center', justifyContent: 'center' }}><Art size={24} color={tone[1]} /></View>
              <View style={{ flex: 1, gap: 4 }}>
                <Chip text={card.kind_label} bg={tone[0]} fg={tone[1]} />
                <Txt f="displayHeavy" size={22} color={c.logoInk} accessibilityRole="header">{card.title}</Txt>
              </View>
            </View>
            <View style={{ padding: 16, gap: 12 }}>
              <Txt size={16} style={{ lineHeight: 26 }}>{card.body}</Txt>
              {card.facts.length ? (
                <View style={{ gap: 6 }}>
                  {card.facts.map((f) => (
                    <Inset key={f.label} pad={10} style={{ flexDirection: 'row', gap: 10 }}>
                      <Txt f="semibold" size={13} color={c.muc2} style={{ width: 120 }}>{f.label}</Txt>
                      <Txt f="bold" size={14} style={{ flex: 1 }}>{f.value}</Txt>
                    </Inset>
                  ))}
                </View>
              ) : null}
              {card.objective_text ? (
                <View style={{ flexDirection: 'row', gap: 8 }}><Target size={15} color={c.son} style={{ marginTop: 3 }} /><Txt size={14} color={c.muc2} style={{ flex: 1 }}>Mục tiêu: {card.objective_text}</Txt></View>
              ) : null}
              {card.source ? (
                <View style={{ gap: 8 }}>
                  <Btn title={source ? 'Ẩn nguồn' : 'Xem nguồn'} icon={ScrollText} tone="giay" size="sm" onPress={() => setSource((v) => !v)} testID="lesson-source" />
                  {source ? <Inset><SourceLine source={card.source} /></Inset> : null}
                </View>
              ) : null}
            </View>
          </Card>
          <Flash text={flash} />
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Btn title="Trước" icon={ChevronLeft} tone="giay" disabled={i === 0} onPress={() => move(-1)} testID="lesson-prev" />
            <View style={{ flex: 1 }} />
            {i < total - 1
              ? <Btn title="Tiếp" iconRight={ChevronRight} tone="son" onPress={() => move(1)} testID="lesson-next" />
              : <Btn title={view.done ? 'Sang luyện tập' : 'Học xong · Luyện tập'} icon={Puzzle} tone="son" loading={busy} onPress={() => { void finish(); }} testID="lesson-finish" />}
          </View>
          <Txt size={12} color={c.muc3} center>Trên máy tính có thể dùng phím ← → để lật thẻ.</Txt>
        </>
      )}
    </SagaPage>
  );
};

// ---------------------------------------------------------------------- các mẫu minigame
interface BodyProps { session: Session; item: PracticeItem; outcome: AnswerOutcome | null; step: AnswerOutcome | null; busy: boolean; onAnswer: (answer: Record<string, unknown>) => void }

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

const ChoiceBody: React.FC<BodyProps> = ({ item, outcome, busy, onAnswer }) => {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const options = item.kind === 'quiz' || item.kind === 'tactic' ? item.options : [];
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => setPicked(null), [item.id]);
  const pick = (id: string): void => { if (outcome || busy) return; setPicked(id); onAnswer({ choice: id }); };
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
        <Inset style={{ flexDirection: 'row', gap: 8 }}>
          <Swords size={17} color={c.son} style={{ marginTop: 2 }} />
          <Txt size={15} style={{ flex: 1 }}>{item.situation}</Txt>
        </Inset>
      ) : null}
      <View style={{ flexDirection: grid ? 'row' : 'column', flexWrap: grid ? 'wrap' : 'nowrap', gap: 8 }}>
        {options.map((o, i) => {
          const mark: OptionMark = outcome ? (o.id === correctId ? 'right' : o.id === chosenId ? 'wrong' : 'dim') : o.id === chosenId ? 'picked' : 'idle';
          return (
            <OptionButton key={o.id} badge={LETTERS[i]} text={o.text} mark={mark} disabled={Boolean(outcome) || busy} onPress={() => pick(o.id)} testID={`option-${LETTERS[i]}`}
              label={`Phương án ${LETTERS[i]}: ${o.text}${mark === 'right' ? ' (đáp án đúng)' : mark === 'wrong' ? ' (em đã chọn, chưa đúng)' : ''}`} style={grid ? { flexBasis: '48%', flexGrow: 1 } : undefined} />
          );
        })}
      </View>
    </View>
  );
};

const SequenceBody: React.FC<BodyProps> = ({ item, outcome, busy, onAnswer }) => {
  const { c } = useTheme();
  const source = item.kind === 'sequence' ? item.items : [];
  const [order, setOrder] = useState<Choice[]>(source);
  useEffect(() => setOrder(source), [item.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const swap = (i: number, d: number): void => setOrder((list) => { const j = i + d; if (j < 0 || j >= list.length) return list; const next = [...list]; [next[i], next[j]] = [next[j], next[i]]; play('step'); return next; });
  const right = (outcome?.detail.right as boolean[] | undefined) ?? null;
  const truth = (outcome?.detail.order as Array<{ id: string; text: string; when: string | null }> | undefined) ?? null;
  return (
    <View style={{ gap: 8 }}>
      <Txt size={14} color={c.muc2}>Xếp từ sớm nhất (trên) tới muộn nhất (dưới) bằng nút mũi tên, rồi bấm Kiểm tra.</Txt>
      {order.map((o, i) => {
        const ok = right ? right[i] : null;
        return (
          <View key={o.id} testID={`seq-row-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: ok === null ? c.adminLine : ok ? c.moc : c.son, backgroundColor: ok === null ? c.the : ok ? c.mocNhat : c.sonNhat }}>
            <View style={{ width: 30, height: 30, borderRadius: 6, backgroundColor: c.adminCanvas, alignItems: 'center', justifyContent: 'center' }}><Txt f="bold" size={14} color={c.muc2}>{i + 1}</Txt></View>
            <Txt f="semibold" size={15} style={{ flex: 1 }}>{o.text}</Txt>
            {ok !== null ? (ok ? <Check size={20} color={c.moc} strokeWidth={2.6} /> : <X size={20} color={c.son} strokeWidth={2.6} />) : (
              <>
                <Btn icon={ArrowUp} tone="giay" size="sm" label={`Đưa “${o.text}” lên trên`} disabled={i === 0 || busy} onPress={() => swap(i, -1)} testID={`seq-up-${i}`} />
                <Btn icon={ArrowDown} tone="giay" size="sm" label={`Đưa “${o.text}” xuống dưới`} disabled={i === order.length - 1 || busy} onPress={() => swap(i, 1)} testID={`seq-down-${i}`} />
              </>
            )}
          </View>
        );
      })}
      {!outcome ? <Btn title="Kiểm tra thứ tự" icon={Check} tone="son" loading={busy} onPress={() => onAnswer({ order: order.map((o) => o.id) })} testID="seq-submit" /> : null}
      {truth ? (
        <Inset style={{ gap: 4 }}>
          <Txt f="bold" size={14}>Thứ tự đúng</Txt>
          {truth.map((t, i) => <Txt key={t.id} size={14}>{i + 1}. {t.text}{t.when ? ` (${t.when})` : ''}</Txt>)}
        </Inset>
      ) : null}
    </View>
  );
};

/** Một thẻ của trò lật thẻ ghép cặp: lúc đầu úp, tự lật ngửa lần lượt (bỏ hoạt ảnh khi người dùng chọn giảm chuyển động) rồi mới chọn được */
const PairCard: React.FC<{ text: string; state: 'idle' | 'picked' | 'matched' | 'wrong'; onPress: () => void; disabled: boolean; testID: string; delay: number }> = ({ text, state, onPress, disabled, testID, delay }) => {
  const { c } = useTheme();
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
        <View style={{ minHeight: 54, borderRadius: 8, backgroundColor: c.logoInk, alignItems: 'center', justifyContent: 'center' }}><Txt f="bold" size={20} color={c.logoGold}>?</Txt></View>
      </Animated.View>
    );
  }
  const t = state === 'matched' ? { line: c.moc, bg: c.mocNhat } : state === 'wrong' ? { line: c.son, bg: c.sonNhat } : state === 'picked' ? { line: c.son, bg: c.adminTint } : { line: c.adminLine, bg: c.the };
  return (
    <Animated.View style={shake}>
      <Animated.View style={{ transform: [{ scaleX: turn }] }}>
        <Pressable onPress={() => { play('tap'); onPress(); }} disabled={disabled || state === 'matched'} testID={testID} accessibilityRole="button" accessibilityState={{ disabled: disabled || state === 'matched', selected: state === 'picked' }}
          accessibilityLabel={`${text}${state === 'matched' ? ' (đã ghép đúng)' : state === 'picked' ? ' (đang chọn)' : ''}`}
          style={({ pressed }) => ({ minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: state === 'idle' ? 1 : 2, borderColor: t.line, backgroundColor: pressed && state === 'idle' ? c.adminCanvas : t.bg })}>
          <Txt f="semibold" size={14} style={{ flex: 1 }}>{text}</Txt>
          {state === 'matched' ? <Check size={18} color={c.moc} strokeWidth={2.6} /> : null}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
};

const PairsBody: React.FC<BodyProps> = ({ item, outcome, step, busy, onAnswer }) => {
  const { c } = useTheme();
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
    const t = setTimeout(() => { setWrong(null); setLeft(null); setRight(null); sent.current = null; }, 750);
    return () => clearTimeout(t);
  }, [step, outcome]);
  const stateOf = (token: string, matched: boolean): 'idle' | 'picked' | 'matched' | 'wrong' => (matched ? 'matched' : wrong?.includes(token) ? 'wrong' : token === left || token === right ? 'picked' : 'idle');
  const column = (side: 'left' | 'right', label: string): React.ReactElement => (
    <View style={{ flex: 1, gap: 8 }}>
      <Txt f="bold" size={12} color={c.muc3} center upper>{label}</Txt>
      {cards.filter((x) => x.side === side).map((x, i) => (
        <PairCard key={x.token} text={x.text} state={stateOf(x.token, x.matched)} disabled={busy || Boolean(wrong) || Boolean(outcome)} testID={`pair-${x.token}`} delay={250 + (i * 2 + (side === 'left' ? 0 : 1)) * 110}
          onPress={() => { if (side === 'left') setLeft((v) => (v === x.token ? null : x.token)); else setRight((v) => (v === x.token ? null : x.token)); }} />
      ))}
    </View>
  );
  const misses = item.kind === 'pairs' ? item.misses : 0;
  return (
    <View style={{ gap: 10 }}>
      <Txt size={14} color={c.muc2}>Các thẻ lật ngửa lần lượt. Chọn một thẻ ở mỗi cột để ghép thành cặp đúng; ghép sai quá 2 lần sẽ bị trừ điểm.</Txt>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {column('left', item.kind === 'pairs' ? item.left_label : '')}
        {column('right', item.kind === 'pairs' ? item.right_label : '')}
      </View>
      <Txt f="semibold" size={13} color={c.muc2}>Đã ghép {cards.filter((x) => x.matched).length / 2}/{item.kind === 'pairs' ? item.pairs_total : 0} cặp · ghép sai {misses} lần</Txt>
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
  const { c } = useTheme();
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
  const markOf = (id: string): OptionMark => (outcome ? (id === correct ? 'right' : id === chosen ? 'wrong' : 'dim') : id === picked ? 'picked' : 'idle');
  const fill = (m: OptionMark): string => (m === 'right' ? c.moc : m === 'wrong' || m === 'picked' ? c.son : m === 'dim' ? c.muc3 : c.logoInk);
  return (
    <View style={{ gap: 10 }}>
      <View onLayout={(e) => setBoxW(e.nativeEvent.layout.width)} style={{ alignItems: 'center' }}>
        {boxW > 0 ? (
          <View style={{ width: w, height: h, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: c.adminLine }}>
            <Image source={mapSource(map)} style={{ width: w, height: h }} resizeMode="stretch" accessibilityLabel="Bản đồ của cuộc kháng chiến, có các điểm đánh chữ để chọn" />
            {spots.map((p) => {
              const m = markOf(p.id);
              return (
                <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Điểm ${p.letter}${labels.get(p.id) ? `: ${labels.get(p.id)}` : ''}`} disabled={Boolean(outcome) || busy} onPress={() => pick(p.id)} testID={`spot-${p.letter}`} hitSlop={6}
                  style={{ position: 'absolute', left: p.x * w - 20, top: p.y * h - 20, width: 40, height: 40, borderRadius: 20, backgroundColor: fill(m), borderWidth: 2, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
                  <Txt f="bold" size={16} color="#ffffff">{p.letter}</Txt>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {spots.map((p) => (
          <OptionButton key={p.id} badge={p.letter} text={labels.get(p.id) ?? `Điểm ${p.letter}`} mark={markOf(p.id)} disabled={Boolean(outcome) || busy} onPress={() => pick(p.id)} testID={`spot-btn-${p.letter}`}
            label={`Chọn điểm ${p.letter}${labels.get(p.id) ? `: ${labels.get(p.id)}` : ''}`} style={{ flexGrow: 1, flexBasis: 150 }} />
        ))}
      </View>
      <Txt size={12} color={c.muc3} center>Bấm vào điểm trên bản đồ hoặc vào ô chữ bên dưới.</Txt>
    </View>
  );
};

/** Thân của một câu luyện tập theo đúng mẫu minigame của nó */
export const ItemBody: React.FC<BodyProps> = (p) =>
  p.item.kind === 'sequence' ? <SequenceBody {...p} /> : p.item.kind === 'pairs' ? <PairsBody {...p} /> : p.item.kind === 'locate' ? <LocateBody {...p} /> : <ChoiceBody {...p} />;

/** Phản hồi sau khi trả lời: đúng / sai, giải thích, mục tiêu kiến thức và nguồn (máy chủ chỉ gửi sau khi đã chấm) */
export const Feedback: React.FC<{ outcome: AnswerOutcome; kind: PracticeItem['kind']; onNext: () => void; nextLabel: string }> = ({ outcome, kind, onNext, nextLabel }) => {
  const { c } = useTheme();
  const half = outcome.score > 0 && outcome.score < 1;
  const [line, ink, title] = outcome.timeout ? [c.son, c.sonChu, 'Hết giờ!'] : outcome.score >= 1 ? [c.moc, c.mocChu, kind === 'tactic' ? 'Quyết định tốt nhất!' : 'Chính xác!']
    : half ? [c.tho, c.vangChu, kind === 'pairs' ? 'Ghép xong, nhưng sai hơi nhiều' : 'Tạm được, còn cách tốt hơn'] : [c.son, c.sonChu, kind === 'pairs' ? 'Ghép xong, nhưng sai quá nhiều lần' : 'Chưa đúng'];
  const feedback = outcome.detail.feedback as string | null | undefined, best = outcome.detail.best_feedback as string | undefined;
  const pairs = outcome.detail.pairs as Array<{ id: string; left: string; right: string }> | undefined;
  useKeys((k) => { if (k === 'Enter') onNext(); });
  return (
    <View accessibilityLiveRegion="polite" testID="item-feedback">
      <Card flat pad={14} style={{ borderRadius: 12, gap: 8, borderLeftWidth: 4, borderLeftColor: line }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {outcome.score >= 1 ? <Check size={20} color={line} strokeWidth={2.6} /> : <Lightbulb size={20} color={line} />}
          <Txt f="bold" size={17} color={ink} style={{ flex: 1 }}>{title}</Txt>
          {outcome.xp ? <Chip text={`+${outcome.xp} điểm`} icon={Sparkles} bg={c.thongNhat} fg={c.thongChu} /> : null}
        </View>
        {feedback ? <Txt size={15}>{feedback}</Txt> : null}
        {best && outcome.score < 1 ? <Txt size={15}>Phương án tốt nhất: {best}</Txt> : null}
        {pairs && outcome.score < 1 ? <Txt size={14}>Các cặp đúng: {pairs.map((p) => `${p.left} – ${p.right}`).join('; ')}.</Txt> : null}
        {outcome.explanation ? <Txt size={15}>{outcome.explanation}</Txt> : null}
        {outcome.objective_text ? <Txt size={13} color={c.muc2}>Mục tiêu: {outcome.objective_text}{outcome.stage_title ? ` (chặng ${outcome.stage_title})` : ''}</Txt> : null}
        {outcome.source ? <SourceLine source={outcome.source} /> : null}
        <Btn title={nextLabel} iconRight={ChevronRight} tone="son" onPress={onNext} testID="item-next" style={{ alignSelf: 'flex-end' }} />
      </Card>
    </View>
  );
};

// ---------------------------------------------------------------------- lượt luyện tập của chặng
export const PracticeScreen: React.FC<StageProps> = ({ session, nav, stageId, campaignNo }) => {
  const { c } = useTheme();
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
  const doneCount = sess?.items.filter((it) => it.done).length ?? 0;
  return (
    <SagaPage testID="saga-practice" max={900} scrollRef={scroller}>
      <SagaHeader title={sess?.stage ? sess.stage.title : 'Luyện tập'} subtitle={sess ? `Minigame luyện tập · cần đạt ${sess.pass_percent ?? 70}% để mở phần nhập vai` : 'Minigame luyện tập'} back={backToStage(nav, campaignNo, stageId)} />
      {!sess || !item ? <LoadState loading={loading} error={error} onRetry={() => setRound((n) => n + 1)} /> : showResult && finished ? (
        <Card flat pad={20} style={{ borderRadius: 12, alignItems: 'center', gap: 10 }} testID="practice-result">
          <Txt f="displayHeavy" size={26} color={finished.passed ? c.mocChu : c.sonChu} accessibilityRole="header">{finished.passed ? 'Đạt rồi!' : 'Chưa đạt'}</Txt>
          <StarRow n={finished.stars} size={30} />
          <Txt f="displayHeavy" size={40} color={c.logoInk}>{finished.percent}%</Txt>
          <Txt size={14} color={c.muc2} center>Đúng trọn vẹn {finished.right}/{finished.total} câu · ngưỡng đạt {finished.pass_percent}% · tốt nhất của em {finished.best}%</Txt>
          {finished.xp ? <Chip text={`+${finished.xp} điểm kinh nghiệm`} icon={Sparkles} bg={c.thongNhat} fg={c.thongChu} style={{ alignSelf: 'center' }} /> : null}
          {!finished.passed ? <Txt size={14} color={c.muc2} center>Xem lại thẻ kiến thức rồi luyện lại. Các câu em trả lời sai đã được đưa vào mục Câu hỏi ôn tập.</Txt> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 6 }}>
            {finished.passed
              ? <Btn title="Nhập vai khám phá" icon={Footprints} tone="son" onPress={() => nav.go('chien-dich', { c: campaignNo, s: stageId, v: 'kham-pha' }, 'replace')} testID="practice-to-explore" />
              : <Btn title="Xem lại thẻ kiến thức" icon={BookOpen} tone="son" onPress={() => nav.go('chien-dich', { c: campaignNo, s: stageId, v: 'hoc' }, 'replace')} testID="practice-to-lesson" />}
            <Btn title="Luyện lại" icon={RotateCcw} tone="giay" onPress={() => { restart.current = true; setRound((n) => n + 1); }} testID="practice-retry" />
          </View>
        </Card>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Chip text={`Câu ${cursor + 1}/${sess.total}`} bg={c.adminCanvas} fg={c.muc} />
            <Meter value={doneCount / sess.total} label={`Đã làm ${doneCount} trên ${sess.total} câu`} style={{ flex: 1, minWidth: 120 }} />
            <Chip text={item.kind_label} icon={item.kind === 'locate' ? MapIcon : item.kind === 'tactic' ? Swords : Puzzle} bg={c.adminCanvas} fg={c.muc2} />
          </View>
          <Card flat pad={16} style={{ borderRadius: 12 }} testID={`practice-item-${item.kind}`}><Txt f="bold" size={18} color={c.logoInk} accessibilityRole="header">{item.prompt}</Txt></Card>
          <ItemBody session={session} item={item} outcome={outcome} step={step} busy={busy} onAnswer={(a) => { void answer(a); }} />
          <Flash text={flash} />
          {outcome ? <Feedback outcome={outcome} kind={item.kind} onNext={next} nextLabel={finished ? 'Xem kết quả' : 'Câu tiếp'} /> : null}
        </>
      )}
    </SagaPage>
  );
};

// ---------------------------------------------------------------------- tổng kết chặng và phần thưởng
const RewardSheet: React.FC<{ completion: Completion; title: string; onClose: () => void }> = ({ completion, title, onClose }) => {
  const { c } = useTheme();
  const r = completion.rewards;
  useEffect(() => { play('reward'); }, []);
  return (
    <Sheet open persistent onClose={onClose} title="Hoàn thành chặng" subtitle={title} footer={<Btn title="Nhận thưởng" icon={Check} tone="son" full onPress={onClose} testID="reward-claim" />}>
      <View style={{ gap: 14 }} testID="reward-overlay" accessibilityLabel="Phần thưởng hoàn thành chặng">
        <View style={{ alignItems: 'center', gap: 6 }}>
          <StarRow n={completion.stars} size={32} />
          <Txt size={13} color={c.muc2}>Sao kiến thức của chặng</Txt>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {r.xp ? <Chip text={`+${num(r.xp)} điểm kinh nghiệm`} icon={Sparkles} bg={c.thongNhat} fg={c.thongChu} /> : null}
          {r.gold ? <Chip text={`+${num(r.gold)} vàng`} icon={Coins} bg={c.vangNhat} fg={c.vangChu} /> : null}
        </View>
        {r.card ? (
          <Inset style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Portrait code={r.card.portrait} size={96} />
            <View style={{ flex: 1, gap: 4 }}>
              <Txt f="bold" size={12} color={c.muc3} upper>Thẻ nhân vật mới</Txt>
              <Txt f="displayHeavy" size={20} color={c.logoInk}>{r.card.name}</Txt>
              <Txt size={13} color={c.muc2}>{r.card.title}</Txt>
              <Chip text={RARITY[r.card.rarity]?.label ?? ''} bg={RARITY[r.card.rarity]?.soft ?? c.adminCanvas} fg={RARITY[r.card.rarity]?.main ?? c.muc} />
            </View>
          </Inset>
        ) : null}
        {r.badge ? (
          <Inset style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Medal code={r.badge.code ?? ''} size={52} />
            <View style={{ flex: 1 }}><Txt f="bold" size={12} color={c.muc3} upper>Huy hiệu</Txt><Txt f="bold" size={16}>{r.badge.name}</Txt></View>
          </Inset>
        ) : null}
        {r.docs.length ? <InfoNote>Mở trong Kho tư liệu: {r.docs.map((d) => d.title).join(', ')}</InfoNote> : null}
        {completion.campaign_done ? <InfoNote>Em đã đi hết cuộc kháng chiến này!</InfoNote> : null}
      </View>
    </Sheet>
  );
};

export const SummaryScreen: React.FC<StageProps> = ({ session, nav, stageId, campaignNo }) => {
  const { c } = useTheme();
  const data = useLoad<StageSummary>(session, (t) => saga.summary(t, stageId), [stageId]);
  const sum = data.data;
  const reward = nav.reward?.stageId === stageId ? nav.reward.completion : null;
  const stats = useMemo(() => (sum ? [
    { label: 'Hiểu kiến thức', value: `${sum.result.knowledge_percent}%`, hint: `${sum.result.practice_tries} lượt luyện`, icon: BookOpen, color: c.mocChu, bg: c.mocNhat },
    { label: 'Nhập vai: gợi ý / sai', value: `${sum.result.explore_hints} / ${sum.result.explore_mistakes}`, hint: 'lần', icon: Footprints, color: c.thuyChu, bg: c.thuyNhat },
    ...(sum.result.battle ? [{ label: 'Trận đánh', value: num(sum.result.battle.score), hint: `điểm · ${sum.result.battle.stars} sao`, icon: Swords, color: c.sonChu, bg: c.sonNhat }] : []),
  ] : []), [sum, c]);
  return (
    <SagaPage testID="saga-summary" max={900}>
      <SagaHeader title={sum ? sum.stage.title : 'Tổng kết chặng'} subtitle={sum ? `Tổng kết chặng · ${sum.stage.place} · ${sum.stage.date_label}` : 'Tổng kết chặng'}
        back={{ label: 'Bản đồ chiến dịch', hint: 'Về bản đồ chiến dịch', onPress: () => nav.back('chien-dich', { c: campaignNo, s: null, v: null }) }} />
      {!sum ? <LoadState loading={data.loading} error={data.error} onRetry={data.reload} /> : (
        <>
          <Card flat pad={14} style={{ borderRadius: 12, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <StarRow n={sum.result.stars} size={26} />
              <Txt size={13} color={c.muc2} style={{ flex: 1, minWidth: 200 }}>Sao kiến thức tính theo phần luyện tập, tách riêng với điểm trận đánh.</Txt>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {stats.map((st) => <Metric key={st.label} compact label={st.label} value={st.value} hint={st.hint} icon={st.icon} color={st.color} background={st.bg} />)}
            </View>
          </Card>

          <Card flat pad={16} style={{ borderRadius: 12, gap: 10 }} testID="summary-debrief">
            <BlockTitle title={sum.debrief.title} icon={ScrollText} />
            {sum.debrief.paragraphs.map((p, i) => <Txt key={i} f="serif" size={17} style={{ lineHeight: 28 }}>{p}</Txt>)}
            <Txt f="bold" size={12} color={c.muc3} upper>Nguồn tham khảo</Txt>
            {sum.debrief.sources.map((src) => <SourceLine key={src.key} source={src} />)}
          </Card>

          <InfoNote>Phần sáng tạo trong trò chơi: {sum.debrief.fiction}</InfoNote>

          {sum.weak_objectives.length ? (
            <Card flat pad={14} style={{ borderRadius: 12, gap: 8 }}>
              <BlockTitle title="Nên ôn lại" icon={Target} />
              {sum.weak_objectives.map((w) => (
                <View key={w.objective} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Txt size={14} style={{ flex: 1 }}>{w.text}</Txt><Txt f="bold" size={13} color={c.hoaChu}>{w.percent}% đúng</Txt>
                </View>
              ))}
              <Btn title="Ôn câu hỏi" icon={RotateCcw} tone="giay" size="sm" onPress={() => nav.go('cau-hoi', { c: null, s: null, v: null })} testID="summary-review" />
            </Card>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {sum.next ? <Btn title={`Chặng tiếp theo: ${sum.next.title}`} icon={Play} tone="son" onPress={() => nav.go('chien-dich', { c: sum.next!.campaign_no, s: sum.next!.id, v: null }, 'replace')} testID="summary-next" /> : null}
            <Btn title="Về bản đồ" icon={MapIcon} tone="giay" onPress={() => nav.go('chien-dich', { c: campaignNo, s: null, v: null }, 'replace')} testID="summary-map" />
          </View>
        </>
      )}
      {reward && sum ? <RewardSheet completion={reward} title={sum.stage.title} onClose={() => { nav.setReward(null); nav.refresh(); }} /> : null}
    </SagaPage>
  );
};
