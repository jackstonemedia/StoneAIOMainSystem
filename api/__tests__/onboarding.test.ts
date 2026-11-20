/**
 * Onboarding — complete-platform item 6.
 *
 * First-login redirect is server-decided: only the workspace owner, only
 * while onboardingCompletedAt is unset. Invitees (members, never owners)
 * are never redirected. Skip and finish both land on POST /complete.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  workspace: null as any,
  updated: null as any,
}));

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    workspace: {
      findUnique: vi.fn(async () => state.workspace),
      update: vi.fn(async ({ where, data }: any) => {
        state.updated = { ...state.workspace, ...data };
        state.workspace = state.updated;
        return state.workspace;
      }),
    },
  },
}));

import onboardingRouter from '../routes/onboarding.routes.js';

function app(userId = 'user_owner', workspaceId = 'ws_new') {
  const a = express();
  a.use(express.json());
  a.use((req: any, _res: any, next: any) => {
    req.userId = userId;
    req.workspaceId = workspaceId;
    next();
  });
  a.use('/onboarding', onboardingRouter);
  return a;
}

describe('Onboarding status (item 6)', () => {
  beforeEach(() => {
    state.workspace = { id: 'ws_new', name: 'New Co', ownerId: 'user_owner', onboardingCompletedAt: null };
    state.updated = null;
  });

  it('owner with an unset flag → redirect', async () => {
    const res = await request(app()).get('/onboarding/status');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ shouldRedirect: true, workspaceId: 'ws_new', workspaceName: 'New Co' });
  });

  it('owner with the flag set → no redirect', async () => {
    state.workspace.onboardingCompletedAt = new Date('2026-11-19T10:00:00Z');
    const res = await request(app()).get('/onboarding/status');
    expect(res.body.shouldRedirect).toBe(false);
  });

  it('invitee (member, not owner) with an unset flag → never redirected', async () => {
    const res = await request(app('user_invitee')).get('/onboarding/status');
    expect(res.body.shouldRedirect).toBe(false);
  });

  it('missing workspace → no redirect (never a blocker)', async () => {
    state.workspace = null;
    const res = await request(app()).get('/onboarding/status');
    expect(res.body.shouldRedirect).toBe(false);
  });
});

describe('Onboarding complete (item 6)', () => {
  beforeEach(() => {
    state.workspace = { id: 'ws_new', name: 'New Co', ownerId: 'user_owner', onboardingCompletedAt: null };
    state.updated = null;
  });

  it('owner → 200 and the flag is set', async () => {
    const res = await request(app()).post('/onboarding/complete').send({});
    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(true);
    expect(state.workspace.onboardingCompletedAt).toBeInstanceOf(Date);
    // And the status endpoint now says no redirect.
    const status = await request(app()).get('/onboarding/status');
    expect(status.body.shouldRedirect).toBe(false);
  });

  it('non-owner → 403 and the flag is untouched', async () => {
    const res = await request(app('user_invitee')).post('/onboarding/complete').send({});
    expect(res.status).toBe(403);
    expect(state.workspace.onboardingCompletedAt).toBeNull();
  });

  it('missing workspace → 404', async () => {
    state.workspace = null;
    const res = await request(app()).post('/onboarding/complete').send({});
    expect(res.status).toBe(404);
  });
});
