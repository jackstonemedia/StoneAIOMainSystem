import { create } from 'zustand';
import { apiFetch } from '../lib/apiClient';
import type { TourProgressItem, TourStatus } from '../lib/tours/types';
import { getTour } from '../lib/tours/registry';

interface TourStoreState {
  activeTourKey: string | null;
  currentStepIndex: number;
  isRunning: boolean;
  isPaused: boolean;
  targetRect: DOMRect | null;
  progressMap: Record<string, TourProgressItem>;
  isLoaded: boolean;

  fetchProgress: () => Promise<void>;
  loadProgress: () => Promise<void>;
  startTour: (tourKey: string, stepIndex?: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  skipTour: () => void;
  completeTour: () => void;
  stopTour: () => void;
  resetTour: (tourKey?: string) => Promise<void>;
  setTargetRect: (rect: DOMRect | null) => void;
  setPaused: (paused: boolean) => void;
  getStatus: (tourKey: string) => TourStatus;
}

const LOCAL_STORAGE_PROGRESS_KEY = 'stone_aio_tour_progress';

function loadLocalProgress(): Record<string, TourProgressItem> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalProgress(progress: Record<string, TourProgressItem>) {
  try {
    localStorage.setItem(LOCAL_STORAGE_PROGRESS_KEY, JSON.stringify(progress));
  } catch {}
}

export const useTourStore = create<TourStoreState>((set, get) => ({
  activeTourKey: null,
  currentStepIndex: 0,
  isRunning: false,
  isPaused: false,
  targetRect: null,
  progressMap: loadLocalProgress(),
  isLoaded: false,

  getStatus: (tourKey: string) => {
    const item = get().progressMap[tourKey];
    return item?.status || 'not_started';
  },

  fetchProgress: async () => {
    try {
      const res = await apiFetch('/api/onboarding/progress');
      if (res.ok) {
        const data = await res.json();
        if (data && data.progress) {
          const merged = { ...loadLocalProgress(), ...data.progress };
          saveLocalProgress(merged);
          set({ progressMap: merged, isLoaded: true });
          return;
        }
      }
    } catch (e) {
      console.warn('[TourStore] Failed to fetch server progress, using local cache', e);
    }
    set({ isLoaded: true });
  },

  loadProgress: async () => {
    if (!get().isLoaded) {
      await get().fetchProgress();
    }
  },

  startTour: (tourKey: string, stepIndex = 0) => {
    const tour = getTour(tourKey);
    if (!tour || tour.steps.length === 0) return;

    const boundedIndex = Math.max(0, Math.min(stepIndex, tour.steps.length - 1));
    const newProgress = {
      ...get().progressMap,
      [tourKey]: {
        status: 'in_progress' as TourStatus,
        stepIndex: boundedIndex,
      },
    };

    saveLocalProgress(newProgress);
    set({
      activeTourKey: tourKey,
      currentStepIndex: boundedIndex,
      isRunning: true,
      isPaused: false,
      progressMap: newProgress,
    });

    apiFetch(`/api/onboarding/progress/${tourKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress', stepIndex: boundedIndex }),
    }).catch((err) => console.warn('[TourStore] Failed to sync progress to server:', err));
  },

  nextStep: () => {
    const { activeTourKey, currentStepIndex } = get();
    if (!activeTourKey) return;

    const tour = getTour(activeTourKey);
    if (!tour) return;

    if (currentStepIndex < tour.steps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      const newProgress = {
        ...get().progressMap,
        [activeTourKey]: {
          status: 'in_progress' as TourStatus,
          stepIndex: nextIndex,
        },
      };

      saveLocalProgress(newProgress);
      set({ currentStepIndex: nextIndex, progressMap: newProgress });

      apiFetch(`/api/onboarding/progress/${activeTourKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress', stepIndex: nextIndex }),
      }).catch(() => {});
    } else {
      get().completeTour();
    }
  },

  prevStep: () => {
    const { activeTourKey, currentStepIndex } = get();
    if (!activeTourKey || currentStepIndex <= 0) return;

    const prevIndex = currentStepIndex - 1;
    const newProgress = {
      ...get().progressMap,
      [activeTourKey]: {
        status: 'in_progress' as TourStatus,
        stepIndex: prevIndex,
      },
    };

    saveLocalProgress(newProgress);
    set({ currentStepIndex: prevIndex, progressMap: newProgress });

    apiFetch(`/api/onboarding/progress/${activeTourKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress', stepIndex: prevIndex }),
    }).catch(() => {});
  },

  goToStep: (index: number) => {
    const { activeTourKey } = get();
    if (!activeTourKey) return;

    const tour = getTour(activeTourKey);
    if (!tour) return;

    const safeIndex = Math.max(0, Math.min(index, tour.steps.length - 1));
    const newProgress = {
      ...get().progressMap,
      [activeTourKey]: {
        status: 'in_progress' as TourStatus,
        stepIndex: safeIndex,
      },
    };

    saveLocalProgress(newProgress);
    set({ currentStepIndex: safeIndex, progressMap: newProgress });

    apiFetch(`/api/onboarding/progress/${activeTourKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress', stepIndex: safeIndex }),
    }).catch(() => {});
  },

  skipTour: () => {
    const { activeTourKey } = get();
    if (activeTourKey) {
      const newProgress = {
        ...get().progressMap,
        [activeTourKey]: {
          status: 'skipped' as TourStatus,
          stepIndex: get().currentStepIndex,
        },
      };
      saveLocalProgress(newProgress);
      set({
        isRunning: false,
        activeTourKey: null,
        targetRect: null,
        progressMap: newProgress,
      });

      apiFetch(`/api/onboarding/progress/${activeTourKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'skipped', stepIndex: get().currentStepIndex }),
      }).catch(() => {});
    } else {
      get().stopTour();
    }
  },

  completeTour: () => {
    const { activeTourKey } = get();
    if (activeTourKey) {
      const newProgress = {
        ...get().progressMap,
        [activeTourKey]: {
          status: 'completed' as TourStatus,
          stepIndex: get().currentStepIndex,
          completedAt: new Date().toISOString(),
        },
      };
      saveLocalProgress(newProgress);
      set({
        isRunning: false,
        activeTourKey: null,
        targetRect: null,
        progressMap: newProgress,
      });

      apiFetch(`/api/onboarding/progress/${activeTourKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', stepIndex: get().currentStepIndex }),
      }).catch(() => {});
    } else {
      get().stopTour();
    }
  },

  stopTour: () => {
    set({
      isRunning: false,
      activeTourKey: null,
      targetRect: null,
      isPaused: false,
    });
  },

  resetTour: async (tourKey?: string) => {
    if (tourKey) {
      const newProgress = { ...get().progressMap };
      delete newProgress[tourKey];
      saveLocalProgress(newProgress);
      set({
        progressMap: newProgress,
        ...(get().activeTourKey === tourKey ? { isRunning: false, activeTourKey: null, targetRect: null } : {}),
      });

      try {
        await apiFetch('/api/onboarding/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tourKey }),
        });
      } catch (e) {
        console.warn('[TourStore] Failed to reset server progress:', e);
      }
    } else {
      saveLocalProgress({});
      set({
        progressMap: {},
        isRunning: false,
        activeTourKey: null,
        targetRect: null,
      });

      try {
        await apiFetch('/api/onboarding/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
      } catch (e) {
        console.warn('[TourStore] Failed to reset all server progress:', e);
      }
    }
  },

  setTargetRect: (targetRect: DOMRect | null) => set({ targetRect }),
  setPaused: (isPaused: boolean) => set({ isPaused }),
}));
