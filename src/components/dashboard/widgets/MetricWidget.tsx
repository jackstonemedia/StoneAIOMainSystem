import type { MetricWidgetConfig, MetricKey } from '../../../types/dashboard';
import type { BusinessMetrics } from '../../../hooks/useDashboardMetrics';
import { DollarSign, TrendingUp, Users, BarChart3 } from 'lucide-react';
import { MetricCard } from '../../ui/MetricCard';
import { WidgetShell } from '../WidgetShell';

interface MetricWidgetProps {
  config: Partial<MetricWidgetConfig>;
  metrics?: BusinessMetrics;
  isLoading: boolean;
  isEditing?: boolean;
  onRemove?: () => void;
}

const LABELS: Record<MetricKey, string> = {
  revenue: 'Monthly Revenue',
  pipeline: 'Pipeline Value',
  contacts: 'Active Contacts',
  conversion: 'Conversion Rate',
  deals_won: 'Deals Won',
  avg_deal: 'Avg Deal Size',
  response_time: 'Response Time',
  csat: 'CSAT Score',
};

const ICONS: Partial<Record<MetricKey, { icon: React.ComponentType<any>; color: string; bg: string }>> = {
  revenue: { icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  pipeline: { icon: TrendingUp, color: 'text-text-muted', bg: 'bg-primary/10' },
  contacts: { icon: Users, color: 'text-text-muted', bg: 'bg-primary/10' },
  conversion: { icon: BarChart3, color: 'text-text-muted', bg: 'bg-primary/10' },
};

function computeRevenue(metrics?: BusinessMetrics) {
  const series = metrics?.revenue?.trend ?? [];
  const current = metrics?.revenue?.current ?? (series.length ? series[series.length - 1] : 0);
  let change: string | undefined;
  let trend: 'up' | 'down' | 'neutral' = 'neutral';

  if (series.length >= 2) {
    const prev = series[series.length - 2];
    if (prev) {
      const diff = current - prev;
      const pct = prev ? (diff / prev) * 100 : 0;
      if (!Number.isNaN(pct) && Number.isFinite(pct)) {
        change = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
        if (pct > 0) trend = 'up';
        else if (pct < 0) trend = 'down';
      }
    }
  }

  return {
    valueLabel: current ? `$${current.toLocaleString()}` : '$0',
    change,
    trend,
    sparkline: series.length ? series : undefined,
  };
}

function computePipeline(metrics?: BusinessMetrics) {
  const value = metrics?.pipeline?.value ?? 0;
  return {
    valueLabel: value ? `$${value.toLocaleString()}` : '$0',
    change: undefined,
    trend: 'neutral' as const,
    sparkline: metrics?.pipeline?.trend && metrics.pipeline.trend.length ? metrics.pipeline.trend : undefined,
  };
}

function computeContacts(metrics?: BusinessMetrics) {
  const total = metrics?.contacts?.total ?? 0;
  return {
    valueLabel: total ? total.toLocaleString() : '0',
    change: undefined,
    trend: 'neutral' as const,
    sparkline: metrics?.contacts?.trend && metrics.contacts.trend.length ? metrics.contacts.trend : undefined,
  };
}

function computeConversion(metrics?: BusinessMetrics) {
  const stages = metrics?.pipeline_stages ?? [];
  const lead = stages.find((s) => s.name === 'Lead');
  const won = stages.find((s) => s.name === 'Won');
  const rate = lead && lead.count > 0 && won ? (won.count / lead.count) * 100 : 0;
  return {
    valueLabel: `${rate.toFixed(1)}%`,
    change: undefined,
    trend: 'neutral' as const,
    sparkline: undefined,
  };
}

function getMetricData(key: MetricKey, metrics?: BusinessMetrics) {
  switch (key) {
    case 'revenue':
      return computeRevenue(metrics);
    case 'pipeline':
      return computePipeline(metrics);
    case 'contacts':
      return computeContacts(metrics);
    case 'conversion':
      return computeConversion(metrics);
    default:
      return {
        valueLabel: '—',
        change: undefined,
        trend: 'neutral' as const,
        sparkline: undefined,
      };
  }
}

export function MetricWidget({ config, metrics, isLoading, isEditing, onRemove }: MetricWidgetProps) {
  const metricKey: MetricKey = config.metricKey ?? 'revenue';
  const label = config.label ?? LABELS[metricKey];
  const showSparkline = config.showSparkline ?? true;

  const data = getMetricData(metricKey, metrics);
  const iconConf = ICONS[metricKey];
  const Icon = iconConf?.icon ?? DollarSign;
  const iconColor = iconConf?.color ?? 'text-primary';
  const iconBg = iconConf?.bg ?? 'bg-primary/10';

  return (
    <WidgetShell title={label} isEditing={isEditing} onRemove={onRemove} noPadding>
      {isLoading && !metrics ? (
        <div className="h-full flex items-center justify-center">
          <div className="w-full h-16 rounded-xl bg-surface-hover animate-pulse" />
        </div>
      ) : (
        <MetricCard
          label={label}
          value={data.valueLabel}
          change={data.change}
          trend={data.trend}
          icon={Icon}
          iconColor={iconColor}
          iconBg={iconBg}
          sparkline={showSparkline ? data.sparkline : undefined}
        />
      )}
    </WidgetShell>
  );
}
