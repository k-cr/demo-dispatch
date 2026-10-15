import { Router } from 'express';
import { CatalogController } from '../controllers/catalog.controller.js';
import { StandardTaskController } from '../controllers/standardTask.controller.js';
import { TaskExecutionController } from '../controllers/taskExecution.controller.js';
import { ChecklistController } from '../controllers/checklist.controller.js';
import { DispatchController } from '../controllers/dispatch.controller.js';
import { pool } from '../database/pool.js';

export const api = Router();

api.get('/health', async (_req, res) => {
  const db = await pool.query('SELECT 1').then(() => 'up', () => 'down');
  res.status(db === 'up' ? 200 : 503).json({ status: db === 'up' ? 'ok' : 'degraded', db, time: new Date().toISOString() });
});

// Catálogos
api.get('/projects', CatalogController.projects);
api.get('/locations', CatalogController.locations);
api.get('/equipment', CatalogController.equipment);
api.get('/equipment-types', CatalogController.equipmentTypes);
api.get('/operators', CatalogController.operators);
api.get('/shifts', CatalogController.shifts);
api.get('/task-categories', CatalogController.categories);
api.get('/metrics', CatalogController.metrics);

// Tareas estándar
api.get('/standard-tasks', StandardTaskController.list);
api.get('/standard-tasks/:id', StandardTaskController.get);
api.post('/standard-tasks', StandardTaskController.create);
api.put('/standard-tasks/:id', StandardTaskController.update);

// Ejecuciones de tareas
api.get('/task-executions', TaskExecutionController.list);
api.get('/task-executions/:id', TaskExecutionController.get);
api.post('/task-executions', TaskExecutionController.create);
api.put('/task-executions/:id', TaskExecutionController.update);
api.delete('/task-executions/:id', TaskExecutionController.remove);
api.get('/task-executions/:id/checklist', TaskExecutionController.getChecklist);
api.put('/task-executions/:id/checklist', TaskExecutionController.saveChecklist);

// Checklists
api.get('/checklists', ChecklistController.list);
api.get('/checklists/:id', ChecklistController.get);
api.post('/checklists', ChecklistController.create);
api.put('/checklists/:id', ChecklistController.update);

// Dispatch
api.get('/dispatch/timeline', DispatchController.timeline);
api.get('/dispatch/config', DispatchController.config);
api.get('/dispatch/changes', DispatchController.changes);
