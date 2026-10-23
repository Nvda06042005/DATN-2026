import React from 'react';
import { Star } from 'lucide-react';

export const Stars: React.FC<{ n: number; max?: number; size?: number; label?: string }> = ({ n, max = 3, size = 18, label }) => (
  <span className="inline-flex items-center gap-0.5" role="img" aria-label={label ?? `${n}/${max} sao`}>
    {Array.from({ length: max }, (_, i) => (
      <Star key={i} style={{ width: size, height: size }} className={i < n ? 'text-dong fill-dong' : 'text-vien-2'} strokeWidth={2.2} aria-hidden={true} />
    ))}
  </span>
);
