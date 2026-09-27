import { useEffect, useRef } from 'react';
import { useTourStore } from '../store/useTourStore';

interface AutoLaunchOptions {
  delayMs?: number;
  disabled?: boolean;
}

export function useAutoLaunchTour(tourKey: string, options: AutoLaunchOptions = {}) {
  const { delayMs = 600, disabled = false } = options;
  const { startTour, progressMap, isLoaded, isRunning } = useTourStore();
  const launchedRef = useRef(false);

  useEffect(() => {
    if (disabled || !isLoaded || isRunning || launchedRef.current) return;

    const currentStatus = progressMap[tourKey]?.status || 'not_started';
    if (currentStatus !== 'not_started') return;

    const isDialogOpen = !!document.querySelector('[role="dialog"], .modal-open, .fixed.inset-0.z-50');
    if (isDialogOpen) return;

    const timer = setTimeout(() => {
      if (!document.querySelector('[role="dialog"], .modal-open')) {
        launchedRef.current = true;
        startTour(tourKey, 0);
      }
    }, delayMs);

    return () => clearTimeout(timer);
  }, [tourKey, isLoaded, isRunning, disabled, delayMs, progressMap, startTour]);
}
