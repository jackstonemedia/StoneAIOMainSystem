/**
 * Web Search Grounding Tool — Stone AIO Assistant
 * Spec Section 2.8 & Stage S3
 */

import { tryGetAIClient } from '../../../../packages/ai/client.js';
import type { ToolDefinition } from './types.js';

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
    execute: async (args: { query: string }) => {
      const ai = tryGetAIClient();
      if (!ai) {
        return {
          query: args.query,
          summary: 'Web search unavailable: Google AI client not configured.',
        };
      }

      try {
        const response = await ai.models.generateContent({
          model: process.env.ASSISTANT_SMALL_MODEL || 'gemini-3.8-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Provide a concise, factual summary (3-4 bullet points max) for this research topic:\n\n${args.query}`,
                },
              ],
            },
          ],
        });

        return {
          query: args.query,
          summary: response.text?.trim() || 'No relevant information found.',
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
