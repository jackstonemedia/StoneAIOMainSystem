/**
 * App Mode Store
 * Controls whether the user is in "Creator Studio" or "Business Hub" mode.
 * Persisted to localStorage so it survives page refresh.
 */

import { createContext, useContext, useState, useEffect, type ReactNode, createElement } from 'react';

export type AppMode = 'creator' | 'business';

interface ModeContextValue {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
}

const ModeContext = createContext<ModeContextValue>({
  mode: 'creator',
  setMode: () => {},
  toggleMode: () => {},
});

const STORAGE_KEY = 'stone-aio-mode';

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return (stored === 'business' || stored === 'creator') ? stored : 'creator';
    } catch {
      return 'creator';
    }
  });

  const setMode = (newMode: AppMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch {}
  };

  const toggleMode = () => setMode(mode === 'creator' ? 'business' : 'creator');

  return createElement(ModeContext.Provider, { value: { mode, setMode, toggleMode } }, children);
}

export function useMode() {
  return useContext(ModeContext);
}
