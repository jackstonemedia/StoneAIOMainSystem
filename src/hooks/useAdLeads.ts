import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import type { AdLead, AdsApiListResponse } from '../types/ads';

const API = '/api/ads/leads';

export interface LeadFilters {
  campaignId?: string;
  platform?: string;
  syncStatus?: string;
  page?: number;
  pageSize?: number;
}

async function fetchLeads(filters: LeadFilters): Promise<AdsApiListResponse<AdLead>> {
  const params = new URLSearchParams(
    Object.entries(filters)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)])
  );
  const res = await fetch(`${API}?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch leads');
  return res.json();
}

async function retrySync(id: string): Promise<void> {
  const res = await fetch(`${API}/${id}/retry-sync`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to retry lead sync');
}

async function bulkRetrySync(campaignId?: string): Promise<{ total: number; succeeded: number; failed: number }> {
  const res = await fetch(`${API}/bulk-retry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignId }),
  });
  if (!res.ok) throw new Error('Failed to bulk retry lead sync');
  return res.json();
}

export function useAdLeads(filters: LeadFilters = {}) {
  return useQuery({
    queryKey: queryKeys.ads.leads(Object.fromEntries(Object.entries(filters).map(([k, v]) => [k, String(v ?? '')]))),
    queryFn: () => fetchLeads(filters),
    staleTime: 30_000,
  });
}

export function useRetryLeadSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: retrySync,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ads.leads() }),
  });
}

export function useBulkRetryLeadSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (campaignId?: string) => bulkRetrySync(campaignId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ads.leads() }),
  });
}
