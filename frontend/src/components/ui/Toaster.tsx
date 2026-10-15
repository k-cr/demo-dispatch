import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useToasts, type ToastKind } from '../../store/toastStore';

const ICON: Record<ToastKind, typeof Info> = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };
const CLS: Record<ToastKind, string> = {
  success: 'text-emerald-600',
  error: 'text-red-600',
  warning: 'text-amber-600',
  info: 'text-primary-600',
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[360px] flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICON[t.kind];
        return (
          <div key={t.id} className="pointer-events-auto flex gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
            <Icon className={clsx('mt-0.5 h-5 w-5 shrink-0', CLS[t.kind])} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">{t.title}</p>
              {t.lines?.map((l, i) => (
                <p key={i} className="mt-0.5 text-[13px] leading-snug text-gray-600">
                  {l}
                </p>
              ))}
            </div>
            <button onClick={() => dismiss(t.id)} aria-label="Cerrar" className="h-6 w-6 rounded text-gray-400 hover:bg-gray-100">
              <X className="mx-auto h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
