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

/**
 * Default Gemini model, configurable via GEMINI_MODEL.
 * Default is the provider's current recommended model as of 2026-10-21.
 * gemini-2.5-flash (the previous default) is retired for new users (404)
 * and gemini-2.0-flash is retired — neither may be hardcoded anywhere.
 */
export const DEFAULT_MODEL = env.GEMINI_MODEL || 'gemini-3.8-flash';

/** Strongest model for interview turns and drafting (spec §22 default 13). */
export const INTERVIEW_MODEL = env.GEMINI_INTERVIEW_MODEL || DEFAULT_MODEL;

/** Smaller/cheaper model for short summaries (spec §22 default 13). */
export const SUMMARY_MODEL = env.GEMINI_SUMMARY_MODEL || DEFAULT_MODEL;
