import type { Request } from 'express';
import type { z } from 'zod';
import { HttpError } from './errors.js';

export const parseBody = <T extends z.ZodType>(schema: T, req: Request): z.infer<T> => schema.parse(req.body ?? {});

export const parseQuery = <T extends z.ZodType>(schema: T, req: Request): z.infer<T> => schema.parse(req.query);

export function parseId(req: Request, param = 'id'): number {
  const id = Number(req.params[param]);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'invalid_id', `Parámetro ${param} inválido`);
  return id;
}

// Usuario que realiza la acción. El sistema principal puede enviar X-User (nombre/email).
export const actor = (req: Request) => (req.header('x-user') ?? 'dispatch-ui').slice(0, 120);
