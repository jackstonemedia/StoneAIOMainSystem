/**
 * A safe version of Clerk's useUser hook that doesn't throw 
 * if ClerkProvider is missing (e.g. in development bypass mode).
 */
export function useSafeUser() {
  const isDevBypass = !import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  if (isDevBypass) {
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

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useUser } = require('@clerk/clerk-react');
    return useUser();
  } catch (e) {
    return { user: null, isLoaded: true, isSignedIn: false };
  }
}
