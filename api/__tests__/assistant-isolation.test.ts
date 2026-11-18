import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import assistantRouter from '../routes/assistant.routes.js';
import { errorHandler } from '../middleware/error.js';

interface FixtureConversation {
  id: string;
  workspaceId: string;
  userId: string;
  title: string;
  mode: string;
  thinking: string;
  projectId?: string | null;
  pinnedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FixtureMessage {
  id: string;
  workspaceId: string;
  conversationId: string;
  userId: string;
  role: string;
  parts: any[];
  searchableText: string;
  createdAt: Date;
  updatedAt: Date;
}

const mockConversations: Record<string, FixtureConversation> = {};
const mockMessages: Record<string, FixtureMessage> = {};

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    // D4: lets the pre-flight budget check read (plan null → default
    // budget, zero usage) instead of failing open with a noisy log.
    workspace: { findUnique: vi.fn().mockResolvedValue(null) },
    agentTokenUsage: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn().mockImplementation(async (callback) => {
      const txMock = {
        $executeRaw: vi.fn().mockResolvedValue(1),
        assistantConversation: {
          findMany: vi.fn().mockImplementation(({ where }) => {
            return Promise.resolve(
              Object.values(mockConversations).filter(
                (c) => c.workspaceId === where.workspaceId && c.userId === where.userId
              )
            );
          }),
          findFirst: vi.fn().mockImplementation(({ where }) => {
            const item = mockConversations[where.id];
            if (item && item.workspaceId === where.workspaceId && item.userId === where.userId) {
              const msgs = Object.values(mockMessages).filter((m) => m.conversationId === item.id);
              return Promise.resolve({ ...item, messages: msgs });
            }
            return Promise.resolve(null);
          }),
          create: vi.fn().mockImplementation(({ data }) => {
            const id = `convo-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const item = {
              id,
              ...data,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockConversations[id] = item;
            return Promise.resolve(item);
          }),
          update: vi.fn().mockImplementation(({ where, data }) => {
            const item = mockConversations[where.id];
            if (item) {
              Object.assign(item, data, { updatedAt: new Date() });
              return Promise.resolve(item);
            }
            return Promise.reject(new Error('Record not found'));
          }),
          delete: vi.fn().mockImplementation(({ where }) => {
            delete mockConversations[where.id];
            return Promise.resolve({ id: where.id });
          }),
        },
        assistantMessage: {
          findFirst: vi.fn().mockImplementation(({ where }) => {
            const msg = mockMessages[where.id];
            if (msg && msg.workspaceId === where.workspaceId && msg.userId === where.userId) {
              return Promise.resolve(msg);
            }
            return Promise.resolve(null);
          }),
          create: vi.fn().mockImplementation(({ data }) => {
            const id = `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const item = {
              id,
              ...data,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockMessages[id] = item;
            return Promise.resolve(item);
          }),
          update: vi.fn().mockImplementation(({ where, data }) => {
            const item = mockMessages[where.id];
            if (item) {
              Object.assign(item, data, { updatedAt: new Date() });
              return Promise.resolve(item);
            }
            return Promise.reject(new Error('Message not found'));
          }),
          delete: vi.fn().mockImplementation(({ where }) => {
            delete mockMessages[where.id];
            return Promise.resolve({ id: where.id });
          }),
          deleteMany: vi.fn().mockImplementation(({ where }) => {
            let count = 0;
            for (const [id, msg] of Object.entries(mockMessages)) {
              if (msg.conversationId === where.conversationId && msg.createdAt > where.createdAt.gt) {
                delete mockMessages[id];
                count++;
              }
            }
            return Promise.resolve({ count });
          }),
        },
        assistantSettings: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            defaultMode: 'ask',
            thinking: 'auto',
          }),
        },
        // D4: streamTurn reads workspace settings; the mock previously
        // had no such delegate because no test ran a full turn.
        assistantWorkspaceSettings: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...data })),
        },
        assistantUsage: {
          upsert: vi.fn().mockResolvedValue({ id: 'usage-1' }),
        },
      };
      return await callback(txMock);
    }),
  },
}));

vi.mock('../../packages/ai/engine/chat-engine.js', () => ({
  chatEngine: {
    stream: vi.fn().mockImplementation(async function* () {
      yield { type: 'delta', text: 'Hello from Stone AI' };
      yield { type: 'done', inputTokens: 10, outputTokens: 20, fullText: 'Hello from Stone AI' };
    }),
    generateTitle: vi.fn().mockResolvedValue({ title: 'Calculated Title', usage: { input: 5, output: 7 } }),
  },
}));

function buildApp(workspaceId: string, userId: string) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.workspaceId = workspaceId;
    req.userId = userId;
    next();
  });
  app.use('/api/assistant', assistantRouter);
  app.use(errorHandler);
  return app;
}

describe('Assistant Multi-Tenant & Cross-User Strict Isolation Suite (P0 Gate)', () => {
  beforeEach(() => {
    // Reset fixtures
    for (const key of Object.keys(mockConversations)) delete mockConversations[key];
    for (const key of Object.keys(mockMessages)) delete mockMessages[key];

    // Tenant A, User 1
    mockConversations['convo-tenant-a-user-1'] = {
      id: 'convo-tenant-a-user-1',
      workspaceId: 'ws-tenant-a',
      userId: 'user-a-1',
      title: 'Tenant A Secret Chat',
      mode: 'read_only',
      thinking: 'auto',
      createdAt: new Date('2026-10-01'),
      updatedAt: new Date('2026-10-01'),
    };
    mockMessages['msg-a-1'] = {
      id: 'msg-a-1',
      workspaceId: 'ws-tenant-a',
      conversationId: 'convo-tenant-a-user-1',
      userId: 'user-a-1',
      role: 'user',
      parts: [{ type: 'text', text: 'Tenant A confidential message' }],
      searchableText: 'Tenant A confidential message',
      createdAt: new Date('2026-10-01'),
      updatedAt: new Date('2026-10-01'),
    };

    // Tenant A, User 2 (same workspace, different user)
    mockConversations['convo-tenant-a-user-2'] = {
      id: 'convo-tenant-a-user-2',
      workspaceId: 'ws-tenant-a',
      userId: 'user-a-2',
      title: 'Tenant A Peer Private Chat',
      mode: 'read_only',
      thinking: 'auto',
      createdAt: new Date('2026-10-02'),
      updatedAt: new Date('2026-10-02'),
    };

    // Tenant B, User 1 (different workspace)
    mockConversations['convo-tenant-b-user-1'] = {
      id: 'convo-tenant-b-user-1',
      workspaceId: 'ws-tenant-b',
      userId: 'user-b-1',
      title: 'Tenant B Top Secret Strategy',
      mode: 'full',
      thinking: 'auto',
      createdAt: new Date('2026-10-03'),
      updatedAt: new Date('2026-10-03'),
    };
    mockMessages['msg-b-1'] = {
      id: 'msg-b-1',
      workspaceId: 'ws-tenant-b',
      conversationId: 'convo-tenant-b-user-1',
      userId: 'user-b-1',
      role: 'user',
      parts: [{ type: 'text', text: 'Tenant B strategy details' }],
      searchableText: 'Tenant B strategy details',
      createdAt: new Date('2026-10-03'),
      updatedAt: new Date('2026-10-03'),
    };
  });

  it('1. User A-1 can list their own chats and NEVER sees Tenant B or Peer User A-2 chats', async () => {
    const app = buildApp('ws-tenant-a', 'user-a-1');
    const res = await request(app).get('/api/assistant/conversations');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe('convo-tenant-a-user-1');
  });

  it('2. Reading cross-tenant conversation returns 404 (identical to non-existent)', async () => {
    const app = buildApp('ws-tenant-a', 'user-a-1');
    // Request Tenant B conversation
    const resTenantB = await request(app).get('/api/assistant/conversations/convo-tenant-b-user-1');
    expect(resTenantB.status).toBe(404);
    expect(resTenantB.body.error).toBe('Conversation not found');

    // Request non-existent conversation
    const resGuessed = await request(app).get('/api/assistant/conversations/random-non-existent-id');
    expect(resGuessed.status).toBe(404);
    expect(resGuessed.body.error).toBe('Conversation not found');
  });

  it('3. Reading peer conversation within same workspace returns 404', async () => {
    const app = buildApp('ws-tenant-a', 'user-a-1');
    // Request User A-2 conversation in ws-tenant-a
    const res = await request(app).get('/api/assistant/conversations/convo-tenant-a-user-2');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Conversation not found');
  });

  it('4. Renaming / patching cross-tenant conversation returns 404 and does not modify it', async () => {
    const app = buildApp('ws-tenant-a', 'user-a-1');
    const res = await request(app)
      .patch('/api/assistant/conversations/convo-tenant-b-user-1')
      .send({ title: 'Hacked Title' });
    expect(res.status).toBe(404);
    expect(mockConversations['convo-tenant-b-user-1'].title).toBe('Tenant B Top Secret Strategy');
  });

  it('5. Deleting cross-tenant conversation returns 404 and does not delete it', async () => {
    const app = buildApp('ws-tenant-a', 'user-a-1');
    const res = await request(app).delete('/api/assistant/conversations/convo-tenant-b-user-1');
    expect(res.status).toBe(404);
    expect(mockConversations['convo-tenant-b-user-1']).toBeDefined();
  });

  it('6. Posting message to cross-tenant conversation returns 404 without emitting SSE or saving message', async () => {
    const app = buildApp('ws-tenant-a', 'user-a-1');
    const res = await request(app)
      .post('/api/assistant/conversations/convo-tenant-b-user-1/messages')
      .send({ content: 'Attempted injection across tenants' });
    expect(res.status).toBe(404);

    const crossMessages = Object.values(mockMessages).filter(
      (m) => m.conversationId === 'convo-tenant-b-user-1' && m.searchableText.includes('injection')
    );
    expect(crossMessages).toHaveLength(0);
  });

  it('7. Regenerate on cross-tenant conversation returns 404', async () => {
    const app = buildApp('ws-tenant-a', 'user-a-1');
    const res = await request(app).post('/api/assistant/conversations/convo-tenant-b-user-1/regenerate');
    expect(res.status).toBe(404);
  });

  it('8. Giving feedback on cross-tenant message returns 404', async () => {
    const app = buildApp('ws-tenant-a', 'user-a-1');
    const res = await request(app)
      .post('/api/assistant/messages/msg-b-1/feedback')
      .send({ rating: 'down', comment: 'Malicious feedback' });
    expect(res.status).toBe(404);
  });

  it('9. Client-provided workspaceId or userId in body/query is completely ignored in favor of session', async () => {
    const app = buildApp('ws-tenant-a', 'user-a-1');
    const res = await request(app)
      .post('/api/assistant/conversations')
      .send({
        title: 'Safe Chat',
        workspaceId: 'ws-tenant-b', // Spoofed!
        userId: 'user-b-1',         // Spoofed!
      });

    expect(res.status).toBe(200);
    expect(res.body.workspaceId).toBe('ws-tenant-a');
    expect(res.body.userId).toBe('user-a-1');
  });

  it('10. D4: a first-exchange turn counts the title call in the turn total exactly once', async () => {
    // NOTE: this calls streamTurn directly instead of going through the
    // route — the route aborts its signal on req 'close', and supertest
    // fires that as soon as the request body is sent, so no turn ever
    // runs through the route under supertest (the loop breaks stopped
    // with zero main-loop tokens). The direct call uses a live signal.
    const { assistantOrchestrator } = await import('../services/assistant/orchestrator.js');

    // Fresh conversation titled 'New Conversation' with no messages yet —
    // the only fixture state where the title block runs.
    mockConversations['convo-title-test'] = {
      id: 'convo-title-test',
      workspaceId: 'ws-tenant-a',
      userId: 'user-a-1',
      title: 'New Conversation',
      mode: 'read_only',
      thinking: 'auto',
      createdAt: new Date('2026-10-04'),
      updatedAt: new Date('2026-10-04'),
    };

    const sseChunks: string[] = [];
    const fakeRes: any = {
      writableEnded: false,
      setHeader: () => {},
      flushHeaders: () => {},
      write: (chunk: string) => {
        sseChunks.push(chunk);
        return true;
      },
      end: () => {
        fakeRes.writableEnded = true;
      },
      status: () => fakeRes,
      json: () => {},
    };

    await assistantOrchestrator.streamTurn({
      workspaceId: 'ws-tenant-a',
      userId: 'user-a-1',
      userRole: 'member',
      userName: 'User',
      conversationId: 'convo-title-test',
      content: 'Hello, what deals do we have open?',
      res: fakeRes,
      signal: new AbortController().signal,
    });

    const stream = sseChunks.join('');
    // The mocked main loop reports 10 in / 20 out; the mocked title call
    // reports 5 in / 7 out. The 'done' event must carry 15 / 27 — the
    // title tokens added to the turn total once, not dropped, not doubled.
    // (incrementUsage receives the same totals, so the daily bucket holds
    // turn + title exactly once too.)
    const doneBlock = stream
      .split('\n\n')
      .find((b) => b.startsWith('event: done'));
    expect(doneBlock).toBeDefined();
    const doneData = JSON.parse(doneBlock!.split('data: ')[1]);
    expect(doneData.inputTokens).toBe(15);
    expect(doneData.outputTokens).toBe(27);
    expect(mockConversations['convo-title-test'].title).toBe('Calculated Title');
  });
});
