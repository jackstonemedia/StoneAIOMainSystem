/**
 * Typed client for the Create with AI backend (Milestone 1).
 * Paths are relative to the apiClient base (which already points at /api).
 */

import { apiClient } from './apiClient';

export type BusinessProfile = {
  id: string;
  workspaceId: string;
  businessName: string;
  businessType: string;
  services: string;
  serviceArea: string;
  senderName: string;
  replyToEmail: string;
  physicalAddress: string;
  bookingLink: string | null;
  phone: string | null;
  customerType: string | null;
  voiceDescription: string | null;
  wordsToAvoid: string | null;
  websiteUrl: string | null;
  differentiators: string | null;
  guaranteesProof: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WritingSample = {
  id: string;
  profileId: string;
  title: string;
  content: string;
  source: 'paste' | 'upload';
  styleSummary: Record<string, unknown> | null;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProfileResponse = {
  profile: BusinessProfile | null;
  samples: WritingSample[];
  missingRequired: string[];
};

export type PrefillResponse = {
  suggestions: Partial<Record<string, string>>;
  sources: Partial<Record<string, string>>;
  pagesFetched: string[];
};

const BASE = '/email-marketing/create-with-ai';

export async function getProfile(): Promise<ProfileResponse> {
  const r = await apiClient.get(`${BASE}/profile`);
  return r.data;
}

export async function saveProfile(data: Record<string, unknown>): Promise<{ profile: BusinessProfile }> {
  const r = await apiClient.post(`${BASE}/profile`, data);
  return r.data;
}

export async function updateProfile(data: Record<string, unknown>): Promise<{ profile: BusinessProfile }> {
  const r = await apiClient.patch(`${BASE}/profile`, data);
  return r.data;
}

export async function addSamplePaste(title: string, content: string): Promise<{ sample: WritingSample }> {
  const r = await apiClient.post(`${BASE}/samples`, { title, source: 'paste', content });
  return r.data;
}

export async function addSampleUpload(
  title: string,
  fileName: string,
  mimeType: string,
  contentBase64: string,
): Promise<{ sample: WritingSample }> {
  const r = await apiClient.post(`${BASE}/samples`, { title, source: 'upload', fileName, mimeType, contentBase64 });
  return r.data;
}

export async function updateSample(
  sampleId: string,
  patch: Record<string, unknown>,
): Promise<{ sample: WritingSample }> {
  const r = await apiClient.patch(`${BASE}/samples/${sampleId}`, patch);
  return r.data;
}

export async function deleteSample(sampleId: string): Promise<void> {
  await apiClient.delete(`${BASE}/samples/${sampleId}`);
}

export async function generateStyleSummary(sampleId: string): Promise<{ sample: WritingSample }> {
  const r = await apiClient.post(`${BASE}/samples/${sampleId}/style-summary`, {});
  return r.data;
}

export async function prefillFromWebsite(websiteUrl: string): Promise<PrefillResponse> {
  const r = await apiClient.post(`${BASE}/prefill`, { websiteUrl });
  return r.data;
}

/** Reads a File as base64 (without the data: prefix) for upload. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

/* ── Interview drafts (Milestone 2) ─────────────────────────────────────────── */

export type InterviewPhase = 'goal' | 'audience' | 'cta';
export type DraftPhase = InterviewPhase | 'brief_confirm';

export type ChecklistItemState = {
  id: string;
  label: string;
  kind: 'base' | 'extra';
  reason?: string;
  status: 'missing' | 'vague' | 'complete' | 'placeholder';
  userWords: string;
  fact: string;
  attempts: number;
  blocksSending: boolean;
};

export type ChatMessageState = {
  role: 'user' | 'ai';
  text: string;
  phase: DraftPhase;
  kind: 'answer' | 'question' | 'recap' | 'transition' | 'brief' | 'system';
  target?: string;
  at: string;
};

export type CampaignDraftState = {
  id: string;
  workspaceId: string;
  currentPhase: DraftPhase;
  status: string;
  profileSnapshot: Record<string, unknown>;
  conversation: ChatMessageState[];
  checklists: Partial<
    Record<
      InterviewPhase,
      {
        items: ChecklistItemState[];
        needsReview: boolean;
        flags?: {
          coldContacts?: boolean | null;
          listHints?: Record<string, string | undefined>;
          estimatedSize?: number | null;
        };
      }
    >
  >;
  brief: Record<string, unknown> | null;
  briefVersion: number;
  profileNotedAt: string | null;
  expiresAt: string;
};

export type TurnResultState = {
  draft: CampaignDraftState;
  aiText: string;
  phaseCompleted: boolean;
  capped: boolean;
  briefReady: boolean;
};

const DRAFTS = `${BASE}/drafts`;

export async function createDraft(): Promise<{ draft: CampaignDraftState }> {
  const r = await apiClient.post(DRAFTS, {});
  return r.data;
}

export async function listDrafts(): Promise<{ drafts: CampaignDraftState[] }> {
  const r = await apiClient.get(DRAFTS);
  return r.data;
}

export async function getDraft(draftId: string): Promise<{ draft: CampaignDraftState }> {
  const r = await apiClient.get(`${DRAFTS}/${draftId}`);
  return r.data;
}

export async function deleteDraft(draftId: string): Promise<void> {
  await apiClient.delete(`${DRAFTS}/${draftId}`);
}

export async function sendTurn(draftId: string, message: string): Promise<TurnResultState> {
  const r = await apiClient.post(`${DRAFTS}/${draftId}/turn`, { message });
  return r.data;
}

export async function retryTurn(draftId: string): Promise<TurnResultState> {
  const r = await apiClient.post(`${DRAFTS}/${draftId}/retry`, {});
  return r.data;
}

export async function escapeHatch(draftId: string): Promise<{ draft: CampaignDraftState }> {
  const r = await apiClient.post(`${DRAFTS}/${draftId}/escape-hatch`, {});
  return r.data;
}

export async function reopenPhase(
  draftId: string,
  phase: InterviewPhase,
): Promise<{ draft: CampaignDraftState }> {
  const r = await apiClient.post(`${DRAFTS}/${draftId}/reopen`, { phase });
  return r.data;
}

export async function confirmBrief(
  draftId: string,
  confirmation: string,
): Promise<{ draft: CampaignDraftState; turn?: TurnResultState }> {
  const r = await apiClient.post(`${DRAFTS}/${draftId}/confirm-brief`, { confirmation });
  return r.data;
}

export async function updateDraftSnapshot(
  draftId: string,
  action: 'regenerate' | 'keep',
): Promise<{ draft: CampaignDraftState }> {
  const r = await apiClient.post(`${DRAFTS}/${draftId}/snapshot`, { action });
  return r.data;
}
