/**
 * Gemini Chat Engine — Stone AIO
 *
 * The ONLY module that imports the Gemini SDK (@google/genai).
 * Yields typed stream events for the orchestrator.
 */

import { tryGetAIClient } from '../client.js';

export interface ChatEngineMessagePart {
  type: string;
  text?: string;
  name?: string;
  args?: Record<string, unknown>;
  response?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ChatEngineMessage {
  role: 'user' | 'assistant' | 'system' | 'model';
  parts: ChatEngineMessagePart[] | string;
}

export interface ChatStreamOptions {
  model?: string;
  systemPrompt?: string;
  thinking?: 'auto' | 'extended' | string;
  signal?: AbortSignal;
  tools?: Array<{ functionDeclarations: any[] }>;
}

export interface FunctionCallPayload {
  id?: string;
  name: string;
  args: Record<string, unknown>;
  thoughtSignature?: string;
}

export type EngineStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'thought_summary'; text: string }
  | { type: 'function_call'; id?: string; name: string; args: Record<string, unknown>; thoughtSignature?: string }
  | {
      type: 'done';
      inputTokens: number;
      outputTokens: number;
      fullText: string;
      functionCalls?: FunctionCallPayload[];
      thoughtSignatures?: Record<string, unknown>;
    }
  | { type: 'error'; code: string; message: string; retryable: boolean };

export class ChatEngine {
  private defaultModel: string;
  private smallModel: string;

  constructor() {
    this.defaultModel = process.env.GEMINI_CHAT_MODEL || process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    this.smallModel = process.env.ASSISTANT_SMALL_MODEL || 'gemini-3.8-flash';
  }

  /**
   * Formats internal conversation messages into Gemini API content format.
   */
  private formatContents(messages: ChatEngineMessage[]): Array<{ role: string; parts: Array<any> }> {
    return messages.map((msg) => {
      const role = msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user';

      if (typeof msg.parts === 'string') {
        return {
          role,
          parts: [{ text: msg.parts }],
        };
      }

      if (Array.isArray(msg.parts)) {
        const parts: any[] = [];
        for (const p of msg.parts) {
          if (p.type === 'text' && typeof p.text === 'string') {
            parts.push({ text: p.text });
          } else if (p.type === 'function_call' && p.name) {
            const fcPart: Record<string, unknown> = {
              functionCall: {
                name: p.name,
                args: (p.args as Record<string, unknown>) || {},
              },
            };
            const sig = p.thoughtSignature || (p as any).thought_signature;
            if (sig) {
              fcPart.thoughtSignature = sig;
            }
            parts.push(fcPart);
          } else if (p.type === 'function_response' && p.name) {
            parts.push({
              functionResponse: {
                name: p.name,
                response: (p.response as Record<string, unknown>) || {},
              },
            });
          } else if (p.type === 'image' && p.data && p.mimeType) {
            parts.push({
              inlineData: {
                mimeType: p.mimeType as string,
                data: (p.data as string).replace(/^data:[^;]+;base64,/, ''),
              },
            });
          } else if (p.text && typeof p.text === 'string') {
            parts.push({ text: p.text });
          }
        }
        return { role, parts: parts.length > 0 ? parts : [{ text: '' }] };
      }

      return { role, parts: [{ text: '' }] };
    });
  }

  /**
   * Stream a conversation turn with Gemini.
   */
  async *stream(
    messages: ChatEngineMessage[],
    options: ChatStreamOptions = {}
  ): AsyncGenerator<EngineStreamEvent, void, unknown> {
    const ai = tryGetAIClient();
    if (!ai) {
      yield {
        type: 'error',
        code: 'not_available',
        message: 'Google AI API key is not configured on the server.',
        retryable: false,
      };
      return;
    }

    const modelName = options.model || this.defaultModel;
    const contents = this.formatContents(messages);

    // Build thinking config if model supports it
    // Auto maps to medium thinking, Extended maps to high
    const isGemini3 = modelName.includes('3.') || modelName.includes('gemini-3');
    let thinkingConfig: Record<string, unknown> | undefined;

    if (isGemini3) {
      thinkingConfig = {
        thinkingLevel: options.thinking === 'extended' ? 'high' : 'medium',
      };
    } else {
      thinkingConfig = {
        thinkingBudget: options.thinking === 'extended' ? 4096 : 2048,
      };
    }

    let fullText = '';
    let inputTokens = 0;
    let outputTokens = 0;
    const accumulatedFunctionCalls: FunctionCallPayload[] = [];

    try {
      const responseStream = await ai.models.generateContentStream({
        model: modelName,
        contents,
        config: {
          systemInstruction: options.systemPrompt,
          thinkingConfig,
          ...(options.tools && options.tools.length > 0 ? { tools: options.tools } : {}),
        },
      });

      for await (const chunk of responseStream) {
        if (options.signal?.aborted) {
          break;
        }

        // Handle text delta
        const textChunk = chunk.text;
        if (textChunk) {
          fullText += textChunk;
          yield { type: 'delta', text: textChunk };
        }

        // Handle function calls
        const candidateParts = (chunk as any).candidates?.[0]?.content?.parts;
        let chunkThoughtSignature: string | undefined;
        if (Array.isArray(candidateParts)) {
          for (const cp of candidateParts) {
            if (cp.thoughtSignature || cp.thought_signature) {
              chunkThoughtSignature = cp.thoughtSignature || cp.thought_signature;
              break;
            }
          }
        }

        const functionCalls = chunk.functionCalls;
        if (functionCalls && Array.isArray(functionCalls)) {
          for (const fc of functionCalls) {
            const callPayload: FunctionCallPayload = {
              id: (fc as any).id,
              name: fc.name || '',
              args: (fc as any).args || {},
              thoughtSignature: (fc as any).thoughtSignature || (fc as any).thought_signature || chunkThoughtSignature,
            };
            accumulatedFunctionCalls.push(callPayload);
            yield {
              type: 'function_call',
              id: callPayload.id,
              name: callPayload.name,
              args: callPayload.args,
              thoughtSignature: callPayload.thoughtSignature,
            };
          }
        }

        // Handle usage metadata if present on the chunk
        const usage = (chunk as unknown as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }).usageMetadata;
        if (usage) {
          if (usage.promptTokenCount) inputTokens = usage.promptTokenCount;
          if (usage.candidatesTokenCount) outputTokens = usage.candidatesTokenCount;
        }
      }

      yield {
        type: 'done',
        inputTokens: inputTokens || Math.round(fullText.length / 4),
        outputTokens: outputTokens || Math.round(fullText.length / 4),
        fullText,
        functionCalls: accumulatedFunctionCalls.length > 0 ? accumulatedFunctionCalls : undefined,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[ChatEngine Error]:', message);

      if (
        message.includes('402') ||
        message.includes('prepayment') ||
        message.includes('depleted') ||
        message.includes('RESOURCE_EXHAUSTED')
      ) {
        yield {
          type: 'error',
          code: 'credits_depleted',
          message: 'Google AI Studio: Your prepayment credits are depleted ($0.00 balance). Please refill your prepay balance at https://ai.studio/projects or create a new free API key at https://aistudio.google.com/app/apikey.',
          retryable: false,
        };
      } else if (message.includes('429') || message.toLowerCase().includes('rate')) {
        yield {
          type: 'error',
          code: 'rate_limited',
          message: 'Google Gemini rate limit reached. Please try again in a moment.',
          retryable: true,
        };
      } else if (message.includes('deadline') || message.includes('timeout')) {
        yield {
          type: 'error',
          code: 'timeout',
          message: 'Request to Google Gemini timed out. Please try again.',
          retryable: true,
        };
      } else if (message.includes('blocked') || message.includes('safety')) {
        yield {
          type: 'error',
          code: 'blocked',
          message: 'The model flagged this content under safety guidelines. Try rephrasing your request.',
          retryable: false,
        };
      } else {
        yield {
          type: 'error',
          code: 'provider_error',
          message: message || 'Google Gemini error. Please try again.',
          retryable: true,
        };
      }
    }
  }

  /**
   * Generates a short title (six words or fewer) for a conversation based on the first message.
   */
  async generateTitle(userMessage: string): Promise<string> {
    const fallback = userMessage.trim().slice(0, 50) || 'New Conversation';
    const ai = tryGetAIClient();
    if (!ai || !userMessage.trim()) return fallback;

    try {
      const response = await ai.models.generateContent({
        model: this.smallModel,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Generate a short, concise conversation title of 6 words or fewer summarizing this user request. Do not include quotes, markdown, or punctuation. Title only:\n\n${userMessage}`,
              },
            ],
          },
        ],
      });

      const title = response.text?.trim().replace(/^["']|["']$/g, '');
      if (title && title.length < 80) {
        return title;
      }
      return fallback;
    } catch {
      return fallback;
    }
  }
}

export const chatEngine = new ChatEngine();
