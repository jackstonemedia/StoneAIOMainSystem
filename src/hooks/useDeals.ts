/**
 * Deal data hooks.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crmApi } from '../lib/api/crm';
import { queryKeys } from '../lib/queryKeys';
import type { CreateDealInput, UpdateDealInput } from '../types/crm';

export function useDeals() {
  return useQuery({
    queryKey: queryKeys.crm.deals(),
    queryFn: crmApi.getDeals,
    staleTime: 30_000,
  });
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDealInput) => crmApi.createDeal(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.deals() });
    },
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDealInput }) =>
      crmApi.updateDeal(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.deals() });
    },
  });
}

export function useDeleteDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => crmApi.deleteDeal(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.deals() });
    },
  });
}

export function usePipelines() {
  return useQuery({
    queryKey: queryKeys.crm.pipelines(),
    queryFn: crmApi.getPipelines,
    staleTime: 60_000,
  });
}
