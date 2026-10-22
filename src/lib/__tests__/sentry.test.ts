/**
 * Client Sentry module tests (B-2).
 *
 * No network: the dummy-DSN test passes a `beforeSend` that records the event
 * and returns null, dropping it before any transport happens.
 * Module state (`initialized`) is isolated per test via resetModules + dynamic import.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ErrorEvent } from '@sentry/react';

const DUMMY_DSN = 'https://publickey@o0.ingest.sentry.io/0';

describe('client Sentry (B-2)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('no DSN → init returns false, capture returns null, nothing throws', async () => {
    const mod = await import('../sentry.js');
    expect(mod.initSentry('')).toBe(false);
    expect(mod.isSentryEnabled()).toBe(false);
    expect(mod.captureClientError(new Error('boom'))).toBeNull();
  });

  it('dummy DSN + dropping beforeSend → beforeSend receives the captured error', async () => {
    const seen: ErrorEvent[] = [];
    const mod = await import('../sentry.js');
    expect(
      mod.initSentry(DUMMY_DSN, {
        beforeSend: (event) => {
          seen.push(event);
          return null; // drop before any network
        },
      }),
    ).toBe(true);
    expect(mod.isSentryEnabled()).toBe(true);

    const id = mod.captureClientError(new Error('boom'), { where: 'test' });
    expect(typeof id).toBe('string');
    expect(seen).toHaveLength(1);
    const values = seen[0].exception?.values;
    expect(values?.[0]?.value).toBe('boom');
  });

  it('init is idempotent — second init returns true without re-initializing', async () => {
    const mod = await import('../sentry.js');
    expect(mod.initSentry(DUMMY_DSN, { beforeSend: () => null })).toBe(true);
    expect(mod.initSentry(DUMMY_DSN, { beforeSend: () => null })).toBe(true);
  });
});
