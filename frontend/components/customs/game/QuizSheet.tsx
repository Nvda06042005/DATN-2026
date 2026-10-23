import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, RotateCcw, Stamp, Trophy } from 'lucide-react';
import { QuestionCard } from '@/components/customs/game/QuestionCard';
import { Mascot } from '@/components/customs/Mascot';
import { GBtn } from '@/components/ui/button';
import { InfoNote } from '@/components/ui/info-note';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useGame } from '@/hooks/use-game';
import type { AnswerResult, QuestionRequest, ServedQuestion } from '@/types/learningType';

interface QuizSummary {
  correct: number;
  total: number;
  passed: boolean;
  results: AnswerResult[];
  gems: number;
  xp: number;
}

/** Một lượt hỏi đáp gồm nhiều câu (khảo thí, mở khóa, nâng cấp, chiêu mộ…) */
export const QuizSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  request: QuestionRequest;
  passMark?: number;
  timer?: boolean;
  intro?: React.ReactNode;
  finishLabel?: string;
  sessionKind?: 'practice' | 'tower' | 'recruit' | 'raid' | null;
  onFinish?: (summary: QuizSummary) => void;
}> = ({ open, onClose, title, subtitle, request, passMark, timer = false, intro, finishLabel = 'Hoàn thành', sessionKind = 'practice', onFinish }) => {
  const { fetchQuestions, state, finishSession, sound } = useGame();
  const [questions, setQuestions] = useState<ServedQuestion[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<AnswerResult[]>([]);
  const [finished, setFinished] = useState(false);
  const loadId = useRef(0);
  const reqKey = JSON.stringify(request);

  const load = useCallback(() => {
    const id = ++loadId.current;
    setQuestions(null);
    setError(null);
    setIndex(0);
    setResults([]);
    setFinished(false);
    fetchQuestions(JSON.parse(reqKey) as QuestionRequest)
      .then((res) => {
        if (id !== loadId.current) return;
        if (!res.questions.length) setError('Chưa có câu hỏi phù hợp. Em thử chủ đề khác nhé.');
        setQuestions(res.questions);
        setNote(res.note ?? null);
      })
      .catch((err) => id === loadId.current && setError(err instanceof Error ? err.message : 'Không tải được câu hỏi'));
  }, [fetchQuestions, reqKey]);

  useEffect(() => {
    if (open) load();
    else loadId.current++;
  }, [open, load]);

  const total = questions?.length ?? request.count;
  const correct = results.filter((r) => r.correct).length;
  const need = passMark ?? Math.ceil(total * 0.6);
  const passed = correct >= need;
  const timerSec = timer && state.settings.timer ? 20 : null;

  const next = () => {
    if (!questions) return;
    if (index + 1 < questions.length) setIndex(index + 1);
    else {
      setFinished(true);
      if (sessionKind) finishSession(sessionKind, correct, questions.length);
      if (passed) sound('win');
    }
  };

  const summary: QuizSummary = {
    correct,
    total,
    passed,
    results,
    gems: results.reduce((s, r) => s + r.gems_gained, 0),
    xp: results.reduce((s, r) => s + r.xp_gained, 0),
  };

  return (
    <Sheet open={open} onClose={onClose} title={title} subtitle={subtitle} wide>
      {intro && !finished && index === 0 && results.length === 0 && <div className="mb-4">{intro}</div>}
      {note && !finished && <InfoNote className="mb-3">{note}</InfoNote>}
      {error ? (
        <div className="flex flex-col items-center text-center gap-3 py-6">
          <Mascot size={90} mood="sad" />
          <p className="font-semibold text-muc">{error}</p>
          <GBtn variant="ngoc" onClick={load}>
            <RefreshCw className="w-4 h-4" aria-hidden={true} /> Thử lại
          </GBtn>
        </div>
      ) : !questions ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Spinner label="Quân Sư đang chọn câu hỏi…" />
        </div>
      ) : finished ? (
        <div className="flex flex-col items-center text-center gap-3 py-2">
          <Mascot size={110} mood={passed ? 'excited' : 'thinking'} accessory={passed ? 'crown' : 'scholar'} bob />
          <p className="font-display font-extrabold text-2xl text-muc">{passed ? 'Xuất sắc!' : 'Cố lên chút nữa!'}</p>
          <p className="text-muc-2">
            Em trả lời đúng <strong className="text-muc">{correct}/{total}</strong> câu{passMark !== undefined ? ` (cần ${need})` : ''}.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <span className="g-chip bg-dong-nhat text-dong-chu !text-sm">
              <Stamp className="w-4 h-4" aria-hidden={true} /> +{summary.gems} Ấn Tín
            </span>
            <span className="g-chip bg-ngoc-nhat text-ngoc-chu !text-sm">+{summary.xp} XP</span>
          </div>
          {!passed && <InfoNote>Câu sai đã có giải thích. Em có thể làm lại – mỗi lần câu hỏi sẽ khác.</InfoNote>}
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {!passed && (
              <GBtn variant="giay" onClick={load}>
                <RotateCcw className="w-4 h-4" aria-hidden={true} /> Làm lại
              </GBtn>
            )}
            <GBtn
              variant={passed ? 'ngoc' : 'son'}
              size="lg"
              onClick={() => {
                onFinish?.(summary);
                onClose();
              }}
            >
              <Trophy className="w-5 h-5" aria-hidden={true} /> {finishLabel}
            </GBtn>
          </div>
        </div>
      ) : (
        <QuestionCard
          key={questions[index].id + index}
          q={questions[index]}
          index={index}
          total={questions.length}
          timerSec={timerSec}
          onAnswered={(r) => setResults((rs) => [...rs, r])}
          onNext={next}
          nextLabel={index + 1 < questions.length ? 'Câu tiếp theo' : 'Xem kết quả'}
        />
      )}
    </Sheet>
  );
};
