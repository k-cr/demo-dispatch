/** Cliente HTTP mínimo para la API REST de Dispatch. */

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') + '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type Params = Record<string, string | number | boolean | null | undefined | (string | number)[]>;

function qs(params?: Params) {
  if (!params) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length) sp.set(k, v.join(','));
    } else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

async function request<T>(method: string, path: string, body?: unknown, params?: Params): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${qs(params)}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        // El sistema principal puede inyectar aquí el usuario autenticado
        'X-User': (window as unknown as { __DISPATCH_USER__?: string }).__DISPATCH_USER__ ?? 'dispatch-ui',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network_error', 'No hay conexión con el servidor');
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const e = json?.error ?? {};
    throw new ApiError(res.status, e.code ?? 'http_error', e.message ?? `Error ${res.status}`, e.details);
  }
  return json as T;
}

export const http = {
  get: <T>(path: string, params?: Params) => request<T>('GET', path, undefined, params),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
