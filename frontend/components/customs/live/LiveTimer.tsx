import React from 'react';

/** Đồng hồ câu hỏi: hiện số giây; trình đọc màn hình chỉ được báo ở mốc 10 giây, 5 giây và khi hết giờ */
export const LiveTimer: React.FC<{ seconds: number; total: number; size?: number; className?: string; light?: boolean }> = ({
  seconds,
  total,
  size = 96,
  className = '',
  light = false,
}) => {
  const ratio = total > 0 ? Math.max(0, Math.min(1, seconds / total)) : 0;
  const r = 42;
  const circ = 2 * Math.PI * r;
  const urgent = seconds <= 5;
  const announce = seconds === 0 ? 'Hết giờ' : seconds === 5 || seconds === 10 ? `Còn ${seconds} giây` : '';
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke={light ? 'rgba(255,255,255,0.22)' : 'var(--color-vien)'} strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={urgent ? '#e21b3c' : light ? '#ffffff' : 'var(--color-ngoc)'}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - ratio)}
          style={{ transition: 'stroke-dashoffset 250ms linear' }}
        />
      </svg>
      <span
        role="timer"
        aria-label={`Còn ${seconds} giây`}
        className={`absolute inset-0 flex items-center justify-center font-black tabular ${urgent ? 'text-[#e21b3c]' : ''}`}
        style={{ fontSize: size * 0.36 }}
      >
        {seconds}
      </span>
      <span className="sr-only" role="status" aria-atomic="true">
        {announce}
      </span>
    </div>
  );
};
