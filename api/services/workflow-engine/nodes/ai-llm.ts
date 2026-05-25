'use strict';

import type { NodeImplementation, NodeExecuteResult } from '../node-runner.js';
import type { NodeConfigField, WorkflowItem, ExecutionContext } from '../../../src/types/automation.js';
import { GoogleGenAI } from '@google/genai';

/**
 * AI LLM (Gemini) node.
 *
 * Sends a prompt to Google's Gemini model and returns the generated response.
 *
 * Configuration:
 *   - model      (select, default gemini-2.5-flash) — Gemini model: gemini-2.5-flash or gemini-2.5-pro
 *   - prompt     (textarea, required)               — The prompt / instructions to send
 *   - temperature (number, default 0.7)             — Controls randomness (0–1)
 *   - maxTokens   (number, default 2048)            — Maximum output tokens
 */
export const aiLlm: NodeImplementation = {
  type: 'ai.llm',
  category: 'ai',
  displayName: 'AI (Gemini)',
  description: 'Generate text using Google Gemini AI models.',
  iconName: 'sparkles',
  color: '#8B5CF6',
  outputHandles: [
    { id: 'default', label: 'Success', color: '#8B5CF6' },
    { id: 'error', label: 'Error', color: '#EF4444' },
  ],
  configSchema: [
    {
      key: 'model',
      label: 'Model',
      type: 'select',
      defaultValue: 'gemini-2.5-flash',
      options: [
        { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
        { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
      ],
    },
    {
      key: 'prompt',
      label: 'Prompt',
      type: 'textarea',
      required: true,
      placeholder: 'Enter your prompt here...',
    },
    {
      key: 'temperature',
      label: 'Temperature',
      type: 'number',
      defaultValue: 0.7,
      description: 'Controls randomness: 0 = deterministic, 1 = creative',
    },
    {
      key: 'maxTokens',
      label: 'Max Tokens',
      type: 'number',
      defaultValue: 2048,
      description: 'Maximum number of tokens to generate in the response',
    },
  ] as NodeConfigField[],

  async execute(config: Record<string, unknown>, _items: WorkflowItem[], _context: ExecutionContext): Promise<NodeExecuteResult> {
    if (!config.prompt) {
      throw new Error('Prompt is required to generate AI output.');
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is not set.');
    }

    try {
      const ai = new GoogleGenAI({ apiKey });

      const model = (config.model as string) ?? 'gemini-2.5-flash';
      const prompt = config.prompt as string;
      const temperature = (config.temperature as number) ?? 0.7;
      const maxTokens = (config.maxTokens as number) ?? 2048;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      });

      const text = response.text ?? '';

      return {
        output: [
          {
            json: {
              response: text,
              model,
              usage: response.usageMetadata,
            },
          },
        ],
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`AI (Gemini) generation failed: ${message}`);
    }
  },
};
