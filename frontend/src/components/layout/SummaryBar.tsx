import clsx from 'clsx';
import { AlertTriangle, Gauge, Target, Timer } from 'lucide-react';
import type { ExecutionStatus, TimelineSummary } from '../../types';
import { useDispatchStore } from '../../store/dispatchStore';
import { STATUS, STATUS_ORDER } from '../../utils/status';

/** Indicadores del período. Los chips de estado funcionan como filtro rápido. */
export function SummaryBar({ summary }: { summary: TimelineSummary | undefined }) {
  const { filters, toggleStatus } = useDispatchStore();
  if (!summary) return <div className="h-[58px] border-b border-gray-200 bg-white" />;

  return (
    <div className="flex flex-wrap items-stretch gap-1.5 border-b border-gray-200 bg-white px-4 py-2">
      <Kpi label="Tareas" value={summary.total} />
      <div className="mx-1 w-px self-stretch bg-gray-200" />
      {STATUS_ORDER.map((s: ExecutionStatus) => {
        const st = STATUS[s];
        const Icon = st.icon;
        const active = filters.statuses.includes(s);
        return (
          <button
            key={s}
            type="button"
            aria-pressed={active}
            onClick={() => toggleStatus(s)}
            title={`Filtrar: ${st.label}`}
            className={clsx(
              'flex items-center gap-2 rounded-lg border py-1 pl-1.5 pr-3 text-left transition-colors',
              active ? 'border-primary-400 bg-primary-50 ring-1 ring-primary-300' : 'border-gray-200 hover:bg-gray-50',
            )}
          >
            <span className={clsx('flex h-7 w-7 items-center justify-center rounded-md', st.badge, 'ring-1 ring-inset')}>
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="leading-tight">
              <span className="block text-[17px] font-bold tabular-nums text-gray-900">{summary.byStatus[s] ?? 0}</span>
              <span className="block text-[11px] text-gray-500">{st.label}</span>
            </span>
          </button>
        );
      })}
      <div className="mx-1 w-px self-stretch bg-gray-200" />
      <Kpi icon={Target} label="Cumplimiento plan" value={summary.planCompliancePct == null ? '—' : `${summary.planCompliancePct}%`} tone={tone(summary.planCompliancePct)} />
      <Kpi icon={Gauge} label="Puntualidad" value={summary.punctualityPct == null ? '—' : `${summary.punctualityPct}%`} tone={tone(summary.punctualityPct)} />
      {summary.shouldBeRunning > 0 && (
        <Kpi icon={AlertTriangle} label="Sin iniciar (atrasadas)" value={summary.shouldBeRunning} tone="warn" />
      )}
      {summary.overdue > 0 && <Kpi icon={Timer} label="Exceden el plan" value={summary.overdue} tone="bad" />}
    </div>
  );
}

const tone = (pct: number | null) => (pct == null ? undefined : pct >= 90 ? 'good' : pct >= 75 ? 'warn' : 'bad');

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon?: typeof Target; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div
      className={clsx(
        'flex items-center gap-2 rounded-lg px-2.5 py-1',
        tone === 'warn' && 'bg-amber-50 text-amber-800',
        tone === 'bad' && 'bg-red-50 text-red-700',
        tone === 'good' && 'bg-emerald-50 text-emerald-800',
      )}
    >
      {Icon && <Icon className="h-4 w-4 opacity-80" aria-hidden />}
      <span className="leading-tight">
        <span className="block text-[17px] font-bold tabular-nums">{value}</span>
        <span className={clsx('block text-[11px]', tone ? 'opacity-80' : 'text-gray-500')}>{label}</span>
      </span>
    </div>
  );
}
