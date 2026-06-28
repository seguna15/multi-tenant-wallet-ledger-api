import { signOut } from '@/lib/utils/auth';
import { ApiError } from '@ledger/utils';

// after
export const BASE_URL = process.env.NEXT_PUBLIC_API_URL;
export const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? '';


if (!BASE_URL) {
  throw new Error('NEXT_PUBLIC_API_URL must be set');
}

const SKIP_REFRESH_PATHS = new Set(['/auth/login', '/auth/register', '/admin/auth/login']);

const skipRefresh = (path: string) => SKIP_REFRESH_PATHS.has(path);

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

let isRefreshing = false;
let queue: Array<{ resolve: () => void; reject: (e: unknown) => void }> = [];

async function buildApiError(res: Response): Promise<ApiError> {
  const payload = await res.json().catch(() => ({}));
  return new ApiError({
    statusCode: res.status,
    message: payload?.message ?? res.statusText,
    correlationId: payload?.correlationId,
    timestamp: payload?.timestamp,
  });
}

async function refreshTokens(): Promise<void> {
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'x-api-key': API_KEY },
  });
  if (!res.ok) throw new ApiError({ statusCode: res.status, message: 'Session expired' });
}

async function request<T>(path: string, options: RequestOptions = {}, _retry = true): Promise<T> {
  const { body, headers, ...rest } = options;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    cache: 'no-store',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && _retry && !skipRefresh(path)) {
    if (isRefreshing) {
      await new Promise<void>((resolve, reject) => queue.push({ resolve, reject }));
      return request<T>(path, options, false);
    }

    isRefreshing = true;
    try {
      await refreshTokens();
      queue.forEach(({ resolve }) => resolve());
      return request<T>(path, options, false);
    } catch (err) {
      queue.forEach(({ reject }) => reject(err));
      await signOut();
      throw err;
    } finally {
      isRefreshing = false;
      queue = [];
    }
  }

  if (res.status === 401) {
    await signOut();
    throw await buildApiError(res);
  }

  if (res.status === 403) {
    await signOut();
    throw await buildApiError(res);
  }

  if (res.status >= 400) {
    throw await buildApiError(res);
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const apiClient = {
  get: <T>(path: string, opts?: RequestOptions) => request<T>(path, { method: 'GET', ...opts }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: 'POST', body, ...opts }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { method: 'PATCH', body, ...opts }),
  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { method: 'DELETE', ...opts }),
};
