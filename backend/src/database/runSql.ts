/**
 * Ejecuta los scripts SQL de /database sin necesidad de tener psql instalado.
 *   npm run db:schema   → database/schema.sql
 *   npm run db:seed     → database/seed.sql
 *   npm run db:reset    → ambos
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { env, DATABASE_DIR } from '../config/env.js';

const files: Record<string, string> = {
  schema: 'schema.sql',
  seed: 'seed.sql',
};

const targets = process.argv.slice(2);
if (targets.length === 0 || targets.some((t) => !files[t])) {
  console.error('Uso: tsx src/database/runSql.ts <schema|seed> [...]');
  process.exit(1);
}

const isSsl =
  env.DATABASE_SSL ||
  (env.DATABASE_URL && (env.DATABASE_URL.includes('sslmode=require') || env.DATABASE_URL.includes('ssl=true')));

const client = new pg.Client({
  connectionString: env.DATABASE_URL,
  ...(isSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});
await client.connect();
try {
  for (const t of targets) {
    const file = path.join(DATABASE_DIR, files[t]);
    process.stdout.write(`→ Ejecutando ${path.relative(process.cwd(), file)} ... `);
    const result = await client.query(fs.readFileSync(file, 'utf8'));
    console.log('OK');
    const last = Array.isArray(result) ? result[result.length - 1] : result;
    if (t === 'seed' && last?.rows?.length) console.table(last.rows);
  }
} catch (err) {
  console.error('\n✖ Error ejecutando SQL:', (err as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
}
