import type { BusinessMetrics } from '../../../hooks/useDashboardMetrics';
import { WidgetShell } from '../WidgetShell';

interface LeaderboardWidgetProps {
  metrics?: BusinessMetrics;
  isLoading: boolean;
  isEditing?: boolean;
  onRemove?: () => void;
}

export function LeaderboardWidget({ metrics, isLoading, isEditing, onRemove }: LeaderboardWidgetProps) {
  const rows = metrics?.agentPerformance ?? [];

  return (
    <WidgetShell
      title="Top Workflows"
      subtitle="Most frequently run automations"
      isEditing={isEditing}
      onRemove={onRemove}
    >
      {isLoading && !metrics ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-surface-hover animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-[13px] text-text-muted py-4">No workflow run data yet.</div>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 5).map((r, idx) => {
            const rank = idx + 1;
            let badgeCls = '';
            if (rank === 1) badgeCls = 'bg-amber-500/10 text-amber-300 border-amber-500/50';
            else if (rank === 2) badgeCls = 'bg-slate-500/10 text-slate-200 border-slate-400/40';
            else if (rank === 3) badgeCls = 'bg-orange-500/10 text-orange-300 border-orange-500/40';

            return (
              <div
                key={r.name}
                className="relative flex items-center gap-3 p-2.5 rounded-lg border border-border/60 bg-surface/70 overflow-hidden"
              >
                <div className="w-6 h-6 rounded-full border border-border flex items-center justify-center text-[11px] font-semibold text-text-muted bg-bg/80">
                  {rank}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-text-main truncate">{r.name}</div>
                  <div className="text-[11px] text-text-muted flex items-center gap-3">
                    <span>{r.runs} runs</span>
                    <span>{r.success.toFixed(1)}% success</span>
                    <span>{r.avgTime} avg</span>
                  </div>
                </div>
                {badgeCls && (
                  <div className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeCls}`}>
                    Top {rank}
                  </div>
                )}
                <div
                  className="absolute inset-0 -z-10 opacity-20"
                  style={{
                    background:
                      'radial-gradient(circle at 0% 0%, rgba(82,103,125,0.5), transparent 55%), radial-gradient(circle at 100% 100%, rgba(16,185,129,0.4), transparent 50%)',
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </WidgetShell>
  );
}
