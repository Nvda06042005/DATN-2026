/**
 * Thư viện học liệu – phần làm cùng máy chủ (16/11/2026):
 * - "Giáo viên khác": bộ đề trong kho chung của trường do giáo viên khác cùng trường soạn (đã được duyệt vào kho trường), xem trước, tổ chức thi đấu.
 * - "Đề kiểm tra": giáo viên gửi đề giữa kỳ / cuối kỳ cho quản trị trường duyệt; đề được duyệt thì "Tổ chức thi" (mật khẩu, giờ mở, giờ đóng),
 *   hệ thống tạo bài thi cho lớp và báo học sinh; học sinh nhập mật khẩu giáo viên cung cấp để làm (migration 068).
 * - Quản trị trường duyệt đề ở mục Duyệt nội dung (`ExamReview`); học sinh làm bài ở mục Kỳ thi (`StudentExams`).
 */
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Check, ClipboardCheck, Eye, KeyRound, Play, Plus, RefreshCw, Send, Undo2, X } from 'lucide-react-native';
import * as classroom from '@/api/classroomApi';
import * as learning from '@/api/learningApi';
import { errorMessage } from '@/api/client';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { dateText } from '@/components/admin/AccountSheet';
import { Cell, DataTable, ErrorNote, Page, PageHeader, SearchFilterBar, StatusChip, useAction, useLoad, type SearchFilter } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { QuizPlayer } from '@/components/portal/QuizPlayer';
import { Btn, Card, EmptyState, Field, InfoNote, Segmented, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { ExamItem, MyAssignment } from '@/types/classroom';
import type { AttemptState, QuizItem } from '@/types/learning';

const STATUS: Record<ExamItem['status'], { kind: 'warn' | 'on' | 'off' | 'info'; text: string }> = {
  pending: { kind: 'warn', text: 'Chờ duyệt' }, approved: { kind: 'on', text: 'Đã duyệt' }, rejected: { kind: 'off', text: 'Bị từ chối' }, scheduled: { kind: 'info', text: 'Đã tổ chức thi' },
};
const at = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
/** "dd/mm/yyyy" + "HH:mm" (giờ Việt Nam) → ISO; sai định dạng trả null */
const toIso = (day: string, time: string): string | null => {
  const d = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(day.trim()), t = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!d || !t) return null;
  const ms = Date.UTC(Number(d[3]), Number(d[2]) - 1, Number(d[1]), Number(t[1]) - 7, Number(t[2]));
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
};
const vnNow = () => new Date(Date.now() + 7 * 3_600_000);
const pad = (n: number) => String(n).padStart(2, '0');
const randomPassword = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('');

/** Xem trước bộ đề bằng khung làm bài (lượt làm thử không tính điểm) */
const PreviewSheet: React.FC<{ session: Session; quiz: { id: number; title: string }; onClose: () => void }> = ({ session, quiz, onClose }) => {
  const attempt = useLoad<AttemptState>(() => learning.previewQuiz(session.token, quiz.id), [session.token, quiz.id], session.expired);
  return (
    <Sheet open onClose={onClose} title={`Xem trước: ${quiz.title}`} subtitle="Làm thử, không tính điểm" wide>
      <ErrorNote message={attempt.error} />
      {attempt.loading && !attempt.data ? <Spinner /> : null}
      {attempt.data ? <QuizPlayer session={session} initial={attempt.data} title={quiz.title} onClose={onClose} /> : null}
    </Sheet>
  );
};

// ---------------------------------------------------------------------- Giáo viên khác
export const OtherTeachersLibrary: React.FC<{ session: Session; onStartLiveQuiz?: (quizId: number) => void }> = ({ session, onStartLiveQuiz }) => {
  const { c } = useTheme();
  const list = useLoad(() => learning.listQuizzes(session.token, { store: 'school', limit: 100 }), [session.token], session.expired);
  const [teacher, setTeacher] = useState('');
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState<QuizItem | null>(null);
  const others = (list.data?.items ?? []).filter((z) => (z as QuizItem & { owner_id?: number | null }).owner_id !== session.user.id && z.owner_name);
  const teachers = [...new Set(others.map((z) => z.owner_name!))].sort((a, b) => a.localeCompare(b, 'vi'));
  const term = q.trim().toLowerCase();
  const rows = others.filter((z) => (!teacher || z.owner_name === teacher) && (!term || `${z.title} ${z.owner_name} ${z.campaign_title ?? ''}`.toLowerCase().includes(term)));
  const f_teacher: SearchFilter = { key: 'teacher', label: 'Giáo viên', value: teacher, options: [{ value: '', label: 'Mọi giáo viên' }, ...teachers.map((t) => ({ value: t, label: t }))], onChange: setTeacher };
  return (
    <Card style={{ padding: 16, borderRadius: 18, gap: 12 }} testID="library-others">
      <View style={{ gap: 4 }}>
        <Txt f="bold" size={18} accessibilityRole="header">Giáo viên khác</Txt>
        <Txt size={13} color={c.muc2}>Bộ đề của các thầy cô cùng trường đã được duyệt vào kho chung của trường. Xem trước, tổ chức thi đấu hoặc dùng làm đề kiểm tra.</Txt>
      </View>
      <SearchFilterBar placeholder="Tìm theo tên đề, giáo viên, chủ đề" value={q} onChange={setQ} searchId="library-others-search" filters={[f_teacher]} />
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data ? (
        <DataTable<QuizItem> rows={rows} rowKey={(z) => z.id} empty={others.length ? 'Không có đề nào khớp bộ lọc' : 'Chưa có giáo viên nào trong trường chia sẻ bộ đề vào kho chung.'}
          columns={[
            { key: 'title', label: 'Bộ đề', width: 260, grow: 2, render: (z) => <Cell main={z.title} sub={z.campaign_title ?? undefined} /> },
            { key: 'teacher', label: 'Giáo viên', width: 180, filter: f_teacher, render: (z) => <Txt size={13}>{z.owner_name}</Txt> },
            { key: 'n', label: 'Số câu', width: 80, render: (z) => <Txt size={13}>{z.question_count}</Txt> },
            { key: 'time', label: 'Cập nhật', width: 110, hideOnCard: true, render: (z) => <Txt size={13}>{dateText(z.updated_at)}</Txt> },
          ]}
          actions={(z) => (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Btn icon={Eye} label={`Xem trước ${z.title}`} title="Xem" tone="giay" size="sm" onPress={() => setPreview(z)} disabled={!z.question_count} />
              {onStartLiveQuiz ? <Btn icon={Play} label={`Tổ chức thi đấu với ${z.title}`} title="Thi đấu" tone="giay" size="sm" onPress={() => onStartLiveQuiz(z.id)} disabled={!z.question_count} /> : null}
            </View>
          )} actionsWidth={190} />
      ) : null}
      {preview ? <PreviewSheet session={session} quiz={preview} onClose={() => setPreview(null)} /> : null}
    </Card>
  );
};

// ---------------------------------------------------------------------- giáo viên: đề kiểm tra
const RequestSheet: React.FC<{ session: Session; onClose: () => void; onDone: () => void }> = ({ session, onClose, onDone }) => {
  const classes = useLoad(() => classroom.teacherClasses(session.token), [session.token], session.expired);
  const quizzes = useLoad(() => learning.listQuizzes(session.token, { limit: 100 }), [session.token], session.expired);
  const [classId, setClassId] = useState('');
  const [kind, setKind] = useState<'midterm' | 'final'>('midterm');
  const [quizId, setQuizId] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const { busy, run } = useAction(session.expired);
  const active = (classes.data ?? []).filter((k) => k.is_active);
  const cls = active.find((k) => String(k.id) === classId);
  const auto = `${kind === 'midterm' ? 'Kiểm tra giữa kỳ' : 'Kiểm tra cuối kỳ'} môn Lịch sử${cls ? ` lớp ${cls.name}` : ''}`;
  const send = async () => {
    setProblem(null);
    if (!cls) { setProblem('Hãy chọn lớp.'); return; }
    if (!quizId) { setProblem('Hãy chọn bộ đề trong thư viện.'); return; }
    const ok = await run(() => classroom.requestExam(session.token, { class_id: cls.id, quiz_id: Number(quizId), kind, title: title.trim() || auto, note: note.trim() || undefined }), 'Đã gửi đề kiểm tra cho quản trị trường duyệt');
    if (ok) { onDone(); onClose(); }
  };
  return (
    <Sheet open onClose={onClose} title="Gửi đề kiểm tra để duyệt" subtitle="Quản trị viên trường duyệt trước khi thầy cô tổ chức thi" icon={<Send size={20} color="#b91c1c" />} wide
      footer={<View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}><Btn title="Hủy" tone="giay" onPress={onClose} /><Btn icon={Send} title="Gửi duyệt" tone="son" loading={busy} onPress={() => { void send(); }} testID="exam-request-send" /></View>}>
      <View style={{ gap: 12 }} testID="exam-request-sheet">
        <Segmented<'midterm' | 'final'> label="Loại đề" value={kind} onChange={setKind} options={[{ value: 'midterm', label: 'Kiểm tra giữa kỳ' }, { value: 'final', label: 'Kiểm tra cuối kỳ' }]} />
        <AdminSelect label="Lớp *" value={classId} onChange={setClassId} testID="exam-request-class" options={[{ value: '', label: '— Chọn lớp —' }, ...active.map((k) => ({ value: String(k.id), label: `${k.name} · ${k.students} học sinh` }))]} />
        <AdminSelect label="Bộ đề trong thư viện *" value={quizId} onChange={setQuizId} testID="exam-request-quiz"
          options={[{ value: '', label: '— Chọn bộ đề —' }, ...(quizzes.data?.items ?? []).filter((z) => z.question_count > 0).map((z) => ({ value: String(z.id), label: `${z.title} (${z.question_count} câu${z.owner_name && z.owner_name !== session.user.full_name ? ` · ${z.owner_name}` : ''})` }))]} />
        <Field label="Tên đề kiểm tra" value={title} onChangeText={setTitle} placeholder={auto} maxLength={150} hint="Để trống sẽ tự đặt theo loại đề và lớp." />
        <Field label="Ghi chú cho Ban Giám hiệu" value={note} onChangeText={setNote} multiline numberOfLines={3} maxLength={1000} inputStyle={{ minHeight: 80, textAlignVertical: 'top' }} placeholder="Ví dụ: đề 20 câu, ma trận theo Công văn 7991, làm trong 45 phút." />
        <ErrorNote message={problem} />
      </View>
    </Sheet>
  );
};

const OrganizeSheet: React.FC<{ session: Session; exam: ExamItem; onClose: () => void; onDone: (password: string) => void }> = ({ session, exam, onClose, onDone }) => {
  const now = vnNow();
  const [password, setPassword] = useState(randomPassword());
  const [day, setDay] = useState(`${pad(now.getUTCDate())}/${pad(now.getUTCMonth() + 1)}/${now.getUTCFullYear()}`);
  const [open, setOpen] = useState(`${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`);
  const [close, setClose] = useState(`${pad((now.getUTCHours() + 1) % 24)}:${pad(now.getUTCMinutes())}`);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setProblem(null);
    const starts = toIso(day, open), ends = toIso(day, close);
    if (!starts || !ends) { setProblem('Ngày ghi dd/mm/yyyy, giờ ghi HH:mm (ví dụ 07:30).'); return; }
    setBusy(true);
    try { await classroom.organizeExam(session.token, exam.id, { password, starts_at: starts, ends_at: ends }); onDone(password); } catch (e) { setProblem(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={`Tổ chức thi: ${exam.title}`} subtitle={`Lớp ${exam.class_name} · ${exam.kind_label} học kỳ ${exam.semester}`} icon={<ClipboardCheck size={20} color="#b91c1c" />} wide
      footer={<View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}><Btn title="Hủy" tone="giay" onPress={onClose} /><Btn icon={Play} title="Tổ chức thi" tone="son" loading={busy} onPress={() => { void submit(); }} testID="exam-organize-submit" /></View>}>
      <View style={{ gap: 12 }} testID="exam-organize-sheet">
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label="Mật khẩu bài thi *" value={password} onChangeText={(v) => setPassword(v.replace(/\s/g, ''))} maxLength={32} style={{ flexGrow: 1, flexBasis: 220 }} hint="4–32 ký tự. Thầy cô đọc mật khẩu cho học sinh khi vào giờ thi." testID="exam-password" />
          <Btn icon={RefreshCw} title="Tạo mật khẩu khác" tone="giay" onPress={() => setPassword(randomPassword())} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Field label="Ngày thi *" value={day} onChangeText={setDay} placeholder="dd/mm/yyyy" style={{ flexGrow: 1, flexBasis: 160 }} />
          <Field label="Giờ mở *" value={open} onChangeText={setOpen} placeholder="07:30" style={{ flexGrow: 1, flexBasis: 120 }} />
          <Field label="Giờ đóng *" value={close} onChangeText={setClose} placeholder="08:15" style={{ flexGrow: 1, flexBasis: 120 }} />
        </View>
        <InfoNote>Hệ thống tạo bài thi cho cả lớp (mỗi em làm một lần) và báo học sinh. Mật khẩu chỉ hiện lại một lần sau khi tổ chức; hãy ghi lại.</InfoNote>
        <ErrorNote message={problem} />
      </View>
    </Sheet>
  );
};

export const ExamRequests: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const list = useLoad(() => classroom.listExams(session.token), [session.token], session.expired);
  const [creating, setCreating] = useState(false);
  const [organizing, setOrganizing] = useState<ExamItem | null>(null);
  const [shown, setShown] = useState<{ exam: ExamItem; password: string } | null>(null);
  const { busy, run } = useAction(session.expired);
  return (
    <Card style={{ padding: 16, borderRadius: 18, gap: 12 }} testID="library-exams">
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 240, gap: 4 }}>
          <Txt f="bold" size={18} accessibilityRole="header">Đề kiểm tra giữa kỳ / cuối kỳ</Txt>
          <Txt size={13} color={c.muc2}>Gửi đề cho quản trị trường duyệt; đề được duyệt thì bấm "Tổ chức thi" để đặt mật khẩu và giờ thi. Học sinh được báo và nhập mật khẩu để làm bài.</Txt>
        </View>
        <Btn icon={Plus} title="Gửi đề kiểm tra" tone="son" size="sm" onPress={() => setCreating(true)} testID="exam-request-open" />
      </View>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data ? (
        <DataTable<ExamItem> rows={list.data} rowKey={(e) => e.id} empty="Chưa gửi đề kiểm tra nào."
          columns={[
            { key: 'title', label: 'Đề kiểm tra', width: 260, grow: 2, render: (e) => <Cell main={e.title} sub={`Bộ đề: ${e.quiz_title ?? '—'} · ${e.question_count} câu`} /> },
            { key: 'class', label: 'Lớp', width: 90, render: (e) => <Txt size={13}>{e.class_name}</Txt> },
            { key: 'kind', label: 'Loại', width: 150, render: (e) => <Txt size={13}>{e.kind_label} · HK{e.semester}</Txt> },
            { key: 'status', label: 'Trạng thái', width: 140, render: (e) => <StatusChip kind={STATUS[e.status].kind} text={STATUS[e.status].text} /> },
            { key: 'when', label: 'Giờ thi / phản hồi', width: 220, grow: 1, render: (e) => <Txt size={12} color={e.status === 'rejected' ? c.sonChu : c.muc2}>{e.status === 'scheduled' ? `${at(e.starts_at)} – ${at(e.ends_at)}` : e.review_note ? `${e.reviewer_name ?? 'Quản trị trường'}: ${e.review_note}` : `Gửi ${dateText(e.created_at)}`}</Txt> },
          ]}
          actions={(e) => e.status === 'approved' ? <Btn icon={ClipboardCheck} title="Tổ chức thi" tone="son" size="sm" onPress={() => setOrganizing(e)} testID={`exam-organize-${e.id}`} />
            : e.status === 'pending' ? <Btn icon={Undo2} title="Rút lại" tone="giay" size="sm" disabled={busy} onPress={async () => { if (await run(() => classroom.cancelExam(session.token, e.id), 'Đã rút lại đề')) list.reload(); }} />
            : null} actionsWidth={150} />
      ) : null}
      {creating ? <RequestSheet session={session} onClose={() => setCreating(false)} onDone={list.reload} /> : null}
      {organizing ? <OrganizeSheet session={session} exam={organizing} onClose={() => setOrganizing(null)} onDone={(password) => { setShown({ exam: organizing, password }); setOrganizing(null); list.reload(); }} /> : null}
      {shown ? (
        <Sheet open onClose={() => setShown(null)} title="Đã tổ chức thi" subtitle={`${shown.exam.title} · lớp ${shown.exam.class_name}`} icon={<KeyRound size={20} color="#b91c1c" />}
          footer={<Btn title="Đã ghi lại mật khẩu" tone="son" onPress={() => setShown(null)} />}>
          <View style={{ gap: 10, alignItems: 'center' }} testID="exam-password-shown">
            <Txt size={14} color={c.muc2} center>Mật khẩu bài thi (đọc cho học sinh khi vào giờ thi; hệ thống không hiển thị lại):</Txt>
            <Txt f="heavy" size={34} selectable style={{ letterSpacing: 4 }}>{shown.password}</Txt>
            <Txt size={13} color={c.muc3} center>Học sinh đã được báo; bài thi nằm ở mục Kỳ thi của học sinh.</Txt>
          </View>
        </Sheet>
      ) : null}
    </Card>
  );
};

// ---------------------------------------------------------------------- quản trị trường: duyệt đề kiểm tra
export const ExamReview: React.FC<{ session: Session; switcher?: React.ReactNode }> = ({ session, switcher }) => {
  const { c } = useTheme();
  const list = useLoad(() => classroom.listExams(session.token), [session.token], session.expired);
  const [status, setStatus] = useState('pending');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<ExamItem | null>(null);
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [preview, setPreview] = useState<{ id: number; title: string } | null>(null);
  const { busy, run } = useAction(session.expired);
  const term = q.trim().toLowerCase();
  const rows = (list.data ?? []).filter((e) => (!status || e.status === status) && (!term || `${e.title} ${e.teacher_name ?? ''} ${e.class_name} ${e.quiz_title ?? ''}`.toLowerCase().includes(term)));
  const f_status: SearchFilter = { key: 'status', label: 'Trạng thái', value: status, options: [{ value: '', label: 'Tất cả' }, ...(Object.keys(STATUS) as Array<ExamItem['status']>).map((k) => ({ value: k, label: STATUS[k].text }))], onChange: setStatus };
  const decide = async (approve: boolean) => {
    if (!open) return;
    if (await run(() => classroom.reviewExam(session.token, open.id, approve, note.trim() || undefined), approve ? 'Đã duyệt đề kiểm tra' : 'Đã từ chối đề kiểm tra')) { setOpen(null); setNote(''); setRejecting(false); list.reload(); }
  };
  return (
    <Page>
      <PageHeader title="Duyệt nội dung" subtitle="Đề kiểm tra giữa kỳ / cuối kỳ giáo viên gửi. Duyệt xong, giáo viên mới tổ chức thi (đặt mật khẩu, giờ thi) cho lớp." />
      {switcher}
      <SearchFilterBar placeholder="Tìm theo tên đề, giáo viên, lớp" value={q} onChange={setQ} searchId="exam-review-search" filters={[f_status]} />
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data ? (
        <DataTable<ExamItem> rows={rows} rowKey={(e) => e.id} onRowPress={(e) => { setOpen(e); setNote(''); setRejecting(false); }} empty={status === 'pending' ? 'Không có đề kiểm tra nào chờ duyệt' : 'Chưa có đề kiểm tra nào'}
          columns={[
            { key: 'title', label: 'Đề kiểm tra', width: 260, grow: 2, render: (e) => <Cell main={e.title} sub={`Bộ đề: ${e.quiz_title ?? '—'} · ${e.question_count} câu`} /> },
            { key: 'teacher', label: 'Giáo viên', width: 170, render: (e) => <Txt size={13}>{e.teacher_name ?? '—'}</Txt> },
            { key: 'class', label: 'Lớp', width: 80, render: (e) => <Txt size={13}>{e.class_name}</Txt> },
            { key: 'kind', label: 'Loại', width: 150, render: (e) => <Txt size={13}>{e.kind_label} · HK{e.semester}</Txt> },
            { key: 'status', label: 'Trạng thái', width: 140, filter: f_status, render: (e) => <StatusChip kind={STATUS[e.status].kind} text={STATUS[e.status].text} /> },
            { key: 'time', label: 'Ngày gửi', width: 110, hideOnCard: true, render: (e) => <Txt size={13}>{dateText(e.created_at)}</Txt> },
          ]} />
      ) : null}
      {open ? (
        <Sheet open onClose={() => setOpen(null)} title={open.title} subtitle={`${open.teacher_name ?? 'Giáo viên'} · lớp ${open.class_name} · ${open.kind_label} học kỳ ${open.semester}`} wide>
          <View style={{ gap: 12 }} testID="exam-review-sheet">
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <StatusChip kind={STATUS[open.status].kind} text={STATUS[open.status].text} />
              <Txt size={13} color={c.muc2}>Bộ đề: {open.quiz_title ?? '—'} · {open.question_count} câu</Txt>
              {open.quiz_title ? <Btn icon={Eye} title="Xem bộ đề" tone="giay" size="sm" onPress={() => setPreview({ id: open.quiz_id, title: open.quiz_title! })} /> : null}
            </View>
            {open.note ? <Card flat pad={12}><Txt size={14} style={{ lineHeight: 22 }}>{open.note}</Txt></Card> : null}
            {open.review_note ? <Txt size={14} color={c.muc2}>Phản hồi: {open.review_note}</Txt> : null}
            {open.status === 'scheduled' ? <Txt size={14}>Giờ thi: {at(open.starts_at)} – {at(open.ends_at)}</Txt> : null}
            {open.status === 'pending' ? (rejecting ? (
              <View style={{ gap: 8 }}>
                <Field label="Lý do từ chối * (giáo viên sẽ thấy)" value={note} onChangeText={setNote} multiline numberOfLines={3} maxLength={300} inputStyle={{ minHeight: 70, textAlignVertical: 'top' }} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Btn title="Quay lại" tone="giay" size="sm" onPress={() => setRejecting(false)} />
                  <Btn icon={X} title="Gửi lời từ chối" tone="son" size="sm" loading={busy} disabled={note.trim().length < 3} onPress={() => { void decide(false); }} testID="exam-reject-confirm" />
                </View>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                <Field label="Ghi chú cho giáo viên (tùy chọn)" value={note} onChangeText={setNote} maxLength={300} />
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Btn icon={Check} title="Duyệt" tone="ngoc" loading={busy} onPress={() => { void decide(true); }} testID="exam-approve" />
                  <Btn icon={X} title="Từ chối…" tone="giay" onPress={() => setRejecting(true)} testID="exam-reject" />
                </View>
              </View>
            )) : null}
          </View>
        </Sheet>
      ) : null}
      {preview ? <PreviewSheet session={session} quiz={preview} onClose={() => setPreview(null)} /> : null}
    </Page>
  );
};

// ---------------------------------------------------------------------- học sinh: kỳ thi
export const StudentExams: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const list = useLoad(() => classroom.myAssignments(session.token), [session.token], session.expired);
  const exams = useMemo(() => (list.data ?? []).filter((a): a is MyAssignment & { exam_kind: 'midterm' | 'final' } => Boolean(a.exam_kind)), [list.data]);
  const [entering, setEntering] = useState<MyAssignment | null>(null);
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState<{ title: string; attempt: AttemptState } | null>(null);
  const start = async () => {
    if (!entering) return;
    setProblem(null); setBusy(true);
    try {
      const res = await classroom.startAssignment(session.token, entering.id, password.trim());
      if (res.kind === 'quiz') { setPlaying({ title: entering.title, attempt: res.attempt }); setEntering(null); setPassword(''); }
    } catch (e) { setProblem(errorMessage(e)); } finally { setBusy(false); }
  };
  if (playing) {
    return (
      <Page>
        <QuizPlayer session={session} initial={playing.attempt} title={playing.title} onClose={() => { setPlaying(null); list.reload(); }} />
      </Page>
    );
  }
  const now = Date.now();
  return (
    <Page>
      <PageHeader title="Kỳ thi" subtitle="Bài kiểm tra giữa kỳ, cuối kỳ thầy cô tổ chức. Vào giờ thi, nhập mật khẩu thầy cô đọc để làm bài; mỗi bài làm một lần." />
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data && !exams.length ? <EmptyState mood="happy" title="Chưa có kỳ thi nào" text="Khi thầy cô tổ chức thi, bài thi sẽ hiện ở đây và em nhận được thông báo." /> : null}
      <View style={{ gap: 10 }} testID="student-exams">
        {exams.map((a) => {
          const opens = a.exam_starts_at ? new Date(a.exam_starts_at).getTime() : 0, closes = new Date(a.exam_ends_at ?? a.due_at).getTime();
          const state = a.submitted_at ? { kind: 'on' as const, text: `Đã làm · ${a.best_percent ?? 0}%` } : now < opens ? { kind: 'info' as const, text: 'Chưa mở' } : now > closes ? { kind: 'off' as const, text: 'Đã đóng' } : { kind: 'warn' as const, text: 'Đang mở' };
          const can = !a.submitted_at && now >= opens && now <= closes && a.attempts_left > 0;
          return (
            <Card key={a.id} flat pad={16} style={{ gap: 8, borderRadius: 12 }} testID={`student-exam-${a.id}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <ClipboardCheck size={18} color={c.logoRed} />
                <Txt f="bold" size={16} style={{ flex: 1, minWidth: 200 }}>{a.title}</Txt>
                <StatusChip kind={state.kind} text={state.text} />
              </View>
              <Txt size={13} color={c.muc2}>Lớp {a.class_name} · Mở {at(a.exam_starts_at ?? null)} – đóng {at(a.exam_ends_at ?? a.due_at)}</Txt>
              {can ? <Btn icon={KeyRound} title="Vào làm bài" tone="son" size="sm" onPress={() => { setEntering(a); setPassword(''); setProblem(null); }} style={{ alignSelf: 'flex-start' }} testID={`student-exam-enter-${a.id}`} /> : null}
            </Card>
          );
        })}
      </View>
      {entering ? (
        <Sheet open onClose={() => setEntering(null)} title="Nhập mật khẩu bài thi" subtitle={entering.title} icon={<KeyRound size={20} color="#b91c1c" />}
          footer={<View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}><Btn title="Hủy" tone="giay" onPress={() => setEntering(null)} /><Btn icon={Play} title="Bắt đầu làm bài" tone="son" loading={busy} disabled={password.trim().length < 4} onPress={() => { void start(); }} testID="student-exam-start" /></View>}>
          <View style={{ gap: 10 }}>
            <Field label="Mật khẩu (thầy cô cung cấp)" value={password} onChangeText={setPassword} autoCapitalize="characters" autoCorrect={false} maxLength={32} onSubmitEditing={() => { void start(); }} testID="student-exam-password" />
            <InfoNote>Em chỉ được làm bài này một lần. Bắt đầu rồi thì làm cho xong trước giờ đóng.</InfoNote>
            <ErrorNote message={problem} />
          </View>
        </Sheet>
      ) : null}
    </Page>
  );
};
