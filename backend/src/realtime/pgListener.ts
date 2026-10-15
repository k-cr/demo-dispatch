import pg from 'pg';
import { env } from '../config/env.js';
import { eventBus, type DispatchEvent } from './eventBus.js';

/**
 * Escucha el canal NOTIFY "dispatch_events" (emitido por el trigger de
 * task_executions) y publica cada cambio en el bus interno.
 *
 *   PostgreSQL ──NOTIFY──▶ pgListener ──▶ eventBus ──▶ (futuro) WebSocket ──▶ React
 */
let client: pg.Client | null = null;
let stopped = false;

export async function startPgListener() {
  stopped = false;
  try {
    client = new pg.Client({ connectionString: env.DATABASE_URL });
    client.on('notification', (msg) => {
      if (msg.channel !== 'dispatch_events' || !msg.payload) return;
      try {
        eventBus.emitEvent(JSON.parse(msg.payload) as DispatchEvent);
      } catch {
        /* payload inválido: se ignora */
      }
    });
    client.on('error', (err) => {
      console.warn('[realtime] conexión LISTEN perdida:', err.message);
      scheduleReconnect();
    });
    await client.connect();
    await client.query('LISTEN dispatch_events');
    console.log('[realtime] escuchando NOTIFY dispatch_events');
  } catch (err) {
    console.warn('[realtime] no se pudo iniciar LISTEN:', (err as Error).message);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (stopped) return;
  client?.end().catch(() => undefined);
  client = null;
  setTimeout(() => void startPgListener(), 5000);
}

export async function stopPgListener() {
  stopped = true;
  await client?.end().catch(() => undefined);
  client = null;
}
