import { useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useChecklists,
  useConfig,
  useCreateExecution,
  useEquipment,
  useLocations,
  useOperators,
  useProjects,
  useStandardTasks,
  useTimeline,
} from '../hooks/useDispatchData';
import { useNow } from '../hooks/useNow';
import { useRealtimeChanges } from '../hooks/useRealtimeChanges';
import { useDispatchStore } from '../store/dispatchStore';
import { currentShift, operationalDate } from '../utils/shifts';
import { roundTo, MIN } from '../utils/time';
import type { Equipment } from '../types';
import { DispatchHeader } from '../components/layout/DispatchHeader';
import { FiltersBar } from '../components/layout/FiltersBar';
import { SummaryBar } from '../components/layout/SummaryBar';
import { StatusLegend } from '../components/layout/StatusLegend';
import { Sidebar } from '../components/sidebar/Sidebar';
import { Gantt } from '../components/gantt/Gantt';
import { TaskDetailPanel } from '../components/detail/TaskDetailPanel';
import { Toaster } from '../components/ui/Toaster';
import { Button } from '../components/ui/Button';

export function DispatchPage({ initialProjectCode }: { initialProjectCode?: string }) {
  const qc = useQueryClient();
  const store = useDispatchStore();
  const { projectId, date, filters, setPeriod, setProject, select, openDraft } = store;

  const config = useConfig();
  const projects = useProjects();
  const locations = useLocations(projectId);
  const equipment = useEquipment(projectId);
  const operators = useOperators(projectId);
  const standardTasks = useStandardTasks();
  const checklists = useChecklists();
  const timeline = useTimeline();
  const create = useCreateExecution();

  const cfg = config.data;
  const now = useNow(cfg?.timeline.nowLineRefreshSeconds ?? 15);
  const realtime = useRealtimeChanges(timeline.data?.lastEventId);

  // Inicialización: jornada y turno actuales + proyecto por defecto
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current || !cfg || !projects.data) return;
    initialized.current = true;
    const preferred =
      projects.data.find((p) => p.code === initialProjectCode) ??
      [...projects.data].sort((a, b) => b.equipment_count - a.equipment_count)[0];
    setProject(preferred?.id ?? null);
    setPeriod({
      date: operationalDate(cfg.shifts, cfg.timezone),
      range: cfg.timeline.defaultRange,
      shiftId: currentShift(cfg.shifts, cfg.timezone)?.id ?? null,
    });
    useDispatchStore.setState({ zoom: cfg.timeline.defaultZoom });
  }, [cfg, projects.data, initialProjectCode, setPeriod, setProject]);

  const executions = timeline.data?.executions ?? [];

  /** Crear tarea en un equipo/hora (soltar desde el panel o doble clic) */
  const onCreateAt = useCallback(
    (eq: Equipment, at: number, standardTaskId: number | null) => {
      const prev = executions
        .filter((e) => e.equipment_id === eq.id && Date.parse(e.planned_start) <= at)
        .sort((a, b) => Date.parse(b.planned_start) - Date.parse(a.planned_start));
      const operatorId = prev.find((e) => e.operator_id)?.operator_id ?? null;
      const locationId = filters.locationId ?? prev.find((e) => e.location_id)?.location_id ?? null;
      const std = standardTasks.data?.find((t) => t.id === standardTaskId);

      if (std) {
        create.mutate(
          {
            standard_task_id: std.id,
            equipment_id: eq.id,
            planned_start: new Date(at).toISOString(),
            duration_min: std.standard_duration_min,
            operator_id: std.requires_operator ? operatorId : null,
            location_id: locationId,
          },
          { onSuccess: (res) => select(res.data.id) },
        );
      } else {
        openDraft({
          standard_task_id: null,
          equipment_id: eq.id,
          operator_id: operatorId,
          location_id: locationId,
          planned_start: new Date(at).toISOString(),
          planned_end: new Date(at + 60 * MIN).toISOString(),
        });
      }
    },
    [executions, filters.locationId, standardTasks.data, create, select, openDraft],
  );

  const onNewTask = () => {
    const r = timeline.data?.range;
    const from = r ? Date.parse(r.from) : now;
    const to = r ? Date.parse(r.to) : now;
    const at = now >= from && now < to ? roundTo(now, 15 * MIN) : from;
    openDraft({
      standard_task_id: null,
      equipment_id: filters.equipmentId,
      operator_id: filters.operatorId,
      location_id: filters.locationId,
      planned_start: new Date(at).toISOString(),
      planned_end: new Date(at + 60 * MIN).toISOString(),
    });
  };

  // ---------------------------------------------------------------- estados globales
  if (config.isError || projects.isError)
    return (
      <FullScreen>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 p-2 shadow-sm">
          <AlertTriangle className="h-8 w-8 text-amber-600" />
        </div>
        <h1 className="mt-3 text-lg font-bold text-gray-900">No se pudo conectar con la API de VR Analytics Dispatch</h1>
        <p className="mt-1 max-w-md text-center text-sm text-gray-600">
          Verifique que el backend esté en ejecución (<code className="rounded bg-gray-100 px-1">npm run dev</code> en /backend) y que la base de datos esté
          creada.
        </p>
        <Button className="mt-4" icon={RefreshCw} onClick={() => qc.refetchQueries()}>
          Reintentar
        </Button>
      </FullScreen>
    );

  if (!cfg || !projects.data || !date)
    return (
      <FullScreen>
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#fedec2] bg-[#fff3e8] p-2 shadow-sm animate-pulse">
          <img src="/vr-analytics-icon.svg" alt="VR Analytics" className="h-12 w-12" />
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary-700" />
          <p className="text-sm font-semibold text-slate-700">Cargando VR Analytics Dispatch…</p>
        </div>
      </FullScreen>
    );

  return (
    <div className="flex h-screen flex-col bg-gray-100 text-gray-900">
      <DispatchHeader
        config={cfg}
        projects={projects.data}
        timeline={timeline.data}
        fetching={timeline.isFetching}
        connection={realtime}
        now={now}
        onRefresh={() => {
          qc.invalidateQueries({ queryKey: ['timeline'] });
          qc.invalidateQueries({ queryKey: ['standard-tasks'] });
          qc.invalidateQueries({ queryKey: ['checklists'] });
        }}
        onNewTask={onNewTask}
      />
      <FiltersBar
        config={cfg}
        locations={locations.data ?? []}
        equipment={equipment.data ?? []}
        operators={operators.data ?? []}
        standardTasks={standardTasks.data ?? []}
      />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          config={cfg}
          projects={projects.data}
          locations={locations.data ?? []}
          standardTasks={standardTasks.data ?? []}
          checklists={checklists.data ?? []}
          executions={executions}
          now={now}
        />

        <main className="relative flex min-w-0 flex-1 flex-col">
          <SummaryBar summary={timeline.data?.summary} />
          <div className="relative flex min-h-0 flex-1 flex-col">
            {timeline.data ? (
              <Gantt data={timeline.data} config={cfg} now={now} onCreateAt={onCreateAt} />
            ) : timeline.isError ? (
              <div className="m-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">No se pudo cargar el timeline: {String(timeline.error?.message)}</div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando planificación…
              </div>
            )}
            {timeline.isFetching && timeline.data && (
              <div className="pointer-events-none absolute right-3 top-[60px] z-50 flex items-center gap-1.5 rounded-full bg-white/90 px-2 py-1 text-[11px] text-gray-500 shadow ring-1 ring-gray-200">
                <Loader2 className="h-3 w-3 animate-spin" /> Actualizando
              </div>
            )}
          </div>
          <StatusLegend />

          <TaskDetailPanel
            config={cfg}
            executions={executions}
            equipment={equipment.data ?? []}
            operators={operators.data ?? []}
            locations={locations.data ?? []}
            standardTasks={standardTasks.data ?? []}
            checklists={checklists.data ?? []}
          />
        </main>
      </div>
      <Toaster />
    </div>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="flex h-screen flex-col items-center justify-center bg-gray-100 p-6">{children}</div>;
}
