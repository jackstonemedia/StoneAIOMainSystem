/**
 * Live chat provisioning — Tier 3 Tranche A, Fix 13.
 *
 * POST /api/inbox/provision used to have no caller at all: a fresh
 * workspace had no live-chat channel and no way to get one, and the embed
 * snippet route's only caller was the archived inbox. The Conversations
 * settings Live Chat tab is now the caller (toggle → provision → channel
 * + embed snippet). The backend itself was already complete; these tests
 * pin it: provisioning is idempotent, the status endpoint reports it,
 * and the embed code carries the channel's token.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  inboxEnabled: false,
  workspaceUpdates: [] as any[],
  channels: [] as any[],
  labelsCreated: 0,
  sequences: [] as any[],
}));

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    workspace: {
      findUnique: vi.fn(async () => ({ inboxEnabled: state.inboxEnabled })),
      update: vi.fn(async ({ where, data }: any) => {
        state.workspaceUpdates.push({ where, data });
        state.inboxEnabled = true;
        return {};
      }),
    },
    inboxChannel: {
      findMany: vi.fn(async () => state.channels),
      findFirst: vi.fn(async () => state.channels[0] ?? null),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `ich_${state.channels.length + 1}`, ...data };
        state.channels.push(row);
        return row;
      }),
    },
    inboxLabel: {
      createMany: vi.fn(async ({ data }: any) => {
        state.labelsCreated += data.length;
        return { count: data.length };
      }),
    },
    inboxDisplayIdSequence: {
      upsert: vi.fn(async ({ create }: any) => {
        state.sequences.push(create);
        return create;
      }),
    },
    $transaction: vi.fn(async (fn: any) => {
      const tx = {
        workspace: {
          update: vi.fn(async ({ where, data }: any) => {
            state.workspaceUpdates.push({ where, data });
            state.inboxEnabled = true;
            return {};
          }),
        },
        inboxChannel: {
          create: vi.fn(async ({ data }: any) => {
            const row = { id: `ich_${state.channels.length + 1}`, ...data };
            state.channels.push(row);
            return row;
          }),
        },
        inboxLabel: {
          createMany: vi.fn(async ({ data }: any) => {
            state.labelsCreated += data.length;
            return { count: data.length };
          }),
        },
        inboxDisplayIdSequence: {
          upsert: vi.fn(async ({ create }: any) => {
            state.sequences.push(create);
            return create;
          }),
        },
      };
      return fn(tx);
    }),
  },
}));

import inboxRouter from '../routes/inbox.routes.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.workspaceId = 'ws_test';
    req.userId = 'user_1';
    next();
  });
  app.use('/inbox', inboxRouter);
  return app;
}

describe('inbox provisioning (Fix 13)', () => {
  beforeEach(() => {
    state.inboxEnabled = false;
    state.workspaceUpdates = [];
    state.channels = [];
    state.labelsCreated = 0;
    state.sequences = [];
  });

  it('GET /provision reports unprovisioned on a fresh workspace', async () => {
    const res = await request(makeApp()).get('/inbox/provision');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ provisioned: false });
  });

  it('POST /provision creates the channel, labels and sequence exactly once', async () => {
    const app = makeApp();
    const first = await request(app).post('/inbox/provision');
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ success: true });
    expect(state.workspaceUpdates).toHaveLength(1);
    expect(state.channels).toHaveLength(1);
    expect(state.channels[0]).toMatchObject({
      name: 'Support Chat',
      channelType: 'live_chat',
      welcomeMessage: 'Welcome! How can we help you today?',
    });
    expect(state.channels[0].embedToken).toBeTruthy();
    expect(state.labelsCreated).toBe(4);
    expect(state.sequences).toHaveLength(1);

    // Second call is a no-op: the workspace is already provisioned.
    const second = await request(app).post('/inbox/provision');
    expect(second.status).toBe(200);
    expect(state.workspaceUpdates).toHaveLength(1);
    expect(state.channels).toHaveLength(1);
    expect(state.labelsCreated).toBe(4);

    const status = await request(app).get('/inbox/provision');
    expect(status.body).toEqual({ provisioned: true });
  });

  it('GET /channels/:id/embed returns the snippet with the channel token', async () => {
    state.channels = [{
      id: 'ich_1', name: 'Support Chat', channelType: 'live_chat',
      embedToken: 'tok_abc123',
    }];
    const res = await request(makeApp()).get('/inbox/channels/ich_1/embed');
    expect(res.status).toBe(200);
    expect(res.body.token).toBe('tok_abc123');
    expect(res.body.html).toContain('tok_abc123');
    expect(res.body.html).toContain('/widget/v1/loader.js');
    expect(res.body.html).toContain('data-inbox-token');
  });

  it('GET /channels/:id/embed 404s for a missing channel', async () => {
    const res = await request(makeApp()).get('/inbox/channels/nope/embed');
    expect(res.status).toBe(404);
  });
});
