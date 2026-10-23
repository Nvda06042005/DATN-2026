import React from 'react';
import { Crown } from 'lucide-react';
import { ENEMY_TYPES } from '@/constants/game/elements';
import type { EnemyDef } from '@/types/gameType';

/** Huy hiệu quân địch */
export const EnemyBadge: React.FC<{ enemy: EnemyDef; size?: number; className?: string }> = ({ enemy, size = 64, className = '' }) => {
  const Icon = ENEMY_TYPES[enemy.type].Icon;
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-2xl shrink-0 bg-dich text-white ${className}`}
      style={{ width: size, height: size, boxShadow: enemy.boss ? '0 0 0 3px #b91c1c, 0 3px 0 3px #7f1d1d' : '0 3px 0 rgba(0,0,0,0.3)' }}
      aria-hidden="true"
    >
      <Icon className="w-1/2 h-1/2" strokeWidth={2} aria-hidden={true} />
      {enemy.boss && <Crown className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 text-dong fill-dong" aria-hidden={true} />}
    </span>
  );
};
