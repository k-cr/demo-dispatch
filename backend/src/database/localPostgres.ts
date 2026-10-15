/**
 * PostgreSQL local sin instalación (paquete embedded-postgres, binarios oficiales).
 * Útil cuando no hay Docker ni PostgreSQL en la máquina.
 *
 *   npm run db:start      → levanta PostgreSQL con los datos de DATABASE_URL
 *                           (usuario, clave, puerto y base). Datos en dispatch/.pgdata
 *
 * Dejar esta terminal abierta mientras se usa Dispatch; Ctrl+C para detener.
 */
import fs from 'node:fs';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { env, DATABASE_DIR } from '../config/env.js';

const url = new URL(env.DATABASE_URL);
const user = decodeURIComponent(url.username || 'dispatch');
const password = decodeURIComponent(url.password || 'dispatch');
const port = Number(url.port || 5432);
const database = url.pathname.replace(/^\//, '') || 'dispatch';
const dataDir = path.resolve(DATABASE_DIR, '..', '.pgdata');

const pg = new EmbeddedPostgres({ databaseDir: dataDir, user, password, port, persistent: true });

try {
  if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
    console.log(`→ Inicializando base de datos en ${dataDir}`);
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase(database);
    console.log(`→ Base "${database}" creada. Ejecute "npm run db:reset" para cargar tablas y datos.`);
  } catch {
    /* ya existe */
  }
  console.log(`✔ PostgreSQL local escuchando en localhost:${port} (usuario ${user}, base ${database})`);
  console.log('  Deje esta terminal abierta. Ctrl+C para detener.');
} catch (err) {
  console.error('✖ No se pudo iniciar PostgreSQL local:', (err as Error).message);
  console.error(`  ¿Hay otro PostgreSQL usando el puerto ${port}? Cambie el puerto en DATABASE_URL (.env).`);
  process.exit(1);
}

const stop = async () => {
  console.log('\n→ Deteniendo PostgreSQL…');
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => undefined, 1 << 30);
