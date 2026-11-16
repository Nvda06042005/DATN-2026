/**
 * Hành trình Đông A – phần chơi trong game Phaser: nhập vai khám phá, trận đánh theo lượt và màn Bạch Đằng 1288.
 * Mỗi màn chỉ có một GameViewport (một game Phaser). Giao diện React giữ phần chữ, nút lệnh và hộp thoại; cảnh game lo di chuyển, hoạt ảnh và chọn ô / chọn đơn vị.
 * Hai bên trao đổi qua GameBridge theo sự kiện. Mọi lệnh đi tới máy chủ kèm mã lệnh và số thứ tự; máy chủ quyết định kết quả, giao diện chỉ dựng lại từ sự kiện trả về.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { Anchor, ArrowDown, ArrowUp, BookOpen, Check, ChevronRight, Flag, Flame, Footprints, Hand, Lightbulb, Minus, Play, RotateCcw, Shield, SkipForward, Sparkles, Swords, Target, Wheat, X } from 'lucide-react-native';
import * as saga from '@/lib/saga-api';
import { errorMessage } from '@/api/client';
import type { Session } from '@/components/auth';
import { GameViewport } from '@/components/portal/GameViewport';
import { Chunky, Confetti, Flash, GameBtn, LoadState, Meter, Overlay, Panel, Pill, SG, ScreenHead, StarRow, Sunburst, TieuTuongArt, num, useFlash, useKeys, useSaga, type SagaNav } from '@/components/portal/SagaKit';
import { Txt } from '@/components/ui';
import { GameBridge } from '@/game/bridge';
import { play } from '@/lib/saga-sound';
import type { BattleFinished, BattleSession, BdEvent, BdUnit, BdView, Choice, ExploreEvent, ExploreFinished, ExploreSession, TacticsEvent, TacticsUnit, TacticsView, XY } from '@/types/saga';

const EXPLORE_ASPECT = 704 / 416;
const TACTICS_ASPECT = 960 / 540;
const BD_ASPECT = 960 / 520;
type StageProps = { session: Session; nav: SagaNav; stageId: number; campaignNo: number };
const statusOf = (e: unknown): number | undefined => (e as { status?: number }).status;
/** Giá trị mới nhất của props cho các hàm xử lý sự kiện: hàm giữ nguyên danh tính nên không phải đăng ký lại với cảnh game mỗi lần giao diện vẽ lại */
function useLatest<T>(value: T): React.MutableRefObject<T> { const ref = useRef(value); ref.current = value; return ref; }

// ---------------------------------------------------------------------- nhập vai khám phá
interface Page { who: string | null; text: string; tone: 'say' | 'good' | 'bad' | 'clue' }

export const ExploreScreen: React.FC<StageProps> = ({ session, nav, stageId, campaignNo }) => {
  const s = useSaga();
  const { height, width } = useWindowDimensions();
  const scroller = useRef<ScrollViewInstance | null>(null);
  const bridge = useMemo(() => new GameBridge(), []);
  const ctx = useLatest({ session, nav });
  const [view, setView] = useState<ExploreSession | null>(null);
  const viewRef = useRef<ExploreSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const restart = useRef(false);
  const [near, setNear] = useState<{ target: string; name: string } | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [finished, setFinished] = useState<ExploreFinished | null>(null);
  const [reached, setReached] = useState(false);
  const reachedRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [flash, setFlash] = useFlash(5000);

  const apply = useCallback((v: ExploreSession): void => { viewRef.current = v; setView(v); bridge.set('explore:view', v); }, [bridge]);

  const send = useCallback(async (action: Record<string, unknown>): Promise<void> => {
    const cur = viewRef.current;
    if (!cur || busyRef.current || cur.status !== 'active') return;
    busyRef.current = true; setBusy(true);
    try {
      const res = await saga.act<ExploreSession, { events: ExploreEvent[] }, ExploreFinished>(ctx.current.session.token, cur.session_id, cur.seq, action);
      apply(res.view);
      const events = res.replayed ? [] : res.outcome.events;
      bridge.emit('explore:events', events);
      const next: Page[] = [];
      for (const e of events) {
        if (e.t === 'say' || e.t === 'gave') for (const line of e.lines ?? []) next.push({ who: e.who ?? null, text: line, tone: 'say' });
        else if (e.t === 'right') { play('right'); for (const line of e.lines ?? []) next.push({ who: e.who ?? null, text: line, tone: 'good' }); }
        else if (e.t === 'wrong') { play('wrong'); for (const line of e.lines ?? []) next.push({ who: e.who ?? null, text: line, tone: 'bad' }); }
        else if (e.t === 'got') { play('reward'); next.push({ who: null, text: `Em nhặt được: ${e.text ?? 'một vật'}.`, tone: 'good' }); }
        else if (e.t === 'clue') next.push({ who: 'Manh mối', text: e.text ?? '', tone: 'clue' });
        else if (e.t === 'step') setFlash(`Mục tiêu mới: ${e.text ?? ''}`);
        else if (e.t === 'battle') { reachedRef.current = true; setReached(true); }
      }
      if (next.length) setPages((p) => [...p, ...next]);
      if (res.finished) { setFinished(res.finished); if (res.finished.xp) ctx.current.nav.refresh(); }
      if (res.completion?.first) ctx.current.nav.setReward({ stageId, completion: res.completion });
    } catch (e) {
      if (statusOf(e) === 401) ctx.current.session.expired();
      else if (statusOf(e) === 409) setRound((n) => n + 1);
      setFlash(errorMessage(e));
    } finally { busyRef.current = false; setBusy(false); }
  }, [apply, bridge, ctx, setFlash, stageId]);

  useEffect(() => {
    let live = true;
    setLoading(true); setError(null); setPages([]); setFinished(null); setReached(false); reachedRef.current = false;
    saga.startExplore(session.token, stageId, restart.current).then((v) => {
      if (!live) return;
      restart.current = false;
      apply(v);
      setLoading(false);
      // vừa thắng trận quay lại: bước chạm trán được qua ngay, không bắt đi lại tới vùng địch
      if (v.current?.type === 'battle' && v.battle?.won && v.current.marker) void send({ type: 'interact', target: v.current.marker });
    }).catch((e) => { if (!live) return; if (statusOf(e) === 401) ctx.current.session.expired(); setError(errorMessage(e)); setLoading(false); });
    return () => { live = false; };
  }, [apply, ctx, send, session.token, stageId, round]);

  const asking = view?.current?.asking ?? null;
  const talking = pages.length > 0;
  const locked = talking || Boolean(asking) || Boolean(finished) || busy;
  // nhả khóa trễ một nhịp để phím Enter vừa đóng lời thoại không bị cảnh game hiểu là "nói chuyện lần nữa"
  useEffect(() => {
    if (locked) { bridge.set('explore:lock', true); return undefined; }
    const t = setTimeout(() => bridge.set('explore:lock', false), 220);
    return () => clearTimeout(t);
  }, [bridge, locked]);

  useEffect(() => {
    const offs = [
      bridge.on('explore:near', (n: { target: string; name: string } | null) => setNear(n)),
      bridge.on('explore:interact', (p: { target: string }) => { void send({ type: 'interact', target: p.target }); }),
      bridge.on('explore:zone', (id: string) => {
        const step = viewRef.current?.current;
        // đã báo chạm trán rồi thì chờ người chơi bấm "Vào trận", không gửi lại lệnh mỗi lần cảnh báo vùng
        if (!step || step.marker !== `zone:${id}` || (step.type === 'battle' && reachedRef.current)) return;
        void send({ type: 'interact', target: `zone:${id}` });
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [bridge, send]);

  const nextPage = (): void => { play('tap'); setPages((p) => p.slice(1)); };
  useKeys((k) => { if (talking && (k === 'Enter' || k === ' ' || k.toLowerCase() === 'e')) nextPage(); }, talking);
  useKeys((k) => { const i = Number(k) - 1; if (asking && !talking && asking.options[i]) void send({ type: 'answer', choice: asking.options[i].id }); }, Boolean(asking) && !talking && !busy);

  const back = (): void => nav.back('chien-dich', { c: campaignNo, s: stageId, v: null });
  const page = pages[0] ?? null;
  const cur = view?.current ?? null;
  const pageTone = page?.tone === 'good' ? SG.green : page?.tone === 'bad' ? SG.red : page?.tone === 'clue' ? SG.yellow : SG.blue;
  // Khung game cao tối đa phần còn lại của màn hình; đủ cao thì lời thoại / câu hỏi nổi ngay trên cảnh (như game nhập vai), màn nhỏ thì nằm ngay dưới cảnh
  const maxH = Math.max(220, height - 300);
  const canvasH = Math.min(maxH, Math.min(width - 24, 1000) / EXPLORE_ASPECT);
  const over = canvasH >= 400;
  const atBattle = Boolean(reached && cur?.type === 'battle' && view?.battle && !view.battle.won);
  const talk = !view ? null : page ? (
    <Panel tone={pageTone} pad={12} style={{ gap: 6 }} testID="explore-dialog">
      {page.who ? <Pill text={page.who} bg={pageTone} fg={page.tone === 'clue' ? SG.onYellow : '#ffffff'} /> : null}
      <Txt size={17} color={s.ink} style={{ lineHeight: 26 }} accessibilityLiveRegion="polite">{page.text}</Txt>
      <GameBtn title={pages.length > 1 ? 'Tiếp' : 'Đã rõ'} iconRight={ChevronRight} tone="green" size="sm" onPress={nextPage} testID="explore-next" label={`${pages.length > 1 ? 'Tiếp' : 'Đã rõ'} (phím Enter)`} style={{ alignSelf: 'flex-end' }} />
    </Panel>
  ) : asking ? (
    <Panel tone={SG.purple} pad={12} style={{ gap: 8 }} testID="explore-ask">
      <Txt f="heavy" size={16} color={s.ink}>{asking.prompt}</Txt>
      {asking.options.map((o: Choice, i: number) => (
        <Chunky key={o.id} bg="#ffffff" edge="#c9d5ea" onPress={() => { void send({ type: 'answer', choice: o.id }); }} disabled={busy} label={`Phương án ${i + 1}: ${o.text}`} testID={`explore-answer-${i + 1}`} radius={14} depth={4} style={{ alignSelf: 'stretch' }}>
          <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 5 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: SG.purple, alignItems: 'center', justifyContent: 'center' }}><Txt f="heavy" size={14} color="#ffffff">{i + 1}</Txt></View>
            <Txt f="bold" size={15} color="#1e2a4a" style={{ flex: 1 }}>{o.text}</Txt>
          </View>
        </Chunky>
      ))}
    </Panel>
  ) : atBattle && view.battle ? (
    <Panel tone={SG.red} pad={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }} testID="explore-battle">
      <Swords size={28} color={SG.red} strokeWidth={2.4} />
      <View style={{ flex: 1, minWidth: 180 }}>
        <Txt f="heavy" size={17} color={s.ink}>Chạm trán quân địch!</Txt>
        <Txt size={14} color={s.sub}>{view.battle.title}. Thắng trận rồi em sẽ quay lại đúng chỗ này để làm tiếp nhiệm vụ.</Txt>
      </View>
      <GameBtn title="Vào trận" icon={Swords} tone="red" size="lg" onPress={() => nav.go('chien-dich', { c: campaignNo, s: stageId, v: 'tran' }, 'replace')} testID="explore-fight" />
    </Panel>
  ) : null;
  const hasTalk = talk !== null;
  // màn nhỏ: lời thoại nằm dưới cảnh, tự cuộn tới để không bị khuất
  useEffect(() => {
    if (over || !hasTalk) return undefined;
    const t = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(t);
  }, [over, hasTalk, page]);
  return (
    <View style={{ flex: 1, backgroundColor: s.dark ? '#0d1730' : '#e9f7e4' }} testID="saga-explore">
      <ScrollView ref={scroller} contentContainerStyle={{ padding: 12, paddingBottom: 40, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 1000, gap: 10 }}>
          <ScreenHead title={view ? view.title : 'Nhập vai khám phá'} subtitle={view?.stage ? `${view.stage.title} · ${view.stage.date_label}` : undefined} onBack={back} backLabel="Về bảng thông tin chặng" />
          {!view ? <LoadState loading={loading} error={error} onRetry={() => setRound((n) => n + 1)} /> : (
            <>
              <Panel pad={10} style={{ gap: 8 }} testID="explore-goal">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Target size={20} color={SG.red} strokeWidth={2.6} />
                  <Txt f="heavy" size={16} color={s.ink} style={{ flex: 1 }} accessibilityLiveRegion="polite">{cur ? cur.goal : 'Đã hoàn thành nhiệm vụ ở cảnh này.'}</Txt>
                  <Pill text={`Bước ${Math.min(view.progress.step + 1, view.progress.total)}/${view.progress.total}`} bg={SG.navy} size={12} />
                </View>
                <Meter value={view.progress.step / Math.max(1, view.progress.total)} fill={SG.green} label="Tiến độ nhiệm vụ nhập vai" height={8} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  {view.progress.inventory.map((it) => <Pill key={it.id} text={`Đang mang: ${it.name}`} icon={Hand} bg="#fff3c9" fg="#7a5a00" size={12} />)}
                  <Pill text={`Gợi ý đã xem: ${view.progress.hints}`} bg={s.card2} fg={s.ink} size={12} />
                  <Pill text={`Sai: ${view.progress.mistakes}`} bg={s.card2} fg={s.ink} size={12} />
                  <View style={{ flex: 1 }} />
                  <GameBtn title="Xem lại manh mối" icon={Lightbulb} tone="white" size="sm" disabled={!cur?.has_clue || locked} onPress={() => { void send({ type: 'hint' }); }} testID="explore-hint" label="Xem lại manh mối (mỗi lần xem được ghi nhận)" />
                </View>
              </Panel>

              <View style={{ width: '100%', maxWidth: Math.round(maxH * EXPLORE_ASPECT), alignSelf: 'center' }}>
                <GameViewport kind="explore" bridge={bridge} aspect={EXPLORE_ASPECT} label={`Cảnh nhập vai: ${view.title}`} />
                {near && !locked && !hasTalk ? (
                  <View style={{ position: 'absolute', left: 0, right: 0, bottom: 10, alignItems: 'center' }} pointerEvents="box-none">
                    <GameBtn title={near.target.startsWith('item:') ? `Nhặt ${near.name}` : `Nói chuyện với ${near.name}`} icon={Hand} tone="yellow" onPress={() => bridge.emit('explore:press')} testID="explore-interact" label={`${near.target.startsWith('item:') ? 'Nhặt' : 'Nói chuyện với'} ${near.name} (phím E)`} style={{ alignSelf: 'center' }} />
                  </View>
                ) : null}
                {over && hasTalk ? <View style={{ position: 'absolute', left: 10, right: 10, bottom: 10 }}>{talk}</View> : null}
              </View>

              <Flash text={flash} tone="info" />
              {!over && hasTalk ? talk : (
                <Panel pad={12} style={{ gap: 4 }}>
                  <Txt f="bold" size={14} color={s.ink}>{view.intro}</Txt>
                  <Txt size={13} color={s.sub}>Đi lại: phím W A S D hoặc phím mũi tên, hoặc chạm vào nơi muốn tới. Tương tác: tới gần rồi nhấn E / Enter, hoặc bấm nút hiện trên cảnh.</Txt>
                  <Txt size={13} color={s.sub}>Nhân vật em điều khiển và các nhân vật phụ trong cảnh là hư cấu; lời kể lịch sử lấy từ nội dung đã kiểm chứng của chặng.</Txt>
                </Panel>
              )}
            </>
          )}
        </View>
      </ScrollView>
      {finished && !talking ? (
        <Overlay label="Hoàn thành nhiệm vụ nhập vai" testID="explore-done">
          <Panel style={{ alignItems: 'center', gap: 10, overflow: 'hidden' }}>
            <Confetti />
            <TieuTuongArt size={92} cheer />
            <Txt f="heavy" size={24} color={SG.greenEdge} center accessibilityRole="header">Hoàn thành nhiệm vụ!</Txt>
            <Txt f="semibold" size={15} color={s.sub} center>Em đã xem lại manh mối {finished.hints} lần và nhầm {finished.mistakes} lần.</Txt>
            {finished.xp ? <Pill text={`+${finished.xp} điểm kinh nghiệm`} icon={Sparkles} bg={SG.purple} style={{ alignSelf: 'center' }} /> : null}
            {finished.suggest_review ? <Txt size={14} color={s.sub} center>Chặng này được đánh dấu “Cần ôn” vì em phải xem gợi ý hoặc sai nhiều lần. Ôn lại để nhớ chắc hơn nhé.</Txt> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
              <GameBtn title="Xem tổng kết" icon={Sparkles} tone="yellow" size="lg" onPress={() => nav.go('chien-dich', { c: campaignNo, s: stageId, v: 'tong-ket' }, 'replace')} testID="explore-summary" />
              <GameBtn title="Chơi lại cảnh" icon={RotateCcw} tone="white" size="lg" onPress={() => { restart.current = true; setRound((n) => n + 1); }} testID="explore-replay" />
            </View>
          </Panel>
        </Overlay>
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------------------- trận đánh: nạp phiên rồi mở đúng kiểu trận
export const BattleScreen: React.FC<StageProps> = (p) => {
  const { session, nav, stageId, campaignNo } = p;
  const s = useSaga();
  const [sess, setSess] = useState<BattleSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const restart = useRef(false);
  const ctx = useLatest(session);
  useEffect(() => {
    let live = true;
    setLoading(true); setError(null); setSess(null);
    saga.startBattle(session.token, stageId, restart.current).then((b) => { if (!live) return; restart.current = false; setSess(b); setLoading(false); })
      .catch((e) => { if (!live) return; if (statusOf(e) === 401) ctx.current.expired(); setError(errorMessage(e)); setLoading(false); });
    return () => { live = false; };
  }, [ctx, session.token, stageId, round]);
  const again = useCallback((fresh: boolean): void => { restart.current = fresh; setRound((n) => n + 1); }, []);
  if (!sess) {
    return (
      <View style={{ flex: 1, backgroundColor: s.dark ? '#0d1730' : '#e3f2ff', padding: 16, alignItems: 'center' }} testID="saga-battle">
        <View style={{ width: '100%', maxWidth: 820, gap: 12 }}>
          <ScreenHead title="Trận đánh" onBack={() => nav.back('chien-dich', { c: campaignNo, s: stageId, v: null })} backLabel="Về bảng thông tin chặng" />
          <LoadState loading={loading} error={error} onRetry={() => again(false)} />
          {error ? <GameBtn title="Vào phần nhập vai" icon={Footprints} tone="red" onPress={() => nav.go('chien-dich', { c: campaignNo, s: stageId, v: 'kham-pha' }, 'replace')} testID="battle-to-explore" style={{ alignSelf: 'center' }} /> : null}
        </View>
      </View>
    );
  }
  return sess.mode === 'bachdang'
    ? <BachDangHost key={sess.session_id} {...p} initial={sess as BattleSession & BdView} onAgain={again} />
    : <TacticsHost key={sess.session_id} {...p} initial={sess as BattleSession & TacticsView} onAgain={again} />;
};

type HostProps<V> = StageProps & { initial: BattleSession & V; onAgain: (fresh: boolean) => void };

const ResultPanel: React.FC<{ finished: BattleFinished; reasonText: string | null; tips: string[]; onContinue: () => void; onRetry: () => void; onLesson: () => void; onStage: () => void }> = ({ finished, reasonText, tips, onContinue, onRetry, onLesson, onStage }) => (
  <Overlay label={finished.won ? 'Chiến thắng' : 'Trận đánh chưa thắng'} testID="battle-result" maxWidth={560}>
    <View style={{ borderRadius: 26, overflow: 'hidden', borderWidth: 4, borderColor: finished.won ? SG.yellow : '#9aa5bd' }}>
      <Sunburst color={finished.won ? '#1f6fbf' : '#39435f'} ray={finished.won ? '#2a82d6' : '#434e6e'} size={1000} />
      {finished.won ? <Confetti /> : null}
      <ScrollView contentContainerStyle={{ alignItems: 'center', padding: 20, gap: 10 }}>
        <Txt f="heavy" size={34} color={finished.won ? SG.yellow : '#ffffff'} center accessibilityRole="header">{finished.won ? 'CHIẾN THẮNG!' : 'CHƯA THẮNG'}</Txt>
        {finished.won ? <StarRow n={finished.stars} size={38} dim="rgba(255,255,255,0.3)" /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          <Pill text={`${num(finished.score)} điểm trận`} icon={Swords} bg="#ffffff" fg="#1e2a4a" size={15} />
          {finished.xp ? <Pill text={`+${finished.xp} điểm kinh nghiệm`} icon={Sparkles} bg={SG.purple} size={15} /> : null}
        </View>
        {reasonText ? <Txt f="heavy" size={15} color="#ffe9a8" center>{reasonText}</Txt> : null}
        <Txt size={15} color="#ffffff" center>{finished.text}</Txt>
        {finished.good?.length ? (
          <View style={{ alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 14, padding: 12, gap: 4 }}>
            <Txt f="heavy" size={14} color="#bff5c8">LÀM TỐT</Txt>
            {finished.good.map((g) => <Txt key={g} size={14} color="#ffffff">• {g}</Txt>)}
          </View>
        ) : null}
        {finished.mistakes?.length ? (
          <View style={{ alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 14, padding: 12, gap: 4 }} testID="battle-mistakes">
            <Txt f="heavy" size={14} color="#ffd0c2">{finished.won ? 'CÒN CÓ THỂ TỐT HƠN' : 'VÌ SAO CHƯA THẮNG'}</Txt>
            {finished.mistakes.map((m) => <Txt key={m.code} size={14} color="#ffffff">• {m.text}</Txt>)}
          </View>
        ) : null}
        {!finished.won && tips.length ? (
          <View style={{ alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 14, padding: 12, gap: 4 }}>
            <Txt f="heavy" size={14} color="#ffe9a8">GỢI Ý</Txt>
            {tips.map((t) => <Txt key={t} size={14} color="#ffffff">• {t}</Txt>)}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 4 }}>
          {finished.won ? <GameBtn title="Tiếp tục nhiệm vụ" icon={Play} tone="yellow" size="lg" onPress={onContinue} testID="battle-continue" /> : <GameBtn title="Đánh lại" icon={RotateCcw} tone="yellow" size="lg" onPress={onRetry} testID="battle-retry" />}
          {finished.won ? <GameBtn title="Đánh lại" icon={RotateCcw} tone="white" onPress={onRetry} testID="battle-retry" /> : <GameBtn title="Xem lại thẻ kiến thức" icon={BookOpen} tone="white" onPress={onLesson} testID="battle-lesson" />}
          <GameBtn title="Về chặng" tone="white" onPress={onStage} testID="battle-stage" />
        </View>
      </ScrollView>
    </View>
  </Overlay>
);

const LogBox: React.FC<{ lines: string[] }> = ({ lines }) => {
  const s = useSaga();
  return (
    <Panel pad={12} style={{ gap: 3, minHeight: 96 }}>
      <Txt f="heavy" size={13} color={s.sub}>DIỄN BIẾN</Txt>
      {lines.length ? lines.slice(-7).map((l, i) => <Txt key={`${i}${l}`} size={13} color={s.ink}>{l}</Txt>) : <Txt size={13} color={s.sub}>Chưa có diễn biến nào.</Txt>}
    </Panel>
  );
};

// ---------------------------------------------------------------------- trận đánh theo lượt
const LOSE_REASON: Record<string, string> = { wiped: 'Toàn bộ quân ta đã bị loại khỏi trận.', protect: 'Người cần bảo vệ đã ngã xuống.', escaped: 'Hết số vòng mà chưa diệt đủ mục tiêu.', timeout: 'Hết số vòng của trận mà chưa đạt mục tiêu.' };
const FX_TEXT: Record<string, string> = { cover: 'được che chắn', rally: 'được khích lệ', stun: 'choáng', weak: 'suy yếu' };

function tacticsLine(e: TacticsEvent, name: (id?: string) => string): string | null {
  switch (e.t) {
    case 'round': return `— Vòng ${e.n} —`;
    case 'attack': return `${name(e.unit)} đánh ${name(e.target)}: −${e.dmg}${e.adv ? ' (khắc chế)' : ''}${e.guarded ? ' (đối phương đang phòng thủ)' : ''}`;
    case 'skill': return `${name(e.unit)} dùng “${e.name}”`;
    case 'defend': return `${name(e.unit)} phòng thủ`;
    case 'fx': return e.status === 'burn' ? `${name(e.unit)} bị lửa đốt: −${e.dmg}` : `${name(e.unit)} kiệt sức vì thiếu lương: −${e.dmg}`;
    case 'down': return `${name(e.unit)} bị loại khỏi trận`;
    case 'skip': return `${name(e.unit)} bị choáng, mất lượt`;
    case 'stratagem': return `Mưu kế “${e.name}” ${e.ok ? 'phát huy trọn vẹn' : 'chỉ có tác dụng yếu'}. ${e.text ?? ''}`;
    default: return null;
  }
}

const UnitCard: React.FC<{ u: TacticsUnit; title: string }> = ({ u, title }) => {
  const s = useSaga();
  return (
    <Panel pad={12} style={{ gap: 4 }} tone={u.side === 'ally' ? SG.green : SG.red}>
      <Txt f="heavy" size={12} color={s.sub}>{title}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Txt f="heavy" size={17} color={s.ink}>{u.name}</Txt>
        <Pill text={`${u.cls_label} · ${u.row === 'front' ? 'hàng trước' : 'hàng sau'}`} bg={u.side === 'ally' ? SG.green : SG.red} size={11} />
      </View>
      <Meter value={u.hp / Math.max(1, u.max_hp)} fill={u.side === 'ally' ? SG.green : SG.red} label={`Sinh lực của ${u.name}`} height={10} />
      <Txt f="semibold" size={13} color={s.ink}>Sinh lực {u.hp}/{u.max_hp} · Công {u.atk} · Thủ {u.def} · Nhanh {u.spd}{u.ranged ? ' · bắn xa' : ''}</Txt>
      {u.skill ? <Txt size={13} color={s.sub}>Kỹ năng “{u.skill.name}” (tốn {u.skill.cost} lương{u.cd > 0 ? `, còn hồi ${u.cd} vòng` : ''}): {u.skill.text}</Txt> : null}
      {u.guard || u.burn > 0 || u.fx.length ? <Txt size={13} color={s.sub}>Trạng thái: {[u.guard ? 'đang phòng thủ' : null, u.burn > 0 ? 'đang cháy' : null, ...u.fx.map((f) => FX_TEXT[f] ?? f)].filter(Boolean).join(', ')}</Txt> : null}
    </Panel>
  );
};

const TacticsHost: React.FC<HostProps<TacticsView>> = ({ session, nav, stageId, campaignNo, initial, onAgain }) => {
  const s = useSaga();
  const { height, width } = useWindowDimensions();
  const bridge = useMemo(() => { const b = new GameBridge(); b.set('tactics:view', initial); return b; }, [initial]);
  const ctx = useLatest({ session, nav, onAgain });
  const [view, setView] = useState(initial);
  const viewRef = useRef(initial);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const ready = useRef(false);
  const pending = useRef<{ view: BattleSession & TacticsView; finished: BattleFinished | null } | null>(null);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mode, setMode] = useState<'idle' | 'attack' | 'skill'>('idle');
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const [inspect, setInspect] = useState<string | null>(null);
  const [ask, setAsk] = useState(false);
  const [finished, setFinished] = useState<BattleFinished | null>(null);
  const [flash, setFlash] = useFlash();
  const [log, setLog] = useState<string[]>(() => (initial.events ?? []).map((e) => tacticsLine(e as TacticsEvent, (id) => initial.units.find((u) => u.id === id)?.name ?? 'Đơn vị')).filter((l): l is string => Boolean(l)));

  const commit = useCallback((): void => {
    if (watchdog.current) { clearTimeout(watchdog.current); watchdog.current = null; }
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    viewRef.current = p.view; setView(p.view); bridge.set('tactics:view', p.view);
    if (p.finished) { setFinished(p.finished); play(p.finished.won ? 'win' : 'lose'); if (p.finished.xp) ctx.current.nav.refresh(); }
    busyRef.current = false; setBusy(false);
  }, [bridge, ctx]);

  const send = useCallback(async (action: Record<string, unknown>): Promise<void> => {
    const cur = viewRef.current;
    if (busyRef.current || cur.status !== 'active') return;
    busyRef.current = true; setBusy(true); setMode('idle'); setAsk(false); bridge.emit('tactics:targets', []);
    try {
      const res = await saga.act<BattleSession & TacticsView, { events: TacticsEvent[] }, BattleFinished>(ctx.current.session.token, cur.session_id, cur.seq, action);
      pending.current = { view: res.view, finished: res.finished };
      if (res.completion?.first) ctx.current.nav.setReward({ stageId, completion: res.completion });
      const events = res.replayed ? [] : res.outcome.events;
      const lines = events.map((e) => tacticsLine(e, (id) => res.view.units.find((u) => u.id === id)?.name ?? 'Đơn vị')).filter((l): l is string => Boolean(l));
      if (lines.length) setLog((l) => [...l, ...lines].slice(-40));
      if (ready.current && events.length) {
        bridge.emit('tactics:play', { events, view: res.view });
        // cảnh game báo 'tactics:played' khi dựng xong; quá lâu không báo (thẻ trình duyệt bị ẩn, lỗi dựng hình) thì vẫn nhận trạng thái mới để không kẹt lượt
        watchdog.current = setTimeout(commit, 6000 + events.length * 1500);
      } else commit();
    } catch (e) {
      if (statusOf(e) === 401) ctx.current.session.expired();
      else if (statusOf(e) === 409) ctx.current.onAgain(false);
      setFlash(errorMessage(e));
      busyRef.current = false; setBusy(false);
    }
  }, [bridge, commit, ctx, setFlash, stageId]);

  useEffect(() => {
    const offs = [
      bridge.on('tactics:ready', () => { ready.current = true; }),
      bridge.on('tactics:played', () => commit()),
      bridge.on('tactics:event', (e: TacticsEvent) => { if (e.t === 'attack' || e.t === 'fx') play('hit'); }),
      bridge.on('tactics:inspect', (id: string) => setInspect(id)),
      bridge.on('tactics:pick', (id: string) => { if (modeRef.current === 'attack') void send({ type: 'attack', target: id }); else if (modeRef.current === 'skill') void send({ type: 'skill', target: id }); }),
    ];
    return () => { offs.forEach((off) => off()); if (watchdog.current) clearTimeout(watchdog.current); };
  }, [bridge, commit, send]);

  const actor = view.actor ? view.units.find((u) => u.id === view.actor!.id) ?? null : null;
  const skill = view.actor?.skill ?? null;
  const targets = mode === 'attack' ? view.actor?.attack_targets ?? [] : mode === 'skill' ? skill?.targets ?? [] : [];
  const choose = (m: 'idle' | 'attack' | 'skill'): void => {
    setMode(m);
    bridge.emit('tactics:targets', m === 'attack' ? view.actor?.attack_targets ?? [] : m === 'skill' ? skill?.targets ?? [] : []);
  };
  const castSkill = (): void => { if (!skill?.usable) return; if (skill.targets.length) choose('skill'); else void send({ type: 'skill' }); };
  const canAct = Boolean(actor) && !busy && view.status === 'active';
  useKeys((k) => {
    const key = k.toLowerCase();
    if (mode !== 'idle') {
      if (key === 'escape') choose('idle');
      const i = Number(k) - 1;
      if (targets[i]) void send(mode === 'attack' ? { type: 'attack', target: targets[i] } : { type: 'skill', target: targets[i] });
      return;
    }
    if (key === 'a' && view.actor?.attack_targets.length) choose('attack');
    else if (key === 'd') void send({ type: 'defend' });
    else if (key === 's') castSkill();
  }, canAct && !ask);

  const shown = inspect ? view.units.find((u) => u.id === inspect) ?? null : null;
  const stage = { c: campaignNo, s: stageId };
  // Màn rộng: chiến trường bên trái, bảng lệnh và thẻ đơn vị bên phải nên lệnh luôn trong tầm nhìn; màn hẹp: xếp dọc, chiến trường thấp để lệnh nằm ngay dưới
  const wide = width >= 1000;
  const maxH = wide ? Math.max(260, height - 215) : Math.max(180, height - 430);
  const fieldW = wide ? Math.round(Math.min(Math.min(width - 24, 1320) - 330, maxH * TACTICS_ASPECT)) : undefined;
  const field = <GameViewport kind="tactics" bridge={bridge} aspect={TACTICS_ASPECT} label={`Chiến trường: ${view.title}`} maxHeight={wide ? undefined : maxH} />;
  const commands = (
    <Panel style={{ gap: 10 }} testID="tactics-commands">
      {ask && view.stratagem ? (
        <View style={{ gap: 8 }}>
          <Txt f="heavy" size={16} color={s.ink}>Mưu kế: {view.stratagem.name}</Txt>
          <Txt size={14} color={s.sub}>{view.stratagem.text}</Txt>
          <Txt f="bold" size={15} color={s.ink}>{view.stratagem.prompt}</Txt>
          {view.stratagem.options.map((o, i) => <GameBtn key={o.id} title={o.text} tone="white" full disabled={busy} onPress={() => { void send({ type: 'stratagem', answer: o.id }); }} testID={`stratagem-${i + 1}`} />)}
          <GameBtn title="Để sau" icon={X} tone="white" size="sm" onPress={() => setAsk(false)} testID="stratagem-cancel" />
        </View>
      ) : mode !== 'idle' ? (
        <View style={{ gap: 8 }}>
          <Txt f="heavy" size={16} color={s.ink}>{mode === 'attack' ? 'Chọn mục tiêu để tấn công' : `Chọn mục tiêu cho “${actor?.skill?.name ?? 'kỹ năng'}”`}</Txt>
          <Txt size={13} color={s.sub}>Bấm vào đơn vị có vòng đỏ trên chiến trường, hoặc chọn trong danh sách.</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {targets.map((id, i) => { const u = view.units.find((x) => x.id === id); return u ? <GameBtn key={id} title={`${i + 1}. ${u.name} (${u.hp}/${u.max_hp})`} tone={u.side === 'enemy' ? 'red' : 'green'} size="sm" onPress={() => { void send(mode === 'attack' ? { type: 'attack', target: id } : { type: 'skill', target: id }); }} testID={`target-${id}`} /> : null; })}
            <GameBtn title="Hủy" icon={X} tone="white" size="sm" onPress={() => choose('idle')} testID="target-cancel" />
          </View>
        </View>
      ) : actor && view.actor ? (
        <View style={{ gap: 8 }}>
          <Txt f="heavy" size={16} color={s.ink} accessibilityLiveRegion="polite">Lượt của {actor.name} ({actor.cls_label})</Txt>
          <View style={wide ? { gap: 8 } : { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <GameBtn title="Tấn công" icon={Swords} tone="red" full={wide} disabled={!canAct || !view.actor.attack_targets.length} onPress={() => choose('attack')} testID="cmd-attack" label="Tấn công (phím A)" />
            <GameBtn title="Phòng thủ (+1 lương)" icon={Shield} tone="blue" full={wide} disabled={!canAct} onPress={() => { void send({ type: 'defend' }); }} testID="cmd-defend" label="Phòng thủ, giảm nửa sát thương và thêm 1 quân lương (phím D)" />
            {actor.skill && skill ? <GameBtn title={`${actor.skill.name} (−${actor.skill.cost} lương)`} icon={Sparkles} tone="purple" full={wide} disabled={!canAct || !skill.usable} onPress={castSkill} testID="cmd-skill" label={`Kỹ năng ${actor.skill.name} (phím S)${skill.why ? `: ${skill.why}` : ''}`} /> : null}
            {view.stratagem?.state === 'ready' ? <GameBtn title={`Mưu kế: ${view.stratagem.name}`} icon={Lightbulb} tone="yellow" full={wide} disabled={!canAct} onPress={() => setAsk(true)} testID="cmd-stratagem" /> : null}
          </View>
          {skill && !skill.usable && skill.why ? <Txt size={13} color={s.sub}>Kỹ năng: {skill.why}</Txt> : null}
        </View>
      ) : (
        <Txt f="bold" size={15} color={s.sub}>{view.status === 'active' ? 'Đang diễn ra lượt đánh…' : 'Trận đánh đã kết thúc.'}</Txt>
      )}
    </Panel>
  );
  const cards = (
    <>
      {actor ? <UnitCard u={actor} title="ĐANG RA LỆNH" /> : null}
      {shown && shown.id !== actor?.id ? <UnitCard u={shown} title="ĐANG XEM" /> : null}
    </>
  );
  return (
    <View style={{ flex: 1, backgroundColor: s.dark ? '#0d1730' : '#e3f2ff' }} testID="saga-battle">
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 1320, gap: 10 }}>
          <ScreenHead title={view.title} subtitle={view.objective_text} onBack={() => nav.go('chien-dich', { ...stage, v: 'kham-pha' }, 'replace')} backLabel="Rời trận, về phần nhập vai" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <Pill text={`Vòng ${view.round}/${view.max_rounds}`} bg={SG.navy} />
            <Pill text={`Quân lương: ${view.supply.ally}`} icon={Wheat} bg="#fff3c9" fg="#7a5a00" />
            <Pill text={`Hiểu bài ${view.knowledge}%${view.knowledge >= 90 ? ': +2 lương, +10% sức đánh' : view.knowledge >= 70 ? ': +1 lương' : ''}`} icon={BookOpen} bg={s.card} fg={s.ink} />
            <Txt f="bold" size={12} color={s.sub}>Lượt kế tiếp:</Txt>
            {view.queue.slice(0, wide ? 6 : 4).map((id, i) => { const u = view.units.find((x) => x.id === id); return u ? <Pill key={`${id}${i}`} text={`${i + 1}. ${u.name}`} bg={u.side === 'ally' ? '#e2f7e6' : '#ffe3e3'} fg={u.side === 'ally' ? '#156b2c' : '#a31f1f'} size={12} /> : null; })}
          </View>
          {wide ? (
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <View style={{ width: fieldW }}>{field}</View>
              <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
                <Flash text={flash} />
                {commands}
                {cards}
              </View>
            </View>
          ) : (
            <>
              {field}
              <Flash text={flash} />
              {commands}
              {cards}
            </>
          )}
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: 10, alignItems: 'flex-start' }}>
            <View style={wide ? { flex: 1 } : { alignSelf: 'stretch' }}><LogBox lines={log} /></View>
            <Panel pad={12} style={[{ gap: 3 }, wide ? { flex: 1 } : { alignSelf: 'stretch' }]}>
              <Txt f="heavy" size={13} color={s.sub}>BỐI CẢNH VÀ MẸO</Txt>
              <Txt size={13} color={s.ink}>{view.intro}</Txt>
              {view.tips.map((t) => <Txt key={t} size={13} color={s.sub}>• {t}</Txt>)}
              <Txt size={12} color={s.sub}>Chỉ số, sinh lực và kỹ năng là phần sáng tạo của trò chơi để minh họa thế trận; diễn biến lịch sử nằm ở phần tổng kết.</Txt>
            </Panel>
          </View>
        </View>
      </ScrollView>
      {finished ? (
        <ResultPanel finished={finished} reasonText={!finished.won ? LOSE_REASON[view.reason ?? ''] ?? null : null} tips={view.tips}
          onContinue={() => nav.go('chien-dich', { ...stage, v: 'kham-pha' }, 'replace')} onRetry={() => onAgain(true)}
          onLesson={() => nav.go('chien-dich', { ...stage, v: 'hoc' }, 'replace')} onStage={() => nav.go('chien-dich', { ...stage, v: null }, 'replace')} />
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------------------- màn Bạch Đằng 1288
const BD_STATE: Record<BdUnit['state'], string> = { wait: 'chưa tới', free: 'cơ động', slow: 'mắc cạn', stuck: 'vướng cọc', sunk: 'đã chìm', escaped: 'đã thoát', blocked: 'bị cọc chắn' };
const PHASES: Array<{ id: 'prepare' | 'lure' | 'counter'; label: string }> = [{ id: 'prepare', label: 'Đóng cọc lòng sông' }, { id: 'lure', label: 'Nhử địch vào trận' }, { id: 'counter', label: 'Phản công khi nước rút' }];
const TIDE_ICON = [ArrowDown, Minus, ArrowUp];
const TIDE_COLOR = ['#f4b942', '#7fbdf0', '#2f7fd8'];
const sameCell = (a: XY, x: number, y: number): boolean => a[0] === x && a[1] === y;

function bdLine(e: BdEvent, name: (id?: string) => string): string | null {
  switch (e.t) {
    case 'tide': return `Con nước: ${e.label}`;
    case 'reveal': case 'warn': case 'blocked': return e.text ?? null;
    case 'stake': return 'Đóng một cụm cọc trên bãi cạn';
    case 'unstake': return 'Nhổ một cụm cọc';
    case 'phase': return e.phase === 'lure' ? '— Giai đoạn 2: nhử địch —' : e.phase === 'counter' ? '— Giai đoạn 3: nước rút, phản công —' : null;
    case 'provoke': return `Thuyền nhẹ khiêu chiến: ${(e.units ?? []).map((u) => name(u)).join(', ')} đuổi theo`;
    case 'attack': return `${name(e.unit)} đánh ${name(e.target)}: −${e.dmg}`;
    case 'stuck': return `${name(e.unit)} vướng cọc khi nước rút: −${e.dmg}`;
    case 'slow': return `${name(e.unit)} mắc cạn trên bãi`;
    case 'refloat': return `${name(e.unit)} lết được ra lạch sâu`;
    case 'fire': return e.ok ? `Bè lửa trúng ${name(e.target)}: −${e.dmg}` : `Bè lửa không trúng ${name(e.target)}. ${e.text ?? ''}`;
    case 'burn': return `${name(e.unit)} bốc cháy: −${e.dmg}`;
    case 'arrows': return `Cung nỏ hai bờ bắn ${name(e.target)}: −${e.dmg}`;
    case 'sunk': return `${name(e.unit)} bị đánh chìm`;
    case 'escape': return `${name(e.unit)} chạy thoát ra biển`;
    default: return null;
  }
}

const BachDangHost: React.FC<HostProps<BdView>> = ({ session, nav, stageId, campaignNo, initial, onAgain }) => {
  const s = useSaga();
  const { height, width } = useWindowDimensions();
  const bridge = useMemo(() => { const b = new GameBridge(); b.set('bd:view', initial); b.set('bd:mode', { kind: initial.phase === 'prepare' ? 'stake' : initial.phase === 'lure' ? 'lure' : 'none' }); return b; }, [initial]);
  const ctx = useLatest({ session, nav, onAgain });
  const [view, setView] = useState(initial);
  const viewRef = useRef(initial);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const ready = useRef(false);
  const pending = useRef<{ view: BattleSession & BdView; finished: BattleFinished | null } | null>(null);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const selRef = useRef<string | null>(null);
  selRef.current = sel;
  const [dest, setDest] = useState<XY | null>(null);
  const [finished, setFinished] = useState<BattleFinished | null>(null);
  const [rules, setRules] = useState(initial.phase === 'prepare' && initial.turn === 0);
  const [flash, setFlash] = useFlash(6000);
  const [log, setLog] = useState<string[]>(() => (initial.events ?? []).map((e) => bdLine(e as BdEvent, (id) => initial.units.find((u) => u.id === id)?.name ?? 'Thuyền')).filter((l): l is string => Boolean(l)));

  const commit = useCallback((): void => {
    if (watchdog.current) { clearTimeout(watchdog.current); watchdog.current = null; }
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    viewRef.current = p.view; setView(p.view); bridge.set('bd:view', p.view);
    if (p.finished) { setFinished(p.finished); play(p.finished.won ? 'win' : 'lose'); if (p.finished.xp) ctx.current.nav.refresh(); }
    busyRef.current = false; setBusy(false);
  }, [bridge, ctx]);

  const send = useCallback(async (action: Record<string, unknown>): Promise<void> => {
    const cur = viewRef.current;
    if (busyRef.current || cur.status !== 'active') return;
    busyRef.current = true; setBusy(true); setSel(null); setDest(null);
    try {
      const res = await saga.act<BattleSession & BdView, { events: BdEvent[] }, BattleFinished>(ctx.current.session.token, cur.session_id, cur.seq, action);
      pending.current = { view: res.view, finished: res.finished };
      if (res.completion?.first) ctx.current.nav.setReward({ stageId, completion: res.completion });
      const events = res.replayed ? [] : res.outcome.events;
      const lines = events.map((e) => bdLine(e, (id) => res.view.units.find((u) => u.id === id)?.name ?? 'Thuyền')).filter((l): l is string => Boolean(l));
      if (lines.length) setLog((l) => [...l, ...lines].slice(-40));
      const warn = events.find((e) => e.t === 'warn' || e.t === 'blocked' || (e.t === 'fire' && !e.ok));
      if (warn?.text) setFlash(warn.text);
      if (ready.current && events.length) {
        bridge.emit('bd:play', { events, view: res.view });
        watchdog.current = setTimeout(commit, 6000 + events.length * 1500);
      } else commit();
    } catch (e) {
      if (statusOf(e) === 401) ctx.current.session.expired();
      else if (statusOf(e) === 409) ctx.current.onAgain(false);
      setFlash(errorMessage(e));
      busyRef.current = false; setBusy(false);
    }
  }, [bridge, commit, ctx, setFlash, stageId]);

  // ý nghĩa của cú bấm vào ô thay đổi theo giai đoạn
  const onCell = useCallback((p: { x: number; y: number; unit: string | null }): void => {
    const v = viewRef.current;
    if (busyRef.current || v.status !== 'active' || !v.options) return;
    if ('stakeable' in v.options) {
      void send({ type: v.options.removable.some((c) => sameCell(c, p.x, p.y)) ? 'unstake' : 'stake', at: [p.x, p.y] });
    } else if ('moves' in v.options) {
      if (v.options.moves.some((m) => sameCell(m.to, p.x, p.y))) void send({ type: 'move', to: [p.x, p.y] });
      else setFlash('Thuyền nhẹ không tới được ô này trong một lượt. Hãy chọn một ô được tô sáng.');
    } else if ('allies' in v.options) {
      const ally = p.unit ? v.options.allies.find((a) => a.unit === p.unit) : undefined;
      const cur = selRef.current;
      if (ally && ally.unit !== cur) { setSel(ally.unit); setDest(null); play('tap'); return; }
      const mine = cur ? v.options.allies.find((a) => a.unit === cur) : undefined;
      const move = mine?.moves.find((m) => sameCell(m.to, p.x, p.y));
      if (!mine) { setFlash('Hãy chọn một cánh quân của ta trước (bấm vào thuyền hoặc nút tên cánh quân).'); return; }
      const foe = p.unit ? v.units.find((u) => u.id === p.unit && u.side === 'enemy') : undefined;
      if (foe) {
        // bấm thẳng vào thuyền địch: cánh quân đang chọn tự áp sát bằng đường ngắn nhất rồi đánh; nếu chỉ thả bè lửa tới được thì chờ người chơi xác nhận (bè lửa có hạn)
        const me = v.units.find((u) => u.id === mine.unit);
        const near = (list: typeof mine.moves): (typeof mine.moves)[number] | undefined => [...list].sort((a, b) => (Math.abs(a.to[0] - (me?.x ?? 0)) + Math.abs(a.to[1] - (me?.y ?? 0))) - (Math.abs(b.to[0] - (me?.x ?? 0)) + Math.abs(b.to[1] - (me?.y ?? 0))))[0];
        const hit = near(mine.moves.filter((m) => m.attack.includes(foe.id)));
        if (hit) { void send({ type: 'order', unit: mine.unit, to: hit.to, attack: foe.id }); return; }
        const burn = near(mine.moves.filter((m) => m.fire.includes(foe.id)));
        if (burn) { setDest(burn.to); play('tap'); return; }
        setFlash(`${foe.name} ở ngoài tầm của cánh quân đang chọn trong lượt này.`);
        return;
      }
      if (!move) { setFlash('Cánh quân này không tới được ô đó: thuyền không đi qua bãi cọc đã lộ, ghềnh đá hay thuyền khác.'); return; }
      if (move.attack.length || move.fire.length) { setDest(move.to); play('tap'); } else void send({ type: 'order', unit: mine.unit, to: move.to });
    }
  }, [send, setFlash]);

  useEffect(() => {
    const offs = [
      bridge.on('bd:ready', () => { ready.current = true; }),
      bridge.on('bd:played', () => commit()),
      bridge.on('bd:event', (e: BdEvent) => { if (e.t === 'attack' || e.t === 'stuck' || e.t === 'arrows' || (e.t === 'fire' && e.ok)) play('hit'); }),
      bridge.on('bd:cell', onCell),
    ];
    return () => { offs.forEach((off) => off()); if (watchdog.current) clearTimeout(watchdog.current); };
  }, [bridge, commit, onCell]);

  useEffect(() => {
    bridge.set('bd:mode', busy || view.status !== 'active' ? { kind: 'none' } : view.phase === 'prepare' ? { kind: 'stake' } : view.phase === 'lure' ? { kind: 'lure' } : sel ? { kind: 'ally', unit: sel } : { kind: 'none' });
  }, [bridge, busy, sel, view.phase, view.status]);

  const opt = view.options;
  const prepare = opt && 'stakeable' in opt ? opt : null, lure = opt && 'moves' in opt ? opt : null, counter = opt && 'allies' in opt ? opt : null;
  const phaseIndex = view.phase === 'done' ? 3 : PHASES.findIndex((p) => p.id === view.phase);
  const unitOf = (id: string): BdUnit | undefined => view.units.find((u) => u.id === id);
  const picked = sel && counter ? counter.allies.find((a) => a.unit === sel) ?? null : null;
  const self = sel ? unitOf(sel) : undefined;
  const destMove = picked && dest ? picked.moves.find((m) => sameCell(m.to, dest[0], dest[1])) ?? null : null;
  const TideIcon = TIDE_ICON[view.tide.level] ?? Minus;
  const stage = { c: campaignNo, s: stageId };
  const off = busy || view.status !== 'active';
  // Màn rộng: khúc sông bên trái; con nước, giai đoạn và bảng lệnh bên phải. Màn hẹp: xếp dọc, khúc sông ngay trên bảng lệnh
  const wide = width >= 1000;
  const maxH = wide ? Math.max(260, height - 185) : Math.max(180, height - 330);
  const fieldW = wide ? Math.round(Math.min(Math.min(width - 24, 1320) - 330, maxH * BD_ASPECT)) : undefined;
  const field = <GameViewport kind="bachdang" bridge={bridge} aspect={BD_ASPECT} label="Khúc sông Bạch Đằng chia ô: bấm vào ô để ra lệnh; trên bàn phím dùng phím mũi tên để chọn ô, phím E để ra lệnh" maxHeight={wide ? undefined : maxH} />;
  const tide = (
    <Panel pad={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} testID="bd-tide">
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: TIDE_COLOR[view.tide.level] ?? SG.blue, alignItems: 'center', justifyContent: 'center' }}><TideIcon size={24} color="#ffffff" strokeWidth={3} /></View>
      <View>
        <Txt f="heavy" size={12} color={s.sub}>THỦY TRIỀU</Txt>
        <Txt f="heavy" size={17} color={s.ink} accessibilityLiveRegion="polite">{view.tide.label}</Txt>
      </View>
      <View accessible accessibilityLabel={`Dự báo con nước các lượt tới: ${view.tide.forecast.map((f) => f.label).join(', ')}`} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 44, marginLeft: 6 }}>
        {view.tide.forecast.map((f, i) => (
          <View key={i} style={{ alignItems: 'center', gap: 2 }}>
            <View style={{ width: 16, height: 10 + f.level * 13, borderRadius: 4, backgroundColor: TIDE_COLOR[f.level] ?? SG.blue, borderWidth: i === 0 ? 2 : 0, borderColor: s.ink }} />
            <View style={{ width: 8, height: 4, borderRadius: 2, backgroundColor: f.phase === 'counter' ? SG.red : f.phase === 'lure' ? SG.yellow : '#9aa5bd' }} />
          </View>
        ))}
      </View>
    </Panel>
  );
  const phases = (
    <View accessibilityRole="list" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }} testID="bd-phases">
      {PHASES.map((p, i) => {
        const done = i < phaseIndex, on = i === phaseIndex;
        return (
          <View key={p.id} accessibilityRole="listitem" accessibilityLabel={`Giai đoạn ${i + 1}: ${p.label}${done ? ', đã xong' : on ? ', đang làm' : ''}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: on ? SG.yellow : s.card, borderRadius: 999, borderWidth: 2, borderColor: done ? SG.green : on ? SG.yellowEdge : s.line, paddingHorizontal: 10, paddingVertical: 5 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: done ? SG.green : SG.navy, alignItems: 'center', justifyContent: 'center' }}>
              {done ? <Check size={13} color="#ffffff" strokeWidth={3.6} /> : <Txt f="heavy" size={12} color="#ffffff">{i + 1}</Txt>}
            </View>
            <Txt f="heavy" size={13} color={on ? SG.onYellow : s.ink}>{p.label}</Txt>
          </View>
        );
      })}
    </View>
  );
  const briefing = view.briefing ? <Panel pad={10} style={{ flexDirection: 'row', gap: 8 }}><Flag size={18} color={SG.red} strokeWidth={2.6} style={{ marginTop: 2 }} /><Txt f="bold" size={14} color={s.ink} style={{ flex: 1 }}>{view.briefing}</Txt></Panel> : null;
  const commands = (
    <Panel style={{ gap: 10 }} testID="bd-commands">
      {prepare ? (
        <>
          <Txt f="heavy" size={16} color={s.ink}>{prepare.can_stake ? 'Nước thấp: bấm vào bãi cạn (ô viền xanh) để đóng cọc, bấm lại để nhổ' : 'Nước chưa đủ thấp để đóng cọc: hãy chờ con nước'}</Txt>
          <Txt size={14} color={s.sub}>Còn {view.stakes_left} cụm cọc · con nước này còn đóng được {view.stakes_turn_left} cụm · còn {prepare.turns_left} lượt chuẩn bị.</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <GameBtn title="Chờ con nước" icon={SkipForward} tone="blue" disabled={off || prepare.turns_left <= 0} onPress={() => { void send({ type: 'wait' }); }} testID="bd-wait" />
            <GameBtn title="Sẵn sàng nhử địch" icon={Check} tone="green" disabled={off} onPress={() => { void send({ type: 'ready' }); }} testID="bd-ready" />
          </View>
        </>
      ) : lure ? (
        <>
          <Txt f="heavy" size={16} color={s.ink}>Khiêu chiến rồi lui thuyền dẫn địch qua bãi cọc</Txt>
          <Txt size={14} color={s.sub}>Bấm ô vàng để lui thuyền nhẹ; ô đỏ là nơi sẽ bị đánh trúng. Bóng mờ cho biết thuyền địch sẽ tới đâu sau lượt đó. Thuyền địch bám theo vệt nước của thuyền nhẹ. Còn {lure.turns_left} lượt nước cao.</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <GameBtn title="Khiêu chiến" icon={Flame} tone="red" disabled={off || !lure.provoke} onPress={() => { void send({ type: 'provoke' }); }} testID="bd-provoke" label={lure.provoke ? 'Khiêu chiến các thuyền địch trong tầm' : 'Khiêu chiến: chưa có thuyền địch trong tầm hoặc cả đoàn đã đuổi theo'} />
            <GameBtn title="Chờ một lượt" icon={SkipForward} tone="blue" disabled={off} onPress={() => { void send({ type: 'wait' }); }} testID="bd-wait" />
          </View>
        </>
      ) : counter ? (
        <>
          <Txt f="heavy" size={16} color={s.ink}>{picked && self ? (destMove ? `Lệnh cho ${self.name} tại ô đã chọn` : `${self.name}: bấm ô vàng / cam để tiến (ô cam áp sát được thuyền địch)`) : 'Chọn một cánh quân rồi ra lệnh'}</Txt>
          <Txt size={14} color={s.sub}>Đánh áp mạn thuyền đang vướng cọc gây thêm một nửa sát thương; bè lửa chỉ trúng thuyền đã vướng cọc hoặc mắc cạn. Còn {counter.turns_left} lượt nước ròng.</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {view.units.filter((u) => u.side === 'ally').map((u) => {
              const can = counter.allies.some((a) => a.unit === u.id);
              return <GameBtn key={u.id} title={`${u.name}${u.fire ? ` · ${u.fire} bè lửa` : ''}`} icon={Anchor} tone={sel === u.id ? 'yellow' : 'white'} size="sm" disabled={off || !can} onPress={() => { setSel(u.id); setDest(null); }} testID={`bd-ally-${u.id}`}
                label={`${u.name}: ${can ? 'chọn để ra lệnh' : u.acted ? 'đã ra lệnh lượt này' : BD_STATE[u.state]}`} />;
            })}
          </View>
          {picked && self ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {destMove ? (
                <>
                  {destMove.attack.map((id) => <GameBtn key={`a${id}`} title={`Đánh ${unitOf(id)?.name ?? ''}`} icon={Swords} tone="red" size="sm" disabled={off} onPress={() => { void send({ type: 'order', unit: picked.unit, to: destMove.to, attack: id }); }} testID={`bd-attack-${id}`} />)}
                  {destMove.fire.map((id) => <GameBtn key={`f${id}`} title={`Thả bè lửa vào ${unitOf(id)?.name ?? ''}`} icon={Flame} tone="orange" size="sm" disabled={off} onPress={() => { void send({ type: 'order', unit: picked.unit, to: destMove.to, fire: id }); }} testID={`bd-fire-${id}`} />)}
                  <GameBtn title={self.x === destMove.to[0] && self.y === destMove.to[1] ? 'Giữ vị trí (xong lượt)' : 'Chỉ di chuyển'} tone="white" size="sm" disabled={off} onPress={() => { void send({ type: 'order', unit: picked.unit, to: destMove.to }); }} testID="bd-move-only" />
                  <GameBtn title="Chọn ô khác" icon={X} tone="white" size="sm" onPress={() => setDest(null)} testID="bd-redo" />
                </>
              ) : (
                <GameBtn title="Đứng yên tại chỗ" tone="white" size="sm" disabled={off} onPress={() => setDest([self.x, self.y])} testID="bd-stay" />
              )}
            </View>
          ) : null}
          <GameBtn title="Kết thúc lượt" icon={SkipForward} tone="blue" disabled={off} onPress={() => { void send({ type: 'end_turn' }); }} testID="bd-end-turn" />
        </>
      ) : (
        <Txt f="bold" size={15} color={s.sub}>{view.status === 'active' ? 'Đang diễn ra…' : 'Trận đánh đã kết thúc.'}</Txt>
      )}
    </Panel>
  );
  return (
    <View style={{ flex: 1, backgroundColor: s.dark ? '#0d1730' : '#dff1ff' }} testID="saga-bachdang">
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 1320, gap: 10 }}>
          <ScreenHead title={view.title} subtitle={view.stage ? `${view.stage.place} · ${view.stage.date_label}` : undefined} onBack={() => nav.go('chien-dich', { ...stage, v: 'kham-pha' }, 'replace')} backLabel="Rời trận, về phần nhập vai" />
          {wide ? (
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <View style={{ width: fieldW }}>{field}</View>
              <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
                {tide}
                {phases}
                <Flash text={flash} />
                {commands}
                {briefing}
              </View>
            </View>
          ) : (
            <>
              {tide}
              {phases}
              {briefing}
              {field}
              <Flash text={flash} />
              {commands}
            </>
          )}
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: 10, alignItems: 'flex-start' }}>
        <Panel pad={12} style={[{ gap: 4 }, wide ? { flex: 1 } : { alignSelf: 'stretch' }]} testID="bd-units">
          <Txt f="heavy" size={13} color={s.sub}>LỰC LƯỢNG</Txt>
          {view.units.map((u) => (
            <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: u.side === 'ally' ? SG.green : SG.red }} />
              <Txt f="bold" size={13} color={s.ink} style={{ flex: 1 }} numberOfLines={1}>{u.name}{u.flagship ? ' (thuyền chỉ huy)' : u.key ? ' (chủ lực)' : ''}</Txt>
              <Txt size={13} color={s.sub}>{u.hp}/{u.max_hp} · {BD_STATE[u.state]}{u.burn > 0 ? ' · đang cháy' : ''}</Txt>
            </View>
          ))}
        </Panel>
            <View style={[{ gap: 10 }, wide ? { flex: 1 } : { alignSelf: 'stretch' }]}>
              <LogBox lines={log} />
              <Panel pad={12} style={{ gap: 4 }}>
                <Txt f="bold" size={13} color={s.ink}>{view.intro}</Txt>
                <Txt size={13} color={s.sub}>Chọn ô: bấm hoặc chạm vào khúc sông; trên bàn phím dùng phím mũi tên hoặc W A S D để di chuyển ô chọn, phím E để chọn ô.</Txt>
                <GameBtn title={rules ? 'Ẩn luật chơi' : 'Xem luật chơi'} icon={BookOpen} tone="white" size="sm" onPress={() => setRules((v) => !v)} testID="bd-rules" />
                {rules ? view.rules.map((r) => <Txt key={r} size={13} color={s.ink}>• {r}</Txt>) : null}
                <Txt size={12} color={s.sub}>Lưới ô, số lượt, sinh lực và sát thương là mô hình dạy học của trò chơi, không phải số liệu lịch sử.</Txt>
              </Panel>
            </View>
          </View>
        </View>
      </ScrollView>
      {finished ? (
        <ResultPanel finished={finished} reasonText={finished.won ? `Vướng cọc: ${finished.stranded ?? 0} đoàn thuyền · thoát: ${finished.escaped ?? 0}` : null} tips={[]}
          onContinue={() => nav.go('chien-dich', { ...stage, v: 'kham-pha' }, 'replace')} onRetry={() => onAgain(true)}
          onLesson={() => nav.go('chien-dich', { ...stage, v: 'hoc' }, 'replace')} onStage={() => nav.go('chien-dich', { ...stage, v: null }, 'replace')} />
      ) : null}
    </View>
  );
};
