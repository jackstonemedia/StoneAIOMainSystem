const viteEnv = (import.meta as any).env ?? {};

export const CLERK_PUBLISHABLE_KEY = viteEnv.VITE_CLERK_PUBLISHABLE_KEY || '';

export const IS_DEV_AUTH_BYPASS =
  viteEnv.VITE_DEV_AUTH_BYPASS === 'true' ||
  (!CLERK_PUBLISHABLE_KEY && viteEnv.DEV);
