import React from 'react';
import { ArrowDown, ArrowUp, Minus, Waves } from 'lucide-react';
import { TIDE_CYCLE, TIDE_LABEL } from '@/constants/game/battle';
import type { TideState } from '@/types/battleType';

export const TideMeter: React.FC<{ tide: TideState; round: number }> = ({ tide, round }) => (
  <div className="flex items-center gap-2" aria-label={`Thủy triều: ${TIDE_LABEL[tide]}`}>
    <Waves className="w-5 h-5 text-thuy-chu" aria-hidden={true} />
    <div className="flex gap-1">
      {TIDE_CYCLE.map((t, i) => {
        const cur = (round - 1) % TIDE_CYCLE.length === i;
        return (
          <span key={i} className={`g-chip !text-[11px] ${cur ? (t === 'rut' ? 'bg-ngoc text-white' : 'bg-thuy text-white') : 'bg-giay-2 text-muc-3'}`}>
            {t === 'len' ? <ArrowUp className="w-3 h-3" aria-hidden={true} /> : t === 'rut' ? <ArrowDown className="w-3 h-3" aria-hidden={true} /> : <Minus className="w-3 h-3" aria-hidden={true} />}
            <span className={cur ? '' : 'sr-only'}>{TIDE_LABEL[t]}</span>
          </span>
        );
      })}
    </div>
  </div>
);
