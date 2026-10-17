/**
 * Server-side Sentry error monitoring (B-2).
 *
 * No-op when SENTRY_DSN is empty: the server runs exactly as before without a DSN.
 * Error monitoring only — no tracing (`tracesSampleRate: 0`), no PII. (Installed
 * @sentry/node v11 has no `sendDefaultPii` option; the SDK does not attach user
 * PII by default, and our code passes only error + method/path context.)
 *
 * The DSN param is injectable (defaults to `env.SENTRY_DSN`) so tests can pass a dummy
 * DSN + a `beforeSend` that drops the event before any network happens.
 *
 * The SDK's default integrations capture `uncaughtException` / `unhandledRejection` once
 * `initSentry()` has run (called at the top of `startServer()` in server.ts).
 */
import * as Sentry from '@sentry/node';
import type { NodeOptions } from '@sentry/node';
import { env } from '../../infrastructure/config/env.js';

type InitOptions = Pick<NodeOptions, 'beforeSend'>;

let initialized = false;

export function isSentryEnabled(): boolean {
  return initialized;
}

export function initSentry(dsn: string | undefined = env.SENTRY_DSN, options?: InitOptions): boolean {
  if (initialized) return true;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    tracesSampleRate: 0,
    ...(options?.beforeSend ? { beforeSend: options.beforeSend } : {}),
  });
  initialized = true;
  return true;
}

/** Capture a server error in Sentry. No-op (returns null) when Sentry is not initialized. */
export function captureServerError(
  error: unknown,
  context?: Record<string, unknown>,
): string | null {
  if (!initialized) return null;
  try {
    return Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    // Monitoring must never break the request.
    return null;
  }
}
