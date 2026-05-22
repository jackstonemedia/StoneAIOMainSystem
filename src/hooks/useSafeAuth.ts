import { IS_DEV_AUTH_BYPASS } from '../lib/clerkConfig';

/**
 * A safe user helper that never calls Clerk React hooks, so it cannot throw
 * when a component is rendered outside ClerkProvider.
 */
export function useSafeUser() {
  if (IS_DEV_AUTH_BYPASS) {
    return {
      user: {
        primaryEmailAddress: { emailAddress: 'dev@stoneaio.com' },
        firstName: 'Dev',
        lastName: 'User',
        id: 'user_dev_123',
      },
      isLoaded: true,
      isSignedIn: true,
    };
  }

  const clerk = (window as any).Clerk;

  return {
    user: clerk?.user || null,
    isLoaded: !!clerk?.loaded,
    isSignedIn: !!clerk?.user,
  };
}
