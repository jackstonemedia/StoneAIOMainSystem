/**
 * Typed axios instance for all Stone AIO API calls.
 *
 * - Sets base URL to /api
 * - Attaches Clerk JWT on every request (in production)
 * - Normalizes error messages from the backend error envelope
 */
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach Clerk auth token ─────────────────────────────
apiClient.interceptors.request.use(async (config) => {
  try {
    // window.Clerk is injected by @clerk/clerk-react's ClerkProvider
    const token = await (window as any).Clerk?.session?.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // No Clerk session (dev mode) — request proceeds without auth header
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
