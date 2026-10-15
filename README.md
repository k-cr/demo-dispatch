# Dispatch: planificación de ciclos operativos

Dispatch es un módulo web para **planificar, editar y monitorear en tiempo real** las tareas estándar de los ciclos operativos mineros: carguío, perforación, acarreo, servicios auxiliares, inspección y mantenimiento.

Personalizado y adaptado para la identidad corporativa de **VR-Analytics (BI Solutions)**: colores oficiales `#d76800` (naranja vibrante de marca), `#a84300` (naranja oscuro / hover), `#fff3e8` (fondo sutil cálido / badges), blancos `#ffffff`, acento azul `#3563a9` y el logo oficial de 4 cuadrantes de VR-Analytics.

| Capa | Tecnología |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query y Zustand. El Gantt está desarrollado a medida, sin librerías externas. |
| Backend | Node.js, Express 5, TypeScript y Zod como API REST modular |
| Base de datos | PostgreSQL 14 o superior, en el esquema `dispatch`, con triggers `NOTIFY` para tiempo real |

---

## 1. Estructura

```
dispatch/
├── frontend/                 React + TS
│   └── src/
│       ├── components/
│       │   ├── gantt/        Gantt, TaskBlock, TimeHeader, EquipmentLabel, GanttTooltip
│       │   ├── sidebar/      Árbol de tareas estándar, Ubicación, Checklists y sus modales
│       │   ├── detail/       Detalle de tarea, Plan vs Real, Checklist de la ejecución
│       │   ├── layout/       Header, filtros, KPIs y leyenda
│       │   └── ui/           Button, Field, Select, Combobox (buscador), Modal, Toaster
│       ├── pages/            DispatchPage
│       ├── hooks/            useDispatchData (queries y mutaciones), useRealtimeChanges, useNow
│       ├── services/         Cliente HTTP y endpoints
│       ├── store/            Estado de la vista (Zustand) y notificaciones
│       ├── types/            Tipos compartidos
│       └── utils/            Zona horaria, turnos, carriles del Gantt, estilos por estado
├── backend/                  Express + TS
│   └── src/
│       ├── config/           Variables de entorno validadas
│       ├── controllers/      Capa HTTP
│       ├── routes/           Definición de endpoints
│       ├── services/         Lógica de negocio: rangos, turnos, estados, solapamientos
│       ├── models/           Acceso a datos (SQL parametrizado)
│       ├── validators/       Esquemas Zod
│       ├── middleware/       Errores y validación
│       ├── realtime/         Bus de eventos, LISTEN/NOTIFY y gateway (preparado para WebSocket)
│       └── database/         Pool pg y runner de scripts SQL
├── database/
│   ├── schema.sql            Esquema completo (tablas, vistas, triggers)
│   ├── seed.sql              Datos de prueba
│   ├── config/dispatch.config.json   Configuración de UI: zoom, rangos, polling
│   └── migrations/           Convención para migraciones futuras
├── docker-compose.yml        Stack completo (db, backend, frontend) para producción y Coolify
├── .env.example
├── .env.coolify.example      Variables de entorno listas para Coolify
├── COOLIFY.md                Guía paso a paso para despliegue en Coolify
└── README.md
```

> 🚀 **¿Despliegue en Coolify?** Consulte la guía completa en [COOLIFY.md](COOLIFY.md) para desplegar el stack completo en 1 clic.

---

## 2. Instalación y ejecución local

### Requisitos
- **Node.js 20 o superior**
- **PostgreSQL 14 o superior**. Puede instalarse con Docker o de forma nativa.

### 2.1 Variables de entorno
```bash
cp .env.example .env
```
Por defecto el backend se conecta a `postgres://dispatch:dispatch@localhost:5432/dispatch`.

### 2.2 Configurar PostgreSQL

**Opción 0: sin instalar nada (PostgreSQL embebido).** Usa binarios oficiales que se descargan con `npm install` y guarda los datos en `dispatch/.pgdata`. Deje esa terminal abierta:
```bash
npm run db:start             # PostgreSQL en el puerto de DATABASE_URL (5432)
```

**Opción A: Docker.** Crea la base y ejecuta `schema.sql` y `seed.sql` automáticamente:
```bash
docker compose up -d
```

**Opción B: PostgreSQL nativo (macOS con Homebrew)**
```bash
brew install postgresql@16
brew services start postgresql@16
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"   # postgresql@16 no se agrega al PATH solo
psql postgres -c "CREATE USER dispatch WITH PASSWORD 'dispatch' SUPERUSER;"
createdb -O dispatch dispatch
```

### 2.3 Instalar dependencias
```bash
npm run install:all          # equivale a: npm install en backend/ y en frontend/
```

### 2.4 Crear las tablas y cargar los datos de prueba
Desde la raíz del proyecto (no hace falta `psql`):
```bash
npm run db:reset             # ejecuta schema.sql + seed.sql
```
También puede hacerse con psql:
```bash
psql "$DATABASE_URL" -f database/schema.sql
psql "$DATABASE_URL" -f database/seed.sql
```
> Las ejecuciones de prueba se generan **en relación con la fecha y hora actual** (ayer, hoy y mañana, turnos día y noche). El Gantt siempre abre con el turno en curso y estados coherentes con la hora. Para "rejuvenecer" la demo, vuelva a ejecutar `npm run db:reset`.

### 2.5 Iniciar el backend
```bash
npm run dev:backend          # http://localhost:4000/api
```

### 2.6 Iniciar el frontend
```bash
npm run dev:frontend         # http://localhost:5173
```
Vite redirige `/api` hacia el backend, así que no hace falta configurar CORS en desarrollo.

### Producción
```bash
npm run build
node backend/dist/index.js              # API
# Servir frontend/dist con cualquier servidor estático (definir VITE_API_URL al compilar)
```

---

## 3. Funcionalidades

**Gantt operativo** (componente central)
- Las filas son los equipos, agrupados por tipo. Cada fila muestra el operador actual, el estado del equipo y su ocupación planificada.
- El encabezado tiene dos niveles: los turnos arriba (Día y Noche, con sombreado nocturno) y la escala horaria abajo.
- La **línea AHORA** es roja, se actualiza cada 15 s y su etiqueta queda fija al hacer scroll vertical. Si queda fuera de la vista aparece un botón "AHORA →" para volver a ella.
- **Bloques**: muestran tarea, equipo, operador y horario. El estado se indica con **color, ícono, patrón y etiqueta**, no solo con color: borde punteado para planificada, rayado para detenida y cancelada, texto tachado para cancelada.
- Debajo del bloque aparece una **barra de tiempo real**, con el inicio y fin real o hasta "ahora" si la tarea sigue en curso.
- **Alertas visuales**:
  - borde ámbar: debería estar en ejecución y no empezó;
  - icono rojo: la tarea en curso superó el fin planificado;
  - `!`: superposición con otra tarea del equipo.
- **Drag & drop**:
  - mover un bloque en horizontal cambia el horario;
  - moverlo en vertical cambia el equipo;
  - arrastrar sus bordes cambia la duración;
  - el ajuste se adapta al zoom (5, 15 o 60 min) y `Esc` cancela el arrastre;
  - los cambios se guardan con `PUT /api/task-executions/:id`, con actualización optimista y control de versión.
- **Crear tareas**:
  - arrastrar una tarea estándar desde el panel izquierdo hasta una fila; se sugieren el operador y la ubicación previos;
  - doble clic en un espacio vacío;
  - botón "Nueva tarea".
- **Zoom** por horas, día o semana. **Rangos** de turno, día, semana, 2 semanas o 4 semanas, con botones de anterior, hoy y siguiente.

**Panel izquierdo**
- *Tareas*: árbol "Ciclo Operativo → Categoría → Tarea" que se expande y contrae, con buscador y filtro rápido por tarea o categoría. Permite editar y crear tareas estándar con estos campos: nombre, código, tipo, duración, categoría, equipo requerido, operador requerido, estado, checklists y magnitudes.
- *Ubicación*: selección encadenada Proyecto → Zona → Frente → Nivel, con conteo de tareas y equipos trabajando por frente.
- *Checklists*: alta y edición de checklists, sus ítems (sección, orden, obligatorio) y la vinculación con tareas estándar.

**Detalle de tarea** (panel derecho)
- *Detalle*: tarea, equipo, operador (buscador), fecha, inicio, fin, duración, estado, ubicación y observaciones. Muestra advertencias de solapamiento de equipo u operador.
- *Acciones rápidas*:
  - Iniciar, Detener, Reanudar, Finalizar, Demorada, Cancelar y Reabrir;
  - registran automáticamente el inicio y fin reales.
- *Plan vs Real*: inicio, fin, duración, distancia, producción, agua y combustible, con su desvío.
- *Checklist*: respuestas OK, NO OK o N/A por ítem, observación en los hallazgos y porcentaje de avance. Permite asociar checklists adicionales.

**Filtros**: proyecto, ubicación, frente, equipo, tipo de equipo, operador, turno, estado, tarea y fecha. Se aplican en el servidor y el Gantt se actualiza sin recargar la página.

**Indicadores**: conteo por estado (también sirve como filtro), cumplimiento del plan, puntualidad de inicio, tareas sin iniciar y tareas que exceden el plan.

---

## 4. API REST

Base: `http://localhost:4000/api`. Los errores siguen el formato `{ "error": { code, message, details } }`.

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado de la API y de la base de datos |
| GET | `/projects` | Proyectos |
| GET | `/locations?project_id=` | Ubicaciones con jerarquía (`path`, `depth`) |
| GET | `/equipment?project_id=&equipment_type_id=` | Equipos |
| GET | `/equipment-types` | Tipos de equipo |
| GET | `/operators?project_id=&q=` | Operadores (búsqueda por nombre o legajo) |
| GET | `/shifts` | Turnos |
| GET | `/task-categories`, `/metrics` | Catálogos |
| GET / POST | `/standard-tasks` | Listar y crear tareas estándar (`checklist_ids`, `metrics`) |
| GET / PUT | `/standard-tasks/:id` | Ver y editar una tarea estándar |
| GET | `/task-executions?from=&to=&...filtros` | Ejecuciones |
| POST | `/task-executions` | Crear. Acepta `duration_min`; calcula turno y proyecto automáticamente |
| GET / PUT / DELETE | `/task-executions/:id` | Ver, editar (parcial) y eliminar |
| GET / PUT | `/task-executions/:id/checklist` | Resultado del checklist de una ejecución |
| GET / POST | `/checklists` | Listar y crear checklists con `items` y `standard_task_ids` |
| GET / PUT | `/checklists/:id` | Ver y editar un checklist |
| GET | `/dispatch/timeline` | **Vista Gantt** (ver abajo) |
| GET | `/dispatch/config` | Estados, turnos, categorías, magnitudes y configuración de UI |
| GET | `/dispatch/changes?since=<id>` | Eventos de cambio (polling) |

### `GET /api/dispatch/timeline`
| Parámetro | Ejemplo | Notas |
|---|---|---|
| `date` | `2026-10-04` | Fecha operativa. Por defecto, hoy. |
| `range` | `shift` · `day` · `week` · `2weeks` · `4weeks` | La jornada empieza con el primer turno (07:00) |
| `from`, `to` | ISO 8601 | Rango explícito (reemplaza `date` y `range`) |
| `shift_id` | `1` | Con `range=shift` define la ventana; en otros rangos filtra |
| `project_id`, `location_id` | | `location_id` incluye las sububicaciones |
| `equipment_id`, `equipment_type_id`, `operator_id` | | |
| `status` | `en_ejecucion,demorada` | Lista separada por comas |
| `standard_task_id`, `category_id` | | |

La respuesta tiene esta forma: `{ range, serverTime, lastEventId, equipment[], executions[], summary }`.

### Concurrencia
Cada ejecución tiene un número de `version`. Si `PUT` incluye `version` y el registro cambió mientras tanto, responde **409 `version_conflict`** con la versión actual. Esto evita que dos despachadores se pisen los cambios.

### Advertencias
`POST` y `PUT` de ejecuciones devuelven `{ data, warnings[] }`. Las advertencias cubren solapamiento de equipo, solapamiento de operador, tipo de equipo incompatible, operador faltante y equipo no operativo. No bloquean el guardado.

---

## 5. Modelo de datos (esquema `dispatch`)

```
projects ─┬─ locations (auto-referencia: zona → frente → nivel)
          ├─ equipment ── equipment_types
          └─ operators
shifts
task_categories ── standard_tasks ─┬─ task_checklists ── checklists ── checklist_items
                                   └─ standard_task_metrics ── metrics
task_executions ─┬─ task_execution_values (plan vs real por magnitud)
   (estado → execution_statuses)
                 └─ checklist_executions ── checklist_execution_items
dispatch_events (registro de cambios para tiempo real)
```

Cambios respecto de la especificación original:
- **Jerarquía de ubicaciones** con `parent_id`, que representa Proyecto → Zona → Frente → Nivel. La vista `v_locations` arma la ruta completa.
- `task_categories`, `execution_statuses` y `metrics` son **tablas de catálogo**. Así se pueden agregar estados o magnitudes sin tocar el código.
- Los valores planificados y reales se guardan en `task_execution_values` por magnitud (distancia, producción, etc.), en lugar de columnas fijas.
- La columna `order` se llama `sort_order`, porque `order` es palabra reservada.
- `version` sirve para control optimista; `created_by` y `updated_by` sirven para auditoría.
- Las columnas **`external_id`** guardan el ID del registro equivalente en *Gestión de Equipos* (`projects.id`, `equipment.id`, `users.id`, `form_templates.id`).
- Vistas: `v_task_executions` (ejecución con todos sus datos) y `v_task_execution_checklist_progress`.

---

## 6. Tiempo real

```
PostgreSQL ──trigger NOTIFY──▶ Backend (pgListener → eventBus) ──▶ [WebSocket futuro] ──▶ React Dispatch
     │
     └── tabla dispatch_events ◀── GET /api/dispatch/changes?since=<id>  (polling actual, cada 15 s)
```
- Cada INSERT, UPDATE o DELETE en `task_executions` registra un evento y emite `pg_notify('dispatch_events')`.
- El frontend consulta `/dispatch/changes` cada 15 s; si llegan eventos, refresca el timeline. Además hace un refresco completo cada 60 s.
- **Para migrar a WebSocket** hay que tocar dos archivos:
  - `backend/src/realtime/gateway.ts`, que incluye el ejemplo con `ws`;
  - `frontend/src/hooks/useRealtimeChanges.ts`.
  
  El resto del código no cambia.

---

## 7. Integración con Gestión de Equipos

- **Frontend**: `frontend/src/DispatchModule.tsx` exporta `<DispatchModule initialProjectCode="GUA" />`, que puede montarse como una ruta más del sistema, por ejemplo `/operations/dispatch`. Ya usa la misma paleta y tipografía.
- **Usuario**: el cliente envía el header `X-User`. El sistema principal puede definirlo con `window.__DISPATCH_USER__ = email`, y queda registrado en `created_by` y `updated_by`.
- **Datos maestros**: proyectos, equipos, operadores y checklists tienen `external_id`. Para sincronizarlos desde la API principal (`/api/projects`, `/api/equipment`, `/api/users` con rol `operario_carga`, `/api/form-templates`) basta con hacer un *upsert* por `external_id`.

---

## 8. Datos de prueba

Se tomaron del sistema *Gestión de Equipos*:

| Entidad | Contenido |
|---|---|
| Proyectos | **GUALCAMAYO** y **EQ, AUXILARES** |
| Ubicaciones | 14: Mina → Frente 01/02/03 → Nivel 1250/1280, Botadero Norte, Pad de Lixiviación, Caminos, Taller, NC1/NC2 |
| Equipos | 14 reales: volcadores 016/017/018/027/028/029-ALQ, cargadoras 042-ALQ y CF-36, EX-11, T-03, MO-06, CA-18, EX-06, CG-01 |
| Operadores | 21 usuarios reales con rol `operario_carga` |
| Turnos | Día 07:00–19:00 y Noche 19:00–07:00 |
| Tareas estándar | 19, en 7 categorías |
| Checklists | 6 plantillas reales "Check List Diario" (PD-001, 002, 004, 005, 06 y 007) con 160 ítems |
| Ejecuciones | Unas 700, entre ayer, hoy y mañana: ciclos completos de acarreo, carguío, riego, perfilado, mantenimiento preventivo y correctivo, colación y tronadura |
| Escenarios en el turno en curso | Un camión **demorado**, uno **detenido** por falla (con un correctivo planificado y sus ciclos cancelados) y un ciclo **cancelado** por tronadura |

> La flota actual no tiene perforadoras. Las tareas de **Perforación** existen en el catálogo, pero no tienen ejecuciones de prueba hasta que se registre una perforadora.

---

## 9. Notas
- **Zona horaria**: los rangos, turnos y etiquetas se calculan en `OPERATION_TIMEZONE` (`America/Argentina/San_Juan`), sin importar la zona horaria del navegador.
- Optimizado para escritorio (1366 px o más). En pantallas angostas el panel lateral se puede contraer.
