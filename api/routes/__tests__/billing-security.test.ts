import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import billingRouter from '../billing.routes.js';

const mockWorkspaceUpdate = vi.fn().mockResolvedValue({
  id: 'ws-test',
  plan: 'pro',
  creditsLimit: 25000,
  subscriptionStatus: 'active',
});

const mockWorkspaceFindUnique = vi.fn().mockResolvedValue({
  id: 'ws-test',
  name: 'Test Workspace',
  plan: 'free',
  stripeCustomerId: null,
});

const mockSessionRetrieve = vi.fn();

const mockMemberFindFirst = vi.fn().mockResolvedValue({ role: 'admin' });

vi.mock('../../../infrastructure/database/client.js', () => ({
  db: {
    workspace: {
      findUnique: (...args: any[]) => mockWorkspaceFindUnique(...args),
      findFirst: (...args: any[]) => mockWorkspaceFindUnique(...args),
      update: (...args: any[]) => mockWorkspaceUpdate(...args),
    },
    workspaceMember: {
      findFirst: (...args: any[]) => mockMemberFindFirst(...args),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      checkout = {
        sessions: {
          retrieve: (...args: any[]) => mockSessionRetrieve(...args),
        },
      };
    },
  };
});

function createApp(workspaceId: string = 'ws-test', userRole: string = 'admin') {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    (req as any).workspaceId = workspaceId;
    (req as any).userId = 'user-admin';
    (req as any).userRole = userRole;
    next();
  });
  app.use('/api', billingRouter);
  return app;
}

describe('Billing Security & Plan Guardrails (C2 & C7)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Dev Plan Switcher (/billing/dev-set-plan) (C2)', () => {
    it('is strictly forbidden in production mode', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_DEV_BILLING_BYPASS = 'true';
      const app = createApp();

      const res = await request(app)
        .post('/api/billing/dev-set-plan')
        .send({ planId: 'scale' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden');
      expect(mockWorkspaceUpdate).not.toHaveBeenCalled();
    });

    it('is forbidden in development mode when ENABLE_DEV_BILLING_BYPASS is not set', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.ENABLE_DEV_BILLING_BYPASS;
      const app = createApp();

      const res = await request(app)
        .post('/api/billing/dev-set-plan')
        .send({ planId: 'scale' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden');
      expect(mockWorkspaceUpdate).not.toHaveBeenCalled();
    });

    it('allows plan switching in development mode when ENABLE_DEV_BILLING_BYPASS === "true"', async () => {
      process.env.NODE_ENV = 'development';
      process.env.ENABLE_DEV_BILLING_BYPASS = 'true';
      const app = createApp();

      const res = await request(app)
        .post('/api/billing/dev-set-plan')
        .send({ planId: 'scale' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.plan).toBe('scale');
      expect(mockWorkspaceUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ws-test' },
          data: expect.objectContaining({ plan: 'scale' }),
        })
      );
    });
  });

  describe('Stripe Checkout Session Hijack Prevention (/billing/verify-session) (C7)', () => {
    it('rejects verification if checkout session belongs to another workspace', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_123';
      mockSessionRetrieve.mockResolvedValue({
        id: 'cs_foreign_session',
        status: 'complete',
        payment_status: 'paid',
        metadata: {
          workspaceId: 'ws-foreign',
          planId: 'scale',
        },
      });

      const app = createApp('ws-victim');

      const res = await request(app)
        .post('/api/billing/verify-session')
        .send({ sessionId: 'cs_foreign_session' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden: Checkout session belongs to a different workspace');
      expect(mockWorkspaceUpdate).not.toHaveBeenCalled();
    });

    it('successfully updates plan when session belongs to authenticated workspace', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_123';
      mockSessionRetrieve.mockResolvedValue({
        id: 'cs_valid_session',
        status: 'complete',
        payment_status: 'paid',
        customer: 'cus_123',
        subscription: 'sub_123',
        metadata: {
          workspaceId: 'ws-test',
          planId: 'scale',
        },
      });

      const app = createApp('ws-test');

      const res = await request(app)
        .post('/api/billing/verify-session')
        .send({ sessionId: 'cs_valid_session' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.plan).toBe('scale');
      expect(mockWorkspaceUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ws-test' },
          data: expect.objectContaining({
            plan: 'scale',
            stripeCustomerId: 'cus_123',
            stripeSubscriptionId: 'sub_123',
          }),
        })
      );
    });

    it('rejects member without admin or owner role from managing billing plans', async () => {
      process.env.NODE_ENV = 'development';
      process.env.ENABLE_DEV_BILLING_BYPASS = 'true';
      const app = createApp('ws-test', 'member');

      const res = await request(app)
        .post('/api/billing/dev-set-plan')
        .send({ planId: 'scale' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden — insufficient permissions');
      expect(mockWorkspaceUpdate).not.toHaveBeenCalled();
    });
  });
});
