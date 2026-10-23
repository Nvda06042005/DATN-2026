import React from 'react';
import type { AnswerShape } from '@/constants/theme';
import { ANSWER_STYLES } from '@/constants/theme';

export const KahootShape: React.FC<{ shape: AnswerShape; size?: number; color?: string; className?: string }> = ({
  shape,
  size = 28,
  color = '#fff',
  className = '',
}) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
    {shape === 'triangle' && <path d="M16 4 L29 27 H3 Z" fill={color} />}
    {shape === 'diamond' && <path d="M16 2 L30 16 L16 30 L2 16 Z" fill={color} />}
    {shape === 'circle' && <circle cx="16" cy="16" r="13" fill={color} />}
    {shape === 'square' && <rect x="4" y="4" width="24" height="24" rx="2" fill={color} />}
  </svg>
);

/** Bốn ô màu thu nhỏ – dùng làm biểu tượng Quiz */
export const KahootMiniGrid: React.FC<{ size?: number; className?: string }> = ({ size = 20, className = '' }) => (
  <div className={`grid grid-cols-2 gap-[2px] shrink-0 ${className}`} style={{ width: size, height: size }}>
    {ANSWER_STYLES.map((s) => (
      <div key={s.shape} className="rounded-[3px]" style={{ background: s.bg }} />
    ))}
  </div>
);
