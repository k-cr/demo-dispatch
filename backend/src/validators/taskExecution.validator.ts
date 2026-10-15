import { z } from 'zod';

export const EXECUTION_STATUSES = [
  'planificada',
  'en_ejecucion',
  'finalizada',
  'demorada',
  'detenida',
  'cancelada',
] as const;

const id = z.number().int().positive();
const ts = z.coerce.date();

const valueSchema = z.object({
  metric_id: id,
  planned_value: z.number().nullish(),
  actual_value: z.number().nullish(),
});

const base = z.object({
  standard_task_id: id,
  project_id: id,
  location_id: id.nullable(),
  equipment_id: id,
  operator_id: id.nullable(),
  shift_id: id.nullable(),
  planned_start: ts,
  planned_end: ts,
  /** Alternativa a planned_end: duración en minutos desde planned_start */
  duration_min: z.number().int().positive().max(14 * 24 * 60),
  actual_start: ts.nullable(),
  actual_end: ts.nullable(),
  status: z.enum(EXECUTION_STATUSES),
  cycle_number: z.number().int().nullable(),
  observations: z.string().max(4000).nullable(),
  values: z.array(valueSchema),
});

export const createExecutionSchema = base.partial().extend({
  standard_task_id: id,
  equipment_id: id,
  planned_start: ts,
});

export const updateExecutionSchema = base.partial().extend({
  /** Si se envía, el servidor rechaza la edición si el registro cambió (409) */
  version: z.number().int().positive().optional(),
});

export type CreateExecutionInput = z.infer<typeof createExecutionSchema>;
export type UpdateExecutionInput = z.infer<typeof updateExecutionSchema>;

const csvInts = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : v.split(',')).map(Number).filter((n) => Number.isInteger(n) && n > 0));

const csvStatuses = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : v.split(',')).filter(Boolean))
  .pipe(z.array(z.enum(EXECUTION_STATUSES)));

export const executionFilterSchema = z.object({
  from: ts.optional(),
  to: ts.optional(),
  project_id: z.coerce.number().int().positive().optional(),
  location_id: z.coerce.number().int().positive().optional(),
  equipment_id: z.coerce.number().int().positive().optional(),
  equipment_type_id: z.coerce.number().int().positive().optional(),
  operator_id: z.coerce.number().int().positive().optional(),
  shift_id: z.coerce.number().int().positive().optional(),
  standard_task_id: z.coerce.number().int().positive().optional(),
  category_id: z.coerce.number().int().positive().optional(),
  status: csvStatuses.optional(),
  ids: csvInts.optional(),
});

export type ExecutionFilter = z.infer<typeof executionFilterSchema>;

export const RANGE_MODES = ['shift', 'day', 'week', '2weeks', '4weeks'] as const;

export const timelineQuerySchema = executionFilterSchema.extend({
  /** Fecha operativa YYYY-MM-DD (por defecto: hoy en la zona horaria de la operación) */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  range: z.enum(RANGE_MODES).default('day'),
});

export type TimelineQuery = z.infer<typeof timelineQuerySchema>;
