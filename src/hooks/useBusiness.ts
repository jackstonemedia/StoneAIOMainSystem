/**
 * Campaign & business hub data hooks.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { businessApi } from '../lib/api/business';
import { queryKeys } from '../lib/queryKeys';
import type {
  CreateCampaignInput,
  UpdateCampaignInput,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from '../types/business';

// ── Campaigns ─────────────────────────────────────────────────────────────────

export function useCampaigns() {
  return useQuery({
    queryKey: queryKeys.business.campaigns(),
    queryFn: businessApi.getCampaigns,
    staleTime: 30_000,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCampaignInput) => businessApi.createCampaign(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.business.campaigns() });
    },
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCampaignInput }) =>
      businessApi.updateCampaign(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.business.campaigns() });
    },
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => businessApi.deleteCampaign(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.business.campaigns() });
    },
  });
}

// ── Appointments ──────────────────────────────────────────────────────────────

export function useAppointments() {
  return useQuery({
    queryKey: queryKeys.business.appointments(),
    queryFn: businessApi.getAppointments,
    staleTime: 30_000,
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAppointmentInput) => businessApi.createAppointment(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.business.appointments() });
    },
  });
}

export function useUpdateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAppointmentInput }) =>
      businessApi.updateAppointment(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.business.appointments() });
    },
  });
}

export function useDeleteAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => businessApi.deleteAppointment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.business.appointments() });
    },
  });
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export function useReviews() {
  return useQuery({
    queryKey: queryKeys.business.reviews(),
    queryFn: businessApi.getReviews,
    staleTime: 60_000,
  });
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export function useAnalytics(params?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: [...queryKeys.business.analytics(), params],
    queryFn: () => businessApi.getAnalytics(params),
    staleTime: 60_000,
  });
}
