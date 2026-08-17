/**
 * useAI — Frontend hook for all Stone AIO AI features.
 *
 * All calls go through /api/ai/* — the Gemini key never leaves the server.
 */

import { useState, useCallback } from 'react';
import { apiClient } from './apiClient';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AIChatMessage {
  role: 'user' | 'model';
  content: string;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAI() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  // ── Streaming chat ───────────────────────────────────────────────────────
  const streamChat = useCallback(async (
    message: string,
    history: AIChatMessage[],
    onChunk: (text: string) => void,
    onDone: () => void,
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Forward auth token from apiClient defaults
          ...((apiClient.defaults.headers.common as any) || {}),
        },
        body: JSON.stringify({ message, history }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        for (const line of text.split('\n')) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6);
            if (payload === '[DONE]') { onDone(); break; }
            try {
              const parsed = JSON.parse(payload);
              if (parsed.text) onChunk(parsed.text);
              if (parsed.error) throw new Error(parsed.error);
            } catch { /* ignore parse errors for incomplete chunks */ }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'AI error');
      onDone();
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Email: generate from prompt ──────────────────────────────────────────
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
    streamChat,
    generateEmail,
    improveEmail,
    generateSubjectLines,
    getContactInsights,
  };
}
