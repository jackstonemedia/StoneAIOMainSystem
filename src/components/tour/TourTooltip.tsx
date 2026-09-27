import React, { useLayoutEffect, useState, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Sparkles } from 'lucide-react';
import type { TourStep } from '../../lib/tours/types';
import { useTourStore } from '../../store/useTourStore';

interface TourTooltipProps {
  step: TourStep;
  currentStepIndex: number;
  totalSteps: number;
  targetRect: DOMRect | null;
}

export const TourTooltip: React.FC<TourTooltipProps> = ({
  step,
  currentStepIndex,
  totalSteps,
  targetRect,
}) => {
  const { nextStep, prevStep, skipTour, goToStep } = useTourStore();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; placement: string }>({
    top: window.innerHeight / 2 - 100,
    left: window.innerWidth / 2 - 180,
    placement: 'center',
  });

  useLayoutEffect(() => {
    if (!tooltipRef.current) return;
    const tooltipEl = tooltipRef.current;
    const tooltipWidth = tooltipEl.offsetWidth || 360;
    const tooltipHeight = tooltipEl.offsetHeight || 200;
    const margin = 16;
    const offset = 14;

    if (!targetRect) {
      setCoords({
        top: Math.max(margin, window.innerHeight / 2 - tooltipHeight / 2),
        left: Math.max(margin, window.innerWidth / 2 - tooltipWidth / 2),
        placement: 'center',
      });
      return;
    }

    let placement = step.placement || 'auto';
    const spaceBelow = window.innerHeight - targetRect.bottom;
    const spaceAbove = targetRect.top;
    const spaceRight = window.innerWidth - targetRect.right;
    const spaceLeft = targetRect.left;

    if (placement === 'auto') {
      if (spaceBelow >= tooltipHeight + offset + margin) {
        placement = 'bottom';
      } else if (spaceAbove >= tooltipHeight + offset + margin) {
        placement = 'top';
      } else if (spaceRight >= tooltipWidth + offset + margin) {
        placement = 'right';
      } else if (spaceLeft >= tooltipWidth + offset + margin) {
        placement = 'left';
      } else {
        placement = 'bottom';
      }
    }

    let top = 0;
    let left = 0;

    switch (placement) {
      case 'bottom':
        top = targetRect.bottom + offset;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case 'top':
        top = targetRect.top - tooltipHeight - offset;
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        break;
      case 'right':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.right + offset;
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
        left = targetRect.left - tooltipWidth - offset;
        break;
      default:
        top = targetRect.bottom + offset;
        left = targetRect.left;
    }

    left = Math.max(margin, Math.min(left, window.innerWidth - tooltipWidth - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - tooltipHeight - margin));

    setCoords({ top, left, placement });
  }, [targetRect, step, currentStepIndex]);

  const isLast = currentStepIndex === totalSteps - 1;

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[9995] w-[360px] max-w-[calc(100vw-32px)] rounded-2xl bg-zinc-900/95 text-white border border-white/20 p-5 shadow-2xl backdrop-blur-2xl transition-all duration-200 animate-in fade-in zoom-in-95 pointer-events-auto"
      style={{
        top: coords.top,
        left: coords.left,
        background: 'var(--surface, #18181b)',
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-[11px] font-bold">
            <Sparkles className="w-3 h-3" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Step {currentStepIndex + 1} of {totalSteps}
          </span>
        </div>
        <button
          onClick={skipTour}
          className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
          title="Close tour (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <h3 className="text-sm font-bold text-white tracking-tight mb-1.5">
        {step.title}
      </h3>
      <p className="text-xs text-zinc-300 leading-relaxed mb-4">
        {step.body}
      </p>

      <div className="flex items-center justify-between pt-3 border-t border-white/10">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <button
              key={i}
              onClick={() => goToStep(i)}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === currentStepIndex
                  ? 'w-5 bg-primary'
                  : i < currentStepIndex
                  ? 'w-1.5 bg-primary/40'
                  : 'w-1.5 bg-white/20 hover:bg-white/40'
              }`}
              title={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {currentStepIndex > 0 && (
            <button
              onClick={prevStep}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
          )}

          <button
            onClick={nextStep}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-primary hover:bg-primary/90 transition-colors shadow-md"
          >
            {isLast ? (
              <>
                <Check className="w-3.5 h-3.5" /> Finish
              </>
            ) : (
              <>
                Next <ChevronRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
