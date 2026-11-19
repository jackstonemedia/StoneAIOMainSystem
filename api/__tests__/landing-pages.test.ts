/**
 * Landing Pages — Wave 1 item 1.1 / outline 02-17.
 * The builder, model, and routes did not exist: a landing page could not be
 * created, published, or measured anywhere. These tests pin the service +
 * route contract with a fake db (supertest + stub workspace middleware).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  pages: [] as any[],
  views: [] as any[],
  responses: [] as any[],
}));

function matches(where: any, row: any): boolean {
  return Object.entries(where || {}).every(([k, v]) => row[k] === v);
}

function withCounts(row: any) {
  return {
    ...row,
    _count: {
      views: state.views.filter((v) => v.pageId === row.id).length,
      responses: state.responses.filter((r) => r.pageId === row.id).length,
    },
  };
}

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    landingPage: {
      findMany: vi.fn(async ({ where }: any) => {
        const rows = state.pages
          .filter((p) => matches(where, p))
          .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
        return rows.map(withCounts);
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        const row = state.pages.find((p) => matches(where, p)) ?? null;
        return row ? withCounts(row) : null;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        const row = state.pages.find((p) => matches(where, p)) ?? null;
        return row ? withCounts(row) : null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const now = new Date().toISOString();
        const row = {
          id: `lp_${state.pages.length + 1}`,
          ...data,
          createdAt: now,
          updatedAt: now,
        };
        state.pages.push(row);
        return withCounts(row);
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = state.pages.find((p) => p.id === where.id);
        if (!row) throw new Error('Record not found');
        Object.assign(row, data, { updatedAt: new Date().toISOString() });
        return withCounts(row);
      }),
      delete: vi.fn(async ({ where }: any) => {
        const i = state.pages.findIndex((p) => p.id === where.id);
        if (i === -1) throw new Error('Record not found');
        const [row] = state.pages.splice(i, 1);
        return row;
      }),
    },
    landingPageView: {
      deleteMany: vi.fn(async ({ where }: any) => {
        const before = state.views.length;
        state.views = state.views.filter((v) => !matches(where, v));
        return { count: before - state.views.length };
      }),
    },
    formResponse: {
      deleteMany: vi.fn(async ({ where }: any) => {
        const before = state.responses.length;
        state.responses = state.responses.filter((r) => !matches(where, r));
        return { count: before - state.responses.length };
      }),
    },
    $transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
  },
}));

import router from '../routes/landing-pages.routes.js';

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.workspaceId = 'ws_test';
  req.userId = 'user_test';
  next();
});
app.use('/api/landing-pages', router);
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
    status: 'draft',
    seoTitle: null,
    seoDesc: null,
    sectionsJson: [],
    publishedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
  state.pages.push(row);
  return row;
}

describe('Landing Pages (Wave 1 item 1.1)', () => {
  beforeEach(() => {
    state.pages = [];
    state.views = [];
    state.responses = [];
  });

  it('lists pages with real stats, conversion null at 0 views', async () => {
    const page = seedPage();
    state.views.push({ id: 'v1', pageId: page.id }, { id: 'v2', pageId: page.id });
    state.responses.push({ id: 'r1', pageId: page.id });
    const res = await request(app).get('/api/landing-pages');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].stats).toEqual({ views: 2, submissions: 1, conversion: 50 });
  });

  it('creates from a template: sections seeded, slug from name, draft', async () => {
    const res = await request(app)
      .post('/api/landing-pages')
      .send({ name: 'Free Guide', templateId: 'lead-capture' });
    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('free-guide');
    expect(res.body.status).toBe('draft');
    expect(res.body.sectionsJson).toHaveLength(3);
    expect(res.body.sectionsJson[0].type).toBe('hero');
    expect(res.body.stats).toEqual({ views: 0, submissions: 0, conversion: null });
  });

  it('rejects a bad slug and an unknown template', async () => {
    const badSlug = await request(app)
      .post('/api/landing-pages')
      .send({ name: 'X', slug: 'Bad Slug!' });
    expect(badSlug.status).toBe(400);
    const badTemplate = await request(app)
      .post('/api/landing-pages')
      .send({ name: 'X', templateId: 'nope' });
    expect(badTemplate.status).toBe(400);
  });

  it('uniquifies a taken slug instead of failing', async () => {
    seedPage({ slug: 'free-guide' });
    const res = await request(app)
      .post('/api/landing-pages')
      .send({ name: 'Free Guide' });
    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('free-guide-2');
  });

  it('404s on an unknown page and on another workspace’s page', async () => {
    const missing = await request(app).get('/api/landing-pages/lp_nope');
    expect(missing.status).toBe(404);
    seedPage({ workspaceId: 'ws_other' });
    const other = await request(app).get('/api/landing-pages/lp_1');
    expect(other.status).toBe(404);
  });

  it('update persists sectionsJson (regression: client sends sectionsJson)', async () => {
    const page = seedPage({
      sectionsJson: [{ id: 's1', type: 'hero', config: { heading: 'Old' } }],
    });
    const res = await request(app)
      .put(`/api/landing-pages/${page.id}`)
      .send({
        sectionsJson: [
          { id: 's1', type: 'hero', config: { heading: 'New' } },
          { id: 's2', type: 'text', config: { body: 'Added' } },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.sectionsJson[0].config.heading).toBe('New');
    expect(res.body.sectionsJson).toHaveLength(2);
  });

  it('refuses a slug change on a published page', async () => {
    const page = seedPage({
      status: 'published',
      sectionsJson: [{ id: 's1', type: 'hero', config: {} }],
    });
    const res = await request(app)
      .put(`/api/landing-pages/${page.id}`)
      .send({ slug: 'new-slug' });
    expect(res.status).toBe(400);
  });

  it('publish requires at least one section, then sets publishedAt', async () => {
    const empty = seedPage();
    const fail = await request(app).post(`/api/landing-pages/${empty.id}/publish`);
    expect(fail.status).toBe(400);

    const full = seedPage({
      sectionsJson: [{ id: 's1', type: 'hero', config: {} }],
    });
    const res = await request(app).post(`/api/landing-pages/${full.id}/publish`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('published');
    expect(res.body.publishedAt).toBeTruthy();

    const unpub = await request(app).post(`/api/landing-pages/${full.id}/unpublish`);
    expect(unpub.body.status).toBe('draft');
    expect(unpub.body.publishedAt).toBeNull();
  });

  it('duplicate copies sections with fresh ids, as a draft with a new slug', async () => {
    const page = seedPage({
      name: 'Original',
      slug: 'original',
      status: 'published',
      sectionsJson: [{ id: 'sec-aaa', type: 'hero', config: { heading: 'Hi' } }],
    });
    const res = await request(app).post(`/api/landing-pages/${page.id}/duplicate`);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Original (copy)');
    expect(res.body.slug).toBe('original-copy');
    expect(res.body.status).toBe('draft');
    expect(res.body.sectionsJson[0].id).not.toBe('sec-aaa');
    expect(res.body.sectionsJson[0].config).toEqual({ heading: 'Hi' });
  });

  it('delete removes the page and its views + responses', async () => {
    const page = seedPage();
    state.views.push({ id: 'v1', pageId: page.id });
    state.responses.push({ id: 'r1', pageId: page.id });
    const res = await request(app).delete(`/api/landing-pages/${page.id}`);
    expect(res.status).toBe(200);
    expect(state.pages).toHaveLength(0);
    expect(state.views).toHaveLength(0);
    expect(state.responses).toHaveLength(0);
  });

  it('stats endpoint reports views, submissions, conversion', async () => {
    const page = seedPage();
    state.views.push(
      { id: 'v1', pageId: page.id },
      { id: 'v2', pageId: page.id },
      { id: 'v3', pageId: page.id },
      { id: 'v4', pageId: page.id },
    );
    state.responses.push({ id: 'r1', pageId: page.id });
    const res = await request(app).get(`/api/landing-pages/${page.id}/stats`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ views: 4, submissions: 1, conversion: 25 });
  });

  it('templates endpoint lists the 3 starters', async () => {
    const res = await request(app).get('/api/landing-pages/templates');
    expect(res.status).toBe(200);
    expect(res.body.map((t: any) => t.id)).toEqual(['lead-capture', 'event', 'offer']);
  });
});
