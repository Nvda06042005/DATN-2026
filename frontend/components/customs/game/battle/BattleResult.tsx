import React from 'react';
import { BookOpen, Check, RotateCcw, Trophy, X } from 'lucide-react';
import { LoreChip } from '@/components/customs/game/GameChips';
import { Mascot } from '@/components/customs/Mascot';
import { GBtn } from '@/components/ui/button';
import { InfoNote } from '@/components/ui/info-note';
import { Sheet } from '@/components/ui/sheet';
import { Stars } from '@/components/ui/stars';
import { useGame } from '@/hooks/use-game';
import { starsOf } from '@/lib/game/battle-engine';
import type { BattleState } from '@/types/battleType';

export const BattleResult: React.FC<{ b: BattleState; onDone: () => void }> = ({ b, onDone }) => {
  const { state } = useGame();
  const stars = starsOf(b);
  const prevStars = state.campaign[b.phase.id] ?? 0;
  const win = b.result === 'win';
  return (
    <Sheet open persistent onClose={onDone} title={win ? 'Chiến thắng!' : 'Lui quân'} subtitle={b.endText} wide>
      <div className="grid md:grid-cols-2 gap-5">
        <div className="flex flex-col items-center text-center gap-3">
          <Mascot size={110} mood={win ? 'excited' : 'sad'} accessory={win ? 'helmet' : 'none'} bob={win} />
          {win && <Stars n={stars} size={34} label={`Đạt ${stars}/3 sao`} />}
          <ul className="text-left w-full space-y-1.5 text-sm">
            <li className={`flex items-center gap-2 ${win ? 'text-ngoc-chu font-semibold' : 'text-muc-2'}`}>
              {win ? <Check className="w-4 h-4 shrink-0" aria-hidden={true} /> : <X className="w-4 h-4 shrink-0" aria-hidden={true} />} Thắng trận
            </li>
            <li className={`flex items-center gap-2 ${b.stratGood ? 'text-ngoc-chu font-semibold' : 'text-muc-2'}`}>
              {b.stratGood ? <Check className="w-4 h-4 shrink-0" aria-hidden={true} /> : <X className="w-4 h-4 shrink-0" aria-hidden={true} />} Kế sách “{b.phase.strat.name}”: {b.phase.strat.starHint.charAt(0).toLowerCase() + b.phase.strat.starHint.slice(1)} (trả lời đúng câu hỏi)
            </li>
            <li className={`flex items-center gap-2 ${b.answered > 0 && b.correct / b.answered >= 0.8 ? 'text-ngoc-chu font-semibold' : 'text-muc-2'}`}>
              {b.answered > 0 && b.correct / b.answered >= 0.8 ? <Check className="w-4 h-4 shrink-0" aria-hidden={true} /> : <X className="w-4 h-4 shrink-0" aria-hidden={true} />} Trả lời đúng từ 80% (
              {b.correct}/{b.answered})
            </li>
          </ul>
          {win && stars > prevStars && <p className="g-chip bg-dong-nhat text-dong-chu !text-sm">Kỷ lục mới của màn này!</p>}
        </div>
        <div className="space-y-3">
          <div className="g-inset p-4">
            <p className="font-display font-bold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-ngoc-chu" aria-hidden={true} /> Sử Ký: {b.phase.name} ({b.phase.date})
            </p>
            <p className="mt-1 leading-relaxed">{b.phase.history}</p>
            <LoreChip lore="chinh_su" className="mt-2" />
          </div>
          {b.phase.id === 'm2p1' && win && (
            <div className="rounded-2xl border-2 border-hoa bg-hoa-nhat p-4">
              <p className="font-display font-bold text-hoa-chu">Tưởng nhớ Trần Bình Trọng</p>
              <p className="text-sm leading-relaxed mt-1">Ông đã hy sinh để triều đình rút lui an toàn. Câu nói “Ta thà làm quỷ nước Nam, chứ không thèm làm vương đất Bắc!” còn vang mãi.</p>
            </div>
          )}
          {!win && <InfoNote>Mỗi câu sai trong trận đều có giải thích. Em ôn lại chủ đề của màn ở Quốc Tử Giám rồi đánh lại nhé – không mất gì ngoài lượt chơi.</InfoNote>}
          <GBtn variant={win ? 'ngoc' : 'son'} size="lg" className="w-full" onClick={onDone}>
            {win ? <Trophy className="w-5 h-5" aria-hidden={true} /> : <RotateCcw className="w-5 h-5" aria-hidden={true} />} {win ? 'Nhận thưởng' : 'Về bản đồ chiến dịch'}
          </GBtn>
        </div>
      </div>
    </Sheet>
  );
};
