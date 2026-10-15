import clsx from 'clsx';
import { Clock, Plus, Trash2 } from 'lucide-react';
import type { Metric } from '../../types';
import { fmtDuration } from '../../utils/time';
import { inputCls } from '../ui/Field';
import { IconButton } from '../ui/Button';

export interface ValueRow {
  metric_id: number;
  planned_value: number | null;
  actual_value: number | null;
}

interface Props {
  plannedStart: string; // HH:MM
  plannedEnd: string;
  plannedDuration: number;
  actualStart: string; // datetime-local (YYYY-MM-DDTHH:MM) o ''
  actualEnd: string;
  onActualChange: (field: 'actualStart' | 'actualEnd', value: string) => void;
  nowLocal: () => string;
  values: ValueRow[];
  metrics: Metric[];
  onValuesChange: (v: ValueRow[]) => void;
}

const minutesBetween = (a: string, b: string) => (a && b ? (Date.parse(b + ':00Z') - Date.parse(a + ':00Z')) / 60000 : null);

function Deviation({ plan, real, unit, invert }: { plan: number | null; real: number | null; unit: string; invert?: boolean }) {
  if (plan == null || real == null) return <span className="text-gray-300">—</span>;
  const d = Math.round((real - plan) * 10) / 10;
  if (d === 0) return <span className="text-gray-500">0</span>;
  const bad = invert ? d < 0 : d > 0;
  return (
    <span className={clsx('font-semibold', bad ? 'text-red-600' : 'text-emerald-600')}>
      {d > 0 ? '+' : ''}
      {d} {unit}
    </span>
  );
}

/** Tabla PLAN | REAL | DESVÍO para indicadores de cumplimiento operativo */
export function PlanVsReal(p: Props) {
  const actualDuration = minutesBetween(p.actualStart, p.actualEnd);
  const startDelay = p.actualStart ? minutesBetween(p.actualStart.slice(0, 11) + p.plannedStart, p.actualStart) : null;
  const unused = p.metrics.filter((m) => !p.values.some((v) => v.metric_id === m.id));
  const setVal = (i: number, k: 'planned_value' | 'actual_value', raw: string) =>
    p.onValuesChange(p.values.map((v, j) => (j === i ? { ...v, [k]: raw === '' ? null : Number(raw) } : v)));

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-[13px]">
          <thead className="bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left" />
              <th className="px-2 py-2 text-left">Plan</th>
              <th className="px-2 py-2 text-left">Real</th>
              <th className="px-2 py-2 text-right">Desvío</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="px-3 py-2 font-medium text-gray-700">Inicio</td>
              <td className="px-2 tabular-nums">{p.plannedStart}</td>
              <td className="px-2">
                <ActualInput value={p.actualStart} onChange={(v) => p.onActualChange('actualStart', v)} onNow={() => p.onActualChange('actualStart', p.nowLocal())} />
              </td>
              <td className="px-2 text-right">
                <Deviation plan={0} real={startDelay} unit="min" />
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-medium text-gray-700">Fin</td>
              <td className="px-2 tabular-nums">{p.plannedEnd}</td>
              <td className="px-2">
                <ActualInput value={p.actualEnd} onChange={(v) => p.onActualChange('actualEnd', v)} onNow={() => p.onActualChange('actualEnd', p.nowLocal())} />
              </td>
              <td />
            </tr>
            <tr>
              <td className="px-3 py-2 font-medium text-gray-700">Duración</td>
              <td className="px-2 tabular-nums">{fmtDuration(p.plannedDuration)}</td>
              <td className="px-2 tabular-nums">{actualDuration != null ? fmtDuration(actualDuration) : '—'}</td>
              <td className="px-2 text-right">
                <Deviation plan={p.plannedDuration} real={actualDuration} unit="min" />
              </td>
            </tr>
            {p.values.map((v, i) => {
              const m = p.metrics.find((x) => x.id === v.metric_id);
              if (!m) return null;
              return (
                <tr key={v.metric_id}>
                  <td className="px-3 py-1.5 font-medium text-gray-700">
                    {m.name} <span className="text-[11px] font-normal text-gray-400">({m.unit})</span>
                  </td>
                  <td className="px-2">
                    <input type="number" step="any" value={v.planned_value ?? ''} onChange={(e) => setVal(i, 'planned_value', e.target.value)} className={clsx(inputCls, 'h-7 w-20 text-right text-[13px]')} aria-label={`${m.name} plan`} />
                  </td>
                  <td className="px-2">
                    <input type="number" step="any" value={v.actual_value ?? ''} onChange={(e) => setVal(i, 'actual_value', e.target.value)} className={clsx(inputCls, 'h-7 w-20 text-right text-[13px]')} aria-label={`${m.name} real`} />
                  </td>
                  <td className="whitespace-nowrap px-2 text-right">
                    <Deviation plan={v.planned_value} real={v.actual_value} unit={m.unit} invert={m.code === 'production_t' || m.code === 'water_m3'} />
                    <IconButton icon={Trash2} label="Quitar magnitud" className="ml-1 h-6 w-6" onClick={() => p.onValuesChange(p.values.filter((_, j) => j !== i))} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {unused.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-gray-500">Agregar magnitud:</span>
          {unused.map((m) => (
            <button
              key={m.id}
              onClick={() => p.onValuesChange([...p.values, { metric_id: m.id, planned_value: null, actual_value: null }])}
              className="flex items-center gap-1 rounded-full border border-gray-300 px-2 py-0.5 text-[12px] text-gray-600 hover:border-primary-400 hover:text-primary-700"
            >
              <Plus className="h-3 w-3" /> {m.name}
            </button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-gray-500">Los valores reales alimentan los indicadores de cumplimiento (plan vs. real, puntualidad y desvío de duración).</p>
    </div>
  );
}

function ActualInput({ value, onChange, onNow }: { value: string; onChange: (v: string) => void; onNow: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <input type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} className={clsx(inputCls, 'h-7 w-[178px] px-1.5 text-[12px]')} />
      <IconButton icon={Clock} label="Usar hora actual" className="h-7 w-7" onClick={onNow} />
    </div>
  );
}
