/**
 * Soạn và quản lý thông báo (Sprint 11: HK.GV.076, HK.QT.043, HK.AD.069) và khảo sát đánh giá trải nghiệm của trường (Sprint 12: HK.QT.049, HK.QT.050).
 * Thông báo: giáo viên gửi tới lớp mình phụ trách; quản trị trường gửi cả trường / khối / lớp; quản trị tổng gửi toàn hệ thống hoặc theo trường và vai trò; đặt lịch gửi,
 * sửa đợt chưa gửi, sửa chữ hoặc thu hồi đợt đã gửi. Khảo sát: tạo từ mẫu hoặc tự soạn, chọn đối tượng và lớp, hẹn giờ mở / đóng, xem kết quả tổng hợp ẩn danh, xuất dữ liệu thô.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Download, Pencil, Plus, Send, Trash2 } from 'lucide-react-native';
import * as analytics from '@/api/analyticsApi';
import * as admin from '@/api/adminApi';
import * as api from '@/api/platformApi';
import { Cell, DataTable, DownloadButton, ErrorNote, fromVn, Page, PageHeader, StatusChip, toVn, useAction, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { ColumnChart, StatGrid, StatTile } from '@/components/charts';
import { Bar, Btn, Card, ConfirmSheet, EmptyState, Field, InfoNote, Segmented, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { Broadcast, Question, QType, Survey, SurveyResult, SurveyTemplate } from '@/types/platform';
import { QTYPE_TEXT } from '@/types/platform';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) : '—');

/** Hàng chip chọn một hoặc nhiều giá trị */
function Chips<T extends string | number>({ label, options, value, onChange }: { label: string; options: Array<{ value: T; label: string }>; value: T[]; onChange: (v: T[]) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Txt f="bold" size={14} color={c.muc2}>{label}</Txt>
      <View accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <Pressable key={String(o.value)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}
              style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 5, borderWidth: 1, justifyContent: 'center', borderColor: on ? c.son : c.adminLine, backgroundColor: on ? c.adminTint : c.the }}>
              <Txt f="bold" size={14} color={on ? c.son : c.muc2}>{o.label}</Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------- thông báo
const scopeText = (b: Broadcast): string => (b.scope === 'class' ? `Lớp ${(b.class_names ?? []).join(', ')}` : b.scope === 'grade' ? `Khối ${b.grades.join(', ')}` : b.scope === 'school' ? 'Cả trường' : b.school_ids.length ? `${b.school_ids.length} trường` : 'Toàn hệ thống');
const ROLE_OPTIONS = [{ value: 'student', label: 'Học sinh' }, { value: 'teacher', label: 'Giáo viên' }];

const Compose: React.FC<{ session: Session; editing: Broadcast | null; onClose: () => void; onSaved: () => void }> = ({ session, editing, onClose, onSaved }) => {
  const role = session.user.role;
  const sent = editing?.status === 'sent';
  const classes = useLoad(() => (role === 'root_admin' ? Promise.resolve([]) : analytics.classes(session.token)), [session.token, role], session.expired);
  const schools = useLoad(() => (role === 'root_admin' ? admin.listSchools(session.token, { limit: 100 }) : Promise.resolve(null)), [session.token, role], session.expired);
  const { busy, run } = useAction(session.expired);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [body, setBody] = useState(editing?.body ?? '');
  const [scope, setScope] = useState<string>(editing?.scope ?? (role === 'teacher' ? 'class' : role === 'school_admin' ? 'school' : 'system'));
  const [classIds, setClassIds] = useState<number[]>(editing?.class_ids ?? []);
  const [grades, setGrades] = useState<number[]>(editing?.grades ?? []);
  const [schoolIds, setSchoolIds] = useState<number[]>(editing?.school_ids ?? []);
  const [roles, setRoles] = useState<string[]>(editing?.roles ?? []);
  const [at, setAt] = useState(editing?.status === 'scheduled' ? toVn(editing.send_at) : '');
  const [preview, setPreview] = useState<number | null>(null);
  const activeClasses = (classes.data ?? []).filter((c) => c.is_active);
  const payload = () => ({ title: title.trim(), body: body.trim(), scope, class_ids: classIds, grades, school_ids: schoolIds, roles, send_at: at.trim() ? fromVn(at) : null });
  const atInvalid = Boolean(at.trim()) && !fromVn(at);
  const ready = title.trim().length >= 2 && body.trim().length >= 1 && !atInvalid && (role !== 'teacher' || classIds.length > 0) && (scope !== 'class' || classIds.length > 0) && (scope !== 'grade' || grades.length > 0);
  const roleOptions = role === 'root_admin' ? [...ROLE_OPTIONS, { value: 'school_admin', label: 'Quản trị trường' }] : ROLE_OPTIONS;

  const save = async () => {
    const out = await run(() => (editing ? api.updateBroadcast(session.token, editing.id, sent ? { title: title.trim(), body: body.trim() } : payload()) : api.createBroadcast(session.token, payload())),
      editing ? 'Đã cập nhật thông báo' : at.trim() ? 'Đã đặt lịch gửi' : 'Đã gửi thông báo');
    if (out) { onSaved(); onClose(); }
  };
  const count = async () => { const r = await run(() => api.previewBroadcast(session.token, payload())); if (r) setPreview(r.recipients); };

  return (
    <Sheet open onClose={onClose} wide title={editing ? (sent ? 'Sửa thông báo đã gửi' : 'Sửa thông báo chưa gửi') : 'Soạn thông báo'} subtitle={sent ? 'Chỉ sửa được tiêu đề và nội dung; thông báo của người nhận cập nhật theo' : undefined}
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        {!sent ? <Btn title="Xem số người nhận" tone="giay" loading={busy} onPress={count} testID="bc-preview" /> : null}
        <Btn title="Hủy" tone="giay" onPress={onClose} />
        <Btn icon={Send} title={editing ? 'Lưu' : at.trim() ? 'Đặt lịch gửi' : 'Gửi ngay'} tone="son" loading={busy} disabled={!ready} onPress={save} testID="bc-save" /></View>}>
      <View style={{ gap: 14 }}>
        <Field label="Tiêu đề" value={title} onChangeText={setTitle} maxLength={160} nativeID="bc-title" />
        <Field label="Nội dung" value={body} onChangeText={setBody} multiline numberOfLines={5} maxLength={1000} inputStyle={{ minHeight: 120, textAlignVertical: 'top' }} nativeID="bc-body" />
        {!sent ? (
          <>
            {role === 'school_admin' ? <Segmented<string> label="Phạm vi gửi" value={scope} onChange={setScope} options={[{ value: 'school', label: 'Cả trường' }, { value: 'grade', label: 'Theo khối' }, { value: 'class', label: 'Theo lớp' }]} /> : null}
            {scope === 'grade' ? <Chips<number> label="Khối nhận" options={[6, 7, 8, 9].map((g) => ({ value: g, label: `Khối ${g}` }))} value={grades} onChange={setGrades} /> : null}
            {scope === 'class' ? (
              classes.loading ? <Spinner /> : activeClasses.length
                ? <Chips<number> label={role === 'teacher' ? 'Lớp nhận (lớp thầy cô phụ trách)' : 'Lớp nhận'} options={activeClasses.map((c) => ({ value: c.id, label: c.name }))} value={classIds} onChange={setClassIds} />
                : <InfoNote><Txt size={14}>Chưa có lớp nào đang hoạt động để gửi.</Txt></InfoNote>
            ) : null}
            {role === 'root_admin' ? <Chips<number> label="Chỉ gửi tới các trường (bỏ trống = tất cả trường)" options={(schools.data?.items ?? []).map((s) => ({ value: s.id, label: s.name }))} value={schoolIds} onChange={setSchoolIds} /> : null}
            {role !== 'teacher' ? <Chips<string> label={role === 'root_admin' ? 'Vai trò nhận (bỏ trống = học sinh, giáo viên và quản trị trường)' : 'Vai trò nhận (bỏ trống = học sinh và giáo viên)'} options={roleOptions} value={roles} onChange={setRoles} /> : null}
            <Field label="Hẹn giờ gửi (giờ Việt Nam, dạng 2026-11-05 07:30; để trống = gửi ngay)" value={at} onChangeText={setAt} placeholder="VD: 2026-11-05 07:30" autoCapitalize="none" error={atInvalid ? 'Nhập đúng dạng năm-tháng-ngày giờ:phút' : null} nativeID="bc-at" />
            {preview !== null ? <InfoNote><Txt f="bold" size={14}>Sẽ gửi tới {preview} người.</Txt></InfoNote> : null}
          </>
        ) : <InfoNote><Txt size={14}>Đã gửi tới {editing?.recipients} người.</Txt></InfoNote>}
      </View>
    </Sheet>
  );
};

export const BroadcastManager: React.FC<{ session: Session }> = ({ session }) => {
  const list = useLoad(() => api.broadcasts(session.token), [session.token], session.expired);
  const { busy, run } = useAction(session.expired);
  const [compose, setCompose] = useState<Broadcast | 'new' | null>(null);
  const [remove, setRemove] = useState<Broadcast | null>(null);
  return (
    <Page>
      <PageHeader title="Thông báo" subtitle={session.user.role === 'teacher' ? 'Gửi thông báo tới các lớp thầy cô phụ trách, có thể hẹn giờ' : session.user.role === 'school_admin' ? 'Gửi thông báo tới cả trường, một khối hoặc một số lớp, có thể hẹn giờ' : 'Gửi thông báo tới toàn hệ thống hoặc theo trường và vai trò, có thể hẹn giờ'}
        actions={<Btn icon={Plus} title="Soạn thông báo" tone="son" onPress={() => setCompose('new')} testID="bc-new" />} />
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data ? (
        <DataTable<Broadcast> rows={list.data} rowKey={(b) => b.id} empty="Chưa có thông báo nào. Bấm “Soạn thông báo” để bắt đầu." onRowPress={(b) => setCompose(b)}
          columns={[
            { key: 'title', label: 'Thông báo', flex: 2.4, render: (b) => <Cell main={b.title} sub={b.body} /> },
            { key: 'to', label: 'Gửi tới', flex: 1.3, render: (b) => <Txt size={14}>{scopeText(b)}</Txt> },
            { key: 'status', label: 'Trạng thái', flex: 1.5, render: (b) => (b.status === 'scheduled' ? <View style={{ gap: 4 }}><StatusChip kind="warn" text="Chờ gửi" /><Txt size={12}>{when(b.send_at)}</Txt></View>
              : <View style={{ gap: 4 }}><StatusChip kind="on" text="Đã gửi" /><Txt size={12}>{b.recipients} người · {b.read ?? 0} đã đọc · {when(b.sent_at)}</Txt></View>) },
            { key: 'by', label: 'Người gửi', hideOnCard: false, render: (b) => <Txt size={13}>{b.sender_name ?? '—'}</Txt> },
          ]}
          actions={(b) => <><Btn icon={Pencil} label={`Sửa thông báo ${b.title}`} tone="giay" size="sm" onPress={() => setCompose(b)} /><Btn icon={Trash2} label={b.status === 'sent' ? `Thu hồi thông báo ${b.title}` : `Hủy lịch gửi ${b.title}`} tone="giay" size="sm" onPress={() => setRemove(b)} testID={`bc-delete-${b.id}`} /></>} />
      ) : null}
      {compose ? <Compose session={session} editing={compose === 'new' ? null : compose} onClose={() => setCompose(null)} onSaved={() => list.reload()} /> : null}
      <ConfirmSheet open={Boolean(remove)} title={remove?.status === 'sent' ? 'Thu hồi thông báo?' : 'Hủy lịch gửi?'} message={remove?.status === 'sent' ? `Thông báo “${remove?.title}” sẽ bị xóa khỏi hộp thư của ${remove?.recipients} người đã nhận.` : `Thông báo “${remove?.title}” sẽ không được gửi nữa.`}
        confirmLabel={remove?.status === 'sent' ? 'Thu hồi' : 'Hủy lịch'} tone="son" busy={busy} onCancel={() => setRemove(null)} onConfirm={async () => { const b = remove!; if (await run(() => api.deleteBroadcast(session.token, b.id), b.status === 'sent' ? 'Đã thu hồi thông báo' : 'Đã hủy lịch gửi')) { setRemove(null); list.reload(); } }} />
    </Page>
  );
};

// ---------------------------------------------------------------------- khảo sát của trường (HK.QT.049–050)
const PHASE: Record<Survey['phase'], { kind: 'muted' | 'warn' | 'on' | 'off'; text: string }> = { draft: { kind: 'muted', text: 'Bản nháp' }, scheduled: { kind: 'warn', text: 'Chờ mở' }, open: { kind: 'on', text: 'Đang mở' }, closed: { kind: 'off', text: 'Đã đóng' } };
const AUDIENCE_TEXT = { student: 'Học sinh', teacher: 'Giáo viên', both: 'Học sinh và giáo viên' } as const;

export const QuestionEditor: React.FC<{ q: Question; index: number; onChange: (q: Question) => void; onRemove: () => void }> = ({ q, index, onChange, onRemove }) => {
  const { c } = useTheme();
  return (
    <Card flat pad={12} style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Txt f="bold" size={14} style={{ flex: 1 }}>Câu {index + 1}</Txt>
        <Btn icon={Trash2} label={`Xóa câu ${index + 1}`} tone="giay" size="sm" onPress={onRemove} />
      </View>
      <Segmented<QType> label={`Loại câu ${index + 1}`} value={q.type} onChange={(type) => onChange({ ...q, type, options: type === 'single' || type === 'multi' ? q.options ?? ['Lựa chọn 1', 'Lựa chọn 2'] : undefined })} options={(Object.keys(QTYPE_TEXT) as QType[]).map((t) => ({ value: t, label: QTYPE_TEXT[t] }))} />
      <Field label="Nội dung câu hỏi" value={q.text} onChangeText={(text) => onChange({ ...q, text })} maxLength={300} nativeID={`sq-${index}`} />
      {q.type === 'single' || q.type === 'multi' ? <Field label="Các lựa chọn (mỗi dòng một lựa chọn, 2–10 dòng)" value={(q.options ?? []).join('\n')} onChangeText={(v) => onChange({ ...q, options: v.split('\n') })} multiline numberOfLines={4} inputStyle={{ minHeight: 90, textAlignVertical: 'top' }} /> : null}
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: q.required }} onPress={() => onChange({ ...q, required: !q.required })} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Txt size={14} color={q.required ? c.son : c.muc2}>{q.required ? '✔ Bắt buộc trả lời' : '☐ Không bắt buộc'}</Txt>
      </Pressable>
    </Card>
  );
};

const SurveyForm: React.FC<{ session: Session; templates: SurveyTemplate[]; onClose: () => void; onSaved: () => void }> = ({ session, templates, onClose, onSaved }) => {
  const classes = useLoad(() => analytics.classes(session.token), [session.token], session.expired);
  const { busy, run } = useAction(session.expired);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState<'student' | 'teacher' | 'both'>('student');
  const [questions, setQuestions] = useState<Question[]>([{ id: 'q1', type: 'likert5', text: '', required: true }]);
  const [classIds, setClassIds] = useState<number[]>([]);
  const [opens, setOpens] = useState('');
  const [closes, setCloses] = useState('');
  const pickTemplate = (t: SurveyTemplate | null) => {
    setTemplateId(t?.id ?? null);
    if (t) { setTitle(t.title); setDescription(t.description ?? ''); setAudience(t.audience); setQuestions(t.questions.map((q) => ({ ...q }))); }
  };
  const bad = (opens.trim() && !fromVn(opens)) || (closes.trim() && !fromVn(closes));
  const ready = title.trim().length >= 3 && questions.length > 0 && questions.every((q) => q.text.trim().length >= 3 && (q.type !== 'single' && q.type !== 'multi' ? true : (q.options ?? []).filter((o) => o.trim()).length >= 2)) && !bad;
  const save = async (draft: boolean) => {
    const out = await run(() => api.createSurvey(session.token, {
      title: title.trim(), description: description.trim() || null, audience, template_id: templateId ?? undefined, status: draft ? 'draft' : 'open', class_ids: classIds,
      opens_at: opens.trim() ? fromVn(opens) : null, closes_at: closes.trim() ? fromVn(closes) : null,
      questions: questions.map((q, i) => ({ ...q, id: `q${i + 1}`, text: q.text.trim(), options: q.options?.map((o) => o.trim()).filter(Boolean) })),
    }), draft ? 'Đã lưu bản nháp' : 'Đã tạo khảo sát và gửi thông báo');
    if (out) { onSaved(); onClose(); }
  };
  return (
    <Sheet open onClose={onClose} wide title="Tạo khảo sát" subtitle="Ẩn danh: chỉ xem được số liệu tổng hợp"
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <Btn title="Hủy" tone="giay" onPress={onClose} />
        <Btn title="Lưu bản nháp" tone="giay" loading={busy} disabled={!ready} onPress={() => save(true)} testID="survey-draft" />
        <Btn icon={Send} title="Mở khảo sát" tone="son" loading={busy} disabled={!ready} onPress={() => save(false)} testID="survey-create" /></View>}>
      <View style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Txt f="bold" size={14}>Bắt đầu từ mẫu của hệ thống (hoặc tự soạn)</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Btn title="Tự soạn" tone={templateId === null ? 'son' : 'giay'} size="sm" onPress={() => pickTemplate(null)} />
            {templates.map((t) => <Btn key={t.id} title={t.title} tone={templateId === t.id ? 'son' : 'giay'} size="sm" onPress={() => pickTemplate(t)} testID={`survey-template-${t.id}`} />)}
          </View>
        </View>
        <Field label="Tiêu đề" value={title} onChangeText={setTitle} maxLength={160} nativeID="survey-title" />
        <Field label="Giới thiệu ngắn (không bắt buộc)" value={description} onChangeText={setDescription} multiline numberOfLines={2} maxLength={600} inputStyle={{ minHeight: 60, textAlignVertical: 'top' }} />
        <Segmented<'student' | 'teacher' | 'both'> label="Đối tượng trả lời" value={audience} onChange={setAudience} options={[{ value: 'student', label: 'Học sinh' }, { value: 'teacher', label: 'Giáo viên' }, { value: 'both', label: 'Cả hai' }]} />
        <Chips<number> label="Giới hạn theo lớp (bỏ trống = cả trường)" options={(classes.data ?? []).filter((c) => c.is_active).map((c) => ({ value: c.id, label: c.name }))} value={classIds} onChange={setClassIds} />
        <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 220 }}><Field label="Mở lúc (giờ Việt Nam; để trống = mở ngay)" value={opens} onChangeText={setOpens} placeholder="VD: 2026-11-05 07:30" autoCapitalize="none" /></View>
          <View style={{ flex: 1, minWidth: 220 }}><Field label="Đóng lúc (để trống = đóng thủ công)" value={closes} onChangeText={setCloses} placeholder="VD: 2026-11-12 23:59" autoCapitalize="none" /></View>
        </View>
        {bad ? <InfoNote><Txt size={13}>Nhập thời điểm đúng dạng năm-tháng-ngày giờ:phút, ví dụ 2026-11-05 07:30.</Txt></InfoNote> : null}
        <Txt f="bold" size={15} accessibilityRole="header">Câu hỏi ({questions.length}/30)</Txt>
        {questions.map((q, i) => <QuestionEditor key={i} q={q} index={i} onChange={(nq) => setQuestions(questions.map((x, j) => (j === i ? nq : x)))} onRemove={() => setQuestions(questions.filter((_, j) => j !== i))} />)}
        <View style={{ flexDirection: 'row' }}><Btn icon={Plus} title="Thêm câu hỏi" tone="giay" size="sm" disabled={questions.length >= 30} onPress={() => setQuestions([...questions, { id: `q${questions.length + 1}`, type: 'likert5', text: '', required: true }])} testID="survey-add-question" /></View>
      </View>
    </Sheet>
  );
};

const Results: React.FC<{ session: Session; survey: Survey; onClose: () => void }> = ({ session, survey, onClose }) => {
  const { c } = useTheme();
  const data = useLoad(() => api.surveyResults(session.token, survey.id), [session.token, survey.id], session.expired);
  const r: SurveyResult | null = data.data;
  return (
    <Sheet open onClose={onClose} wide title={`Kết quả: ${survey.title}`} subtitle="Số liệu tổng hợp ẩn danh"
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <DownloadButton title="Xuất Excel" fetchBlob={() => api.exportSurvey(session.token, survey.id, 'xlsx')} filename={`khao-sat-${survey.id}.xlsx`} />
        <DownloadButton title="Xuất CSV" fetchBlob={() => api.exportSurvey(session.token, survey.id, 'csv')} filename={`khao-sat-${survey.id}.csv`} />
        <Btn title="Đóng" tone="giay" onPress={onClose} /></View>}>
      <ErrorNote message={data.error} />
      {data.loading && !r ? <Spinner /> : null}
      {r ? (
        <View style={{ gap: 14 }}>
          <StatGrid>
            <StatTile label="Đã trả lời" value={r.responses.total} hint={`${r.responses.students} học sinh · ${r.responses.teachers} giáo viên`} tone="thuy" />
            <StatTile label="Được mời" value={r.targets.total} />
            <StatTile label="Tỉ lệ trả lời" value={r.response_rate === null ? null : `${r.response_rate}%`} tone={r.response_rate !== null && r.response_rate >= 50 ? 'ngoc' : 'vang'} />
          </StatGrid>
          {r.questions.map((q, i) => (
            <Card key={q.id} flat pad={12} style={{ gap: 8 }}>
              <Txt f="bold" size={15}>{i + 1}. {q.text}</Txt>
              <Txt size={12} color={c.muc3}>{q.n} câu trả lời · {QTYPE_TEXT[q.type]}</Txt>
              {q.type === 'likert5' || q.type === 'nps' ? (
                <>
                  <ColumnChart height={90} unit="người" summary={`Biểu đồ phân bố câu trả lời: ${q.text}`} data={(q.counts ?? []).map((n, k) => ({ label: String((q.min ?? 0) + k), values: { n } }))} series={[{ key: 'n', label: 'Số người' }]} />
                  <Txt size={14}>Trung bình: <Txt f="bold" size={14}>{q.mean ?? '–'}</Txt>{q.type === 'likert5' ? ` · đồng ý (4–5): ${q.agree_percent ?? '–'}%` : ` · điểm NPS: ${q.nps ?? '–'} (ủng hộ ${q.promoters}, trung lập ${q.passives}, chưa ủng hộ ${q.detractors})`}</Txt>
                </>
              ) : null}
              {q.type === 'single' || q.type === 'multi' ? (q.options ?? []).map((o) => (
                <View key={o.option} style={{ gap: 3 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Txt size={14} style={{ flex: 1 }}>{o.option}</Txt><Txt f="bold" size={14}>{o.count} ({o.percent}%)</Txt></View>
                  <Bar value={o.percent} max={100} fill={c.thuy} height={10} label={`${o.option}: ${o.percent}%`} />
                </View>
              )) : null}
              {q.type === 'text' ? (q.hidden ? <InfoNote><Txt size={13}>Ý kiến tự do được ẩn khi có dưới {r.min_text_responses} người trả lời để không lộ ai viết gì.</Txt></InfoNote>
                : q.answers?.length ? q.answers.map((a, k) => <Txt key={k} size={14} style={{ paddingVertical: 4 }}>• {a}</Txt>) : <Txt size={14} color={c.muc3}>Chưa có ý kiến nào.</Txt>) : null}
            </Card>
          ))}
        </View>
      ) : null}
    </Sheet>
  );
};

export const SurveyManager: React.FC<{ session: Session }> = ({ session }) => {
  const list = useLoad(() => api.surveys(session.token), [session.token], session.expired);
  const templates = useLoad(() => api.surveyTemplates(session.token), [session.token], session.expired);
  const { busy, run } = useAction(session.expired);
  const [create, setCreate] = useState(false);
  const [results, setResults] = useState<Survey | null>(null);
  const [remove, setRemove] = useState<Survey | null>(null);
  const act = (s: Survey, patch: Record<string, unknown>, done: string) => run(() => api.updateSurvey(session.token, s.id, patch), done).then((o) => { if (o) list.reload(); });
  const rows = useMemo(() => list.data ?? [], [list.data]);
  return (
    <Page>
      <PageHeader title="Khảo sát" subtitle="Đánh giá trải nghiệm của học sinh và giáo viên trong trường (ẩn danh), phục vụ nghiên cứu hiệu quả trò chơi hóa và AI"
        actions={<Btn icon={Plus} title="Tạo khảo sát" tone="son" onPress={() => setCreate(true)} testID="survey-new" />} />
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data ? (
        <DataTable<Survey> rows={rows} rowKey={(s) => s.id} empty="Chưa có khảo sát nào. Bấm “Tạo khảo sát” và chọn một mẫu của hệ thống." onRowPress={(s) => setResults(s)}
          columns={[
            { key: 'title', label: 'Khảo sát', flex: 2.4, render: (s) => <Cell main={s.title} sub={`${AUDIENCE_TEXT[s.audience]} · ${s.questions.length} câu${s.class_ids.length ? ` · ${s.class_ids.length} lớp` : ' · cả trường'}`} /> },
            { key: 'phase', label: 'Trạng thái', render: (s) => <StatusChip kind={PHASE[s.phase].kind} text={PHASE[s.phase].text} /> },
            { key: 'rate', label: 'Đã trả lời', render: (s) => <Txt size={14}>{s.responses}/{s.targets}{s.response_rate !== null ? ` (${s.response_rate}%)` : ''}</Txt> },
            { key: 'time', label: 'Thời gian', render: (s) => <Txt size={12}>{s.opens_at ? `Mở ${when(s.opens_at)}` : 'Mở ngay'}{s.closes_at ? `\nĐóng ${when(s.closes_at)}` : ''}</Txt> },
          ]}
          actions={(s) => (
            <>
              <Btn icon={Download} label={`Xem kết quả ${s.title}`} title="Kết quả" tone="giay" size="sm" onPress={() => setResults(s)} />
              {s.status === 'draft' ? <Btn title="Mở" tone="ngoc" size="sm" loading={busy} onPress={() => act(s, { status: 'open' }, 'Đã mở khảo sát và gửi thông báo')} /> : null}
              {s.status === 'open' ? <Btn title="Đóng" tone="giay" size="sm" loading={busy} onPress={() => act(s, { status: 'closed' }, 'Đã đóng khảo sát')} /> : null}
              {s.responses === 0 ? <Btn icon={Trash2} label={`Xóa khảo sát ${s.title}`} tone="giay" size="sm" onPress={() => setRemove(s)} /> : null}
            </>
          )} actionsWidth={230} />
      ) : null}
      {!rows.length && list.data ? <EmptyState mood="thinking" title="Chưa có khảo sát nào" /> : null}
      {create ? <SurveyForm session={session} templates={(templates.data ?? []).filter((t) => t.is_active)} onClose={() => setCreate(false)} onSaved={() => list.reload()} /> : null}
      {results ? <Results session={session} survey={results} onClose={() => setResults(null)} /> : null}
      <ConfirmSheet open={Boolean(remove)} title="Xóa khảo sát?" message={`Khảo sát “${remove?.title}” chưa có câu trả lời nào và sẽ bị xóa.`} confirmLabel="Xóa" tone="son" busy={busy} onCancel={() => setRemove(null)}
        onConfirm={async () => { const s = remove!; if (await run(() => api.deleteSurvey(session.token, s.id), 'Đã xóa khảo sát')) { setRemove(null); list.reload(); } }} />
    </Page>
  );
};
