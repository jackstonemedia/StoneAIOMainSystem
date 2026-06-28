import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import type { AdAccount } from '../types/ads';

const API = '/api/ads';

async function fetchAccounts(): Promise<AdAccount[]> {
  const res = await fetch(`${API}/accounts`);
  if (!res.ok) throw new Error('Failed to fetch ad accounts');
  return res.json();
}

async function disconnectAccount(platform: string): Promise<void> {
  const res = await fetch(`${API}/accounts/${platform.toLowerCase()}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to disconnect ${platform} account`);
}

async function initOAuth(platform: 'google' | 'facebook'): Promise<string> {
  const res = await fetch(`${API}/oauth/${platform}/init`);
  if (!res.ok) throw new Error('Failed to initiate OAuth');
  const data = await res.json();
  return data.url;
}

async function completeOAuth(
  platform: 'google' | 'facebook',
  tokens: unknown,
  accountId: string,
  accountName: string,
  pages?: unknown,
): Promise<void> {
  const res = await fetch(`${API}/oauth/${platform}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokens, accountId, accountName, pages }),
  });
  if (!res.ok) throw new Error('Failed to complete OAuth');
}

export function useAdAccounts() {
  return useQuery({
    queryKey: queryKeys.ads.accounts(),
    queryFn: fetchAccounts,
    staleTime: 30_000,
  });
}

export function useDisconnectAdAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (platform: string) => disconnectAccount(platform),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ads.accounts() }),
  });
}

export function useInitAdOAuth() {
  return useMutation({
    mutationFn: async (platform: 'google' | 'facebook') => {
      const url = await initOAuth(platform);
      window.location.href = url;
    },
  });
}

export function useCompleteAdOAuth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { platform: 'google' | 'facebook'; tokens: unknown; accountId: string; accountName: string; pages?: unknown }) =>
      completeOAuth(vars.platform, vars.tokens, vars.accountId, vars.accountName, vars.pages),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.ads.accounts() }),
  });
}
