/**
 * Bước Nhập vai trong thế giới khối vuông (21/11/2026). Vòng chơi theo cấu trúc người dùng gửi: nhận nhiệm vụ → khám phá, hỏi người dân → thu thập, chế tạo,
 * xây dựng → phối hợp cùng bạn cùng lớp → mở trang sử (màn tổng kết đã có nguồn của chặng).
 * Cảnh 3D (game/world3d.ts) lo đi lại, chọn ô; màn này gửi lệnh tới máy chủ (mã lệnh + số thứ tự), hiện lời thoại, câu hỏi, túi đồ, bàn chế tạo,
 * đồng hồ con nước, bạn cùng lớp đang chơi và tín hiệu nhanh. Điểm, mở khóa và kết quả do máy chủ quyết định; nhân vật của em và nhân vật phụ là hư cấu.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Award, BookOpen, Check, ChevronDown, ChevronRight, ChevronUp, Droplets, Fence, Flag, Hammer, Hand, Leaf, Lightbulb, MessageCircle,
  Package, Pencil, RotateCcw, RotateCw, Sailboat, Shield, Ship, Shirt, Sparkles, Swords, Target, Tent, TreePine, Users, Wheat, ZoomIn, ZoomOut,
} from 'lucide-react-native';
import * as saga from '@/lib/saga-api';
import { errorMessage } from '@/api/client';
import type { Session } from '@/components/auth';
import { Flash, OptionButton, SagaHeader, SagaPage, useFlash, useKeys, type SagaNav } from '@/components/portal/SagaKit';
import { WorldViewport } from '@/components/portal/WorldViewport';
import { Btn, Card, Chip, InfoNote, Sheet, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { GameBridge } from '@/game/bridge';
import { play } from '@/lib/saga-sound';
import { applyBlockChange, PLACEABLE, tideAt, zoneTotals } from '@/lib/world-map';
import { WORLD_SAY, useWorldRoom, type BlockChange } from '@/lib/world-socket';
import type { IconType } from '@/types/game';
import type { Choice, ExploreFinished, WorldBookPage, WorldEvent, WorldLook, WorldSession } from '@/types/saga';

type Page = { who: string | null; text: string; tone: 'say' | 'good' | 'bad' | 'clue' };
const statusOf = (e: unknown): number | undefined => (e as { status?: number }).status;
const ICON: Record<string, IconType> = { go: TreePine, tre: Leaf, lua: Wheat, coc: Pencil, be: Sailboat, bao: Package, rao: Fence, thuyen: Ship, van: Shield, leu: Tent, co: Flag };
const TINT: Record<string, string> = { go: '#8a5a32', tre: '#5f8f3e', lua: '#a8902a', coc: '#5a3a22', be: '#3f7f8a', bao: '#9a7a3e', rao: '#8a6238', thuyen: '#6b4a2a', van: '#7a5a3a', leu: '#9a7a3e', co: '#b8261b' };
const TITLE_NAME: Record<string, string> = { 'nguoi-giu-lang': 'Người giữ làng', 'dong-long-giu-nuoc': 'Đồng lòng giữ nước' };
/** Website chính thức: ứng dụng điện thoại gốc mở đúng màn thế giới khối trên trình duyệt */
const SITE = process.env.EXPO_PUBLIC_SITE_URL || 'https://datn-2026-indol.vercel.app';
const NEAR_VERB: Record<string, string> = { go: 'Chặt cây lấy gỗ', tre: 'Chặt tre', lua: 'Gặt lúa' };
/** Lựa chọn khi tự tạo nhân vật (máy chủ chỉ nhận đúng các giá trị này) */
const LOOK_OPTIONS = {
  gender: [{ v: 'nam', label: 'Nam' }, { v: 'nu', label: 'Nữ' }],
  robe: ['#8b6b4c', '#2f5f8f', '#1d7a68', '#6a4c9c', '#b8261b', '#3f4a5a'],
  hat: [{ v: 'none', label: 'Không đội' }, { v: 'non', label: 'Nón lá' }, { v: 'khan', label: 'Khăn' }, { v: 'helmet', label: 'Mũ trụ' }],
  skin: ['#f9d8bb', '#eec39a', '#d9a676', '#b98258'],
} as const;

const Box: React.FC<{ children: React.ReactNode; style?: object; testID?: string }> = ({ children, style, testID }) => <Card flat pad={12} style={{ borderRadius: 12, ...style }} testID={testID}>{children}</Card>;

/** Hình xem trước nhân vật khối (mặt trước) cho hộp tự tạo nhân vật */
const LookPreview: React.FC<{ look: WorldLook; size?: number }> = ({ look, size = 96 }) => {
  const u = size / 24;
  const r = (x: number, y: number, w: number, h: number, bg: string, extra: object = {}) => <View style={{ position: 'absolute', left: x * u, top: y * u, width: w * u, height: h * u, backgroundColor: bg, ...extra }} />;
  return (
    <View style={{ width: size, height: size * 1.25, alignSelf: 'center' }} accessible accessibilityLabel={`Xem trước nhân vật: ${look.gender === 'nu' ? 'nữ' : 'nam'}`}>
      {look.gender === 'nu' ? r(6.5, 5, 11, 12, '#211915') : null}
      {r(9, 22, 2.5, 6, '#3a2f28')}{r(12.5, 22, 2.5, 6, '#3a2f28')}
      {r(6, 13, 12, 11, look.robe)}{r(6, 18, 12, 1.2, '#00000033')}{r(10, 13, 4, 4, '#f3ead8')}
      {r(3.5, 13.5, 2.5, 8, look.robe)}{r(18, 13.5, 2.5, 8, look.robe)}{r(3.5, 21, 2.5, 1.6, look.skin)}{r(18, 21, 2.5, 1.6, look.skin)}
      {r(7, 5, 10, 8.5, look.skin)}{r(7, 4.2, 10, 2.4, '#211915')}{r(9, 8.4, 1.4, 1.6, '#1d1712')}{r(13.6, 8.4, 1.4, 1.6, '#1d1712')}
      {look.hat === 'non' ? r(3.5, 1.8, 17, 2.6, '#d9c47f', { borderTopLeftRadius: 40 * u, borderTopRightRadius: 40 * u }) : null}
      {look.hat === 'khan' ? r(6.6, 3.2, 10.8, 2.2, '#1f2a33') : null}
      {look.hat === 'helmet' ? <>{r(6.4, 2.4, 11.2, 3.4, '#7a7f86')}{r(11.2, 0.6, 1.6, 2, '#b8261b')}</> : null}
    </View>
  );
};

/** Sổ sử Đông A: sau mỗi cuộc kháng chiến, sắp xếp đúng thứ tự các sự kiện để hoàn thiện trang sổ (máy chủ chấm, thưởng điểm một lần) */
/** Chỗ đứng khi vào trận của phiên thế giới khối (chỉ trong tab này; trình duyệt chặn lưu trữ thì về chỗ xuất phát như trước) */
const RETURN_KEY = (sessionId: number): string => `donga_world_return_${sessionId}`;
function saveReturnCell(sessionId: number, cell: [number, number]): void {
  try { (globalThis as { sessionStorage?: Storage }).sessionStorage?.setItem(RETURN_KEY(sessionId), JSON.stringify(cell)); } catch { /* không lưu được thì thôi */ }
}
function takeReturnCell(sessionId: number): [number, number] | null {
  try {
    const ss = (globalThis as { sessionStorage?: Storage }).sessionStorage;
    const raw = ss?.getItem(RETURN_KEY(sessionId));
    if (!raw) return null;
    ss?.removeItem(RETURN_KEY(sessionId));
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) && v.length === 2 && v.every((n) => Number.isInteger(n) && n >= 0 && n < 200) ? [v[0] as number, v[1] as number] : null;
  } catch { return null; }
}

export const BookSheet: React.FC<{ session: Session; onClose: () => void; onXp: () => void }> = ({ session, onClose, onXp }) => {
  const { c } = useTheme();
  const [pages, setPages] = useState<WorldBookPage[] | null>(null);
  const [orders, setOrders] = useState<Record<number, string[]>>({});
  const [result, setResult] = useState<Record<number, { ok: boolean; text: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const adopt = useCallback((list: WorldBookPage[]) => { setPages(list); setOrders(Object.fromEntries(list.map((pg) => [pg.campaign_no, pg.events.map((e) => e.id)]))); }, []);
  useEffect(() => { saga.worldBook(session.token).then((r) => adopt(r.pages)).catch((e) => setError(errorMessage(e))); }, [adopt, session.token]);
  const move = (no: number, i: number, d: -1 | 1): void => setOrders((o) => {
    const list = [...(o[no] ?? [])];
    const j = i + d;
    if (j < 0 || j >= list.length) return o;
    [list[i], list[j]] = [list[j], list[i]];
    return { ...o, [no]: list };
  });
  const submit = async (no: number): Promise<void> => {
    setBusy(true);
    try {
      const r = await saga.submitBook(session.token, no, orders[no] ?? []);
      setResult((x) => ({ ...x, [no]: { ok: r.correct, text: r.correct ? (r.first ? `Hoàn thiện trang Sổ sử! +${r.xp} điểm kinh nghiệm.` : 'Trang này đã hoàn thiện từ trước.') : `Đúng ${r.positions}/${r.total} vị trí. Đọc lại và thử xếp lần nữa nhé.` } }));
      if (r.correct) adopt(r.pages);
      if (r.xp) onXp();
    } catch (e) { setResult((x) => ({ ...x, [no]: { ok: false, text: errorMessage(e) } })); } finally { setBusy(false); }
  };
  return (
    <Sheet open wide onClose={onClose} title="Sổ sử Đông A" subtitle="Sau mỗi cuộc kháng chiến, sắp xếp đúng thứ tự các sự kiện để hoàn thiện một trang sổ">
      <View style={{ gap: 14 }} testID="world-book">
        {error ? <InfoNote>{error}</InfoNote> : null}
        {!pages && !error ? <Txt size={14} color={c.muc2}>Đang mở Sổ sử…</Txt> : null}
        {(pages ?? []).map((pg) => {
          const order = orders[pg.campaign_no] ?? [];
          const byId = Object.fromEntries(pg.events.map((e) => [e.id, e.text]));
          return (
            <View key={pg.campaign_no} style={{ gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: c.adminLine }} testID={`book-page-${pg.campaign_no}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <BookOpen size={18} color={c.son} />
                <Txt f="bold" size={15} style={{ flex: 1 }}>Phần {pg.campaign_no} · {pg.title}</Txt>
                <Chip text={pg.done ? 'Đã hoàn thiện' : pg.unlocked ? 'Đang xếp' : `Chưa mở · xong ${pg.stages.done}/${pg.stages.total} chặng`} icon={pg.done ? Check : undefined}
                  bg={pg.done ? c.mocNhat : pg.unlocked ? c.vangNhat : c.adminCanvas} fg={pg.done ? c.mocChu : pg.unlocked ? c.vangChu : c.muc2} />
              </View>
              {!pg.unlocked ? <Txt size={13} color={c.muc2}>Hoàn thành mọi chặng của phần này để mở trang sổ.</Txt> : null}
              {pg.unlocked ? order.map((id, i) => (
                <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 10, backgroundColor: pg.done ? c.mocNhat : c.adminCanvas }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: pg.done ? c.mocChu : c.son, alignItems: 'center', justifyContent: 'center' }}><Txt f="bold" size={13} color="#ffffff">{i + 1}</Txt></View>
                  <Txt size={14} style={{ flex: 1, lineHeight: 20 }}>{byId[id]}</Txt>
                  {!pg.done ? (
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Đưa lên: ${byId[id]}`} disabled={i === 0 || busy} onPress={() => move(pg.campaign_no, i, -1)} testID={`book-${pg.campaign_no}-up-${i}`}
                        style={{ width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: c.the, opacity: i === 0 ? 0.4 : 1 }}><ChevronUp size={20} color={c.muc} /></Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Đưa xuống: ${byId[id]}`} disabled={i === order.length - 1 || busy} onPress={() => move(pg.campaign_no, i, 1)} testID={`book-${pg.campaign_no}-down-${i}`}
                        style={{ width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: c.the, opacity: i === order.length - 1 ? 0.4 : 1 }}><ChevronDown size={20} color={c.muc} /></Pressable>
                    </View>
                  ) : null}
                </View>
              )) : null}
              {pg.unlocked && !pg.done ? <Btn title="Ghi vào Sổ sử" icon={BookOpen} tone="son" size="sm" disabled={busy} onPress={() => { void submit(pg.campaign_no); }} testID={`book-${pg.campaign_no}-submit`} style={{ alignSelf: 'flex-start' }} /> : null}
              {result[pg.campaign_no] ? <Txt f="semibold" size={13} color={result[pg.campaign_no].ok ? c.mocChu : c.sonChu} accessibilityLiveRegion="polite">{result[pg.campaign_no].text}</Txt> : null}
            </View>
          );
        })}
        {pages && pages.length > 0 && pages.every((pg) => pg.done) ? (
          <View style={{ gap: 6, padding: 14, borderRadius: 14, backgroundColor: c.mocNhat }} testID="book-complete">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Check size={20} color={c.mocChu} />
              <Txt f="bold" size={16} color={c.mocChu} style={{ flex: 1 }}>Em đã hoàn thiện Sổ sử Đông A</Txt>
            </View>
            <Txt size={14} style={{ lineHeight: 21 }}>Đủ {pages.length} trang: {pages.map((pg) => `${pg.title}`).join('; ')}. Sổ ghi lại đúng thứ tự những gì quân dân nhà Trần đã làm để giữ nước – em có thể mở lại bất cứ lúc nào để ôn.</Txt>
          </View>
        ) : null}
      </View>
    </Sheet>
  );
};

export const WorldScreen: React.FC<{ session: Session; nav: SagaNav; stageId: number; campaignNo: number; initial: WorldSession; onRestart: () => void; onReload: () => void }> = ({ session, nav, stageId, campaignNo, initial, onRestart, onReload }) => {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const scroller = useRef<ScrollViewInstance | null>(null);
  // Vào trận rồi quay lại: cảnh mới dựng lại đặt em đúng chỗ đã bấm "Vào trận" (lời mời hứa như vậy), không về chỗ xuất phát
  const bridge = useMemo(() => { const b = new GameBridge(); b.set('world:view', initial); const back = takeReturnCell(initial.session_id); if (back) b.set('world:start', back); return b; }, [initial]);
  const ctx = useRef({ session, nav });
  ctx.current = { session, nav };
  const [view, setView] = useState<WorldSession>(initial);
  const viewRef = useRef(initial);
  const [pages, setPages] = useState<Page[]>([]);
  const [finished, setFinished] = useState<ExploreFinished | null>(null);
  const [reached, setReached] = useState(false);
  const reachedRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [flash, setFlash] = useFlash(4000);
  const [near, setNear] = useState<{ kind: string; id: string; name: string } | null>(null);
  const [craft, setCraft] = useState<string | null>(null);
  const [mode, setModeState] = useState<string | null>(null);
  const [lookOpen, setLookOpen] = useState(!initial.look.chosen);
  const [look, setLook] = useState<WorldLook>({ gender: initial.look.gender, robe: initial.look.robe, hat: initial.look.hat, skin: initial.look.skin });
  const [savingLook, setSavingLook] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [clock, setClock] = useState(() => tideAt(Date.now() + (initial.server_now - Date.now())));
  const goalY = useRef<number | null>(null);
  const talkBox = useRef<{ y: number; height: number } | null>(null);
  const skew = useRef(initial.server_now - Date.now());
  const pos = useRef<{ x: number; z: number }>({ x: initial.map.spawn[0] + 0.5, z: initial.map.spawn[1] + 0.5 });
  const zoneIn = useRef('');

  const apply = useCallback((v: WorldSession): void => { viewRef.current = v; skew.current = v.server_now - Date.now(); setView(v); bridge.emit('world:view', v); }, [bridge]);
  const setMode = useCallback((item: string | null) => { setModeState(item); bridge.emit('world:mode', item); }, [bridge]);
  // sang bước khác thì cất vật đang cầm (không thì vật dư sau bước đặt vật khiến chạm để đi bị hiểu thành đặt vật)
  const stepId = view.current?.id ?? null;
  useEffect(() => { setMode(null); }, [stepId, setMode]);

  const room = useWorldRoom(session.token, { class_id: initial.room.class_id, campaign_no: initial.room.campaign_no }, bridge, {
    block: (ch: BlockChange, me: number | null) => {
      const cur = viewRef.current;
      apply({ ...cur, blocks: applyBlockChange(cur.blocks, ch, me) });
    },
    node: (n) => bridge.emit('world:node', n),
  });

  const send = useCallback(async (action: Record<string, unknown>): Promise<void> => {
    const cur = viewRef.current;
    if (busyRef.current || cur.status !== 'active') return;
    busyRef.current = true; setBusy(true);
    try {
      const res = await saga.act<WorldSession, { events: WorldEvent[] }, ExploreFinished>(ctx.current.session.token, cur.session_id, cur.seq, action);
      apply(res.view);
      const events = res.replayed ? [] : res.outcome.events;
      const next: Page[] = [];
      for (const e of events) {
        if (e.t === 'say') for (const line of e.lines ?? []) next.push({ who: e.who ?? null, text: line, tone: 'say' });
        else if (e.t === 'right') { play('right'); for (const line of e.lines ?? []) next.push({ who: e.who ?? null, text: line, tone: 'good' }); }
        else if (e.t === 'wrong') { play('wrong'); for (const line of e.lines ?? []) next.push({ who: e.who ?? null, text: line, tone: 'bad' }); }
        else if (e.t === 'clue') next.push({ who: 'Manh mối', text: e.text ?? '', tone: 'clue' });
        else if (e.t === 'got' || e.t === 'made' || e.t === 'placed') { play('reward'); setFlash(e.text ?? ''); }
        else if (e.t === 'gave') { play('reward'); for (const line of e.lines ?? []) next.push({ who: e.who ?? null, text: line, tone: 'good' }); }
        else if (e.t === 'award') { play('reward'); next.push({ who: 'Phần thưởng', text: e.text ?? 'Em nhận được phần thưởng mới!', tone: 'good' }); }
        else if (e.t === 'help') setFlash(e.text ?? '');
        else if (e.t === 'wait') setFlash(e.text ?? '');
        else if (e.t === 'step') setFlash(`Mục tiêu mới: ${e.text ?? ''}`);
        else if (e.t === 'battle') { reachedRef.current = true; setReached(true); }
      }
      if (next.length) setPages((p) => [...p, ...next]);
      if (res.finished) { setFinished(res.finished); if (res.finished.xp) ctx.current.nav.refresh(); }
      if (res.completion?.first) ctx.current.nav.setReward({ stageId, completion: res.completion });
      // vừa đặt xong phần vật cần đặt: bỏ chế độ cầm vật
      if (action.type === 'place' && !(res.view.progress.inventory[String(action.item)] > 0)) setMode(null);
    } catch (e) {
      if (statusOf(e) === 401) ctx.current.session.expired();
      else if (statusOf(e) === 409) onReload();
      setFlash(errorMessage(e));
    } finally { busyRef.current = false; setBusy(false); }
  }, [apply, onReload, setFlash, setMode, stageId]);

  // vừa thắng trận quay lại: bước ra trận được qua ngay, không phải đi lại tới vùng địch
  useEffect(() => {
    const cur = initial.current;
    if (cur?.type === 'battle' && initial.battle?.won && cur.marker?.startsWith('zone:')) void send({ type: 'zone', zone: cur.marker.slice(5) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const offs = [
      bridge.on('world:act', (a: Record<string, unknown>) => { void send(a); }),
      bridge.on('world:craft', (id: string) => setCraft(id)),
      bridge.on('world:near', (n: { kind: string; id: string; name: string } | null) => setNear(n)),
      bridge.on('world:hint', (t: string) => setFlash(t)),
      bridge.on('world:travel', (name: string) => setFlash(`Đi thuyền: ${name}`)),
      bridge.on('world:pos', (p: { x: number; z: number; ry: number }) => { pos.current = p; room.move(p); }),
      bridge.on('world:zone', (id: string) => {
        zoneIn.current = id;
        if (!id) return;
        const step = viewRef.current.current;
        // chọn đúng đường / luyện đội hình: bước vào bất kỳ vùng nào của bước này đều gửi máy chủ chấm
        if (step && (step.type === 'pick' || step.type === 'drill') && step.need?.zones?.includes(id)) { void send({ type: 'zone', zone: id }); return; }
        if (!step || step.marker !== `zone:${id}` || (step.type !== 'zone' && step.type !== 'battle') || (step.type === 'battle' && reachedRef.current)) return;
        void send({ type: 'zone', zone: id });
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [bridge, room.move, send, setFlash]);

  // đồng hồ con nước theo giờ máy chủ
  useEffect(() => { const t = setInterval(() => setClock(tideAt(Date.now() + skew.current)), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (room.said && Date.now() - room.said.at < 1500) setFlash(`${room.said.name}: ${room.said.text}`); }, [room.said, setFlash]);
  // bước cần đúng con nước (vd. nhử giặc khi nước lên): em đã đứng sẵn trong vùng lúc nước chưa tới thì khi con nước đổi đúng lúc, tự gửi lại –
  // không thì em đứng chờ mãi (máy khách chỉ gửi khi bước VÀO vùng)
  const tideZone = view.current?.type === 'zone' && view.current.need?.tide && view.current.marker?.startsWith('zone:') ? view.current.marker.slice(5) : null;
  useEffect(() => {
    if (tideZone && clock.state === view.current?.need?.tide && zoneIn.current === tideZone) void send({ type: 'zone', zone: tideZone });
  // chỉ khi con nước đổi (hoặc sang bước khác)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock.state, tideZone]);
  // em đã đặt đủ phần mình mà cả lớp chưa đủ, trong phòng còn bạn khác: hỏi lại máy chủ mỗi 20 giây – chờ các bạn 60 giây rồi dân binh tới giúp
  const waiting = view.current?.type === 'place' && (view.current.need?.own ?? 0) >= (view.current.need?.count ?? 1) ? view.current.need?.zone ?? null : null;
  useEffect(() => {
    if (!waiting) return undefined;
    const t = setInterval(() => { void send({ type: 'zone', zone: waiting }); }, 20_000);
    return () => clearInterval(t);
  }, [send, waiting]);

  const cur = view.current;
  const asking = cur?.asking ?? null;
  const talking = pages.length > 0;
  const locked = talking || Boolean(asking) || Boolean(finished) || Boolean(craft) || lookOpen || bookOpen;
  useEffect(() => {
    if (locked) { bridge.emit('world:lock', true); return undefined; }
    const t = setTimeout(() => bridge.emit('world:lock', false), 220);
    return () => clearTimeout(t);
  }, [bridge, locked]);
  const nextPage = (): void => { play('tap'); setPages((p) => p.slice(1)); };
  useKeys((k) => { if (talking && (k === 'Enter' || k === ' ' || k.toLowerCase() === 'e')) nextPage(); }, talking);
  useKeys((k) => { const i = Number(k) - 1; if (asking && !talking && asking.options[i]) void send({ type: 'answer', choice: asking.options[i].id }); }, Boolean(asking) && !talking && !busy);

  const back = (): void => nav.back('chien-dich', { c: campaignNo, s: stageId, v: null });
  const totals = zoneTotals(view.blocks);
  const need = cur?.need ?? null;
  const needText = !need ? null
    : cur?.type === 'drill' && need.command ? `Hiệu lệnh ${(need.index ?? 0) + 1}/${need.zones?.length ?? 0}: ${need.command}`
    : cur?.type === 'pick' ? 'Tìm đúng nơi trên bản đồ (các ô sáng là những nơi có thể chọn)'
    : cur?.type === 'give' && need.item ? `${view.items[need.item] ?? need.item}: ${Math.min(need.have ?? 0, need.count ?? 0)}/${need.count} – mang tới tận tay`
    : need.zone ? `Em ${need.own ?? 0}/${need.count} · Cả lớp ${Math.max(need.total ?? 0, totals[need.zone] ?? 0)}/${need.team}`
    : need.item ? `${view.items[need.item] ?? need.item}: ${Math.min(need.have ?? 0, need.count ?? 0)}/${need.count}`
    : need.tide ? (need.tide === 'high' ? 'Cần nước lên' : 'Cần nước rút') : null;
  // khung 3D chiếm phần còn lại của màn hình dưới khung nhiệm vụ (trang tự cuộn tới khung nhiệm vụ khi mở)
  const canvasH = width < 760 ? Math.max(280, Math.min(height - 340, 520)) : Math.max(320, Math.min(height - 275, 640));
  const over = canvasH >= 420 && width >= 600;
  const atBattle = Boolean(reached && cur?.type === 'battle' && view.battle && !view.battle.won);
  const pageTone = pages[0]?.tone === 'good' ? [c.mocNhat, c.mocChu] : pages[0]?.tone === 'bad' ? [c.sonNhat, c.sonChu] : pages[0]?.tone === 'clue' ? [c.vangNhat, c.vangChu] : [c.thuyNhat, c.thuyChu];
  const page = pages[0] ?? null;
  const talk = page ? (
    <Box style={{ gap: 6 }} testID="world-dialog">
      {page.who ? <Chip text={page.who} bg={pageTone[0]} fg={pageTone[1]} /> : null}
      <Txt size={16} style={{ lineHeight: 25 }} accessibilityLiveRegion="polite">{page.text}</Txt>
      <Btn title={pages.length > 1 ? 'Tiếp' : 'Đã rõ'} iconRight={ChevronRight} tone="son" size="sm" onPress={nextPage} testID="world-next" label={`${pages.length > 1 ? 'Tiếp' : 'Đã rõ'} (phím Enter)`} style={{ alignSelf: 'flex-end' }} />
    </Box>
  ) : asking ? (
    <Box style={{ gap: 8 }} testID="world-ask">
      <Txt f="bold" size={16}>{asking.prompt}</Txt>
      {asking.options.map((o: Choice, i: number) => (
        <OptionButton key={o.id} badge={String(i + 1)} text={o.text} disabled={busy} onPress={() => { void send({ type: 'answer', choice: o.id }); }} label={`Phương án ${i + 1}: ${o.text}`} testID={`world-answer-${i + 1}`} />
      ))}
    </Box>
  ) : atBattle && view.battle ? (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderLeftWidth: 4, borderLeftColor: c.son }} testID="world-battle">
      <Swords size={24} color={c.son} />
      <View style={{ flex: 1, minWidth: 180 }}>
        <Txt f="bold" size={16}>Tới lúc ra trận!</Txt>
        <Txt size={14} color={c.muc2}>{view.battle.title}. Thắng trận rồi em quay lại đúng chỗ này để làm tiếp nhiệm vụ.</Txt>
      </View>
      <Btn title="Vào trận" icon={Swords} tone="son" onPress={() => { saveReturnCell(view.session_id, [Math.floor(pos.current.x), Math.floor(pos.current.z)]); nav.go('chien-dich', { c: campaignNo, s: stageId, v: 'tran' }, 'replace'); }} testID="world-fight" />
    </Box>
  ) : null;
  const hasTalk = talk !== null;
  // Màn hẹp (điện thoại): lời thoại nằm ngay dưới cảnh 3D. Hiện lời thoại thì cuộn VỪA ĐỦ để thấy hết hộp (không cuộn tới cuối trang – trước đây
  // trượt tới tận phần giới thiệu, che cả hộp lẫn cảnh); đóng lời thoại thì cuộn về khung mục tiêu + cảnh 3D để em chơi tiếp.
  const shownTalk = useRef(false);
  useEffect(() => {
    if (over) return undefined;
    if (!hasTalk && !shownTalk.current) return undefined; // chưa từng mở lời thoại: giữ vị trí cuộn ban đầu
    const t = setTimeout(() => {
      const node = (scroller.current as unknown as { getScrollableNode?: () => HTMLElement | null } | null)?.getScrollableNode?.();
      const visible = node?.clientHeight || height;
      if (hasTalk && talkBox.current) { shownTalk.current = true; scroller.current?.scrollTo({ y: Math.max(0, talkBox.current.y + talkBox.current.height + 12 - visible), animated: true }); }
      else if (!hasTalk && goalY.current !== null) scroller.current?.scrollTo({ y: Math.max(0, goalY.current - 8), animated: true });
    }, 140);
    return () => clearTimeout(t);
  }, [over, hasTalk, page, height]);

  const inv = Object.entries(view.progress.inventory).filter(([, n]) => n > 0);
  const nearLabel = !near ? null : near.kind === 'npc' ? `Nói chuyện với ${near.name}` : near.kind === 'station' ? 'Mở bàn chế tạo' : near.kind === 'route' ? `Đi thuyền: ${near.name}` : NEAR_VERB[near.id] ?? 'Thu thập';
  const station = craft ? view.map.stations.find((s) => s.id === craft) : null;
  const camBtn = (k: string, label: string, Icon: IconType) => (
    <Pressable key={k} accessibilityRole="button" accessibilityLabel={label} onPress={() => bridge.emit('world:camera', k)} testID={`world-cam-${k}`}
      style={({ pressed }) => ({ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: pressed ? '#ffffff' : '#ffffffd9', borderWidth: 1, borderColor: '#00000022' })}>
      <Icon size={19} color="#26413a" />
    </Pressable>
  );
  const pad = (dir: string, label: string, Icon: IconType) => (
    <Pressable key={dir} accessibilityRole="button" accessibilityLabel={label} onPressIn={() => bridge.emit('world:walk', dir)} onPressOut={() => bridge.emit('world:walk', '')}
      style={({ pressed }) => ({ width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: pressed ? '#ffffff' : '#ffffffcc' })}>
      <Icon size={20} color="#26413a" />
    </Pressable>
  );
  const saveLook = async (): Promise<void> => {
    setSavingLook(true);
    try {
      const res = await saga.setWorldLook(session.token, look);
      bridge.emit('world:look', res.look);
      apply({ ...viewRef.current, look: res.look });
      setLookOpen(false);
    } catch (e) { setFlash(errorMessage(e)); } finally { setSavingLook(false); }
  };

  return (
    <SagaPage testID="saga-world" max={1200} scrollRef={scroller}>
      <SagaHeader title={view.title} subtitle={view.stage ? `Thế giới khối · ${view.stage.title} · ${view.stage.date_label}` : 'Thế giới khối'}
        back={{ label: 'Thông tin chặng', hint: 'Về bảng thông tin chặng', onPress: back }} />
      <View onLayout={(e) => { if (goalY.current === null) { goalY.current = e.nativeEvent.layout.y; setTimeout(() => scroller.current?.scrollTo({ y: Math.max(0, (goalY.current ?? 0) - 8), animated: false }), 60); } }}>
      <Box style={{ gap: 8 }} testID="world-goal">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Target size={18} color={c.son} />
          <Txt f="bold" size={15} style={{ flex: 1 }} accessibilityLiveRegion="polite">{cur ? cur.goal : 'Đã hoàn thành nhiệm vụ ở thế giới khối.'}</Txt>
          <Chip text={`Bước ${Math.min(view.progress.step + 1, view.progress.total)}/${view.progress.total}`} bg={c.adminCanvas} fg={c.muc} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {needText ? <Chip text={needText} icon={Target} bg={c.vangNhat} fg={c.vangChu} /> : null}
          <View testID="world-tide"><Chip text={`${clock.state === 'high' ? 'Nước lên' : 'Nước rút'} · còn ${Math.ceil(clock.leftMs / 1000)} giây`} icon={Droplets} bg={clock.state === 'high' ? c.thuyNhat : c.mocNhat} fg={clock.state === 'high' ? c.thuyChu : c.mocChu} /></View>
          <View testID="world-online"><Chip text={!room.connected ? 'Đang kết nối lớp…' : room.mates.length ? `${room.mates.length} bạn cùng lớp đang chơi` : 'Chỉ có em trong phòng'} icon={Users} bg={c.adminCanvas} fg={c.muc2} /></View>
          <View style={{ flex: 1 }} />
          <Btn title="Manh mối" icon={Lightbulb} tone="giay" size="sm" disabled={!cur?.has_clue || locked} onPress={() => { void send({ type: 'hint' }); }} testID="world-hint" label="Xem lại manh mối (mỗi lần xem được ghi nhận)" />
          <Btn title="Sổ sử" icon={BookOpen} tone="giay" size="sm" onPress={() => setBookOpen(true)} testID="world-book-open" label="Mở Sổ sử Đông A" />
          <Btn title="Nhân vật" icon={Shirt} tone="giay" size="sm" onPress={() => setLookOpen(true)} testID="world-look" label="Tự tạo nhân vật của em" />
        </View>
      </Box>
      </View>

      <WorldViewport bridge={bridge} height={canvasH} label={`Thế giới khối: ${view.map.title}`} webUrl={`${SITE}/hoc-sinh?tab=chien-dich&c=${campaignNo}&s=${stageId}&v=kham-pha`}>
        <View style={{ position: 'absolute', right: 10, top: 10, gap: 6 }} pointerEvents="box-none">
          {camBtn('left', 'Xoay góc nhìn sang trái (phím Q)', RotateCcw)}{camBtn('right', 'Xoay góc nhìn sang phải (phím R)', RotateCw)}
          {camBtn('in', 'Phóng to', ZoomIn)}{camBtn('out', 'Thu nhỏ', ZoomOut)}
        </View>
        {width < 900 ? (
          <View style={{ position: 'absolute', left: 10, bottom: 10, width: 146, height: 146 }} pointerEvents="box-none">
            <View style={{ position: 'absolute', left: 50, top: 0 }}>{pad('w', 'Đi lên', ArrowUp)}</View>
            <View style={{ position: 'absolute', left: 0, top: 50 }}>{pad('a', 'Sang trái', ArrowLeft)}</View>
            <View style={{ position: 'absolute', left: 100, top: 50 }}>{pad('d', 'Sang phải', ArrowRight)}</View>
            <View style={{ position: 'absolute', left: 50, top: 100 }}>{pad('s', 'Đi xuống', ArrowDown)}</View>
          </View>
        ) : null}
        {mode ? (
          <View style={{ position: 'absolute', left: 10, top: 10, maxWidth: '70%', borderRadius: 12, backgroundColor: '#fffaf0f0', padding: 10, gap: 6 }} testID="world-holding">
            <Txt f="bold" size={13}>Đang cầm: {view.items[mode]}</Txt>
            <Txt size={12} color={c.muc2}>Chạm vào ô sáng màu vàng để đặt. {view.map.zones.some((z) => z.accepts.includes(mode) && z.tide === 'low') ? 'Chỉ đặt được khi nước rút.' : ''}</Txt>
            <Btn title="Cất vào túi" tone="giay" size="sm" onPress={() => setMode(null)} testID="world-holding-cancel" style={{ alignSelf: 'flex-start' }} />
          </View>
        ) : null}
        {near && !locked && !hasTalk ? (
          <View style={width < 900 ? { position: 'absolute', right: 10, bottom: 12, maxWidth: '55%', alignItems: 'flex-end' } : { position: 'absolute', left: 0, right: 0, bottom: 12, alignItems: 'center' }} pointerEvents="box-none">
            <Btn title={nearLabel ?? ''} icon={near.kind === 'station' ? Hammer : near.kind === 'route' ? Ship : Hand} tone="son" onPress={() => bridge.emit('world:press')} testID="world-interact" label={`${nearLabel} (phím E)`} style={{ alignSelf: width < 900 ? 'flex-end' : 'center' }} />
          </View>
        ) : null}
        {over && hasTalk ? <View style={{ position: 'absolute', left: 10, right: 10, bottom: 10 }}>{talk}</View> : null}
      </WorldViewport>

      <Flash text={flash} tone="info" />
      {!over && hasTalk ? <View onLayout={(e) => { talkBox.current = { y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height }; }}>{talk}</View> : null}

      <Box style={{ gap: 10 }} testID="world-bag">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Package size={18} color={c.muc} /><Txt f="bold" size={15} style={{ flex: 1 }}>Túi đồ</Txt>
          <Txt size={12} color={c.muc2}>Chạm vật dùng để xây (cọc, rào, bao lương, thuyền) để cầm lên rồi đặt.</Txt>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {!inv.length ? <Txt size={13} color={c.muc2}>Túi còn trống. Đứng cạnh cây, bụi tre hay ruộng lúa rồi chạm vào để thu thập.</Txt> : null}
          {inv.map(([item, n]) => {
            const Icon = ICON[item] ?? Package;
            const can = (PLACEABLE as readonly string[]).includes(item);
            const held = mode === item;
            return (
              <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: held, disabled: !can }} disabled={!can} testID={`world-item-${item}`}
                accessibilityLabel={`${view.items[item]}: ${n}${can ? held ? ', đang cầm – chạm để cất' : ', chạm để cầm lên và đặt' : ''}`}
                onPress={() => setMode(held ? null : item)}
                style={({ pressed }) => ({ minWidth: 92, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: 12, borderWidth: held ? 3 : 1, borderColor: held ? '#e3b244' : c.adminLine, backgroundColor: pressed ? c.adminCanvas : c.the })}>
                <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: `${TINT[item] ?? '#777777'}22`, alignItems: 'center', justifyContent: 'center' }}><View style={item === 'coc' ? { transform: [{ rotate: '135deg' }] } : undefined}><Icon size={18} color={TINT[item] ?? c.muc} /></View></View>
                <View><Txt f="bold" size={13}>{view.items[item]}</Txt><Txt size={12} color={c.muc2}>× {n}</Txt></View>
              </Pressable>
            );
          })}
        </View>
      </Box>

      <Box style={{ gap: 8 }} testID="world-team">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MessageCircle size={18} color={c.muc} /><Txt f="bold" size={15} style={{ flex: 1 }}>Phối hợp cùng lớp {view.room.class_name ?? ''}</Txt>
        </View>
        <Txt size={13} color={c.muc2}>{room.mates.length ? `Đang cùng chơi: ${room.mates.map((m) => m.name).join(', ')}.` : 'Rủ các bạn trong lớp cùng vào: khối các bạn đặt (cọc, rào, thuyền, bao lương) được tính chung cho cả lớp.'}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {WORLD_SAY.map((s) => <Btn key={s.code} title={s.text} tone="giay" size="sm" disabled={!room.connected} onPress={() => room.say(s.code)} testID={`world-say-${s.code}`} label={`Gửi tín hiệu: ${s.text}`} />)}
        </View>
      </Box>

      <Box style={{ gap: 8 }} testID="world-marks">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Award size={18} color={c.muc} /><Txt f="bold" size={15} style={{ flex: 1 }}>Dấu ấn và phần thưởng của em</Txt>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {view.awards.filter((a) => a.startsWith('title:')).map((a) => <Chip key={a} text={`Danh hiệu: ${TITLE_NAME[a.slice(6)] ?? a.slice(6)}`} icon={Award} bg={c.vangNhat} fg={c.vangChu} />)}
          {(view.map.routes ?? []).filter((r) => view.routes_open.includes(r.id)).map((r) => <Chip key={r.id} text={r.name} icon={Ship} bg={c.thuyNhat} fg={c.thuyChu} />)}
          {view.village_help ? <Chip text="Dân làng góp sức: mỗi lần thu thập +1" icon={Users} bg={c.mocNhat} fg={c.mocChu} /> : null}
        </View>
        {view.changes.length ? view.changes.map((ch) => <Txt key={ch.stage} size={13} color={c.muc2}>• {ch.text}</Txt>)
          : <Txt size={13} color={c.muc2}>Xong mỗi nhiệm vụ, bản đồ sẽ đổi theo việc em đã làm: làng có người ở, kho lương đầy, thuyền đưa đồng đội về…</Txt>}
      </Box>

      <Box style={{ gap: 4 }}>
        <Txt f="semibold" size={14}>{view.intro}</Txt>
        <Txt size={13} color={c.muc2}>Đi lại: phím W A S D / mũi tên, hoặc chạm vào nơi muốn tới. Chạm vào cây, bụi tre, ruộng lúa để thu thập; tới bàn chế tạo để làm cọc, bè, thuyền…; phím E để tương tác. Kéo chuột / vuốt ngang để xoay góc nhìn, Q / R xoay 90°, cuộn chuột để phóng to.</Txt>
        <Txt size={13} color={c.muc2}>{view.map.note} Nhân vật em điều khiển và nhân vật phụ là hư cấu; trang sử sau nhiệm vụ lấy từ nội dung đã kiểm chứng của chặng.</Txt>
      </Box>

      {station ? (
        <Sheet open onClose={() => setCraft(null)} title={station.name} subtitle="Chế tạo từ vật trong túi">
          <View style={{ gap: 10 }} testID="world-craft">
            {Object.entries(view.recipes).map(([id, r]) => {
              const need = Object.entries(r.needs);
              const max = Math.min(10, ...need.map(([it, n]) => Math.floor((view.progress.inventory[it] ?? 0) / n)));
              const Icon = ICON[r.item] ?? Package;
              return (
                <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: c.adminLine }} testID={`craft-${id}`}>
                  <Icon size={22} color={TINT[r.item] ?? c.muc} />
                  <View style={{ flex: 1 }}>
                    <Txt f="bold" size={14}>{view.items[r.item]}</Txt>
                    <Txt size={12} color={c.muc2}>Cần {need.map(([it, n]) => `${n} ${view.items[it]?.toLowerCase()} (có ${view.progress.inventory[it] ?? 0})`).join(' + ')}</Txt>
                  </View>
                  <Btn title="Làm 1" icon={Hammer} tone="son" size="sm" disabled={max < 1 || busy} onPress={() => { void send({ type: 'craft', recipe: id, station: station.id, times: 1 }); }} testID={`craft-${id}-one`} label={`Làm 1 ${view.items[r.item]}`} />
                  {max > 1 ? <Btn title={`Làm ${max}`} tone="giay" size="sm" disabled={busy} onPress={() => { void send({ type: 'craft', recipe: id, station: station.id, times: max }); }} testID={`craft-${id}-max`} label={`Làm ${max} ${view.items[r.item]}`} /> : null}
                </View>
              );
            })}
            <InfoNote>Công thức chế tạo là quy ước của trò chơi, không phải kỹ thuật thật thời Trần.</InfoNote>
          </View>
        </Sheet>
      ) : null}

      {bookOpen ? <BookSheet session={session} onClose={() => setBookOpen(false)} onXp={() => nav.refresh()} /> : null}

      {lookOpen ? (
        <Sheet open onClose={() => setLookOpen(false)} title={view.look.chosen ? 'Nhân vật của em' : 'Tạo nhân vật của em'} subtitle="Các bạn cùng lớp sẽ thấy nhân vật này trong thế giới khối"
          footer={<Btn title="Lưu nhân vật" icon={Sparkles} tone="son" full disabled={savingLook} onPress={() => { void saveLook(); }} testID="world-look-save" />}>
          <View style={{ gap: 14 }} testID="world-look-sheet">
            <LookPreview look={look} />
            <Txt f="bold" size={14}>Nhân vật</Txt>
            <View style={{ flexDirection: 'row', gap: 8 }}>{LOOK_OPTIONS.gender.map((o) => <Btn key={o.v} title={o.label} tone={look.gender === o.v ? 'son' : 'giay'} size="sm" onPress={() => setLook((l) => ({ ...l, gender: o.v }))} testID={`look-gender-${o.v}`} />)}</View>
            <Txt f="bold" size={14}>Màu áo</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{LOOK_OPTIONS.robe.map((col) => (
              <Pressable key={col} accessibilityRole="button" accessibilityLabel={`Màu áo ${col}`} accessibilityState={{ selected: look.robe === col }} onPress={() => setLook((l) => ({ ...l, robe: col }))} testID={`look-robe-${col.slice(1)}`}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: col, borderWidth: look.robe === col ? 4 : 1, borderColor: look.robe === col ? '#e3b244' : '#00000033' }} />
            ))}</View>
            <Txt f="bold" size={14}>Đội đầu</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{LOOK_OPTIONS.hat.map((o) => <Btn key={o.v} title={o.label} tone={look.hat === o.v ? 'son' : 'giay'} size="sm" onPress={() => setLook((l) => ({ ...l, hat: o.v }))} testID={`look-hat-${o.v}`} />)}</View>
            <Txt f="bold" size={14}>Màu da</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{LOOK_OPTIONS.skin.map((col) => (
              <Pressable key={col} accessibilityRole="button" accessibilityLabel={`Màu da ${col}`} accessibilityState={{ selected: look.skin === col }} onPress={() => setLook((l) => ({ ...l, skin: col }))}
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: col, borderWidth: look.skin === col ? 4 : 1, borderColor: look.skin === col ? '#e3b244' : '#00000033' }} />
            ))}</View>
            <InfoNote>Trang phục là hình khối cách điệu, không phục dựng trang phục thời Trần.</InfoNote>
          </View>
        </Sheet>
      ) : null}

      {finished && !talking ? (
        <Sheet open persistent onClose={() => nav.go('chien-dich', { c: campaignNo, s: stageId, v: 'tong-ket' }, 'replace')} title="Hoàn thành nhiệm vụ" subtitle={view.title}
          footer={<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }}>
            <Btn title="Chơi lại" icon={RotateCcw} tone="giay" onPress={onRestart} testID="world-replay" />
            <Btn title="Mở trang sử" icon={Sparkles} tone="son" onPress={() => nav.go('chien-dich', { c: campaignNo, s: stageId, v: 'tong-ket' }, 'replace')} testID="world-summary" />
          </View>}>
          <View style={{ gap: 10 }} testID="world-done">
            <Txt size={15}>Em đã cùng các bạn hoàn thành “{view.title}”. Trang sử tiếp theo kể lại những điều em vừa trải nghiệm, kèm nguồn tư liệu.</Txt>
            <Txt size={14} color={c.muc2}>Xem lại manh mối {finished.hints} lần, trả lời nhầm {finished.mistakes} lần.</Txt>
            {finished.xp ? <Chip text={`+${finished.xp} điểm kinh nghiệm`} icon={Sparkles} bg={c.thongNhat} fg={c.thongChu} /> : null}
            {finished.suggest_review ? <InfoNote>Chặng này được đánh dấu “Cần ôn” vì em xem gợi ý hoặc nhầm nhiều lần. Ôn lại để nhớ chắc hơn nhé.</InfoNote> : null}
          </View>
        </Sheet>
      ) : null}
    </SagaPage>
  );
};
