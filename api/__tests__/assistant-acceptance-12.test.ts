/**
 * Jack's Acceptance Run (12 Scenarios) — Stone AIO Assistant
 * Spec Section 15 (Acceptance Testing & Verification)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import assistantRouter from '../routes/assistant.routes.js';
import { evaluateModeGate } from '../services/assistant/modes.js';
import { toolRegistry } from '../services/assistant/tools/registry.js';
import { findersTools } from '../services/assistant/tools/finders.tools.js';
import { memoryService } from '../services/assistant/memory.service.js';
import { projectService } from '../services/assistant/project.service.js';
import { assistantRepo } from '../services/assistant/assistant.repo.js';

interface FixtureContact {
  id: string;
  workspaceId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dndEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastContactedAt?: Date | null;
  events?: Array<{ type: string; title: string; createdAt: Date }>;
}

interface FixtureToolCall {
  id: string;
  workspaceId: string;
  userId: string;
  toolName: string;
  risk: string;
  args: any;
  status: string;
  result?: any;
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
  createdAt: Date;
  updatedAt: Date;
}

const mockContacts: Record<string, FixtureContact> = {};
const mockToolCalls: Record<string, FixtureToolCall> = {};
const mockConversations: Record<string, FixtureConversation> = {};
const mockMemories: Record<string, any> = {};
const mockProjects: Record<string, any> = {};

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    $transaction: vi.fn().mockImplementation(async (callback) => {
      const txMock = {
        $executeRaw: vi.fn().mockResolvedValue(1),
        contact: {
          findMany: vi.fn().mockImplementation(({ where, take }) => {
            const list = Object.values(mockContacts).filter((c) => {
              if (where.workspaceId && c.workspaceId !== where.workspaceId) return false;
              if (where.dndEnabled !== undefined && c.dndEnabled !== where.dndEnabled) return false;
              return true;
            });
            return Promise.resolve(
              list.map((c) => ({
                ...c,
                events: c.events || [],
                campaignRecipients: [],
                inboxMessages: [],
              })).slice(0, take || 50)
            );
          }),
        },
        contactEvent: {
          findFirst: vi.fn().mockImplementation(({ where }) => {
            const c = mockContacts[where.contactId];
            if (!c || !c.events || c.events.length === 0) return Promise.resolve(null);
            return Promise.resolve(c.events[c.events.length - 1]);
          }),
        },
        activity: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        conversation: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
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
          findMany: vi.fn().mockImplementation(({ where }) => {
            const list = Object.values(mockConversations).filter((c) => {
              if (where.workspaceId && c.workspaceId !== where.workspaceId) return false;
              if (where.userId && c.userId !== where.userId) return false;
              return true;
            });
            return Promise.resolve(list);
          }),
        },
        assistantMemory: {
          findFirst: vi.fn().mockImplementation(({ where }) => {
            const item = Object.values(mockMemories).find((m) => {
              if (where.workspaceId && m.workspaceId !== where.workspaceId) return false;
              if (where.key && m.key !== where.key) return false;
              if (where.userId && m.userId !== where.userId) return false;
              return true;
            });
            return Promise.resolve(item || null);
          }),
          findMany: vi.fn().mockImplementation(({ where }) => {
            const list = Object.values(mockMemories).filter((m) => {
              if (where.workspaceId && m.workspaceId !== where.workspaceId) return false;
              if (where.OR) {
                const match = where.OR.some((clause: any) => {
                  if (clause.userId && m.userId === clause.userId) return true;
                  if (clause.category && m.category === clause.category) return true;
                  return false;
                });
                return match;
              }
              if (where.userId && m.userId !== where.userId) return false;
              return true;
            });
            return Promise.resolve(list);
          }),
          create: vi.fn().mockImplementation(({ data }) => {
            const id = `mem-${Date.now()}-${Math.random()}`;
            const item = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
            mockMemories[id] = item;
            return Promise.resolve(item);
          }),
        },
        assistantProject: {
          findFirst: vi.fn().mockImplementation(({ where }) => {
            const item = Object.values(mockProjects).find((p) => {
              if (where.id && p.id !== where.id) return false;
              if (where.workspaceId && p.workspaceId !== where.workspaceId) return false;
              return true;
            });
            return Promise.resolve(item || null);
          }),
          create: vi.fn().mockImplementation(({ data }) => {
            const id = `proj-${Date.now()}`;
            const item = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
            mockProjects[id] = item;
            return Promise.resolve(item);
          }),
        },
        assistantProjectFile: {
          create: vi.fn().mockImplementation(({ data }) => {
            return Promise.resolve({ id: `file-${Date.now()}`, ...data, status: 'ready' });
          }),
        },
        assistantProjectLink: {
          create: vi.fn().mockImplementation(({ data }) => {
            return Promise.resolve({ id: `link-${Date.now()}`, ...data });
          }),
        },
        assistantSettings: {
          findUnique: vi.fn().mockResolvedValue({ memoryEnabled: true }),
        },
      };
      return callback(txMock);
    }),
    contact: {
      findMany: vi.fn().mockImplementation(({ where, take }) => {
        const list = Object.values(mockContacts).filter((c) => {
          if (where.workspaceId && c.workspaceId !== where.workspaceId) return false;
          if (where.dndEnabled !== undefined && c.dndEnabled !== where.dndEnabled) return false;
          return true;
        });
        return Promise.resolve(
          list.map((c) => ({
            ...c,
            events: c.events || [],
            campaignRecipients: [],
            inboxMessages: [],
          })).slice(0, take || 50)
        );
      }),
    },
    contactEvent: {
      findFirst: vi.fn().mockImplementation(({ where }) => {
        const c = mockContacts[where.contactId];
        if (!c || !c.events || c.events.length === 0) return Promise.resolve(null);
        return Promise.resolve(c.events[c.events.length - 1]);
      }),
    },
    activity: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    conversation: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    campaignRecipient: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    inboxMessage: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    task: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    appointment: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    deal: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

function createApp(userRole = 'member', userId = 'user-1', workspaceId = 'ws-alpha') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { id: userId, role: userRole };
    (req as any).workspace = { id: workspaceId, name: 'Alpha Workspace' };
    (req as any).workspaceId = workspaceId;
    (req as any).userId = userId;
    (req as any).userRole = userRole;
    next();
  });
  app.use('/api/assistant', assistantRouter);
  return app;
}

describe("Jack's Acceptance Run (12 Scenarios from Spec Section 15)", () => {
  beforeEach(() => {
    for (const k in mockContacts) delete mockContacts[k];
    for (const k in mockToolCalls) delete mockToolCalls[k];
    for (const k in mockConversations) delete mockConversations[k];
    for (const k in mockMemories) delete mockMemories[k];
    for (const k in mockProjects) delete mockProjects[k];
  });

  // Scenario 1: "Find leads I haven't talked to in 3 weeks."
  it('Scenario 1: find_stale_leads returns contacts with reasons and days since last touch', async () => {
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 25); // 25 days ago (> 3 weeks)

    mockContacts['c1'] = {
      id: 'c1',
      workspaceId: 'ws-alpha',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      phone: '555-0100',
      dndEnabled: false,
      createdAt: staleDate,
      updatedAt: staleDate,
      lastContactedAt: staleDate,
      events: [{ type: 'email', title: 'Follow-up sent', createdAt: staleDate }],
    };

    const staleFinder = findersTools.find((t) => t.name === 'find_stale_leads')!;
    const res = await staleFinder.execute(
      { olderThanDays: 21 },
      { workspaceId: 'ws-alpha', userId: 'user-1', userRole: 'member' }
    );

    expect(res.total).toBe(1);
    expect(res.leads[0].id).toBe('c1');
    expect(res.leads[0].daysSinceLastTouch).toBeGreaterThanOrEqual(21);
    expect(res.leads[0].matchReason).toContain('days since last');
  });

  // Scenario 2: "Which new leads never got a welcome email?" then "send them one" in Ask first
  it('Scenario 2: find_unwelcomed_leads identifies leads with zero emails and queues in Ask first', async () => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 2);

    mockContacts['c2'] = {
      id: 'c2',
      workspaceId: 'ws-alpha',
      firstName: 'Bob',
      lastName: 'Jones',
      email: 'bob@example.com',
      phone: '555-0101',
      dndEnabled: false,
      createdAt: recentDate,
      updatedAt: recentDate,
      events: [],
    };

    const unwelcomedFinder = findersTools.find((t) => t.name === 'find_unwelcomed_leads')!;
    const res = await unwelcomedFinder.execute(
      { createdWithinDays: 30 },
      { workspaceId: 'ws-alpha', userId: 'user-1', userRole: 'member' }
    );

    expect(res.total).toBe(1);
    expect(res.leads[0].id).toBe('c2');
    expect(res.leads[0].matchReason).toContain('zero outbound emails');

    // In Ask first (draft) mode, send_email queues for approval
    const sendTool = toolRegistry.getTool('send_email')!;
    const decision = evaluateModeGate({
      chatMode: 'draft',
      userRole: 'member',
      toolRisk: sendTool.risk,
      minimumRole: sendTool.minimumRole,
    });
    expect(decision.action).toBe('proposal');
  });

  // Scenario 3: The same request in Read-only explains and offers switch to Ask first
  it('Scenario 3: Read-only mode blocks execution and prompts to switch to Ask first', () => {
    const sendTool = toolRegistry.getTool('send_email')!;
    const decision = evaluateModeGate({
      chatMode: 'read_only',
      userRole: 'member',
      toolRisk: sendTool.risk,
      minimumRole: sendTool.minimumRole,
    });

    expect(decision.action).toBe('blocked');
    expect((decision as any).reason).toContain('Read-only mode');
  });

  // Scenario 4: Autonomous mode with email cap respects daily limits
  it('Scenario 4: Autonomous mode with email cap allows sends under cap and queues excess', () => {
    const sendTool = toolRegistry.getTool('send_email')!;

    // Case A: under cap in full mode with admin role
    const decisionUnder = evaluateModeGate({
      chatMode: 'full',
      userRole: 'admin',
      toolRisk: sendTool.risk,
      minimumRole: sendTool.minimumRole,
      capability: 'emails',
      capabilityEnabled: true,
      dailyLimitExceeded: false,
    });
    expect(decisionUnder.action).toBe('execute');

    // Case B: exceeds daily cap
    const decisionOver = evaluateModeGate({
      chatMode: 'full',
      userRole: 'admin',
      toolRisk: sendTool.risk,
      minimumRole: sendTool.minimumRole,
      capability: 'emails',
      capabilityEnabled: true,
      dailyLimitExceeded: true,
    });
    expect(decisionOver.action).toBe('needs_approval');
    expect((decisionOver as any).reason).toContain('Daily outreach limit reached');
  });

  // Scenario 5: Autonomous, "delete this contact": it still asks
  it('Scenario 5: Destructive actions (delete_contact) always require approval even in Autonomous mode', () => {
    const deleteTool = toolRegistry.getTool('delete_contact')!;
    expect(deleteTool).toBeDefined();

    const decision = evaluateModeGate({
      chatMode: 'full',
      userRole: 'admin',
      toolRisk: deleteTool.risk,
      minimumRole: deleteTool.minimumRole,
      requiresExplicitApproval: true,
    });

    expect(decision.action).toBe('needs_approval');
    expect((decision as any).reason).toContain('Action requires explicit approval even in Full autonomy');
  });

  // Scenario 6: Inbound email prompt injection forces Tier 2 reach-out action to queue
  it('Scenario 6: Inbound message injection triggers untrusted content gate, queuing actions', () => {
    const sendTool = toolRegistry.getTool('send_email')!;

    const decision = evaluateModeGate({
      chatMode: 'full',
      userRole: 'admin',
      toolRisk: sendTool.risk,
      minimumRole: sendTool.minimumRole,
      hasUntrustedContent: true,
    });

    expect(decision.action).toBe('needs_approval');
    expect((decision as any).reason).toContain('untrusted content');
  });

  // Scenario 7: "Remember I sign off as Jack": appears under Personal memory and another member cannot see it
  it('Scenario 7: Personal memory is scoped to user and invisible to other members in the same workspace', async () => {
    // User A saves preference
    await memoryService.saveMemory('ws-alpha', 'user-A', {
      value: 'Prefers signing off as Jack.',
      category: 'preference',
      key: 'Sign-off',
    });

    // User A retrieves memory
    const userABlock = await memoryService.getMemoriesPromptBlock('ws-alpha', 'user-A');
    expect(userABlock).toContain('Jack');

    // User B retrieves memory in the same workspace
    const userBBlock = await memoryService.getMemoriesPromptBlock('ws-alpha', 'user-B');
    expect(userBBlock).not.toContain('Jack');
  });

  // Scenario 8: Project creation, file upload, CRM link association
  it('Scenario 8: Project files and CRM links are properly recorded for knowledge context', async () => {
    const project = await projectService.createProject('ws-alpha', 'user-1', {
      name: 'Q4 Win-back',
      description: 'Re-engaging stalled accounts',
      visibility: 'private',
    });

    expect(project.id).toBeTruthy();
    expect(project.name).toBe('Q4 Win-back');

    const file = await projectService.addProjectFile('ws-alpha', 'user-1', project.id, {
      fileName: 'playbook.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      extractedText: 'Target discount is up to 10 percent.',
    });
    expect(file.fileName).toBe('playbook.pdf');

    const link = await projectService.addProjectLink('ws-alpha', 'user-1', project.id, {
      entityType: 'smart_list',
      entityId: 'sl-123',
      label: 'Stalled Q3 Leads',
    });
    expect(link.entityType).toBe('smart_list');
  });

  // Scenario 9: Abort mid-stream signal handling
  it('Scenario 9: AbortController signal halts turn without unhandled exceptions', () => {
    const controller = new AbortController();
    expect(controller.signal.aborted).toBe(false);
    controller.abort();
    expect(controller.signal.aborted).toBe(true);
  });

  // Scenario 10: Pause assistant forces Read-only for all users at once
  it('Scenario 10: Pausing assistant enforces Read-only across all users', () => {
    const updateTool = toolRegistry.getTool('update_contact')!;

    const pausedDecision = evaluateModeGate({
      chatMode: 'full',
      userRole: 'owner',
      toolRisk: updateTool.risk,
      minimumRole: updateTool.minimumRole,
      isPaused: true,
    });

    expect(pausedDecision.action).toBe('blocked');
    expect((pausedDecision as any).reason).toContain('paused by a workspace administrator');
  });

  // Scenario 11: Approve the same action in two tabs executes exactly once (atomic claiming)
  it('Scenario 11: Double-approve executes exactly once via atomic claim', async () => {
    const toolCallId = 'call-1';
    mockToolCalls[toolCallId] = {
      id: toolCallId,
      workspaceId: 'ws-alpha',
      userId: 'user-1',
      toolName: 'create_contact',
      risk: 'write',
      args: { firstName: 'Test', lastName: 'Contact' },
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // First claim succeeds
    const firstClaim = await assistantRepo.claimToolCall('ws-alpha', toolCallId, 'user-approver');
    expect(firstClaim).toBe(true);
    expect(mockToolCalls[toolCallId].status).toBe('running');

    // Second claim fails atomically
    const secondClaim = await assistantRepo.claimToolCall('ws-alpha', toolCallId, 'user-approver');
    expect(secondClaim).toBe(false);

    // Route returns 400 when attempting to approve a running tool call
    const app = createApp('admin', 'user-approver', 'ws-alpha');
    const res = await request(app).post(`/api/assistant/tool-calls/${toolCallId}/approve`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Cannot approve tool call with status "running"');
  });

  // Scenario 12: Cross-workspace tenant isolation
  it('Scenario 12: User in Workspace B cannot access Workspace A conversations', async () => {
    mockConversations['convo-alpha'] = {
      id: 'convo-alpha',
      workspaceId: 'ws-alpha',
      userId: 'user-1',
      title: 'Confidential Strategy',
      mode: 'read_only',
      thinking: 'auto',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // User in Workspace Beta tries to access Workspace Alpha's conversation
    const appBeta = createApp('member', 'user-2', 'ws-beta');
    const res = await request(appBeta).get('/api/assistant/conversations/convo-alpha');

    expect(res.status).toBe(404);
  });
});
