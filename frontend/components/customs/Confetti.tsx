import React from 'react';

/** Hiệu ứng pháo giấy khi chiến thắng */
const CONFETTI_COLORS = ['#0f766e', '#0369a1', '#d97706', '#b91c1c', '#7e22ce', '#c2410c', '#ffb6cf'];

/** Giả ngẫu nhiên tất định (0..1) theo hạt giống */
const seeded = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

export const Confetti: React.FC<{ count?: number }> = ({ count = 70 }) => {
  const pieces = React.useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: seeded(i + 1) * 100,
        delay: seeded(i + 101) * 1.6,
        duration: 2.4 + seeded(i + 201) * 2.2,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + seeded(i + 301) * 8,
        round: seeded(i + 401) > 0.6,
      })),
    [count]
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 block"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.45,
            background: p.color,
            borderRadius: p.round ? '999px' : '2px',
            animation: `confettiFall ${p.duration}s linear ${p.delay}s both`,
          }}
        />
      ))}
    </div>
  );
};
