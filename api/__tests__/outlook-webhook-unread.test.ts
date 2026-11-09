/**
 * Outlook push webhook — POST /api/hooks/outlook-messages.
 * Pins the 2026-11-07 unread fix (agent/webhook-raw-body-fix): a new
 * conversation was created with unreadCount: 1 and then unconditionally
 * incremented by 1, so the first inbound message showed 2 unread.
 * New conversations are now created with unreadCount: 0; the single
 * increment lands the first message at 1.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { outlookWebhookHandler } from '../webhooks/outlook-messages.handler.js';

vi.mock('../../infrastructure/database/client.js', () => {
  const mockConversations: any[] = [];
  const mockMessages: any[] = [];
  return {
    __mockConversations: mockConversations,
    __mockMessages: mockMessages,
    db: {
      channelConnection: {
        findUnique: vi.fn().mockResolvedValue({ id: 'conn_1', workspaceId: 'ws_test', isActive: true }),
      },
      conversationMessage: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }: any) => {
          const row = { id: `msg_${mockMessages.length + 1}`, ...data };
          mockMessages.push(row);
          return Promise.resolve(row);
        }),
      },
      contact: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      conversation: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }: any) => {
          const row = { id: `cv_${mockConversations.length + 1}`, ...data };
          mockConversations.push(row);
          return Promise.resolve(row);
        }),
        update: vi.fn().mockImplementation(({ where, data }: any) => {
          const row = mockConversations.find((c) => c.id === where.id);
          if (row && data.unreadCount?.increment) row.unreadCount += data.unreadCount.increment;
          return Promise.resolve(row);
        }),
      },
    },
  };
});

vi.mock('axios', () => ({
  default: { get: vi.fn() },
}));

vi.mock('../services/channels/outlook.service.js', () => ({
  getToken: vi.fn().mockResolvedValue('outlook_token_dummy'),
}));

const OLD_ENV = { ...process.env };

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.type = vi.fn(() => res);
  res.send = vi.fn((body?: any) => {
    res.body = body;
    return res;
  });
  return res;
}

describe('outlookWebhookHandler unread count', () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        id: 'msg_outlook_1',
        conversationId: 'thread_outlook_1',
        from: { emailAddress: { address: 'sender@example.com' } },
        subject: 'Hello from Outlook',
        body: { content: 'Test message body' },
      },
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('first inbound message on a new conversation lands at unreadCount 1, not 2', async () => {
    const mod: any = await import('../../infrastructure/database/client.js');
    const req: any = {
      method: 'POST',
      query: {},
      body: {
        value: [{ clientState: 'conn_1', resourceData: { id: 'msg_outlook_1' } }],
      },
    };
    const res = mockRes();
    await outlookWebhookHandler(req, res);
    expect(res.statusCode).toBe(202);

    const createCall = vi.mocked(mod.db.conversation.create).mock.calls[0]?.[0];
    expect(createCall?.data.unreadCount).toBe(0);
    const created: any = mod.__mockConversations?.[0];
    // create with 0 + one increment = 1 unread after the first message
    expect(created?.unreadCount).toBe(1);
  });
});
