/**
 * Funnels — Wave 1 item 1.2 / outline 02-18.
 * No funnel model, route, or page existed: a multi-step funnel could not be
 * created, published, or measured anywhere. These tests pin the service +
 * route contract with a fake db (supertest + stub workspace middleware).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  funnels: [] as any[],
  steps: [] as any[],
  stepViews: [] as any[],
  pages: [] as any[],
  campaigns: [] as any[],
  responses: [] as any[],
  contacts: [] as any[],
  // Monotonic id counters: length+1 ids collide after a delete + create.
  seq: { funnel: 0, step: 0, page: 0, campaign: 0 },
}));

// The fake db is built inside vi.hoisted: the vi.mock factory is hoisted above
// the module body, so a top-level const would read as uninitialized there.
const fakeDb: any = vi.hoisted(() => {
  const matches = (where: any, row: any): boolean =>
    Object.entries(where || {}).every(([k, v]) => {
      if (v !== null && typeof v === 'object' && 'in' in (v as any)) {
        return (v as any).in.includes(row[k]);
      }
      return row[k] === v;
    });

  const sortRows = (rows: any[], orderBy: any): any[] => {
    if (!orderBy) return rows;
    const [[key, dir]] = Object.entries(orderBy);
    return [...rows].sort((a, b) =>
      dir === 'desc'
        ? String(b[key]).localeCompare(String(a[key]))
        : String(a[key]).localeCompare(String(b[key])),
    );
  };

  const db: any = {
    funnel: {
      findMany: vi.fn(async ({ where, orderBy }: any) =>
        sortRows(state.funnels.filter((f) => matches(where, f)), orderBy),
      ),
      findFirst: vi.fn(async ({ where }: any) =>
        state.funnels.find((f) => matches(where, f)) ?? null,
      ),
      findUnique: vi.fn(async ({ where }: any) =>
        state.funnels.find((f) => matches(where, f)) ?? null,
      ),
      create: vi.fn(async ({ data }: any) => {
        const now = new Date().toISOString();
        const row = { id: `fn_${++state.seq.funnel}`, ...data, createdAt: now, updatedAt: now };
        state.funnels.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = state.funnels.find((f) => f.id === where.id);
        if (!row) throw new Error('Record not found');
        Object.assign(row, data, { updatedAt: new Date().toISOString() });
        return row;
      }),
      delete: vi.fn(async ({ where }: any) => {
        const i = state.funnels.findIndex((f) => f.id === where.id);
        if (i === -1) throw new Error('Record not found');
        const [row] = state.funnels.splice(i, 1);
        return row;
      }),
    },
    funnelStep: {
      findMany: vi.fn(async ({ where, orderBy, include }: any) => {
        const rows = sortRows(state.steps.filter((s) => matches(where, s)), orderBy);
        return rows.map((s) => ({
          ...s,
          landingPage: include?.landingPage
            ? state.pages.find((p) => p.id === s.landingPageId) ?? null
            : undefined,
          campaign: include?.campaign
            ? state.campaigns.find((c) => c.id === s.campaignId) ?? null
            : undefined,
        }));
      }),
      create: vi.fn(async ({ data }: any) => {
        const now = new Date().toISOString();
        const row = {
          id: `fs_${++state.seq.step}`,
          ...data,
          createdAt: now,
          updatedAt: now,
        };
        state.steps.push(row);
        return row;
      }),
      createMany: vi.fn(async ({ data }: any) => {
        for (const d of data) {
          const now = new Date().toISOString();
          state.steps.push({
            id: `fs_${++state.seq.step}`,
            ...d,
            createdAt: now,
            updatedAt: now,
          });
        }
        return { count: data.length };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = state.steps.find((s) => s.id === where.id);
        if (!row) throw new Error('Record not found');
        Object.assign(row, data, { updatedAt: new Date().toISOString() });
        return row;
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        const before = state.steps.length;
        state.steps = state.steps.filter((s) => !matches(where, s));
        return { count: before - state.steps.length };
      }),
    },
    funnelStepView: {
      groupBy: vi.fn(async ({ by, where }: any) => {
        const field = by[0];
        const rows = state.stepViews.filter((v) => matches(where, v));
        const counts = new Map<string, number>();
        for (const r of rows) counts.set(r[field], (counts.get(r[field]) ?? 0) + 1);
        return [...counts.entries()].map(([key, count]) => ({ [field]: key, _count: { _all: count } }));
      }),
      deleteMany: vi.fn(async ({ where }: any) => {
        const before = state.stepViews.length;
        state.stepViews = state.stepViews.filter((v) => !matches(where, v));
        return { count: before - state.stepViews.length };
      }),
    },
    landingPage: {
      findMany: vi.fn(async ({ where }: any) => state.pages.filter((p) => matches(where, p))),
    },
    campaign: {
      findMany: vi.fn(async ({ where }: any) => state.campaigns.filter((c) => matches(where, c))),
    },
    formResponse: {
      groupBy: vi.fn(async ({ by, where }: any) => {
        const field = by[0];
        const rows = state.responses.filter((r) => matches(where, r));
        const counts = new Map<string, number>();
        for (const r of rows) {
          if (r[field]) counts.set(r[field], (counts.get(r[field]) ?? 0) + 1);
        }
        return [...counts.entries()].map(([key, count]) => ({ [field]: key, _count: { _all: count } }));
      }),
      findMany: vi.fn(async ({ where, orderBy, take }: any) => {
        let rows = sortRows(state.responses.filter((r) => matches(where, r)), orderBy);
        if (typeof take === 'number') rows = rows.slice(0, take);
        return rows.map((r) => ({
          ...r,
          contact: state.contacts.find((c) => c.id === r.contactId) ?? null,
        }));
      }),
    },
    $transaction: vi.fn(async (arg: any) => {
      // The service uses both forms: an array of ops, and a callback receiving tx.
      if (typeof arg === 'function') return arg(db);
      return Promise.all(arg);
    }),
  };
  return db;
});

vi.mock('../../infrastructure/database/client.js', () => ({ db: fakeDb }));

import router from '../routes/funnels.routes.js';

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.workspaceId = 'ws_test';
  req.userId = 'user_test';
  next();
});
app.use('/api/funnels', router);
// Central error handler, same contract as server.ts: AppError -> its status.
app.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err.statusCode ?? 500).json({ error: err.message });
});

function seedPage(overrides: any = {}) {
  const row = {
    id: `lp_${++state.seq.page}`,
    workspaceId: 'ws_test',
    name: 'Test Page',
    slug: `test-page-${state.pages.length + 1}`,
    status: 'published',
    ...overrides,
  };
  state.pages.push(row);
  return row;
}

function seedCampaign(overrides: any = {}) {
  const row = { id: `cp_${++state.seq.campaign}`, workspaceId: 'ws_test', name: 'Test Campaign', status: 'DRAFT', ...overrides };
  state.campaigns.push(row);
  return row;
}

function seedFunnel(overrides: any = {}) {
  const row = {
    id: `fn_${++state.seq.funnel}`,
    workspaceId: 'ws_test',
    name: 'Test Funnel',
    slug: `test-funnel-${state.funnels.length + 1}`,
    status: 'draft',
    publishedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
  state.funnels.push(row);
  return row;
}

function seedStep(funnelId: string, overrides: any = {}) {
  const row = {
    id: `fs_${++state.seq.step}`,
    workspaceId: 'ws_test',
    funnelId,
    position: state.steps.filter((s) => s.funnelId === funnelId).length,
    landingPageId: 'lp_1',
    offerTitle: null,
    offerBody: null,
    tagOnSubmit: null,
    campaignId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
  state.steps.push(row);
  return row;
}

describe('Funnels (Wave 1 item 1.2)', () => {
  beforeEach(() => {
    state.funnels = [];
    state.steps = [];
    state.stepViews = [];
    state.pages = [];
    state.campaigns = [];
    state.responses = [];
    state.contacts = [];
    state.seq = { funnel: 0, step: 0, page: 0, campaign: 0 };
  });

  it('lists funnels with real totals, conversion null at 0 views', async () => {
    const funnel = seedFunnel();
    const page = seedPage();
    const s1 = seedStep(funnel.id, { landingPageId: page.id });
    const s2 = seedStep(funnel.id, { landingPageId: page.id });
    state.stepViews.push(
      { id: 'v1', stepId: s1.id },
      { id: 'v2', stepId: s1.id },
      { id: 'v3', stepId: s2.id },
    );
    state.responses.push({ id: 'r1', funnelStepId: s1.id });
    const res = await request(app).get('/api/funnels');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].totals).toEqual({ views: 3, submissions: 1, conversion: 33.3 });
    expect(res.body[0].steps[0].stats).toEqual({ views: 2, submissions: 1, conversion: 50, reachedNext: 50 });
    expect(res.body[0].steps[1].stats).toEqual({ views: 1, submissions: 0, conversion: 0, reachedNext: null });
  });

  it('creates a funnel with steps: slug from name, draft, positions in order', async () => {
    const p1 = seedPage({ slug: 'guide' });
    const p2 = seedPage({ slug: 'offer' });
    const cp = seedCampaign();
    const res = await request(app)
      .post('/api/funnels')
      .send({
        name: 'Free Guide Funnel',
        steps: [
          { landingPageId: p1.id, offerTitle: 'Get the guide', tagOnSubmit: 'funnel:guide' },
          { landingPageId: p2.id, campaignId: cp.id },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('free-guide-funnel');
    expect(res.body.status).toBe('draft');
    expect(res.body.steps).toHaveLength(2);
    expect(res.body.steps[0].position).toBe(0);
    expect(res.body.steps[0].tagOnSubmit).toBe('funnel:guide');
    expect(res.body.steps[1].position).toBe(1);
    expect(res.body.steps[1].campaign?.id).toBe(cp.id);
    expect(res.body.totals).toEqual({ views: 0, submissions: 0, conversion: null });
  });

  it('rejects a step with an unknown landing page or campaign', async () => {
    const badPage = await request(app)
      .post('/api/funnels')
      .send({ name: 'X', steps: [{ landingPageId: 'lp_nope' }] });
    expect(badPage.status).toBe(400);

    const page = seedPage();
    const badCampaign = await request(app)
      .post('/api/funnels')
      .send({ name: 'X', steps: [{ landingPageId: page.id, campaignId: 'cp_nope' }] });
    expect(badCampaign.status).toBe(400);
  });

  it('rejects a bad slug and uniquifies a taken slug', async () => {
    const bad = await request(app).post('/api/funnels').send({ name: 'X', slug: 'Bad Slug!' });
    expect(bad.status).toBe(400);
    seedFunnel({ slug: 'free-guide-funnel' });
    const res = await request(app).post('/api/funnels').send({ name: 'Free Guide Funnel' });
    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('free-guide-funnel-2');
  });

  it('404s on an unknown funnel and on another workspace’s funnel', async () => {
    const missing = await request(app).get('/api/funnels/fn_nope');
    expect(missing.status).toBe(404);
    seedFunnel({ workspaceId: 'ws_other' });
    const other = await request(app).get('/api/funnels/fn_1');
    expect(other.status).toBe(404);
  });

  it('update syncs steps: keeps ids and views, drops removed steps, adds new ones', async () => {
    const funnel = seedFunnel();
    const page = seedPage();
    const s1 = seedStep(funnel.id, { landingPageId: page.id });
    const s2 = seedStep(funnel.id, { landingPageId: page.id });
    state.stepViews.push({ id: 'v1', funnelId: funnel.id, stepId: s1.id }, { id: 'v2', funnelId: funnel.id, stepId: s2.id });
    const res = await request(app)
      .put(`/api/funnels/${funnel.id}`)
      .send({
        steps: [
          { id: s1.id, landingPageId: page.id, offerTitle: 'Updated offer' },
          { landingPageId: page.id },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.steps).toHaveLength(2);
    expect(res.body.steps[0].id).toBe(s1.id);
    expect(res.body.steps[0].offerTitle).toBe('Updated offer');
    expect(res.body.steps[0].stats.views).toBe(1);
    expect(res.body.steps[1].id).not.toBe(s2.id);
    expect(state.steps.find((s) => s.id === s2.id)).toBeUndefined();
    expect(state.stepViews.find((v) => v.stepId === s2.id)).toBeUndefined();
  });

  it('publish requires 2 steps and published pages, then sets publishedAt', async () => {
    const one = seedFunnel();
    const page = seedPage();
    seedStep(one.id, { landingPageId: page.id });
    const tooFew = await request(app).post(`/api/funnels/${one.id}/publish`);
    expect(tooFew.status).toBe(400);

    const draftPage = seedFunnel();
    const draft = seedPage({ status: 'draft' });
    seedStep(draftPage.id, { landingPageId: page.id });
    seedStep(draftPage.id, { landingPageId: draft.id });
    const draftBlock = await request(app).post(`/api/funnels/${draftPage.id}/publish`);
    expect(draftBlock.status).toBe(400);
    expect(draftBlock.body.error).toMatch(/not published/);

    const ok = seedFunnel();
    seedStep(ok.id, { landingPageId: page.id });
    seedStep(ok.id, { landingPageId: page.id });
    const res = await request(app).post(`/api/funnels/${ok.id}/publish`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('published');
    expect(res.body.publishedAt).toBeTruthy();

    const unpub = await request(app).post(`/api/funnels/${ok.id}/unpublish`);
    expect(unpub.body.status).toBe('draft');
    expect(unpub.body.publishedAt).toBeNull();
  });

  it('refuses a slug change on a published funnel', async () => {
    const funnel = seedFunnel({ status: 'published' });
    const res = await request(app).put(`/api/funnels/${funnel.id}`).send({ slug: 'new-slug' });
    expect(res.status).toBe(400);
  });

  it('duplicate copies steps with fresh ids, as a draft with a new slug', async () => {
    const funnel = seedFunnel({ name: 'Original', slug: 'original', status: 'published' });
    const page = seedPage();
    seedStep(funnel.id, { landingPageId: page.id, offerTitle: 'Deal' });
    seedStep(funnel.id, { landingPageId: page.id });
    const res = await request(app).post(`/api/funnels/${funnel.id}/duplicate`);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Original (copy)');
    expect(res.body.slug).toBe('original-copy');
    expect(res.body.status).toBe('draft');
    expect(res.body.steps).toHaveLength(2);
    expect(res.body.steps[0].id).not.toBe('fs_1');
    expect(res.body.steps[0].offerTitle).toBe('Deal');
  });

  it('delete removes the funnel, its steps, and their views', async () => {
    const funnel = seedFunnel();
    const page = seedPage();
    const s1 = seedStep(funnel.id, { landingPageId: page.id });
    state.stepViews.push({ id: 'v1', funnelId: funnel.id, stepId: s1.id });
    const res = await request(app).delete(`/api/funnels/${funnel.id}`);
    expect(res.status).toBe(200);
    expect(state.funnels).toHaveLength(0);
    expect(state.steps).toHaveLength(0);
    expect(state.stepViews).toHaveLength(0);
  });

  it('stats endpoint reports per-step views, submissions, conversion, reachedNext', async () => {
    const funnel = seedFunnel();
    const page = seedPage();
    const s1 = seedStep(funnel.id, { landingPageId: page.id });
    const s2 = seedStep(funnel.id, { landingPageId: page.id });
    state.stepViews.push(
      { id: 'v1', stepId: s1.id },
      { id: 'v2', stepId: s1.id },
      { id: 'v3', stepId: s1.id },
      { id: 'v4', stepId: s1.id },
      { id: 'v5', stepId: s2.id },
      { id: 'v6', stepId: s2.id },
    );
    state.responses.push({ id: 'r1', funnelStepId: s1.id });
    const res = await request(app).get(`/api/funnels/${funnel.id}/stats`);
    expect(res.status).toBe(200);
    expect(res.body.views).toBe(6);
    expect(res.body.submissions).toBe(1);
    expect(res.body.conversion).toBe(16.7);
    expect(res.body.steps[0].stats).toEqual({ views: 4, submissions: 1, conversion: 25, reachedNext: 50 });
    expect(res.body.steps[1].stats).toEqual({ views: 2, submissions: 0, conversion: 0, reachedNext: null });
  });

  it('submissions endpoint lists funnel submissions newest-first with contact info', async () => {
    const funnel = seedFunnel();
    const page = seedPage();
    const s1 = seedStep(funnel.id, { landingPageId: page.id });
    state.contacts.push(
      { id: 'ct_1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' },
      { id: 'ct_2', firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com' },
    );
    state.responses.push(
      { id: 'r1', funnelId: funnel.id, funnelStepId: s1.id, workspaceId: 'ws_test', contactId: 'ct_1', answersJson: { email: 'ada@example.com' }, submittedAt: '2026-11-19T10:00:00.000Z' },
      { id: 'r2', funnelId: funnel.id, funnelStepId: s1.id, workspaceId: 'ws_test', contactId: 'ct_2', answersJson: { email: 'grace@example.com' }, submittedAt: '2026-11-19T12:00:00.000Z' },
      { id: 'r3', funnelId: 'fn_other', funnelStepId: s1.id, workspaceId: 'ws_test', contactId: 'ct_1', answersJson: {}, submittedAt: '2026-11-19T13:00:00.000Z' },
    );
    const res = await request(app).get(`/api/funnels/${funnel.id}/submissions`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].contact.email).toBe('grace@example.com');
    expect(res.body[1].contact.email).toBe('ada@example.com');
  });

  it('submissions endpoint 404s on an unknown funnel', async () => {
    const res = await request(app).get('/api/funnels/fn_nope/submissions');
    expect(res.status).toBe(404);
  });
});
