import React from 'react';
import type { IconType } from '@/types/gameType';

export const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string; Icon: IconType }> = ({ checked, onChange, label, desc, Icon }) => (
  <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="w-full flex items-center gap-3 min-h-[56px] text-left">
    <span className="w-10 h-10 rounded-xl bg-giay-2 text-muc-2 flex items-center justify-center shrink-0">
      <Icon className="w-5 h-5" aria-hidden={true} />
    </span>
    <span className="flex-1 min-w-0">
      <span className="block font-semibold">{label}</span>
      {desc && <span className="block text-sm text-muc-2">{desc}</span>}
    </span>
    <span className={`relative w-12 h-7 rounded-full transition shrink-0 ${checked ? 'bg-ngoc' : 'bg-vien-2'}`} aria-hidden="true">
      <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'left-6' : 'left-1'}`} />
    </span>
  </button>
);
