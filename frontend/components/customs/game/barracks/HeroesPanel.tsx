import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { HeroMedallion } from '@/components/customs/game/art/HeroMedallion';
import { HeroSheet } from '@/components/customs/game/barracks/HeroSheet';
import { ElementChip } from '@/components/customs/game/GameChips';
import { ELEMENTS } from '@/constants/game/elements';
import { HEROES } from '@/constants/game/heroes';
import { useGame } from '@/hooks/use-game';
import type { ElementId } from '@/types/gameType';

export const HeroesPanel: React.FC = () => {
  const { state } = useGame();
  const [filter, setFilter] = useState<ElementId | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const list = HEROES.filter((h) => filter === 'all' || h.element === filter);
  const ownedCount = HEROES.filter((h) => state.heroes[h.id]).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Lọc theo hệ quân">
        {(['all', 'thuy', 'moc', 'tho', 'hoa', 'thong'] as const).map((f) => {
          const active = filter === f;
          const el = f === 'all' ? null : ELEMENTS[f];
          const Icon = el?.Icon;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={active}
              className={`g-chip !min-h-[40px] !px-3 !text-sm border-2 ${active ? 'bg-son text-white border-son' : 'bg-the text-muc-2 border-vien'}`}
            >
              {Icon && <Icon className="w-4 h-4" aria-hidden={true} />}
              {el ? el.name : `Tất cả (${ownedCount}/${HEROES.length})`}
            </button>
          );
        })}
      </div>
      {filter !== 'all' && (
        <div className={`rounded-2xl p-3 ${ELEMENTS[filter].soft}`}>
          <p className={`font-display font-bold ${ELEMENTS[filter].text}`}>{ELEMENTS[filter].place}</p>
          <p className="text-sm text-muc">{ELEMENTS[filter].desc}</p>
        </div>
      )}
      <ul className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        {list.map((h) => {
          const owned = state.heroes[h.id];
          return (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => setOpen(h.id)}
                className={`g-card w-full h-full p-3 flex flex-col items-center text-center gap-1.5 hover:-translate-y-0.5 transition ${owned ? '' : 'opacity-80'}`}
                aria-label={`${h.name}${owned ? `, giai đoạn ${owned.stage}` : ', chưa có'}`}
              >
                <HeroMedallion hero={h} stage={owned?.stage ?? 1} size={68} dim={!owned} />
                <p className="font-display font-extrabold leading-tight mt-1">{h.name}</p>
                <p className="text-xs text-muc-2 leading-tight">{h.title}</p>
                <div className="flex flex-wrap justify-center gap-1 mt-auto pt-1">
                  <ElementChip element={h.element} />
                  {!owned && (
                    <span className="g-chip bg-giay-2 text-muc-2">
                      <Lock className="w-3 h-3" aria-hidden={true} /> Chưa có
                    </span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <HeroSheet heroId={open} onClose={() => setOpen(null)} />
    </div>
  );
};
