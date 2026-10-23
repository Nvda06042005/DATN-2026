import React from 'react';
import { Mascot } from '@/components/customs/Mascot';
import type { MascotMood } from '@/types/mascotType';

export const EmptyState: React.FC<{ mood?: MascotMood; title: string; text?: string; action?: React.ReactNode }> = ({ mood = 'thinking', title, text, action }) => (
  <div className="g-card-flat p-6 flex flex-col items-center text-center gap-2">
    <Mascot size={96} mood={mood} />
    <p className="font-display font-bold text-lg text-muc">{title}</p>
    {text && <p className="text-sm text-muc-2 max-w-sm">{text}</p>}
    {action}
  </div>
);
