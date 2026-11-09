/**
 * Stripe webhook — POST /api/webhooks/stripe + /api/stripe/webhook.
 * Covers the 2026-11-07 fix (agent/webhook-raw-body-fix): the global
 * express.json() runs before the webhook mounts, so the route-level
 * express.raw() was a no-op and stripe.webhooks.constructEvent received
 * the already-parsed object — every production event threw
 * "Webhook payload must be provided as a string or a Buffer" and the
 * handler returned 400. The raw bytes are now captured before json()
 * (server.ts pre-json middleware) and the handler verifies req.rawBody.
 * The regression case below (parsed-object body, no rawBody) pins that
 * the trap can never silently return.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { stripeWebhookHandler } from '../routes/billing.routes.js';

vi.mock('../../infrastructure/database/idempotency.js', () => ({
  claimWebhookEvent: vi.fn().mockResolvedValue(true),
}));

const WEBHOOK_SECRET = 'whsec_testsecret1234567890';
const OLD_ENV = { ...process.env };

function signPayload(payload: string, secret: string): string {
  const ts = Math.floor(Date.now() / 1000);
  const signed = `${ts}.${payload}`;
  const v1 = crypto.createHmac('sha256', secret).update(signed).digest('hex');
  return `t=${ts},v1=${v1}`;
}

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.send = vi.fn((body?: any) => {
    res.body = body;
    return res;
  });
  res.json = vi.fn((body?: any) => {
    res.body = body;
    return res;
  });
  return res;
}

function eventPayload(type = 'customer.created'): string {
  return JSON.stringify({
    id: `evt_test_${type}`,
    type,
    data: { object: { id: 'cus_test', object: 'customer' } },
  });
}

describe('stripeWebhookHandler signature verification', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
    vi.clearAllMocks();
  });

  it('valid signature over the raw body is processed (unhandled type -> 200 received)', async () => {
    const payload = eventPayload();
    const req: any = {
      headers: { 'stripe-signature': signPayload(payload, WEBHOOK_SECRET) },
      body: JSON.parse(payload),
      rawBody: Buffer.from(payload, 'utf8'),
    };
    const res = mockRes();
    await stripeWebhookHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  it('tampered signature -> 400, nothing processed', async () => {
    const payload = eventPayload();
    const req: any = {
      headers: { 'stripe-signature': signPayload(payload, 'whsec_wrongsecret0000') },
      body: JSON.parse(payload),
      rawBody: Buffer.from(payload, 'utf8'),
    };
    const res = mockRes();
    await stripeWebhookHandler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('missing signature in production -> 400', async () => {
    const payload = eventPayload();
    const req: any = {
      headers: {},
      body: JSON.parse(payload),
      rawBody: Buffer.from(payload, 'utf8'),
    };
    const res = mockRes();
    await stripeWebhookHandler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('parsed-object body with no rawBody -> 400 (regression: the raw-body trap)', async () => {
    const payload = eventPayload();
    const req: any = {
      headers: { 'stripe-signature': signPayload(payload, WEBHOOK_SECRET) },
      body: JSON.parse(payload),
      // no rawBody — this is what the handler received before the fix
    };
    const res = mockRes();
    await stripeWebhookHandler(req, res);
    expect(res.statusCode).toBe(400);
    expect(String(res.body)).toContain('parsed JavaScript object');
  });

  it('missing webhook secret in production -> 400', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const payload = eventPayload();
    const req: any = {
      headers: { 'stripe-signature': signPayload(payload, WEBHOOK_SECRET) },
      body: JSON.parse(payload),
      rawBody: Buffer.from(payload, 'utf8'),
    };
    const res = mockRes();
    await stripeWebhookHandler(req, res);
    expect(res.statusCode).toBe(400);
  });
});
