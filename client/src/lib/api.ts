/**
 * Tiny fetch wrapper around the API.
 *
 * Reads the bearer token from localStorage and attaches it to every request.
 * Centralizes 401 handling so an expired session boots the user back to /login
 * regardless of which screen they were on.
 */

const SESSION_STORAGE_KEY = 'hp-mm-session';

const BASE_URL: string = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** When true, a 401 response does NOT auto-clear the session. Used by /auth/me probes during boot. */
  silentOn401?: boolean;
  /** Skip attaching the bearer token even if one is stored. */
  unauthenticated?: boolean;
}

export async function apiFetch<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (!opts.unauthenticated) {
    const token = getSessionToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  let body: unknown = null;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    body = await res.json().catch(() => null);
  } else {
    body = await res.text().catch(() => '');
  }

  if (!res.ok) {
    if (res.status === 401 && !opts.silentOn401) {
      clearSessionToken();
    }
    const message =
      (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : null) ?? `${res.status} ${res.statusText}`;
    throw new ApiError(message, res.status, body);
  }
  return body as T;
}

// ---------------------------------------------------------------------------
// Session-token helpers
// ---------------------------------------------------------------------------

export function getSessionToken(): string | null {
  try {
    return window.localStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string): void {
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, token);
  } catch {
    /* localStorage disabled — silently fail */
  }
}

export function clearSessionToken(): void {
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* noop */
  }
}

export const apiBaseUrl = BASE_URL;
