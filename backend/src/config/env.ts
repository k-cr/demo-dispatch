import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));

// Busca .env en backend/ y, si no existe, en la raíz del proyecto
dotenv.config({ path: path.resolve(here, '../../.env'), quiet: true });
dotenv.config({ path: path.resolve(here, '../../../.env'), quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1).default('postgres://dispatch:dispatch@localhost:5432/dispatch'),
  DB_SCHEMA: z.string().default('dispatch'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // Zona horaria operativa: define el inicio de turnos/jornadas al calcular rangos
  OPERATION_TIMEZONE: z.string().default('America/Argentina/San_Juan'),
  // Escucha LISTEN/NOTIFY de PostgreSQL para reenviar eventos (preparado para WebSocket)
  REALTIME_PG_LISTEN: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  // Soporte para conexiones SSL (necesario en bases externas / gestionadas)
  DATABASE_SSL: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
});

export const env = schema.parse(process.env);

const candidateDirs = [
  process.env.DATABASE_DIR,
  path.resolve(here, '../../../database'),
  path.resolve(here, '../../database'),
  path.resolve(here, '../database'),
  path.resolve(process.cwd(), 'database'),
  path.resolve(process.cwd(), '../database'),
  '/app/database',
].filter((d): d is string => typeof d === 'string' && d.length > 0);

export const DATABASE_DIR = candidateDirs.find((dir) => fs.existsSync(dir)) || path.resolve(here, '../../../database');

