import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, Play, ChevronRight, Sparkles, Compass, 
  Users, Zap, MailOpen, MessageSquare, Megaphone, Calendar, 
  ChevronDown, ChevronUp, RotateCcw
} from 'lucide-react';
import { useTourStore } from '../../store/useTourStore';
import { GETTING_STARTED_MILESTONES } from '../../lib/tours/gettingStarted';
import { getTour } from '../../lib/tours/registry';
import { useToast } from '../ui/Toast';

const ICON_MAP: Record<string, any> = {
  Users,
  Zap,
  MailOpen,
  MessageSquare,
  Megaphone,
  Calendar,
};

export const GettingStartedHub: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { startTour, resetTour, progressMap } = useTourStore();

  const completedCount = GETTING_STARTED_MILESTONES.filter(
    (m) => progressMap[m.tourKey]?.status === 'completed'
  ).length;
  const totalCount = GETTING_STARTED_MILESTONES.length;
  const percentage = Math.round((completedCount / totalCount) * 100);

  const handleLaunch = (tourKey: string, route: string) => {
    navigate(route);
    setTimeout(() => {
      startTour(tourKey, 0);
    }, 300);
  };

  const handleReset = async () => {
    await resetTour();
    toast('success', 'Progress Reset', 'Onboarding milestone progress has been reset.');
  };

  return (
    <div 
      className="rounded-2xl border p-5 transition-all shadow-md relative overflow-hidden"
      data-tour="getting-started-hub"
      style={{
        background: 'var(--surface, #131b2e)',
        borderColor: 'var(--border, rgba(255, 255, 255, 0.12))',
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center border border-primary/30 shadow-inner">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">
                Getting Started with Stone AIO
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/20 text-primary border border-primary/30">
                {completedCount} of {totalCount} Completed
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Master the platform step-by-step with interactive product tours.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            title={isCollapsed ? 'Expand checklist' : 'Collapse checklist'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="mt-4 mb-2">
        <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-primary rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {!isCollapsed && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in duration-200">
          {GETTING_STARTED_MILESTONES.map((milestone) => {
            const status = progressMap[milestone.tourKey]?.status || 'not_started';
            const isCompleted = status === 'completed';
            const isInProgress = status === 'in_progress';
            const Icon = ICON_MAP[milestone.icon] || Compass;

            return (
              <div
                key={milestone.id}
                className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between group ${
                  isCompleted
                    ? 'bg-green-500/5 border-green-500/20'
                    : isInProgress
                    ? 'bg-primary/5 border-primary/30'
                    : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        isCompleted
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-white/10 text-zinc-300 group-hover:text-white'
                      }`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                        {milestone.section}
                      </span>
                    </div>
                    {isCompleted && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-green-400">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Done
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-white group-hover:text-primary transition-colors">
                    {milestone.title}
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-snug line-clamp-2">
                    {milestone.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between">
                  <button
                    onClick={() => handleLaunch(milestone.tourKey, milestone.route)}
                    className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                      isCompleted
                        ? 'bg-white/10 hover:bg-white/15 text-zinc-200'
                        : 'bg-primary text-white hover:bg-primary/90 shadow-sm'
                    }`}
                  >
                    <Play className="w-3 h-3 fill-current" />
                    {isCompleted ? 'Review Tour' : isInProgress ? 'Resume Tour' : 'Start Tour'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
