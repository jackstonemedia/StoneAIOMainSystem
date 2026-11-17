/**
 * Campaign audience resolution — Tier 2 follow-ups (Fix A).
 *
 * The editor's count and the send must agree on a draft's real recipients.
 * A bulk-email draft has direct CampaignRecipient rows and no list /
 * segment / smartList audience: the send used to resolve those drafts to
 * ALL workspace contacts (the all-contacts fallback) and row the selected
 * contacts twice. `resolveCampaignRecipientContactIds` makes direct rows
 * win when no audience is set; `sendCampaign` captures the resolution
 * before the SENT-clear and rebuilds the recipient rows from the resolved
 * list, so no contact is ever sent to twice.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.CHANNEL_ENCRYPTION_KEY = 'ab'.repeat(32);

const state = vi.hoisted(() => ({
  workspace: { id: 'ws_test', name: 'Test Co', plan: 'complete', subscriptionStatus: 'active', trialEndsAt: null } as any,
  contacts: [
    { id: 'ct_alice', workspaceId: 'ws_test', email: 'alice@acmecorp.com' },
    { id: 'ct_bob', workspaceId: 'ws_test', email: 'bob@example.com' },
    { id: 'ct_carol', workspaceId: 'ws_test', email: 'carol@example.com' },
    { id: 'ct_dan', workspaceId: 'ws_test', email: 'dan@example.com' },
    { id: 'ct_noemail', workspaceId: 'ws_test', email: null },
  ] as any[],
  campaigns: [] as any[],
  recipients: [] as any[],
  segments: [{ id: 'seg_1', workspaceId: 'ws_test', filterDefinition: {} }] as any[],
  campaignUpdates: [] as any[],
  sentJobs: [] as any[],
  smartListContacts: [{ id: 'ct_carol', email: 'carol@example.com' }] as any[],
  segmentContactIds: ['ct_dan'] as string[],
  sendJob: vi.fn(async (job: any) => {
    state.sentJobs.push(job);
    return { ok: true };
  }),
  getSmartListContacts: vi.fn(async () => ({ contacts: state.smartListContacts })),
  evaluateSegment: vi.fn(async () => state.segmentContactIds),
}));

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    workspace: {
      findUnique: vi.fn(async () => state.workspace),
      findFirst: vi.fn(async () => state.workspace),
    },
    contact: {
      findMany: vi.fn(async ({ where }: any) => {
        if (where?.id?.in) {
          return state.contacts.filter((c: any) => where.id.in.includes(c.id) && c.workspaceId === where.workspaceId);
        }
        // All-contacts fallback shape: email not null.
        return state.contacts.filter((c: any) => c.workspaceId === where.workspaceId && c.email);
      }),
    },
    campaign: {
      findFirst: vi.fn(async ({ where }: any) =>
        state.campaigns.find((c: any) => c.id === where.id && c.workspaceId === where.workspaceId) ?? null,
      ),
      updateMany: vi.fn(async ({ where, data }: any) => {
        for (const c of state.campaigns) {
          if (c.id === where.id && c.workspaceId === where.workspaceId) Object.assign(c, data);
        }
        state.campaignUpdates.push({ where, data });
        return { count: 1 };
      }),
    },
    campaignRecipient: {
      findMany: vi.fn(async ({ where }: any) =>
        state.recipients.filter((r: any) => r.campaignId === where.campaignId),
      ),
      deleteMany: vi.fn(async ({ where }: any) => {
        const before = state.recipients.length;
        state.recipients = state.recipients.filter((r: any) => r.campaignId !== where.campaignId);
        return { count: before - state.recipients.length };
      }),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `cr_${state.recipients.length + 1}`, ...data };
        state.recipients.push(row);
        return row;
      }),
    },
    campaignEmail: {
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    segment: {
      findFirst: vi.fn(async ({ where }: any) =>
        state.segments.find((s: any) => s.id === where.id && s.workspaceId === where.workspaceId) ?? null,
      ),
    },
  },
}));

vi.mock('../services/email-marketing/mailbox-pool.service.js', () => ({
  getWorkspaceOutreachCapacity: vi.fn(async () => ({ activeMailboxes: 1, totalDailyLimit: 40, totalCapacity: 40 })),
}));

vi.mock('../services/email-marketing/cold-outreach.service.js', () => ({
  coldSendContext: vi.fn(async () => ({ allowed: async () => true, jitter: async () => {}, isCold: false })),
}));

vi.mock('../services/email-marketing/email-send-worker.service.js', () => ({
  emailMarketingSendQueue: {},
  processEmailSendJobDirectly: (...args: any[]) => (state.sendJob as any)(...args),
}));

vi.mock('../services/email-marketing/outreach-scheduler.service.js', () => ({
  planCampaignMultiDaySchedule: vi.fn(() => ({ totalDays: 1 })),
  applyCampaignMultiDaySchedule: vi.fn(async () => {}),
}));

vi.mock('../services/email-marketing/sequence-runner.service.js', () => ({
  enrollSequenceIfNeeded: vi.fn(async () => {}),
}));

vi.mock('../services/email-marketing/audience.service.js', () => ({
  evaluateSegment: (...args: any[]) => (state.evaluateSegment as any)(...args),
}));

vi.mock('../services/crm.service.js', () => ({
  getSmartListContacts: (...args: any[]) => (state.getSmartListContacts as any)(...args),
}));

import {
  resolveCampaignRecipientContactIds,
  sendCampaign,
  getCampaignOutreachPlan,
} from '../services/email-marketing/campaigns.service.js';

function bulkDraft(overrides: any = {}) {
  return {
    id: 'camp_bulk',
    workspaceId: 'ws_test',
    name: 'Bulk email — 2 contacts',
    status: 'DRAFT',
    listId: null,
    segmentId: null,
    smartListId: null,
    abTestConfig: null,
    ...overrides,
  };
}

function seedBulkDraft(overrides: any = {}) {
  state.campaigns = [bulkDraft(overrides)];
  state.recipients = [
    { id: 'cr_1', campaignId: 'camp_bulk', contactId: 'ct_alice', status: 'PENDING', variant: null },
    { id: 'cr_2', campaignId: 'camp_bulk', contactId: 'ct_bob', status: 'PENDING', variant: null },
  ];
}

beforeEach(() => {
  state.campaigns = [];
  state.recipients = [];
  state.campaignUpdates = [];
  state.sentJobs = [];
  state.smartListContacts = [{ id: 'ct_carol', email: 'carol@example.com' }];
  state.segmentContactIds = ['ct_dan'];
  state.contacts.find((c: any) => c.id === 'ct_bob')!.email = 'bob@example.com';
  vi.clearAllMocks();
  state.sendJob.mockClear();
});

describe('resolveCampaignRecipientContactIds', () => {
  it('direct rows win when no audience is set', async () => {
    seedBulkDraft();
    const ids = await resolveCampaignRecipientContactIds('ws_test', state.campaigns[0]);
    expect([...ids].sort()).toEqual(['ct_alice', 'ct_bob']);
  });

  it('skips a direct contact whose email was removed, and dedupes rows', async () => {
    seedBulkDraft();
    state.contacts.find((c: any) => c.id === 'ct_bob')!.email = null;
    state.recipients.push({ id: 'cr_3', campaignId: 'camp_bulk', contactId: 'ct_alice', status: 'PENDING', variant: null });
    const ids = await resolveCampaignRecipientContactIds('ws_test', state.campaigns[0]);
    expect(ids).toEqual(['ct_alice']);
  });

  it('a set smart list wins over direct rows', async () => {
    seedBulkDraft({ smartListId: 'sl_1' });
    const ids = await resolveCampaignRecipientContactIds('ws_test', state.campaigns[0]);
    expect(ids).toEqual(['ct_carol']);
  });

  it('a set segment wins over direct rows', async () => {
    seedBulkDraft({ segmentId: 'seg_1' });
    const ids = await resolveCampaignRecipientContactIds('ws_test', state.campaigns[0]);
    expect(ids).toEqual(['ct_dan']);
  });

  it('no rows and no audience falls back to all contacts with emails (unchanged)', async () => {
    state.campaigns = [bulkDraft()];
    const ids = await resolveCampaignRecipientContactIds('ws_test', state.campaigns[0]);
    expect([...ids].sort()).toEqual(['ct_alice', 'ct_bob', 'ct_carol', 'ct_dan']);
  });
});

describe('sendCampaign with direct recipients', () => {
  it('sends to exactly the 2 selected contacts, once each', async () => {
    seedBulkDraft();
    const result = await sendCampaign('ws_test', 'camp_bulk');
    expect(result.queued).toBe(2);
    expect(state.sentJobs.map((j: any) => j.contactId).sort()).toEqual(['ct_alice', 'ct_bob']);
    const rows = state.recipients.filter((r: any) => r.campaignId === 'camp_bulk');
    expect(rows).toHaveLength(2);
    expect(rows.map((r: any) => r.contactId).sort()).toEqual(['ct_alice', 'ct_bob']);
  });

  it('a SENT re-send goes to the same 2 contacts, not the whole workspace', async () => {
    seedBulkDraft({ status: 'SENT' });
    const result = await sendCampaign('ws_test', 'camp_bulk');
    expect(result.queued).toBe(2);
    expect(state.sentJobs.map((j: any) => j.contactId).sort()).toEqual(['ct_alice', 'ct_bob']);
    expect(state.recipients.filter((r: any) => r.campaignId === 'camp_bulk')).toHaveLength(2);
  });

  it('a smart-list campaign still sends to the list, not the direct rows', async () => {
    seedBulkDraft({ smartListId: 'sl_1' });
    const result = await sendCampaign('ws_test', 'camp_bulk');
    expect(result.queued).toBe(1);
    expect(state.sentJobs.map((j: any) => j.contactId)).toEqual(['ct_carol']);
  });
});

describe('getCampaignOutreachPlan with direct recipients', () => {
  it('reports the direct recipient count, not the workspace total', async () => {
    seedBulkDraft();
    const plan = await getCampaignOutreachPlan('ws_test', 'camp_bulk');
    expect(plan.recipientCount).toBe(2);
  });
});
