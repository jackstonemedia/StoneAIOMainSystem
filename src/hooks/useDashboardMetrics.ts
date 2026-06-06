import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import type { DateRange } from '../types/dashboard';

interface RevenueMetrics {
  current?: number;
  trend?: number[];
}

interface PipelineMetrics {
  value?: number;
  trend?: number[];
}

interface ContactsMetrics {
  total?: number;
  trend?: number[];
}

interface PipelineStageMetrics {
  name: string;
  count: number;
  value: number;
  color: string;
}

interface CampaignSummary {
  name: string;
  sent: number;
  opens: number;
  clicks: number;
  conversions?: number;
}

interface AgentPerformanceRow {
  name: string;
  runs: number;
  success: number;
  avgTime: string;
}

export interface BusinessMetrics {
  revenue?: RevenueMetrics;
  pipeline?: PipelineMetrics;
  contacts?: ContactsMetrics;
  pipeline_stages?: PipelineStageMetrics[];
  campaigns?: CampaignSummary[];
  agentPerformance?: AgentPerformanceRow[];
}

function resolveDateRange(dateRange: DateRange) {
  if (typeof dateRange !== 'string') {
    const from = dateRange.from || undefined;
    const to = dateRange.to || undefined;
    const key = `${from ?? ''}-${to ?? ''}`;
    return { from, to, key };
  }

  const now = new Date();
  let days = 30;
  if (dateRange === '7d') days = 7;
  else if (dateRange === '30d') days = 30;
  else if (dateRange === '90d') days = 90;
  else if (dateRange === '1y') days = 365;

  const to = now.toISOString();
  const from = new Date(now.getTime() - days * 86_400_000).toISOString();
  return { from, to, key: dateRange };
}

export function useDashboardMetrics(dateRange: DateRange) {
  const { from, to, key } = resolveDateRange(dateRange);

  const query = useQuery<BusinessMetrics>({
    queryKey: ['dashboard_metrics', key],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await apiClient.get<BusinessMetrics>('/business/metrics', { params });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    metrics: query.data,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
