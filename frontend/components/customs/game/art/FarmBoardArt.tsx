import React from 'react';

/** Nền bàn Điền Trang: đồng cỏ, đường đất, sông, lũy tre */
export const FarmBoardArt: React.FC<{ dark: boolean }> = ({ dark }) => {
  const gid = React.useId().replace(/:/g, '');
  const grassA = dark ? '#2c4a37' : '#a6cf86';
  const grassB = dark ? '#21382a' : '#88bb66';
  const path = dark ? '#5b4a32' : '#e3c690';
  const water = dark ? '#1d4e6b' : '#7cc7dc';
  const waterB = dark ? '#173e56' : '#5fb2d0';
  const tree = dark ? '#1f3b2a' : '#4f8f3a';
  const treeLight = dark ? '#2f5a3f' : '#6aac4c';
  const trees: Array<[number, number, number]> = [
    [30, 300, 22],
    [56, 286, 16],
    [570, 300, 20],
    [548, 288, 15],
    [300, 26, 18],
    [328, 20, 14],
    [270, 24, 13],
    [580, 210, 16],
    [20, 200, 15],
    [210, 400, 14],
    [392, 402, 16],
  ];
  return (
    <svg viewBox="0 0 600 600" className="absolute inset-0 w-full h-full" aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <radialGradient id={`g-${gid}`} cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor={grassA} />
          <stop offset="100%" stopColor={grassB} />
        </radialGradient>
        <linearGradient id={`w-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={water} />
          <stop offset="100%" stopColor={waterB} />
        </linearGradient>
        <pattern id={`t-${gid}`} width="44" height="44" patternUnits="userSpaceOnUse">
          <path d="M8 30 l3 -7 l3 7 M28 14 l3 -7 l3 7" fill="none" stroke={dark ? '#3c6149' : '#7cae5b'} strokeWidth="2" strokeLinecap="round" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="600" height="600" rx="40" fill={`url(#g-${gid})`} />
      <rect x="0" y="0" width="600" height="600" rx="40" fill={`url(#t-${gid})`} />
      <path d="M0 470 C120 430 220 470 320 452 C420 434 500 400 600 420 L600 560 Q600 600 560 600 L40 600 Q0 600 0 560 Z" fill={`url(#w-${gid})`} />
      <path d="M0 470 C120 430 220 470 320 452 C420 434 500 400 600 420" fill="none" stroke={dark ? '#4d6f5a' : '#d9c48e'} strokeWidth="10" opacity="0.8" />
      <g stroke={dark ? '#3a7194' : '#d8f1f8'} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.8">
        <path d="M60 520 q14 -8 28 0 t28 0" />
        <path d="M260 540 q14 -8 28 0 t28 0" />
        <path d="M430 500 q14 -8 28 0 t28 0" />
      </g>
      <g stroke={path} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.95">
        <path d="M110 190 C170 240 220 250 300 245 C380 240 430 230 490 190" />
        <path d="M300 245 L300 390" />
        <path d="M120 300 C180 330 240 340 300 330 C360 320 420 330 480 300" />
        <path d="M110 480 C130 420 180 400 240 392" />
        <path d="M480 480 C470 430 420 400 360 392" />
      </g>
      {trees.map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y + r * 0.35} r={r} fill={tree} />
          <circle cx={x - r * 0.25} cy={y} r={r * 0.75} fill={treeLight} />
        </g>
      ))}
    </svg>
  );
};
