import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, Play, RotateCcw, CheckCircle2, ChevronRight, Compass, Sparkles } from 'lucide-react';
import { useTourStore } from '../../store/useTourStore';
import { getAllTours, getTourForRoute } from '../../lib/tours/registry';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../ui/Toast';

export const TourLauncher: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { startTour, resetTour, progressMap } = useTourStore();
  const currentTour = getTourForRoute(location.pathname);
  const allTours = getAllTours();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleStartCurrent = () => {
    setIsOpen(false);
    if (currentTour) {
      startTour(currentTour.key, 0);
    }
  };

  const handleStartTour = (key: string, route?: string) => {
    setIsOpen(false);
    if (route && location.pathname !== route) {
      navigate(route);
      setTimeout(() => {
        startTour(key, 0);
      }, 300);
    } else {
      startTour(key, 0);
    }
  };

  const handleResetCurrent = async () => {
    if (!currentTour) return;
    await resetTour(currentTour.key);
    toast('success', 'Tour Reset', `Reset ${currentTour.title} tour.`);
  };

  const handleResetAll = async () => {
    setIsOpen(false);
    await resetTour();
    toast('success', 'All Tours Reset', 'You can now replay any section walkthrough from the start.');
  };

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 hover:bg-surface-hover"
        style={{
          background: 'var(--surface, rgba(255,255,255,0.06))',
          borderColor: 'var(--border, rgba(255,255,255,0.15))',
          color: 'var(--text-main, #ffffff)',
        }}
        title="Interactive Product Tours and Help"
      >
        <Compass className="w-3.5 h-3.5 text-primary" />
        <span className="hidden sm:inline">Product Tour</span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 rounded-xl bg-zinc-900/95 text-white border border-white/15 p-3 shadow-2xl backdrop-blur-2xl z-[9999] animate-in fade-in slide-in-from-top-2 duration-150"
          style={{ background: 'var(--surface, #18181b)' }}
        >
          <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold tracking-wide uppercase text-zinc-300">
                Feature Walkthroughs
              </span>
            </div>
            <button
              onClick={handleResetAll}
              className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
              title="Reset all tour progress"
            >
              <RotateCcw className="w-3 h-3" />
              Reset All
            </button>
          </div>

          {currentTour && (
            <div className="mb-3 p-2.5 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{currentTour.title}</span>
                {progressMap[currentTour.key]?.status === 'completed' && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-green-400">
                    <CheckCircle2 className="w-3 h-3" /> Completed
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                {currentTour.description}
              </p>
              <div className="flex items-center gap-2 mt-2.5">
                <button
                  onClick={handleStartCurrent}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <Play className="w-3 h-3 fill-current" />
                  {progressMap[currentTour.key]?.status === 'completed' ? 'Replay Tour' : 'Start Tour'}
                </button>
                <button
                  onClick={handleResetCurrent}
                  className="px-2 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-zinc-300 text-xs transition-colors"
                  title="Reset this tour"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          <div className="px-2 py-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              All Section Tours
            </span>
          </div>

          <div className="space-y-1 max-h-48 overflow-y-auto pr-1 mt-1">
            {allTours.map((t) => {
              const status = progressMap[t.key]?.status || 'not_started';
              const isCompleted = status === 'completed';

              return (
                <button
                  key={t.key}
                  onClick={() => handleStartTour(t.key, t.steps[0]?.route)}
                  className="w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors hover:bg-white/10 group"
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-medium text-zinc-200 group-hover:text-white truncate">
                      {t.title}
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate">
                      {t.section} • {t.steps.length} steps
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
