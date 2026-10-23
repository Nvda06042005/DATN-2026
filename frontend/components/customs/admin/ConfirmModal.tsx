import React from 'react';
import { Loader2 } from 'lucide-react';
import { Mascot } from '@/components/customs/Mascot';
import { ModalShell } from '@/components/ui/modal-shell';

export const ConfirmModal: React.FC<{
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ title, message, confirmLabel, danger, busy, onConfirm, onClose }) => (
  <ModalShell title={title} onClose={onClose}>
    <div className="p-6">
      <div className="flex items-start gap-4">
        <Mascot size={72} mood={danger ? 'sad' : 'thinking'} />
        <div className="text-sm font-bold text-duo-wolf leading-relaxed">{message}</div>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button onClick={onClose} className="btn-3d btn-ghost">
          Huỷ
        </button>
        <button onClick={onConfirm} disabled={busy} className={`btn-3d ${danger ? 'btn-red' : 'btn-blue'}`}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} {confirmLabel}
        </button>
      </div>
    </div>
  </ModalShell>
);
