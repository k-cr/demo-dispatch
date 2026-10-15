import type { Request, Response } from 'express';
import { z } from 'zod';
import { StandardTaskService } from '../services/standardTask.service.js';
import { parseBody, parseId, parseQuery } from '../middleware/validate.js';
import { standardTaskSchema, standardTaskUpdateSchema } from '../validators/standardTask.validator.js';

const listQuery = z.object({
  active: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  category_id: z.coerce.number().int().positive().optional(),
});

export const StandardTaskController = {
  list: async (req: Request, res: Response) => {
    res.json(await StandardTaskService.list(parseQuery(listQuery, req)));
  },
  get: async (req: Request, res: Response) => {
    res.json(await StandardTaskService.get(parseId(req)));
  },
  create: async (req: Request, res: Response) => {
    res.status(201).json(await StandardTaskService.create(parseBody(standardTaskSchema, req)));
  },
  update: async (req: Request, res: Response) => {
    res.json(await StandardTaskService.update(parseId(req), parseBody(standardTaskUpdateSchema, req)));
  },
};
