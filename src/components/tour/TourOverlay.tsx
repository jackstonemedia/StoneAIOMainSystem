import React from 'react';
import { useTourStore } from '../../store/useTourStore';

interface TourOverlayProps {
  targetRect: DOMRect | null;
  padding?: number;
  onBackdropClick?: () => void;
}

export const TourOverlay: React.FC<TourOverlayProps> = ({
  targetRect,
  padding = 6,
  onBackdropClick,
}) => {
  const isRunning = useTourStore((s) => s.isRunning);

  if (!isRunning) return null;

  if (!targetRect) {
    return (
      <div 
        className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 pointer-events-auto"
        onClick={onBackdropClick}
      />
    );
  }

  const x = Math.max(0, targetRect.left - padding);
  const y = Math.max(0, targetRect.top - padding);
  const width = Math.min(window.innerWidth - x, targetRect.width + padding * 2);
  const height = Math.min(window.innerHeight - y, targetRect.height + padding * 2);
  const radius = 8;

  return (
    <div className="fixed inset-0 z-[9990] pointer-events-none overflow-hidden">
      <svg 
        className="w-full h-full absolute inset-0 pointer-events-auto"
        style={{ width: '100vw', height: '100vh' }}
        onClick={onBackdropClick}
      >
        <defs>
          <mask id="stone-tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={x}
              y={y}
              width={width}
              height={height}
              rx={radius}
              ry={radius}
              fill="black"
              className="transition-all duration-300 ease-out"
            />
          </mask>
        </defs>

        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(10, 15, 29, 0.72)"
          mask="url(#stone-tour-spotlight-mask)"
        />

        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={radius}
          ry={radius}
          fill="none"
          stroke="var(--primary, #6366f1)"
          strokeWidth="2"
          strokeDasharray="4 2"
          className="transition-all duration-300 ease-out opacity-90 animate-pulse pointer-events-none"
        />
      </svg>
    </div>
  );
};
