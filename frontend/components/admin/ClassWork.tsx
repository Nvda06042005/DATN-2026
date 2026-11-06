/**
 * Bài tập và tiến độ của lớp (HK.GV.028, 045–050): giao bộ đề / mini-game / bài học cho cả lớp, đội hoặc học sinh với hạn nộp; xem tình trạng nộp, gia hạn,
 * thu hồi, chấm điểm kèm nhận xét, nhắc học sinh chưa nộp; tiến độ lớp trên hành trình và học sinh chậm.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { BellRing, Pencil, Plus, Undo2 } from 'lucide-react-native';
import * as battle from '@/api/battleApi';
import * as api from '@/api/classroomApi';
import * as learning from '@/api/learningApi';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { Cell, DataTable, DownloadButton, ErrorNote, FormSheet, StatusChip, fromVn, idsToValues, toVn, useAction, useLoad, valuesToIds, type FieldDef } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Bar, Btn, ConfirmSheet, EmptyState, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { AssignmentDetail, AssignmentRow, ClassDetail, SubmissionRow } from '@/types/classroom';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) : '—');
const STATE: Record<SubmissionRow['state'], { text: string; kind: 'on' | 'off' | 'warn' | 'info' | 'muted' }> = {
  todo: { text: 'Chưa nộp', kind: 'muted' }, submitted: { text: 'Đã nộp', kind: 'on' }, late: { text: 'Nộp muộn', kind: 'warn' }, graded: { text: 'Đã chấm', kind: 'info' },
};

// ---------------------------------------------------------------------- bài tập
const AssignForm: React.FC<{ session: Session; cls: ClassDetail; row?: AssignmentDetail; onClose: () => void; onSaved: () => void }> = ({ session, cls, row, onClose, onSaved }) => {
  const { token } = session;
  const quizzes = useLoad(() => learning.listQuizzes(token, { limit: 100 }), [token], session.expired);
  const lessons = useLoad(() => learning.listLessons(token, {}), [token], session.expired);
  const minis = useLoad(() => battle.battleList(token), [token], session.expired);
  const teams = useLoad(() => api.classTeams(token, cls.id), [token, cls.id], session.expired);
  const students = useLoad(() => api.classStudents(token, cls.id), [token, cls.id], session.expired);
  const editing = !!row;
  const fields: FieldDef[] = [
    { name: 'title', label: 'Tên bài tập', required: true },
    { name: 'description', label: 'Hướng dẫn cho học sinh', type: 'textarea' },
    ...(editing ? [] : [
      { name: 'kind', label: 'Loại bài tập', type: 'select' as const, required: true, options: [{ value: 'quiz', label: 'Bộ đề (làm bài trắc nghiệm)' }, { value: 'minigame', label: 'Mini-game' }, { value: 'lesson', label: 'Bài học (đọc và trả lời nhanh)' }] },
      { name: 'quiz_id', label: 'Bộ đề', type: 'select' as const, required: true, options: [{ value: '', label: '— Chọn bộ đề —' }, ...(quizzes.data?.items ?? []).filter((z) => z.question_count > 0).map((z) => ({ value: String(z.id), label: `${z.title} (${z.question_count} câu)` }))], when: (v: Record<string, string | string[]>) => v.kind === 'quiz' },
      { name: 'minigame_id', label: 'Mini-game', type: 'select' as const, required: true, options: [{ value: '', label: '— Chọn mini-game —' }, ...(minis.data?.minigames ?? []).map((m) => ({ value: String(m.id), label: `${m.title} (${m.kind_label})` }))], when: (v: Record<string, string | string[]>) => v.kind === 'minigame' },
      { name: 'lesson_id', label: 'Bài học', type: 'select' as const, required: true, options: [{ value: '', label: '— Chọn bài học —' }, ...(lessons.data ?? []).filter((l) => l.status === 'published').map((l) => ({ value: String(l.id), label: l.title }))], when: (v: Record<string, string | string[]>) => v.kind === 'lesson' },
    ] satisfies FieldDef[]),
    { name: 'audience', label: 'Giao cho', type: 'select', options: [{ value: 'class', label: 'Cả lớp' }, { value: 'team', label: 'Một số đội' }, { value: 'students', label: 'Một số học sinh' }] },
    { name: 'team_ids', label: 'Đội', type: 'multi', options: (teams.data ?? []).map((t) => ({ value: String(t.id), label: t.name })), when: (v) => v.audience === 'team' },
    { name: 'student_ids', label: 'Học sinh', type: 'multi', options: (students.data ?? []).map((s) => ({ value: String(s.id), label: s.full_name })), when: (v) => v.audience === 'students' },
    { name: 'due_at', label: 'Hạn nộp (giờ Việt Nam)', required: true, placeholder: '2026-11-20 23:59', hint: 'Dạng YYYY-MM-DD HH:mm; không quá một năm kể từ hôm nay' },
    { name: 'max_attempts', label: 'Số lần làm tối đa (1–10)', type: 'number' },
    { name: 'bonus_points', label: 'Điểm thưởng khi nộp đúng hạn (0–500)', type: 'number' },
  ];
  const nextWeek = toVn(new Date(Date.now() + 7 * 86_400_000).toISOString()).slice(0, 10) + ' 23:59';
  const initial: Record<string, string | string[]> = row ? {
    title: row.title, description: row.description ?? '', audience: row.audience, team_ids: idsToValues(row.team_ids), student_ids: idsToValues(row.student_ids), due_at: toVn(row.due_at), max_attempts: String(row.max_attempts), bonus_points: String(row.bonus_points),
  } : { title: '', description: '', kind: 'quiz', quiz_id: '', minigame_id: '', lesson_id: '', audience: 'class', team_ids: [] as string[], student_ids: [] as string[], due_at: nextWeek, max_attempts: '3', bonus_points: '30' };
  return (
    <FormSheet title={editing ? 'Sửa / gia hạn bài tập' : 'Giao bài tập'} subtitle={editing ? row.title : `Lớp ${cls.name}`} fields={fields} initial={initial} wide submitLabel={editing ? 'Lưu thay đổi' : 'Giao bài'} onClose={onClose}
      onSubmit={async (v) => {
        const due = fromVn(String(v.due_at));
        if (!due) throw new Error('Nhập hạn nộp theo dạng 2026-11-20 23:59 (giờ Việt Nam).');
        const audience = String(v.audience) as AssignmentDetail['audience'];
        const common = {
          title: String(v.title).trim(), description: String(v.description ?? '').trim() || null, audience, team_ids: audience === 'team' ? valuesToIds(v.team_ids) : [], student_ids: audience === 'students' ? valuesToIds(v.student_ids) : [],
          due_at: due, max_attempts: Number(v.max_attempts) || 1, bonus_points: Number(v.bonus_points) || 0,
        };
        if (row) await api.updateAssignment(token, row.id, common);
        else {
          const kind = String(v.kind) as AssignmentRow['kind'];
          await api.createAssignment(token, cls.id, { ...common, kind, ...(kind === 'quiz' ? { quiz_id: Number(v.quiz_id) } : kind === 'minigame' ? { minigame_id: Number(v.minigame_id) } : { lesson_id: Number(v.lesson_id) }) });
        }
        onSaved();
        onClose();
      }} />
  );
};

const GradeForm: React.FC<{ session: Session; assignmentId: number; student: SubmissionRow; onClose: () => void; onSaved: () => void }> = ({ session, assignmentId, student, onClose, onSaved }) => (
  <FormSheet title="Chấm điểm và nhận xét" subtitle={`${student.full_name}${student.best_percent !== null ? ` · làm bài đạt ${student.best_percent}%` : ''}`} submitLabel="Lưu điểm"
    fields={[{ name: 'score', label: 'Điểm của giáo viên (0–100)', type: 'number', required: true, hint: 'Từ 80: Giỏi · 65: Khá · 50: Trung bình · dưới 50: Yếu' }, { name: 'feedback', label: 'Nhận xét', type: 'textarea' }]}
    initial={{ score: student.teacher_score !== null ? String(student.teacher_score) : student.best_percent !== null ? String(student.best_percent) : '', feedback: student.feedback ?? '' }} onClose={onClose}
    onSubmit={async (v) => { await api.gradeAssignment(session.token, assignmentId, { user_id: student.id, score: Number(v.score), feedback: String(v.feedback ?? '').trim() || null }); onSaved(); onClose(); }} />
);

const AssignmentSheet: React.FC<{ session: Session; cls: ClassDetail; id: number; onClose: () => void; onChanged: () => void }> = ({ session, cls, id, onClose, onChanged }) => {
  const { c } = useTheme();
  const detail = useLoad(() => api.assignmentDetail(session.token, id), [session.token, id], session.expired);
  const { busy, run } = useAction(session.expired);
  const [grading, setGrading] = useState<SubmissionRow | null>(null);
  const [editing, setEditing] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const d = detail.data;
  const changed = () => { detail.reload(); onChanged(); };
  return (
    <Sheet open onClose={onClose} title={d?.title ?? 'Bài tập'} subtitle={d ? `${d.kind_label} · ${d.content_title} · hạn ${when(d.due_at)}` : undefined} wide footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Btn title="Đóng" tone="giay" onPress={onClose} /></View>}>
      <ErrorNote message={detail.error} />
      {detail.loading && !d ? <Spinner /> : null}
      {d ? (
        <View style={{ gap: 12 }}>
          {d.description ? <Txt size={14} color={c.muc2}>{d.description}</Txt> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <StatusChip kind={d.status === 'revoked' ? 'off' : d.overdue ? 'warn' : 'on'} text={d.status === 'revoked' ? 'Đã thu hồi' : d.overdue ? 'Quá hạn' : 'Đang mở'} />
            <StatusChip kind="info" text={`${d.summary.submitted}/${d.summary.total} đã nộp`} />
            {d.summary.late ? <StatusChip kind="warn" text={`${d.summary.late} nộp muộn`} /> : null}
            <StatusChip kind="muted" text={`${d.summary.graded} đã chấm`} />
            <StatusChip kind="muted" text={`tối đa ${d.max_attempts} lần · thưởng ${d.bonus_points} điểm`} />
          </View>
          <Bar value={d.summary.submitted} max={Math.max(1, d.summary.total)} label={`Đã nộp ${d.summary.submitted}/${d.summary.total}`} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <DownloadButton title="Xuất Excel" fetchBlob={() => api.exportAssignment(session.token, id, 'xlsx')} filename={`bai-tap-${id}.xlsx`} />
            <DownloadButton title="Xuất PDF" fetchBlob={() => api.exportAssignment(session.token, id, 'pdf')} filename={`bai-tap-${id}.pdf`} />
          </View>
          {d.status === 'active' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Btn icon={BellRing} title="Nhắc học sinh chưa nộp" tone="dong" size="sm" loading={busy} testID="assign-remind"
                onPress={async () => { const res = await run(() => api.remindAssignment(session.token, id)); if (res) { detail.reload(); } }} />
              <Btn icon={Pencil} title="Sửa / gia hạn" tone="giay" size="sm" onPress={() => setEditing(true)} />
              <Btn icon={Undo2} title="Thu hồi" tone="giay" size="sm" onPress={() => setRevoking(true)} disabled={d.summary.submitted > 0} />
            </View>
          ) : null}
          <DataTable<SubmissionRow> rows={d.students} rowKey={(s) => s.id} empty="Không có học sinh nào trong phạm vi giao"
            columns={[
              { key: 'n', label: 'Học sinh', flex: 2, render: (s) => <Cell main={s.nickname || s.full_name} sub={s.user_code} /> },
              { key: 's', label: 'Tình trạng', flex: 1.2, render: (s) => <StatusChip kind={STATE[s.state].kind} text={STATE[s.state].text} /> },
              { key: 'p', label: 'Kết quả', flex: 1.4, render: (s) => <Txt size={13}>{s.best_percent !== null ? `${s.best_percent}% · ${s.attempts} lần` : '—'}</Txt> },
              { key: 't', label: 'Điểm giáo viên', flex: 1.4, render: (s) => <Cell main={s.teacher_score !== null ? `${s.teacher_score}/100 · ${s.grade}` : '—'} sub={s.feedback} /> },
            ]}
            actions={(s) => (s.submitted_at ? <Btn title={s.teacher_score !== null ? 'Chấm lại' : 'Chấm điểm'} tone="giay" size="sm" onPress={() => setGrading(s)} testID={`grade-${s.id}`} /> : null)} />
        </View>
      ) : null}
      {grading ? <GradeForm session={session} assignmentId={id} student={grading} onClose={() => setGrading(null)} onSaved={changed} /> : null}
      {editing && d ? <AssignForm session={session} cls={cls} row={d} onClose={() => setEditing(false)} onSaved={changed} /> : null}
      <ConfirmSheet open={revoking} title="Thu hồi bài tập?" message="Học sinh sẽ không còn thấy bài tập này. Chỉ thu hồi được khi chưa có học sinh nào nộp." confirmLabel="Thu hồi" busy={busy} onCancel={() => setRevoking(false)}
        onConfirm={async () => { const res = await run(() => api.revokeAssignment(session.token, id), 'Đã thu hồi bài tập'); setRevoking(false); if (res) changed(); }} />
    </Sheet>
  );
};

export const ClassAssignments: React.FC<{ session: Session; cls: ClassDetail }> = ({ session, cls }) => {
  const list = useLoad(() => api.assignmentList(session.token, cls.id), [session.token, cls.id], session.expired);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}><Btn icon={Plus} title="Giao bài tập" tone="son" size="sm" onPress={() => setCreating(true)} testID="assign-create" disabled={!cls.is_active} /></View>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data ? (
        <DataTable<AssignmentRow> rows={list.data} rowKey={(a) => a.id} onRowPress={(a) => setOpen(a.id)} empty="Lớp chưa có bài tập nào. Bấm “Giao bài tập” để giao bộ đề, mini-game hoặc bài học."
          columns={[
            { key: 't', label: 'Bài tập', flex: 3, render: (a) => <Cell main={a.title} sub={`${a.kind_label}: ${a.content_title}`} /> },
            { key: 'd', label: 'Hạn nộp', flex: 1.5, render: (a) => <Txt size={13}>{when(a.due_at)}</Txt> },
            { key: 'a', label: 'Phạm vi', flex: 1.2, render: (a) => <Txt size={13}>{a.audience === 'class' ? 'Cả lớp' : a.audience === 'team' ? 'Theo đội' : 'Học sinh chọn'} · {a.audience_size}</Txt> },
            { key: 'r', label: 'Đã nộp', flex: 1.2, render: (a) => <Txt size={13}>{a.submitted}/{a.audience_size} ({a.rate}%) · chấm {a.graded}</Txt> },
            { key: 's', label: 'Trạng thái', flex: 1, render: (a) => <StatusChip kind={a.status === 'revoked' ? 'off' : a.overdue ? 'warn' : 'on'} text={a.status === 'revoked' ? 'Thu hồi' : a.overdue ? 'Quá hạn' : 'Đang mở'} /> },
          ]} />
      ) : null}
      {creating ? <AssignForm session={session} cls={cls} onClose={() => setCreating(false)} onSaved={list.reload} /> : null}
      {open !== null ? <AssignmentSheet session={session} cls={cls} id={open} onClose={() => setOpen(null)} onChanged={list.reload} /> : null}
    </View>
  );
};

// ---------------------------------------------------------------------- tiến độ lớp (HK.GV.028)
export const ClassProgress: React.FC<{ session: Session; cls: ClassDetail }> = ({ session, cls }) => {
  const { c } = useTheme();
  const [journey, setJourney] = useState('');
  const view = useLoad(() => api.classProgress(session.token, cls.id, journey ? Number(journey) : undefined), [session.token, cls.id, journey], session.expired);
  const d = view.data;
  return (
    <View style={{ gap: 14 }}>
      <ErrorNote message={view.error} />
      {view.loading && !d ? <Spinner /> : null}
      {d && !d.journey ? <EmptyState mood="thinking" title="Lớp chưa được giao hành trình" text="Vào mục Hành trình học, mở một hành trình rồi bấm “Giao cho lớp”." /> : null}
      {d?.journey ? (
        <>
          {d.journeys.length > 1 ? <AdminSelect label="Hành trình" value={journey || String(d.journey.id)} onChange={setJourney} options={d.journeys.map((j) => ({ value: String(j.id), label: j.title }))} /> : <Txt f="bold" size={16}>{d.journey.title}</Txt>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <StatusChip kind="info" text={`Trung bình ${d.summary.avg_percent}% hoàn thành`} />
            <StatusChip kind={d.summary.behind ? 'warn' : 'on'} text={d.summary.behind ? `${d.summary.behind} học sinh cần hỗ trợ` : 'Không có học sinh chậm'} />
            {d.journey.starts_at || d.journey.ends_at ? <StatusChip kind="muted" text={`Lịch: ${d.journey.starts_at ? when(d.journey.starts_at) : 'ngay'} → ${d.journey.ends_at ? when(d.journey.ends_at) : 'không hết hạn'}`} /> : null}
          </View>
          <Txt f="bold" size={15}>Các nút trên bản đồ</Txt>
          <View style={{ gap: 8 }}>
            {d.nodes.map((n) => (
              <View key={n.id} style={{ gap: 4 }}>
                <Txt size={14}>{n.position}. {n.title} <Txt size={12} color={c.muc3}>· {n.done} học sinh đã xong · {n.at_node} đang ở nút này</Txt></Txt>
                <Bar value={n.done} max={Math.max(1, d.summary.students ?? 1)} label={`${n.title}: ${n.percent}%`} height={8} />
              </View>
            ))}
          </View>
          <Txt f="bold" size={15}>Học sinh</Txt>
          <DataTable rows={d.students} rowKey={(s) => s.id} empty="Lớp chưa có học sinh"
            columns={[
              { key: 'n', label: 'Học sinh', flex: 2, render: (s) => <Cell main={s.full_name} sub={s.name !== s.full_name ? s.name : null} /> },
              { key: 'p', label: 'Tiến độ', flex: 2, render: (s) => <View style={{ gap: 4 }}><Bar value={s.done} max={Math.max(1, s.total)} label={`${s.name}: ${s.percent}%`} height={8} /><Txt size={12} color={c.muc3}>{s.done}/{s.total} nút · {s.percent}%</Txt></View> },
              { key: 'c', label: 'Đang ở', flex: 1.6, render: (s) => <Txt size={13}>{s.current_node ?? (s.done >= s.total ? 'Đã hoàn thành' : '—')}</Txt> },
              { key: 'b', label: 'Ghi chú', flex: 2, render: (s) => (s.behind ? <StatusChip kind="warn" text={s.reason ?? 'Cần hỗ trợ'} /> : <StatusChip kind="on" text="Đúng tiến độ" />) },
            ]} />
        </>
      ) : null}
    </View>
  );
};
