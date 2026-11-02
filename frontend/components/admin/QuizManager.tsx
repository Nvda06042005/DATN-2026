/**
 * Quản lý bộ đề (HK.GV.040–044, HK.AD.045): danh sách bộ đề của tôi / trường / hệ thống, tạo (chọn câu hỏi, thứ tự, thời gian mỗi câu, điểm, xáo trộn),
 * sửa (khóa khi đang được giao hoặc đã có học sinh làm), nhân bản, xóa, làm thử như học sinh, gửi duyệt.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { ArrowDown, ArrowUp, Copy, Pencil, Play, Plus, Send, Sparkles, Trash2 } from 'lucide-react-native';
import * as api from '@/api/learningApi';
import { AdminSelect } from '@/components/admin/AdminSelect';
import { QuestionPicker, ScopeChip, useCampaignOptions } from '@/components/admin/ContentKit';
import { AiQuizModal } from '@/components/admin/AiQuizModal';
import { Cell, DataTable, ErrorNote, FilterBar, FilterBox, Page, PageHeader, Pager, StatusChip, useAction, useDebounced, useLoad } from '@/components/admin/kit';
import { dateText } from '@/components/admin/AccountSheet';
import type { Session } from '@/components/auth';
import { Overlay } from '@/components/portal/LessonReader';
import { QuizPlayer } from '@/components/portal/QuizPlayer';
import { Btn, Card, ConfirmSheet, Field, Inset, Sheet, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { AttemptState, QuizDetail, QuizItem } from '@/types/learning';
import { QTYPE_TEXT } from '@/types/learning';

interface Row { question_id: number; prompt: string; qtype_label: string; points: string; seconds: string }

const QuizForm: React.FC<{ session: Session; initial?: QuizDetail; onClose: () => void; onSaved: (q: QuizDetail) => void }> = ({ session, initial, onClose, onSaved }) => {
  const { c } = useTheme();
  const campaigns = useCampaignOptions(session);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [campaign, setCampaign] = useState(initial?.campaign_id ? String(initial.campaign_id) : '');
  const [seconds, setSeconds] = useState(String(initial?.seconds_per_question ?? 20));
  const [pass, setPass] = useState(String(initial?.pass_percent ?? 60));
  const [shuffleQ, setShuffleQ] = useState(initial?.shuffle_questions ?? false);
  const [shuffleO, setShuffleO] = useState(initial?.shuffle_options ?? false);
  const [rows, setRows] = useState<Row[]>(() => (initial?.items ?? []).map((i) => ({ question_id: i.question_id, prompt: i.prompt, qtype_label: i.qtype_label, points: String(i.points), seconds: i.seconds ? String(i.seconds) : '' })));
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const move = (i: number, d: number) => setRows((r) => { const n = [...r]; const j = i + d; if (j < 0 || j >= n.length) return n; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        title, description: description.trim() || null, campaign_id: campaign ? Number(campaign) : null, seconds_per_question: Number(seconds), pass_percent: Number(pass),
        shuffle_questions: shuffleQ, shuffle_options: shuffleO,
        items: rows.map((r) => ({ question_id: r.question_id, points: Number(r.points) || 100, seconds: r.seconds ? Number(r.seconds) : null })),
      };
      onSaved(initial ? await api.updateQuiz(session.token, initial.id, body) : await api.createQuiz(session.token, body));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa lưu được bộ đề.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title={initial ? 'Sửa bộ đề' : 'Tạo bộ đề'} wide
      footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}><Btn title="Hủy" tone="giay" onPress={onClose} disabled={busy} /><Btn title="Lưu bộ đề" tone="son" onPress={submit} loading={busy} testID="quiz-save" /></View>}>
      <ErrorNote message={error} />
      <Field label="Tên bộ đề *" value={title} onChangeText={setTitle} nativeID="quiz-title" />
      <Field label="Mô tả" value={description} onChangeText={setDescription} multiline numberOfLines={2} inputStyle={{ minHeight: 60, textAlignVertical: 'top' }} />
      <FilterBar>
        <FilterBox flex={2}><AdminSelect label="Chủ đề" value={campaign} options={campaigns} onChange={setCampaign} /></FilterBox>
        <FilterBox><Field label="Giây mỗi câu (5–300)" value={seconds} onChangeText={setSeconds} keyboardType="numeric" /></FilterBox>
        <FilterBox><Field label="Điểm đạt (%)" value={pass} onChangeText={setPass} keyboardType="numeric" /></FilterBox>
      </FilterBar>
      <FilterBar>
        <FilterBox><AdminSelect label="Xáo trộn thứ tự câu hỏi" value={shuffleQ ? 'yes' : 'no'} options={[{ value: 'no', label: 'Giữ nguyên thứ tự' }, { value: 'yes', label: 'Xáo trộn mỗi lượt' }]} onChange={(v) => setShuffleQ(v === 'yes')} /></FilterBox>
        <FilterBox><AdminSelect label="Xáo trộn đáp án" value={shuffleO ? 'yes' : 'no'} options={[{ value: 'no', label: 'Giữ nguyên thứ tự' }, { value: 'yes', label: 'Xáo trộn mỗi lượt' }]} onChange={(v) => setShuffleO(v === 'yes')} /></FilterBox>
      </FilterBar>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Txt f="bold" size={15}>Các câu hỏi ({rows.length})</Txt>
          <Btn icon={Plus} title="Thêm câu hỏi" tone="son" size="sm" onPress={() => setPicking(true)} testID="quiz-add-questions" />
        </View>
        {rows.length === 0 ? <Txt size={13} color={c.muc3}>Chưa có câu hỏi nào. Bấm “Thêm câu hỏi” để chọn từ ngân hàng.</Txt> : null}
        {rows.map((r, i) => (
          <Card key={r.question_id} flat pad={12} style={{ gap: 8 }}>
            <Txt size={13} color={c.muc3}>Câu {i + 1} · {r.qtype_label}</Txt>
            <Txt f="semibold" size={14}>{r.prompt}</Txt>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <View style={{ width: 110 }}><Field label="Điểm (10–1000)" value={r.points} onChangeText={(v) => setRows((x) => x.map((y, j) => (j === i ? { ...y, points: v } : y)))} keyboardType="numeric" /></View>
              <View style={{ width: 130 }}><Field label="Giây riêng" value={r.seconds} placeholder={`mặc định ${seconds}`} onChangeText={(v) => setRows((x) => x.map((y, j) => (j === i ? { ...y, seconds: v } : y)))} keyboardType="numeric" /></View>
              <Btn icon={ArrowUp} label="Đưa lên" tone="giay" size="sm" disabled={i === 0} onPress={() => move(i, -1)} />
              <Btn icon={ArrowDown} label="Đưa xuống" tone="giay" size="sm" disabled={i === rows.length - 1} onPress={() => move(i, 1)} />
              <Btn icon={Trash2} label={`Gỡ câu ${i + 1}`} tone="giay" size="sm" onPress={() => setRows((x) => x.filter((_, j) => j !== i))} />
            </View>
          </Card>
        ))}
      </View>
      {picking ? <QuestionPicker session={session} title="Chọn câu hỏi cho bộ đề" exclude={rows.map((r) => r.question_id)} onClose={() => setPicking(false)}
        onPick={(items) => { setRows((x) => [...x, ...items.map((q) => ({ question_id: q.id, prompt: q.prompt, qtype_label: q.qtype_label, points: '100', seconds: '' }))]); setPicking(false); }} /> : null}
    </Sheet>
  );
};

const QuizDetailSheet: React.FC<{ session: Session; id: number; onClose: () => void; onChanged: () => void; onPreview: (a: AttemptState, title: string) => void; onStudio?: (quizId: number) => void }> = ({ session, id, onClose, onChanged, onPreview, onStudio }) => {
  const { c } = useTheme();
  const role = session.user.role;
  const detail = useLoad(() => api.getQuiz(session.token, id), [session.token, id], session.expired);
  const { busy, run } = useAction(session.expired);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const d = detail.data;
  const shareTarget = role === 'teacher' && d?.scope === 'teacher' ? 'school' : role === 'school_admin' && d?.scope === 'school' ? 'system' : null;
  const shared = d?.shares.find((x) => x.target === shareTarget);
  const total = d ? d.items.reduce((n, i) => n + (i.seconds ?? d.seconds_per_question), 0) : 0;
  return (
    <Sheet open onClose={onClose} title={d?.title ?? 'Bộ đề'} subtitle={d ? `${d.items.length} câu · ${Math.ceil(total / 60)} phút · đạt từ ${d.pass_percent}%` : undefined} wide>
      <ErrorNote message={detail.error} />
      {detail.loading && !d ? <Spinner /> : null}
      {d ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <ScopeChip scope={d.scope} />
            {d.locked ? <StatusChip kind="warn" text="Đang khóa chỉnh sửa" /> : null}
            {d.shuffle_questions ? <StatusChip kind="muted" text="Xáo trộn câu hỏi" /> : null}
            {d.shuffle_options ? <StatusChip kind="muted" text="Xáo trộn đáp án" /> : null}
            {d.shares.map((x) => <StatusChip key={x.target} kind={x.status === 'approved' ? 'on' : x.status === 'pending' ? 'warn' : 'off'} text={`${x.target === 'school' ? 'Gửi trường' : 'Gửi hệ thống'}: ${x.status === 'approved' ? 'đã duyệt' : x.status === 'pending' ? 'chờ duyệt' : 'bị từ chối'}`} />)}
          </View>
          {d.description ? <Txt size={14}>{d.description}</Txt> : null}
          {d.lock_reason ? <Inset style={{ backgroundColor: c.vangNhat }}><Txt size={13} color={c.vangChu}>{d.lock_reason}</Txt></Inset> : null}
          {shared?.review_note ? <Inset style={{ backgroundColor: c.sonNhat }}><Txt size={13} color={c.sonChu}>Lý do từ chối: {shared.review_note}</Txt></Inset> : null}
          <View style={{ gap: 6 }}>
            {d.items.map((i) => <Txt key={i.question_id} size={14}>{i.position}. {i.prompt} <Txt size={12} color={c.muc3}>({QTYPE_TEXT[i.qtype]}, {i.points} điểm, {i.seconds ?? d.seconds_per_question}s)</Txt></Txt>)}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Btn icon={Play} title="Làm thử như học sinh" tone="ngoc" size="sm" loading={busy} onPress={async () => { const a = await run(() => api.previewQuiz(session.token, d.id)); if (a) { onPreview(a, d.title); onClose(); } }} testID="quiz-preview" />
            {d.can_edit ? <Btn icon={Pencil} title="Sửa" tone="son" size="sm" disabled={d.locked} onPress={() => setEditing(true)} testID="quiz-edit" /> : null}
            {d.can_edit && onStudio ? <Btn icon={Sparkles} title="Sửa trong trình soạn Quiz" tone="ngoc" size="sm" disabled={d.locked} onPress={() => { onClose(); onStudio(d.id); }} testID="quiz-edit-studio" /> : null}
            {role === 'teacher' || role === 'root_admin' ? <Btn icon={Copy} title="Nhân bản" tone="giay" size="sm" loading={busy} onPress={async () => { if (await run(() => api.duplicateQuiz(session.token, d.id), 'Đã nhân bản bộ đề')) { onChanged(); onClose(); } }} /> : null}
            {shareTarget ? <Btn icon={Send} title={shareTarget === 'school' ? 'Gửi vào kho của trường' : 'Đề xuất lên kho hệ thống'} tone="giay" size="sm" loading={busy} disabled={shared?.status === 'pending'}
              onPress={async () => { if (await run(() => api.requestShare(session.token, 'quiz', d.id, shareTarget), 'Đã gửi đi duyệt')) detail.reload(); }} /> : null}
            {d.can_edit ? <Btn icon={Trash2} title="Xóa" tone="giay" size="sm" onPress={() => setRemoving(true)} /> : null}
          </View>
        </View>
      ) : null}
      {editing && d ? <QuizForm session={session} initial={d} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); detail.reload(); onChanged(); }} /> : null}
      <ConfirmSheet open={removing} title="Xóa bộ đề?" message="Chỉ xóa được bộ đề chưa nằm trong hành trình và chưa có học sinh làm. Các câu hỏi vẫn được giữ trong ngân hàng." confirmLabel="Xóa" busy={busy}
        onCancel={() => setRemoving(false)} onConfirm={async () => { if (d) { const ok = await run(async () => { await api.deleteQuiz(session.token, d.id); return true; }, 'Đã xóa bộ đề'); setRemoving(false); if (ok) { onChanged(); onClose(); } } }} />
    </Sheet>
  );
};

export const QuizManager: React.FC<{ session: Session; onStudio?: (quizId?: number) => void }> = ({ session, onStudio }) => {
  const role = session.user.role;
  const [store, setStore] = useState(role === 'school_admin' ? 'school' : 'all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [aiModal, setAiModal] = useState(false);
  const [preview, setPreview] = useState<{ attempt: AttemptState; title: string } | null>(null);
  const term = useDebounced(q.trim(), 300);
  const list = useLoad(() => api.listQuizzes(session.token, { store, q: term, page, limit: 15 }), [session.token, store, term, page], session.expired);
  const canWrite = role === 'teacher' || role === 'root_admin';
  return (
    <>
    <Page>
      <PageHeader title="Bộ đề" subtitle="Bộ câu hỏi dùng ở các nút trên bản đồ hành trình. Bộ đề đang được giao hoặc đã có học sinh làm thì khóa chỉnh sửa; hãy nhân bản để thay đổi."
        actions={canWrite ? <><Btn icon={Sparkles} title="Soạn đề bằng AI" tone="ngoc" size="sm" onPress={() => setAiModal(true)} testID="quiz-ai" />{onStudio ? <Btn icon={Sparkles} title="Soạn Quiz kiểu Kahoot" tone="ngoc" size="sm" onPress={() => onStudio()} testID="quiz-studio" /> : null}<Btn icon={Plus} title="Tạo bộ đề" tone="son" size="sm" onPress={() => setCreating(true)} testID="quiz-create" /></> : undefined} />
      <FilterBar>
        <FilterBox><AdminSelect label="Kho" value={store} onChange={(v) => { setStore(v); setPage(1); }}
          options={role === 'root_admin' ? [{ value: 'all', label: 'Kho hệ thống và đề xuất' }, { value: 'system', label: 'Kho hệ thống' }, { value: 'school', label: 'Kho của các trường' }]
            : [{ value: 'all', label: 'Tất cả kho' }, ...(role === 'teacher' ? [{ value: 'mine', label: 'Của tôi' }] : []), { value: 'school', label: 'Kho của trường' }, { value: 'system', label: 'Kho hệ thống' }]} /></FilterBox>
        <FilterBox flex={2}><Field label="Tìm bộ đề" value={q} onChangeText={(v) => { setQ(v); setPage(1); }} /></FilterBox>
      </FilterBar>
      <ErrorNote message={list.error} />
      {list.loading && !list.data ? <Spinner /> : null}
      {list.data ? (
        <>
          <DataTable<QuizItem> rows={list.data.items} rowKey={(r) => r.id} onRowPress={(r) => setOpen(r.id)} empty="Chưa có bộ đề nào"
            columns={[
              { key: 'title', label: 'Bộ đề', flex: 3, render: (r) => <Cell main={r.title} sub={r.campaign_title ?? 'Chưa gắn chủ đề'} /> },
              { key: 'scope', label: 'Kho', flex: 1.2, render: (r) => <ScopeChip scope={r.scope} /> },
              { key: 'n', label: 'Số câu', flex: 0.7, render: (r) => <Txt size={13}>{r.question_count}</Txt> },
              { key: 'time', label: 'Thời gian', flex: 0.9, render: (r) => <Txt size={13}>{Math.ceil(r.total_seconds / 60)} phút</Txt> },
              { key: 'used', label: 'Đã giao / làm', flex: 1, render: (r) => <Txt size={13}>{r.assigned} hành trình · {r.attempts} lượt{r.locked ? ' (khóa)' : ''}</Txt> },
              { key: 'owner', label: 'Người soạn', flex: 1.3, hideOnCard: true, render: (r) => <Cell main={r.owner_name ?? '—'} sub={dateText(r.updated_at)} /> },
            ]} />
          <Pager page={page} limit={15} total={list.data.total} onPage={setPage} />
        </>
      ) : null}
            {aiModal ? <AiQuizModal open={aiModal} onClose={() => { setAiModal(false); list.reload(); }} session={session} /> : null}
      {open !== null ? <QuizDetailSheet session={session} id={open} onClose={() => setOpen(null)} onChanged={list.reload} onPreview={(attempt, title) => setPreview({ attempt, title })} onStudio={onStudio} /> : null}
      {creating ? <QuizForm session={session} onClose={() => setCreating(false)} onSaved={(d) => { setCreating(false); list.reload(); setOpen(d.id); }} /> : null}
    </Page>
    {preview ? <Overlay title={`Làm thử: ${preview.title}`} onBack={() => setPreview(null)}><QuizPlayer session={session} initial={preview.attempt} title={preview.title} onClose={() => setPreview(null)} /></Overlay> : null}
    </>
  );
};
