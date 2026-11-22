/**
 * Hành trình Đông A – phần chơi trong game Phaser: nhập vai khám phá, trận đánh theo lượt và màn Bạch Đằng 1288.
 * Mỗi màn chỉ có một GameViewport (một game Phaser). Giao diện React giữ phần chữ, nút lệnh và hộp thoại (thẻ, nút và nhãn của các cổng quản trị);
 * cảnh game lo di chuyển, hoạt ảnh và chọn ô / chọn đơn vị. Hai bên trao đổi qua GameBridge theo sự kiện. Mọi lệnh đi tới máy chủ kèm mã lệnh và số thứ tự;
 * máy chủ quyết định kết quả, giao diện chỉ dựng lại từ sự kiện trả về.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { Anchor, ArrowDown, ArrowUp, BookOpen, Check, Flag, Flame, Footprints, Lightbulb, Minus, Play, RotateCcw, Shield, SkipForward, Sparkles, Swords, Wheat, X } from 'lucide-react-native';
import * as saga from '@/lib/saga-api';
import { errorMessage } from '@/api/client';
import type { Session } from '@/components/auth';
import { GameViewport } from '@/components/portal/GameViewport';
import { WorldScreen } from '@/components/portal/WorldScreen';
import { WorldEmbed } from '@/components/portal/WorldViewport';
import { BlockTitle, Flash, LoadState, Meter, OptionButton, SagaHeader, SagaPage, StarRow, num, useFlash, useKeys, type SagaNav } from '@/components/portal/SagaKit';
import { Btn, Card, Chip, InfoNote, Inset, Sheet, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { GameBridge } from '@/game/bridge';
import { play } from '@/lib/saga-sound';
import { isWorldSession, type BattleFinished, type BattleSession, type BdEvent, type BdUnit, type BdView, type TacticsEvent, type TacticsUnit, type TacticsView, type WorldSession, type XY } from '@/types/saga';

const TACTICS_ASPECT = 960 / 540;
const BD_ASPECT = 960 / 520;
type StageProps = { session: Session; nav: SagaNav; stageId: number; campaignNo: number };
const statusOf = (e: unknown): number | undefined => (e as { status?: number }).status;
/** Giá trị mới nhất của props cho các hàm xử lý sự kiện: hàm giữ nguyên danh tính nên không phải đăng ký lại với cảnh game mỗi lần giao diện vẽ lại */
function useLatest<T>(value: T): React.MutableRefObject<T> { const ref = useRef(value); ref.current = value; return ref; }
/** Thẻ viền mảnh của các trang quản trị */
const Box: React.FC<{ children: React.ReactNode; pad?: number; style?: object; testID?: string }> = ({ children, pad = 12, style, testID }) => <Card flat pad={pad} style={{ borderRadius: 12, ...style }} testID={testID}>{children}</Card>;

// ---------------------------------------------------------------------- nhập vai khám phá

/**
 * Bước Nhập vai (21/11/2026): cả 13 chặng mở thế giới khối vuông 3D chơi chung cùng lớp (WorldScreen); cảnh nhập vai 2D cũ đã gỡ khỏi giao diện theo yêu cầu
 * "xóa 9 chặng còn lại vẫn dùng cảnh nhập vai 2D" (dữ liệu cũ trong cơ sở dữ liệu giữ nguyên, không xóa). Màn này chỉ nạp / tải lại phiên của máy chủ.
 */
export const ExploreScreen: React.FC<StageProps> = ({ session, nav, stageId, campaignNo }) => {
  const ctx = useLatest({ session, nav });
  const [world, setWorld] = useState<WorldSession | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const restart = useRef(false);
  // ứng dụng gốc: trang website trong WebView tự mở phiên (không tạo hai phiên)
  const native = Platform.OS !== 'web';
  useEffect(() => {
    if (native) return undefined;
    let live = true;
    setLoading(true); setError(null); setMissing(false);
    saga.startExplore(session.token, stageId, restart.current, ctx.current.nav.classId).then((v) => {
      if (!live) return;
      restart.current = false;
      if (isWorldSession(v)) setWorld(v); else { setWorld(null); setMissing(true); }
      setLoading(false);
    }).catch((e) => { if (!live) return; if (statusOf(e) === 401) ctx.current.session.expired(); setError(errorMessage(e)); setLoading(false); });
    return () => { live = false; };
  }, [ctx, native, session.token, stageId, round]);
  const back = (): void => nav.back('chien-dich', { c: campaignNo, s: stageId, v: null });
  if (native) return <WorldEmbed token={session.token} userId={session.user.id} schoolCode={session.user.school_code ?? null} classId={nav.classId ?? null} stageId={stageId} campaignNo={campaignNo} onBack={back} />;
  if (world) {
    return <WorldScreen key={world.session_id} session={session} nav={nav} stageId={stageId} campaignNo={campaignNo} initial={world}
      onRestart={() => { restart.current = true; setWorld(null); setRound((n) => n + 1); }} onReload={() => { setWorld(null); setRound((n) => n + 1); }} />;
  }
  return (
    <SagaPage testID="saga-explore" max={1060}>
      <SagaHeader title="Nhập vai" subtitle="Thế giới khối" back={{ label: 'Thông tin chặng', hint: 'Về bảng thông tin chặng', onPress: back }} />
      {missing ? <InfoNote>Chặng này chưa có nhiệm vụ thế giới khối. Em quay lại bảng thông tin chặng nhé.</InfoNote> : <LoadState loading={loading} error={error} onRetry={() => setRound((n) => n + 1)} />}
    </SagaPage>
  );
};

// ---------------------------------------------------------------------- trận đánh: nạp phiên rồi mở đúng kiểu trận
export const BattleScreen: React.FC<StageProps> = (p) => {
  const { session, nav, stageId, campaignNo } = p;
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
      <SagaPage testID="saga-battle" max={900}>
        <SagaHeader title="Trận đánh" back={{ label: 'Thông tin chặng', hint: 'Về bảng thông tin chặng', onPress: () => nav.back('chien-dich', { c: campaignNo, s: stageId, v: null }) }} />
        <LoadState loading={loading} error={error} onRetry={() => again(false)} />
        {error ? <Btn title="Vào phần nhập vai" icon={Footprints} tone="son" onPress={() => nav.go('chien-dich', { c: campaignNo, s: stageId, v: 'kham-pha' }, 'replace')} testID="battle-to-explore" /> : null}
      </SagaPage>
    );
  }
  return sess.mode === 'bachdang'
    ? <BachDangHost key={sess.session_id} {...p} initial={sess as BattleSession & BdView} onAgain={again} />
    : <TacticsHost key={sess.session_id} {...p} initial={sess as BattleSession & TacticsView} onAgain={again} />;
};

type HostProps<V> = StageProps & { initial: BattleSession & V; onAgain: (fresh: boolean) => void };

const ResultSheet: React.FC<{ finished: BattleFinished; reasonText: string | null; tips: string[]; onContinue: () => void; onRetry: () => void; onLesson: () => void; onStage: () => void }> = ({ finished, reasonText, tips, onContinue, onRetry, onLesson, onStage }) => {
  const { c } = useTheme();
  const list = (title: string, items: string[], color: string, testID?: string): React.ReactElement => (
    <Inset style={{ gap: 4 }}>
      <View testID={testID} style={{ gap: 4 }}>
        <Txt f="bold" size={12} color={color} upper>{title}</Txt>
        {items.map((t) => <Txt key={t} size={14}>• {t}</Txt>)}
      </View>
    </Inset>
  );
  return (
    <Sheet open persistent onClose={onStage} title={finished.won ? 'Chiến thắng!' : 'Trận đánh chưa thắng'}
      footer={<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
        <Btn title="Về chặng" tone="giay" onPress={onStage} testID="battle-stage" />
        {finished.won ? <Btn title="Đánh lại" icon={RotateCcw} tone="giay" onPress={onRetry} testID="battle-retry" /> : <Btn title="Xem lại thẻ kiến thức" icon={BookOpen} tone="giay" onPress={onLesson} testID="battle-lesson" />}
        {finished.won ? <Btn title="Tiếp tục nhiệm vụ" icon={Play} tone="son" onPress={onContinue} testID="battle-continue" /> : <Btn title="Đánh lại" icon={RotateCcw} tone="son" onPress={onRetry} testID="battle-retry" />}
      </View>}>
      <View style={{ gap: 12 }} testID="battle-result">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {finished.won ? <StarRow n={finished.stars} size={26} /> : null}
          <Chip text={`${num(finished.score)} điểm trận`} icon={Swords} bg={c.adminCanvas} fg={c.muc} />
          {finished.xp ? <Chip text={`+${finished.xp} điểm kinh nghiệm`} icon={Sparkles} bg={c.thongNhat} fg={c.thongChu} /> : null}
        </View>
        {reasonText ? <Txt f="bold" size={15} color={finished.won ? c.mocChu : c.sonChu}>{reasonText}</Txt> : null}
        <Txt size={15}>{finished.text}</Txt>
        {finished.good?.length ? list('Làm tốt', finished.good, c.mocChu) : null}
        {finished.mistakes?.length ? list(finished.won ? 'Còn có thể tốt hơn' : 'Vì sao chưa thắng', finished.mistakes.map((m) => m.text), c.sonChu, 'battle-mistakes') : null}
        {!finished.won && tips.length ? list('Gợi ý', tips, c.vangChu) : null}
      </View>
    </Sheet>
  );
};

const LogBox: React.FC<{ lines: string[] }> = ({ lines }) => {
  const { c } = useTheme();
  return (
    <Box style={{ gap: 3, minHeight: 96 }}>
      <Txt f="bold" size={12} color={c.muc3} upper>Diễn biến</Txt>
      {lines.length ? lines.slice(-7).map((l, i) => <Txt key={`${i}${l}`} size={13}>{l}</Txt>) : <Txt size={13} color={c.muc3}>Chưa có diễn biến nào.</Txt>}
    </Box>
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
  const { c } = useTheme();
  const ally = u.side === 'ally';
  return (
    <Box style={{ gap: 4, borderLeftWidth: 4, borderLeftColor: ally ? c.moc : c.son }}>
      <Txt f="bold" size={12} color={c.muc3} upper>{title}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Txt f="bold" size={16}>{u.name}</Txt>
        <Chip text={`${u.cls_label} · ${u.row === 'front' ? 'hàng trước' : 'hàng sau'}`} bg={ally ? c.mocNhat : c.sonNhat} fg={ally ? c.mocChu : c.sonChu} />
      </View>
      <Meter value={u.hp / Math.max(1, u.max_hp)} color={ally ? c.moc : c.son} label={`Sinh lực của ${u.name}`} />
      <Txt f="semibold" size={13}>Sinh lực {u.hp}/{u.max_hp} · Công {u.atk} · Thủ {u.def} · Nhanh {u.spd}{u.ranged ? ' · bắn xa' : ''}</Txt>
      {u.skill ? <Txt size={13} color={c.muc2}>Kỹ năng “{u.skill.name}” (tốn {u.skill.cost} lương{u.cd > 0 ? `, còn hồi ${u.cd} vòng` : ''}): {u.skill.text}</Txt> : null}
      {u.guard || u.burn > 0 || u.fx.length ? <Txt size={13} color={c.muc2}>Trạng thái: {[u.guard ? 'đang phòng thủ' : null, u.burn > 0 ? 'đang cháy' : null, ...u.fx.map((f) => FX_TEXT[f] ?? f)].filter(Boolean).join(', ')}</Txt> : null}
    </Box>
  );
};

const TacticsHost: React.FC<HostProps<TacticsView>> = ({ session, nav, stageId, campaignNo, initial, onAgain }) => {
  const { c } = useTheme();
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
  // Màn rộng: chiến trường bên trái, bảng lệnh và thẻ đơn vị bên phải nên lệnh luôn trong tầm nhìn; màn hẹp: xếp dọc, chiến trường thấp để lệnh nằm ngay dưới.
  // Khung học sinh có thanh menu bên trái (từ 1000 px) nên bề ngang dành cho trang hẹp hơn cửa sổ khoảng 250 px.
  const pageW = Math.min(width >= 1000 ? width - 280 : width - 32, 1320);
  const wide = pageW >= 900;
  const maxH = wide ? Math.max(260, height - 260) : Math.max(180, height - 430);
  const fieldW = wide ? Math.round(Math.min(pageW - 330, maxH * TACTICS_ASPECT)) : undefined;
  const field = <GameViewport kind="tactics" bridge={bridge} aspect={TACTICS_ASPECT} label={`Chiến trường: ${view.title}`} maxHeight={wide ? undefined : maxH} />;
  const commands = (
    <Box style={{ gap: 10 }} testID="tactics-commands">
      {ask && view.stratagem ? (
        <View style={{ gap: 8 }}>
          <Txt f="bold" size={16}>Mưu kế: {view.stratagem.name}</Txt>
          <Txt size={14} color={c.muc2}>{view.stratagem.text}</Txt>
          <Txt f="semibold" size={15}>{view.stratagem.prompt}</Txt>
          {view.stratagem.options.map((o, i) => <OptionButton key={o.id} badge={String(i + 1)} text={o.text} disabled={busy} onPress={() => { void send({ type: 'stratagem', answer: o.id }); }} label={`Phương án ${i + 1}: ${o.text}`} testID={`stratagem-${i + 1}`} />)}
          <Btn title="Để sau" icon={X} tone="giay" size="sm" onPress={() => setAsk(false)} testID="stratagem-cancel" />
        </View>
      ) : mode !== 'idle' ? (
        <View style={{ gap: 8 }}>
          <Txt f="bold" size={16}>{mode === 'attack' ? 'Chọn mục tiêu để tấn công' : `Chọn mục tiêu cho “${actor?.skill?.name ?? 'kỹ năng'}”`}</Txt>
          <Txt size={13} color={c.muc2}>Bấm vào đơn vị có vòng đỏ trên chiến trường, hoặc chọn trong danh sách (phím 1, 2, 3…).</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {targets.map((id, i) => { const u = view.units.find((x) => x.id === id); return u ? <Btn key={id} title={`${i + 1}. ${u.name} (${u.hp}/${u.max_hp})`} tone={u.side === 'enemy' ? 'son' : 'giay'} size="sm" onPress={() => { void send(mode === 'attack' ? { type: 'attack', target: id } : { type: 'skill', target: id }); }} testID={`target-${id}`} /> : null; })}
            <Btn title="Hủy" icon={X} tone="giay" size="sm" onPress={() => choose('idle')} testID="target-cancel" />
          </View>
        </View>
      ) : actor && view.actor ? (
        <View style={{ gap: 8 }}>
          <Txt f="bold" size={16} accessibilityLiveRegion="polite">Lượt của {actor.name} ({actor.cls_label})</Txt>
          <View style={wide ? { gap: 8 } : { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Btn title="Tấn công" icon={Swords} tone="son" full={wide} disabled={!canAct || !view.actor.attack_targets.length} onPress={() => choose('attack')} testID="cmd-attack" label="Tấn công (phím A)" />
            <Btn title="Phòng thủ (+1 lương)" icon={Shield} tone="giay" full={wide} disabled={!canAct} onPress={() => { void send({ type: 'defend' }); }} testID="cmd-defend" label="Phòng thủ, giảm nửa sát thương và thêm 1 quân lương (phím D)" />
            {actor.skill && skill ? <Btn title={`${actor.skill.name} (−${actor.skill.cost} lương)`} icon={Sparkles} tone="giay" full={wide} disabled={!canAct || !skill.usable} onPress={castSkill} testID="cmd-skill" label={`Kỹ năng ${actor.skill.name} (phím S)${skill.why ? `: ${skill.why}` : ''}`} /> : null}
            {view.stratagem?.state === 'ready' ? <Btn title={`Mưu kế: ${view.stratagem.name}`} icon={Lightbulb} tone="giay" full={wide} disabled={!canAct} onPress={() => setAsk(true)} testID="cmd-stratagem" /> : null}
          </View>
          {skill && !skill.usable && skill.why ? <Txt size={13} color={c.muc2}>Kỹ năng: {skill.why}</Txt> : null}
        </View>
      ) : (
        <Txt f="semibold" size={15} color={c.muc2}>{view.status === 'active' ? 'Đang diễn ra lượt đánh…' : 'Trận đánh đã kết thúc.'}</Txt>
      )}
    </Box>
  );
  const cards = (
    <>
      {actor ? <UnitCard u={actor} title="Đang ra lệnh" /> : null}
      {shown && shown.id !== actor?.id ? <UnitCard u={shown} title="Đang xem" /> : null}
    </>
  );
  return (
    <SagaPage testID="saga-battle" max={1320}>
      <SagaHeader title={view.title} subtitle={view.objective_text} back={{ label: 'Rời trận', hint: 'Rời trận, về phần nhập vai', onPress: () => nav.go('chien-dich', { ...stage, v: 'kham-pha' }, 'replace') }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <Chip text={`Vòng ${view.round}/${view.max_rounds}`} bg={c.adminCanvas} fg={c.muc} />
        <Chip text={`Quân lương: ${view.supply.ally}`} icon={Wheat} bg={c.vangNhat} fg={c.vangChu} />
        <Chip text={`Hiểu bài ${view.knowledge}%${view.knowledge >= 90 ? ': +2 lương, +10% sức đánh' : view.knowledge >= 70 ? ': +1 lương' : ''}`} icon={BookOpen} bg={c.adminCanvas} fg={c.muc2} />
        <Txt f="semibold" size={12} color={c.muc3}>Lượt kế tiếp:</Txt>
        {view.queue.slice(0, wide ? 6 : 4).map((id, i) => { const u = view.units.find((x) => x.id === id); return u ? <Chip key={`${id}${i}`} text={`${i + 1}. ${u.name}`} bg={u.side === 'ally' ? c.mocNhat : c.sonNhat} fg={u.side === 'ally' ? c.mocChu : c.sonChu} /> : null; })}
      </View>
      {wide ? (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
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
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 12, alignItems: 'flex-start' }}>
        <View style={wide ? { flex: 1 } : { alignSelf: 'stretch' }}><LogBox lines={log} /></View>
        <Box style={wide ? { gap: 3, flex: 1 } : { gap: 3, alignSelf: 'stretch' }}>
          <Txt f="bold" size={12} color={c.muc3} upper>Bối cảnh và mẹo</Txt>
          <Txt size={13}>{view.intro}</Txt>
          {view.tips.map((t) => <Txt key={t} size={13} color={c.muc2}>• {t}</Txt>)}
          <Txt size={12} color={c.muc3}>Chỉ số, sinh lực và kỹ năng là phần sáng tạo của trò chơi để minh họa thế trận; diễn biến lịch sử nằm ở phần tổng kết.</Txt>
        </Box>
      </View>
      {finished ? (
        <ResultSheet finished={finished} reasonText={!finished.won ? LOSE_REASON[view.reason ?? ''] ?? null : null} tips={view.tips}
          onContinue={() => nav.go('chien-dich', { ...stage, v: 'kham-pha' }, 'replace')} onRetry={() => onAgain(true)}
          onLesson={() => nav.go('chien-dich', { ...stage, v: 'hoc' }, 'replace')} onStage={() => nav.go('chien-dich', { ...stage, v: null }, 'replace')} />
      ) : null}
    </SagaPage>
  );
};

// ---------------------------------------------------------------------- màn Bạch Đằng 1288
const BD_STATE: Record<BdUnit['state'], string> = { wait: 'chưa tới', free: 'cơ động', slow: 'mắc cạn', stuck: 'vướng cọc', sunk: 'đã chìm', escaped: 'đã thoát', blocked: 'bị cọc chắn' };
const PHASES: Array<{ id: 'prepare' | 'lure' | 'counter'; label: string }> = [{ id: 'prepare', label: 'Đóng cọc lòng sông' }, { id: 'lure', label: 'Nhử địch vào trận' }, { id: 'counter', label: 'Phản công khi nước rút' }];
const TIDE_ICON = [ArrowDown, Minus, ArrowUp];
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
  const { c } = useTheme();
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
      void send({ type: v.options.removable.some((cc) => sameCell(cc, p.x, p.y)) ? 'unstake' : 'stake', at: [p.x, p.y] });
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
  const tideColor = (level: number): string => [c.tho, c.thuyNhat, c.thuy][level] ?? c.thuy;
  const stage = { c: campaignNo, s: stageId };
  const off = busy || view.status !== 'active';
  // Màn rộng: khúc sông bên trái; con nước, giai đoạn và bảng lệnh bên phải. Màn hẹp: xếp dọc, khúc sông ngay trên bảng lệnh
  const pageW = Math.min(width >= 1000 ? width - 280 : width - 32, 1320);
  const wide = pageW >= 900;
  const maxH = wide ? Math.max(260, height - 230) : Math.max(180, height - 330);
  const fieldW = wide ? Math.round(Math.min(pageW - 330, maxH * BD_ASPECT)) : undefined;
  const field = <GameViewport kind="bachdang" bridge={bridge} aspect={BD_ASPECT} label="Khúc sông Bạch Đằng chia ô: bấm vào ô để ra lệnh; trên bàn phím dùng phím mũi tên để chọn ô, phím E để ra lệnh" maxHeight={wide ? undefined : maxH} />;
  const tide = (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} testID="bd-tide">
      <View style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: view.tide.level === 1 ? c.thuyNhat : tideColor(view.tide.level), alignItems: 'center', justifyContent: 'center' }}><TideIcon size={22} color={view.tide.level === 1 ? c.thuyChu : '#ffffff'} strokeWidth={2.6} /></View>
      <View>
        <Txt f="bold" size={12} color={c.muc3} upper>Thủy triều</Txt>
        <Txt f="bold" size={16} accessibilityLiveRegion="polite">{view.tide.label}</Txt>
      </View>
      <View accessible accessibilityLabel={`Dự báo con nước các lượt tới: ${view.tide.forecast.map((f) => f.label).join(', ')}`} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 42, marginLeft: 6 }}>
        {view.tide.forecast.map((f, i) => (
          <View key={i} style={{ alignItems: 'center', gap: 2 }}>
            <View style={{ width: 14, height: 10 + f.level * 12, borderRadius: 3, backgroundColor: f.level === 1 ? c.thuy : tideColor(f.level), opacity: f.level === 1 ? 0.55 : 1, borderWidth: i === 0 ? 2 : 0, borderColor: c.logoInk }} />
            <View style={{ width: 8, height: 4, borderRadius: 2, backgroundColor: f.phase === 'counter' ? c.son : f.phase === 'lure' ? c.dong : c.muc3 }} />
          </View>
        ))}
      </View>
    </Box>
  );
  const phases = (
    <View accessibilityRole="list" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }} testID="bd-phases">
      {PHASES.map((p, i) => {
        const done = i < phaseIndex, on = i === phaseIndex;
        return (
          <View key={p.id} accessibilityRole="listitem" accessibilityLabel={`Giai đoạn ${i + 1}: ${p.label}${done ? ', đã xong' : on ? ', đang làm' : ''}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: on ? c.adminTint : c.the, borderRadius: 6, borderWidth: 1, borderColor: done ? c.moc : on ? c.son : c.adminLine, paddingHorizontal: 10, paddingVertical: 5 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: done ? c.moc : on ? c.son : c.adminCanvas, alignItems: 'center', justifyContent: 'center' }}>
              {done ? <Check size={13} color="#ffffff" strokeWidth={3} /> : <Txt f="bold" size={12} color={on ? '#ffffff' : c.muc2}>{i + 1}</Txt>}
            </View>
            <Txt f={on ? 'bold' : 'semibold'} size={13}>{p.label}</Txt>
          </View>
        );
      })}
    </View>
  );
  const briefing = view.briefing ? <Box style={{ flexDirection: 'row', gap: 8 }}><Flag size={17} color={c.son} style={{ marginTop: 2 }} /><Txt f="semibold" size={14} style={{ flex: 1 }}>{view.briefing}</Txt></Box> : null;
  const commands = (
    <Box style={{ gap: 10 }} testID="bd-commands">
      {prepare ? (
        <>
          <Txt f="bold" size={16}>{prepare.can_stake ? 'Nước thấp: bấm vào bãi cạn (ô viền xanh) để đóng cọc, bấm lại để nhổ' : 'Nước chưa đủ thấp để đóng cọc: hãy chờ con nước'}</Txt>
          <Txt size={14} color={c.muc2}>Còn {view.stakes_left} cụm cọc · con nước này còn đóng được {view.stakes_turn_left} cụm · còn {prepare.turns_left} lượt chuẩn bị.</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Btn title="Chờ con nước" icon={SkipForward} tone="giay" disabled={off || prepare.turns_left <= 0} onPress={() => { void send({ type: 'wait' }); }} testID="bd-wait" />
            <Btn title="Sẵn sàng nhử địch" icon={Check} tone="son" disabled={off} onPress={() => { void send({ type: 'ready' }); }} testID="bd-ready" />
          </View>
        </>
      ) : lure ? (
        <>
          <Txt f="bold" size={16}>Khiêu chiến rồi lui thuyền dẫn địch qua bãi cọc</Txt>
          <Txt size={14} color={c.muc2}>Bấm ô vàng để lui thuyền nhẹ; ô đỏ là nơi sẽ bị đánh trúng. Bóng mờ cho biết thuyền địch sẽ tới đâu sau lượt đó. Thuyền địch bám theo vệt nước của thuyền nhẹ. Còn {lure.turns_left} lượt nước cao.</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Btn title="Khiêu chiến" icon={Flame} tone="son" disabled={off || !lure.provoke} onPress={() => { void send({ type: 'provoke' }); }} testID="bd-provoke" label={lure.provoke ? 'Khiêu chiến các thuyền địch trong tầm' : 'Khiêu chiến: chưa có thuyền địch trong tầm hoặc cả đoàn đã đuổi theo'} />
            <Btn title="Chờ một lượt" icon={SkipForward} tone="giay" disabled={off} onPress={() => { void send({ type: 'wait' }); }} testID="bd-wait" />
          </View>
        </>
      ) : counter ? (
        <>
          <Txt f="bold" size={16}>{picked && self ? (destMove ? `Lệnh cho ${self.name} tại ô đã chọn` : `${self.name}: bấm ô vàng / cam để tiến (ô cam áp sát được thuyền địch)`) : 'Chọn một cánh quân rồi ra lệnh'}</Txt>
          <Txt size={14} color={c.muc2}>Đánh áp mạn thuyền đang vướng cọc gây thêm một nửa sát thương; bè lửa chỉ trúng thuyền đã vướng cọc hoặc mắc cạn. Còn {counter.turns_left} lượt nước ròng.</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {view.units.filter((u) => u.side === 'ally').map((u) => {
              const can = counter.allies.some((a) => a.unit === u.id);
              return <Btn key={u.id} title={`${u.name}${u.fire ? ` · ${u.fire} bè lửa` : ''}`} icon={Anchor} tone={sel === u.id ? 'son' : 'giay'} size="sm" selected={sel === u.id} disabled={off || !can} onPress={() => { setSel(u.id); setDest(null); }} testID={`bd-ally-${u.id}`}
                label={`${u.name}: ${can ? 'chọn để ra lệnh' : u.acted ? 'đã ra lệnh lượt này' : BD_STATE[u.state]}`} />;
            })}
          </View>
          {picked && self ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {destMove ? (
                <>
                  {destMove.attack.map((id) => <Btn key={`a${id}`} title={`Đánh ${unitOf(id)?.name ?? ''}`} icon={Swords} tone="son" size="sm" disabled={off} onPress={() => { void send({ type: 'order', unit: picked.unit, to: destMove.to, attack: id }); }} testID={`bd-attack-${id}`} />)}
                  {destMove.fire.map((id) => <Btn key={`f${id}`} title={`Thả bè lửa vào ${unitOf(id)?.name ?? ''}`} icon={Flame} tone="son" size="sm" disabled={off} onPress={() => { void send({ type: 'order', unit: picked.unit, to: destMove.to, fire: id }); }} testID={`bd-fire-${id}`} />)}
                  <Btn title={self.x === destMove.to[0] && self.y === destMove.to[1] ? 'Giữ vị trí (xong lượt)' : 'Chỉ di chuyển'} tone="giay" size="sm" disabled={off} onPress={() => { void send({ type: 'order', unit: picked.unit, to: destMove.to }); }} testID="bd-move-only" />
                  <Btn title="Chọn ô khác" icon={X} tone="giay" size="sm" onPress={() => setDest(null)} testID="bd-redo" />
                </>
              ) : (
                <Btn title="Đứng yên tại chỗ" tone="giay" size="sm" disabled={off} onPress={() => setDest([self.x, self.y])} testID="bd-stay" />
              )}
            </View>
          ) : null}
          <Btn title="Kết thúc lượt" icon={SkipForward} tone="giay" disabled={off} onPress={() => { void send({ type: 'end_turn' }); }} testID="bd-end-turn" />
        </>
      ) : (
        <Txt f="semibold" size={15} color={c.muc2}>{view.status === 'active' ? 'Đang diễn ra…' : 'Trận đánh đã kết thúc.'}</Txt>
      )}
    </Box>
  );
  return (
    <SagaPage testID="saga-bachdang" max={1320}>
      <SagaHeader title={view.title} subtitle={view.stage ? `${view.stage.place} · ${view.stage.date_label}` : undefined} back={{ label: 'Rời trận', hint: 'Rời trận, về phần nhập vai', onPress: () => nav.go('chien-dich', { ...stage, v: 'kham-pha' }, 'replace') }} />
      {wide ? (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
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
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 12, alignItems: 'flex-start' }}>
        <View style={wide ? { flex: 1 } : { alignSelf: 'stretch' }}>
          <Box style={{ gap: 4 }} testID="bd-units">
            <BlockTitle title="Lực lượng" />
            {view.units.map((u) => (
              <View key={u.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: u.side === 'ally' ? c.moc : c.son }} />
                <Txt f="semibold" size={13} style={{ flex: 1 }} numberOfLines={1}>{u.name}{u.flagship ? ' (thuyền chỉ huy)' : u.key ? ' (chủ lực)' : ''}</Txt>
                <Txt size={13} color={c.muc2}>{u.hp}/{u.max_hp} · {BD_STATE[u.state]}{u.burn > 0 ? ' · đang cháy' : ''}</Txt>
              </View>
            ))}
          </Box>
        </View>
        <View style={[{ gap: 10 }, wide ? { flex: 1 } : { alignSelf: 'stretch' }]}>
          <LogBox lines={log} />
          <Box style={{ gap: 4 }}>
            <Txt f="semibold" size={13}>{view.intro}</Txt>
            <Txt size={13} color={c.muc2}>Chọn ô: bấm hoặc chạm vào khúc sông; trên bàn phím dùng phím mũi tên hoặc W A S D để di chuyển ô chọn, phím E để chọn ô.</Txt>
            <Btn title={rules ? 'Ẩn luật chơi' : 'Xem luật chơi'} icon={BookOpen} tone="giay" size="sm" onPress={() => setRules((v) => !v)} testID="bd-rules" />
            {rules ? view.rules.map((r) => <Txt key={r} size={13}>• {r}</Txt>) : null}
            <Txt size={12} color={c.muc3}>Lưới ô, số lượt, sinh lực và sát thương là mô hình dạy học của trò chơi, không phải số liệu lịch sử.</Txt>
          </Box>
        </View>
      </View>
      {finished ? (
        <ResultSheet finished={finished} reasonText={finished.won ? `Vướng cọc: ${finished.stranded ?? 0} đoàn thuyền · thoát: ${finished.escaped ?? 0}` : null} tips={[]}
          onContinue={() => nav.go('chien-dich', { ...stage, v: 'kham-pha' }, 'replace')} onRetry={() => onAgain(true)}
          onLesson={() => nav.go('chien-dich', { ...stage, v: 'hoc' }, 'replace')} onStage={() => nav.go('chien-dich', { ...stage, v: null }, 'replace')} />
      ) : null}
    </SagaPage>
  );
};
