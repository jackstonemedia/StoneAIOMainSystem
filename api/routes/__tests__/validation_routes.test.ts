import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import billingRouter from '../billing.routes.js';
import { errorHandler } from '../../middleware/error.js';

vi.mock('../../../infrastructure/database/client.js', () => ({
  db: {
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: 'user-1', clerkId: 'test_user_new' }),
      create: vi.fn().mockResolvedValue({ id: 'user-1', clerkId: 'test_user_new' }),
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
  app.use('/api', billingRouter);
  app.use(errorHandler);
  return app;
}

describe('API Input Validation (P1.1)', () => {
  const app = createApp();

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
