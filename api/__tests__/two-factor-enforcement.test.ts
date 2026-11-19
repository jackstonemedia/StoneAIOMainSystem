/**
 * 2FA enforcement at sign-in — Tier 3 Tranche A, Fix 17.
 *
 * The TOTP machinery existed (UserTwoFactor + setup/verify endpoints) but
 * nothing ever consulted it at sign-in: enabling 2FA changed nothing.
 * Now the requireTwoFactor middleware runs after resolveWorkspace on every
 * authenticated API route: an enabled user whose session hasn't passed the
 * TOTP challenge gets 403 2FA_REQUIRED, and a workspace that requires 2FA
 * blocks members who haven't set it up with 403 2FA_SETUP_REQUIRED.
 * The TwoFactorGate shows the challenge / setup screen on those 403s.
 */
process.env.CHANNEL_ENCRYPTION_KEY = 'ab'.repeat(32);

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { generateSync } from 'otplib';

const TOTP_SECRET = 'KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD'; // test secret (base32, 20 bytes)

const state = vi.hoisted(() => ({
  twoFactorEnabled: false,
  twoFactorConfigured: false,
  requireTwoFactor: false,
  sessions: {} as Record<string, { userId: string; verifiedAt: Date }>,
  upserts: [] as any[],
}));

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    userTwoFactor: {
      findUnique: vi.fn(async () => {
        if (!state.twoFactorConfigured) return null;
        // The secret is encrypted with the real encryptString and decrypted
        // for real by the route — the TOTP round-trip is genuinely exercised.
        const { encryptString } = await import('../services/channels/encryption.js');
        return {
          userId: 'user_1',
          secretEncrypted: encryptString(TOTP_SECRET),
          enabled: state.twoFactorEnabled,
        };
      }),
      update: vi.fn(async () => ({})),
      upsert: vi.fn(async () => ({})),
    },
    twoFactorSession: {
      findUnique: vi.fn(async ({ where }: any) => state.sessions[where.sessionId] ?? null),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        state.sessions[where.sessionId] = { userId: create.userId ?? update.userId, verifiedAt: create.verifiedAt ?? update.verifiedAt };
        state.upserts.push(where.sessionId);
        return state.sessions[where.sessionId];
      }),
    },
    workspace: {
      findUnique: vi.fn(async () => ({ requireTwoFactor: state.requireTwoFactor })),
      update: vi.fn(async ({ data }: any) => ({ id: 'ws_test', ...data })),
    },
    workspaceMember: {
      findFirst: vi.fn(async () => ({ workspaceId: 'ws_test', role: 'admin' })),
    },
  },
}));

import { requireTwoFactorVerified } from '../middleware/requireTwoFactor.js';
import settingsRouter from '../routes/settings.routes.js';

function jwtWithSid(sid: string | null) {
  if (!sid) return '';
  const payload = Buffer.from(JSON.stringify({ sid })).toString('base64url');
  return `Bearer header.${payload}.sig`;
}

function gateApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.userId = 'user_1';
    req.workspaceId = 'ws_test';
    next();
  });
  app.use(requireTwoFactorVerified);
  app.get('/protected', (_req: any, res: any) => res.json({ ok: true }));
  app.get('/settings/2fa/challenge', (_req: any, res: any) => res.json({ ok: true }));
  app.get('/widget/channels/current', (_req: any, res: any) => res.json({ ok: true }));
  return app;
}

describe('requireTwoFactor middleware (Fix 17)', () => {
  beforeEach(() => {
    state.twoFactorEnabled = false;
    state.twoFactorConfigured = false;
    state.requireTwoFactor = false;
    state.sessions = {};
    state.upserts = [];
  });

  it('lets a user with no 2FA through', async () => {
    const res = await request(gateApp()).get('/protected');
    expect(res.status).toBe(200);
  });

  it('blocks an enabled user whose session is unverified (403 2FA_REQUIRED)', async () => {
    state.twoFactorConfigured = true;
    state.twoFactorEnabled = true;
    const res = await request(gateApp()).get('/protected');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('2FA_REQUIRED');
  });

  it('lets an enabled user with a fresh verified session through', async () => {
    state.twoFactorConfigured = true;
    state.twoFactorEnabled = true;
    state.sessions['sess_1'] = { userId: 'user_1', verifiedAt: new Date() };
    const res = await request(gateApp())
      .get('/protected')
      .set('Authorization', jwtWithSid('sess_1'));
    expect(res.status).toBe(200);
  });

  it('blocks when the verification is stale (>12h)', async () => {
    state.twoFactorConfigured = true;
    state.twoFactorEnabled = true;
    state.sessions['sess_1'] = { userId: 'user_1', verifiedAt: new Date(Date.now() - 13 * 60 * 60 * 1000) };
    const res = await request(gateApp())
      .get('/protected')
      .set('Authorization', jwtWithSid('sess_1'));
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('2FA_REQUIRED');
  });

  it('blocks a member with no 2FA when the workspace requires it (403 2FA_SETUP_REQUIRED)', async () => {
    state.requireTwoFactor = true;
    const res = await request(gateApp()).get('/protected');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('2FA_SETUP_REQUIRED');
  });

  it('lets a verified member through when the workspace requires 2FA', async () => {
    state.requireTwoFactor = true;
    state.twoFactorConfigured = true;
    state.twoFactorEnabled = true;
    state.sessions['dev:user_1'] = { userId: 'user_1', verifiedAt: new Date() };
    const res = await request(gateApp()).get('/protected');
    expect(res.status).toBe(200);
  });

  it('exempts the 2FA endpoints themselves', async () => {
    state.twoFactorConfigured = true;
    state.twoFactorEnabled = true;
    const res = await request(gateApp()).get('/settings/2fa/challenge');
    expect(res.status).toBe(200);
  });

  it('exempts the public widget', async () => {
    state.twoFactorConfigured = true;
    state.twoFactorEnabled = true;
    const res = await request(gateApp()).get('/widget/channels/current');
    expect(res.status).toBe(200);
  });
});

function settingsApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.userId = 'user_1';
    req.workspaceId = 'ws_test';
    next();
  });
  app.use('/api/settings', settingsRouter);
  return app;
}

describe('POST /2fa/challenge (Fix 17)', () => {
  beforeEach(() => {
    state.twoFactorEnabled = false;
    state.twoFactorConfigured = false;
    state.requireTwoFactor = false;
    state.sessions = {};
    state.upserts = [];
  });

  it('verifies a valid code and records the session', async () => {
    state.twoFactorConfigured = true;
    state.twoFactorEnabled = true;
    const code = generateSync({ secret: TOTP_SECRET });
    const res = await request(settingsApp())
      .post('/api/settings/2fa/challenge')
      .set('Authorization', jwtWithSid('sess_9'))
      .send({ code });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(state.sessions['sess_9']).toBeDefined();
    expect(state.sessions['sess_9'].userId).toBe('user_1');
  });

  it('rejects a wrong code', async () => {
    state.twoFactorConfigured = true;
    state.twoFactorEnabled = true;
    const res = await request(settingsApp())
      .post('/api/settings/2fa/challenge')
      .set('Authorization', jwtWithSid('sess_9'))
      .send({ code: '000000' });
    expect(res.status).toBe(400);
    expect(state.sessions['sess_9']).toBeUndefined();
  });

  it('rejects the challenge when 2FA is not enabled', async () => {
    state.twoFactorConfigured = true;
    state.twoFactorEnabled = false;
    const code = generateSync({ secret: TOTP_SECRET });
    const res = await request(settingsApp())
      .post('/api/settings/2fa/challenge')
      .set('Authorization', jwtWithSid('sess_9'))
      .send({ code });
    expect(res.status).toBe(400);
  });

  it('GET /2fa/status reports verified after a challenge', async () => {
    state.twoFactorConfigured = true;
    state.twoFactorEnabled = true;
    const code = generateSync({ secret: TOTP_SECRET });
    await request(settingsApp())
      .post('/api/settings/2fa/challenge')
      .set('Authorization', jwtWithSid('sess_9'))
      .send({ code });
    const res = await request(settingsApp())
      .get('/api/settings/2fa/status')
      .set('Authorization', jwtWithSid('sess_9'));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ enabled: true, configured: true, verified: true, requireTwoFactor: false });
  });
});
