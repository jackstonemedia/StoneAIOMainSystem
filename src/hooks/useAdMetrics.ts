import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import type { DashboardMetrics, DailyMetricPoint } from '../types/ads';

const API = '/api/ads/metrics';

export interface MetricsFilters {
  preset?: string;
  platform?: string;
  start?: string;
  end?: string;
}

async function fetchDashboardMetrics(filters: MetricsFilters): Promise<DashboardMetrics> {
  const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => !!v) as [string, string][]);
  const res = await fetch(`${API}/dashboard?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch dashboard metrics');
  return res.json();
}

async function fetchChartData(filters: MetricsFilters): Promise<DailyMetricPoint[]> {
  const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => !!v) as [string, string][]);
  const res = await fetch(`${API}/chart?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch chart data');
  return res.json();
}

async function fetchCampaignMetrics(id: string, filters: MetricsFilters) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => !!v) as [string, string][]);
  const res = await fetch(`${API}/campaigns/${id}?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch campaign metrics');
  return res.json();
}

export function useAdDashboardMetrics(filters: MetricsFilters = {}) {
  return useQuery({
    queryKey: queryKeys.ads.metrics(filters as Record<string, string>),
    queryFn: () => fetchDashboardMetrics(filters),
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });
}

export function useAdChartData(filters: MetricsFilters = {}) {
  return useQuery({
    queryKey: queryKeys.ads.chartData(filters as Record<string, string>),
    queryFn: () => fetchChartData(filters),
    staleTime: 5 * 60_000,
  });
}

export function useCampaignMetrics(id: string, filters: MetricsFilters = {}) {
  return useQuery({
    queryKey: queryKeys.ads.campaignMetrics(id, filters as Record<string, string>),
    queryFn: () => fetchCampaignMetrics(id, filters),
    enabled: !!id,
    staleTime: 5 * 60_000,
  });
}
