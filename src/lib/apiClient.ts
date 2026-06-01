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

// ── Global fetch override for /api paths ───────────────────────────────────────
const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (url.startsWith('/api') && _getToken) {
    try {
      const token = await _getToken();
      if (token) {
        init = init || {};
        const headers = new Headers(init.headers);
        headers.set('Authorization', `Bearer ${token}`);
        
        // Preserve Content-Type if it was a plain object
        if (!(init.headers instanceof Headers) && init.headers) {
           Object.entries(init.headers).forEach(([k, v]) => headers.set(k, v as string));
        }

        init.headers = headers;
      }
    } catch {
      // Proceed without token if it fails
    }
  }
  return originalFetch(input, init);
};

/**
 * Authenticated fetch() drop-in — attaches the Clerk JWT just like apiClient does.
 * Use this in any CRM page that uses raw fetch() instead of apiClient.
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
  return fetch(url, { ...options, headers });
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
