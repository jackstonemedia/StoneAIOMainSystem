import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import assistantRouter from '../routes/assistant.routes.js';
import { errorHandler } from '../middleware/error.js';

interface FixtureWorkspaceSettings {
  id: string;
  workspaceId: string;
  maxMode: string;
  fullAutonomyRoles: string[];
  requireApprovalFor: Record<string, any>;
  bulkThreshold: number;
  dailyLimits: Record<string, any>;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const mockWorkspaceSettings: Record<string, FixtureWorkspaceSettings> = {};

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    $transaction: vi.fn().mockImplementation(async (callback) => {
      const txMock = {
        $executeRaw: vi.fn().mockResolvedValue(1),
        assistantWorkspaceSettings: {
          findUnique: vi.fn().mockImplementation(({ where }) => {
            return Promise.resolve(mockWorkspaceSettings[where.workspaceId] || null);
          }),
          create: vi.fn().mockImplementation(({ data }) => {
            const item: FixtureWorkspaceSettings = {
              id: `ws-set-${Date.now()}`,
              workspaceId: data.workspaceId,
              maxMode: data.maxMode || 'full',
              fullAutonomyRoles: data.fullAutonomyRoles || ['owner', 'admin'],
              requireApprovalFor: data.requireApprovalFor || {},
              bulkThreshold: data.bulkThreshold ?? 25,
              dailyLimits: data.dailyLimits || {},
              enabled: data.enabled ?? true,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockWorkspaceSettings[data.workspaceId] = item;
            return Promise.resolve(item);
          }),
          upsert: vi.fn().mockImplementation(({ where, create, update }) => {
            let item = mockWorkspaceSettings[where.workspaceId];
            if (!item) {
              item = {
                id: `ws-set-${Date.now()}`,
                workspaceId: create.workspaceId,
                maxMode: create.maxMode || 'full',
                fullAutonomyRoles: create.fullAutonomyRoles || ['owner', 'admin'],
                requireApprovalFor: create.requireApprovalFor || {},
                bulkThreshold: create.bulkThreshold ?? 25,
                dailyLimits: create.dailyLimits || {},
                enabled: create.enabled ?? true,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
            } else {
              item = {
                ...item,
                ...update,
                updatedAt: new Date(),
              };
            }
            mockWorkspaceSettings[where.workspaceId] = item;
            return Promise.resolve(item);
          }),
        },
      };
      return callback(txMock);
    }),
  },
}));

function createApp(role: string = 'admin', workspaceId: string = 'ws-test-1', userId: string = 'user-1') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).workspaceId = workspaceId;
    (req as any).userId = userId;
    (req as any).userRole = role;
    next();
  });
  app.use('/assistant', assistantRouter);
  app.use(errorHandler);
  return app;
}

describe('Stage S7: Workspace Settings & Admin Controls', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockWorkspaceSettings)) {
      delete mockWorkspaceSettings[key];
    }
  });

  it('rejects GET /workspace-settings for non-admin members with 403', async () => {
    const app = createApp('member', 'ws-test-1', 'user-member');
    const res = await request(app).get('/assistant/workspace-settings');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Only workspace admins or owners/);
  });

  it('allows GET /workspace-settings for workspace admins (200 with default settings)', async () => {
    const app = createApp('admin', 'ws-test-1', 'user-admin');
    const res = await request(app).get('/assistant/workspace-settings');
    expect(res.status).toBe(200);
    expect(res.body.workspaceId).toBe('ws-test-1');
    expect(res.body.maxMode).toBe('full');
    expect(res.body.bulkThreshold).toBe(25);
    expect(res.body.enabled).toBe(true);
  });

  it('rejects PUT /workspace-settings for regular members with 403', async () => {
    const app = createApp('member', 'ws-test-1', 'user-member');
    const res = await request(app)
      .put('/assistant/workspace-settings')
      .send({ maxMode: 'draft', bulkThreshold: 10 });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Only workspace admins or owners/);
  });

  it('allows PUT /workspace-settings for workspace owners/admins and saves changes', async () => {
    const app = createApp('owner', 'ws-test-1', 'user-owner');
    const updateRes = await request(app)
      .put('/assistant/workspace-settings')
      .send({
        maxMode: 'draft',
        bulkThreshold: 50,
        fullAutonomyRoles: ['owner'],
        enabled: true,
        requireApprovalFor: { email_send: true, bulk_change: true },
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.maxMode).toBe('draft');
    expect(updateRes.body.bulkThreshold).toBe(50);
    expect(updateRes.body.fullAutonomyRoles).toEqual(['owner']);
    expect(updateRes.body.requireApprovalFor).toEqual({ email_send: true, bulk_change: true });

    // Verify GET retrieves the updated settings
    const getRes = await request(app).get('/assistant/workspace-settings');
    expect(getRes.status).toBe(200);
    expect(getRes.body.maxMode).toBe('draft');
    expect(getRes.body.bulkThreshold).toBe(50);
  });

  it('enforces multi-tenant isolation across workspace governance settings', async () => {
    const appWs1 = createApp('admin', 'ws-alpha', 'admin-alpha');
    const appWs2 = createApp('admin', 'ws-beta', 'admin-beta');

    // Update settings in ws-alpha
    await request(appWs1)
      .put('/assistant/workspace-settings')
      .send({ maxMode: 'read_only', bulkThreshold: 5 });

    // Retrieve settings in ws-beta
    const betaRes = await request(appWs2).get('/assistant/workspace-settings');
    expect(betaRes.status).toBe(200);
    expect(betaRes.body.workspaceId).toBe('ws-beta');
    // Beta retains defaults, not alpha's mutated settings
    expect(betaRes.body.maxMode).toBe('full');
    expect(betaRes.body.bulkThreshold).toBe(25);
  });
});
