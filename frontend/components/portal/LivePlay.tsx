/**
 * Thi đấu trực tiếp của học sinh (Sprint 8, HK.HS.079–085): phòng chờ (chọn biệt danh và hình đại diện), trả lời câu hỏi đồng bộ với màn hình giáo viên,
 * bảng điểm top 5 sau mỗi câu, bục vinh quang cuối trận kèm điểm cộng vào tài khoản, xem lại từng câu, thi theo đội, đánh trùm cả lớp.
 * Khi giáo viên ẩn nội dung trên thiết bị, màn hình chỉ có các nút hình – màu ứng với đáp án trên màn chiếu (HK.HS.139). Máy chủ chấm điểm và giữ đồng hồ.
 */
import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { CheckCircle2, Clock, Lock, Trophy, Users, Wifi, WifiOff, XCircle } from 'lucide-react-native';
import * as api from '@/api/liveApi';
import { errorMessage } from '@/api/client';
import { ErrorNote, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { BossPanel, LiveAvatar, LiveAvatarPicker, LiveBoard, LiveChoice, LiveCountdown, LiveDistribution, LivePodium, LiveShapeButton } from '@/components/portal/LiveKit';
import { MediaView } from '@/components/portal/Media';
import { buildAnswer, initialDraft, keyLines, QuestionInput, ready, type Draft } from '@/components/portal/QuizPlayer';
import { Btn, Card, Chip, Field, InfoNote, Spinner, Txt } from '@/components/ui';
import { useLiveRoom, useRemaining } from '@/hooks/use-live-room';
import { useTheme } from '@/hooks/use-theme';
import type { PlayQuestion } from '@/types/learning';
import { LIVE_MODE_TEXT, type LiveReview, type LiveView } from '@/types/live';

const StatusChip: React.FC<{ on: boolean }> = ({ on }) => {
  const { c } = useTheme();
  return <Chip text={on ? 'Đã kết nối' : 'Đang kết nối lại…'} bg={on ? c.ngocNhat : c.vangNhat} fg={on ? c.ngocChu : c.vangChu} icon={on ? Wifi : WifiOff} />;
};

// ---------------------------------------------------------------------- phòng chờ (HK.HS.079–080)
const Lobby: React.FC<{ view: LiveView; busy: boolean; onProfile: (nickname: string, avatar: string) => void }> = ({ view, busy, onProfile }) => {
  const { c } = useTheme();
  const me = view.me;
  const [nick, setNick] = useState(me?.nickname ?? '');
  const [avatar, setAvatar] = useState(me?.avatar ?? 'star');
  useEffect(() => { if (me) { setNick(me.nickname); setAvatar(me.avatar); } }, [me?.nickname, me?.avatar]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = Boolean(me && ((!view.room.profile_names && nick.trim() !== me.nickname) || avatar !== me.avatar));
  return (
    <View style={{ gap: 14 }}>
      <Card style={{ alignItems: 'center', gap: 6 }}>
        <Users size={36} color={c.thuyChu} />
        <Txt f="displayHeavy" size={22} center accessibilityRole="header">Đang chờ giáo viên bắt đầu…</Txt>
        <Txt size={14} color={c.muc2} center>Em đã vào phòng “{view.room.title}”. Khi giáo viên bấm bắt đầu, câu hỏi sẽ hiện ngay trên màn hình này.</Txt>
        {view.room.mode === 'team' ? <Chip text={me?.team_name ? `Em thuộc đội: ${me.team_name}` : 'Em chưa có đội: điểm của em không tính vào bảng đội'} bg={me?.team_name ? c.ngocNhat : c.vangNhat} fg={me?.team_name ? c.ngocChu : c.vangChu} /> : null}
      </Card>
      <Card flat pad={14} style={{ gap: 10 }}>
        <Txt f="bold" size={16}>{view.room.profile_names ? 'Tên hiển thị và hình đại diện' : 'Biệt danh và hình đại diện'}</Txt>
        {view.room.profile_names
          ? <Txt size={15} testID="live-profile-name">Tên của em trong phòng: <Txt f="bold" size={15}>{me?.nickname}</Txt> (lấy theo hồ sơ của em)</Txt>
          : <Field label="Biệt danh (2–20 ký tự)" value={nick} onChangeText={setNick} maxLength={20} testID="live-nickname" />}
        <LiveAvatarPicker value={avatar} onChange={setAvatar} />
        <Btn title="Lưu thay đổi" tone="ngoc" size="sm" disabled={!dirty} loading={busy} onPress={() => onProfile(view.room.profile_names ? (me?.nickname ?? nick) : nick, avatar)} testID="live-profile-save" />
      </Card>
      <Txt f="bold" size={15}>Đã có {view.player_count} bạn trong phòng</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {view.players.map((p) => (
          <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 12, borderRadius: 999, borderWidth: 2, borderColor: p.nickname === me?.nickname ? c.ngoc : c.vien, backgroundColor: c.the }}>
            <LiveAvatar avatar={p.avatar} size={34} />
            <Txt size={14} f={p.nickname === me?.nickname ? 'bold' : 'body'}>{p.nickname}</Txt>
          </View>
        ))}
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------- câu hỏi (HK.HS.081, HK.HS.139)
const Question: React.FC<{ view: LiveView; skew: number; onAnswer: (value: unknown) => Promise<void> }> = ({ view, skew, onAnswer }) => {
  const { c } = useTheme();
  const q = view.question!;
  const pq = q.view as unknown as PlayQuestion;
  const hidden = Boolean(q.view.hidden);
  const remaining = useRemaining(q, skew);
  const [draft, setDraft] = useState<Draft>(() => initialDraft(pq));
  const [sending, setSending] = useState(false);
  const [sentLocal, setSentLocal] = useState<number | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  useEffect(() => { setDraft(initialDraft(pq)); setPicked(null); setPicks([]); }, [q.index]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = Boolean(view.me?.answered) || sentLocal === q.index;
  const closed = remaining <= 0 && !q.paused;
  const send = async (value: unknown, label?: string) => {
    if (done || sending || closed || q.paused) return;
    setSending(true);
    if (label) setPicked(label);
    try { await onAnswer(value); setSentLocal(q.index); } catch { /* lỗi hiển thị ở khung chính */ } finally { setSending(false); }
  };
  const opts = q.view.options ?? [];
  const instant = q.qtype === 'single' || q.qtype === 'truefalse';
  const locked = sending || closed || q.paused;
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Txt f="bold" size={14} color={c.muc2}>Câu {q.index + 1}/{q.total} · {q.points_max > 0 ? `tối đa ${q.points_max} điểm` : 'không tính điểm'}</Txt>
          {view.me ? <Txt f="bold" size={14} color={c.dongChu}>{view.me.score} điểm · hạng {view.me.rank ?? '–'}</Txt> : null}
        </View>
        <LiveCountdown remaining={remaining} total={q.seconds} paused={q.paused} />
      </View>
      {view.boss ? <BossPanel boss={view.boss} /> : null}
      {hidden ? (
        <Card style={{ gap: 6, alignItems: 'center' }}>
          <Txt f="displayHeavy" size={20} center accessibilityRole="header">Nhìn lên màn hình của lớp và chọn đáp án</Txt>
          <Txt size={14} color={c.muc2} center>{q.qtype === 'multiple' ? 'Câu này có nhiều đáp án đúng: chọn đủ các nút rồi bấm Gửi.' : 'Bấm nút có hình và màu giống đáp án em chọn trên màn hình.'}</Txt>
        </Card>
      ) : (
        <Card style={{ gap: 8 }}>
          <Txt f="displayHeavy" size={22} accessibilityRole="header">{q.view.prompt}</Txt>
          <MediaView image={q.view.image_url} video={q.view.video_url} label={q.view.prompt} />
        </Card>
      )}
      {q.paused ? <InfoNote>Giáo viên đang tạm dừng. Câu hỏi sẽ tiếp tục ngay khi thầy cô bấm tiếp tục.</InfoNote> : null}
      {done ? (
        <Card flat pad={16} style={{ backgroundColor: c.ngocNhat }}>
          <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={36} color={c.ngocChu} />
            <Txt f="displayHeavy" size={20} color={c.ngocChu}>Đã gửi câu trả lời!</Txt>
            <Txt size={14} color={c.ngocChu} center>Chờ các bạn khác và kết quả của câu này{picked ? ` (em chọn: ${picked})` : ''}.</Txt>
          </View>
        </Card>
      ) : hidden ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {opts.map((o) => (
              <LiveShapeButton key={o.id} shape={o.shape} disabled={locked} testID={`live-shape-${o.shape}`}
                selected={q.qtype === 'multiple' ? picks.includes(o.id) : picked === o.id}
                onPress={() => {
                  if (q.qtype === 'multiple') setPicks((p) => (p.includes(o.id) ? p.filter((x) => x !== o.id) : [...p, o.id]));
                  else void send(q.qtype === 'truefalse' ? { value: o.id === 'true' } : { choice: o.id }, o.id === 'true' ? 'Đúng' : o.id === 'false' ? 'Sai' : `nút ${String.fromCharCode(65 + o.shape)}`);
                }} />
            ))}
          </View>
          {q.qtype === 'multiple' ? <Btn title="Gửi đáp án" tone="ngoc" size="lg" full loading={sending} disabled={picks.length === 0 || locked} onPress={() => send({ choices: picks }, `${picks.length} nút`)} testID="live-submit" /> : null}
        </View>
      ) : instant ? (
        <View style={{ gap: 10 }}>
          {(q.qtype === 'truefalse' ? [{ id: 'true', text: 'Đúng', shape: 0 }, { id: 'false', text: 'Sai', shape: 1 }] : opts).map((o, i) => (
            <LiveChoice key={o.id} index={i} shape={o.shape} text={o.text ?? ''} disabled={locked} testID={`live-option-${i}`}
              onPress={() => send(q.qtype === 'truefalse' ? { value: o.id === 'true' } : { choice: o.id }, o.text)} big />
          ))}
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <QuestionInput q={pq} draft={draft} setDraft={setDraft} disabled={locked} />
          <Btn title="Gửi đáp án" tone="ngoc" size="lg" full loading={sending} disabled={!ready(pq, draft) || closed || q.paused} onPress={() => send(buildAnswer(pq.qtype, draft))} testID="live-submit" />
        </View>
      )}
      {view.room.tab_alert && !done ? <Txt size={12} color={c.muc3}>Giáo viên sẽ biết nếu em rời khỏi tab này khi đang làm bài.</Txt> : null}
      {closed && !done ? <Txt size={13} color={c.sonChu}>Đã hết giờ cho câu này.</Txt> : null}
    </View>
  );
};

// ---------------------------------------------------------------------- kết quả câu và bảng điểm (HK.HS.082)
const Results: React.FC<{ view: LiveView }> = ({ view }) => {
  const { c } = useTheme();
  const r = view.results!, me = view.me, last = me?.last;
  const total = r.stats.correct + r.stats.wrong + r.stats.none;
  const right = r.options ? r.options.filter((o) => o.correct).map((o) => o.text) : keyLines(r.qtype, r.answer_key);
  const tone = r.skipped ? 'muted' : !last || last.elapsed_ms === null ? 'none' : last.correct ? 'ok' : 'bad';
  return (
    <View style={{ gap: 14 }}>
      {view.boss ? <BossPanel boss={view.boss} hit={r.boss_hit} /> : null}
      <Card style={{ backgroundColor: tone === 'ok' ? c.ngocNhat : tone === 'bad' ? c.sonNhat : c.the2 }}>
        <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', gap: 6 }}>
        {tone === 'ok' ? <CheckCircle2 size={44} color={c.ngocChu} /> : tone === 'bad' ? <XCircle size={44} color={c.sonChu} /> : <Clock size={44} color={c.muc3} />}
        <Txt f="displayHeavy" size={26} center color={tone === 'ok' ? c.ngocChu : tone === 'bad' ? c.sonChu : c.muc}>
          {r.skipped ? 'Giáo viên đã bỏ qua câu này' : tone === 'ok' ? `Chính xác! ${last?.points ? `+${last.points} điểm` : 'Câu này không tính điểm'}${view.boss && last?.damage ? ` · đòn của em: -${last.damage} máu trùm` : ''}` : tone === 'bad' ? 'Chưa đúng' : 'Em chưa trả lời câu này'}
        </Txt>
        {r.skipped ? <Txt size={14} color={c.muc2} center>Câu bị bỏ qua không tính điểm cho ai.</Txt> : null}
        {me ? <Txt f="bold" size={16}>Hạng {me.rank ?? '–'} · {me.score} điểm</Txt> : null}
        </View>
      </Card>
      {!r.skipped ? (
        <Card flat pad={14} style={{ gap: 6 }}>
          <Txt f="bold" size={15}>{r.prompt}</Txt>
          <Txt f="semibold" size={15} color={c.ngocChu}>Đáp án đúng: {right.join('; ')}</Txt>
          {r.explanation ? <Txt size={14} color={c.muc2}>{r.explanation}</Txt> : null}
          <Txt size={13} color={c.muc3}>{r.stats.correct}/{total} bạn trả lời đúng</Txt>
        </Card>
      ) : null}
      {r.options && !r.skipped ? <LiveDistribution options={r.options} total={total} /> : null}
      <Txt f="bold" size={16}>Bảng điểm</Txt>
      <LiveBoard rows={r.top} me={me?.nickname} />
      {me && !r.top.some((t) => t.nickname === me.nickname) ? <Txt size={14} color={c.muc2}>Em đang xếp hạng {me.rank ?? '–'} với {me.score} điểm.</Txt> : null}
      {r.teams ? (
        <>
          <Txt f="bold" size={16}>Bảng điểm đội (trung bình thành viên)</Txt>
          {r.teams.map((t) => <Txt key={t.team_id} size={15} f={t.name === me?.team_name ? 'bold' : 'body'}>{t.rank}. {t.name}: {t.score} điểm ({t.members} bạn)</Txt>)}
        </>
      ) : null}
      <Txt size={13} color={c.muc3} center>{r.last ? (view.boss?.outcome ? 'Trận đấu với trùm đã ngã ngũ. Chờ giáo viên mở màn tổng kết…' : 'Đây là câu cuối. Chờ giáo viên mở bục vinh quang…') : 'Chờ giáo viên chuyển sang câu tiếp theo…'}</Txt>
    </View>
  );
};

// ---------------------------------------------------------------------- bục vinh quang (HK.HS.083) và xem lại (HK.HS.084)
const ReviewList: React.FC<{ review: LiveReview }> = ({ review }) => {
  const { c } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <Txt size={14} color={c.muc2}>Hạng {review.summary.rank}/{review.summary.players} · {review.summary.score} điểm · đúng {review.summary.correct_count}/{review.items.filter((i) => !i.skipped).length} câu</Txt>
      {review.items.map((it) => (
        <Card key={it.index} flat pad={12} style={{ gap: 4, borderColor: it.skipped ? c.vien : it.correct ? c.ngoc : c.son }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip text={it.skipped ? 'Bị bỏ qua' : it.correct ? `Đúng +${it.points}` : it.answered ? 'Sai' : 'Chưa trả lời'} bg={it.skipped ? c.dichNhat : it.correct ? c.ngocNhat : c.sonNhat} fg={it.skipped ? c.dich : it.correct ? c.ngocChu : c.sonChu} icon={it.correct ? CheckCircle2 : it.skipped ? Clock : XCircle} />
            <Txt size={12} color={c.muc3}>Câu {it.index + 1}{it.class_correct_rate !== null ? ` · cả lớp đúng ${it.class_correct_rate}%` : ''}</Txt>
          </View>
          <Txt f="semibold" size={15}>{it.prompt}</Txt>
          {!it.skipped ? <Txt size={14} color={c.ngocChu}>Đáp án: {keyLines(it.qtype, it.answer_key).join('; ')}</Txt> : null}
          {it.explanation && !it.skipped ? <Txt size={13} color={c.muc2}>{it.explanation}</Txt> : null}
        </Card>
      ))}
    </View>
  );
};

export const LiveReviewScreen: React.FC<{ session: Session; id: number }> = ({ session, id }) => {
  const review = useLoad(() => api.myReview(session.token, id), [session.token, id], session.expired);
  return (
    <View style={{ gap: 12 }}>
      <ErrorNote message={review.error} />
      {review.loading && !review.data ? <Spinner /> : null}
      {review.data ? <ReviewList review={review.data} /> : null}
    </View>
  );
};

const Ended: React.FC<{ view: LiveView; session: Session }> = ({ view, session }) => {
  const { c } = useTheme();
  const f = view.final!, me = view.me;
  const [open, setOpen] = useState(false);
  const podium = view.room.mode === 'team' && f.teams?.length ? f.teams.slice(0, 3).map((t) => ({ rank: t.rank, name: t.name, score: t.score, sub: `${t.members} bạn` })) : f.podium.map((p) => ({ rank: p.rank, name: p.nickname, avatar: p.avatar, score: p.score, sub: p.team_name }));
  return (
    <View style={{ gap: 14 }}>
      {view.boss ? <BossPanel boss={view.boss} /> : null}
      <Txt f="displayHeavy" size={26} center accessibilityRole="header">{view.room.mode === 'team' ? 'Đội chiến thắng' : 'Bục vinh quang'}</Txt>
      {f.ended_early ? <InfoNote>Giáo viên đã kết thúc trận sớm ({f.played}/{view.room.total} câu).</InfoNote> : null}
      <LivePodium items={podium} />
      {me ? (
        <Card style={{ gap: 6, alignItems: 'center', backgroundColor: c.vangNhat }}>
          <Trophy size={32} color={c.vangChu} />
          <Txt f="displayHeavy" size={22} color={c.vangChu}>Em đứng hạng {me.rank ?? '–'}</Txt>
          <Txt f="bold" size={16}>{me.score} điểm · đúng {me.correct_count}/{me.answered_count} câu đã trả lời</Txt>
          {me.team_name ? <Txt size={14} color={c.muc2}>Đội {me.team_name}</Txt> : null}
          <Txt f="bold" size={16} color={c.ngocChu}>{me.xp_awarded > 0 ? `+${me.xp_awarded} điểm đã cộng vào tài khoản của em${view.boss?.outcome === 'win' ? ' (đã gồm thưởng hạ trùm)' : ''}` : 'Lần này em chưa có điểm cộng vào tài khoản'}</Txt>
        </Card>
      ) : null}
      <Txt f="bold" size={16}>Bảng xếp hạng cuối trận</Txt>
      <LiveBoard rows={f.ranking.slice(0, 10)} me={me?.nickname} />
      <Btn title={open ? 'Ẩn phần xem lại' : 'Xem lại kết quả từng câu'} tone="giay" onPress={() => setOpen(!open)} testID="live-review-open" />
      {open ? <LiveReviewScreen session={session} id={view.room.id} /> : null}
    </View>
  );
};

// ---------------------------------------------------------------------- màn hình chính
export const LivePlay: React.FC<{ session: Session; roomId: number }> = ({ session, roomId }) => {
  const { c } = useTheme();
  const live = useLiveRoom(session.token, roomId, session.expired);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const view = live.view;
  const qIndex = view?.question?.index;
  const answeredNow = Boolean(view?.me?.answered);
  const watching = view?.room.state === 'question' && Boolean(view.room.tab_alert);
  // Rời tab / thu nhỏ trình duyệt khi đang trả lời: báo cho giáo viên (HK.SYS.023); không chặn việc làm bài
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !watching || qIndex === undefined || answeredNow) return undefined;
    const onChange = () => { if (document.visibilityState === 'hidden') void live.blur(qIndex); };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, [watching, qIndex, answeredNow]); // eslint-disable-line react-hooks/exhaustive-deps
  const answer = async (value: unknown) => {
    if (!view?.question) return;
    setError(null);
    try { await live.answer(view.question.index, value); } catch (e) { setError(errorMessage(e)); throw e; }
  };
  const profile = async (nickname: string, avatar: string) => {
    setBusy(true);
    setError(null);
    try { await live.profile({ nickname: nickname.trim(), avatar }); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <StatusChip on={live.connected} />
        {view ? <Chip text={LIVE_MODE_TEXT[view.room.mode]} bg={c.thuyNhat} fg={c.thuyChu} /> : null}
        {view?.room.locked ? <Chip text="Phòng đã khóa" bg={c.vangNhat} fg={c.vangChu} icon={Lock} /> : null}
        {view ? <Txt size={13} color={c.muc3} numberOfLines={1} style={{ flex: 1 }}>{view.room.class_name} · {view.room.title}</Txt> : null}
      </View>
      {live.kicked ? (
        <Card style={{ gap: 8, alignItems: 'center', backgroundColor: c.sonNhat }} testID="live-kicked">
          <XCircle size={40} color={c.sonChu} />
          <Txt f="displayHeavy" size={22} center color={c.sonChu}>Em đã bị giáo viên loại khỏi phòng thi</Txt>
          <Txt size={14} center color={c.muc2}>Em không vào lại được phòng này. Hãy hỏi giáo viên nếu có nhầm lẫn.</Txt>
        </Card>
      ) : null}
      <ErrorNote message={live.kicked ? null : error ?? live.error} />
      {!view && !live.error && !live.kicked ? <Spinner label="Đang vào phòng thi…" /> : null}
      {live.kicked ? null : view?.room.state === 'lobby' ? <Lobby view={view} busy={busy} onProfile={profile} /> : null}
      {live.kicked ? null : view?.room.state === 'question' && view.question ? <Question key={view.question.index} view={view} skew={live.skew} onAnswer={answer} /> : null}
      {live.kicked ? null : view?.room.state === 'results' && view.results ? <Results view={view} /> : null}
      {live.kicked ? null : view?.room.state === 'ended' && view.final ? <Ended view={view} session={session} /> : null}
    </View>
  );
};
