import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DispatchPage } from './pages/DispatchPage';

/**
 * Punto de integración con el sistema Gestión de Equipos.
 * Puede montarse como una ruta más (ej. /operations/dispatch):
 *
 *   <Route path="/operations/dispatch" element={<DispatchModule initialProjectCode="GUA" />} />
 *
 * Para identificar al usuario en la auditoría de cambios:
 *   window.__DISPATCH_USER__ = authStore.user.email
 */
export function DispatchModule({ initialProjectCode }: { initialProjectCode?: string }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchOnWindowFocus: true, retry: 1, staleTime: 10_000 },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <DispatchPage initialProjectCode={initialProjectCode} />
    </QueryClientProvider>
  );
}
