/**
 * Trợ lý AI cho Giáo viên — Đồng bộ giao diện AI Hub Đông A (4 công cụ giảng dạy & khảo thí):
 * 1. Hỏi đáp tư liệu có trích dẫn SGK 7 & ĐVSKTT + Nhập vai Danh tướng (HK.GV.073)
 * 2. Số hóa Đề thi Word (.docx), Biên tập trực quan & Trộn mã đề 101–104 (SmartExamStudio)
 * 3. Soạn bản nháp câu hỏi AI (duyệt trước khi lưu vào Ngân hàng - HK.GV.038), Soạn đề Bloom (AiQuizModal) & Gợi ý kịch bản tiết học (HK.GV.075)
 * 4. Thống kê ẩn danh "Học sinh hỏi gì" để giáo viên điều chỉnh trọng tâm giảng dạy (HK.GV.074)
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  ArrowLeft,
  Bot,
  ChartColumn,
  ClipboardList,
  ListChecks,
  MessageSquareText,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react-native';
import * as api from '@/api/aiApi';
import * as learning from '@/api/learningApi';
import { AiQuizModal } from '@/components/admin/AiQuizModal';
import {
  Cell,
  DataTable,
  ErrorNote,
  FormSheet,
  useAction,
  useLoad,
  type FieldDef,
} from '@/components/admin/kit';
import { SmartExamStudio } from '@/components/admin/SmartExamStudio';
import type { Session } from '@/components/auth';
import { DetailSheet } from '@/components/portal/Library';
import { ChatPanel } from '@/components/portal/TieuTuong';
import { Btn, Card, Chip, EmptyState, Field, InfoNote, Segmented, Spinner, Txt, useToast } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { DraftResult, PlanResult, QuestionDraft } from '@/types/ai';

type TeacherAiView = 'hub' | 'ask' | 'smart_exam' | 'authoring' | 'topics';
type AuthoringTab = 'questions' | 'plan';

const KIND_LABEL: Record<string, string> = {
  figure: 'Nhân vật',
  event: 'Sự kiện',
  place: 'Địa danh',
  battle: 'Trận đánh',
  source: 'Tư liệu',
  term: 'Thuật ngữ',
  lesson: 'Bài học',
  doc: 'Tài liệu',
};

const TEACHER_ROLEPLAY_FIGURES = [
  { id: 1, name: 'Trần Hưng Đạo', role: 'Quốc Công Tiết Chế', quote: 'Nếu bệ hạ muốn hàng, xin hãy chém đầu thần trước đã!' },
  { id: 2, name: 'Trần Quốc Toản', role: 'Hoài Văn Hầu', quote: 'Phá cường địch, báo hoàng ân!' },
  { id: 3, name: 'Trần Thủ Độ', role: 'Thái Sư', quote: 'Đầu thần chưa rơi xuống đất, xin bệ hạ đừng lo!' },
  { id: 4, name: 'Trần Bình Trọng', role: 'Bảo Nghĩa Vương', quote: 'Ta thà làm quỷ nước Nam, chứ không thèm làm vương đất Bắc!' },
  { id: 5, name: 'Trần Nhân Tông', role: 'Phật Hoàng Trúc Lâm', quote: 'Xã tắc hai phen chồn ngựa đá / Non sông nghìn thuở vững âu vàng.' },
  { id: 6, name: 'Trần Khánh Dư', role: 'Nhân Huệ Vương', quote: 'Đánh đắm đoàn thuyền lương Vân Đồn, bẻ gãy dạ dày giặc Nguyên!' },
  { id: 7, name: 'Phạm Ngũ Lão', role: 'Điện Súy', quote: 'Múa giáo non sông trải mấy thu / Ba quân khí mạnh nuốt trôi trâu.' },
  { id: 8, name: 'Yết Kiêu', role: 'Danh Tướng Thủy Chiến', quote: 'Dưới làn nước sâu sông Bạch Đằng, một lòng đục thuyền giặc giữ non sông!' },
];

const optionTitle = (d: QuestionDraft): string[] => {
  if (d.qtype === 'single') {
    const o = d.data.options as Array<{ id: string; text: string }>;
    return o.map((x) => `${x.id === d.data.correct ? '✓' : '○'} ${x.text}`);
  }
  if (d.qtype === 'truefalse') return [`Đáp án: ${d.data.correct ? 'Đúng' : 'Sai'}`];
  return (d.data.blanks as Array<{ accept: string[] }>).map((b, i) => `Chỗ trống ${i + 1}: ${b.accept.join(' / ')}`);
};

// ---------------------------------------------------------------------- Soạn câu hỏi bản nháp (HK.GV.038)
const DraftCard: React.FC<{ session: Session; draft: QuestionDraft; onSaved: () => void; onDrop: () => void }> = ({
  session,
  draft,
  onSaved,
  onDrop,
}) => {
  const { c } = useTheme();
  const { busy, run } = useAction(session.expired);
  const [edit, setEdit] = useState(false);
  const [saved, setSaved] = useState(false);
  const save = async (d: QuestionDraft) => {
    const res = await run(
      () =>
        learning.createQuestion(session.token, {
          qtype: d.qtype,
          prompt: d.prompt,
          explanation: d.explanation,
          difficulty: d.difficulty,
          data: d.data as never,
        }),
      'Đã lưu vào ngân hàng câu hỏi của bạn',
    );
    if (res) {
      setSaved(true);
      onSaved();
    }
  };
  const fields: FieldDef[] = [
    {
      name: 'prompt',
      label: 'Nội dung câu hỏi',
      type: 'textarea',
      required: true,
      hint: draft.qtype === 'fill' ? 'Giữ nguyên chỗ trống ____' : undefined,
    },
    ...(draft.qtype === 'truefalse'
      ? [{ name: 'correct', label: 'Đáp án', type: 'select' as const, options: [{ value: 'true', label: 'Đúng' }, { value: 'false', label: 'Sai' }] }]
      : []),
    ...(draft.qtype === 'single'
      ? [
          {
            name: 'correct',
            label: 'Đáp án đúng',
            type: 'select' as const,
            options: (draft.data.options as Array<{ id: string; text: string }>).map((o) => ({ value: o.id, label: o.text })),
          },
        ]
      : []),
    ...(draft.qtype === 'fill'
      ? [{ name: 'accept', label: 'Các cách viết đáp án được chấp nhận (cách nhau bằng dấu phẩy)', required: true }]
      : []),
    { name: 'explanation', label: 'Giải thích', type: 'textarea' },
    {
      name: 'difficulty',
      label: 'Độ khó',
      type: 'select',
      options: [
        { value: '1', label: 'Dễ' },
        { value: '2', label: 'Vừa' },
        { value: '3', label: 'Khó' },
      ],
    },
  ];
  const initial = {
    prompt: draft.prompt,
    explanation: draft.explanation,
    difficulty: String(draft.difficulty),
    correct: String(draft.data.correct),
    accept: ((draft.data.blanks as Array<{ accept: string[] }> | undefined)?.[0]?.accept ?? []).join(', '),
  };

  return (
    <Card flat pad={12} style={{ gap: 6, opacity: saved ? 0.7 : 1 }}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Chip text={{ single: 'Một đáp án', truefalse: 'Đúng / sai', fill: 'Điền khuyết' }[draft.qtype]} bg={c.thuyNhat} fg={c.thuyChu} />
        <Chip text={['', 'Dễ', 'Vừa', 'Khó'][draft.difficulty]} bg={c.the2} fg={c.muc2} />
        {saved ? <Chip text="Đã lưu" bg={c.ngocNhat} fg={c.ngocChu} /> : null}
      </View>
      <Txt f="semibold" size={15}>{draft.prompt}</Txt>
      {optionTitle(draft).map((l, i) => (
        <Txt key={i} size={13} color={c.muc2}>{l}</Txt>
      ))}
      {draft.explanation ? <Txt size={12} color={c.muc3}>Giải thích: {draft.explanation}</Txt> : null}
      {!saved ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Btn title="Sửa rồi lưu" tone="dong" size="sm" onPress={() => setEdit(true)} testID="draft-edit" />
          <Btn icon={Save} title="Lưu nguyên" tone="ngoc" size="sm" loading={busy} onPress={() => save(draft)} testID="draft-save" />
          <Btn icon={Trash2} label="Bỏ câu này" tone="giay" size="sm" onPress={onDrop} />
        </View>
      ) : null}
      {edit ? (
        <FormSheet
          title="Sửa câu hỏi trước khi lưu"
          fields={fields}
          initial={initial}
          onClose={() => setEdit(false)}
          onSubmit={async (v) => {
            const d: QuestionDraft = {
              ...draft,
              prompt: String(v.prompt).trim(),
              explanation: String(v.explanation ?? '').trim(),
              difficulty: Number(v.difficulty) || 2,
              data: { ...draft.data },
            };
            if (draft.qtype === 'truefalse') d.data = { correct: v.correct === 'true' };
            if (draft.qtype === 'single') d.data = { ...draft.data, correct: String(v.correct) };
            if (draft.qtype === 'fill') {
              d.data = {
                blanks: [{ accept: String(v.accept).split(',').map((x) => x.trim()).filter(Boolean) }],
              };
            }
            await learning.createQuestion(session.token, {
              qtype: d.qtype,
              prompt: d.prompt,
              explanation: d.explanation,
              difficulty: d.difficulty,
              data: d.data as never,
            });
            setEdit(false);
            setSaved(true);
            onSaved();
          }}
        />
      ) : null}
    </Card>
  );
};

const QuestionMaker: React.FC<{ session: Session; onOpenSmartExam?: () => void }> = ({ session, onOpenSmartExam }) => {
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
    const out = await run(() =>
      api.aiQuestionDrafts(
        session.token,
        kind === 'text' ? { kind: 'text', text, count } : { kind: apiKind, id: picked ?? undefined, count },
      ),
    );
    if (out) {
      setRes(out);
      setDrafts(out.drafts);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Card
        flat
        pad={14}
        style={{
          backgroundColor: c.the,
          borderColor: c.ngoc,
          borderWidth: 1.5,
          gap: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <View style={{ flex: 1, minWidth: 240, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Txt f="bold" size={15} color={c.muc}>Soạn đề khảo thí chuẩn SGK 7 & ĐVSKTT</Txt>
            <Chip text="5 nhóm chủ đề · Bloom" bg={c.ngocNhat} fg={c.ngocChu} />
          </View>
          <Txt size={13} color={c.muc2}>
            Sinh nhanh bộ trắc nghiệm 4 đáp án đối chiếu căn cứ sử liệu chính thức hoặc chuyển sang Số hóa Đề Word (.docx) & Trộn mã đề.
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Btn icon={Sparkles} title="Soạn đề AI theo ma trận Bloom" tone="son" size="sm" onPress={() => setQuizModalOpen(true)} />
          {onOpenSmartExam ? (
            <Btn icon={ListChecks} title="Số hóa Đề Word (.docx)" tone="thuy" size="sm" onPress={onOpenSmartExam} />
          ) : null}
        </View>
      </Card>

      {quizModalOpen ? <AiQuizModal open={quizModalOpen} onClose={() => setQuizModalOpen(false)} session={session} /> : null}

      <Txt size={13} color={c.muc2}>
        Hoặc chọn một bài học, trận đánh, sự kiện hoặc dán văn bản tự do: Hệ thống soạn bản nháp câu hỏi; thầy cô đọc, sửa rồi bấm lưu thì câu hỏi mới vào ngân hàng của thầy cô.
      </Txt>
      <Segmented<typeof kind>
        label="Nguồn nội dung"
        value={kind}
        onChange={(k) => {
          setKind(k);
          setPicked(null);
        }}
        options={[
          { value: 'lessons', label: 'Bài học' },
          { value: 'battles', label: 'Trận đánh' },
          { value: 'events', label: 'Sự kiện' },
          { value: 'text', label: 'Dán văn bản' },
        ]}
      />
      <ErrorNote message={options.error} />
      {kind === 'text' ? (
        <Field
          label="Văn bản tư liệu (tối thiểu 80 ký tự)"
          value={text}
          onChangeText={setText}
          multiline
          numberOfLines={6}
          inputStyle={{ minHeight: 140, textAlignVertical: 'top' }}
          nativeID="draft-text"
        />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {list.map((o) => (
            <Btn key={o.id} title={o.title} tone={picked === o.id ? 'ngoc' : 'giay'} size="sm" onPress={() => setPicked(o.id)} />
          ))}
        </View>
      )}
      <Segmented<number> label="Số câu" value={count} onChange={setCount} options={[3, 5, 8].map((n) => ({ value: n, label: `${n} câu` }))} />
      <View style={{ flexDirection: 'row' }}>
        <Btn
          icon={Sparkles}
          title="Soạn câu hỏi nháp"
          tone="son"
          loading={busy}
          disabled={kind === 'text' ? text.trim().length < 80 : picked === null}
          onPress={go}
          testID="draft-run"
        />
      </View>
      {res ? <InfoNote><Txt size={13}>{res.note}</Txt></InfoNote> : null}
      {res && !drafts.length ? <EmptyState mood="thinking" title="Đã xử lý hết các bản nháp" /> : null}
      {drafts.map((d, i) => (
        <DraftCard
          key={`${res?.conversation_id}-${i}-${d.prompt}`}
          session={session}
          draft={d}
          onSaved={() => undefined}
          onDrop={() => setDrafts((all) => all.filter((_, j) => j !== i))}
        />
      ))}
    </View>
  );
};

// ---------------------------------------------------------------------- Kịch bản tiết học (HK.GV.075)
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
  const go = async () => {
    const out = await run(() =>
      api.aiLessonPlan(session.token, {
        ...(source === 'journey' ? { journey_id: picked ?? undefined } : { battle_id: picked ?? undefined }),
        minutes,
        note,
      }),
    );
    if (out) setRes(out);
  };
  return (
    <View style={{ gap: 12 }}>
      <Txt size={14}>Chọn một hành trình hoặc một trận đánh, hệ thống gợi ý kịch bản tiết học có dùng nền tảng. Thầy cô điều chỉnh theo lớp của mình.</Txt>
      <Segmented<typeof source>
        label="Dựa trên"
        value={source}
        onChange={(v) => {
          setSource(v);
          setPicked(null);
        }}
        options={[
          { value: 'journey', label: 'Hành trình' },
          { value: 'battle', label: 'Trận đánh' },
        ]}
      />
      <ErrorNote message={journeys.error ?? options.error} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {list.map((o) => (
          <Btn key={o.id} title={o.title} tone={picked === o.id ? 'ngoc' : 'giay'} size="sm" onPress={() => setPicked(o.id)} />
        ))}
      </View>
      <Segmented<number> label="Thời lượng" value={minutes} onChange={setMinutes} options={[15, 30, 45, 90].map((n) => ({ value: n, label: `${n} phút` }))} />
      <Field
        label="Ghi chú cho kịch bản (không bắt buộc)"
        value={note}
        onChangeText={setNote}
        placeholder="Ví dụ: lớp đông, phòng không có máy chiếu…"
        maxLength={300}
        nativeID="plan-note"
      />
      <View style={{ flexDirection: 'row' }}>
        <Btn icon={ClipboardList} title="Gợi ý kịch bản" tone="son" loading={busy} disabled={picked === null} onPress={go} testID="plan-run" />
      </View>
      {busy ? <Spinner label="Đang soạn kịch bản…" /> : null}
      {res ? (
        <Card flat pad={14} style={{ gap: 8 }}>
          <InfoNote><Txt size={13}>{res.note}</Txt></InfoNote>
          <Txt size={14} style={{ lineHeight: 22 }} selectable>{res.text}</Txt>
          <View style={{ flexDirection: 'row' }}>
            <Btn
              title="Sao chép nội dung"
              tone="giay"
              size="sm"
              onPress={() => {
                const nav = (globalThis as { navigator?: { clipboard?: { writeText: (s: string) => Promise<void> } } }).navigator;
                if (nav?.clipboard) void nav.clipboard.writeText(res.text).then(() => toast('Đã sao chép'));
                else toast('Hãy chọn và sao chép văn bản ở trên');
              }}
            />
          </View>
        </Card>
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------------------- Chủ đề học sinh hỏi (HK.GV.074)
const Topics: React.FC<{ session: Session }> = ({ session }) => {
  const { c } = useTheme();
  const [days, setDays] = useState(30);
  const topics = useLoad(() => api.aiTopics(session.token, days), [session.token, days], session.expired);
  const d = topics.data;
  return (
    <View style={{ gap: 12 }}>
      <Segmented<number>
        label="Khoảng thời gian"
        value={days}
        onChange={setDays}
        options={[7, 30, 90].map((n) => ({ value: n, label: `${n} ngày` }))}
      />
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
          {!d.topics.length ? (
            <EmptyState
              mood="thinking"
              title="Chưa có câu hỏi nào trong khoảng thời gian này"
              text="Khi học sinh trong các lớp của thầy cô hỏi Trợ lý AI, các chủ đề được hỏi nhiều sẽ hiện ở đây."
            />
          ) : null}
          {d.topics.length ? (
            <DataTable
              rows={d.topics}
              rowKey={(r) => `${r.kind}${r.id}`}
              empty="Chưa có chủ đề"
              columns={[
                { key: 't', label: 'Chủ đề được nhắc tới', flex: 3, render: (r) => <Cell main={r.title} sub={KIND_LABEL[r.kind] ?? r.kind} /> },
                { key: 'n', label: 'Số lượt hỏi', render: (r) => <Txt f="bold" size={14}>{r.asked}</Txt> },
              ]}
            />
          ) : null}
          {d.keywords.length ? (
            <View style={{ gap: 6 }}>
              <Txt f="bold" size={14}>Từ khóa hay gặp trong câu hỏi</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {d.keywords.map((k) => (
                  <Chip key={k.word} text={`${k.word} · ${k.count}`} bg={c.dongNhat} fg={c.dongChu} />
                ))}
              </View>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
};

// ---------------------------------------------------------------------- Component chính: AiTeacher (đồng bộ AI Hub Đông A)
export const AiTeacher: React.FC<{ session: Session; onGoLibrary?: () => void }> = ({ session, onGoLibrary }) => {
  const { c } = useTheme();
  const [activeView, setActiveView] = useState<TeacherAiView>('hub');
  const [authoringTab, setAuthoringTab] = useState<AuthoringTab>('questions');
  const [askTab, setAskTab] = useState<'chat' | 'roleplay'>('chat');
  const [selectedFigure, setSelectedFigure] = useState<typeof TEACHER_ROLEPLAY_FIGURES[0] | null>(null);
  const [detail, setDetail] = useState<{ type: string; id: number } | null>(null);
  const topicsSummary = useLoad(() => api.aiTopics(session.token, 30), [session.token], session.expired);

  // ======================================================================
  // 1. GIAO DIỆN HUB TRỢ LÝ AI GIÁO VIÊN (ĐỒNG BỘ PHONG CÁCH VỚI AI HUB HỌC SINH)
  // ======================================================================
  if (activeView === 'hub') {
    const td = topicsSummary.data;

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 24, paddingBottom: 60, gap: 22, maxWidth: 980, alignSelf: 'center', width: '100%' }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header chào mừng */}
        <View style={{ alignItems: 'center', gap: 8, paddingTop: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Txt size={22}>👋</Txt>
            <Txt f="displayHeavy" size={24} color={c.muc}>
              Trợ lý AI Giảng dạy Đông A — Hào Khí Đông A
            </Txt>
          </View>
          <Txt f="bold" size={20} center color={c.muc}>
            Tra cứu Sử liệu • Số hóa Đề Word • Soạn Câu hỏi & Kịch bản
          </Txt>
          <Txt size={14} center color={c.muc2} style={{ maxWidth: 700 }}>
            Không gian AI dành riêng cho Thầy Cô Lịch sử 7: Hỏi đáp đối chiếu SGK & ĐVSKTT, bóc tách đề Word (.docx) & trộn mã đề, soạn câu hỏi/kịch bản tiết học và theo dõi câu hỏi học sinh.
          </Txt>
        </View>

        {/* Lưới 3 Thẻ Tính năng chính (Đồng bộ thiết kế 3 Card với Student AI Hub) */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
          {/* Card 1: Hỏi đáp Sử liệu & Nhập vai */}
          <Pressable
            onPress={() => {
              setAskTab('chat');
              setActiveView('ask');
            }}
            testID="teacher-ai-ask-card"
            style={({ pressed }) => ({
              flexGrow: 1,
              flexBasis: 270,
              maxWidth: 310,
              minHeight: 168,
              padding: 20,
              borderRadius: 18,
              backgroundColor: pressed ? c.the2 : c.the,
              borderWidth: 1.5,
              borderColor: c.vien,
              gap: 10,
              justifyContent: 'space-between',
            })}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={22} color="#4F46E5" />
              </View>
              <Chip text="SGK 7 • 8 Danh tướng" bg={c.thuyNhat} fg={c.thuyChu} />
            </View>
            <View style={{ gap: 4 }}>
              <Txt f="bold" size={17} color={c.muc}>Hỏi đáp Sử liệu & Nhập vai</Txt>
              <Txt size={13} color={c.muc2} numberOfLines={3}>
                Tra cứu sử liệu có trích dẫn nguồn chính sử & mở chế độ đàm đạo nhập vai 8 danh tướng thời Trần để minh họa tiết học.
              </Txt>
            </View>
          </Pressable>

          {/* Card 2: Số hóa Đề Word (.docx) & Trộn đề */}
          <Pressable
            onPress={() => setActiveView('smart_exam')}
            testID="teacher-ai-smart-exam-card"
            style={({ pressed }) => ({
              flexGrow: 1,
              flexBasis: 270,
              maxWidth: 310,
              minHeight: 168,
              padding: 20,
              borderRadius: 18,
              backgroundColor: pressed ? c.the2 : c.the,
              borderWidth: 1.5,
              borderColor: c.vien,
              gap: 10,
              justifyContent: 'space-between',
            })}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' }}>
                <ListChecks size={22} color="#059669" />
              </View>
              <Chip text="Word .docx • Trộn đề" bg={c.ngocNhat} fg={c.ngocChu} />
            </View>
            <View style={{ gap: 4 }}>
              <Txt f="bold" size={17} color={c.muc}>Số hóa Đề Word & Trộn đề</Txt>
              <Txt size={13} color={c.muc2} numberOfLines={3}>
                Tải lên đề thi .docx bất kỳ để tự động bóc tách 9 dạng câu hỏi, biên tập trực quan, trình chiếu và trộn mã đề 101–104.
              </Txt>
            </View>
          </Pressable>

          {/* Card 3: Soạn câu hỏi & Kịch bản tiết học */}
          <Pressable
            onPress={() => {
              setAuthoringTab('questions');
              setActiveView('authoring');
            }}
            testID="teacher-ai-authoring-card"
            style={({ pressed }) => ({
              flexGrow: 1,
              flexBasis: 270,
              maxWidth: 310,
              minHeight: 168,
              padding: 20,
              borderRadius: 18,
              backgroundColor: pressed ? c.the2 : c.the,
              borderWidth: 1.5,
              borderColor: c.vien,
              gap: 10,
              justifyContent: 'space-between',
            })}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center' }}>
                <ClipboardList size={22} color="#EA580C" />
              </View>
              <Chip text="Bloom • Tiết 15–90p" bg={c.dongNhat} fg={c.dongChu} />
            </View>
            <View style={{ gap: 4 }}>
              <Txt f="bold" size={17} color={c.muc}>Soạn Câu hỏi & Kịch bản</Txt>
              <Txt size={13} color={c.muc2} numberOfLines={3}>
                Sinh câu hỏi trắc nghiệm từ SGK/tư liệu (thầy cô duyệt trước khi lưu Ngân hàng) và gợi ý kịch bản tiết học dùng nền tảng.
              </Txt>
            </View>
          </Pressable>
        </View>

        {/* Thẻ Tổng hợp bên dưới: Nhu cầu Học tập Lớp học ("Học sinh hỏi gì") */}
        <Card style={{ padding: 18, gap: 14, borderRadius: 18 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 240 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: c.dongNhat, alignItems: 'center', justifyContent: 'center' }}>
                <MessageSquareText size={19} color={c.dongChu} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Txt f="bold" size={16} color={c.muc}>
                    Tổng hợp Chủ đề Học sinh Hỏi AI (30 ngày)
                  </Txt>
                  <Chip text="Ẩn danh · Theo lớp" bg={c.thuyNhat} fg={c.thuyChu} />
                </View>
                <Txt size={12} color={c.muc2}>
                  Thống kê ẩn danh những chủ đề học sinh hay hỏi Trợ lý AI để thầy cô điều chỉnh trọng tâm bài giảng
                </Txt>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <Btn
                icon={ChartColumn}
                title="Xem thống kê chi tiết"
                tone="ngoc"
                size="sm"
                onPress={() => setActiveView('topics')}
                testID="teacher-ai-topics-btn"
              />
              <Btn
                icon={RefreshCw}
                title="Làm mới"
                tone="giay"
                size="sm"
                loading={topicsSummary.loading}
                onPress={topicsSummary.reload}
              />
            </View>
          </View>

          {topicsSummary.loading && !td ? (
            <Spinner label="Đang tổng hợp câu hỏi học sinh trong 30 ngày qua…" />
          ) : td ? (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip text={`${td.questions} lượt hỏi`} bg={c.thuyNhat} fg={c.thuyChu} />
                <Chip text={`${td.students} học sinh đã hỏi`} bg={c.ngocNhat} fg={c.ngocChu} />
                <Chip text={`${td.refused} câu ngoài phạm vi`} bg={c.the2} fg={c.muc2} />
              </View>
              {td.topics.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {td.topics.slice(0, 4).map((tp) => (
                    <View
                      key={`${tp.kind}-${tp.id}`}
                      style={{
                        width: '48%',
                        flexGrow: 1,
                        minWidth: 260,
                        padding: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: c.vien,
                        backgroundColor: c.giay2,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Txt f="bold" size={14} color={c.muc}>{tp.title}</Txt>
                        <Txt size={12} color={c.muc3}>{KIND_LABEL[tp.kind] ?? tp.kind}</Txt>
                      </View>
                      <Chip text={`${tp.asked} lượt hỏi`} bg={c.dongNhat} fg={c.dongChu} />
                    </View>
                  ))}
                </View>
              ) : (
                <Txt size={13} color={c.muc2}>
                  Chưa có câu hỏi nào từ học sinh trong 30 ngày qua. Thầy cô có thể dùng “Soạn Câu hỏi & Kịch bản” hoặc “Số hóa Đề Word” ở trên để chuẩn bị học liệu cho lớp.
                </Txt>
              )}
            </View>
          ) : (
            <Txt size={13} color={c.muc2}>
              Bấm “Xem thống kê chi tiết” để kiểm tra báo cáo câu hỏi theo 7, 30 hoặc 90 ngày.
            </Txt>
          )}
        </Card>
      </ScrollView>
    );
  }

  // ======================================================================
  // 2. GIAO DIỆN CON: HỎI ĐÁP SỬ LIỆU & NHẬP VAI (CỦA GIÁO VIÊN)
  // ======================================================================
  if (activeView === 'ask') {
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 80, gap: 16, maxWidth: 960, alignSelf: 'center', width: '100%' }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Btn icon={ArrowLeft} title="Quay lại Trợ lý AI" tone="giay" size="sm" onPress={() => { setSelectedFigure(null); setActiveView('hub'); }} />
          <Txt f="bold" size={18} color={c.muc} style={{ flex: 1 }}>Hỏi đáp Sử liệu & Minh họa Nhân vật</Txt>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Btn
              title="Tra cứu sử liệu"
              tone={askTab === 'chat' && !selectedFigure ? 'son' : 'giay'}
              size="sm"
              onPress={() => { setSelectedFigure(null); setAskTab('chat'); }}
            />
            <Btn
              title="Nhập vai Danh tướng"
              tone={askTab === 'roleplay' || selectedFigure ? 'son' : 'giay'}
              size="sm"
              onPress={() => setAskTab('roleplay')}
            />
          </View>
        </View>

        {askTab === 'roleplay' ? (
          selectedFigure ? (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Chip text={`Đang nhập vai: ${selectedFigure.role} ${selectedFigure.name}`} bg={c.sonNhat} fg={c.sonChu} />
                <Btn title="Chọn vị tướng khác" tone="giay" size="sm" onPress={() => setSelectedFigure(null)} />
              </View>
              <ChatPanel
                key={`teacher-rp-${selectedFigure.id}`}
                session={session}
                mode="roleplay"
                figure={{ id: selectedFigure.id, name: selectedFigure.name }}
                placeholder={`Thầy cô muốn đặt câu hỏi gì với ${selectedFigure.name}?`}
                samples={[
                  'Ngài nghĩ gì về âm mưu xâm lược của giặc Mông - Nguyên?',
                  'Kế sách đánh giặc quan trọng nhất của nhà Trần là gì?',
                  'Ý nghĩa câu nói nổi tiếng của ngài trong lịch sử là gì?',
                ]}
              />
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <Txt size={14} color={c.muc2}>
                Chọn một danh tướng thời Trần để trình chiếu hoặc đối thoại trực tiếp phục vụ giảng dạy (hóa thân dựa trên chính sử):
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {TEACHER_ROLEPLAY_FIGURES.map((fig) => (
                  <Pressable
                    key={fig.id}
                    onPress={() => setSelectedFigure(fig)}
                    style={({ pressed }) => ({
                      flexGrow: 1,
                      flexBasis: 260,
                      padding: 16,
                      borderRadius: 16,
                      backgroundColor: pressed ? c.the2 : c.the,
                      borderWidth: 2,
                      borderColor: c.vien,
                      gap: 6,
                    })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Txt f="bold" size={16} color={c.muc}>{fig.name}</Txt>
                      <Chip text={fig.role} bg={c.giay2} fg={c.muc2} />
                    </View>
                    <Txt size={12} color={c.muc3} style={{ fontStyle: 'italic' }}>“{fig.quote}”</Txt>
                  </Pressable>
                ))}
              </View>
            </View>
          )
        ) : (
          <ChatPanel
            session={session}
            mode="teacher"
            onOpen={(kind, id) => setDetail({ type: kind, id })}
            samples={[
              'Hội nghị Diên Hồng diễn ra khi nào?',
              'Trận Bạch Đằng có những chi tiết nào đáng chú ý?',
              'Hịch tướng sĩ do ai viết?',
            ]}
            placeholder="Thầy cô muốn tra cứu tư liệu lịch sử nào?"
          />
        )}

        {detail ? (
          <DetailSheet
            session={session}
            type={detail.type}
            id={detail.id}
            onClose={() => setDetail(null)}
            onOpen={(type, id) => setDetail({ type, id })}
          />
        ) : null}
      </ScrollView>
    );
  }

  // ======================================================================
  // 3. GIAO DIỆN CON: SỐ HÓA ĐỀ WORD (.DOCX) & TRỘN MÃ ĐỀ
  // ======================================================================
  if (activeView === 'smart_exam') {
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 80, gap: 16, maxWidth: 1180, alignSelf: 'center', width: '100%' }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Btn icon={ArrowLeft} title="Quay lại Trợ lý AI" tone="giay" size="sm" onPress={() => setActiveView('hub')} />
          <Txt f="bold" size={18} color={c.muc} style={{ flex: 1 }}>Số hóa Đề thi Word (.docx) & Trộn mã đề 101–104</Txt>
        </View>
        <SmartExamStudio
          session={session}
          initialMode="upload"
          authorName={session.user.full_name}
          onClose={() => setActiveView('hub')}
          onPublishedToLibrary={() => {
            if (onGoLibrary) onGoLibrary();
            else setActiveView('hub');
          }}
        />
      </ScrollView>
    );
  }

  // ======================================================================
  // 4. GIAO DIỆN CON: SOẠN CÂU HỎI & KỊCH BẢN TIẾT HỌC
  // ======================================================================
  if (activeView === 'authoring') {
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 80, gap: 16, maxWidth: 1020, alignSelf: 'center', width: '100%' }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Btn icon={ArrowLeft} title="Quay lại Trợ lý AI" tone="giay" size="sm" onPress={() => setActiveView('hub')} />
          <Txt f="bold" size={18} color={c.muc} style={{ flex: 1 }}>Soạn Câu hỏi & Kịch bản Tiết học</Txt>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Btn
              title="Soạn câu hỏi"
              tone={authoringTab === 'questions' ? 'son' : 'giay'}
              size="sm"
              onPress={() => setAuthoringTab('questions')}
            />
            <Btn
              title="Kịch bản tiết học"
              tone={authoringTab === 'plan' ? 'son' : 'giay'}
              size="sm"
              onPress={() => setAuthoringTab('plan')}
            />
          </View>
        </View>

        {authoringTab === 'questions' ? (
          <QuestionMaker session={session} onOpenSmartExam={() => setActiveView('smart_exam')} />
        ) : (
          <PlanMaker session={session} />
        )}
      </ScrollView>
    );
  }

  // ======================================================================
  // 5. GIAO DIỆN CON: THỐNG KÊ "HỌC SINH HỎI GÌ"
  // ======================================================================
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 20, paddingBottom: 80, gap: 16, maxWidth: 1020, alignSelf: 'center', width: '100%' }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Btn icon={ArrowLeft} title="Quay lại Trợ lý AI" tone="giay" size="sm" onPress={() => setActiveView('hub')} />
        <Txt f="bold" size={18} color={c.muc} style={{ flex: 1 }}>Thống kê Chủ đề Học sinh Hỏi AI</Txt>
      </View>
      <Topics session={session} />
    </ScrollView>
  );
};
