export type WidgetType =
  | 'metric'
  | 'revenue_chart'
  | 'pipeline_funnel'
  | 'activity_feed'
  | 'tasks'
  | 'schedule'
  | 'conversion'
  | 'campaign_health'
  | 'leaderboard'
  | 'quick_actions';

export interface WidgetInstance {
  id: string;
  type: WidgetType;
  config: Partial<WidgetConfig>;
}

export type MetricKey =
  | 'revenue'
  | 'pipeline'
  | 'contacts'
  | 'conversion'
  | 'deals_won'
  | 'avg_deal'
  | 'response_time'
  | 'csat';

export interface MetricWidgetConfig {
  metricKey: MetricKey;
  label?: string;
  showSparkline?: boolean;
}

export type DateRange =
  | '7d'
  | '30d'
  | '90d'
  | '1y'
  | { from: string; to: string };

export type WidgetConfig = MetricWidgetConfig;

export interface DashboardGridItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  static?: boolean;
}

export interface DashboardLayout {
  widgets: WidgetInstance[];
  gridLayout: DashboardGridItem[];
}
