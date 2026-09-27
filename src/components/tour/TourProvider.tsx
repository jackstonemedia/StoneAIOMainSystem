import React, { useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTourStore } from '../../store/useTourStore';
import { getTour } from '../../lib/tours/registry';
import { TourOverlay } from './TourOverlay';
import { TourTooltip } from './TourTooltip';

export const TourProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    activeTourKey,
    currentStepIndex,
    isRunning,
    targetRect,
    setTargetRect,
    nextStep,
    prevStep,
    skipTour,
    loadProgress,
  } = useTourStore();

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const activeTour = activeTourKey ? getTour(activeTourKey) : null;
  const currentStep = activeTour && currentStepIndex >= 0 ? activeTour.steps[currentStepIndex] : null;

  const updateTargetRect = useCallback(() => {
    if (!isRunning || !currentStep) {
      setTargetRect(null);
      return;
    }

    const el = document.querySelector(currentStep.target);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [isRunning, currentStep, setTargetRect]);

  useEffect(() => {
    if (!isRunning || !currentStep) return;

    if (currentStep.route && location.pathname !== currentStep.route) {
      navigate(currentStep.route);
    }
  }, [isRunning, currentStep, location.pathname, navigate]);

  useEffect(() => {
    if (!isRunning || !currentStep) return;

    const el = document.querySelector(currentStep.target);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }

    const timer = setTimeout(() => {
      updateTargetRect();
    }, 250);

    return () => clearTimeout(timer);
  }, [currentStepIndex, isRunning, currentStep, updateTargetRect]);

  useEffect(() => {
    if (!isRunning) return;

    const handleRecalc = () => {
      updateTargetRect();
    };

    window.addEventListener('resize', handleRecalc);
    window.addEventListener('scroll', handleRecalc, true);

    const observer = new MutationObserver(() => {
      updateTargetRect();
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    const interval = setInterval(handleRecalc, 500);
    const timeout = setTimeout(handleRecalc, 100);

    return () => {
      window.removeEventListener('resize', handleRecalc);
      window.removeEventListener('scroll', handleRecalc, true);
      observer.disconnect();
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [updateTargetRect, currentStepIndex, isRunning, location.pathname]);

  useEffect(() => {
    if (!isRunning) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        skipTour();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          e.preventDefault();
          nextStep();
        }
      } else if (e.key === 'ArrowLeft') {
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          e.preventDefault();
          prevStep();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning, nextStep, prevStep, skipTour]);

  return (
    <>
      {children}
      {isRunning && currentStep && (
        <>
          <TourOverlay targetRect={targetRect} onBackdropClick={nextStep} />
          <TourTooltip
            step={currentStep}
            currentStepIndex={currentStepIndex}
            totalSteps={activeTour?.steps.length || 0}
            targetRect={targetRect}
          />
        </>
      )}
    </>
  );
};
