/**
 * Settings Security — Tier 1 Fix 1.
 * The old endpoints were theater: 2FA setup returned a deterministic secret
 * derived from the workspace ID and verify accepted ANY 6-digit code;
 * password change returned success without changing anything; sessions were
 * one hardcoded row and revoke was a no-op. These tests pin the real behavior:
 * real TOTP (random secret, encrypted at rest, code actually checked),
 * the password route is gone (Clerk owns passwords), and sessions come from
 * Clerk or honestly 503 in dev mode.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { generateSync } from 'otplib';

// Real encryption round-trip with a test-only key (64 hex chars).
process.env.CHANNEL_ENCRYPTION_KEY = 'ab'.repeat(32);

const twoFactorStore = vi.hoisted(() => new Map<string, any>());

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    userTwoFactor: {
      findUnique: vi.fn(async ({ where }: any) => twoFactorStore.get(where.userId) ?? null),
      upsert: vi.fn(async ({ where, update, create }: any) => {
        const existing = twoFactorStore.get(where.userId);
        const row = existing
          ? { ...existing, ...update }
          : { id: `utf_${where.userId}`, ...create };
        twoFactorStore.set(where.userId, row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = { ...twoFactorStore.get(where.userId), ...data };
        twoFactorStore.set(where.userId, row);
        return row;
      }),
      delete: vi.fn(async ({ where }: any) => {
        const row = twoFactorStore.get(where.userId);
        twoFactorStore.delete(where.userId);
        return row;
      }),
    },
    // Not hit by these tests; present so the router module loads.
    workspace: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    workspaceMember: { findMany: vi.fn(async () => []), create: vi.fn(), delete: vi.fn() },
    apiKey: { findMany: vi.fn(async () => []), findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    integration: { findMany: vi.fn(async () => []) },
    pipeline: { findFirst: vi.fn(), create: vi.fn() },
    pipelineStage: { create: vi.fn() },
  },
}));

const clerkMock = vi.hoisted(() => ({
  sessions: [] as any[],
  revoked: [] as string[],
}));

vi.mock('@clerk/express', () => ({
  clerkClient: {
    sessions: {
      getSessionList: vi.fn(async ({ userId }: any) => ({
        data: clerkMock.sessions.filter((s: any) => s.userId === userId),
        totalCount: clerkMock.sessions.filter((s: any) => s.userId === userId).length,
      })),
      revokeSession: vi.fn(async (id: string) => {
        clerkMock.revoked.push(id);
      }),
    },
  },
}));

import settingsRouter from '../routes/settings.routes.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.userId = req.headers['x-test-user'] || 'user_test_1';
    req.workspaceId = 'ws_test';
    next();
  });
  app.use('/api/settings', settingsRouter);
  return app;
}

function fakeJwt(sid: string) {
  const payload = Buffer.from(JSON.stringify({ sid, sub: 'user_test_1' })).toString('base64url');
  return `header.${payload}.sig`;
}

describe('Settings Security (Tier 1 Fix 1)', () => {
  beforeEach(() => {
    twoFactorStore.clear();
    clerkMock.sessions = [];
    clerkMock.revoked = [];
    delete process.env.CLERK_SECRET_KEY;
  });

  it('2FA setup returns a random secret + a locally-generated QR data URL, stored encrypted and disabled', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/settings/2fa/setup');
    expect(res.status).toBe(200);
    expect(typeof res.body.secret).toBe('string');
    expect(res.body.secret.length).toBeGreaterThanOrEqual(16);
    expect(res.body.qrCodeUrl.startsWith('data:image/png;base64,')).toBe(true);
    // The secret must NOT be sent to a third-party QR service.
    expect(res.body.qrCodeUrl).not.toContain('qrserver');
    const row = twoFactorStore.get('user_test_1');
    expect(row).toBeDefined();
    expect(row.enabled).toBe(false);
    // Stored encrypted: the ciphertext is not the plaintext secret.
    expect(row.secretEncrypted).not.toBe(res.body.secret);
    expect(row.secretEncrypted).not.toContain(res.body.secret);
  });

  it('2FA verify rejects a wrong code and accepts the correct TOTP code', async () => {
    const app = buildApp();
    const setup = await request(app).get('/api/settings/2fa/setup');
    const secret = setup.body.secret as string;

    const wrong = await request(app)
      .post('/api/settings/2fa/verify')
      .send({ code: '000000' });
    expect(wrong.status).toBe(400);

    // The correct code is generated from the same secret (what a real
    // authenticator app would show). A wrong code must never enable 2FA.
    const code = generateSync({ secret });
    const ok = await request(app).post('/api/settings/2fa/verify').send({ code });
    expect(ok.status).toBe(200);
    expect(ok.body.success).toBe(true);

    const status = await request(app).get('/api/settings/2fa/status');
    expect(status.body).toEqual({ enabled: true, configured: true });
  });

  it('2FA verify without a stored secret refuses instead of enabling', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/settings/2fa/verify')
      .send({ code: '123456' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/set up 2fa first/i);
  });

  it('2FA disable requires the current code, then clears the secret', async () => {
    const app = buildApp();
    const setup = await request(app).get('/api/settings/2fa/setup');
    const secret = setup.body.secret as string;
    await request(app)
      .post('/api/settings/2fa/verify')
      .send({ code: generateSync({ secret }) });

    const wrong = await request(app)
      .delete('/api/settings/2fa')
      .send({ code: '000000' });
    expect(wrong.status).toBe(400);

    const ok = await request(app)
      .delete('/api/settings/2fa')
      .send({ code: generateSync({ secret }) });
    expect(ok.status).toBe(200);

    const status = await request(app).get('/api/settings/2fa/status');
    expect(status.body).toEqual({ enabled: false, configured: false });
  });

  it('the password endpoint is gone — no fake success can survive', async () => {
    const app = buildApp();
    const res = await request(app)
      .put('/api/settings/password')
      .send({ currentPassword: 'oldpassword', newPassword: 'newpassword123' });
    expect(res.status).toBe(404);
  });

  it('sessions honestly 503 in dev mode instead of returning fake rows', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/settings/sessions');
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/clerk/i);
    expect(JSON.stringify(res.body)).not.toContain('Chrome on Windows');
  });

  it('sessions list real Clerk sessions and mark the current one', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_dummy';
    clerkMock.sessions = [
      { id: 'sess_current', userId: 'user_test_1', status: 'active', lastActiveAt: Date.now() },
      { id: 'sess_other', userId: 'user_test_1', status: 'active', lastActiveAt: Date.now() - 3600_000 },
      { id: 'sess_someone_else', userId: 'user_other', status: 'active', lastActiveAt: Date.now() },
    ];
    const app = buildApp();
    const res = await request(app)
      .get('/api/settings/sessions')
      .set('Authorization', `Bearer ${fakeJwt('sess_current')}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const current = res.body.find((s: any) => s.id === 'sess_current');
    const other = res.body.find((s: any) => s.id === 'sess_other');
    expect(current.isCurrent).toBe(true);
    expect(other.isCurrent).toBe(false);
    // No invented device / location / IP — only what Clerk actually returns.
    expect(current.device).toBeUndefined();
    expect(current.location).toBeUndefined();
    expect(current.ip).toBeUndefined();
  });

  it('revoking a session calls Clerk; the current session and unknown ids are refused', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_dummy';
    clerkMock.sessions = [
      { id: 'sess_current', userId: 'user_test_1', status: 'active', lastActiveAt: Date.now() },
      { id: 'sess_other', userId: 'user_test_1', status: 'active', lastActiveAt: Date.now() },
    ];
    const app = buildApp();
    const auth = `Bearer ${fakeJwt('sess_current')}`;

    const refuseCurrent = await request(app)
      .delete('/api/settings/sessions/sess_current')
      .set('Authorization', auth);
    expect(refuseCurrent.status).toBe(400);
    expect(clerkMock.revoked).toEqual([]);

    const unknown = await request(app)
      .delete('/api/settings/sessions/sess_nope')
      .set('Authorization', auth);
    expect(unknown.status).toBe(404);
    expect(clerkMock.revoked).toEqual([]);

    const ok = await request(app)
      .delete('/api/settings/sessions/sess_other')
      .set('Authorization', auth);
    expect(ok.status).toBe(200);
    expect(clerkMock.revoked).toEqual(['sess_other']);
  });
});
