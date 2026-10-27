import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase 0 truthfulness regression test: when the AI client cannot be built
// (no Gemini key), the copilots must fail honestly — never substitute the
// old hardcoded mock replies.

// Mock the database client
vi.mock('../../../infrastructure/database/client.js', () => {
  return {
    db: {
      inboxConversation: {
        findUnique: vi.fn(),
      },
      conversation: {
        findUnique: vi.fn(),
      },
    },
  };
});

// Mock the AI client so getAIClient throws the real key-missing error
vi.mock('../../packages/ai/client.js', () => {
  return {
    getAIClient: () => {
      throw new Error('GOOGLE_AI_API_KEY is not configured in environment variables.');
    },
    DEFAULT_MODEL: 'gemini-3.8-flash',
    SUMMARY_MODEL: 'gemini-3.8-flash',
  };
});

import { db } from '../../../infrastructure/database/client.js';
import { copilotService } from '../inbox/copilot.service';
import { conversationCopilotService } from '../conversation-copilot.service';

const OLD_MOCK_PHRASES = /look into that|billing issue|Support Team|Stone AIO Team/;

describe('Copilot truthfulness (Phase 0)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.inboxConversation.findUnique as any).mockResolvedValue({
      id: 'conv-inbox-1',
      workspaceId: 'ws-test',
      inboxContact: { name: 'Jane' },
      messages: [
        { senderType: 'customer', content: 'Hi, I need help with my order.' },
        { senderType: 'agent', content: 'Of course — what seems to be the problem?' },
      ],
    });
    (db.conversation.findUnique as any).mockResolvedValue({
      id: 'conv-1',
      workspaceId: 'ws-test',
      contact: { firstName: 'Jane', lastName: 'Doe' },
      messages: [
        { sender: 'Jane', direction: 'inbound', body: 'Hi, I need help with my order.' },
        { sender: 'Support', direction: 'outbound', body: 'Of course — what seems to be the problem?' },
      ],
    });
  });

  it('inbox copilot draft fails honestly without a key, with no mock text', async () => {
    const err = await copilotService.generateDraftReply('conv-inbox-1', 'ws-test').catch((e) => e);
    expect(err.message).toMatch('GOOGLE_AI_API_KEY');
    expect(err.message).not.toMatch(OLD_MOCK_PHRASES);
  });

  it('inbox copilot summary + action items fail honestly without a key', async () => {
    for (const fn of [
      () => copilotService.summarizeConversation('conv-inbox-1', 'ws-test'),
      () => copilotService.extractActionItems('conv-inbox-1', 'ws-test'),
    ]) {
      const err = await fn().catch((e) => e);
      expect(err.message).toMatch('GOOGLE_AI_API_KEY');
      expect(err.message).not.toMatch(OLD_MOCK_PHRASES);
    }
  });

  it('conversations copilot draft/summary/action-items fail honestly without a key', async () => {
    for (const fn of [
      () => conversationCopilotService.generateDraftReply('conv-1', 'ws-test'),
      () => conversationCopilotService.summarizeConversation('conv-1', 'ws-test'),
      () => conversationCopilotService.extractActionItems('conv-1', 'ws-test'),
    ]) {
      const err = await fn().catch((e) => e);
      expect(err.message).toMatch('GOOGLE_AI_API_KEY');
      expect(err.message).not.toMatch(OLD_MOCK_PHRASES);
    }
  });

  it('workspace guard still fires before any AI call', async () => {
    await expect(copilotService.generateDraftReply('conv-inbox-1', 'ws-other')).rejects.toThrow('Unauthorized');
    await expect(conversationCopilotService.generateDraftReply('conv-1', 'ws-other')).rejects.toThrow('Unauthorized');
  });
});
