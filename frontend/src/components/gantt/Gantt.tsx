import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import clsx from 'clsx';
import { ChevronDown, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import type { DispatchConfig, Equipment, TaskExecution, TimelineResponse } from '../../types';
import { useDispatchStore } from '../../store/dispatchStore';
import { useUpdateExecution } from '../../hooks/useDispatchData';
import { assignLanes, isLateToStart, isOverrun, type PlacedExecution } from '../../utils/gantt';
import { LOCKED_STATUSES } from '../../utils/status';
import { shiftSegments } from '../../utils/shifts';
import { roundTo, toTimeStr, DAY, HOUR, MIN } from '../../utils/time';
import { TaskBlock, type DragMode } from './TaskBlock';
import { TimeHeader, TOP_H, BOTTOM_H } from './TimeHeader';
import { EquipmentLabel } from './EquipmentLabel';
import { GanttTooltipHost, setHover } from './GanttTooltip';

export const LABEL_W = 236;
const HEADER_H = TOP_H + BOTTOM_H;
const GROUP_H = 28;
const ROW_PAD = 5;
export const DND_MIME = 'application/x-dispatch-task';

interface Props {
  data: TimelineResponse;
  config: DispatchConfig;
  now: number;
  onCreateAt: (equipment: Equipment, at: number, standardTaskId: number | null) => void;
}

interface Preview {
  id: number;
  start: number;
  end: number;
  equipmentId: number;
}

interface DragState {
  exec: TaskExecution;
  mode: DragMode;
  x0: number;
  y0: number;
  scroll0: number;
  start0: number;
  end0: number;
  moved: boolean;
  locked: boolean;
  current: Preview;
}

interface Row {
  equipment: Equipment;
  placed: PlacedExecution[];
  height: number;
  operatorName: string | null;
  utilization: number;
}

export function Gantt({ data, config, now, onCreateAt }: Props) {
  const tz = config.timezone;
  const { zoom, colorBy, collapsedGroups, toggleGroup, selectedId, select, scrollToNowTick } = useDispatchStore();
  const zoomDef = config.timeline.zoomLevels[zoom];
  const px = zoomDef.pxPerHour;
  const snapMs = zoomDef.snapMinutes * MIN;
  const LANE_H = config.timeline.laneHeight;

  const from = Date.parse(data.range.from);
  const to = Date.parse(data.range.to);
  const width = Math.round(((to - from) / HOUR) * px);
  const x = useCallback((t: number) => ((t - from) / HOUR) * px, [from, px]);

  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [dropTarget, setDropTarget] = useState<{ equipmentId: number; at: number } | null>(null);
  const [view, setView] = useState({ left: 0, width: 0 });
  const update = useUpdateExecution();
  // refs para mantener estables los callbacks que reciben los bloques (memo)
  const live = useRef({ update, select, equipment: data.equipment });
  live.current = { update, select, equipment: data.equipment };

  const segments = useMemo(() => shiftSegments(config.shifts, tz, from, to), [config.shifts, tz, from, to]);

  // ---------------------------------------------------------------- filas
  const groups = useMemo(() => {
    const byEq = new Map<number, { exec: TaskExecution; start: number; end: number }[]>();
    for (const e of data.executions) {
      let eqId = e.equipment_id;
      let start = Date.parse(e.planned_start);
      let end = Date.parse(e.planned_end);
      if (preview?.id === e.id) ({ equipmentId: eqId, start, end } = preview);
      if (!byEq.has(eqId)) byEq.set(eqId, []);
      byEq.get(eqId)!.push({ exec: e, start, end });
    }

    const map = new Map<string, { key: string; name: string; rows: Row[] }>();
    for (const eq of data.equipment) {
      const items = byEq.get(eq.id) ?? [];
      const { placed, lanes } = assignLanes(items);
      const productive = items.filter((i) => i.exec.status !== 'cancelada' && i.exec.task_type !== 'demora');
      const busy = productive.reduce((acc, i) => acc + Math.max(0, Math.min(i.end, to) - Math.max(i.start, from)), 0);
      const current =
        items.find((i) => i.start <= now && i.end > now && i.exec.operator_name) ??
        [...items].reverse().find((i) => i.start <= now && i.exec.operator_name) ??
        items.find((i) => i.exec.operator_name);
      const key = eq.equipment_type_name;
      if (!map.has(key)) map.set(key, { key, name: key, rows: [] });
      map.get(key)!.rows.push({
        equipment: eq,
        placed,
        height: lanes * LANE_H + ROW_PAD * 2,
        operatorName: current?.exec.operator_name ?? null,
        utilization: Math.round((busy / (to - from)) * 100),
      });
    }
    return [...map.values()];
  }, [data, preview, from, to, now, LANE_H]);

  // --------------------------------------------------------- scroll / ahora
  const nowInRange = now >= from && now < to;
  const scrollToNow = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      const el = scroller.current;
      if (!el) return;
      el.scrollTo({ left: Math.max(0, x(now) - (el.clientWidth - LABEL_W) * 0.35), behavior });
    },
    [x, now],
  );

  const lastKey = useRef('');
  useLayoutEffect(() => {
    const key = `${data.range.from}|${zoom}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    if (nowInRange) scrollToNow('auto');
    else scroller.current?.scrollTo({ left: 0 });
  }, [data.range.from, zoom, nowInRange, scrollToNow]);

  useEffect(() => {
    if (scrollToNowTick) scrollToNow();
  }, [scrollToNowTick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let raf = 0;
    const sync = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setView({ left: el.scrollLeft, width: el.clientWidth }));
    };
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', sync);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  // ---------------------------------------------------- arrastrar / redimensionar
  const onBlockPointerDown = useCallback(
    (e: ReactPointerEvent, exec: TaskExecution, mode: DragMode) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const el = scroller.current!;
      const start0 = Date.parse(exec.planned_start);
      const end0 = Date.parse(exec.planned_end);
      drag.current = {
        exec, mode, x0: e.clientX, y0: e.clientY, scroll0: el.scrollLeft, start0, end0, moved: false,
        locked: LOCKED_STATUSES.includes(exec.status),
        current: { id: exec.id, start: start0, end: end0, equipmentId: exec.equipment_id },
      };
      setHover(null);

      const onMove = (ev: PointerEvent) => {
        const d = drag.current;
        if (!d || d.locked) return;
        if (!d.moved && Math.abs(ev.clientX - d.x0) < 4 && Math.abs(ev.clientY - d.y0) < 4) return;
        d.moved = true;

        // Autoscroll en los bordes
        const r = el.getBoundingClientRect();
        if (ev.clientX > r.right - 40) el.scrollLeft += 18;
        else if (ev.clientX < r.left + LABEL_W + 40) el.scrollLeft -= 18;
        if (ev.clientY > r.bottom - 30) el.scrollTop += 14;
        else if (ev.clientY < r.top + HEADER_H + 30) el.scrollTop -= 14;

        const deltaMs = (((ev.clientX - d.x0) + (el.scrollLeft - d.scroll0)) / px) * HOUR;
        let { start, end, equipmentId } = d.current;
        if (d.mode === 'move') {
          start = roundTo(d.start0 + deltaMs, snapMs);
          end = start + (d.end0 - d.start0);
          const rowEl = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-equipment-row]');
          if (rowEl) equipmentId = Number(rowEl.dataset.equipmentRow);
        } else if (d.mode === 'resize-start') {
          start = Math.min(roundTo(d.start0 + deltaMs, snapMs), d.end0 - snapMs);
          end = d.end0;
        } else {
          end = Math.max(roundTo(d.end0 + deltaMs, snapMs), d.start0 + snapMs);
          start = d.start0;
        }
        d.current = { id: d.exec.id, start, end, equipmentId };
        setPreview(d.current);
      };

      const finish = (commit: boolean) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('keydown', onKey);
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        if (!d.moved) {
          if (commit) live.current.select(d.exec.id);
          return;
        }
        const c = d.current;
        const changed = c.start !== d.start0 || c.end !== d.end0 || c.equipmentId !== d.exec.equipment_id;
        if (commit && changed) {
          const eq = live.current.equipment.find((q) => q.id === c.equipmentId);
          const body = {
            planned_start: new Date(c.start).toISOString(),
            planned_end: new Date(c.end).toISOString(),
            ...(c.equipmentId !== d.exec.equipment_id ? { equipment_id: c.equipmentId } : {}),
            version: d.exec.version,
          };
          live.current.update.mutate({
            id: d.exec.id,
            body,
            optimistic: {
              planned_start: body.planned_start,
              planned_end: body.planned_end,
              equipment_id: c.equipmentId,
              equipment_code: eq?.code ?? d.exec.equipment_code,
            },
          });
        }
        setPreview(null);
      };
      const onUp = () => finish(true);
      const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && finish(false);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('keydown', onKey);
    },
    [px, snapMs],
  );

  const onActivate = useCallback((id: number) => live.current.select(id), []);

  const onHover = useCallback((exec: TaskExecution | null, e?: ReactPointerEvent) => {
    if (drag.current?.moved) return;
    setHover(exec && e ? { exec, x: e.clientX, y: e.clientY } : null);
  }, []);

  // ------------------------------------------------- soltar tarea estándar / doble clic
  const timeAt = (e: { clientX: number }, laneEl: HTMLElement) =>
    roundTo(from + ((e.clientX - laneEl.getBoundingClientRect().left) / px) * HOUR, snapMs);

  const onLaneDragOver = (e: DragEvent<HTMLDivElement>, eq: Equipment) => {
    if (!e.dataTransfer.types.includes(DND_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const at = timeAt(e, e.currentTarget);
    if (dropTarget?.equipmentId !== eq.id || dropTarget.at !== at) setDropTarget({ equipmentId: eq.id, at });
  };
  const onLaneDrop = (e: DragEvent<HTMLDivElement>, eq: Equipment) => {
    const id = Number(e.dataTransfer.getData(DND_MIME));
    setDropTarget(null);
    if (!id) return;
    e.preventDefault();
    onCreateAt(eq, timeAt(e, e.currentTarget), id);
  };
  const onLaneDoubleClick = (e: MouseEvent<HTMLDivElement>, eq: Equipment) => {
    if (e.target !== e.currentTarget) return;
    onCreateAt(eq, timeAt(e, e.currentTarget), null);
  };

  // ---------------------------------------------------------------- fondo
  const gridStep = zoom === 'week' ? px * 6 : px;
  const background = [
    `repeating-linear-gradient(to right, #e5e7eb 0 1px, transparent 1px ${gridStep}px)`,
    zoom === 'hours' ? `repeating-linear-gradient(to right, #f1f2f4 0 1px, transparent 1px ${px / 4}px)` : null,
  ]
    .filter(Boolean)
    .join(',');
  const dayLines: number[] = [];
  for (let t = from + DAY; t < to; t += DAY) dayLines.push(t);

  const nowX = x(now);
  const visibleLeft = view.left;
  const visibleRight = view.left + view.width - LABEL_W;
  const edge = !nowInRange ? null : nowX < visibleLeft ? 'left' : nowX > visibleRight ? 'right' : null;
  const totalRows = groups.reduce((n, g) => n + g.rows.length, 0);

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scroller} className="gantt-scroll absolute inset-0 overflow-auto bg-white">
        <div className="relative" style={{ width: LABEL_W + width, minHeight: '100%' }}>
          {/* ===== Encabezado de tiempo (sticky) ===== */}
          <div className="sticky top-0 z-40 flex border-b border-gray-300 bg-white" style={{ height: HEADER_H }}>
            <div
              className="sticky left-0 z-50 flex shrink-0 flex-col justify-end border-r border-gray-300 bg-white px-3 pb-1.5"
              style={{ width: LABEL_W }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Equipo / Operador</span>
              <span className="text-[13px] font-bold text-gray-800">
                {totalRows} equipos · {data.executions.length} tareas
              </span>
            </div>
            <div className="relative" style={{ width }}>
              <TimeHeader from={from} to={to} width={width} zoom={zoom} zoomDef={zoomDef} tz={tz} segments={segments} />
              {nowInRange && (
                <div className="pointer-events-none absolute bottom-0 z-10 -translate-x-1/2" style={{ left: nowX, top: TOP_H }}>
                  <div className="flex flex-col items-center">
                    <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white shadow">
                      AHORA {toTimeStr(now, tz)}
                    </span>
                    <span className="h-0 w-0 border-x-[5px] border-t-[5px] border-x-transparent border-t-red-600" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ===== Cuerpo ===== */}
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0"
              style={{ left: LABEL_W, width, backgroundImage: background }}
            >
              {segments
                .filter((s) => s.shift.start_time >= '18:00' || s.shift.code === 'NOCHE')
                .map((s) => (
                  <div key={`${s.date}-n`} className="absolute inset-y-0 bg-slate-500/[0.055]" style={{ left: x(s.start), width: x(s.end) - x(s.start) }} />
                ))}
              {dayLines.map((t) => (
                <div key={t} className="absolute inset-y-0 w-px bg-gray-400/70" style={{ left: x(t) }} />
              ))}
            </div>

            {groups.map((g) => {
              const collapsed = collapsedGroups[g.key];
              return (
                <Fragment key={g.key}>
                  <div className="relative flex border-b border-gray-200 bg-gray-50" style={{ height: GROUP_H }}>
                    <button
                      onClick={() => toggleGroup(g.key)}
                      aria-expanded={!collapsed}
                      className="sticky left-0 z-30 flex shrink-0 items-center gap-1.5 border-r border-gray-300 bg-gray-50 px-2 text-left text-[11px] font-bold uppercase tracking-wide text-gray-600 hover:text-gray-900"
                      style={{ width: LABEL_W }}
                    >
                      {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {g.name}
                      <span className="ml-auto rounded-full bg-gray-200 px-1.5 text-[10px] text-gray-600">{g.rows.length}</span>
                    </button>
                  </div>
                  {!collapsed &&
                    g.rows.map((r) => {
                      const eq = r.equipment;
                      const inactive = eq.status !== 'operativo';
                      const isDrop = dropTarget?.equipmentId === eq.id;
                      return (
                        <div key={eq.id} className="relative flex border-b border-gray-200" style={{ height: r.height }}>
                          <EquipmentLabel
                            equipment={eq}
                            height={r.height}
                            width={LABEL_W}
                            operatorName={r.operatorName}
                            utilization={r.utilization}
                            taskCount={r.placed.length}
                          />
                          <div
                            data-equipment-row={eq.id}
                            className={clsx('relative shrink-0', isDrop && 'bg-primary-50/70', preview?.equipmentId === eq.id && 'bg-primary-50/40')}
                            style={{
                              width,
                              backgroundImage: inactive
                                ? 'repeating-linear-gradient(135deg, rgba(100,116,139,.08) 0 8px, transparent 8px 16px)'
                                : undefined,
                            }}
                            onDragOver={(e) => onLaneDragOver(e, eq)}
                            onDragLeave={() => setDropTarget(null)}
                            onDrop={(e) => onLaneDrop(e, eq)}
                            onDoubleClick={(e) => onLaneDoubleClick(e, eq)}
                          >
                            {r.placed.map((p) => {
                              const left = Math.max(0, x(p.start));
                              const right = Math.min(width, x(p.end));
                              if (right <= 0 || left >= width) return null;
                              const top = ROW_PAD + p.lane * LANE_H;
                              const e = p.exec;
                              const as = e.actual_start ? Date.parse(e.actual_start) : null;
                              const ae = e.actual_end ? Date.parse(e.actual_end) : as ? Math.min(now, to) : null;
                              return (
                                <Fragment key={e.id}>
                                  <TaskBlock
                                    exec={e}
                                    left={left}
                                    width={right - left}
                                    top={top}
                                    height={LANE_H - 8}
                                    timeLabel={`${toTimeStr(p.start, tz)} - ${toTimeStr(p.end, tz)}`}
                                    colorBy={colorBy}
                                    selected={selectedId === e.id}
                                    dragging={preview?.id === e.id}
                                    overlap={p.overlap}
                                    lateToStart={isLateToStart(e, now)}
                                    overrun={isOverrun(e, now)}
                                    clippedStart={x(p.start) < 0}
                                    clippedEnd={x(p.end) > width}
                                    onPointerDown={onBlockPointerDown}
                                    onHover={onHover}
                                    onActivate={onActivate}
                                  />
                                  {as !== null && ae !== null && preview?.id !== e.id && (
                                    <div
                                      aria-hidden
                                      title="Tiempo real"
                                      className={clsx(
                                        'pointer-events-none absolute z-[5] h-[3px] rounded-full',
                                        e.status === 'detenida' ? 'bg-red-600' : e.status === 'en_ejecucion' ? 'bg-primary-900' : 'bg-gray-700/70',
                                      )}
                                      style={{ left: Math.max(0, x(as)), width: Math.max(2, Math.min(width, x(ae)) - Math.max(0, x(as))), top: top + LANE_H - 6 }}
                                    />
                                  )}
                                </Fragment>
                              );
                            })}
                            {isDrop && (
                              <div className="pointer-events-none absolute inset-y-1 z-20 border-l-2 border-dashed border-primary-600" style={{ left: x(dropTarget.at) }}>
                                <span className="ml-1 rounded bg-primary-700 px-1 text-[10px] font-semibold text-white">{toTimeStr(dropTarget.at, tz)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </Fragment>
              );
            })}

            {nowInRange && (
              <div aria-hidden className="pointer-events-none absolute inset-y-0 z-[15] w-[2px] bg-red-500/90" style={{ left: LABEL_W + nowX - 1 }} />
            )}
          </div>

          {totalRows === 0 && (
            <div className="sticky left-0 flex flex-col items-center justify-center py-20 text-gray-500" style={{ width: view.width || '100%' }}>
              <Inbox className="mb-2 h-8 w-8 text-gray-300" />
              <p className="text-sm font-medium">No hay equipos ni tareas para los filtros seleccionados</p>
            </div>
          )}
        </div>
      </div>

      {/* Indicador "AHORA" cuando la línea queda fuera de la vista */}
      {edge && (
        <button
          onClick={() => scrollToNow()}
          className={clsx(
            'absolute z-50 flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-lg hover:bg-red-700',
            edge === 'left' ? 'left-[248px]' : 'right-4',
          )}
          style={{ top: TOP_H + 4 }}
        >
          {edge === 'left' && <ChevronLeft className="h-3.5 w-3.5" />}
          AHORA {toTimeStr(now, tz)}
          {edge === 'right' && <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      )}

      {!preview && <GanttTooltipHost tz={tz} />}
    </div>
  );
}
