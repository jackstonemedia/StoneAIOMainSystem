/**
 * Company data hooks.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crmApi } from '../lib/api/crm';
import { queryKeys } from '../lib/queryKeys';
import type { CreateCompanyInput, UpdateCompanyInput } from '../types/crm';

export function useCompanies() {
  return useQuery({
    queryKey: queryKeys.crm.companies(),
    queryFn: crmApi.getCompanies,
    staleTime: 30_000,
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: queryKeys.crm.company(id),
    queryFn: () => crmApi.getCompany(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCompanyInput) => crmApi.createCompany(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.companies() });
    },
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCompanyInput }) =>
      crmApi.updateCompany(id, data),
    onSuccess: (_result, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.companies() });
      qc.invalidateQueries({ queryKey: queryKeys.crm.company(id) });
    },
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => crmApi.deleteCompany(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.companies() });
    },
  });
}
