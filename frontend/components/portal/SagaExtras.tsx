/**
 * Hành trình Đông A – ba mục ngoài bản đồ, dựng bằng bộ thành phần của các cổng quản trị (tiêu đề hai nửa, thẻ số liệu, thẻ viền mảnh, bảng, nhóm nút chọn):
 *   - "Câu hỏi": ôn tập tính giờ (đồng hồ do máy chủ giữ và chỉ chạy khi câu được mở), ưu tiên câu từng sai và mục tiêu còn yếu, có chuỗi đúng và thanh cấp độ.
 *   - "Bộ thẻ": thẻ nhân vật đã mở, huy chương và bảng xếp hạng tuần của lớp.
 *   - "Tư liệu": kho tư liệu gồm văn bản gốc (mở dần theo chặng), nhân vật, niên biểu và bản đồ, đều ghi nguồn.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Pressable, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { BookOpen, Check, Clock, Flame, Lock, Map as MapIcon, Play, RotateCcw, ScrollText, Sparkles, Target, Trophy, Users } from 'lucide-react-native';
import * as game from '@/api/gameApi';
import * as saga from '@/lib/saga-api';
import { errorMessage } from '@/api/client';
import { DashboardMetric as Metric } from '@/components/admin/DashboardMetric';
import { Cell, DataTable, type Column } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import {
  BlockTitle, Flash, LoadState, Medal, Meter, Portrait, RARITY, SagaHeader, SagaPage, SourceLine, StarRow, TONE, mapSource, num, useFlash, useLoad, type SagaNav,
} from '@/components/portal/SagaKit';
import { Feedback, ItemBody } from '@/components/portal/SagaLearn';
import { Btn, Card, Chip, EmptyState, InfoNote, Inset, Segmented, Sheet, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { play } from '@/lib/saga-sound';
import type { BadgeItem, Board, BoardEntry } from '@/types/gamification';
import type { AnswerOutcome, Archive, ArchiveText, CardAlbum, PracticeSession, ReviewFinished, ReviewInfo, SagaCard, TimelineMark } from '@/types/saga';

const statusOf = (e: unknown): number | undefined => (e as { status?: number }).status;

// ---------------------------------------------------------------------- "Câu hỏi": ôn tập tính giờ
const ReviewQuiz: React.FC<{ session: Session; nav: SagaNav; initial: PracticeSession; onExit: () => void }> = ({ session, nav, initial, onExit }) => {
  const { c } = useTheme();
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
        // vừa đủ điểm lên cấp: tải lại ngay để hiện thông báo "Lên cấp"
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
  const urgent = left !== null && left <= 5;
  return (
    <SagaPage testID="saga-review-quiz" max={900} scrollRef={scroller}>
      <SagaHeader title="Câu hỏi ôn tập" subtitle="Mỗi câu có đồng hồ do máy chủ giữ; đồng hồ chỉ chạy khi câu được mở." back={{ label: 'Dừng lượt ôn', hint: 'Dừng lượt ôn, có thể tiếp tục sau', onPress: onExit }} />
      {showResult && finished ? (
        <Card flat pad={20} style={{ borderRadius: 12, alignItems: 'center', gap: 10 }} testID="review-result">
          <Txt f="displayHeavy" size={26} color={c.mocChu} accessibilityRole="header">Xong lượt ôn!</Txt>
          <Txt f="displayHeavy" size={40} color={c.logoInk}>{finished.right}/{finished.total}</Txt>
          <Txt size={14} color={c.muc2} center>Đúng {finished.percent}% · chuỗi đúng dài nhất {finished.best_streak} câu</Txt>
          {gained ? <Chip text={`+${gained} điểm kinh nghiệm`} icon={Sparkles} bg={c.thongNhat} fg={c.thongChu} style={{ alignSelf: 'center' }} /> : null}
          <Txt size={14} color={c.muc2} center>Câu trả lời đúng đã ra khỏi danh sách cần ôn; câu còn sai sẽ được hỏi lại ở lượt sau.</Txt>
          <Btn title="Xong" icon={Check} tone="son" onPress={onExit} testID="review-done" />
        </Card>
      ) : item ? (
        <>
          <Card flat pad={12} style={{ borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Chip text={`Câu ${cursor + 1}/${sess.total}`} bg={c.adminCanvas} fg={c.muc} />
            <View accessible accessibilityRole="timer" accessibilityLabel={left === null ? 'Đồng hồ đang dừng' : `Còn ${left} giây`} testID="review-timer"
              style={{ minWidth: 72, height: 44, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: urgent ? c.son : c.adminLine, backgroundColor: urgent ? c.sonNhat : c.the, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Clock size={16} color={urgent ? c.son : c.muc2} />
              <Txt f="bold" size={18} color={urgent ? c.sonChu : c.muc}>{left === null ? '–' : `${left}s`}</Txt>
            </View>
            <Chip text={`Chuỗi đúng: ${streak}`} icon={Flame} bg={c.hoaNhat} fg={c.hoaChu} />
            <View style={{ flex: 1, minWidth: 180, gap: 4 }}>
              <Txt size={12} color={c.muc3}>Cấp {level?.level ?? 1} · {num(xpNow)}{level?.next_xp ? `/${num(level.next_xp)}` : ''} điểm</Txt>
              <Meter value={level && level.next_xp !== null ? (xpNow - level.floor) / Math.max(1, level.next_xp - level.floor) : 1} label="Tiến độ lên cấp" height={6} />
            </View>
          </Card>
          <Card flat pad={16} style={{ borderRadius: 12, gap: 6 }} testID={`review-item-${item.kind}`}>
            <Txt f="bold" size={12} color={c.muc3} upper>{item.kind_label}{item.stage_title ? ` · ${item.stage_title}` : ''}</Txt>
            <Txt f="bold" size={18} color={c.logoInk} accessibilityRole="header">{item.prompt}</Txt>
          </Card>
          <ItemBody session={session} item={item} outcome={outcome} step={null} busy={busy} onAnswer={(a) => { void act({ type: 'answer', item_id: item.id, answer: a }); }} />
          <Flash text={flash} />
          {outcome ? <Feedback outcome={outcome} kind={item.kind} onNext={next} nextLabel={finished ? 'Xem kết quả' : 'Câu tiếp'} /> : null}
          <Btn title="Dừng lượt ôn" tone="giay" size="sm" onPress={onExit} testID="review-exit" label="Dừng lượt ôn, có thể tiếp tục sau" />
        </>
      ) : null}
    </SagaPage>
  );
};

export const ReviewScreen: React.FC<{ session: Session; nav: SagaNav }> = ({ session, nav }) => {
  const { c } = useTheme();
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
  const dueColumns: Column<ReviewInfo['due'][number]>[] = [
    { key: 'prompt', label: 'Câu hỏi', width: 360, grow: 2, render: (q) => <Cell main={q.prompt} sub={`${q.kind_label} · chặng ${q.stage_title}`} /> },
    { key: 'wrong', label: 'Số lần sai', width: 110, render: (q) => <Txt f="bold" size={14}>{q.wrong_count}</Txt> },
  ];
  return (
    <SagaPage testID="saga-review">
      <SagaHeader title="Câu hỏi ôn tập" subtitle="Mỗi câu có đồng hồ. Câu em từng trả lời sai được hỏi lại trước; trả lời đúng được +5 điểm (mỗi câu một lần trong ngày)."
        actions={d?.can_start ? (
          <>
            {d.active_session_id ? <Btn title="Lượt mới" icon={RotateCcw} tone="giay" size="sm" disabled={busy} onPress={() => { void start(true); }} testID="review-restart" /> : null}
            <Btn title={d.active_session_id ? 'Tiếp tục lượt đang dở' : `Bắt đầu ôn ${d.size} câu`} icon={Play} tone="son" size="sm" loading={busy} onPress={() => { void start(false); }} testID="review-start" />
          </>
        ) : undefined} />
      {!d ? <LoadState loading={info.loading} error={info.error} onRetry={info.reload} /> : (
        <>
          <Flash text={flash} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Metric compact label="Câu cần ôn" value={d.due.length} hint="câu" icon={RotateCcw} color={c.son} background={c.sonNhat} />
            <Metric compact label="Câu đã trả lời" value={d.stats.answers} hint="" icon={Check} color={c.thuyChu} background={c.thuyNhat} />
            <Metric compact label="Tỉ lệ đúng" value={`${d.stats.percent}%`} hint="" icon={Target} color={c.mocChu} background={c.mocNhat} />
            <Metric compact label="Câu trong kho ôn" value={d.pool} hint="câu" icon={BookOpen} color={c.thongChu} background={c.thongNhat} />
          </View>
          {!d.can_start ? (
            <EmptyState title="Chưa có câu nào để ôn" text="Hãy học và luyện tập ít nhất một chặng trên bản đồ; các câu hỏi của chặng đó sẽ xuất hiện ở đây."
              action={<Btn title="Mở bản đồ chiến dịch" icon={MapIcon} tone="son" onPress={() => nav.go('chien-dich', { c: null, s: null, v: null })} testID="review-to-map" />} />
          ) : null}
          {d.weak_objectives.length ? (
            <Card flat pad={14} style={{ borderRadius: 12, gap: 8 }} testID="review-weak">
              <BlockTitle title="Mục tiêu còn yếu" icon={Target} />
              {d.weak_objectives.map((w) => (
                <View key={`${w.stage_id}${w.objective}`} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <Txt size={14} style={{ flex: 1 }}>{w.text}</Txt>
                    <Txt f="bold" size={13} color={c.hoaChu}>{w.percent}%</Txt>
                  </View>
                  <Meter value={w.percent / 100} color={c.hoa} height={6} label={`${w.text}: đúng ${w.percent}%`} />
                  <Txt size={12} color={c.muc3}>Chặng {w.stage_title} · {w.answers} lượt trả lời</Txt>
                </View>
              ))}
            </Card>
          ) : null}
          {d.due.length ? (
            <Card flat pad={14} style={{ borderRadius: 12, gap: 8 }} testID="review-due">
              <BlockTitle title="Câu từng trả lời sai" note={`${d.due.length} câu`} icon={RotateCcw} />
              <DataTable columns={dueColumns} rows={d.due} rowKey={(q) => q.item_id} empty="Không có câu nào." />
            </Card>
          ) : null}
        </>
      )}
    </SagaPage>
  );
};

// ---------------------------------------------------------------------- "Bộ thẻ": thẻ nhân vật, huy chương, bảng xếp hạng tuần
const HeroCard: React.FC<{ card: SagaCard; onPress: () => void; latest?: boolean; testID?: string }> = ({ card, onPress, latest, testID }) => {
  const { c } = useTheme();
  const r = RARITY[card.rarity] ?? RARITY.common;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} testID={testID}
      accessibilityLabel={card.owned ? `Thẻ ${card.name}, ${card.title}, độ hiếm ${r.label.toLowerCase()}` : `Thẻ ${card.name} chưa mở${card.stage_title ? `: hoàn thành chặng ${card.stage_title}` : ''}`}
      style={({ pressed }) => ({ flexGrow: 1, flexBasis: 150, maxWidth: 220, minWidth: 140, borderRadius: 12, borderWidth: latest ? 2 : 1, borderColor: latest ? c.son : c.adminLine, backgroundColor: pressed ? c.adminCanvas : c.the, padding: 10, gap: 6, alignItems: 'center' })}>
      <Portrait code={card.portrait} size={104} locked={!card.owned} />
      <Txt f="bold" size={14} center numberOfLines={2}>{card.name}</Txt>
      <Txt size={12} color={c.muc3} center numberOfLines={1}>{card.owned ? card.title : card.stage_title ? `Mở ở chặng ${card.stage_title}` : 'Chưa mở'}</Txt>
      {card.owned ? <Chip text={r.label} bg={r.soft} fg={r.main} style={{ alignSelf: 'center' }} /> : <Chip text="Chưa mở" icon={Lock} bg={c.dichNhat} fg={c.dich} style={{ alignSelf: 'center' }} />}
      {latest ? <Txt f="bold" size={11} color={c.son} upper>Thẻ mới nhất</Txt> : null}
    </Pressable>
  );
};

const CardDetail: React.FC<{ card: SagaCard; onClose: () => void; onStage: () => void }> = ({ card, onClose, onStage }) => {
  const { c } = useTheme();
  const r = RARITY[card.rarity] ?? RARITY.common;
  return (
    <Sheet open onClose={onClose} title={card.name} subtitle={`${card.title}${card.years ? ` · ${card.years}` : ''}`}
      footer={<View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {card.stage_id ? <Btn title="Tới chặng" icon={MapIcon} tone="giay" onPress={onStage} testID="card-stage" /> : null}
        <Btn title="Đóng" tone="son" onPress={onClose} testID="card-close" />
      </View>}>
      <View style={{ gap: 12 }} testID="card-detail">
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <Portrait code={card.portrait} size={110} locked={!card.owned} />
          <View style={{ flex: 1, gap: 6 }}>
            {card.owned ? <Chip text={r.label} bg={r.soft} fg={r.main} /> : <Chip text="Chưa mở" icon={Lock} bg={c.dichNhat} fg={c.dich} />}
            {card.stage_title ? <Txt size={13} color={c.muc2}>{card.owned ? 'Mở ở chặng' : 'Hoàn thành chặng'} “{card.stage_title}”{card.owned ? '' : ' để mở thẻ'}</Txt> : null}
            {card.owned ? <StarRow n={r.stars} max={5} size={14} /> : null}
          </View>
        </View>
        {card.owned ? (
          <>
            {card.intro ? <Txt size={15}>{card.intro}</Txt> : null}
            {card.role_text ? <Inset style={{ gap: 4 }}><Txt f="bold" size={12} color={c.muc3} upper>Trong cuộc kháng chiến</Txt><Txt size={15}>{card.role_text}</Txt></Inset> : null}
            {card.quote ? <View style={{ borderLeftWidth: 3, borderLeftColor: c.son, paddingLeft: 12, gap: 2 }}><Txt f="serifItalic" size={18}>“{card.quote.replace(/ \/ /g, '\n')}”</Txt>{card.quote_source ? <Txt size={12} color={c.muc3}>{card.quote_source}</Txt> : null}</View> : null}
            {card.source ? <SourceLine source={{ title: card.source, publisher: 'Tranh chân dung trên thẻ là hình minh họa cách điệu, không phải chân dung lịch sử', url: card.source_url ?? null, note: null }} /> : null}
          </>
        ) : (
          <Txt size={15}>Thẻ này còn khóa. Phần giới thiệu nhân vật sẽ mở cùng thẻ khi em hoàn thành chặng.</Txt>
        )}
      </View>
    </Sheet>
  );
};

export const CollectionScreen: React.FC<{ session: Session; nav: SagaNav }> = ({ session, nav }) => {
  const { c } = useTheme();
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
  const wide = width >= 1180;
  const cards = album.data?.cards ?? [];
  const latest = album.data?.latest_code ?? null;
  const medals = useMemo(() => {
    const list = badges.data ?? [];
    return [...list.filter((b) => b.code.startsWith('saga-')), ...list.filter((b) => !b.code.startsWith('saga-') && b.earned)].slice(0, 8);
  }, [badges.data]);
  const b = board.data;
  const entries = b && 'entries' in b ? b.entries : [];
  const boardColumns: Column<BoardEntry>[] = [
    { key: 'rank', label: 'Hạng', width: 64, render: (e) => <Txt f="bold" size={14} color={e.rank <= 3 && e.xp > 0 ? c.son : c.muc}>{e.rank}</Txt> },
    { key: 'name', label: 'Học sinh', width: 200, grow: 2, render: (e) => (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <Txt f={e.me ? 'bold' : 'semibold'} size={14} numberOfLines={1} style={{ flexShrink: 1 }}>{e.me ? session.user.full_name : e.name}</Txt>
        {e.me ? <Chip text="Em" bg={c.sonNhat} fg={c.sonChu} /> : null}
      </View>
    ) },
    { key: 'xp', label: 'Điểm tuần', width: 110, render: (e) => <Txt f="bold" size={14}>{num(e.xp)}</Txt> },
  ];
  const leaderboard = (
    <Card flat pad={14} style={{ borderRadius: 12, gap: 10, flex: wide ? 1 : undefined }} testID="saga-board">
      <BlockTitle title="Bảng xếp hạng tuần" note={b && 'label' in b ? b.label : 'Lớp của em'} icon={Trophy} />
      {!b ? <LoadState loading={board.loading} error={board.error} onRetry={board.reload} /> : 'message' in b && !('entries' in b) ? (
        <Txt size={14} color={c.muc2}>{b.message}</Txt>
      ) : 'entries' in b && b.disabled ? <Txt size={14} color={c.muc2}>{b.message ?? 'Bảng xếp hạng đang tắt.'}</Txt>
        : <DataTable columns={boardColumns} rows={entries} rowKey={(e) => `${e.rank}${e.name}`} paginate={false} empty="Tuần này chưa ai ghi điểm. Em hãy là người mở đầu!" />}
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><Users size={14} color={c.muc3} /><Txt size={12} color={c.muc3} style={{ flex: 1 }}>Điểm tính theo kinh nghiệm kiếm được từ thứ Hai. Mỗi phần thưởng chỉ tính một lần.</Txt></View>
    </Card>
  );
  return (
    <SagaPage testID="saga-collection" max={1320}>
      <SagaHeader title="Bộ thẻ nhân vật" subtitle={album.data ? `Đã mở ${album.data.owned}/${album.data.total} thẻ. Hoàn thành một chặng để mở thẻ nhân vật của chặng đó.` : 'Thẻ nhân vật, huy chương và bảng xếp hạng tuần của lớp.'} />
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16, alignItems: wide ? 'flex-start' : 'stretch' }}>
        <View style={{ flex: wide ? 1.6 : undefined, gap: 16 }}>
          {!album.data ? <LoadState loading={album.loading} error={album.error} onRetry={album.reload} /> : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {cards.map((card) => <HeroCard key={card.code} card={card} latest={card.code === latest} onPress={() => setOpen(card)} testID={card.code === latest ? 'card-latest' : `card-${card.code}`} />)}
            </View>
          )}
          <Card flat pad={14} style={{ borderRadius: 12, gap: 10 }}>
            <BlockTitle title="Huy chương" />
            {medals.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                {medals.map((m) => (
                  <View key={m.id} accessible accessibilityLabel={`Huy chương ${m.name}: ${m.earned ? 'đã đạt' : 'chưa đạt'}. ${m.description ?? ''}`} style={{ alignItems: 'center', width: 90, gap: 2 }}>
                    <Medal code={m.code} size={52} earned={m.earned} />
                    <Txt f="semibold" size={12} color={m.earned ? c.muc : c.muc3} center numberOfLines={2}>{m.name}</Txt>
                  </View>
                ))}
              </View>
            ) : <Txt size={14} color={c.muc2}>{badges.loading ? 'Đang tải huy chương…' : 'Chưa có huy chương nào.'}</Txt>}
          </Card>
        </View>
        {leaderboard}
      </View>
      <InfoNote>Hình trên thẻ là tranh minh họa cách điệu của trò chơi, không phải chân dung lịch sử.</InfoNote>
      {open ? <CardDetail card={open} onClose={() => setOpen(null)} onStage={() => { const cd = open; setOpen(null); if (cd.stage_id && cd.campaign_no) nav.go('chien-dich', { c: cd.campaign_no, s: cd.stage_id, v: null }); }} /> : null}
    </SagaPage>
  );
};

// ---------------------------------------------------------------------- "Tư liệu": kho tư liệu
type Section = 'van-ban' | 'nhan-vat' | 'nien-bieu' | 'ban-do';

const DocView: React.FC<{ doc: ArchiveText; onStage: () => void }> = ({ doc, onStage }) => {
  const { c } = useTheme();
  return (
    <Card flat pad={20} style={{ borderRadius: 12, gap: 10 }} testID={`doc-${doc.code}`}>
      <View style={{ gap: 2 }}>
        <Txt f="displayHeavy" size={22} color={c.logoInk} accessibilityRole="header">{doc.title}</Txt>
        {doc.subtitle ? <Txt size={13} color={c.muc3}>{doc.subtitle}</Txt> : null}
      </View>
      {doc.locked || !doc.body ? (
        <Inset style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Lock size={22} color={c.muc2} />
          <View style={{ flex: 1, minWidth: 200 }}>
            <Txt f="bold" size={15}>Tư liệu này còn khóa</Txt>
            <Txt size={14} color={c.muc2}>{doc.lock ? `Hoàn thành chặng “${doc.lock.stage_title}” để mở.` : 'Hoàn thành chặng liên quan để mở.'}</Txt>
          </View>
          {doc.lock ? <Btn title="Tới chặng" icon={MapIcon} tone="giay" size="sm" onPress={onStage} testID="doc-to-stage" /> : null}
        </Inset>
      ) : (
        <>
          <View style={{ gap: 4, paddingVertical: 4 }}>
            {doc.body.lines.map((l, i) => <Txt key={i} f="serifItalic" size={19} style={{ lineHeight: 30 }}>{l}</Txt>)}
          </View>
          {doc.body.translation?.length ? (
            <Inset style={{ gap: 2 }}>
              <Txt f="bold" size={12} color={c.muc3} upper>Bản dịch{doc.body.translator ? ` · ${doc.body.translator}` : ''}</Txt>
              {doc.body.translation.map((l, i) => <Txt key={i} f="serif" size={17}>{l}</Txt>)}
            </Inset>
          ) : doc.body.translator ? <Txt size={12} color={c.muc3}>{doc.body.translator}</Txt> : null}
          {doc.body.note ? <InfoNote>Chú giải: {doc.body.note}</InfoNote> : null}
          {doc.source ? (
            <Pressable accessibilityRole="link" accessibilityLabel={`Nguồn: ${doc.source}. Bấm để mở`} disabled={!doc.source_url} onPress={() => { if (doc.source_url) void Linking.openURL(doc.source_url); }} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Txt size={12} color={c.muc3}>Nguồn: {doc.source}{doc.source_url ? ' (bấm để mở)' : ''}</Txt>
            </Pressable>
          ) : null}
        </>
      )}
    </Card>
  );
};

const Timeline: React.FC<{ marks: TimelineMark[]; onStage: (c: number | null, id: number | null) => void }> = ({ marks, onStage }) => {
  const { c } = useTheme();
  return (
    <Card flat pad={16} style={{ borderRadius: 12 }}>
      {marks.map((m, i) => {
        const tone = TONE[m.campaign_no ?? 0]?.main ?? c.muc3;
        return (
          <View key={m.key} testID={`mark-${m.key}`} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ alignItems: 'center', width: 20 }}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: tone, marginTop: 4, alignItems: 'center', justifyContent: 'center' }}>{m.stage_id && m.done ? <Check size={9} color="#ffffff" strokeWidth={4} /> : null}</View>
              {i < marks.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: c.adminLine }} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: 16, gap: 2 }}>
              <Txt f="bold" size={12} color={c.son}>{m.date_label}</Txt>
              <Txt f="bold" size={15}>{m.title}</Txt>
              <Txt size={14} color={c.muc2}>{m.text}</Txt>
              {m.stage_id ? <Btn title={m.done ? 'Xem lại chặng' : 'Mở chặng'} icon={MapIcon} tone="giay" size="sm" onPress={() => onStage(m.campaign_no, m.stage_id)} testID={`mark-open-${m.stage_id}`} style={{ marginTop: 4 }} />
                : m.source ? <Pressable accessibilityRole="link" accessibilityLabel={`Nguồn: ${m.source}`} disabled={!m.source_url} onPress={() => { if (m.source_url) void Linking.openURL(m.source_url); }} style={{ minHeight: 32, justifyContent: 'center' }}><Txt size={12} color={c.muc3}>Nguồn: {m.source}{m.source_url ? ' (bấm để mở)' : ''}</Txt></Pressable> : null}
            </View>
          </View>
        );
      })}
      {!marks.length ? <Txt size={14} color={c.muc2}>Chưa có mốc nào trong phần này.</Txt> : null}
    </Card>
  );
};

export const ArchiveScreen: React.FC<{ session: Session; nav: SagaNav }> = ({ session, nav }) => {
  const { c } = useTheme();
  const data = useLoad<Archive>(session, saga.archive, []);
  const [section, setSection] = useState<Section>('van-ban');
  const [camp, setCamp] = useState(0);
  const [docId, setDocId] = useState<number | null>(null);
  const [mapW, setMapW] = useState(0);
  const d = data.data;
  const texts = useMemo(() => (d?.texts ?? []).filter((t) => !camp || t.campaign_no === camp), [d, camp]);
  const doc = texts.find((t) => t.id === docId) ?? texts.find((t) => !t.locked) ?? texts[0] ?? null;
  const figures = (d?.figures ?? []).filter((f) => !camp || f.campaign_no === camp);
  const marks = (d?.timeline ?? []).filter((m) => !camp || m.campaign_no === camp);
  const maps = (d?.maps ?? []).filter((m) => !camp || m.campaign_no === camp);
  const toStage = (cn: number | null, id: number | null): void => { if (cn && id) nav.go('chien-dich', { c: cn, s: id, v: null }); };
  return (
    <SagaPage testID="saga-archive">
      <SagaHeader title="Kho tư liệu" subtitle="Văn bản gốc (mở dần theo chặng em hoàn thành), nhân vật, niên biểu và bản đồ của ba lần kháng chiến; mọi mục đều ghi nguồn." />
      <View style={{ gap: 10 }}>
        <Segmented<Section> label="Phần của kho tư liệu" value={section} onChange={(v) => { setSection(v); play('tap'); }}
          options={[{ value: 'van-ban', label: 'Văn bản gốc' }, { value: 'nhan-vat', label: 'Nhân vật' }, { value: 'nien-bieu', label: 'Niên biểu' }, { value: 'ban-do', label: 'Bản đồ' }]} />
        <Segmented<number> label="Lọc theo cuộc kháng chiến" value={camp} onChange={(n) => { setCamp(n); setDocId(null); }}
          options={[{ value: 0, label: 'Cả ba lần' }, ...[1, 2, 3].map((n) => ({ value: n, label: `${TONE[n].label} · ${TONE[n].years}` }))]} />
      </View>
      {!d ? <LoadState loading={data.loading} error={data.error} onRetry={data.reload} /> : section === 'van-ban' ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {texts.map((t) => {
              const on = t.id === doc?.id;
              return (
                <Pressable key={t.id} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${t.title}${t.locked ? ' (còn khóa)' : ''}`} onPress={() => { setDocId(t.id); play('tap'); }} testID={`doc-pick-${t.code}`}
                  style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 5, borderWidth: 1, borderColor: on ? c.son : c.adminLine, backgroundColor: on ? c.adminTint : pressed ? c.adminCanvas : c.the })}>
                  {t.locked ? <Lock size={14} color={c.muc3} /> : <ScrollText size={14} color={on ? c.son : c.muc2} />}
                  <Txt f={on ? 'bold' : 'semibold'} size={13} color={t.locked ? c.muc3 : on ? c.son : c.muc}>{t.title}</Txt>
                </Pressable>
              );
            })}
          </View>
          {doc ? <DocView doc={doc} onStage={() => toStage(doc.lock?.campaign_no ?? null, doc.lock?.stage_id ?? null)} /> : <Txt size={14} color={c.muc2}>Chưa có văn bản nào trong phần này.</Txt>}
        </View>
      ) : section === 'nhan-vat' ? (
        <View style={{ gap: 10 }}>
          {figures.map((f) => (
            <Card key={f.code} flat pad={14} style={{ borderRadius: 12, flexDirection: 'row', gap: 14 }} testID={`figure-${f.code}`}>
              <Portrait code={f.portrait} size={76} locked={!f.owned} />
              <View style={{ flex: 1, gap: 3 }}>
                <Txt f="bold" size={16}>{f.name}</Txt>
                <Txt f="semibold" size={13} color={c.son}>{f.title}{f.owned && f.years ? ` · ${f.years}` : ''}</Txt>
                {f.owned ? (
                  <>
                    {f.intro ? <Txt size={14}>{f.intro}</Txt> : null}
                    {f.role_text ? <Txt size={14} color={c.muc2}>{f.role_text}</Txt> : null}
                    {f.source ? <Pressable accessibilityRole="link" accessibilityLabel={`Nguồn: ${f.source}`} disabled={!f.source_url} onPress={() => { if (f.source_url) void Linking.openURL(f.source_url); }} style={{ minHeight: 32, justifyContent: 'center' }}><Txt size={12} color={c.muc3}>Nguồn: {f.source}{f.source_url ? ' (bấm để mở)' : ''}</Txt></Pressable> : null}
                  </>
                ) : <Txt size={14} color={c.muc2}>{f.stage_title ? `Hoàn thành chặng “${f.stage_title}” để mở hồ sơ nhân vật.` : 'Hồ sơ còn khóa.'}</Txt>}
              </View>
            </Card>
          ))}
          <InfoNote>Hình trên thẻ là tranh minh họa cách điệu của trò chơi, không phải chân dung lịch sử.</InfoNote>
        </View>
      ) : section === 'nien-bieu' ? (
        <Timeline marks={marks} onStage={toStage} />
      ) : (
        <View style={{ gap: 16 }} onLayout={(e) => setMapW(e.nativeEvent.layout.width)}>
          {maps.map((m) => {
            const w = Math.min(mapW - 30, 620 * (m.image_w / Math.max(1, m.image_h))), h = w / (m.image_w / Math.max(1, m.image_h));
            return (
              <Card key={m.campaign_no} flat pad={14} style={{ borderRadius: 12, gap: 8, alignItems: 'center' }} testID={`archive-map-${m.campaign_no}`}>
                <Txt f="bold" size={16} center>{m.title} ({m.years})</Txt>
                {mapW > 0 ? <Image source={mapSource(m)} style={{ width: w, height: h, borderRadius: 8, borderWidth: 1, borderColor: c.adminLine }} resizeMode="stretch" accessibilityLabel={`Bản đồ ${m.title}`} /> : null}
                <Txt size={12} color={c.muc3} center>{m.credit}</Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  <Btn title="Mở bản đồ chiến dịch" icon={Play} tone="son" size="sm" onPress={() => nav.go('chien-dich', { c: m.campaign_no, s: null, v: null })} testID={`archive-map-open-${m.campaign_no}`} />
                  {m.credit_url ? <Btn title="Trang gốc của bản đồ" icon={BookOpen} tone="giay" size="sm" onPress={() => { void Linking.openURL(m.credit_url!); }} testID={`archive-map-src-${m.campaign_no}`} /> : null}
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </SagaPage>
  );
};
