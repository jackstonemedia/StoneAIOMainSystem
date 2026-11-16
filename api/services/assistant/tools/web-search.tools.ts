/**
 * Web Search Grounding Tool — Stone AIO Assistant
 * Spec Section 2.8 & Stage S3
 */

import { tryGetAIClient } from '../../../../packages/ai/client.js';
import { db } from '../../../../infrastructure/database/client.js';
import { recordUsage, extractUsage } from '../../agent/metering.js';
import type { ToolContext, ToolDefinition } from './types.js';

export const webSearchTools: ToolDefinition[] = [
  {
    name: 'web_search',
    description: 'Search the live web for recent external company, industry, or public information.',
    risk: 'read',
    minimumRole: 'member',
    isUntrustedContentSource: true,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query to research.' },
      },
      required: ['query'],
    },
    execute: async (args: { query: string }, ctx: ToolContext) => {
      const ai = tryGetAIClient();
      if (!ai) {
        return {
          query: args.query,
          summary: 'Web search unavailable: Google AI client not configured.',
        };
      }

      const prompt = `Provide a concise, factual summary (3-4 bullet points max) for this research topic:\n\n${args.query}`;
      try {
        const response = await ai.models.generateContent({
          model: process.env.ASSISTANT_SMALL_MODEL || 'gemini-3.8-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        });

        const summary = response.text?.trim() || 'No relevant information found.';
        // D4: record the search call's tokens into the monthly bucket.
        // Never fatal, and only when the caller supplied a workspace
        // (direct calls without ctx simply skip recording). Error
        // responses record nothing — no response, no tokens to count.
        if (ctx?.workspaceId) {
          try {
            const usage = extractUsage(response, prompt, summary);
            await recordUsage(db as any, ctx.workspaceId, usage);
            console.log(
              `[WebSearch] recorded ${usage.input + usage.output} search tokens for workspace ${ctx.workspaceId}`,
            );
          } catch (recErr) {
            console.error('[WebSearch] Failed to record search usage:', (recErr as Error)?.message);
          }
        }

        return {
          query: args.query,
          summary,
        };
      } catch (err: unknown) {
        return {
          query: args.query,
          summary: `Search query completed with error: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  },
];
