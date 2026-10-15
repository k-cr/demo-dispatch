import { createServer } from 'node:http';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { pool } from './database/pool.js';
import { startPgListener, stopPgListener } from './realtime/pgListener.js';
import { attachRealtimeGateway } from './realtime/gateway.js';

const server = createServer(createApp());
const realtime = attachRealtimeGateway(server);

server.listen(env.PORT, '0.0.0.0', async () => {
  console.log(`[dispatch] API escuchando en http://0.0.0.0:${env.PORT}/api  (tiempo real: ${realtime.mode})`);
  try {
    await pool.query('SELECT 1 FROM dispatch.task_executions LIMIT 1');
    console.log('[dispatch] base de datos OK');
  } catch (err) {
    console.error('[dispatch] ⚠ no se pudo consultar la base de datos:', (err as Error).message);
    console.error('           Verifique DATABASE_URL y ejecute "npm run db:reset".');
  }
  if (env.REALTIME_PG_LISTEN) void startPgListener();
});

async function shutdown() {
  console.log('[dispatch] cerrando...');
  server.close();
  await stopPgListener();
  await pool.end();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
