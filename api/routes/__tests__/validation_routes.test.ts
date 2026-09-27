import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import onboardingRouter from '../onboarding.routes.js';
import billingRouter from '../billing.routes.js';
import { errorHandler } from '../../middleware/error.js';

vi.mock('../../../infrastructure/database/client.js', () => ({
  db: {
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: 'user-1', clerkId: 'test_user_new' }),
      create: vi.fn().mockResolvedValue({ id: 'user-1', clerkId: 'test_user_new' }),
    },
    userOnboardingProgress: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({
        id: 'prog-1',
        userId: 'user-1',
        tourKey: 'crm',
        status: 'in_progress',
        stepIndex: 1,
        completedAt: null,
      }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    workspace: {
      findUnique: vi.fn().mockResolvedValue({ id: 'ws-1', plan: 'free' }),
      findFirst: vi.fn().mockResolvedValue({ id: 'ws-1', plan: 'free' }),
      update: vi.fn().mockResolvedValue({ id: 'ws-1', plan: 'pro' }),
    },
    deal: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    processedWebhookEvent: {
      create: vi.fn().mockResolvedValue({ id: 'pwe-1' }),
    },
  },
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', onboardingRouter);
  app.use('/api', billingRouter);
  app.use(errorHandler);
  return app;
}

describe('API Input Validation (P1.1)', () => {
  const app = createApp();

  it('rejects invalid status enum on PUT /api/onboarding/progress/:tourKey', async () => {
    const res = await request(app)
      .put('/api/onboarding/progress/crm')
      .send({ status: 'INVALID_STATUS', stepIndex: 2 });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Validation failed');
  });

  it('accepts valid status and stepIndex on PUT /api/onboarding/progress/:tourKey', async () => {
    const res = await request(app)
      .put('/api/onboarding/progress/crm')
      .send({ status: 'completed', stepIndex: 4 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects missing amount on POST /api/stripe/create-payment-intent', async () => {
    const res = await request(app)
      .post('/api/stripe/create-payment-intent')
      .send({ dealId: 'deal-123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Validation failed');
  });

  it('rejects non-positive amount on POST /api/stripe/create-payment-intent', async () => {
    const res = await request(app)
      .post('/api/stripe/create-payment-intent')
      .send({ amount: -50, dealId: 'deal-123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Validation failed');
  });
});
