import { query, queryOne, type Queryable } from '../database/pool.js';
import type { ExecutionFilter } from '../validators/taskExecution.validator.js';

/** Columnas que expone la API para una ejecución (vista v_task_executions + valores). */
const SELECT = `
  SELECT v.id, v.standard_task_id, v.task_code, v.task_name, v.task_type, v.standard_duration_min,
         v.category_id, v.category_code, v.category_name, v.category_color,
         v.project_id, v.project_name, v.location_id, v.location_name, v.location_path,
         v.equipment_id, v.equipment_code, v.equipment_name, v.equipment_type_id, v.equipment_type_name,
         v.operator_id, v.operator_name, v.operator_code, v.shift_id, v.shift_name,
         v.planned_start, v.planned_end, v.actual_start, v.actual_end, v.status, v.cycle_number,
         v.observations, v.version, v.created_by, v.updated_by, v.created_at, v.updated_at,
         v.linked_checklists, v.checklist_answered, v.checklist_total, v.checklist_failed,
         coalesce((SELECT json_agg(json_build_object(
                     'metric_id', m.id, 'code', m.code, 'name', m.name, 'unit', m.unit,
                     'planned_value', tv.planned_value, 'actual_value', tv.actual_value) ORDER BY m.sort_order)
                   FROM task_execution_values tv JOIN metrics m ON m.id = tv.metric_id
                   WHERE tv.task_execution_id = v.id), '[]') AS "values"
  FROM v_task_executions v`;

function buildWhere(f: ExecutionFilter) {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replace('?', `$${params.length}`));
  };

  // Solapamiento con el rango: considera tiempos planificados y reales
  if (f.from) add(`greatest(v.planned_end, coalesce(v.actual_end, v.planned_end)) > ?`, f.from);
  if (f.to) add(`least(v.planned_start, coalesce(v.actual_start, v.planned_start)) < ?`, f.to);
  if (f.project_id) add(`v.project_id = ?`, f.project_id);
  if (f.location_id)
    add(`v.location_id IN (SELECT id FROM v_locations WHERE ?::int = ANY(ancestors))`, f.location_id);
  if (f.equipment_id) add(`v.equipment_id = ?`, f.equipment_id);
  if (f.equipment_type_id) add(`v.equipment_type_id = ?`, f.equipment_type_id);
  if (f.operator_id) add(`v.operator_id = ?`, f.operator_id);
  if (f.shift_id) add(`v.shift_id = ?`, f.shift_id);
  if (f.standard_task_id) add(`v.standard_task_id = ?`, f.standard_task_id);
  if (f.category_id) add(`v.category_id = ?`, f.category_id);
  if (f.status?.length) add(`v.status = ANY(?::text[])`, f.status);
  if (f.ids?.length) add(`v.id = ANY(?::int[])`, f.ids);

  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export interface ExecutionRow {
  id: number;
  equipment_id: number;
  operator_id: number | null;
  standard_task_id: number;
  project_id: number;
  planned_start: Date;
  planned_end: Date;
  actual_start: Date | null;
  actual_end: Date | null;
  status: string;
  version: number;
  [k: string]: unknown;
}

export const TaskExecutionModel = {
  list: (f: ExecutionFilter, limit = 5000) => {
    const { sql, params } = buildWhere(f);
    params.push(limit);
    return query(`${SELECT} ${sql} ORDER BY v.equipment_code, v.planned_start LIMIT $${params.length}`, params);
  },

  get: (id: number, db?: Queryable) => queryOne(`${SELECT} WHERE v.id = $1`, [id], db),

  getRaw: (id: number, db?: Queryable) =>
    queryOne<ExecutionRow>(`SELECT * FROM task_executions WHERE id = $1`, [id], db),

  insert: (d: Record<string, unknown>, db: Queryable) => {
    const cols = Object.keys(d);
    const params = cols.map((c) => d[c]);
    return queryOne<{ id: number }>(
      `INSERT INTO task_executions (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
      params,
      db,
    );
  },

  update: (id: number, d: Record<string, unknown>, db: Queryable) => {
    const cols = Object.keys(d);
    if (!cols.length) return queryOne<{ id: number }>(`SELECT id FROM task_executions WHERE id = $1`, [id], db);
    const params = cols.map((c) => d[c]);
    params.push(id);
    return queryOne<{ id: number }>(
      `UPDATE task_executions SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')}
       WHERE id = $${params.length} RETURNING id`,
      params,
      db,
    );
  },

  remove: (id: number) => queryOne<{ id: number }>(`DELETE FROM task_executions WHERE id = $1 RETURNING id`, [id]),

  upsertValues: async (
    id: number,
    values: { metric_id: number; planned_value?: number | null; actual_value?: number | null }[],
    db: Queryable,
  ) => {
    for (const v of values) {
      await query(
        `INSERT INTO task_execution_values (task_execution_id, metric_id, planned_value, actual_value)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (task_execution_id, metric_id)
         DO UPDATE SET planned_value = EXCLUDED.planned_value, actual_value = EXCLUDED.actual_value`,
        [id, v.metric_id, v.planned_value ?? null, v.actual_value ?? null],
        db,
      );
    }
  },

  copyDefaultValues: (id: number, standardTaskId: number, db: Queryable) =>
    query(
      `INSERT INTO task_execution_values (task_execution_id, metric_id, planned_value)
       SELECT $1, metric_id, default_value FROM standard_task_metrics WHERE standard_task_id = $2
       ON CONFLICT DO NOTHING`,
      [id, standardTaskId],
      db,
    ),

  /** Otras ejecuciones (no canceladas) que se solapan para el mismo equipo u operador */
  findOverlaps: (
    p: { id?: number; equipment_id: number; operator_id: number | null; start: Date; end: Date },
    db?: Queryable,
  ) =>
    query<{ id: number; kind: 'equipment' | 'operator'; task_name: string; equipment_code: string; operator_name: string | null; planned_start: Date; planned_end: Date }>(
      `SELECT v.id, CASE WHEN v.equipment_id = $2 THEN 'equipment' ELSE 'operator' END AS kind,
              v.task_name, v.equipment_code, v.operator_name, v.planned_start, v.planned_end
       FROM v_task_executions v
       WHERE v.id <> coalesce($1, 0) AND v.status <> 'cancelada'
         AND v.planned_start < $5 AND v.planned_end > $4
         AND (v.equipment_id = $2 OR ($3::int IS NOT NULL AND v.operator_id = $3))
       ORDER BY v.planned_start LIMIT 10`,
      [p.id ?? null, p.equipment_id, p.operator_id, p.start, p.end],
      db,
    ),
};
