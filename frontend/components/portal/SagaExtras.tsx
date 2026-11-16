/**
 * Hành trình Đông A – ba mục ngoài bản đồ:
 *   - "Câu hỏi": ôn tập tính giờ (đồng hồ do máy chủ giữ và chỉ chạy khi câu được mở), ưu tiên câu từng sai và mục tiêu còn yếu, có chuỗi đúng và thanh cấp độ.
 *   - "Bộ thẻ": thẻ nhân vật đã mở, huy chương và bảng xếp hạng tuần của lớp.
 *   - "Tư liệu": kho tư liệu gồm văn bản gốc (mở dần theo chặng), nhân vật, niên biểu và bản đồ, đều ghi nguồn.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BookOpen, Check, Clock, Flame, Lock, Map as MapIcon, Play, RotateCcw, ScrollText, Sparkles, Star, Target, Trophy, Users } from 'lucide-react-native';
import * as game from '@/api/gameApi';
import * as saga from '@/lib/saga-api';
import { errorMessage } from '@/api/client';
import type { Session } from '@/components/auth';
import {
  Confetti, Flash, GameBtn, LoadState, Medal, Meter, Overlay, Panel, Pill, Portrait, RARITY, SG, ScreenHead, SourceLine, Sunburst, TONE, TieuTuongArt, mapSource, num, useFlash, useLoad, useSaga, type SagaNav,
} from '@/components/portal/SagaKit';
import { Feedback, ItemBody } from '@/components/portal/SagaLearn';
import { Txt } from '@/components/ui';
import { play } from '@/lib/saga-sound';
import type { IconType } from '@/types/game';
import type { BadgeItem, Board } from '@/types/gamification';
import type { AnswerOutcome, Archive, ArchiveText, CardAlbum, PracticeSession, ReviewFinished, ReviewInfo, SagaCard } from '@/types/saga';

const statusOf = (e: unknown): number | undefined => (e as { status?: number }).status;
const QUIZ_BG = ['#7c52e6', '#5632c0'] as const;

// ---------------------------------------------------------------------- "Câu hỏi": ôn tập tính giờ
const ReviewQuiz: React.FC<{ session: Session; nav: SagaNav; initial: PracticeSession; onExit: () => void }> = ({ session, nav, initial, onExit }) => {
  const [sess, setSess] = useState(initial);
  const [cursor, setCursor] = useState(Math.min(initial.index, initial.total - 1));
  const [outcome, setOutcome] = useState<AnswerOutcome | null>(null);
  const [finished, setFinished] = useState<ReviewFinished | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gained, setGained] = useState(0);
  const [left, setLeft] = useState<number | null>(null);
  const [flash, setFlash] = useFlash();
  const deadline = useRef<number | null>(null);
  const scroller = useRef<ScrollViewInstance | null>(null);
  useEffect(() => {
    if (!outcome) return undefined;
    const t = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(t);
  }, [outcome]);
  const live = useRef({ sess, busy, outcome, session, nav });
  live.current = { sess, busy, outcome, session, nav };
  const item = sess.items[cursor];
  const level = nav.home?.hud.level ?? null;

  const act = async (action: Record<string, unknown>, timedOut = false): Promise<void> => {
    const cur = live.current;
    if (cur.busy) return;
    setBusy(true); live.current.busy = true;
    try {
      const res = await saga.act<PracticeSession, AnswerOutcome & { ready?: boolean }, ReviewFinished>(cur.session.token, cur.sess.session_id, cur.sess.seq, action);
      setSess(res.view);
      if (res.outcome.ready) return;
      deadline.current = null; setLeft(null);
      setOutcome({ ...res.outcome, timeout: res.outcome.timeout || timedOut });
      play(res.outcome.correct ? 'right' : 'wrong');
      if (res.outcome.xp) {
        setGained((g) => g + (res.outcome.xp ?? 0));
        const lv = cur.nav.home?.hud.level;
        // vừa đủ điểm lên cấp: tải lại ngay để hiện màn "Lên cấp"
        if (lv && lv.next_xp !== null && lv.xp + gained + res.outcome.xp >= lv.next_xp) cur.nav.refresh();
      }
      if (res.finished) setFinished(res.finished);
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
    const t = setInterval(() => {
      if (deadline.current === null || live.current.outcome) return;
      const ms = deadline.current - Date.now();
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
      if (ms <= 0 && !live.current.busy) { deadline.current = null; void act({ type: 'answer', item_id: live.current.sess.items.find((it) => !it.done)?.id, answer: {} }, true); }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const next = (): void => {
    setOutcome(null);
    if (finished) { setShowResult(true); play('win'); return; }
    const i = sess.items.findIndex((it) => !it.done);
    setCursor(i < 0 ? sess.total - 1 : i);
  };
  const streak = outcome?.streak ?? sess.streak ?? 0;
  const xpNow = level ? level.xp + gained : gained;
  return (
    <View style={{ flex: 1 }} testID="saga-review-quiz">
      <LinearGradient colors={[QUIZ_BG[0], QUIZ_BG[1]]} style={StyleSheet.absoluteFill} />
      <ScrollView ref={scroller} contentContainerStyle={{ padding: 16, paddingBottom: 40, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 820, gap: 14 }}>
          {showResult && finished ? (
            <Panel style={{ alignItems: 'center', gap: 10, overflow: 'hidden' }} testID="review-result">
              <Confetti />
              <TieuTuongArt size={96} cheer />
              <Txt f="heavy" size={26} color="#5632c0" center accessibilityRole="header">Xong lượt ôn!</Txt>
              <Txt f="heavy" size={40} color="#1e2a4a">{finished.right}/{finished.total}</Txt>
              <Txt f="semibold" size={15} color="#4a5672" center>Đúng {finished.percent}% · chuỗi đúng dài nhất {finished.best_streak} câu</Txt>
              {gained ? <Pill text={`+${gained} điểm kinh nghiệm`} icon={Sparkles} bg={SG.purple} style={{ alignSelf: 'center' }} /> : null}
              <Txt size={14} color="#4a5672" center>Câu trả lời đúng đã ra khỏi danh sách cần ôn; câu còn sai sẽ được hỏi lại ở lượt sau.</Txt>
              <GameBtn title="Xong" icon={Check} tone="green" size="lg" onPress={onExit} testID="review-done" style={{ alignSelf: 'center' }} />
            </Panel>
          ) : item ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <Pill text={`Câu ${cursor + 1}/${sess.total}`} bg="rgba(255,255,255,0.22)" size={14} />
                <View accessible accessibilityRole="timer" accessibilityLabel={left === null ? 'Đồng hồ đang dừng' : `Còn ${left} giây`} testID="review-timer"
                  style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: '#ffffff', borderWidth: 5, borderColor: left !== null && left <= 5 ? SG.red : SG.yellow, alignItems: 'center', justifyContent: 'center' }}>
                  {left === null ? <Clock size={22} color="#5632c0" strokeWidth={2.6} /> : <Txt f="heavy" size={22} color={left <= 5 ? SG.red : '#5632c0'}>{left}</Txt>}
                </View>
                <Pill text={`Chuỗi đúng: ${streak}`} icon={Flame} bg="rgba(255,255,255,0.22)" size={14} style={{ alignSelf: 'center' }} />
              </View>
              <View style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 18, gap: 6 }} testID={`review-item-${item.kind}`}>
                <Txt f="bold" size={12} color="#6b56b8">{item.kind_label.toUpperCase()}{item.stage_title ? ` · ${item.stage_title}` : ''}</Txt>
                <Txt f="heavy" size={20} color="#1e2a4a" center accessibilityRole="header">{item.prompt}</Txt>
              </View>
              <ItemBody session={session} item={item} outcome={outcome} step={null} busy={busy} onAnswer={(a) => { void act({ type: 'answer', item_id: item.id, answer: a }); }} skin="quiz" />
              <Flash text={flash} />
              {outcome ? <Feedback outcome={outcome} kind={item.kind} onNext={next} nextLabel={finished ? 'Xem kết quả' : 'Câu tiếp'} skin="quiz" /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: SG.yellow, borderWidth: 3, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '45deg' }] }}>
                  <View style={{ transform: [{ rotate: '-45deg' }] }}><Txt f="heavy" size={17} color={SG.onYellow}>{level?.level ?? 1}</Txt></View>
                </View>
                <Meter value={level && level.next_xp !== null ? (xpNow - level.floor) / Math.max(1, level.next_xp - level.floor) : 1} fill={SG.yellow} track="rgba(255,255,255,0.25)" label="Tiến độ lên cấp" style={{ flex: 1 }} />
                <Txt f="heavy" size={13} color="#ffffff">{num(xpNow)}{level?.next_xp ? `/${num(level.next_xp)}` : ''} điểm</Txt>
              </View>
              <GameBtn title="Dừng lượt ôn" tone="white" size="sm" onPress={onExit} testID="review-exit" label="Dừng lượt ôn, có thể tiếp tục sau" style={{ alignSelf: 'center' }} />
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
};

export const ReviewScreen: React.FC<{ session: Session; nav: SagaNav }> = ({ session, nav }) => {
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
  if (quiz) return <ReviewQuiz session={session} nav={nav} initial={quiz} onExit={() => { setQuiz(null); setRound((n) => n + 1); nav.refresh(); }} />;
  const d = info.data;
  return (
    <View style={{ flex: 1 }} testID="saga-review">
      <LinearGradient colors={[QUIZ_BG[0], QUIZ_BG[1]]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 820, gap: 14 }}>
          <ScreenHead title="Câu hỏi ôn tập" subtitle="Mỗi câu có đồng hồ. Câu em từng trả lời sai được hỏi lại trước." light />
          {!d ? <LoadState loading={info.loading} error={info.error} onRetry={info.reload} light /> : (
            <>
              <Panel style={{ gap: 10, alignItems: 'center' }}>
                <TieuTuongArt size={84} cheer={d.can_start} />
                {d.can_start ? (
                  <>
                    <Txt f="heavy" size={20} color="#1e2a4a" center>{d.due.length ? `${d.due.length} câu đang chờ em ôn lại` : 'Giữ phong độ bằng một lượt ôn nhanh'}</Txt>
                    <Txt size={14} color="#4a5672" center>Một lượt gồm {d.size} câu lấy từ các chặng em đã luyện. Trả lời đúng được +5 điểm (mỗi câu một lần trong ngày).</Txt>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                      <GameBtn title={d.active_session_id ? 'Tiếp tục lượt đang dở' : `Bắt đầu ôn ${d.size} câu`} icon={Play} tone="yellow" size="lg" loading={busy} onPress={() => { void start(false); }} testID="review-start" />
                      {d.active_session_id ? <GameBtn title="Lượt mới" icon={RotateCcw} tone="white" size="lg" disabled={busy} onPress={() => { void start(true); }} testID="review-restart" /> : null}
                    </View>
                  </>
                ) : (
                  <>
                    <Txt f="heavy" size={20} color="#1e2a4a" center>Chưa có câu nào để ôn</Txt>
                    <Txt size={14} color="#4a5672" center>Hãy học và luyện tập ít nhất một chặng trên bản đồ; các câu hỏi của chặng đó sẽ xuất hiện ở đây.</Txt>
                    <GameBtn title="Mở bản đồ chiến dịch" icon={MapIcon} tone="green" size="lg" onPress={() => nav.go('chien-dich', { c: null, s: null, v: null })} testID="review-to-map" style={{ alignSelf: 'center' }} />
                  </>
                )}
                <Flash text={flash} />
              </Panel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {[{ label: 'Câu đã trả lời', value: num(d.stats.answers) }, { label: 'Tỉ lệ đúng', value: `${d.stats.percent}%` }, { label: 'Cần ôn', value: String(d.due.length) }].map((st) => (
                  <View key={st.label} style={{ flexGrow: 1, flexBasis: 150, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 16, padding: 12, alignItems: 'center' }}>
                    <Txt f="bold" size={13} color="rgba(255,255,255,0.86)">{st.label}</Txt>
                    <Txt f="heavy" size={26} color="#ffffff">{st.value}</Txt>
                  </View>
                ))}
              </View>
              {d.weak_objectives.length ? (
                <Panel style={{ gap: 8 }} testID="review-weak">
                  <Txt f="heavy" size={16} color="#1e2a4a" accessibilityRole="header">Mục tiêu còn yếu</Txt>
                  {d.weak_objectives.map((w) => (
                    <View key={`${w.stage_id}${w.objective}`} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <Target size={16} color={SG.red} strokeWidth={2.6} />
                      <View style={{ flex: 1 }}><Txt size={14} color="#1e2a4a">{w.text}</Txt><Txt size={12} color="#4a5672">Chặng {w.stage_title} · {w.answers} lượt trả lời</Txt></View>
                      <Txt f="heavy" size={14} color={SG.orangeEdge}>{w.percent}%</Txt>
                    </View>
                  ))}
                </Panel>
              ) : null}
              {d.due.length ? (
                <Panel style={{ gap: 8 }} testID="review-due">
                  <Txt f="heavy" size={16} color="#1e2a4a" accessibilityRole="header">Câu từng trả lời sai</Txt>
                  {d.due.slice(0, 8).map((q) => (
                    <View key={q.item_id} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <RotateCcw size={15} color={SG.purpleEdge} strokeWidth={2.6} />
                      <View style={{ flex: 1 }}><Txt size={14} color="#1e2a4a" numberOfLines={2}>{q.prompt}</Txt><Txt size={12} color="#4a5672">{q.kind_label} · chặng {q.stage_title}</Txt></View>
                      <Txt f="bold" size={12} color="#4a5672">sai {q.wrong_count} lần</Txt>
                    </View>
                  ))}
                  {d.due.length > 8 ? <Txt size={12} color="#4a5672">… và {d.due.length - 8} câu khác.</Txt> : null}
                </Panel>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

// ---------------------------------------------------------------------- "Bộ thẻ": thẻ nhân vật, huy chương, bảng xếp hạng tuần
const HeroCard: React.FC<{ card: SagaCard; w: number; onPress?: () => void; tilt?: number; glow?: boolean; testID?: string }> = ({ card, w, onPress, tilt = 0, glow, testID }) => {
  const r = RARITY[card.rarity] ?? RARITY.common;
  return (
    <Pressable accessibilityRole="button" disabled={!onPress} onPress={onPress} testID={testID}
      accessibilityLabel={card.owned ? `Thẻ ${card.name}, ${card.title}, độ hiếm ${r.label.toLowerCase()}` : `Thẻ ${card.name} chưa mở${card.stage_title ? `: hoàn thành chặng ${card.stage_title}` : ''}`}
      style={({ pressed }) => ({ width: w, minHeight: 44, borderRadius: w * 0.1, backgroundColor: card.owned ? r.main : '#4b2a33', borderWidth: 3, borderColor: glow ? SG.yellow : card.owned ? '#ffffff' : '#7a5560', borderBottomWidth: 6,
        alignItems: 'center', padding: w * 0.06, gap: 2, transform: [{ rotate: `${tilt}deg` }, { scale: pressed ? 0.96 : 1 }] })}>
      <Portrait code={card.portrait} size={w * 0.84} locked={!card.owned} />
      <Txt f="heavy" size={Math.max(11, Math.round(w * 0.1))} color="#ffffff" center numberOfLines={2}>{card.name.toUpperCase()}</Txt>
      <Txt f="bold" size={Math.max(9, Math.round(w * 0.075))} color={card.owned ? '#ffffff' : '#d9b9c0'} center numberOfLines={1}>{card.owned ? r.label : 'CHƯA MỞ'}</Txt>
      {card.owned ? <View style={{ flexDirection: 'row' }}>{Array.from({ length: r.stars }, (_, i) => <Star key={i} size={Math.max(8, w * 0.08)} color="#ffe27a" fill="#ffe27a" />)}</View> : <Lock size={Math.max(10, w * 0.1)} color="#d9b9c0" strokeWidth={2.6} />}
    </Pressable>
  );
};

const CardDetail: React.FC<{ card: SagaCard; onClose: () => void; onStage: () => void }> = ({ card, onClose, onStage }) => {
  const s = useSaga();
  return (
    <Overlay label={`Thẻ nhân vật ${card.name}`} onClose={onClose} testID="card-detail" maxWidth={560}>
      <Panel style={{ gap: 10 }}>
        <ScrollView contentContainerStyle={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <HeroCard card={card} w={132} />
            <View style={{ flex: 1, gap: 4 }}>
              <Txt f="heavy" size={22} color={s.ink} accessibilityRole="header">{card.name}</Txt>
              <Txt f="bold" size={15} color={s.sub}>{card.title}{card.years ? ` · ${card.years}` : ''}</Txt>
              {card.stage_title ? <Txt size={13} color={s.sub}>{card.owned ? 'Mở ở chặng' : 'Hoàn thành chặng'} “{card.stage_title}”{card.owned ? '' : ' để mở thẻ'}</Txt> : null}
            </View>
          </View>
          {card.owned ? (
            <>
              {card.intro ? <Txt size={15} color={s.ink}>{card.intro}</Txt> : null}
              {card.role_text ? <View style={{ backgroundColor: s.card2, borderRadius: 14, padding: 12 }}><Txt f="heavy" size={13} color={s.sub}>TRONG CUỘC KHÁNG CHIẾN</Txt><Txt size={15} color={s.ink}>{card.role_text}</Txt></View> : null}
              {card.quote ? <View style={{ borderLeftWidth: 4, borderLeftColor: SG.red, paddingLeft: 12 }}><Txt f="serifItalic" size={19} color={s.ink}>“{card.quote.replace(/ \/ /g, '\n')}”</Txt>{card.quote_source ? <Txt size={13} color={s.sub}>{card.quote_source}</Txt> : null}</View> : null}
              {card.source ? <SourceLine source={{ title: card.source, publisher: 'Tranh chân dung trên thẻ là hình minh họa cách điệu, không phải chân dung lịch sử', url: card.source_url ?? null, note: null }} /> : null}
            </>
          ) : (
            <Txt size={15} color={s.ink}>Thẻ này còn khóa. Phần giới thiệu nhân vật sẽ mở cùng thẻ khi em hoàn thành chặng.</Txt>
          )}
          <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {card.stage_id ? <GameBtn title="Tới chặng" icon={MapIcon} tone="white" onPress={onStage} testID="card-stage" /> : null}
            <GameBtn title="Đóng" tone="green" onPress={onClose} testID="card-close" />
          </View>
        </ScrollView>
      </Panel>
    </Overlay>
  );
};

const RANK_TONE = ['#ffcf3f', '#cfd6e2', '#f0a56a'];
const AVATAR_TONE = [SG.blue, SG.green, SG.orange, SG.purple, SG.red];
const initials = (name: string): string => name.split(/\s+/).filter(Boolean).slice(-2).map((p) => p[0]?.toUpperCase() ?? '').join('');

export const CollectionScreen: React.FC<{ session: Session; nav: SagaNav }> = ({ session, nav }) => {
  const { width } = useWindowDimensions();
  const album = useLoad<CardAlbum>(session, saga.cards, []);
  const badges = useLoad<BadgeItem[]>(session, (t) => game.gameBadges(t).catch((e) => { if (statusOf(e) === 401) throw e; return []; }), []);
  const board = useLoad<Board | { message: string }>(session, async (t) => {
    try { return await game.leaderboard(t, { scope: 'class', period: 'week' }); } catch (e) {
      if (statusOf(e) === 401) throw e;
      try { return await game.leaderboard(t, { scope: 'school', period: 'week' }); } catch (e2) { if (statusOf(e2) === 401) throw e2; return { message: errorMessage(e) }; }
    }
  }, []);
  const [open, setOpen] = useState<SagaCard | null>(null);
  const wide = width >= 900;
  const cards = album.data?.cards ?? [];
  const latest = cards.find((c) => c.code === album.data?.latest_code) ?? null;
  const fan = useMemo(() => {
    const owned = cards.filter((c) => c.owned && c.code !== latest?.code);
    const side = [...owned, ...cards.filter((c) => !c.owned)].slice(0, 2);
    return { center: latest ?? cards[0] ?? null, left: side[0] ?? null, right: side[1] ?? null };
  }, [cards, latest]);
  const medals = useMemo(() => {
    const list = badges.data ?? [];
    return [...list.filter((b) => b.code.startsWith('saga-')), ...list.filter((b) => !b.code.startsWith('saga-') && b.earned)].slice(0, 8);
  }, [badges.data]);
  const b = board.data;
  const small = Math.min(104, Math.max(84, (Math.min(width, 620) - 32 - 30) / 4));
  return (
    <View style={{ flex: 1 }} testID="saga-collection">
      <Sunburst color="#7d1826" ray="#8f1f2e" size={2200} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 104, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 1100, gap: 16, flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'flex-start' : 'stretch' }}>
          <View style={{ flex: wide ? 1.5 : undefined, gap: 14 }}>
            <View>
              <Txt f="heavy" size={24} color={SG.yellow} accessibilityRole="header">{latest ? 'THẺ NHÂN VẬT MỚI!' : 'BỘ THẺ NHÂN VẬT'}</Txt>
              <Txt f="semibold" size={14} color="#ffd9d9">{album.data ? `Đã mở ${album.data.owned}/${album.data.total} thẻ. Hoàn thành một chặng để mở thẻ của chặng đó.` : 'Đang tải bộ thẻ…'}</Txt>
            </View>
            {!album.data ? <LoadState loading={album.loading} error={album.error} onRetry={album.reload} light /> : (
              <>
                {fan.center ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', height: 250 }}>
                    {fan.left ? <View style={{ marginRight: -26, marginBottom: 6 }}><HeroCard card={fan.left} w={118} tilt={-9} onPress={() => setOpen(fan.left)} /></View> : null}
                    <View style={{ zIndex: 2 }}><HeroCard card={fan.center} w={150} glow onPress={() => setOpen(fan.center)} testID="card-latest" /></View>
                    {fan.right ? <View style={{ marginLeft: -26, marginBottom: 6 }}><HeroCard card={fan.right} w={118} tilt={9} onPress={() => setOpen(fan.right)} /></View> : null}
                  </View>
                ) : null}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                  {cards.map((c) => <HeroCard key={c.code} card={c} w={small} onPress={() => setOpen(c)} testID={`card-${c.code}`} />)}
                </View>
              </>
            )}
            <View style={{ gap: 8 }}>
              <Txt f="heavy" size={16} color="#ffffff" accessibilityRole="header">Huy chương</Txt>
              {medals.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                  {medals.map((m) => (
                    <View key={m.id} accessible accessibilityLabel={`Huy chương ${m.name}: ${m.earned ? 'đã đạt' : 'chưa đạt'}. ${m.description ?? ''}`} style={{ alignItems: 'center', width: 84 }}>
                      <Medal code={m.code} size={56} earned={m.earned} />
                      <Txt f="bold" size={12} color={m.earned ? '#ffffff' : '#d9b9c0'} center numberOfLines={2}>{m.name}</Txt>
                    </View>
                  ))}
                </View>
              ) : <Txt size={14} color="#ffd9d9">{badges.loading ? 'Đang tải huy chương…' : 'Chưa có huy chương nào.'}</Txt>}
            </View>
          </View>

          <Panel style={{ flex: wide ? 1 : undefined, gap: 10 }} testID="saga-board">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Trophy size={22} color={SG.yellowEdge} strokeWidth={2.6} />
              <View style={{ flex: 1 }}>
                <Txt f="heavy" size={17} color="#1e2a4a" accessibilityRole="header">BẢNG XẾP HẠNG TUẦN</Txt>
                <Txt f="semibold" size={13} color="#4a5672">{b && 'label' in b ? b.label : 'Lớp của em'}</Txt>
              </View>
            </View>
            {!b ? <LoadState loading={board.loading} error={board.error} onRetry={board.reload} /> : 'message' in b && !('entries' in b) ? (
              <Txt size={14} color="#4a5672">{b.message}</Txt>
            ) : 'entries' in b ? (
              b.disabled ? <Txt size={14} color="#4a5672">{b.message ?? 'Bảng xếp hạng đang tắt.'}</Txt> : b.entries.length ? b.entries.map((e, i) => (
                <View key={`${e.rank}${e.name}${i}`} accessible accessibilityLabel={`Hạng ${e.rank}: ${e.name}, ${e.xp} điểm${e.me ? ' (em)' : ''}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 14, borderWidth: 2, borderColor: e.me ? SG.red : '#e6ecf7', backgroundColor: e.me ? '#fff3c9' : '#ffffff' }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: RANK_TONE[e.rank - 1] ?? '#eef2fa', alignItems: 'center', justifyContent: 'center' }}><Txt f="heavy" size={13} color="#1e2a4a">{e.rank}</Txt></View>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: AVATAR_TONE[i % AVATAR_TONE.length], alignItems: 'center', justifyContent: 'center' }}><Txt f="heavy" size={13} color="#ffffff">{initials(e.me ? session.user.full_name : e.name)}</Txt></View>
                  <Txt f={e.me ? 'heavy' : 'bold'} size={15} color="#1e2a4a" style={{ flex: 1 }} numberOfLines={1}>{e.me ? 'Em' : e.name}</Txt>
                  <Txt f="heavy" size={15} color={e.me ? SG.redEdge : '#4a5672'}>{num(e.xp)}</Txt>
                </View>
              )) : <Txt size={14} color="#4a5672">Tuần này chưa ai ghi điểm. Em hãy là người mở đầu!</Txt>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><Users size={14} color="#4a5672" /><Txt size={12} color="#4a5672" style={{ flex: 1 }}>Điểm tính theo kinh nghiệm kiếm được từ thứ Hai. Mỗi phần thưởng chỉ tính một lần.</Txt></View>
          </Panel>
        </View>
      </ScrollView>
      {open ? <CardDetail card={open} onClose={() => setOpen(null)} onStage={() => { const c = open; setOpen(null); if (c.stage_id && c.campaign_no) nav.go('chien-dich', { c: c.campaign_no, s: c.stage_id, v: null }); }} /> : null}
    </View>
  );
};

// ---------------------------------------------------------------------- "Tư liệu": kho tư liệu
type Section = 'van-ban' | 'nhan-vat' | 'nien-bieu' | 'ban-do';
const SECTIONS: Array<{ id: Section; label: string; icon: IconType }> = [{ id: 'van-ban', label: 'Văn bản gốc', icon: ScrollText }, { id: 'nhan-vat', label: 'Nhân vật', icon: Users }, { id: 'nien-bieu', label: 'Niên biểu', icon: Clock }, { id: 'ban-do', label: 'Bản đồ', icon: MapIcon }];
const WOOD = { bg: '#2b1b12', side: '#1d120b', line: '#4a3122', text: '#f3e3c3', sub: '#c9b08a', gold: '#e0a93b', paper: '#f6ecd2', ink: '#3a2414', red: '#b3261e' };

const Rod: React.FC = () => (
  <View style={{ width: 16, alignItems: 'center' }}>
    <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: WOOD.gold }} />
    <View style={{ flex: 1, width: 10, backgroundColor: '#6b3f22' }} />
    <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: WOOD.gold }} />
  </View>
);

const ScrollPaper: React.FC<{ doc: ArchiveText; onStage: () => void }> = ({ doc, onStage }) => (
  <View style={{ flexDirection: 'row', alignItems: 'stretch' }} testID={`doc-${doc.code}`}>
    <Rod />
    <View style={{ flex: 1, backgroundColor: WOOD.paper, paddingVertical: 24, paddingHorizontal: 18, alignItems: 'center', gap: 10, minHeight: 330 }}>
      <Txt f="heavy" size={22} color={WOOD.red} center accessibilityRole="header">{doc.title.toUpperCase()}</Txt>
      {doc.subtitle ? <Txt size={13} color="#7a5a3a" center>{doc.subtitle}</Txt> : null}
      <View style={{ width: 120, height: 2, backgroundColor: '#d9c08f' }} />
      {doc.locked || !doc.body ? (
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 18 }}>
          <Lock size={34} color="#7a5a3a" strokeWidth={2.2} />
          <Txt f="bold" size={16} color={WOOD.ink} center>Tư liệu này còn khóa</Txt>
          <Txt size={14} color="#7a5a3a" center>{doc.lock ? `Hoàn thành chặng “${doc.lock.stage_title}” để mở.` : 'Hoàn thành chặng liên quan để mở.'}</Txt>
          {doc.lock ? <GameBtn title="Tới chặng" icon={MapIcon} tone="yellow" size="sm" onPress={onStage} testID="doc-to-stage" style={{ alignSelf: 'center' }} /> : null}
        </View>
      ) : (
        <>
          {doc.body.lines.map((l, i) => <Txt key={i} f="serifItalic" size={21} color={WOOD.ink} center style={{ lineHeight: 32 }}>{l}</Txt>)}
          {doc.body.translation?.length ? (
            <View style={{ alignItems: 'center', marginTop: 6, gap: 2 }}>
              <Txt f="heavy" size={12} color="#7a5a3a">BẢN DỊCH{doc.body.translator ? ` · ${doc.body.translator}` : ''}</Txt>
              {doc.body.translation.map((l, i) => <Txt key={i} f="serif" size={18} color={WOOD.ink} center>{l}</Txt>)}
            </View>
          ) : doc.body.translator ? <Txt size={12} color="#7a5a3a">{doc.body.translator}</Txt> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 10 }}>
            <View accessible accessibilityLabel="Đã mở khóa" style={{ width: 86, height: 86, borderRadius: 43, borderWidth: 3, borderColor: WOOD.red, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-14deg' }] }}>
              <Txt f="heavy" size={12} color={WOOD.red} center>ĐÃ MỞ{'\n'}KHÓA</Txt>
            </View>
            {doc.body.note ? (
              <View style={{ maxWidth: 300, backgroundColor: '#ffe98a', padding: 10, borderRadius: 4, transform: [{ rotate: '1.5deg' }] }}>
                <Txt f="heavy" size={13} color="#5a4300">Chú giải</Txt>
                <Txt size={13} color="#5a4300">{doc.body.note}</Txt>
              </View>
            ) : null}
          </View>
          {doc.source ? (
            <Pressable accessibilityRole="link" accessibilityLabel={`Nguồn: ${doc.source}. Bấm để mở`} disabled={!doc.source_url} onPress={() => { if (doc.source_url) void Linking.openURL(doc.source_url); }} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Txt size={12} color="#7a5a3a" center>Nguồn: {doc.source}{doc.source_url ? ' (bấm để mở)' : ''}</Txt>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
    <Rod />
  </View>
);

export const ArchiveScreen: React.FC<{ session: Session; nav: SagaNav }> = ({ session, nav }) => {
  const { width } = useWindowDimensions();
  const data = useLoad<Archive>(session, saga.archive, []);
  const [section, setSection] = useState<Section>('van-ban');
  const [camp, setCamp] = useState(0);
  const [docId, setDocId] = useState<number | null>(null);
  const [mapW, setMapW] = useState(0);
  const wide = width >= 860;
  const d = data.data;
  const texts = useMemo(() => (d?.texts ?? []).filter((t) => !camp || t.campaign_no === camp), [d, camp]);
  const doc = texts.find((t) => t.id === docId) ?? texts.find((t) => !t.locked) ?? texts[0] ?? null;
  const figures = (d?.figures ?? []).filter((f) => !camp || f.campaign_no === camp);
  const marks = (d?.timeline ?? []).filter((m) => !camp || m.campaign_no === camp);
  const maps = (d?.maps ?? []).filter((m) => !camp || m.campaign_no === camp);
  const toStage = (c: number | null, id: number | null): void => { if (c && id) nav.go('chien-dich', { c, s: id, v: null }); };
  return (
    <View style={{ flex: 1, backgroundColor: WOOD.bg, flexDirection: wide ? 'row' : 'column' }} testID="saga-archive">
      <View accessibilityRole="tablist" style={wide ? { width: 210, backgroundColor: WOOD.side, padding: 14, gap: 6 } : { backgroundColor: WOOD.side, padding: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <Txt f="heavy" size={14} color={WOOD.gold} accessibilityRole="header" style={wide ? { marginBottom: 6 } : { width: '100%' }}>KHO TƯ LIỆU</Txt>
        {SECTIONS.map((sec) => {
          const on = sec.id === section;
          return (
            <Pressable key={sec.id} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={sec.label} onPress={() => { setSection(sec.id); play('tap'); }} testID={`archive-${sec.id}`}
              style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: on ? '#3a2418' : 'transparent', borderLeftWidth: wide ? 4 : 0, borderLeftColor: on ? WOOD.gold : 'transparent', borderBottomWidth: wide ? 0 : 3, borderBottomColor: on ? WOOD.gold : 'transparent' }}>
              <sec.icon size={18} color={on ? WOOD.gold : WOOD.sub} strokeWidth={2.4} />
              <Txt f={on ? 'heavy' : 'semibold'} size={14} color={on ? WOOD.text : WOOD.sub}>{sec.label}</Txt>
            </Pressable>
          );
        })}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 104, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 860, gap: 14 }}>
          <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {[0, 1, 2, 3].map((n) => {
              const on = n === camp, t = TONE[n];
              return (
                <Pressable key={n} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={n ? `Chỉ xem tư liệu ${t.label.toLowerCase()}` : 'Xem tư liệu của cả ba lần kháng chiến'} onPress={() => { setCamp(n); setDocId(null); }} testID={`archive-camp-${n}`}
                  style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, backgroundColor: on ? (t?.main ?? WOOD.gold) : 'transparent', borderWidth: 2, borderColor: t?.main ?? WOOD.gold }}>
                  <Txt f="heavy" size={13} color={on ? (n ? '#ffffff' : WOOD.ink) : WOOD.text}>{n ? `${t.label} · ${n === 1 ? '1258' : n === 2 ? '1285' : '1287–1288'}` : 'TẤT CẢ'}</Txt>
                </Pressable>
              );
            })}
          </View>
          {!d ? <LoadState loading={data.loading} error={data.error} onRetry={data.reload} light /> : section === 'van-ban' ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {texts.map((t) => {
                  const on = t.id === doc?.id;
                  return (
                    <Pressable key={t.id} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${t.title}${t.locked ? ' (còn khóa)' : ''}`} onPress={() => { setDocId(t.id); play('tap'); }} testID={`doc-pick-${t.code}`}
                      style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 12, borderWidth: 2, borderColor: on ? WOOD.gold : WOOD.line, backgroundColor: on ? '#3a2418' : 'transparent' }}>
                      {t.locked ? <Lock size={14} color={WOOD.sub} strokeWidth={2.6} /> : <ScrollText size={14} color={WOOD.gold} strokeWidth={2.6} />}
                      <Txt f="bold" size={13} color={t.locked ? WOOD.sub : WOOD.text}>{t.title}</Txt>
                    </Pressable>
                  );
                })}
              </View>
              {doc ? <ScrollPaper doc={doc} onStage={() => toStage(doc.lock?.campaign_no ?? null, doc.lock?.stage_id ?? null)} /> : <Txt size={14} color={WOOD.sub} center>Chưa có văn bản nào trong phần này.</Txt>}
            </>
          ) : section === 'nhan-vat' ? (
            <View style={{ gap: 10 }}>
              {figures.map((f) => (
                <View key={f.code} testID={`figure-${f.code}`} style={{ flexDirection: 'row', gap: 12, backgroundColor: '#3a2418', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: WOOD.line }}>
                  <Portrait code={f.portrait} size={72} locked={!f.owned} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Txt f="heavy" size={17} color={WOOD.text}>{f.name}</Txt>
                    <Txt f="bold" size={13} color={WOOD.gold}>{f.title}{f.owned && f.years ? ` · ${f.years}` : ''}</Txt>
                    {f.owned ? (
                      <>
                        {f.intro ? <Txt size={14} color={WOOD.text}>{f.intro}</Txt> : null}
                        {f.role_text ? <Txt size={14} color={WOOD.sub}>{f.role_text}</Txt> : null}
                        {f.source ? <Pressable accessibilityRole="link" accessibilityLabel={`Nguồn: ${f.source}`} disabled={!f.source_url} onPress={() => { if (f.source_url) void Linking.openURL(f.source_url); }} style={{ minHeight: 32, justifyContent: 'center' }}><Txt size={12} color={WOOD.sub}>Nguồn: {f.source}{f.source_url ? ' (bấm để mở)' : ''}</Txt></Pressable> : null}
                      </>
                    ) : <Txt size={14} color={WOOD.sub}>{f.stage_title ? `Hoàn thành chặng “${f.stage_title}” để mở hồ sơ nhân vật.` : 'Hồ sơ còn khóa.'}</Txt>}
                  </View>
                </View>
              ))}
              <Txt size={12} color={WOOD.sub}>Hình trên thẻ là tranh minh họa cách điệu của trò chơi, không phải chân dung lịch sử.</Txt>
            </View>
          ) : section === 'nien-bieu' ? (
            <View>
              {marks.map((m, i) => {
                const tone = TONE[m.campaign_no ?? 0]?.main ?? WOOD.gold;
                return (
                  <View key={m.key} testID={`mark-${m.key}`} style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ alignItems: 'center', width: 22 }}>
                      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: tone, borderWidth: 3, borderColor: WOOD.bg, marginTop: 4, alignItems: 'center', justifyContent: 'center' }}>{m.stage_id && m.done ? <Check size={9} color="#ffffff" strokeWidth={4} /> : null}</View>
                      {i < marks.length - 1 ? <View style={{ flex: 1, width: 3, backgroundColor: WOOD.line }} /> : null}
                    </View>
                    <View style={{ flex: 1, paddingBottom: 16, gap: 2 }}>
                      <Txt f="heavy" size={13} color={WOOD.gold}>{m.date_label}</Txt>
                      <Txt f="heavy" size={16} color={WOOD.text}>{m.title}</Txt>
                      <Txt size={14} color={WOOD.sub}>{m.text}</Txt>
                      {m.stage_id ? <GameBtn title={m.done ? 'Xem lại chặng' : 'Mở chặng'} icon={MapIcon} tone="white" size="sm" onPress={() => toStage(m.campaign_no, m.stage_id)} testID={`mark-open-${m.stage_id}`} style={{ marginTop: 4 }} />
                        : m.source ? <Pressable accessibilityRole="link" accessibilityLabel={`Nguồn: ${m.source}`} disabled={!m.source_url} onPress={() => { if (m.source_url) void Linking.openURL(m.source_url); }} style={{ minHeight: 32, justifyContent: 'center' }}><Txt size={12} color={WOOD.sub}>Nguồn: {m.source}{m.source_url ? ' (bấm để mở)' : ''}</Txt></Pressable> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={{ gap: 16 }} onLayout={(e) => setMapW(e.nativeEvent.layout.width)}>
              {maps.map((m) => {
                const w = Math.min(mapW, 620 * (m.image_w / Math.max(1, m.image_h))), h = w / (m.image_w / Math.max(1, m.image_h));
                return (
                  <View key={m.campaign_no} testID={`archive-map-${m.campaign_no}`} style={{ gap: 6, alignItems: 'center' }}>
                    <Txt f="heavy" size={16} color={WOOD.text} center>{m.title} ({m.years})</Txt>
                    {mapW > 0 ? <Image source={mapSource(m)} style={{ width: w, height: h, borderRadius: 12, borderWidth: 3, borderColor: TONE[m.campaign_no]?.main ?? WOOD.gold }} resizeMode="stretch" accessibilityLabel={`Bản đồ ${m.title}`} /> : null}
                    <Txt size={12} color={WOOD.sub} center>{m.credit}</Txt>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                      <GameBtn title="Mở bản đồ chiến dịch" icon={Play} tone="yellow" size="sm" onPress={() => nav.go('chien-dich', { c: m.campaign_no, s: null, v: null })} testID={`archive-map-open-${m.campaign_no}`} />
                      {m.credit_url ? <GameBtn title="Trang gốc của bản đồ" icon={BookOpen} tone="white" size="sm" onPress={() => { void Linking.openURL(m.credit_url!); }} testID={`archive-map-src-${m.campaign_no}`} /> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};
