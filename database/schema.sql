-- =============================================================================
--  DISPATCH · Esquema PostgreSQL
--  Módulo de planificación y monitoreo de ciclos operativos (VR-Analytics BI Solutions)
--
--  Idempotente: elimina y recrea el esquema "dispatch".
--  Uso:  psql "$DATABASE_URL" -f database/schema.sql
-- =============================================================================

DROP SCHEMA IF EXISTS dispatch CASCADE;
CREATE SCHEMA dispatch;
SET search_path TO dispatch, public;

-- -----------------------------------------------------------------------------
--  Funciones utilitarias
-- -----------------------------------------------------------------------------

-- Mantiene updated_at en cada UPDATE
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
--  CATÁLOGOS MAESTROS
--  Las columnas external_id referencian el ID del registro equivalente en el
--  sistema principal (Gestión de Equipos) para facilitar la integración.
-- =============================================================================

CREATE TABLE projects (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  external_id  integer UNIQUE,
  code         varchar(30)  NOT NULL UNIQUE,
  name         varchar(150) NOT NULL,
  status       varchar(20)  NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'inactive', 'closed')),
  timezone     varchar(60)  NOT NULL DEFAULT 'America/Argentina/San_Juan',
  created_at   timestamptz  NOT NULL DEFAULT now(),
  updated_at   timestamptz  NOT NULL DEFAULT now()
);

-- Jerarquía de ubicaciones: Zona → Frente → Nivel (auto-referencia)
CREATE TABLE locations (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id   integer      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id    integer      REFERENCES locations(id) ON DELETE CASCADE,
  external_id  integer,
  code         varchar(40)  NOT NULL UNIQUE,
  name         varchar(150) NOT NULL,
  type         varchar(20)  NOT NULL
               CHECK (type IN ('zona', 'frente', 'nivel', 'botadero', 'stock', 'camino', 'planta', 'taller', 'otro')),
  active       boolean      NOT NULL DEFAULT true,
  sort_order   integer      NOT NULL DEFAULT 0,
  created_at   timestamptz  NOT NULL DEFAULT now(),
  updated_at   timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX idx_locations_project ON locations(project_id);
CREATE INDEX idx_locations_parent  ON locations(parent_id);

CREATE TABLE equipment_types (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  external_id  integer UNIQUE,
  name         varchar(100) NOT NULL UNIQUE,
  -- Rol operativo del tipo de equipo dentro del ciclo
  category     varchar(30)  NOT NULL DEFAULT 'auxiliar'
               CHECK (category IN ('carguio', 'acarreo', 'perforacion', 'auxiliar', 'servicio', 'transporte')),
  sort_order   integer      NOT NULL DEFAULT 0
);

CREATE TABLE equipment (
  id                 integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  external_id        integer UNIQUE,
  project_id         integer      REFERENCES projects(id) ON DELETE SET NULL,
  equipment_type_id  integer      NOT NULL REFERENCES equipment_types(id),
  code               varchar(40)  NOT NULL UNIQUE,      -- número interno (ej. 016-ALQ)
  name               varchar(150) NOT NULL,
  brand              varchar(80),
  model              varchar(120),
  capacity_t         numeric(10,2),
  capacity_m3        numeric(10,2),
  status             varchar(20)  NOT NULL DEFAULT 'operativo'
                     CHECK (status IN ('operativo', 'mantenimiento', 'standby', 'fuera_servicio')),
  active             boolean      NOT NULL DEFAULT true,
  created_at         timestamptz  NOT NULL DEFAULT now(),
  updated_at         timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX idx_equipment_project ON equipment(project_id);
CREATE INDEX idx_equipment_type    ON equipment(equipment_type_id);

CREATE TABLE operators (
  id                integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  external_user_id  integer UNIQUE,                    -- users.id del sistema principal
  employee_code     varchar(30)  NOT NULL UNIQUE,
  first_name        varchar(80)  NOT NULL,
  last_name         varchar(80)  NOT NULL,
  full_name         varchar(170) GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  project_id        integer      REFERENCES projects(id) ON DELETE SET NULL,
  status            varchar(20)  NOT NULL DEFAULT 'activo'
                    CHECK (status IN ('activo', 'inactivo', 'licencia')),
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX idx_operators_project ON operators(project_id);

-- Turnos. Si end_time <= start_time, el turno cruza la medianoche.
CREATE TABLE shifts (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        varchar(20)  NOT NULL UNIQUE,
  name        varchar(60)  NOT NULL,
  start_time  time         NOT NULL,
  end_time    time         NOT NULL,
  color       varchar(9)   NOT NULL DEFAULT '#D76800',
  sort_order  integer      NOT NULL DEFAULT 0,
  active      boolean      NOT NULL DEFAULT true
);

-- =============================================================================
--  TAREAS ESTÁNDAR (catálogo del ciclo operativo)
-- =============================================================================

CREATE TABLE task_categories (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        varchar(20)  NOT NULL UNIQUE,
  name        varchar(80)  NOT NULL,
  color       varchar(9)   NOT NULL,
  icon        varchar(40)  NOT NULL DEFAULT 'circle',
  sort_order  integer      NOT NULL DEFAULT 0
);

CREATE TABLE standard_tasks (
  id                          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code                        varchar(30)  NOT NULL UNIQUE,
  name                        varchar(120) NOT NULL,
  category_id                 integer      NOT NULL REFERENCES task_categories(id),
  task_type                   varchar(20)  NOT NULL DEFAULT 'productiva'
                              CHECK (task_type IN ('productiva', 'soporte', 'inspeccion', 'mantenimiento', 'demora')),
  standard_duration_min       integer      NOT NULL CHECK (standard_duration_min > 0),
  description                 text,
  required_equipment_type_id  integer      REFERENCES equipment_types(id) ON DELETE SET NULL,
  requires_operator           boolean      NOT NULL DEFAULT true,
  active                      boolean      NOT NULL DEFAULT true,
  sort_order                  integer      NOT NULL DEFAULT 0,
  created_at                  timestamptz  NOT NULL DEFAULT now(),
  updated_at                  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX idx_standard_tasks_category ON standard_tasks(category_id);

-- Catálogo de magnitudes medibles (plan vs real)
CREATE TABLE metrics (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        varchar(30)  NOT NULL UNIQUE,
  name        varchar(80)  NOT NULL,
  unit        varchar(20)  NOT NULL,
  sort_order  integer      NOT NULL DEFAULT 0
);

-- Magnitudes que aplican por defecto a cada tarea estándar
CREATE TABLE standard_task_metrics (
  standard_task_id  integer NOT NULL REFERENCES standard_tasks(id) ON DELETE CASCADE,
  metric_id         integer NOT NULL REFERENCES metrics(id) ON DELETE CASCADE,
  default_value     numeric(12,3),
  PRIMARY KEY (standard_task_id, metric_id)
);

-- =============================================================================
--  CHECKLISTS
--  Tarea estándar → Checklist → Ítems
-- =============================================================================

CREATE TABLE checklists (
  id                 integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  external_id        integer UNIQUE,                   -- form_templates.id del sistema principal
  code               varchar(30)  UNIQUE,
  name               varchar(150) NOT NULL,
  description        text,
  equipment_type_id  integer      REFERENCES equipment_types(id) ON DELETE SET NULL,
  active             boolean      NOT NULL DEFAULT true,
  created_at         timestamptz  NOT NULL DEFAULT now(),
  updated_at         timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE checklist_items (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  checklist_id  integer      NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  section       varchar(120),
  description   varchar(250) NOT NULL,
  sort_order    integer      NOT NULL DEFAULT 0,         -- "order" en la especificación
  required      boolean      NOT NULL DEFAULT true,
  active        boolean      NOT NULL DEFAULT true
);
CREATE INDEX idx_checklist_items_checklist ON checklist_items(checklist_id, sort_order);

CREATE TABLE task_checklists (
  standard_task_id  integer NOT NULL REFERENCES standard_tasks(id) ON DELETE CASCADE,
  checklist_id      integer NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  PRIMARY KEY (standard_task_id, checklist_id)
);

-- =============================================================================
--  EJECUCIONES (lo que se ve en el Gantt)
-- =============================================================================

CREATE TABLE execution_statuses (
  code         varchar(20) PRIMARY KEY,
  label        varchar(40) NOT NULL,
  color        varchar(9)  NOT NULL,
  icon         varchar(40) NOT NULL,
  is_terminal  boolean     NOT NULL DEFAULT false,
  sort_order   integer     NOT NULL DEFAULT 0
);

CREATE TABLE task_executions (
  id                integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  standard_task_id  integer      NOT NULL REFERENCES standard_tasks(id),
  project_id        integer      NOT NULL REFERENCES projects(id),
  location_id       integer      REFERENCES locations(id) ON DELETE SET NULL,
  equipment_id      integer      NOT NULL REFERENCES equipment(id),
  operator_id       integer      REFERENCES operators(id) ON DELETE SET NULL,
  shift_id          integer      REFERENCES shifts(id),
  planned_start     timestamptz  NOT NULL,
  planned_end       timestamptz  NOT NULL,
  actual_start      timestamptz,
  actual_end        timestamptz,
  status            varchar(20)  NOT NULL DEFAULT 'planificada' REFERENCES execution_statuses(code),
  cycle_number      integer,                             -- n° de ciclo dentro del turno (opcional)
  observations      text,
  version           integer      NOT NULL DEFAULT 1,     -- control de concurrencia optimista
  created_by        varchar(120),
  updated_by        varchar(120),
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT chk_planned_range CHECK (planned_end > planned_start),
  CONSTRAINT chk_actual_range  CHECK (actual_end IS NULL OR actual_start IS NULL OR actual_end >= actual_start)
);
CREATE INDEX idx_task_exec_range     ON task_executions(planned_start, planned_end);
CREATE INDEX idx_task_exec_equipment ON task_executions(equipment_id, planned_start);
CREATE INDEX idx_task_exec_operator  ON task_executions(operator_id, planned_start);
CREATE INDEX idx_task_exec_project   ON task_executions(project_id, planned_start);
CREATE INDEX idx_task_exec_status    ON task_executions(status);

-- Valores planificados vs reales por magnitud (distancia, producción, ...)
CREATE TABLE task_execution_values (
  task_execution_id  integer NOT NULL REFERENCES task_executions(id) ON DELETE CASCADE,
  metric_id          integer NOT NULL REFERENCES metrics(id),
  planned_value      numeric(12,3),
  actual_value       numeric(12,3),
  PRIMARY KEY (task_execution_id, metric_id)
);

CREATE TABLE checklist_executions (
  id                 integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_execution_id  integer      NOT NULL REFERENCES task_executions(id) ON DELETE CASCADE,
  checklist_id       integer      NOT NULL REFERENCES checklists(id),
  status             varchar(20)  NOT NULL DEFAULT 'pendiente'
                     CHECK (status IN ('pendiente', 'en_progreso', 'completado', 'rechazado')),
  completed_at       timestamptz,
  operator_id        integer      REFERENCES operators(id) ON DELETE SET NULL,
  created_at         timestamptz  NOT NULL DEFAULT now(),
  updated_at         timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (task_execution_id, checklist_id)
);

CREATE TABLE checklist_execution_items (
  id                      integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  checklist_execution_id  integer      NOT NULL REFERENCES checklist_executions(id) ON DELETE CASCADE,
  checklist_item_id       integer      NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  result                  varchar(10)  CHECK (result IN ('ok', 'no_ok', 'na')),
  observation             text,
  UNIQUE (checklist_execution_id, checklist_item_id)
);

-- =============================================================================
--  EVENTOS (tiempo real)
--  Cada cambio en task_executions genera un evento y un NOTIFY. Hoy el frontend
--  consulta /api/dispatch/changes (polling); a futuro el backend reenvía el
--  NOTIFY por WebSocket sin cambiar el modelo.
-- =============================================================================

CREATE TABLE dispatch_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity      varchar(40)  NOT NULL,
  entity_id   integer      NOT NULL,
  action      varchar(10)  NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  project_id  integer,
  payload     jsonb,
  created_at  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX idx_dispatch_events_created ON dispatch_events(created_at);

CREATE FUNCTION task_execution_bump_version() RETURNS trigger AS $$
BEGIN
  NEW.version    := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION notify_task_execution_change() RETURNS trigger AS $$
DECLARE
  rec  task_executions;
  evid bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN rec := OLD; ELSE rec := NEW; END IF;

  INSERT INTO dispatch_events (entity, entity_id, action, project_id, payload)
  VALUES ('task_execution', rec.id, lower(TG_OP), rec.project_id,
          jsonb_build_object('status', rec.status, 'equipment_id', rec.equipment_id, 'version', rec.version))
  RETURNING id INTO evid;

  PERFORM pg_notify('dispatch_events', json_build_object(
    'id', evid, 'entity', 'task_execution', 'entity_id', rec.id,
    'action', lower(TG_OP), 'project_id', rec.project_id)::text);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_task_exec_version BEFORE UPDATE ON task_executions
  FOR EACH ROW EXECUTE FUNCTION task_execution_bump_version();
CREATE TRIGGER trg_task_exec_notify AFTER INSERT OR UPDATE OR DELETE ON task_executions
  FOR EACH ROW EXECUTE FUNCTION notify_task_execution_change();

CREATE TRIGGER trg_projects_updated        BEFORE UPDATE ON projects        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_locations_updated       BEFORE UPDATE ON locations       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_equipment_updated       BEFORE UPDATE ON equipment       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_operators_updated       BEFORE UPDATE ON operators       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_standard_tasks_updated  BEFORE UPDATE ON standard_tasks  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_checklists_updated      BEFORE UPDATE ON checklists      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_checklist_exec_updated  BEFORE UPDATE ON checklist_executions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
--  VISTAS
-- =============================================================================

-- Ruta legible de cada ubicación ("Mina / Frente 03 / Nivel 1250")
CREATE VIEW v_locations AS
WITH RECURSIVE tree AS (
  SELECT l.id, l.project_id, l.parent_id, l.code, l.name, l.type, l.active, l.sort_order,
         l.name::text AS path, 0 AS depth, ARRAY[l.id] AS ancestors
  FROM locations l WHERE l.parent_id IS NULL
  UNION ALL
  SELECT c.id, c.project_id, c.parent_id, c.code, c.name, c.type, c.active, c.sort_order,
         t.path || ' / ' || c.name, t.depth + 1, t.ancestors || c.id
  FROM locations c JOIN tree t ON c.parent_id = t.id
)
SELECT * FROM tree;

-- Progreso de checklist por ejecución de tarea
CREATE VIEW v_task_execution_checklist_progress AS
SELECT ce.task_execution_id,
       count(DISTINCT ce.id)                                        AS checklist_count,
       count(cei.id) FILTER (WHERE cei.result IS NOT NULL)          AS answered_items,
       count(ci.id)                                                 AS total_items,
       count(cei.id) FILTER (WHERE cei.result = 'no_ok')            AS failed_items
FROM checklist_executions ce
JOIN checklist_items ci ON ci.checklist_id = ce.checklist_id AND ci.active
LEFT JOIN checklist_execution_items cei
       ON cei.checklist_execution_id = ce.id AND cei.checklist_item_id = ci.id
GROUP BY ce.task_execution_id;

-- Ejecución con todos los datos que necesita el Gantt / detalle
CREATE VIEW v_task_executions AS
SELECT te.*,
       st.code            AS task_code,
       st.name            AS task_name,
       st.task_type,
       st.standard_duration_min,
       tc.id              AS category_id,
       tc.code            AS category_code,
       tc.name            AS category_name,
       tc.color           AS category_color,
       e.code             AS equipment_code,
       e.name             AS equipment_name,
       e.equipment_type_id,
       et.name            AS equipment_type_name,
       o.full_name        AS operator_name,
       o.employee_code    AS operator_code,
       vl.name            AS location_name,
       vl.path            AS location_path,
       s.name             AS shift_name,
       p.name             AS project_name,
       (SELECT count(*) FROM task_checklists tk WHERE tk.standard_task_id = te.standard_task_id) AS linked_checklists,
       cp.answered_items  AS checklist_answered,
       cp.total_items     AS checklist_total,
       cp.failed_items    AS checklist_failed
FROM task_executions te
JOIN standard_tasks st   ON st.id = te.standard_task_id
JOIN task_categories tc  ON tc.id = st.category_id
JOIN equipment e         ON e.id  = te.equipment_id
JOIN equipment_types et  ON et.id = e.equipment_type_id
JOIN projects p          ON p.id  = te.project_id
LEFT JOIN operators o    ON o.id  = te.operator_id
LEFT JOIN v_locations vl ON vl.id = te.location_id
LEFT JOIN shifts s       ON s.id  = te.shift_id
LEFT JOIN v_task_execution_checklist_progress cp ON cp.task_execution_id = te.id;
