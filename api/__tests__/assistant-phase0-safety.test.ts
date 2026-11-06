/**
 * Phase 0: Safety & Tenant Hardening Tests
 * Spec Section 3 / Section 14 Phase 0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import assistantRouter from '../routes/assistant.routes.js';
import { assistantRepo } from '../services/assistant/assistant.repo.js';

interface FixtureToolCall {
  id: string;
  workspaceId: string;
  userId: string;
  conversationId?: string;
  toolName: string;
  risk: string;
  args: any;
  status: string;
  result?: any;
  error?: string;
  approvedByUserId?: string;
  decidedAt?: Date;
  executedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

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

interface FixtureConversation {
  id: string;
  workspaceId: string;
  userId: string;
  title: string;
  mode: string;
  thinking: string;
  pinnedAt: Date | null;
  projectId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const mockToolCalls: Record<string, FixtureToolCall> = {};
const mockWorkspaceSettings: Record<string, FixtureWorkspaceSettings> = {};
const mockConversations: Record<string, FixtureConversation> = {};

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    $transaction: vi.fn().mockImplementation(async (callback) => {
      const txMock = {
        $executeRaw: vi.fn().mockResolvedValue(1),
        assistantToolCall: {
          findFirst: vi.fn().mockImplementation(({ where }) => {
            const item = Object.values(mockToolCalls).find((t) => {
              if (where.id && t.id !== where.id) return false;
              if (where.workspaceId && t.workspaceId !== where.workspaceId) return false;
              return true;
            });
            return Promise.resolve(item || null);
          }),
          updateMany: vi.fn().mockImplementation(({ where, data }) => {
            let count = 0;
            for (const item of Object.values(mockToolCalls)) {
              if (where.id && item.id !== where.id) continue;
              if (where.workspaceId && item.workspaceId !== where.workspaceId) continue;
              if (where.status && item.status !== where.status) continue;
              Object.assign(item, data, { updatedAt: new Date() });
              count++;
            }
            return Promise.resolve({ count });
          }),
          update: vi.fn().mockImplementation(({ where, data }) => {
            const item = mockToolCalls[where.id];
            if (item) {
              Object.assign(item, data, { updatedAt: new Date() });
              return Promise.resolve(item);
            }
            return Promise.reject(new Error('Tool call not found'));
          }),
        },
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
        },
        assistantConversation: {
          findFirst: vi.fn().mockImplementation(({ where }) => {
            const item = Object.values(mockConversations).find((c) => {
              if (where.id && c.id !== where.id) return false;
              if (where.workspaceId && c.workspaceId !== where.workspaceId) return false;
              if (where.userId && c.userId !== where.userId) return false;
              return true;
            });
            return Promise.resolve(item || null);
          }),
          update: vi.fn().mockImplementation(({ where, data }) => {
            const item = mockConversations[where.id];
            if (item) {
              Object.assign(item, data, { updatedAt: new Date() });
              return Promise.resolve(item);
            }
            return Promise.reject(new Error('Conversation not found'));
          }),
        },
      };
      return callback(txMock);
    }),
  },
}));

vi.mock('../services/assistant/tools/registry.js', () => ({
  toolRegistry: {
    getTool: vi.fn().mockReturnValue({
      name: 'send_email',
      minimumRole: 'member',
    }),
    execute: vi.fn().mockResolvedValue({
      result: { sent: true },
    }),
  },
}));

function createApp(userRole: string = 'member', workspaceId: string = 'ws-test', userId: string = 'user-test') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).workspaceId = workspaceId;
    (req as any).userId = userId;
    (req as any).userRole = userRole;
    next();
  });
  app.use('/api/assistant', assistantRouter);
  return app;
}

describe('Phase 0 Safety: Atomic Approval Execution & Role Enforcement', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockToolCalls)) delete mockToolCalls[key];
    for (const key of Object.keys(mockWorkspaceSettings)) delete mockWorkspaceSettings[key];
    for (const key of Object.keys(mockConversations)) delete mockConversations[key];
  });

  it('atomically claims a pending tool call and blocks duplicate/concurrent execution', async () => {
    const toolCallId = 'tc-123';
    mockToolCalls[toolCallId] = {
      id: toolCallId,
      workspaceId: 'ws-test',
      userId: 'user-author',
      toolName: 'send_email',
      risk: 'send',
      args: { to: 'lead@example.com', subject: 'Hello' },
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // First claim succeeds
    const firstClaim = await assistantRepo.claimToolCall('ws-test', toolCallId, 'user-approver');
    expect(firstClaim).toBe(true);
    expect(mockToolCalls[toolCallId].status).toBe('running');

    // Second claim fails atomically
    const secondClaim = await assistantRepo.claimToolCall('ws-test', toolCallId, 'user-approver');
    expect(secondClaim).toBe(false);
  });

  it('rejects approval with 409 Conflict if tool call is already running or approved', async () => {
    const toolCallId = 'tc-456';
    mockToolCalls[toolCallId] = {
      id: toolCallId,
      workspaceId: 'ws-test',
      userId: 'user-author',
      toolName: 'send_email',
      risk: 'send',
      args: { to: 'lead@example.com' },
      status: 'running', // already claimed
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const app = createApp('admin', 'ws-test', 'user-approver');
    const res = await request(app).post(`/api/assistant/tool-calls/${toolCallId}/approve`).send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Cannot approve tool call with status "running"');
  });

  it('prevents regular members from setting conversation mode above workspace ceiling', async () => {
    // Workspace ceiling is 'draft'
    mockWorkspaceSettings['ws-test'] = {
      id: 'ws-set-1',
      workspaceId: 'ws-test',
      maxMode: 'draft',
      fullAutonomyRoles: ['owner', 'admin'],
      requireApprovalFor: {},
      bulkThreshold: 25,
      dailyLimits: {},
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockConversations['c-1'] = {
      id: 'c-1',
      workspaceId: 'ws-test',
      userId: 'user-test',
      title: 'Test Chat',
      mode: 'read_only',
      thinking: 'auto',
      pinnedAt: null,
      projectId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const app = createApp('member', 'ws-test', 'user-test');

    // Trying to set mode to 'full' when ceiling is 'draft' should be rejected with 400
    const res = await request(app).patch('/api/assistant/conversations/c-1').send({ mode: 'full' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Workspace ceiling is "draft"');
  });

  it('allows members to set conversation mode at or below workspace ceiling', async () => {
    mockWorkspaceSettings['ws-test'] = {
      id: 'ws-set-1',
      workspaceId: 'ws-test',
      maxMode: 'draft',
      fullAutonomyRoles: ['owner', 'admin'],
      requireApprovalFor: {},
      bulkThreshold: 25,
      dailyLimits: {},
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockConversations['c-2'] = {
      id: 'c-2',
      workspaceId: 'ws-test',
      userId: 'user-test',
      title: 'Test Chat',
      mode: 'read_only',
      thinking: 'auto',
      pinnedAt: null,
      projectId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const app = createApp('member', 'ws-test', 'user-test');
    const res = await request(app).patch('/api/assistant/conversations/c-2').send({ mode: 'draft' });

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('draft');
  });
});
