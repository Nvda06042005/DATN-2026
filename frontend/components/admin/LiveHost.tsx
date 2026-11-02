/**
 * Màn hình điều khiển trận thi đấu trực tiếp của giáo viên, thiết kế để chiếu lên lớp (Sprint 8, HK.GV.052–055, HK.SYS.016; ver0.2: HK.GV.095–101):
 * phòng chờ với mã PIN và mã QR, danh sách người tham gia cập nhật theo thời gian thực (có nút loại người chơi), khóa / mở khóa phòng, duyệt học sinh xin vào muộn,
 * điều khiển (bắt đầu, câu tiếp theo, tạm dừng, bỏ qua câu, kết thúc sớm), thiết lập chống tra cứu và cảnh báo chuyển tab, kết quả từng câu (biểu đồ phân bố đáp án,
 * đáp án đúng, bảng xếp hạng tức thời), thanh máu trùm ở chế độ Đánh trùm cả lớp và bục vinh quang cuối trận. Giao diện theo chủ đề của Quiz.
 * Máy chủ giữ trạng thái; màn hình này chỉ hiển thị và gửi lệnh.
 */
import React, { useState } from 'react';
import { Image, Platform, Pressable, View } from 'react-native';
import { ArrowRight, Eye, FileText, Lock, LockOpen, Maximize, Music, Pause, Play, Shuffle, SkipForward, Square, TriangleAlert, Trophy, UserX, Users, VolumeX, Wifi, WifiOff } from 'lucide-react-native';
import * as api from '@/api/liveApi';
import { errorMessage } from '@/api/client';
import { DownloadButton, ErrorNote, Page, PageHeader, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { BossPanel, LiveAvatar, LiveBoard, LiveChoice, LiveCountdown, LiveDistribution, LivePodium } from '@/components/portal/LiveKit';
import { LIVE_MUSIC, ThemeFrame, themeOf, useLobbyMusic } from '@/components/portal/LiveTheme';
import { MediaView } from '@/components/portal/Media';
import { keyLines } from '@/components/portal/QuizPlayer';
import { Btn, Card, Chip, ConfirmSheet, InfoNote, Segmented, Spinner, ToggleRow, Txt, useToast } from '@/components/ui';
import { useLiveRoom, useRemaining } from '@/hooks/use-live-room';
import { useTheme } from '@/hooks/use-theme';
import { LIVE_MODE_TEXT, type LiveAction, type LiveView } from '@/types/live';

const fullscreen = () => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.();
};

/** Ghi chú: trên nền chủ đề đậm thì đặt trong thẻ sáng để vẫn đọc được */
const Note: React.FC<{ view: LiveView; children: React.ReactNode }> = ({ view, children }) => (themeOf(view.room.theme).bg ? <Card flat pad={12}><Txt size={14}>{children}</Txt></Card> : <InfoNote>{children}</InfoNote>);

const PlayerChip: React.FC<{ p: LiveView['players'][number]; onKick?: () => void; showAlerts?: boolean }> = ({ p, onKick, showAlerts }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: onKick ? 4 : 16, borderRadius: 999, borderWidth: 2, borderColor: p.online ? c.ngoc : c.vien, backgroundColor: c.the, opacity: p.online ? 1 : 0.7 }}>
      <LiveAvatar avatar={p.avatar} size={44} />
      <View>
        <Txt f="bold" size={18}>{p.nickname}</Txt>
        {p.team_name ? <Txt size={12} color={c.muc3}>{p.team_name}</Txt> : null}
        {showAlerts && p.tab_switches ? <Txt size={12} color={c.vangChu}>Chuyển tab {p.tab_switches} lần</Txt> : null}
      </View>
      {onKick ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Loại ${p.nickname} khỏi phòng`} onPress={onKick} hitSlop={6} testID={`live-kick-${p.id}`}
          style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.sonNhat : 'transparent' })}>
          <UserX size={20} color={c.sonChu} />
        </Pressable>
      ) : null}
    </View>
  );
};

const Lobby: React.FC<{ view: LiveView; join: { join_url?: string; qr?: string }; onKick: (id: number, name: string) => void; music: boolean; onMusic: () => void }> = ({ view, join, onKick, music, onMusic }) => {
  const { c } = useTheme();
  const hasMusic = (view.room.theme.music ?? 'none') !== 'none';
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <Card style={{ flexGrow: 2, flexBasis: 360, alignItems: 'center', gap: 8, paddingVertical: 24 }}>
          <Txt size={16} color={c.muc2}>Vào trang học sinh → mục “Thi đấu”, nhập mã PIN</Txt>
          <Txt f="displayHeavy" size={88} selectable testID="live-pin-display" accessibilityLabel={`Mã PIN ${view.room.pin.split('').join(' ')}`} style={{ letterSpacing: 14 }}>{view.room.pin}</Txt>
          {join.join_url ? <Txt size={13} color={c.muc3} selectable center>hoặc quét mã QR / mở {join.join_url}</Txt> : null}
          {view.room.locked ? <Chip text="Phòng đã khóa – chỉ người đã vào hoặc được duyệt mới vào được" bg={c.vangNhat} fg={c.vangChu} icon={Lock} /> : null}
        </Card>
        {join.qr ? (
          <Card style={{ flexGrow: 1, flexBasis: 240, alignItems: 'center', justifyContent: 'center' }}>
            <Image source={{ uri: join.qr }} accessibilityLabel={`Mã QR vào phòng thi, mã PIN ${view.room.pin}`} style={{ width: 240, height: 240 }} />
          </Card>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Users size={26} color={c.thuyChu} />
        <Txt f="displayHeavy" size={26} accessibilityLiveRegion="polite" color={themeOf(view.room.theme).bg ? '#ffffff' : c.muc}>{view.player_count} học sinh đã vào phòng</Txt>
        <Chip text={LIVE_MODE_TEXT[view.room.mode]} bg={c.thuyNhat} fg={c.thuyChu} />
        {hasMusic ? <Btn icon={music ? VolumeX : Music} title={music ? 'Tắt nhạc chờ' : `Bật nhạc chờ: ${LIVE_MUSIC.find((m) => m.id === view.room.theme.music)?.label ?? ''}`} tone="giay" size="sm" onPress={onMusic} testID="live-music" /> : null}
      </View>
      {view.player_count === 0 ? <Note view={view}>Chưa có ai vào phòng. Học sinh của lớp {view.room.class_name} nhập mã PIN ở trên để vào.</Note> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {view.players.map((p) => <PlayerChip key={p.id} p={p} onKick={() => onKick(p.id, p.nickname)} />)}
      </View>
    </View>
  );
};

const Question: React.FC<{ view: LiveView; skew: number; answered: { count: number; online: number } | null }> = ({ view, skew, answered }) => {
  const { c } = useTheme();
  const q = view.question!;
  const remaining = useRemaining(q, skew);
  const opts = q.qtype === 'truefalse' ? [{ id: 'true', text: 'Đúng', shape: 0 }, { id: 'false', text: 'Sai', shape: 1 }] : q.view.options ?? [];
  return (
    <View style={{ gap: 18 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Txt f="bold" size={20} color={themeOf(view.room.theme).bg ? '#ffffff' : c.muc2}>Câu {q.index + 1}/{q.total} · {q.points_max > 0 ? `tối đa ${q.points_max} điểm` : 'không tính điểm'}</Txt>
        <Chip text={`${answered?.count ?? 0}/${view.player_count} đã trả lời`} bg={c.thuyNhat} fg={c.thuyChu} icon={Users} />
      </View>
      {view.boss ? <BossPanel boss={view.boss} big /> : null}
      <LiveCountdown remaining={remaining} total={q.seconds} paused={q.paused} big />
      <Card style={{ paddingVertical: 28, gap: 12 }}>
        <Txt f="displayHeavy" size={34} accessibilityRole="header">{q.view.prompt}</Txt>
        <MediaView image={q.view.image_url} video={q.view.video_url} label={q.view.prompt} height={300} />
      </Card>
      {opts.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {opts.map((o, i) => <View key={o.id} style={{ flexGrow: 1, flexBasis: 360 }}><LiveChoice index={i} shape={o.shape} text={o.text ?? ''} big /></View>)}
        </View>
      ) : <Note view={view}>Câu này học sinh trả lời trên thiết bị của mình ({q.qtype === 'fill' ? 'điền khuyết' : q.qtype === 'order' ? 'sắp xếp' : 'đặt lên bản đồ'}).</Note>}
      {view.alerts?.length ? (
        <Card flat pad={14} style={{ backgroundColor: c.vangNhat, gap: 4 }} testID="live-alerts">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><TriangleAlert size={20} color={c.vangChu} /><Txt f="bold" size={16} color={c.vangChu}>Học sinh rời tab khi đang trả lời</Txt></View>
          {view.alerts.map((a) => <Txt key={a.player_id} size={15} color={c.vangChu}>{a.nickname}: {a.count} lần ở câu này</Txt>)}
        </Card>
      ) : null}
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
      <Txt f="bold" size={20} color={themeOf(view.room.theme).bg ? '#ffffff' : c.muc2}>Kết quả câu {r.index + 1}/{view.room.total}</Txt>
      {view.boss ? <BossPanel boss={view.boss} hit={r.boss_hit} big /> : null}
      <Card style={{ paddingVertical: 20 }}><Txt f="displayHeavy" size={28}>{r.prompt}</Txt></Card>
      {r.skipped ? <Note view={view}>Câu này đã bị bỏ qua nên không tính điểm cho ai.</Note> : (
        <>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <Chip text={`${r.stats.correct} đúng`} bg={c.ngocNhat} fg={c.ngocChu} />
            <Chip text={`${r.stats.wrong} sai`} bg={c.sonNhat} fg={c.sonChu} />
            <Chip text={`${r.stats.none} chưa trả lời`} bg={c.dichNhat} fg={c.dich} />
          </View>
          {r.options ? <LiveDistribution options={r.options} total={total} big /> : (
            <Card flat pad={16} style={{ gap: 4 }}><Txt f="bold" size={18}>Đáp án đúng</Txt>{keyLines(r.qtype, r.answer_key).map((l) => <Txt key={l} size={18}>{l}</Txt>)}</Card>
          )}
          {r.explanation ? <Note view={view}>{r.explanation}</Note> : null}
        </>
      )}
      <Txt f="displayHeavy" size={24} color={themeOf(view.room.theme).bg ? '#ffffff' : c.muc}>Bảng xếp hạng tức thời</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <View style={{ flexGrow: 2, flexBasis: 360 }}><LiveBoard rows={r.top} big /></View>
        {r.teams ? (
          <View style={{ flexGrow: 1, flexBasis: 260, gap: 8 }}>
            <Txt f="bold" size={16} color={themeOf(view.room.theme).bg ? '#ffffff' : c.muc}>Điểm đội (trung bình thành viên)</Txt>
            {r.teams.map((t) => <Txt key={t.team_id} size={18} color={themeOf(view.room.theme).bg ? '#ffffff' : c.muc}>{t.rank}. {t.name}: {t.score} điểm ({t.members} bạn)</Txt>)}
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
      {view.boss ? <BossPanel boss={view.boss} big /> : null}
      <Txt f="displayHeavy" size={34} center accessibilityRole="header" color={themeOf(view.room.theme).bg ? '#ffffff' : c.muc}>{team ? 'Đội chiến thắng' : 'Bục vinh quang'}</Txt>
      {f.ended_early ? <Note view={view}>Trận được kết thúc sớm sau {f.played}/{view.room.total} câu.</Note> : null}
      <LivePodium items={items} big />
      {team ? <Txt size={14} color={c.muc2} center>Điểm đội là trung bình điểm của các thành viên đã tham gia. Top 3 cá nhân: {f.podium.map((p) => `${p.rank}. ${p.nickname} (${p.score})`).join(' · ')}</Txt> : null}
      <Txt f="bold" size={18} color={themeOf(view.room.theme).bg ? '#ffffff' : c.muc}>Bảng xếp hạng cuối trận</Txt>
      <LiveBoard rows={f.ranking.slice(0, 10)} />
      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Btn icon={FileText} title="Xem báo cáo trận" tone="son" onPress={onReport} testID="live-open-report" />
        <DownloadButton title="Xuất Excel" fetchBlob={() => api.exportRoom(session.token, view.room.id, 'xlsx')} filename={`bao-cao-thi-dau-${view.room.id}.xlsx`} />
        <DownloadButton title="Xuất PDF" fetchBlob={() => api.exportRoom(session.token, view.room.id, 'pdf')} filename={`bao-cao-thi-dau-${view.room.id}.pdf`} />
      </View>
    </View>
  );
};

/** Thiết lập chống tra cứu (HK.GV.100) và tên theo hồ sơ (HK.GV.098): đổi được ngay cả khi trận đang diễn ra, trừ tên và tự khóa chỉ đổi ở phòng chờ */
const SafetyCard: React.FC<{ view: LiveView; busy: boolean; onChange: (body: Partial<api.RoomOptions>) => void }> = ({ view, busy, onChange }) => {
  const { c } = useTheme();
  const r = view.room;
  const lobby = r.state === 'lobby';
  const autoLock = r.auto_lock_seconds === null ? 'off' : r.auto_lock_seconds === 0 ? 'start' : 'delay';
  return (
    <Card flat pad={14} style={{ gap: 10 }} testID="live-safety">
      <Txt f="bold" size={15}>Chống tra cứu đáp án</Txt>
      <ToggleRow icon={Eye} checked={!r.hide_on_device} onChange={(v) => onChange({ hide_on_device: !v })} label="Hiện đầy đủ câu hỏi trên thiết bị học sinh" desc="Tắt (mặc định): thiết bị chỉ có nút hình – màu, nội dung chỉ hiện trên màn chiếu. Bật khi học từ xa." />
      <ToggleRow icon={Shuffle} checked={r.shuffle_device} onChange={(v) => onChange({ shuffle_device: v })} label="Xáo thứ tự đáp án trên từng thiết bị" desc="Chỉ có tác dụng khi hiện đầy đủ nội dung trên thiết bị; hình – màu của mỗi đáp án giữ nguyên." />
      <ToggleRow icon={TriangleAlert} checked={r.tab_alert} onChange={(v) => onChange({ tab_alert: v })} label="Cảnh báo khi học sinh chuyển tab / thu nhỏ trình duyệt" desc="Hiện tên học sinh trên màn hình điều khiển trong lúc đang trả lời." />
      {lobby ? (
        <>
          <ToggleRow icon={Users} checked={r.profile_names} onChange={(v) => onChange({ profile_names: v })} label="Tên hiển thị lấy theo hồ sơ học sinh" desc="Tắt thì học sinh tự đặt biệt danh." />
          <Txt f="bold" size={14} color={c.muc2}>Tự khóa phòng</Txt>
          <Segmented<string> label="Tự khóa phòng" value={autoLock} onChange={(v) => onChange({ auto_lock_seconds: v === 'off' ? null : v === 'start' ? 0 : 30 })}
            options={[{ value: 'start', label: 'Khi bắt đầu' }, { value: 'delay', label: 'Sau 30 giây' }, { value: 'off', label: 'Không tự khóa' }]} />
        </>
      ) : null}
      {busy ? <Spinner label="Đang lưu…" /> : null}
    </Card>
  );
};

export const LiveHost: React.FC<{ session: Session; roomId: number; onBack: () => void; onReport: (roomId: number) => void }> = ({ session, roomId, onBack, onReport }) => {
  const toast = useToast();
  const { c } = useTheme();
  const live = useLiveRoom(session.token, roomId, session.expired);
  const join = useLoad(() => api.hostRoom(session.token, roomId), [session.token, roomId], session.expired);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'skip' | 'end' | null>(null);
  const [kicking, setKicking] = useState<{ id: number; name: string } | null>(null);
  const [music, setMusic] = useState(false);
  const [showPlayers, setShowPlayers] = useState(false);
  const view = live.view;
  const room = view?.room;
  const q = view?.question;
  useLobbyMusic(room?.theme.music, music && room?.state === 'lobby');
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); await live.refresh(); } catch (e) { toast(errorMessage(e)); } finally { setBusy(false); setConfirm(null); setKicking(null); }
  };
  const run = (action: LiveAction) => act(() => live.command(action));
  return (
    <Page>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Btn title="Danh sách phòng thi" tone="giay" size="sm" onPress={onBack} />
        <Chip text={live.connected ? 'Đã kết nối thời gian thực' : 'Đang kết nối lại…'} bg={live.connected ? c.ngocNhat : c.vangNhat} fg={live.connected ? c.ngocChu : c.vangChu} icon={live.connected ? Wifi : WifiOff} />
        {room?.locked ? <Chip text="Phòng đã khóa" bg={c.vangNhat} fg={c.vangChu} icon={Lock} /> : null}
        {Platform.OS === 'web' ? <Btn icon={Maximize} title="Toàn màn hình" tone="giay" size="sm" onPress={fullscreen} /> : null}
      </View>
      <ErrorNote message={live.error} />
      {!view ? <Spinner label="Đang mở phòng thi…" /> : null}
      {room ? <PageHeader title={room.title} subtitle={`Lớp ${room.class_name} · ${LIVE_MODE_TEXT[room.mode].toLowerCase()}${view?.boss ? ` (${view.boss.name})` : ''} · ${room.total} câu`} /> : null}

      {view && room ? (
        <ThemeFrame theme={room.theme}>
          {room.state === 'lobby' ? <Lobby view={view} join={{ join_url: join.data?.join_url, qr: join.data?.qr }} onKick={(id, name) => setKicking({ id, name })} music={music} onMusic={() => setMusic((m) => !m)} /> : null}
          {room.state === 'question' && q ? <Question view={view} skew={live.skew} answered={live.answered} /> : null}
          {room.state === 'results' && view.results ? <Results view={view} /> : null}
          {room.state === 'ended' && view.final ? <Ended session={session} view={view} onReport={() => onReport(roomId)} /> : null}
        </ThemeFrame>
      ) : null}

      {view?.requests?.length ? (
        <Card flat pad={14} style={{ gap: 10, borderColor: c.vangDam }} testID="live-requests">
          <Txt f="bold" size={16}>Học sinh xin vào phòng ({view.requests.length})</Txt>
          {view.requests.map((r) => (
            <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Txt size={15} style={{ flex: 1, minWidth: 160 }}>{r.full_name}{r.user_code ? ` · ${r.user_code}` : ''}</Txt>
              <Btn title="Cho vào" tone="ngoc" size="sm" disabled={busy} onPress={() => act(() => api.decideRequest(session.token, roomId, r.id, true))} testID={`live-approve-${r.id}`} />
              <Btn title="Từ chối" tone="giay" size="sm" disabled={busy} onPress={() => act(() => api.decideRequest(session.token, roomId, r.id, false))} testID={`live-reject-${r.id}`} />
            </View>
          ))}
          <Txt size={12} color={c.muc3}>Người được duyệt chỉ làm từ câu đang diễn ra và không xem lại các câu đã qua.</Txt>
        </Card>
      ) : null}

      {view && room && room.state !== 'ended' ? (
        <Card flat pad={14} style={{ gap: 10, position: 'relative' }}>
          <Txt size={13} color={c.muc3}>Điều khiển trận (chỉ giáo viên thấy ở máy này; học sinh làm trên thiết bị của mình)</Txt>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {room.state === 'lobby' ? <Btn icon={Play} title="Bắt đầu trận" tone="ngoc" size="lg" loading={busy} disabled={view.player_count === 0} onPress={() => run('start')} testID="live-start" /> : null}
            {room.state === 'question' ? <Btn icon={q?.paused ? Play : Pause} title={q?.paused ? 'Tiếp tục' : 'Tạm dừng'} tone="giay" loading={busy} onPress={() => run(q?.paused ? 'resume' : 'pause')} testID="live-pause" /> : null}
            {room.state === 'question' ? <Btn icon={ArrowRight} title="Kết thúc câu, xem kết quả" tone="ngoc" loading={busy} onPress={() => run('next')} testID="live-next" /> : null}
            {room.state === 'question' ? <Btn icon={SkipForward} title="Bỏ qua câu này" tone="giay" disabled={busy} onPress={() => setConfirm('skip')} testID="live-skip" /> : null}
            {room.state === 'results' ? <Btn icon={view.results?.last ? Trophy : ArrowRight} title={view.results?.last ? 'Xem bục vinh quang' : 'Câu tiếp theo'} tone="ngoc" size="lg" loading={busy} onPress={() => run('next')} testID="live-next" /> : null}
            <Btn icon={room.locked ? LockOpen : Lock} title={room.locked ? 'Mở khóa phòng' : 'Khóa phòng'} tone="giay" disabled={busy} onPress={() => run(room.locked ? 'unlock' : 'lock')} testID="live-lock" />
            <Btn icon={Users} title={showPlayers ? 'Ẩn danh sách người chơi' : `Người chơi (${view.player_count})`} tone="giay" onPress={() => setShowPlayers((v) => !v)} testID="live-players-toggle" />
            <Btn icon={Square} title={room.state === 'lobby' ? 'Hủy phòng' : 'Kết thúc trận'} tone="giay" disabled={busy} onPress={() => setConfirm('end')} testID="live-end" />
          </View>
          {room.locked ? <Txt size={13} color={c.muc3}>Phòng đang khóa: mã PIN không nhận thêm người mới. Học sinh đã vào vẫn nối lại được khi mất mạng.</Txt> : null}
          {showPlayers ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {view.players.map((p) => <PlayerChip key={p.id} p={p} showAlerts onKick={() => setKicking({ id: p.id, name: p.nickname })} />)}
            </View>
          ) : null}
        </Card>
      ) : null}
      {view && room && room.state !== 'ended' ? <SafetyCard view={view} busy={busy} onChange={(body) => act(() => api.roomSettings(session.token, roomId, body))} /> : null}
      <ConfirmSheet open={confirm === 'skip'} title="Bỏ qua câu này?" message="Câu bị bỏ qua không tính điểm cho ai (điểm học sinh đã nhận ở câu này được thu hồi) và trận chuyển sang màn hình kết quả." confirmLabel="Bỏ qua câu" busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => run('skip')} />
      <ConfirmSheet open={confirm === 'end'} title={room?.state === 'lobby' ? 'Hủy phòng thi?' : 'Kết thúc trận sớm?'} message={room?.state === 'lobby' ? 'Phòng sẽ đóng, học sinh không vào được nữa.' : 'Trận kết thúc ngay, các câu còn lại không diễn ra. Điểm được chốt và cộng vào tài khoản học sinh.'} confirmLabel={room?.state === 'lobby' ? 'Hủy phòng' : 'Kết thúc trận'} busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => run('end')} />
      <ConfirmSheet open={Boolean(kicking)} title={`Loại ${kicking?.name ?? ''} khỏi phòng?`} message="Người bị loại không vào lại được phòng này; điểm và đáp án của người đó không còn được tính." confirmLabel="Loại khỏi phòng" busy={busy} onCancel={() => setKicking(null)} onConfirm={() => { if (kicking) void act(() => api.kickPlayer(session.token, roomId, kicking.id)); }} />
    </Page>
  );
};
