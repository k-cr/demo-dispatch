import { env } from '../config/env.js';
import { queryOne, withTransaction, type Queryable } from '../database/pool.js';
import { EquipmentModel } from '../models/catalog.model.js';
import { StandardTaskModel } from '../models/standardTask.model.js';
import { TaskExecutionModel, type ExecutionRow } from '../models/taskExecution.model.js';
import { HttpError, notFound } from '../middleware/errors.js';
import type {
  CreateExecutionInput,
  ExecutionFilter,
  UpdateExecutionInput,
} from '../validators/taskExecution.validator.js';

const MIN = 60_000;

export interface Warning {
  code: string;
  message: string;
}

/** Turno al que pertenece un instante (según hora local de la operación) */
async function resolveShiftId(at: Date, db?: Queryable): Promise<number | null> {
  const row = await queryOne<{ id: number }>(
    `SELECT id FROM shifts
     WHERE active AND (
       (end_time > start_time AND ($1::timestamptz AT TIME ZONE $2)::time >= start_time AND ($1::timestamptz AT TIME ZONE $2)::time < end_time)
       OR (end_time <= start_time AND (($1::timestamptz AT TIME ZONE $2)::time >= start_time OR ($1::timestamptz AT TIME ZONE $2)::time < end_time)))
     ORDER BY sort_order LIMIT 1`,
    [at, env.OPERATION_TIMEZONE],
    db,
  );
  return row?.id ?? null;
}

/** Completa tiempos reales al cambiar de estado (Iniciar / Finalizar) */
function applyStatusSideEffects(
  patch: Record<string, unknown>,
  current: Partial<ExecutionRow> | null,
  explicit: { actual_start?: unknown; actual_end?: unknown },
) {
  const status = patch.status as string | undefined;
  if (!status) return;
  const now = new Date();
  const actualStart = explicit.actual_start !== undefined ? explicit.actual_start : current?.actual_start ?? null;
  const actualEnd = explicit.actual_end !== undefined ? explicit.actual_end : current?.actual_end ?? null;

  if (['en_ejecucion', 'detenida'].includes(status) && !actualStart) patch.actual_start = now;
  if (status === 'en_ejecucion' && actualEnd && explicit.actual_end === undefined) patch.actual_end = null; // reanudar
  if (status === 'finalizada') {
    if (!actualStart) patch.actual_start = patch.planned_start ?? current?.planned_start ?? now;
    if (!actualEnd) patch.actual_end = now;
  }
  if (status === 'planificada' && explicit.actual_start === undefined && current?.status !== 'planificada') {
    patch.actual_start = null;
    patch.actual_end = null;
  }
}

async function buildWarnings(exec: ExecutionRow, db: Queryable): Promise<Warning[]> {
  const warnings: Warning[] = [];
  const [task, equipment, overlaps] = await Promise.all([
    StandardTaskModel.get(exec.standard_task_id, db),
    EquipmentModel.get(exec.equipment_id),
    exec.status === 'cancelada'
      ? Promise.resolve([])
      : TaskExecutionModel.findOverlaps(
          { id: exec.id, equipment_id: exec.equipment_id, operator_id: exec.operator_id, start: exec.planned_start, end: exec.planned_end },
          db,
        ),
  ]);

  if (task?.required_equipment_type_id && equipment && task.required_equipment_type_id !== equipment.equipment_type_id)
    warnings.push({ code: 'equipment_type_mismatch', message: `La tarea requiere equipo tipo "${task.required_equipment_type_name}"` });
  if (task?.requires_operator && !exec.operator_id && exec.status !== 'cancelada')
    warnings.push({ code: 'operator_required', message: 'La tarea requiere un operador asignado' });
  if (equipment && equipment.status !== 'operativo')
    warnings.push({ code: 'equipment_not_operational', message: `El equipo ${equipment.code} está en estado "${equipment.status}"` });

  const fmt = (d: Date) => new Date(d).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: env.OPERATION_TIMEZONE });
  for (const o of overlaps) {
    warnings.push(
      o.kind === 'equipment'
        ? { code: 'equipment_overlap', message: `${o.equipment_code} ya tiene "${o.task_name}" ${fmt(o.planned_start)}–${fmt(o.planned_end)}` }
        : { code: 'operator_overlap', message: `${o.operator_name} está asignado a ${o.equipment_code} (${o.task_name}) ${fmt(o.planned_start)}–${fmt(o.planned_end)}` },
    );
  }
  return warnings;
}

export const TaskExecutionService = {
  list: (f: ExecutionFilter) => TaskExecutionModel.list(f),

  async get(id: number) {
    const row = await TaskExecutionModel.get(id);
    if (!row) throw notFound('Ejecución de tarea');
    return row;
  },

  async create(input: CreateExecutionInput, actor: string) {
    return withTransaction(async (db) => {
      const task = await StandardTaskModel.get(input.standard_task_id, db);
      if (!task) throw new HttpError(400, 'invalid_standard_task', 'Tarea estándar inexistente');
      const equipment = await EquipmentModel.get(input.equipment_id);
      if (!equipment) throw new HttpError(400, 'invalid_equipment', 'Equipo inexistente');

      const start = input.planned_start;
      const end = input.planned_end ?? new Date(start.getTime() + (input.duration_min ?? task.standard_duration_min) * MIN);
      if (end <= start) throw new HttpError(400, 'invalid_range', 'El fin debe ser posterior al inicio');

      const projectId = input.project_id ?? equipment.project_id;
      if (!projectId) throw new HttpError(400, 'project_required', 'Indique el proyecto');

      const data: Record<string, unknown> = {
        standard_task_id: input.standard_task_id,
        project_id: projectId,
        location_id: input.location_id ?? null,
        equipment_id: input.equipment_id,
        operator_id: input.operator_id ?? null,
        shift_id: input.shift_id ?? (await resolveShiftId(start, db)),
        planned_start: start,
        planned_end: end,
        actual_start: input.actual_start ?? null,
        actual_end: input.actual_end ?? null,
        status: input.status ?? 'planificada',
        cycle_number: input.cycle_number ?? null,
        observations: input.observations ?? null,
        created_by: actor,
        updated_by: actor,
      };
      applyStatusSideEffects(data, null, { actual_start: input.actual_start, actual_end: input.actual_end });

      const { id } = (await TaskExecutionModel.insert(data, db))!;
      await TaskExecutionModel.copyDefaultValues(id, input.standard_task_id, db);
      if (input.values?.length) await TaskExecutionModel.upsertValues(id, input.values, db);

      const raw = (await TaskExecutionModel.getRaw(id, db))!;
      return { data: await TaskExecutionModel.get(id, db), warnings: await buildWarnings(raw, db) };
    });
  },

  async update(id: number, input: UpdateExecutionInput, actor: string) {
    return withTransaction(async (db) => {
      const current = await queryOne<ExecutionRow>(`SELECT * FROM task_executions WHERE id = $1 FOR UPDATE`, [id], db);
      if (!current) throw notFound('Ejecución de tarea');
      if (input.version && input.version !== current.version) {
        throw new HttpError(409, 'version_conflict', 'La tarea fue modificada por otro usuario. Se recargaron los datos.', {
          current: await TaskExecutionModel.get(id, db),
        });
      }

      const { values, version: _v, duration_min, ...fields } = input;
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) if (v !== undefined) patch[k] = v;

      // Duración → fin (si no se envió fin explícito)
      if (duration_min !== undefined && input.planned_end === undefined) {
        const start = (input.planned_start ?? current.planned_start) as Date;
        patch.planned_end = new Date(new Date(start).getTime() + duration_min * MIN);
      }
      const start = new Date((patch.planned_start ?? current.planned_start) as Date);
      const end = new Date((patch.planned_end ?? current.planned_end) as Date);
      if (end <= start) throw new HttpError(400, 'invalid_range', 'El fin debe ser posterior al inicio');

      if (input.planned_start !== undefined && input.shift_id === undefined) patch.shift_id = await resolveShiftId(start, db);

      if (input.equipment_id !== undefined && input.project_id === undefined) {
        const eq = await EquipmentModel.get(input.equipment_id);
        if (!eq) throw new HttpError(400, 'invalid_equipment', 'Equipo inexistente');
        if (eq.project_id) patch.project_id = eq.project_id;
      }

      applyStatusSideEffects(patch, current, { actual_start: input.actual_start, actual_end: input.actual_end });
      patch.updated_by = actor;

      await TaskExecutionModel.update(id, patch, db);
      if (values?.length) await TaskExecutionModel.upsertValues(id, values, db);

      const raw = (await TaskExecutionModel.getRaw(id, db))!;
      return { data: await TaskExecutionModel.get(id, db), warnings: await buildWarnings(raw, db) };
    });
  },

  async remove(id: number) {
    const row = await TaskExecutionModel.remove(id);
    if (!row) throw notFound('Ejecución de tarea');
    return { id };
  },
};
