import { z } from 'zod';

const itemSchema = z.object({
  id: z.number().int().positive().optional(),
  section: z.string().trim().max(120).nullish(),
  description: z.string().trim().min(1).max(250),
  sort_order: z.number().int().optional(),
  required: z.boolean().optional(),
});

const base = z.object({
  code: z.string().trim().max(30).nullish(),
  name: z.string().trim().min(1).max(150),
  description: z.string().max(2000).nullish(),
  equipment_type_id: z.number().int().positive().nullish(),
  active: z.boolean(),
  items: z.array(itemSchema),
  /** Tareas estándar a las que se vincula el checklist */
  standard_task_ids: z.array(z.number().int().positive()).optional(),
});

export const checklistSchema = base.extend({
  active: base.shape.active.default(true),
  items: base.shape.items.default([]),
});
export const checklistUpdateSchema = base.partial();

export type ChecklistInput = z.infer<typeof checklistUpdateSchema>;

export const executionChecklistSchema = z.object({
  checklist_id: z.number().int().positive(),
  items: z
    .array(
      z.object({
        checklist_item_id: z.number().int().positive(),
        result: z.enum(['ok', 'no_ok', 'na']).nullable(),
        observation: z.string().max(1000).nullish(),
      }),
    )
    .default([]),
  /** Si se omite se calcula según los ítems respondidos */
  status: z.enum(['pendiente', 'en_progreso', 'completado', 'rechazado']).optional(),
  operator_id: z.number().int().positive().nullish(),
});

export type ExecutionChecklistInput = z.infer<typeof executionChecklistSchema>;
