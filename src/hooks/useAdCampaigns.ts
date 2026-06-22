import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import type { AdCampaign, CampaignDraft } from '../types/ads';

const API = '/api/ads';

async function fetchCampaigns(filters?: Record<string, string>): Promise<AdCampaign[]> {
  const params = new URLSearchParams(filters ?? {});
  const res = await fetch(`${API}/campaigns?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch campaigns');
  return res.json();
}

async function fetchCampaign(id: string): Promise<AdCampaign> {
  const res = await fetch(`${API}/campaigns/${id}`);
  if (!res.ok) throw new Error('Campaign not found');
  return res.json();
}

async function createCampaign(data: Partial<CampaignDraft>): Promise<AdCampaign> {
  const res = await fetch(`${API}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? 'Failed to create campaign');
  }
  return res.json();
}

async function updateCampaign(id: string, data: Partial<CampaignDraft>): Promise<AdCampaign> {
  const res = await fetch(`${API}/campaigns/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update campaign');
  return res.json();
}

async function launchCampaign(id: string): Promise<{ success: boolean; reason?: string }> {
  const res = await fetch(`${API}/campaigns/${id}/launch`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.reason || data.error || 'Launch failed');
  }
  return data;
}

async function pauseCampaign(id: string): Promise<AdCampaign> {
  const res = await fetch(`${API}/campaigns/${id}/pause`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to pause campaign');
  return res.json();
}

async function resumeCampaign(id: string): Promise<AdCampaign> {
  const res = await fetch(`${API}/campaigns/${id}/resume`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to resume campaign');
  return res.json();
}

async function duplicateCampaign(id: string): Promise<AdCampaign> {
  const res = await fetch(`${API}/campaigns/${id}/duplicate`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to duplicate campaign');
  return res.json();
}

async function deleteCampaign(id: string): Promise<void> {
  const res = await fetch(`${API}/campaigns/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete campaign');
}

async function bulkAction(action: 'pause' | 'resume' | 'delete', ids: string[]): Promise<void> {
  const res = await fetch(`${API}/campaigns/bulk/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error(`Bulk ${action} failed`);
}

export function useAdCampaigns(filters?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.ads.campaigns(filters),
    queryFn: () => fetchCampaigns(filters),
    staleTime: 60_000,
  });
}

export function useAdCampaign(id: string) {
  return useQuery({
    queryKey: queryKeys.ads.campaign(id),
    queryFn: () => fetchCampaign(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ads.all }),
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CampaignDraft> }) => updateCampaign(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ads.all }),
  });
}

export function useLaunchCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: launchCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ads.all }),
  });
}

export function usePauseCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pauseCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ads.all }),
  });
}

export function useResumeCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: resumeCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ads.all }),
  });
}

export function useDuplicateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: duplicateCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ads.all }),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ads.all }),
  });
}

export function useBulkCampaignAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, ids }: { action: 'pause' | 'resume' | 'delete'; ids: string[] }) => bulkAction(action, ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ads.all }),
  });
}
