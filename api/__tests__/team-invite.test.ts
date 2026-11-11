/**
 * Real team invites — Tier 1 Fix 9.
 * The old POST /team/invite created a WorkspaceMember with a fake
 * `pending_<email>_<ts>` user id that could never match a real Clerk user,
 * and toasted "Invitation sent!" while sending nothing. Invites are now
 * token rows (WorkspaceInvite) + a real Gmail invite email, and the
 * invitee accepts at /invite/:token, which creates the real membership.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  members: [] as any[],
  invites: [] as any[],
  gmailConn: null as any,
  workspace: { id: 'ws_test', name: 'Acme Corp', ownerId: 'user_admin' },
  sendGmail: null as any,
}));

const gmailMock = vi.hoisted(() => ({ sendGmailMessage: vi.fn() }));

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    workspaceMember: {
      findMany: vi.fn(async () => state.members),
      findFirst: vi.fn(async ({ where }: any) =>
        state.members.find((m: any) => m.workspaceId === where.workspaceId && (!where.userId || m.userId === where.userId)) ?? null,
      ),
      create: vi.fn(async ({ data }: any) => {
        const row = { ...data, createdAt: new Date().toISOString() };
        state.members.push(row);
        return row;
      }),
      delete: vi.fn(async () => ({})),
    },
    workspaceInvite: {
      findUnique: vi.fn(async ({ where }: any) =>
        state.invites.find((i: any) => i.token === where.token) ?? null,
      ),
      findFirst: vi.fn(async ({ where }: any) =>
        state.invites.find((i: any) => {
          if (where.id && i.id !== where.id) return false;
          if (where.workspaceId && i.workspaceId !== where.workspaceId) return false;
          if (where.email && i.email !== where.email) return false;
          if (where.acceptedAt === null && i.acceptedAt !== null) return false;
          if (where.expiresAt?.gt && !(i.expiresAt > where.expiresAt.gt)) return false;
          return true;
        }) ?? null,
      ),
      findMany: vi.fn(async ({ where }: any) =>
        state.invites.filter((i: any) => {
          if (where.workspaceId && i.workspaceId !== where.workspaceId) return false;
          if (where.acceptedAt === null && i.acceptedAt !== null) return false;
          if (where.expiresAt?.gt && !(i.expiresAt > where.expiresAt.gt)) return false;
          return true;
        }),
      ),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `inv_${state.invites.length + 1}`, ...data, acceptedAt: null, createdAt: new Date().toISOString() };
        state.invites.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const row = state.invites.find((i: any) => i.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = state.invites.findIndex((i: any) => i.id === where.id);
        if (idx >= 0) state.invites.splice(idx, 1);
        return {};
      }),
    },
    channelConnection: {
      findFirst: vi.fn(async () => state.gmailConn),
    },
    workspace: {
      findUnique: vi.fn(async () => state.workspace),
    },
  },
}));

vi.mock('../services/channels/gmail.service.js', () => ({
  sendGmailMessage: gmailMock.sendGmailMessage,
}));

import settingsRouter from '../routes/settings.routes.js';
import invitesRouter, { publicInvitesRouter } from '../routes/invites.routes.js';

function makeApp(router: any, opts: { authed?: boolean; userId?: string } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.workspaceId = 'ws_test';
    req.userId = opts.userId ?? 'user_admin';
    if (opts.authed !== false) req.userRole = 'admin';
    next();
  });
  app.use(router);
  return app;
}

const settingsApp = makeApp(settingsRouter);
const publicApp = makeApp(publicInvitesRouter, { authed: false });
// The accepter is a different user from the inviter — not a member yet.
const invitesApp = makeApp(invitesRouter, { userId: 'user_newbie' });

describe('Team invite (Tier 1 Fix 9)', () => {
  beforeEach(() => {
    state.members = [{ workspaceId: 'ws_test', userId: 'user_admin', role: 'admin' }];
    state.invites = [];
    state.gmailConn = { id: 'cc_gmail', provider: 'gmail', isActive: true };
    gmailMock.sendGmailMessage.mockReset();
    gmailMock.sendGmailMessage.mockResolvedValue({ messageId: 'm1', threadId: 't1' });
  });

  it('invite without a Gmail connection is refused honestly (503) and creates nothing', async () => {
    state.gmailConn = null;
    const res = await request(settingsApp).post('/team/invite').send({ email: 'new@example.com', role: 'member' });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/Connect Gmail/);
    expect(state.invites).toHaveLength(0);
  });

  it('invite with Gmail creates the invite row and sends a real email with the accept link', async () => {
    const res = await request(settingsApp).post('/team/invite').send({ email: 'new@example.com', role: 'member' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(state.invites).toHaveLength(1);
    expect(state.invites[0].token).toHaveLength(32);
    expect(state.invites[0]).toMatchObject({ email: 'new@example.com', role: 'member' });
    expect(gmailMock.sendGmailMessage).toHaveBeenCalledTimes(1);
    const [, to, subject, body] = gmailMock.sendGmailMessage.mock.calls[0];
    expect(to).toBe('new@example.com');
    expect(subject).toMatch(/Acme Corp/);
    expect(body).toMatch(/\/invite\/[A-Za-z0-9_-]{32}/);
    // No fake pending member row is created anymore.
    expect(state.members).toHaveLength(1);
  });

  it('a second invite to the same pending email is 409', async () => {
    await request(settingsApp).post('/team/invite').send({ email: 'new@example.com', role: 'member' });
    const res = await request(settingsApp).post('/team/invite').send({ email: 'new@example.com', role: 'member' });
    expect(res.status).toBe(409);
    expect(state.invites).toHaveLength(1);
  });

  it('a failed email send deletes the invite row and returns 502', async () => {
    gmailMock.sendGmailMessage.mockRejectedValueOnce(new Error('Gmail 401: bad token'));
    const res = await request(settingsApp).post('/team/invite').send({ email: 'new@example.com', role: 'member' });
    expect(res.status).toBe(502);
    expect(state.invites).toHaveLength(0);
  });

  it('GET /team filters out legacy pending_ rows', async () => {
    state.members.push({ workspaceId: 'ws_test', userId: 'pending_jane_example_com_123', role: 'member' });
    const res = await request(settingsApp).get('/team');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].userId).toBe('user_admin');
  });

  it('GET /team/invites lists pending invites without tokens; DELETE revokes one', async () => {
    await request(settingsApp).post('/team/invite').send({ email: 'new@example.com', role: 'member' });
    const list = await request(settingsApp).get('/team/invites');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].token).toBeUndefined();
    expect(list.body[0].email).toBe('new@example.com');
    const del = await request(settingsApp).delete(`/team/invites/${list.body[0].id}`);
    expect(del.status).toBe(200);
    expect(state.invites).toHaveLength(0);
  });

  it('public lookup returns the workspace name for a valid token, 404 for unknown', async () => {
    await request(settingsApp).post('/team/invite').send({ email: 'new@example.com', role: 'member' });
    const token = state.invites[0].token;
    const ok = await request(publicApp).get(`/${token}`);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ email: 'new@example.com', role: 'member', workspaceName: 'Acme Corp' });
    const bad = await request(publicApp).get('/nope-not-a-token');
    expect(bad.status).toBe(404);
  });

  it('public lookup of an expired invite is 410', async () => {
    await request(settingsApp).post('/team/invite').send({ email: 'new@example.com', role: 'member' });
    state.invites[0].expiresAt = new Date(Date.now() - 1000);
    const res = await request(publicApp).get(`/${state.invites[0].token}`);
    expect(res.status).toBe(410);
  });

  it('accept creates the real membership and marks the invite accepted', async () => {
    await request(settingsApp).post('/team/invite').send({ email: 'new@example.com', role: 'member' });
    const token = state.invites[0].token;
    const res = await request(invitesApp).post(`/${token}/accept`).send({});
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, workspaceId: 'ws_test', role: 'member' });
    expect(state.members.find((m: any) => m.userId === 'user_newbie' && m.workspaceId === 'ws_test')).toBeTruthy();
    expect(state.invites[0].acceptedAt).not.toBeNull();
  });

  it('accepting twice is 409 (already accepted)', async () => {
    await request(settingsApp).post('/team/invite').send({ email: 'new@example.com', role: 'member' });
    const token = state.invites[0].token;
    await request(invitesApp).post(`/${token}/accept`).send({});
    const res = await request(invitesApp).post(`/${token}/accept`).send({});
    expect(res.status).toBe(409);
  });

  it('accepting an expired invite is 410 and creates no membership', async () => {
    await request(settingsApp).post('/team/invite').send({ email: 'new@example.com', role: 'member' });
    state.invites[0].expiresAt = new Date(Date.now() - 1000);
    const res = await request(invitesApp).post(`/${state.invites[0].token}/accept`).send({});
    expect(res.status).toBe(410);
    expect(state.members).toHaveLength(1);
  });
});
