import React from 'react';

interface ShinyTextProps {
  text: string;
  className?: string;
  speed?: number;
}

/**
 * ReactBits ShinyText — Metallic shimmer text animation
 */
export const ShinyText: React.FC<ShinyTextProps> = ({
  text,
  className = '',
  speed = 4,
}) => {
  return (
    <span
      className={`inline-block bg-clip-text text-transparent bg-[length:200%_100%] animate-shine ${className}`}
      style={{
        backgroundImage:
          'linear-gradient(110deg, currentColor 35%, rgba(255,255,255,0.95) 50%, currentColor 65%)',
        animationDuration: `${speed}s`,
      }}
    >
      {text}
    </span>
  );
};
