/**
 * AuthTokenProvider — wires Clerk's getToken into the apiClient module ref.
 *
 * Must be rendered INSIDE <ClerkProvider>. On mount (synchronous via layout effect),
 * it sets the token getter so the first request already has auth.
 */
import { useLayoutEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { setTokenGetter } from './apiClient';

export function AuthTokenProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn } = useAuth();

  // useLayoutEffect fires before browser paint — before React Query first renders
  useLayoutEffect(() => {
    if (isSignedIn) {
      setTokenGetter(getToken);
    } else {
      setTokenGetter(null);
    }

    return () => {
      setTokenGetter(null);
    };
  }, [isSignedIn, getToken]);

  return <>{children}</>;
}
