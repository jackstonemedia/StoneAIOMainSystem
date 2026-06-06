/**
 * src/lib/gemini.ts
 * Shared Gemini AI client for all Stone AIO AI features.
 *
 * Reads VITE_GEMINI_API_KEY (or VITE_GOOGLE_AI_API_KEY as fallback).
 * All AI features import from here — never instantiate the SDK directly.
 */
import { GoogleGenAI } from '@google/genai';

// ── Client singleton ──────────────────────────────────────────────────────────
const apiKey =
  (import.meta as any).env?.VITE_GEMINI_API_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_AI_API_KEY ||
  '';

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!_client) {
    if (!apiKey) {
      throw new Error(
        'Gemini API key not found. Set VITE_GEMINI_API_KEY in your .env.local file.'
      );
    }
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}

const DEFAULT_MODEL = 'gemini-2.5-flash';

// ── generateText ──────────────────────────────────────────────────────────────
/**
 * One-shot text generation. Returns the full response string.
 * @param prompt     - The user prompt
 * @param systemPrompt - Optional system instruction
 * @param model      - Gemini model name (defaults to gemini-2.0-flash)
 */
export async function generateText(
  prompt: string,
  systemPrompt?: string,
  model: string = DEFAULT_MODEL
): Promise<string> {
  const client = getClient();
  const response = await client.models.generateContent({
    model,
    contents: prompt,
    ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
  });
  return response.text ?? '';
}

// ── streamText ────────────────────────────────────────────────────────────────
/**
 * Streaming text generation. Calls `onChunk` for each token as it arrives.
 * Ideal for chat UIs and long-form content generation.
 *
 * @param prompt      - The user prompt
 * @param onChunk     - Callback invoked with each incremental text chunk
 * @param systemPrompt - Optional system instruction
 * @param model       - Gemini model name
 */
export async function streamText(
  prompt: string,
  onChunk: (text: string) => void,
  systemPrompt?: string,
  model: string = DEFAULT_MODEL
): Promise<void> {
  const client = getClient();
  const response = await client.models.generateContentStream({
    model,
    contents: prompt,
    ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
  });

  for await (const chunk of response) {
    const text = chunk.text;
    if (text) onChunk(text);
  }
}

// ── generateJSON ──────────────────────────────────────────────────────────────
/**
 * Instructs the model to return a valid JSON object matching the given schema
 * description. Parses and returns the typed result.
 *
 * @param prompt  - The user prompt describing what JSON to produce
 * @param schema  - Plain-English description of the expected JSON shape
 * @param model   - Gemini model name
 *
 * @throws If the model returns invalid JSON or the response is empty.
 */
export async function generateJSON<T = unknown>(
  prompt: string,
  schema: string,
  model: string = DEFAULT_MODEL
): Promise<T> {
  const client = getClient();
  const fullPrompt = `${prompt}

Respond with ONLY a valid JSON object/array. No markdown fences, no explanation.
Expected shape: ${schema}`;

  const response = await client.models.generateContent({
    model,
    contents: fullPrompt,
    generationConfig: {
      responseMimeType: 'application/json',
    },
  } as any);

  const raw = (response.text ?? '').trim();
  if (!raw) throw new Error('Gemini returned an empty response');

  try {
    return JSON.parse(raw) as T;
  } catch {
    // Fallback: strip markdown fences if present
    const stripped = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    return JSON.parse(stripped) as T;
  }
}

// ── isConfigured ─────────────────────────────────────────────────────────────
/**
 * Returns true if a Gemini API key is present in the environment.
 * Use this to conditionally show AI features in the UI.
 */
export function isGeminiConfigured(): boolean {
  return !!apiKey;
}

// ── SYSTEM PROMPTS ────────────────────────────────────────────────────────────
export const SYSTEM_PROMPTS = {
  assistant:
    'You are Stone AIO\'s AI assistant — an expert CRM strategist, sales coach, and marketing advisor. Be concise, actionable, and data-driven. When referencing data, be specific about numbers.',

  emailWriter:
    'You are an expert email copywriter. Write compelling, personalized email copy that converts. Match the tone to the business context provided.',

  socialWriter:
    'You are an expert social media copywriter. Write engaging, platform-optimized captions that drive engagement. Be authentic and on-brand.',

  insights:
    'You are a business analyst specializing in CRM data. Analyze the provided data and surface actionable insights. Be specific about what the numbers mean and what to do about them.',

  pageBuilder:
    'You are an expert landing page copywriter and conversion specialist. Write compelling, benefit-focused copy that converts visitors to leads.',
} as const;
