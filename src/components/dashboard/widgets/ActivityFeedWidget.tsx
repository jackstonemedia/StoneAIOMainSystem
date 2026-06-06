import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Mail, Users, Bot, Star, CheckSquare, Activity as ActivityIcon, Info } from 'lucide-react';
import type { Activity } from '../../../types/crm';
import { WidgetShell } from '../WidgetShell';

interface ActivityFeedWidgetProps {
  isEditing?: boolean;
  onRemove?: () => void;
}

type Visual = {
  label: string;
  hex: string;
  Icon: typeof ActivityIcon;
};

function getVisualForActivity(a: Activity): Visual {
  const t = a.type?.toLowerCase() ?? '';

  if (t.includes('deal') || t.includes('opportun')) {
    return { label: 'Deal', hex: '#EF4444', Icon: DollarSign };
  }
  if (t.includes('campaign') || t.includes('email')) {
    return { label: 'Campaign', hex: '#52677D', Icon: Mail };
  }
  if (t.includes('contact') || t.includes('lead')) {
    return { label: 'Contact', hex: '#14B8A6', Icon: Users };
  }
  if (t.includes('agent') || t.includes('workflow') || t.includes('automation')) {
    return { label: 'Automation', hex: '#8B5CF6', Icon: Bot };
  }
  if (t.includes('review') || t.includes('rating')) {
    return { label: 'Review', hex: '#10B981', Icon: Star };
  }
  if (t.includes('task') || t.includes('todo')) {
    return { label: 'Task', hex: '#F59E0B', Icon: CheckSquare };
  }

  return { label: 'Activity', hex: '#64748B', Icon: ActivityIcon };
}

function formatTimeAgo(iso: string): string {
  const created = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ActivityFeedWidget({ isEditing, onRemove }: ActivityFeedWidgetProps) {
  const navigate = useNavigate();

  const {
    data: activities = [],
    isLoading,
    isError,
  } = useQuery<Activity[]>({
    queryKey: ['dashboard_activity'],
    queryFn: async () => {
      const res = await fetch('/api/crm/activities');
      if (!res.ok) throw new Error('Failed to load activity');
      const body = await res.json();
      return Array.isArray(body) ? body : body.activities ?? [];
    },
    refetchInterval: 30_000,
  });

  const actions = (
    <button
      type="button"
      className="text-[12px] text-primary hover:text-primary/80 font-medium"
      onClick={() => navigate('/crm/contacts')}
    >
      View all activity 
    </button>
  );

  return (
    <WidgetShell
      title="Recent Activity"
      subtitle="Live feed across your workspace"
      isEditing={isEditing}
      onRemove={onRemove}
      actions={actions}
      noPadding
    >
      <div className="max-h-full overflow-y-auto">
        {isLoading ? (
          <div className="divide-y divide-border/60">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-8 h-8 rounded-lg bg-surface-hover border border-border/70 animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="h-3.5 rounded bg-surface-hover animate-pulse" />
                  <div className="h-2.5 w-1/3 rounded bg-surface-hover animate-pulse" />
                </div>
                <div className="w-10 h-3 rounded bg-surface-hover animate-pulse" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="px-5 py-3.5 text-xs text-red-300 bg-red-950/40 border-b border-border/60 flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-red-400" />
            <span>Could not load recent activity. Please try again in a moment.</span>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-8 text-center text-[13px] text-text-muted">
            <div className="w-9 h-9 rounded-full border border-border flex items-center justify-center mb-2">
              <ActivityIcon className="w-4 h-4 text-primary" />
            </div>
            <div>No recent activity yet</div>
            <p className="mt-1 text-[12px] text-text-muted">
              As you send campaigns, move deals, and work contacts, they will show up here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {activities.map((activity, i) => {
              const { Icon, hex, label } = getVisualForActivity(activity);
              const time = formatTimeAgo(activity.createdAt);
              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 px-5 py-3.5 hover:bg-surface-hover/80 transition-colors group animate-fade-up"
                  style={{ animationDelay: `${i * 35}ms` }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
                    style={{ background: `${hex}18`, color: hex, borderColor: 'var(--border)' }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-text-main truncate">{activity.title}</p>
                      <span className="text-[11px] text-text-muted shrink-0">{time}</span>
                    </div>
                    {activity.notes && (
                      <p className="text-[12px] text-text-muted line-clamp-2">{activity.notes}</p>
                    )}
                    <span className="inline-flex items-center px-2 py-0.5 mt-0.5 rounded-full border border-border/70 text-[11px] text-text-muted bg-surface/80">
                      {label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </WidgetShell>
  );
}
