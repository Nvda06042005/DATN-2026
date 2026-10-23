import React from 'react';
import type { IconType } from '@/types/gameType';

export const HudPill: React.FC<{ Icon: IconType; value: string; label: string; tone: string; hint?: string }> = ({ Icon, value, label, tone, hint }) => (
  <span className="g-pill" title={hint ?? label}>
    <span className={`g-pill-ico ${tone}`}>
      <Icon className="w-4 h-4" aria-hidden={true} />
    </span>
    <span className="sr-only">{label}: </span>
    {value}
  </span>
);
