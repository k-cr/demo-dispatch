import { withTransaction } from '../database/pool.js';
import { ChecklistModel } from '../models/checklist.model.js';
import { TaskExecutionModel } from '../models/taskExecution.model.js';
import { notFound } from '../middleware/errors.js';
import type { ChecklistInput, ExecutionChecklistInput } from '../validators/checklist.validator.js';

type ItemRow = { result: string | null; required: boolean };

function withProgress<T extends { items: ItemRow[] }>(c: T) {
  const total = c.items.length;
  const answered = c.items.filter((i) => i.result).length;
  const failed = c.items.filter((i) => i.result === 'no_ok').length;
  return { ...c, progress: { total, answered, failed, percent: total ? Math.round((answered / total) * 100) : 0 } };
}

export const ChecklistService = {
  list: (active?: boolean) => ChecklistModel.list(active),

  async get(id: number) {
    const row = await ChecklistModel.get(id);
    if (!row) throw notFound('Checklist');
    return row;
  },

  create: (input: ChecklistInput & { name: string }) =>
    withTransaction(async (db) => {
      const { id } = (await ChecklistModel.insert({ ...input, active: input.active ?? true }, db))!;
      await ChecklistModel.syncItems(id, input.items ?? [], db);
      if (input.standard_task_ids) await ChecklistModel.setStandardTasks(id, input.standard_task_ids, db);
      return ChecklistModel.get(id, db);
    }),

  update: (id: number, input: ChecklistInput) =>
    withTransaction(async (db) => {
      const { items, standard_task_ids, ...fields } = input;
      const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
      const row = await ChecklistModel.update(id, patch, db);
      if (!row) throw notFound('Checklist');
      if (items) await ChecklistModel.syncItems(id, items, db);
      if (standard_task_ids) await ChecklistModel.setStandardTasks(id, standard_task_ids, db);
      return ChecklistModel.get(id, db);
    }),

  async forExecution(taskExecutionId: number) {
    const exec = await TaskExecutionModel.getRaw(taskExecutionId);
    if (!exec) throw notFound('Ejecución de tarea');
    const rows = (await ChecklistModel.forExecution(taskExecutionId)) as { items: ItemRow[] }[];
    return { task_execution_id: taskExecutionId, checklists: rows.map(withProgress) };
  },

  async saveForExecution(taskExecutionId: number, input: ExecutionChecklistInput) {
    const exec = await TaskExecutionModel.getRaw(taskExecutionId);
    if (!exec) throw notFound('Ejecución de tarea');
    const checklist = await ChecklistModel.get(input.checklist_id);
    if (!checklist) throw notFound('Checklist');

    await withTransaction(async (db) => {
      const ce = (await ChecklistModel.upsertExecution(
        taskExecutionId, input.checklist_id, input.status ?? 'en_progreso', input.operator_id ?? exec.operator_id, db,
      ))!;
      await ChecklistModel.upsertExecutionItems(ce.id, input.items, db);

      if (!input.status) {
        // Estado automático según los ítems obligatorios respondidos
        const p = (await ChecklistModel.executionProgress(ce.id, db))!;
        const auto = p.answered_required === 0 ? 'pendiente'
          : p.answered_required >= p.total_required ? 'completado' : 'en_progreso';
        await ChecklistModel.upsertExecution(taskExecutionId, input.checklist_id, auto, null, db);
      }
      // Fuerza un evento de cambio para que otros clientes refresquen el bloque
      await TaskExecutionModel.update(taskExecutionId, { updated_by: exec.updated_by ?? 'dispatch-ui' }, db);
    });
    return this.forExecution(taskExecutionId);
  },
};
