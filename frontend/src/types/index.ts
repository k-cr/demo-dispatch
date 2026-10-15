/** Tipos compartidos del módulo Dispatch (reflejan las respuestas de la API). */

export type ExecutionStatus = 'planificada' | 'en_ejecucion' | 'finalizada' | 'demorada' | 'detenida' | 'cancelada';
export type RangeMode = 'shift' | 'day' | 'week' | '2weeks' | '4weeks';
export type ZoomLevel = 'hours' | 'day' | 'week';
export type ChecklistResult = 'ok' | 'no_ok' | 'na';
export type TaskType = 'productiva' | 'soporte' | 'inspeccion' | 'mantenimiento' | 'demora';

export interface Project {
  id: number;
  external_id: number | null;
  code: string;
  name: string;
  status: string;
  timezone: string;
  equipment_count: number;
}

export interface Location {
  id: number;
  project_id: number;
  parent_id: number | null;
  code: string;
  name: string;
  type: string;
  path: string;
  depth: number;
}

export interface EquipmentType {
  id: number;
  name: string;
  category: string;
  sort_order: number;
}

export interface Equipment {
  id: number;
  external_id: number | null;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  status: 'operativo' | 'mantenimiento' | 'standby' | 'fuera_servicio';
  capacity_t: number | null;
  capacity_m3: number | null;
  project_id: number | null;
  project_name: string | null;
  equipment_type_id: number;
  equipment_type_name: string;
  equipment_category: string;
  type_sort: number;
}

export interface Operator {
  id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  full_name: string;
  status: string;
  project_id: number | null;
  project_name: string | null;
}

export interface Shift {
  id: number;
  code: string;
  name: string;
  start_time: string; // HH:MM
  end_time: string;
  color: string;
  sort_order: number;
}

export interface TaskCategory {
  id: number;
  code: string;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
}

export interface Metric {
  id: number;
  code: string;
  name: string;
  unit: string;
}

export interface StatusDef {
  code: ExecutionStatus;
  label: string;
  color: string;
  icon: string;
  is_terminal: boolean;
}

export interface ZoomDef {
  label: string;
  pxPerHour: number;
  snapMinutes: number;
  tickMinutes: number;
}

export interface DispatchConfig {
  module: { name: string; area: string; version: string };
  timezone: string;
  locale: string;
  realtime: { mode: string; changesPollSeconds: number; fullRefreshSeconds: number };
  timeline: {
    defaultRange: RangeMode;
    defaultZoom: ZoomLevel;
    zoomLevels: Record<ZoomLevel, ZoomDef>;
    ranges: Record<RangeMode, { label: string; days: number; defaultZoom: ZoomLevel }>;
    laneHeight: number;
    nowLineRefreshSeconds: number;
    lateToleranceMinutes: number;
  };
  ciclosOperativos: { rootLabel: string; categoryOrder: string[] };
  statuses: StatusDef[];
  shifts: Shift[];
  categories: TaskCategory[];
  metrics: Metric[];
  equipmentTypes: EquipmentType[];
}

export interface StandardTask {
  id: number;
  code: string;
  name: string;
  category_id: number;
  category_code: string;
  category_name: string;
  category_color: string;
  task_type: TaskType;
  standard_duration_min: number;
  description: string | null;
  required_equipment_type_id: number | null;
  required_equipment_type_name: string | null;
  requires_operator: boolean;
  active: boolean;
  sort_order: number;
  checklist_ids: number[];
  metrics: { metric_id: number; code: string; name: string; unit: string; default_value: number | null }[];
}

export interface ExecutionValue {
  metric_id: number;
  code: string;
  name: string;
  unit: string;
  planned_value: number | null;
  actual_value: number | null;
}

export interface TaskExecution {
  id: number;
  standard_task_id: number;
  task_code: string;
  task_name: string;
  task_type: TaskType;
  standard_duration_min: number;
  category_id: number;
  category_code: string;
  category_name: string;
  category_color: string;
  project_id: number;
  project_name: string;
  location_id: number | null;
  location_name: string | null;
  location_path: string | null;
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  equipment_type_id: number;
  equipment_type_name: string;
  operator_id: number | null;
  operator_name: string | null;
  operator_code: string | null;
  shift_id: number | null;
  shift_name: string | null;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  status: ExecutionStatus;
  cycle_number: number | null;
  observations: string | null;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  updated_at: string;
  linked_checklists: number;
  checklist_answered: number | null;
  checklist_total: number | null;
  checklist_failed: number | null;
  values: ExecutionValue[];
}

export interface TimelineSummary {
  total: number;
  byStatus: Partial<Record<ExecutionStatus, number>>;
  planCompliancePct: number | null;
  punctualityPct: number | null;
  durationDeviationPct: number | null;
  shouldBeRunning: number;
  overdue: number;
}

export interface TimelineResponse {
  range: { from: string; to: string; date: string; mode: RangeMode; shift_id: number | null };
  serverTime: string;
  lastEventId: number;
  equipment: Equipment[];
  executions: TaskExecution[];
  summary: TimelineSummary;
}

export interface Warning {
  code: string;
  message: string;
}

export interface MutationResult {
  data: TaskExecution;
  warnings: Warning[];
}

export interface ChecklistItem {
  id?: number;
  section: string | null;
  description: string;
  sort_order: number;
  required: boolean;
}

export interface Checklist {
  id: number;
  code: string | null;
  name: string;
  description: string | null;
  equipment_type_id: number | null;
  equipment_type_name: string | null;
  active: boolean;
  items: ChecklistItem[];
  standard_task_ids: number[];
}

export interface ExecutionChecklistItem {
  checklist_item_id: number;
  section: string | null;
  description: string;
  required: boolean;
  sort_order: number;
  result: ChecklistResult | null;
  observation: string | null;
}

export interface ExecutionChecklist {
  checklist_id: number;
  code: string | null;
  name: string;
  description: string | null;
  execution_id: number | null;
  status: 'pendiente' | 'en_progreso' | 'completado' | 'rechazado';
  completed_at: string | null;
  items: ExecutionChecklistItem[];
  progress: { total: number; answered: number; failed: number; percent: number };
}

export interface TimelineFilters {
  locationId: number | null;
  equipmentId: number | null;
  equipmentTypeId: number | null;
  operatorId: number | null;
  standardTaskId: number | null;
  categoryId: number | null;
  statuses: ExecutionStatus[];
}

/** Borrador para crear una ejecución desde el Gantt o el panel de tareas */
export interface ExecutionDraft {
  standard_task_id: number | null;
  equipment_id: number | null;
  operator_id: number | null;
  location_id: number | null;
  planned_start: string;
  planned_end: string;
}
