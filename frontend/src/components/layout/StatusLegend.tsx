import clsx from 'clsx';
import { AlertTriangle, MousePointerClick, Move, Timer } from 'lucide-react';
import { STATUS, STATUS_ORDER } from '../../utils/status';

export function StatusLegend() {
  return (
    <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-200 bg-white px-4 py-1.5 text-[11px] text-gray-600">
      {STATUS_ORDER.map((s) => {
        const st = STATUS[s];
        const Icon = st.icon;
        return (
          <span key={s} className="flex items-center gap-1">
            <span className={clsx('flex h-4 w-6 items-center justify-center rounded-[3px] border', st.block, st.pattern === 'dashed' && 'border-dashed')}>
              <Icon className="h-2.5 w-2.5" aria-hidden />
            </span>
            {st.label}
          </span>
        );
      })}
      <span className="flex items-center gap-1">
        <span className="h-[3px] w-6 rounded-full bg-gray-700/70" /> Tiempo real
      </span>
      <span className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3 text-amber-500" /> Debería estar en ejecución
      </span>
      <span className="flex items-center gap-1">
        <Timer className="h-3 w-3 text-red-500" /> Excede plan
      </span>
      <span className="flex items-center gap-1">
        <span className="flex h-3 w-3 items-center justify-center rounded-full bg-red-600 text-[8px] font-bold text-white">!</span> Superposición
      </span>
      <span className="ml-auto flex items-center gap-3 text-gray-400">
        <span className="flex items-center gap-1">
          <Move className="h-3 w-3" /> Arrastre bloques o bordes
        </span>
        <span className="flex items-center gap-1">
          <MousePointerClick className="h-3 w-3" /> Doble clic: nueva tarea
        </span>
      </span>
    </footer>
  );
}
