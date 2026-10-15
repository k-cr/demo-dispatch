import { query } from '../database/pool.js';

/** Acceso a datos de catálogos maestros (solo lectura desde Dispatch). */

export const ProjectModel = {
  list: () =>
    query(
      `SELECT p.id, p.external_id, p.code, p.name, p.status, p.timezone,
              (SELECT count(*) FROM equipment e WHERE e.project_id = p.id AND e.active) AS equipment_count
       FROM projects p ORDER BY p.name`,
    ),
};

export const LocationModel = {
  list: (projectId?: number) =>
    query(
      `SELECT id, project_id, parent_id, code, name, type, active, sort_order, path, depth
       FROM v_locations
       WHERE ($1::int IS NULL OR project_id = $1) AND active
       ORDER BY project_id, path`,
      [projectId ?? null],
    ),
};

export const EquipmentTypeModel = {
  list: () => query(`SELECT id, external_id, name, category, sort_order FROM equipment_types ORDER BY sort_order, name`),
};

export interface EquipmentFilter {
  project_id?: number;
  equipment_type_id?: number;
  equipment_id?: number;
  ids?: number[];
}

export const EquipmentModel = {
  list: (f: EquipmentFilter = {}) =>
    query(
      `SELECT e.id, e.external_id, e.code, e.name, e.brand, e.model, e.status, e.capacity_t, e.capacity_m3,
              e.project_id, p.name AS project_name,
              e.equipment_type_id, et.name AS equipment_type_name, et.category AS equipment_category,
              et.sort_order AS type_sort
       FROM equipment e
       JOIN equipment_types et ON et.id = e.equipment_type_id
       LEFT JOIN projects p    ON p.id  = e.project_id
       WHERE e.active
         AND ($1::int   IS NULL OR e.project_id = $1)
         AND ($2::int   IS NULL OR e.equipment_type_id = $2)
         AND ($3::int   IS NULL OR e.id = $3)
         AND ($4::int[] IS NULL OR e.id = ANY($4))
       ORDER BY et.sort_order, e.code`,
      [f.project_id ?? null, f.equipment_type_id ?? null, f.equipment_id ?? null, f.ids ?? null],
    ),
  get: (id: number) =>
    query(`SELECT id, project_id, equipment_type_id, code, status FROM equipment WHERE id = $1`, [id]).then((r) => r[0] ?? null),
};

export const OperatorModel = {
  list: (projectId?: number, search?: string) =>
    query(
      `SELECT o.id, o.external_user_id, o.employee_code, o.first_name, o.last_name, o.full_name, o.status,
              o.project_id, p.name AS project_name
       FROM operators o LEFT JOIN projects p ON p.id = o.project_id
       WHERE ($1::int IS NULL OR o.project_id = $1)
         AND ($2::text IS NULL OR o.full_name ILIKE '%' || $2 || '%' OR o.employee_code ILIKE '%' || $2 || '%')
       ORDER BY o.last_name, o.first_name`,
      [projectId ?? null, search ?? null],
    ),
};

export const ShiftModel = {
  list: () =>
    query(
      `SELECT id, code, name, to_char(start_time, 'HH24:MI') AS start_time, to_char(end_time, 'HH24:MI') AS end_time,
              color, sort_order
       FROM shifts WHERE active ORDER BY sort_order`,
    ),
};

export const LookupModel = {
  categories: () => query(`SELECT id, code, name, color, icon, sort_order FROM task_categories ORDER BY sort_order`),
  metrics: () => query(`SELECT id, code, name, unit, sort_order FROM metrics ORDER BY sort_order`),
  statuses: () => query(`SELECT code, label, color, icon, is_terminal, sort_order FROM execution_statuses ORDER BY sort_order`),
};
