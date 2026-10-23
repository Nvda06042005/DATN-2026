import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => <span className={`block rounded-xl bg-giay-2 animate-pulse ${className}`} aria-hidden="true" />;
