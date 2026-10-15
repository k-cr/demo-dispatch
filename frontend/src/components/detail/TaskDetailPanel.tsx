import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DispatchApi } from '../../services/dispatch.api';
import clsx from 'clsx';
import { AlertTriangle, Ban, CheckCircle2, ClipboardCheck, Clock, Info, MapPin, OctagonPause, Play, RotateCcw, Save, Scale, Trash2, Truck, User, X, AlarmClock } from 'lucide-react';
import type { Checklist, DispatchConfig, Equipment, ExecutionDraft, ExecutionStatus, Location, Operator, StandardTask, TaskExecution, Warning } from '../../types';
import { useCreateExecution, useDeleteExecution, useUpdateExecution } from '../../hooks/useDispatchData';
import { useDispatchStore } from '../../store/dispatchStore';
import type { ExecutionPayload } from '../../services/dispatch.api';
import { STATUS, STATUS_ORDER } from '../../utils/status';
import { checklistPercent } from '../../utils/gantt';
import { fmtDate, fmtDuration, timeToMinutes, toDateStr, toTimeStr, zonedToDate, MIN } from '../../utils/time';
import { currentShift } from '../../utils/shifts';
import { Button } from '../ui/Button';
import { Combobox } from '../ui/Combobox';
import { Field, Input, Select, Textarea } from '../ui/Field';
import { StatusBadge } from '../ui/StatusBadge';
import { PlanVsReal, type ValueRow } from './PlanVsReal';
import { ExecutionChecklist } from './ExecutionChecklist';

interface Props {
  config: DispatchConfig;
  executions: TaskExecution[];
  equipment: Equipment[];
  operators: Operator[];
  locations: Location[];
  standardTasks: StandardTask[];
  checklists: Checklist[];
}

interface Form {
  standard_task_id: number | null;
  equipment_id: number | null;
  operator_id: number | null;
  location_id: number | null;
  status: ExecutionStatus;
  date: string;
  start: string;
  end: string;
  duration: number;
  actualStart: string;
  actualEnd: string;
  observations: string;
  values: ValueRow[];
}

type Tab = 'detail' | 'plan' | 'checklist';

const toLocalDT = (iso: string | null, tz: string) => (iso ? `${toDateStr(iso, tz)}T${toTimeStr(iso, tz)}` : '');
const fromLocalDT = (v: string, tz: string) => (v ? zonedToDate(v.slice(0, 10), v.slice(11, 16), tz).toISOString() : null);

function formFrom(src: { planned_start: string; planned_end: string } & Partial<TaskExecution> & Partial<ExecutionDraft>, tz: string, defaults?: StandardTask): Form {
  const ps = Date.parse(src.planned_start);
  const pe = Date.parse(src.planned_end);
  return {
    standard_task_id: src.standard_task_id ?? null,
    equipment_id: src.equipment_id ?? null,
    operator_id: src.operator_id ?? null,
    location_id: src.location_id ?? null,
    status: (src.status as ExecutionStatus) ?? 'planificada',
    date: toDateStr(ps, tz),
    start: toTimeStr(ps, tz),
    end: toTimeStr(pe, tz),
    duration: Math.round((pe - ps) / MIN),
    actualStart: toLocalDT(src.actual_start ?? null, tz),
    actualEnd: toLocalDT(src.actual_end ?? null, tz),
    observations: src.observations ?? '',
    values:
      src.values?.map((v) => ({ metric_id: v.metric_id, planned_value: v.planned_value, actual_value: v.actual_value })) ??
      defaults?.metrics.map((m) => ({ metric_id: m.metric_id, planned_value: m.default_value, actual_value: null })) ??
      [],
  };
}

/** Acciones rápidas de cambio de estado */
const ACTIONS: Record<ExecutionStatus, { to: ExecutionStatus; label: string; icon: typeof Play; variant: 'primary' | 'secondary' | 'danger' | 'success' }[]> = {
  planificada: [
    { to: 'en_ejecucion', label: 'Iniciar', icon: Play, variant: 'primary' },
    { to: 'demorada', label: 'Demorada', icon: AlarmClock, variant: 'secondary' },
    { to: 'cancelada', label: 'Cancelar', icon: Ban, variant: 'danger' },
  ],
  demorada: [
    { to: 'en_ejecucion', label: 'Iniciar', icon: Play, variant: 'primary' },
    { to: 'cancelada', label: 'Cancelar', icon: Ban, variant: 'danger' },
  ],
  en_ejecucion: [
    { to: 'finalizada', label: 'Finalizar', icon: CheckCircle2, variant: 'success' },
    { to: 'detenida', label: 'Detener', icon: OctagonPause, variant: 'danger' },
  ],
  detenida: [
    { to: 'en_ejecucion', label: 'Reanudar', icon: Play, variant: 'primary' },
    { to: 'finalizada', label: 'Finalizar', icon: CheckCircle2, variant: 'success' },
  ],
  finalizada: [{ to: 'en_ejecucion', label: 'Reabrir', icon: RotateCcw, variant: 'secondary' }],
  cancelada: [{ to: 'planificada', label: 'Reactivar', icon: RotateCcw, variant: 'secondary' }],
};

export function TaskDetailPanel({ config, executions, equipment, operators, locations, standardTasks, checklists }: Props) {
  const tz = config.timezone;
  const { selectedId, draft, closeDetail, select } = useDispatchStore();
  const inList = selectedId != null ? executions.find((e) => e.id === selectedId) ?? null : null;
  // Si la tarea no está en el timeline (filtrada o recién creada) se consulta directamente
  const fetched = useQuery({
    queryKey: ['execution', selectedId],
    queryFn: () => DispatchApi.execution(selectedId!),
    enabled: selectedId != null && !inList,
  });
  const exec = inList ?? (selectedId != null ? fetched.data ?? null : null);
  const isCreate = !!draft && !exec;
  const open = isCreate || !!exec;

  const update = useUpdateExecution();
  const create = useCreateExecution();
  const remove = useDeleteExecution();

  const [tab, setTab] = useState<Tab>('detail');
  const [form, setForm] = useState<Form | null>(null);
  const [initial, setInitial] = useState<Form | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);

  // Carga el formulario al seleccionar otra tarea o cuando llega una versión nueva del servidor
  const sourceKey = exec ? `${exec.id}:${exec.version}` : draft ? `draft:${draft.planned_start}:${draft.equipment_id}:${draft.standard_task_id}` : '';
  useEffect(() => {
    if (!open) return;
    const src = exec ?? draft!;
    const std = standardTasks.find((t) => t.id === src.standard_task_id);
    const f = formFrom(src as TaskExecution, tz, std);
    setForm(f);
    setInitial(f);
  }, [sourceKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setTab('detail');
    setWarnings([]);
  }, [selectedId, draft]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !(e.target as HTMLElement).closest('input,textarea,select') && closeDetail();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeDetail]);

  const std = standardTasks.find((t) => t.id === form?.standard_task_id);
  const eq = equipment.find((e) => e.id === form?.equipment_id);

  // Conflictos detectados en el cliente
  const conflicts = useMemo(() => {
    if (!form || !form.equipment_id) return [];
    const s = zonedToDate(form.date, form.start, tz).getTime();
    const e = s + form.duration * MIN;
    return executions.filter(
      (x) =>
        x.id !== exec?.id &&
        x.status !== 'cancelada' &&
        Date.parse(x.planned_start) < e &&
        Date.parse(x.planned_end) > s &&
        (x.equipment_id === form.equipment_id || (form.operator_id != null && x.operator_id === form.operator_id)),
    );
  }, [form, executions, exec?.id, tz]);

  if (!open || !form || !initial) return null;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const setStart = (start: string) => {
    const end = minutesToTime(timeToMinutes(start) + form.duration);
    setForm({ ...form, start, end });
  };
  const setEnd = (end: string) => {
    let d = timeToMinutes(end) - timeToMinutes(form.start);
    if (d <= 0) d += 24 * 60;
    setForm({ ...form, end, duration: d });
  };
  const setDuration = (duration: number) => setForm({ ...form, duration, end: minutesToTime(timeToMinutes(form.start) + duration) });
  const setTask = (id: number | null) => {
    const t = standardTasks.find((x) => x.id === id);
    setForm({
      ...form,
      standard_task_id: id,
      ...(t && isCreate
        ? {
            duration: t.standard_duration_min,
            end: minutesToTime(timeToMinutes(form.start) + t.standard_duration_min),
            values: t.metrics.map((m) => ({ metric_id: m.metric_id, planned_value: m.default_value, actual_value: null })),
          }
        : {}),
    });
  };

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const plannedStartIso = zonedToDate(form.date, form.start, tz).toISOString();
  const plannedEndIso = new Date(Date.parse(plannedStartIso) + form.duration * MIN).toISOString();
  const shiftName = config.shifts.find((s) => s.id === currentShift(config.shifts, tz, new Date(plannedStartIso))?.id)?.name;

  const buildPayload = (): ExecutionPayload => {
    const p: ExecutionPayload = {};
    const changed = <K extends keyof Form>(k: K) => JSON.stringify(form[k]) !== JSON.stringify(initial[k]) || isCreate;
    if (changed('standard_task_id') && form.standard_task_id) p.standard_task_id = form.standard_task_id;
    if (changed('equipment_id') && form.equipment_id) p.equipment_id = form.equipment_id;
    if (changed('operator_id')) p.operator_id = form.operator_id;
    if (changed('location_id')) p.location_id = form.location_id;
    if (changed('status')) p.status = form.status;
    if (changed('date') || changed('start') || changed('end') || changed('duration')) {
      p.planned_start = plannedStartIso;
      p.planned_end = plannedEndIso;
    }
    if (changed('actualStart')) p.actual_start = fromLocalDT(form.actualStart, tz);
    if (changed('actualEnd')) p.actual_end = fromLocalDT(form.actualEnd, tz);
    if (changed('observations')) p.observations = form.observations || null;
    if (changed('values')) p.values = form.values;
    return p;
  };

  const onSave = () => {
    if (isCreate) {
      create.mutate(buildPayload(), {
        onSuccess: (res) => {
          select(res.data.id);
          setWarnings(res.warnings);
        },
      });
    } else if (exec) {
      const body = { ...buildPayload(), version: exec.version };
      update.mutate({ id: exec.id, body }, { onSuccess: (res) => setWarnings(res.warnings) });
    }
  };

  const quickStatus = (to: ExecutionStatus) => {
    if (!exec) return set('status', to);
    update.mutate(
      { id: exec.id, body: { status: to, version: exec.version }, optimistic: { status: to } },
      { onSuccess: (res) => setWarnings(res.warnings) },
    );
  };

  const onDelete = () => {
    if (!exec) return;
    if (!window.confirm(`¿Eliminar la tarea "${exec.task_name}" de ${exec.equipment_code}?`)) return;
    remove.mutate(exec.id, { onSuccess: closeDetail });
  };

  const nowLocal = () => toLocalDT(new Date().toISOString(), tz);
  const pct = exec ? checklistPercent(exec) : null;
  const color = std?.category_color ?? exec?.category_color ?? '#1A5096';

  const eqOptions = equipment.map((e) => ({ value: e.id, label: e.code, sublabel: e.name, group: e.equipment_type_name }));
  const opOptions = operators.map((o) => ({ value: o.id, label: o.full_name, sublabel: o.employee_code }));
  const taskOptions = standardTasks.filter((t) => t.active || t.id === form.standard_task_id).map((t) => ({ value: t.id, label: t.name, sublabel: `${t.code} · ${fmtDuration(t.standard_duration_min)}`, group: t.category_name }));

  return (
    <aside
      role="dialog"
      aria-label="Detalle de tarea"
      className="absolute inset-y-0 right-0 z-[60] flex w-[460px] max-w-full flex-col border-l border-gray-200 bg-white shadow-2xl"
    >
      {/* ---- Encabezado ---- */}
      <div className="border-b border-gray-200">
        <div className="h-1" style={{ backgroundColor: color }} />
        <div className="flex items-start gap-3 px-4 pb-3 pt-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
              {isCreate ? 'Nueva tarea' : 'Detalle de tarea'} {std && `· ${std.category_name} · ${std.code}`}
              {exec?.cycle_number ? ` · Ciclo ${exec.cycle_number}` : ''}
            </div>
            <h2 className="truncate text-lg font-bold text-gray-900">{std?.name ?? 'Seleccione una tarea estándar'}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gray-600">
              {eq && (
                <span className="flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5 text-gray-400" />
                  <b>{eq.code}</b> {eq.name}
                </span>
              )}
              {exec && <StatusBadge status={exec.status} size="xs" />}
            </div>
          </div>
          <button onClick={closeDetail} aria-label="Cerrar detalle" className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        {exec && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-3">
            {ACTIONS[exec.status].map((a) => (
              <Button key={a.to} size="xs" variant={a.variant} icon={a.icon} loading={update.isPending && update.variables?.body.status === a.to} onClick={() => quickStatus(a.to)}>
                {a.label}
              </Button>
            ))}
          </div>
        )}

        <div role="tablist" className="flex gap-1 px-3">
          {(
            [
              ['detail', 'Detalle', Info],
              ['plan', 'Plan vs Real', Scale],
              ['checklist', `Checklist${pct != null ? ` ${pct}%` : ''}`, ClipboardCheck],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={clsx(
                'flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-[13px] font-medium',
                tab === id ? 'border-primary-700 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-800',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Contenido ---- */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {(warnings.length > 0 || conflicts.length > 0) && tab !== 'checklist' && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[12px] text-amber-900">
            <div className="mb-1 flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-4 w-4" /> Atención
            </div>
            <ul className="list-disc space-y-0.5 pl-5">
              {warnings.map((w, i) => (
                <li key={i}>{w.message}</li>
              ))}
              {warnings.length === 0 &&
                conflicts.slice(0, 4).map((c) => (
                  <li key={c.id}>
                    {c.equipment_id === form.equipment_id ? `${c.equipment_code} ya tiene` : `${c.operator_name} asignado a ${c.equipment_code}:`} “{c.task_name}” {toTimeStr(c.planned_start, tz)}–{toTimeStr(c.planned_end, tz)}
                  </li>
                ))}
            </ul>
          </div>
        )}

        {tab === 'detail' && (
          <div className="grid grid-cols-6 gap-3">
            <Field label="Tarea" className="col-span-6">
              <Combobox options={taskOptions} value={form.standard_task_id} onChange={setTask} placeholder="Tarea estándar…" />
            </Field>
            <Field label="Equipo" className="col-span-3">
              <Combobox icon={Truck} options={eqOptions} value={form.equipment_id} onChange={(v) => set('equipment_id', v)} placeholder="Equipo…" />
            </Field>
            <Field label="Operador" className="col-span-3" hint={std?.requires_operator && !form.operator_id ? 'Esta tarea requiere operador' : undefined}>
              <Combobox icon={User} allowClear options={opOptions} value={form.operator_id} onChange={(v) => set('operator_id', v)} placeholder="Buscar operador…" />
            </Field>
            <Field label="Fecha" className="col-span-2">
              <Input type="date" value={form.date} onChange={(e) => e.target.value && set('date', e.target.value)} />
            </Field>
            <Field label="Inicio" className="col-span-2">
              <Input type="time" value={form.start} onChange={(e) => e.target.value && setStart(e.target.value)} />
            </Field>
            <Field label="Fin" className="col-span-2">
              <Input type="time" value={form.end} onChange={(e) => e.target.value && setEnd(e.target.value)} />
            </Field>
            <Field label="Duración (min)" className="col-span-2" hint={std ? `Estándar: ${fmtDuration(std.standard_duration_min)}` : undefined}>
              <Input type="number" min={1} value={form.duration} onChange={(e) => Number(e.target.value) > 0 && setDuration(Number(e.target.value))} />
            </Field>
            <Field label="Estado" className="col-span-4">
              <Select value={form.status} onChange={(e) => set('status', e.target.value as ExecutionStatus)}>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS[s].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ubicación" className="col-span-6">
              <Select icon={MapPin} value={form.location_id ?? ''} onChange={(e) => set('location_id', e.target.value ? Number(e.target.value) : null)}>
                <option value="">Sin ubicación</option>
                {locations
                  .filter((l) => !eq?.project_id || l.project_id === eq.project_id)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.path}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Observaciones" className="col-span-6">
              <Textarea rows={3} value={form.observations} onChange={(e) => set('observations', e.target.value)} placeholder="Demoras, incidentes, indicaciones al operador…" />
            </Field>

            <dl className="col-span-6 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg bg-gray-50 p-3 text-[12px]">
              <dt className="text-gray-500">Turno</dt>
              <dd className="font-medium text-gray-800">{shiftName ?? '—'}</dd>
              <dt className="text-gray-500">Inicio / fin planificado</dt>
              <dd className="font-medium tabular-nums text-gray-800">
                {fmtDate(plannedStartIso, tz)} {toTimeStr(plannedStartIso, tz)} → {toTimeStr(plannedEndIso, tz)}
              </dd>
              {exec && (
                <>
                  <dt className="text-gray-500">Inicio / fin real</dt>
                  <dd className="font-medium tabular-nums text-gray-800">
                    {exec.actual_start ? toTimeStr(exec.actual_start, tz) : '—'} → {exec.actual_end ? toTimeStr(exec.actual_end, tz) : exec.actual_start ? 'en curso' : '—'}
                  </dd>
                  <dt className="text-gray-500">Checklist</dt>
                  <dd className="font-medium text-gray-800">{pct != null ? `${pct}% completado` : exec.linked_checklists ? 'Pendiente' : 'No aplica'}</dd>
                  <dt className="text-gray-500">Última modificación</dt>
                  <dd className="text-gray-800">
                    {exec.updated_by ?? '—'} · v{exec.version}
                  </dd>
                </>
              )}
            </dl>
          </div>
        )}

        {tab === 'plan' && (
          <PlanVsReal
            plannedStart={form.start}
            plannedEnd={form.end}
            plannedDuration={form.duration}
            actualStart={form.actualStart}
            actualEnd={form.actualEnd}
            onActualChange={(k, v) => set(k, v)}
            nowLocal={nowLocal}
            values={form.values}
            metrics={config.metrics}
            onValuesChange={(v) => set('values', v)}
          />
        )}

        {tab === 'checklist' &&
          (exec ? (
            <ExecutionChecklist executionId={exec.id} allChecklists={checklists} tz={tz} />
          ) : (
            <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">Guarde la tarea para registrar su checklist.</p>
          ))}
      </div>

      {/* ---- Pie ---- */}
      {tab !== 'checklist' && (
        <div className="flex items-center gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3">
          {exec && (
            <Button variant="danger" icon={Trash2} onClick={onDelete} loading={remove.isPending}>
              Eliminar
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {dirty && !isCreate && (
              <Button variant="ghost" onClick={() => setForm(initial)}>
                Descartar
              </Button>
            )}
            {!dirty && !isCreate && (
              <span className="flex items-center gap-1 text-[12px] text-gray-400">
                <Clock className="h-3.5 w-3.5" /> Sin cambios
              </span>
            )}
            <Button
              variant="primary"
              icon={Save}
              disabled={(!dirty && !isCreate) || !form.standard_task_id || !form.equipment_id}
              loading={update.isPending || create.isPending}
              onClick={onSave}
            >
              {isCreate ? 'Planificar tarea' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
}

function minutesToTime(min: number) {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
