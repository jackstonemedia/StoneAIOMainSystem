/**
 * Landing Pages API client (Wave 1 item 1.1 / outline 02-17).
 * Thin wrapper over apiFetch; the server returns the error message, and
 * apiFetch throws with it, so the UI shows the honest reason.
 */
import { apiFetch } from '../apiClient';
import type { LandingPage, LandingPageStats, PageSection } from '../../types';

export type { LandingPage, LandingPageStats, PageSection };

export interface LandingPageTemplate {
  id: string;
  name: string;
  description: string;
  sections: unknown[];
}

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export const landingPagesApi = {
  list(): Promise<LandingPage[]> {
    return apiFetch('/api/landing-pages').then(json<LandingPage[]>);
  },
  get(id: string): Promise<LandingPage> {
    return apiFetch(`/api/landing-pages/${id}`).then(json<LandingPage>);
  },
  templates(): Promise<LandingPageTemplate[]> {
    return apiFetch('/api/landing-pages/templates').then(json<LandingPageTemplate[]>);
  },
  create(input: { name: string; templateId?: string; slug?: string }): Promise<LandingPage> {
    return apiFetch('/api/landing-pages', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then(json<LandingPage>);
  },
  update(id: string, input: Partial<Pick<LandingPage, 'name' | 'slug' | 'seoTitle' | 'seoDesc'>> & { sectionsJson?: unknown }): Promise<LandingPage> {
    return apiFetch(`/api/landing-pages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }).then(json<LandingPage>);
  },
  remove(id: string): Promise<{ success: boolean }> {
    return apiFetch(`/api/landing-pages/${id}`, { method: 'DELETE' }).then(json<{ success: boolean }>);
  },
  publish(id: string): Promise<LandingPage> {
    return apiFetch(`/api/landing-pages/${id}/publish`, { method: 'POST' }).then(json<LandingPage>);
  },
  unpublish(id: string): Promise<LandingPage> {
    return apiFetch(`/api/landing-pages/${id}/unpublish`, { method: 'POST' }).then(json<LandingPage>);
  },
  duplicate(id: string): Promise<LandingPage> {
    return apiFetch(`/api/landing-pages/${id}/duplicate`, { method: 'POST' }).then(json<LandingPage>);
  },
  stats(id: string): Promise<LandingPageStats> {
    return apiFetch(`/api/landing-pages/${id}/stats`).then(json<LandingPageStats>);
  },
};

/** Public URL of a published page (same origin, no auth). */
export function publicPageUrl(slug: string): string {
  return `/p/${slug}`;
}
