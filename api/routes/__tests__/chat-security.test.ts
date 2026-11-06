import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import chatRouter from '../chat.routes.js';
import { errorHandler } from '../../middleware/error.js';

interface FixtureAgent {
  id: string;
  workspaceId: string;
  name: string;
  type: string;
  updatedAt: Date;
}

interface FixtureMessage {
  id: string;
  agentId: string;
  userId: string;
  role: string;
  content: string;
  createdAt: Date;
}

const mockAgents: Record<string, FixtureAgent> = {
  'conv-tenant-a': {
    id: 'conv-tenant-a',
    workspaceId: 'ws-tenant-a',
    name: 'Tenant A Convo',
    type: 'assistant',
    updatedAt: new Date(),
  },
  'conv-tenant-b': {
    id: 'conv-tenant-b',
    workspaceId: 'ws-tenant-b',
    name: 'Tenant B Convo',
    type: 'assistant',
    updatedAt: new Date(),
  },
};

const mockMessages: FixtureMessage[] = [
  {
    id: 'msg-1',
    agentId: 'conv-tenant-a',
    userId: 'user-a',
    role: 'user',
    content: 'Tenant A Secret message',
    createdAt: new Date(),
  },
  {
    id: 'msg-2',
    agentId: 'conv-tenant-b',
    userId: 'user-b',
    role: 'user',
    content: 'Tenant B Confidential message',
    createdAt: new Date(),
  },
];

vi.mock('../../../infrastructure/database/client.js', () => ({
  db: {
    agent: {
      findMany: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(
          Object.values(mockAgents).filter(
            (a) => (!where.workspaceId || a.workspaceId === where.workspaceId) && (!where.type || a.type === where.type)
          )
        );
      }),
      findFirst: vi.fn().mockImplementation(({ where }) => {
        const item = mockAgents[where.id];
        if (item && (!where.workspaceId || item.workspaceId === where.workspaceId)) {
          return Promise.resolve(item);
        }
        return Promise.resolve(null);
      }),
      create: vi.fn().mockImplementation(({ data }) => {
        const id = `conv-${Date.now()}`;
        const record = { id, updatedAt: new Date(), ...data };
        mockAgents[id] = record;
        return Promise.resolve(record);
      }),
    },
    agentMessage: {
      findMany: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(mockMessages.filter((m) => m.agentId === where.agentId));
      }),
      create: vi.fn().mockImplementation(({ data }) => {
        const id = `msg-${Date.now()}`;
        const record = { id, createdAt: new Date(), ...data };
        mockMessages.push(record);
        return Promise.resolve(record);
      }),
    },
  },
}));

vi.mock('../../../packages/ai/client.js', () => ({
  DEFAULT_MODEL: 'gemini-3.8-flash',
  tryGetAIClient: vi.fn().mockReturnValue({
    models: {
      generateContentStream: vi.fn().mockResolvedValue([
        { text: 'Mock reply' },
      ]),
    },
  }),
}));

function buildApp(workspaceId: string = 'ws-tenant-a') {
  const app = express();
  app.use(express.json());
  app.use((req: express.Request & { workspaceId?: string; userId?: string }, _res, next) => {
    req.workspaceId = workspaceId;
    req.userId = 'test-user';
    next();
  });
  app.use('/api/conversations', chatRouter);
  app.use(errorHandler);
  return app;
}

describe('Legacy Chat Routes Security & Multi-Tenant Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows reading conversations belonging to the caller workspace', async () => {
    const app = buildApp('ws-tenant-a');
    const res = await request(app).get('/api/conversations/conv-tenant-a');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].content).toBe('Tenant A Secret message');
  });

  it('strictly blocks reading conversations belonging to another workspace (returns 404)', async () => {
    const app = buildApp('ws-tenant-a');
    // Request Tenant B's conversation
    const res = await request(app).get('/api/conversations/conv-tenant-b');
    expect(res.status).toBe(404);
  });

  it('strictly blocks posting messages to conversations belonging to another workspace (returns 404)', async () => {
    const app = buildApp('ws-tenant-a');
    // Post to Tenant B's conversation
    const res = await request(app)
      .post('/api/conversations/conv-tenant-b/messages')
      .send({ message: 'Attempted cross-tenant injection' });
    expect(res.status).toBe(404);
  });
});
