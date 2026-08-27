import type { MetricWidgetConfig, MetricKey } from '../../../types/dashboard';
import type { BusinessMetrics } from '../../../hooks/useDashboardMetrics';
import { DollarSign, TrendingUp, Users, BarChart3, Mail, CheckCircle2, Eye, MousePointer, Percent, AlertTriangle, ShieldAlert, UserMinus } from 'lucide-react';
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
  conversion: 'Lead Conversion',
  email_sent: 'Emails Sent',
  email_delivered: 'Delivered',
  email_unique_opens: 'Unique Opens',
  email_total_opens: 'Total Opens',
  email_unique_clicks: 'Unique Clicks',
  email_total_clicks: 'Total Clicks',
  email_open_rate: 'Open Rate',
  email_click_rate: 'Click Rate',
  email_hard_bounces: 'Hard Bounces',
  email_soft_bounces: 'Soft Bounces',
  email_complaints: 'Spam Complaints',
  email_unsubscribes: 'Unsubscribes',
};

const ICONS: Partial<Record<MetricKey, { icon: React.ComponentType<any>; color: string; bg: string }>> = {
  revenue: { icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  pipeline: { icon: TrendingUp, color: 'text-text-muted', bg: 'bg-primary/10' },
  contacts: { icon: Users, color: 'text-text-muted', bg: 'bg-primary/10' },
  conversion: { icon: Percent, color: 'text-text-muted', bg: 'bg-primary/10' },
  email_sent: { icon: Mail, color: 'text-sky-400', bg: 'bg-sky-500/10' },
  email_delivered: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  email_unique_opens: { icon: Eye, color: 'text-violet-400', bg: 'bg-violet-500/10' },
  email_total_opens: { icon: Eye, color: 'text-violet-400', bg: 'bg-violet-500/10' },
  email_unique_clicks: { icon: MousePointer, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  email_total_clicks: { icon: MousePointer, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  email_open_rate: { icon: Percent, color: 'text-violet-400', bg: 'bg-violet-500/10' },
  email_click_rate: { icon: Percent, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  email_hard_bounces: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
  email_soft_bounces: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  email_complaints: { icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/10' },
  email_unsubscribes: { icon: UserMinus, color: 'text-red-400', bg: 'bg-red-500/10' },
};

function numberMetric(value: number) {
  return {
    valueLabel: value.toLocaleString(),
    change: undefined,
    trend: 'neutral' as const,
    sparkline: undefined,
  };
}

function rateMetric(value: number) {
  return {
    valueLabel: (value.toFixed(1)) + '%',
    change: undefined,
    trend: 'neutral' as const,
    sparkline: undefined,
  };
}

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
  const lead = stages.find((stage) => stage.name === 'Lead');
  const won = stages.find((stage) => stage.name === 'Won');
  const rate = lead && lead.count > 0 && won ? (won.count / lead.count) * 100 : 0;

  return {
    valueLabel: (rate.toFixed(1)) + '%',
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
    case 'email_sent': return numberMetric(metrics?.email?.sent ?? 0);
    case 'email_delivered': return numberMetric(metrics?.email?.delivered ?? 0);
    case 'email_unique_opens': return numberMetric(metrics?.email?.uniqueOpens ?? 0);
    case 'email_total_opens': return numberMetric(metrics?.email?.totalOpens ?? 0);
    case 'email_unique_clicks': return numberMetric(metrics?.email?.uniqueClicks ?? 0);
    case 'email_total_clicks': return numberMetric(metrics?.email?.totalClicks ?? 0);
    case 'email_open_rate': {
      const delivered = metrics?.email?.delivered ?? 0;
      const opens = metrics?.email?.uniqueOpens ?? 0;
      return rateMetric(delivered > 0 ? opens / delivered * 100 : 0);
    }
    case 'email_click_rate': {
      const delivered = metrics?.email?.delivered ?? 0;
      const clicks = metrics?.email?.uniqueClicks ?? 0;
      return rateMetric(delivered > 0 ? clicks / delivered * 100 : 0);
    }
    case 'email_hard_bounces': return numberMetric(metrics?.email?.hardBounces ?? 0);
    case 'email_soft_bounces': return numberMetric(metrics?.email?.softBounces ?? 0);
    case 'email_complaints': return numberMetric(metrics?.email?.complaints ?? 0);
    case 'email_unsubscribes': return numberMetric(metrics?.email?.unsubscribes ?? 0);
    default:
      return numberMetric(0);
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
