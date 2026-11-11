/**
 * Website widget — Tier 1 Fix 2.
 * The shipped widget (public/widget/v1/app.html) and the widget routes
 * disagreed on everything: the widget posted { contact: { name, email } }
 * while the route wanted { contactId }; it sent `Authorization: Bearer
 * <contactId>` while the middleware only reads `x-inbox-token` (header) or
 * `inboxToken` (query); it opened an SSE stream at /api/widget/sse, a route
 * that does not exist; and it reversed the message list the server already
 * returns oldest-first. These tests pin the corrected contract.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import http from 'node:http';

const stores = vi.hoisted(() => ({
  channels: new Map<string, any>(),
  contacts: new Map<string, any>(),
  conversations: new Map<string, any>(),
  messages: [] as any[],
  seqs: new Map<string, any>(),
}));

vi.mock('../../infrastructure/database/client.js', () => {
  const tx = {
    inboxDisplayIdSequence: {
      upsert: vi.fn(async ({ where }: any) => {
        const cur = stores.seqs.get(where.workspaceId) ?? { workspaceId: where.workspaceId, lastId: 0 };
        cur.lastId += 1;
        stores.seqs.set(where.workspaceId, cur);
        return cur;
      }),
    },
    inboxChannelAgent: { findMany: vi.fn(async () => []) },
    inboxConversation: {
      create: vi.fn(async ({ data }: any) => {
        const row = {
          id: `conv_${stores.conversations.size + 1}`,
          status: 'open',
          unreadCount: 0,
          lastActivityAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        stores.conversations.set(row.id, row);
        return row;
      }),
    },
  };
  return {
    db: {
      $transaction: vi.fn(async (fn: any) => fn(tx)),
      inboxChannel: {
        findUnique: vi.fn(async ({ where }: any) => stores.channels.get(where.embedToken) ?? null),
      },
      inboxContact: {
        findFirst: vi.fn(async ({ where }: any) =>
          [...stores.contacts.values()].find(
            (c) => c.workspaceId === where.workspaceId && c.externalId === where.externalId,
          ) ?? null,
        ),
        create: vi.fn(async ({ data }: any) => {
          const row = { id: `ct_${stores.contacts.size + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data };
          stores.contacts.set(data.externalId, row);
          return row;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const row = [...stores.contacts.values()].find((c) => c.id === where.id);
          Object.assign(row, data);
          return row;
        }),
      },
      inboxConversation: {
        findUnique: vi.fn(async ({ where }: any) => stores.conversations.get(where.id) ?? null),
        update: vi.fn(async ({ where, data }: any) => {
          const row = stores.conversations.get(where.id);
          Object.assign(row, data);
          return row;
        }),
      },
      inboxMessage: {
        create: vi.fn(async ({ data }: any) => {
          const row = { id: `msg_${stores.messages.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data };
          stores.messages.push(row);
          return row;
        }),
        findMany: vi.fn(async ({ where }: any) =>
          stores.messages.filter((m) => m.workspaceId === where.workspaceId && m.conversationId === where.conversationId),
        ),
        count: vi.fn(async ({ where }: any) =>
          stores.messages.filter((m) => m.workspaceId === where.workspaceId && m.conversationId === where.conversationId).length,
        ),
      },
      inboxMention: { create: vi.fn(async () => ({})) },
      channelConnection: { findFirst: vi.fn(async () => null) },
    },
  };
});

import widgetRouter from '../routes/inbox-widget.routes.js';

const TOKEN = 'tok_test_123';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/widget', widgetRouter);
  return app;
}

describe('Website widget (Tier 1 Fix 2)', () => {
  beforeEach(() => {
    stores.channels.clear();
    stores.contacts.clear();
    stores.conversations.clear();
    stores.messages.length = 0;
    stores.seqs.clear();
    stores.channels.set(TOKEN, {
      id: 'ch_1',
      workspaceId: 'ws_test',
      embedToken: TOKEN,
      isEnabled: true,
      channelType: 'live_chat',
      name: 'Website',
    });
  });

  it('creates a conversation from { contact: { name, email } } and returns { conversation, contact }', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/widget/conversations')
      .set('x-inbox-token', TOKEN)
      .send({ contact: { name: 'Visitor One', email: 'visitor@example.com' } });
    expect(res.status).toBe(200);
    expect(res.body.conversation).toBeDefined();
    expect(res.body.conversation.inboxChannelId).toBe('ch_1');
    expect(res.body.contact).toBeDefined();
    expect(res.body.contact.email).toBe('visitor@example.com');
    // The contact is keyed by email as its externalId, so a repeat visit
    // resolves the same contact instead of creating a duplicate.
    expect(res.body.conversation.inboxContactId).toBe(res.body.contact.id);
    const again = await request(app)
      .post('/api/widget/conversations')
      .set('x-inbox-token', TOKEN)
      .send({ contact: { name: 'Visitor One', email: 'visitor@example.com' } });
    expect(again.body.contact.id).toBe(res.body.contact.id);
  });

  it('still accepts { contactId } (back-compat)', async () => {
    const app = buildApp();
    stores.contacts.set('ext_1', { id: 'ct_existing', workspaceId: 'ws_test', externalId: 'ext_1', name: 'Existing', email: 'e@x.com' });
    const res = await request(app)
      .post('/api/widget/conversations')
      .set('x-inbox-token', TOKEN)
      .send({ contactId: 'ct_existing' });
    expect(res.status).toBe(200);
    expect(res.body.inboxContactId).toBe('ct_existing');
  });

  it('rejects a missing token and an unknown token', async () => {
    const app = buildApp();
    const noToken = await request(app)
      .post('/api/widget/conversations')
      .send({ contact: { name: 'V', email: 'v@x.com' } });
    expect(noToken.status).toBe(401);
    const badToken = await request(app)
      .post('/api/widget/conversations')
      .set('x-inbox-token', 'tok_nope')
      .send({ contact: { name: 'V', email: 'v@x.com' } });
    expect(badToken.status).toBe(401);
  });

  it('rejects a start with neither contactId nor contact.email', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/widget/conversations')
      .set('x-inbox-token', TOKEN)
      .send({ contact: { name: 'No Email' } });
    expect(res.status).toBe(400);
  });

  it('visitor messages send and list in server order (oldest first — the widget must not reverse)', async () => {
    const app = buildApp();
    const started = await request(app)
      .post('/api/widget/conversations')
      .set('x-inbox-token', TOKEN)
      .send({ contact: { name: 'Visitor', email: 'v@x.com' } });
    const convId = started.body.conversation.id;

    for (const text of ['first', 'second']) {
      const sent = await request(app)
        .post(`/api/widget/conversations/${convId}/messages`)
        .set('x-inbox-token', TOKEN)
        .send({ content: text });
      expect(sent.status).toBe(200);
      expect(sent.body.senderType).toBe('contact');
    }

    const listed = await request(app)
      .get(`/api/widget/conversations/${convId}/messages`)
      .set('x-inbox-token', TOKEN);
    expect(listed.status).toBe(200);
    expect(listed.body.messages.map((m: any) => m.content)).toEqual(['first', 'second']);
  });

  it('refuses messages for a conversation on another channel', async () => {
    const app = buildApp();
    stores.conversations.set('conv_other', { id: 'conv_other', workspaceId: 'ws_test', inboxChannelId: 'ch_other' });
    const res = await request(app)
      .get('/api/widget/conversations/conv_other/messages')
      .set('x-inbox-token', TOKEN);
    expect(res.status).toBe(403);
  });

  it('the corrected SSE route exists and streams (query token, as EventSource requires)', async () => {
    const app = buildApp();
    const started = await request(app)
      .post('/api/widget/conversations')
      .set('x-inbox-token', TOKEN)
      .send({ contact: { name: 'Visitor', email: 'v@x.com' } });
    const convId = started.body.conversation.id;

    const server = app.listen(0);
    await new Promise<void>((resolve) => server.on('listening', resolve));
    const port = (server.address() as any).port;
    const headers: Record<string, string> = await new Promise((resolve, reject) => {
      const req = http.get(
        `http://127.0.0.1:${port}/api/widget/conversations/${convId}/sse?inboxToken=${TOKEN}`,
        (res) => {
          const h: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) h[k] = String(v);
          req.destroy();
          resolve(h);
        },
      );
      req.on('error', reject);
      setTimeout(() => reject(new Error('SSE request timed out')), 5000);
    });
    expect(headers['content-type']).toContain('text/event-stream');
    server.close();
  });
});
