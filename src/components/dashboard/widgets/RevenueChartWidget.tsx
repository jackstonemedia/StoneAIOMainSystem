import { useState } from 'react';
import type { BusinessMetrics } from '../../../hooks/useDashboardMetrics';
import { WidgetShell } from '../WidgetShell';

interface RevenueChartWidgetProps {
  metrics?: BusinessMetrics;
  isLoading: boolean;
  isEditing?: boolean;
  onRemove?: () => void;
}

const FALLBACK_SERIES = [38, 42, 41, 55, 52, 62, 58, 71, 68, 78, 82, 92];

function AreaChart({ data, color }: { data: number[]; color: string }) {
  if (!data.length) data = FALLBACK_SERIES;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const w = 300, h = 80;
  const pts = data.map((v, i) => ({ x: (i / (data.length - 1)) * w, y: h - ((v - min) / range) * h }));
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaD = `M0,${h} L${pts.map((p) => `${p.x},${p.y}`).join(' L')} L${w},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`rev-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#rev-${color})`} />
      <path d={pathD} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PERIODS: { id: '7d' | '30d' | '90d' | '1y'; label: string }[] = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: '1y', label: '1y' },
];

function sliceForPeriod(series: number[], period: '7d' | '30d' | '90d' | '1y') {
  if (!series.length) return FALLBACK_SERIES;
  if (period === '1y') return series;
  if (period === '90d') return series.slice(-6);
  if (period === '30d') return series.slice(-4);
  return series.slice(-2);
}

export function RevenueChartWidget({ metrics, isLoading, isEditing, onRemove }: RevenueChartWidgetProps) {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('1y');
  const base = metrics?.revenue?.trend && metrics.revenue.trend.length ? metrics.revenue.trend : FALLBACK_SERIES;
  const data = sliceForPeriod(base, period);

  return (
    <WidgetShell
      title="Revenue Trend"
      subtitle="Rolling revenue over time"
      isEditing={isEditing}
      onRemove={onRemove}
      noPadding
    >
      {isLoading && !metrics ? (
        <div className="p-6">
          <div className="h-6 w-32 rounded bg-surface-hover mb-4 animate-pulse" />
          <div className="h-32 rounded-xl bg-surface-hover animate-pulse" />
        </div>
      ) : (
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-sm font-semibold text-text-main">Revenue Trend</div>
              <div className="text-xs text-text-muted mt-0.5">12-month rolling revenue</div>
            </div>
            <div className="flex bg-bg border border-border rounded-lg p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    period === p.id
                      ? 'bg-surface text-primary border border-border shadow-sm'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-32">
            <AreaChart data={data} color="var(--primary)" />
          </div>
        </div>
      )}
    </WidgetShell>
  );
}
