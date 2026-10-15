import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DispatchApi } from '../services/dispatch.api';

export type ConnectionState = 'online' | 'syncing' | 'offline';

const POLL_SECONDS = Number(import.meta.env.VITE_POLL_SECONDS) || 15;

/**
 * Tiempo real por polling: consulta /api/dispatch/changes?since=<último evento>.
 * Si llegan eventos (cambios de otros usuarios), invalida el timeline.
 *
 * Para migrar a WebSocket basta reemplazar el useQuery por una suscripción al
 * socket y llamar a la misma función `onEvents`.
 */
export function useRealtimeChanges(initialEventId: number | undefined) {
  const qc = useQueryClient();
  const since = useRef<number | null>(null);
  const [browserOnline, setBrowserOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    if (since.current === null && initialEventId != null) since.current = initialEventId;
  }, [initialEventId]);

  useEffect(() => {
    const on = () => setBrowserOnline(true);
    const off = () => setBrowserOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const q = useQuery({
    queryKey: ['changes'],
    enabled: initialEventId != null,
    refetchInterval: POLL_SECONDS * 1000,
    refetchIntervalInBackground: false,
    retry: 1,
    queryFn: async () => {
      const res = await DispatchApi.changes(since.current ?? 0);
      if (res.events.length) {
        since.current = res.lastEventId;
        qc.invalidateQueries({ queryKey: ['timeline'] });
        const ids = new Set(res.events.map((e) => e.entity_id));
        ids.forEach((id) => qc.invalidateQueries({ queryKey: ['execution-checklist', id] }));
      }
      return { ...res, receivedAt: Date.now() };
    },
  });

  const state: ConnectionState = !browserOnline || q.isError ? 'offline' : q.isFetching ? 'syncing' : 'online';
  return { state, lastSync: q.data?.receivedAt ?? null, pollSeconds: POLL_SECONDS };
}
