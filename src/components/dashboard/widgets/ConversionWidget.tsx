import type { BusinessMetrics } from '../../../hooks/useDashboardMetrics';
import { WidgetShell } from '../WidgetShell';

interface ConversionWidgetProps {
  metrics?: BusinessMetrics;
  isLoading: boolean;
  isEditing?: boolean;
  onRemove?: () => void;
}

interface Pair {
  label: string;
  pct: number;
}

function buildPairs(metrics?: BusinessMetrics): { pairs: Pair[]; overall: number } {
  const stages = metrics?.pipeline_stages ?? [];
  if (!stages.length) return { pairs: [], overall: 0 };
  const pairs: Pair[] = [];
  for (let i = 0; i < stages.length - 1; i++) {
    const from = stages[i];
    const to = stages[i + 1];
    const pct = from.count ? (to.count / from.count) * 100 : 0;
    pairs.push({ label: `${from.name} → ${to.name}`, pct });
  }
  const lead = stages[0];
  const won = stages.find((s) => s.name === 'Won');
  const overall = lead && won && lead.count ? (won.count / lead.count) * 100 : 0;
  return { pairs, overall };
}

function barColor(pct: number): string {
  if (pct >= 30) return '#10B981';
  if (pct >= 15) return '#F59E0B';
  return '#EF4444';
}

export function ConversionWidget({ metrics, isLoading, isEditing, onRemove }: ConversionWidgetProps) {
  const { pairs, overall } = buildPairs(metrics);

  return (
    <WidgetShell
      title="Conversion Funnel"
      subtitle="Stage-to-stage conversion rates"
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
      ) : pairs.length === 0 ? (
        <div className="text-[13px] text-text-muted py-4">Not enough pipeline data to compute conversions.</div>
      ) : (
        <div className="space-y-3">
          {pairs.map((p) => {
            const pct = Math.round(p.pct * 10) / 10;
            const color = barColor(pct);
            return (
              <div key={p.label} className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-text-muted">
                  <span className="font-semibold tracking-[0.12em] uppercase">{p.label}</span>
                  <span className="text-[12px] font-semibold text-text-main">{pct.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-border/40 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}40` }}
                  />
                </div>
              </div>
            );
          })}
          <div className="pt-1 text-[12px] text-text-muted">
            Overall: <span className="font-semibold text-text-main">{(Math.round(overall * 10) / 10).toFixed(1)}%</span> lead → close
          </div>
        </div>
      )}
    </WidgetShell>
  );
}
