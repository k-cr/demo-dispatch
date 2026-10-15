import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'md' | 'lg' | 'xl';
}

export function Modal({ open, title, subtitle, onClose, children, footer, width = 'lg' }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-gray-900/40 p-4 pt-[6vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className={clsx(
          'flex max-h-[88vh] w-full flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5',
          { md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' }[width],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-gray-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
