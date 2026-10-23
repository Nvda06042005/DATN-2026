import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle, Check, CheckCircle2, ChevronRight, Copy, Flame, Loader2, Lock, Maximize2, Radio, RotateCcw,
  Trophy, Unlock, Users, Wifi, WifiOff, X
} from 'lucide-react';
import { Confetti } from '@/components/customs/Confetti';
import { KahootShape } from '@/components/customs/KahootShape';
import { LiveOptionTiles } from '@/components/customs/live/LiveOptionTiles';
import { LiveTimer } from '@/components/customs/live/LiveTimer';
import { Mascot } from '@/components/customs/Mascot';
import { LIVE_COUNTS, LIVE_SCOPES } from '@/constants/live';
import { ANSWER_STYLES } from '@/constants/theme';
import { useCountdown } from '@/hooks/use-countdown';
import { useLiveSocket } from '@/hooks/use-live-socket';
import type { LiveHostPlayer, LiveHostRoom } from '@/types/liveType';
import { avatarColor, formatPin, shortName } from '@/utils/format';
import { liveJoinHref, sameLiveKey } from '@/utils/live';

interface LiveHostModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  token: string;
  onShowToast: (msg: string) => void;
  onSessionExpired: () => void;
  /** Gọi khi một trận vừa được lưu vào lịch sử lớp */
  onSaved: () => void;
  /** Học sinh thật của lớp – để biết bao nhiêu bạn đã vào phòng */
  students: Array<{ id: string; name: string }>;
}

export const LiveHostModal: React.FC<LiveHostModalProps> = (props) => (props.isOpen ? <LiveHostConsole {...props} /> : null);

const LiveHostConsole: React.FC<LiveHostModalProps> = ({ onClose, title, token, onShowToast, onSessionExpired, onSaved, students }) => {
  const [room, setRoom] = useState<LiveHostRoom | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ title: string; count: number; scope: string }>({ title, count: 10, scope: 'all' });
  const [seconds, startTimer] = useCountdown();
  const [busy, setBusy] = useState(false);
  const [ending, setEnding] = useState(false);
  const [kick, setKick] = useState<LiveHostPlayer | null>(null);
  const savedId = useRef<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const { status, send, reconnect } = useLiveSocket(token, (msg) => {
    if (msg.type === 'room') {
      setReady(true);
      setBusy(false);
      setError(null);
      setRoom(msg.room);
      startTimer(msg.room?.phase === 'question' ? msg.room.remaining_ms : null);
      if (msg.room?.session_id && savedId.current !== msg.room.session_id) {
        savedId.current = msg.room.session_id;
        onSaved();
      }
    } else if (msg.type === 'saved') {
      onSaved();
    } else if (msg.type === 'error') {
      setBusy(false);
      setError(msg.message);
    }
  });

  useEffect(() => {
    if (status === 'expired') onSessionExpired();
  }, [status, onSessionExpired]);

  const phaseKey = room ? `${room.phase}-${room.index}` : ready ? 'setup' : 'loading';
  useEffect(() => {
    headingRef.current?.focus();
  }, [phaseKey]);

  const act = (msg: Record<string, unknown>) => {
    const ok = send(msg);
    if (!ok) onShowToast('Đang nối lại máy chủ – thầy/cô thử lại sau giây lát');
    return ok;
  };
  const openRoom = () => {
    setBusy(true);
    if (!act({ type: 'create', title: form.title.trim(), count: form.count, scope: form.scope })) setBusy(false);
  };
  const endRoom = () => {
    act({ type: 'close' });
    onClose();
  };
  const requestClose = () => {
    if (!room) onClose();
    else if (room.phase === 'podium') endRoom();
    else setEnding(true);
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else document.documentElement.requestFullscreen?.().catch(() => onShowToast('Trình duyệt chặn toàn màn hình – nhấn F11 để trình chiếu'));
  };
  const copyLink = (href: string) => {
    navigator.clipboard
      ?.writeText(href)
      .then(() => onShowToast('Đã sao chép đường link vào phòng'))
      .catch(() => onShowToast('Không sao chép được – hãy đọc mã PIN cho cả lớp'));
  };

  const joined = room?.players.length ?? 0;
  const q = room?.question ?? null;
  const reveal = room?.reveal ?? null;
  const counts = reveal?.counts ?? [];
  const maxCount = Math.max(1, ...counts);
  const rightIndex = q && reveal ? q.options.findIndex((o) => sameLiveKey(o.key, reveal.key)) : -1;
  const rightCount = rightIndex >= 0 ? counts[rightIndex] ?? 0 : 0;
  const joinHref = room ? liveJoinHref(room.pin) : null;
  const announce = !room
    ? ''
    : room.phase === 'lobby'
    ? `${joined} học sinh đã vào phòng`
    : room.phase === 'question'
    ? `Câu ${room.index + 1} trên ${room.total}`
    : room.phase === 'reveal'
    ? `Đã công bố đáp án. ${rightCount} trên ${room.answered} bạn trả lời đúng`
    : room.phase === 'scoreboard'
    ? 'Bảng điểm'
    : 'Kết thúc trận';

  return (
    <div
      className="fixed inset-0 z-[60] kahoot-bg text-white flex flex-col overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={`Thi đấu cả lớp: ${room?.title ?? form.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !ending && !kick) requestClose();
      }}
    >
      {room?.phase === 'podium' && <Confetti count={90} />}

      {/* Hình nền trôi (trang trí) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {ANSWER_STYLES.map((s, i) => (
          <div key={s.shape} className="absolute animate-spin-slow opacity-[0.12]" style={{ left: `${6 + i * 26}%`, top: `${i % 2 ? 70 : 10}%`, animationDuration: `${20 + i * 6}s` }}>
            <KahootShape shape={s.shape} size={140} color="#fff" />
          </div>
        ))}
      </div>

      {/* Thanh trên */}
      <div className="relative z-10 flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-black text-2xl tracking-tight shrink-0">đông a!</span>
          {room && <span className="chip bg-white/15 text-white hidden sm:inline-flex truncate">{room.title}</span>}
          {room?.class_name && <span className="chip bg-white/15 text-white hidden md:inline-flex">Lớp {room.class_name}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1.5 rounded-xl bg-black/25 px-3 h-10 text-sm font-bold">
            {status === 'open' ? (
              <>
                <Wifi className="w-4 h-4" aria-hidden="true" /> <span className="hidden sm:inline">Đã kết nối</span>
                <span className="sr-only sm:hidden">Đã kết nối</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" aria-hidden="true" /> <span>{status === 'connecting' ? 'Đang kết nối…' : 'Đang nối lại…'}</span>
              </>
            )}
          </span>
          <button type="button" onClick={toggleFullscreen} className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 hidden sm:flex items-center justify-center" aria-label="Bật/tắt toàn màn hình">
            <Maximize2 className="w-5 h-5" aria-hidden="true" />
          </button>
          <button type="button" onClick={requestClose} className="w-11 h-11 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center" aria-label="Đóng phòng thi đấu">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <p className="sr-only" role="status" aria-atomic="true">
        {announce}
      </p>

      {!ready ? (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-3 font-black text-xl" role="status">
          <Loader2 className="w-10 h-10 animate-spin" aria-hidden="true" />
          {status === 'reconnecting' ? 'Chưa kết nối được máy chủ – đang thử lại…' : 'Đang kết nối phòng thi đấu…'}
        </div>
      ) : !room ? (
        /* ===== MỞ PHÒNG ===== */
        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto px-4 pb-8">
          <form
            className="max-w-xl mx-auto bg-white text-duo-ink rounded-3xl p-6 sm:p-8 shadow-[0_6px_0_rgba(0,0,0,0.25)] space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              openRoom();
            }}
          >
            <div>
              <h2 ref={headingRef} tabIndex={-1} className="font-black text-2xl sm:text-3xl outline-none">
                Mở phòng thi đấu
              </h2>
              <p className="text-sm font-semibold text-duo-wolf mt-1">
                Câu hỏi lấy từ ngân hàng của game (trắc nghiệm, đúng/sai), mỗi câu 20 giây. Server chấm và cộng XP, Ấn Tín, mức nắm vững như khi học sinh tự luyện.
              </p>
            </div>
            <div>
              <label htmlFor="live-title" className="block font-black text-sm mb-1.5">
                Tên trận
              </label>
              <input
                id="live-title"
                value={form.title}
                maxLength={120}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full min-h-[48px] rounded-xl border-2 border-duo-swan bg-white px-4 py-2 font-bold text-duo-ink focus:outline-none focus:border-kh-purple"
              />
            </div>
            <fieldset>
              <legend className="font-black text-sm mb-1.5">Số câu</legend>
              <div className="grid grid-cols-3 gap-2">
                {LIVE_COUNTS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={form.count === n}
                    onClick={() => setForm((f) => ({ ...f, count: n }))}
                    className={`min-h-[48px] rounded-xl border-2 font-black transition-colors ${form.count === n ? 'border-kh-purple bg-kh-purple text-white' : 'border-duo-swan bg-white text-duo-ink hover:border-kh-purple'}`}
                  >
                    {n} câu
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="font-black text-sm mb-1.5">Phạm vi câu hỏi</legend>
              <div className="grid grid-cols-2 gap-2">
                {LIVE_SCOPES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={form.scope === s.id}
                    onClick={() => setForm((f) => ({ ...f, scope: s.id }))}
                    className={`min-h-[48px] rounded-xl border-2 px-3 font-black transition-colors ${form.scope === s.id ? 'border-kh-purple bg-kh-purple text-white' : 'border-duo-swan bg-white text-duo-ink hover:border-kh-purple'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </fieldset>
            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-duo-red-light text-duo-red-dark px-4 py-3 text-sm font-bold">
                <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" /> {error}
              </p>
            )}
            <button type="submit" disabled={busy || status !== 'open'} className="btn-3d btn-gold btn-lg w-full">
              {busy ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <Radio className="w-5 h-5" aria-hidden="true" />} Mở phòng
            </button>
          </form>
        </div>
      ) : room.phase === 'lobby' ? (
        /* ===== PHÒNG CHỜ ===== */
        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto flex flex-col items-center px-4 pb-6">
          <h2 ref={headingRef} tabIndex={-1} className="sr-only">
            Phòng chờ – mã PIN {room.pin.split('').join(' ')}
          </h2>
          <div className="bg-white text-duo-ink rounded-2xl flex flex-col sm:flex-row items-stretch overflow-hidden shadow-[0_6px_0_rgba(0,0,0,0.25)] mt-2 w-full max-w-3xl">
            <div className="px-6 py-4 border-b-2 sm:border-b-0 sm:border-r-2 border-duo-swan flex-1 min-w-0">
              <p className="font-black text-sm text-duo-wolf">Học sinh vào phòng</p>
              <p className="font-bold leading-snug">
                Trang học sinh → <b>Quốc Tử Giám</b> → <b>Thi đấu cả lớp</b>, nhập mã PIN
              </p>
              {joinHref && (
                <div className="flex items-center gap-2 mt-2">
                  <p className="text-xs font-semibold text-duo-wolf break-all flex-1">{joinHref}</p>
                  <button type="button" onClick={() => copyLink(joinHref)} className="btn-3d btn-white btn-sm shrink-0">
                    <Copy className="w-4 h-4" aria-hidden="true" /> Sao chép
                  </button>
                </div>
              )}
            </div>
            <div className="px-6 py-3 text-center">
              <p className="font-black text-sm text-duo-wolf">Mã PIN</p>
              <p className="font-black text-5xl sm:text-6xl tracking-wider text-kh-purple tabular" aria-hidden="true">
                {formatPin(room.pin)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 w-full max-w-5xl mt-6">
            <span className="flex items-center gap-2 bg-black/25 rounded-xl px-4 py-2 font-black text-lg">
              <Users className="w-5 h-5" aria-hidden="true" /> {joined}
              {students.length > 0 ? `/${students.length}` : ''} học sinh
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => act({ type: 'lock', locked: !room.locked })} className="btn-3d btn-white" aria-pressed={room.locked}>
                {room.locked ? <Lock className="w-5 h-5" aria-hidden="true" /> : <Unlock className="w-5 h-5" aria-hidden="true" />}
                {room.locked ? 'Đã khóa phòng' : 'Khóa phòng'}
              </button>
              <button type="button" onClick={() => act({ type: 'start' })} disabled={joined === 0} className="btn-3d btn-gold btn-lg">
                Bắt đầu <ChevronRight className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>
          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-black/30 px-4 py-2 font-bold">
              {error}
            </p>
          )}

          {joined === 0 ? (
            <div className="mt-16 bg-black/25 rounded-2xl px-6 py-4 font-black text-xl text-center">
              {students.length === 0 ? 'Lớp chưa có học sinh – nhờ quản trị viên cấp tài khoản trước nhé' : 'Đang chờ học sinh nhập mã PIN…'}
            </div>
          ) : (
            <ul className="mt-8 flex flex-wrap justify-center gap-3 max-w-5xl" aria-label="Học sinh trong phòng">
              {room.players.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setKick(p)}
                    className={`animate-pop-in min-h-[44px] bg-black/30 hover:bg-black/45 rounded-xl px-4 py-2 font-black text-lg flex items-center gap-2 ${p.connected ? '' : 'opacity-60'}`}
                    aria-label={`${p.name}${p.connected ? '' : ' (mất kết nối)'} – bấm để mời ra khỏi phòng`}
                  >
                    {!p.connected && <WifiOff className="w-4 h-4" aria-hidden="true" />}
                    {shortName(p.name)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (room.phase === 'question' || room.phase === 'reveal') && q ? (
        /* ===== CÂU HỎI / CÔNG BỐ ĐÁP ÁN ===== */
        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto flex flex-col px-4 sm:px-6 pb-6">
          <h2 ref={headingRef} tabIndex={-1} className="bg-white text-duo-ink rounded-2xl px-6 py-4 text-center font-black text-xl sm:text-3xl leading-snug shadow-[0_6px_0_rgba(0,0,0,0.25)] outline-none">
            {q.prompt}
          </h2>

          {room.phase === 'question' ? (
            <div className="flex items-center justify-between gap-4 py-4">
              <LiveTimer seconds={seconds} total={room.duration_ms / 1000} size={110} light />
              <div className="flex flex-col items-center text-center min-w-0">
                <Mascot size={120} mood="thinking" accessory="helmet" bob className="hidden sm:block" />
                <span className="font-black text-sm text-white/80">
                  Câu {room.index + 1} / {room.total}
                </span>
                <span className="chip bg-white/15 text-white mt-1 max-w-full truncate">{q.topic}</span>
              </div>
              <div className="text-center shrink-0">
                <div className="font-black text-5xl tabular">
                  {room.answered}
                  <span className="text-2xl text-white/70">/{joined}</span>
                </div>
                <div className="font-black text-sm text-white/80">đã trả lời</div>
                <button type="button" onClick={() => act({ type: 'reveal' })} className="btn-3d btn-white btn-sm mt-3">
                  Công bố đáp án
                </button>
              </div>
            </div>
          ) : (
            reveal && (
              <div className="flex flex-col lg:flex-row gap-4 py-4">
                <ul className="flex-1 flex items-end justify-center gap-4 sm:gap-8 h-56" aria-label="Số học sinh chọn mỗi đáp án">
                  {q.options.map((o, i) => {
                    const s = ANSWER_STYLES[i % ANSWER_STYLES.length];
                    const count = counts[i] ?? 0;
                    const isRight = i === rightIndex;
                    return (
                      <li key={String(o.key)} className={`flex flex-col items-center justify-end h-full w-16 sm:w-24 ${isRight ? '' : 'opacity-50'}`}>
                        <div className="w-full rounded-t-lg transition-all duration-700 ease-out" style={{ height: `${Math.max(6, (count / maxCount) * 100)}%`, background: s.bg }} aria-hidden="true" />
                        <div className="w-full flex items-center justify-center gap-1.5 py-2 rounded-b-lg font-black text-xl" style={{ background: s.bg, color: s.fg }} aria-hidden="true">
                          <KahootShape shape={s.shape} size={18} color={s.fg} />
                          {count}
                          {isRight && <Check className="w-5 h-5 stroke-[4]" />}
                        </div>
                        <span className="sr-only">
                          {o.text}: {count} bạn chọn{isRight ? ' (đáp án đúng)' : ''}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div className="lg:w-[40%] bg-black/25 rounded-2xl p-4">
                  <p className="font-black text-lg">
                    {rightCount}/{room.answered} bạn trả lời đúng
                  </p>
                  <p className="font-semibold leading-relaxed mt-2">{reveal.explanation}</p>
                  {reveal.source && <p className="text-xs font-bold text-white/75 mt-2">Nguồn: {reveal.source}</p>}
                  <button type="button" onClick={() => act({ type: 'next' })} className="btn-3d btn-white mt-4">
                    Bảng điểm <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )
          )}

          <LiveOptionTiles q={q} correctKey={room.phase === 'reveal' && reveal ? reveal.key : null} />
        </div>
      ) : room.phase === 'scoreboard' ? (
        /* ===== BẢNG ĐIỂM ===== */
        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto flex flex-col items-center px-4 pb-6">
          <h2 ref={headingRef} tabIndex={-1} className="bg-white text-duo-ink rounded-2xl px-10 py-3 font-black text-3xl shadow-[0_6px_0_rgba(0,0,0,0.25)] outline-none">
            Bảng điểm
          </h2>
          <ol className="w-full max-w-2xl mt-8 space-y-3">
            {room.players.slice(0, 5).map((p, i) => (
              <li
                key={p.id}
                className={`flex items-center justify-between gap-3 rounded-xl px-5 py-3 font-black text-xl animate-slide-up ${i === 0 ? 'bg-white text-duo-ink' : 'bg-black/25'}`}
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-full flex items-center justify-center text-white text-base shrink-0" style={{ background: avatarColor(p.name) }}>
                    {i + 1}
                  </span>
                  <span className="truncate">{shortName(p.name)}</span>
                  {p.streak >= 2 && (
                    <span className={`flex items-center gap-0.5 text-sm ${i === 0 ? 'text-duo-red-dark' : 'text-white/90'}`}>
                      <Flame className="w-4 h-4" aria-hidden="true" /> {p.streak}
                      <span className="sr-only">câu đúng liên tiếp</span>
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3 shrink-0 tabular">
                  {p.last_gain > 0 && <span className={`text-sm ${i === 0 ? 'text-duo-green-dark' : 'text-duo-green-light'}`}>+{p.last_gain}</span>}
                  {p.score.toLocaleString('vi-VN')}
                </span>
              </li>
            ))}
          </ol>
          {joined > 5 && <p className="mt-3 font-bold text-white/80">và {joined - 5} bạn khác</p>}
          <button type="button" onClick={() => act({ type: 'next' })} className="btn-3d btn-white mt-8">
            {room.index + 1 < room.total ? 'Câu tiếp theo' : 'Xem bục vinh quang'} <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        /* ===== BỤC VINH QUANG ===== */
        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto flex flex-col items-center px-4 pb-6">
          <h2 ref={headingRef} tabIndex={-1} className="flex items-center justify-center gap-2 font-black text-2xl sm:text-3xl text-center outline-none mt-1 mb-4 max-w-4xl">
            <Trophy className="w-8 h-8 text-duo-gold shrink-0" aria-hidden="true" />
            <span className="line-clamp-2">{room.title}</span>
          </h2>
          <div className="flex items-end justify-center gap-3 sm:gap-6 w-full max-w-3xl">
            {[room.players[1], room.players[0], room.players[2]].map((p, i) =>
              p ? (
                <div key={p.id} className="flex flex-col items-center w-1/3 max-w-[220px] animate-slide-up" style={{ animationDelay: `${[400, 900, 0][i]}ms` }}>
                  {i === 1 && <Mascot size={72} accessory="crown" mood="love" bob />}
                  <span className="font-black text-xl sm:text-2xl text-center mt-1">{shortName(p.name)}</span>
                  <span className="font-bold text-white/80">{p.score.toLocaleString('vi-VN')} điểm</span>
                  <div className={`w-full mt-2 rounded-t-2xl flex flex-col items-center justify-start pt-3 ${['h-28', 'h-40', 'h-20'][i]}`} style={{ background: ['#c0c0c0', '#d97706', '#cd7f32'][i] }}>
                    <span className="w-12 h-12 rounded-full bg-white/40 flex items-center justify-center font-black text-2xl text-black/60">{[2, 1, 3][i]}</span>
                  </div>
                </div>
              ) : null
            )}
          </div>
          <section className="w-full max-w-3xl bg-black/25 rounded-2xl p-4 mt-6" aria-labelledby="live-final-title">
            <h3 id="live-final-title" className="font-black text-lg mb-2">
              Kết quả cả lớp
            </h3>
            <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
              {room.players.map((p, i) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-1 border-b border-white/10 font-bold">
                  <span className="truncate">
                    {i + 1}. {p.name}
                  </span>
                  <span className="shrink-0 tabular text-white/85">
                    {p.score.toLocaleString('vi-VN')} · {p.correct}/{room.total} đúng
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <p className="mt-4 font-bold text-white/85 flex items-center gap-2" role="status">
            {room.session_id ? (
              <>
                <CheckCircle2 className="w-5 h-5" aria-hidden="true" /> Đã lưu vào lịch sử thi đấu của lớp
              </>
            ) : room.saved ? (
              'Đang lưu kết quả…'
            ) : null}
          </p>
          <div className="w-full flex flex-wrap items-center justify-center gap-3 py-4">
            <button type="button" onClick={openRoom} disabled={busy} className="btn-3d btn-white">
              <RotateCcw className="w-4 h-4" aria-hidden="true" /> Trận mới
            </button>
            <button type="button" onClick={endRoom} className="btn-3d btn-gold">
              Kết thúc
            </button>
          </div>
        </div>
      )}

      {/* ===== HỘP THOẠI ===== */}
      {ending && room && (
        <div className="absolute inset-0 z-20 bg-black/55 flex items-center justify-center p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="live-end-title" className="w-full max-w-md bg-white text-duo-ink rounded-3xl p-6 space-y-4">
            <h3 id="live-end-title" className="font-black text-xl">
              Kết thúc phòng thi đấu?
            </h3>
            <p className="text-sm font-semibold text-duo-wolf">
              {room.phase === 'lobby'
                ? 'Học sinh trong phòng chờ sẽ được báo là phòng đã đóng.'
                : 'Kết quả tới câu hiện tại vẫn được lưu vào lịch sử lớp. Nếu chỉ tạm rời, phòng được giữ 15 phút để thầy/cô quay lại.'}
            </p>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={endRoom} className="btn-3d btn-red w-full">
                Kết thúc trận
              </button>
              <button type="button" onClick={onClose} className="btn-3d btn-white w-full">
                Tạm rời, giữ phòng mở
              </button>
              <button type="button" onClick={() => setEnding(false)} className="btn-3d btn-white w-full" autoFocus>
                Tiếp tục
              </button>
            </div>
          </div>
        </div>
      )}
      {kick && (
        <div className="absolute inset-0 z-20 bg-black/55 flex items-center justify-center p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="live-kick-title" className="w-full max-w-md bg-white text-duo-ink rounded-3xl p-6 space-y-4">
            <h3 id="live-kick-title" className="font-black text-xl">
              Mời {kick.name} ra khỏi phòng?
            </h3>
            <p className="text-sm font-semibold text-duo-wolf">Bạn này sẽ không vào lại được phòng thi đấu này.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  act({ type: 'kick', player_id: kick.id });
                  setKick(null);
                }}
                className="btn-3d btn-red flex-1"
              >
                Mời ra
              </button>
              <button type="button" onClick={() => setKick(null)} className="btn-3d btn-white flex-1" autoFocus>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
      {status === 'replaced' && (
        <div className="absolute inset-0 z-30 bg-black/65 flex items-center justify-center p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="live-replaced-title" className="w-full max-w-md bg-white text-duo-ink rounded-3xl p-6 space-y-4">
            <h3 id="live-replaced-title" className="font-black text-xl">
              Phòng đang được điều khiển ở nơi khác
            </h3>
            <p className="text-sm font-semibold text-duo-wolf">Thầy/cô vừa mở phòng thi đấu ở một tab hoặc máy khác.</p>
            <div className="flex gap-2">
              <button type="button" onClick={reconnect} className="btn-3d btn-gold flex-1" autoFocus>
                Điều khiển ở đây
              </button>
              <button type="button" onClick={onClose} className="btn-3d btn-white flex-1">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
