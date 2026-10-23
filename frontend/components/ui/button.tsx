import React from 'react';

type GBtnVariant = 'son' | 'ngoc' | 'dong' | 'giay' | 'ghost';

export const GBtn = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: GBtnVariant; size?: 'sm' | 'md' | 'lg'; iconOnly?: boolean }
>(({ variant = 'son', size = 'md', iconOnly = false, className = '', type = 'button', ...rest }, ref) => (
  <button
    ref={ref}
    type={type}
    className={`g-btn ${variant === 'son' ? '' : `g-btn-${variant}`} ${size === 'lg' ? 'g-btn-lg' : size === 'sm' ? 'g-btn-sm' : ''} ${iconOnly ? 'g-btn-icon' : ''} ${className}`}
    {...rest}
  />
));

GBtn.displayName = 'GBtn';
