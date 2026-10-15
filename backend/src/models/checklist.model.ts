import { query, queryOne, type Queryable } from '../database/pool.js';

const SELECT = `
  SELECT c.id, c.external_id, c.code, c.name, c.description, c.equipment_type_id,
         et.name AS equipment_type_name, c.active, c.updated_at,
         coalesce((SELECT json_agg(json_build_object('id', ci.id, 'section', ci.section, 'description', ci.description,
                                                     'sort_order', ci.sort_order, 'required', ci.required)
                                   ORDER BY ci.sort_order, ci.id)
                   FROM checklist_items ci WHERE ci.checklist_id = c.id AND ci.active), '[]') AS items,
         coalesce((SELECT array_agg(tk.standard_task_id) FROM task_checklists tk WHERE tk.checklist_id = c.id), '{}')
           AS standard_task_ids
  FROM checklists c
  LEFT JOIN equipment_types et ON et.id = c.equipment_type_id`;

export const ChecklistModel = {
  list: (active?: boolean) =>
    query(`${SELECT} WHERE ($1::boolean IS NULL OR c.active = $1) ORDER BY c.name`, [active ?? null]),

  get: (id: number, db?: Queryable) => queryOne(`${SELECT} WHERE c.id = $1`, [id], db),

  insert: (d: { code?: string | null; name: string; description?: string | null; equipment_type_id?: number | null; active: boolean }, db: Queryable) =>
    queryOne<{ id: number }>(
      `INSERT INTO checklists (code, name, description, equipment_type_id, active) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [d.code ?? null, d.name, d.description ?? null, d.equipment_type_id ?? null, d.active],
      db,
    ),

  update: (id: number, d: Record<string, unknown>, db: Queryable) => {
    const cols = Object.keys(d);
    if (!cols.length) return queryOne<{ id: number }>(`SELECT id FROM checklists WHERE id = $1`, [id], db);
    const params = [...cols.map((c) => d[c]), id];
    return queryOne<{ id: number }>(
      `UPDATE checklists SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id = $${params.length} RETURNING id`,
      params,
      db,
    );
  },

  /**
   * Sincroniza ítems: actualiza los que traen id, inserta los nuevos y desactiva
   * (no borra) los omitidos para preservar resultados históricos.
   */
  syncItems: async (
    checklistId: number,
    items: { id?: number; section?: string | null; description: string; sort_order?: number; required?: boolean }[],
    db: Queryable,
  ) => {
    const keep: number[] = [];
    for (const [i, it] of items.entries()) {
      const order = it.sort_order ?? i + 1;
      if (it.id) {
        const row = await queryOne<{ id: number }>(
          `UPDATE checklist_items SET section = $1, description = $2, sort_order = $3, required = $4, active = true
           WHERE id = $5 AND checklist_id = $6 RETURNING id`,
          [it.section ?? null, it.description, order, it.required ?? true, it.id, checklistId],
          db,
        );
        if (row) keep.push(row.id);
      } else {
        const row = await queryOne<{ id: number }>(
          `INSERT INTO checklist_items (checklist_id, section, description, sort_order, required)
           VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [checklistId, it.section ?? null, it.description, order, it.required ?? true],
          db,
        );
        keep.push(row!.id);
      }
    }
    await query(
      `UPDATE checklist_items SET active = false WHERE checklist_id = $1 AND NOT (id = ANY($2::int[]))`,
      [checklistId, keep],
      db,
    );
  },

  setStandardTasks: async (checklistId: number, taskIds: number[], db: Queryable) => {
    await query(`DELETE FROM task_checklists WHERE checklist_id = $1`, [checklistId], db);
    if (taskIds.length)
      await query(
        `INSERT INTO task_checklists (standard_task_id, checklist_id) SELECT unnest($2::int[]), $1 ON CONFLICT DO NOTHING`,
        [checklistId, taskIds],
        db,
      );
  },

  // ---- Ejecuciones de checklist -------------------------------------------

  /** Checklists aplicables a una ejecución: vinculados a la tarea estándar o ya ejecutados */
  forExecution: (taskExecutionId: number) =>
    query(
      `WITH te AS (
         SELECT te.id, te.standard_task_id, e.equipment_type_id
         FROM task_executions te JOIN equipment e ON e.id = te.equipment_id WHERE te.id = $1
       ),
       linked AS (
         SELECT c.id, c.equipment_type_id FROM te
         JOIN task_checklists tk ON tk.standard_task_id = te.standard_task_id
         JOIN checklists c       ON c.id = tk.checklist_id AND c.active
       ),
       applicable AS (
         -- Si hay checklists del tipo de equipo, se usan solo esos
         SELECT l.id FROM linked l, te
         WHERE l.equipment_type_id = te.equipment_type_id
            OR l.equipment_type_id IS NULL
            OR NOT EXISTS (SELECT 1 FROM linked l2 WHERE l2.equipment_type_id = te.equipment_type_id)
         UNION
         SELECT ce.checklist_id FROM checklist_executions ce WHERE ce.task_execution_id = $1
       )
       SELECT c.id AS checklist_id, c.code, c.name, c.description,
              ce.id AS execution_id, coalesce(ce.status, 'pendiente') AS status, ce.completed_at, ce.operator_id,
              coalesce((SELECT json_agg(json_build_object(
                          'checklist_item_id', ci.id, 'section', ci.section, 'description', ci.description,
                          'required', ci.required, 'sort_order', ci.sort_order,
                          'result', cei.result, 'observation', cei.observation) ORDER BY ci.sort_order, ci.id)
                        FROM checklist_items ci
                        LEFT JOIN checklist_execution_items cei
                               ON cei.checklist_item_id = ci.id AND cei.checklist_execution_id = ce.id
                        WHERE ci.checklist_id = c.id AND ci.active), '[]') AS items
       FROM applicable a
       JOIN checklists c ON c.id = a.id
       LEFT JOIN checklist_executions ce ON ce.checklist_id = c.id AND ce.task_execution_id = $1
       ORDER BY c.name`,
      [taskExecutionId],
    ),

  upsertExecution: (
    taskExecutionId: number,
    checklistId: number,
    status: string,
    operatorId: number | null | undefined,
    db: Queryable,
  ) =>
    queryOne<{ id: number }>(
      `INSERT INTO checklist_executions (task_execution_id, checklist_id, status, operator_id, completed_at)
       VALUES ($1, $2, $3::varchar, $4, CASE WHEN $3::varchar = 'completado' THEN now() END)
       ON CONFLICT (task_execution_id, checklist_id) DO UPDATE
         SET status = EXCLUDED.status,
             operator_id = coalesce(EXCLUDED.operator_id, checklist_executions.operator_id),
             completed_at = CASE WHEN EXCLUDED.status = 'completado'
                                 THEN coalesce(checklist_executions.completed_at, now()) END
       RETURNING id`,
      [taskExecutionId, checklistId, status, operatorId ?? null],
      db,
    ),

  upsertExecutionItems: async (
    checklistExecutionId: number,
    items: { checklist_item_id: number; result: string | null; observation?: string | null }[],
    db: Queryable,
  ) => {
    for (const it of items) {
      await query(
        `INSERT INTO checklist_execution_items (checklist_execution_id, checklist_item_id, result, observation)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (checklist_execution_id, checklist_item_id)
         DO UPDATE SET result = EXCLUDED.result, observation = EXCLUDED.observation`,
        [checklistExecutionId, it.checklist_item_id, it.result, it.observation ?? null],
        db,
      );
    }
  },

  executionProgress: (checklistExecutionId: number, db: Queryable) =>
    queryOne<{ total_required: number; answered_required: number }>(
      `SELECT count(*) FILTER (WHERE ci.required) AS total_required,
              count(cei.id) FILTER (WHERE ci.required AND cei.result IS NOT NULL) AS answered_required
       FROM checklist_executions ce
       JOIN checklist_items ci ON ci.checklist_id = ce.checklist_id AND ci.active
       LEFT JOIN checklist_execution_items cei ON cei.checklist_execution_id = ce.id AND cei.checklist_item_id = ci.id
       WHERE ce.id = $1`,
      [checklistExecutionId],
      db,
    ),
};
