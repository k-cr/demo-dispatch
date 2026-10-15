import clsx from 'clsx';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Crosshair, Factory, Layers, Palette, Plus, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import type { DispatchConfig, Project, RangeMode, TimelineResponse, ZoomLevel } from '../../types';
import { useDispatchStore } from '../../store/dispatchStore';
import { currentShift, operationalDate, periodLabel, stepPeriod } from '../../utils/shifts';
import { Button, IconButton } from '../ui/Button';
import { Input, Segmented, Select } from '../ui/Field';
import type { ConnectionState } from '../../hooks/useRealtimeChanges';

interface Props {
  config: DispatchConfig;
  projects: Project[];
  timeline: TimelineResponse | undefined;
  fetching: boolean;
  connection: { state: ConnectionState; lastSync: number | null };
  now: number;
  onRefresh: () => void;
  onNewTask: () => void;
}

const RANGES: { value: RangeMode; label: string }[] = [
  { value: 'shift', label: 'Turno' },
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: '2weeks', label: '2 semanas' },
  { value: '4weeks', label: '4 semanas' },
];

const STEP_LABEL: Record<RangeMode, [string, string]> = {
  shift: ['Turno anterior', 'Turno siguiente'],
  day: ['Día anterior', 'Día siguiente'],
  week: ['Semana anterior', 'Semana siguiente'],
  '2weeks': ['2 semanas antes', '2 semanas después'],
  '4weeks': ['4 semanas antes', '4 semanas después'],
};

export function DispatchHeader({ config, projects, timeline, fetching, connection, now, onRefresh, onNewTask }: Props) {
  const { projectId, date, range, shiftId, zoom, colorBy, setProject, setPeriod, setZoom, setColorBy, requestScrollToNow } = useDispatchStore();
  const tz = config.timezone;
  const shifts = config.shifts;
  const effectiveShiftId = range === 'shift' ? shiftId ?? timeline?.range.shift_id ?? null : shiftId;
  const shift = shifts.find((s) => s.id === effectiveShiftId) ?? null;
  const label = timeline ? periodLabel(timeline.range.mode, timeline.range.from, timeline.range.to, tz, shift) : null;

  const step = (dir: 1 | -1) => setPeriod(stepPeriod(range, date, effectiveShiftId, shifts, dir));
  const goToday = () => {
    setPeriod({
      date: operationalDate(shifts, tz),
      shiftId: range === 'shift' ? currentShift(shifts, tz)?.id ?? null : shiftId,
    });
    requestScrollToNow();
  };

  const onShiftChange = (v: string) => {
    const id = v ? Number(v) : null;
    if (id === null && range === 'shift') setPeriod({ shiftId: null, range: 'day' });
    else if (id !== null && range === 'day') setPeriod({ shiftId: id, range: 'shift' });
    else setPeriod({ shiftId: id });
  };

  const onRangeChange = (r: RangeMode) => {
    if (r === 'shift') setPeriod({ range: r, shiftId: shiftId ?? currentShift(shifts, tz)?.id ?? shifts[0]?.id ?? null });
    // Al salir de la vista de turno se muestra el período completo (todos los turnos)
    else setPeriod({ range: r, shiftId: range === 'shift' ? null : shiftId });
  };

  const secondsAgo = connection.lastSync ? Math.max(0, Math.round((now - connection.lastSync) / 1000)) : null;

  return (
    <header className="border-b border-gray-200 bg-white">
      {/* ---- Fila 1: identidad + selectores principales ---- */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
        <div className="mr-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#fedec2] bg-[#fff3e8] p-1 shadow-sm transition-transform hover:scale-105">
            <img src="/vr-analytics-icon.svg" alt="VR Analytics" className="h-8 w-8" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-black tracking-tight text-slate-900">VR ANALYTICS</span>
              <span className="rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-700 ring-1 ring-inset ring-primary-200">
                Dispatch
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500">BI SOLUTIONS · Ciclos operativos</p>
          </div>
        </div>

        <Select
          icon={Factory}
          compact
          aria-label="Proyecto"
          className="w-44"
          value={projectId ?? ''}
          onChange={(e) => setProject(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Todos los proyectos</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>

        <div className="relative">
          <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
          <Input
            type="date"
            aria-label="Fecha"
            value={date}
            onChange={(e) => e.target.value && setPeriod({ date: e.target.value })}
            className="h-8 w-[150px] pl-8 text-[13px]"
          />
        </div>

        <Select icon={Clock} compact aria-label="Turno" className="w-[190px]" value={effectiveShiftId ?? ''} onChange={(e) => onShiftChange(e.target.value)}>
          <option value="">Todos los turnos</option>
          {shifts.map((s) => (
            <option key={s.id} value={s.id} title={`${s.start_time} → ${s.end_time}`}>
              {s.name} ({s.start_time.slice(0, 2)}–{s.end_time.slice(0, 2)} h)
            </option>
          ))}
        </Select>

        <Select icon={Layers} compact aria-label="Rango temporal" className="w-36" value={range} onChange={(e) => onRangeChange(e.target.value as RangeMode)}>
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <div
            className={clsx(
              'flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium ring-1 ring-inset',
              connection.state === 'offline' ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200',
            )}
            role="status"
            title={`Actualización automática por consulta periódica (${config.realtime.changesPollSeconds} s)`}
          >
            {connection.state === 'offline' ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
            <span className={clsx('h-1.5 w-1.5 rounded-full', connection.state === 'offline' ? 'bg-red-500' : connection.state === 'syncing' ? 'animate-ping bg-emerald-500' : 'bg-emerald-500')} />
            {connection.state === 'offline' ? 'Sin conexión' : secondsAgo === null ? 'Conectando…' : `En línea · hace ${secondsAgo} s`}
          </div>
          <IconButton icon={RefreshCw} label="Actualizar datos" onClick={onRefresh} className={clsx(fetching && '[&>svg]:animate-spin')} />
          <Button variant="primary" icon={Plus} onClick={onNewTask}>
            Nueva tarea
          </Button>
        </div>
      </div>

      {/* ---- Fila 2: navegación del período + zoom ---- */}
      <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 bg-gray-50/60 px-4 py-2">
        <div className="flex items-center gap-1">
          <IconButton icon={ChevronLeft} label={STEP_LABEL[range][0]} onClick={() => step(-1)} />
          <Button size="sm" onClick={goToday} title="Ir al período actual">
            Hoy
          </Button>
          <IconButton icon={ChevronRight} label={STEP_LABEL[range][1]} onClick={() => step(1)} />
        </div>
        {label && (
          <div className="min-w-0 leading-tight">
            <div className="text-[15px] font-bold text-gray-900">{label.title}</div>
            <div className="text-[12px] text-gray-500">{label.subtitle}</div>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" icon={Crosshair} onClick={requestScrollToNow} title="Centrar en la hora actual">
            Ahora
          </Button>
          <span className="hidden text-[11px] font-semibold uppercase tracking-wide text-gray-400 xl:inline">Zoom</span>
          <Segmented<ZoomLevel>
            label="Zoom de la línea de tiempo"
            value={zoom}
            onChange={setZoom}
            options={(['hours', 'day', 'week'] as ZoomLevel[]).map((z) => ({ value: z, label: config.timeline.zoomLevels[z].label }))}
          />
          <IconButton
            icon={Palette}
            label={colorBy === 'status' ? 'Colorear por categoría' : 'Colorear por estado'}
            active={colorBy === 'category'}
            onClick={() => setColorBy(colorBy === 'status' ? 'category' : 'status')}
          />
        </div>
      </div>
    </header>
  );
}
