import fs from 'node:fs';
import path from 'node:path';
import { env, DATABASE_DIR } from '../config/env.js';
import { query, queryOne } from '../database/pool.js';
import { EquipmentModel, EquipmentTypeModel, LookupModel, ShiftModel } from '../models/catalog.model.js';
import { TaskExecutionModel } from '../models/taskExecution.model.js';
import { HttpError } from '../middleware/errors.js';
import type { TimelineQuery } from '../validators/taskExecution.validator.js';

const uiConfig = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATABASE_DIR, 'config', 'dispatch.config.json'), 'utf8'));
  } catch {
    return {};
  }
})();

const RANGE_DAYS: Record<string, number> = { day: 1, week: 7, '2weeks': 14, '4weeks': 28 };

export interface ResolvedRange {
  from: Date;
  to: Date;
  date: string;
  mode: TimelineQuery['range'];
  shift_id: number | null;
}

/**
 * Calcula la ventana temporal en la zona horaria de la operación.
 * La "jornada operativa" empieza con el primer turno (07:00) y dura 24 h.
 */
export async function resolveRange(q: TimelineQuery): Promise<ResolvedRange> {
  const tz = env.OPERATION_TIMEZONE;

  if (q.from && q.to) {
    if (q.to <= q.from) throw new HttpError(400, 'invalid_range', '"to" debe ser posterior a "from"');
    return { from: q.from, to: q.to, date: q.from.toISOString().slice(0, 10), mode: q.range, shift_id: q.shift_id ?? null };
  }

  const base = await queryOne<{ day_start: string; today: string }>(
    `SELECT to_char(min(start_time), 'HH24:MI') AS day_start,
            to_char(((now() AT TIME ZONE $1) - min(start_time))::date, 'YYYY-MM-DD') AS today
     FROM shifts WHERE active`,
    [tz],
  );
  const date = q.date ?? base!.today;

  if (q.range === 'shift') {
    // Turno indicado, o el turno en curso
    const row = await queryOne<{ from_ts: Date; to_ts: Date; id: number }>(
      `WITH s AS (
         SELECT id, start_time,
                CASE WHEN end_time > start_time THEN end_time - start_time
                     ELSE end_time - start_time + interval '24 hours' END AS dur
         FROM shifts
         WHERE active AND ($3::int IS NOT NULL AND id = $3
               OR $3::int IS NULL AND (
                    (end_time > start_time AND (now() AT TIME ZONE $2)::time >= start_time AND (now() AT TIME ZONE $2)::time < end_time)
                 OR (end_time <= start_time AND ((now() AT TIME ZONE $2)::time >= start_time OR (now() AT TIME ZONE $2)::time < end_time))))
         ORDER BY sort_order LIMIT 1
       )
       SELECT id, (($1::date + start_time) AT TIME ZONE $2) AS from_ts,
                  (($1::date + start_time) AT TIME ZONE $2) + dur AS to_ts
       FROM s`,
      [date, tz, q.shift_id ?? null],
    );
    if (!row) throw new HttpError(400, 'invalid_shift', 'Turno no encontrado');
    return { from: row.from_ts, to: row.to_ts, date, mode: 'shift', shift_id: row.id };
  }

  const days = RANGE_DAYS[q.range];
  const row = await queryOne<{ from_ts: Date; to_ts: Date }>(
    `WITH d AS (
       SELECT CASE WHEN $4 = 'day' THEN $1::date
                   ELSE $1::date - (extract(isodow FROM $1::date)::int - 1) END AS start_date
     )
     SELECT ((start_date + $2::time) AT TIME ZONE $3) AS from_ts,
            ((start_date + $2::time) AT TIME ZONE $3) + make_interval(days => $5) AS to_ts
     FROM d`,
    [date, base!.day_start, tz, q.range, days],
  );
  return { from: row!.from_ts, to: row!.to_ts, date, mode: q.range, shift_id: q.shift_id ?? null };
}

const TASK_LEVEL_FILTERS = ['location_id', 'operator_id', 'status', 'standard_task_id', 'category_id', 'ids'] as const;

export async function getTimeline(q: TimelineQuery) {
  const range = await resolveRange(q);
  const filter = { ...q, from: range.from, to: range.to, shift_id: range.shift_id ?? undefined };

  const [executions, lastEvent] = await Promise.all([
    TaskExecutionModel.list(filter),
    queryOne<{ id: number | null }>(`SELECT max(id) AS id FROM dispatch_events`),
  ]);

  // Filas del Gantt: equipos del proyecto. Con filtros a nivel de tarea, solo los que tienen tareas.
  const hasTaskFilter = TASK_LEVEL_FILTERS.some((k) => {
    const v = q[k as keyof TimelineQuery];
    return Array.isArray(v) ? v.length > 0 : v != null;
  });
  const equipment = await EquipmentModel.list({
    project_id: q.project_id,
    equipment_type_id: q.equipment_type_id,
    equipment_id: q.equipment_id,
    ids: hasTaskFilter ? [...new Set(executions.map((e) => e.equipment_id as number))] : undefined,
  });

  return {
    range: { ...range, from: range.from.toISOString(), to: range.to.toISOString() },
    serverTime: new Date().toISOString(),
    lastEventId: lastEvent?.id ?? 0,
    equipment,
    executions,
    summary: summarize(executions, new Date()),
  };
}

type Exec = { status: string; planned_start: Date; planned_end: Date; actual_start: Date | null; actual_end: Date | null };

/** Indicadores de cumplimiento operativo del período consultado */
export function summarize(rows: Exec[], now: Date) {
  const tolerance = (uiConfig?.timeline?.lateToleranceMinutes ?? 5) * 60_000;
  const byStatus: Record<string, number> = {};
  let due = 0;
  let dueDone = 0;
  let punctual = 0;
  let started = 0;
  let shouldBeRunning = 0;
  let overdue = 0;
  let plannedMin = 0;
  let actualMin = 0;

  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    if (r.status === 'cancelada') continue;
    const ps = new Date(r.planned_start).getTime();
    const pe = new Date(r.planned_end).getTime();
    if (pe <= now.getTime()) {
      due += 1;
      if (r.status === 'finalizada') dueDone += 1;
    }
    if (r.actual_start) {
      started += 1;
      if (new Date(r.actual_start).getTime() <= ps + tolerance) punctual += 1;
    }
    if (ps <= now.getTime() && pe > now.getTime() && ['planificada', 'demorada'].includes(r.status)) shouldBeRunning += 1;
    if (r.status === 'en_ejecucion' && pe < now.getTime()) overdue += 1;
    if (r.status === 'finalizada' && r.actual_start && r.actual_end) {
      plannedMin += (pe - ps) / 60_000;
      actualMin += (new Date(r.actual_end).getTime() - new Date(r.actual_start).getTime()) / 60_000;
    }
  }

  return {
    total: rows.length,
    byStatus,
    planCompliancePct: due ? Math.round((dueDone / due) * 100) : null,
    punctualityPct: started ? Math.round((punctual / started) * 100) : null,
    durationDeviationPct: plannedMin ? Math.round(((actualMin - plannedMin) / plannedMin) * 1000) / 10 : null,
    shouldBeRunning,
    overdue,
  };
}

export async function getConfig() {
  const [statuses, shifts, categories, metrics, equipmentTypes] = await Promise.all([
    LookupModel.statuses(),
    ShiftModel.list(),
    LookupModel.categories(),
    LookupModel.metrics(),
    EquipmentTypeModel.list(),
  ]);
  return { ...uiConfig, timezone: env.OPERATION_TIMEZONE, statuses, shifts, categories, metrics, equipmentTypes };
}

export async function getChanges(since: number) {
  const events = await query(
    `SELECT id, entity, entity_id, action, project_id, created_at FROM dispatch_events
     WHERE id > $1 ORDER BY id LIMIT 500`,
    [since],
  );
  const last = await queryOne<{ id: number | null }>(`SELECT max(id) AS id FROM dispatch_events`);
  return { lastEventId: last?.id ?? 0, events, serverTime: new Date().toISOString() };
}
