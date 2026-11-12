/**
 * Tier 2 Fix 2 — baked-in Clerk test-key fallback removed.
 * Missing VITE_CLERK_PUBLISHABLE_KEY must fail loudly (throw in dev,
 * plain error screen in the built app) — never silently run a test app.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolveClerkAuthState } from '../clerkConfig';

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('resolveClerkAuthState', () => {
  it('ok when a key is present', () => {
    expect(resolveClerkAuthState({ publishableKey: 'pk_live_abc', devAuthBypass: false, isDev: true })).toBe('ok');
    expect(resolveClerkAuthState({ publishableKey: 'pk_live_xyz', devAuthBypass: false, isDev: false })).toBe('ok');
  });

  it('ok in dev auth bypass even with no key', () => {
    expect(resolveClerkAuthState({ publishableKey: '', devAuthBypass: true, isDev: true })).toBe('ok');
  });

  it('throws in dev when the key is missing and there is no bypass', () => {
    expect(resolveClerkAuthState({ publishableKey: '', devAuthBypass: false, isDev: true })).toBe('throw-dev');
    expect(resolveClerkAuthState({ devAuthBypass: false, isDev: true })).toBe('throw-dev');
  });

  it('error-screen in a built app when the key is missing and there is no bypass', () => {
    expect(resolveClerkAuthState({ publishableKey: '', devAuthBypass: false, isDev: false })).toBe('error-screen');
  });
});

describe('no test-app key anywhere in src/', () => {
  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) {
        // Test fixtures may mention key formats; the guard covers shipped code.
        if (entry === '__tests__') continue;
        out.push(...walk(p));
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) out.push(p);
    }
    return out;
  }

  it('no real-looking pk_test_ key literal remains in shipped client source', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC_DIR)) {
      const src = readFileSync(file, 'utf8');
      // A real publishable key has a long base64 body; this ignores comments
      // and fragments that merely mention the prefix.
      if (/pk_test_[A-Za-z0-9]{8,}/.test(src)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});

describe('App root fails loudly without a Clerk key', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('rendering App with CLERK_AUTH_STATE throw-dev throws (dev loud failure)', async () => {
    vi.resetModules();
    vi.doMock('../../lib/clerkConfig', () => ({
      CLERK_PUBLISHABLE_KEY: '',
      IS_DEV_AUTH_BYPASS: false,
      CLERK_AUTH_STATE: 'throw-dev',
    }));
    const { default: App } = await import('../../App');
    const { render } = await import('@testing-library/react');
    expect(() => render(<App />)).toThrow(/VITE_CLERK_PUBLISHABLE_KEY is not set/);
  });

  it('rendering App with CLERK_AUTH_STATE error-screen shows the plain error screen', async () => {
    vi.resetModules();
    vi.doMock('../../lib/clerkConfig', () => ({
      CLERK_PUBLISHABLE_KEY: '',
      IS_DEV_AUTH_BYPASS: false,
      CLERK_AUTH_STATE: 'error-screen',
    }));
    const { default: App } = await import('../../App');
    const { render, screen } = await import('@testing-library/react');
    render(<App />);
    expect(screen.getByText('Authentication is not configured')).toBeTruthy();
    expect(screen.getByText(/VITE_CLERK_PUBLISHABLE_KEY/)).toBeTruthy();
  });
});
