/**
 * CRM Settings — Tier 2 Fix 8.
 * The Settings page's Save button only flipped local state, and the inputs
 * showed hardcoded defaults ('Stone AIO CRM', 'jack@stoneaio.com') that were
 * never persisted. Settings now persist in a CrmSettings row (one per
 * workspace); a workspace with no row gets blanks, never invented defaults.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  settings: [] as any[],
}));

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    crmSettings: {
      findUnique: vi.fn(async ({ where }: any) =>
        state.settings.find((s) => s.workspaceId === where.workspaceId) ?? null),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const row = state.settings.find((s) => s.workspaceId === where.workspaceId);
        if (row) {
          Object.assign(row, update, { updatedAt: new Date().toISOString() });
          return row;
        }
        const next = { id: `cs_${state.settings.length + 1}`, ...create, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        state.settings.push(next);
        return next;
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

describe('CRM Settings (Tier 2 Fix 8)', () => {
  beforeEach(() => {
    state.settings = [
      { id: 'cs_other', workspaceId: 'ws_other', crmName: 'Other CRM', adminEmail: 'other@example.com', notifyNewLead: true, notifyDealWon: false, notifyDealLost: false, weeklyDigest: false },
    ];
  });

  it('GET returns blanks — never invented defaults — when no row exists', async () => {
    const res = await request(app).get('/api/crm/settings');
    expect(res.status).toBe(200);
    expect(res.body.crmName).toBeNull();
    expect(res.body.adminEmail).toBeNull();
    expect(res.body.defaultCurrency).toBeNull();
    expect(res.body.notifyNewLead).toBe(false);
    expect(res.body.weeklyDigest).toBe(false);
  });

  it('PUT creates a row and GET returns the saved values (round-trip)', async () => {
    const put = await request(app).put('/api/crm/settings').send({
      crmName: 'Acme CRM',
      defaultCurrency: 'EUR',
      fiscalYearStart: 'April',
      dealStageLabels: 'Won / Lost',
      adminEmail: 'admin@acme.com',
      defaultRole: 'Manager',
      notifyNewLead: true,
      notifyDealWon: true,
      notifyDealLost: false,
      weeklyDigest: true,
    });
    expect(put.status).toBe(200);
    expect(put.body.id).toBeTruthy();

    const get = await request(app).get('/api/crm/settings');
    expect(get.body.crmName).toBe('Acme CRM');
    expect(get.body.defaultCurrency).toBe('EUR');
    expect(get.body.adminEmail).toBe('admin@acme.com');
    expect(get.body.notifyNewLead).toBe(true);
    expect(get.body.weeklyDigest).toBe(true);
  });

  it('a second PUT updates the same row instead of creating another', async () => {
    await request(app).put('/api/crm/settings').send({ crmName: 'First' });
    await request(app).put('/api/crm/settings').send({ crmName: 'Second' });
    const get = await request(app).get('/api/crm/settings');
    expect(get.body.crmName).toBe('Second');
    expect(state.settings.filter((s) => s.workspaceId === 'ws_test')).toHaveLength(1);
  });

  it('PUT rejects a non-boolean toggle with 400 and writes nothing', async () => {
    const res = await request(app).put('/api/crm/settings').send({ notifyNewLead: 'yes' });
    expect(res.status).toBe(400);
    expect(state.settings.filter((s) => s.workspaceId === 'ws_test')).toHaveLength(0);
  });

  it('PUT rejects a non-string text field with 400 and writes nothing', async () => {
    const res = await request(app).put('/api/crm/settings').send({ crmName: 42 });
    expect(res.status).toBe(400);
    expect(state.settings.filter((s) => s.workspaceId === 'ws_test')).toHaveLength(0);
  });

  it('another workspace row is never visible or touched', async () => {
    await request(app).put('/api/crm/settings').send({ crmName: 'Mine' });
    const other = state.settings.find((s) => s.workspaceId === 'ws_other');
    expect(other.crmName).toBe('Other CRM');
    const get = await request(app).get('/api/crm/settings');
    expect(get.body.crmName).toBe('Mine');
  });
});
