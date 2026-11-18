/**
 * Tier 2 fix 3 — trial / past-due billing gap.
 *
 * The holes (verified 2026-11-11):
 * - No handler for `customer.subscription.trial_will_end`, and
 *   `invoice.payment_failed` never stored the past-due status, so a
 *   trial-expired or past-due workspace kept its paid plan until Stripe
 *   sent `subscription.deleted`.
 * - `requirePlan` / `assertPlan` checked `plan` only, never
 *   `subscriptionStatus` — paid features stayed open on a dead
 *   subscription.
 * - `checkout.session.completed` fell back to `'plus'` when
 *   `metadata.planId` was missing — a configuration error granting a
 *   paid plan.
 *
 * The fixes: past-due is stored on both the invoice and subscription
 * events; trial_will_end records (trigger) + notifies (owner email via
 * the workspace Gmail connection) without touching the plan; the plan
 * gates treat past_due / incomplete_expired / unpaid as Free; checkout
 * without a valid plan id grants nothing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { stripeWebhookHandler } from '../routes/billing.routes.js';
import { requirePlan, assertPlan } from '../middleware/plan-guard.js';
import { PLAN_CONFIGS } from '../services/billing/plans.js';

const { mockGetUser, mockSendGmail, fakeDb } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockSendGmail: vi.fn(),
  fakeDb: {
    workspace: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    channelConnection: { findFirst: vi.fn() },
    crmTriggerSubscription: { findMany: vi.fn() },
  },
}));

vi.mock('../../infrastructure/database/idempotency.js', () => ({
  claimWebhookEvent: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../infrastructure/database/client.js', () => ({ db: fakeDb }));
vi.mock('@clerk/express', () => ({
  clerkClient: { users: { getUser: mockGetUser } },
}));
vi.mock('../services/channels/gmail.service.js', () => ({
  sendGmailMessage: mockSendGmail,
}));

const WEBHOOK_SECRET = 'whsec_testsecret1234567890';
const OLD_ENV = { ...process.env };

const WORKSPACE_ROW = {
  id: 'ws_1',
  ownerId: 'user_owner_1',
  name: 'Test Workspace',
  plan: 'plus',
  subscriptionStatus: 'active',
  trialEndsAt: new Date('2026-11-19T00:00:00.000Z'),
};

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

function signedEventReq(type: string, object: Record<string, unknown>) {
  const payload = JSON.stringify({ id: `evt_test_${type}_${Date.now()}`, type, data: { object } });
  return {
    headers: { 'stripe-signature': signPayload(payload, WEBHOOK_SECRET) },
    body: JSON.parse(payload),
    rawBody: Buffer.from(payload, 'utf8'),
  } as any;
}

describe('Tier 2 fix 3 — trial / past-due billing gap', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.NODE_ENV = 'production';
    vi.clearAllMocks();
    fakeDb.workspace.findFirst.mockResolvedValue({ ...WORKSPACE_ROW });
    fakeDb.workspace.findUnique.mockResolvedValue({ plan: 'plus', subscriptionStatus: 'active' });
    fakeDb.workspace.update.mockResolvedValue({ ...WORKSPACE_ROW });
    fakeDb.channelConnection.findFirst.mockResolvedValue({ id: 'conn_gmail_1', email: 'owner@example.com' });
    fakeDb.crmTriggerSubscription.findMany.mockResolvedValue([]);
    mockGetUser.mockResolvedValue({
      primaryEmailAddressId: 'email_1',
      emailAddresses: [{ id: 'email_1', emailAddress: 'owner@example.com' }],
    });
    mockSendGmail.mockResolvedValue({ messageId: 'msg_1', threadId: 'thread_1' });
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  it('subscription.updated past_due → stored status past-due, and the paid gate then denies', async () => {
    const req = signedEventReq('customer.subscription.updated', {
      id: 'sub_1',
      object: 'subscription',
      customer: 'cus_1',
      status: 'past_due',
      metadata: {},
      trial_end: null,
    });
    const res = mockRes();
    await stripeWebhookHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(fakeDb.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ws_1' },
        data: expect.objectContaining({ subscriptionStatus: 'past_due' }),
      }),
    );

    // The gate now sees the past-due workspace as Free.
    fakeDb.workspace.findUnique.mockResolvedValue({ plan: 'plus', subscriptionStatus: 'past_due' });
    const gateRes = mockRes();
    const next = vi.fn();
    await requirePlan('basic')({ workspaceId: 'ws_1' } as any, gateRes, next);
    expect(next).not.toHaveBeenCalled();
    expect(gateRes.statusCode).toBe(403);
    expect(gateRes.body.code).toBe('PLAN_REQUIRED');
    expect(gateRes.body.currentPlan).toBe('free');
    expect(gateRes.body.subscriptionStatus).toBe('past_due');
    expect(String(gateRes.body.error)).toContain('past due');

    await expect(assertPlan('ws_1', 'basic')).rejects.toThrow('PLAN_REQUIRED');
  });

  it('invoice.payment_failed → stored status past-due', async () => {
    const req = signedEventReq('invoice.payment_failed', {
      id: 'in_1',
      object: 'invoice',
      customer: 'cus_1',
      amount_due: 1900,
      metadata: {},
    });
    const res = mockRes();
    await stripeWebhookHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(fakeDb.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ws_1' },
        data: expect.objectContaining({ subscriptionStatus: 'past_due' }),
      }),
    );
  });

  it('trial_will_end → no plan change, owner emailed via the workspace Gmail connection', async () => {
    const req = signedEventReq('customer.subscription.trial_will_end', {
      id: 'sub_1',
      object: 'subscription',
      customer: 'cus_1',
      status: 'trialing',
      trial_end: 1794567890,
    });
    const res = mockRes();
    await stripeWebhookHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true });
    // Nothing about the plan or the stored status was written.
    expect(fakeDb.workspace.update).not.toHaveBeenCalled();
    expect(mockSendGmail).toHaveBeenCalledTimes(1);
    const [connId, to, subject, body] = mockSendGmail.mock.calls[0];
    expect(connId).toBe('conn_gmail_1');
    expect(to).toBe('owner@example.com');
    expect(subject).toContain('trial');
    expect(body).toContain('Test Workspace');
  });

  it('trial_will_end with no Gmail connected → 200, no email, still no plan change', async () => {
    fakeDb.channelConnection.findFirst.mockResolvedValue(null);
    const req = signedEventReq('customer.subscription.trial_will_end', {
      id: 'sub_1',
      object: 'subscription',
      customer: 'cus_1',
      status: 'trialing',
      trial_end: 1794567890,
    });
    const res = mockRes();
    await stripeWebhookHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(mockSendGmail).not.toHaveBeenCalled();
    expect(fakeDb.workspace.update).not.toHaveBeenCalled();
  });

  it('checkout.session.completed without metadata.planId → no Plus grant, plan untouched', async () => {
    const req = signedEventReq('checkout.session.completed', {
      id: 'cs_test',
      object: 'checkout.session',
      client_reference_id: 'ws_1',
      customer: 'cus_1',
      metadata: {},
    });
    const res = mockRes();
    await stripeWebhookHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(fakeDb.workspace.update).toHaveBeenCalledTimes(1);
    const updateData = fakeDb.workspace.update.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty('plan');
    expect(updateData).not.toHaveProperty('creditsLimit');
    expect(updateData.stripeCustomerId).toBe('cus_1');
  });

  it('checkout.session.completed with a valid planId still grants the plan (regression)', async () => {
    const req = signedEventReq('checkout.session.completed', {
      id: 'cs_test',
      object: 'checkout.session',
      client_reference_id: 'ws_1',
      customer: 'cus_1',
      metadata: { planId: 'plus' },
    });
    const res = mockRes();
    await stripeWebhookHandler(req, res);
    expect(res.statusCode).toBe(200);
    const updateData = fakeDb.workspace.update.mock.calls[0][0].data;
    expect(updateData.plan).toBe('plus');
    expect(updateData.creditsLimit).toBe(PLAN_CONFIGS.plus.creditsLimit);
    // No subscription was retrieved, so no status is invented.
    expect(updateData).not.toHaveProperty('subscriptionStatus');
  });

  it('requirePlan lets a paid, active workspace through', async () => {
    fakeDb.workspace.findUnique.mockResolvedValue({ plan: 'plus', subscriptionStatus: 'active' });
    const gateRes = mockRes();
    const next = vi.fn();
    await requirePlan('basic')({ workspaceId: 'ws_1' } as any, gateRes, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(gateRes.statusCode).toBe(200);
  });

  it('requirePlan denies an unpaid workspace as Free', async () => {
    fakeDb.workspace.findUnique.mockResolvedValue({ plan: 'complete', subscriptionStatus: 'unpaid' });
    const gateRes = mockRes();
    const next = vi.fn();
    await requirePlan('basic')({ workspaceId: 'ws_1' } as any, gateRes, next);
    expect(next).not.toHaveBeenCalled();
    expect(gateRes.statusCode).toBe(403);
    expect(gateRes.body.code).toBe('PLAN_REQUIRED');
    expect(gateRes.body.currentPlan).toBe('free');
  });

  it('assertPlan passes for an active paid workspace', async () => {
    fakeDb.workspace.findUnique.mockResolvedValue({ plan: 'plus', subscriptionStatus: 'active' });
    await expect(assertPlan('ws_1', 'basic')).resolves.toBeUndefined();
  });
});
