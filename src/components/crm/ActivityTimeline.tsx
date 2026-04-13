import { Mail, Phone, CalendarDays, FileText, CircleDollarSign, MessageSquare } from 'lucide-react';

export interface TimelineActivity {
  id: string;
  type: 'email' | 'call' | 'meeting' | 'note' | 'deal' | 'sms' | string;
  title: string;
  description?: string;
  timestamp: string;
  relatedName?: string;
}

interface ActivityTimelineProps {
  activities: TimelineActivity[];
  compact?: boolean;
}

const typeConfig: Record<string, { icon: any; color: string; bg: string }> = {
  email:   { icon: Mail,            color: 'text-sky-400',    bg: 'bg-sky-500/15 border-sky-500/30' },
  call:    { icon: Phone,           color: 'text-green-400',  bg: 'bg-green-500/15 border-green-500/30' },
  meeting: { icon: CalendarDays,    color: 'text-purple-400', bg: 'bg-purple-500/15 border-purple-500/30' },
  note:    { icon: FileText,        color: 'text-amber-400',  bg: 'bg-amber-500/15 border-amber-500/30' },
  deal:    { icon: CircleDollarSign,color: 'text-primary',    bg: 'bg-primary/15 border-primary/30' },
  sms:     { icon: MessageSquare,   color: 'text-rose-400',   bg: 'bg-rose-500/15 border-rose-500/30' },
};

function relativeTime(ts: string): string {
  try {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return ts;
  }
}

export default function ActivityTimeline({ activities, compact = false }: ActivityTimelineProps) {
  if (!activities.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-muted">
        <CalendarDays className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">No activities yet</p>
        <p className="text-xs mt-1 opacity-60">Log a call, email, or meeting to get started.</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-0">
      {/* Vertical line */}
      <div className="absolute left-[19px] top-5 bottom-5 w-px bg-border/50" />

      {activities.map((activity, i) => {
        const config = typeConfig[activity.type] ?? typeConfig.note;
        const Icon = config.icon;

        return (
          <div
            key={activity.id}
            className={`relative flex gap-4 group ${compact ? 'py-2' : 'py-3'} ${i !== activities.length - 1 ? '' : ''}`}
          >
            {/* Icon */}
            <div className={`shrink-0 w-10 h-10 rounded-full border flex items-center justify-center z-10 ${config.bg} transition-transform group-hover:scale-110`}>
              <Icon className={`w-4 h-4 ${config.color}`} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 bg-surface/50 rounded-xl border border-border/50 px-4 py-2.5 group-hover:border-border transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-main truncate">{activity.title}</p>
                  {activity.description && !compact && (
                    <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{activity.description}</p>
                  )}
                  {activity.relatedName && (
                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium text-primary/70 bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
                      {activity.relatedName}
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-[10px] text-text-muted whitespace-nowrap pt-0.5">{relativeTime(activity.timestamp)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
