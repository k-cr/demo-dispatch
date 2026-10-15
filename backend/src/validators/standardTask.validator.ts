import { z } from 'zod';

export const TASK_TYPES = ['productiva', 'soporte', 'inspeccion', 'mantenimiento', 'demora'] as const;

// Campos sin valores por defecto: la actualización parcial no debe pisar lo existente
const base = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(120),
  category_id: z.number().int().positive(),
  task_type: z.enum(TASK_TYPES),
  standard_duration_min: z.number().int().positive().max(24 * 60),
  description: z.string().max(2000).nullish(),
  required_equipment_type_id: z.number().int().positive().nullish(),
  requires_operator: z.boolean(),
  active: z.boolean(),
  sort_order: z.number().int(),
  checklist_ids: z.array(z.number().int().positive()).optional(),
  metrics: z
    .array(z.object({ metric_id: z.number().int().positive(), default_value: z.number().nullish() }))
    .optional(),
});

export const standardTaskSchema = base.extend({
  task_type: base.shape.task_type.default('productiva'),
  requires_operator: base.shape.requires_operator.default(true),
  active: base.shape.active.default(true),
  sort_order: base.shape.sort_order.default(0),
});

export const standardTaskUpdateSchema = base.partial();

export type StandardTaskInput = z.infer<typeof standardTaskSchema>;
