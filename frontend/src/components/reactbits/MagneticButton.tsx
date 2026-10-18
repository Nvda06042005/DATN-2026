import React, { useRef, useState } from 'react';

interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  strength?: number;
}

/**
 * Awwwards MagneticButton — Tactile cursor pull effect for primary actions
 */
export const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  strength = 0.22,
  className = '',
  ...rest
}) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width / 2)) * strength;
    const dy = (e.clientY - (rect.top + rect.height / 2)) * strength;
    setOffset({ x: dx, y: dy });
  };

  const handleMouseLeave = () => {
    setOffset({ x: 0, y: 0 });
  };

  return (
    <button
      ref={btnRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `translate3d(${offset.x.toFixed(1)}px, ${offset.y.toFixed(1)}px, 0)`,
        transition:
          offset.x === 0 && offset.y === 0
            ? 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)'
            : 'transform 0.08s linear',
      }}
      className={className}
      {...rest}
    >
      {children}
    </button>
  );
};
