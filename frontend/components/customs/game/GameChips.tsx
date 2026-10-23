import React from 'react';
import { Star } from 'lucide-react';
import { ELEMENTS, LORE_LABEL, TIER_INFO } from '@/constants/game/elements';
import type { ElementId, Lore, Tier } from '@/types/gameType';

export const LoreChip: React.FC<{ lore: Lore | string; className?: string }> = ({ lore, className = '' }) => {
  const key = (lore in LORE_LABEL ? lore : 'chinh_su') as Lore;
  return <span className={`g-chip lore-${key} ${className}`}>{LORE_LABEL[key]}</span>;
};

export const ElementChip: React.FC<{ element: ElementId; className?: string }> = ({ element, className = '' }) => {
  const el = ELEMENTS[element];
  const Icon = el.Icon;
  return (
    <span className={`g-chip ${el.soft} ${el.text} ${className}`}>
      <Icon className="w-3.5 h-3.5" aria-hidden={true} />
      {el.name}
    </span>
  );
};

export const TierChip: React.FC<{ tier: Tier }> = ({ tier }) => (
  <span className="g-chip bg-dong-nhat text-dong-chu">
    {Array.from({ length: TIER_INFO[tier].stars }, (_, i) => (
      <Star key={i} className="w-3 h-3 fill-current" aria-hidden={true} />
    ))}
    {TIER_INFO[tier].name}
  </span>
);
