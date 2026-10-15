import type { Request, Response } from 'express';
import { TaskExecutionService } from '../services/taskExecution.service.js';
import { ChecklistService } from '../services/checklist.service.js';
import { actor, parseBody, parseId, parseQuery } from '../middleware/validate.js';
import {
  createExecutionSchema,
  executionFilterSchema,
  updateExecutionSchema,
} from '../validators/taskExecution.validator.js';
import { executionChecklistSchema } from '../validators/checklist.validator.js';

export const TaskExecutionController = {
  list: async (req: Request, res: Response) => {
    res.json(await TaskExecutionService.list(parseQuery(executionFilterSchema, req)));
  },
  get: async (req: Request, res: Response) => {
    res.json(await TaskExecutionService.get(parseId(req)));
  },
  create: async (req: Request, res: Response) => {
    res.status(201).json(await TaskExecutionService.create(parseBody(createExecutionSchema, req), actor(req)));
  },
  update: async (req: Request, res: Response) => {
    res.json(await TaskExecutionService.update(parseId(req), parseBody(updateExecutionSchema, req), actor(req)));
  },
  remove: async (req: Request, res: Response) => {
    res.json(await TaskExecutionService.remove(parseId(req)));
  },

  getChecklist: async (req: Request, res: Response) => {
    res.json(await ChecklistService.forExecution(parseId(req)));
  },
  saveChecklist: async (req: Request, res: Response) => {
    res.json(await ChecklistService.saveForExecution(parseId(req), parseBody(executionChecklistSchema, req)));
  },
};
