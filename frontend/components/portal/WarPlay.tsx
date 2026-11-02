/**
 * Chơi game thẻ tướng (Sprint 6 theo ver0.2): bản đồ hành quân (HK.HS.134–135, SYS.021) với điểm dừng, đường đi chấm, nhân vật di chuyển, sự kiện tại điểm dừng
 * (cốt truyện, thẻ, thử thách, tư liệu, rương, trận đánh) và Nhật ký hành quân; danh sách màn chơi, giới thiệu màn kèm chọn đội hình; trận đánh theo lượt (đòn thường,
 * chiêu, tuyệt kỹ có câu hỏi 15 giây, phòng thủ, thẻ chiến thuật, tự động đánh, tốc độ x2); kết quả, sao, phần thưởng; “Sự thật lịch sử” (HK.HS.138).
 * Máy chủ giữ trạng thái trận, tính sát thương, phần thưởng và đo thời gian trả lời; giao diện chỉ hiển thị và gửi hành động. Trạng thái luôn kèm chữ, không chỉ dựa vào màu.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Pressable, ScrollView, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { Award, BookMarked, BookOpen, Check, ChevronLeft, ChevronRight, CircleHelp, Cuboid, FastForward, Flag, Gift, History as HistoryIcon, Lock, Pause, Play, RotateCcw, ScrollText, Shield, Swords, Trophy, ZoomIn, ZoomOut } from 'lucide-react-native';
import * as api from '@/api/warApi';
import { ApiError, errorMessage } from '@/api/client';
import { ErrorNote, useAction, useLoad } from '@/components/admin/kit';
import { SandTableView } from '@/components/portal/SandTableView';
import type { Session } from '@/components/auth';
import { LiveCountdown } from '@/components/portal/LiveKit';
import { QuestionInput, buildAnswer, initialDraft, ready, type Draft } from '@/components/portal/QuizPlayer';
import { CardPortrait } from '@/components/portal/WarCards';
import { Bar, Btn, Card, Chip, EmptyState, InfoNote, Segmented, Sheet, Spinner, Stars, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { DIFFICULTY_LABEL } from '@/types/battle';
import type { IconType } from '@/types/game';
import { POINT_LABEL, RARITY_COLOR, SLOT_LABEL, type BattleView, type Dialog, type MarchEvent, type MarchPoint, type PointKind, type ReplayFrame, type StageIntro, type UnitView, type WarStatus } from '@/types/war';

const POINT_ICON: Record<PointKind, IconType> = { start: Flag, story: ScrollText, card: Award, quiz: CircleHelp, source: BookMarked, battle: Swords, chest: Gift };
const POINT_STATE_TEXT = { current: 'Em đang ở đây', visited: 'Đã đi qua', open: 'Có thể đi tới', locked: 'Chưa mở' } as const;

/** Báo game đang đóng hoặc đã dùng bao nhiêu phút trong ngày (HK.QT.056, SYS.022) */
export const WarBanner: React.FC<{ war: WarStatus | null | undefined }> = ({ war }) => {
  const { c } = useTheme();
  if (!war) return null;
  if (!war.open) return <InfoNote><Txt size={14}>{war.reason ?? 'Game thẻ tướng đang tạm đóng.'}</Txt></InfoNote>;
  return war.limit_minutes ? <Txt size={12} color={c.muc3}>Hôm nay em đã chơi {war.used_minutes}/{war.limit_minutes} phút.</Txt> : null;
};

// ---------------------------------------------------------------------- hành quân: danh sách và bản đồ
export const MarchTab: React.FC<{ session: Session; refreshKey: number; onStage: (id: number) => void; onSource: (id: number) => void; onChanged: () => void }> = ({ session, refreshKey, onStage, onSource, onChanged }) => {
  const { c } = useTheme();
  const list = useLoad(() => api.marchList(session.token), [session.token, refreshKey], session.expired);
  const [campaign, setCampaign] = useState<number | null>(null);
  const [log, setLog] = useState(false);
  if (campaign !== null) return <MarchMapView session={session} campaignId={campaign} refreshKey={refreshKey} onBack={() => setCampaign(null)} onStage={onStage} onSource={onSource} onChanged={onChanged} />;
  return (
    <View style={{ gap: 12 }}>
      <ErrorNote message={list.error} />
      <Txt size={14} color={c.muc2}>Dẫn quân đi qua từng địa danh của cuộc kháng chiến: nghe câu chuyện, gom thẻ tướng, vượt thử thách và ra trận. Nhân vật chỉ đi theo đường nối.</Txt>
      {list.loading && !list.data ? <Spinner label="Đang mở bản đồ hành quân…" /> : null}
      {list.data && !list.data.length ? <EmptyState mood="thinking" title="Chưa có bản đồ hành quân" text="Bản đồ sẽ xuất hiện khi nội dung được duyệt và phát hành." /> : null}
      {(list.data ?? []).map((m) => (
        <Pressable key={m.id} accessibilityRole="button" accessibilityLabel={`${m.title}, đã đi ${m.visited} trên ${m.points} điểm`} onPress={() => setCampaign(m.campaign_id)} testID={`march-map-${m.id}`}
          style={({ pressed }) => ({ borderRadius: 20, borderWidth: 2, borderColor: c.dong, backgroundColor: pressed ? c.the2 : c.the, padding: 16, gap: 8 })}>
          <Chip text={m.year_label} bg={c.dongNhat} fg={c.dongChu} />
          <Txt f="displayHeavy" size={20}>{m.title}</Txt>
          <Txt size={13} color={c.muc2}>{m.campaign_title}</Txt>
          <Bar value={m.visited} max={Math.max(1, m.points)} label={`Đã đi ${m.visited}/${m.points} điểm`} />
          <Txt size={12} color={c.muc3}>Đã đi {m.visited}/{m.points} điểm</Txt>
        </Pressable>
      ))}
      <Btn icon={HistoryIcon} title="Nhật ký hành quân" tone="giay" onPress={() => setLog(true)} testID="march-log-open" />
      {log ? <MarchLogSheet session={session} onClose={() => setLog(false)} /> : null}
    </View>
  );
};

const Edge: React.FC<{ a: MarchPoint; b: MarchPoint; w: number; h: number; on: boolean }> = ({ a, b, w, h, on }) => {
  const { c } = useTheme();
  const x1 = (a.x / 100) * w, y1 = (a.y / 100) * h, x2 = (b.x / 100) * w, y2 = (b.y / 100) * h;
  const len = Math.hypot(x2 - x1, y2 - y1);
  return <View pointerEvents="none" style={{ position: 'absolute', left: (x1 + x2) / 2 - len / 2, top: (y1 + y2) / 2 - 1.5, width: len, height: 0, borderTopWidth: 3, borderStyle: on ? 'solid' : 'dashed', borderColor: on ? c.dong : c.vien2, transform: [{ rotate: `${Math.atan2(y2 - y1, x2 - x1)}rad` }] }} />;
};

const MarchMapView: React.FC<{ session: Session; campaignId: number; refreshKey: number; onBack: () => void; onStage: (id: number) => void; onSource: (id: number) => void; onChanged: () => void }> = ({ session, campaignId, refreshKey, onBack, onStage, onSource, onChanged }) => {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const map = useLoad(() => api.marchMap(session.token, campaignId), [session.token, campaignId, refreshKey], session.expired);
  const { busy, run } = useAction(session.expired);
  const [zoom, setZoom] = useState(1);
  const [note, setNote] = useState<string | null>(null);
  const [event, setEvent] = useState<{ point: { id: number; name: string; kind: PointKind }; event: MarchEvent } | null>(null);
  const [log, setLog] = useState(false);
  const [reduce, setReduce] = useState(false);
  const ax = useRef(new Animated.Value(0)).current, ay = useRef(new Animated.Value(0)).current;
  const walking = useRef(false);
  const data = map.data;
  // Trên điện thoại bản đồ rộng hơn màn hình (tối thiểu 520 px) để nhãn các điểm không đè nhau; kéo ngang để xem, tự cuộn tới nhân vật
  const room = Math.max(280, Math.min(width - 32, 760));
  const base = Math.max(520, room);
  const w = base * zoom, h = w * 0.72;
  const here = data?.points.find((p) => p.id === data.current_point_id) ?? null;
  const hscroll = useRef<ScrollViewInstance>(null);

  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => undefined); }, []);
  useEffect(() => { if (here) hscroll.current?.scrollTo({ x: Math.max(0, (here.x / 100) * w - room / 2), animated: false }); }, [here?.id, zoom, room]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (here && !walking.current) { ax.setValue(here.x); ay.setValue(here.y); } }, [here?.id, here?.x, here?.y]); // eslint-disable-line react-hooks/exhaustive-deps

  const walk = (path: number[]) => new Promise<void>((resolve) => {
    const pts = path.map((id) => data?.points.find((p) => p.id === id)).filter((p): p is MarchPoint => Boolean(p));
    if (!pts.length) { resolve(); return; }
    walking.current = true;
    Animated.sequence(pts.map((p) => Animated.parallel([
      Animated.timing(ax, { toValue: p.x, duration: reduce ? 0 : 320, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      Animated.timing(ay, { toValue: p.y, duration: reduce ? 0 : 320, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
    ]))).start(() => { walking.current = false; resolve(); });
  });

  const go = async (p: MarchPoint) => {
    if (busy) return;
    if (p.state === 'locked') { setNote(p.locked_reason ?? 'Điểm này chưa mở. Hãy đi tiếp theo đường nối.'); return; }
    setNote(null);
    const res = await run(() => api.marchMove(session.token, p.id));
    if (!res) return;
    await walk(res.path);
    map.reload(); onChanged();
    if (res.event) setEvent({ point: res.point, event: res.event });
  };

  const visited = (p: MarchPoint) => p.state === 'visited' || p.state === 'current';
  const byId = (id: number) => data?.points.find((p) => p.id === id);
  return (
    <View style={{ gap: 12 }}>
      <Btn title="Tất cả bản đồ" tone="giay" size="sm" onPress={onBack} />
      <ErrorNote message={map.error} />
      {map.loading && !data ? <Spinner label="Đang mở bản đồ…" /> : null}
      {data ? (
        <>
          <View style={{ gap: 4 }}>
            <Txt f="displayHeavy" size={22} accessibilityRole="header">{data.map.title}</Txt>
            <Txt size={13} color={c.muc2}>{data.map.campaign.title} · {data.map.campaign.year_label}</Txt>
            <Bar value={data.progress.visited} max={Math.max(1, data.progress.total)} label={`Đã đi ${data.progress.visited}/${data.progress.total} điểm`} />
            <Txt size={12} color={c.muc3}>Đã đi {data.progress.visited}/{data.progress.total} điểm</Txt>
          </View>
          <WarBanner war={data.war} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Btn icon={ZoomOut} label="Thu nhỏ bản đồ" tone="giay" size="sm" disabled={zoom <= 1} onPress={() => setZoom((z) => Math.max(1, +(z - 0.4).toFixed(1)))} testID="march-zoom-out" />
            <Btn icon={ZoomIn} label="Phóng to bản đồ" tone="giay" size="sm" disabled={zoom >= 2.2} onPress={() => setZoom((z) => Math.min(2.2, +(z + 0.4).toFixed(1)))} testID="march-zoom-in" />
            <Btn icon={HistoryIcon} title="Nhật ký hành quân" tone="giay" size="sm" onPress={() => setLog(true)} testID="march-log-open" />
          </View>
          <View style={{ borderRadius: 20, borderWidth: 2, borderColor: c.vien, overflow: 'hidden', backgroundColor: c.the2, height: Math.min(h, base * 0.95) }} testID="march-panel">
            <ScrollView ref={hscroll} horizontal nestedScrollEnabled showsHorizontalScrollIndicator={w > room}>
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={zoom > 1}>
                <View style={{ width: w, height: h }}>
                  {data.map.background_url ? <Image accessible={false} source={{ uri: data.map.background_url }} resizeMode="cover" style={{ position: 'absolute', width: w, height: h, opacity: 0.55 }} /> : null}
                  {data.edges.map((e, i) => { const a = byId(e.from), b = byId(e.to); return a && b ? <Edge key={i} a={a} b={b} w={w} h={h} on={visited(a) && visited(b)} /> : null; })}
                  {data.points.map((p) => {
                    const Icon = POINT_ICON[p.kind], now = p.state === 'current', locked = p.state === 'locked', seen = p.state === 'visited' || now;
                    return (
                      <Pressable key={p.id} testID={`march-point-${p.id}`} accessibilityRole="button" accessibilityLabel={`${p.name}, ${POINT_LABEL[p.kind]}, ${POINT_STATE_TEXT[p.state]}${p.done ? ', đã hoàn thành' : ''}${locked && p.locked_reason ? `. ${p.locked_reason}` : ''}`} onPress={() => go(p)}
                        style={{ position: 'absolute', left: (p.x / 100) * w - 48, top: (p.y / 100) * h - 22, width: 96, alignItems: 'center', gap: 2 }}>
                        <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: now ? c.ngoc : seen ? c.ngocChu : locked ? c.vien2 : c.dong, backgroundColor: locked ? c.vien : seen ? c.ngocNhat : c.dongNhat }}>
                          {locked ? <Lock size={20} color={c.muc3} /> : <Icon size={22} color={seen ? c.ngocChu : c.dongChu} />}
                          {p.done && p.kind !== 'start' ? <View style={{ position: 'absolute', right: -4, top: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: c.ngoc, alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="#ffffff" /></View> : null}
                        </View>
                        <Txt f="semibold" size={11} center numberOfLines={2} color={locked ? c.muc3 : c.muc} style={{ backgroundColor: `${c.the}cc`, paddingHorizontal: 4, borderRadius: 6 }}>{p.name}</Txt>
                      </Pressable>
                    );
                  })}
                  {here ? (
                    <Animated.View pointerEvents="none" accessibilityLabel={`Em đang ở ${here.name}`} style={{ position: 'absolute', zIndex: 5, left: Animated.add(Animated.multiply(ax, w / 100), -16), top: Animated.add(Animated.multiply(ay, h / 100), -46), width: 32, height: 32, borderRadius: 16, backgroundColor: c.son, borderWidth: 2, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
                      <Shield size={18} color="#ffffff" />
                    </Animated.View>
                  ) : null}
                </View>
              </ScrollView>
            </ScrollView>
          </View>
          {note ? <InfoNote><Txt size={14}>{note}</Txt></InfoNote> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {(Object.keys(POINT_LABEL) as PointKind[]).map((k) => <Chip key={k} text={POINT_LABEL[k]} icon={POINT_ICON[k]} bg={c.the2} fg={c.muc2} />)}
          </View>
          <Txt size={12} color={c.muc3}>Chạm vào một điểm đang mở để dẫn quân tới. Điểm khóa mở khi em đi qua điểm kề bên; điểm trận đánh mở khi em học tới trận đó trong lộ trình.</Txt>
        </>
      ) : null}
      {event ? <MarchEventSheet session={session} point={event.point} event={event.event} onClose={() => { setEvent(null); map.reload(); }} onStage={(id) => { setEvent(null); onStage(id); }} onSource={(id) => { setEvent(null); onSource(id); }} onChanged={onChanged} /> : null}
      {log ? <MarchLogSheet session={session} onClose={() => setLog(false)} /> : null}
    </View>
  );
};

// ---------------------------------------------------------------------- sự kiện tại điểm dừng
const DialogPlayer: React.FC<{ dialog: Dialog; onSource: (id: number) => void }> = ({ dialog, onSource }) => {
  const { c } = useTheme();
  const [n, setN] = useState(1);
  const [replies, setReplies] = useState<Record<number, string>>({});
  const line = dialog.lines[n - 1];
  const waiting = Boolean(line?.choices?.length) && replies[n - 1] === undefined;
  // Tua nhanh (HK.HS.116): hiện liền các lời thoại kế tiếp, dừng ở câu có lựa chọn trả lời để em tự chọn
  const fastForward = () => {
    let k = n;
    while (k < dialog.lines.length) { const choice = Boolean(dialog.lines[k].choices?.length); k += 1; if (choice) break; }
    setN(k);
  };
  return (
    <View style={{ gap: 10 }}>
      <Txt f="bold" size={15}>{dialog.title}</Txt>
      {dialog.lines.slice(0, n).map((l, i) => (
        <View key={i} style={{ gap: 6 }}>
          <View style={{ padding: 12, borderRadius: 14, backgroundColor: c.the2, gap: 2 }}>
            <Txt f="bold" size={13} color={c.dongChu}>{l.speaker}</Txt>
            <Txt size={15} style={{ lineHeight: 23 }}>{l.text}</Txt>
          </View>
          {replies[i] ? <View style={{ padding: 12, borderRadius: 14, backgroundColor: c.thuyNhat }}><Txt size={15} style={{ lineHeight: 23 }}>{replies[i]}</Txt></View> : null}
        </View>
      ))}
      {waiting ? (
        <View style={{ gap: 8 }}>
          <Txt size={13} color={c.muc2}>Em chọn lời đáp:</Txt>
          {line.choices!.map((ch, i) => <Btn key={i} title={ch.text} tone="giay" full onPress={() => setReplies((r) => ({ ...r, [n - 1]: ch.reply }))} />)}
        </View>
      ) : n < dialog.lines.length ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Btn title="Tiếp" tone="ngoc" full onPress={() => setN(n + 1)} testID="dialog-next" /></View>
          {dialog.lines.length - n > 1 ? <Btn icon={FastForward} title="Tua nhanh" tone="giay" onPress={fastForward} testID="dialog-fast" /> : null}
        </View>
      ) : dialog.sources.length ? (
          <View style={{ gap: 6 }}>
            <Txt f="bold" size={13} color={c.muc2}>Tư liệu liên quan</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{dialog.sources.map((s) => <Btn key={s.id} icon={BookMarked} title={s.title} tone="thuy" size="sm" onPress={() => onSource(s.id)} />)}</View>
          </View>
        ) : null}
    </View>
  );
};

const QuizPoint: React.FC<{ session: Session; pointId: number; event: Extract<MarchEvent, { kind: 'quiz' }>; onChanged: () => void }> = ({ session, pointId, event, onChanged }) => {
  const { c } = useTheme();
  const q = event.question;
  const [draft, setDraft] = useState<Draft>(() => (q ? initialDraft(q) : null));
  const [res, setRes] = useState<Awaited<ReturnType<typeof api.marchAnswer>> | null>(null);
  const { busy, run } = useAction(session.expired);
  if (!q) return <Txt size={14} color={c.muc2}>{event.done ? 'Em đã vượt thử thách này.' : 'Thử thách này chưa có câu hỏi.'}</Txt>;
  const submit = async () => {
    const out = await run(() => api.marchAnswer(session.token, pointId, buildAnswer(q.qtype, draft)));
    if (out) { setRes(out); onChanged(); }
  };
  const solved = event.done || Boolean(res?.correct);
  return (
    <View style={{ gap: 12 }}>
      {event.done && !res ? <Chip text="Em đã vượt thử thách này" bg={c.ngocNhat} fg={c.ngocChu} icon={Check} /> : null}
      <Txt f="semibold" size={17} style={{ lineHeight: 25 }}>{q.prompt}</Txt>
      {q.image_url ? <Image accessibilityLabel="Hình minh họa câu hỏi" source={{ uri: q.image_url }} resizeMode="contain" style={{ width: '100%', height: 180, borderRadius: 12 }} /> : null}
      <QuestionInput q={q} draft={draft} setDraft={setDraft} disabled={solved || busy} />
      {res ? (
        <View accessibilityLiveRegion="polite" style={{ padding: 12, borderRadius: 14, backgroundColor: res.correct ? c.ngocNhat : c.sonNhat, gap: 4 }}>
          <Txt f="bold" size={15} color={res.correct ? c.ngocChu : c.sonChu}>{res.correct ? 'Chính xác!' : 'Chưa đúng, thử lại nhé'}</Txt>
          {res.explanation ? <Txt size={14}>{res.explanation}</Txt> : null}
          {res.rewards && (res.rewards.gold || res.rewards.binh_thu) ? <Txt size={14} color={c.dongChu}>Thưởng: {res.rewards.gold ? `${res.rewards.gold} vàng` : ''}{res.rewards.gold && res.rewards.binh_thu ? ', ' : ''}{res.rewards.binh_thu ? `${res.rewards.binh_thu} Binh thư` : ''}</Txt> : null}
        </View>
      ) : null}
      {!solved ? <Btn title={res ? 'Thử lại' : 'Trả lời'} tone="ngoc" size="lg" full loading={busy} disabled={!res && !ready(q, draft)} onPress={res ? () => { setRes(null); setDraft(initialDraft(q)); } : submit} testID="march-quiz-submit" /> : null}
    </View>
  );
};

const MarchEventSheet: React.FC<{ session: Session; point: { id: number; name: string; kind: PointKind }; event: MarchEvent; onClose: () => void; onStage: (id: number) => void; onSource: (id: number) => void; onChanged: () => void }> = ({ session, point, event, onClose, onStage, onSource, onChanged }) => {
  const { c } = useTheme();
  return (
    <Sheet open onClose={onClose} title={point.name} subtitle={POINT_LABEL[point.kind]} wide footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Btn title="Đóng" tone="giay" onPress={onClose} testID="march-event-close" /></View>}>
      {event.kind === 'story' ? (event.dialog ? <DialogPlayer dialog={event.dialog} onSource={onSource} /> : <Txt size={14} color={c.muc2}>Điểm này chưa có lời thoại được phát hành.</Txt>) : null}
      {event.kind === 'card' ? (
        <View style={{ gap: 8 }}>
          {event.card ? (
            <>
              <Txt f="displayHeavy" size={20}>{event.merged ? `Em có thẻ ${event.card.name}!` : `Em nhận ${event.qty ?? 1} mảnh thẻ ${event.card.name}`}</Txt>
              {event.merged ? <Txt size={14} color={c.ngocChu}>Đủ mảnh nên thẻ đã được ghép vào bộ thẻ của em.</Txt> : <Txt size={14} color={c.muc2}>Hiện có {event.fragments ?? 0} mảnh. Gom đủ để ghép thành thẻ.</Txt>}
            </>
          ) : <Txt size={14} color={c.muc2}>{event.done ? 'Em đã nhận thẻ ở điểm này rồi.' : 'Điểm này chưa có thẻ.'}</Txt>}
        </View>
      ) : null}
      {event.kind === 'quiz' ? <QuizPoint session={session} pointId={point.id} event={event} onChanged={onChanged} /> : null}
      {event.kind === 'source' ? (event.source ? <View style={{ gap: 10 }}><Txt size={15}>Em tìm thấy một tư liệu: <Txt f="bold" size={15}>{event.source.title}</Txt>. Tư liệu đã được mở khóa trong kho tư liệu.</Txt><Btn icon={BookOpen} title="Đọc tư liệu" tone="thuy" onPress={() => onSource(event.source!.id)} /></View> : <Txt size={14} color={c.muc2}>Điểm này chưa có tư liệu được phát hành.</Txt>) : null}
      {event.kind === 'chest' ? (
        event.rewards ? (
          <View style={{ gap: 6 }}>
            <Txt f="displayHeavy" size={20}>Em mở được rương!</Txt>
            {event.rewards.gold ? <Txt size={15}>+{event.rewards.gold} vàng</Txt> : null}
            {event.rewards.binh_thu ? <Txt size={15}>+{event.rewards.binh_thu} Binh thư</Txt> : null}
            {event.rewards.fragments.map((f, i) => <Txt key={i} size={15}>+{f.qty} mảnh thẻ {f.card}{f.merged ? ' (đã ghép thành thẻ)' : ''}</Txt>)}
          </View>
        ) : <Txt size={14} color={c.muc2}>{event.done ? 'Rương này em đã mở rồi.' : 'Rương trống.'}</Txt>
      ) : null}
      {event.kind === 'battle' ? (
        <View style={{ gap: 10 }}>
          <Txt size={15}>{event.first ? 'Quân địch đã ở trước mặt! Hãy lập đội hình rồi ra trận.' : 'Em đã từng tới chiến trường này.'}</Txt>
          {event.stage_id ? <Btn icon={Swords} title="Xem màn chơi" tone="son" size="lg" full onPress={() => onStage(event.stage_id!)} testID="march-battle-open" /> : <Txt size={14} color={c.muc2}>Trận đánh này chưa có màn chơi được phát hành.</Txt>}
        </View>
      ) : null}
    </Sheet>
  );
};

const MarchLogSheet: React.FC<{ session: Session; onClose: () => void }> = ({ session, onClose }) => {
  const { c } = useTheme();
  const log = useLoad(() => api.marchLog(session.token), [session.token], session.expired);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Sheet open onClose={onClose} title="Nhật ký hành quân" subtitle="Các câu chuyện em đã nghe trên đường" wide footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Btn title="Đóng" tone="giay" onPress={onClose} /></View>}>
      <ErrorNote message={log.error} />
      {log.loading && !log.data ? <Spinner /> : null}
      {log.data && !log.data.length ? <EmptyState mood="thinking" title="Nhật ký còn trống" text="Đi tới các điểm cốt truyện trên bản đồ để ghi lại những câu chuyện." /> : null}
      <View style={{ gap: 8 }}>
        {(log.data ?? []).map((d) => (
          <Card key={d.id} flat pad={12} style={{ gap: 6 }}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: open === d.id }} onPress={() => setOpen(open === d.id ? null : d.id)} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Txt f="bold" size={15}>{d.title}</Txt>
              <Txt size={12} color={c.muc3}>{d.point_name ?? 'Hành quân'}</Txt>
            </Pressable>
            {open === d.id ? d.lines.map((l, i) => <Txt key={i} size={14}><Txt f="bold" size={14}>{l.speaker}: </Txt>{l.text}</Txt>) : null}
          </Card>
        ))}
      </View>
    </Sheet>
  );
};

// ---------------------------------------------------------------------- màn chơi: danh sách và giới thiệu
export const WarStagesTab: React.FC<{ session: Session; refreshKey: number; onIntro: (id: number) => void }> = ({ session, refreshKey, onIntro }) => {
  const { c } = useTheme();
  const list = useLoad(() => api.warStages(session.token), [session.token, refreshKey], session.expired);
  const data = list.data;
  return (
    <View style={{ gap: 12 }}>
      <ErrorNote message={list.error} />
      <Txt size={14} color={c.muc2}>Mang đội hình thẻ tướng ra chiến trường lịch sử. Tướng từng tham gia đúng trận đó được “Hào khí” tăng sức mạnh.</Txt>
      <WarBanner war={data?.war} />
      {list.loading && !data ? <Spinner label="Đang mở chiến trường…" /> : null}
      {data && !data.stages.length ? <EmptyState mood="thinking" title="Chưa có màn chơi" text="Các màn chơi xuất hiện khi nội dung được duyệt và phát hành." /> : null}
      {(data?.stages ?? []).map((s) => (
        <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`${s.title}, ${s.battle_name}, độ khó ${DIFFICULTY_LABEL[s.difficulty] ?? 'vừa'}.${s.locked ? `Chưa mở: ${s.locked_reason ?? ''}` : s.best_stars ? `Cao nhất ${s.best_stars} sao` : 'Chưa đánh'}`} onPress={() => onIntro(s.id)} testID={`war-stage-${s.id}`}
          style={({ pressed }) => ({ borderRadius: 18, borderWidth: 2, borderColor: s.locked ? c.vien : c.son, backgroundColor: pressed ? c.the2 : c.the, padding: 14, gap: 8, opacity: s.locked ? 0.85 : 1 })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: s.locked ? c.vien : c.son, alignItems: 'center', justifyContent: 'center' }}>{s.locked ? <Lock size={22} color={c.muc3} /> : <Swords size={24} color="#ffffff" />}</View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt f="displayHeavy" size={18}>{s.title}</Txt>
              <Txt size={13} color={c.muc2}>{[s.date_text ?? String(s.year), s.campaign_title].filter(Boolean).join(' · ')}</Txt>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Chip text={`Độ khó: ${DIFFICULTY_LABEL[s.difficulty] ?? 'Vừa'}`} bg={c.dichNhat} fg={c.dich} />
            <Chip text={`Tối đa ${s.max_turns} lượt`} bg={c.thuyNhat} fg={c.thuyChu} />
            {s.commander_name ? <Chip text={`Chỉ huy: ${s.commander_name}`} bg={c.sonNhat} fg={c.sonChu} /> : null}
            {s.locked ? <Chip text="Chưa mở" bg={c.vien} fg={c.muc2} icon={Lock} /> : null}
            {s.clears ? <><Stars n={s.best_stars} size={16} /><Txt size={13} color={c.muc2}>Thắng {s.clears} lần</Txt></> : s.attempts ? <Txt size={13} color={c.muc2}>Đã đánh {s.attempts} lần</Txt> : null}
          </View>
          {s.locked && s.locked_reason ? <Txt size={13} color={c.muc3}>{s.locked_reason}</Txt> : null}
        </Pressable>
      ))}
    </View>
  );
};

/** Sa bàn của trận (HK.HS.137): mặc định bản vẽ 2D nhẹ chạy trên máy phòng tin học; máy đủ mạnh bật Sa bàn 3D để xoay và phóng to */
const SandSheet: React.FC<{ session: Session; id: number; onClose: () => void }> = ({ session, id, onClose }) => {
  const data = useLoad(() => api.sandtable(session.token, id), [session.token, id], session.expired);
  return (
    <Sheet open onClose={onClose} title="Sa bàn của trận" subtitle={data.data?.stage.battle_name} wide footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Btn title="Đóng" tone="giay" onPress={onClose} /></View>}>
      <ErrorNote message={data.error} />
      {data.loading && !data.data ? <Spinner /> : null}
      {data.data ? <SandTableView detail={data.data} /> : null}
    </Sheet>
  );
};

export const StageIntroSheet: React.FC<{ session: Session; id: number; onClose: () => void; onStart: (battle: BattleView) => void; onTruth: (stageId: number) => void; onChanged: () => void; onDecision?: (scenarioId: number, title: string) => void; onReplay?: (battleId: number) => void }> = ({ session, id, onClose, onStart, onTruth, onChanged, onDecision, onReplay }) => {
  const { c } = useTheme();
  const student = session.user.role === 'student';
  const intro = useLoad(() => api.stageIntro(session.token, id), [session.token, id], session.expired);
  const forms = useLoad(() => (student ? api.formations(session.token) : Promise.resolve({ slots: [] })), [session.token, student], session.expired);
  const { busy, run } = useAction(session.expired);
  const [slot, setSlot] = useState<number | null>(null);
  const [sand, setSand] = useState(false);
  const [useDecision, setUseDecision] = useState(true);
  const d: StageIntro | null = intro.data;
  const slots = forms.data?.slots ?? [];
  const chosen = slot ?? slots.find((s) => s.size > 0)?.slot ?? 1;
  const picked = slots.find((s) => s.slot === chosen);
  const start = async (restart?: boolean) => {
    const battle = await run(() => api.startStage(session.token, id, { slot: chosen, restart, use_decision: Boolean(d?.decision?.ready && useDecision) }));
    if (battle) onStart(battle);
  };
  const preview = async () => { const battle = await run(() => api.previewStage(session.token, id)); if (battle) onStart(battle); };
  const skip = async () => {
    const out = await run(() => api.skipStage(session.token, id));
    if (out) { onChanged(); intro.reload(); }
  };
  return (
    <Sheet open onClose={onClose} title={d?.title ?? 'Màn chơi'} subtitle={d ? [d.battle.date_text ?? String(d.battle.year), d.battle.name].join(' · ') : undefined} wide
      footer={d ? (
        <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Btn title="Đóng" tone="giay" onPress={onClose} />
          {student && d.progress.best_stars >= 3 ? <Btn icon={FastForward} title="Bỏ qua, nhận nửa thưởng" tone="giay" loading={busy} disabled={!d.war.open} onPress={skip} testID="stage-skip" /> : null}
          {student ? <Btn icon={RotateCcw} title="Đánh lại từ đầu" tone="giay" loading={busy} disabled={!d.war.open || !picked?.size} onPress={() => start(true)} testID="stage-restart" /> : null}
          {student ? <Btn icon={Play} title="Ra trận" tone="son" loading={busy} disabled={!d.war.open || !picked?.size} onPress={() => start()} testID="stage-start" /> : <Btn icon={Play} title="Chơi thử (không ghi điểm)" tone="son" loading={busy} onPress={preview} testID="stage-preview" />}
        </View>
      ) : undefined}>
      <ErrorNote message={intro.error} />
      {intro.loading && !d ? <Spinner /> : null}
      {d ? (
        <View style={{ gap: 12 }}>
          <WarBanner war={d.war} />
          {d.class_link?.lock_reason ? <InfoNote><Txt size={14}>{d.class_link.lock_reason}</Txt></InfoNote> : null}
          {d.summary ? <Txt size={15} style={{ lineHeight: 23 }}>{d.summary}</Txt> : d.battle.context ? <Txt size={15} style={{ lineHeight: 23 }}>{d.battle.context}</Txt> : null}
          {d.objective ? <Card flat pad={12} style={{ borderColor: c.dong }}><Txt f="bold" size={13} color={c.dongChu}>Nhiệm vụ</Txt><Txt f="semibold" size={16}>{d.objective}</Txt></Card> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip text={`Độ khó: ${DIFFICULTY_LABEL[d.difficulty] ?? 'Vừa'}`} bg={c.dichNhat} fg={c.dich} />
            <Chip text={`Tối đa ${d.max_turns} lượt`} bg={c.thuyNhat} fg={c.thuyChu} />
            {d.progress.best_stars ? <Chip text={`Cao nhất ${d.progress.best_stars} sao`} bg={c.dongNhat} fg={c.dongChu} /> : null}
            {d.class_link && !d.class_link.skill_questions ? <Chip text="Giáo viên tắt câu hỏi tuyệt kỹ" bg={c.ngocNhat} fg={c.ngocChu} /> : null}
          </View>
          {d.has_sandtable ? <Btn icon={Cuboid} title="Xem Sa bàn của trận" tone="giay" size="sm" onPress={() => setSand(true)} testID="stage-sand" /> : null}
          <View style={{ gap: 2 }}>
            <Txt f="bold" size={14}>Đạt sao khi</Txt>
            {d.stars.map((s, i) => <Txt key={i} size={14} color={c.muc2}>{i + 1} sao: {s}</Txt>)}
          </View>
          <View style={{ gap: 4 }}>
            <Txt f="bold" size={14}>Quân địch</Txt>
            {d.enemies.map((w, i) => <Txt key={i} size={14}>{w.label ?? `Làn sóng ${i + 1}`}: {w.units.map((u) => `${u.name}${u.commander ? ' (chỉ huy)' : ''}`).join(', ')}</Txt>)}
            {d.commander ? <Txt size={13} color={c.muc2}>Chỉ huy: {d.commander.name}{d.commander.role_text ? ` – ${d.commander.role_text}` : ''}</Txt> : null}
          </View>
          {d.terrain_notes.length ? <View style={{ gap: 2 }}><Txt f="bold" size={14}>Địa hình</Txt>{d.terrain_notes.map((t, i) => <Txt key={i} size={14} color={c.muc2}>• {t}</Txt>)}</View> : null}
          {d.suggested_cards.length ? (
            <View style={{ gap: 6 }}>
              <Txt f="bold" size={14}>Tướng nên mang (được “Hào khí” +10%)</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{d.suggested_cards.map((s) => <Chip key={s.id} text={`${s.name}${s.owned ? '' : ' (chưa có)'}`} bg={s.owned ? `${RARITY_COLOR[s.rarity]}22` : c.vien} fg={s.owned ? RARITY_COLOR[s.rarity] : c.muc3} />)}</View>
            </View>
          ) : null}
          <Txt size={13} color={c.muc2}>Thưởng lần đầu thắng: {d.rewards.gold} vàng, {d.rewards.binh_thu} Binh thư, {d.rewards.xp} điểm kinh nghiệm{d.rewards.card ? ', một thẻ tướng' : ''}{d.rewards.fragments ? `, ${d.rewards.fragments} mảnh thẻ` : ''}.</Txt>
          {student && d.decision ? (
            <Card flat pad={12} style={{ gap: 8, borderColor: c.thuy }}>
              <Txt f="bold" size={14}>Quyết sách trước trận</Txt>
              <Txt size={13} color={c.muc2} style={{ lineHeight: 20 }}>Làm bài quyết sách “{d.decision.title}” trước khi ra trận: quyết định đúng nhiều thì cả đội mạnh thêm tới 15% công và thủ, sai nhiều thì yếu đi tới 15%. Kết quả có hiệu lực {d.decision.hours} giờ và dùng cho một trận. Không bắt buộc.</Txt>
              {d.decision.ready ? (
                <View style={{ gap: 8 }}>
                  <Chip text={`Đã làm: ${d.decision.ready.percent}% → ${d.decision.ready.modifier_pct > 0 ? '+' : ''}${d.decision.ready.modifier_pct}% công và thủ`} bg={d.decision.ready.modifier_pct >= 0 ? c.ngocNhat : c.sonNhat} fg={d.decision.ready.modifier_pct >= 0 ? c.ngocChu : c.sonChu} />
                  <Segmented<'yes' | 'no'> label="Dùng kết quả quyết sách" value={useDecision ? 'yes' : 'no'} onChange={(v) => setUseDecision(v === 'yes')} options={[{ value: 'yes', label: 'Dùng lợi thế này' }, { value: 'no', label: 'Không dùng' }]} />
                </View>
              ) : null}
              {onDecision ? <Btn icon={ScrollText} title={d.decision.ready ? 'Làm lại quyết sách' : 'Làm quyết sách'} tone="thuy" size="sm" onPress={() => onDecision(d.decision!.scenario_id, d.decision!.title)} testID="stage-decision" /> : null}
            </Card>
          ) : null}
          {student && d.recent?.length && onReplay ? (
            <View style={{ gap: 6 }}>
              <Txt f="bold" size={14}>Xem lại trận gần đây</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {d.recent.map((r) => <Btn key={r.id} icon={HistoryIcon} tone="giay" size="sm" title={`${r.status === 'won' ? `Thắng · ${r.stars} sao` : 'Thua'} · ${new Date(r.finished_at).toLocaleString('vi-VN')}`} onPress={() => onReplay(r.id)} testID={`stage-replay-${r.id}`} />)}
              </View>
            </View>
          ) : null}
          {student ? (
            <View style={{ gap: 8 }}>
              <Txt f="bold" size={14}>Đội hình ra trận</Txt>
              <Segmented<number> label="Chọn đội hình" value={chosen} onChange={setSlot} options={[1, 2, 3].map((n) => { const s = slots.find((x) => x.slot === n); return { value: n, label: `Đội ${n} (${s?.size ?? 0})` }; })} />
              {picked?.size ? <Txt size={13} color={c.muc2}>{picked.name}: {picked.size} thẻ, lực chiến {picked.power}.</Txt> : <InfoNote><Txt size={14}>Đội hình này còn trống. Vào “Bộ thẻ → Đội hình” để chọn tối đa 5 thẻ.</Txt></InfoNote>}
            </View>
          ) : null}
          {d.progress.clears > 0 || !student ? <Btn icon={ScrollText} title="Sự thật lịch sử" tone="thuy" onPress={() => onTruth(d.id)} testID="stage-truth" /> : null}
        </View>
      ) : null}
      {sand ? <SandSheet session={session} id={id} onClose={() => setSand(false)} /> : null}
    </Sheet>
  );
};

export const TruthSheet: React.FC<{ session: Session; id: number; onClose: () => void; onSource: (id: number) => void }> = ({ session, id, onClose, onSource }) => {
  const { c } = useTheme();
  const truth = useLoad(() => api.stageTruth(session.token, id), [session.token, id], session.expired);
  const t = truth.data;
  return (
    <Sheet open onClose={onClose} title="Sự thật lịch sử" subtitle={t?.battle.name} wide footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Btn title="Đóng" tone="giay" onPress={onClose} testID="truth-close" /></View>}>
      <ErrorNote message={truth.error} />
      {truth.loading && !t ? <Spinner /> : null}
      {t ? (
        <View style={{ gap: 12 }}>
          <Txt size={13} color={c.muc3}>{[t.battle.date_text ?? String(t.battle.year)].join(' · ')}</Txt>
          {t.battle.context ? <View><Txt f="bold" size={13} color={c.muc2}>Bối cảnh</Txt><Txt size={15} style={{ lineHeight: 23 }}>{t.battle.context}</Txt></View> : null}
          {t.battle.forces ? <View><Txt f="bold" size={13} color={c.muc2}>Lực lượng</Txt><Txt size={15} style={{ lineHeight: 23 }}>{t.battle.forces}</Txt></View> : null}
          {t.battle.course ? <View><Txt f="bold" size={13} color={c.muc2}>Diễn biến thật</Txt><Txt size={15} style={{ lineHeight: 23 }}>{t.battle.course}</Txt></View> : null}
          {t.battle.result ? <View><Txt f="bold" size={13} color={c.muc2}>Kết quả</Txt><Txt size={15} style={{ lineHeight: 23 }}>{t.battle.result}</Txt></View> : null}
          {t.commander ? <Card flat pad={12} style={{ gap: 2 }}><Txt f="bold" size={14}>Chỉ huy đối phương: {t.commander.name}</Txt>{t.commander.tactics ? <Txt size={14}>Chiến thuật: {t.commander.tactics}</Txt> : null}{t.commander.outcome ? <Txt size={14}>Kết cục: {t.commander.outcome}</Txt> : null}</Card> : null}
          {t.differences.length ? <Card flat pad={12} style={{ gap: 4, borderColor: c.dong }}><Txt f="bold" size={14} color={c.dongChu}>Ván chơi khác lịch sử thật ở điểm nào?</Txt>{t.differences.map((x, i) => <Txt key={i} size={14}>• {x}</Txt>)}</Card> : null}
          {t.figures.length ? <View style={{ gap: 4 }}><Txt f="bold" size={14}>Nhân vật liên quan</Txt>{t.figures.map((f) => <Txt key={f.id} size={14}>• {f.name}{f.honorific ? ` (${f.honorific})` : ''}{f.role_text ? ` – ${f.role_text}` : ''}</Txt>)}</View> : null}
          {t.sources.length ? (
            <View style={{ gap: 6 }}>
              <Txt f="bold" size={14}>Tư liệu gốc</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{t.sources.map((s) => <Btn key={s.id} icon={s.locked ? Lock : BookMarked} title={s.title} tone="thuy" size="sm" disabled={s.locked} onPress={() => onSource(s.id)} />)}</View>
            </View>
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
};

// ---------------------------------------------------------------------- trận đánh theo lượt
const EFFECT_TEXT: Record<string, string> = { stun: 'Choáng', shield: 'Khiên', atk_up: 'Tăng công', def_up: 'Tăng thủ', atk_down: 'Giảm công', burn: 'Bỏng', hunger: 'Thiếu lương' };

const UnitTile: React.FC<{ u: UnitView; acting: boolean; targeted: boolean; telegraphed: boolean; onPress?: () => void }> = ({ u, acting, targeted, telegraphed, onPress }) => {
  const { c } = useTheme();
  const ally = u.side === 'ally';
  const tone = ally ? c.ngoc : c.son;
  // Hiệu ứng nội tại kéo dài cả trận (số lượt rất lớn) hiện không kèm số lượt; các hiệu ứng giống nhau gộp lại “×n”
  const effects = Object.values(u.effects.reduce<Record<string, { text: string; n: number }>>((acc, e) => {
    const text = `${EFFECT_TEXT[e.type] ?? e.type}${e.turns > 30 ? '' : ` ${e.turns} lượt`}`;
    acc[text] = { text, n: (acc[text]?.n ?? 0) + 1 };
    return acc;
  }, {}));
  return (
    <Pressable accessibilityRole={onPress ? 'button' : 'text'} accessibilityLabel={`${ally ? 'Đồng đội' : 'Quân địch'} ${u.name}${u.commander ? ', chỉ huy' : ''}, máu ${u.hp} trên ${u.max_hp}${u.alive ? '' : ', đã ngã xuống'}${acting ? ', đang tới lượt' : ''}${telegraphed ? ', bị nhắm bởi chiêu lớn' : ''}${targeted ? ', đang được chọn làm mục tiêu' : ''}`} disabled={!onPress || !u.alive} onPress={onPress} testID={`war-unit-${u.id}`}
      style={{ width: '31.5%', minWidth: 104, flexGrow: 1, padding: 8, gap: 4, borderRadius: 14, borderWidth: 3, borderColor: acting ? c.dong : targeted ? c.son : telegraphed ? c.sonChu : c.vien, backgroundColor: c.the, opacity: u.alive ? 1 : 0.45 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <CardPortrait card={{ name: u.name, rarity: u.commander ? 'epic' : 'common', branch: u.branch, kind: 'general', owned: true }} size={34} />
        <Txt f="bold" size={12} numberOfLines={2} style={{ flex: 1 }}>{u.name}</Txt>
      </View>
      <Bar value={u.hp} max={Math.max(1, u.max_hp)} height={8} fill={tone} label={`Máu ${u.hp}/${u.max_hp}`} />
      <Txt size={11} color={c.muc2}>Máu {u.hp}/{u.max_hp}{u.guard ? ' · Thủ' : ''}</Txt>
      {ally ? <><Bar value={u.rage} max={100} height={6} fill="#e69a00" label={`Nộ ${u.rage}`} /><Txt size={10} color={c.muc3}>Nộ {u.rage}/100</Txt></> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
        {u.commander ? <Chip text="Chỉ huy" bg={c.sonNhat} fg={c.sonChu} /> : null}
        {u.hao_khi ? <Chip text="Hào khí" bg={c.dongNhat} fg={c.dongChu} /> : null}
        {!u.alive ? <Chip text="Ngã xuống" bg={c.vien} fg={c.muc2} /> : null}
        {telegraphed && u.alive ? <Chip text="Bị nhắm!" bg={c.sonNhat} fg={c.sonChu} /> : null}
        {effects.map((e) => <Chip key={e.text} text={e.n > 1 ? `${e.text} ×${e.n}` : e.text} bg={c.thuyNhat} fg={c.thuyChu} />)}
      </View>
    </Pressable>
  );
};

const LOG_TONE: Record<string, 'muc' | 'ngocChu' | 'thuyChu' | 'sonChu' | 'dongChu' | 'vangChu'> = { hit: 'muc', heal: 'ngocChu', effect: 'thuyChu', alert: 'sonChu', wave: 'dongChu', end: 'dongChu', question: 'vangChu', info: 'muc' };

export const WarBattleScreen: React.FC<{ session: Session; battleId: number; initial?: BattleView; onClose: (changed: boolean) => void; onTruth: (stageId: number) => void; onRestart?: (stageId: number) => void; onReplay?: (battleId: number) => void }> = ({ session, battleId, initial, onClose, onTruth, onRestart, onReplay }) => {
  const { c } = useTheme();
  const { token } = session;
  const [view, setView] = useState<BattleView | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const [fast, setFast] = useState(false);
  const [draft, setDraft] = useState<Draft>(null);
  const [left, setLeft] = useState(0);
  const [feedback, setFeedback] = useState<{ correct: boolean; in_time: boolean; explanation: string | null } | null>(null);
  const deadline = useRef(0);
  const guard = useCallback((e: unknown) => { if (e instanceof ApiError && e.status === 401) session.expired(); setError(errorMessage(e)); setAuto(false); }, [session]);

  useEffect(() => { if (!view) api.warBattle(token, battleId).then(setView).catch(guard); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback(async (body: { type: string; slot?: string; target?: string; steps?: number }) => {
    setBusy(true); setError(null);
    try { setView(await api.battleAct(token, battleId, body)); } catch (e) { guard(e); } finally { setBusy(false); }
  }, [token, battleId, guard]);

  // Câu hỏi tuyệt kỹ: đồng hồ đếm ngược chạy từ thời gian còn lại do máy chủ báo; máy chủ mới là nơi đo thật
  const qkey = view?.question ? `${view.turn}:${view.question.view.id}` : null;
  useEffect(() => {
    if (!view?.question) return undefined;
    deadline.current = Date.now() + view.question.remaining_ms;
    setDraft(initialDraft(view.question.view)); setLeft(view.question.remaining_ms);
    const t = setInterval(() => setLeft(Math.max(0, deadline.current - Date.now())), 250);
    return () => clearInterval(t);
  }, [qkey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tự động đánh: mỗi nhịp gửi vài bước; dừng khi gặp câu hỏi tuyệt kỹ hoặc hết trận
  useEffect(() => {
    if (!auto || busy || !view || view.status !== 'active' || view.question || view.pending) return undefined;
    const t = setTimeout(() => { void send({ type: 'auto_run', steps: fast ? 6 : 3 }); }, fast ? 450 : 900);
    return () => clearTimeout(t);
  }, [auto, busy, view, fast, send]);

  const answer = async () => {
    if (!view?.question) return;
    setBusy(true); setError(null);
    try {
      const out = await api.battleAnswer(token, battleId, buildAnswer(view.question.view.qtype, draft));
      setFeedback({ correct: out.result.correct, in_time: out.result.in_time, explanation: out.result.explanation });
      setView(out.battle);
    } catch (e) { guard(e); } finally { setBusy(false); }
  };

  if (!view) return error ? <ErrorNote message={error} /> : <Spinner label="Đang chuẩn bị trận đánh…" />;
  const actor = view.units.find((u) => u.id === view.actor) ?? null;
  const allies = view.units.filter((u) => u.side === 'ally'), enemies = view.units.filter((u) => u.side === 'enemy');
  const over = view.status !== 'active';
  const targetOf = (slot: 'normal' | 'active' | 'ultimate') => actor?.moves.find((m) => m.slot === slot)?.target ?? 'enemy_one';
  const move = (slot: 'normal' | 'active' | 'ultimate') => {
    const t = targetOf(slot);
    const pick = (t === 'enemy_one' || t === 'ally_one') && target && view.units.find((u) => u.id === target && u.alive && u.side === (t === 'enemy_one' ? 'enemy' : 'ally')) ? target : undefined;
    void send({ type: 'move', slot, target: pick });
    setFeedback(null);
  };
  const act = (type: 'guard' | 'tactic' | 'auto') => { void send({ type }); setFeedback(null); };
  const pickable = (u: UnitView) => !over && !view.question && !busy && actor !== null && u.alive;

  if (over && view.result) return <WarResult view={view} onClose={() => onClose(true)} onTruth={() => onTruth(view.stage.id)} onRestart={onRestart && view.mode === 'play' ? () => onRestart(view.stage.id) : undefined} onReplay={onReplay ? () => onReplay(view.id) : undefined} />;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Txt f="bold" size={13} color={c.muc3} upper numberOfLines={2} style={{ flex: 1 }}>{view.stage.title}{view.mode === 'preview' ? ' · chơi thử' : ''}</Txt>
          <Stars n={view.stars_now} size={18} label={`Đang đạt ${view.stars_now} sao`} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip text={`Lượt ${Math.min(view.turn, view.max_turns)}/${view.max_turns}`} bg={c.thuyNhat} fg={c.thuyChu} />
          <Chip text={`Làn sóng ${view.wave}/${view.waves}`} bg={c.sonNhat} fg={c.sonChu} />
          {view.tide ? <Chip text={view.tide === 'high' ? 'Triều lên' : 'Triều rút'} bg={view.tide === 'high' ? c.thuyNhat : c.dongNhat} fg={view.tide === 'high' ? c.thuyChu : c.dongChu} /> : null}
          {view.terrain.stakes ? <Chip text="Cọc ngầm" bg={c.dongNhat} fg={c.dongChu} /> : null}
          {view.terrain.hunger ? <Chip text="Địch thiếu lương" bg={c.dongNhat} fg={c.dongChu} /> : null}
          {view.mode === 'play' ? <Chip text={`Tối đa 3 sao nếu thắng trong ${view.star_turns} lượt`} bg={c.the2} fg={c.muc2} /> : null}
          {view.advantage && view.advantage.modifier_pct !== 0 ? <Chip text={`Quyết sách ${view.advantage.percent}%: ${view.advantage.modifier_pct > 0 ? '+' : ''}${view.advantage.modifier_pct}% công và thủ`} bg={view.advantage.modifier_pct > 0 ? c.ngocNhat : c.sonNhat} fg={view.advantage.modifier_pct > 0 ? c.ngocChu : c.sonChu} /> : null}
        </View>
      </View>
      {view.stage.background_url ? <Image accessible={false} source={{ uri: view.stage.background_url }} resizeMode="cover" style={{ width: '100%', height: 110, borderRadius: 14, opacity: 0.85 }} /> : null}
      <View accessibilityLabel={`Thứ tự lượt: ${view.order.map((id) => view.units.find((u) => u.id === id)?.name).filter(Boolean).join(', ')}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Txt f="bold" size={12} color={c.muc3}>Thứ tự lượt</Txt>
        {view.order.slice(0, 10).map((id, i) => {
          const u = view.units.find((x) => x.id === id);
          if (!u || !u.alive) return null;
          return (
            <View key={`${id}-${i}`} style={{ borderRadius: 999, borderWidth: 2, borderColor: id === view.actor ? c.dong : u.side === 'ally' ? c.ngoc : c.son, backgroundColor: id === view.actor ? c.dongNhat : c.the, paddingHorizontal: 8, minHeight: 28, justifyContent: 'center' }}>
              <Txt f={id === view.actor ? 'bold' : 'medium'} size={11}>{u.name.split(/\s+/).slice(-2).join(' ')}</Txt>
            </View>
          );
        })}
      </View>
      <ErrorNote message={error} />
      {view.telegraph ? (
        <View accessibilityLiveRegion="assertive" style={{ padding: 12, borderRadius: 14, backgroundColor: c.sonNhat, borderWidth: 2, borderColor: c.son }}>
          <Txt f="bold" size={14} color={c.sonChu}>Chỉ huy địch sắp tung chiêu lớn!</Txt>
          <Txt size={13} color={c.sonChu}>Mục tiêu: {view.telegraph.targets.map((t) => view.units.find((u) => u.id === t)?.name ?? t).join(', ')}. Hãy phòng thủ hoặc hạ chỉ huy trước.</Txt>
        </View>
      ) : null}
      <Txt f="bold" size={14} color={c.sonChu}>Quân địch</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {enemies.map((u) => <UnitTile key={u.id} u={u} acting={u.id === view.actor} targeted={target === u.id} telegraphed={Boolean(view.telegraph?.targets.includes(u.id))} onPress={pickable(u) ? () => setTarget(target === u.id ? null : u.id) : undefined} />)}
      </View>
      <Txt f="bold" size={14} color={c.ngocChu}>Quân ta</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {allies.map((u) => <UnitTile key={u.id} u={u} acting={u.id === view.actor} targeted={target === u.id} telegraphed={Boolean(view.telegraph?.targets.includes(u.id))} onPress={pickable(u) ? () => setTarget(target === u.id ? null : u.id) : undefined} />)}
      </View>

      {view.question ? (
        <Card style={{ gap: 12, borderColor: c.dong }}>
          <Txt f="bold" size={13} color={c.dongChu}>Tuyệt kỹ: trả lời đúng và kịp giờ để tăng sức mạnh (×1,6); sai hoặc chậm chỉ còn ×0,6</Txt>
          <LiveCountdown remaining={left} total={view.question.seconds} />
          {left <= 0 ? <Txt size={13} color={c.sonChu}>Hết giờ! Em vẫn trả lời được nhưng tuyệt kỹ sẽ yếu đi.</Txt> : null}
          <Txt f="semibold" size={17} style={{ lineHeight: 25 }}>{view.question.view.prompt}</Txt>
          {view.question.view.image_url ? <Image accessibilityLabel="Hình minh họa câu hỏi" source={{ uri: view.question.view.image_url }} resizeMode="contain" style={{ width: '100%', height: 160, borderRadius: 12 }} /> : null}
          <QuestionInput q={view.question.view} draft={draft} setDraft={setDraft} disabled={busy} />
          <Btn title="Tung tuyệt kỹ" tone="son" size="lg" full loading={busy} disabled={!ready(view.question.view, draft)} onPress={answer} testID="war-answer" />
        </Card>
      ) : actor ? (
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Txt f="displayHeavy" size={18}>Lượt của {actor.name}</Txt>
            <Chip text={`Nộ ${actor.rage}/100`} bg={c.dongNhat} fg={c.dongChu} />
          </View>
          <Txt size={12} color={c.muc3}>{target ? `Mục tiêu đã chọn: ${view.units.find((u) => u.id === target)?.name}. Chạm lại để bỏ chọn.` : 'Chạm vào một đơn vị để chọn mục tiêu; không chọn thì tự đánh mục tiêu mặc định.'}</Txt>
          {feedback ? (
            <View accessibilityLiveRegion="polite" style={{ padding: 10, borderRadius: 12, backgroundColor: feedback.correct && feedback.in_time ? c.ngocNhat : c.vangNhat, gap: 2 }}>
              <Txt f="bold" size={14}>{feedback.correct ? (feedback.in_time ? 'Tuyệt kỹ phát huy trọn vẹn (×1,6)!' : 'Đúng nhưng chậm, tuyệt kỹ yếu đi (×0,6).') : 'Chưa đúng, tuyệt kỹ yếu đi (×0,6).'}</Txt>
              {feedback.explanation ? <Txt size={13}>{feedback.explanation}</Txt> : null}
            </View>
          ) : null}
          {(['normal', 'active', 'ultimate'] as const).map((slot) => {
            const m = actor.moves.find((x) => x.slot === slot);
            if (!m) return null;
            const can = view.available.includes(slot) && !busy;
            return (
              <Pressable key={slot} accessibilityRole="button" accessibilityState={{ disabled: !can }} accessibilityLabel={`${SLOT_LABEL[slot]}: ${m.name}${m.rage_cost ? `, tốn ${m.rage_cost} nộ` : ''}${m.cooldown_left ? `, còn ${m.cooldown_left} lượt hồi` : ''}`} disabled={!can} onPress={() => move(slot)} testID={`war-move-${slot}`}
                style={({ pressed }) => ({ minHeight: 56, padding: 12, borderRadius: 14, borderWidth: 2, borderColor: can ? (slot === 'ultimate' ? c.dong : c.ngoc) : c.vien, backgroundColor: pressed ? c.the2 : can ? c.the : c.vien, opacity: can ? 1 : 0.6, gap: 2 })}>
                <Txt f="bold" size={15}>{SLOT_LABEL[slot]}: {m.name}</Txt>
                {m.description ? <Txt size={12} color={c.muc2}>{m.description}</Txt> : null}
                <Txt size={11} color={c.muc3}>{m.rage_cost ? `Tốn ${m.rage_cost} nộ` : 'Không tốn nộ'}{m.cooldown_left ? ` · còn ${m.cooldown_left} lượt hồi` : ''}{slot === 'ultimate' ? ' · cần trả lời câu hỏi' : ''}</Txt>
              </Pressable>
            );
          })}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Btn icon={Shield} title="Phòng thủ" tone="thuy" size="sm" disabled={busy} onPress={() => act('guard')} testID="war-guard" />
            {view.tactic ? <Btn icon={ScrollText} title={view.tactic.used ? `${view.tactic.name} (đã dùng)` : `Thẻ: ${view.tactic.name}`} tone="dong" size="sm" disabled={busy || view.tactic.used} onPress={() => act('tactic')} testID="war-tactic" /> : null}
            <Btn title="Đánh tự động lượt này" tone="giay" size="sm" disabled={busy} onPress={() => act('auto')} testID="war-auto-turn" />
          </View>
          {view.tactic && !view.tactic.used && view.tactic.text ? <Txt size={12} color={c.muc3}>{view.tactic.name}: {view.tactic.text} (dùng một lần, không mất lượt)</Txt> : null}
        </Card>
      ) : <Spinner label="Quân địch đang hành động…" />}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Btn icon={auto ? Shield : Play} title={auto ? 'Dừng tự động' : 'Tự động đánh'} tone={auto ? 'son' : 'giay'} size="sm" onPress={() => setAuto(!auto)} testID="war-auto-run" />
        <Btn icon={FastForward} title={fast ? 'Tốc độ x2' : 'Tốc độ x1'} tone={fast ? 'dong' : 'giay'} size="sm" onPress={() => setFast(!fast)} testID="war-speed" />
      </View>
      <View style={{ gap: 4 }}>
        <Txt f="bold" size={13} color={c.muc2}>Diễn biến</Txt>
        {view.log.slice(-7).map((l, i) => <Txt key={`${l.t}-${i}`} size={13} color={c[LOG_TONE[l.kind] ?? 'muc']} f={l.kind === 'alert' || l.kind === 'end' ? 'bold' : 'body'}>• {l.text}</Txt>)}
      </View>
    </View>
  );
};

const WarResult: React.FC<{ view: BattleView; onClose: () => void; onTruth: () => void; onRestart?: () => void; onReplay?: () => void }> = ({ view, onClose, onTruth, onRestart, onReplay }) => {
  const { c } = useTheme();
  const r = view.result!;
  const rw = r.rewards;
  return (
    <View style={{ gap: 14 }}>
      <Card style={{ alignItems: 'center', gap: 8, backgroundColor: r.won ? c.ngocNhat : c.the2 }}>
        <Trophy size={40} color={r.won ? c.ngocChu : c.muc3} />
        <Txt f="displayHeavy" size={26} center accessibilityRole="header">{r.won ? 'Chiến thắng!' : 'Chưa thắng, thử lại nhé'}</Txt>
        {r.won ? <Stars n={r.stars} size={32} label={`${r.stars} sao`} /> : null}
        <Txt size={14} color={c.muc2} center>{r.turns} lượt · {r.ally_down} tướng ngã xuống{r.best_unit ? ` · ${r.best_unit.name} gây nhiều sát thương nhất (${r.best_unit.damage})` : ''}</Txt>
        <Txt size={13} color={c.muc3} center>Tuyệt kỹ: {r.ultimates} lần, trong đó {r.ultimates_strong} lần phát huy trọn vẹn</Txt>
      </Card>
      {r.preview ? <Chip text="Chơi thử: không ghi điểm hay phần thưởng" bg={c.dichNhat} fg={c.dich} /> : null}
      {r.won && !r.preview ? (
        <Card flat pad={14} style={{ gap: 4 }}>
          <Txt f="bold" size={15}>{r.first_clear ? 'Phần thưởng lần đầu thắng' : 'Em đã thắng màn này trước đó, không nhận thêm thưởng'}</Txt>
          {rw.gold ? <Txt size={14}>+{rw.gold} vàng</Txt> : null}
          {rw.binh_thu ? <Txt size={14}>+{rw.binh_thu} Binh thư</Txt> : null}
          {rw.xp ? <Txt size={14}>+{rw.xp} điểm kinh nghiệm</Txt> : null}
          {rw.card ? <Txt f="bold" size={14} color={c.dongChu}>Em nhận được thẻ {rw.card}!</Txt> : null}
          {rw.fragments.map((f, i) => <Txt key={i} size={14}>+{f.qty} mảnh thẻ {f.card}</Txt>)}
          {rw.merged.length ? <Txt size={14} color={c.ngocChu}>Đã ghép thành thẻ: {rw.merged.join(', ')}</Txt> : null}
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Btn icon={ScrollText} title="Sự thật lịch sử" tone="thuy" onPress={onTruth} testID="war-truth" />
        {onReplay ? <Btn icon={HistoryIcon} title="Xem lại trận" tone="giay" onPress={onReplay} testID="war-watch" /> : null}
        {onRestart ? <Btn icon={RotateCcw} title="Đánh lại" tone="dong" onPress={onRestart} testID="war-replay" /> : null}
        <Btn title="Xong" tone="ngoc" onPress={onClose} testID="war-done" />
      </View>
    </View>
  );
};

/** Xem lại trận đã kết thúc (HK.SYS.022): từng bước theo nhật ký máy chủ đã ghi, tự phát hoặc bấm từng bước */
export const WarReplaySheet: React.FC<{ session: Session; id: number; onClose: () => void }> = ({ session, id, onClose }) => {
  const { c } = useTheme();
  const data = useLoad(() => api.battleReplay(session.token, id), [session.token, id], session.expired);
  const frames: ReplayFrame[] = data.data?.frames ?? [];
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return undefined;
    if (i >= frames.length - 1) { setPlaying(false); return undefined; }
    const t = setTimeout(() => setI((x) => Math.min(frames.length - 1, x + 1)), 1100);
    return () => clearTimeout(t);
  }, [playing, i, frames.length]);
  const f: ReplayFrame | undefined = frames[Math.min(i, frames.length - 1)];
  const side = (s: 'a' | 'e') => (f?.units ?? []).filter((u) => u[2] === s);
  const row = (u: ReplayFrame['units'][number]) => (
    <View key={u[0]} style={{ gap: 3, opacity: u[6] ? 1 : 0.55 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Txt f="semibold" size={13} style={{ flex: 1 }}>{u[1]}{u[6] ? '' : ' · ngã xuống'}</Txt>
        <Txt size={12} color={c.muc2}>Máu {u[3]}/{u[4]} · Nộ {u[5]}</Txt>
      </View>
      <Bar value={u[3]} max={Math.max(1, u[4])} height={8} fill={u[2] === 'a' ? c.ngoc : c.son} label={`${u[1]}: máu ${u[3]}/${u[4]}`} />
    </View>
  );
  return (
    <Sheet open onClose={onClose} title="Xem lại trận" subtitle={data.data?.stage.title} wide footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Btn title="Đóng" tone="giay" onPress={onClose} testID="replay-close" /></View>}>
      <ErrorNote message={data.error} />
      {data.loading && !data.data ? <Spinner /> : null}
      {data.data && !frames.length ? <InfoNote><Txt size={14}>{data.data.note ?? 'Trận này chưa có dữ liệu phát lại.'}</Txt></InfoNote> : null}
      {f ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip text={`Bước ${i + 1}/${frames.length}`} bg={c.the2} fg={c.muc2} />
            <Chip text={`Lượt ${f.turn}`} bg={c.thuyNhat} fg={c.thuyChu} />
            <Chip text={`Làn sóng ${f.wave}`} bg={c.sonNhat} fg={c.sonChu} />
            {f.tide ? <Chip text={f.tide === 'high' ? 'Triều lên' : 'Triều rút'} bg={c.dongNhat} fg={c.dongChu} /> : null}
            {f.status !== 'active' ? <Chip text={f.status === 'won' ? 'Chiến thắng' : 'Thất bại'} bg={f.status === 'won' ? c.ngocNhat : c.sonNhat} fg={f.status === 'won' ? c.ngocChu : c.sonChu} /> : null}
            {data.data?.advantage && data.data.advantage.modifier_pct !== 0 ? <Chip text={`Quyết sách ${data.data.advantage.modifier_pct > 0 ? '+' : ''}${data.data.advantage.modifier_pct}%`} bg={c.the2} fg={c.muc2} /> : null}
          </View>
          <Bar value={i + 1} max={frames.length} height={6} label={`Bước ${i + 1}/${frames.length}`} />
          <Txt f="bold" size={15} accessibilityLiveRegion="polite" testID="replay-label">{f.label}</Txt>
          <View style={{ gap: 3 }}>
            {f.log.length ? f.log.map((l, k) => <Txt key={`${l.t}-${k}`} size={13} color={c[LOG_TONE[l.kind] ?? 'muc']} f={l.kind === 'alert' || l.kind === 'end' ? 'bold' : 'body'}>• {l.text}</Txt>) : <Txt size={13} color={c.muc3}>Bước này không có diễn biến mới.</Txt>}
          </View>
          <Txt f="bold" size={14} color={c.sonChu}>Quân địch</Txt>
          <View style={{ gap: 8 }}>{side('e').map(row)}</View>
          <Txt f="bold" size={14} color={c.ngocChu}>Quân ta</Txt>
          <View style={{ gap: 8 }}>{side('a').map(row)}</View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Btn icon={ChevronLeft} title="Bước trước" tone="giay" size="sm" disabled={i === 0} onPress={() => { setPlaying(false); setI(i - 1); }} testID="replay-prev" />
            <Btn icon={playing ? Pause : Play} title={playing ? 'Dừng' : i >= frames.length - 1 ? 'Phát lại từ đầu' : 'Tự phát'} tone="thuy" size="sm" onPress={() => { if (playing) setPlaying(false); else { if (i >= frames.length - 1) setI(0); setPlaying(true); } }} testID="replay-play" />
            <Btn icon={ChevronRight} title="Bước sau" tone="giay" size="sm" disabled={i >= frames.length - 1} onPress={() => { setPlaying(false); setI(i + 1); }} testID="replay-next" />
          </View>
        </View>
      ) : null}
    </Sheet>
  );
};

/** Mục “Trận đánh” gộp hai kiểu: chiến trường bằng thẻ tướng và mô phỏng quyết định (đã có từ Sprint 6 ver0.1) */
export const BattlesHub: React.FC<{ session: Session; refreshKey: number; onIntro: (id: number) => void; decision: React.ReactNode }> = ({ session, refreshKey, onIntro, decision }) => {
  const [mode, setMode] = useState<'war' | 'decision'>('war');
  return (
    <View style={{ gap: 14 }}>
      <Txt f="displayHeavy" size={24} accessibilityRole="header">Trận đánh</Txt>
      <Segmented<'war' | 'decision'> label="Kiểu trận đánh" value={mode} onChange={setMode} options={[{ value: 'war', label: 'Chiến trường thẻ tướng' }, { value: 'decision', label: 'Quyết định của chỉ huy' }]} />
      {mode === 'war' ? <WarStagesTab session={session} refreshKey={refreshKey} onIntro={onIntro} /> : decision}
    </View>
  );
};
