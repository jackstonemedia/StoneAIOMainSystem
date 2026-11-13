/**
 * Bulk email / SMS — Tier 2 Fix 6.
 * The Contacts bulk toolbar used to toast "Drafting email/SMS to N
 * contacts" and do nothing. Bulk email must now create a REAL campaign
 * draft with the selected contacts as recipients (Complete-gated, like
 * every other campaign creation); bulk SMS must send through the real
 * Twilio path, failing honestly with zero rows created when no Twilio
 * connection exists, and reporting per-contact sent/failed/skipped
 * counts instead of a success toast for messages that never left.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

process.env.CHANNEL_ENCRYPTION_KEY = 'ab'.repeat(32);

const state = vi.hoisted(() => ({
  contacts: [
    { id: 'ct_alice', workspaceId: 'ws_test', email: 'alice@acmecorp.com', phone: '+15551234567' },
    { id: 'ct_bob', workspaceId: 'ws_test', email: 'bob@example.com', phone: null },
    { id: 'ct_noemail', workspaceId: 'ws_test', email: null, phone: '+15559876543' },
  ] as any[],
  workspace: { plan: 'complete', subscriptionStatus: 'active' } as any,
  twilioConn: null as any,
  campaigns: [] as any[],
  recipients: [] as any[],
  conversations: [] as any[],
  messages: [] as any[],
  messageUpdates: [] as any[],
  conversationUpdates: [] as any[],
}));

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    workspace: {
      findUnique: vi.fn(async () => state.workspace),
    },
    contact: {
      findMany: vi.fn(async ({ where }: any) =>
        state.contacts.filter((c) => where.id.in.includes(c.id) && c.workspaceId === where.workspaceId),
      ),
    },
    campaign: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `camp_${state.campaigns.length + 1}`, ...data, status: 'DRAFT' };
        state.campaigns.push(row);
        return row;
      }),
    },
    campaignRecipient: {
      createMany: vi.fn(async ({ data }: any) => {
        state.recipients.push(...data);
        return { count: data.length };
      }),
    },
    channelConnection: {
      findFirst: vi.fn(async () => state.twilioConn),
    },
    conversation: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `conv_${state.conversations.length + 1}`, ...data };
        state.conversations.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        const conv = state.conversations.find((c) => c.id === where.id);
        if (!conv) return null;
        return { ...conv, contact: state.contacts.find((c) => c.id === conv.contactId) ?? null };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        state.conversationUpdates.push({ where, data });
        return null;
      }),
    },
    conversationMessage: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `msg_${state.messages.length + 1}`, ...data, status: 'sent' };
        state.messages.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        state.messageUpdates.push({ where, data });
        const m = state.messages.find((x) => x.id === where.id);
        if (m) Object.assign(m, data);
        return {};
      }),
    },
  },
}));

const twilioMock = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('twilio', () => ({
  default: vi.fn(() => ({ messages: { create: twilioMock.create } })),
}));

import { encryptJson } from '../services/channels/encryption.js';
import router from '../routes/crm.routes.js';

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.workspaceId = 'ws_test';
  req.userId = 'user_test';
  next();
});
app.use('/api/crm', router);

describe('POST /api/crm/bulk-email (Tier 2 Fix 6)', () => {
  beforeEach(() => {
    state.workspace = { plan: 'complete', subscriptionStatus: 'active' };
    state.campaigns = [];
    state.recipients = [];
  });

  it('creates a draft campaign with the selected contacts as recipients', async () => {
    const res = await request(app)
      .post('/api/crm/bulk-email')
      .send({ contactIds: ['ct_alice', 'ct_bob', 'ct_noemail'] });
    expect(res.status).toBe(201);
    expect(res.body.campaignId).toBeTruthy();
    expect(res.body.recipientCount).toBe(2);
    expect(res.body.skippedNoEmail).toBe(1);
    expect(state.campaigns).toHaveLength(1);
    expect(state.campaigns[0].status).toBe('DRAFT');
    expect(state.recipients.map((r: any) => r.contactId).sort()).toEqual(['ct_alice', 'ct_bob']);
    expect(state.recipients.every((r: any) => r.campaignId === res.body.campaignId)).toBe(true);
  });

  it('400s when none of the selected contacts have an email address', async () => {
    const res = await request(app)
      .post('/api/crm/bulk-email')
      .send({ contactIds: ['ct_noemail'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/have an email address/i);
    expect(state.campaigns).toHaveLength(0);
  });

  it('400s on an empty selection', async () => {
    const res = await request(app).post('/api/crm/bulk-email').send({ contactIds: [] });
    expect(res.status).toBe(400);
    expect(state.campaigns).toHaveLength(0);
  });

  it('403s with PLAN_REQUIRED on a below-Complete workspace and creates nothing', async () => {
    state.workspace = { plan: 'pro', subscriptionStatus: 'active' };
    const res = await request(app)
      .post('/api/crm/bulk-email')
      .send({ contactIds: ['ct_alice'] });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLAN_REQUIRED');
    expect(state.campaigns).toHaveLength(0);
    expect(state.recipients).toHaveLength(0);
  });
});

describe('POST /api/crm/bulk-sms (Tier 2 Fix 6)', () => {
  beforeEach(() => {
    state.twilioConn = null;
    state.conversations = [];
    state.messages = [];
    state.messageUpdates = [];
    state.conversationUpdates = [];
    twilioMock.create.mockReset();
  });

  const withTwilio = () => {
    state.twilioConn = {
      id: 'cc_twilio',
      provider: 'twilio',
      isActive: true,
      twilioPhoneNumber: '+15550001111',
      credentialsJson: encryptJson({ accountSid: 'AC_test', authToken: 'tok_test' }),
    };
  };

  it('fails honestly with zero rows created when no Twilio connection exists', async () => {
    const res = await request(app)
      .post('/api/crm/bulk-sms')
      .send({ contactIds: ['ct_alice', 'ct_bob'], message: 'Hello' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No active Twilio/);
    expect(state.conversations).toHaveLength(0);
    expect(state.messages).toHaveLength(0);
  });

  it('sends to contacts with a phone, skips contacts without one', async () => {
    withTwilio();
    twilioMock.create.mockResolvedValue({ sid: 'SM_test' });
    const res = await request(app)
      .post('/api/crm/bulk-sms')
      .send({ contactIds: ['ct_alice', 'ct_bob', 'ct_noemail'], message: 'Hi there' });
    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(2);
    expect(res.body.skipped).toBe(1);
    expect(res.body.failed).toBe(0);
    expect(twilioMock.create).toHaveBeenCalledTimes(2);
    expect(twilioMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Hi there', from: '+15550001111', to: '+15551234567' }),
    );
    expect(twilioMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Hi there', to: '+15559876543' }),
    );
    // Both sent rows are marked delivered, never left as the 'sent' default.
    expect(state.messageUpdates.filter((u: any) => u.data.status === 'delivered')).toHaveLength(2);
  });

  it('counts a Twilio failure per contact and marks that message failed', async () => {
    withTwilio();
    twilioMock.create.mockRejectedValueOnce(new Error('Twilio 21211: invalid number'));
    twilioMock.create.mockResolvedValue({ sid: 'SM_test2' });
    const res = await request(app)
      .post('/api/crm/bulk-sms')
      .send({ contactIds: ['ct_alice', 'ct_noemail'], message: 'Hi there' });
    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(1);
    expect(res.body.failed).toBe(1);
    const failed = res.body.results.find((r: any) => r.status === 'failed');
    expect(failed.error).toMatch(/Twilio 21211/);
    expect(state.messageUpdates).toContainEqual(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    );
  });

  it('400s on an empty message', async () => {
    withTwilio();
    const res = await request(app)
      .post('/api/crm/bulk-sms')
      .send({ contactIds: ['ct_alice'], message: '   ' });
    expect(res.status).toBe(400);
    expect(state.conversations).toHaveLength(0);
  });
});
