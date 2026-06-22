import { useMutation } from '@tanstack/react-query';
import type { AdType } from '../types/ads';

const API = '/api/ads/ai';

export interface GeneratedAdCopy {
  headlines: string[];
  descriptions: string[];
  primaryText?: string;
}

export interface KeywordSuggestion {
  text: string;
  matchType: 'BROAD' | 'PHRASE' | 'EXACT';
}

export interface GeneratedImage {
  url: string;
  mimeType: string;
}

async function generateCopy(description: string, adType: AdType, numVariants: number = 3): Promise<GeneratedAdCopy[]> {
  const res = await fetch(`${API}/generate-copy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, adType, numVariants }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? 'AI copy generation failed');
  }
  const data = await res.json();
  return data.variants;
}

async function suggestKeywords(description: string, seed?: string[], numKeywords?: number): Promise<KeywordSuggestion[]> {
  const res = await fetch(`${API}/suggest-keywords`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, seed, numKeywords }),
  });
  if (!res.ok) throw new Error('Keyword suggestion failed');
  const data = await res.json();
  return data.keywords;
}

async function generateImage(description: string): Promise<GeneratedImage> {
  const res = await fetch(`${API}/generate-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  });
  if (!res.ok) throw new Error('Image generation failed');
  return res.json();
}

export function useGenerateAdCopy() {
  return useMutation({
    mutationFn: ({ description, adType, numVariants }: { description: string; adType: AdType; numVariants?: number }) =>
      generateCopy(description, adType, numVariants),
  });
}

export function useSuggestKeywords() {
  return useMutation({
    mutationFn: ({ description, seed, numKeywords }: { description: string; seed?: string[]; numKeywords?: number }) =>
      suggestKeywords(description, seed, numKeywords),
  });
}

export function useGenerateAdImage() {
  return useMutation({
    mutationFn: ({ description }: { description: string }) => generateImage(description),
  });
}
