import { GoogleGenAI } from '@google/genai';
import { env } from '../../infrastructure/config/env.js';

let _instance: GoogleGenAI | null = null;

/**
 * Returns the shared GoogleGenAI client.
 * Throws if GOOGLE_AI_API_KEY is not configured.
 */
export function getAIClient(): GoogleGenAI {
  if (!_instance) {
    if (!env.GOOGLE_AI_API_KEY) {
      throw new Error('GOOGLE_AI_API_KEY is not configured in environment variables.');
    }
    _instance = new GoogleGenAI({ apiKey: env.GOOGLE_AI_API_KEY });
  }
  return _instance;
}

/**
 * Returns the AI client if the key is present, null otherwise.
 * Use this in routes that gracefully degrade without the key.
 */
export function tryGetAIClient(): GoogleGenAI | null {
  if (!env.GOOGLE_AI_API_KEY) return null;
  return getAIClient();
}

export const DEFAULT_MODEL = 'gemini-2.5-flash';
