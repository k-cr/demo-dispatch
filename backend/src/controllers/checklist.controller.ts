import type { Request, Response } from 'express';
import { z } from 'zod';
import { ChecklistService } from '../services/checklist.service.js';
import { parseBody, parseId, parseQuery } from '../middleware/validate.js';
import { checklistSchema, checklistUpdateSchema } from '../validators/checklist.validator.js';

export const ChecklistController = {
  list: async (req: Request, res: Response) => {
    const q = parseQuery(z.object({ active: z.enum(['true', 'false']).transform((v) => v === 'true').optional() }), req);
    res.json(await ChecklistService.list(q.active));
  },
  get: async (req: Request, res: Response) => {
    res.json(await ChecklistService.get(parseId(req)));
  },
  create: async (req: Request, res: Response) => {
    res.status(201).json(await ChecklistService.create(parseBody(checklistSchema, req)));
  },
  update: async (req: Request, res: Response) => {
    res.json(await ChecklistService.update(parseId(req), parseBody(checklistUpdateSchema, req)));
  },
};
