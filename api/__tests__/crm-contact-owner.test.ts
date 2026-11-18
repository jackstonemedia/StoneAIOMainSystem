/**
 * Contact owner — Tier 2 Fix 11.
 * The "Contact Owner" dropdown showed a hardcoded "John Doe (You)", the
 * create payload never sent ownerId, and createContact silently dropped
 * ownerId / assignedUserId / customFieldsJson / dateOfBirth even though the
 * schema accepts them. Owners are now real workspace members, validated
 * server-side, and the detail page shows (and lets you change) the owner.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const state = vi.hoisted(() => ({
  members: [
    { workspaceId: 'ws_test', userId: 'user_dev_jack_stone', role: 'admin', createdAt: '2026-01-01T00:00:00.000Z' },
    { workspaceId: 'ws_test', userId: 'test_user_new', role: 'member', createdAt: '2026-01-02T00:00:00.000Z' },
    { workspaceId: 'ws_test', userId: 'pending_x@example.com_123', role: 'member', createdAt: '2026-01-03T00:00:00.000Z' },
  ] as any[],
  created: null as any,
}));

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    company: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: any) => ({ id: 'co_new', ...data })),
    },
    contact: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: 'ct_new', ...data, tagsJson: data.tagsJson ?? '[]', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        state.created = row;
        return row;
      }),
    },
    workspaceMember: {
      findUnique: vi.fn(async ({ where }: any) =>
        state.members.find((m: any) => m.workspaceId === where.workspaceId_userId.workspaceId && m.userId === where.workspaceId_userId.userId) ?? null),
      findMany: vi.fn(async ({ where }: any) => state.members.filter((m: any) => m.workspaceId === where.workspaceId)),
    },
    activity: {
      create: vi.fn(async ({ data }: any) => ({ id: 'act_1', ...data })),
    },
    tag: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: any) => ({ id: 'tag_1', ...data })),
    },
  },
}));

// Clerk lookup fails in this test file (no keys) — the /team endpoint must
// fall back to the userId as the display name instead of inventing one.
vi.mock('@clerk/express', () => ({
  clerkClient: {
    users: {
      getUserList: vi.fn(async () => { throw new Error('Clerk is not configured'); }),
    },
  },
}));

import { createContact } from '../services/crm.service.js';
import settingsRouter from '../routes/settings.routes.js';

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.workspaceId = 'ws_test';
  req.userId = 'user_test';
  req.userRole = 'admin';
  next();
});
app.use('/api/settings', settingsRouter);

describe('Contact owner (Tier 2 Fix 11)', () => {
  beforeEach(() => {
    state.created = null;
  });

  it('createContact writes ownerId, assignedUserId, customFieldsJson and dateOfBirth', async () => {
    const c = await createContact('ws_test', {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      ownerId: 'user_dev_jack_stone',
      assignedUserId: 'test_user_new',
      customFieldsJson: [{ key: 'VIP Level', value: 'Gold' }],
      dateOfBirth: '1990-05-14',
    });
    expect(c.ownerId).toBe('user_dev_jack_stone');
    expect(c.assignedUserId).toBe('test_user_new');
    expect(c.customFieldsJson).toBe(JSON.stringify([{ key: 'VIP Level', value: 'Gold' }]));
    expect(c.dateOfBirth).toBeInstanceOf(Date);
    expect((c.dateOfBirth as Date).toISOString().slice(0, 10)).toBe('1990-05-14');
  });

  it('createContact rejects an ownerId who is not a workspace member', async () => {
    await expect(createContact('ws_test', {
      firstName: 'Jane',
      ownerId: 'user_stranger',
    })).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('not a member') });
    expect(state.created).toBeNull();
  });

  it('createContact rejects an invalid dateOfBirth', async () => {
    await expect(createContact('ws_test', {
      firstName: 'Jane',
      dateOfBirth: 'not-a-date',
    })).rejects.toMatchObject({ statusCode: 400 });
    expect(state.created).toBeNull();
  });

  it('createContact leaves owner fields null when none are given', async () => {
    const c = await createContact('ws_test', { firstName: 'Jane' });
    expect(c.ownerId).toBeNull();
    expect(c.assignedUserId).toBeNull();
    expect(c.customFieldsJson).toBeNull();
    expect(c.dateOfBirth).toBeNull();
  });

  it('GET /team lists real members with the userId as displayName when Clerk is unavailable, and filters pending_ rows', async () => {
    const res = await request(app).get('/api/settings/team');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].userId).toBe('user_dev_jack_stone');
    expect(res.body[0].displayName).toBe('user_dev_jack_stone');
    expect(res.body.find((m: any) => m.userId.startsWith('pending_'))).toBeUndefined();
    expect(res.body.some((m: any) => m.displayName === 'John Doe (You)')).toBe(false);
  });
});
