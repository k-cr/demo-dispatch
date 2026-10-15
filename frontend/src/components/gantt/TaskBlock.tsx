import { memo, type PointerEvent as ReactPointerEvent } from 'react';
import clsx from 'clsx';
import { AlertTriangle, ChevronLeft, ChevronRight, ClipboardCheck, Timer } from 'lucide-react';
import type { TaskExecution } from '../../types';
import { LOCKED_STATUSES, STATUS } from '../../utils/status';
import { checklistPercent } from '../../utils/gantt';

export type DragMode = 'move' | 'resize-start' | 'resize-end';

interface Props {
  exec: TaskExecution;
  left: number;
  width: number;
  top: number;
  height: number;
  timeLabel: string;
  colorBy: 'status' | 'category';
  selected: boolean;
  dragging: boolean;
  overlap: boolean;
  lateToStart: boolean;
  overrun: boolean;
  clippedStart: boolean;
  clippedEnd: boolean;
  onPointerDown: (e: ReactPointerEvent, exec: TaskExecution, mode: DragMode) => void;
  onHover: (exec: TaskExecution | null, e?: ReactPointerEvent) => void;
  onActivate: (id: number) => void;
}

const STRIPES: Record<string, string> = {
  detenida: 'repeating-linear-gradient(135deg, rgba(220,38,38,.10) 0 6px, transparent 6px 12px)',
  cancelada: 'repeating-linear-gradient(135deg, rgba(107,114,128,.12) 0 6px, transparent 6px 12px)',
};

function TaskBlockImpl(p: Props) {
  const { exec, width } = p;
  const st = STATUS[exec.status];
  const Icon = st.icon;
  const locked = LOCKED_STATUSES.includes(exec.status);
  const pct = checklistPercent(exec);
  const tiny = width < 26;
  const compact = width < 74;
  const running = exec.status === 'en_ejecucion';

  const byCategory = p.colorBy === 'category';
  const style: React.CSSProperties = {
    left: p.left,
    width: Math.max(width, 4),
    top: p.top,
    height: p.height,
    borderLeftColor: exec.category_color,
    backgroundImage: st.pattern === 'stripes' ? STRIPES[exec.status] : undefined,
    ...(byCategory && !running
      ? { backgroundColor: `${exec.category_color}1F`, borderColor: exec.category_color, color: '#1f2937' }
      : {}),
    ...(byCategory && running ? { backgroundColor: exec.category_color, borderColor: exec.category_color } : {}),
  };

  const label = `${exec.task_name} · ${exec.equipment_code} · ${exec.operator_name ?? 'sin operador'} · ${p.timeLabel} · ${st.label}`;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      data-execution-id={exec.id}
      onPointerDown={(e) => p.onPointerDown(e, exec, 'move')}
      onPointerEnter={(e) => p.onHover(exec, e)}
      onPointerMove={(e) => p.onHover(exec, e)}
      onPointerLeave={() => p.onHover(null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          p.onActivate(exec.id);
        }
      }}
      style={style}
      className={clsx(
        'group absolute select-none overflow-hidden rounded-[5px] border border-l-[3px] text-left shadow-sm',
        'transition-[box-shadow,transform] duration-75 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
        st.block,
        st.pattern === 'dashed' && 'border-dashed',
        exec.status === 'cancelada' && 'opacity-75',
        locked ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
        p.selected && 'z-20 ring-2 ring-primary-500 ring-offset-1 shadow-lg',
        p.dragging && 'z-30 opacity-90 shadow-xl ring-2 ring-primary-400',
        p.lateToStart && !p.selected && 'ring-2 ring-amber-400 animate-[pulse_2s_ease-in-out_infinite]',
        p.overrun && !p.selected && 'ring-2 ring-red-400',
        !p.selected && !p.dragging && 'hover:z-10 hover:shadow-md',
      )}
    >
      {tiny ? (
        width >= 12 && <Icon className="mx-auto mt-[calc(50%-6px)] h-3 w-3 opacity-80" style={{ marginTop: p.height / 2 - 6 }} aria-hidden />
      ) : (
        <div className="flex h-full flex-col justify-center gap-px px-1.5 py-0.5 leading-[12px]">
          <div className="flex min-w-0 items-center gap-1">
            {p.clippedStart && <ChevronLeft className="-ml-1 h-3 w-3 shrink-0 opacity-60" aria-hidden />}
            <Icon className={clsx('h-3 w-3 shrink-0', running && 'animate-pulse')} aria-hidden />
            <span className={clsx('truncate text-[10.5px] font-bold uppercase tracking-wide', exec.status === 'cancelada' && 'line-through')}>
              {exec.task_name}
            </span>
            {p.clippedEnd && <ChevronRight className="-mr-1 ml-auto h-3 w-3 shrink-0 opacity-60" aria-hidden />}
          </div>
          {compact ? (
            <div className="truncate text-[10px] opacity-80">{p.timeLabel.split(' - ')[0]}</div>
          ) : (
            <>
              <div className="truncate text-[10px] font-semibold opacity-90">{exec.equipment_code}</div>
              <div className="truncate text-[10px] opacity-80">{exec.operator_name ?? '— sin operador —'}</div>
              <div className="truncate text-[10px] tabular-nums opacity-80">{p.timeLabel}</div>
            </>
          )}
        </div>
      )}

      {/* Indicadores */}
      {!tiny && (
        <div className="pointer-events-none absolute right-0.5 top-0.5 flex items-center gap-0.5">
          {pct !== null && width >= 110 && (
            <span
              className={clsx(
                'flex items-center gap-0.5 rounded px-0.5 text-[9px] font-semibold',
                running ? 'bg-white/20' : 'bg-white/80 text-gray-600',
                (exec.checklist_failed ?? 0) > 0 && 'text-red-600',
              )}
              title={`Checklist ${pct}%`}
            >
              <ClipboardCheck className="h-2.5 w-2.5" aria-hidden />
              {pct}%
            </span>
          )}
          {p.lateToStart && (
            <span title="Debería estar en ejecución" className="rounded-full bg-amber-400 p-[2px] text-white">
              <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
            </span>
          )}
          {p.overrun && (
            <span title="Excede el fin planificado" className="rounded-full bg-red-500 p-[2px] text-white">
              <Timer className="h-2.5 w-2.5" aria-hidden />
            </span>
          )}
          {p.overlap && (
            <span title="Se superpone con otra tarea del equipo" className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white">
              !
            </span>
          )}
        </div>
      )}

      {/* Asas para redimensionar */}
      {!locked && width >= 18 && (
        <>
          <span
            aria-hidden
            onPointerDown={(e) => {
              e.stopPropagation();
              p.onPointerDown(e, exec, 'resize-start');
            }}
            className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize opacity-0 group-hover:bg-black/15 group-hover:opacity-100"
          />
          <span
            aria-hidden
            onPointerDown={(e) => {
              e.stopPropagation();
              p.onPointerDown(e, exec, 'resize-end');
            }}
            className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize opacity-0 group-hover:bg-black/15 group-hover:opacity-100"
          />
        </>
      )}
    </div>
  );
}

export const TaskBlock = memo(TaskBlockImpl);
