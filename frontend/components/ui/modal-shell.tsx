import React from 'react';
import { X } from 'lucide-react';

export const ModalShell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-[60] bg-black/45 flex items-center justify-center p-4 animate-in" onClick={onClose}>
    <div
      className={`bg-white rounded-3xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-hidden flex flex-col shadow-2xl zoom-in-95`}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="px-6 pt-5 pb-3 flex items-center justify-between border-b-2 border-duo-swan">
        <h3 className="text-xl font-black text-duo-ink">{title}</h3>
        <button onClick={onClose} className="text-duo-hare hover:text-duo-wolf" title="Đóng">
          <X className="w-6 h-6 stroke-[3]" />
        </button>
      </div>
      <div className="overflow-y-auto">{children}</div>
    </div>
  </div>
);
