import React from 'react';
import { Mascot } from '@/components/customs/Mascot';

interface BrandLogoProps {
  compact?: boolean;
  subtitle?: string;
  className?: string;
  tone?: 'green' | 'white';
}

/** Logo "Đông A": ấn triện son đỏ có Rồng Con, chữ Baloo 2 */
export const BrandLogo: React.FC<BrandLogoProps> = ({ compact = false, subtitle, className = '', tone = 'green' }) => {
  const light = tone === 'white';
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <span className="brand-seal w-11 h-11 shrink-0" aria-hidden="true">
        <Mascot size={38} mood="happy" accessory="helmet" title="Đông A" />
      </span>
      {!compact && (
        <div className="leading-none">
          <span className={`block font-display text-[24px] font-extrabold tracking-tight ${light ? 'text-white' : 'text-son-chu'}`}>Đông A</span>
          {subtitle && (
            <span className={`block text-[10px] font-bold uppercase tracking-[0.16em] mt-1 ${light ? 'text-white/80' : 'text-muc-2'}`}>{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
};
