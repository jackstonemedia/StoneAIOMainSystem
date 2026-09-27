const viteEnv = (import.meta as any).env ?? {};

// Publishable keys are intentionally public — they must be in the client bundle.
// Fallback ensures this works even if VITE_ env var wasn't embedded at build time.
export const CLERK_PUBLISHABLE_KEY =
  viteEnv.VITE_CLERK_PUBLISHABLE_KEY ||
  'pk_test_c3VyZS1zcGFuaWVsLTg3LmNsZXJrLmFjY291bnRzLmRldiQ';

export const IS_DEV_AUTH_BYPASS =
  Boolean(viteEnv.DEV && viteEnv.VITE_DEV_AUTH_BYPASS === 'true');
