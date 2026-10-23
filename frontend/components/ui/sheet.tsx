import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { GBtn } from '@/components/ui/button';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/** Bảng trượt (di động) / hộp thoại (máy tính) – có bẫy focus, Esc để đóng */
export const Sheet: React.FC<{
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  persistent?: boolean;
  icon?: React.ReactNode;
}> = ({ open, onClose, title, subtitle, children, footer, wide = false, persistent = false, icon }) => {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !persistent) {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key === 'Tab' && node) {
        const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const a = items[0];
        const b = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          b.focus();
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      previous?.focus?.();
    };
  }, [open, persistent]);

  if (!open) return null;
  return (
    <div className="g-backdrop animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && !persistent && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`g-sheet animate-sheet-up sm:animate-pop-in ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} outline-none`}
      >
        <div className="sticky top-0 z-10 bg-giay/95 backdrop-blur px-4 sm:px-6 pt-3 pb-3 border-b-2 border-vien">
          <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-vien-2 sm:hidden" aria-hidden="true" />
          <div className="flex items-start gap-3">
            {icon && <span className="shrink-0 mt-0.5">{icon}</span>}
            <div className="flex-1 min-w-0">
              <h2 id={titleId} className="font-display font-extrabold text-xl leading-tight text-muc">
                {title}
              </h2>
              {subtitle && <div className="text-sm text-muc-2 mt-0.5">{subtitle}</div>}
            </div>
            {!persistent && (
              <GBtn variant="ghost" iconOnly onClick={onClose} aria-label="Đóng">
                <X className="w-5 h-5" aria-hidden={true} />
              </GBtn>
            )}
          </div>
        </div>
        <div className="px-4 sm:px-6 py-4">{children}</div>
        {footer && <div className="sticky bottom-0 bg-giay/95 backdrop-blur px-4 sm:px-6 py-3 border-t-2 border-vien">{footer}</div>}
      </div>
    </div>
  );
};
