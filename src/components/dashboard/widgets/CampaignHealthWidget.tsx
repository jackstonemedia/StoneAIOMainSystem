import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { businessApi } from '../../../lib/api/business';
import type { Campaign } from '../../../types/business';
import { WidgetShell } from '../WidgetShell';

interface CampaignHealthWidgetProps {
  metrics?: unknown;
  isLoading: boolean;
  isEditing?: boolean;
  onRemove?: () => void;
}

export function CampaignHealthWidget({ isEditing, onRemove }: CampaignHealthWidgetProps) {
  const navigate = useNavigate();

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['dashboard_campaigns'],
    queryFn: () => businessApi.getCampaigns(),
  });

  const active = campaigns.filter((c) => c.status === 'active').slice(0, 4);

  return (
    <WidgetShell
      title="Campaign Health"
      subtitle="Performance of active campaigns"
      isEditing={isEditing}
      onRemove={onRemove}
    >
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-surface-hover animate-pulse" />
          ))}
        </div>
      ) : active.length === 0 ? (
        <div className="text-[13px] text-text-muted py-4">No active campaigns yet.</div>
      ) : (
        <div className="space-y-3">
          {active.map((c) => {
            const sent = c.metrics?.sent ?? c.audience?.estimatedSize ?? 0;
            const opens = c.metrics ? (c.metrics.opened / (c.metrics.sent || 1)) * 100 : 0;
            const clicks = c.metrics ? (c.metrics.clicked / (c.metrics.sent || 1)) * 100 : 0;
            return (
              <div key={c.id} className="space-y-1">
                <div className="flex items-center justify-between text-[13px]">
                  <div className="truncate text-text-main font-medium">{c.name}</div>
                  <span className="ml-2 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Active
                  </span>
                </div>
                <div className="text-[11px] text-text-muted flex items-center gap-2">
                  <span>Sent: {sent.toLocaleString()}</span>
                  <span>Opens: {opens.toFixed(1)}%</span>
                  <span>Clicks: {clicks.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-border/40 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(opens, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => navigate('/business/campaigns')}
            className="mt-2 text-[12px] font-medium text-primary hover:text-primary/80"
          >
            View Campaigns →
          </button>
        </div>
      )}
    </WidgetShell>
  );
}
