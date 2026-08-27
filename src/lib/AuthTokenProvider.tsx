import React, { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { setTokenGetter } from './apiClient';
import { IS_DEV_AUTH_BYPASS } from './clerkConfig';

function AuthTokenInner() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn) {
      setTokenGetter(getToken);
    } else {
      setTokenGetter(null);
    }

    return () => {
      setTokenGetter(null);
    };
  }, [isSignedIn, getToken]);

  return null;
}

export function AuthTokenProvider({ children }: { children: React.ReactNode }) {
  if (IS_DEV_AUTH_BYPASS) {
    return <>{children}</>;
  }

  return (
    <>
      <AuthTokenInner />
      {children}
    </>
  );
}
