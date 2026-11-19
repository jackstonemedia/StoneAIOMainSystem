/**
 * Business Overview honesty — Tier 3 Tranche A, Fix 1.
 *
 * The Business Overview page used to show invented numbers on an empty
 * workspace ($48,250 revenue, $182,400 pipeline, 2,847 contacts, 24.8%
 * conversion) because the page read the metrics payload with truthiness
 * fallbacks and the backend returned an empty revenue trend. After the
 * fix the backend returns real series for every card and no conversion
 * field at all (the card is dropped until a backend can return it).
 *
 * These tests pin the backend contract with a stubbed db: an empty
 * workspace gets zeros and empty lists, a won deal in the selected
 * period counts as revenue and buckets into the trend, and a won deal
 * outside the period does not count.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.CHANNEL_ENCRYPTION_KEY = 'ab'.repeat(32);

const DAY = 86_400_000;
const NOW = new Date();
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);

const state = vi.hoisted(() => ({
  contacts: [] as any[],
  deals: [] as any[],
  convos: [] as any[],
  messages: [] as any[],
  appointments: [] as any[],
}));

function inRange(d: Date, gte?: Date, lte?: Date, lt?: Date): boolean {
  const t = new Date(d).getTime();
  if (gte && t < new Date(gte).getTime()) return false;
  if (lte && t > new Date(lte).getTime()) return false;
  if (lt && t >= new Date(lt).getTime()) return false;
  return true;
}

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    contact: {
      count: vi.fn(async ({ where }: any) => {
        let rows = state.contacts.filter((c: any) => c.workspaceId === where.workspaceId);
        if (where?.createdAt) {
          rows = rows.filter((c: any) =>
            inRange(c.createdAt, where.createdAt.gte, where.createdAt.lte, where.createdAt.lt),
          );
        }
        return rows.length;
      }),
      findMany: vi.fn(async ({ where }: any) =>
        state.contacts.filter((c: any) => c.workspaceId === where.workspaceId),
      ),
    },
    deal: {
      findMany: vi.fn(async ({ where }: any) => {
        let rows = state.deals.filter((d: any) => d.workspaceId === where.workspaceId);
        if (where?.OR) {
          // Flag rule: status 'won'/'lost' OR a flagged won/lost stage.
          rows = rows.filter((d: any) =>
            where.OR.some((branch: any) => {
              if (branch.status) return d.status === branch.status;
              if (branch.pipelineStage?.isWon) return d.pipelineStage?.isWon === true;
              if (branch.pipelineStage?.isLost) return d.pipelineStage?.isLost === true;
              return false;
            }),
          );
        }
        if (where?.updatedAt) {
          rows = rows.filter((d: any) =>
            inRange(d.updatedAt, where.updatedAt.gte, where.updatedAt.lte, where.updatedAt.lt),
          );
        }
        if (where?.createdAt) {
          rows = rows.filter((d: any) =>
            inRange(d.createdAt, where.createdAt.gte, where.createdAt.lte, where.createdAt.lt),
          );
        }
        return rows;
      }),
    },
    conversation: {
      count: vi.fn(async ({ where }: any) => {
        let rows = state.convos.filter((c: any) => c.workspaceId === where.workspaceId);
        if (where?.unreadCount?.gt != null) rows = rows.filter((c: any) => c.unreadCount > where.unreadCount.gt);
        if (where?.status) rows = rows.filter((c: any) => c.status === where.status);
        return rows.length;
      }),
      findMany: vi.fn(async ({ where }: any) =>
        state.convos.filter((c: any) => c.workspaceId === where.workspaceId),
      ),
    },
    conversationMessage: {
      findMany: vi.fn(async () => state.messages),
    },
    appointment: {
      count: vi.fn(async ({ where }: any) => {
        let rows = state.appointments.filter((a: any) => a.workspaceId === where.workspaceId);
        if (where?.status) rows = rows.filter((a: any) => a.status === where.status);
        return rows.length;
      }),
      findMany: vi.fn(async ({ where, take }: any) => {
        let rows = state.appointments.filter((a: any) => a.workspaceId === where.workspaceId);
        if (where?.startTime?.gte) {
          rows = rows
            .filter((a: any) => new Date(a.startTime) >= new Date(where.startTime.gte))
            .sort((x: any, y: any) => new Date(x.startTime).getTime() - new Date(y.startTime).getTime());
        } else {
          rows = [...rows].sort(
            (x: any, y: any) => new Date(y.startTime).getTime() - new Date(x.startTime).getTime(),
          );
        }
        return take != null ? rows.slice(0, take) : rows;
      }),
    },
    campaignRecipient: {
      findMany: vi.fn(async () => []),
    },
    emailEvent: {
      findMany: vi.fn(async () => []),
    },
    campaign: {
      findFirst: vi.fn(async () => null),
    },
    workflow: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
    workflowRun: {
      findMany: vi.fn(async () => []),
    },
  },
}));

import { getBusinessMetrics, getAnalyticsOverview } from '../services/business.service.js';

const WS = 'ws_test';

function seedEmpty() {
  state.contacts = [];
  state.deals = [];
  state.convos = [];
  state.messages = [];
  state.appointments = [];
}

function seedWithData() {
  state.contacts = [
    { id: 'ct_1', workspaceId: WS, firstName: 'Alice', lastName: 'Freeman', email: 'alice@acmecorp.com', source: 'Website', createdAt: daysAgo(2) },
    { id: 'ct_2', workspaceId: WS, firstName: 'Bob', lastName: 'Stone', email: 'bob@example.com', source: 'Referral', createdAt: daysAgo(5) },
    { id: 'ct_3', workspaceId: WS, firstName: 'Carol', lastName: 'Old', email: 'carol@example.com', source: 'Website', createdAt: daysAgo(40) },
  ];
  state.deals = [
    // Won by flagged stage, in the 30d window.
    { id: 'dl_1', workspaceId: WS, title: 'Q3 Enterprise License', amount: 5000, status: 'open', pipelineStage: { id: 'ps_won', name: 'Won', isWon: true, order: 4 }, updatedAt: daysAgo(10), createdAt: daysAgo(20), contact: { firstName: 'Alice', lastName: 'Freeman', email: 'alice@acmecorp.com' } },
    // Won by flagged stage, in the previous window only.
    { id: 'dl_2', workspaceId: WS, title: 'Old Won Deal', amount: 3000, status: 'open', pipelineStage: { id: 'ps_won', name: 'Won', isWon: true, order: 4 }, updatedAt: daysAgo(40), createdAt: daysAgo(50), contact: { firstName: 'Bob', lastName: 'Stone', email: 'bob@example.com' } },
    // Open.
    { id: 'dl_3', workspaceId: WS, title: 'Marketing Automation', amount: 10000, status: 'open', pipelineStage: { id: 'ps_proposal', name: 'Proposal', order: 2 }, updatedAt: daysAgo(2), createdAt: daysAgo(12), contact: { firstName: 'Alice', lastName: 'Freeman', email: 'alice@acmecorp.com' } },
    // Won on the default template's 'Closed' stage (isWon) — counts as won, never as lost.
    { id: 'dl_4', workspaceId: WS, title: 'Closed Won Deal', amount: 7000, status: 'open', pipelineStage: { id: 'ps_closed', name: 'Closed', isWon: true, order: 2 }, updatedAt: daysAgo(3), createdAt: daysAgo(15), contact: { firstName: 'Alice', lastName: 'Freeman', email: 'alice@acmecorp.com' } },
    // Stage NAMED 'Won' but not flagged, status open — a name alone is not a win.
    { id: 'dl_5', workspaceId: WS, title: 'Name Only Deal', amount: 1000, status: 'open', pipelineStage: { id: 'ps_won_unflagged', name: 'Won', isWon: false, order: 4 }, updatedAt: daysAgo(1), createdAt: daysAgo(6), contact: { firstName: 'Bob', lastName: 'Stone', email: 'bob@example.com' } },
    // Lost by flagged stage.
    { id: 'dl_6', workspaceId: WS, title: 'Lost Deal', amount: 2000, status: 'open', pipelineStage: { id: 'ps_lost', name: 'Lost', isLost: true, order: 5 }, updatedAt: daysAgo(4), createdAt: daysAgo(9), contact: { firstName: 'Bob', lastName: 'Stone', email: 'bob@example.com' } },
    // Won by STATUS on a non-won stage — the status leg of the OR.
    { id: 'dl_7', workspaceId: WS, title: 'Status Won Deal', amount: 4000, status: 'won', pipelineStage: { id: 'ps_negotiation', name: 'Negotiation', order: 3 }, updatedAt: daysAgo(2), createdAt: daysAgo(11), contact: { firstName: 'Alice', lastName: 'Freeman', email: 'alice@acmecorp.com' } },
  ];
  state.convos = [
    { id: 'cv_1', workspaceId: WS, status: 'open', unreadCount: 1, subject: 'Pricing question', lastMessageAt: daysAgo(1), contact: { firstName: 'Alice', lastName: 'Freeman', email: 'alice@acmecorp.com' }, messages: [{ direction: 'inbound', createdAt: daysAgo(1), body: 'Hi, what does the Plus plan cost?' }] },
    { id: 'cv_2', workspaceId: WS, status: 'closed', unreadCount: 0, subject: 'Thanks', lastMessageAt: daysAgo(3), contact: { firstName: 'Bob', lastName: 'Stone', email: 'bob@example.com' }, messages: [] },
  ];
  state.messages = [
    { channel: 'email', direction: 'outbound', createdAt: daysAgo(1) },
    { channel: 'email', direction: 'inbound', createdAt: daysAgo(1) },
  ];
  state.appointments = [
    { id: 'ap_1', workspaceId: WS, title: 'Discovery call', startTime: new Date(NOW.getTime() + 2 * 60 * 60 * 1000), endTime: new Date(NOW.getTime() + 3 * 60 * 60 * 1000), status: 'confirmed', type: 'call', createdAt: daysAgo(1), contact: { firstName: 'Alice', lastName: 'Freeman', email: 'alice@acmecorp.com', phone: null } },
    { id: 'ap_2', workspaceId: WS, title: 'Last week sync', startTime: daysAgo(7), endTime: daysAgo(7), status: 'completed', type: 'meeting', createdAt: daysAgo(8), contact: null },
  ];
}

function window30d() {
  return {
    from: new Date(NOW.getTime() - 30 * DAY).toISOString(),
    to: NOW.toISOString(),
  };
}

function window7d() {
  return {
    from: new Date(NOW.getTime() - 7 * DAY).toISOString(),
    to: NOW.toISOString(),
  };
}

describe('getBusinessMetrics — Fix 1 (no invented numbers)', () => {
  beforeEach(() => {
    seedEmpty();
  });

  it('empty workspace: every card is zero, every list is empty, no conversion field', async () => {
    const m = await getBusinessMetrics(WS, window30d().from, window30d().to);

    expect(m.revenue.current).toBe(0);
    expect(m.revenue.trend).toHaveLength(30);
    expect(m.revenue.trend.every((v: number) => v === 0)).toBe(true);
    expect(m.revenue.changePct).toBeNull();
    expect(m.pipeline.value).toBe(0);
    expect(m.contacts.total).toBe(0);
    expect(m.contacts.trend).toHaveLength(30);
    expect(m.contacts.trend.every((v: number) => v === 0)).toBe(true);
    expect(m.contacts.changePct).toBeNull();
    expect(m.pipeline_stages).toEqual([]);
    expect(m.activityFeed).toEqual([]);
    expect(m.calendar.upcomingAppointments).toEqual([]);

    // The invented numbers must not appear anywhere in the payload.
    expect(JSON.stringify(m)).not.toContain('48,250');
    expect(JSON.stringify(m)).not.toContain('182,400');
    expect(JSON.stringify(m)).not.toContain('2,847');
    expect('conversion' in m).toBe(false);
  });

  it('won deal in the period counts as revenue and buckets into the trend', async () => {
    seedWithData();
    const { from, to } = window30d();
    const m = await getBusinessMetrics(WS, from, to);

    // Won in the 30d window by flag: d1 (5,000, flagged 'Won'), d4
    // (7,000, flagged 'Closed'), d7 (4,000, status 'won'). d2 (3,000)
    // is in the previous window only; d5 (stage named 'Won', unflagged)
    // is not a win at all.
    expect(m.revenue.current).toBe(16000);
    expect(m.revenue.trend.reduce((s: number, v: number) => s + v, 0)).toBe(16000);
    expect(m.revenue.changePct).toBe(433);
    expect(m.crm.revenueOverTime.reduce((s: number, b: any) => s + b.value, 0)).toBe(16000);

    // Contacts: 3 total, 2 created in the window, 1 in the previous window.
    expect(m.contacts.total).toBe(3);
    expect(m.contacts.trend.reduce((s: number, v: number) => s + v, 0)).toBe(2);
    expect(m.contacts.changePct).toBe(100);

    // Pipeline: only the open deals count (d3 Proposal + d5 name-only).
    expect(m.pipeline.value).toBe(11000);
    expect(m.pipeline_stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Won', count: 3, value: 9000 }),
        expect.objectContaining({ name: 'Proposal', count: 1, value: 10000 }),
        expect.objectContaining({ name: 'Closed', count: 1, value: 7000 }),
      ]),
    );

    // Win rate by flag: 4 won (d1, d2, d4, d7), 1 lost (d6) — the
    // closed-won deal is never counted as lost, the name-only deal
    // never as won.
    expect(m.crm.winRate).toBe(80);
    expect(m.crm.wonDealsCount).toBe(4);
    expect(m.crm.lostDealsCount).toBe(1);
    expect(m.headline.wonDeals.allTimeValue).toBe(19000);

    // Activity feed is built from the real rows only.
    expect(m.activityFeed.length).toBe(9);
    expect(m.activityFeed.some((e: any) => e.type === 'deal_won' && e.subtitle.includes('Q3 Enterprise License'))).toBe(true);
    expect(m.activityFeed.some((e: any) => e.type === 'deal_won' && e.subtitle.includes('Closed Won Deal'))).toBe(true);
    expect(m.activityFeed.some((e: any) => e.type === 'contact_created' && e.subtitle.includes('Alice'))).toBe(true);

    // Today's appointment shows up; last week's does not count as upcoming.
    expect(m.calendar.upcomingAppointments).toHaveLength(1);
    expect(m.calendar.upcomingAppointments[0].title).toBe('Discovery call');
  });

  it('a won deal outside the period does not count as current revenue', async () => {
    seedWithData();
    const { from, to } = window7d();
    const m = await getBusinessMetrics(WS, from, to);

    // Won in the 7d window: d4 (7,000, 3 days ago) + d7 (4,000, 2 days
    // ago). d1 was won 10 days ago: outside the window, inside the
    // previous one — and the name-only d5 still does not count.
    expect(m.revenue.current).toBe(11000);
    expect(m.revenue.trend.reduce((s: number, v: number) => s + v, 0)).toBe(11000);
    expect(m.revenue.changePct).toBe(120);

    // The 7d window still has real contacts: 2 created in it, 0 before it.
    expect(m.contacts.total).toBe(3);
    expect(m.contacts.trend.reduce((s: number, v: number) => s + v, 0)).toBe(2);
    expect(m.contacts.changePct).toBeNull();
  });
});

describe('getAnalyticsOverview — Fix 2 (win rate by flag)', () => {
  beforeEach(() => {
    seedEmpty();
  });

  it('counts won deals by flag and lists the stages that actually have deals', async () => {
    seedWithData();
    const a = await getAnalyticsOverview(WS, 30);

    // Won by flag: d1, d2, d4, d7. d5 (unflagged 'Won' name) is not won.
    expect(a.deals.won).toBe(4);
    expect(a.deals.wonValue).toBe(19000);
    // recentWon filters by createdAt in the window: d1, d4, d7 (d2 created 50d ago).
    expect(a.deals.recentWon).toBe(3);
    expect(a.deals.recentRevenue).toBe(16000);
    // byStage is derived from the stages that have deals — 'Closed' is
    // present, 'Lead'/'Qualified' (no deals) are not. The two stages
    // named 'Won' are different stages (one flagged, one not), so they
    // stay separate rows.
    expect(a.deals.byStage).toHaveLength(6);
    expect(a.deals.byStage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Closed', count: 1, value: 7000 }),
        expect.objectContaining({ name: 'Negotiation', count: 1, value: 4000 }),
      ]),
    );
    expect(a.deals.byStage.filter((s: any) => s.name === 'Won')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ count: 2, value: 8000 }),
        expect.objectContaining({ count: 1, value: 1000 }),
      ]),
    );
    expect(a.deals.byStage.some((s: any) => s.name === 'Lead')).toBe(false);
    // Monthly revenue: the current month holds the three recent wins;
    // the previous month holds d2.
    const currentMonth = a.monthlyRevenue[a.monthlyRevenue.length - 1];
    expect(currentMonth.won).toBe(16000);
    expect(currentMonth.deals).toBe(3);
    expect(a.monthlyRevenue.some((m: any) => m.won === 3000 && m.deals === 1)).toBe(true);
  });

  it('empty workspace: zero wins and an empty byStage', async () => {
    const a = await getAnalyticsOverview(WS, 30);
    expect(a.deals.won).toBe(0);
    expect(a.deals.wonValue).toBe(0);
    expect(a.deals.byStage).toEqual([]);
    expect(a.monthlyRevenue.every((m: any) => m.won === 0)).toBe(true);
  });
});
