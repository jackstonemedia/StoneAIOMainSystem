/**
 * Public landing pages — Wave 1 item 1.1, Slice 3.
 * The public GET serves a published page only, records a view, and never
 * leaks workspace internals. Drafts and unknown slugs 404.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  pages: [] as any[],
  views: [] as any[],
  contacts: [] as any[],
  responses: [] as any[],
}));

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    landingPage: {
      findUnique: vi.fn(async ({ where }: any) => {
        const row = state.pages.find((p) => p.slug === where.slug) ?? null;
        return row ? { ...row } : null;
      }),
    },
    landingPageView: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `v_${state.views.length + 1}`, ...data };
        state.views.push(row);
        return row;
      }),
    },
    contact: {
      findFirst: vi.fn(async ({ where }: any) => {
        return (
          state.contacts.find((c) => c.workspaceId === where.workspaceId && c.email === where.email) ?? null
        );
      }),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `ct_${state.contacts.length + 1}`, ...data };
        state.contacts.push(row);
        return row;
      }),
    },
    formResponse: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `fr_${state.responses.length + 1}`, ...data };
        state.responses.push(row);
        return row;
      }),
    },
  },
}));

import router from '../routes/public-landing.routes.js';

const app = express();
app.use(express.json());
app.use('/api/public/pages', router);
app.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err.statusCode ?? 500).json({ error: err.message });
});

describe('Public landing pages (Wave 1 item 1.1, Slice 3)', () => {
  beforeEach(() => {
    state.pages = [];
    state.views = [];
    state.contacts = [];
    state.responses = [];
  });

  it('serves a published page and records a view', async () => {
    state.pages.push({
      id: 'lp_1',
      workspaceId: 'ws_test',
      name: 'Free Guide',
      slug: 'free-guide',
      seoTitle: 'Free Guide',
      seoDesc: 'Get it now',
      sectionsJson: [{ id: 's1', type: 'hero', config: {} }],
      status: 'published',
    });
    const res = await request(app).get('/api/public/pages/free-guide');
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('free-guide');
    expect(res.body.sectionsJson).toHaveLength(1);
    // Nothing workspace-internal leaks to the visitor.
    expect(res.body.workspaceId).toBeUndefined();
    expect(res.body.status).toBeUndefined();
    // View recorded (fire-and-forget — give the async write a beat).
    await new Promise((r) => setTimeout(r, 50));
    expect(state.views).toHaveLength(1);
    expect(state.views[0].pageId).toBe('lp_1');
    expect(state.views[0].workspaceId).toBe('ws_test');
  });

  it('404s a draft page', async () => {
    state.pages.push({
      id: 'lp_1',
      workspaceId: 'ws_test',
      name: 'Draft',
      slug: 'draft-page',
      seoTitle: null,
      seoDesc: null,
      sectionsJson: [],
      status: 'draft',
    });
    const res = await request(app).get('/api/public/pages/draft-page');
    expect(res.status).toBe(404);
    expect(state.views).toHaveLength(0);
  });

  it('404s an unknown slug', async () => {
    const res = await request(app).get('/api/public/pages/nope');
    expect(res.status).toBe(404);
  });

  it('submit creates a contact and a form response', async () => {
    state.pages.push({
      id: 'lp_1',
      workspaceId: 'ws_test',
      name: 'Free Guide',
      slug: 'free-guide',
      seoTitle: null,
      seoDesc: null,
      sectionsJson: [],
      status: 'published',
    });
    const res = await request(app)
      .post('/api/public/pages/free-guide/submit')
      .send({ name: 'Ada Lovelace', email: 'ADA@example.com', phone: '555-1', message: 'Hi' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true });
    expect(state.contacts).toHaveLength(1);
    expect(state.contacts[0].email).toBe('ada@example.com');
    expect(state.contacts[0].firstName).toBe('Ada');
    expect(state.contacts[0].lastName).toBe('Lovelace');
    expect(state.responses).toHaveLength(1);
    expect(state.responses[0].contactId).toBe(state.contacts[0].id);
    expect(state.responses[0].answersJson.email).toBe('ada@example.com');
  });

  it('submit reuses an existing contact instead of duplicating it', async () => {
    state.pages.push({
      id: 'lp_1',
      workspaceId: 'ws_test',
      name: 'Free Guide',
      slug: 'free-guide',
      seoTitle: null,
      seoDesc: null,
      sectionsJson: [],
      status: 'published',
    });
    state.contacts.push({
      id: 'ct_existing',
      workspaceId: 'ws_test',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
    });
    const res = await request(app)
      .post('/api/public/pages/free-guide/submit')
      .send({ name: 'Someone Else', email: 'ada@example.com' });
    expect(res.status).toBe(201);
    expect(state.contacts).toHaveLength(1);
    expect(state.contacts[0].firstName).toBe('Ada');
    expect(state.responses[0].contactId).toBe('ct_existing');
  });

  it('submit rejects a bad email and a draft page', async () => {
    state.pages.push({
      id: 'lp_1',
      workspaceId: 'ws_test',
      name: 'Free Guide',
      slug: 'free-guide',
      seoTitle: null,
      seoDesc: null,
      sectionsJson: [],
      status: 'published',
    });
    const badEmail = await request(app)
      .post('/api/public/pages/free-guide/submit')
      .send({ email: 'not-an-email' });
    expect(badEmail.status).toBe(400);
    expect(state.contacts).toHaveLength(0);

    state.pages.push({
      id: 'lp_2',
      workspaceId: 'ws_test',
      name: 'Draft',
      slug: 'draft-page',
      seoTitle: null,
      seoDesc: null,
      sectionsJson: [],
      status: 'draft',
    });
    const draft = await request(app)
      .post('/api/public/pages/draft-page/submit')
      .send({ email: 'a@b.com' });
    expect(draft.status).toBe(404);
    expect(state.contacts).toHaveLength(0);
  });
});
