import { Mail, Phone, CalendarDays, FileText, CircleDollarSign, MessageSquare, Sparkles } from 'lucide-react';

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
  meeting: { icon: CalendarDays,    color: 'text-text-muted', bg: 'bg-primary/100/15 border-primary/30' },
  note:    { icon: FileText,        color: 'text-text-muted',  bg: 'bg-primary/100/15 border-primary/30' },
  deal:    { icon: CircleDollarSign,color: 'text-primary',    bg: 'bg-primary/15 border-primary/30' },
  sms:     { icon: MessageSquare,   color: 'text-rose-400',   bg: 'bg-rose-500/15 border-rose-500/30' },
  contact_created: { icon: Sparkles, color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' },
  deal_created: { icon: CircleDollarSign, color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30' },
  internal_comment: { icon: FileText, color: 'text-amber-500', bg: 'bg-amber-500/20 border-amber-500/40' },
};

function formatDateTime(ts: string): string {
  try {
    const d = new Date(ts);
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return `${dateStr}, ${timeStr}`;
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
    <div className="relative flex flex-col gap-4">
      {activities.map((activity, i) => {
        const config = typeConfig[activity.type] ?? typeConfig.note;
        const Icon = config.icon;

        return (
          <div
            key={activity.id}
            className={`border rounded-[8px] flex flex-col gap-3 relative shadow-sm ${compact ? 'p-3' : 'p-4'} ${activity.type === 'internal_comment' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-primary/5 border-primary/20'}`}
          >
            <div className="flex items-start justify-between">
              <div className="text-[14px] text-text-main prose prose-invert prose-p:my-0 font-medium leading-snug pr-6 flex items-start gap-3">
                <div className={`shrink-0 w-5 h-5 rounded flex items-center justify-center mt-0.5 ${config.bg}`}>
                  <Icon className={`w-3 h-3 ${config.color}`} />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-[13px]">{activity.title}</span>
                  {activity.description && !compact && (
                    <div className="mt-1 text-[13px] text-text-muted opacity-80" dangerouslySetInnerHTML={{ __html: activity.description }} />
                  )}
                  {activity.relatedName && (
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-[4px]">
                        {activity.relatedName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-text-muted">
                {formatDateTime(activity.timestamp)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
