/**
 * CRM Documents — Tier 2 Fix 5.
 * GET/POST/PUT/DELETE /api/crm/documents did not exist (no CrmDocument model),
 * so the Documents page silently showed "No documents found" and every
 * create/save quietly did nothing. The model, migration, and routes now exist;
 * the page surfaces real errors instead of fake empty states.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  docs: [] as any[],
}));

function matches(where: any, row: any) {
  return Object.entries(where || {}).every(([k, v]) => row[k] === v);
}

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    crmDocument: {
      findMany: vi.fn(async ({ where, select }: any) => {
        const rows = state.docs
          .filter((d) => matches(where, d))
          .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
        if (!select) return rows;
        return rows.map((d) => {
          const out: any = {};
          for (const k of Object.keys(select)) if (select[k]) out[k] = d[k];
          return out;
        });
      }),
      findFirst: vi.fn(async ({ where }: any) => state.docs.find((d) => matches(where, d)) ?? null),
      create: vi.fn(async ({ data }: any) => {
        const now = new Date().toISOString();
        const row = { id: `doc_${state.docs.length + 1}`, ...data, createdAt: now, updatedAt: now };
        state.docs.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = state.docs.find((d) => d.id === where.id);
        if (!row) throw new Error('Record not found');
        Object.assign(row, data, { updatedAt: new Date().toISOString() });
        return row;
      }),
      delete: vi.fn(async ({ where }: any) => {
        const i = state.docs.findIndex((d) => d.id === where.id);
        if (i === -1) throw new Error('Record not found');
        const [row] = state.docs.splice(i, 1);
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

describe('CRM Documents (Tier 2 Fix 5)', () => {
  beforeEach(() => {
    state.docs = [
      { id: 'doc_a', workspaceId: 'ws_test', title: 'Playbook', content: '<p>Old</p>', createdBy: 'user_test', createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-02T10:00:00.000Z' },
      { id: 'doc_b', workspaceId: 'ws_test', title: 'Notes', content: '', createdBy: 'user_test', createdAt: '2026-11-01T11:00:00.000Z', updatedAt: '2026-11-01T11:00:00.000Z' },
      { id: 'doc_other', workspaceId: 'ws_other', title: 'Not yours', content: 'secret', createdBy: 'user_x', createdAt: '2026-11-01T12:00:00.000Z', updatedAt: '2026-11-01T12:00:00.000Z' },
    ];
  });

  it('GET /documents lists only this workspace, newest first, without content', async () => {
    const res = await request(app).get('/api/crm/documents');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ id: 'doc_a', title: 'Playbook', type: 'document' });
    expect(res.body[0]).not.toHaveProperty('content');
    expect(res.body.map((d: any) => d.id)).not.toContain('doc_other');
  });

  it('GET /documents/:id returns the document with content', async () => {
    const res = await request(app).get('/api/crm/documents/doc_a');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'doc_a', title: 'Playbook', content: '<p>Old</p>', type: 'document' });
  });

  it('GET /documents/:id in another workspace is 404', async () => {
    const res = await request(app).get('/api/crm/documents/doc_other');
    expect(res.status).toBe(404);
  });

  it('POST /documents creates with title + content and records the author', async () => {
    const res = await request(app)
      .post('/api/crm/documents')
      .send({ title: 'New Doc', content: '<p>Hello</p>' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'New Doc', content: '<p>Hello</p>', workspaceId: 'ws_test', createdBy: 'user_test' });
    expect(state.docs).toHaveLength(4);
  });

  it('POST /documents with no title defaults to Untitled Document', async () => {
    const res = await request(app).post('/api/crm/documents').send({ content: 'x' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Untitled Document');
    expect(res.body.content).toBe('x');
  });

  it('POST /documents with no content stores an empty document honestly', async () => {
    const res = await request(app).post('/api/crm/documents').send({ title: 'Blank' });
    expect(res.status).toBe(201);
    expect(res.body.content).toBe('');
  });

  it('POST /documents with a non-string title is 400 and stores nothing', async () => {
    const res = await request(app).post('/api/crm/documents').send({ title: 42 });
    expect(res.status).toBe(400);
    expect(state.docs).toHaveLength(3);
  });

  it('PUT /documents/:id updates title and content', async () => {
    const res = await request(app)
      .put('/api/crm/documents/doc_b')
      .send({ title: 'Renamed', content: '<p>Filled in</p>' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'doc_b', title: 'Renamed', content: '<p>Filled in</p>' });
  });

  it('PUT /documents/:id with neither field is 400', async () => {
    const res = await request(app).put('/api/crm/documents/doc_b').send({});
    expect(res.status).toBe(400);
  });

  it('PUT /documents/:id in another workspace is 404 and changes nothing', async () => {
    const res = await request(app).put('/api/crm/documents/doc_other').send({ title: 'Hijack' });
    expect(res.status).toBe(404);
    expect(state.docs.find((d) => d.id === 'doc_other')!.title).toBe('Not yours');
  });

  it('DELETE /documents/:id removes it', async () => {
    const res = await request(app).delete('/api/crm/documents/doc_b');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(state.docs.map((d) => d.id)).toEqual(['doc_a', 'doc_other']);
  });

  it('DELETE /documents/:id in another workspace is 404 and deletes nothing', async () => {
    const res = await request(app).delete('/api/crm/documents/doc_other');
    expect(res.status).toBe(404);
    expect(state.docs).toHaveLength(3);
  });
});
