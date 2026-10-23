import React from 'react';
import { Loader2 } from 'lucide-react';

export const Spinner: React.FC<{ label?: string; className?: string }> = ({ label = 'Đang tải…', className = '' }) => (
  <span className={`inline-flex items-center gap-2 font-semibold text-muc-2 ${className}`} role="status">
    <Loader2 className="w-5 h-5 animate-spin" aria-hidden={true} /> {label}
  </span>
);
