/**
 * Bulk Actions — Tier 2 Fix 9.
 * The Bulk Actions page hardcoded `const hasActions = false`, and no
 * bulk-action history model existed — real bulk runs happened inline from
 * Contacts and were never recorded. A BulkAction row is now written on
 * completion of every bulk run, and the page lists real rows with an
 * honest empty state when there are none.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  actions: [] as any[],
  bulkResult: { success: true, affected: 2 } as any,
}));

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    bulkAction: {
      findMany: vi.fn(async ({ where, take }: any) => {
        const rows = state.actions
          .filter((a) => a.workspaceId === where.workspaceId)
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        return typeof take === 'number' ? rows.slice(0, take) : rows;
      }),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `ba_${state.actions.length + 1}`, ...data, createdAt: new Date().toISOString() };
        state.actions.push(row);
        return row;
      }),
    },
  },
}));

vi.mock('../services/crm.service.js', () => ({
  bulkContacts: vi.fn(async () => state.bulkResult),
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

describe('Bulk Actions (Tier 2 Fix 9)', () => {
  beforeEach(() => {
    state.actions = [
      { id: 'ba_old', workspaceId: 'ws_test', type: 'tag', label: 'Add tag: vip — 2 contacts', targetCount: 2, successCount: 2, failedCount: 0, status: 'completed', createdBy: 'user_test', createdAt: '2026-11-01T10:00:00.000Z', completedAt: '2026-11-01T10:00:01.000Z' },
      { id: 'ba_new', workspaceId: 'ws_test', type: 'delete', label: 'Delete 1 contact', targetCount: 1, successCount: 1, failedCount: 0, status: 'completed', createdBy: 'user_test', createdAt: '2026-11-02T10:00:00.000Z', completedAt: '2026-11-02T10:00:01.000Z' },
      { id: 'ba_other', workspaceId: 'ws_other', type: 'tag', label: 'Not yours', targetCount: 5, successCount: 5, failedCount: 0, status: 'completed', createdBy: 'user_x', createdAt: '2026-11-03T10:00:00.000Z', completedAt: '2026-11-03T10:00:01.000Z' },
    ];
    state.bulkResult = { success: true, affected: 2 };
  });

  it('GET lists only this workspace, newest first', async () => {
    const res = await request(app).get('/api/crm/bulk-actions');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe('ba_new');
    expect(res.body[1].id).toBe('ba_old');
  });

  it('GET returns an empty list when the workspace has no runs', async () => {
    state.actions = state.actions.filter((a) => a.workspaceId !== 'ws_test');
    const res = await request(app).get('/api/crm/bulk-actions');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /bulk (tag) writes a completed BulkAction row with the real counts', async () => {
    const res = await request(app).post('/api/crm/bulk').send({ action: 'tag', contactIds: ['c1', 'c2'], payload: { tag: 'enterprise' } });
    expect(res.status).toBe(200);
    const rows = state.actions.filter((a) => a.type === 'tag' && a.workspaceId === 'ws_test' && a.label.includes('enterprise'));
    expect(rows).toHaveLength(1);
    expect(rows[0].targetCount).toBe(2);
    expect(rows[0].successCount).toBe(2);
    expect(rows[0].failedCount).toBe(0);
    expect(rows[0].status).toBe('completed');
    expect(rows[0].createdBy).toBe('user_test');
    expect(rows[0].completedAt).toBeTruthy();
  });

  it('POST /bulk records a partial run when fewer contacts were affected than requested', async () => {
    state.bulkResult = { success: true, affected: 1 };
    const res = await request(app).post('/api/crm/bulk').send({ action: 'tag', contactIds: ['c1', 'c2'], payload: { tag: 'vip' } });
    expect(res.status).toBe(200);
    const row = state.actions[state.actions.length - 1];
    expect(row.targetCount).toBe(2);
    expect(row.successCount).toBe(1);
    expect(row.failedCount).toBe(1);
    expect(row.status).toBe('partial');
  });

  it('POST /bulk (export) still returns the CSV and records the exported count', async () => {
    state.bulkResult = { csv: 'First Name,Last Name,Email,Phone,Status,Lead Score\nAlice,Freeman,a@x.com,,active,0\nBob,Smith,b@x.com,,active,0' };
    const res = await request(app).post('/api/crm/bulk').send({ action: 'export', contactIds: ['c1', 'c2'] });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const row = state.actions[state.actions.length - 1];
    expect(row.type).toBe('export');
    expect(row.successCount).toBe(2);
    expect(row.failedCount).toBe(0);
    expect(row.status).toBe('completed');
  });
});
