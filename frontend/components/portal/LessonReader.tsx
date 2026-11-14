/**
 * Đọc bài học (HK.HS.029–030, 037): các khối văn bản, hình, video, bản đồ; thời lượng và tiến độ đọc; câu kiểm tra nhanh cuối bài; ghi chú riêng.
 * Bài học hoàn thành khi em đọc hết và trả lời đúng mọi câu kiểm tra nhanh. `Overlay` là khung toàn màn hình dùng chung cho đọc bài và làm bài.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Linking, NativeScrollEvent, NativeSyntheticEvent, ScrollView, TextInput, View, type ScrollViewInstance } from 'react-native';
import { ArrowLeft, CheckCircle2, ExternalLink, Save, Target, Trash2, Video, XCircle } from 'lucide-react-native';
import * as api from '@/api/learningApi';
import * as classroom from '@/api/classroomApi';
import { ErrorNote, useAction, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { LeafletMap } from '@/components/portal/LeafletMap';
import { LessonCelebrationView } from '@/components/portal/LessonCelebrationView';
import { QuestionInput } from '@/components/portal/QuizPlayer';
import { Bar, Btn, Card, Chip, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { accuracyTagFor, type QuestDeltaItem } from '@/lib/learning-celebration';
import { useQuestSnapshot } from '@/lib/use-lesson-celebration';
import type { LessonBlock, LessonCompletion, PlayQuestion } from '@/types/learning';

/** Khung toàn màn hình phủ lên ứng dụng, có nút quay lại và vùng cuộn riêng */
export const Overlay: React.FC<{ title: string; onBack: () => void; children: React.ReactNode; onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void; footer?: React.ReactNode; resetKey?: unknown }> = ({ title, onBack, children, onScroll, footer, resetKey }) => {
  const { c } = useTheme();
  const scroller = useRef<ScrollViewInstance>(null);
  // Đổi bước (học từng bước) thì cuộn về đầu để em thấy ngay nội dung mới
  useEffect(() => { scroller.current?.scrollTo({ y: 0, animated: false }); }, [resetKey]);
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, backgroundColor: c.giay }}>
      <View style={{ minHeight: 56, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.the, borderBottomWidth: 2, borderBottomColor: c.vien }}>
        <Btn icon={ArrowLeft} label="Quay lại" tone="ghost" size="sm" onPress={onBack} testID="overlay-back" />
        <Txt f="bold" size={15} numberOfLines={1} style={{ flex: 1 }}>{title}</Txt>
      </View>
      <ScrollView ref={scroller} onScroll={onScroll} scrollEventThrottle={120} contentContainerStyle={{ padding: 16, paddingBottom: 56, maxWidth: 760, width: '100%', alignSelf: 'center', gap: 16 }} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer}
    </View>
  );
};

export const Block: React.FC<{ block: LessonBlock }> = ({ block }) => {
  const { c } = useTheme();
  if (block.type === 'text') {
    return (
      <View style={{ gap: 6 }}>
        {block.heading ? <Txt f="displayHeavy" size={22} accessibilityRole="header">{block.heading}</Txt> : null}
        <Txt size={17} style={{ lineHeight: 28 }}>{block.text}</Txt>
      </View>
    );
  }
  if (block.type === 'image') {
    return (
      <View style={{ gap: 6 }}>
        <Image source={{ uri: block.url }} accessibilityLabel={block.caption ?? 'Hình minh họa bài học'} style={{ width: '100%', height: 260, borderRadius: 14, backgroundColor: c.dichNhat }} resizeMode="contain" />
        {block.caption ? <Txt size={13} color={c.muc2} center>{block.caption}</Txt> : null}
      </View>
    );
  }
  if (block.type === 'video') {
    return (
      <Card flat pad={14} style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Video size={20} color={c.thuyChu} /><Txt f="bold" size={15}>Video minh họa</Txt></View>
        {block.caption ? <Txt size={14} color={c.muc2}>{block.caption}</Txt> : null}
        <Btn icon={ExternalLink} title="Mở video" tone="thuy" size="sm" onPress={() => { if (block.url) Linking.openURL(block.url); }} />
      </Card>
    );
  }
  return (
    <View style={{ gap: 6 }}>
      <LeafletMap label={`Bản đồ: ${block.label}`} markers={[{ id: 'm', lat: block.lat ?? 16, lng: block.lng ?? 106, label: block.label ?? '', tone: 'son' }]} zoom={block.zoom ?? 7} height={260} />
      {block.caption ? <Txt size={13} color={c.muc2} center>{block.caption}</Txt> : null}
    </View>
  );
};

/** Đọc bài học của một nút trên bản đồ hoặc (có `assignmentId`) bài học được giao thành bài tập của lớp */
/** Mục tiêu bài học (yêu cầu cần đạt, 14/11/2026): mỗi dòng một mục tiêu, hiện ở đầu bài cho học sinh và khi quản trị xem trước */
export const LessonObjectives: React.FC<{ text: string | null | undefined }> = ({ text }) => {
  const { c } = useTheme();
  const lines = (text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  return (
    <View testID="lesson-objectives" style={{ gap: 6, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: c.thuyNhat, backgroundColor: c.the }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Target size={16} color={c.thuyChu} /><Txt f="bold" size={14} color={c.thuyChu}>Sau bài học này, em sẽ</Txt></View>
      {lines.map((l, i) => <Txt key={i} size={14}>• {l}</Txt>)}
    </View>
  );
};

export const LessonReader: React.FC<{ session: Session; nodeId: number; assignmentId?: number; title: string; onClose: (changed: boolean) => void; onOpenLink: (type: string, id: number) => void }> = ({ session, nodeId, assignmentId, title, onClose, onOpenLink }) => {
  const { c } = useTheme();
  const { token } = session;
  const lesson = useLoad(async () => {
    if (!assignmentId) return api.lessonOfNode(token, nodeId);
    const started = await classroom.startAssignment(token, assignmentId);
    if (started.kind !== 'lesson') throw new Error('Bài tập này không phải bài học.');
    return started.lesson;
  }, [token, nodeId, assignmentId], session.expired);
  const { busy, run } = useAction(session.expired);
  const data = lesson.data;
  const [read, setRead] = useState(0);
  const [drafts, setDrafts] = useState<Record<number, unknown>>({});
  const [outcome, setOutcome] = useState<LessonCompletion | null>(null);
  const [note, setNote] = useState('');
  const sent = useRef(0);
  const changed = useRef(false);
  const startedAt = useRef(Date.now());
  const layout = useRef({ height: 1, content: 1 });
  const { captureAfter, acknowledge } = useQuestSnapshot(token, Boolean(assignmentId));
  const [celeb, setCeleb] = useState<{ deltas: QuestDeltaItem[]; ackIds: number[] } | null>(null);

  useEffect(() => { if (data) { setRead(data.progress.read_percent); setNote(data.note ?? ''); sent.current = data.progress.read_percent; } }, [data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const report = useCallback((percent: number) => {
    if (percent <= sent.current) return;
    sent.current = percent;
    (assignmentId ? classroom.assignmentLessonProgress(token, assignmentId, percent) : api.lessonProgress(token, nodeId, percent)).catch(() => undefined);
  }, [token, nodeId, assignmentId]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    layout.current = { height: layoutMeasurement.height, content: contentSize.height };
    const percent = Math.min(100, Math.round(((contentOffset.y + layoutMeasurement.height) / Math.max(1, contentSize.height)) * 100));
    const value = percent >= 96 ? 100 : percent;
    setRead((r) => Math.max(r, value));
    report(value);
  };

  const complete = async (answers: Array<{ question_id: number; answer: unknown }>): Promise<LessonCompletion> => {
    if (!assignmentId) return api.completeLesson(token, nodeId, answers);
    const res = await classroom.completeAssignmentLesson(token, assignmentId, answers);
    return { completed: res.completed, results: res.results, node: null, submission: res.submission };
  };
  const checkDone = Boolean(data?.checks.length) && data!.checks.every((q) => drafts[q.id] !== undefined || q.qtype === 'order');
  const submit = async () => {
    if (!data) return;
    report(100);
    const answers = data.checks.map((q) => ({ question_id: q.id, answer: toAnswer(q, drafts[q.id]) }));
    const out = await run(async () => {
      const res = await complete(answers);
      const snap = res.completed && !assignmentId ? await captureAfter() : { questDeltas: [], ackIds: [] };
      return { res, snap };
    });
    if (out) {
      if (out.res.completed && !assignmentId) {
        setCeleb({ deltas: out.snap.questDeltas, ackIds: out.snap.ackIds });
      }
      setOutcome(out.res);
      if (out.res.completed) changed.current = true;
    }
  };
  const finishWithoutChecks = async () => {
    const out = await run(async () => {
      if (assignmentId) await classroom.assignmentLessonProgress(token, assignmentId, 100);
      else await api.lessonProgress(token, nodeId, 100);
      const res = await complete([]);
      const snap = res.completed && !assignmentId ? await captureAfter() : { questDeltas: [], ackIds: [] };
      return { res, snap };
    });
    if (out) {
      if (out.res.completed && !assignmentId) {
        setCeleb({ deltas: out.snap.questDeltas, ackIds: out.snap.ackIds });
      }
      setOutcome(out.res);
      if (out.res.completed) changed.current = true;
    }
  };
  const saveNote = async () => { if (data) await run(() => api.saveNote(token, 'lesson', data.id, note), 'Đã lưu ghi chú'); };
  const deleteNote = async () => { if (data) { await run(() => api.removeNote(token, 'lesson', data.id), 'Đã xóa ghi chú'); setNote(''); } };

  const done = Boolean(data?.progress.completed_at) || outcome?.completed;
  const checkTotal = outcome?.results?.length ?? 0;
  const checkRight = outcome?.results?.filter((r) => r.correct).length ?? 0;
  const readerAccuracy = checkTotal ? Math.round((checkRight / checkTotal) * 100) : 100;
  return (
    <Overlay title={title} onBack={() => onClose(changed.current)} onScroll={onScroll}>
      <ErrorNote message={lesson.error} />
      {lesson.loading && !data ? <Spinner label="Đang mở bài học…" /> : null}
      {data ? (
        <>
          <View style={{ gap: 8 }}>
            <Txt f="displayHeavy" size={28} accessibilityRole="header">{data.title}</Txt>
            {data.summary ? <Txt size={16} color={c.muc2}>{data.summary}</Txt> : null}
            <LessonObjectives text={data.objectives} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <Chip text={`Khoảng ${data.read_minutes} phút`} bg={c.thuyNhat} fg={c.thuyChu} />
              {done ? <Chip text="Đã hoàn thành" bg={c.ngocNhat} fg={c.ngocChu} icon={CheckCircle2} /> : null}
            </View>
            <Bar value={read} max={100} height={8} label={`Tiến độ đọc ${read}%`} />
            <Txt size={12} color={c.muc3}>Đã đọc {read}%</Txt>
          </View>
          {data.blocks.map((b, i) => <Block key={i} block={b} />)}
          {data.links.length ? (
            <View style={{ gap: 8 }}>
              <Txt f="bold" size={15}>Tìm hiểu thêm</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {data.links.map((l) => <Btn key={`${l.ref_type}${l.ref_id}`} title={l.label ?? l.ref_type} tone="thuy" size="sm" disabled={l.ref_type === 'campaign'} onPress={() => onOpenLink(l.ref_type, l.ref_id)} />)}
              </View>
            </View>
          ) : null}

          <Card flat pad={14} style={{ gap: 8 }}>
            <Txt f="bold" size={16}>Ghi chú của em</Txt>
            <TextInput value={note} onChangeText={setNote} multiline accessibilityLabel="Ghi chú riêng cho bài học" placeholder="Viết điều em muốn nhớ…" placeholderTextColor={c.muc3} maxLength={2000}
              style={{ minHeight: 90, padding: 12, borderRadius: 12, borderWidth: 2, borderColor: c.vien, color: c.muc, fontSize: 16, textAlignVertical: 'top', backgroundColor: c.the }} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn icon={Save} title="Lưu ghi chú" tone="giay" size="sm" disabled={!note.trim() || busy} onPress={saveNote} />
              {data.note ? <Btn icon={Trash2} label="Xóa ghi chú" tone="giay" size="sm" onPress={deleteNote} /> : null}
            </View>
          </Card>

          <Card style={{ gap: 12 }}>
            <Txt f="displayHeavy" size={22}>Kiểm tra nhanh</Txt>
            {done && !outcome ? <Txt size={15} color={c.ngocChu}>Em đã hoàn thành bài học này. Em có thể đọc lại bất cứ lúc nào.</Txt> : null}
            {read < 100 && !done ? <Txt size={14} color={c.muc2}>Hãy đọc hết bài học (kéo xuống cuối trang) rồi trả lời câu hỏi để hoàn thành.</Txt> : null}
            {data.checks.map((q: PlayQuestion, i) => {
              const result = outcome?.results.find((r) => r.question_id === q.id);
              return (
                <View key={q.id} style={{ gap: 8 }}>
                  <Txt f="bold" size={16}>Câu {i + 1}. {q.prompt}</Txt>
                  <QuestionInput q={q} draft={(drafts[q.id] as never) ?? defaultDraft(q)} setDraft={(v) => setDrafts((d) => ({ ...d, [q.id]: v }))} disabled={Boolean(outcome?.completed)} />
                  {result ? (
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }} accessibilityLiveRegion="polite">
                      {result.correct ? <CheckCircle2 size={20} color={c.ngocChu} /> : <XCircle size={20} color={c.sonChu} />}
                      <Txt size={14} color={result.correct ? c.ngocChu : c.sonChu} style={{ flex: 1 }}>{result.correct ? 'Đúng' : 'Chưa đúng, em thử lại nhé.'}{result.explanation ? ` ${result.explanation}` : ''}</Txt>
                    </View>
                  ) : null}
                </View>
              );
            })}
            {!outcome?.completed && !done ? (
              data.checks.length
                ? <Btn title="Nộp câu kiểm tra" tone="ngoc" size="lg" full loading={busy} disabled={read < 100 || !checkDone} onPress={submit} testID="lesson-submit" />
                : <Btn title="Đánh dấu đã đọc xong" tone="ngoc" size="lg" full loading={busy} disabled={read < 100} onPress={finishWithoutChecks} />
            ) : null}
            {outcome?.completed && outcome.submission ? (
              <Card flat pad={14} style={{ gap: 6, backgroundColor: c.ngocNhat }}>
                <Txt f="displayHeavy" size={20} color={c.ngocChu}>Đã nộp bài tập!</Txt>
                <Txt size={14}>{outcome.submission.on_time ? 'Em nộp đúng hạn.' : 'Em nộp sau hạn nên không có điểm thưởng.'}{outcome.submission.bonus ? ` Em nhận +${outcome.submission.bonus} điểm thưởng.` : ''}</Txt>
                <Btn title="Về danh sách bài tập" tone="ngoc" onPress={() => onClose(true)} />
              </Card>
            ) : null}
            {outcome?.completed && outcome.node ? (
              <LessonCelebrationView
                summary={{
                  headline: 'Hoàn thành bài học!',
                  subtitle: data.title,
                  xpEarned: outcome.node.points_awarded,
                  accuracyPercent: readerAccuracy,
                  accuracyTag: accuracyTagFor(readerAccuracy, true),
                  stars: outcome.node.stars,
                  elapsedMs: Date.now() - startedAt.current,
                  passed: true,
                  nextNodeTitle: outcome.node.next_node?.title ?? null,
                  journeyCompleted: outcome.node.journey_completed,
                }}
                questDeltas={celeb?.deltas ?? []}
                nodeResult={outcome.node}
                extraLinks={data.links}
                onOpenLink={onOpenLink}
                onDone={() => {
                  acknowledge(celeb?.ackIds ?? []);
                  onClose(true);
                }}
              />
            ) : null}
          </Card>
        </>
      ) : null}
    </Overlay>
  );
};

const defaultDraft = (q: PlayQuestion): unknown => (q.qtype === 'multiple' ? [] : q.qtype === 'fill' ? Array.from({ length: q.blanks ?? 1 }, () => '') : q.qtype === 'order' ? (q.items ?? []).map((i) => i.id) : q.qtype === 'map' ? {} : null);

const toAnswer = (q: PlayQuestion, draft: unknown): unknown => {
  const value = draft ?? defaultDraft(q);
  switch (q.qtype) {
    case 'single': return { choice: value };
    case 'multiple': return { choices: value };
    case 'truefalse': return { value };
    case 'fill': return { blanks: value };
    case 'order': return { order: value };
    default: return { placements: value };
  }
};
