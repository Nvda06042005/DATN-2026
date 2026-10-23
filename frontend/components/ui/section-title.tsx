import React from 'react';

export const SectionTitle: React.FC<{ title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; className?: string }> = ({ title, subtitle, action, className = '' }) => (
  <div className={`flex items-end justify-between gap-3 ${className}`}>
    <div className="min-w-0">
      <h2 className="font-display font-extrabold text-2xl leading-tight text-muc">{title}</h2>
      {subtitle && <p className="text-sm text-muc-2 mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);
