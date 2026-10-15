import { EventEmitter } from 'node:events';

export interface DispatchEvent {
  id: number;
  entity: 'task_execution' | string;
  entity_id: number;
  action: 'insert' | 'update' | 'delete';
  project_id: number | null;
}

/**
 * Bus de eventos interno. Hoy lo alimenta el listener de PostgreSQL; mañana un
 * gateway WebSocket solo necesita suscribirse:  eventBus.onEvent(ev => ws.broadcast(ev))
 */
class DispatchEventBus extends EventEmitter {
  emitEvent(ev: DispatchEvent) {
    this.emit('dispatch:event', ev);
  }
  onEvent(fn: (ev: DispatchEvent) => void) {
    this.on('dispatch:event', fn);
    return () => this.off('dispatch:event', fn);
  }
}

export const eventBus = new DispatchEventBus();
eventBus.setMaxListeners(100);
