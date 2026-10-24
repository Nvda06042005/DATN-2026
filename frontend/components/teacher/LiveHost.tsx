/**
 * Màn điều khiển thi đấu cả lớp của giáo viên (chiếu lên bảng): mở phòng, đọc mã PIN, bắt đầu, công bố đáp án, bảng điểm, bục vinh quang.
 * Server giữ đáp án và chấm; giáo viên tải lại / đổi máy thì vào lại đúng phòng (máy cũ nhận "replaced").
 */
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Check, CheckCircle2, ChevronRight, Copy, Flame, Lock, Maximize2, Radio, RotateCcw, Trophy, Unlock, Users, Wifi, WifiOff, X } from 'lucide-react-native';
import { KahootShape, Mascot } from '@/components/art';
import { Confetti, LIVE_COUNTS, LIVE_SCOPES, LiveBackdrop, LiveOptionTiles, LiveTimer } from '@/components/live';
import { Btn, Card, Chip, Field, Inset, Segmented, Spinner, Txt, useToast } from '@/components/ui';
import { ANSWER_STYLES } from '@/constants/theme';
import { useLiveSocket } from '@/hooks/use-live-socket';
import { useTheme } from '@/hooks/use-theme';
import { useCountdown } from '@/hooks/use-timers';
import { avatarColor, fmt, formatPin, sameLiveKey, shortName, webHref } from '@/lib/format';
import type { LiveHostPlayer, LiveHostRoom } from '@/types/api';

const WHITE_SOFT = 'rgba(255,255,255,0.15)';
const BLACK_SOFT = 'rgba(0,0,0,0.25)';

export const LiveHost: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  token: string;
  onExpired: () => void;
  /** Một trận vừa được lưu vào lịch sử lớp */
  onSaved: () => void;
  /** Số học sinh thật của lớp – để biết bao nhiêu bạn đã vào phòng */
  classSize: number;
}> = (props) => (
  <Modal visible={props.open} animationType="slide" presentationStyle="fullScreen" onRequestClose={props.onClose} statusBarTranslucent>
    {props.open && <HostConsole {...props} />}
  </Modal>
);

const HostConsole: React.FC<React.ComponentProps<typeof LiveHost>> = ({ onClose, title, token, onExpired, onSaved, classSize }) => {
  const { c } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const [room, setRoom] = useState<LiveHostRoom | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title, count: 10 as number, scope: 'all' });
  const [seconds, startTimer] = useCountdown();
  const [busy, setBusy] = useState(false);
  const [ending, setEnding] = useState(false);
  const [kick, setKick] = useState<LiveHostPlayer | null>(null);
  const savedId = useRef<number | null>(null);

  const { status, send, reconnect } = useLiveSocket(token, (msg) => {
    if (msg.type === 'room') {
      setReady(true);
      setBusy(false);
      setError(null);
      setRoom(msg.room);
      startTimer(msg.room?.phase === 'question' ? msg.room.remaining_ms : null);
      if (msg.room?.session_id && savedId.current !== msg.room.session_id) {
        savedId.current = msg.room.session_id;
        onSaved();
      }
    } else if (msg.type === 'saved') onSaved();
    else if (msg.type === 'error') {
      setBusy(false);
      setError(msg.message);
    }
  });

  useEffect(() => {
    if (status === 'expired') onExpired();
  }, [status, onExpired]);

  const act = (msg: Record<string, unknown>) => {
    const ok = send(msg);
    if (!ok) toast('Đang nối lại máy chủ – thầy/cô thử lại sau giây lát');
    return ok;
  };
  const openRoom = () => {
    setBusy(true);
    if (!act({ type: 'create', title: form.title.trim(), count: form.count, scope: form.scope })) setBusy(false);
  };
  const endRoom = () => {
    act({ type: 'close' });
    onClose();
  };
  const requestClose = () => {
    if (!room) onClose();
    else if (room.phase === 'podium') endRoom();
    else setEnding(true);
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else document.documentElement.requestFullscreen?.().catch(() => toast('Trình duyệt chặn toàn màn hình – nhấn F11 để trình chiếu'));
  };

  const joined = room?.players.length ?? 0;
  const q = room?.question ?? null;
  const reveal = room?.reveal ?? null;
  const counts = reveal?.counts ?? [];
  const maxCount = Math.max(1, ...counts);
  const rightIndex = q && reveal ? q.options.findIndex((o) => sameLiveKey(o.key, reveal.key)) : -1;
  const rightCount = rightIndex >= 0 ? (counts[rightIndex] ?? 0) : 0;
  const joinHref = room ? webHref(`/hoc-sinh?pin=${room.pin}`) : null;

  const whiteCard = { backgroundColor: '#ffffff', borderRadius: 20, borderBottomWidth: 6, borderBottomColor: 'rgba(0,0,0,0.25)' } as const;

  let body: React.ReactNode;
  if (!ready) {
    body = (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Spinner color="#ffffff" label={status === 'reconnecting' ? 'Chưa kết nối được máy chủ – đang thử lại…' : 'Đang kết nối phòng thi đấu…'} />
      </View>
    );
  } else if (!room) {
    body = (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <Card pad={24} style={{ width: '100%', maxWidth: 560, alignSelf: 'center', gap: 16 }}>
          <View>
            <Txt f="displayHeavy" size={26} accessibilityRole="header">
              Mở phòng thi đấu
            </Txt>
            <Txt size={14} color={c.muc2}>
              Câu hỏi lấy từ ngân hàng của game (trắc nghiệm, đúng/sai), mỗi câu 20 giây. Server chấm và cộng XP, Ấn Tín, mức nắm vững như khi học sinh tự luyện.
            </Txt>
          </View>
          <Field label="Tên trận" nativeID="live-title" value={form.title} maxLength={120} onChangeText={(v) => setForm((f) => ({ ...f, title: v }))} />
          <View style={{ gap: 6 }}>
            <Txt f="bold" size={14} color={c.muc2}>
              Số câu
            </Txt>
            <Segmented label="Số câu" options={LIVE_COUNTS.map((n) => ({ value: n as number, label: `${n} câu` }))} value={form.count} onChange={(n) => setForm((f) => ({ ...f, count: n }))} />
          </View>
          <View style={{ gap: 6 }}>
            <Txt f="bold" size={14} color={c.muc2}>
              Phạm vi câu hỏi
            </Txt>
            <Segmented label="Phạm vi câu hỏi" options={LIVE_SCOPES.map((s) => ({ value: s.id, label: s.label }))} value={form.scope} onChange={(s) => setForm((f) => ({ ...f, scope: s }))} />
          </View>
          {error && (
            <Inset style={{ backgroundColor: c.sonNhat }}>
              <Txt f="bold" size={14} color={c.sonChu} accessibilityRole="alert">
                {error}
              </Txt>
            </Inset>
          )}
          <Btn title="Mở phòng" icon={Radio} tone="dong" size="lg" full loading={busy} disabled={status !== 'open'} onPress={openRoom} />
        </Card>
      </ScrollView>
    );
  } else if (room.phase === 'lobby') {
    body = (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, alignItems: 'center', gap: 18 }}>
        <View style={[whiteCard, { width: '100%', maxWidth: 820, flexDirection: wide ? 'row' : 'column', overflow: 'hidden' }]}>
          <View style={{ flex: 1, padding: 18, gap: 6, borderRightWidth: wide ? 2 : 0, borderBottomWidth: wide ? 0 : 2, borderColor: c.vien }}>
            <Txt f="bold" size={14} color={c.muc2}>
              Học sinh vào phòng
            </Txt>
            <Txt f="semibold">Trang học sinh → Quốc Tử Giám → Thi đấu cả lớp, nhập mã PIN</Txt>
            {joinHref && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Txt size={12} color={c.muc2} style={{ flex: 1 }} selectable>
                  {joinHref}
                </Txt>
                <Btn
                  title="Sao chép"
                  icon={Copy}
                  tone="giay"
                  size="sm"
                  onPress={() => Clipboard.setStringAsync(joinHref).then(() => toast('Đã sao chép đường link vào phòng'), () => toast('Không sao chép được – hãy đọc mã PIN cho cả lớp'))}
                />
              </View>
            )}
          </View>
          <View style={{ padding: 14, alignItems: 'center', justifyContent: 'center' }} accessible accessibilityLabel={`Mã PIN ${room.pin.split('').join(' ')}`}>
            <Txt f="bold" size={14} color={c.muc2}>
              Mã PIN
            </Txt>
            <Txt f="displayHeavy" size={wide ? 60 : 48} color="#115e59" style={{ letterSpacing: 4, fontVariant: ['tabular-nums'] }} testID="live-pin">
              {formatPin(room.pin)}
            </Txt>
          </View>
        </View>
        <View style={{ width: '100%', maxWidth: 1000, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: BLACK_SOFT, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 }}>
            <Users size={20} color="#ffffff" />
            <Txt f="displayHeavy" size={19} color="#ffffff">
              {joined}
              {classSize > 0 ? `/${classSize}` : ''} học sinh
            </Txt>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Btn title={room.locked ? 'Đã khóa phòng' : 'Khóa phòng'} icon={room.locked ? Lock : Unlock} tone="giay" selected={room.locked} onPress={() => act({ type: 'lock', locked: !room.locked })} />
            <Btn title="Bắt đầu" iconRight={ChevronRight} tone="dong" size="lg" disabled={joined === 0} onPress={() => act({ type: 'start' })} />
          </View>
        </View>
        {error && (
          <Txt f="bold" color="#ffffff" style={{ backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }} accessibilityRole="alert">
            {error}
          </Txt>
        )}
        {joined === 0 ? (
          <Txt f="displayHeavy" size={20} color="#ffffff" center style={{ marginTop: 40, backgroundColor: BLACK_SOFT, borderRadius: 18, paddingHorizontal: 20, paddingVertical: 14 }}>
            {classSize === 0 ? 'Lớp chưa có học sinh – nhờ quản trị viên cấp tài khoản trước nhé' : 'Đang chờ học sinh nhập mã PIN…'}
          </Txt>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, maxWidth: 1000 }} accessibilityLabel="Học sinh trong phòng">
            {room.players.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setKick(p)}
                accessibilityRole="button"
                accessibilityLabel={`${p.name}${p.connected ? '' : ' (mất kết nối)'} – bấm để mời ra khỏi phòng`}
                style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 14, backgroundColor: pressed ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.3)', opacity: p.connected ? 1 : 0.6 })}
              >
                {!p.connected && <WifiOff size={16} color="#ffffff" />}
                <Txt f="displayHeavy" size={18} color="#ffffff">
                  {shortName(p.name)}
                </Txt>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    );
  } else if ((room.phase === 'question' || room.phase === 'reveal') && q) {
    body = (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 14, width: '100%', maxWidth: 1100, alignSelf: 'center' }}>
        <View style={[whiteCard, { paddingHorizontal: 20, paddingVertical: 16 }]}>
          <Txt f="displayHeavy" size={wide ? 28 : 21} center accessibilityRole="header">
            {q.prompt}
          </Txt>
        </View>
        {room.phase === 'question' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <LiveTimer seconds={seconds} total={room.duration_ms / 1000} size={wide ? 110 : 84} light />
            <View style={{ alignItems: 'center', flex: 1, gap: 4 }}>
              {wide && <Mascot size={110} mood="thinking" accessory="helmet" bob />}
              <Txt f="bold" size={14} color="rgba(255,255,255,0.85)">
                Câu {room.index + 1} / {room.total}
              </Txt>
              <Chip text={q.topic} bg={WHITE_SOFT} fg="#ffffff" style={{ alignSelf: 'center', maxWidth: '100%' }} />
            </View>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Txt f="displayHeavy" size={46} color="#ffffff" style={{ fontVariant: ['tabular-nums'] }} accessibilityLabel={`${room.answered} trên ${joined} bạn đã trả lời`}>
                {room.answered}
                <Txt f="displayHeavy" size={22} color="rgba(255,255,255,0.7)">
                  /{joined}
                </Txt>
              </Txt>
              <Txt f="bold" size={13} color="rgba(255,255,255,0.85)">
                đã trả lời
              </Txt>
              <Btn title="Công bố đáp án" tone="giay" size="sm" onPress={() => act({ type: 'reveal' })} />
            </View>
          </View>
        ) : (
          reveal && (
            <View style={{ flexDirection: wide ? 'row' : 'column', gap: 14 }}>
              <View style={{ flex: 1, height: 220, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: wide ? 28 : 14 }} accessibilityLabel="Số học sinh chọn mỗi đáp án">
                {q.options.map((o, i) => {
                  const s = ANSWER_STYLES[i % ANSWER_STYLES.length];
                  const count = counts[i] ?? 0;
                  const isRight = i === rightIndex;
                  return (
                    <View key={String(o.key)} style={{ width: wide ? 88 : 64, height: '100%', justifyContent: 'flex-end', opacity: isRight ? 1 : 0.5 }} accessible accessibilityLabel={`${o.text}: ${count} bạn chọn${isRight ? ' (đáp án đúng)' : ''}`}>
                      <View style={{ height: `${Math.max(6, (count / maxCount) * 78)}%`, backgroundColor: s.bg, borderTopLeftRadius: 8, borderTopRightRadius: 8 }} />
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6, backgroundColor: s.bg, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}>
                        <KahootShape shape={s.shape} size={16} color={s.fg} />
                        <Txt f="displayHeavy" size={18} color={s.fg}>
                          {count}
                        </Txt>
                        {isRight && <Check size={18} color={s.fg} strokeWidth={4} />}
                      </View>
                    </View>
                  );
                })}
              </View>
              <View style={{ flex: wide ? 0.8 : undefined, backgroundColor: BLACK_SOFT, borderRadius: 18, padding: 16, gap: 8 }}>
                <Txt f="displayHeavy" size={19} color="#ffffff" accessibilityLiveRegion="polite">
                  {rightCount}/{room.answered} bạn trả lời đúng
                </Txt>
                <Txt f="semibold" color="#ffffff">
                  {reveal.explanation}
                </Txt>
                {reveal.source && (
                  <Txt f="bold" size={12} color="rgba(255,255,255,0.8)">
                    Nguồn: {reveal.source}
                  </Txt>
                )}
                <Btn title="Bảng điểm" iconRight={ChevronRight} tone="giay" onPress={() => act({ type: 'next' })} />
              </View>
            </View>
          )
        )}
        <LiveOptionTiles q={q} correctKey={room.phase === 'reveal' && reveal ? reveal.key : null} />
      </ScrollView>
    );
  } else if (room.phase === 'scoreboard') {
    body = (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, alignItems: 'center', gap: 12 }}>
        <View style={[whiteCard, { paddingHorizontal: 32, paddingVertical: 10 }]}>
          <Txt f="displayHeavy" size={28} accessibilityRole="header">
            Bảng điểm
          </Txt>
        </View>
        <View style={{ width: '100%', maxWidth: 640, gap: 10, marginTop: 10 }}>
          {room.players.slice(0, 5).map((p, i) => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: i === 0 ? '#ffffff' : BLACK_SOFT }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: avatarColor(p.name), alignItems: 'center', justifyContent: 'center' }}>
                  <Txt f="displayHeavy" color="#ffffff">
                    {i + 1}
                  </Txt>
                </View>
                <Txt f="displayHeavy" size={19} color={i === 0 ? c.muc : '#ffffff'} numberOfLines={1} style={{ flexShrink: 1 }}>
                  {shortName(p.name)}
                </Txt>
                {p.streak >= 2 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }} accessible accessibilityLabel={`${p.streak} câu đúng liên tiếp`}>
                    <Flame size={16} color={i === 0 ? c.sonChu : '#ffffff'} />
                    <Txt f="bold" size={14} color={i === 0 ? c.sonChu : '#ffffff'}>
                      {p.streak}
                    </Txt>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {p.last_gain > 0 && (
                  <Txt f="bold" size={14} color={i === 0 ? c.ngocChu : '#99f6e4'}>
                    +{p.last_gain}
                  </Txt>
                )}
                <Txt f="displayHeavy" size={19} color={i === 0 ? c.muc : '#ffffff'} style={{ fontVariant: ['tabular-nums'] }}>
                  {fmt(p.score)}
                </Txt>
              </View>
            </View>
          ))}
        </View>
        {joined > 5 && (
          <Txt f="bold" color="rgba(255,255,255,0.85)">
            và {joined - 5} bạn khác
          </Txt>
        )}
        <Btn title={room.index + 1 < room.total ? 'Câu tiếp theo' : 'Xem bục vinh quang'} iconRight={ChevronRight} tone="giay" onPress={() => act({ type: 'next' })} style={{ marginTop: 12 }} />
      </ScrollView>
    );
  } else {
    const podium = [room.players[1], room.players[0], room.players[2]];
    body = (
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, alignItems: 'center', gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 900 }}>
          <Trophy size={30} color={c.dong} />
          <Txt f="displayHeavy" size={26} color="#ffffff" center numberOfLines={2} style={{ flexShrink: 1 }} accessibilityRole="header">
            {room.title}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 12, width: '100%', maxWidth: 700 }}>
          {podium.map((p, i) =>
            p ? (
              <View key={p.id} style={{ flex: 1, maxWidth: 220, alignItems: 'center' }}>
                {i === 1 && <Mascot size={70} accessory="crown" mood="love" bob />}
                <Txt f="displayHeavy" size={20} color="#ffffff" center numberOfLines={2}>
                  {shortName(p.name)}
                </Txt>
                <Txt f="bold" color="rgba(255,255,255,0.85)">
                  {fmt(p.score)} điểm
                </Txt>
                <View style={{ width: '100%', height: [110, 160, 80][i], marginTop: 8, borderTopLeftRadius: 18, borderTopRightRadius: 18, alignItems: 'center', paddingTop: 10, backgroundColor: ['#c0c0c0', '#d97706', '#cd7f32'][i] }}>
                  <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                    <Txt f="displayHeavy" size={22} color="rgba(0,0,0,0.6)">
                      {[2, 1, 3][i]}
                    </Txt>
                  </View>
                </View>
              </View>
            ) : null,
          )}
        </View>
        <View style={{ width: '100%', maxWidth: 700, backgroundColor: BLACK_SOFT, borderRadius: 18, padding: 16, gap: 4 }}>
          <Txt f="displayHeavy" size={18} color="#ffffff">
            Kết quả cả lớp
          </Txt>
          {room.players.map((p, i) => (
            <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
              <Txt f="bold" color="#ffffff" numberOfLines={1} style={{ flex: 1 }}>
                {i + 1}. {p.name}
              </Txt>
              <Txt f="bold" color="rgba(255,255,255,0.85)">
                {fmt(p.score)} · {p.correct}/{room.total} đúng
              </Txt>
            </View>
          ))}
        </View>
        {(room.session_id || room.saved) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLiveRegion="polite">
            {room.session_id ? <CheckCircle2 size={20} color="#ffffff" /> : null}
            <Txt f="bold" color="rgba(255,255,255,0.9)">
              {room.session_id ? 'Đã lưu vào lịch sử thi đấu của lớp' : 'Đang lưu kết quả…'}
            </Txt>
          </View>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
          <Btn title="Trận mới" icon={RotateCcw} tone="giay" loading={busy} onPress={openRoom} />
          <Btn title="Kết thúc" tone="dong" onPress={endRoom} />
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }} accessibilityViewIsModal role="dialog" aria-label={`Thi đấu cả lớp: ${room?.title ?? form.title}`}>
      <LiveBackdrop />
      {room?.phase === 'podium' && <Confetti count={80} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <Txt f="displayHeavy" size={24} color="#ffffff">
            đông a!
          </Txt>
          {room && wide && <Chip text={room.title} bg={WHITE_SOFT} fg="#ffffff" />}
          {room?.class_name && wide && <Chip text={`Lớp ${room.class_name}`} bg={WHITE_SOFT} fg="#ffffff" />}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 12, borderRadius: 12, backgroundColor: BLACK_SOFT }} accessibilityLiveRegion="polite">
            {status === 'open' ? <Wifi size={16} color="#ffffff" /> : <WifiOff size={16} color="#ffffff" />}
            <Txt f="bold" size={13} color="#ffffff">
              {status === 'open' ? 'Đã kết nối' : status === 'connecting' ? 'Đang kết nối…' : 'Đang nối lại…'}
            </Txt>
          </View>
          {Platform.OS === 'web' && wide && <Btn tone="giay" size="sm" icon={Maximize2} label="Bật/tắt toàn màn hình" onPress={toggleFullscreen} />}
          <Btn tone="giay" size="sm" icon={X} label="Đóng phòng thi đấu" onPress={requestClose} />
        </View>
      </View>
      <View style={{ flex: 1 }}>{body}</View>

      {ending && room && (
        <Overlay>
          <Txt f="displayHeavy" size={20} accessibilityRole="header">
            Kết thúc phòng thi đấu?
          </Txt>
          <Txt size={14} color={c.muc2}>
            {room.phase === 'lobby'
              ? 'Học sinh trong phòng chờ sẽ được báo là phòng đã đóng.'
              : 'Kết quả tới câu hiện tại vẫn được lưu vào lịch sử lớp. Nếu chỉ tạm rời, phòng được giữ 15 phút để thầy/cô quay lại.'}
          </Txt>
          <Btn title="Kết thúc trận" full onPress={endRoom} />
          <Btn title="Tạm rời, giữ phòng mở" tone="giay" full onPress={onClose} />
          <Btn title="Tiếp tục" tone="giay" full onPress={() => setEnding(false)} />
        </Overlay>
      )}
      {kick && (
        <Overlay>
          <Txt f="displayHeavy" size={20} accessibilityRole="header">
            Mời {kick.name} ra khỏi phòng?
          </Txt>
          <Txt size={14} color={c.muc2}>
            Bạn này sẽ không vào lại được phòng thi đấu này.
          </Txt>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn
              title="Mời ra"
              style={{ flex: 1 }}
              full
              onPress={() => {
                act({ type: 'kick', player_id: kick.id });
                setKick(null);
              }}
            />
            <Btn title="Hủy" tone="giay" style={{ flex: 1 }} full onPress={() => setKick(null)} />
          </View>
        </Overlay>
      )}
      {status === 'replaced' && (
        <Overlay>
          <Txt f="displayHeavy" size={20} accessibilityRole="header">
            Phòng đang được điều khiển ở nơi khác
          </Txt>
          <Txt size={14} color={c.muc2}>
            Thầy/cô vừa mở phòng thi đấu ở một tab hoặc máy khác.
          </Txt>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn title="Điều khiển ở đây" tone="dong" style={{ flex: 1 }} full onPress={reconnect} />
            <Btn title="Đóng" tone="giay" style={{ flex: 1 }} full onPress={onClose} />
          </View>
        </Overlay>
      )}
    </View>
  );
};

/** Hộp thoại phủ trong màn thi đấu (không mở Modal lồng nhau) */
const Overlay: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 60 }}>
    <Card pad={22} style={{ width: '100%', maxWidth: 440, gap: 12 }}>
      <View accessibilityViewIsModal role="alertdialog" style={{ gap: 12 }}>
        {children}
      </View>
    </Card>
  </View>
);
