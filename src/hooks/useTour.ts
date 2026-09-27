import { useTourStore } from '../store/useTourStore';
import { getTour } from '../lib/tours/registry';

export function useTour() {
  const store = useTourStore();
  const activeTour = store.activeTourKey ? getTour(store.activeTourKey) : null;
  const currentStep = activeTour?.steps[store.currentStepIndex] || null;

  return {
    ...store,
    activeTour,
    currentStep,
  };
}
