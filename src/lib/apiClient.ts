/**
 * Typed axios instance for all Stone AIO API calls.
 *
 * Auth token injection uses a module-level ref updated by AuthTokenProvider.
 * This ensures the interceptor is registered ONCE at module load time,
 * so no requests ever fire without it — regardless of React render timing.
 */
import axios from 'axios';

// Module-level ref: updated by AuthTokenProvider when Clerk session is ready
let _getToken: (() => Promise<string | null>) | null = null;

/** Called by AuthTokenProvider to wire in the Clerk getToken function */
export function setTokenGetter(fn: (() => Promise<string | null>) | null) {
  _getToken = fn;
}

/** Returns the current JWT, or null in dev-bypass mode or when not signed in. */
export async function getStoredToken(): Promise<string | null> {
  if (!_getToken) return null;
  try { return await _getToken(); } catch { return null; }
}

/**
 * Extracts a clean, human-readable error message from any API error.
 * Works with axios errors, fetch Response objects, or plain Error instances.
 *
 * Use this in catch blocks to get a consistent string to show users:
 *   toast('error', 'Failed', extractApiError(err));
 */
export function extractApiError(err: unknown): string {
  if (!err) return 'An unexpected error occurred';
  // Axios-style error (already normalized by response interceptor)
  if (err instanceof Error) return err.message || 'An unexpected error occurred';
  // Plain object with error/message field (raw API response shape)
  if (typeof err === 'object') {
    const e = err as Record<string, unknown>;
    if (typeof e['error'] === 'string') return e['error'];
    if (typeof e['message'] === 'string') return e['message'];
  }
  return String(err) || 'An unexpected error occurred';
}

/**
 * Authenticated fetch() drop-in — attaches the Clerk JWT just like apiClient does.
 * Unlike raw fetch(), throws a normalized Error on non-2xx responses so callers
 * get consistent error handling regardless of which fetch utility they use.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers ?? {}) as Record<string, string>),
  };
  if (_getToken) {
    try {
      const token = await _getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch { /* proceed without token */ }
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.clone().json() as Record<string, unknown>;
      if (typeof body['error'] === 'string') message = body['error'];
      else if (typeof body['message'] === 'string') message = body['message'];
    } catch { /* body not JSON — keep status-based message */ }
    throw new Error(message);
  }

  return response;
}

export const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — always registered, token fetched per-request ─────────
apiClient.interceptors.request.use(async (config) => {
  if (_getToken) {
    try {
      const token = await _getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Token fetch failed — proceed without auth (will get 401 from server)
    }
  }
  return config;
});

// ── Response interceptor — normalize errors ───────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (err) => {
    const message =
      err.response?.data?.error ??
      err.response?.data?.message ??
      err.message ??
      'An unexpected error occurred';
    return Promise.reject(new Error(message));
  },
);
