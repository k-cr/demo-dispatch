import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  EquipmentModel,
  EquipmentTypeModel,
  LocationModel,
  LookupModel,
  OperatorModel,
  ProjectModel,
  ShiftModel,
} from '../models/catalog.model.js';
import { parseQuery } from '../middleware/validate.js';

const optId = z.coerce.number().int().positive().optional();

export const CatalogController = {
  projects: async (_req: Request, res: Response) => {
    res.json(await ProjectModel.list());
  },

  locations: async (req: Request, res: Response) => {
    const q = parseQuery(z.object({ project_id: optId }), req);
    res.json(await LocationModel.list(q.project_id));
  },

  equipment: async (req: Request, res: Response) => {
    const q = parseQuery(z.object({ project_id: optId, equipment_type_id: optId }), req);
    res.json(await EquipmentModel.list(q));
  },

  equipmentTypes: async (_req: Request, res: Response) => {
    res.json(await EquipmentTypeModel.list());
  },

  operators: async (req: Request, res: Response) => {
    const q = parseQuery(z.object({ project_id: optId, q: z.string().trim().min(1).optional() }), req);
    res.json(await OperatorModel.list(q.project_id, q.q));
  },

  shifts: async (_req: Request, res: Response) => {
    res.json(await ShiftModel.list());
  },

  categories: async (_req: Request, res: Response) => {
    res.json(await LookupModel.categories());
  },

  metrics: async (_req: Request, res: Response) => {
    res.json(await LookupModel.metrics());
  },
};
