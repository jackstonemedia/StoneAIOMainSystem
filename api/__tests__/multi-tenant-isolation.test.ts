import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import workflowsRouter from '../routes/workflows.routes.js';
import crmRouter from '../routes/crm.routes.js';
import opportunitiesRouter from '../routes/opportunities.routes.js';
import billingRouter from '../routes/billing.routes.js';
import { errorHandler } from '../middleware/error.js';

// ── In-Memory Multi-Tenant Database Fixtures ───────────────────────────────────
interface FixtureStore {
  workflows: Record<string, any>;
  pipelines: Record<string, any>;
  pipelineStages: Record<string, any>;
  contacts: Record<string, any>;
  deals: Record<string, any>;
  nativeDefinitions: Record<string, any>;
}

const fixtures: FixtureStore = {
  workflows: {
    'wf-a-1': { id: 'wf-a-1', workspaceId: 'ws-tenant-a', name: 'Workflow A', status: 'published' },
    'wf-b-1': { id: 'wf-b-1', workspaceId: 'ws-tenant-b', name: 'Workflow B (Confidential)', status: 'published' },
  },
  pipelines: {
    'pipe-a-1': { id: 'pipe-a-1', workspaceId: 'ws-tenant-a', name: 'Sales Pipeline A' },
    'pipe-b-1': { id: 'pipe-b-1', workspaceId: 'ws-tenant-b', name: 'Sales Pipeline B' },
  },
  pipelineStages: {
    'stage-a-1': { id: 'stage-a-1', pipelineId: 'pipe-a-1', name: 'Lead A' },
    'stage-b-1': { id: 'stage-b-1', pipelineId: 'pipe-b-1', name: 'Lead B' },
  },
  contacts: {
    'ct-a-1': { id: 'ct-a-1', workspaceId: 'ws-tenant-a', email: 'alice@client-a.com' },
    'ct-b-1': { id: 'ct-b-1', workspaceId: 'ws-tenant-b', email: 'bob@client-b.com' },
  },
  deals: {
    'deal-a-1': { id: 'deal-a-1', workspaceId: 'ws-tenant-a', name: 'Deal A' },
    'deal-b-1': { id: 'deal-b-1', workspaceId: 'ws-tenant-b', name: 'Deal B' },
  },
  nativeDefinitions: {
    'wf-b-1': {
      workflowId: 'wf-b-1',
      nodesJson: JSON.stringify([{ id: 'node_1', type: 'trigger.manual' }]),
      edgesJson: JSON.stringify([]),
    },
  },
};

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    workflow: {
      findFirst: vi.fn().mockImplementation(({ where }) => {
        const item = fixtures.workflows[where.id];
        if (item && (!where.workspaceId || item.workspaceId === where.workspaceId)) {
          return Promise.resolve(item);
        }
        return Promise.resolve(null);
      }),
      findFirstOrThrow: vi.fn().mockImplementation(({ where }) => {
        const item = fixtures.workflows[where.id];
        if (item && (!where.workspaceId || item.workspaceId === where.workspaceId)) {
          return Promise.resolve(item);
        }
        return Promise.reject(new Error('Record not found'));
      }),
      create: vi.fn().mockImplementation(({ data }) => {
        const id = `wf-copy-${Date.now()}`;
        const record = { id, ...data };
        fixtures.workflows[id] = record;
        return Promise.resolve(record);
      }),
    },
    nativeWorkflowDefinition: {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(fixtures.nativeDefinitions[where.workflowId] || null);
      }),
      create: vi.fn().mockResolvedValue({ id: 'def-1' }),
    },
    pipeline: {
      findFirst: vi.fn().mockImplementation(({ where }) => {
        const item = fixtures.pipelines[where.id];
        if (item && (!where.workspaceId || item.workspaceId === where.workspaceId)) {
          return Promise.resolve(item);
        }
        return Promise.resolve(null);
      }),
      findUnique: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(fixtures.pipelines[where.id] || null);
      }),
    },
    pipelineStage: {
      findFirst: vi.fn().mockImplementation(({ where }) => {
        const stage = fixtures.pipelineStages[where.id];
        if (!stage) return Promise.resolve(null);
        if (where.pipeline?.workspaceId) {
          const parentPipe = fixtures.pipelines[stage.pipelineId];
          if (!parentPipe || parentPipe.workspaceId !== where.pipeline.workspaceId) {
            return Promise.resolve(null);
          }
        }
        return Promise.resolve(stage);
      }),
      findUnique: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(fixtures.pipelineStages[where.id] || null);
      }),
      create: vi.fn().mockImplementation(({ data }) => {
        const id = `stage-${Date.now()}`;
        const record = { id, ...data };
        fixtures.pipelineStages[id] = record;
        return Promise.resolve(record);
      }),
      update: vi.fn().mockImplementation(({ where, data }) => {
        const existing = fixtures.pipelineStages[where.id];
        if (existing) {
          Object.assign(existing, data);
          return Promise.resolve(existing);
        }
        return Promise.reject(new Error('Stage not found'));
      }),
      delete: vi.fn().mockImplementation(({ where }) => {
        delete fixtures.pipelineStages[where.id];
        return Promise.resolve({ id: where.id });
      }),
    },
    contact: {
      findFirst: vi.fn().mockImplementation(({ where }) => {
        const ct = fixtures.contacts[where.id];
        if (ct && (!where.workspaceId || ct.workspaceId === where.workspaceId)) {
          return Promise.resolve(ct);
        }
        return Promise.resolve(null);
      }),
    },
    workspace: {
      // Complete plan so these tests exercise the tenant-scoping layer:
      // the Billing Core plan gate runs before route handlers, and a
      // gated plan would 403 before scoping ever runs (which also
      // blocks the action, but is not what this suite measures).
      // Plan gating itself is covered by plan-guard tests.
      findUnique: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve({ id: where.id, plan: 'complete', ownerId: 'user-admin' });
      }),
      update: vi.fn().mockResolvedValue({ id: 'ws-tenant-a', plan: 'scale' }),
    },
    workspaceMember: {
      findFirst: vi.fn().mockResolvedValue({ role: 'admin' }),
    },
  },
}));

vi.mock('stripe', () => ({
  default: class MockStripe {
    checkout = {
      sessions: {
        retrieve: vi.fn().mockImplementation((sessionId: string) => {
          if (sessionId === 'cs_tenant_b') {
            return Promise.resolve({
              id: 'cs_tenant_b',
              status: 'complete',
              payment_status: 'paid',
              metadata: { workspaceId: 'ws-tenant-b', planId: 'scale' },
            });
          }
          return Promise.resolve({
            id: sessionId,
            status: 'complete',
            payment_status: 'paid',
            metadata: { workspaceId: 'ws-tenant-a', planId: 'scale' },
          });
        }),
      },
    };
  },
}));

function createMultiTenantApp() {
  const app = express();
  app.use(express.json());

  // Workspace context resolution simulation
  app.use((req, res, next) => {
    const wsHeader = req.headers['x-workspace-id'] as string;
    (req as any).workspaceId = wsHeader || 'ws-tenant-a';
    (req as any).userId = 'user-test';
    (req as any).userRole = 'admin';
    next();
  });

  app.use('/api/workflows', workflowsRouter);
  app.use('/api/crm', crmRouter);
  app.use('/api/opportunities', opportunitiesRouter);
  app.use('/api', billingRouter);
  app.use(errorHandler);
  return app;
}

describe('Multi-Tenant Cross-Workspace Strict Isolation (P0 Suite)', () => {
  const app = createMultiTenantApp();

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  });

  describe('Workflows Isolation', () => {
    it('Tenant A cannot clone Tenant B workflow template (returns 404)', async () => {
      const res = await request(app)
        .post('/api/workflows/from-template/wf-b-1')
        .set('x-workspace-id', 'ws-tenant-a');

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Template not found');
    });

    it('Tenant A cannot view Tenant B workflow definition (returns 404)', async () => {
      const res = await request(app)
        .get('/api/workflows/wf-b-1/definition')
        .set('x-workspace-id', 'ws-tenant-a');

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Resource not found');
    });

    it('Tenant A cannot execute test on Tenant B workflow (returns 404)', async () => {
      const res = await request(app)
        .post('/api/workflows/wf-b-1/test-native')
        .set('x-workspace-id', 'ws-tenant-a')
        .send({ triggerData: {} });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Resource not found');
    });
  });

  describe('CRM Pipelines & Stages Isolation', () => {
    it('Tenant A cannot add a stage to Tenant B pipeline (returns 404)', async () => {
      const res = await request(app)
        .post('/api/crm/pipelines/pipe-b-1/stages')
        .set('x-workspace-id', 'ws-tenant-a')
        .send({ name: 'Hacked Stage' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Resource not found');
    });

    it('Tenant A cannot modify Tenant B pipeline stage (returns 404)', async () => {
      const res = await request(app)
        .put('/api/crm/pipelines/pipe-b-1/stages/stage-b-1')
        .set('x-workspace-id', 'ws-tenant-a')
        .send({ name: 'Tampered Stage Name' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Pipeline stage not found');
    });

    it('Tenant A cannot delete Tenant B pipeline stage (returns 404)', async () => {
      const res = await request(app)
        .delete('/api/crm/pipelines/pipe-b-1/stages/stage-b-1')
        .set('x-workspace-id', 'ws-tenant-a');

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Pipeline stage not found');
      // Stage B must remain untouched in store
      expect(fixtures.pipelineStages['stage-b-1']).toBeDefined();
    });
  });

  describe('Opportunities Stages Isolation', () => {
    it('Tenant A cannot update Tenant B stage via Opportunities API (returns 404)', async () => {
      const res = await request(app)
        .put('/api/opportunities/stages/stage-b-1')
        .set('x-workspace-id', 'ws-tenant-a')
        .send({ name: 'Compromised Stage' });

      expect(res.status).toBe(404);
    });

    it('Tenant A cannot delete Tenant B stage via Opportunities API (returns 404)', async () => {
      const res = await request(app)
        .delete('/api/opportunities/stages/stage-b-1')
        .set('x-workspace-id', 'ws-tenant-a');

      expect(res.status).toBe(404);
      expect(fixtures.pipelineStages['stage-b-1']).toBeDefined();
    });
  });

  describe('Billing Checkout Session Hijack Prevention', () => {
    it('Tenant A cannot hijack Tenant B Stripe checkout session (returns 403)', async () => {
      const res = await request(app)
        .post('/api/billing/verify-session')
        .set('x-workspace-id', 'ws-tenant-a')
        .send({ sessionId: 'cs_tenant_b' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden: Checkout session belongs to a different workspace');
    });
  });
});
