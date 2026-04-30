/**
 * Typed Business Hub API functions.
 * Replaces untyped functions in src/lib/api.ts for the /business namespace.
 */
import { apiClient } from '../apiClient';
import type {
  Campaign,
  CreateCampaignInput,
  UpdateCampaignInput,
  Appointment,
  CreateAppointmentInput,
  UpdateAppointmentInput,
  Review,
} from '../../types/business';

export const businessApi = {
  // ── Campaigns ────────────────────────────────────────────────────────────────
  getCampaigns: () =>
    apiClient.get<Campaign[]>('/business/campaigns').then((r) => r.data),

  createCampaign: (data: CreateCampaignInput) =>
    apiClient.post<Campaign>('/business/campaigns', data).then((r) => r.data),

  updateCampaign: (id: string, data: UpdateCampaignInput) =>
    apiClient.put<Campaign>(`/business/campaigns/${id}`, data).then((r) => r.data),

  deleteCampaign: (id: string) =>
    apiClient.delete(`/business/campaigns/${id}`).then((r) => r.data),

  // ── Appointments ─────────────────────────────────────────────────────────────
  getAppointments: () =>
    apiClient.get<Appointment[]>('/business/appointments').then((r) => r.data),

  createAppointment: (data: CreateAppointmentInput) =>
    apiClient.post<Appointment>('/business/appointments', data).then((r) => r.data),

  updateAppointment: (id: string, data: UpdateAppointmentInput) =>
    apiClient.put<Appointment>(`/business/appointments/${id}`, data).then((r) => r.data),

  deleteAppointment: (id: string) =>
    apiClient.delete(`/business/appointments/${id}`).then((r) => r.data),

  // ── Reviews ──────────────────────────────────────────────────────────────────
  getReviews: () =>
    apiClient.get<Review[]>('/business/reviews').then((r) => r.data),

  createReview: (data: Omit<Review, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>) =>
    apiClient.post<Review>('/business/reviews', data).then((r) => r.data),

  // ── Forms ────────────────────────────────────────────────────────────────────
  getForms: () =>
    apiClient.get<unknown[]>('/business/forms').then((r) => r.data),

  createForm: (data: Record<string, unknown>) =>
    apiClient.post<unknown>('/business/forms', data).then((r) => r.data),

  // ── Analytics ────────────────────────────────────────────────────────────────
  getAnalytics: (params?: { from?: string; to?: string }) =>
    apiClient.get<Record<string, unknown>>('/business/analytics', { params }).then((r) => r.data),
};
