import { memo } from 'react';
import clsx from 'clsx';
import { User } from 'lucide-react';
import type { Equipment } from '../../types';
import { EQUIPMENT_STATUS } from '../../utils/status';

interface Props {
  equipment: Equipment;
  height: number;
  width: number;
  operatorName: string | null;
  utilization: number;
  taskCount: number;
}

function EquipmentLabelImpl({ equipment: e, height, width, operatorName, utilization, taskCount }: Props) {
  const st = EQUIPMENT_STATUS[e.status] ?? EQUIPMENT_STATUS.operativo;
  return (
    <div
      className="sticky left-0 z-30 flex shrink-0 flex-col justify-center gap-0.5 border-r border-gray-300 bg-white px-3"
      style={{ width, height }}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-[13px] font-bold text-primary-700">{e.code}</span>
        <span className={clsx('rounded px-1.5 py-px text-[10px] font-semibold ring-1 ring-inset', st.cls)}>{st.label}</span>
      </div>
      <div className="truncate text-[12px] text-gray-600" title={`${e.name}${e.brand ? ` · ${e.brand}` : ''}${e.model ? ` ${e.model}` : ''}`}>
        {e.name}
        {e.capacity_t ? <span className="text-gray-400"> · {e.capacity_t} t</span> : null}
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
        <User className="h-3 w-3 shrink-0" aria-hidden />
        <span className={clsx('min-w-0 flex-1 truncate', !operatorName && 'italic text-gray-400')}>{operatorName ?? 'Sin operador'}</span>
        <span className="shrink-0 tabular-nums" title={`${taskCount} tareas · ocupación planificada ${utilization}%`}>
          {utilization}%
        </span>
        <span className="h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-gray-200" aria-hidden>
          <span
            className={clsx('block h-full rounded-full', utilization > 85 ? 'bg-emerald-500' : utilization > 50 ? 'bg-primary-500' : 'bg-amber-400')}
            style={{ width: `${Math.min(100, utilization)}%` }}
          />
        </span>
      </div>
    </div>
  );
}

export const EquipmentLabel = memo(EquipmentLabelImpl);
