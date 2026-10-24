/**
 * Câu hỏi của game: 5 dạng (trắc nghiệm, đúng/sai, sắp xếp, nối cặp, chọn trên lược đồ). Server giữ đáp án và chấm;
 * máy học sinh chỉ gửi lựa chọn. QuizSheet là một lượt nhiều câu (khảo thí, nâng cấp, chiêu mộ, chặn giặc...).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View, useWindowDimensions } from 'react-native';
import {
  AlertTriangle, ArrowRight, Check, Lightbulb, Link2, ListOrdered, MapPin, MessageSquare, Plus, RotateCcw, Sparkles, Stamp, Star, Timer, Trophy, X,
} from 'lucide-react-native';
import { Mascot, SchematicMap } from '@/components/art';
import { Bar, Btn, Chip, InfoNote, Sheet, Skeleton, Spinner, Txt } from '@/components/ui';
import { ELEMENTS, LORE_LABEL, TIER_INFO } from '@/constants/game';
import type { Palette } from '@/constants/theme';
import { useGame } from '@/hooks/use-game';
import { usePopIn } from '@/hooks/use-motion';
import { useTheme } from '@/hooks/use-theme';
import type { AnswerPayload, AnswerResult, GQType, QuestionRequest, ServedQuestion } from '@/types/api';
import type { ElementId, IconType, Lore, PlaceId, Tier } from '@/types/game';

// ---------------------------------------------------------------------- nhãn
const LORE_COLORS = (c: Palette): Record<Lore, [string, string]> => ({
  chinh_su: [c.ngocNhat, c.ngocChu],
  giai_thoai: [c.dongNhat, c.dongChu],
  sang_tao: [c.thongNhat, c.thongChu],
  dan_gian: [c.hoaNhat, c.hoaChu],
});

/** Mức độ tin cậy của nội dung: chính sử, giai thoại, sáng tạo của game, dân gian */
export const LoreChip: React.FC<{ lore: Lore | string }> = ({ lore }) => {
  const { c } = useTheme();
  const key = (lore in LORE_LABEL ? lore : 'chinh_su') as Lore;
  const [bg, fg] = LORE_COLORS(c)[key];
  return <Chip text={LORE_LABEL[key]} bg={bg} fg={fg} />;
};

export const ElementChip: React.FC<{ element: ElementId }> = ({ element }) => {
  const { c } = useTheme();
  const el = ELEMENTS[element];
  return <Chip text={el.name} icon={el.Icon} bg={c[el.soft]} fg={c[el.text]} />;
};

export const TierChip: React.FC<{ tier: Tier }> = ({ tier }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: c.dongNhat, alignSelf: 'flex-start' }}>
      {Array.from({ length: TIER_INFO[tier].stars }, (_, i) => (
        <Star key={i} size={11} color={c.dongChu} fill={c.dongChu} />
      ))}
      <Txt f="bold" size={12} color={c.dongChu}>
        {TIER_INFO[tier].name}
      </Txt>
    </View>
  );
};

// ---------------------------------------------------------------------- ô đáp án
type AnsState = '' | 'picked' | 'correct' | 'wrong';

const AnswerButton: React.FC<{
  onPress?: () => void;
  disabled?: boolean;
  state?: AnsState;
  label: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  center?: boolean;
  minHeight?: number;
  style?: object;
  selected?: boolean;
}> = ({ onPress, disabled, state = '', label, left, right, center, minHeight = 56, style, selected }) => {
  const { c } = useTheme();
  const border = state === 'correct' ? c.ngoc : state === 'wrong' ? c.son : state === 'picked' ? c.dong : c.vien;
  const bg = state === 'correct' ? c.ngocNhat : state === 'wrong' ? c.sonNhat : state === 'picked' ? c.dongNhat : c.the;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: selected ?? state === 'picked' }}
      style={({ pressed }) => [
        {
          flexDirection: 'row', alignItems: 'center', justifyContent: center ? 'center' : 'flex-start', gap: 12, minHeight, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16,
          backgroundColor: bg, borderWidth: 2, borderColor: border, borderBottomWidth: pressed && !disabled ? 2 : 5, borderBottomColor: state ? border : c.vien2,
          marginTop: pressed && !disabled ? 3 : 0,
        },
        style,
      ]}
    >
      {left}
      <Txt f="semibold" size={16} style={{ flexShrink: 1, flexGrow: center ? 0 : 1 }}>
        {label}
      </Txt>
      {right}
    </Pressable>
  );
};

const KeyBadge: React.FC<{ text: string; bg?: string; fg?: string }> = ({ text, bg, fg }) => {
  const { c } = useTheme();
  return (
    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: bg ?? c.giay2, alignItems: 'center', justifyContent: 'center' }}>
      <Txt f="displayHeavy" size={15} color={fg ?? c.muc2}>
        {text}
      </Txt>
    </View>
  );
};

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const TYPE_LABEL: Record<GQType, { text: string; icon: IconType }> = {
  mcq: { text: 'Trắc nghiệm', icon: Sparkles },
  tf: { text: 'Đúng hay sai', icon: Check },
  order: { text: 'Sắp xếp thứ tự', icon: ListOrdered },
  match: { text: 'Nối cặp', icon: Link2 },
  map: { text: 'Chọn trên lược đồ', icon: MapPin },
};
const PAIR_KEYS: Array<keyof Palette> = ['thuy', 'hoa', 'moc', 'thong', 'tho'];

// ---------------------------------------------------------------------- một câu hỏi
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
  const { c } = useTheme();
  const { width } = useWindowDimensions();
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
  const pop = usePopIn(result ? result.question_id : null);

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
    [q, submitAnswer, sound, onAnswered],
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
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, phase, timerSec, failed]);

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
  const busy = phase !== 'answer';
  const optionState = (key: number | string | boolean): AnsState => {
    if (!done) return choice === key ? 'picked' : '';
    if (reveal.choice === key) return 'correct';
    if (choice === key) return 'wrong';
    return '';
  };
  const stateIcon = (st: AnsState) => (st === 'correct' ? <Check size={20} color={c.ngocChu} /> : st === 'wrong' ? <X size={20} color={c.sonChu} /> : null);

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <Chip text={`Câu ${index + 1}/${total}`} bg={c.giay2} fg={c.muc2} />
        <Chip text={TYPE_LABEL[q.type].text} icon={TYPE_LABEL[q.type].icon} bg={c.dongNhat} fg={c.dongChu} />
        {q.topic ? <Chip text={q.topic} bg={c.ngocNhat} fg={c.ngocChu} style={{ maxWidth: '100%' }} /> : null}
        {timerSec !== null && phase === 'answer' && (
          <Chip text={`${timeLeft} giây`} icon={Timer} bg={timeLeft <= 5 ? c.sonNhat : c.giay2} fg={timeLeft <= 5 ? c.sonChu : c.muc2} style={{ marginLeft: 'auto' }} />
        )}
      </View>
      {timerSec !== null && phase === 'answer' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Bar value={timeLeft} max={timerSec + (extended ? 15 : 0)} fill={timeLeft <= 5 ? c.son : c.dong} label="Thời gian còn lại" style={{ flex: 1 }} />
          {!extended && (
            <Btn
              title="Thêm thời gian"
              icon={Plus}
              tone="giay"
              size="sm"
              onPress={() => {
                setExtended(true);
                setTimeLeft((v) => v + 15);
              }}
            />
          )}
        </View>
      )}

      <Txt f="display" size={21} accessibilityRole="header">
        {q.prompt}
      </Txt>
      {q.hint && !done ? hint ? <InfoNote>{q.hint}</InfoNote> : <Btn title="Gợi ý" icon={Lightbulb} tone="ghost" size="sm" onPress={() => setHint(true)} /> : null}

      {q.type === 'mcq' && (
        <View style={{ gap: 10 }}>
          {options.map((o, i) => {
            const st = optionState(o.key);
            return (
              <AnswerButton
                key={String(o.key)}
                label={o.text}
                disabled={busy}
                onPress={() => pick(o.key)}
                state={st}
                left={<KeyBadge text={LETTERS[i]} />}
                right={stateIcon(st)}
              />
            );
          })}
        </View>
      )}

      {q.type === 'tf' && (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {[
            { key: true, text: 'Đúng' },
            { key: false, text: 'Sai' },
          ].map((o) => {
            const st: AnsState = !done ? (choice === o.key ? 'picked' : '') : reveal.choice === o.key ? 'correct' : choice === o.key ? 'wrong' : '';
            return (
              <AnswerButton
                key={o.text}
                label={o.text}
                center
                minHeight={64}
                disabled={busy}
                onPress={() => pick(o.key)}
                state={st}
                style={{ flex: 1 }}
                left={o.key ? <Check size={22} color={c.ngocChu} /> : <X size={22} color={c.sonChu} />}
              />
            );
          })}
        </View>
      )}

      {q.type === 'map' && (
        <View style={{ flexDirection: width >= 640 ? 'row' : 'column', gap: 12, alignItems: 'flex-start' }}>
          <View style={{ flex: 1, width: '100%', maxWidth: 420, alignSelf: 'center', borderRadius: 18, borderWidth: 2, borderColor: c.vien, overflow: 'hidden' }}>
            <SchematicMap
              dark={dark}
              selectable={done ? [] : (options.map((o) => o.key) as PlaceId[])}
              pins={options.map((o) => o.key) as PlaceId[]}
              labels={[]}
              selected={(choice as PlaceId) ?? null}
              correct={done ? ((reveal.choice as PlaceId) ?? null) : null}
              wrong={done && choice !== reveal.choice ? ((choice as PlaceId) ?? null) : null}
              onSelect={(id) => pick(id)}
              title="Lược đồ: chọn địa danh đúng"
            />
          </View>
          <View style={{ gap: 8, width: width >= 640 ? 220 : '100%' }} accessibilityLabel="Hoặc chọn trong danh sách">
            {options.map((o) => {
              const st = optionState(o.key);
              return <AnswerButton key={String(o.key)} label={o.text} minHeight={48} disabled={busy} onPress={() => pick(o.key)} state={st} left={<MapPin size={16} color={c.sonChu} />} right={stateIcon(st)} />;
            })}
          </View>
        </View>
      )}

      {q.type === 'order' && (
        <View style={{ gap: 12 }}>
          <View style={{ gap: 8 }} accessibilityLabel="Thứ tự em đã chọn">
            {(done ? (reveal.order ?? []) : order).map((key, i) => {
              const it = items.find((x) => x.key === key);
              const ok = done ? order[i] === key : null;
              return (
                <AnswerButton
                  key={`${key}-${i}`}
                  label={done ? `${i + 1}. ${it?.text ?? ''}` : (it?.text ?? '')}
                  minHeight={50}
                  disabled={done || phase === 'sending'}
                  onPress={() => setOrder((o) => o.filter((k) => k !== key))}
                  state={ok === true ? 'correct' : ok === false ? 'wrong' : ''}
                  left={<KeyBadge text={String(i + 1)} bg={c.dong} fg="#1c1917" />}
                  right={!done ? <X size={16} color={c.muc3} /> : null}
                />
              );
            })}
            {!done &&
              Array.from({ length: items.length - order.length }, (_, i) => (
                <View key={`empty-${i}`} style={{ minHeight: 50, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: c.vien2, justifyContent: 'center', paddingHorizontal: 16 }}>
                  <Txt size={14} color={c.muc3}>
                    Vị trí {order.length + i + 1}
                  </Txt>
                </View>
              ))}
          </View>
          {!done && items.length > order.length && (
            <View style={{ gap: 8 }}>
              <Txt f="semibold" size={14} color={c.muc2}>
                Chạm lần lượt theo thứ tự từ sớm đến muộn:
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {items
                  .filter((it) => !order.includes(it.key as number))
                  .map((it) => (
                    <AnswerButton key={String(it.key)} label={it.text} minHeight={48} onPress={() => setOrder((o) => [...o, it.key as number])} left={<Plus size={16} color={c.dongChu} />} />
                  ))}
              </View>
            </View>
          )}
          {!done && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn title="Làm lại" icon={RotateCcw} tone="giay" disabled={!order.length || phase === 'sending'} onPress={() => setOrder([])} />
              <Btn title="Kiểm tra" icon={Check} tone="ngoc" full style={{ flex: 1 }} loading={phase === 'sending'} disabled={order.length !== items.length} onPress={() => submit({ order })} />
            </View>
          )}
        </View>
      )}

      {q.type === 'match' && (
        <View style={{ gap: 12 }}>
          <Txt f="semibold" size={14} color={c.muc2}>
            Chạm một ô bên trái, rồi chạm ô bên phải tương ứng.
          </Txt>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, gap: 8 }}>
              {left.map((l, i) => {
                const paired = pairs[String(l.key)];
                const ok = done ? (reveal.pairs ?? {})[String(l.key)] === paired : null;
                const active = activeLeft === l.key;
                return (
                  <AnswerButton
                    key={String(l.key)}
                    label={l.text}
                    disabled={done || phase === 'sending'}
                    onPress={() => setActiveLeft(active ? null : (l.key as number))}
                    selected={active}
                    state={ok === true ? 'correct' : ok === false ? 'wrong' : active ? 'picked' : ''}
                    left={<KeyBadge text={String(i + 1)} bg={paired !== undefined ? c[PAIR_KEYS[i % PAIR_KEYS.length]] : c.giay2} fg={paired !== undefined ? '#ffffff' : c.muc2} />}
                  />
                );
              })}
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              {right.map((r) => {
                const owner = Object.entries(pairs).find(([, v]) => v === r.key)?.[0];
                const ownerIdx = owner === undefined ? -1 : left.findIndex((l) => String(l.key) === owner);
                const correctOwner = done ? Object.entries(reveal.pairs ?? {}).find(([, v]) => v === r.key)?.[0] : undefined;
                return (
                  <AnswerButton
                    key={String(r.key)}
                    label={r.text}
                    disabled={done || phase === 'sending' || activeLeft === null}
                    onPress={() => {
                      if (activeLeft === null) return;
                      setPairs((p) => {
                        const next: Record<string, number> = {};
                        for (const [k, v] of Object.entries(p)) if (v !== r.key && k !== String(activeLeft)) next[k] = v;
                        next[String(activeLeft)] = r.key as number;
                        return next;
                      });
                      setActiveLeft(null);
                    }}
                    left={ownerIdx >= 0 ? <KeyBadge text={String(ownerIdx + 1)} bg={c[PAIR_KEYS[ownerIdx % PAIR_KEYS.length]]} fg="#ffffff" /> : null}
                    right={done && correctOwner !== undefined ? <Chip text={`đúng: ${left.findIndex((l) => String(l.key) === correctOwner) + 1}`} bg={c.ngocNhat} fg={c.ngocChu} /> : null}
                  />
                );
              })}
            </View>
          </View>
          {!done && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn title="Làm lại" icon={RotateCcw} tone="giay" disabled={!Object.keys(pairs).length || phase === 'sending'} onPress={() => setPairs({})} />
              <Btn title="Kiểm tra" icon={Check} tone="ngoc" full style={{ flex: 1 }} loading={phase === 'sending'} disabled={Object.keys(pairs).length !== left.length} onPress={() => submit({ pairs })} />
            </View>
          )}
        </View>
      )}

      {phase === 'sending' && (q.type === 'mcq' || q.type === 'tf' || q.type === 'map') && <Spinner label="Đang chấm…" />}
      {failed && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 16, backgroundColor: c.sonNhat }} accessibilityRole="alert">
          <AlertTriangle size={16} color={c.sonChu} />
          <Txt f="semibold" size={14} color={c.sonChu} style={{ flex: 1 }}>
            Chưa gửi được câu trả lời. Kiểm tra kết nối rồi chọn lại nhé.
          </Txt>
        </View>
      )}

      {done && result && (
        <Animated.View
          style={[{ borderRadius: 22, padding: 16, borderWidth: 2, gap: 8, backgroundColor: result.correct ? c.ngocNhat : c.sonNhat, borderColor: result.correct ? c.ngoc : c.son }, pop]}
          accessibilityLiveRegion="polite"
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: result.correct ? c.ngoc : c.son, alignItems: 'center', justifyContent: 'center' }}>
              {result.correct ? <Check size={20} color="#ffffff" /> : <X size={20} color="#ffffff" />}
            </View>
            <Txt f="displayHeavy" size={21} color={result.correct ? c.ngocChu : c.sonChu} accessibilityRole="alert">
              {result.correct ? 'Chính xác!' : 'Chưa đúng rồi'}
            </Txt>
            <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 6 }}>
              {result.gems_gained > 0 && <Chip text={`+${result.gems_gained} Ấn Tín`} icon={Stamp} bg={c.the} fg={c.dongChu} />}
              <Chip text={`+${result.xp_gained} XP`} bg={c.the} fg={c.muc2} />
            </View>
          </View>
          <Txt>{result.explanation}</Txt>
          {result.correct && result.gems_gained === 0 && result.progress.day_gems >= result.progress.daily_gem_cap && (
            <Txt size={13} color={c.muc2}>
              Hôm nay em đã nhận đủ {result.progress.daily_gem_cap} Ấn Tín – vẫn được cộng XP.
            </Txt>
          )}
          {result.source && (
            <Txt f="semibold" size={12} color={c.muc2}>
              Nguồn: {result.source}
            </Txt>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            <Btn title={nextLabel} iconRight={ArrowRight} tone={result.correct ? 'ngoc' : 'son'} full style={{ flex: 1, minWidth: 160 }} onPress={onNext} />
            {!result.correct && <Btn title="Hỏi Quân Sư" icon={MessageSquare} tone="giay" onPress={() => askAdvisor(`Giải thích giúp em: ${q.prompt}`)} />}
          </View>
        </Animated.View>
      )}
    </View>
  );
};

// ---------------------------------------------------------------------- một lượt nhiều câu
export interface QuizSummary {
  correct: number;
  total: number;
  passed: boolean;
  results: AnswerResult[];
  gems: number;
  xp: number;
}

export interface QuizProps {
  request: QuestionRequest;
  passMark?: number;
  timer?: boolean;
  intro?: React.ReactNode;
  finishLabel?: string;
  sessionKind?: 'practice' | 'tower' | 'recruit' | 'raid' | null;
  onFinish?: (summary: QuizSummary) => void;
  /** Đóng lượt hỏi (sau khi bấm nút kết thúc) */
  onClose: () => void;
}

/** Nội dung một lượt hỏi đáp; đặt trong Sheet có sẵn để không phải mở hộp thoại thứ hai */
export const QuizPanel: React.FC<QuizProps> = ({ request, passMark, timer = false, intro, finishLabel = 'Hoàn thành', sessionKind = 'practice', onFinish, onClose }) => {
  const { fetchQuestions, state, finishSession, sound } = useGame();
  const { c } = useTheme();
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
    load();
    return () => {
      loadId.current++;
    };
  }, [load]);

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
    correct, total, passed, results, gems: results.reduce((s, r) => s + r.gems_gained, 0), xp: results.reduce((s, r) => s + r.xp_gained, 0),
  };

  return (
    <>
      {intro && !finished && index === 0 && results.length === 0 ? intro : null}
      {note && !finished ? <InfoNote>{note}</InfoNote> : null}
      {error ? (
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 20 }}>
          <Mascot size={90} mood="sad" />
          <Txt f="semibold" center>
            {error}
          </Txt>
          <Btn title="Thử lại" icon={RotateCcw} tone="ngoc" onPress={load} />
        </View>
      ) : !questions ? (
        <View style={{ gap: 10 }} accessibilityState={{ busy: true }}>
          <Skeleton height={22} width="35%" />
          <Skeleton height={60} />
          <Skeleton height={54} />
          <Skeleton height={54} />
          <Spinner label="Quân Sư đang chọn câu hỏi…" />
        </View>
      ) : finished ? (
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Mascot size={110} mood={passed ? 'excited' : 'thinking'} accessory={passed ? 'crown' : 'scholar'} bob />
          <Txt f="displayHeavy" size={26} center accessibilityRole="header">
            {passed ? 'Xuất sắc!' : 'Cố lên chút nữa!'}
          </Txt>
          <Txt color={c.muc2} center>
            Em trả lời đúng{' '}
            <Txt f="bold">
              {correct}/{total}
            </Txt>{' '}
            câu{passMark !== undefined ? ` (cần ${need})` : ''}.
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
            <Chip text={`+${summary.gems} Ấn Tín`} icon={Stamp} bg={c.dongNhat} fg={c.dongChu} />
            <Chip text={`+${summary.xp} XP`} bg={c.ngocNhat} fg={c.ngocChu} />
          </View>
          {!passed && <InfoNote>Câu sai đã có giải thích. Em có thể làm lại – mỗi lần câu hỏi sẽ khác.</InfoNote>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 6 }}>
            {!passed && <Btn title="Làm lại" icon={RotateCcw} tone="giay" onPress={load} />}
            <Btn
              title={finishLabel}
              icon={Trophy}
              tone={passed ? 'ngoc' : 'son'}
              size="lg"
              onPress={() => {
                onFinish?.(summary);
                onClose();
              }}
            />
          </View>
        </View>
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
    </>
  );
};

/** Lượt hỏi đáp trong hộp thoại riêng (khi chưa có hộp thoại nào đang mở) */
export const QuizSheet: React.FC<QuizProps & { open: boolean; title: string; subtitle?: string }> = ({ open, title, subtitle, ...props }) => (
  <Sheet open={open} onClose={props.onClose} title={title} subtitle={subtitle} wide>
    {open && <QuizPanel {...props} />}
  </Sheet>
);
