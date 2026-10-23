import React from 'react';
import { ELEMENTS } from '@/constants/game/elements';
import type { HeroDef } from '@/types/gameType';

/** Huy hiệu tướng: vòng màu theo hệ + vật biểu trưng; không vẽ chân dung người thật */
export const HeroMedallion: React.FC<{ hero: HeroDef; stage?: number; size?: number; dim?: boolean; className?: string }> = ({
  hero,
  stage = 1,
  size = 64,
  dim = false,
  className = '',
}) => {
  const el = ELEMENTS[hero.element];
  const Icon = hero.symbol;
  const golden = hero.tier === 'huyen_thoai' || hero.tier === 'tiet_che';
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-full shrink-0 ${el.fill} ${dim ? 'grayscale opacity-60' : ''} ${className}`}
      style={{ width: size, height: size, boxShadow: golden ? '0 0 0 3px #fbbf24, 0 3px 0 3px #92400e' : '0 3px 0 rgba(0,0,0,0.25)' }}
      aria-hidden="true"
    >
      <span className="absolute rounded-full bg-the" style={{ inset: Math.max(4, size * 0.09) }} />
      <span className="absolute rounded-full" style={{ inset: Math.max(4, size * 0.09), boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.06)' }} />
      <Icon className={`relative ${el.text}`} size={Math.round(size * 0.46)} strokeWidth={2.2} aria-hidden={true} />
      {stage > 1 && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
          {Array.from({ length: stage - 1 }, (_, i) => (
            <span key={i} className="w-2.5 h-2.5 rotate-45 bg-dong border border-dong-dam" />
          ))}
        </span>
      )}
    </span>
  );
};
