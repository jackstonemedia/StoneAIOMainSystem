import React, { useEffect } from 'react';
import { setTokenGetter } from './apiClient';
import { IS_DEV_AUTH_BYPASS } from './clerkConfig';

export function AuthTokenProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (IS_DEV_AUTH_BYPASS) return;

    const setupTokenGetter = () => {
      const clerk = (window as any).Clerk;
      if (clerk) {
        setTokenGetter(async () => {
          if (clerk.session) {
            return await clerk.session.getToken();
          }
          return null;
        });
        if (typeof clerk.addListener === 'function') {
          clerk.addListener((emission: any) => {
            if (emission.session) {
              setTokenGetter(async () => await emission.session.getToken());
            } else {
              setTokenGetter(null);
            }
          });
        }
      }
    };

    setupTokenGetter();
    const timer = setTimeout(setupTokenGetter, 500);

    return () => {
      clearTimeout(timer);
      setTokenGetter(null);
    };
  }, []);

  return <>{children}</>;
}
