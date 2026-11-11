/**
 * Opportunity activity logs — Tier 1 Fix 5.
 * POST /api/opportunities/:id/events did not exist, so the detail page
 * fabricated a log row on failure (Date.now() id) and toasted success —
 * the note vanished on refresh. The routes now exist and persist to
 * OpportunityActivityLog; the page throws on failure instead of faking.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  deal: null as any,
  logs: [] as any[],
  created: [] as any[],
}));

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    deal: {
      findFirst: vi.fn(async () => state.deal),
    },
    opportunityActivityLog: {
      findMany: vi.fn(async () => state.logs),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: 'log_new', ...data, createdAt: new Date().toISOString() };
        state.created.push(row);
        return row;
      }),
    },
  },
}));

import router from '../routes/opportunities.routes.js';

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.workspaceId = 'ws_test';
  req.userId = 'user_test';
  next();
});
app.use('/api/opportunities', router);

describe('Opportunity events (Tier 1 Fix 5)', () => {
  beforeEach(() => {
    state.deal = { id: 'deal_1', workspaceId: 'ws_test' };
    state.logs = [
      { id: 'log_1', type: 'internal_comment', title: 'Internal Note', description: 'Called the client', createdAt: '2026-11-10T10:00:00.000Z' },
    ];
    state.created = [];
  });

  it('GET /:id/logs returns persisted logs with content mapped from description', async () => {
    const res = await request(app).get('/api/opportunities/deal_1/logs');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: 'log_1', content: 'Called the client', description: 'Called the client' });
  });

  it('GET /:id/logs on an unknown opportunity is 404', async () => {
    state.deal = null;
    const res = await request(app).get('/api/opportunities/nope/logs');
    expect(res.status).toBe(404);
  });

  it('POST /:id/events persists the note and returns it', async () => {
    const res = await request(app)
      .post('/api/opportunities/deal_1/events')
      .send({ type: 'internal_comment', title: 'Internal Note', content: 'Follow up next week' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ content: 'Follow up next week', description: 'Follow up next week', type: 'internal_comment' });
    expect(state.created).toHaveLength(1);
    expect(state.created[0]).toMatchObject({
      workspaceId: 'ws_test',
      dealId: 'deal_1',
      type: 'internal_comment',
      description: 'Follow up next week',
      userId: 'user_test',
    });
  });

  it('POST /:id/events without content is 400 and persists nothing', async () => {
    const res = await request(app)
      .post('/api/opportunities/deal_1/events')
      .send({ type: 'internal_comment', content: '   ' });
    expect(res.status).toBe(400);
    expect(state.created).toHaveLength(0);
  });

  it('POST /:id/events on an unknown opportunity is 404 and persists nothing', async () => {
    state.deal = null;
    const res = await request(app)
      .post('/api/opportunities/nope/events')
      .send({ type: 'internal_comment', content: 'Hello' });
    expect(res.status).toBe(404);
    expect(state.created).toHaveLength(0);
  });
});
