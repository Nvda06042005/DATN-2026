import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChessKnight, Siren, Swords, Warehouse } from 'lucide-react';
import { BattleBackdrop } from '@/components/customs/game/art/BattleBackdrop';
import { QuestionCard } from '@/components/customs/game/QuestionCard';
import { Mascot } from '@/components/customs/Mascot';
import { GBtn } from '@/components/ui/button';
import { InfoNote } from '@/components/ui/info-note';
import { Bar } from '@/components/ui/progress-bar';
import { Sheet } from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { useGame } from '@/hooks/use-game';
import { todayKey } from '@/store/game.store';
import type { ServedQuestion } from '@/types/learningType';
import { fmt } from '@/utils/format';

/** Sự kiện “Giặc Mông – Nguyên cướp lương” */
export const RaidEvent: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { state, update, toast, fetchQuestions, sound, finishSession } = useGame();
  const [stage, setStage] = useState<'alarm' | 'choose' | 'question' | 'result'>('alarm');
  const [mode, setMode] = useState<'vuon_khong' | 'chan' | null>(null);
  const [q, setQ] = useState<ServedQuestion | null>(null);
  const [outcome, setOutcome] = useState<{ title: string; text: string; delta: number; good: boolean } | null>(null);
  const [seconds, setSeconds] = useState(30);
  const [stamina, setStamina] = useState(100);
  const lastCorrect = useRef(false);
  const timed = state.settings.timer;

  const resolve = useCallback(
    (m: 'vuon_khong' | 'chan' | null, correct: boolean) => {
      const luong = state.luong;
      let delta = 0;
      let title = '';
      let text = '';
      let good = false;
      if (m === 'vuon_khong' && correct) {
        delta = Math.max(20, Math.round(luong * 0.1));
        title = 'Giặc đói kiệt, phải rút lui!';
        text = 'Toàn bộ lương đã vào Kho Bí Mật. Giặc vào điền trang trống, không cướp được gì nên kiệt sức mà rút. Em nhận thêm phần thưởng.';
        good = true;
      } else if (m === 'vuon_khong') {
        delta = -Math.round(luong * 0.05);
        title = 'Giấu được một nửa số lương';
        text = 'Chưa trả lời đúng nên chỉ kịp giấu 50% lương vào kho. Giặc cướp được một ít rồi rút đi.';
      } else if (m === 'chan' && correct) {
        delta = Math.round(luong * 0.05);
        title = 'Đánh chặn thành công!';
        text = 'Quân ta chặn đánh, giặc không cướp được lương.';
        good = true;
      } else {
        delta = -Math.round(luong * 0.1);
        title = 'Giặc cướp được một ít lương';
        text = m ? 'Đánh chặn chưa thành công.' : 'Không kịp ứng phó.';
      }
      update((s) => ({ ...s, luong: Math.max(0, s.luong + delta), raid: { sessions: 0, lastDay: todayKey() } }));
      setOutcome({ title, text, delta, good });
      setStage('result');
      sound(good ? 'win' : 'bad');
    },
    [state.luong, update, sound]
  );

  useEffect(() => {
    if (!timed || stage === 'result' || stage === 'question') return;
    if (seconds <= 0) {
      resolve(null, false);
      return;
    }
    const t = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [seconds, stage, timed, resolve]);

  useEffect(() => {
    if (stage !== 'result' || !outcome?.good || mode !== 'vuon_khong') return;
    const t = window.setInterval(() => setStamina((s) => Math.max(0, s - 10)), 140);
    return () => window.clearInterval(t);
  }, [stage, outcome, mode]);

  const choose = (m: 'vuon_khong' | 'chan') => {
    setMode(m);
    setStage('question');
    fetchQuestions({ units: m === 'vuon_khong' ? ['KC1_VUON_KHONG_NHA_TRONG'] : ['KC1_OVERVIEW', 'KC1_DONG_BO_DAU', 'CAUSES_OF_VICTORY'], count: 1 })
      .then((res) => setQ(res.questions[0] ?? null))
      .catch(() => {
        toast('Không tải được câu hỏi');
        setStage('choose');
      });
  };

  return (
    <Sheet
      open
      persistent={stage !== 'result'}
      onClose={onDone}
      title="Báo động! Giặc kéo đến cướp lương"
      subtitle={stage === 'result' ? 'Kết quả ứng phó' : 'Quân xâm lược đi xa, phải dựa vào lương cướp tại chỗ.'}
      icon={<span className="w-11 h-11 rounded-2xl bg-son text-white flex items-center justify-center animate-alarm"><Siren className="w-6 h-6" aria-hidden={true} /></span>}
      wide
    >
      {(stage === 'alarm' || stage === 'choose') && (
        <div className="space-y-4">
          <div className="relative h-24 rounded-2xl overflow-hidden bg-giay-2" aria-hidden="true">
            <BattleBackdrop bg="plain" dark={false} />
            <div className="absolute inset-y-0 right-0 flex items-center gap-3 pr-4 animate-march">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-12 h-12 rounded-xl bg-dich text-white flex items-center justify-center shadow">
                  <ChessKnight className="w-7 h-7" aria-hidden={true} />
                </span>
              ))}
            </div>
          </div>
          {timed && (
            <div className="flex items-center gap-3" aria-live="polite">
              <Bar value={seconds} max={30} fill={seconds <= 10 ? 'bg-son' : 'bg-dong'} className="flex-1" label="Thời gian ứng phó" />
              <span className="font-display font-extrabold text-xl tabular w-14 text-right">{seconds}s</span>
            </div>
          )}
          <p className="font-semibold">
            Giặc sắp đến Điền Trang. Trong kho có <strong>{fmt(state.luong)}</strong> Lương Thảo. Em chọn cách ứng phó:
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <button type="button" className="g-card p-4 text-left hover:-translate-y-0.5 transition" onClick={() => choose('vuon_khong')}>
              <span className="w-11 h-11 rounded-2xl bg-ngoc text-white flex items-center justify-center mb-2">
                <Warehouse className="w-6 h-6" aria-hidden={true} />
              </span>
              <p className="font-display font-extrabold text-lg">Vườn không nhà trống</p>
              <p className="text-sm text-muc-2 mt-1">Giấu hết lương vào Kho Bí Mật. Trả lời 1 câu “Vì sao…?”.</p>
            </button>
            <button type="button" className="g-card p-4 text-left hover:-translate-y-0.5 transition" onClick={() => choose('chan')}>
              <span className="w-11 h-11 rounded-2xl bg-son text-white flex items-center justify-center mb-2">
                <Swords className="w-6 h-6" aria-hidden={true} />
              </span>
              <p className="font-display font-extrabold text-lg">Đánh chặn</p>
              <p className="text-sm text-muc-2 mt-1">Ra quân chặn giặc. Trả lời 1 câu để thắng trận phòng thủ ngắn.</p>
            </button>
          </div>
          <InfoNote>Tệ nhất em chỉ mất 10% Lương Thảo. Không mất tướng, không mất công trình.</InfoNote>
        </div>
      )}
      {stage === 'question' &&
        (q ? (
          <QuestionCard
            q={q}
            index={0}
            total={1}
            timerSec={null}
            nextLabel="Xem kết quả"
            onAnswered={(r) => {
              lastCorrect.current = r.correct;
              finishSession('raid', r.correct ? 1 : 0, 1);
            }}
            onNext={() => resolve(mode, lastCorrect.current)}
          />
        ) : (
          <Spinner label="Đang chuẩn bị câu hỏi…" />
        ))}
      {stage === 'result' && outcome && (
        <div className="space-y-4 text-center">
          {mode === 'vuon_khong' && outcome.good && (
            <div className="g-card-flat p-4 text-left space-y-2">
              <p className="font-semibold text-muc-2">Sức bền của giặc</p>
              <Bar value={stamina} max={100} fill="bg-son" label="Sức bền của giặc" height={16} />
              <p className="text-sm text-muc-2">Không cướp được lương, giặc tụt sức bền rồi phải rút.</p>
            </div>
          )}
          <Mascot size={100} mood={outcome.good ? 'excited' : 'sad'} accessory={outcome.good ? 'helmet' : 'none'} className="mx-auto" />
          <p className="font-display font-extrabold text-2xl">{outcome.title}</p>
          <p className="text-muc-2">{outcome.text}</p>
          <p className={`font-display font-extrabold text-xl ${outcome.delta >= 0 ? 'text-ngoc-chu' : 'text-son-chu'}`}>
            {outcome.delta >= 0 ? '+' : ''}
            {fmt(outcome.delta)} Lương Thảo
          </p>
          <div className="g-inset p-4 text-left">
            <p className="font-display font-bold mb-1">Bài học lịch sử</p>
            <p className="text-muc leading-relaxed">
              Quân xâm lược đi xa, phải dựa vào lương cướp tại chỗ và đoàn vận lương. Khi nhân dân thực hiện “vườn không nhà trống”, giặc không cướp được lương nên kiệt sức và buộc
              phải rút – như ở Thăng Long năm 1258.
            </p>
          </div>
          <GBtn variant="ngoc" size="lg" className="w-full" onClick={onDone}>
            <Check className="w-5 h-5" aria-hidden={true} /> Về Điền Trang
          </GBtn>
        </div>
      )}
    </Sheet>
  );
};
