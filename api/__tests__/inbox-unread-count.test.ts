/**
 * Inbox unread counts, widget path — Tier 3 Tranche A, Fix 9.
 *
 * A visitor writing in through the website widget never badged: the
 * widget/live-chat createMessage path updated lastActivityAt (and, for
 * agent sends, status/firstReplyAt) but never unreadCount, so the
 * LiveChatInbox badge stayed at 0 and new chats were invisible. The
 * webhook inbound path already incremented; this was the widget path only.
 *
 * Fix: a contact message increments unreadCount; opening the thread in
 * LiveChatInbox calls POST /inbox/conversations/:id/mark-read, which
 * clears it (the inbox model never had a mark-read toggle — the legacy
 * Conversations toggle is a different model).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  conversation: null as any,
  conversationUpdates: [] as any[],
  updateManyCalls: [] as any[],
}));

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    inboxMessage: {
      create: vi.fn(async ({ data }: any) => ({ id: 'im_1', ...data, createdAt: new Date() })),
    },
    inboxMention: { create: vi.fn(async () => ({})) },
    inboxConversation: {
      findUnique: vi.fn(async () => state.conversation),
      update: vi.fn(async ({ where, data }: any) => {
        state.conversationUpdates.push({ where, data });
        return { id: where.id, ...data };
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        state.updateManyCalls.push({ where, data });
        return { count: 1 };
      }),
    },
    channelConnection: { findFirst: vi.fn(async () => null) },
  },
}));

vi.mock('../services/channels/realtime.service.js', () => ({
  publishInboxEvent: vi.fn(async () => {}),
  publishWidgetEvent: vi.fn(async () => {}),
}));

import { createMessage } from '../services/inbox/inbox-message.service.js';
import inboxRouter from '../routes/inbox.routes.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.workspaceId = 'ws_test';
    req.userId = 'user_test';
    next();
  });
  app.use('/inbox', inboxRouter);
  return app;
}

describe('inbox unread counts (Fix 9)', () => {
  beforeEach(() => {
    state.conversationUpdates = [];
    state.updateManyCalls = [];
    state.conversation = {
      id: 'conv_1', status: 'pending', firstReplyAt: null,
      inboxChannel: { channelType: 'live_chat' },
      inboxContact: { email: 'visitor@example.com' },
    };
  });

  it('a visitor message increments unreadCount on the conversation', async () => {
    await createMessage('ws_test', 'conv_1', {
      senderType: 'contact', senderId: 'ct_visitor', content: 'Hi, I need help',
    });
    expect(state.conversationUpdates).toHaveLength(1);
    expect(state.conversationUpdates[0].data).toMatchObject({
      unreadCount: { increment: 1 },
    });
    expect(state.conversationUpdates[0].data.lastActivityAt).toBeInstanceOf(Date);
  });

  it('an agent reply does not touch unreadCount', async () => {
    await createMessage('ws_test', 'conv_1', {
      senderType: 'agent', senderId: 'user_test', content: 'How can I help?',
    });
    expect(state.conversationUpdates).toHaveLength(1);
    expect(state.conversationUpdates[0].data).not.toHaveProperty('unreadCount');
    expect(state.conversationUpdates[0].data.status).toBe('open');
    expect(state.conversationUpdates[0].data.firstReplyAt).toBeInstanceOf(Date);
  });

  it('a bot message does not increment unreadCount', async () => {
    await createMessage('ws_test', 'conv_1', {
      senderType: 'bot', content: 'Thanks for reaching out.',
    });
    expect(state.conversationUpdates).toHaveLength(1);
    expect(state.conversationUpdates[0].data).not.toHaveProperty('unreadCount');
  });

  it('mark-read clears unreadCount, scoped to the workspace', async () => {
    const res = await request(makeApp()).post('/inbox/conversations/conv_1/mark-read');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(state.updateManyCalls).toHaveLength(1);
    expect(state.updateManyCalls[0]).toEqual({
      where: { id: 'conv_1', workspaceId: 'ws_test' },
      data: { unreadCount: 0 },
    });
  });
});
