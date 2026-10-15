import type { Server } from 'node:http';
import { eventBus } from './eventBus.js';

/**
 * Punto de extensión para tiempo real.
 *
 * Modo actual: POLLING. El frontend consulta GET /api/dispatch/changes?since=<id>
 * cada N segundos y, si hay eventos nuevos, refresca el timeline.
 *
 * Para migrar a WebSocket (ej. paquete "ws"):
 *
 *   import { WebSocketServer } from 'ws';
 *   const wss = new WebSocketServer({ server, path: '/ws/dispatch' });
 *   eventBus.onEvent((ev) => {
 *     const msg = JSON.stringify({ type: 'dispatch:event', data: ev });
 *     wss.clients.forEach((c) => c.readyState === c.OPEN && c.send(msg));
 *   });
 *
 * y en el frontend reemplazar el polling de useRealtimeChanges() por una
 * suscripción al socket (la invalidación de queries es la misma).
 */
export function attachRealtimeGateway(_server: Server) {
  let count = 0;
  eventBus.onEvent(() => {
    count += 1;
  });
  return {
    mode: 'polling' as const,
    stats: () => ({ eventsSinceStart: count }),
  };
}
