// @ts-ignore
export const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';

export const IS_DEV_AUTH_BYPASS = !CLERK_PUBLISHABLE_KEY;
