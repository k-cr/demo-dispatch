import { withTransaction } from '../database/pool.js';
import { StandardTaskModel } from '../models/standardTask.model.js';
import { notFound } from '../middleware/errors.js';
import type { StandardTaskInput } from '../validators/standardTask.validator.js';

export const StandardTaskService = {
  list: (opts: { active?: boolean; category_id?: number }) => StandardTaskModel.list(opts),

  async get(id: number) {
    const row = await StandardTaskModel.get(id);
    if (!row) throw notFound('Tarea estándar');
    return row;
  },

  create: (input: StandardTaskInput) =>
    withTransaction(async (db) => {
      const { id } = (await StandardTaskModel.insert(input, db))!;
      if (input.checklist_ids) await StandardTaskModel.setChecklists(id, input.checklist_ids, db);
      if (input.metrics) await StandardTaskModel.setMetrics(id, input.metrics, db);
      return StandardTaskModel.get(id, db);
    }),

  update: (id: number, input: Partial<StandardTaskInput>) =>
    withTransaction(async (db) => {
      const row = await StandardTaskModel.update(id, input, db);
      if (!row) throw notFound('Tarea estándar');
      if (input.checklist_ids) await StandardTaskModel.setChecklists(id, input.checklist_ids, db);
      if (input.metrics) await StandardTaskModel.setMetrics(id, input.metrics, db);
      return StandardTaskModel.get(id, db);
    }),
};
