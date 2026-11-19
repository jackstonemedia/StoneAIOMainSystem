/**
 * Public funnel steps — Wave 1 item 1.2 / outline 02-18, Slice 3.
 * A published funnel's steps must render at /f/:slug/:step with only
 * visitor-safe fields, and a form submit must create/link the contact,
 * apply the step's tag, enroll the contact in the step's campaign once,
 * and record the response with funnel attribution. Nothing here needs auth.
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
  recipients: [] as any[],
  contacts: [] as any[],
  responses: [] as any[],
  seq: { contact: 0, recipient: 0, response: 0, view: 0 },
}));

const fakeDb: any = vi.hoisted(() => {
  const db: any = {
    funnel: {
      findUnique: vi.fn(async ({ where }: any) => {
        const funnel = state.funnels.find((f) => f.slug === where.slug) ?? null;
        if (!funnel) return null;
        const steps = state.steps
          .filter((s) => s.funnelId === funnel.id)
          .sort((a, b) => a.position - b.position)
          .map((s) => ({
            ...s,
            landingPage: state.pages.find((p) => p.id === s.landingPageId) ?? null,
          }));
        return { ...funnel, steps };
      }),
    },
    funnelStep: {
      findUnique: vi.fn(async ({ where }: any) =>
        state.steps.find((s) => s.id === where.id) ?? null,
      ),
    },
    funnelStepView: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `fv_${++state.seq.view}`, ...data, viewedAt: new Date().toISOString() };
        state.stepViews.push(row);
        return row;
      }),
    },
    contact: {
      findFirst: vi.fn(async ({ where }: any) =>
        state.contacts.find((c) => c.workspaceId === where.workspaceId && c.email === where.email) ?? null,
      ),
      findUnique: vi.fn(async ({ where }: any) =>
        state.contacts.find((c) => c.id === where.id) ?? null,
      ),
      create: vi.fn(async ({ data }: any) => {
        const row = {
          id: `ct_${++state.seq.contact}`,
          tagsJson: '[]',
          ...data,
        };
        state.contacts.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = state.contacts.find((c) => c.id === where.id);
        if (!row) throw new Error('Record not found');
        Object.assign(row, data);
        return row;
      }),
    },
    campaign: {
      findUnique: vi.fn(async ({ where }: any) =>
        state.campaigns.find((c) => c.id === where.id) ?? null,
      ),
    },
    campaignRecipient: {
      findFirst: vi.fn(async ({ where }: any) =>
        state.recipients.find(
          (r) => r.campaignId === where.campaignId && r.contactId === where.contactId,
        ) ?? null,
      ),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `cr_${++state.seq.recipient}`, ...data };
        state.recipients.push(row);
        return row;
      }),
    },
    formResponse: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `fr_${++state.seq.response}`, ...data, submittedAt: new Date().toISOString() };
        state.responses.push(row);
        return row;
      }),
    },
  };
  return db;
});

vi.mock('../../infrastructure/database/client.js', () => ({ db: fakeDb }));

import router from '../routes/public-funnels.routes.js';

const app = express();
app.use(express.json());
app.use('/api/public/funnels', router);
// Central error handler, same contract as server.ts: AppError -> its status.
app.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err.statusCode ?? 500).json({ error: err.message });
});

function seedPage(overrides: any = {}) {
  const row = {
    id: `lp_${state.pages.length + 1}`,
    workspaceId: 'ws_test',
    name: 'Test Page',
    slug: `test-page-${state.pages.length + 1}`,
    status: 'published',
    seoTitle: null,
    seoDesc: null,
    sectionsJson: [{ id: 's1', type: 'hero', config: { heading: 'Hi' } }],
    ...overrides,
  };
  state.pages.push(row);
  return row;
}

function seedFunnel(overrides: any = {}) {
  const row = {
    id: `fn_${state.funnels.length + 1}`,
    workspaceId: 'ws_test',
    name: 'Test Funnel',
    slug: `test-funnel-${state.funnels.length + 1}`,
    status: 'published',
    publishedAt: new Date().toISOString(),
    ...overrides,
  };
  state.funnels.push(row);
  return row;
}

function seedStep(funnelId: string, overrides: any = {}) {
  const row = {
    id: `fs_${state.steps.length + 1}`,
    workspaceId: 'ws_test',
    funnelId,
    position: state.steps.filter((s) => s.funnelId === funnelId).length,
    landingPageId: 'lp_1',
    offerTitle: null,
    offerBody: null,
    tagOnSubmit: null,
    campaignId: null,
    ...overrides,
  };
  state.steps.push(row);
  return row;
}

function twoStepFunnel() {
  const p1 = seedPage({ slug: 'guide-page' });
  const p2 = seedPage({ slug: 'offer-page' });
  const funnel = seedFunnel({ slug: 'guide-funnel' });
  const s1 = seedStep(funnel.id, { landingPageId: p1.id, offerTitle: 'Get the guide', tagOnSubmit: 'funnel:guide' });
  const s2 = seedStep(funnel.id, { landingPageId: p2.id, offerTitle: 'Claim the offer' });
  return { funnel, p1, p2, s1, s2 };
}

describe('Public funnel steps (Wave 1 item 1.2, Slice 3)', () => {
  beforeEach(() => {
    state.funnels = [];
    state.steps = [];
    state.stepViews = [];
    state.pages = [];
    state.campaigns = [];
    state.recipients = [];
    state.contacts = [];
    state.responses = [];
    state.seq = { contact: 0, recipient: 0, response: 0, view: 0 };
  });

  it('GET step 1 returns visitor-safe fields and nextStep 2', async () => {
    const { s1 } = twoStepFunnel();
    const res = await request(app).get('/api/public/funnels/guide-funnel/1');
    expect(res.status).toBe(200);
    expect(res.body.stepId).toBe(s1.id);
    expect(res.body.stepNumber).toBe(1);
    expect(res.body.totalSteps).toBe(2);
    expect(res.body.offerTitle).toBe('Get the guide');
    expect(res.body.nextStep).toBe(2);
    expect(res.body.page.sectionsJson).toHaveLength(1);
    // Nothing a visitor may not see leaks out.
    expect(res.body.workspaceId).toBeUndefined();
    expect(res.body.page.workspaceId).toBeUndefined();
    expect(res.body.page.status).toBeUndefined();
    expect(state.stepViews).toHaveLength(1);
    expect(state.stepViews[0].stepId).toBe(s1.id);
  });

  it('GET the last step returns nextStep null', async () => {
    twoStepFunnel();
    const res = await request(app).get('/api/public/funnels/guide-funnel/2');
    expect(res.status).toBe(200);
    expect(res.body.stepNumber).toBe(2);
    expect(res.body.nextStep).toBeNull();
  });

  it('404s on unknown funnel, draft funnel, bad step, and draft page', async () => {
    const { funnel, s1 } = twoStepFunnel();
    expect((await request(app).get('/api/public/funnels/nope/1')).status).toBe(404);
    expect((await request(app).get('/api/public/funnels/guide-funnel/0')).status).toBe(404);
    expect((await request(app).get('/api/public/funnels/guide-funnel/3')).status).toBe(404);

    funnel.status = 'draft';
    expect((await request(app).get('/api/public/funnels/guide-funnel/1')).status).toBe(404);
    funnel.status = 'published';

    const page = state.pages.find((p) => p.id === s1.landingPageId);
    page.status = 'draft';
    expect((await request(app).get('/api/public/funnels/guide-funnel/1')).status).toBe(404);
  });

  it('submit step 1 creates the contact, tags it, stores the response with funnel attribution', async () => {
    const { funnel, s1 } = twoStepFunnel();
    const res = await request(app)
      .post('/api/public/funnels/guide-funnel/1/submit')
      .send({ name: 'Ada Lovelace', email: 'ada@example.com', phone: '555-1' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, nextStep: 2 });

    expect(state.contacts).toHaveLength(1);
    const contact = state.contacts[0];
    expect(contact.firstName).toBe('Ada');
    expect(contact.lastName).toBe('Lovelace');
    expect(contact.source).toBe('funnel');
    expect(JSON.parse(contact.tagsJson)).toEqual(['funnel:guide']);

    expect(state.responses).toHaveLength(1);
    expect(state.responses[0]).toMatchObject({
      funnelId: funnel.id,
      funnelStepId: s1.id,
      contactId: contact.id,
    });
    expect(state.responses[0].answersJson.email).toBe('ada@example.com');
  });

  it('submit on an existing contact tags without overwriting their data, and enrolls in the campaign once', async () => {
    const { s1, s2 } = twoStepFunnel();
    state.campaigns.push({ id: 'cp_1', workspaceId: 'ws_test', name: 'Follow-up', status: 'DRAFT' });
    s2.campaignId = 'cp_1';
    state.contacts.push({
      id: 'ct_existing',
      workspaceId: 'ws_test',
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.com',
      phone: '555-9',
      source: 'import',
      tagsJson: JSON.stringify(['vip']),
    });

    const res = await request(app)
      .post('/api/public/funnels/guide-funnel/2/submit')
      .send({ name: 'Someone Else', email: 'grace@example.com', phone: '000' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, nextStep: null });

    // Existing contact kept their name, phone, and source; only the tag was added.
    const contact = state.contacts.find((c) => c.id === 'ct_existing');
    expect(contact.firstName).toBe('Grace');
    expect(contact.phone).toBe('555-9');
    expect(contact.source).toBe('import');
    expect(JSON.parse(contact.tagsJson)).toEqual(['vip']);

    expect(state.recipients).toHaveLength(1);
    expect(state.recipients[0]).toMatchObject({ campaignId: 'cp_1', contactId: 'ct_existing', status: 'PENDING' });

    // A second submission by the same contact enrolls once, not twice.
    await request(app)
      .post('/api/public/funnels/guide-funnel/2/submit')
      .send({ name: 'Grace Hopper', email: 'grace@example.com' });
    expect(state.recipients).toHaveLength(1);
    expect(state.contacts).toHaveLength(1);
  });

  it('submit with a bad email is a 400 and stores nothing', async () => {
    twoStepFunnel();
    const res = await request(app)
      .post('/api/public/funnels/guide-funnel/1/submit')
      .send({ name: 'No Email', email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(state.contacts).toHaveLength(0);
    expect(state.responses).toHaveLength(0);
  });

  it('submit to a draft funnel is a 404', async () => {
    const { funnel } = twoStepFunnel();
    funnel.status = 'draft';
    const res = await request(app)
      .post('/api/public/funnels/guide-funnel/1/submit')
      .send({ name: 'Ada', email: 'ada@example.com' });
    expect(res.status).toBe(404);
    expect(state.contacts).toHaveLength(0);
  });
});
