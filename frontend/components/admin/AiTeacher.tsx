/**
 * Trợ lý AI cho giáo viên (Sprint 9): hỏi đáp tư liệu lịch sử có trích dẫn (HK.GV.073), tổng hợp chủ đề học sinh hỏi Tiểu Tướng – ẩn danh (HK.GV.074), soạn câu hỏi từ bài học /
 * tư liệu để chỉnh sửa và duyệt trước khi lưu vào ngân hàng câu hỏi (HK.GV.038) và gợi ý kịch bản tiết học từ hành trình hoặc trận đánh (HK.GV.075).
 * Câu hỏi và kịch bản chưa nối mô hình AI được soạn theo mẫu từ chính tư liệu; kết quả luôn ghi rõ nguồn và cách soạn.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { ClipboardList, Save, Sparkles, Trash2 } from 'lucide-react-native';
import * as api from '@/api/aiApi';
import * as learning from '@/api/learningApi';
import { Cell, DataTable, ErrorNote, FormSheet, Page, PageHeader, useAction, useLoad, type FieldDef } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { ChatPanel } from '@/components/portal/TieuTuong';
import { DetailSheet } from '@/components/portal/Library';
import { Btn, Card, Chip, EmptyState, Field, InfoNote, Segmented, Spinner, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { DraftResult, PlanResult, QuestionDraft } from '@/types/ai';
import { AiQuizModal } from '@/components/admin/AiQuizModal';
import { AiHubDashboard } from '@/components/ai/AiHubDashboard';

type Part = 'ask' | 'topics' | 'questions' | 'plan' | 'hub';
const KIND_LABEL: Record<string, string> = { figure: 'Nhân vật', event: 'Sự kiện', place: 'Địa danh', battle: 'Trận đánh', source: 'Tư liệu', term: 'Thuật ngữ', lesson: 'Bài học', doc: 'Tài liệu' };

const optionTitle = (d: QuestionDraft): string[] => {
  if (d.qtype === 'single') { const o = (d.data.options as Array<{ id: string; text: string }>); return o.map((x) => `${x.id === d.data.correct ? '✓' : '○'} ${x.text}`); }
  if (d.qtype === 'truefalse') return [`Đáp án: ${d.data.correct ? 'Đúng' : 'Sai'}`];
  return (d.data.blanks as Array<{ accept: string[] }>).map((b, i) => `Chỗ trống ${i + 1}: ${b.accept.join(' / ')}`);
};

// ---------------------------------------------------------------------- soạn câu hỏi (HK.GV.038)
const DraftCard: React.FC<{ session: Session; draft: QuestionDraft; onSaved: () => void; onDrop: () => void }> = ({ session, draft, onSaved, onDrop }) => {
  const { c } = useTheme();
  const { busy, run } = useAction(session.expired);
  const [edit, setEdit] = useState(false);
  const [saved, setSaved] = useState(false);
  const save = async (d: QuestionDraft) => {
    const res = await run(() => learning.createQuestion(session.token, { qtype: d.qtype, prompt: d.prompt, explanation: d.explanation, difficulty: d.difficulty, data: d.data as never }), 'Đã lưu vào ngân hàng câu hỏi của bạn');
    if (res) { setSaved(true); onSaved(); }
  };
  const fields: FieldDef[] = [
    { name: 'prompt', label: 'Nội dung câu hỏi', type: 'textarea', required: true, hint: draft.qtype === 'fill' ? 'Giữ nguyên chỗ trống ____' : undefined },
    ...(draft.qtype === 'truefalse' ? [{ name: 'correct', label: 'Đáp án', type: 'select' as const, options: [{ value: 'true', label: 'Đúng' }, { value: 'false', label: 'Sai' }] }] : []),
    ...(draft.qtype === 'single' ? [{ name: 'correct', label: 'Đáp án đúng', type: 'select' as const, options: (draft.data.options as Array<{ id: string; text: string }>).map((o) => ({ value: o.id, label: o.text })) }] : []),
    ...(draft.qtype === 'fill' ? [{ name: 'accept', label: 'Các cách viết đáp án được chấp nhận (cách nhau bằng dấu phẩy)', required: true }] : []),
    { name: 'explanation', label: 'Giải thích', type: 'textarea' },
    { name: 'difficulty', label: 'Độ khó', type: 'select', options: [{ value: '1', label: 'Dễ' }, { value: '2', label: 'Vừa' }, { value: '3', label: 'Khó' }] },
  ];
  const initial = { prompt: draft.prompt, explanation: draft.explanation, difficulty: String(draft.difficulty), correct: String(draft.data.correct), accept: ((draft.data.blanks as Array<{ accept: string[] }> | undefined)?.[0]?.accept ?? []).join(', ') };
  return (
    <Card flat pad={12} style={{ gap: 6, opacity: saved ? 0.7 : 1 }}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Chip text={{ single: 'Một đáp án', truefalse: 'Đúng / sai', fill: 'Điền khuyết' }[draft.qtype]} bg={c.thuyNhat} fg={c.thuyChu} />
        <Chip text={['', 'Dễ', 'Vừa', 'Khó'][draft.difficulty]} bg={c.the2} fg={c.muc2} />
        {saved ? <Chip text="Đã lưu" bg={c.ngocNhat} fg={c.ngocChu} /> : null}
      </View>
      <Txt f="semibold" size={15}>{draft.prompt}</Txt>
      {optionTitle(draft).map((l, i) => <Txt key={i} size={13} color={c.muc2}>{l}</Txt>)}
      {draft.explanation ? <Txt size={12} color={c.muc3}>Giải thích: {draft.explanation}</Txt> : null}
      {!saved ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Btn title="Sửa rồi lưu" tone="dong" size="sm" onPress={() => setEdit(true)} testID="draft-edit" />
          <Btn icon={Save} title="Lưu nguyên" tone="ngoc" size="sm" loading={busy} onPress={() => save(draft)} testID="draft-save" />
          <Btn icon={Trash2} label="Bỏ câu này" tone="giay" size="sm" onPress={onDrop} />
        </View>
      ) : null}
      {edit ? (
        <FormSheet title="Sửa câu hỏi trước khi lưu" fields={fields} initial={initial} onClose={() => setEdit(false)}
          onSubmit={async (v) => {
            const d: QuestionDraft = { ...draft, prompt: String(v.prompt).trim(), explanation: String(v.explanation ?? '').trim(), difficulty: Number(v.difficulty) || 2, data: { ...draft.data } };
            if (draft.qtype === 'truefalse') d.data = { correct: v.correct === 'true' };
            if (draft.qtype === 'single') d.data = { ...draft.data, correct: String(v.correct) };
            if (draft.qtype === 'fill') d.data = { blanks: [{ accept: String(v.accept).split(',').map((x) => x.trim()).filter(Boolean) }] };
            await learning.createQuestion(session.token, { qtype: d.qtype, prompt: d.prompt, explanation: d.explanation, difficulty: d.difficulty, data: d.data as never });
            setEdit(false); setSaved(true); onSaved();
          }} />
      ) : null}
    </Card>
  );
};

const QuestionMaker: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const options = useLoad(() => api.aiSummaryOptions(session.token), [session.token], session.expired);
  const { busy, run } = useAction(session.expired);
  const [kind, setKind] = useState<'lessons' | 'battles' | 'events' | 'text'>('lessons');
  const [picked, setPicked] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [count, setCount] = useState(5);
  const [res, setRes] = useState<DraftResult | null>(null);
  const [drafts, setDrafts] = useState<QuestionDraft[]>([]);
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const apiKind = { lessons: 'lesson', battles: 'battle', events: 'event', text: 'text' }[kind];
  const list = kind === 'text' ? [] : options.data?.[kind] ?? [];
  const go = async () => {
    const out = await run(() => api.aiQuestionDrafts(session.token, kind === 'text' ? { kind: 'text', text, count } : { kind: apiKind, id: picked ?? undefined, count }));
    if (out) { setRes(out); setDrafts(out.drafts); }
  };
  return (
    <View style={{ gap: 12 }}>
            <Card flat pad={14} style={{ backgroundColor: c.the, borderColor: c.ngoc, borderWidth: 1.5, gap: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 240, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Txt f="bold" size={15} color={c.muc}>Soạn đề khảo thí chuẩn SGK 7 & DVSKTT</Txt>
            <Chip text="5 nhóm chủ đề · Bloom" bg={c.ngocNhat} fg={c.ngocChu} />
          </View>
          <Txt size={13} color={c.muc2}>Sinh bộ trắc nghiệm 4 đáp án đối chiếu căn cứ sử liệu chính thức, phân bổ nhận thức và lưu thẳng vào Ngân hàng.</Txt>
        </View>
        <Btn icon={Sparkles} title="Mở bộ soạn đề AI" tone="ngoc" onPress={() => setQuizModalOpen(true)} />
      </Card>
      {quizModalOpen ? <AiQuizModal open={quizModalOpen} onClose={() => setQuizModalOpen(false)} session={session} /> : null}
      <Txt size={14}>Hoặc chọn một bài học, trận đánh, sự kiện hoặc dán văn bản tự do: Hệ thống soạn bản nháp câu hỏi; thầy cô đọc, sửa và bấm lưu thì câu hỏi mới vào ngân hàng của thầy cô. Không có câu nào tự lưu.</Txt>
      <Segmented<typeof kind> label="Nguồn nội dung" value={kind} onChange={(k) => { setKind(k); setPicked(null); }} options={[{ value: 'lessons', label: 'Bài học' }, { value: 'battles', label: 'Trận đánh' }, { value: 'events', label: 'Sự kiện' }, { value: 'text', label: 'Dán văn bản' }]} />
      <ErrorNote message={options.error} />
      {kind === 'text' ? <Field label="Văn bản tư liệu (tối thiểu 80 ký tự)" value={text} onChangeText={setText} multiline numberOfLines={6} inputStyle={{ minHeight: 140, textAlignVertical: 'top' }} nativeID="draft-text" />
        : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{list.map((o) => <Btn key={o.id} title={o.title} tone={picked === o.id ? 'ngoc' : 'giay'} size="sm" onPress={() => setPicked(o.id)} />)}</View>}
      <Segmented<number> label="Số câu" value={count} onChange={setCount} options={[3, 5, 8].map((n) => ({ value: n, label: `${n} câu` }))} />
      <View style={{ flexDirection: 'row' }}><Btn icon={Sparkles} title="Soạn câu hỏi" tone="son" loading={busy} disabled={kind === 'text' ? text.trim().length < 80 : picked === null} onPress={go} testID="draft-run" /></View>
      {res ? <InfoNote><Txt size={13}>{res.note}</Txt></InfoNote> : null}
      {res && !drafts.length ? <EmptyState mood="thinking" title="Đã xử lý hết các bản nháp" /> : null}
      {drafts.map((d, i) => <DraftCard key={`${res?.conversation_id}-${i}-${d.prompt}`} session={session} draft={d} onSaved={() => undefined} onDrop={() => setDrafts((all) => all.filter((_, j) => j !== i))} />)}
    </View>
  );
};

// ---------------------------------------------------------------------- kịch bản tiết học (HK.GV.075)
const PlanMaker: React.FC<{ session: Session }> = ({ session }) => {
  const toast = useToast();
  const journeys = useLoad(() => learning.listJourneys(session.token), [session.token], session.expired);
  const options = useLoad(() => api.aiSummaryOptions(session.token), [session.token], session.expired);
  const { busy, run } = useAction(session.expired);
  const [source, setSource] = useState<'journey' | 'battle'>('journey');
  const [picked, setPicked] = useState<number | null>(null);
  const [minutes, setMinutes] = useState(45);
  const [note, setNote] = useState('');
  const [res, setRes] = useState<PlanResult | null>(null);
  const list = source === 'journey' ? (journeys.data ?? []).map((j) => ({ id: j.id, title: j.title })) : options.data?.battles ?? [];
  const go = async () => { const out = await run(() => api.aiLessonPlan(session.token, { ...(source === 'journey' ? { journey_id: picked ?? undefined } : { battle_id: picked ?? undefined }), minutes, note })); if (out) setRes(out); };
  return (
    <View style={{ gap: 12 }}>
      <Txt size={14}>Chọn một hành trình hoặc một trận đánh, hệ thống gợi ý kịch bản tiết học có dùng nền tảng. Thầy cô điều chỉnh theo lớp của mình.</Txt>
      <Segmented<typeof source> label="Dựa trên" value={source} onChange={(v) => { setSource(v); setPicked(null); }} options={[{ value: 'journey', label: 'Hành trình' }, { value: 'battle', label: 'Trận đánh' }]} />
      <ErrorNote message={journeys.error ?? options.error} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{list.map((o) => <Btn key={o.id} title={o.title} tone={picked === o.id ? 'ngoc' : 'giay'} size="sm" onPress={() => setPicked(o.id)} />)}</View>
      <Segmented<number> label="Thời lượng" value={minutes} onChange={setMinutes} options={[15, 30, 45, 90].map((n) => ({ value: n, label: `${n} phút` }))} />
      <Field label="Ghi chú cho kịch bản (không bắt buộc)" value={note} onChangeText={setNote} placeholder="Ví dụ: lớp đông, phòng không có máy chiếu…" maxLength={300} nativeID="plan-note" />
      <View style={{ flexDirection: 'row' }}><Btn icon={ClipboardList} title="Gợi ý kịch bản" tone="son" loading={busy} disabled={picked === null} onPress={go} testID="plan-run" /></View>
      {busy ? <Spinner label="Đang soạn kịch bản…" /> : null}
      {res ? (
        <Card flat pad={14} style={{ gap: 8 }}>
          <InfoNote><Txt size={13}>{res.note}</Txt></InfoNote>
          <Txt size={14} style={{ lineHeight: 22 }} selectable>{res.text}</Txt>
          <View style={{ flexDirection: 'row' }}><Btn title="Sao chép nội dung" tone="giay" size="sm" onPress={() => { const nav = (globalThis as { navigator?: { clipboard?: { writeText: (s: string) => Promise<void> } } }).navigator; if (nav?.clipboard) void nav.clipboard.writeText(res.text).then(() => toast('Đã sao chép')); else toast('Hãy chọn và sao chép văn bản ở trên'); }} /></View>
        </Card>
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------------------- chủ đề học sinh hỏi (HK.GV.074)
const Topics: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const [days, setDays] = useState(30);
  const topics = useLoad(() => api.aiTopics(session.token, days), [session.token, days], session.expired);
  const d = topics.data;
  return (
    <View style={{ gap: 12 }}>
      <Segmented<number> label="Khoảng thời gian" value={days} onChange={setDays} options={[7, 30, 90].map((n) => ({ value: n, label: `${n} ngày` }))} />
      <ErrorNote message={topics.error} />
      {topics.loading && !d ? <Spinner /> : null}
      {d ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip text={`${d.questions} câu hỏi`} bg={c.thuyNhat} fg={c.thuyChu} />
            <Chip text={`${d.students} học sinh đã hỏi`} bg={c.ngocNhat} fg={c.ngocChu} />
            <Chip text={`${d.refused} câu ngoài phạm vi`} bg={c.the2} fg={c.muc2} />
          </View>
          <InfoNote><Txt size={13}>{d.note}</Txt></InfoNote>
          {!d.topics.length ? <EmptyState mood="thinking" title="Chưa có câu hỏi nào trong khoảng thời gian này" text="Khi học sinh trong các lớp của thầy cô hỏi Tiểu Tướng, các chủ đề được hỏi nhiều sẽ hiện ở đây." /> : null}
          {d.topics.length ? (
            <DataTable rows={d.topics} rowKey={(r) => `${r.kind}${r.id}`} empty="Chưa có chủ đề"
              columns={[{ key: 't', label: 'Chủ đề được nhắc tới', flex: 3, render: (r) => <Cell main={r.title} sub={KIND_LABEL[r.kind] ?? r.kind} /> }, { key: 'n', label: 'Số lượt hỏi', render: (r) => <Txt f="bold" size={14}>{r.asked}</Txt> }]} />
          ) : null}
          {d.keywords.length ? (
            <View style={{ gap: 6 }}>
              <Txt f="bold" size={14}>Từ khóa hay gặp trong câu hỏi</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{d.keywords.map((k) => <Chip key={k.word} text={`${k.word} · ${k.count}`} bg={c.dongNhat} fg={c.dongChu} />)}</View>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
};

export const AiTeacher: React.FC<{ session: Session }> = ({ session }) => {
  const [part, setPart] = useState<Part>('ask');
  const [detail, setDetail] = useState<{ type: string; id: number } | null>(null);
  return (
    <Page>
      <PageHeader title="Trợ lý AI" subtitle="Hỏi đáp tư liệu, thống kê câu hỏi của học sinh, soạn câu hỏi và kịch bản tiết học. Nội dung do AI soạn luôn cần thầy cô duyệt." />
      <Segmented<Part> label="Mục trợ lý" value={part} onChange={setPart}
        options={[{ value: 'ask', label: 'Hỏi đáp tư liệu' }, { value: 'topics', label: 'Học sinh hỏi gì' }, { value: 'questions', label: 'Soạn câu hỏi' }, { value: 'plan', label: 'Kịch bản tiết học' }, { value: 'hub', label: 'Trung tâm AI Hub' }]} />
      {part === 'ask' ? <ChatPanel session={session} mode="teacher" onOpen={(kind, id) => setDetail({ type: kind, id })} samples={['Hội nghị Diên Hồng diễn ra khi nào?', 'Trận Bạch Đằng có những chi tiết nào đáng chú ý?', 'Hịch tướng sĩ do ai viết?']} placeholder="Thầy cô muốn tra cứu điều gì?" /> : null}
      {part === 'topics' ? <Topics session={session} /> : null}
      {part === 'questions' ? <QuestionMaker session={session} /> : null}
      {part === 'plan' ? <PlanMaker session={session} /> : null}
      {part === 'hub' ? <AiHubDashboard session={session} onOpenSource={(kind, id) => setDetail({ type: kind, id })} /> : null}
      {detail ? <DetailSheet session={session} type={detail.type} id={detail.id} onClose={() => setDetail(null)} onOpen={(type, id) => setDetail({ type, id })} /> : null}
    </Page>
  );
};

