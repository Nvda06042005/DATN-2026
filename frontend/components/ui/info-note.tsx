import React from 'react';
import { Info } from 'lucide-react';

export const InfoNote: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <p className={`flex items-start gap-2 text-sm text-muc-2 ${className}`}>
    <Info className="w-4 h-4 mt-0.5 shrink-0" aria-hidden={true} />
    <span>{children}</span>
  </p>
);
