import React from 'react';
import type { BattleBg } from '@/types/gameType';

/** Nền chiến trận: đồng bằng, sông, biển (có thủy triều và cọc ngầm) */
export const BattleBackdrop: React.FC<{ bg: BattleBg; tide?: 'len' | 'dung' | 'rut' | null; dark: boolean; stakes?: boolean }> = ({ bg, tide = null, dark, stakes = false }) => {
  const gid = React.useId().replace(/:/g, '');
  const skyTop = bg === 'sea' ? '#cfe9f2' : '#fde7c8';
  const skyBot = bg === 'sea' ? '#eef7f2' : '#f8e9cf';
  const waterY = tide === 'len' ? 128 : tide === 'dung' ? 138 : tide === 'rut' ? 152 : 136;
  return (
    <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden="true">
      <defs>
        <linearGradient id={`sky-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={skyTop} />
          <stop offset="100%" stopColor={skyBot} />
        </linearGradient>
        <linearGradient id={`sea-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6cb9d8" />
          <stop offset="100%" stopColor="#2f86b0" />
        </linearGradient>
      </defs>
      <rect width="400" height="220" fill={`url(#sky-${gid})`} />
      <circle cx="330" cy="46" r="18" fill="#fbbf24" opacity="0.55" />
      <path d="M0 120 C60 92 110 104 160 96 C220 86 270 100 320 90 C360 84 380 92 400 96 V220 H0 Z" fill="#c9b285" opacity="0.6" />
      <path d="M0 130 C80 112 140 124 200 116 C260 108 330 120 400 112 V220 H0 Z" fill="#b89a66" opacity="0.55" />
      {bg === 'plain' && (
        <g>
          <path d="M0 150 C100 138 200 150 300 142 C350 138 380 142 400 144 V220 H0 Z" fill="#c8ad73" />
          <path d="M0 176 C120 166 240 178 400 168 V220 H0 Z" fill="#b39358" />
          {[30, 90, 160, 250, 330, 370].map((x) => (
            <path key={x} d={`M${x} 196 l4 -8 l4 8`} fill="none" stroke="#8a7140" strokeWidth="2" strokeLinecap="round" />
          ))}
        </g>
      )}
      {bg !== 'plain' && (
        <g>
          <path d={`M0 ${waterY} C80 ${waterY - 6} 160 ${waterY + 4} 240 ${waterY - 2} C300 ${waterY - 6} 360 ${waterY + 2} 400 ${waterY} V220 H0 Z`} fill={`url(#sea-${gid})`} style={{ transition: 'all 0.8s ease' }} />
          <g stroke="#d4f0f8" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity="0.8">
            <path d={`M30 ${waterY + 26} q12 -6 24 0 t24 0`} />
            <path d={`M190 ${waterY + 40} q12 -6 24 0 t24 0`} />
            <path d={`M300 ${waterY + 22} q12 -6 24 0 t24 0`} />
          </g>
          {bg === 'river' && <path d="M0 214 C120 200 260 212 400 200 V220 H0 Z" fill="#9f8452" />}
          {stakes && (
            <g>
              {[40, 78, 116, 154, 192, 230, 268, 306, 344].map((x, i) => (
                <g key={x} transform={`translate(${x} ${168 + (i % 2) * 8})`}>
                  <rect x="-3" y="0" width="6" height="40" fill="#8b5a2b" stroke="#3b2a1a" strokeWidth="1.2" />
                  <path d="M-3 0 L0 -9 L3 0 Z" fill="#94a3b8" stroke="#3b2a1a" strokeWidth="1.2" />
                </g>
              ))}
              {tide !== 'rut' && <path d={`M0 ${Math.min(waterY + 30, 200)} H400 V220 H0 Z`} fill={`url(#sea-${gid})`} opacity="0.92" />}
            </g>
          )}
        </g>
      )}
      {dark && <rect width="400" height="220" fill="#0b1220" opacity="0.5" />}
    </svg>
  );
};
