import type { Request, Response } from 'express';
import { z } from 'zod';
import { getChanges, getConfig, getTimeline } from '../services/dispatch.service.js';
import { parseQuery } from '../middleware/validate.js';
import { timelineQuerySchema } from '../validators/taskExecution.validator.js';

export const DispatchController = {
  timeline: async (req: Request, res: Response) => {
    res.json(await getTimeline(parseQuery(timelineQuerySchema, req)));
  },
  config: async (_req: Request, res: Response) => {
    res.json(await getConfig());
  },
  changes: async (req: Request, res: Response) => {
    const q = parseQuery(z.object({ since: z.coerce.number().int().min(0).default(0) }), req);
    res.json(await getChanges(q.since));
  },
};
