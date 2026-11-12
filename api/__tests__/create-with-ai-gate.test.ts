/**
 * Create-with-AI Complete-plan gate — Tier 1 Fix 4.
 * confirmSend / confirmSequenceSend / testSendEmail created SCHEDULED
 * campaigns (or sent test emails) for any plan, while the real send path
 * (campaigns.service sendCampaign) requires Complete — so a below-Complete
 * workspace got a success response for a campaign that would silently
 * never send. All three entry points now assert the Complete plan first,
 * before any row is created or any send happens.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const planGuard = vi.hoisted(() => ({ plan: 'free' as string }));
// NOTE: the service imports plan-guard dynamically, and that dynamic import
// is not reliably intercepted by vi.mock — so the tests drive the REAL
// assertPlan and control its answer through the mocked workspace plan.
// That exercises the real gate (meetsPlan) instead of a stub.
const dbState = vi.hoisted(() => ({
  workspaceFindUnique: vi.fn(async () => ({ plan: planGuard.plan })),
  campaignFindFirst: vi.fn(async () => null),
  campaignCreate: vi.fn(async () => ({})),
  campaignEmailFindFirst: vi.fn(async () => null),
  campaignEmailFindMany: vi.fn(async () => []),
  campaignDraftFindFirst: vi.fn(async () => null),
}));
vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    workspace: { findUnique: dbState.workspaceFindUnique },
    campaign: { findFirst: dbState.campaignFindFirst, create: dbState.campaignCreate },
    campaignEmail: { findFirst: dbState.campaignEmailFindFirst, findMany: dbState.campaignEmailFindMany },
    campaignDraft: { findFirst: dbState.campaignDraftFindFirst },
  },
}));

import {
  confirmSend,
  confirmSequenceSend,
  testSendEmail,
} from '../services/email-marketing/send-orchestration.service.js';

const input = {
  idempotencyKey: 'key-1',
  campaignName: 'Test campaign',
  sendNow: true,
  sendAt: null,
  coldAck: false,
};

describe('Create-with-AI plan gate (Tier 1 Fix 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    planGuard.plan = 'free';
  });

  it('confirmSend on a below-Complete workspace is refused before any DB read or write', async () => {
    await expect(confirmSend('ws_test', 'email_1', input)).rejects.toThrow(/PLAN_REQUIRED/);
    expect(dbState.campaignFindFirst).not.toHaveBeenCalled();
    expect(dbState.campaignCreate).not.toHaveBeenCalled();
  });

  it('confirmSequenceSend on a below-Complete workspace is refused before any DB read or write', async () => {
    await expect(confirmSequenceSend('ws_test', 'draft_1', input)).rejects.toThrow(/PLAN_REQUIRED/);
    expect(dbState.campaignFindFirst).not.toHaveBeenCalled();
  });

  it('testSendEmail on a below-Complete workspace is refused before any send', async () => {
    await expect(testSendEmail('ws_test', 'email_1', ['owner@example.com'])).rejects.toThrow(/PLAN_REQUIRED/);
    expect(dbState.campaignEmailFindFirst).not.toHaveBeenCalled();
  });

  it('confirmSend on a Complete workspace passes the gate and reaches validation', async () => {
    planGuard.plan = 'complete';
    await expect(confirmSend('ws_test', 'email_1', { ...input, idempotencyKey: '' })).rejects.toThrow(
      /idempotency key/i,
    );
  });

  it('testSendEmail on a Complete workspace passes the gate and reaches the email lookup', async () => {
    planGuard.plan = 'complete';
    await expect(testSendEmail('ws_test', 'email_1', ['owner@example.com'])).rejects.toThrow(/not found/i);
    expect(dbState.campaignEmailFindFirst).toHaveBeenCalled();
  });
});
