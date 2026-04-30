/**
 * Agent data hooks.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agentsApi } from '../lib/api/agents';
import { queryKeys } from '../lib/queryKeys';
import type { CreateAgentInput, UpdateAgentInput } from '../types/agent';

export function useAgents() {
  return useQuery({
    queryKey: queryKeys.agents.list(),
    queryFn: agentsApi.list,
    staleTime: 30_000,
  });
}

export function useAgent(id: string) {
  return useQuery({
    queryKey: queryKeys.agents.detail(id),
    queryFn: () => agentsApi.get(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAgentInput) => agentsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agents.list() });
    },
  });
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAgentInput }) =>
      agentsApi.update(id, data),
    onSuccess: (_result, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.agents.list() });
      qc.invalidateQueries({ queryKey: queryKeys.agents.detail(id) });
    },
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => agentsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.agents.list() });
    },
  });
}
