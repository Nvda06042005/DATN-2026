/**
 * Thi đấu trực tiếp của giáo viên (Sprint 8, HK.GV.051, 056–058): danh sách phòng thi đã tổ chức (lịch sử theo lớp), tạo phòng từ bộ đề với chế độ cá nhân hoặc theo đội
 * (hệ thống sinh mã PIN; từ 16/11/2026 không còn mã QR, tạo phòng ở trang riêng), mở màn hình điều khiển để chiếu lên lớp, và báo cáo trận: điểm từng học sinh, tỉ lệ đúng từng câu, câu khó nhất, bảng xếp hạng đội, xuất Excel/PDF.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { ArrowLeft, Play, Plus } from 'lucide-react-native';
import * as classroom from '@/api/classroomApi';
import * as api from '@/api/liveApi';
import * as learning from '@/api/learningApi';
import { Cell, DataTable, DownloadButton, ErrorNote, Page, PageHeader, StatusChip, useLoad } from '@/components/admin/kit';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { QuestionPicker } from '@/components/admin/ContentKit';
import { errorMessage } from '@/api/client';
import { LiveHost } from '@/components/admin/LiveHost';
import type { Session } from '@/components/auth';
import { Bar, Btn, Card, EmptyState, Field, InfoNote, Segmented, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { LIVE_MODE_TEXT, LIVE_STATE_TEXT, type LiveReport, type LiveRoomRow } from '@/types/live';
import { QTYPE_TEXT, type QuestionItem } from '@/types/learning';

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
                {x.skipped ? null : x.poll ? (
                  <Txt size={13} color={c.muc2}>Bình chọn (không có đáp án đúng): {x.votes ? x.votes.map((v) => `${v.text} ${v.count}`).join(' · ') : `${x.answered} lượt chọn`} · {x.none} chưa chọn</Txt>
                ) : (
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

/**
 * Trang tạo phòng thi đấu (16/11/2026: thay hộp thoại cũ bằng trang riêng). Giữ các trường Lớp, Tên phòng (để trống thì tự đặt; hệ thống tự sinh mã PIN)
 * và các tùy chọn khóa phòng, tên hiển thị, câu hỏi trên thiết bị, xáo đáp án, cảnh báo chuyển tab. Câu hỏi lấy từ **ngân hàng câu hỏi** (chọn từng câu,
 * hệ thống gộp thành bộ đề của phòng) hoặc một **bộ đề trong thư viện học liệu** (của tôi, của trường, hệ thống). Tạo xong mở phòng chờ chỉ hiện mã PIN.
 */
const yesNo = (yes: string, no: string) => [{ value: 'yes', label: yes }, { value: 'no', label: no }];
const LIVE_QTYPES = ['single', 'multiple', 'truefalse', 'poll'];

const CreateRoomPage: React.FC<{ session: Session; quizId?: number; onBack: () => void; onCreated: (id: number) => void }> = ({ session, quizId, onBack, onCreated }) => {
  const { c } = useTheme();
  const classes = useLoad(() => classroom.teacherClasses(session.token), [session.token], session.expired);
  const quizzes = useLoad(() => learning.listQuizzes(session.token, { limit: 100 }), [session.token], session.expired);
  const [classId, setClassId] = useState('');
  const [title, setTitle] = useState('');
  const [source, setSource] = useState<'bank' | 'library'>(quizId ? 'library' : 'bank');
  const [quiz, setQuiz] = useState(quizId ? String(quizId) : '');
  const [picked, setPicked] = useState<QuestionItem[]>([]);
  const [picking, setPicking] = useState(false);
  const [opt, setOpt] = useState({ auto_lock: 'start', profile_names: 'yes', hide_on_device: 'yes', shuffle_device: 'yes', tab_alert: 'yes' });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const active = (classes.data ?? []).filter((k) => k.is_active);
  const cls = active.find((k) => String(k.id) === classId);
  const today = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
  const autoTitle = cls ? `Phòng thi lớp ${cls.name} · ${today}` : 'Phòng thi';
  const usable = picked.filter((q) => LIVE_QTYPES.includes(q.qtype));
  const create = async (): Promise<void> => {
    setProblem(null);
    if (!cls) { setProblem('Hãy chọn lớp.'); return; }
    if (source === 'bank' && !usable.length) { setProblem('Hãy chọn ít nhất một câu hỏi một đáp án, nhiều đáp án, đúng / sai hoặc bình chọn từ ngân hàng câu hỏi.'); return; }
    if (source === 'library' && !quiz) { setProblem('Hãy chọn một bộ đề trong thư viện học liệu.'); return; }
    setBusy(true);
    try {
      const name = title.trim() || autoTitle;
      const quizIdToUse = source === 'library' ? Number(quiz) : (await learning.createQuiz(session.token, { title: name, items: usable.map((q) => ({ question_id: q.id })) })).id;
      const room = await api.createRoom(session.token, {
        class_id: cls.id, quiz_id: quizIdToUse, mode: 'solo', title: name,
        auto_lock_seconds: opt.auto_lock === 'off' ? null : opt.auto_lock === 'start' ? 0 : Number(opt.auto_lock),
        profile_names: opt.profile_names !== 'no', hide_on_device: opt.hide_on_device !== 'no', shuffle_device: opt.shuffle_device !== 'no', tab_alert: opt.tab_alert !== 'no',
      });
      onCreated(room.room.id);
    } catch (e) { setProblem(errorMessage(e)); } finally { setBusy(false); }
  };
  const set = (k: keyof typeof opt) => (v: string) => setOpt((o) => ({ ...o, [k]: v }));
  return (
    <Page>
      <Btn icon={ArrowLeft} title="Danh sách phòng thi" tone="ghost" size="sm" onPress={onBack} testID="live-create-back" style={{ marginLeft: -10 }} />
      <PageHeader title="Tạo phòng thi đấu" subtitle="Chọn lớp và câu hỏi; hệ thống tự sinh mã PIN 6 số để học sinh của lớp vào phòng."
        actions={<Btn icon={Play} title="Tạo phòng" tone="son" size="sm" loading={busy} onPress={() => { void create(); }} testID="live-create-submit" />} />
      <Card flat pad={16} style={{ gap: 14, borderRadius: 12 }} testID="live-create-page">
        <Txt f="bold" size={15} accessibilityRole="header">Thông tin phòng</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <View style={{ flexGrow: 1, flexBasis: 260 }}>
            <AdminSelect label="Lớp *" value={classId} onChange={setClassId} testID="live-create-class"
              options={[{ value: '', label: '— Chọn lớp —' }, ...active.map((k) => ({ value: String(k.id), label: `${k.name} · ${k.students} học sinh` }))]} />
          </View>
          <View style={{ flexGrow: 1, flexBasis: 260 }}>
            <Field label="Tên phòng" value={title} onChangeText={setTitle} placeholder={autoTitle} hint="Để trống sẽ tự đặt theo lớp và ngày; mã PIN của phòng do hệ thống tự sinh." testID="live-create-title" />
          </View>
        </View>
      </Card>
      <Card flat pad={16} style={{ gap: 14, borderRadius: 12 }}>
        <Txt f="bold" size={15} accessibilityRole="header">Câu hỏi</Txt>
        <Segmented<'bank' | 'library'> label="Nguồn câu hỏi" value={source} onChange={setSource}
          options={[{ value: 'bank', label: 'Chọn từ ngân hàng câu hỏi' }, { value: 'library', label: 'Bộ đề trong thư viện học liệu' }]} />
        {source === 'bank' ? (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <Btn icon={Plus} title="Chọn câu hỏi" tone="giay" size="sm" onPress={() => setPicking(true)} testID="live-create-pick" />
              <Txt size={13} color={c.muc2}>{usable.length ? `${usable.length} câu đã chọn` : 'Chưa chọn câu nào'}{picked.length > usable.length ? ` · ${picked.length - usable.length} câu không dùng được trong thi đấu (chỉ nhận một đáp án, nhiều đáp án, đúng / sai, bình chọn)` : ''}</Txt>
            </View>
            {picked.length ? (
              <DataTable<QuestionItem> rows={picked} rowKey={(q) => q.id} paginate={false} empty=""
                columns={[
                  { key: 'n', label: 'STT', width: 56, render: (q) => <Txt f="bold" size={13}>{picked.indexOf(q) + 1}</Txt> },
                  { key: 'prompt', label: 'Câu hỏi', width: 380, grow: 2, render: (q) => <Cell main={q.prompt} sub={QTYPE_TEXT[q.qtype]} /> },
                  { key: 'ok', label: 'Dùng được', width: 120, render: (q) => <StatusChip kind={LIVE_QTYPES.includes(q.qtype) ? 'on' : 'off'} text={LIVE_QTYPES.includes(q.qtype) ? 'Có' : 'Không'} /> },
                ]}
                actions={(q) => <Btn title="Bỏ" tone="giay" size="sm" onPress={() => setPicked((list) => list.filter((x) => x.id !== q.id))} />} actionsWidth={90} />
            ) : null}
          </View>
        ) : (
          <AdminSelect label="Bộ đề *" value={quiz} onChange={setQuiz} testID="live-create-quiz"
            options={[{ value: '', label: '— Chọn bộ đề —' }, ...(quizzes.data?.items ?? []).filter((z) => z.question_count > 0).map((z) => ({ value: String(z.id), label: `${z.title} (${z.question_count} câu, ${Math.ceil(z.total_seconds / 60)} phút)` }))]} />
        )}
      </Card>
      <Card flat pad={16} style={{ gap: 14, borderRadius: 12 }}>
        <Txt f="bold" size={15} accessibilityRole="header">Tùy chọn phòng</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <View style={{ flexGrow: 1, flexBasis: 300 }}>
            <AdminSelect label="Khóa phòng" value={opt.auto_lock} onChange={set('auto_lock')}
              options={[{ value: 'start', label: 'Tự khóa ngay khi bấm Bắt đầu (khuyên dùng)' }, { value: '30', label: 'Tự khóa sau 30 giây kể từ lúc bắt đầu' }, { value: '60', label: 'Tự khóa sau 60 giây kể từ lúc bắt đầu' }, { value: 'off', label: 'Không tự khóa (khóa tay khi cần)' }]} />
          </View>
          <View style={{ flexGrow: 1, flexBasis: 300 }}>
            <AdminSelect label="Tên hiển thị" value={opt.profile_names} onChange={set('profile_names')} options={yesNo('Lấy theo hồ sơ học sinh (khuyên dùng)', 'Học sinh tự đặt biệt danh')} />
          </View>
          <View style={{ flexGrow: 1, flexBasis: 300 }}>
            <AdminSelect label="Câu hỏi trên thiết bị học sinh" value={opt.hide_on_device} onChange={set('hide_on_device')} options={yesNo('Ẩn nội dung, chỉ hiện nút hình – màu (khuyên dùng)', 'Hiện đầy đủ nội dung (học từ xa)')} />
          </View>
          <View style={{ flexGrow: 1, flexBasis: 300 }}>
            <AdminSelect label="Xáo thứ tự đáp án theo thiết bị" value={opt.shuffle_device} onChange={set('shuffle_device')} options={yesNo('Có (khi hiện đầy đủ nội dung)', 'Không')} />
          </View>
          <View style={{ flexGrow: 1, flexBasis: 300 }}>
            <AdminSelect label="Cảnh báo chuyển tab" value={opt.tab_alert} onChange={set('tab_alert')} options={yesNo('Có – báo tên học sinh rời tab khi đang trả lời', 'Không')} />
          </View>
        </View>
      </Card>
      <ErrorNote message={problem} />
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
        <Btn title="Hủy" tone="giay" onPress={onBack} />
        <Btn icon={Play} title="Tạo phòng" tone="son" loading={busy} onPress={() => { void create(); }} />
      </View>
      {picking ? <QuestionPicker session={session} title="Chọn câu hỏi cho phòng thi" exclude={picked.map((q) => q.id)} onClose={() => setPicking(false)} onPick={(items) => { setPicked((list) => [...list, ...items]); setPicking(false); }} /> : null}
    </Page>
  );
};

type Screen = { kind: 'list' } | { kind: 'create' } | { kind: 'host'; id: number } | { kind: 'report'; id: number };

export const LiveManager: React.FC<{ session: Session; startQuizId?: number | null; onStarted?: () => void }> = ({ session, startQuizId, onStarted }) => {
  const rooms = useLoad(() => api.listRooms(session.token), [session.token], session.expired);
  const [screen, setScreen] = useState<Screen>(startQuizId ? { kind: 'create' } : { kind: 'list' });
  const back = () => { setScreen({ kind: 'list' }); rooms.reload(); };
  if (screen.kind === 'host') return <LiveHost session={session} roomId={screen.id} onBack={back} onReport={(id) => setScreen({ kind: 'report', id })} />;
  if (screen.kind === 'report') return <Report session={session} roomId={screen.id} onBack={back} />;
  if (screen.kind === 'create') return <CreateRoomPage session={session} quizId={startQuizId ?? undefined} onBack={() => { onStarted?.(); back(); }} onCreated={(id) => { onStarted?.(); rooms.reload(); setScreen({ kind: 'host', id }); }} />;
  return (
    <Page>
      <PageHeader title="Thi đấu trực tiếp" subtitle="Tổ chức thi kiểu Kahoot cho cả lớp: chọn câu hỏi từ ngân hàng câu hỏi hoặc thư viện học liệu, chiếu mã PIN, học sinh vào bằng điện thoại hoặc máy tính; xem báo cáo sau trận."
        actions={<Btn icon={Plus} title="Tạo phòng thi" tone="son" size="sm" onPress={() => setScreen({ kind: 'create' })} testID="live-create" />} />
      <ErrorNote message={rooms.error} />
      {rooms.loading && !rooms.data ? <Spinner /> : null}
      {rooms.data && !rooms.data.length ? <EmptyState mood="thinking" title="Chưa có phòng thi nào" text="Bấm “Tạo phòng thi”, chọn lớp và câu hỏi. Khi phòng sẵn sàng, mở màn hình điều khiển và chiếu mã PIN lên lớp." /> : null}
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
    </Page>
  );
};
