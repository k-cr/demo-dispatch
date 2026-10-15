import { create } from 'zustand';
import { ClipboardCheck, MapPin, Truck, User } from 'lucide-react';
import type { TaskExecution } from '../../types';
import { StatusBadge } from '../ui/StatusBadge';
import { fmtDuration, toTimeStr } from '../../utils/time';
import { checklistPercent } from '../../utils/gantt';

export function GanttTooltip({ exec, x, y, tz }: { exec: TaskExecution; x: number; y: number; tz: string }) {
  const W = 300;
  const left = Math.min(x + 16, window.innerWidth - W - 12);
  const top = Math.min(y + 16, window.innerHeight - 260);
  const ps = Date.parse(exec.planned_start);
  const pe = Date.parse(exec.planned_end);
  const pct = checklistPercent(exec);

  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[90] rounded-lg border border-gray-200 bg-white p-3 text-[12px] shadow-xl"
      style={{ left, top, width: W }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: exec.category_color }}>
            {exec.category_name} · {exec.task_code}
            {exec.cycle_number ? ` · Ciclo ${exec.cycle_number}` : ''}
          </div>
          <div className="truncate text-sm font-bold text-gray-900">{exec.task_name}</div>
        </div>
        <StatusBadge status={exec.status} size="xs" />
      </div>
      <dl className="mt-2 space-y-1 text-gray-700">
        <div className="flex items-center gap-1.5">
          <Truck className="h-3.5 w-3.5 text-gray-400" aria-hidden />
          <span className="font-semibold">{exec.equipment_code}</span>
          <span className="truncate text-gray-500">{exec.equipment_name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-gray-400" aria-hidden />
          {exec.operator_name ?? <span className="italic text-gray-400">Sin operador</span>}
        </div>
        {exec.location_path && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-gray-400" aria-hidden />
            <span className="truncate">{exec.location_path}</span>
          </div>
        )}
      </dl>
      <div className="mt-2 grid grid-cols-[52px_1fr] gap-x-2 gap-y-0.5 rounded-md bg-gray-50 px-2 py-1.5 tabular-nums">
        <span className="text-gray-500">Plan</span>
        <span>
          {toTimeStr(ps, tz)} – {toTimeStr(pe, tz)} <span className="text-gray-400">({fmtDuration((pe - ps) / 60000)})</span>
        </span>
        <span className="text-gray-500">Real</span>
        <span>
          {exec.actual_start ? toTimeStr(exec.actual_start, tz) : '—'} – {exec.actual_end ? toTimeStr(exec.actual_end, tz) : exec.actual_start ? 'en curso' : '—'}
        </span>
      </div>
      {pct !== null && (
        <div className="mt-1.5 flex items-center gap-1.5 text-gray-600">
          <ClipboardCheck className="h-3.5 w-3.5 text-gray-400" aria-hidden />
          Checklist {pct}%{(exec.checklist_failed ?? 0) > 0 && <span className="font-semibold text-red-600">· {exec.checklist_failed} observado(s)</span>}
        </div>
      )}
      {exec.observations && <p className="mt-1.5 line-clamp-2 text-gray-600">“{exec.observations}”</p>}
      <p className="mt-2 border-t border-gray-100 pt-1.5 text-[10.5px] text-gray-400">Clic: detalle · Arrastrar: mover / cambiar equipo · Bordes: duración</p>
    </div>
  );
}

/** Estado de hover aislado: mover el mouse no re-renderiza el Gantt completo */
const useHover = create<{ hover: { exec: TaskExecution; x: number; y: number } | null }>(() => ({ hover: null }));
export const setHover = (hover: { exec: TaskExecution; x: number; y: number } | null) => useHover.setState({ hover });

export function GanttTooltipHost({ tz }: { tz: string }) {
  const hover = useHover((s) => s.hover);
  return hover ? <GanttTooltip exec={hover.exec} x={hover.x} y={hover.y} tz={tz} /> : null;
}
