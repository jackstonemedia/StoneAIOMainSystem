const viteEnv = (import.meta as any).env ?? {};

// Publishable keys are intentionally public — they must be in the client bundle.
//
// Tier 2 Fix 2: there is NO fallback key. The old code silently fell back to
// a baked-in test Clerk app (pk_test_…) when VITE_CLERK_PUBLISHABLE_KEY was
// missing, so a misconfigured deploy ran auth against a test app with no
// visible error. If the key is missing now, auth is unconfigured and the app
// must fail loudly (see CLERK_AUTH_STATE / App.tsx) — never a silent test app.
export const CLERK_PUBLISHABLE_KEY = viteEnv.VITE_CLERK_PUBLISHABLE_KEY ?? '';

export const IS_DEV_AUTH_BYPASS =
  Boolean(viteEnv.DEV && viteEnv.VITE_DEV_AUTH_BYPASS === 'true');

/** How the app must react to the Clerk configuration. Pure — unit-tested. */
export type ClerkAuthState = 'ok' | 'throw-dev' | 'error-screen';

export function resolveClerkAuthState(input: {
  publishableKey?: string;
  devAuthBypass?: boolean;
  isDev?: boolean;
}): ClerkAuthState {
  if (input.publishableKey || input.devAuthBypass) return 'ok';
  // Key missing and no dev bypass: auth is unconfigured. In dev, throw so
  // the failure is loud (Vite error overlay); in the built app, App.tsx
  // renders a plain error screen instead of mounting Clerk with no key.
  return input.isDev ? 'throw-dev' : 'error-screen';
}

export const CLERK_AUTH_STATE = resolveClerkAuthState({
  publishableKey: CLERK_PUBLISHABLE_KEY,
  devAuthBypass: IS_DEV_AUTH_BYPASS,
  isDev: Boolean(viteEnv.DEV),
});
