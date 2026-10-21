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
export type DraftPhase = InterviewPhase | 'brief_confirm' | 'draft_refine' | 'review_send';

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

/* ── Draft + Refine, Review + Send (Milestone 3) ───────────────────────────── */

export type DraftEmailState = {
  id: string;
  draftId: string;
  campaignId: string | null;
  kind: string;
  order: number;
  name: string;
  purpose: string | null;
  subjectVariants: string[];
  subjectSelected: number;
  previewText: string | null;
  bodyHtml: string;
  bodyText: string;
  cta: Record<string, unknown> | null;
  factMap: { claim: string; source: string }[];
  versions: {
    subjects: string[];
    subjectSelected: number;
    previewText: string | null;
    bodyHtml: string;
    bodyText: string;
    factMap: { claim: string; source: string }[];
    note: string;
    at: string;
  }[];
  status: string;
  scheduledAtUtc: string | null;
  coldAck: boolean;
  recipientCount: number | null;
  placeholders: string[];
  removedClaims: { claim: string; where: string }[];
};

export type RecipientResolutionState = {
  sourceType: 'segment' | 'smartList' | 'list' | 'csv';
  sourceId: string | null;
  sourceName: string | null;
  totalCandidates: number;
  selected: { email: string; contactId?: string; firstName?: string; lastName?: string; phone?: string; company?: string }[];
  excluded: { key: string; label: string; count: number; contacts: { email: string; contactId?: string }[] }[];
  phase2ExclusionsNote: string | null;
  mismatch: { applicable: boolean; mismatchPct: number | null; warned: boolean; detail: string };
  csvContacts: { email: string; firstName?: string; lastName?: string; phone?: string; company?: string }[];
  csvRejected: { row: number; email: string; reason: string }[];
  csvDuplicates: number;
  tokenCoverage: Record<string, { missing: number; total: number }>;
  tokensUsed: string[];
};

export type SendChecksState = {
  blocking: string[];
  warnings: string[];
  links: { url: string; ok: boolean; status?: number }[];
  domainAuth: { domain: string | null; spf: boolean; dkim: boolean; verified: boolean; note: string };
};

export async function generateEmail(draftId: string): Promise<{ email: DraftEmailState }> {
  const r = await apiClient.post(`${DRAFTS}/${draftId}/generate-email`, {});
  return r.data;
}

export async function listDraftEmails(draftId: string): Promise<{ emails: DraftEmailState[] }> {
  const r = await apiClient.get(`${DRAFTS}/${draftId}/emails`);
  return r.data;
}

export async function getDraftEmail(emailId: string): Promise<{ email: DraftEmailState }> {
  const r = await apiClient.get(`${BASE}/emails/${emailId}`);
  return r.data;
}

export async function editDraftEmail(
  emailId: string,
  patch: Partial<{ subjectVariants: string[]; subjectSelected: number; previewText: string; bodyHtml: string; bodyText: string }>,
): Promise<{ email: DraftEmailState }> {
  const r = await apiClient.patch(`${BASE}/emails/${emailId}`, patch);
  return r.data;
}

export async function refineDraftEmail(
  emailId: string,
  instruction: string,
  scope: 'whole' | 'subject' | 'opening' | 'body' | 'cta' | 'signoff' = 'whole',
): Promise<{ email: DraftEmailState }> {
  const r = await apiClient.post(`${BASE}/emails/${emailId}/refine`, { instruction, scope });
  return r.data;
}

export async function undoDraftEmail(emailId: string): Promise<{ email: DraftEmailState }> {
  const r = await apiClient.post(`${BASE}/emails/${emailId}/undo`, {});
  return r.data;
}

export async function draftEmailVersions(emailId: string): Promise<{ versions: DraftEmailState['versions']; count: number }> {
  const r = await apiClient.get(`${BASE}/emails/${emailId}/versions`);
  return r.data;
}

export async function consistencyCheckDraftEmail(emailId: string): Promise<{ warnings: string[]; ok: boolean }> {
  const r = await apiClient.post(`${BASE}/emails/${emailId}/consistency-check`, {});
  return r.data;
}

export async function getRecipientSources(): Promise<{
  segments: { id: string; name: string }[];
  smartLists: { id: string; name: string }[];
  lists: { id: string; name: string }[];
}> {
  const r = await apiClient.get(`${BASE}/recipient-sources`);
  return r.data;
}

export async function suggestFilter(draftId: string): Promise<{
  suggestion: string;
  mapped: { hint: string; field: string }[];
  unmapped: string[];
}> {
  const r = await apiClient.post(`${DRAFTS}/${draftId}/recipients/suggest-filter`, {});
  return r.data;
}

export async function resolveRecipients(
  draftId: string,
  sourceType: 'segment' | 'smartList' | 'list' | 'csv',
  sourceId: string | null,
  csvText: string | null,
): Promise<RecipientResolutionState> {
  const r = await apiClient.post(`${DRAFTS}/${draftId}/recipients/resolve`, { sourceType, sourceId, csvText });
  return r.data;
}

export async function runSendChecks(
  emailId: string,
  sendAt: string | null,
): Promise<SendChecksState> {
  const r = await apiClient.post(`${BASE}/emails/${emailId}/checks`, { sendAt });
  return r.data;
}

export async function testSendDraftEmail(
  emailId: string,
  addresses: string[],
): Promise<{ sent: number; to: string[]; subject: string; note: string }> {
  const r = await apiClient.post(`${BASE}/emails/${emailId}/test-send`, { addresses });
  return r.data;
}

export async function simulatePath(
  emailId: string,
  scenario: string,
): Promise<{ scenario: string; emails: { name: string; when: string; trigger: string }[]; note: string }> {
  const r = await apiClient.get(`${BASE}/emails/${emailId}/path-simulator`, { params: { scenario } });
  return r.data;
}

export async function recommendedStart(draftId: string): Promise<{ atUtc: string; reason: string; timeZone: string }> {
  const r = await apiClient.get(`${DRAFTS}/${draftId}/recommended-start`);
  return r.data;
}

export async function confirmSendDraftEmail(
  emailId: string,
  input: { idempotencyKey: string; campaignName: string; sendNow: boolean; sendAt?: string | null; coldAck?: boolean },
): Promise<{ campaignId: string; emailId: string; sendAtUtc: string; recipientCount: number; idempotentReplay: boolean; note: string }> {
  const r = await apiClient.post(`${BASE}/emails/${emailId}/confirm-send`, input);
  return r.data;
}

export async function getCampaignStatus(campaignId: string): Promise<{
  campaign: { id: string; name: string; subject: string; status: string; scheduledAtUtc: string | null; sentAtUtc: string | null; recipientCount: number | null };
  recipients: { id: string; contactId: string; status: string; sentAt: string | null }[];
  events: { type: string; contactId: string; linkUrl: string | null; occurredAt: string; isBotSuspected: boolean }[];
  counts: Record<string, number>;
}> {
  const r = await apiClient.get(`${BASE}/campaigns/${campaignId}`);
  return r.data;
}

export async function pauseCampaignAction(campaignId: string): Promise<{ status: string }> {
  const r = await apiClient.post(`${BASE}/campaigns/${campaignId}/pause`, {});
  return r.data;
}

export async function resumeCampaignAction(campaignId: string): Promise<{ status: string; sendAtUtc: string }> {
  const r = await apiClient.post(`${BASE}/campaigns/${campaignId}/resume`, {});
  return r.data;
}

export async function cancelCampaignAction(campaignId: string): Promise<{ status: string }> {
  const r = await apiClient.post(`${BASE}/campaigns/${campaignId}/cancel`, {});
  return r.data;
}
