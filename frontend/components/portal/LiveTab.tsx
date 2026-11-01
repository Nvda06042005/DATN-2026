/**
 * Tab "Thi đấu" của học sinh (Sprint 8, HK.HS.079, 080, 084): nhập mã PIN 6 số giáo viên chiếu trên màn hình (hoặc mở đường dẫn từ mã QR đã điền sẵn mã),
 * chọn biệt danh và hình đại diện rồi vào phòng chờ; xem phòng đang mở của các lớp; lịch sử các trận đã thi và xem lại từng câu.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { LogIn, Radio, Trophy } from 'lucide-react-native';
import * as api from '@/api/liveApi';
import { errorMessage } from '@/api/client';
import { ErrorNote, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { LiveAvatarPicker } from '@/components/portal/LiveKit';
import { LiveReviewScreen } from '@/components/portal/LivePlay';
import { Btn, Card, Chip, EmptyState, Field, InfoNote, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { LiveLookup, LiveMatch } from '@/types/live';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) : '');

const JoinSheet: React.FC<{ session: Session; pin: string; look: LiveLookup; onClose: () => void; onJoined: (roomId: number, title: string) => void }> = ({ session, pin, look, onClose, onJoined }) => {
  const { c } = useTheme();
  const [nick, setNick] = useState(look.mine?.nickname ?? look.suggested);
  const [avatar, setAvatar] = useState(look.mine?.avatar ?? look.avatars[0] ?? 'star');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.joinRoom(session.token, { pin, nickname: nick.trim(), avatar });
      onJoined(res.room_id, look.title);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={look.title} subtitle={`Lớp ${look.class_name} · ${look.mode === 'team' ? 'thi theo đội' : 'thi cá nhân'} · ${look.total} câu${look.host_name ? ` · GV ${look.host_name}` : ''}`}
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}><Btn title="Hủy" tone="giay" onPress={onClose} disabled={busy} /><Btn icon={LogIn} title={look.mine ? 'Vào lại phòng' : 'Vào phòng chờ'} tone="ngoc" loading={busy} onPress={join} testID="live-join-confirm" /></View>}>
      <ErrorNote message={error} />
      {look.state !== 'lobby' ? <InfoNote>Trận đã bắt đầu. Em vẫn vào được và trả lời từ câu đang diễn ra; điểm các câu trước tính là 0.</InfoNote> : null}
      <Field label="Biệt danh hiện trong bảng điểm (2–20 ký tự)" value={nick} onChangeText={setNick} maxLength={20} testID="live-join-nickname" />
      <Txt f="bold" size={14} color={c.muc2}>Hình đại diện</Txt>
      <LiveAvatarPicker value={avatar} onChange={setAvatar} />
      <Txt size={13} color={c.muc3}>Biệt danh chỉ để hiện trong phòng thi; giáo viên vẫn biết tên thật của em trong báo cáo.</Txt>
    </Sheet>
  );
};

export const LiveTab: React.FC<{ session: Session; refreshKey: number; initialPin?: string; onPlay: (roomId: number, title: string) => void }> = ({ session, refreshKey, initialPin, onPlay }) => {
  const { c } = useTheme();
  const [pin, setPin] = useState(initialPin ?? '');
  const [look, setLook] = useState<{ pin: string; data: LiveLookup } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<LiveMatch | null>(null);
  const open = useLoad(() => api.openRooms(session.token), [session.token, refreshKey], session.expired);
  const mine = useLoad(() => api.myMatches(session.token), [session.token, refreshKey], session.expired);

  const lookup = async (value: string) => {
    const clean = value.replace(/\D/g, '');
    if (clean.length !== 6) return setError('Mã PIN gồm 6 chữ số.');
    setBusy(true);
    setError(null);
    try { setLook({ pin: clean, data: await api.lookupPin(session.token, clean) }); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  useEffect(() => { if (initialPin && initialPin.replace(/\D/g, '').length === 6) void lookup(initialPin); }, [initialPin]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ gap: 16 }}>
      <Txt f="displayHeavy" size={24} accessibilityRole="header">Thi đấu trực tiếp</Txt>
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Radio size={22} color={c.sonChu} /><Txt f="bold" size={17}>Nhập mã PIN để vào phòng thi</Txt></View>
        <Txt size={14} color={c.muc2}>Giáo viên chiếu mã PIN 6 số (hoặc mã QR) trên màn hình lớp. Em chỉ vào được phòng của lớp mình.</Txt>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
          <Field label="Mã PIN" value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholder="••••••" style={{ flex: 1 }}
            inputStyle={{ fontSize: 28, letterSpacing: 8, textAlign: 'center' }} onSubmitEditing={() => lookup(pin)} testID="live-pin" />
          <Btn icon={LogIn} title="Vào" tone="ngoc" size="lg" loading={busy} disabled={pin.length !== 6} onPress={() => lookup(pin)} testID="live-pin-go" />
        </View>
        <ErrorNote message={error} />
      </Card>

      <Txt f="bold" size={17}>Phòng đang mở trong lớp của em</Txt>
      <ErrorNote message={open.error} />
      {open.loading && !open.data ? <Spinner /> : null}
      {open.data && !open.data.length ? <EmptyState mood="thinking" title="Chưa có phòng thi nào đang mở" text="Khi giáo viên mở phòng, phòng sẽ hiện ở đây. Em vẫn cần mã PIN do giáo viên chiếu để vào." /> : null}
      {(open.data ?? []).map((r) => (
        <Card key={r.id} flat pad={14} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip text={r.state === 'lobby' ? 'Phòng chờ' : 'Đang thi'} bg={r.state === 'lobby' ? c.vangNhat : c.ngocNhat} fg={r.state === 'lobby' ? c.vangChu : c.ngocChu} />
            <Chip text={r.mode === 'team' ? 'Theo đội' : 'Cá nhân'} bg={c.thuyNhat} fg={c.thuyChu} />
            <Txt size={12} color={c.muc3}>Lớp {r.class_name} · {r.players} bạn đã vào · {r.total} câu</Txt>
          </View>
          <Txt f="bold" size={16}>{r.title}</Txt>
          {r.joined
            ? <Btn icon={LogIn} title="Vào lại phòng" tone="ngoc" size="sm" onPress={() => onPlay(r.id, r.title)} testID={`live-rejoin-${r.id}`} />
            : <Txt size={13} color={c.muc2}>Nhập mã PIN trên màn hình của giáo viên{r.host_name ? ` (${r.host_name})` : ''} để vào phòng.</Txt>}
        </Card>
      ))}

      <Txt f="bold" size={17}>Các trận em đã thi</Txt>
      <ErrorNote message={mine.error} />
      {mine.data && !mine.data.length ? <Txt size={14} color={c.muc3}>Em chưa thi trận nào.</Txt> : null}
      {(mine.data ?? []).map((m) => (
        <Pressable key={m.id} accessibilityRole="button" accessibilityLabel={`Xem lại trận ${m.title}, hạng ${m.rank}`} onPress={() => setReview(m)} testID={`live-match-${m.id}`}
          style={({ pressed }) => ({ gap: 4, padding: 14, borderRadius: 16, borderWidth: 2, borderColor: c.vien, backgroundColor: pressed ? c.the2 : c.the })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Chip text={`Hạng ${m.rank}/${m.players}`} bg={m.rank <= 3 ? c.vangNhat : c.dichNhat} fg={m.rank <= 3 ? c.vangChu : c.dich} icon={Trophy} />
            <Txt size={12} color={c.muc3}>{when(m.ended_at)} · lớp {m.class_name}</Txt>
          </View>
          <Txt f="bold" size={16}>{m.title}</Txt>
          <Txt size={13} color={c.muc2}>{m.score} điểm · đúng {m.correct_count}/{m.answered_count} câu trả lời{m.xp_awarded ? ` · +${m.xp_awarded} điểm tài khoản` : ''}</Txt>
        </Pressable>
      ))}

      {look ? <JoinSheet session={session} pin={look.pin} look={look.data} onClose={() => setLook(null)} onJoined={(id, title) => { setLook(null); setPin(''); onPlay(id, title); }} /> : null}
      <Sheet open={!!review} onClose={() => setReview(null)} title={review?.title ?? 'Kết quả trận'} subtitle={review ? `Lớp ${review.class_name}` : undefined} wide footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Btn title="Đóng" tone="ngoc" onPress={() => setReview(null)} /></View>}>
        {review ? <LiveReviewScreen session={session} id={review.id} /> : null}
      </Sheet>
    </View>
  );
};
