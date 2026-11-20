/**
 * GDPR — complete-platform item 5.
 *
 * Export: every workspace-scoped table + every child table, secrets
 * stripped. Workspace delete: owner only, typed-name confirm, counts
 * reported. Account delete: the person's data goes; sole-owned workspaces
 * are deleted, shared workspaces transfer ownership, business data stays.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'fs';
import path from 'path';

const state = vi.hoisted(() => ({
  tables: {} as Record<string, any[]>,
  role: 'admin' as string | null,
  clerkDeleted: [] as string[],
}));

function matchWhere(row: any, where: any): boolean {
  if (!where) return true;
  for (const [k, v] of Object.entries(where as Record<string, any>)) {
    if (v && typeof v === 'object' && 'in' in v) {
      if (!v.in.includes(row[k])) return false;
    } else if (v && typeof v === 'object' && 'not' in v) {
      if (row[k] === v.not) return false;
    } else if (row[k] !== v) {
      return false;
    }
  }
  return true;
}

function makeDelegate(table: string) {
  const rows = () => (state.tables[table] ??= []);
  return {
    findMany: vi.fn(async (args: any = {}) => {
      let out = rows().filter((r: any) => matchWhere(r, args.where));
      if (args.include?.workspace) {
        out = out.map((r: any) => ({
          ...r,
          workspace: (state.tables['workspace'] ?? []).find((w: any) => w.id === r.workspaceId) ?? null,
        }));
      }
      return out;
    }),
    findFirst: vi.fn(async (args: any = {}) => {
      if (table === 'workspaceMember' && state.role) return { workspaceId: 'ws_test', userId: 'user_1', role: state.role };
      return rows().find((r: any) => matchWhere(r, args.where)) ?? null;
    }),
    findUnique: vi.fn(async (args: any = {}) => rows().find((r: any) => matchWhere(r, args.where)) ?? null),
    count: vi.fn(async (args: any = {}) => rows().filter((r: any) => matchWhere(r, args.where)).length),
    create: vi.fn(async ({ data }: any) => {
      const row = { id: `id-${Math.random().toString(36).slice(2, 8)}`, ...data };
      rows().push(row);
      return row;
    }),
    update: vi.fn(async ({ where, data }: any) => {
      const row = rows().find((r: any) => matchWhere(r, where));
      if (!row) throw new Error('Record not found');
      Object.assign(row, data);
      return row;
    }),
    delete: vi.fn(async ({ where }: any) => {
      const idx = rows().findIndex((r: any) => matchWhere(r, where));
      if (idx === -1) throw new Error('Record not found');
      return rows().splice(idx, 1)[0];
    }),
    deleteMany: vi.fn(async ({ where }: any = {}) => {
      const before = rows().length;
      state.tables[table] = rows().filter((r: any) => !matchWhere(r, where));
      return { count: before - state.tables[table].length };
    }),
  };
}

vi.mock('../../infrastructure/database/client.js', () => ({
  db: new Proxy(
    {},
    {
      get: (_t: any, prop: string) => {
        if (prop === 'then') return undefined;
        return makeDelegate(prop);
      },
    },
  ),
}));

import { buildWorkspaceExport, EXPORT_DIRECT_TABLES, EXPORT_CHILD_TABLES } from '../services/gdpr/export.service.js';
import { deleteAccount } from '../services/gdpr/delete.service.js';
import gdprRouter from '../routes/gdpr.routes.js';

function seed() {
  state.tables = {
    workspace: [
      { id: 'ws_test', name: 'Test Co', plan: 'plus', ownerId: 'user_1' },
      { id: 'ws_shared', name: 'Shared Co', plan: 'free', ownerId: 'user_1' },
      { id: 'ws_other', name: 'Other Co', plan: 'free', ownerId: 'user_9' },
    ],
    user: [{ id: 'u_1', clerkId: 'user_1' }],
    workspaceMember: [
      { workspaceId: 'ws_test', userId: 'user_1', role: 'admin', createdAt: new Date('2026-01-01') },
      { workspaceId: 'ws_shared', userId: 'user_1', role: 'admin', createdAt: new Date('2026-01-01') },
      { workspaceId: 'ws_shared', userId: 'user_2', role: 'admin', createdAt: new Date('2026-01-02') },
      { workspaceId: 'ws_shared', userId: 'user_3', role: 'member', createdAt: new Date('2026-01-03') },
      { workspaceId: 'ws_other', userId: 'user_1', role: 'member', createdAt: new Date('2026-01-01') },
    ],
    contact: [
      { id: 'ct_1', workspaceId: 'ws_test', firstName: 'Alice', email: 'a@x.com' },
      { id: 'ct_2', workspaceId: 'ws_test', firstName: 'Bob', email: 'b@x.com' },
      { id: 'ct_3', workspaceId: 'ws_shared', firstName: 'Carol', email: 'c@x.com' },
    ],
    conversation: [{ id: 'cv_1', workspaceId: 'ws_test', contactId: 'ct_1' }],
    conversationMessage: [
      { id: 'cm_1', conversationId: 'cv_1', body: 'hi' },
      { id: 'cm_2', conversationId: 'cv_1', body: 'hello' },
    ],
    channelConnection: [
      { id: 'cc_1', workspaceId: 'ws_test', provider: 'gmail', email: 'me@x.com', credentialsJson: 'ENCRYPTED-SECRET' },
    ],
    workspaceInvite: [{ id: 'inv_1', workspaceId: 'ws_test', email: 'n@y.com', token: 'SECRET-TOKEN' }],
    userTwoFactor: [{ id: 'tf_1', userId: 'user_1', secretEncrypted: 'x', enabled: true }],
    twoFactorSession: [{ sessionId: 's_1', userId: 'user_1' }],
    agentConversation: [{ id: 'ac_1', workspaceId: 'ws_shared', userId: 'user_1', title: 'mine' }],
    agentMemory: [{ id: 'am_1', workspaceId: 'ws_shared', userId: 'user_1', content: 'pref' }],
  };
  state.role = 'admin';
  state.clerkDeleted = [];
}

function gdprApp(workspaceId = 'ws_test', userId = 'user_1') {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.userId = userId;
    req.workspaceId = workspaceId;
    next();
  });
  app.use('/gdpr', gdprRouter);
  return app;
}

describe('GDPR export (item 5)', () => {
  beforeEach(seed);

  it('exports every table with counts, and strips credentials', async () => {
    const exported = await buildWorkspaceExport('ws_test');
    expect(exported.workspace).toMatchObject({ id: 'ws_test', name: 'Test Co' });
    expect(exported.counts.contact).toBe(2);
    expect(exported.data.contact).toHaveLength(2);
    // Child table reached via parent ids.
    expect(exported.counts.conversationMessage).toBe(2);
    expect(exported.data.conversationMessage.map((m: any) => m.id)).toEqual(['cm_1', 'cm_2']);
    // Secrets never leave the server.
    expect(JSON.stringify(exported)).not.toContain('ENCRYPTED-SECRET');
    expect(JSON.stringify(exported)).not.toContain('SECRET-TOKEN');
    expect(exported.data.channelConnection[0]).not.toHaveProperty('credentialsJson');
    expect(exported.data.workspaceInvite[0]).not.toHaveProperty('token');
    expect(exported.totalRows).toBe(Object.values(exported.counts).reduce((a: number, b: number) => a + b, 0));
  });

  it('the registry covers every workspace-scoped model in the schema', () => {
    const schema = fs.readFileSync(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
    const models = schema.split(/^model /m).slice(1);
    const wsModels: string[] = [];
    const childModels: Array<{ name: string; parent: string }> = [];
    for (const block of models) {
      const name = block.split(' ')[0];
      const body = block.split('\n}')[0];
      const wsRel = /workspace\s+Workspace\s+@relation\(fields: \[workspaceId\]/.test(body);
      if (wsRel) wsModels.push(name);
    }
    const directKeys = new Set(EXPORT_DIRECT_TABLES.map((t) => t.delegate));
    const toDelegate = (n: string) => n[0].toLowerCase() + n.slice(1);
    for (const m of wsModels) {
      expect(directKeys.has(toDelegate(m))).toBe(true);
    }
    // No registry entry without a model behind it either.
    expect(EXPORT_DIRECT_TABLES.length).toBe(wsModels.length);
    // Every child table's parent is a direct table.
    for (const c of EXPORT_CHILD_TABLES) {
      expect(directKeys.has(c.parent)).toBe(true);
    }
  });

  it('GET /export downloads one JSON file (admin) and refuses a member', async () => {
    const res = await request(gdprApp()).get('/gdpr/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/stone-aio-export-ws_test-.*\.json/);
    const body = JSON.parse(res.text);
    expect(body.workspace.id).toBe('ws_test');
    expect(body.counts.contact).toBe(2);

    state.role = 'member';
    const denied = await request(gdprApp()).get('/gdpr/export');
    expect(denied.status).toBe(403);
  });
});

describe('GDPR workspace delete (item 5)', () => {
  beforeEach(seed);

  it('wrong name → 400 and nothing is deleted', async () => {
    const res = await request(gdprApp()).post('/gdpr/workspace/delete').send({ confirmName: 'Wrong Name' });
    expect(res.status).toBe(400);
    expect(state.tables.workspace).toHaveLength(3);
  });

  it('non-owner → 403 and nothing is deleted', async () => {
    const res = await request(gdprApp('ws_other', 'user_1')).post('/gdpr/workspace/delete').send({ confirmName: 'Other Co' });
    expect(res.status).toBe(403);
    expect(state.tables.workspace).toHaveLength(3);
  });

  it('owner + exact name → deleted with counts', async () => {
    const res = await request(gdprApp()).post('/gdpr/workspace/delete').send({ confirmName: 'Test Co' });
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
    expect(res.body.counts.contact).toBe(2);
    expect(state.tables.workspace.map((w: any) => w.id)).not.toContain('ws_test');
  });
});

describe('GDPR account delete (item 5)', () => {
  beforeEach(seed);

  it('wrong confirm → 400 and nothing is deleted', async () => {
    const res = await request(gdprApp()).post('/gdpr/account/delete').send({ confirm: 'delete' });
    expect(res.status).toBe(400);
    expect(state.tables.user).toHaveLength(1);
  });

  it('deletes the person, sole-owned workspaces, and personal rows — transfers shared ones, keeps business data', async () => {
    const result = await deleteAccount('user_1', async (clerkId) => {
      state.clerkDeleted.push(clerkId);
    });

    expect(result.deleted).toBe(true);
    expect(result.clerkDeleted).toBe(true);
    expect(state.clerkDeleted).toEqual(['user_1']);
    // ws_test was solely owned → deleted with its data.
    expect(result.workspacesDeleted).toEqual(['ws_test']);
    expect(state.tables.workspace.map((w: any) => w.id)).not.toContain('ws_test');
    // ws_shared transfers to the oldest remaining admin (user_2).
    expect(result.workspacesTransferred).toEqual([{ workspaceId: 'ws_shared', newOwnerId: 'user_2' }]);
    expect(state.tables.workspace.find((w: any) => w.id === 'ws_shared').ownerId).toBe('user_2');
    // ws_other: plain membership removed, workspace untouched.
    expect(state.tables.workspace.map((w: any) => w.id)).toContain('ws_other');
    // The person's rows are gone; the business's shared contact stays.
    expect(state.tables.user).toHaveLength(0);
    expect(state.tables.userTwoFactor).toHaveLength(0);
    expect(state.tables.twoFactorSession).toHaveLength(0);
    expect(state.tables.agentConversation).toHaveLength(0);
    expect(state.tables.agentMemory).toHaveLength(0);
    expect(state.tables.contact.find((c: any) => c.id === 'ct_3')).toBeTruthy();
    expect(result.membershipsRemoved).toBe(3);
  });

  it('reports honestly when Clerk deletion is not configured', async () => {
    const result = await deleteAccount('user_1');
    expect(result.clerkDeleted).toBe(false);
    expect(result.clerkNote).toMatch(/not configured/);
  });

  it('POST /account/delete with DELETE confirm returns the summary', async () => {
    const res = await request(gdprApp()).post('/gdpr/account/delete').send({ confirm: 'DELETE' });
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
    // No Clerk key in the test env → honest note, not a pretend delete.
    expect(res.body.clerkDeleted).toBe(false);
    expect(res.body.clerkNote).toMatch(/not configured/);
  });
});
