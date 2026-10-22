/**
 * Server Sentry module tests (B-2).
 *
 * No network: the dummy-DSN test passes a `beforeSend` that records the event
 * and returns null, dropping it before any transport happens.
 * Module state (`initialized`) is isolated per test via resetModules + dynamic import.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ErrorEvent } from '@sentry/node';

const DUMMY_DSN = 'https://publickey@o0.ingest.sentry.io/0';

describe('server Sentry (B-2)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('no DSN → init returns false, capture returns null, nothing throws', async () => {
    const mod = await import('../sentry.js');
    expect(mod.initSentry('')).toBe(false);
    expect(mod.isSentryEnabled()).toBe(false);
    expect(mod.captureServerError(new Error('boom'))).toBeNull();
    expect(mod.captureServerError('string error')).toBeNull();
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

    const id = mod.captureServerError(new Error('boom'), { method: 'GET', path: '/x' });
    expect(typeof id).toBe('string');
    // @sentry/node processes events asynchronously — wait for beforeSend to run.
    const start = Date.now();
    while (seen.length === 0 && Date.now() - start < 5000) {
      await new Promise((r) => setTimeout(r, 25));
    }
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
