// Billing Core — webhook production security unit test: an unsigned
// webhook in production must be rejected, never processed unverified.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../infrastructure/database/client.js', () => {
  return { db: {} };
});
vi.mock('../../services/trigger-emitter.service.js', () => {
  return { emitTrigger: vi.fn() };
});
vi.mock('../../../infrastructure/database/idempotency.js', () => {
  return { claimWebhookEvent: vi.fn(async () => true) };
});

import { stripeWebhookHandler } from '../billing.routes.js';

function mockRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.send = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('stripe webhook production security', () => {
  const prevEnv: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ['NODE_ENV', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']) {
      prevEnv[k] = process.env[k];
    }
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
  });
  afterEach(() => {
    for (const k of Object.keys(prevEnv)) {
      if (prevEnv[k] === undefined) delete process.env[k];
      else process.env[k] = prevEnv[k];
    }
  });

  it('rejects an unsigned webhook in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_dummy';
    const req: any = { headers: {}, body: Buffer.from('{}') };
    const res = mockRes();
    await stripeWebhookHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects when production has no webhook secret at all', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const req: any = { headers: {}, body: Buffer.from('{}') };
    const res = mockRes();
    await stripeWebhookHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
