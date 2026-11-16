/**
 * D4: generateTitle returns the title call's usage alongside the title.
 * The title call is a real model call and was never counted; the
 * orchestrator adds the returned usage to the turn total. Tests pin the
 * return shape, the metadata-first count, the estimate fallback, and the
 * zero-usage paths (no client / failed call). No live key, no network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatEngine } from '../../packages/ai/engine/chat-engine.js';
import { estimateTokens } from '../../packages/ai/usage.js';

const { mockGenerateContent, mockTryGetAIClient } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
  mockTryGetAIClient: vi.fn(),
}));

vi.mock('../../packages/ai/client.js', () => ({
  tryGetAIClient: mockTryGetAIClient,
  DEFAULT_MODEL: 'gemini-3.8-flash',
}));

const TITLE_PROMPT =
  'Generate a short, concise conversation title of 6 words or fewer summarizing this user request. Do not include quotes, markdown, or punctuation. Title only:\n\nHello, what deals do we have open?';

describe('generateTitle usage (D4)', () => {
  const engine = new ChatEngine();

  beforeEach(() => {
    mockGenerateContent.mockReset();
    mockTryGetAIClient.mockReset();
    mockTryGetAIClient.mockReturnValue({
      models: { generateContent: mockGenerateContent },
    });
  });

  it('returns the title with the model-reported usage when usageMetadata is present', async () => {
    mockGenerateContent.mockResolvedValue({
      text: 'Open Deals Overview',
      usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 8 },
    });

    const result = await engine.generateTitle('Hello, what deals do we have open?');

    expect(result.title).toBe('Open Deals Overview');
    expect(result.usage).toEqual({ input: 120, output: 8 });
  });

  it('estimates from prompt and response when usageMetadata is absent', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'Open Deals Overview' });

    const result = await engine.generateTitle('Hello, what deals do we have open?');

    expect(result.title).toBe('Open Deals Overview');
    expect(result.usage).toEqual({
      input: estimateTokens(TITLE_PROMPT),
      output: estimateTokens('Open Deals Overview'),
    });
  });

  it('returns the fallback title with zero usage when there is no AI client', async () => {
    mockTryGetAIClient.mockReturnValue(null);

    const result = await engine.generateTitle('Hello, what deals do we have open?');

    expect(result.title).toBe('Hello, what deals do we have open?');
    expect(result.usage).toEqual({ input: 0, output: 0 });
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('returns the fallback title with zero usage when the call fails, and still counts a successful call whose title falls back', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('boom'));
    const failed = await engine.generateTitle('Hello, what deals do we have open?');
    expect(failed.title).toBe('Hello, what deals do we have open?');
    expect(failed.usage).toEqual({ input: 0, output: 0 });

    // A successful call whose title is too long still spent tokens.
    mockGenerateContent.mockResolvedValue({
      text: 'This title is far too long to ever be used as a conversation title at all, honestly it goes on',
      usageMetadata: { promptTokenCount: 90, candidatesTokenCount: 12 },
    });
    const longTitle = await engine.generateTitle('Hello, what deals do we have open?');
    expect(longTitle.title).toBe('Hello, what deals do we have open?');
    expect(longTitle.usage).toEqual({ input: 90, output: 12 });
  });
});
