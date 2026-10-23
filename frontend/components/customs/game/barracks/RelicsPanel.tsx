import React from 'react';
import { Check, Lock } from 'lucide-react';
import { LoreChip } from '@/components/customs/game/GameChips';
import { GBtn } from '@/components/ui/button';
import { InfoNote } from '@/components/ui/info-note';
import { RELICS } from '@/constants/game/relics';
import { useGame } from '@/hooks/use-game';

export const RelicsPanel: React.FC = () => {
  const { state, update, toast } = useGame();
  return (
    <div className="space-y-4">
      <InfoNote>Mỗi trận được mang theo 1 cổ vật. Hiệu ứng là sáng tạo của game; câu chuyện đi kèm có nhãn nguồn tư liệu.</InfoNote>
      <ul className="grid sm:grid-cols-2 gap-3">
        {Object.values(RELICS).map((r) => {
          const owned = state.relics.includes(r.id);
          const equipped = state.relic === r.id;
          const Icon = r.Icon;
          return (
            <li key={r.id} className={`g-card p-4 space-y-2 ${owned ? '' : 'opacity-80'}`}>
              <div className="flex items-center gap-3">
                <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${owned ? 'bg-dong text-[#1c1917]' : 'bg-giay-2 text-muc-3'}`}>
                  {owned ? <Icon className="w-6 h-6" aria-hidden={true} /> : <Lock className="w-5 h-5" aria-hidden={true} />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-extrabold leading-tight">{r.name}</p>
                  <LoreChip lore={r.lore} className="mt-1" />
                </div>
              </div>
              <p className="text-sm font-semibold text-muc">{r.effect}</p>
              <p className="text-sm text-muc-2">{r.story}</p>
              {owned ? (
                <GBtn
                  variant={equipped ? 'ngoc' : 'giay'}
                  size="sm"
                  className="w-full"
                  aria-pressed={equipped}
                  onClick={() => {
                    update((s) => ({ ...s, relic: equipped ? null : r.id }));
                    toast(equipped ? `Đã cất ${r.name}` : `Mang theo ${r.name} khi ra trận`);
                  }}
                >
                  {equipped ? (
                    <>
                      <Check className="w-4 h-4" aria-hidden={true} /> Đang mang theo
                    </>
                  ) : (
                    'Mang theo khi ra trận'
                  )}
                </GBtn>
              ) : (
                <p className="text-xs font-bold text-dong-chu">Cách nhận: {r.how}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
