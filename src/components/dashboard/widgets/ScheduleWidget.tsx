import { useQuery } from '@tanstack/react-query';
import { Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { businessApi } from '../../../lib/api/business';
import type { Appointment } from '../../../types/business';
import { WidgetShell } from '../WidgetShell';

interface ScheduleWidgetProps {
  isEditing?: boolean;
  onRemove?: () => void;
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function ScheduleWidget({ isEditing, onRemove }: ScheduleWidgetProps) {
  const navigate = useNavigate();

  const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ['dashboard_schedule'],
    queryFn: () => businessApi.getAppointments(),
  });

  const todays = appointments.filter((a) => isToday(a.startTime));

  return (
    <WidgetShell
      title="Today"
      subtitle="Upcoming calls and meetings"
      icon={Calendar}
      isEditing={isEditing}
      onRemove={onRemove}
      noPadding
    >
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/70">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span>
            Now — {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/business/calendar')}
          className="text-[11px] font-medium text-primary hover:text-primary/80"
        >
          Open Calendar →
        </button>
      </div>

      <div className="p-4 space-y-3 max-h-full overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-surface-hover animate-pulse" />
            ))}
          </div>
        ) : todays.length === 0 ? (
          <div className="text-[13px] text-text-muted py-4 text-center">No events scheduled for today.</div>
        ) : (
          todays.slice(0, 6).map((ev) => (
            <div
              key={ev.id}
              className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all border border-border bg-bg hover:border-primary/60"
            >
              <div className="w-1.5 h-10 rounded-full shrink-0 mt-0.5 bg-primary" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-main truncate">{ev.title}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {formatTime(ev.startTime)} · {ev.contact ? `${ev.contact.firstName} ${ev.contact.lastName}` : 'Unassigned'}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </WidgetShell>
  );
}
