import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Recurso') => new HttpError(404, 'not_found', `${what} no encontrado`);

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, 'route_not_found', `Ruta no encontrada: ${req.method} ${req.originalUrl}`));
};

// Traduce errores conocidos (validación, PostgreSQL) a respuestas JSON uniformes
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Datos inválidos',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  // Errores de PostgreSQL
  const pgCode = (err as { code?: string }).code;
  if (pgCode === '23503') {
    res.status(400).json({ error: { code: 'invalid_reference', message: 'Referencia inválida a otro registro', details: err.detail } });
    return;
  }
  if (pgCode === '23505') {
    res.status(409).json({ error: { code: 'duplicate', message: 'Ya existe un registro con ese valor', details: err.detail } });
    return;
  }
  if (pgCode === '23514') {
    res.status(400).json({ error: { code: 'constraint_violation', message: 'Los datos no cumplen una regla de negocio', details: err.constraint } });
    return;
  }
  console.error('[api] error no controlado', err);
  res.status(500).json({ error: { code: 'internal_error', message: 'Error interno del servidor' } });
};
