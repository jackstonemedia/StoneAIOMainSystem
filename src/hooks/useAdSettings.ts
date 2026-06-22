import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import type { AdWorkspaceSettings } from '../types/ads';

const API = '/api/ads/settings';

async function fetchSettings(): Promise<AdWorkspaceSettings> {
  const res = await fetch(API);
  if (!res.ok) throw new Error('Failed to fetch ad settings');
  return res.json();
}

async function updateSettings(data: Partial<AdWorkspaceSettings>): Promise<AdWorkspaceSettings> {
  const res = await fetch(API, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}

async function pauseAll(): Promise<{ pausedCount: number }> {
  const res = await fetch(`${API}/pause-all`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to pause all campaigns');
  return res.json();
}

export function useAdSettings() {
  return useQuery({
    queryKey: queryKeys.ads.settings(),
    queryFn: fetchSettings,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateAdSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ads.settings() }),
  });
}

export function usePauseAllCampaigns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pauseAll,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ads.all }),
  });
}
