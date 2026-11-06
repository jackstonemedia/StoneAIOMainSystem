/**
 * useAI — Frontend hook for content writing helpers (email generate, improve, subject lines).
 */

import { useState, useCallback } from 'react';
import { apiClient } from './apiClient';

export function useAI() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  // ── Email: generate full email ───────────────────────────────────────────
  const generateEmail = useCallback(async (
    prompt: string,
    campaignName?: string,
    audienceDescription?: string,
  ): Promise<string> => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.post('/ai/email/generate', {
        prompt,
        campaignName,
        audienceDescription,
      });
      return data.html || '';
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Generation failed';
      setError(msg);
      return '';
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Email: improve existing copy ─────────────────────────────────────────
  const improveEmail = useCallback(async (
    html: string,
    instruction?: string,
  ): Promise<string> => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.post('/ai/email/improve', { html, instruction });
      return data.html || '';
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Improve failed';
      setError(msg);
      return '';
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Email: generate subject lines ────────────────────────────────────────
  const generateSubjectLines = useCallback(async (
    html?: string,
    campaignContext?: string,
  ): Promise<string[]> => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.post('/ai/email/subject', { html, campaignContext });
      return data.subjects || [];
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Subject generation failed';
      setError(msg);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Contact: AI insights ─────────────────────────────────────────────────
  const getContactInsights = useCallback(async (
    contact: any,
    activities?: any[],
  ): Promise<{ summary: string; nextActions: string[]; engagementScore: string } | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.post('/ai/contact/insights', { contact, activities });
      return data;
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Insights failed';
      setError(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    clearError,
    generateEmail,
    improveEmail,
    generateSubjectLines,
    getContactInsights,
  };
}
