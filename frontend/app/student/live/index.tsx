import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Clock, Flame, Info, Loader2, Radio, Trophy, Users, WifiOff, X } from 'lucide-react';
import { KahootShape } from '@/components/customs/KahootShape';
import { LiveTimer } from '@/components/customs/live/LiveTimer';
import { Mascot } from '@/components/customs/Mascot';
import { GBtn } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ANSWER_STYLES } from '@/constants/theme';
import { useCountdown } from '@/hooks/use-countdown';
import { useGame } from '@/hooks/use-game';
import { useLiveSocket } from '@/hooks/use-live-socket';
import { rememberLiveRoom } from '@/store/live-room.store';
import type { LiveKey, LivePlayerState } from '@/types/liveType';
import { formatPin, shortName } from '@/utils/format';
import { sameLiveKey } from '@/utils/live';

export const LiveArena: React.FC<{
  token: string;
  initialPin: string | null;
  /** Mở tự động sau khi tải lại trang: server báo không còn trong phòng thì đóng luôn */
  resume: boolean;
  onClose: () => void;
  onSessionExpired: () => void;
}> = ({ token, initialPin, resume, onClose, onSessionExpired }) => {
  const { sound } = useGame();
  const [state, setState] = useState<LivePlayerState | null>(null);
  const [ready, setReady] = useState(false);
  const [final, setFinal] = useState<LivePlayerState | null>(null);
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [pin, setPin] = useState(initialPin ?? '');
  const [joining, setJoining] = useState(false);
  const [seconds, startTimer] = useCountdown();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const autoPin = useRef(initialPin);
  const firstMessage = useRef(true);
  const cue = useRef('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);

  const { status, send, reconnect } = useLiveSocket(token, (msg, sendNow) => {
    if (msg.type === 'state') {
      const s = msg.state;
      const first = firstMessage.current;
      firstMessage.current = false;
      setReady(true);
      setJoining(false);
      setState(s);
      startTimer(s?.phase === 'question' ? s.remaining_ms : null);
      if (s) {
        setNotice(null);
        setFinal(null);
        rememberLiveRoom(s.pin);
        const key = s.phase === 'reveal' ? `${s.pin}-${s.index}` : s.phase === 'podium' ? `${s.pin}-podium` : '';
        if (key && cue.current !== key) {
          cue.current = key;
          sound(s.phase === 'podium' ? (s.me.rank <= 3 ? 'win' : 'ok') : s.me.last_correct ? 'ok' : 'bad');
        }
        return;
      }
      rememberLiveRoom(null);
      if (autoPin.current) {
        const p = autoPin.current;
        autoPin.current = null;
        setJoining(sendNow({ type: 'join', pin: p }));
      } else if (first && resume) {
        onClose();
      }
    } else if (msg.type === 'error') {
      setJoining(false);
      setNotice({ tone: 'error', text: msg.message });
    } else if (msg.type === 'kicked') {
      rememberLiveRoom(null);
      setState(null);
      startTimer(null);
      setNotice({ tone: 'error', text: 'Thầy cô đã mời em ra khỏi phòng thi đấu.' });
    } else if (msg.type === 'closed') {
      rememberLiveRoom(null);
      setFinal(state);
      setState(null);
      startTimer(null);
      setNotice({ tone: 'info', text: msg.reason === 'expired' ? 'Phòng thi đấu đã hết hạn.' : 'Thầy cô đã đóng phòng thi đấu.' });
    }
  });

  useEffect(() => {
    if (status === 'expired') onSessionExpired();
  }, [status, onSessionExpired]);

  const phaseKey = state ? `${state.phase}-${state.index}` : final ? 'final' : ready ? 'pin' : 'loading';
  useEffect(() => {
    if (phaseKey === 'pin') pinRef.current?.focus();
    else headingRef.current?.focus();
  }, [phaseKey]);

  const close = () => {
    if (state) send({ type: 'leave' });
    rememberLiveRoom(null);
    onClose();
  };
  const requestClose = () => {
    if (state && state.phase !== 'podium') setConfirmLeave(true);
    else close();
  };
  const join = (e: React.FormEvent) => {
    e.preventDefault();
    const p = pin.replace(/\D/g, '');
    if (p.length !== 6) {
      setNotice({ tone: 'error', text: 'Mã PIN gồm 6 chữ số trên màn hình của thầy cô.' });
      return;
    }
    setNotice(null);
    if (send({ type: 'join', pin: p })) setJoining(true);
    else setNotice({ tone: 'error', text: 'Chưa kết nối được máy chủ – em thử lại sau giây lát nhé.' });
  };
  const answer = (key: LiveKey) => {
    if (!state?.question || state.me.answered) return;
    if (!send({ type: 'answer', question_id: state.question.id, choice: key })) setNotice({ tone: 'error', text: 'Mất kết nối – đang nối lại, em bấm lại nhé.' });
  };

  const me = state?.me;
  const q = state?.question ?? null;
  const rightOption = q && state?.reveal ? q.options.find((o) => sameLiveKey(o.key, state.reveal?.key)) : undefined;
  const rightIndex = q && rightOption ? q.options.indexOf(rightOption) : -1;
  const announce =
    !state || !me
      ? ''
      : state.phase === 'lobby'
      ? `Đã vào phòng ${state.title}. Chờ thầy cô bắt đầu.`
      : state.phase === 'question'
      ? me.answered
        ? 'Đã chốt đáp án. Chờ cả lớp.'
        : `Câu ${state.index + 1} trên ${state.total}`
      : state.phase === 'reveal'
      ? `${me.last_correct ? `Chính xác, cộng ${me.last_gain} điểm` : me.last_correct === false ? 'Chưa đúng' : 'Hết giờ'}. Em đang xếp hạng ${me.rank}.`
      : state.phase === 'scoreboard'
      ? `Em đang xếp hạng ${me.rank} với ${me.score} điểm.`
      : `Kết thúc trận. Em xếp hạng ${me.rank} với ${me.score} điểm.`;

  const resultCard = (s: LivePlayerState, heading: string) => (
    <div className="g-card p-5 text-center space-y-3">
      <Mascot size={110} mood={s.me.rank <= 3 ? 'love' : 'happy'} accessory={s.me.rank === 1 ? 'crown' : 'helmet'} bob className="mx-auto" />
      <h2 ref={headingRef} tabIndex={-1} className="font-display font-extrabold text-2xl outline-none">
        {heading}
      </h2>
      <p className="font-display font-extrabold text-5xl tabular text-son-chu">Hạng {s.me.rank}</p>
      <p className="font-semibold text-muc-2">
        {s.me.score.toLocaleString('vi-VN')} điểm · đúng {s.me.correct}/{s.me.answered_total} câu đã trả lời
      </p>
      {s.top.length > 0 && (
        <ol className="text-left max-w-xs mx-auto space-y-1.5" aria-label="Ba bạn dẫn đầu">
          {s.top.map((t, i) => (
            <li key={`${t.name}-${i}`} className="flex items-center gap-2 font-semibold">
              <span className="w-7 h-7 rounded-full flex items-center justify-center font-display font-extrabold text-sm shrink-0" style={{ background: ['#d97706', '#c0c0c0', '#cd7f32'][i], color: '#1f1600' }}>
                {i + 1}
              </span>
              <span className="flex-1 truncate">{shortName(t.name)}</span>
              <span className="tabular text-muc-2">{t.score.toLocaleString('vi-VN')}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );

  let content: React.ReactNode;
  if (status === 'replaced') {
    content = (
      <div className="g-card p-5 text-center space-y-3">
        <h2 ref={headingRef} tabIndex={-1} className="font-display font-extrabold text-xl outline-none">
          Phòng thi đấu đang mở ở nơi khác
        </h2>
        <p className="text-muc-2">Em vừa mở phòng thi đấu ở một tab hoặc thiết bị khác.</p>
        <div className="flex flex-col min-[420px]:flex-row gap-2 justify-center">
          <GBtn onClick={reconnect}>Chơi ở đây</GBtn>
          <GBtn variant="giay" onClick={onClose}>
            Đóng
          </GBtn>
        </div>
      </div>
    );
  } else if (!ready) {
    content = (
      <div className="py-16 flex justify-center">
        <Spinner label={status === 'reconnecting' ? 'Chưa kết nối được máy chủ – đang thử lại…' : 'Đang kết nối phòng thi đấu…'} />
      </div>
    );
  } else if (!state) {
    content = (
      <div className="space-y-4">
        {notice && (
          <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`rounded-2xl px-4 py-3 font-semibold flex items-start gap-2 ${notice.tone === 'error' ? 'bg-son-nhat text-son-chu' : 'bg-ngoc-nhat text-ngoc-chu'}`}>
            {notice.tone === 'error' ? <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden={true} /> : <Info className="w-5 h-5 shrink-0 mt-0.5" aria-hidden={true} />}
            {notice.text}
          </p>
        )}
        {final ? (
          <>
            {resultCard(final, 'Kết quả của em')}
            <div className="flex flex-col min-[420px]:flex-row gap-2">
              <GBtn variant="giay" className="flex-1" onClick={() => setFinal(null)}>
                Vào phòng khác
              </GBtn>
              <GBtn className="flex-1" onClick={close}>
                Về Quốc Tử Giám
              </GBtn>
            </div>
          </>
        ) : (
          <form className="g-card p-5 space-y-4" onSubmit={join} noValidate>
            <div className="flex items-center gap-3">
              <Mascot size={76} mood="excited" accessory="helmet" bob />
              <div>
                <h2 ref={headingRef} tabIndex={-1} className="font-display font-extrabold text-2xl leading-tight outline-none">
                  Vào phòng thi đấu
                </h2>
                <p className="text-sm text-muc-2">Nhập mã PIN 6 chữ số trên màn hình của thầy cô.</p>
              </div>
            </div>
            <div>
              <label htmlFor="live-pin" className="block font-display font-bold mb-1.5">
                Mã PIN
              </label>
              <input
                ref={pinRef}
                id="live-pin"
                inputMode="numeric"
                autoComplete="off"
                maxLength={7}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^\d ]/g, ''))}
                aria-describedby="live-pin-help"
                className="w-full min-h-[60px] rounded-2xl border-2 border-vien bg-the px-4 text-center font-display font-extrabold text-3xl tracking-[0.3em] tabular text-muc focus:outline-none focus:border-ngoc"
              />
              <p id="live-pin-help" className="text-xs text-muc-2 mt-1.5">
                Câu trả lời được máy chủ chấm và cộng XP, Ấn Tín như khi luyện tập.
              </p>
            </div>
            <GBtn type="submit" size="lg" className="w-full" disabled={joining || status !== 'open'}>
              {joining ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden={true} /> : <Radio className="w-5 h-5" aria-hidden={true} />}
              Vào phòng
            </GBtn>
          </form>
        )}
      </div>
    );
  } else if (state.phase === 'lobby' && me) {
    content = (
      <div className="g-card p-6 text-center space-y-3">
        <Mascot size={120} mood="excited" accessory="helmet" bob className="mx-auto" />
        <h2 ref={headingRef} tabIndex={-1} className="font-display font-extrabold text-2xl outline-none">
          Em đã vào phòng!
        </h2>
        <p className="text-muc-2">
          <b className="text-muc">{me.name}</b> – chờ thầy cô bắt đầu trận nhé.
        </p>
        <p className="inline-flex items-center gap-2 g-chip bg-ngoc-nhat text-ngoc-chu">
          <Users className="w-4 h-4" aria-hidden={true} /> {state.players} bạn trong phòng
        </p>
        <p className="text-sm text-muc-2">
          Mỗi câu {Math.round(state.duration_ms / 1000)} giây · {state.total} câu · trả lời đúng và nhanh để được nhiều điểm
        </p>
      </div>
    );
  } else if ((state.phase === 'question' || state.phase === 'reveal') && q && me) {
    const revealed = state.phase === 'reveal';
    content = (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          {!revealed && <LiveTimer seconds={seconds} total={state.duration_ms / 1000} size={64} />}
          <p className="text-sm font-semibold text-muc-2 min-w-0">
            Câu {state.index + 1}/{state.total}
            <span className="block truncate">{q.topic}</span>
          </p>
        </div>
        <h2 ref={headingRef} tabIndex={-1} className="g-card p-4 font-display font-extrabold text-xl leading-snug outline-none">
          {q.prompt}
        </h2>
        {revealed ? (
          <div className="space-y-3">
            <div className={`rounded-2xl p-4 flex items-center gap-3 ${me.last_correct ? 'bg-ngoc text-white' : me.last_correct === false ? 'bg-son text-white' : 'bg-giay-2 text-muc'}`}>
              <span className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                {me.last_correct ? <Check className="w-7 h-7 stroke-[3]" aria-hidden={true} /> : me.last_correct === false ? <X className="w-7 h-7 stroke-[3]" aria-hidden={true} /> : <Clock className="w-7 h-7" aria-hidden={true} />}
              </span>
              <div className="min-w-0">
                <p className="font-display font-extrabold text-2xl leading-tight">{me.last_correct ? 'Chính xác!' : me.last_correct === false ? 'Chưa đúng' : 'Hết giờ'}</p>
                <p className="font-semibold">
                  {me.last_correct ? `+${me.last_gain} điểm` : 'Không có điểm câu này'}
                  {me.streak >= 2 && (
                    <span className="inline-flex items-center gap-1 ml-2">
                      <Flame className="w-4 h-4" aria-hidden={true} /> {me.streak} câu đúng liên tiếp
                    </span>
                  )}
                </p>
              </div>
              <p className="ml-auto text-right font-display font-extrabold shrink-0">
                Hạng {me.rank}
                <span className="block text-sm font-semibold opacity-90 tabular">{me.score.toLocaleString('vi-VN')} điểm</span>
              </p>
            </div>
            {rightOption && (
              <div
                className="rounded-2xl px-4 py-3 flex items-center gap-3 font-display font-extrabold text-lg"
                style={{ background: ANSWER_STYLES[rightIndex % ANSWER_STYLES.length].bg, color: ANSWER_STYLES[rightIndex % ANSWER_STYLES.length].fg }}
              >
                <KahootShape shape={ANSWER_STYLES[rightIndex % ANSWER_STYLES.length].shape} size={26} color={ANSWER_STYLES[rightIndex % ANSWER_STYLES.length].fg} />
                <span className="flex-1">
                  <span className="block text-xs font-bold opacity-90">Đáp án đúng</span>
                  {rightOption.text}
                </span>
              </div>
            )}
            {state.reveal && (
              <p className="g-card p-4 text-sm leading-relaxed flex gap-2">
                <Info className="w-4 h-4 mt-0.5 shrink-0 text-ngoc-chu" aria-hidden={true} />
                <span>{state.reveal.explanation}</span>
              </p>
            )}
            <p className="text-center text-sm text-muc-2">Chờ thầy cô chuyển sang bảng điểm…</p>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-muc-2" aria-live="polite">
              {me.answered ? 'Đã chốt đáp án! Chờ cả lớp trả lời…' : 'Chọn một đáp án:'}
            </p>
            <div className={`grid gap-3 ${q.options.length > 2 ? 'grid-cols-1 min-[420px]:grid-cols-2' : 'grid-cols-2'}`}>
              {q.options.map((o, i) => {
                const s = ANSWER_STYLES[i % ANSWER_STYLES.length];
                const chosen = sameLiveKey(me.choice, o.key);
                return (
                  <button
                    key={String(o.key)}
                    type="button"
                    disabled={me.answered || seconds === 0}
                    aria-pressed={chosen}
                    onClick={() => answer(o.key)}
                    className={`min-h-[88px] rounded-2xl px-4 py-3 flex items-center gap-3 text-left font-display font-extrabold text-lg leading-snug transition active:translate-y-0.5 disabled:cursor-default ${
                      me.answered && !chosen ? 'opacity-35' : ''
                    } ${chosen ? 'outline outline-4 outline-offset-2 outline-muc' : ''}`}
                    style={{ background: s.bg, color: s.fg, boxShadow: `0 5px 0 ${s.shadow}` }}
                  >
                    <KahootShape shape={s.shape} size={30} color={s.fg} />
                    <span className="flex-1">{o.text}</span>
                    {chosen && <Check className="w-6 h-6 stroke-[3] shrink-0" aria-hidden={true} />}
                  </button>
                );
              })}
            </div>
            {notice?.tone === 'error' && (
              <p role="alert" className="rounded-2xl px-4 py-3 bg-son-nhat text-son-chu font-semibold text-sm">
                {notice.text}
              </p>
            )}
          </>
        )}
      </div>
    );
  } else if (state.phase === 'scoreboard' && me) {
    content = (
      <div className="space-y-3">
        {resultCard(state, 'Bảng điểm')}
        <p className="text-center text-sm text-muc-2">Chờ câu tiếp theo…</p>
      </div>
    );
  } else if (me) {
    content = (
      <div className="space-y-3">
        {resultCard(state, 'Kết thúc trận!')}
        <GBtn size="lg" className="w-full" onClick={close}>
          Về Quốc Tử Giám
        </GBtn>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[80] paper-bg text-muc flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-arena-title"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !confirmLeave) requestClose();
      }}
    >
      <header className="shrink-0 border-b-2 border-vien bg-the">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-2 flex items-center gap-2">
          <span className="w-10 h-10 rounded-2xl bg-son text-white flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5" aria-hidden={true} />
          </span>
          <div className="min-w-0 flex-1">
            <p id="live-arena-title" className="font-display font-extrabold leading-tight truncate">
              {state?.title ?? final?.title ?? 'Thi đấu cả lớp'}
            </p>
            <p className="text-xs font-semibold text-muc-2 truncate">{state ? `Phòng ${formatPin(state.pin)} · ${state.players} bạn` : 'Cùng cả lớp trả lời câu hỏi của thầy cô'}</p>
          </div>
          {me && (
            <span className="g-pill tabular shrink-0" aria-label={`Điểm của em: ${me.score}`}>
              <Trophy className="w-4 h-4" aria-hidden={true} /> {me.score.toLocaleString('vi-VN')}
            </span>
          )}
          <GBtn variant="ghost" iconOnly onClick={requestClose} aria-label={state && state.phase !== 'podium' ? 'Rời phòng thi đấu' : 'Đóng thi đấu cả lớp'}>
            <X className="w-5 h-5" aria-hidden={true} />
          </GBtn>
        </div>
        {(status === 'reconnecting' || (state && !state.host_online)) && (
          <p role="status" className="bg-dong-nhat text-dong-chu text-sm font-semibold px-4 py-1.5 flex items-center justify-center gap-2">
            <WifiOff className="w-4 h-4" aria-hidden={true} />
            {status === 'reconnecting' ? 'Mất kết nối – đang nối lại…' : 'Thầy cô đang mất kết nối – chờ một chút…'}
          </p>
        )}
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-5">{content}</div>
      </main>
      <p className="sr-only" role="status" aria-atomic="true">
        {announce}
      </p>

      {confirmLeave && (
        <div className="absolute inset-0 z-10 bg-black/45 flex items-end sm:items-center justify-center p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="live-leave-title" className="g-card w-full max-w-sm p-5 space-y-3">
            <h3 id="live-leave-title" className="font-display font-extrabold text-xl">
              Rời phòng thi đấu?
            </h3>
            <p className="text-sm text-muc-2">Các câu em đã trả lời vẫn được tính. Muốn chơi tiếp thì nhập lại mã PIN.</p>
            <div className="flex gap-2">
              <GBtn variant="son" className="flex-1" onClick={close}>
                Rời phòng
              </GBtn>
              <GBtn variant="giay" className="flex-1" onClick={() => setConfirmLeave(false)} autoFocus>
                Ở lại
              </GBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
