/**
 * Thi đấu trực tiếp của giáo viên (Sprint 8, HK.GV.051, 056–058): danh sách phòng thi đã tổ chức (lịch sử theo lớp), tạo phòng từ bộ đề với chế độ cá nhân hoặc theo đội
 * (hệ thống sinh mã PIN và mã QR), mở màn hình điều khiển để chiếu lên lớp, và báo cáo trận: điểm từng học sinh, tỉ lệ đúng từng câu, câu khó nhất, bảng xếp hạng đội, xuất Excel/PDF.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { ArrowLeft, Play, Plus } from 'lucide-react-native';
import * as classroom from '@/api/classroomApi';
import * as api from '@/api/liveApi';
import * as learning from '@/api/learningApi';
import { Cell, DataTable, DownloadButton, ErrorNote, FormSheet, Page, PageHeader, StatusChip, useLoad } from '@/components/admin/kit';
import { LiveHost } from '@/components/admin/LiveHost';
import type { Session } from '@/components/auth';
import { Bar, Btn, Card, EmptyState, InfoNote, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { LIVE_MODE_TEXT, LIVE_STATE_TEXT, type LiveReport, type LiveRoomRow } from '@/types/live';
import { QTYPE_TEXT } from '@/types/learning';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) : '—');

const Report: React.FC<{ session: Session; roomId: number; onBack: () => void }> = ({ session, roomId, onBack }) => {
  const { c } = useTheme();
  const report = useLoad(() => api.roomReport(session.token, roomId), [session.token, roomId], session.expired);
  const r: LiveReport | null = report.data;
  return (
    <Page>
      <Btn icon={ArrowLeft} title="Danh sách phòng thi" tone="giay" size="sm" onPress={onBack} />
      <ErrorNote message={report.error} />
      {report.loading && !r ? <Spinner /> : null}
      {r ? (
        <>
          <PageHeader title={`Báo cáo: ${r.room.title}`} subtitle={`Lớp ${r.room.class_name} · ${LIVE_MODE_TEXT[r.room.mode].toLowerCase()} · ${when(r.room.started_at ?? r.room.created_at)}`}
            actions={<>
              <DownloadButton title="Xuất Excel" fetchBlob={() => api.exportRoom(session.token, roomId, 'xlsx')} filename={`bao-cao-thi-dau-${roomId}.xlsx`} />
              <DownloadButton title="Xuất PDF" fetchBlob={() => api.exportRoom(session.token, roomId, 'pdf')} filename={`bao-cao-thi-dau-${roomId}.pdf`} />
            </>} />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <StatusChip kind={r.room.state === 'ended' ? 'muted' : 'on'} text={LIVE_STATE_TEXT[r.room.state]} />
            <StatusChip kind="info" text={`${r.summary.players} học sinh`} />
            <StatusChip kind="info" text={`Điểm trung bình ${r.summary.avg_score}`} />
            <StatusChip kind="info" text={`Tham gia trả lời ${r.summary.participation_rate}%`} />
            <StatusChip kind="muted" text={`${r.room.played}/${r.room.total} câu đã diễn ra${r.room.ended_early ? ' (kết thúc sớm)' : ''}`} />
            {r.summary.skipped ? <StatusChip kind="warn" text={`${r.summary.skipped} câu bị bỏ qua`} /> : null}
          </View>
          {r.boss ? <InfoNote>Đánh trùm {r.boss.name}: {r.boss.outcome === 'win' ? 'cả lớp đã hạ được trùm' : 'cả lớp chưa hạ được trùm'} (trùm còn {r.boss.hp ?? 0}/{r.boss.max_hp ?? 0} máu, cả lớp còn {r.boss.class_hp ?? 0}/{r.boss.class_max_hp ?? 0} máu).</InfoNote> : null}
          {r.removed.length ? <InfoNote>Đã loại khỏi phòng: {r.removed.map((x) => `${x.full_name} (${x.nickname})`).join(', ')}.</InfoNote> : null}
          {r.hardest ? <InfoNote>Câu khó nhất: câu {r.hardest.number} (chỉ {r.hardest.correct_rate}% trả lời đúng) – {r.hardest.prompt}</InfoNote> : null}

          <Txt f="bold" size={16}>Kết quả từng học sinh</Txt>
          <DataTable rows={r.players} rowKey={(p) => `${p.rank}-${p.nickname}`} empty="Chưa có học sinh nào tham gia"
            columns={[
              { key: 'rank', label: 'Hạng', flex: 0.5, render: (p) => <Txt f="bold" size={14}>{p.rank}</Txt> },
              { key: 'name', label: 'Học sinh', flex: 2.2, render: (p) => <Cell main={p.full_name} sub={[p.user_code, `biệt danh ${p.nickname}`, p.team_name].filter(Boolean).join(' · ')} /> },
              { key: 'score', label: 'Điểm', flex: 0.8, render: (p) => <Txt f="bold" size={14}>{p.score}</Txt> },
              { key: 'ok', label: 'Đúng / đã trả lời', flex: 1.4, render: (p) => <Txt size={13}>{p.correct_count}/{p.answered_count} · {p.accuracy}% số câu đã thi</Txt> },
              { key: 'time', label: 'Thời gian TB', flex: 1, hideOnCard: true, render: (p) => <Txt size={13}>{p.avg_seconds === null ? '—' : `${p.avg_seconds} giây`}</Txt> },
              { key: 'tabs', label: 'Chuyển tab', flex: 0.8, hideOnCard: true, render: (p) => <Txt size={13}>{p.tab_switches ? `${p.tab_switches} lần` : '—'}</Txt> },
              { key: 'xp', label: 'Điểm tài khoản', flex: 1, hideOnCard: true, render: (p) => <Txt size={13}>{p.xp_awarded ? `+${p.xp_awarded}` : '—'}</Txt> },
            ]} />

          <Txt f="bold" size={16}>Tỉ lệ đúng từng câu</Txt>
          <View style={{ gap: 12 }}>
            {r.questions.map((x) => (
              <Card key={x.index} flat pad={12} style={{ gap: 6, borderColor: r.hardest?.number === x.number ? c.vang : c.vien }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Txt f="bold" size={14}>Câu {x.number}</Txt>
                  <StatusChip kind="muted" text={QTYPE_TEXT[x.qtype]} />
                  {x.skipped ? <StatusChip kind="warn" text="Bị bỏ qua" /> : null}
                  {r.hardest?.number === x.number ? <StatusChip kind="off" text="Khó nhất" /> : null}
                </View>
                <Txt size={14}>{x.prompt}</Txt>
                {x.skipped ? null : (
                  <>
                    <Bar value={x.correct_rate ?? 0} max={100} height={10} label={`Câu ${x.number}: ${x.correct_rate ?? 0}% đúng`} fill={(x.correct_rate ?? 0) >= 60 ? c.ngoc : c.son} />
                    <Txt size={12} color={c.muc3}>{x.correct} đúng · {x.wrong} sai · {x.none} chưa trả lời{x.avg_seconds !== null ? ` · trung bình ${x.avg_seconds} giây` : ''}</Txt>
                  </>
                )}
              </Card>
            ))}
          </View>

          {r.teams ? (
            <>
              <Txt f="bold" size={16}>Xếp hạng đội (điểm trung bình của thành viên)</Txt>
              <DataTable rows={r.teams} rowKey={(t) => t.team_id} empty="" columns={[
                { key: 'rank', label: 'Hạng', flex: 0.5, render: (t) => <Txt f="bold" size={14}>{t.rank}</Txt> },
                { key: 'name', label: 'Đội', flex: 2, render: (t) => <Cell main={t.name} sub={`${t.members} thành viên`} /> },
                { key: 'score', label: 'Điểm đội', flex: 1, render: (t) => <Txt f="bold" size={14}>{t.score}</Txt> },
                { key: 'total', label: 'Tổng điểm', flex: 1, render: (t) => <Txt size={13}>{t.total}</Txt> },
              ]} />
            </>
          ) : null}
        </>
      ) : null}
    </Page>
  );
};

/** Tạo phòng thi đấu; có thể mở sẵn với một bộ đề (từ trình soạn Quiz: "Tổ chức thi đấu") */
export const CreateRoom: React.FC<{ session: Session; quizId?: number; onClose: () => void; onCreated: (id: number) => void }> = ({ session, quizId, onClose, onCreated }) => {
  const classes = useLoad(() => classroom.teacherClasses(session.token), [session.token], session.expired);
  const quizzes = useLoad(() => learning.listQuizzes(session.token, { limit: 100 }), [session.token], session.expired);
  const bosses = useLoad(() => api.bosses(session.token), [session.token], session.expired);
  const yesNo = (yes: string, no: string) => [{ value: 'yes', label: yes }, { value: 'no', label: no }];
  return (
    <FormSheet title="Tạo phòng thi đấu" subtitle="Hệ thống sinh mã PIN 6 số và mã QR; học sinh của lớp vào bằng mã." wide submitLabel="Tạo phòng"
      fields={[
        { name: 'class_id', label: 'Lớp', type: 'select', required: true, options: [{ value: '', label: '— Chọn lớp —' }, ...(classes.data ?? []).filter((k) => k.is_active).map((k) => ({ value: String(k.id), label: `${k.name} · ${k.students} học sinh` }))] },
        { name: 'quiz_id', label: 'Bộ đề', type: 'select', required: true, options: [{ value: '', label: '— Chọn bộ đề —' }, ...(quizzes.data?.items ?? []).filter((z) => z.question_count > 0).map((z) => ({ value: String(z.id), label: `${z.title} (${z.question_count} câu, ${Math.ceil(z.total_seconds / 60)} phút)` }))] },
        { name: 'mode', label: 'Chế độ', type: 'select', options: [{ value: 'solo', label: 'Cá nhân – mỗi học sinh một bảng điểm' }, { value: 'team', label: 'Theo đội – điểm đội là trung bình thành viên (lớp cần đã chia đội)' }, { value: 'boss', label: 'Đánh trùm cả lớp – cả lớp cùng hạ một chỉ huy giặc' }] },
        { name: 'boss', label: 'Trùm', type: 'select', required: true, when: (v) => v.mode === 'boss', hint: 'Máu trùm tự tính theo sĩ số lúc bắt đầu; câu đúng gây sát thương theo tốc độ, câu sai làm cả lớp mất máu.',
          options: [{ value: '', label: '— Chọn trùm —' }, ...(bosses.data ?? []).map((b) => ({ value: b.key, label: b.name }))] },
        { name: 'title', label: 'Tên phòng (không bắt buộc)', hint: 'Để trống sẽ lấy tên bộ đề và tên lớp' },
        { name: 'auto_lock', label: 'Khóa phòng', type: 'select', hint: 'Phòng khóa thì mã PIN không nhận thêm người mới; học sinh đến muộn phải xin giáo viên duyệt.',
          options: [{ value: 'start', label: 'Tự khóa ngay khi bấm Bắt đầu (khuyên dùng)' }, { value: '30', label: 'Tự khóa sau 30 giây kể từ lúc bắt đầu' }, { value: '60', label: 'Tự khóa sau 60 giây kể từ lúc bắt đầu' }, { value: 'off', label: 'Không tự khóa (khóa tay khi cần)' }] },
        { name: 'profile_names', label: 'Tên hiển thị', type: 'select', options: yesNo('Lấy theo hồ sơ học sinh (khuyên dùng)', 'Học sinh tự đặt biệt danh') },
        { name: 'hide_on_device', label: 'Câu hỏi trên thiết bị học sinh', type: 'select', hint: 'Chống tra cứu: thiết bị chỉ có nút hình – màu, nội dung hiện trên màn chiếu. Chọn hiện đầy đủ khi học từ xa.', options: yesNo('Ẩn nội dung, chỉ hiện nút hình – màu (khuyên dùng)', 'Hiện đầy đủ nội dung') },
        { name: 'shuffle_device', label: 'Xáo thứ tự đáp án theo thiết bị', type: 'select', options: yesNo('Có (khi hiện đầy đủ nội dung)', 'Không') },
        { name: 'tab_alert', label: 'Cảnh báo chuyển tab', type: 'select', options: yesNo('Có – báo tên học sinh rời tab khi đang trả lời', 'Không') },
      ]}
      initial={{ class_id: '', quiz_id: quizId ? String(quizId) : '', mode: 'solo', boss: '', title: '', auto_lock: 'start', profile_names: 'yes', hide_on_device: 'yes', shuffle_device: 'yes', tab_alert: 'yes' }} onClose={onClose}
      onSubmit={async (v) => {
        const mode = v.mode === 'team' ? 'team' : v.mode === 'boss' ? 'boss' : 'solo';
        const room = await api.createRoom(session.token, {
          class_id: Number(v.class_id), quiz_id: Number(v.quiz_id), mode, title: String(v.title).trim() || undefined, ...(mode === 'boss' ? { boss: String(v.boss) } : {}),
          auto_lock_seconds: v.auto_lock === 'off' ? null : v.auto_lock === 'start' ? 0 : Number(v.auto_lock),
          profile_names: v.profile_names !== 'no', hide_on_device: v.hide_on_device !== 'no', shuffle_device: v.shuffle_device !== 'no', tab_alert: v.tab_alert !== 'no',
        });
        onCreated(room.room.id);
      }} />
  );
};

type Screen = { kind: 'list' } | { kind: 'host'; id: number } | { kind: 'report'; id: number };

export const LiveManager: React.FC<{ session: Session; startQuizId?: number | null; onStarted?: () => void }> = ({ session, startQuizId, onStarted }) => {
  const rooms = useLoad(() => api.listRooms(session.token), [session.token], session.expired);
  const [screen, setScreen] = useState<Screen>({ kind: 'list' });
  const [creating, setCreating] = useState(Boolean(startQuizId));
  const back = () => { setScreen({ kind: 'list' }); rooms.reload(); };
  if (screen.kind === 'host') return <LiveHost session={session} roomId={screen.id} onBack={back} onReport={(id) => setScreen({ kind: 'report', id })} />;
  if (screen.kind === 'report') return <Report session={session} roomId={screen.id} onBack={back} />;
  return (
    <Page>
      <PageHeader title="Thi đấu trực tiếp" subtitle="Tổ chức thi kiểu Kahoot cho cả lớp: chọn bộ đề, chiếu mã PIN, học sinh vào bằng điện thoại hoặc máy tính; xem báo cáo sau trận."
        actions={<Btn icon={Plus} title="Tạo phòng thi" tone="son" size="sm" onPress={() => setCreating(true)} testID="live-create" />} />
      <ErrorNote message={rooms.error} />
      {rooms.loading && !rooms.data ? <Spinner /> : null}
      {rooms.data && !rooms.data.length ? <EmptyState mood="thinking" title="Chưa có phòng thi nào" text="Bấm “Tạo phòng thi”, chọn lớp và bộ đề. Khi phòng sẵn sàng, mở màn hình điều khiển và chiếu mã PIN lên lớp." /> : null}
      {rooms.data?.length ? (
        <DataTable<LiveRoomRow> rows={rooms.data} rowKey={(r) => r.id} empty="" onRowPress={(r) => setScreen(r.state === 'ended' ? { kind: 'report', id: r.id } : { kind: 'host', id: r.id })}
          columns={[
            { key: 'title', label: 'Phòng thi', flex: 3, render: (r) => <Cell main={r.title} sub={`Lớp ${r.class_name} · ${r.mode === 'team' ? 'theo đội' : r.mode === 'boss' ? 'đánh trùm' : 'cá nhân'}${r.locked ? ' · đã khóa' : ''}`} /> },
            { key: 'state', label: 'Trạng thái', flex: 1.4, render: (r) => <StatusChip kind={r.state === 'ended' ? 'muted' : r.state === 'lobby' ? 'warn' : 'on'} text={r.state === 'ended' && r.ended_early ? 'Kết thúc sớm' : LIVE_STATE_TEXT[r.state]} /> },
            { key: 'pin', label: 'Mã PIN', flex: 1, render: (r) => <Txt f="bold" size={15} style={{ letterSpacing: 2 }}>{r.pin ?? '—'}</Txt> },
            { key: 'players', label: 'Người chơi', flex: 1, render: (r) => <Txt size={13}>{r.players} · điểm TB {r.avg_score}</Txt> },
            { key: 'time', label: 'Tạo lúc', flex: 1.5, hideOnCard: true, render: (r) => <Txt size={13}>{when(r.created_at)}</Txt> },
          ]}
          actions={(r) => (r.state === 'ended'
            ? <Btn title="Báo cáo" tone="giay" size="sm" onPress={() => setScreen({ kind: 'report', id: r.id })} />
            : <Btn icon={Play} title="Mở phòng" tone="ngoc" size="sm" onPress={() => setScreen({ kind: 'host', id: r.id })} testID={`live-open-${r.id}`} />)} />
      ) : null}
      {creating ? <CreateRoom session={session} quizId={startQuizId ?? undefined} onClose={() => { setCreating(false); onStarted?.(); }} onCreated={(id) => { setCreating(false); onStarted?.(); rooms.reload(); setScreen({ kind: 'host', id }); }} /> : null}
    </Page>
  );
};
