/**
 * Funnels API client (Wave 1 item 1.2 / outline 02-18).
 * Thin wrapper over apiFetch; the server returns the error message, and
 * apiFetch throws with it, so the UI shows the honest reason.
 */
import { apiFetch } from '../apiClient';

export interface FunnelStepStats {
  views: number;
  submissions: number;
  conversion: number | null;
  reachedNext: number | null;
}

export interface FunnelStep {
  id: string;
  position: number;
  landingPageId: string;
  offerTitle: string | null;
  offerBody: string | null;
  tagOnSubmit: string | null;
  campaignId: string | null;
  landingPage: { id: string; name: string; slug: string; status: string } | null;
  campaign: { id: string; name: string; status: string } | null;
  stats: FunnelStepStats;
}

export interface Funnel {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  steps: FunnelStep[];
  totals: { views: number; submissions: number; conversion: number | null };
}

export interface FunnelStepInput {
  id?: string;
  landingPageId: string;
  offerTitle?: string | null;
  offerBody?: string | null;
  tagOnSubmit?: string | null;
  campaignId?: string | null;
}

export interface FunnelSubmissionRow {
  id: string;
  submittedAt: string;
  stepId: string | null;
  answers: Record<string, unknown>;
  contact: { id: string; firstName: string; lastName: string; email: string | null } | null;
}

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export const funnelsApi = {
  list(): Promise<Funnel[]> {
    return apiFetch('/api/funnels').then(json<Funnel[]>);
  },
  get(id: string): Promise<Funnel> {
    return apiFetch(`/api/funnels/${id}`).then(json<Funnel>);
  },
  create(input: { name: string; slug?: string; steps?: FunnelStepInput[] }): Promise<Funnel> {
    return apiFetch('/api/funnels', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then(json<Funnel>);
  },
  update(
    id: string,
    input: Partial<Pick<Funnel, 'name' | 'slug'>> & { steps?: FunnelStepInput[] },
  ): Promise<Funnel> {
    return apiFetch(`/api/funnels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }).then(json<Funnel>);
  },
  remove(id: string): Promise<{ success: boolean }> {
    return apiFetch(`/api/funnels/${id}`, { method: 'DELETE' }).then(json<{ success: boolean }>);
  },
  publish(id: string): Promise<Funnel> {
    return apiFetch(`/api/funnels/${id}/publish`, { method: 'POST' }).then(json<Funnel>);
  },
  unpublish(id: string): Promise<Funnel> {
    return apiFetch(`/api/funnels/${id}/unpublish`, { method: 'POST' }).then(json<Funnel>);
  },
  duplicate(id: string): Promise<Funnel> {
    return apiFetch(`/api/funnels/${id}/duplicate`, { method: 'POST' }).then(json<Funnel>);
  },
  stats(id: string): Promise<Funnel['totals'] & { steps: FunnelStep[] }> {
    return apiFetch(`/api/funnels/${id}/stats`).then(json<Funnel['totals'] & { steps: FunnelStep[] }>);
  },
  submissions(id: string): Promise<FunnelSubmissionRow[]> {
    return apiFetch(`/api/funnels/${id}/submissions`).then(json<FunnelSubmissionRow[]>);
  },
};

/** Public URL of a funnel step (same origin, no auth). Step is 1-based. */
export function publicFunnelUrl(slug: string, step = 1): string {
  return `/f/${slug}/${step}`;
}
