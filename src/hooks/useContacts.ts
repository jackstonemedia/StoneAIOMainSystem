/**
 * CRM contact data hooks — wraps TanStack Query + typed crmApi.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crmApi } from '../lib/api/crm';
import { queryKeys } from '../lib/queryKeys';
import type { CreateContactInput, UpdateContactInput } from '../types/crm';

export function useContacts() {
  return useQuery({
    queryKey: queryKeys.crm.contacts(),
    queryFn: crmApi.getContacts,
    staleTime: 30_000,
  });
}

export function useContact(id: string) {
  return useQuery({
    queryKey: queryKeys.crm.contact(id),
    queryFn: () => crmApi.getContact(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateContactInput) => crmApi.createContact(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.contacts() });
    },
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateContactInput }) =>
      crmApi.updateContact(id, data),
    onSuccess: (_result, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.contacts() });
      qc.invalidateQueries({ queryKey: queryKeys.crm.contact(id) });
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => crmApi.deleteContact(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.contacts() });
    },
  });
}

export function useBulkDeleteContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => crmApi.bulkDeleteContacts(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.contacts() });
    },
  });
}
