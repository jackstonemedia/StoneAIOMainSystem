import type { DateRange, WidgetInstance, WidgetType } from '../../types/dashboard';
import type { BusinessMetrics } from '../../hooks/useDashboardMetrics';
import { WidgetShell } from './WidgetShell';
import { MetricWidget } from './widgets/MetricWidget';
import { RevenueChartWidget } from './widgets/RevenueChartWidget';
import { PipelineFunnelWidget } from './widgets/PipelineFunnelWidget';
import { ActivityFeedWidget } from './widgets/ActivityFeedWidget';
import { TasksWidget } from './widgets/TasksWidget';
import { ScheduleWidget } from './widgets/ScheduleWidget';
import { ConversionWidget } from './widgets/ConversionWidget';
import { CampaignHealthWidget } from './widgets/CampaignHealthWidget';
import { LeaderboardWidget } from './widgets/LeaderboardWidget';
import { QuickActionsWidget } from './widgets/QuickActionsWidget';

interface WidgetRegistryProps {
  instance: WidgetInstance;
  metrics?: BusinessMetrics;
  isMetricsLoading: boolean;
  dateRange: DateRange;
  isEditing: boolean;
  onRemove: () => void;
}

export function WidgetRegistry({
  instance,
  metrics,
  isMetricsLoading,
  dateRange,
  isEditing,
  onRemove,
}: WidgetRegistryProps) {
  const { type, config } = instance;

  switch (type as WidgetType) {
    case 'metric':
      return (
        <MetricWidget
          config={config}
          metrics={metrics}
          isLoading={isMetricsLoading}
          isEditing={isEditing}
          onRemove={onRemove}
        />
      );
    case 'revenue_chart':
      return (
        <RevenueChartWidget
          metrics={metrics}
          isLoading={isMetricsLoading}
          isEditing={isEditing}
          onRemove={onRemove}
        />
      );
    case 'pipeline_funnel':
      return (
        <PipelineFunnelWidget
          metrics={metrics}
          isLoading={isMetricsLoading}
          isEditing={isEditing}
          onRemove={onRemove}
        />
      );
    case 'activity_feed':
      return (
        <ActivityFeedWidget
          isEditing={isEditing}
          onRemove={onRemove}
        />
      );
    case 'tasks':
      return (
        <TasksWidget
          isEditing={isEditing}
          onRemove={onRemove}
        />
      );
    case 'schedule':
      return (
        <ScheduleWidget
          isEditing={isEditing}
          onRemove={onRemove}
        />
      );
    case 'conversion':
      return (
        <ConversionWidget
          metrics={metrics}
          isLoading={isMetricsLoading}
          isEditing={isEditing}
          onRemove={onRemove}
        />
      );
    case 'campaign_health':
      return (
        <CampaignHealthWidget
          metrics={metrics}
          isLoading={isMetricsLoading}
          isEditing={isEditing}
          onRemove={onRemove}
        />
      );
    case 'leaderboard':
      return (
        <LeaderboardWidget
          metrics={metrics}
          isLoading={isMetricsLoading}
          isEditing={isEditing}
          onRemove={onRemove}
        />
      );
    case 'quick_actions':
      return (
        <QuickActionsWidget
          isEditing={isEditing}
          onRemove={onRemove}
        />
      );
    default:
      return (
        <WidgetShell title="Unknown widget" isEditing={isEditing} onRemove={onRemove}>
          <div className="text-sm text-text-muted">This widget type is not recognized.</div>
        </WidgetShell>
      );
  }
}
