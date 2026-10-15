import pg from 'pg';
import { env } from '../config/env.js';

// numeric → number, bigint (count) → number
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => (v === null ? null : Number(v)));

const isSsl =
  env.DATABASE_SSL ||
  (env.DATABASE_URL && (env.DATABASE_URL.includes('sslmode=require') || env.DATABASE_URL.includes('ssl=true')));

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  options: `-c search_path=${env.DB_SCHEMA},public`,
  ...(isSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

pool.on('error', (err) => {
  console.error('[db] error inesperado en cliente inactivo', err);
});

export type Queryable = Pick<pg.PoolClient, 'query'>;

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params: unknown[] = [],
  client: Queryable = pool,
): Promise<T[]> {
  const res = await client.query<T>(text, params as any[]);
  return res.rows;
}

export async function queryOne<T extends pg.QueryResultRow = any>(
  text: string,
  params: unknown[] = [],
  client: Queryable = pool,
): Promise<T | null> {
  const rows = await query<T>(text, params, client);
  return rows[0] ?? null;
}

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
