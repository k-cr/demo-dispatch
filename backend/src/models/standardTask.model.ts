import { query, queryOne, type Queryable } from '../database/pool.js';
import type { StandardTaskInput } from '../validators/standardTask.validator.js';

const SELECT = `
  SELECT st.id, st.code, st.name, st.category_id, tc.code AS category_code, tc.name AS category_name,
         tc.color AS category_color, st.task_type, st.standard_duration_min, st.description,
         st.required_equipment_type_id, et.name AS required_equipment_type_name,
         st.requires_operator, st.active, st.sort_order, st.updated_at,
         coalesce((SELECT array_agg(tk.checklist_id ORDER BY tk.checklist_id)
                   FROM task_checklists tk WHERE tk.standard_task_id = st.id), '{}') AS checklist_ids,
         coalesce((SELECT json_agg(json_build_object('metric_id', m.id, 'code', m.code, 'name', m.name,
                                                     'unit', m.unit, 'default_value', stm.default_value)
                                   ORDER BY m.sort_order)
                   FROM standard_task_metrics stm JOIN metrics m ON m.id = stm.metric_id
                   WHERE stm.standard_task_id = st.id), '[]') AS metrics
  FROM standard_tasks st
  JOIN task_categories tc      ON tc.id = st.category_id
  LEFT JOIN equipment_types et ON et.id = st.required_equipment_type_id`;

export const StandardTaskModel = {
  list: (opts: { active?: boolean; category_id?: number } = {}) =>
    query(
      `${SELECT}
       WHERE ($1::boolean IS NULL OR st.active = $1) AND ($2::int IS NULL OR st.category_id = $2)
       ORDER BY tc.sort_order, st.sort_order, st.code`,
      [opts.active ?? null, opts.category_id ?? null],
    ),

  get: (id: number, db?: Queryable) => queryOne(`${SELECT} WHERE st.id = $1`, [id], db),

  insert: (d: StandardTaskInput, db: Queryable) =>
    queryOne<{ id: number }>(
      `INSERT INTO standard_tasks (code, name, category_id, task_type, standard_duration_min, description,
                                   required_equipment_type_id, requires_operator, active, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [d.code, d.name, d.category_id, d.task_type, d.standard_duration_min, d.description ?? null,
       d.required_equipment_type_id ?? null, d.requires_operator, d.active, d.sort_order],
      db,
    ),

  update: (id: number, d: Partial<StandardTaskInput>, db: Queryable) => {
    const cols = ['code', 'name', 'category_id', 'task_type', 'standard_duration_min', 'description',
                  'required_equipment_type_id', 'requires_operator', 'active', 'sort_order'] as const;
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const c of cols) {
      if (d[c] !== undefined) {
        params.push(d[c]);
        sets.push(`${c} = $${params.length}`);
      }
    }
    if (sets.length === 0) return queryOne<{ id: number }>(`SELECT id FROM standard_tasks WHERE id = $1`, [id], db);
    params.push(id);
    return queryOne<{ id: number }>(
      `UPDATE standard_tasks SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING id`, params, db);
  },

  setChecklists: async (id: number, checklistIds: number[], db: Queryable) => {
    await query(`DELETE FROM task_checklists WHERE standard_task_id = $1`, [id], db);
    if (checklistIds.length)
      await query(
        `INSERT INTO task_checklists (standard_task_id, checklist_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING`,
        [id, checklistIds], db);
  },

  setMetrics: async (id: number, metrics: { metric_id: number; default_value?: number | null }[], db: Queryable) => {
    await query(`DELETE FROM standard_task_metrics WHERE standard_task_id = $1`, [id], db);
    for (const m of metrics)
      await query(
        `INSERT INTO standard_task_metrics (standard_task_id, metric_id, default_value) VALUES ($1,$2,$3)`,
        [id, m.metric_id, m.default_value ?? null], db);
  },
};
