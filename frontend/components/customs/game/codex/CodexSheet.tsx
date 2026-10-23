import React, { useState } from 'react';
import { Lock, MessageSquare, ScrollText, Target } from 'lucide-react';
import { LoreChip } from '@/components/customs/game/GameChips';
import { QuizSheet } from '@/components/customs/game/QuizSheet';
import { Mascot } from '@/components/customs/Mascot';
import { GBtn } from '@/components/ui/button';
import { RichText } from '@/components/ui/rich-text';
import { Sheet } from '@/components/ui/sheet';
import { CATEGORY_LABEL } from '@/constants/game/exam';
import { useGame } from '@/hooks/use-game';
import type { CodexEntry } from '@/types/learningType';

export const CodexSheet: React.FC<{ entry: CodexEntry | null; unlocked: boolean; onClose: () => void; onUnlocked: (unit: string) => void }> = ({ entry, unlocked, onClose, onUnlocked }) => {
  const { askAdvisor } = useGame();
  const [quiz, setQuiz] = useState(false);
  if (!entry) return null;
  return (
    <>
      <Sheet open={!quiz} onClose={onClose} title={entry.topic} subtitle={entry.event} wide icon={<span className="w-11 h-11 rounded-2xl bg-dong text-[#1c1917] flex items-center justify-center"><ScrollText className="w-6 h-6" aria-hidden={true} /></span>}>
        {unlocked ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              <LoreChip lore={entry.label} />
              {entry.badge && <span className="g-chip bg-dong-nhat text-dong-chu">{entry.badge}</span>}
              <span className="g-chip bg-giay-2 text-muc-2">{CATEGORY_LABEL[entry.category] ?? entry.category}</span>
            </div>
            <blockquote className="rounded-2xl border-l-4 border-dong bg-the p-4 font-serif text-[1.05rem] leading-relaxed">{entry.fact_chunk}</blockquote>
            {entry.answer && <RichText text={entry.answer} className="text-muc" />}
            {entry.entity && <p className="text-sm text-muc-2">Nhân vật: {entry.entity}</p>}
            {entry.source && <p className="text-xs font-semibold text-muc-2">Nguồn: {entry.source}</p>}
            <div className="flex flex-wrap gap-2">
              <GBtn variant="ngoc" onClick={() => askAdvisor(`Quân Sư kể thêm về ${entry.topic} cho em nhé`)}>
                <MessageSquare className="w-4 h-4" aria-hidden={true} /> Hỏi Quân Sư
              </GBtn>
              <GBtn variant="giay" onClick={() => setQuiz(true)}>
                <Target className="w-4 h-4" aria-hidden={true} /> Ôn 3 câu
              </GBtn>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center gap-3 py-4">
            <Mascot size={96} mood="thinking" accessory="scholar" />
            <p className="font-semibold">Thẻ Sử Ký này đang khóa.</p>
            <p className="text-sm text-muc-2">Trả lời đúng 1 câu về “{entry.topic}” để mở thẻ và đọc tư liệu.</p>
            <GBtn variant="son" onClick={() => setQuiz(true)}>
              <Lock className="w-4 h-4" aria-hidden={true} /> Mở thẻ
            </GBtn>
          </div>
        )}
      </Sheet>
      <QuizSheet
        open={quiz}
        onClose={() => setQuiz(false)}
        title={unlocked ? 'Ôn chủ đề' : 'Mở thẻ Sử Ký'}
        subtitle={entry.topic}
        request={{ units: [entry.unit_id], count: unlocked ? 3 : 1 }}
        passMark={1}
        sessionKind={unlocked ? 'practice' : null}
        finishLabel={unlocked ? 'Hoàn thành' : 'Đọc thẻ'}
        onFinish={(sum) => {
          if (!unlocked && sum.correct > 0) onUnlocked(entry.unit_id);
        }}
      />
    </>
  );
};
