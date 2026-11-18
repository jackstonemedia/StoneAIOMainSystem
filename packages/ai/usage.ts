/**
 * Token usage helpers — shared by the API metering layer and the AI engine.
 *
 * Lives in packages/ai (not api/services/agent/metering.ts) so the engine
 * can compute a call's usage without importing the API layer: the engine
 * is the only module that talks to Gemini, and the metering layer re-exports
 * these (see metering.ts) so every existing import keeps working.
 *
 * Counts prefer the API's usageMetadata when present and fall back to a
 * chars/4 estimate, which is always an estimate, never presented as exact.
 */

export interface TokenUsage {
  input: number;
  output: number;
}

/** Rough token estimate: ~4 chars per token. Estimates only. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Usage for one LLM call. Prefers usageMetadata when the response
 * carries it; otherwise estimates from the prompt/response text.
 */
export function extractUsage(
  res: any,
  promptText: string,
  responseText: string,
): TokenUsage {
  const meta = res?.usageMetadata;
  if (meta && typeof meta.promptTokenCount === 'number' && typeof meta.candidatesTokenCount === 'number') {
    return { input: meta.promptTokenCount, output: meta.candidatesTokenCount };
  }
  return { input: estimateTokens(promptText), output: estimateTokens(responseText) };
}
