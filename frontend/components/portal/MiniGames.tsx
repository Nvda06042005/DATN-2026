/**
 * Mini-game lịch sử của học sinh (Sprint 6, HK.HS.058–060): ghép thẻ trong thời gian giới hạn, sắp xếp dòng thời gian, ô chữ. Máy chủ giữ đáp án, kiểm tra từng
 * lần ghép và giữ đồng hồ; giao diện chỉ hiển thị thời gian còn lại. Kết quả hiện bằng chữ kèm sao và điểm, không chỉ dựa vào màu.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, TextInput, View, useWindowDimensions } from 'react-native';
import { ArrowDown, ArrowUp, CheckCircle2, Clock, RotateCcw, Trophy, XCircle } from 'lucide-react-native';
import * as api from '@/api/battleApi';
import { ApiError, errorMessage } from '@/api/client';
import { ErrorNote } from '@/components/admin/kit';
import type { Session } from '@/components/auth';
import { Bar, Btn, Card, Chip, Spinner, Stars, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { CrosswordGame, MatchGame, MiniRun, TimelineGame } from '@/types/battle';

/** Đếm ngược từ số mili giây còn lại do máy chủ trả; hết giờ thì gọi `onZero` một lần để máy chủ chốt lượt */
function useCountdown(initial: number | null, running: boolean, onZero: () => void): number {
  const [left, setLeft] = useState(initial ?? 0);
  const deadline = useRef(Date.now() + (initial ?? 0));
  const fired = useRef(false);
  useEffect(() => { deadline.current = Date.now() + (initial ?? 0); fired.current = false; setLeft(initial ?? 0); }, [initial]);
  useEffect(() => {
    if (!running || initial === null) return undefined;
    const timer = setInterval(() => {
      const ms = Math.max(0, deadline.current - Date.now());
      setLeft(ms);
      if (ms <= 0 && !fired.current) { fired.current = true; onZero(); }
    }, 250);
    return () => clearInterval(timer);
  }, [running, initial, onZero]);
  return left;
}

const TimerBar: React.FC<{ left: number; total: number }> = ({ left, total }) => {
  const { c } = useTheme();
  const s = Math.ceil(left / 1000);
  const hurry = left <= 10_000;
  return (
    <View accessibilityRole="timer" accessibilityLabel={`Còn ${s} giây`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Clock size={20} color={hurry ? c.sonChu : c.muc2} />
      <View style={{ flex: 1 }}><Bar value={left} max={Math.max(1, total * 1000)} height={12} fill={hurry ? c.son : c.ngoc} /></View>
      <Txt f="displayHeavy" size={22} color={hurry ? c.sonChu : c.muc} style={{ minWidth: 64, textAlign: 'right' }}>{Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</Txt>
    </View>
  );
};

// ---------------------------------------------------------------------- ghép thẻ (HK.HS.058)
const MatchPlayer: React.FC<{ run: MiniRun; game: MatchGame; busy: boolean; onPair: (left: string, right: string) => Promise<boolean | undefined>; onFinish: () => void }> = ({ run, game, busy, onPair, onFinish }) => {
  const { c } = useTheme();
  const [left, setLeft] = useState<string | null>(null);
  const [right, setRight] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const matchedLeft = new Set(game.matched.map((m) => m.left)), matchedRight = new Set(game.matched.map((m) => m.right));
  const choose = async (l: string | null, r: string | null) => {
    if (!l || !r) return;
    const ok = await onPair(l, r);
    setMessage(ok === undefined ? null : ok ? { ok: true, text: 'Ghép đúng!' } : { ok: false, text: 'Chưa đúng, hãy thử cặp khác. Mỗi lần ghép sai bị trừ một ít điểm.' });
    setLeft(null); setRight(null);
  };
  const Card_: React.FC<{ id: string; text: string; side: 'l' | 'r' }> = ({ id, text, side }) => {
    const done = side === 'l' ? matchedLeft.has(id) : matchedRight.has(id);
    const on = side === 'l' ? left === id : right === id;
    return (
      <Pressable accessibilityRole="button" accessibilityState={{ selected: on, disabled: done || busy }} accessibilityLabel={`${text}${done ? ', đã ghép' : on ? ', đang chọn' : ''}`} disabled={done || busy}
        onPress={() => { if (side === 'l') { setLeft(id); void choose(id, right); } else { setRight(id); void choose(left, id); } }}
        style={{ minHeight: 56, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 2, justifyContent: 'center', borderColor: done ? c.ngoc : on ? c.thuy : c.vien, backgroundColor: done ? c.ngocNhat : on ? c.thuyNhat : c.the, opacity: done ? 0.8 : 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {done ? <CheckCircle2 size={18} color={c.ngocChu} /> : null}
          <Txt f={on ? 'bold' : 'semibold'} size={15} style={{ flex: 1 }}>{text}</Txt>
        </View>
      </Pressable>
    );
  };
  return (
    <View style={{ gap: 12 }}>
      <Txt size={14} color={c.muc2}>Bấm một thẻ bên trái rồi một thẻ bên phải để ghép thành cặp. Đã ghép {game.matched.length}/{game.total} cặp · ghép sai {game.wrong} lần.</Txt>
      {message ? <Chip text={message.text} bg={message.ok ? c.ngocNhat : c.sonNhat} fg={message.ok ? c.ngocChu : c.sonChu} /> : null}
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 8 }}>
          <Txt f="bold" size={13} color={c.muc2}>{game.left_label}</Txt>
          {game.lefts.map((x) => <Card_ key={x.id} id={x.id} text={x.text} side="l" />)}
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          <Txt f="bold" size={13} color={c.muc2}>{game.right_label}</Txt>
          {game.rights.map((x) => <Card_ key={x.id} id={x.id} text={x.text} side="r" />)}
        </View>
      </View>
      <Btn title="Nộp bài và kết thúc" tone="giay" disabled={busy || !game.matched.length} onPress={onFinish} testID="match-finish" />
      <Txt size={12} color={c.muc3}>{run.points} điểm tối đa cho bài này.</Txt>
    </View>
  );
};

// ---------------------------------------------------------------------- sắp xếp dòng thời gian (HK.HS.059)
const TimelinePlayer: React.FC<{ game: TimelineGame; busy: boolean; onSubmit: (order: string[]) => void }> = ({ game, busy, onSubmit }) => {
  const { c } = useTheme();
  const [order, setOrder] = useState(game.items.map((i) => i.id));
  const text = (id: string) => game.items.find((i) => i.id === id)?.text ?? id;
  const move = (index: number, delta: number) => setOrder((o) => { const next = [...o]; const t = index + delta; if (t < 0 || t >= next.length) return o; [next[index], next[t]] = [next[t], next[index]]; return next; });
  return (
    <View style={{ gap: 10 }}>
      <Txt size={14} color={c.muc2}>Dùng mũi tên để đưa các sự kiện về đúng thứ tự thời gian: sớm nhất ở trên cùng.</Txt>
      {order.map((id, i) => (
        <View key={id} style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 2, borderColor: c.vien, backgroundColor: c.the }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.dongNhat, alignItems: 'center', justifyContent: 'center' }}><Txt f="bold" size={14} color={c.dongChu}>{i + 1}</Txt></View>
          <Txt f="medium" size={16} style={{ flex: 1 }}>{text(id)}</Txt>
          <Btn icon={ArrowUp} label={`Đưa lên: ${text(id)}`} tone="giay" size="sm" disabled={i === 0 || busy} onPress={() => move(i, -1)} />
          <Btn icon={ArrowDown} label={`Đưa xuống: ${text(id)}`} tone="giay" size="sm" disabled={i === order.length - 1 || busy} onPress={() => move(i, 1)} />
        </View>
      ))}
      <Btn title="Nộp bài" tone="ngoc" size="lg" full loading={busy} onPress={() => onSubmit(order)} testID="timeline-submit" />
    </View>
  );
};

// ---------------------------------------------------------------------- ô chữ (HK.HS.060)
const plain = (s: string) => s.normalize('NFD').replace(/\p{Mn}/gu, '').replace(/đ/gi, 'd').toUpperCase().replace(/[^A-Z0-9]/g, '');

const CrosswordPlayer: React.FC<{ game: CrosswordGame; busy: boolean; onSubmit: (words: Record<string, string>) => void }> = ({ game, busy, onSubmit }) => {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const [letters, setLetters] = useState<Record<string, string>>({});
  const cell = Math.max(26, Math.min(40, Math.floor((Math.min(width, 720) - 48) / game.cols)));
  const cells = useMemo(() => {
    const map = new Map<string, { number?: number }>();
    for (const w of game.words) {
      for (let i = 0; i < w.length; i++) {
        const key = `${w.row + (w.dir === 'down' ? i : 0)},${w.col + (w.dir === 'across' ? i : 0)}`;
        const cur = map.get(key) ?? {};
        if (i === 0) cur.number = w.number;
        map.set(key, cur);
      }
    }
    return map;
  }, [game]);
  const set = (key: string, value: string) => setLetters((l) => ({ ...l, [key]: plain(value).slice(-1) }));
  const submit = () => onSubmit(Object.fromEntries(game.words.map((w) => [w.id, Array.from({ length: w.length }, (_, i) => letters[`${w.row + (w.dir === 'down' ? i : 0)},${w.col + (w.dir === 'across' ? i : 0)}`] || ' ').join('')])));
  const clues = (dir: 'across' | 'down') => game.words.filter((w) => w.dir === dir).sort((a, b) => a.number - b.number);
  return (
    <View style={{ gap: 12 }}>
      <Txt size={14} color={c.muc2}>Gõ từng chữ cái vào ô (bỏ dấu, không cần gõ khoảng trắng). Số nhỏ trong ô là số thứ tự của gợi ý.</Txt>
      <View accessibilityLabel={`Ô chữ ${game.rows} hàng ${game.cols} cột`} style={{ alignSelf: 'center' }}>
        {Array.from({ length: game.rows }, (_, r) => (
          <View key={r} style={{ flexDirection: 'row' }}>
            {Array.from({ length: game.cols }, (_, col) => {
              const key = `${r},${col}`;
              const info = cells.get(key);
              if (!info) return <View key={col} style={{ width: cell, height: cell }} />;
              return (
                <View key={col} style={{ width: cell, height: cell, borderWidth: 1.5, borderColor: c.muc2, backgroundColor: c.the }}>
                  {info.number ? <Txt size={9} color={c.muc3} style={{ position: 'absolute', left: 2, top: 0 }}>{info.number}</Txt> : null}
                  <TextInput value={letters[key] ?? ''} onChangeText={(v) => set(key, v)} maxLength={3} autoCapitalize="characters" autoCorrect={false} editable={!busy}
                    accessibilityLabel={`Ô hàng ${r + 1} cột ${col + 1}${info.number ? `, gợi ý số ${info.number}` : ''}`} style={{ flex: 1, textAlign: 'center', paddingTop: info.number ? 8 : 0, fontSize: Math.round(cell * 0.5), fontWeight: '700', color: c.muc } as never} />
                </View>
              );
            })}
          </View>
        ))}
      </View>
      {(['across', 'down'] as const).map((dir) => (
        <View key={dir} style={{ gap: 6 }}>
          <Txt f="bold" size={15}>{dir === 'across' ? 'Hàng ngang' : 'Hàng dọc'}</Txt>
          {clues(dir).map((w) => <Txt key={w.id} size={14} style={{ lineHeight: 21 }}><Txt f="bold" size={14}>{w.number}.</Txt> ({w.length} chữ) {w.clue}</Txt>)}
        </View>
      ))}
      <Btn title="Nộp bài" tone="ngoc" size="lg" full loading={busy} onPress={submit} testID="crossword-submit" />
    </View>
  );
};

// ---------------------------------------------------------------------- kết quả
const MiniResultView: React.FC<{ run: MiniRun; onReplay: () => void; onClose: () => void }> = ({ run, onReplay, onClose }) => {
  const { c } = useTheme();
  const r = run.result!;
  const detail = r.detail as { review?: Array<Record<string, any>> } | null;
  return (
    <View style={{ gap: 14 }}>
      <Card style={{ alignItems: 'center', gap: 8, backgroundColor: r.passed ? c.ngocNhat : c.the2 }}>
        <Trophy size={40} color={r.passed ? c.ngocChu : c.muc3} />
        <Txt f="displayHeavy" size={26} center accessibilityRole="header">{r.timed_out ? 'Hết giờ' : r.passed ? 'Hoàn thành!' : 'Chưa đạt, thử lại nhé'}</Txt>
        <Txt f="displayHeavy" size={44}>{r.percent}%</Txt>
        <Txt size={14} color={c.muc2} center>Đúng {r.units}/{r.total}{r.wrong !== undefined ? ` · ghép sai ${r.wrong} lần` : ''} · cần đạt 60% · {Math.max(1, Math.round(r.duration_ms / 1000))} giây</Txt>
        <Stars n={r.stars} size={30} />
        <Txt f="bold" size={16}>{r.score}/{r.max} điểm</Txt>
      </Card>
      {run.mode === 'preview' ? <Chip text="Chơi thử: không ghi điểm" bg={c.dichNhat} fg={c.dich} /> : r.xp_awarded > 0 ? <Txt f="bold" size={15} color={c.ngocChu}>+{r.xp_awarded} điểm vào tài khoản của em</Txt> : r.score > 0 ? <Txt size={14} color={c.muc2}>Điểm chỉ tăng khi em vượt kỷ lục cũ.</Txt> : null}
      {run.kind === 'timeline' && detail?.review ? (
        <View style={{ gap: 8 }}>
          <Txt f="displayHeavy" size={20} accessibilityRole="header">Thứ tự đúng</Txt>
          {detail.review.map((x) => (
            <Card key={x.id} flat pad={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderLeftWidth: 5, borderLeftColor: x.ok ? c.ngoc : c.son }}>
              <Txt f="bold" size={15}>{x.position}.</Txt>
              <View style={{ flex: 1 }}><Txt f="semibold" size={15}>{x.text}</Txt>{x.when ? <Txt size={13} color={c.muc2}>{x.when}</Txt> : null}</View>
              <Txt f="bold" size={13} color={x.ok ? c.ngocChu : c.sonChu}>{x.ok ? 'Đúng vị trí' : 'Sai vị trí'}</Txt>
            </Card>
          ))}
        </View>
      ) : null}
      {run.kind === 'crossword' && detail?.review ? (
        <View style={{ gap: 8 }}>
          <Txt f="displayHeavy" size={20} accessibilityRole="header">Đáp án</Txt>
          {detail.review.map((x) => (
            <Card key={x.id} flat pad={12} style={{ gap: 2, borderLeftWidth: 5, borderLeftColor: x.ok ? c.ngoc : c.son }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{x.ok ? <CheckCircle2 size={16} color={c.ngocChu} /> : <XCircle size={16} color={c.sonChu} />}<Txt f="bold" size={15}>{x.answer}</Txt></View>
              {!x.ok ? <Txt size={13} color={c.muc2}>Em điền: {String(x.given).trim() || '(bỏ trống)'}</Txt> : null}
            </Card>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Btn icon={RotateCcw} title="Chơi lại" tone="dong" onPress={onReplay} testID="mini-replay" />
        <Btn title="Xong" tone="ngoc" onPress={onClose} testID="mini-done" />
      </View>
    </View>
  );
};

/** Màn chơi một mini-game: bắt đầu (hoặc tiếp tục lượt dở), chơi, kết quả */
export const MiniScreen: React.FC<{ session: Session; id: number; restart?: boolean; preview?: boolean; onClose: (changed: boolean) => void }> = ({ session, id, restart, preview, onClose }) => {
  const { token } = session;
  const { c } = useTheme();
  const [run, setRun] = useState<MiniRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const guard = useCallback((e: unknown) => { if (e instanceof ApiError && e.status === 401) session.expired(); setError(errorMessage(e)); }, [session]);
  const begin = useCallback(async (again?: boolean) => {
    setBusy(true); setError(null);
    try { setRun(await api.startMinigame(token, id, { restart: again ?? restart, preview })); } catch (e) { guard(e); } finally { setBusy(false); }
  }, [token, id, restart, preview, guard]);
  useEffect(() => { void begin(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const settle = useCallback(() => { if (run) api.getRun(token, run.id).then((r) => setRun(r as MiniRun)).catch(guard); }, [run, token, guard]);
  const left = useCountdown(run?.remaining_ms ?? null, run?.status === 'active', settle);

  const pair = async (l: string, r: string): Promise<boolean | undefined> => {
    if (!run) return undefined;
    setBusy(true); setError(null);
    try { const res = await api.answerMini(token, run.id, { left: l, right: r }); setRun(res.run); return res.correct; } catch (e) { guard(e); return undefined; } finally { setBusy(false); }
  };
  const submit = async (body: Record<string, unknown>) => {
    if (!run) return;
    setBusy(true); setError(null);
    try { setRun((await api.answerMini(token, run.id, body)).run); } catch (e) { guard(e); } finally { setBusy(false); }
  };
  const finish = async () => {
    if (!run) return;
    setBusy(true);
    try { setRun(await api.finishRun(token, run.id)); } catch (e) { guard(e); } finally { setBusy(false); }
  };

  if (!run) return error ? <ErrorNote message={error} /> : <Spinner label="Đang chuẩn bị mini-game…" />;
  return (
    <View style={{ gap: 14 }}>
      <Txt f="bold" size={13} color={c.muc3} upper numberOfLines={2}>{run.title}{run.mode === 'preview' ? ' · chơi thử' : ''}</Txt>
      <ErrorNote message={error} />
      {run.status === 'done' && run.result ? <MiniResultView run={run} onReplay={() => begin(true)} onClose={() => onClose(true)} /> : (
        <>
          <TimerBar left={left} total={run.seconds} />
          {run.kind === 'match' ? <MatchPlayer run={run} game={run.game as MatchGame} busy={busy} onPair={pair} onFinish={finish} /> : null}
          {run.kind === 'timeline' ? <TimelinePlayer game={run.game as TimelineGame} busy={busy} onSubmit={(order) => submit({ order })} /> : null}
          {run.kind === 'crossword' ? <CrosswordPlayer game={run.game as CrosswordGame} busy={busy} onSubmit={(words) => submit({ words })} /> : null}
        </>
      )}
    </View>
  );
};
