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
