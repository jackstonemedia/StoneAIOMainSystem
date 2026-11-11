/**
 * Outlook push webhook — Tier 1 Fix 8.
 * The old skip rule `if (msg.isDraft || msg.sentDateTime) continue` dropped
 * EVERY received message: Graph sets sentDateTime on inbound mail too.
 * The handler now skips only drafts and messages sent from the connected
 * mailbox itself (conn.email, stored at OAuth connect time).
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
        findUnique: vi.fn().mockResolvedValue({
          id: 'conn_1',
          workspaceId: 'ws_test',
          isActive: true,
          email: 'owner@example.com',
        }),
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
          const row = { id: `cv_${mockConversations.length + 1}`, ...data, unreadCount: 0 };
          mockConversations.push(row);
          return Promise.resolve(row);
        }),
        update: vi.fn().mockResolvedValue({}),
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

async function runHandler(msgData: any) {
  vi.mocked(axios.get).mockResolvedValue({ data: msgData } as any);
  const mod: any = await import('../../infrastructure/database/client.js');
  const req: any = {
    method: 'POST',
    query: {},
    body: { value: [{ clientState: 'conn_1', resourceData: { id: msgData.id } }] },
  };
  const res = mockRes();
  await outlookWebhookHandler(req, res);
  expect(res.statusCode).toBe(202);
  return mod;
}

describe('outlookWebhookHandler inbound (Tier 1 Fix 8)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // The mock's message/conversation stores are module-level arrays, so
    // empty them between tests (clearAllMocks only resets call counts).
    const mod: any = await import('../../infrastructure/database/client.js');
    mod.__mockMessages.length = 0;
    mod.__mockConversations.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('a received message WITH sentDateTime set is ingested (the old rule dropped it)', async () => {
    const mod = await runHandler({
      id: 'msg_in_1',
      conversationId: 'thread_in_1',
      isDraft: false,
      sentDateTime: '2026-11-10T21:00:00Z',
      receivedDateTime: '2026-11-10T21:00:05Z',
      from: { emailAddress: { address: 'customer@example.com' } },
      subject: 'Need help',
      body: { content: 'Hello' },
    });
    expect(mod.__mockMessages).toHaveLength(1);
    expect(mod.__mockMessages[0]).toMatchObject({ direction: 'inbound', sender: 'customer@example.com' });
    expect(mod.__mockConversations).toHaveLength(1);
  });

  it('a message sent FROM the connected mailbox is skipped', async () => {
    const mod = await runHandler({
      id: 'msg_out_1',
      conversationId: 'thread_out_1',
      isDraft: false,
      sentDateTime: '2026-11-10T21:00:00Z',
      from: { emailAddress: { address: 'owner@example.com' } },
      subject: 'Re: Need help',
      body: { content: 'Sure' },
    });
    expect(mod.__mockMessages).toHaveLength(0);
    expect(mod.__mockConversations).toHaveLength(0);
  });

  it('the own-mailbox check is case-insensitive', async () => {
    const mod = await runHandler({
      id: 'msg_out_2',
      conversationId: 'thread_out_2',
      isDraft: false,
      sentDateTime: '2026-11-10T21:00:00Z',
      from: { emailAddress: { address: 'Owner@Example.COM' } },
      subject: 'Re: Need help',
      body: { content: 'Sure' },
    });
    expect(mod.__mockMessages).toHaveLength(0);
  });

  it('a draft is skipped', async () => {
    const mod = await runHandler({
      id: 'msg_draft_1',
      conversationId: 'thread_draft_1',
      isDraft: true,
      from: { emailAddress: { address: 'customer@example.com' } },
      subject: 'Draft',
      body: { content: 'Unfinished' },
    });
    expect(mod.__mockMessages).toHaveLength(0);
  });
});
