/**
 * Company activity logs — Tier 1 Fix 6.
 * POST /api/crm/companies/:id/events did not exist (no CompanyEvent model),
 * so the company detail page fabricated a log row on failure (Date.now()
 * id) and toasted success — the note vanished on refresh. The model,
 * migration, and routes now exist; the page throws on failure instead.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  company: null as any,
  events: [] as any[],
  created: [] as any[],
}));

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    company: {
      findFirst: vi.fn(async () => state.company),
    },
    companyEvent: {
      findMany: vi.fn(async () => state.events),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: 'evt_new', ...data, createdAt: new Date().toISOString() };
        state.created.push(row);
        return row;
      }),
    },
  },
}));

import router from '../routes/crm.routes.js';

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.workspaceId = 'ws_test';
  req.userId = 'user_test';
  next();
});
app.use('/api/crm', router);

describe('Company events (Tier 1 Fix 6)', () => {
  beforeEach(() => {
    state.company = { id: 'co_1', workspaceId: 'ws_test', name: 'Acme' };
    state.events = [
      { id: 'evt_1', type: 'internal_comment', title: 'Internal Note', content: 'Met at the expo', createdAt: '2026-11-10T10:00:00.000Z' },
    ];
    state.created = [];
  });

  it('GET /companies/:id/events returns persisted events', async () => {
    const res = await request(app).get('/api/crm/companies/co_1/events');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: 'evt_1', content: 'Met at the expo' });
  });

  it('GET /companies/:id/events on another workspace’s company is 404', async () => {
    state.company = null;
    const res = await request(app).get('/api/crm/companies/co_1/events');
    expect(res.status).toBe(404);
  });

  it('POST /companies/:id/events persists the note and returns it', async () => {
    const res = await request(app)
      .post('/api/crm/companies/co_1/events')
      .send({ type: 'internal_comment', title: 'Internal Note', content: 'Follow up next week' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ content: 'Follow up next week', type: 'internal_comment' });
    expect(state.created).toHaveLength(1);
    expect(state.created[0]).toMatchObject({ companyId: 'co_1', type: 'internal_comment', content: 'Follow up next week' });
  });

  it('POST /companies/:id/events without content is 400 and persists nothing', async () => {
    const res = await request(app)
      .post('/api/crm/companies/co_1/events')
      .send({ type: 'internal_comment', content: '   ' });
    expect(res.status).toBe(400);
    expect(state.created).toHaveLength(0);
  });

  it('POST /companies/:id/events on an unknown company is 404 and persists nothing', async () => {
    state.company = null;
    const res = await request(app)
      .post('/api/crm/companies/co_1/events')
      .send({ type: 'internal_comment', content: 'Hello' });
    expect(res.status).toBe(404);
    expect(state.created).toHaveLength(0);
  });
});
