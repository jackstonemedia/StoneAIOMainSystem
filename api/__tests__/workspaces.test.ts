/**
 * Workspace switching — complete-platform item 4.
 *
 * Before this, resolveWorkspace pinned the user to whichever membership
 * findFirst returned: a user joining a second workspace silently landed in
 * the wrong one, and there was no way to create or pick a workspace.
 * Now the client sends its selection as an `x-workspace-id` header (or a
 * `?workspaceId=` query param on GET-only EventSource streams), the
 * middleware honours it only on membership, and anything else fails loudly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  // Memberships of the dev user: ws-alpha (first) and ws-beta.
  memberships: ['ws-alpha', 'ws-beta'] as string[],
  created: [] as any[],
}));

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    workspaceMember: {
      findFirst: vi.fn(async ({ where }: any) => {
        if (where.workspaceId) {
          return state.memberships.includes(where.workspaceId)
            ? { workspaceId: where.workspaceId, role: 'admin' }
            : null;
        }
        // Fallback: first membership.
        return state.memberships.length > 0 ? { workspaceId: state.memberships[0], role: 'admin' } : null;
      }),
      findMany: vi.fn(async () => [
        { workspaceId: 'ws-alpha', role: 'admin', createdAt: new Date('2026-01-01'), workspace: { id: 'ws-alpha', name: 'Alpha Co', plan: 'plus', createdAt: new Date('2026-01-01') } },
        { workspaceId: 'ws-beta', role: 'member', createdAt: new Date('2026-02-01'), workspace: { id: 'ws-beta', name: 'Beta LLC', plan: 'free', createdAt: new Date('2026-02-01') } },
      ]),
      create: vi.fn(async ({ data }: any) => data),
    },
    workspace: {
      create: vi.fn(async ({ data }: any) => ({ id: 'ws-new', ...data, createdAt: new Date() })),
    },
    $transaction: vi.fn(async (fn: any) => {
      const tx = {
        workspace: { create: vi.fn(async ({ data }: any) => ({ id: 'ws-new', ...data, createdAt: new Date() })) },
        workspaceMember: {
          create: vi.fn(async ({ data }: any) => {
            state.created.push(data);
            return data;
          }),
        },
      };
      return fn(tx);
    }),
    user: { upsert: vi.fn(async () => ({})) },
  },
}));

import { resolveWorkspace } from '../middleware/workspace.js';
import workspacesRouter from '../routes/workspaces.routes.js';

function middlewareApp() {
  const app = express();
  app.use(express.json());
  app.use(resolveWorkspace);
  app.get('/probe', (req: any, res: any) => res.json({ workspaceId: req.workspaceId }));
  app.post('/probe', (req: any, res: any) => res.json({ workspaceId: req.workspaceId }));
  return app;
}

function routesApp(workspaceId = 'ws-alpha') {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.userId = 'test_user_new';
    req.workspaceId = workspaceId;
    next();
  });
  app.use('/workspaces', workspacesRouter);
  return app;
}

describe('resolveWorkspace selection (item 4)', () => {
  beforeEach(() => {
    state.memberships = ['ws-alpha', 'ws-beta'];
    state.created = [];
  });

  it('no selection → first membership (today’s behaviour, unchanged)', async () => {
    const res = await request(middlewareApp()).get('/probe');
    expect(res.status).toBe(200);
    expect(res.body.workspaceId).toBe('ws-alpha');
  });

  it('x-workspace-id header is honoured when the user is a member', async () => {
    const res = await request(middlewareApp()).get('/probe').set('x-workspace-id', 'ws-beta');
    expect(res.status).toBe(200);
    expect(res.body.workspaceId).toBe('ws-beta');
  });

  it('x-workspace-id for a workspace the user is NOT a member of fails loudly (400)', async () => {
    const res = await request(middlewareApp()).get('/probe').set('x-workspace-id', 'ws-other');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not a member/);
  });

  it('?workspaceId= works on GET (EventSource streams) and is ignored on POST', async () => {
    const getRes = await request(middlewareApp()).get('/probe?workspaceId=ws-beta');
    expect(getRes.status).toBe(200);
    expect(getRes.body.workspaceId).toBe('ws-beta');

    const postRes = await request(middlewareApp()).post('/probe?workspaceId=ws-beta');
    expect(postRes.status).toBe(200);
    expect(postRes.body.workspaceId).toBe('ws-alpha');
  });

  it('the dev eval override still wins over the selection header', async () => {
    const res = await request(middlewareApp())
      .get('/probe')
      .set('x-workspace-id', 'ws-alpha')
      .set('x-eval-workspace', 'ws-beta');
    expect(res.status).toBe(200);
    expect(res.body.workspaceId).toBe('ws-beta');
  });
});

describe('workspaces routes (item 4)', () => {
  it('GET / lists memberships with isCurrent from the resolved workspace', async () => {
    const res = await request(routesApp('ws-beta')).get('/workspaces');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ id: 'ws-alpha', name: 'Alpha Co', plan: 'plus', role: 'admin', isCurrent: false });
    expect(res.body[1]).toMatchObject({ id: 'ws-beta', name: 'Beta LLC', plan: 'free', role: 'member', isCurrent: true });
  });

  it('POST / creates a workspace with the creator as owner + admin', async () => {
    const res = await request(routesApp()).post('/workspaces').send({ name: 'Gamma Inc' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'ws-new', name: 'Gamma Inc', plan: 'free', role: 'admin' });
    expect(state.created).toContainEqual({ workspaceId: 'ws-new', userId: 'test_user_new', role: 'admin' });
  });

  it('POST / rejects an empty name and a name over 100 chars', async () => {
    expect((await request(routesApp()).post('/workspaces').send({ name: '   ' })).status).toBe(400);
    expect((await request(routesApp()).post('/workspaces').send({ name: 'x'.repeat(101) })).status).toBe(400);
  });
});
