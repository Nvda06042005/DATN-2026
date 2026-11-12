/**
 * Học một bài ngắn theo từng bước (HK.HS.119) và nghe kể chuyện lịch sử (HK.HS.121) của lộ trình dạng đường đi:
 *  - bài học xen kẽ thẻ kiến thức và câu hỏi kiểm tra nhanh; thanh tiến độ và số tim ở trên cùng; bấm "Kiểm tra" để biết đúng / sai kèm giải thích ngay;
 *    cuối bài báo điểm, độ chính xác và thời gian. Việc chấm và hoàn thành bài do máy chủ quyết định.
 *  - nghe kể chuyện: lời kể hiện thành phụ đề từng dòng; phát âm thanh thu sẵn nếu có, không thì máy đọc tiếng Việt của thiết bị.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { CheckCircle2, Headphones, Heart, Pause, Play, XCircle } from 'lucide-react-native';
import * as api from '@/api/learningApi';
import * as game from '@/api/gameApi';
import { ErrorNote, useAction, useLoad } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { LessonCelebrationView } from '@/components/portal/LessonCelebrationView';
import { Block, Overlay } from '@/components/portal/LessonReader';
import { buildAnswer, initialDraft, QuestionInput, ready, type Draft } from '@/components/portal/QuizPlayer';
import { Bar, Btn, Card, Chip, Spinner, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { accuracyTagFor, type QuestDeltaItem } from '@/lib/learning-celebration';
import { useQuestSnapshot } from '@/lib/use-lesson-celebration';
import type { Hud } from '@/types/gamification';
import type { LessonBlock, LessonCheckResult, LessonCompletion, NodeResult, PlayQuestion } from '@/types/learning';

type Step = { kind: 'card'; block: LessonBlock; cardNo: number } | { kind: 'question'; q: PlayQuestion };

/** Xếp câu hỏi xen kẽ giữa các thẻ: câu thứ i đứng sau thẻ ceil((i+1)·B/n); câu cuối luôn sau thẻ cuối */
export function buildSteps(blocks: LessonBlock[], checks: PlayQuestion[]): Step[] {
  const out: Step[] = [];
  const n = checks.length;
  blocks.forEach((block, k) => {
    out.push({ kind: 'card', block, cardNo: k + 1 });
    checks.forEach((q, i) => { if (Math.max(0, Math.ceil(((i + 1) * blocks.length) / n) - 1) === k) out.push({ kind: 'question', q }); });
  });
  // Bài không có thẻ nào thì chỉ còn các câu hỏi
  if (!blocks.length) checks.forEach((q) => out.push({ kind: 'question', q }));
  return out;
}

export const LessonSteps: React.FC<{ session: Session; nodeId: number; title: string; onClose: (changed: boolean) => void; onOpenLink: (type: string, id: number) => void; onScrollMode: () => void; onGameChanged: () => void }> = ({
  session, nodeId, title, onClose, onOpenLink, onScrollMode, onGameChanged,
}) => {
  const { c } = useTheme();
  const { token } = session;
  const lesson = useLoad(() => api.lessonOfNode(token, nodeId), [token, nodeId], session.expired);
  const { busy, run } = useAction(session.expired);
  const data = lesson.data;
  const [hearts, setHearts] = useState<Hud['hearts'] | null>(null);
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [checked, setChecked] = useState<Record<number, LessonCheckResult>>({});
  const [firstTry, setFirstTry] = useState<Record<number, boolean>>({});
  const [good, setGood] = useState<Record<number, unknown>>({});
  const [finished, setFinished] = useState<LessonCompletion | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(Date.now());
  const { captureAfter, acknowledge } = useQuestSnapshot(token);
  const [celeb, setCeleb] = useState<{ deltas: QuestDeltaItem[]; ackIds: number[] } | null>(null);
  const loadHearts = useCallback(() => { game.gameMe(token).then((h) => setHearts(h.hearts)).catch(() => undefined); }, [token]);
  useEffect(() => { loadHearts(); }, [loadHearts]);

  const steps = useMemo(() => (data ? buildSteps(data.blocks, data.checks) : []), [data]);
  const step = steps[index];
  const blocksTotal = data?.blocks.length ?? 0;

  const reportRead = (cardNo: number) => {
    const percent = cardNo >= blocksTotal ? 100 : Math.round((cardNo / Math.max(1, blocksTotal)) * 100);
    api.lessonProgress(token, nodeId, percent).catch(() => undefined);
  };

  const finish = async () => {
    if (!data) return;
    const answers = data.checks.map((q) => ({ question_id: q.id, answer: good[q.id] }));
    const out = await run(async () => {
      await api.lessonProgress(token, nodeId, 100);
      const res = await api.completeLesson(token, nodeId, answers);
      const snap = res.completed ? await captureAfter() : { questDeltas: [], ackIds: [] };
      return { res, snap };
    });
    if (out) {
      setElapsed(Date.now() - startedAt.current);
      setCeleb({ deltas: out.snap.questDeltas, ackIds: out.snap.ackIds });
      setFinished(out.res);
      onGameChanged();
      loadHearts();
    }
  };
  const next = () => {
    if (step?.kind === 'card') reportRead(step.cardNo);
    if (index + 1 < steps.length) setIndex(index + 1); else void finish();
  };
  const check = async (q: PlayQuestion) => {
    const answer = buildAnswer(q.qtype, drafts[q.id] ?? initialDraft(q));
    const res = await run(() => api.lessonCheck(token, nodeId, q.id, answer));
    if (!res) return;
    setChecked((m) => ({ ...m, [q.id]: res }));
    setFirstTry((m) => (m[q.id] === undefined ? { ...m, [q.id]: res.correct } : m));
    if (res.correct) setGood((m) => ({ ...m, [q.id]: answer }));
    onGameChanged();
    loadHearts();
  };
  const retry = (q: PlayQuestion) => {
    setChecked((m) => { const { [q.id]: _gone, ...rest } = m; return rest; });
    setDrafts((m) => ({ ...m, [q.id]: initialDraft(q) }));
  };

  const questions = data?.checks.length ?? 0;
  const correctFirst = Object.values(firstTry).filter(Boolean).length;
  const accuracy = questions ? Math.round((correctFirst / questions) * 100) : 100;

  return (
    <Overlay title={title} onBack={() => onClose(Boolean(finished?.completed))} resetKey={`${index}-${finished ? 'done' : ''}`}>
      <ErrorNote message={lesson.error} />
      {lesson.loading && !data ? <Spinner label="Đang mở bài học…" /> : null}
      {data && !finished ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}><Bar value={index} max={Math.max(1, steps.length)} height={12} fill={c.ngoc} label={`Bước ${Math.min(index + 1, steps.length)} trên ${steps.length}`} /></View>
            <View accessible accessibilityLabel={hearts?.enabled ? `Tim: ${hearts.current} trên ${hearts.max}` : 'Lớp đã tắt cơ chế tim'} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36 }}>
              <Heart size={22} color={c.son} fill={hearts && hearts.enabled && hearts.current > 0 ? c.son : 'transparent'} />
              <Txt f="display" size={16}>{hearts ? (hearts.enabled ? hearts.current : '∞') : '–'}</Txt>
            </View>
          </View>
          <Txt size={12} color={c.muc3}>Bước {Math.min(index + 1, steps.length)}/{steps.length} · khoảng {data.read_minutes} phút</Txt>

          {!step ? <Card flat pad={14}><Txt size={15}>Bài học này chưa có nội dung.</Txt></Card> : null}

          {step?.kind === 'card' ? (
            <View style={{ gap: 16 }}>
              {index === 0 ? (
                <View style={{ gap: 6 }}>
                  <Txt f="displayHeavy" size={28} accessibilityRole="header">{data.title}</Txt>
                  {data.summary ? <Txt size={15} color={c.muc2}>{data.summary}</Txt> : null}
                </View>
              ) : null}
              <Block block={step.block} />
              {index === 0 ? <Btn title="Đọc cả bài một lượt" tone="ghost" size="sm" onPress={onScrollMode} testID="step-scroll-mode" /> : null}
              <Btn title={index + 1 >= steps.length ? 'Hoàn thành bài' : 'Tiếp tục'} tone="ngoc" size="lg" full loading={busy} onPress={next} testID="step-next" />
            </View>
          ) : null}

          {step?.kind === 'question' ? (() => {
            const q = step.q;
            const result = checked[q.id];
            const draft = drafts[q.id] ?? initialDraft(q);
            return (
              <View style={{ gap: 14 }}>
                <Chip text="Kiểm tra nhanh" bg={c.thuyNhat} fg={c.thuyChu} style={{ alignSelf: 'flex-start' }} />
                <Txt f="bold" size={19} accessibilityRole="header">{q.prompt}</Txt>
                <QuestionInput q={q} draft={draft} setDraft={(v) => setDrafts((m) => ({ ...m, [q.id]: v }))} disabled={Boolean(result?.correct)} />
                {result ? (
                  <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: 14, backgroundColor: result.correct ? c.ngocNhat : c.sonNhat }}>
                    {result.correct ? <CheckCircle2 size={24} color={c.ngocChu} /> : <XCircle size={24} color={c.sonChu} />}
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt f="bold" size={16} color={result.correct ? c.ngocChu : c.sonChu}>{result.correct ? 'Chính xác!' : 'Chưa đúng, em thử lại nhé.'}</Txt>
                      {result.explanation ? <Txt size={14}>{result.explanation}</Txt> : null}
                      {!result.correct && hearts?.enabled ? <Txt size={13} color={c.muc2}>Em bị trừ một tim.</Txt> : null}
                    </View>
                  </View>
                ) : null}
                {!result ? <Btn title="Kiểm tra" tone="dong" size="lg" full loading={busy} disabled={!ready(q, draft)} onPress={() => check(q)} testID="step-check" />
                  : result.correct ? <Btn title={index + 1 >= steps.length ? 'Hoàn thành bài' : 'Tiếp tục'} tone="ngoc" size="lg" full loading={busy} onPress={next} testID="step-next" />
                    : <Btn title="Thử lại" tone="son" size="lg" full onPress={() => retry(q)} testID="step-retry" />}
              </View>
            );
          })() : null}
        </>
      ) : null}

      {data && finished && finished.completed ? (
        <LessonCelebrationView
          summary={{
            headline: 'Hoàn thành bài học!',
            subtitle: data.title,
            xpEarned: finished.node?.points_awarded ?? 0,
            accuracyPercent: accuracy,
            accuracyTag: accuracyTagFor(accuracy, true),
            stars: finished.node?.stars,
            elapsedMs: elapsed,
            passed: true,
            nextNodeTitle: finished.node?.next_node?.title ?? null,
            journeyCompleted: finished.node?.journey_completed,
          }}
          questDeltas={celeb?.deltas ?? []}
          nodeResult={finished.node}
          extraLinks={data.links}
          onOpenLink={onOpenLink}
          onDone={() => {
            acknowledge(celeb?.ackIds ?? []);
            onClose(true);
          }}
        />
      ) : null}
      {data && finished && !finished.completed ? (
        <Card style={{ gap: 14, alignItems: 'center' }}>
          <Txt f="displayHeavy" size={26} color={c.ngocChu} accessibilityRole="header">Chưa hoàn thành</Txt>
          <Txt size={14} color={c.muc2} center>Em hãy hoàn thành toàn bộ câu hỏi kiểm tra để vượt qua bài học nhé.</Txt>
          <Btn title="Về lộ trình" tone="ngoc" size="lg" full onPress={() => onClose(false)} testID="step-done" />
        </Card>
      ) : null}
    </Overlay>
  );
};

/** Phần thưởng riêng của lần hoàn thành đầu tiên (vàng, Binh thư, huy hiệu) */
export const Rewards: React.FC<{ node: NodeResult | null | undefined }> = ({ node }) => {
  const { c } = useTheme();
  const r = node?.rewards;
  const parts = [r?.gold ? `+${r.gold} vàng` : '', r?.binh_thu ? `+${r.binh_thu} Binh thư` : '', r?.card ? 'một thẻ nhân vật' : '', r?.badge ? `huy hiệu “${r.badge}”` : '', ...(r?.fragments ?? []).map((f) => `${f.qty} mảnh thẻ ${f.card}${f.merged ? ' (đã ghép thành thẻ)' : ''}`)].filter(Boolean);
  return parts.length ? <Txt f="bold" size={15} color={c.dongChu} center>Em nhận được: {parts.join(', ')}</Txt> : null;
};

// ---------------------------------------------------------------------- nghe kể chuyện
const SPEECH = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof (window as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance === 'function';
const AUDIO = typeof window !== 'undefined' && typeof (window as unknown as { Audio?: unknown }).Audio === 'function';

export const ListenPlayer: React.FC<{ session: Session; nodeId: number; title: string; onClose: (changed: boolean) => void; onQuiz: () => void; onDone: (res: NodeResult) => void }> = ({
  session, nodeId, title, onClose, onQuiz, onDone,
}) => {
  const { c } = useTheme();
  const { token } = session;
  const story = useLoad(() => api.listenOfNode(token, nodeId), [token, nodeId], session.expired);
  const { busy, run } = useAction(session.expired);
  const data = story.data;
  const lines = data?.lines ?? [];
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [finished, setFinished] = useState(false);
  const stamp = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const audio = useRef<{ play: () => Promise<void> | void; pause: () => void; currentTime: number; duration: number; addEventListener: (e: string, f: () => void) => void } | null>(null);

  const stop = useCallback(() => {
    stamp.current += 1;
    if (timer.current) clearTimeout(timer.current);
    audio.current?.pause();
    if (SPEECH) window.speechSynthesis.cancel();
  }, []);
  useEffect(() => stop, [stop]);

  /** Đọc từng dòng bằng giọng của thiết bị; nếu thiết bị không đọc được thì tự chuyển dòng theo độ dài chữ để vẫn xem được phụ đề */
  const speakFrom = useCallback((i: number) => {
    const mine = stamp.current;
    if (i >= lines.length) { setPlaying(false); setFinished(true); return; }
    setCurrent(i);
    let fired = false;
    const advance = () => { if (fired || mine !== stamp.current) return; fired = true; if (timer.current) clearTimeout(timer.current); speakFrom(i + 1); };
    const wait = Math.max(2500, lines[i].length * 70);
    if (SPEECH) {
      const Utter = (window as unknown as { SpeechSynthesisUtterance: new (t: string) => { lang: string; rate: number; onend: () => void; onerror: () => void } }).SpeechSynthesisUtterance;
      const u = new Utter(lines[i]);
      u.lang = 'vi-VN'; u.rate = 0.95; u.onend = advance; u.onerror = advance;
      window.speechSynthesis.speak(u as never);
      timer.current = setTimeout(advance, wait + 10000);
    } else timer.current = setTimeout(advance, wait);
  }, [lines]);

  const toggle = () => {
    if (!data) return;
    if (playing) { stop(); setPlaying(false); return; }
    setPlaying(true);
    if (data.audio_url && AUDIO) {
      if (!audio.current) {
        const a = new (window as unknown as { Audio: new (u: string) => NonNullable<typeof audio.current> }).Audio(data.audio_url);
        a.addEventListener('timeupdate', () => setCurrent(Math.min(lines.length - 1, Math.floor((a.currentTime / (a.duration || 1)) * lines.length))));
        a.addEventListener('ended', () => { setPlaying(false); setFinished(true); setCurrent(Math.max(0, lines.length - 1)); });
        a.addEventListener('error', () => { audio.current = null; speakFrom(current); });
        audio.current = a;
      }
      void audio.current.play();
    } else speakFrom(finished ? 0 : current);
    if (finished) setFinished(false);
  };

  const complete = async () => {
    stop();
    if (!data) return;
    if (data.has_quiz) { onQuiz(); return; }
    const res = await run(() => api.completeNode(token, nodeId));
    if (res) onDone(res);
  };

  return (
    <Overlay title={title} onBack={() => { stop(); onClose(false); }}>
      <ErrorNote message={story.error} />
      {story.loading && !data ? <Spinner label="Đang mở câu chuyện…" /> : null}
      {data ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Headphones size={26} color={c.thuyChu} />
            <Txt f="displayHeavy" size={24} style={{ flex: 1 }} accessibilityRole="header">{data.title}</Txt>
          </View>
          <Bar value={finished ? lines.length : current} max={Math.max(1, lines.length)} height={10} fill={c.thuy} label={`Đã nghe ${finished ? lines.length : current} trên ${lines.length} đoạn`} />
          <Card style={{ gap: 12 }}>
            {lines.map((line, i) => {
              const on = i === current && (playing || !finished);
              return (
                <Txt key={i} size={on ? 20 : 17} f={on ? 'bold' : 'body'} color={on ? c.muc : i < current || finished ? c.muc2 : c.muc3}
                  style={{ lineHeight: on ? 30 : 26, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 10, backgroundColor: on ? c.dongNhat : 'transparent' }}
                  accessibilityLiveRegion={on ? 'polite' : 'none'}>{line}</Txt>
              );
            })}
          </Card>
          <Btn icon={playing ? Pause : Play} title={playing ? 'Tạm dừng' : finished ? 'Nghe lại' : current > 0 ? 'Nghe tiếp' : 'Bắt đầu nghe'} tone="thuy" size="lg" full onPress={toggle} testID="listen-toggle" />
          {!SPEECH && !data.audio_url ? <Txt size={13} color={c.muc3}>Thiết bị này không đọc thành tiếng được; em đọc phụ đề chạy theo từng đoạn nhé.</Txt> : null}
          {!finished ? <Btn title="Em đọc phụ đề, bỏ qua phần nghe" tone="ghost" size="sm" onPress={() => { stop(); setPlaying(false); setFinished(true); setCurrent(Math.max(0, lines.length - 1)); }} testID="listen-skip" /> : null}
          <Btn title={data.has_quiz ? 'Nghe xong, trả lời câu hỏi' : 'Nghe xong'} tone="ngoc" size="lg" full loading={busy} disabled={!finished} onPress={complete} testID="listen-done" />
        </>
      ) : null}
    </Overlay>
  );
};
