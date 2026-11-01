/**
 * Màn hình điều khiển trận thi đấu trực tiếp của giáo viên, thiết kế để chiếu lên lớp (Sprint 8, HK.GV.052–055, HK.SYS.016): phòng chờ với mã PIN và mã QR,
 * danh sách người tham gia cập nhật theo thời gian thực, điều khiển (bắt đầu, câu tiếp theo, tạm dừng, bỏ qua câu, kết thúc sớm), kết quả từng câu (biểu đồ phân bố đáp án,
 * đáp án đúng, bảng xếp hạng tức thời) và bục vinh quang cuối trận. Máy chủ giữ trạng thái; màn hình này chỉ hiển thị và gửi lệnh.
 */
import React, { useState } from 'react';
import { Image, Platform, View } from 'react-native';
import { ArrowRight, FileText, Maximize, Pause, Play, SkipForward, Square, Trophy, Users, Wifi, WifiOff } from 'lucide-react-native';
import * as api from '@/api/liveApi';
import { errorMessage } from '@/api/client';
import { DownloadButton, ErrorNote, Page, PageHeader, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { LiveAvatar, LiveBoard, LiveChoice, LiveCountdown, LiveDistribution, LivePodium } from '@/components/portal/LiveKit';
import { keyLines } from '@/components/portal/QuizPlayer';
import { Btn, Card, Chip, ConfirmSheet, InfoNote, Spinner, Txt, useToast } from '@/components/ui';
import { useLiveRoom, useRemaining } from '@/hooks/use-live-room';
import { useTheme } from '@/hooks/use-theme';
import type { LiveAction, LiveView } from '@/types/live';

const fullscreen = () => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.();
};

const Lobby: React.FC<{ view: LiveView; join: { join_url?: string; qr?: string } }> = ({ view, join }) => {
  const { c } = useTheme();
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <Card style={{ flexGrow: 2, flexBasis: 360, alignItems: 'center', gap: 8, paddingVertical: 24 }}>
          <Txt size={16} color={c.muc2}>Vào trang học sinh → mục “Thi đấu”, nhập mã PIN</Txt>
          <Txt f="displayHeavy" size={88} selectable testID="live-pin-display" accessibilityLabel={`Mã PIN ${view.room.pin.split('').join(' ')}`} style={{ letterSpacing: 14 }}>{view.room.pin}</Txt>
          {join.join_url ? <Txt size={13} color={c.muc3} selectable center>hoặc quét mã QR / mở {join.join_url}</Txt> : null}
        </Card>
        {join.qr ? (
          <Card style={{ flexGrow: 1, flexBasis: 240, alignItems: 'center', justifyContent: 'center' }}>
            <Image source={{ uri: join.qr }} accessibilityLabel={`Mã QR vào phòng thi, mã PIN ${view.room.pin}`} style={{ width: 240, height: 240 }} />
          </Card>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Users size={26} color={c.thuyChu} />
        <Txt f="displayHeavy" size={26} accessibilityLiveRegion="polite">{view.player_count} học sinh đã vào phòng</Txt>
        <Chip text={view.room.mode === 'team' ? 'Thi theo đội' : 'Thi cá nhân'} bg={c.thuyNhat} fg={c.thuyChu} />
      </View>
      {view.player_count === 0 ? <InfoNote>Chưa có ai vào phòng. Học sinh của lớp {view.room.class_name} nhập mã PIN ở trên để vào.</InfoNote> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {view.players.map((p) => (
          <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 16, borderRadius: 999, borderWidth: 2, borderColor: p.online ? c.ngoc : c.vien, backgroundColor: c.the, opacity: p.online ? 1 : 0.7 }}>
            <LiveAvatar avatar={p.avatar} size={44} />
            <View><Txt f="bold" size={18}>{p.nickname}</Txt>{p.team_name ? <Txt size={12} color={c.muc3}>{p.team_name}</Txt> : null}</View>
          </View>
        ))}
      </View>
    </View>
  );
};

const Question: React.FC<{ view: LiveView; skew: number; answered: { count: number; online: number } | null }> = ({ view, skew, answered }) => {
  const { c } = useTheme();
  const q = view.question!;
  const remaining = useRemaining(q, skew);
  const opts = q.qtype === 'truefalse' ? [{ id: 'true', text: 'Đúng' }, { id: 'false', text: 'Sai' }] : q.view.options ?? [];
  return (
    <View style={{ gap: 18 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Txt f="bold" size={20} color={c.muc2}>Câu {q.index + 1}/{q.total}</Txt>
        <Chip text={`${answered?.count ?? 0}/${view.player_count} đã trả lời`} bg={c.thuyNhat} fg={c.thuyChu} icon={Users} />
      </View>
      <LiveCountdown remaining={remaining} total={q.seconds} paused={q.paused} big />
      <Card style={{ paddingVertical: 28 }}><Txt f="displayHeavy" size={34} accessibilityRole="header">{q.view.prompt}</Txt></Card>
      {opts.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {opts.map((o, i) => <View key={o.id} style={{ flexGrow: 1, flexBasis: 360 }}><LiveChoice index={i} text={o.text} big /></View>)}
        </View>
      ) : <InfoNote>Câu này học sinh trả lời trên thiết bị của mình ({q.qtype === 'fill' ? 'điền khuyết' : q.qtype === 'order' ? 'sắp xếp' : 'đặt lên bản đồ'}).</InfoNote>}
      {q.paused ? <Card flat pad={16} style={{ backgroundColor: c.vangNhat }}><Txt f="bold" size={20} color={c.vangChu}>Đang tạm dừng – học sinh chưa trả lời được</Txt></Card> : null}
    </View>
  );
};

const Results: React.FC<{ view: LiveView }> = ({ view }) => {
  const { c } = useTheme();
  const r = view.results!;
  const total = r.stats.correct + r.stats.wrong + r.stats.none;
  return (
    <View style={{ gap: 18 }}>
      <Txt f="bold" size={20} color={c.muc2}>Kết quả câu {r.index + 1}/{view.room.total}</Txt>
      <Card style={{ paddingVertical: 20 }}><Txt f="displayHeavy" size={28}>{r.prompt}</Txt></Card>
      {r.skipped ? <InfoNote>Câu này đã bị bỏ qua nên không tính điểm cho ai.</InfoNote> : (
        <>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <Chip text={`${r.stats.correct} đúng`} bg={c.ngocNhat} fg={c.ngocChu} />
            <Chip text={`${r.stats.wrong} sai`} bg={c.sonNhat} fg={c.sonChu} />
            <Chip text={`${r.stats.none} chưa trả lời`} bg={c.dichNhat} fg={c.dich} />
          </View>
          {r.options ? <LiveDistribution options={r.options} total={total} big /> : (
            <Card flat pad={16} style={{ gap: 4 }}><Txt f="bold" size={18}>Đáp án đúng</Txt>{keyLines(r.qtype, r.answer_key).map((l) => <Txt key={l} size={18}>{l}</Txt>)}</Card>
          )}
          {r.explanation ? <InfoNote>{r.explanation}</InfoNote> : null}
        </>
      )}
      <Txt f="displayHeavy" size={24}>Bảng xếp hạng tức thời</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <View style={{ flexGrow: 2, flexBasis: 360 }}><LiveBoard rows={r.top} big /></View>
        {r.teams ? (
          <View style={{ flexGrow: 1, flexBasis: 260, gap: 8 }}>
            <Txt f="bold" size={16}>Điểm đội (trung bình thành viên)</Txt>
            {r.teams.map((t) => <Txt key={t.team_id} size={18}>{t.rank}. {t.name}: {t.score} điểm ({t.members} bạn)</Txt>)}
          </View>
        ) : null}
      </View>
    </View>
  );
};

const Ended: React.FC<{ session: Session; view: LiveView; onReport: () => void }> = ({ session, view, onReport }) => {
  const { c } = useTheme();
  const f = view.final!;
  const team = view.room.mode === 'team' && f.teams?.length;
  const items = team ? f.teams!.slice(0, 3).map((t) => ({ rank: t.rank, name: t.name, score: t.score, sub: `${t.members} bạn` })) : f.podium.map((p) => ({ rank: p.rank, name: p.nickname, avatar: p.avatar, score: p.score, sub: p.team_name }));
  return (
    <View style={{ gap: 18 }}>
      <Txt f="displayHeavy" size={34} center accessibilityRole="header">{team ? 'Đội chiến thắng' : 'Bục vinh quang'}</Txt>
      {f.ended_early ? <InfoNote>Trận được kết thúc sớm sau {f.played}/{view.room.total} câu.</InfoNote> : null}
      <LivePodium items={items} big />
      {team ? <Txt size={14} color={c.muc2} center>Điểm đội là trung bình điểm của các thành viên đã tham gia. Top 3 cá nhân: {f.podium.map((p) => `${p.rank}. ${p.nickname} (${p.score})`).join(' · ')}</Txt> : null}
      <Txt f="bold" size={18}>Bảng xếp hạng cuối trận</Txt>
      <LiveBoard rows={f.ranking.slice(0, 10)} />
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Btn icon={FileText} title="Xem báo cáo trận" tone="son" onPress={onReport} testID="live-open-report" />
        <DownloadButton title="Xuất Excel" fetchBlob={() => api.exportRoom(session.token, view.room.id, 'xlsx')} filename={`bao-cao-thi-dau-${view.room.id}.xlsx`} />
        <DownloadButton title="Xuất PDF" fetchBlob={() => api.exportRoom(session.token, view.room.id, 'pdf')} filename={`bao-cao-thi-dau-${view.room.id}.pdf`} />
      </View>
    </View>
  );
};

export const LiveHost: React.FC<{ session: Session; roomId: number; onBack: () => void; onReport: (roomId: number) => void }> = ({ session, roomId, onBack, onReport }) => {
  const toast = useToast();
  const { c } = useTheme();
  const live = useLiveRoom(session.token, roomId, session.expired);
  const join = useLoad(() => api.hostRoom(session.token, roomId), [session.token, roomId], session.expired);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'skip' | 'end' | null>(null);
  const view = live.view;
  const run = async (action: LiveAction) => {
    setBusy(true);
    try { await live.command(action); } catch (e) { toast(errorMessage(e)); } finally { setBusy(false); setConfirm(null); }
  };
  const room = view?.room;
  const q = view?.question;
  return (
    <Page>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn title="Danh sách phòng thi" tone="giay" size="sm" onPress={onBack} />
        <Chip text={live.connected ? 'Đã kết nối thời gian thực' : 'Đang kết nối lại…'} bg={live.connected ? c.ngocNhat : c.vangNhat} fg={live.connected ? c.ngocChu : c.vangChu} icon={live.connected ? Wifi : WifiOff} />
        {Platform.OS === 'web' ? <Btn icon={Maximize} title="Toàn màn hình" tone="giay" size="sm" onPress={fullscreen} /> : null}
      </View>
      <ErrorNote message={live.error} />
      {!view ? <Spinner label="Đang mở phòng thi…" /> : null}
      {room ? <PageHeader title={room.title} subtitle={`Lớp ${room.class_name} · ${room.mode === 'team' ? 'thi theo đội' : 'thi cá nhân'} · ${room.total} câu`} /> : null}
      {view && room?.state === 'lobby' ? <Lobby view={view} join={{ join_url: join.data?.join_url, qr: join.data?.qr }} /> : null}
      {view && room?.state === 'question' && q ? <Question view={view} skew={live.skew} answered={live.answered} /> : null}
      {view && room?.state === 'results' && view.results ? <Results view={view} /> : null}
      {view && room?.state === 'ended' && view.final ? <Ended session={session} view={view} onReport={() => onReport(roomId)} /> : null}

      {view && room && room.state !== 'ended' ? (
        <Card flat pad={14} style={{ gap: 10, position: 'relative' }}>
          <Txt size={13} color={c.muc3}>Điều khiển trận (chỉ giáo viên thấy ở máy này; học sinh làm trên thiết bị của mình)</Txt>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {room.state === 'lobby' ? <Btn icon={Play} title="Bắt đầu trận" tone="ngoc" size="lg" loading={busy} disabled={view.player_count === 0} onPress={() => run('start')} testID="live-start" /> : null}
            {room.state === 'question' ? <Btn icon={q?.paused ? Play : Pause} title={q?.paused ? 'Tiếp tục' : 'Tạm dừng'} tone="giay" loading={busy} onPress={() => run(q?.paused ? 'resume' : 'pause')} testID="live-pause" /> : null}
            {room.state === 'question' ? <Btn icon={ArrowRight} title="Kết thúc câu, xem kết quả" tone="ngoc" loading={busy} onPress={() => run('next')} testID="live-next" /> : null}
            {room.state === 'question' ? <Btn icon={SkipForward} title="Bỏ qua câu này" tone="giay" disabled={busy} onPress={() => setConfirm('skip')} testID="live-skip" /> : null}
            {room.state === 'results' ? <Btn icon={view.results?.last ? Trophy : ArrowRight} title={view.results?.last ? 'Xem bục vinh quang' : 'Câu tiếp theo'} tone="ngoc" size="lg" loading={busy} onPress={() => run('next')} testID="live-next" /> : null}
            <Btn icon={Square} title={room.state === 'lobby' ? 'Hủy phòng' : 'Kết thúc trận'} tone="giay" disabled={busy} onPress={() => setConfirm('end')} testID="live-end" />
          </View>
        </Card>
      ) : null}
      <ConfirmSheet open={confirm === 'skip'} title="Bỏ qua câu này?" message="Câu bị bỏ qua không tính điểm cho ai (điểm học sinh đã nhận ở câu này được thu hồi) và trận chuyển sang màn hình kết quả." confirmLabel="Bỏ qua câu" busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => run('skip')} />
      <ConfirmSheet open={confirm === 'end'} title={room?.state === 'lobby' ? 'Hủy phòng thi?' : 'Kết thúc trận sớm?'} message={room?.state === 'lobby' ? 'Phòng sẽ đóng, học sinh không vào được nữa.' : 'Trận kết thúc ngay, các câu còn lại không diễn ra. Điểm được chốt và cộng vào tài khoản học sinh.'} confirmLabel={room?.state === 'lobby' ? 'Hủy phòng' : 'Kết thúc trận'} busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => run('end')} />
    </Page>
  );
};
