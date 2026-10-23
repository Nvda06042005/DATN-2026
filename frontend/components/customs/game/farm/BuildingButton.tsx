import React from 'react';
import { Clock, Hammer, Wheat } from 'lucide-react';
import { BuildingSprite } from '@/components/customs/game/art/BuildingSprite';
import { farmCap } from '@/constants/game/buildings';
import { useGame } from '@/hooks/use-game';
import { farmReady } from '@/store/game.store';
import type { BuildingDef } from '@/types/gameType';
import { fmt, fmtClock } from '@/utils/format';

export const BuildingButton: React.FC<{ def: BuildingDef; now: number; onOpen: () => void }> = ({ def, now, onOpen }) => {
  const { state } = useGame();
  const b = state.buildings[def.id];
  const upgrading = b.upgradeEnds !== null && b.upgradeEnds > now;
  const ready = def.id === 'ruong' ? farmReady(state, now) : 0;
  const full = def.id === 'ruong' && ready >= farmCap(b.level) * 0.5;
  let badge: React.ReactNode = null;
  if (upgrading)
    badge = (
      <span className="bld-badge bg-the text-muc border-2 border-vien">
        <Clock className="w-3.5 h-3.5" aria-hidden={true} /> {fmtClock(((b.upgradeEnds ?? now) - now) / 1000)}
      </span>
    );
  else if (b.level === 0)
    badge = (
      <span className="bld-badge bg-dong text-[#1c1917]">
        <Hammer className="w-3.5 h-3.5" aria-hidden={true} /> Xây
      </span>
    );
  else if (def.id === 'ruong' && ready >= 5)
    badge = (
      <span className={`bld-badge bg-ngoc text-white ${ready >= 20 ? 'animate-badge-bob' : ''}`}>
        <Wheat className="w-3.5 h-3.5" aria-hidden={true} /> +{fmt(ready)}
      </span>
    );
  const label = `${def.name}, ${b.level === 0 ? 'chưa xây' : `cấp ${b.level}`}${upgrading ? ', đang nâng cấp' : ''}${def.id === 'ruong' && ready ? `, có ${ready} Lương Thảo chờ thu` : ''}`;
  return (
    <button
      type="button"
      className="bld"
      style={{ left: `${def.pos.x}%`, top: `${def.pos.y}%`, width: `${def.pos.w}%`, height: `${def.pos.h}%` }}
      onClick={onOpen}
      aria-label={label}
    >
      {badge}
      <BuildingSprite id={def.id} level={b.level} full={full} className={`w-full flex-1 min-h-0 drop-shadow-sm ${upgrading ? 'opacity-80' : ''}`} />
      <span className="bld-name">
        {def.name}
        {b.level > 0 && <span className="ml-1 text-dong-chu">· {b.level}</span>}
      </span>
    </button>
  );
};
