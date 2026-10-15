-- =============================================================================
--  DISPATCH · Datos de prueba
--
--  Datos maestros tomados del sistema Gestión de Equipos (MAPAL Sigma):
--  proyectos, equipos (número interno, tipo, marca), operadores (rol
--  operario_carga) y checklists diarios (plantillas PD-00x con sus ítems).
--  external_id = ID del registro en el sistema principal.
--
--  Las ejecuciones se generan RELATIVAS A LA FECHA ACTUAL (ayer, hoy, mañana)
--  y su estado se calcula según now(): el Gantt abre siempre con datos.
--  Para "refrescar" la demo basta volver a ejecutar schema.sql + seed.sql.
-- =============================================================================

SET search_path TO dispatch, public;

-- -----------------------------------------------------------------------------
--  Estados de ejecución
-- -----------------------------------------------------------------------------
INSERT INTO execution_statuses (code, label, color, icon, is_terminal, sort_order) VALUES
  ('planificada',  'Planificada',   '#64748B', 'calendar-clock', false, 1),
  ('en_ejecucion', 'En ejecución',  '#D76800', 'play',           false, 2),
  ('finalizada',   'Finalizada',    '#15803D', 'check-circle',   true,  3),
  ('demorada',     'Demorada',      '#D97706', 'alarm-clock',    false, 4),
  ('detenida',     'Detenida',      '#DC2626', 'octagon-pause',  false, 5),
  ('cancelada',    'Cancelada',     '#6B7280', 'ban',            true,  6);

-- -----------------------------------------------------------------------------
--  Turnos
-- -----------------------------------------------------------------------------
INSERT INTO shifts (code, name, start_time, end_time, color, sort_order) VALUES
  ('DIA',   'Turno Día',   '07:00', '19:00', '#F59E0B', 1),
  ('NOCHE', 'Turno Noche', '19:00', '07:00', '#334155', 2);

-- -----------------------------------------------------------------------------
--  Proyectos (sistema principal: projects.id 55 y 48)
-- -----------------------------------------------------------------------------
INSERT INTO projects (external_id, code, name, status) VALUES
  (55, 'GUA',   'GUALCAMAYO',    'active'),
  (48, 'EQAUX', 'EQ, AUXILARES', 'active');

-- -----------------------------------------------------------------------------
--  Ubicaciones (Zona → Frente → Nivel)
-- -----------------------------------------------------------------------------
INSERT INTO locations (project_id, parent_id, code, name, type, sort_order)
SELECT p.id, NULL, v.code, v.name, v.type, v.ord
FROM projects p, (VALUES
  ('GUA',   'GUA-MINA', 'Mina',                    'zona',     1),
  ('GUA',   'GUA-BOT',  'Botadero Norte',          'botadero', 2),
  ('GUA',   'GUA-PAD',  'Pad de Lixiviación',      'planta',   3),
  ('GUA',   'GUA-CAM',  'Caminos de acarreo',      'camino',   4),
  ('GUA',   'GUA-TAL',  'Taller de mantenimiento', 'taller',   5),
  ('EQAUX', 'AUX-MINA', 'EQ, AUXILARES MINA',      'zona',     1),
  ('EQAUX', 'AUX-PROC', 'EQ, AUXILARES PROC',      'planta',   2)
) AS v(project, code, name, type, ord)
WHERE p.code = v.project;

INSERT INTO locations (project_id, parent_id, code, name, type, sort_order)
SELECT parent.project_id, parent.id, v.code, v.name, v.type, v.ord
FROM locations parent, (VALUES
  ('GUA-MINA', 'GUA-MINA-F01', 'Frente 01', 'frente', 1),
  ('GUA-MINA', 'GUA-MINA-F02', 'Frente 02', 'frente', 2),
  ('GUA-MINA', 'GUA-MINA-F03', 'Frente 03', 'frente', 3),
  ('AUX-MINA', 'AUX-NC1',      'NC1',       'frente', 1),
  ('AUX-MINA', 'AUX-NC2',      'NC2',       'frente', 2)
) AS v(parent, code, name, type, ord)
WHERE parent.code = v.parent;

INSERT INTO locations (project_id, parent_id, code, name, type, sort_order)
SELECT parent.project_id, parent.id, v.code, v.name, 'nivel', v.ord
FROM locations parent, (VALUES
  ('GUA-MINA-F03', 'GUA-MINA-F03-N1250', 'Nivel 1250', 1),
  ('GUA-MINA-F03', 'GUA-MINA-F03-N1280', 'Nivel 1280', 2)
) AS v(parent, code, name, ord)
WHERE parent.code = v.parent;

-- -----------------------------------------------------------------------------
--  Tipos de equipo (sistema principal: equipment_types.id)
-- -----------------------------------------------------------------------------
INSERT INTO equipment_types (external_id, name, category, sort_order) VALUES
  (43,   'Cargador Frontal',       'carguio',     1),
  (46,   'Excavadora',             'carguio',     2),
  (41,   'Camión Volcador',        'acarreo',     3),
  (NULL, 'Perforadora',            'perforacion', 4),
  (61,   'Topadora',               'auxiliar',    5),
  (52,   'Motoniveladora',         'auxiliar',    6),
  (38,   'Camión Regador de Agua', 'servicio',    7);

-- -----------------------------------------------------------------------------
--  Equipos (sistema principal: equipment.id / internal_number)
-- -----------------------------------------------------------------------------
INSERT INTO equipment (external_id, project_id, equipment_type_id, code, name, brand, model, capacity_t, capacity_m3, status)
SELECT v.ext, p.id, et.id, v.code, v.name, v.brand, v.model, v.cap_t, v.cap_m3, v.status
FROM (VALUES
  (386, 'GUA',   'Cargador Frontal',       '042-ALQ', 'Cargadora Frontal P624',               'John Deere',  'P624',        NULL::numeric, 3.8::numeric, 'operativo'),
  (363, 'GUA',   'Cargador Frontal',       'CF-36',   'Cargadora Frontal XC958ZF',            'XCMG',        'XC958ZF',     NULL, 3.5, 'operativo'),
  (361, 'GUA',   'Excavadora',             'EX-11',   'Excavadora PC240',                     'Komatsu',     'PC240',       NULL, 1.4, 'operativo'),
  (365, 'GUA',   'Camión Volcador',        '016-ALQ', 'Volcador Sullair',                     'Sullair',     NULL,          20,   14,  'operativo'),
  (366, 'GUA',   'Camión Volcador',        '017-ALQ', 'Volcador Sullair',                     'Sullair',     NULL,          20,   14,  'operativo'),
  (367, 'GUA',   'Camión Volcador',        '018-ALQ', 'Volcador Sullair',                     'Sullair',     NULL,          20,   14,  'operativo'),
  (389, 'GUA',   'Camión Volcador',        '027-ALQ', 'Volcador Sullair',                     'Sullair',     NULL,          20,   14,  'operativo'),
  (375, 'GUA',   'Camión Volcador',        '028-ALQ', 'Volcador Sullair',                     'Sullair',     NULL,          20,   14,  'operativo'),
  (376, 'GUA',   'Camión Volcador',        '029-ALQ', 'Volcador Sullair',                     'Sullair',     NULL,          20,   14,  'standby'),
  (397, 'GUA',   'Topadora',               'T-03',    'Topadora Cat D8',                      'Caterpillar', 'D8',          NULL, NULL, 'operativo'),
  (395, 'GUA',   'Motoniveladora',         'MO-06',   'Motoniveladora Cat 140K',              'Caterpillar', '140K',        NULL, NULL, 'operativo'),
  (312, 'GUA',   'Camión Regador de Agua', 'CA-18',   'Regador Trakker 440',                  'Iveco',       'Trakker 440', NULL, 18,  'operativo'),
  (320, 'EQAUX', 'Excavadora',             'EX-06',   'Excavadora Komatsu PC 240 con balde',  'Komatsu',     'PC240',       NULL, 1.4, 'operativo'),
  (342, 'EQAUX', 'Cargador Frontal',       'CG-01',   'Cargadora Frontal CAT 938',            'Caterpillar', '938',         NULL, 3.0, 'operativo')
) AS v(ext, project, type, code, name, brand, model, cap_t, cap_m3, status)
JOIN projects p         ON p.code = v.project
JOIN equipment_types et ON et.name = v.type;

-- -----------------------------------------------------------------------------
--  Operadores (sistema principal: users con rol operario_carga)
-- -----------------------------------------------------------------------------
INSERT INTO operators (external_user_id, employee_code, first_name, last_name, project_id)
SELECT v.ext, 'OP-' || lpad(v.ext::text, 4, '0'), v.fn, v.ln, p.id
FROM (VALUES
  (103, 'Adrián',   'Salinas',    'GUA'), (110, 'Américo',  'Riveros',    'GUA'),
  (121, 'Andrés',   'Martínez',   'GUA'), (70,  'Cristian', 'Arias',      'GUA'),
  (86,  'Daniel',   'Pereyra',    'GUA'), (117, 'Dante',    'Sosa',       'GUA'),
  (104, 'David',    'Morales',    'GUA'), (116, 'Eduardo',  'Robledo',    'GUA'),
  (73,  'Emiliano', 'Moreno',     'GUA'), (118, 'Fabián',   'Ávila',      'GUA'),
  (76,  'Gabriel',  'Páez',       'GUA'), (109, 'Horacio',  'Vega',       'GUA'),
  (97,  'Javier',   'Ontiveros',  'GUA'), (71,  'Jorge',    'Balmaceda',  'GUA'),
  (119, 'Luis',     'Carena',     'GUA'), (98,  'Manuel',   'Millán',     'GUA'),
  (106, 'Marcelo',  'Giménez',    'GUA'), (101, 'Pablo',    'Amado',      'GUA'),
  (72,  'Raúl',     'Moreno',     'GUA'),
  (78,  'Mateo',    'Ibazeta',    'EQAUX'), (102, 'Oscar',  'Olmos',      'EQAUX')
) AS v(ext, fn, ln, project)
JOIN projects p ON p.code = v.project;

-- -----------------------------------------------------------------------------
--  Categorías del ciclo operativo
-- -----------------------------------------------------------------------------
INSERT INTO task_categories (code, name, color, icon, sort_order) VALUES
  ('CAR', 'Carguío',               '#D76800', 'shovel',         1),
  ('PER', 'Perforación',           '#7C3AED', 'drill',          2),
  ('ACA', 'Acarreo',               '#D97706', 'truck',          3),
  ('AUX', 'Servicios auxiliares',  '#0D9488', 'construction',   4),
  ('INS', 'Inspección y servicio', '#0891B2', 'clipboard-check',5),
  ('MAN', 'Mantenimiento',         '#475569', 'wrench',         6),
  ('DEM', 'Demoras operativas',    '#9CA3AF', 'coffee',         7);

-- -----------------------------------------------------------------------------
--  Magnitudes plan vs real
-- -----------------------------------------------------------------------------
INSERT INTO metrics (code, name, unit, sort_order) VALUES
  ('distance_km',   'Distancia',   'km', 1),
  ('production_t',  'Producción',  't',  2),
  ('water_m3',      'Agua regada', 'm³', 3),
  ('fuel_l',        'Combustible', 'L',  4);

-- -----------------------------------------------------------------------------
--  Tareas estándar
-- -----------------------------------------------------------------------------
INSERT INTO standard_tasks (code, name, category_id, task_type, standard_duration_min, description, required_equipment_type_id, requires_operator, sort_order)
SELECT v.code, v.name, c.id, v.type, v.dur, v.descr, et.id, v.req_op, v.ord
FROM (VALUES
  ('CAR-01', 'Cargar equipo',             'CAR', 'productiva',    40,  'Carguío de camiones en el frente de trabajo.',                       'Cargador Frontal',       true,  1),
  ('CAR-02', 'Traslado',                  'CAR', 'soporte',       20,  'Traslado del equipo de carguío entre frentes.',                      'Cargador Frontal',       true,  2),
  ('CAR-03', 'Descarga',                  'CAR', 'productiva',    15,  'Descarga de material en acopio (cargar y transportar).',             'Cargador Frontal',       true,  3),
  ('PER-01', 'Posicionamiento',           'PER', 'soporte',       10,  'Posicionamiento de la perforadora sobre el pozo.',                   'Perforadora',            true,  1),
  ('PER-02', 'Perforación',               'PER', 'productiva',    45,  'Perforación del pozo según malla.',                                  'Perforadora',            true,  2),
  ('PER-03', 'Retiro',                    'PER', 'soporte',       10,  'Retiro de barras y traslado al siguiente pozo.',                     'Perforadora',            true,  3),
  ('ACA-01', 'Carga',                     'ACA', 'productiva',    20,  'Camión en posición de carga bajo equipo de carguío.',                'Camión Volcador',        true,  1),
  ('ACA-02', 'Traslado cargado',          'ACA', 'productiva',    35,  'Transporte de material desde el frente al destino.',                 'Camión Volcador',        true,  2),
  ('ACA-03', 'Descarga',                  'ACA', 'productiva',    10,  'Descarga en botadero, pad o acopio.',                                'Camión Volcador',        true,  3),
  ('ACA-04', 'Retorno',                   'ACA', 'productiva',    30,  'Retorno vacío al frente de carguío.',                                'Camión Volcador',        true,  4),
  ('AUX-01', 'Riego de caminos',          'AUX', 'soporte',       120, 'Riego para control de polvo en caminos de acarreo.',                 'Camión Regador de Agua', true,  1),
  ('AUX-02', 'Perfilado de caminos',      'AUX', 'soporte',       180, 'Perfilado y mantenimiento de caminos.',                              'Motoniveladora',         true,  2),
  ('AUX-03', 'Conformación de botadero',  'AUX', 'soporte',       180, 'Empuje y conformación de bermas en botadero.',                       'Topadora',               true,  3),
  ('INS-01', 'Inspección preoperacional', 'INS', 'inspeccion',    20,  'Check list diario obligatorio antes de operar el equipo.',           NULL,                     true,  1),
  ('INS-02', 'Abastecimiento de combustible','INS','soporte',     20,  'Carga de combustible en surtidor o camión cisterna.',                NULL,                     true,  2),
  ('MAN-01', 'Mantenimiento preventivo',  'MAN', 'mantenimiento', 240, 'Servicio programado según plan de mantenimiento.',                    NULL,                     false, 1),
  ('MAN-02', 'Mantenimiento correctivo',  'MAN', 'mantenimiento', 180, 'Reparación por falla.',                                              NULL,                     false, 2),
  ('DEM-01', 'Colación / cambio de turno','DEM', 'demora',        60,  'Detención programada para colación.',                                NULL,                     false, 1),
  ('DEM-02', 'Tronadura',                 'DEM', 'demora',        45,  'Evacuación del área por tronadura programada.',                      NULL,                     false, 2)
) AS v(code, name, cat, type, dur, descr, eqtype, req_op, ord)
JOIN task_categories c       ON c.code = v.cat
LEFT JOIN equipment_types et ON et.name = v.eqtype;

INSERT INTO standard_task_metrics (standard_task_id, metric_id, default_value)
SELECT st.id, m.id, v.val
FROM (VALUES
  ('ACA-02', 'distance_km',  2.5),  ('ACA-02', 'production_t', 20),
  ('ACA-03', 'production_t', 20),   ('ACA-04', 'distance_km',  2.5),
  ('CAR-01', 'production_t', 120),  ('CAR-03', 'production_t', 15),
  ('AUX-01', 'water_m3',     18),   ('AUX-02', 'distance_km',  4),
  ('INS-02', 'fuel_l',       180)
) AS v(task, metric, val)
JOIN standard_tasks st ON st.code = v.task
JOIN metrics m         ON m.code  = v.metric;

-- -----------------------------------------------------------------------------
--  Checklists (plantillas "Check List Diario" del sistema principal)
-- -----------------------------------------------------------------------------

-- PD - 004 · Check List Diario - Camión Volcador (form_template #13 del sistema principal)
INSERT INTO checklists (external_id, code, name, description, equipment_type_id) VALUES (13, 'PD-004', 'Check List Diario - Camión Volcador', 'ESTE FORMULARIO DEBE SER COMPLETADO OBLIGATORIAMENTE. NO OPERAR EL EQUIPO SI NO CUMPLE LAS CONDICIONES DE SEGURIDAD.', (SELECT id FROM equipment_types WHERE name = 'Camión Volcador'));
INSERT INTO checklist_items (checklist_id, section, description, sort_order, required)
SELECT c.id, v.section, v.description, v.ord, v.required FROM checklists c, (VALUES
  ('SISTEMA ELÉCTRICO', 'Llave de contacto arranque', 1, true),
  ('SISTEMA ELÉCTRICO', 'Alarmas indicadoras de tableros', 2, true),
  ('SISTEMA ELÉCTRICO', 'Corta corriente', 3, true),
  ('SISTEMA ELÉCTRICO', 'Bocina / alarma de retroceso', 4, true),
  ('SISTEMA ELÉCTRICO', 'Balizas', 5, true),
  ('SISTEMA ELÉCTRICO', 'Faros de trabajo', 6, true),
  ('VERIFICACIÓN DE PÉRDIDAS', 'Aceite de motor', 7, true),
  ('VERIFICACIÓN DE PÉRDIDAS', 'Aceite hidráulico', 8, true),
  ('VERIFICACIÓN DE PÉRDIDAS', 'Aceite de transmisión', 9, true),
  ('VERIFICACIÓN DE PÉRDIDAS', 'Agua de motor', 10, true),
  ('VERIFICACIÓN DE PÉRDIDAS', 'Diferencial', 11, true),
  ('NIVELES Y ESTADOS', 'Nivel de aceite de motor', 12, true),
  ('NIVELES Y ESTADOS', 'Nivel de aceite de transmisión', 13, true),
  ('NIVELES Y ESTADOS', 'Líquido de frenos', 14, true),
  ('NIVELES Y ESTADOS', 'Nivel de aceite de dirección', 15, true),
  ('NIVELES Y ESTADOS', 'Limpieza de cabina y tapizados', 16, true),
  ('NIVELES Y ESTADOS', 'Estado de chapas y paragolpes', 17, true),
  ('NIVELES Y ESTADOS', 'Estado de ópticas', 18, true),
  ('NIVELES Y ESTADOS', 'Radio VHF', 19, true),
  ('NIVELES Y ESTADOS', 'Baliza estroboscópica', 20, true),
  ('NIVELES Y ESTADOS', 'Pértiga', 21, true),
  ('ESTADO GENERAL DE VIDRIOS', 'Estado de parabrisas', 22, true),
  ('ESTADO GENERAL DE VIDRIOS', 'Espejo retrovisor', 23, true),
  ('ESTADO GENERAL DE VIDRIOS', 'Limpiaparabrisas', 24, true),
  ('ESTADO GENERAL DE VIDRIOS', 'Extintores', 25, true),
  ('NEUMÁTICOS', 'Presión de inflado', 26, true),
  ('NEUMÁTICOS', 'Estado de las cubiertas', 27, true)
) AS v(section, description, ord, required) WHERE c.external_id = 13;

-- PD - 001 · Check List Diario - Cargadoras (form_template #9 del sistema principal)
INSERT INTO checklists (external_id, code, name, description, equipment_type_id) VALUES (9, 'PD-001', 'Check List Diario - Cargadoras', 'ESTE FORMULARIO DEBE SER COMPLETADO OBLIGATORIAMENTE. NO OPERAR EL EQUIPO SI NO CUMPLE LAS CONDICIONES DE SEGURIDAD.', (SELECT id FROM equipment_types WHERE name = 'Cargador Frontal'));
INSERT INTO checklist_items (checklist_id, section, description, sort_order, required)
SELECT c.id, v.section, v.description, v.ord, v.required FROM checklists c, (VALUES
  ('Sistema Eléctrico', 'Llave de contacto arranque', 1, true),
  ('Sistema Eléctrico', 'Alarmas indicadoras de tableros', 2, true),
  ('Sistema Eléctrico', 'Corta corriente', 3, true),
  ('Sistema Eléctrico', 'Bocina / alarma de retroceso', 4, true),
  ('Sistema Eléctrico', 'Balizas', 5, true),
  ('Sistema Eléctrico', 'Faros de trabajo', 6, true),
  ('Verificación de Pérdidas', 'Aceite de motor', 7, true),
  ('Verificación de Pérdidas', 'Aceite hidráulico', 8, true),
  ('Verificación de Pérdidas', 'Aceite de transmisión', 9, true),
  ('Verificación de Pérdidas', 'Agua de motor', 10, true),
  ('Verificación de Pérdidas', 'Diferencial', 11, true),
  ('Niveles y Estados', 'Nivel de aceite motor', 12, true),
  ('Niveles y Estados', 'Nivel de aceite transmisión', 13, true),
  ('Niveles y Estados', 'Líquido de frenos', 14, true),
  ('Niveles y Estados', 'Nivel de aceite dirección', 15, true),
  ('Niveles y Estados', 'Limpieza de cabina y tapizados', 16, true),
  ('Niveles y Estados', 'Estado de chapas y paragolpes', 17, true),
  ('Niveles y Estados', 'Estado de ópticas', 18, true),
  ('Niveles y Estados', 'Radio VHF', 19, true),
  ('Niveles y Estados', 'Baliza estroboscópica', 20, true),
  ('Niveles y Estados', 'Pértiga', 21, true),
  ('Estado general de vidrios', 'Estado de parabrisas', 22, true),
  ('Estado general de vidrios', 'Espejos retrovisor', 23, true),
  ('Estado general de vidrios', 'Limpiaparabrisas', 24, true),
  ('Estado general de vidrios', 'Extintores', 25, true),
  ('Neumáticos', 'Presión de inflado', 26, true),
  ('Neumáticos', 'Estado de las cubiertas', 27, true)
) AS v(section, description, ord, required) WHERE c.external_id = 9;

-- PD - 002 · Check List Diario - Excavadoras (form_template #10 del sistema principal)
INSERT INTO checklists (external_id, code, name, description, equipment_type_id) VALUES (10, 'PD-002', 'Check List Diario - Excavadoras', 'ESTE FORMULARIO DEBE SER COMPLETADO OBLIGATORIAMENTE. NO OPERAR EL EQUIPO SI NO CUMPLE LAS CONDICIONES DE SEGURIDAD.', (SELECT id FROM equipment_types WHERE name = 'Excavadora'));
INSERT INTO checklist_items (checklist_id, section, description, sort_order, required)
SELECT c.id, v.section, v.description, v.ord, v.required FROM checklists c, (VALUES
  ('Sistema eléctrico', 'Alarmas indicadoras de tableros', 1, true),
  ('Sistema eléctrico', 'Llave de contacto arranque', 2, true),
  ('Sistema eléctrico', 'Corta corriente', 3, true),
  ('Sistema eléctrico', 'Bocina / alarma de retroceso', 4, true),
  ('Sistema eléctrico', 'Balizas', 5, true),
  ('Sistema eléctrico', 'Faros de trabajo', 6, true),
  ('Verificación de pérdidas', 'Aceite de motor', 7, true),
  ('Verificación de pérdidas', 'Aceite hidráulico', 8, true),
  ('Verificación de pérdidas', 'Aceite de transmisión', 9, true),
  ('Verificación de pérdidas', 'Agua de motor', 10, true),
  ('Verificación de pérdidas', 'Diferencial', 11, true),
  ('Niveles y Estado', 'Nivel de aceite motor', 12, true),
  ('Niveles y Estado', 'Nivel de aceite transmisión', 13, true),
  ('Niveles y Estado', 'Nivel de aceite dirección', 14, true),
  ('Niveles y Estado', 'Líquido de frenos', 15, true),
  ('Niveles y Estado', 'Limpieza de cabina y tapizados', 16, true),
  ('Niveles y Estado', 'Estado de chapas', 17, true),
  ('Niveles y Estado', 'Estado de ópticas', 18, true),
  ('Niveles y Estado', 'Baliza estroboscópica', 19, true),
  ('Niveles y Estado', 'Radio VHF', 20, true),
  ('Niveles y Estado', 'Pértiga', 21, true),
  ('Niveles y Estado', 'Extintores', 22, true),
  ('Estado general de vidrios', 'Parabrisas', 23, true),
  ('Estado general de vidrios', 'Limpiaparabrisas', 24, true),
  ('Estado general de vidrios', 'Espejo Retrovisor', 25, true),
  ('Neumáticos', 'Presión de inflado', 26, true),
  ('Neumáticos', 'Estado de las cubiertas', 27, true)
) AS v(section, description, ord, required) WHERE c.external_id = 10;

-- PD - 005 · Check List Diario - Topadora (form_template #15 del sistema principal)
INSERT INTO checklists (external_id, code, name, description, equipment_type_id) VALUES (15, 'PD-005', 'Check List Diario - Topadora', 'ESTE FORMULARIO DEBE SER COMPLETADO OBLIGATORIAMENTE. NO OPERAR EL EQUIPO SI NO CUMPLE LAS CONDICIONES DE SEGURIDAD.', (SELECT id FROM equipment_types WHERE name = 'Topadora'));
INSERT INTO checklist_items (checklist_id, section, description, sort_order, required)
SELECT c.id, v.section, v.description, v.ord, v.required FROM checklists c, (VALUES
  ('SISTEMA ELÉCTRICO', 'Llave de contacto arranque', 1, true),
  ('SISTEMA ELÉCTRICO', 'Alarmas indicadoras de tableros', 2, true),
  ('SISTEMA ELÉCTRICO', 'Corta corriente', 3, true),
  ('SISTEMA ELÉCTRICO', 'Bocina /  alarma de retroceso', 4, true),
  ('SISTEMA ELÉCTRICO', 'Balizas', 5, true),
  ('SISTEMA ELÉCTRICO', 'Faros de trabajo', 6, true),
  ('VERIFICACIÓN DE PÉRDIDAS', 'Aceite de motor', 7, true),
  ('VERIFICACIÓN DE PÉRDIDAS', 'Aceite hidráulico', 8, true),
  ('VERIFICACIÓN DE PÉRDIDAS', 'Aceite de transmisión', 9, true),
  ('VERIFICACIÓN DE PÉRDIDAS', 'Agua de motor', 10, true),
  ('VERIFICACIÓN DE PÉRDIDAS', 'Diferencial', 11, true),
  ('NIVELES Y ESTADOS', 'Nivel de aceite de motor', 12, true),
  ('NIVELES Y ESTADOS', 'Nivel de aceite de transmisión', 13, true),
  ('NIVELES Y ESTADOS', 'Líquido de frenos', 14, true),
  ('NIVELES Y ESTADOS', 'Nivel de aceite de dirección', 15, true),
  ('NIVELES Y ESTADOS', 'Limpieza de cabina y tapizados', 16, true),
  ('NIVELES Y ESTADOS', 'Estado de chapas y paragolpes', 17, true),
  ('NIVELES Y ESTADOS', 'Estado de ópticas', 18, true),
  ('NIVELES Y ESTADOS', 'Radio VHF', 19, true),
  ('NIVELES Y ESTADOS', 'Baliza estroboscópica', 20, true),
  ('NIVELES Y ESTADOS', 'Pértiga', 21, true),
  ('ESTADO GENERAL DE VIDRIOS', 'Estado de parabrisas', 22, true),
  ('ESTADO GENERAL DE VIDRIOS', 'Espejo retrovisor', 23, true),
  ('ESTADO GENERAL DE VIDRIOS', 'Limpiaparabrisas', 24, true),
  ('ESTADO GENERAL DE VIDRIOS', 'Extintores', 25, true)
) AS v(section, description, ord, required) WHERE c.external_id = 15;

-- PD - 06 · Check List Diario - Motoniveladora (form_template #16 del sistema principal)
INSERT INTO checklists (external_id, code, name, description, equipment_type_id) VALUES (16, 'PD-06', 'Check List Diario - Motoniveladora', 'ESTE FORMULARIO DEBE SER COMPLETADO OBLIGATORIAMENTE. NO OPERAR EL EQUIPO SI NO CUMPLE LAS CONDICIONES DE SEGURIDAD.', (SELECT id FROM equipment_types WHERE name = 'Motoniveladora'));
INSERT INTO checklist_items (checklist_id, section, description, sort_order, required)
SELECT c.id, v.section, v.description, v.ord, v.required FROM checklists c, (VALUES
  ('SISTEMA ELÉCTRICO', 'Llave de contacto de arranque', 1, true),
  ('SISTEMA ELÉCTRICO', 'Alarmas indicadoras de tableros', 2, true),
  ('SISTEMA ELÉCTRICO', 'Corta corriente', 3, true),
  ('SISTEMA ELÉCTRICO', 'Bocina / alarma de retroceso', 4, true),
  ('SISTEMA ELÉCTRICO', 'Balizas', 5, true),
  ('SISTEMA ELÉCTRICO', 'Faros de trabajo', 6, true),
  ('VERIFICACIÓN DE PÉRDIDAS', 'Aceite de motor', 7, true),
  ('VERIFICACIÓN DE PÉRDIDAS', 'Aceite hidráulico', 8, true),
  ('VERIFICACIÓN DE PÉRDIDAS', 'Aceite de transmisión', 9, true),
  ('VERIFICACIÓN DE PÉRDIDAS', 'Agua de motor', 10, true),
  ('VERIFICACIÓN DE PÉRDIDAS', 'Diferencial', 11, true),
  ('NIVELES Y ESTADOS', 'Nivel de aceite de motor', 12, true),
  ('NIVELES Y ESTADOS', 'Nivel de aceite transmisión', 13, true),
  ('NIVELES Y ESTADOS', 'Líquido de frenos', 14, true),
  ('NIVELES Y ESTADOS', 'Nivel de aceite dirección', 15, true),
  ('NIVELES Y ESTADOS', 'Limpieza de cabina y tapizados', 16, true),
  ('NIVELES Y ESTADOS', 'Estado de chapas y paragolpes', 17, true),
  ('NIVELES Y ESTADOS', 'Estado de ópticas', 18, true),
  ('NIVELES Y ESTADOS', 'Radio VHF', 19, true),
  ('NIVELES Y ESTADOS', 'Baliza estroboscópica', 20, true),
  ('NIVELES Y ESTADOS', 'Pértiga', 21, true),
  ('ESTADO GENERAL DE VIDRIOS', 'Estado de parabrisas', 22, true),
  ('ESTADO GENERAL DE VIDRIOS', 'Espejo retrovisor', 23, true),
  ('ESTADO GENERAL DE VIDRIOS', 'Limpiaparabrisas', 24, true),
  ('ESTADO GENERAL DE VIDRIOS', 'Extintores', 25, true),
  ('NEUMÁTICOS', 'Presión de inflado', 26, true),
  ('NEUMÁTICOS', 'Estado de las cubiertas', 27, true)
) AS v(section, description, ord, required) WHERE c.external_id = 16;

-- PD - 007 · Check List Diario - Camión Regador (form_template #17 del sistema principal)
INSERT INTO checklists (external_id, code, name, description, equipment_type_id) VALUES (17, 'PD-007', 'Check List Diario - Camión Regador', 'ESTE FORMULARIO DEBE SER COMPLETADO OBLIGATORIAMENTE. NO OPERAR EL EQUIPO SI NO CUMPLE LAS CONDICIONES DE SEGURIDAD.', (SELECT id FROM equipment_types WHERE name = 'Camión Regador de Agua'));
INSERT INTO checklist_items (checklist_id, section, description, sort_order, required)
SELECT c.id, v.section, v.description, v.ord, v.required FROM checklists c, (VALUES
  ('SISTEMA ELÉCTRICO', 'Llave de contacto de arranque', 1, true),
  ('SISTEMA ELÉCTRICO', 'Alarmas indicadoras de tableros', 2, true),
  ('SISTEMA ELÉCTRICO', 'Corta corriente', 3, true),
  ('SISTEMA ELÉCTRICO', 'Bocina / alarma de retroceso', 4, true),
  ('SISTEMA ELÉCTRICO', 'Balizas', 5, true),
  ('SISTEMA ELÉCTRICO', 'Faros de trabajo', 6, true),
  ('VERIFICACIÓN DE PÉRDIDAS', 'Aceite de motor', 7, true),
  ('VERIFICACIÓN DE PÉRDIDAS', 'Aceite hidráulico', 8, true),
  ('VERIFICACIÓN DE PÉRDIDAS', 'Aceite de transmisión', 9, true),
  ('VERIFICACIÓN DE PÉRDIDAS', 'Agua de motor', 10, true),
  ('VERIFICACIÓN DE PÉRDIDAS', 'Diferencial', 11, true),
  ('NIVELES Y ESTADOS', 'Nivel de aceite motor', 12, true),
  ('NIVELES Y ESTADOS', 'Nivel de aceite transmisión', 13, true),
  ('NIVELES Y ESTADOS', 'Líquido de frenos', 14, true),
  ('NIVELES Y ESTADOS', 'Nivel de aceite dirección', 15, true),
  ('NIVELES Y ESTADOS', 'Limpieza de cabina y tapizados', 16, true),
  ('NIVELES Y ESTADOS', 'Estado de chapas y paragolpes', 17, true),
  ('NIVELES Y ESTADOS', 'Estado de ópticas', 18, true),
  ('NIVELES Y ESTADOS', 'Radio VHF', 19, true),
  ('NIVELES Y ESTADOS', 'Baliza estroboscópica', 20, true),
  ('NIVELES Y ESTADOS', 'Pértiga', 21, true),
  ('ESTADO GENERAL DE VIDRIOS', 'Estado de parabrisas', 22, true),
  ('ESTADO GENERAL DE VIDRIOS', 'Espejo retrovisor', 23, true),
  ('ESTADO GENERAL DE VIDRIOS', 'Limpiaparabrisas', 24, true),
  ('ESTADO GENERAL DE VIDRIOS', 'Extintores', 25, true),
  ('NEUMÁTICOS', 'Presión de inflado', 26, true),
  ('NEUMÁTICOS', 'Estado de cubiertas', 27, true)
) AS v(section, description, ord, required) WHERE c.external_id = 17;

-- La inspección preoperacional se vincula a todos los checklists diarios;
-- al ejecutarla se usa el que corresponde al tipo del equipo.
INSERT INTO task_checklists (standard_task_id, checklist_id)
SELECT st.id, c.id FROM standard_tasks st CROSS JOIN checklists c WHERE st.code = 'INS-01';

-- =============================================================================
--  EJECUCIONES DE TAREAS (relativas a la fecha actual)
-- =============================================================================

-- Inserta una ejecución calculando estado, tiempos reales, valores y checklist.
--   p_force: 'detenida' | 'demorada' aplican solo si la tarea abarca "ahora";
--            'cancelada' aplica siempre.
CREATE FUNCTION pg_temp.add_task(
  p_eq text, p_task text, p_op text, p_loc text, p_start timestamptz, p_dur int,
  p_force text DEFAULT NULL, p_obs text DEFAULT NULL, p_cycle int DEFAULT NULL
) RETURNS int AS $$
DECLARE
  tz       text := 'America/Argentina/San_Juan';
  v_end    timestamptz := p_start + make_interval(mins => p_dur);
  v_seed   int := abs(hashtext(p_eq || p_task || p_start::text)) % 100;
  v_status text;
  v_as     timestamptz;
  v_ae     timestamptz;
  v_obs    text := p_obs;
  v_hour   int := extract(hour FROM p_start AT TIME ZONE tz);
  v_id     int;
  v_eq     equipment;
  v_ce     int;
  v_reasons text[] := ARRAY[
    'Demora por congestión de tránsito en rampa principal.',
    'Espera de equipo de carguío en frente.',
    'Reducción de velocidad por visibilidad (polvo).',
    'Espera en punto de descarga.'];
BEGIN
  SELECT * INTO v_eq FROM equipment WHERE code = p_eq;

  IF p_force = 'cancelada' THEN
    v_status := 'cancelada';
  ELSIF v_end <= now() THEN
    v_status := 'finalizada';
    v_as := p_start + make_interval(mins => (v_seed % 9) - 2);
    v_ae := v_end   + make_interval(mins => (v_seed % 13) - 4);
    IF v_ae <= v_as THEN v_ae := v_as + interval '5 min'; END IF;
    IF v_ae > now() THEN v_status := 'en_ejecucion'; v_ae := NULL; END IF;
    IF v_obs IS NULL AND v_ae IS NOT NULL AND v_ae - v_end > interval '5 min' THEN
      v_obs := v_reasons[(v_seed % 4) + 1];
    END IF;
  ELSIF p_start <= now() THEN
    IF p_force = 'demorada' THEN
      v_status := 'demorada';
      v_obs := coalesce(v_obs, 'Inicio demorado: espera de liberación de frente por geotecnia.');
    ELSIF p_force = 'detenida' THEN
      v_status := 'detenida';
      v_as := p_start + interval '3 min';
      v_obs := coalesce(v_obs, 'Detención por falla en sistema hidráulico de tolva. Se solicitó mantenimiento.');
    ELSE
      v_status := 'en_ejecucion';
      v_as := least(now(), p_start + make_interval(mins => v_seed % 6));
    END IF;
  ELSE
    v_status := 'planificada';
  END IF;

  INSERT INTO task_executions (standard_task_id, project_id, location_id, equipment_id, operator_id, shift_id,
                               planned_start, planned_end, actual_start, actual_end, status, cycle_number,
                               observations, created_by)
  VALUES ((SELECT id FROM standard_tasks WHERE code = p_task),
          v_eq.project_id,
          (SELECT id FROM locations WHERE code = p_loc),
          v_eq.id,
          (SELECT id FROM operators WHERE employee_code = p_op),
          (SELECT id FROM shifts WHERE code = CASE WHEN v_hour >= 7 AND v_hour < 19 THEN 'DIA' ELSE 'NOCHE' END),
          p_start, v_end, v_as, v_ae, v_status, p_cycle, v_obs, 'seed')
  RETURNING id INTO v_id;

  -- Valores plan / real
  INSERT INTO task_execution_values (task_execution_id, metric_id, planned_value, actual_value)
  SELECT v_id, stm.metric_id, stm.default_value,
         CASE WHEN v_status = 'finalizada'
              THEN round(stm.default_value * (0.88 + ((v_seed + stm.metric_id * 7) % 17) / 100.0), 1) END
  FROM standard_task_metrics stm
  JOIN standard_tasks st ON st.id = stm.standard_task_id
  WHERE st.code = p_task;

  -- Checklist de inspección preoperacional
  IF p_task = 'INS-01' AND v_status IN ('finalizada', 'en_ejecucion', 'detenida') THEN
    INSERT INTO checklist_executions (task_execution_id, checklist_id, status, completed_at, operator_id)
    SELECT v_id, c.id,
           CASE WHEN v_status = 'finalizada' THEN 'completado' ELSE 'en_progreso' END,
           CASE WHEN v_status = 'finalizada' THEN v_ae END,
           (SELECT id FROM operators WHERE employee_code = p_op)
    FROM checklists c WHERE c.equipment_type_id = v_eq.equipment_type_id
    RETURNING id INTO v_ce;

    IF v_ce IS NOT NULL THEN
      INSERT INTO checklist_execution_items (checklist_execution_id, checklist_item_id, result, observation)
      SELECT v_ce, ci.id,
             CASE WHEN v_seed < 20 AND ci.sort_order = (v_seed % 20) + 3 THEN 'no_ok'
                  WHEN ci.description ILIKE '%pértiga%' AND v_seed % 3 = 0 THEN 'na'
                  ELSE 'ok' END,
             CASE WHEN v_seed < 20 AND ci.sort_order = (v_seed % 20) + 3
                  THEN 'Informado a mantenimiento. Equipo apto para operar con restricción.' END
      FROM checklist_items ci
      JOIN checklists c ON c.id = ci.checklist_id
      WHERE c.id = (SELECT checklist_id FROM checklist_executions WHERE id = v_ce)
        AND (v_status = 'finalizada' OR ci.sort_order <= 18);
    END IF;
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Ciclo de acarreo completo: Carga → Traslado cargado → Descarga → Retorno (95 min)
CREATE FUNCTION pg_temp.haul_cycles(
  p_eq text, p_op text, p_front text, p_dump text, p_from timestamptz, p_until timestamptz,
  p_force text DEFAULT NULL, p_cancel_cycle int DEFAULT NULL
) RETURNS timestamptz AS $$
DECLARE
  t timestamptz := p_from;
  k int := 0;
  f text;
BEGIN
  WHILE t + interval '95 min' <= p_until LOOP
    k := k + 1;
    f := CASE WHEN k = p_cancel_cycle THEN 'cancelada' ELSE p_force END;
    PERFORM pg_temp.add_task(p_eq, 'ACA-01', p_op, p_front,     t,                       20, f, CASE WHEN f = 'cancelada' THEN 'Ciclo cancelado por tronadura programada en el frente.' END, k);
    PERFORM pg_temp.add_task(p_eq, 'ACA-02', p_op, 'GUA-CAM',   t + interval '20 min',   35, f, NULL, k);
    PERFORM pg_temp.add_task(p_eq, 'ACA-03', p_op, p_dump,      t + interval '55 min',   10, f, NULL, k);
    PERFORM pg_temp.add_task(p_eq, 'ACA-04', p_op, 'GUA-CAM',   t + interval '65 min',   30, f, NULL, k);
    t := t + interval '95 min';
  END LOOP;
  RETURN t;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tz   text := 'America/Argentina/San_Juan';
  base date := (now() AT TIME ZONE tz)::date;
  d    int;
  ds   timestamptz;   -- inicio turno día   (07:00)
  ns   timestamptz;   -- inicio turno noche (19:00)
  t    timestamptz;
  trk  record;
  f    text;
BEGIN
  FOR d IN -1..1 LOOP
    ds := ((base + d) + time '07:00') AT TIME ZONE tz;
    ns := ds + interval '12 hours';

    -- ===================== TURNO DÍA · GUALCAMAYO =====================

    -- Camiones volcadores (acarreo)
    FOR trk IN SELECT * FROM (VALUES
      ('016-ALQ', 'OP-0103', 0,  'GUA-MINA-F03-N1250', 'GUA-BOT'),
      ('017-ALQ', 'OP-0110', 10, 'GUA-MINA-F03-N1250', 'GUA-PAD'),
      ('018-ALQ', 'OP-0121', 20, 'GUA-MINA-F02',       'GUA-BOT'),
      ('027-ALQ', 'OP-0070', 30, 'GUA-MINA-F02',       'GUA-PAD'),
      ('028-ALQ', 'OP-0086', 40, 'GUA-MINA-F01',       'GUA-BOT')
    ) AS v(eq, op, off, front, dump) LOOP
      f := NULL;

      PERFORM pg_temp.add_task(trk.eq, 'INS-01', trk.op, trk.front, ds + make_interval(mins => trk.off / 2), 20);
      t := pg_temp.haul_cycles(trk.eq, trk.op, trk.front, trk.dump,
                               ds + make_interval(mins => 25 + trk.off), ds + interval '5 h 30 min', f);
      PERFORM pg_temp.add_task(trk.eq, 'DEM-01', NULL, 'GUA-TAL', ds + interval '5 h 30 min', 60);

      IF d = 0 AND trk.eq = '018-ALQ' THEN
        PERFORM pg_temp.add_task(trk.eq, 'MAN-01', NULL, 'GUA-TAL', ds + interval '6 h 30 min', 240, NULL,
                                 'Service 500 h: cambio de aceite motor, filtros y engrase general.');
      ELSE
        t := pg_temp.haul_cycles(trk.eq, trk.op, trk.front, trk.dump,
                                 ds + make_interval(mins => 390 + trk.off / 2), ds + interval '11 h 20 min', f);
        PERFORM pg_temp.add_task(trk.eq, 'INS-02', trk.op, 'GUA-TAL', ds + interval '11 h 25 min', 20);
      END IF;
    END LOOP;

    -- Cargadora 042-ALQ · Frente 03 / Nivel 1250
    PERFORM pg_temp.add_task('042-ALQ', 'INS-01', 'OP-0117', 'GUA-MINA-F03-N1250', ds,                          20);
    PERFORM pg_temp.add_task('042-ALQ', 'CAR-01', 'OP-0117', 'GUA-MINA-F03-N1250', ds + interval '25 min',      185);
    PERFORM pg_temp.add_task('042-ALQ', 'CAR-02', 'OP-0117', 'GUA-MINA-F03-N1280', ds + interval '3 h 30 min',  30);
    PERFORM pg_temp.add_task('042-ALQ', 'CAR-01', 'OP-0117', 'GUA-MINA-F03-N1280', ds + interval '4 h',         90);
    PERFORM pg_temp.add_task('042-ALQ', 'DEM-01', NULL,      'GUA-TAL',            ds + interval '5 h 30 min',  60);
    PERFORM pg_temp.add_task('042-ALQ', 'CAR-01', 'OP-0117', 'GUA-MINA-F03-N1250', ds + interval '6 h 30 min',  150);
    PERFORM pg_temp.add_task('042-ALQ', 'CAR-03', 'OP-0117', 'GUA-PAD',            ds + interval '9 h',         45);
    PERFORM pg_temp.add_task('042-ALQ', 'CAR-01', 'OP-0117', 'GUA-MINA-F03-N1250', ds + interval '9 h 45 min',  95);
    PERFORM pg_temp.add_task('042-ALQ', 'INS-02', 'OP-0117', 'GUA-TAL',            ds + interval '11 h 25 min', 20);

    -- Cargadora CF-36 · Frente 01
    PERFORM pg_temp.add_task('CF-36', 'INS-01', 'OP-0104', 'GUA-MINA-F01', ds,                          20);
    PERFORM pg_temp.add_task('CF-36', 'CAR-01', 'OP-0104', 'GUA-MINA-F01', ds + interval '35 min',      295);
    PERFORM pg_temp.add_task('CF-36', 'DEM-01', NULL,      'GUA-TAL',      ds + interval '5 h 30 min',  60);
    PERFORM pg_temp.add_task('CF-36', 'CAR-01', 'OP-0104', 'GUA-MINA-F01', ds + interval '6 h 30 min',  180);
    PERFORM pg_temp.add_task('CF-36', 'CAR-02', 'OP-0104', 'GUA-MINA-F02', ds + interval '9 h 30 min',  30);
    PERFORM pg_temp.add_task('CF-36', 'CAR-01', 'OP-0104', 'GUA-MINA-F02', ds + interval '10 h',        80);

    -- Excavadora EX-11 · Frente 02
    PERFORM pg_temp.add_task('EX-11', 'INS-01', 'OP-0116', 'GUA-MINA-F02', ds,                          20);
    PERFORM pg_temp.add_task('EX-11', 'CAR-01', 'OP-0116', 'GUA-MINA-F02', ds + interval '25 min',      305);
    PERFORM pg_temp.add_task('EX-11', 'DEM-02', NULL,      'GUA-MINA-F02', ds + interval '5 h 30 min',  45);
    PERFORM pg_temp.add_task('EX-11', 'DEM-01', NULL,      'GUA-TAL',      ds + interval '6 h 15 min',  45);
    PERFORM pg_temp.add_task('EX-11', 'CAR-01', 'OP-0116', 'GUA-MINA-F02', ds + interval '7 h',         260);

    -- Topadora T-03 · Botadero Norte
    PERFORM pg_temp.add_task('T-03', 'INS-01', 'OP-0073', 'GUA-BOT', ds,                          20);
    PERFORM pg_temp.add_task('T-03', 'AUX-03', 'OP-0073', 'GUA-BOT', ds + interval '30 min',      300);
    PERFORM pg_temp.add_task('T-03', 'DEM-01', NULL,      'GUA-TAL', ds + interval '5 h 30 min',  60);
    PERFORM pg_temp.add_task('T-03', 'AUX-03', 'OP-0073', 'GUA-BOT', ds + interval '6 h 30 min',  240);
    PERFORM pg_temp.add_task('T-03', 'INS-02', 'OP-0073', 'GUA-BOT', ds + interval '10 h 40 min', 20);

    -- Motoniveladora MO-06 · Caminos
    PERFORM pg_temp.add_task('MO-06', 'INS-01', 'OP-0118', 'GUA-CAM', ds,                          20);
    PERFORM pg_temp.add_task('MO-06', 'AUX-02', 'OP-0118', 'GUA-CAM', ds + interval '30 min',      180);
    PERFORM pg_temp.add_task('MO-06', 'AUX-02', 'OP-0118', 'GUA-CAM', ds + interval '3 h 40 min',  110);
    PERFORM pg_temp.add_task('MO-06', 'DEM-01', NULL,      'GUA-TAL', ds + interval '5 h 30 min',  60);
    PERFORM pg_temp.add_task('MO-06', 'AUX-02', 'OP-0118', 'GUA-CAM', ds + interval '6 h 30 min',  270);

    -- Regador CA-18 · Caminos
    PERFORM pg_temp.add_task('CA-18', 'INS-01', 'OP-0076', 'GUA-TAL', ds,                          20);
    PERFORM pg_temp.add_task('CA-18', 'AUX-01', 'OP-0076', 'GUA-CAM', ds + interval '25 min',      120);
    PERFORM pg_temp.add_task('CA-18', 'AUX-01', 'OP-0076', 'GUA-CAM', ds + interval '2 h 40 min',  120);
    PERFORM pg_temp.add_task('CA-18', 'DEM-01', NULL,      'GUA-TAL', ds + interval '5 h 30 min',  60);
    PERFORM pg_temp.add_task('CA-18', 'AUX-01', 'OP-0076', 'GUA-CAM', ds + interval '6 h 30 min',  120);
    PERFORM pg_temp.add_task('CA-18', 'INS-02', 'OP-0076', 'GUA-TAL', ds + interval '8 h 35 min',  20);
    PERFORM pg_temp.add_task('CA-18', 'AUX-01', 'OP-0076', 'GUA-CAM', ds + interval '9 h',         120);

    -- ===================== TURNO DÍA · EQ, AUXILARES =====================
    PERFORM pg_temp.add_task('EX-06', 'INS-01', 'OP-0078', 'AUX-NC1', ds,                         20);
    PERFORM pg_temp.add_task('EX-06', 'CAR-01', 'OP-0078', 'AUX-NC1', ds + interval '30 min',     300);
    PERFORM pg_temp.add_task('EX-06', 'DEM-01', NULL,      'AUX-NC1', ds + interval '5 h 30 min', 60);
    PERFORM pg_temp.add_task('EX-06', 'CAR-01', 'OP-0078', 'AUX-NC1', ds + interval '6 h 30 min', 270);
    PERFORM pg_temp.add_task('CG-01', 'INS-01', 'OP-0102', 'AUX-NC2', ds,                         20);
    PERFORM pg_temp.add_task('CG-01', 'CAR-01', 'OP-0102', 'AUX-NC2', ds + interval '30 min',     180);
    PERFORM pg_temp.add_task('CG-01', 'CAR-02', 'OP-0102', 'AUX-PROC',ds + interval '3 h 30 min', 30);
    PERFORM pg_temp.add_task('CG-01', 'CAR-03', 'OP-0102', 'AUX-PROC',ds + interval '4 h',        90);
    PERFORM pg_temp.add_task('CG-01', 'DEM-01', NULL,      'AUX-NC2', ds + interval '5 h 30 min', 60);
    PERFORM pg_temp.add_task('CG-01', 'CAR-01', 'OP-0102', 'AUX-NC2', ds + interval '6 h 30 min', 240);

    -- ===================== TURNO NOCHE · GUALCAMAYO =====================
    FOR trk IN SELECT * FROM (VALUES
      ('016-ALQ', 'OP-0109', 0,  'GUA-MINA-F03-N1250', 'GUA-BOT'),
      ('017-ALQ', 'OP-0097', 12, 'GUA-MINA-F03-N1250', 'GUA-PAD'),
      ('018-ALQ', 'OP-0071', 24, 'GUA-MINA-F02',       'GUA-BOT')
    ) AS v(eq, op, off, front, dump) LOOP
      PERFORM pg_temp.add_task(trk.eq, 'INS-01', trk.op, trk.front, ns + make_interval(mins => trk.off / 2), 20);
      t := pg_temp.haul_cycles(trk.eq, trk.op, trk.front, trk.dump,
                               ns + make_interval(mins => 25 + trk.off), ns + interval '5 h 30 min');
      PERFORM pg_temp.add_task(trk.eq, 'DEM-01', NULL, 'GUA-TAL', ns + interval '5 h 30 min', 60);
      t := pg_temp.haul_cycles(trk.eq, trk.op, trk.front, trk.dump,
                               ns + make_interval(mins => 390 + trk.off / 2), ns + interval '11 h 20 min');
      PERFORM pg_temp.add_task(trk.eq, 'INS-02', trk.op, 'GUA-TAL', ns + interval '11 h 25 min', 20);
    END LOOP;

    PERFORM pg_temp.add_task('042-ALQ', 'INS-01', 'OP-0119', 'GUA-MINA-F03-N1250', ns,                         20);
    PERFORM pg_temp.add_task('042-ALQ', 'CAR-01', 'OP-0119', 'GUA-MINA-F03-N1250', ns + interval '25 min',     305);
    PERFORM pg_temp.add_task('042-ALQ', 'DEM-01', NULL,      'GUA-TAL',            ns + interval '5 h 30 min', 60);
    PERFORM pg_temp.add_task('042-ALQ', 'CAR-01', 'OP-0119', 'GUA-MINA-F03-N1250', ns + interval '6 h 30 min', 290);

    PERFORM pg_temp.add_task('EX-11', 'INS-01', 'OP-0098', 'GUA-MINA-F02', ns,                         20);
    PERFORM pg_temp.add_task('EX-11', 'CAR-01', 'OP-0098', 'GUA-MINA-F02', ns + interval '25 min',     305);
    PERFORM pg_temp.add_task('EX-11', 'DEM-01', NULL,      'GUA-TAL',      ns + interval '5 h 30 min', 60);
    PERFORM pg_temp.add_task('EX-11', 'CAR-01', 'OP-0098', 'GUA-MINA-F02', ns + interval '6 h 30 min', 290);

    PERFORM pg_temp.add_task('CA-18', 'AUX-01', 'OP-0106', 'GUA-CAM', ns + interval '15 min', 120);
    PERFORM pg_temp.add_task('CA-18', 'AUX-01', 'OP-0106', 'GUA-CAM', ns + interval '2 h 30 min', 120);
  END LOOP;
END $$;

-- =============================================================================
--  ESCENARIOS DE DEMOSTRACIÓN sobre el turno en curso (sea día o noche)
--   · un camión con inicio DEMORADO
--   · un camión DETENIDO por falla → correctivo planificado y ciclos cancelados
--   · un ciclo CANCELADO por tronadura
-- =============================================================================
DO $$
DECLARE
  r       record;
  v_truck record;
BEGIN
  FOR r IN
    SELECT te.id, te.equipment_id, te.planned_end, te.operator_id, te.project_id, te.cycle_number,
           row_number() OVER (ORDER BY e.code) AS rn
    FROM task_executions te
    JOIN equipment e        ON e.id = te.equipment_id
    JOIN equipment_types et ON et.id = e.equipment_type_id
    WHERE et.category = 'acarreo' AND now() BETWEEN te.planned_start AND te.planned_end
  LOOP
    IF r.rn = 2 THEN
      UPDATE task_executions
         SET status = 'demorada', actual_start = NULL,
             observations = 'Inicio demorado: espera de liberación de frente por geotecnia.'
       WHERE id = r.id;

    ELSIF r.rn = 3 THEN
      UPDATE task_executions
         SET status = 'detenida',
             observations = 'Detención por falla en sistema hidráulico de tolva. Se solicitó mantenimiento.'
       WHERE id = r.id;

      UPDATE task_executions
         SET status = 'cancelada', observations = 'Reprogramado por falla del equipo (ver correctivo).'
       WHERE equipment_id = r.equipment_id AND status = 'planificada'
         AND planned_start >= r.planned_end AND planned_start < r.planned_end + interval '3 hours';

      INSERT INTO task_executions (standard_task_id, project_id, location_id, equipment_id, shift_id,
                                   planned_start, planned_end, status, observations, created_by)
      SELECT (SELECT id FROM standard_tasks WHERE code = 'MAN-02'), r.project_id,
             (SELECT id FROM locations WHERE code = 'GUA-TAL'), r.equipment_id,
             (SELECT shift_id FROM task_executions WHERE id = r.id),
             r.planned_end + interval '15 min', r.planned_end + interval '2 h 45 min', 'planificada',
             'OT correctiva: revisión de bomba y mangueras del sistema hidráulico de tolva.', 'seed';

    ELSIF r.rn = 1 THEN
      UPDATE task_executions
         SET status = 'cancelada', observations = 'Ciclo cancelado por tronadura programada en el frente.'
       WHERE equipment_id = r.equipment_id AND cycle_number = r.cycle_number + 1
         AND status = 'planificada' AND planned_start > now() AND planned_start < now() + interval '4 hours';
    END IF;
  END LOOP;
END $$;

-- Resumen
SELECT 'proyectos' AS entidad, count(*) FROM projects
UNION ALL SELECT 'ubicaciones', count(*) FROM locations
UNION ALL SELECT 'equipos', count(*) FROM equipment
UNION ALL SELECT 'operadores', count(*) FROM operators
UNION ALL SELECT 'turnos', count(*) FROM shifts
UNION ALL SELECT 'tareas estándar', count(*) FROM standard_tasks
UNION ALL SELECT 'checklists', count(*) FROM checklists
UNION ALL SELECT 'ítems de checklist', count(*) FROM checklist_items
UNION ALL SELECT 'ejecuciones de tareas', count(*) FROM task_executions
UNION ALL SELECT 'ejecuciones de checklist', count(*) FROM checklist_executions;
