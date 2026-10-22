/**
 * Client-side Sentry error monitoring (B-2).
 *
 * No-op when VITE_SENTRY_DSN is empty: the app runs exactly as before without a DSN.
 * Error monitoring only — no tracing, no Session Replay, no PII. (Installed
 * @sentry/react v11 has no `sendDefaultPii` option; the SDK does not attach
 * user PII by default, and our code passes only error + component-stack context.)
 *
 * The DSN param is injectable (defaults to the Vite build-time env) so tests can pass a
 * dummy DSN + a `beforeSend` that drops the event before any network happens.
 * Follows the codebase's `(import.meta as any).env` pattern (see src/lib/clerkConfig.ts) —
 * there are no vite/client types in this repo.
 */
import * as Sentry from '@sentry/react';
import type { BrowserOptions } from '@sentry/react';

type InitOptions = Pick<BrowserOptions, 'beforeSend'>;

let initialized = false;

export function isSentryEnabled(): boolean {
  return initialized;
}

export function initSentry(
  dsn: string | undefined = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_SENTRY_DSN ?? ''),
  options?: InitOptions,
): boolean {
  if (initialized) return true;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.MODE ??
      'development'),
    ...(options?.beforeSend ? { beforeSend: options.beforeSend } : {}),
  });
  initialized = true;
  return true;
}

/** Capture a client error in Sentry. No-op (returns null) when Sentry is not initialized. */
export function captureClientError(
  error: unknown,
  context?: Record<string, unknown>,
): string | null {
  if (!initialized) return null;
  try {
    return Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    // Monitoring must never break the app.
    return null;
  }
}
