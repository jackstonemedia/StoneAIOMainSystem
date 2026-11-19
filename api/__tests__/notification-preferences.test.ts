/**
 * Notification preferences — Tier 3 Tranche A, Fix 11.
 *
 * The Settings toggles were local useState that only ever showed a toast:
 * nothing was persisted and no producer read them. Preferences now live in
 * NotificationPreference (one row per toggle key; a missing row means the
 * default, enabled) behind GET/PUT /api/notifications/preferences, and the
 * one real producer — ad leads syncing into contacts — honours the
 * new_contact toggle. The other seven toggles (deal won, task overdue,
 * campaign sent, appointment booked, inbound SMS, new review, weekly
 * summary) have no producer, so they have no toggle.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  prefRows: [] as any[],
  upserts: [] as any[],
  notifications: [] as any[],
}));

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    notificationPreference: {
      findMany: vi.fn(async ({ where }: any) =>
        state.prefRows.filter((r) => r.workspaceId === where.workspaceId),
      ),
      findUnique: vi.fn(async ({ where }: any) => {
        const key = where.workspaceId_key;
        return state.prefRows.find((r) => r.workspaceId === key.workspaceId && r.key === key.key) ?? null;
      }),
      upsert: vi.fn(async ({ where, update, create }: any) => {
        state.upserts.push({ where, update, create });
        const key = where.workspaceId_key;
        const existing = state.prefRows.find((r) => r.workspaceId === key.workspaceId && r.key === key.key);
        if (existing) Object.assign(existing, update);
        else state.prefRows.push({ id: `np_${state.prefRows.length + 1}`, ...create });
        return existing ?? state.prefRows[state.prefRows.length - 1];
      }),
    },
    notification: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `n_${state.notifications.length + 1}`, ...data };
        state.notifications.push(row);
        return row;
      }),
    },
  },
}));

import notificationsRouter from '../routes/notifications.routes.js';
import { notifyNewLead } from '../services/ads/ads-lead.service.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.workspaceId = 'ws_test';
    next();
  });
  app.use('/notifications', notificationsRouter);
  return app;
}

describe('notification preferences (Fix 11)', () => {
  beforeEach(() => {
    state.prefRows = [];
    state.upserts = [];
    state.notifications = [];
  });

  it('GET returns the enabled default when nothing is stored', async () => {
    const res = await request(makeApp()).get('/notifications/preferences');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ preferences: { new_contact: true } });
  });

  it('PUT persists a toggle and GET returns the saved value', async () => {
    const put = await request(makeApp())
      .put('/notifications/preferences')
      .send({ preferences: { new_contact: false } });
    expect(put.status).toBe(200);
    expect(put.body).toEqual({ preferences: { new_contact: false } });
    const get = await request(makeApp()).get('/notifications/preferences');
    expect(get.body).toEqual({ preferences: { new_contact: false } });
    expect(state.upserts).toHaveLength(1);
    expect(state.upserts[0].create).toMatchObject({ workspaceId: 'ws_test', key: 'new_contact', enabled: false });
  });

  it('PUT ignores unknown keys', async () => {
    const res = await request(makeApp())
      .put('/notifications/preferences')
      .send({ preferences: { deal_won: false, new_contact: true } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ preferences: { new_contact: true } });
    expect(state.upserts).toHaveLength(1);
    expect(state.upserts[0].create.key).toBe('new_contact');
  });

  it('a disabled new_contact preference stops the ad-lead notification', async () => {
    state.prefRows.push({ id: 'np_1', workspaceId: 'ws_test', key: 'new_contact', enabled: false });
    await notifyNewLead('ws_test', 'ct_1', 'Summer Sale', 'camp_1');
    expect(state.notifications).toHaveLength(0);
  });

  it('an enabled (or unset) new_contact preference lets the notification through', async () => {
    await notifyNewLead('ws_test', 'ct_1', 'Summer Sale', 'camp_1');
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0]).toMatchObject({
      workspaceId: 'ws_test',
      title: 'New lead from Summer Sale',
      type: 'ad_lead',
    });
  });
});
