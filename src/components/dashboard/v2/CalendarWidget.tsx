import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Appointment } from '../../../types/business';
import { DashboardFadeIn } from './DashboardPanel';

interface CalendarWidgetProps {
  appointments: Appointment[];
  isLoading: boolean;
  compact?: boolean;
}

const TYPE_DOT: Record<string, string> = {
  call: 'bg-[#F59E0B]',
  meeting: 'bg-[#EF4444]',
  task: 'bg-[#8B5CF6]',
  default: 'bg-primary',
};

function apptType(a: Appointment): string {
  const t = (a.type || a.title || '').toLowerCase();
  if (t.includes('call')) return 'call';
  if (t.includes('meet')) return 'meeting';
  if (t.includes('task')) return 'task';
  return 'default';
}

export function CalendarWidget({ appointments, isLoading, compact }: CalendarWidgetProps) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const firstOfMonth = new Date(currentYear, currentMonth, 1);
  const startDay = firstOfMonth.getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const cells = useMemo(() => {
    const result: { day: number | null; dots: string[]; isToday: boolean }[] = [];
    for (let i = 0; i < startDay; i++) result.push({ day: null, dots: [], isToday: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const dayAppts = appointments.filter((a) => {
        const dt = new Date(a.startTime);
        return dt.getFullYear() === currentYear && dt.getMonth() === currentMonth && dt.getDate() === d;
      });
      const dots = [...new Set(dayAppts.map((a) => TYPE_DOT[apptType(a)] || TYPE_DOT.default))].slice(0, 3);
      result.push({ day: d, dots, isToday: now.getDate() === d });
    }
    while (result.length % 7 !== 0) result.push({ day: null, dots: [], isToday: false });
    return result;
  }, [appointments, currentMonth, currentYear, startDay, daysInMonth, now]);

  const upcoming = useMemo(() => {
    const t = now.getTime();
    return [...appointments]
      .filter((a) => new Date(a.startTime).getTime() >= t)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, compact ? 0 : 4);
  }, [appointments, now, compact]);

  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const monthName = now.toLocaleDateString(undefined, { month: 'long' });
  const upcomingCount = appointments.filter((a) => new Date(a.startTime).getTime() >= now.getTime()).length;

  return (
    <DashboardFadeIn delay={0.15} className="h-full">
      <div className="rounded-[8px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 overflow-hidden flex flex-col h-full">

        {/* Top band — matches contacts thead */}
        <div className="px-5 py-3 border-b border-border/50 bg-surface/80 backdrop-blur-md flex items-center justify-between shrink-0">
          <div>
            <span className="text-label-caps mb-0.5 block">Schedule</span>
            <h3 className="text-[15px] font-semibold tracking-tight text-text-main">Calendar</h3>
          </div>
          {/* Month navigation inline with header */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="w-6 h-6 rounded-md border border-border/50 bg-bg flex items-center justify-center text-text-muted hover:text-text-main hover:border-border transition-colors duration-150"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <span className="font-semibold text-[12px] text-text-main whitespace-nowrap">
              {monthName} {currentYear}
            </span>
            <button
              type="button"
              className="w-6 h-6 rounded-md border border-border/50 bg-bg flex items-center justify-center text-text-muted hover:text-text-main hover:border-border transition-colors duration-150"
              aria-label="Next month"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Calendar grid body */}
        <div className="flex-1 px-5 py-4">
          {isLoading ? (
            <div className="flex-1 skeleton rounded-lg min-h-[180px]" />
          ) : (
            <>
              <div className="grid grid-cols-7 gap-y-3 text-center mb-1">
                {dayNames.map((d, i) => (
                  <div key={i} className="text-[10px] font-semibold text-text-muted uppercase tracking-wide">
                    {d}
                  </div>
                ))}
                {cells.map((cell, idx) => (
                  <div key={idx} className="relative flex flex-col items-center justify-center h-8">
                    {cell.day != null && (
                      <>
                        <span
                          className={`text-[11px] font-semibold w-7 h-7 flex items-center justify-center rounded-full z-10 transition-colors duration-150 ${
                            cell.isToday
                              ? 'bg-primary/15 text-text-main ring-1 ring-primary/40'
                              : 'text-text-muted hover:text-text-main'
                          }`}
                        >
                          {cell.day}
                        </span>
                        {cell.dots.length > 0 && (
                          <span className="flex gap-0.5 absolute -bottom-0.5">
                            {cell.dots.map((c, i) => (
                              <span key={i} className={`w-1 h-1 rounded-full ${c}`} />
                            ))}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Upcoming list */}
              {upcoming.length > 0 && (
                <div className="mt-4 border-t border-border/40 pt-3">
                  <span className="text-label-caps mb-2 block">Next up</span>
                  <ul>
                    {upcoming.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-2 text-[12px] py-2 px-2 rounded-lg hover:bg-surface-hover/50 transition-colors duration-150 border-b border-border/30 last:border-0"
                      >
                        <span className="font-medium text-text-main truncate">{a.title || 'Appointment'}</span>
                        <span className="text-text-muted whitespace-nowrap shrink-0 opacity-70 text-[11px]">
                          {new Date(a.startTime).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom band — legend + action link, matches contacts footer */}
        <div className="px-5 py-2.5 border-t border-border/50 bg-surface flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 text-[10px] font-semibold text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${TYPE_DOT.call}`} /> Call
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${TYPE_DOT.meeting}`} /> Meeting
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${TYPE_DOT.task}`} /> Task
            </span>
          </div>
          <Link to="/business/calendar" className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {upcomingCount > 0 ? `${upcomingCount} upcoming` : 'Open'}
          </Link>
        </div>

      </div>
    </DashboardFadeIn>
  );
}
