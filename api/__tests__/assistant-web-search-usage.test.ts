/**
 * D4: the web_search tool records its summary call's tokens into the
 * monthly bucket. Tests pin: metadata-first counting, the estimate
 * fallback, no recording on the error path, and no crash (and no
 * recording) when called without a tool context. No live key, no network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { webSearchTools } from '../services/assistant/tools/web-search.tools.js';
import { estimateTokens } from '../../packages/ai/usage.js';

const { mockGenerateContent, mockAgentTokenUpsert } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
  mockAgentTokenUpsert: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../packages/ai/client.js', () => ({
  tryGetAIClient: () => ({
    models: { generateContent: mockGenerateContent },
  }),
  DEFAULT_MODEL: 'gemini-3.8-flash',
}));

vi.mock('../../infrastructure/database/client.js', () => ({
  db: { agentTokenUsage: { upsert: mockAgentTokenUpsert } },
}));

const ctx = {
  workspaceId: 'ws-search-1',
  userId: 'u-search-1',
  userRole: 'member',
  conversationId: 'c-search-1',
};

const SEARCH_PROMPT =
  'Provide a concise, factual summary (3-4 bullet points max) for this research topic:\n\nAcme Corp recent news';

describe('web_search usage recording (D4)', () => {
  const tool = webSearchTools[0];

  beforeEach(() => {
    mockGenerateContent.mockReset();
    mockAgentTokenUpsert.mockClear();
    mockGenerateContent.mockResolvedValue({
      text: '- Acme Corp raised a round.\n- New product launched.',
      usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 20 },
    });
  });

  it('records the model-reported usage once for the context workspace', async () => {
    const result = await tool.execute({ query: 'Acme Corp recent news' }, ctx as any);

    expect(result.summary).toContain('Acme Corp raised a round.');
    expect(mockAgentTokenUpsert).toHaveBeenCalledTimes(1);
    const upsertArg = mockAgentTokenUpsert.mock.calls[0][0];
    expect(upsertArg.where.workspaceId_month.workspaceId).toBe('ws-search-1');
    expect(upsertArg.create.inputTokens).toBe(50);
    expect(upsertArg.create.outputTokens).toBe(20);
    expect(upsertArg.create.totalTokens).toBe(70);
  });

  it('estimates from prompt and response when usageMetadata is absent', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'Short summary.' });

    await tool.execute({ query: 'Acme Corp recent news' }, ctx as any);

    expect(mockAgentTokenUpsert).toHaveBeenCalledTimes(1);
    const upsertArg = mockAgentTokenUpsert.mock.calls[0][0];
    expect(upsertArg.create.inputTokens).toBe(estimateTokens(SEARCH_PROMPT));
    expect(upsertArg.create.outputTokens).toBe(estimateTokens('Short summary.'));
  });

  it('records nothing when the search errors', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('search failed'));

    const result = await tool.execute({ query: 'Acme Corp recent news' }, ctx as any);

    expect(result.summary).toContain('Search query completed with error');
    expect(mockAgentTokenUpsert).not.toHaveBeenCalled();
  });

  it('a recording failure does not break the search result', async () => {
    mockAgentTokenUpsert.mockRejectedValueOnce(new Error('db down'));

    const result = await tool.execute({ query: 'Acme Corp recent news' }, ctx as any);

    expect(result.summary).toContain('Acme Corp raised a round.');
    expect(mockAgentTokenUpsert).toHaveBeenCalledTimes(1);
  });

  it('does not crash and records nothing when called without a context', async () => {
    const result = await (tool.execute as any)({ query: 'Acme Corp recent news' });

    expect(result.summary).toContain('Acme Corp raised a round.');
    expect(mockAgentTokenUpsert).not.toHaveBeenCalled();
  });
});
