import React from 'react';
import type { BuildingId } from '@/types/gameType';

const ART = {
  ink: '#3b2a1a',
  roof: '#a33b1f',
  roofShade: '#7c2d12',
  gold: '#d97706',
  goldLight: '#fbbf24',
  thatch: '#d9a54c',
  thatchShade: '#b7832f',
  wall: '#f6e7c8',
  wallShade: '#e6cfa0',
  pillar: '#b91c1c',
  wood: '#8b5a2b',
  woodDark: '#6b4220',
  water: '#7cc7dc',
  waterDeep: '#3e9cc4',
  stone: '#cfc2a8',
  rice: '#4caf50',
  riceGold: '#e0b03a',
};

/** Mái cong đầu đao: đáy từ (l,b) tới (r,b), nóc từ (l+d,t) tới (r-d,t) */
const curvedRoof = (l: number, r: number, b: number, t: number, d: number) =>
  `M${l - 6} ${b - 7} Q${l} ${b + 1} ${l + 10} ${b} L${r - 10} ${b} Q${r} ${b + 1} ${r + 6} ${b - 7} L${r - d} ${t} L${l + d} ${t} Z`;

const Shadow: React.FC<{ rx?: number }> = ({ rx = 50 }) => <ellipse cx="60" cy="92" rx={rx} ry="6.5" fill="rgba(40,25,10,0.22)" />;

const Scaffold: React.FC = () => (
  <g>
    <Shadow rx={40} />
    <path d="M22 86 L60 70 L98 86 L60 98 Z" fill="none" stroke={ART.wood} strokeWidth="2.5" strokeDasharray="5 4" />
    <g stroke={ART.woodDark} strokeWidth="4" strokeLinecap="round">
      <path d="M36 84 V44" />
      <path d="M84 84 V44" />
      <path d="M32 50 H88" />
      <path d="M36 80 L84 50" />
    </g>
    <rect x="46" y="22" width="28" height="18" rx="4" fill={ART.wall} stroke={ART.ink} strokeWidth="2.5" />
    <path d="M60 40 V52" stroke={ART.woodDark} strokeWidth="3" />
    <path d="M53 28 l14 6 M53 34 l14 -6" stroke={ART.pillar} strokeWidth="2.5" strokeLinecap="round" />
  </g>
);

const RiceTufts: React.FC<{ gold: boolean }> = ({ gold }) => {
  const color = gold ? ART.riceGold : ART.rice;
  const dark = gold ? '#a77b14' : '#2e7d32';
  const tufts: Array<[number, number]> = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) tufts.push([24 + c * 12 + r * 5, 58 + r * 6 - c * 2.2]);
  return (
    <g strokeLinecap="round">
      {tufts.map(([x, y], i) => (
        <g key={i}>
          <path d={`M${x} ${y} l-3 -7 M${x} ${y} l0 -8 M${x} ${y} l3 -7`} stroke={dark} strokeWidth="2.6" />
          <path d={`M${x} ${y} l-3 -7 M${x} ${y} l0 -8 M${x} ${y} l3 -7`} stroke={color} strokeWidth="1.6" />
        </g>
      ))}
    </g>
  );
};

const SpriteRuong: React.FC<{ level: number; full: boolean }> = ({ level, full }) => (
  <g>
    <Shadow rx={54} />
    <path d="M6 66 L58 46 L114 62 L62 86 Z" fill="#a8763e" stroke={ART.ink} strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M13 66 L58 49 L107 62 L62 81 Z" fill={ART.water} />
    <path d="M18 66 L58 51 L100 62" fill="none" stroke="#bfe8f3" strokeWidth="1.6" opacity="0.8" />
    <path d="M36 58 L84 73" stroke="#a8763e" strokeWidth="3" />
    <RiceTufts gold={full} />
    <g transform="translate(80 18)">
      <rect x="2" y="16" width="26" height="16" fill={ART.wall} stroke={ART.ink} strokeWidth="2.2" />
      <path d="M-4 18 L15 2 L34 18 Z" fill={ART.thatch} stroke={ART.ink} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M4 15 L15 6 L26 15" fill="none" stroke={ART.thatchShade} strokeWidth="1.8" />
      <rect x="11" y="22" width="8" height="10" fill={ART.woodDark} />
    </g>
    {level >= 3 && <path d="M8 40 q6 -10 12 0" fill="none" stroke="#2e7d32" strokeWidth="3" strokeLinecap="round" />}
  </g>
);

const SpriteTrai: React.FC<{ level: number }> = ({ level }) => (
  <g>
    <Shadow />
    <rect x="22" y="50" width="76" height="32" rx="2" fill={ART.wall} stroke={ART.ink} strokeWidth="2.5" />
    <rect x="22" y="72" width="76" height="10" fill={ART.wallShade} />
    <path d="M12 54 L34 28 L86 28 L108 54 Z" fill={ART.thatch} stroke={ART.ink} strokeWidth="2.5" strokeLinejoin="round" />
    <g stroke={ART.thatchShade} strokeWidth="2" fill="none">
      <path d="M24 46 L40 33" />
      <path d="M44 46 L52 33" />
      <path d="M66 46 L68 33" />
      <path d="M86 46 L82 33" />
    </g>
    <rect x="52" y="62" width="16" height="20" rx="2" fill={ART.woodDark} />
    <g stroke={ART.woodDark} strokeWidth="2.6" strokeLinecap="round">
      <path d="M10 84 V40" />
      <path d="M16 84 V38" />
    </g>
    <path d="M7 40 l3 -8 l3 8 Z M13 38 l3 -8 l3 8 Z" fill="#94a3b8" stroke={ART.ink} strokeWidth="1.4" />
    <path d="M104 86 V18" stroke={ART.woodDark} strokeWidth="3" strokeLinecap="round" />
    <path d="M105 19 q10 4 18 0 q-4 7 0 13 q-9 4 -18 0 Z" fill={ART.pillar} stroke={ART.ink} strokeWidth="1.8" strokeLinejoin="round" />
    {level >= 3 && <circle cx="114" cy="26" r="2.5" fill={ART.goldLight} />}
  </g>
);

const SpriteKho: React.FC<{ level: number }> = ({ level }) => (
  <g>
    <Shadow rx={42} />
    <g stroke={ART.woodDark} strokeWidth="4" strokeLinecap="round">
      <path d="M36 88 V64" />
      <path d="M84 88 V64" />
      <path d="M50 90 V64" />
      <path d="M70 90 V64" />
    </g>
    <rect x="28" y="60" width="64" height="6" rx="2" fill={ART.wood} stroke={ART.ink} strokeWidth="2" />
    <rect x="34" y="38" width="52" height="24" fill={ART.wall} stroke={ART.ink} strokeWidth="2.5" />
    <path d="M24 42 L60 10 L96 42 Z" fill={ART.thatch} stroke={ART.ink} strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M36 36 L60 16 L84 36" fill="none" stroke={ART.thatchShade} strokeWidth="2" />
    <circle cx="60" cy="50" r="7.5" fill={ART.goldLight} stroke={ART.ink} strokeWidth="2" />
    <path d="M60 47 v5" stroke={ART.ink} strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="60" cy="46.5" r="1.8" fill={ART.ink} />
    {level >= 3 && <path d="M30 70 h60" stroke={ART.gold} strokeWidth="2" />}
  </g>
);

const SpriteXuong: React.FC<{ level: number }> = ({ level }) => {
  const tip = level >= 2 ? '#94a3b8' : '#e6cfa0';
  return (
    <g>
      <Shadow />
      {level >= 3 && (
        <g>
          <path d="M4 82 Q60 70 116 82 L116 94 Q60 86 4 94 Z" fill={ART.water} />
          {[16, 34, 52, 70, 88, 104].map((x) => (
            <path key={x} d={`M${x} 90 l3 -14 l3 14`} fill={ART.wood} stroke={ART.ink} strokeWidth="1.4" />
          ))}
        </g>
      )}
      <g stroke={ART.woodDark} strokeWidth="4" strokeLinecap="round">
        <path d="M18 80 V36" />
        <path d="M102 80 V36" />
      </g>
      <path d={curvedRoof(14, 106, 38, 18, 18)} fill={ART.thatch} stroke={ART.ink} strokeWidth="2.5" strokeLinejoin="round" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`translate(${34 + i * 11} ${44 + (i % 2) * 3}) rotate(${-14 + i * 6})`}>
          <rect x="-3" y="0" width="6" height="34" rx="1.5" fill={ART.wood} stroke={ART.ink} strokeWidth="1.6" />
          <path d="M-3 0 L0 -9 L3 0 Z" fill={tip} stroke={ART.ink} strokeWidth="1.6" strokeLinejoin="round" />
        </g>
      ))}
      <path d="M22 80 h76" stroke={ART.woodDark} strokeWidth="5" strokeLinecap="round" />
    </g>
  );
};

const SpriteBen: React.FC<{ level: number }> = ({ level }) => (
  <g>
    <path d="M0 62 Q60 50 120 62 L120 100 L0 100 Z" fill={ART.water} />
    <path d="M10 70 q8 -4 16 0 t16 0 M64 76 q8 -4 16 0 t16 0" fill="none" stroke="#d4f0f8" strokeWidth="2" strokeLinecap="round" />
    <g stroke={ART.woodDark} strokeWidth="3.5" strokeLinecap="round">
      <path d="M14 92 V58" />
      <path d="M34 92 V58" />
    </g>
    <path d="M6 58 H44 V64 H6 Z" fill={ART.wood} stroke={ART.ink} strokeWidth="2" />
    <g transform="translate(52 34)">
      <path d="M0 40 Q30 52 62 40 L56 50 Q30 58 6 50 Z" fill={ART.wood} stroke={ART.ink} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M30 40 V2" stroke={ART.woodDark} strokeWidth="3" />
      <path d="M31 4 Q50 18 31 36 Z" fill={ART.wall} stroke={ART.ink} strokeWidth="2" strokeLinejoin="round" />
      <path d="M31 16 Q42 20 31 26" fill="none" stroke={ART.pillar} strokeWidth="3" />
      {level >= 2 && <path d="M29 6 Q14 18 29 32 Z" fill={ART.wallShade} stroke={ART.ink} strokeWidth="2" />}
      <path d="M8 44 l-8 8 M54 44 l8 8" stroke={ART.woodDark} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  </g>
);

const SpriteDoanh: React.FC<{ level: number }> = ({ level }) => {
  const flags = ['#0369a1', '#15803d', '#a16207', '#c2410c', '#7e22ce'];
  return (
    <g>
      <Shadow rx={54} />
      {[
        [8, 58, 1],
        [40, 46, 1.2],
        [78, 58, 1],
      ].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <path d="M0 28 L17 0 L34 28 Z" fill={i === 1 ? ART.wall : ART.wallShade} stroke={ART.ink} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M17 0 L17 28" stroke={ART.ink} strokeWidth="1.6" />
          <path d="M12 28 L17 16 L22 28 Z" fill={ART.woodDark} />
        </g>
      ))}
      {flags.slice(0, 3 + Math.min(2, level - 1)).map((c, i) => (
        <g key={c} transform={`translate(${18 + i * 21} 14)`}>
          <path d="M0 36 V0" stroke={ART.woodDark} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M1 1 q8 3 14 0 q-3 5 0 10 q-7 3 -14 0 Z" fill={c} stroke={ART.ink} strokeWidth="1.4" strokeLinejoin="round" />
        </g>
      ))}
    </g>
  );
};

const SpriteHoiQuan: React.FC<{ level: number }> = ({ level }) => (
  <g>
    <Shadow rx={52} />
    <path d="M14 86 H106 L100 78 H20 Z" fill={ART.stone} stroke={ART.ink} strokeWidth="2.2" strokeLinejoin="round" />
    <rect x="24" y="52" width="72" height="26" fill={ART.wall} stroke={ART.ink} strokeWidth="2.4" />
    {[30, 50, 70, 88].map((x) => (
      <rect key={x} x={x - 3} y="52" width="6" height="26" fill={ART.pillar} stroke={ART.ink} strokeWidth="1.4" />
    ))}
    <rect x="52" y="60" width="16" height="18" fill={ART.woodDark} />
    <path d={curvedRoof(16, 104, 54, 38, 14)} fill={ART.roof} stroke={ART.ink} strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M24 50 H96" stroke={ART.roofShade} strokeWidth="2" />
    <rect x="34" y="30" width="52" height="10" fill={ART.wall} stroke={ART.ink} strokeWidth="2" />
    <path d={curvedRoof(28, 92, 32, 14, 12)} fill={ART.roof} stroke={ART.ink} strokeWidth="2.4" strokeLinejoin="round" />
    <path d="M40 14 H80" stroke={ART.gold} strokeWidth="3.5" strokeLinecap="round" />
    <path d="M40 14 q-6 -6 -2 -10 M80 14 q6 -6 2 -10" fill="none" stroke={ART.gold} strokeWidth="3" strokeLinecap="round" />
    {level >= 2 && <circle cx="60" cy="10" r="4" fill={ART.goldLight} stroke={ART.ink} strokeWidth="1.5" />}
  </g>
);

const SpriteQTG: React.FC<{ level: number }> = ({ level }) => (
  <g>
    <Shadow rx={52} />
    <path d="M10 88 H110 L104 80 H16 Z" fill={ART.stone} stroke={ART.ink} strokeWidth="2.2" strokeLinejoin="round" />
    {[
      [14, 54, 32],
      [74, 54, 32],
    ].map(([x, y, w]) => (
      <g key={x}>
        <rect x={x} y={y} width={w} height={26} fill={ART.wall} stroke={ART.ink} strokeWidth="2.2" />
        <path d={curvedRoof(x - 2, x + w + 2, y + 2, y - 12, 8)} fill={ART.roof} stroke={ART.ink} strokeWidth="2.2" strokeLinejoin="round" />
      </g>
    ))}
    <rect x="42" y="40" width="36" height="40" fill={ART.wall} stroke={ART.ink} strokeWidth="2.4" />
    <path d="M50 80 V58 a10 10 0 0 1 20 0 V80 Z" fill={ART.woodDark} />
    <path d={curvedRoof(36, 84, 42, 22, 10)} fill={ART.roof} stroke={ART.ink} strokeWidth="2.4" strokeLinejoin="round" />
    <rect x="50" y="10" width="20" height="13" rx="2" fill={ART.pillar} stroke={ART.ink} strokeWidth="2" />
    <path d="M54 16.5 h12" stroke={ART.goldLight} strokeWidth="2.5" strokeLinecap="round" />
    {level >= 2 && <path d="M38 22 h44" stroke={ART.gold} strokeWidth="3" strokeLinecap="round" />}
  </g>
);

/** Hình công trình trên Điền Trang */
export const BuildingSprite: React.FC<{ id: BuildingId; level: number; full?: boolean; className?: string }> = ({ id, level, full = false, className = '' }) => (
  <svg viewBox="0 0 120 100" className={className} aria-hidden="true" style={{ overflow: 'visible' }}>
    {level <= 0 ? (
      <Scaffold />
    ) : id === 'ruong' ? (
      <SpriteRuong level={level} full={full} />
    ) : id === 'trai' ? (
      <SpriteTrai level={level} />
    ) : id === 'kho' ? (
      <SpriteKho level={level} />
    ) : id === 'xuong' ? (
      <SpriteXuong level={level} />
    ) : id === 'ben' ? (
      <SpriteBen level={level} />
    ) : id === 'doanh' ? (
      <SpriteDoanh level={level} />
    ) : id === 'hoiquan' ? (
      <SpriteHoiQuan level={level} />
    ) : (
      <SpriteQTG level={level} />
    )}
  </svg>
);
