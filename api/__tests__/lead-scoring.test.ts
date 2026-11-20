/**
 * Lead / health scoring — complete-platform item 7.
 *
 * Score = Recency 30 + Engagement 30 + Pipeline 25 + Completeness 15.
 * Bands 75+ Hot / 50–74 Warm / 25–49 Cool / 0–24 Cold. Total 0 renders
 * "—" in the UI (never "0"). Health is Option A: a computed roll-up on
 * read, no column. The two dead columns (healthScore, engagementScore)
 * are deleted; leadScore is now written by the scorer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const NOW = new Date('2026-11-19T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

const state = vi.hoisted(() => ({
  contacts: {} as Record<string, any>,
  emailEvents: {} as Record<string, any[]>,
  contactEvents: {} as Record<string, any[]>,
  activities: {} as Record<string, any[]>,
  conversations: {} as Record<string, any[]>,
  deals: {} as Record<string, any[]>,
  updateCalls: [] as any[],
  contactsPage: [] as any[],
  updateThrows: false,
}));

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    contact: {
      findUnique: vi.fn(async ({ where }: any) => state.contacts[where.id] ?? null),
      findMany: vi.fn(async () => state.contactsPage),
      update: vi.fn(async ({ where, data }: any) => {
        if (state.updateThrows) throw new Error('db down');
        state.updateCalls.push({ where, data });
        const row = state.contacts[where.id];
        if (row) Object.assign(row, data);
        return row;
      }),
    },
    contactEvent: {
      findFirst: vi.fn(async ({ where }: any) => {
        const rows = state.contactEvents[where.contactId] ?? [];
        const excluded = where.type?.notIn ?? [];
        return rows.find((r: any) => !excluded.includes(r.type)) ?? null;
      }),
    },
    activity: {
      findFirst: vi.fn(async ({ where }: any) => {
        const rows = state.activities[where.contactId] ?? [];
        const excluded = where.type?.notIn ?? [];
        return rows.find((r: any) => !excluded.includes(r.type)) ?? null;
      }),
      create: vi.fn(async ({ data }: any) => ({ id: 'act_1', ...data })),
    },
    conversation: {
      findFirst: vi.fn(async ({ where }: any) => (state.conversations[where.contactId] ?? [])[0] ?? null),
    },
    emailEvent: {
      findMany: vi.fn(async ({ where }: any) => {
        const rows = state.emailEvents[where.contactId] ?? [];
        return rows.filter(
          (r: any) =>
            (!where.occurredAt?.gte || new Date(r.occurredAt).getTime() >= new Date(where.occurredAt.gte).getTime()) &&
            (!where.eventType?.in || where.eventType.in.includes(r.eventType)),
        );
      }),
    },
    deal: {
      findMany: vi.fn(async ({ where }: any) => state.deals[where.contactId] ?? []),
    },
    tag: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: any) => ({ id: 'tag_1', ...data })),
    },
  },
}));

vi.mock('../services/trigger-emitter.service.js', () => ({
  emitTrigger: vi.fn(async () => {}),
}));

import {
  computeLeadScore,
  recomputeLeadScore,
  recomputeAllLeadScores,
  computeCompanyHealth,
  scoreBand,
  updateContact,
} from '../services/crm.service.js';

function setContact(id: string, patch: any) {
  state.contacts[id] = {
    id,
    workspaceId: 'ws',
    firstName: 'Test',
    lastName: 'Person',
    email: null,
    phone: null,
    companyId: null,
    ownerId: null,
    lastContactedAt: null,
    leadScore: 0,
    tagsJson: null,
    customFieldsJson: null,
    company: null,
    ...patch,
  };
  state.emailEvents[id] = state.emailEvents[id] ?? [];
  state.contactEvents[id] = state.contactEvents[id] ?? [];
  state.activities[id] = state.activities[id] ?? [];
  state.conversations[id] = state.conversations[id] ?? [];
  state.deals[id] = state.deals[id] ?? [];
}

beforeEach(() => {
  state.contacts = {};
  state.emailEvents = {};
  state.contactEvents = {};
  state.activities = {};
  state.conversations = {};
  state.deals = {};
  state.updateCalls = [];
  state.contactsPage = [];
  state.updateThrows = false;
});

describe('computeLeadScore (item 7)', () => {
  it('A — active prospect: 30 + 20 + 19 + 13 = 82, Hot', async () => {
    setContact('ct_a', { email: 'a@x.com', phone: '555', companyId: 'co_1', lastContactedAt: daysAgo(3) });
    state.emailEvents['ct_a'] = [{ eventType: 'CLICKED', isBotSuspected: false, occurredAt: daysAgo(10) }];
    state.deals['ct_a'] = [{ probability: 60, pipelineStage: { isWon: false, isLost: false } }];
    const s = await computeLeadScore('ct_a', 'ws', NOW);
    expect(s).toMatchObject({ total: 82, band: 'Hot', components: { recency: 30, engagement: 20, pipeline: 19, completeness: 13 } });
  });

  it('B — dormant: 0 + 0 + 0 + 5 = 5, Cold', async () => {
    setContact('ct_b', { email: 'b@x.com', lastContactedAt: daysAgo(120) });
    const s = await computeLeadScore('ct_b', 'ws', NOW);
    expect(s).toMatchObject({ total: 5, band: 'Cold', components: { recency: 0, engagement: 0, pipeline: 0, completeness: 5 } });
  });

  it('C — engaged, no deal: 30 + 30 + 0 + 15 = 75, Hot', async () => {
    setContact('ct_c', { email: 'c@x.com', phone: '555', companyId: 'co_1', ownerId: 'u_1', lastContactedAt: daysAgo(5) });
    state.emailEvents['ct_c'] = [{ eventType: 'REPLIED', isBotSuspected: false, occurredAt: daysAgo(5) }];
    const s = await computeLeadScore('ct_c', 'ws', NOW);
    expect(s).toMatchObject({ total: 75, band: 'Hot', components: { recency: 30, engagement: 30, pipeline: 0, completeness: 15 } });
  });

  it('a bot click is recorded but never counts as engagement', async () => {
    setContact('ct_bot', { email: 'bot@x.com', lastContactedAt: daysAgo(2) });
    state.emailEvents['ct_bot'] = [{ eventType: 'CLICKED', isBotSuspected: true, occurredAt: daysAgo(2) }];
    const s = await computeLeadScore('ct_bot', 'ws', NOW);
    expect(s!.components.engagement).toBe(0);
    expect(s!.total).toBe(35); // 30 recency + 0 + 0 + 5 completeness
  });

  it('a bounce zeroes engagement even after a click', async () => {
    setContact('ct_bn', { email: 'bn@x.com', lastContactedAt: daysAgo(10) });
    state.emailEvents['ct_bn'] = [
      { eventType: 'CLICKED', isBotSuspected: false, occurredAt: daysAgo(10) },
      { eventType: 'BOUNCED', isBotSuspected: false, occurredAt: daysAgo(5) },
    ];
    const s = await computeLeadScore('ct_bn', 'ws', NOW);
    expect(s!.components.engagement).toBe(0);
    expect(s!.total).toBe(25); // 20 recency + 0 + 0 + 5
  });

  it('no open deal but a win in the last 90 days = 15 pipeline', async () => {
    setContact('ct_w', { email: 'w@x.com', lastContactedAt: daysAgo(100) });
    state.deals['ct_w'] = [{ probability: 100, closeDate: daysAgo(10), pipelineStage: { isWon: true, isLost: false } }];
    const s = await computeLeadScore('ct_w', 'ws', NOW);
    expect(s!.components.pipeline).toBe(15);
    expect(s!.total).toBe(20);
  });

  it('a lost deal contributes 0 pipeline', async () => {
    setContact('ct_l', { email: 'l@x.com', lastContactedAt: daysAgo(100) });
    state.deals['ct_l'] = [{ probability: 0, closeDate: daysAgo(10), pipelineStage: { isWon: false, isLost: true } }];
    const s = await computeLeadScore('ct_l', 'ws', NOW);
    expect(s!.components.pipeline).toBe(0);
    expect(s!.total).toBe(5);
  });

  it('no signal at all = 0 (renders "—", never "0")', async () => {
    setContact('ct_0', {});
    const s = await computeLeadScore('ct_0', 'ws', NOW);
    expect(s).toMatchObject({ total: 0, band: 'Cold', components: { recency: 0, engagement: 0, pipeline: 0, completeness: 0 } });
  });

  it('recency counts ContactEvent / Activity / conversation touches, not just lastContactedAt', async () => {
    setContact('ct_r', { email: 'r@x.com', lastContactedAt: daysAgo(200) });
    state.contactEvents['ct_r'] = [{ createdAt: daysAgo(4) }];
    const s = await computeLeadScore('ct_r', 'ws', NOW);
    expect(s!.components.recency).toBe(30);
  });

  it('a contact.created Activity is bookkeeping, not a touch — a new bare contact scores 0', async () => {
    setContact('ct_new', {});
    state.activities['ct_new'] = [{ type: 'contact.created', createdAt: daysAgo(0) }];
    const s = await computeLeadScore('ct_new', 'ws', NOW);
    expect(s).toMatchObject({ total: 0, components: { recency: 0, engagement: 0, pipeline: 0, completeness: 0 } });
  });

  it('creation ContactEvents are bookkeeping too — contact_created and deal_created are not touches', async () => {
    setContact('ct_bc', { email: 'bc@x.com' });
    state.contactEvents['ct_bc'] = [
      { type: 'contact_created', createdAt: daysAgo(0) },
      { type: 'deal_created', createdAt: daysAgo(0) },
    ];
    const s = await computeLeadScore('ct_bc', 'ws', NOW);
    expect(s).toMatchObject({ total: 5, components: { recency: 0, engagement: 0, pipeline: 0, completeness: 5 } });
  });

  it('a real Activity type (a call) counts as a touch', async () => {
    setContact('ct_call', { email: 'call@x.com', lastContactedAt: daysAgo(200) });
    state.activities['ct_call'] = [{ type: 'call', createdAt: daysAgo(2) }];
    const s = await computeLeadScore('ct_call', 'ws', NOW);
    expect(s!.components.recency).toBe(30);
  });

  it('missing contact → null', async () => {
    expect(await computeLeadScore('ct_nope', 'ws', NOW)).toBeNull();
  });

  it('scoreBand boundaries', () => {
    expect(scoreBand(100)).toBe('Hot');
    expect(scoreBand(75)).toBe('Hot');
    expect(scoreBand(74)).toBe('Warm');
    expect(scoreBand(50)).toBe('Warm');
    expect(scoreBand(49)).toBe('Cool');
    expect(scoreBand(25)).toBe('Cool');
    expect(scoreBand(24)).toBe('Cold');
    expect(scoreBand(0)).toBe('Cold');
  });
});

describe('recomputeLeadScore (item 7)', () => {
  it('writes the computed score when it changed', async () => {
    setContact('ct_a', { email: 'a@x.com', phone: '555', companyId: 'co_1', lastContactedAt: daysAgo(3) });
    state.emailEvents['ct_a'] = [{ eventType: 'CLICKED', isBotSuspected: false, occurredAt: daysAgo(10) }];
    state.deals['ct_a'] = [{ probability: 60, pipelineStage: { isWon: false, isLost: false } }];
    const s = await recomputeLeadScore('ct_a', 'ws');
    expect(s!.total).toBe(82);
    expect(state.updateCalls).toHaveLength(1);
    expect(state.updateCalls[0].data).toEqual({ leadScore: 82 });
    expect(state.contacts['ct_a'].leadScore).toBe(82);
  });

  it('does not write when the stored score already matches', async () => {
    setContact('ct_a', { email: 'a@x.com', leadScore: 5, lastContactedAt: daysAgo(200) });
    await recomputeLeadScore('ct_a', 'ws');
    expect(state.updateCalls).toHaveLength(0);
  });

  it('never throws — a db failure returns null instead of breaking the caller', async () => {
    setContact('ct_a', { email: 'a@x.com' });
    state.updateThrows = true;
    expect(await recomputeLeadScore('ct_a', 'ws')).toBeNull();
  });
});

describe('recomputeAllLeadScores (item 7)', () => {
  it('backfills every contact and reports checked/changed', async () => {
    setContact('ct_a', { email: 'a@x.com', leadScore: 0, lastContactedAt: daysAgo(3) });
    setContact('ct_b', { email: 'b@x.com', leadScore: 5, lastContactedAt: daysAgo(120) });
    state.contactsPage = [
      { id: 'ct_a', workspaceId: 'ws' },
      { id: 'ct_b', workspaceId: 'ws' },
    ];
    const res = await recomputeAllLeadScores();
    expect(res).toEqual({ checked: 2, changed: 1 });
    expect(state.contacts['ct_a'].leadScore).toBe(35); // 30 recency + 5 completeness
    expect(state.contacts['ct_b'].leadScore).toBe(5);
  });
});

describe('computeCompanyHealth (item 7, Option A)', () => {
  it('averages its contacts lead scores', () => {
    expect(computeCompanyHealth({ contacts: [{ leadScore: 82 }, { leadScore: 40 }, { leadScore: 0 }], deals: [] }))
      .toMatchObject({ health: 41, contactCount: 3, openDealCount: 0 });
  });

  it('no contacts but open deals → average pipeline component', () => {
    expect(computeCompanyHealth({ contacts: [], deals: [{ probability: 60, pipelineStage: { isWon: false, isLost: false } }] }))
      .toMatchObject({ health: 19, contactCount: 0, openDealCount: 1 });
  });

  it('neither contacts nor deals → null ("—")', () => {
    expect(computeCompanyHealth({ contacts: [], deals: [] })).toMatchObject({ health: null, contactCount: 0, openDealCount: 0 });
  });

  it('a won deal does not count as an open deal', () => {
    expect(computeCompanyHealth({ contacts: [], deals: [{ probability: 100, pipelineStage: { isWon: true, isLost: false } }] }))
      .toMatchObject({ health: null, openDealCount: 0 });
  });
});

describe('updateContact strips client scores (item 7)', () => {
  it('a client-supplied leadScore/healthScore/engagementScore never reaches the db', async () => {
    setContact('ct_1', { email: 'a@x.com' });
    await updateContact('ct_1', 'ws', { firstName: 'Alice', leadScore: 99, healthScore: 50, engagementScore: 77 });
    const firstWrite = state.updateCalls[0];
    expect(firstWrite.data).not.toHaveProperty('leadScore');
    expect(firstWrite.data).not.toHaveProperty('healthScore');
    expect(firstWrite.data).not.toHaveProperty('engagementScore');
    expect(firstWrite.data.firstName).toBe('Alice');
    // The recompute fires after the update (fire-and-forget): email-only
    // contact → completeness 5.
    await new Promise((r) => setTimeout(r, 50));
    const scoreWrite = state.updateCalls.find((c: any) => c.data.leadScore !== undefined);
    expect(scoreWrite?.data).toEqual({ leadScore: 5 });
  });
});
