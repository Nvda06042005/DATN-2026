import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowRight, Check, Lightbulb, Link2, ListOrdered, Loader2, MapPin, MessageSquare, Plus,
  RotateCcw, Sparkles, Stamp, Timer, X
} from 'lucide-react';
import { SchematicMap } from '@/components/customs/game/art/SchematicMap';
import { GBtn } from '@/components/ui/button';
import { InfoNote } from '@/components/ui/info-note';
import { Bar } from '@/components/ui/progress-bar';
import { Spinner } from '@/components/ui/spinner';
import { useGame } from '@/hooks/use-game';
import type { IconType, PlaceId } from '@/types/gameType';
import type { AnswerPayload, AnswerResult, GQType, ServedQuestion } from '@/types/learningType';

const ANSWER_LETTERS = ['A', 'B', 'C', 'D', 'E'];

const TYPE_LABEL: Record<GQType, { text: string; Icon: IconType }> = {
  mcq: { text: 'Trắc nghiệm', Icon: Sparkles },
  tf: { text: 'Đúng hay sai', Icon: Check },
  order: { text: 'Sắp xếp thứ tự', Icon: ListOrdered },
  match: { text: 'Nối cặp', Icon: Link2 },
  map: { text: 'Chọn trên lược đồ', Icon: MapPin },
};

const PAIR_COLORS = ['bg-thuy', 'bg-hoa', 'bg-moc', 'bg-thong', 'bg-tho'];

export const QuestionCard: React.FC<{
  q: ServedQuestion;
  index: number;
  total: number;
  timerSec: number | null;
  onAnswered?: (r: AnswerResult) => void;
  onNext: () => void;
  nextLabel?: string;
}> = ({ q, index, total, timerSec, onAnswered, onNext, nextLabel = 'Câu tiếp theo' }) => {
  const { submitAnswer, askAdvisor, dark, sound } = useGame();
  const [phase, setPhase] = useState<'answer' | 'sending' | 'done'>('answer');
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [choice, setChoice] = useState<number | string | boolean | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [pairs, setPairs] = useState<Record<string, number>>({});
  const [activeLeft, setActiveLeft] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(timerSec ?? 0);
  const [extended, setExtended] = useState(false);
  const [hint, setHint] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);

  const submit = useCallback(
    async (payload: AnswerPayload) => {
      setPhase('sending');
      setFailed(false);
      const r = await submitAnswer(q, payload);
      if (!r) {
        setFailed(true);
        setPhase('answer');
        return;
      }
      setResult(r);
      setPhase('done');
      sound(r.correct ? 'ok' : 'bad');
      onAnswered?.(r);
    },
    [q, submitAnswer, sound, onAnswered]
  );

  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });

  useEffect(() => {
    if (timerSec === null || phase !== 'answer' || failed) return;
    if (timeLeft <= 0) {
      submitRef.current({ choice: null, order: [], pairs: {} });
      return;
    }
    const t = window.setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => window.clearTimeout(t);
  }, [timeLeft, phase, timerSec, failed]);

  useEffect(() => {
    if (phase === 'done') nextRef.current?.focus();
  }, [phase]);

  const pick = (key: number | string | boolean) => {
    if (phase !== 'answer') return;
    setChoice(key);
    submit({ choice: key });
  };

  const items = q.items ?? [];
  const left = q.left ?? [];
  const right = q.right ?? [];
  const options = q.options ?? [];
  const reveal = result?.reveal ?? {};
  const done = phase === 'done';
  const TypeIcon = TYPE_LABEL[q.type].Icon;

  const optionState = (key: number | string) => {
    if (!done) return choice === key ? 'is-picked' : '';
    if (reveal.choice === key) return 'is-correct';
    if (choice === key) return 'is-wrong';
    return '';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="g-chip bg-giay-2 text-muc-2">
          Câu {index + 1}/{total}
        </span>
        <span className="g-chip bg-dong-nhat text-dong-chu">
          <TypeIcon className="w-3.5 h-3.5" aria-hidden={true} /> {TYPE_LABEL[q.type].text}
        </span>
        {q.topic && <span className="g-chip bg-ngoc-nhat text-ngoc-chu max-w-full truncate">{q.topic}</span>}
        {timerSec !== null && phase === 'answer' && (
          <span className={`g-chip ml-auto tabular ${timeLeft <= 5 ? 'bg-son-nhat text-son-chu' : 'bg-giay-2 text-muc-2'}`} aria-live="polite">
            <Timer className="w-3.5 h-3.5" aria-hidden={true} /> {timeLeft} giây
          </span>
        )}
      </div>
      {timerSec !== null && phase === 'answer' && (
        <div className="flex items-center gap-2">
          <Bar value={timeLeft} max={timerSec + (extended ? 15 : 0)} fill={timeLeft <= 5 ? 'bg-son' : 'bg-dong'} label="Thời gian còn lại" className="flex-1" />
          {!extended && (
            <GBtn
              variant="giay"
              size="sm"
              onClick={() => {
                setExtended(true);
                setTimeLeft((v) => v + 15);
              }}
            >
              <Plus className="w-4 h-4" aria-hidden={true} /> Thêm thời gian
            </GBtn>
          )}
        </div>
      )}

      <p className="font-display font-bold text-xl leading-snug text-muc">{q.prompt}</p>
      {q.hint && !done && (
        <div>
          {hint ? (
            <InfoNote>{q.hint}</InfoNote>
          ) : (
            <GBtn variant="ghost" size="sm" onClick={() => setHint(true)}>
              <Lightbulb className="w-4 h-4" aria-hidden={true} /> Gợi ý
            </GBtn>
          )}
        </div>
      )}

      {/* --- Trắc nghiệm --- */}
      {q.type === 'mcq' && (
        <div className="grid gap-2.5">
          {options.map((o, i) => {
            const st = optionState(o.key);
            return (
              <button
                key={String(o.key)}
                type="button"
                disabled={phase !== 'answer'}
                onClick={() => pick(o.key)}
                aria-pressed={choice === o.key}
                className={`ans-btn ${st === 'is-correct' ? 'is-correct' : st === 'is-wrong' ? 'is-wrong' : ''}`}
              >
                <span className="ans-key">{ANSWER_LETTERS[i]}</span>
                <span className="flex-1">{o.text}</span>
                {st === 'is-correct' && <Check className="w-5 h-5 text-ngoc-chu shrink-0" aria-label="Đáp án đúng" />}
                {st === 'is-wrong' && <X className="w-5 h-5 text-son-chu shrink-0" aria-label="Em đã chọn" />}
              </button>
            );
          })}
        </div>
      )}

      {/* --- Đúng / Sai --- */}
      {q.type === 'tf' && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: true, text: 'Đúng' },
            { key: false, text: 'Sai' },
          ].map((o) => {
            const st = !done ? '' : reveal.choice === o.key ? 'is-correct' : choice === o.key ? 'is-wrong' : '';
            return (
              <button
                key={o.text}
                type="button"
                disabled={phase !== 'answer'}
                onClick={() => pick(o.key)}
                aria-pressed={choice === o.key}
                className={`ans-btn justify-center !min-h-[64px] font-display !text-lg !font-bold ${st}`}
              >
                {o.key ? <Check className="w-5 h-5" aria-hidden={true} /> : <X className="w-5 h-5" aria-hidden={true} />} {o.text}
              </button>
            );
          })}
        </div>
      )}

      {/* --- Lược đồ --- */}
      {q.type === 'map' && (
        <div className="grid sm:grid-cols-[1fr_200px] gap-3 items-start">
          <div className="g-card-flat overflow-hidden">
            <SchematicMap
              dark={dark}
              className="w-full h-auto max-h-[340px]"
              selectable={done ? [] : (options.map((o) => o.key) as PlaceId[])}
              pins={options.map((o) => o.key) as PlaceId[]}
              labels={[]}
              selected={(choice as PlaceId) ?? null}
              correct={done ? ((reveal.choice as PlaceId) ?? null) : null}
              wrong={done && choice !== reveal.choice ? ((choice as PlaceId) ?? null) : null}
              onSelect={(id) => pick(id)}
              title="Lược đồ: chọn địa danh đúng"
            />
          </div>
          <div className="grid gap-2" aria-label="Hoặc chọn trong danh sách">
            {options.map((o) => {
              const st = optionState(o.key);
              return (
                <button
                  key={String(o.key)}
                  type="button"
                  disabled={phase !== 'answer'}
                  onClick={() => pick(o.key)}
                  aria-pressed={choice === o.key}
                  className={`ans-btn !min-h-[48px] ${st === 'is-correct' ? 'is-correct' : st === 'is-wrong' ? 'is-wrong' : ''}`}
                >
                  <MapPin className="w-4 h-4 shrink-0 text-son-chu" aria-hidden={true} />
                  <span className="flex-1">{o.text}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* --- Sắp xếp --- */}
      {q.type === 'order' && (
        <div className="space-y-3">
          <ol className="grid gap-2" aria-label="Thứ tự em đã chọn">
            {(done ? reveal.order ?? [] : order).map((key, i) => {
              const it = items.find((x) => x.key === key);
              const mine = order[i];
              const ok = done ? mine === key : null;
              return (
                <li key={`${key}-${i}`}>
                  <button
                    type="button"
                    disabled={done || phase === 'sending'}
                    onClick={() => setOrder((o) => o.filter((k) => k !== key))}
                    className={`ans-btn !min-h-[50px] ${ok === true ? 'is-correct' : ok === false ? 'is-wrong' : ''}`}
                    aria-label={done ? `${i + 1}. ${it?.text}` : `Bỏ "${it?.text}" khỏi thứ tự`}
                  >
                    <span className="ans-key !bg-dong !text-[#1c1917]">{i + 1}</span>
                    <span className="flex-1">{it?.text}</span>
                    {!done && <X className="w-4 h-4 text-muc-3" aria-hidden={true} />}
                  </button>
                </li>
              );
            })}
            {!done &&
              Array.from({ length: items.length - order.length }, (_, i) => (
                <li key={`empty-${i}`} className="rounded-2xl border-2 border-dashed border-vien-2 min-h-[50px] flex items-center px-4 text-sm text-muc-3">
                  Vị trí {order.length + i + 1}
                </li>
              ))}
          </ol>
          {!done && items.length > order.length && (
            <div>
              <p className="text-sm font-semibold text-muc-2 mb-2">Chạm lần lượt theo thứ tự từ sớm đến muộn:</p>
              <div className="flex flex-wrap gap-2">
                {items
                  .filter((it) => !order.includes(it.key as number))
                  .map((it) => (
                    <button key={String(it.key)} type="button" className="ans-btn !w-auto !min-h-[48px]" onClick={() => setOrder((o) => [...o, it.key as number])}>
                      <Plus className="w-4 h-4 text-dong-chu shrink-0" aria-hidden={true} />
                      {it.text}
                    </button>
                  ))}
              </div>
            </div>
          )}
          {!done && (
            <div className="flex gap-2">
              <GBtn variant="giay" onClick={() => setOrder([])} disabled={!order.length || phase === 'sending'}>
                <RotateCcw className="w-4 h-4" aria-hidden={true} /> Làm lại
              </GBtn>
              <GBtn variant="ngoc" className="flex-1" disabled={order.length !== items.length || phase === 'sending'} onClick={() => submit({ order })}>
                {phase === 'sending' ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden={true} /> : <Check className="w-5 h-5" aria-hidden={true} />} Kiểm tra
              </GBtn>
            </div>
          )}
        </div>
      )}

      {/* --- Nối cặp --- */}
      {q.type === 'match' && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-muc-2">Chạm một ô bên trái, rồi chạm ô bên phải tương ứng.</p>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="grid gap-2 content-start">
              {left.map((l, i) => {
                const paired = pairs[String(l.key)];
                const ok = done ? (reveal.pairs ?? {})[String(l.key)] === paired : null;
                return (
                  <button
                    key={String(l.key)}
                    type="button"
                    disabled={done || phase === 'sending'}
                    onClick={() => setActiveLeft(activeLeft === (l.key as number) ? null : (l.key as number))}
                    aria-pressed={activeLeft === l.key}
                    className={`ans-btn !min-h-[56px] !text-[0.95rem] ${activeLeft === l.key ? '!border-dong !bg-dong-nhat' : ''} ${ok === true ? 'is-correct' : ok === false ? 'is-wrong' : ''}`}
                  >
                    <span className={`w-6 h-6 rounded-full shrink-0 ${paired !== undefined ? PAIR_COLORS[i % PAIR_COLORS.length] : 'bg-giay-2'} text-white text-xs font-bold flex items-center justify-center`}>
                      {i + 1}
                    </span>
                    <span className="flex-1">{l.text}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid gap-2 content-start">
              {right.map((r) => {
                const owner = Object.entries(pairs).find(([, v]) => v === r.key)?.[0];
                const ownerIdx = owner === undefined ? -1 : left.findIndex((l) => String(l.key) === owner);
                const correctOwner = done ? Object.entries(reveal.pairs ?? {}).find(([, v]) => v === r.key)?.[0] : undefined;
                return (
                  <button
                    key={String(r.key)}
                    type="button"
                    disabled={done || phase === 'sending' || activeLeft === null}
                    onClick={() => {
                      if (activeLeft === null) return;
                      setPairs((p) => {
                        const next: Record<string, number> = {};
                        for (const [k, v] of Object.entries(p)) if (v !== r.key && k !== String(activeLeft)) next[k] = v;
                        next[String(activeLeft)] = r.key as number;
                        return next;
                      });
                      setActiveLeft(null);
                    }}
                    className="ans-btn !min-h-[56px] !text-[0.95rem]"
                  >
                    {ownerIdx >= 0 && (
                      <span className={`w-6 h-6 rounded-full shrink-0 ${PAIR_COLORS[ownerIdx % PAIR_COLORS.length]} text-white text-xs font-bold flex items-center justify-center`}>
                        {ownerIdx + 1}
                      </span>
                    )}
                    <span className="flex-1">{r.text}</span>
                    {done && correctOwner !== undefined && (
                      <span className="g-chip bg-ngoc-nhat text-ngoc-chu shrink-0">đúng: {left.findIndex((l) => String(l.key) === correctOwner) + 1}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          {!done && (
            <div className="flex gap-2">
              <GBtn variant="giay" onClick={() => setPairs({})} disabled={!Object.keys(pairs).length || phase === 'sending'}>
                <RotateCcw className="w-4 h-4" aria-hidden={true} /> Làm lại
              </GBtn>
              <GBtn variant="ngoc" className="flex-1" disabled={Object.keys(pairs).length !== left.length || phase === 'sending'} onClick={() => submit({ pairs })}>
                {phase === 'sending' ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden={true} /> : <Check className="w-5 h-5" aria-hidden={true} />} Kiểm tra
              </GBtn>
            </div>
          )}
        </div>
      )}

      {phase === 'sending' && (q.type === 'mcq' || q.type === 'tf' || q.type === 'map') && <Spinner label="Đang chấm…" />}
      {failed && (
        <div role="alert" className="rounded-2xl bg-son-nhat text-son-chu p-3 flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden={true} /> Chưa gửi được câu trả lời. Kiểm tra kết nối rồi chọn lại nhé.
        </div>
      )}

      {/* --- Phản hồi --- */}
      {done && result && (
        <div className={`rounded-3xl p-4 border-2 animate-pop-in ${result.correct ? 'bg-ngoc-nhat border-ngoc' : 'bg-son-nhat border-son'}`} role="status" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`w-9 h-9 rounded-full flex items-center justify-center text-white ${result.correct ? 'bg-ngoc' : 'bg-son'}`}>
              {result.correct ? <Check className="w-5 h-5" aria-hidden={true} /> : <X className="w-5 h-5" aria-hidden={true} />}
            </span>
            <p className={`font-display font-extrabold text-xl ${result.correct ? 'text-ngoc-chu' : 'text-son-chu'}`}>{result.correct ? 'Chính xác!' : 'Chưa đúng rồi'}</p>
            <span className="ml-auto flex flex-wrap gap-1.5">
              {result.gems_gained > 0 && (
                <span className="g-chip bg-the text-dong-chu">
                  <Stamp className="w-3.5 h-3.5" aria-hidden={true} /> +{result.gems_gained} Ấn Tín
                </span>
              )}
              <span className="g-chip bg-the text-muc-2">+{result.xp_gained} XP</span>
            </span>
          </div>
          <p className="mt-2 text-muc leading-relaxed">{result.explanation}</p>
          {result.correct && result.gems_gained === 0 && result.progress.day_gems >= result.progress.daily_gem_cap && (
            <p className="mt-1 text-sm text-muc-2">Hôm nay em đã nhận đủ {result.progress.daily_gem_cap} Ấn Tín – vẫn được cộng XP.</p>
          )}
          {result.source && <p className="mt-2 text-xs font-semibold text-muc-2">Nguồn: {result.source}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <GBtn ref={nextRef} variant={result.correct ? 'ngoc' : 'son'} className="flex-1 min-w-[160px]" onClick={onNext}>
              {nextLabel} <ArrowRight className="w-5 h-5" aria-hidden={true} />
            </GBtn>
            {!result.correct && (
              <GBtn variant="giay" onClick={() => askAdvisor(`Giải thích giúp em: ${q.prompt}`)}>
                <MessageSquare className="w-4 h-4" aria-hidden={true} /> Hỏi Quân Sư
              </GBtn>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
