import type { BusinessMetrics } from '../../../hooks/useDashboardMetrics';
import { WidgetShell } from '../WidgetShell';

interface PipelineFunnelWidgetProps {
  metrics?: BusinessMetrics;
  isLoading: boolean;
  isEditing?: boolean;
  onRemove?: () => void;
}

export function PipelineFunnelWidget({ metrics, isLoading, isEditing, onRemove }: PipelineFunnelWidgetProps) {
  const stages = metrics?.pipeline_stages ?? [];
  const totalCount = stages.reduce((sum, s) => sum + (s.count || 0), 0) || 1;

  return (
    <WidgetShell
      title="Sales Pipeline"
      subtitle={totalCount ? `${totalCount} active deals` : 'No deals in pipeline yet'}
      isEditing={isEditing}
      onRemove={onRemove}
    >
      {isLoading && !metrics ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-32 rounded bg-surface-hover animate-pulse" />
              <div className="h-2 w-full rounded-full bg-surface-hover animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {stages.map((stage) => {
            const pct = Math.round(((stage.count || 0) / totalCount) * 100);
            return (
              <div key={stage.name} className="group cursor-pointer">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-text-muted">
                    {stage.name}
                  </span>
                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    <span>{stage.count} deals</span>
                    <span className="text-sm font-semibold text-text-main">
                      ${Math.round(stage.value / 1000).toLocaleString()}k
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-border/40 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 group-hover:opacity-90"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: stage.color,
                      boxShadow: `0 0 8px ${stage.color}40`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetShell>
  );
}
