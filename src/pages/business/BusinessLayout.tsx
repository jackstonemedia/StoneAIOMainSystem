import { Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import BusinessOnboarding from './BusinessOnboarding';

const ONBOARDING_KEY = 'stone-aio-business-onboarded';

export default function BusinessLayout() {
  const location = useLocation();

  // Persist onboarding state in localStorage so it survives page refresh
  const [hasOnboarded, setHasOnboarded] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ONBOARDING_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const completeOnboarding = () => {
    try {
      localStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {}
    setHasOnboarded(true);
  };

  if (!hasOnboarded) {
    return <BusinessOnboarding onComplete={completeOnboarding} />;
  }

  return (
    <div
      className="flex h-full w-full"
      style={{ background: 'var(--bg)', color: 'var(--text-main)' }}
    >
      <main className="flex-1 overflow-hidden flex flex-col w-full">
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
