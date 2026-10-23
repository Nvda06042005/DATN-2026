import React from 'react';

export const Bar: React.FC<{ value: number; max: number; className?: string; fill?: string; label?: string; height?: number }> = ({
  value,
  max,
  className = '',
  fill = 'bg-ngoc',
  label,
  height,
}) => {
  const pctValue = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`g-bar ${className}`} style={height ? { height } : undefined} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} aria-label={label}>
      <span className={fill} style={{ width: `${pctValue}%` }} />
    </div>
  );
};
