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
        if (where?.pipelineStage?.name) {
          rows = rows.filter((d: any) => d.pipelineStage?.name === where.pipelineStage.name);
        }
        if (where?.updatedAt) {
          rows = rows.filter((d: any) =>
            inRange(d.updatedAt, where.updatedAt.gte, where.updatedAt.lte, where.updatedAt.lt),
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

import { getBusinessMetrics } from '../services/business.service.js';

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
    { id: 'dl_1', workspaceId: WS, title: 'Q3 Enterprise License', amount: 5000, pipelineStage: { name: 'Won' }, updatedAt: daysAgo(10), createdAt: daysAgo(20), contact: { firstName: 'Alice', lastName: 'Freeman', email: 'alice@acmecorp.com' } },
    { id: 'dl_2', workspaceId: WS, title: 'Old Won Deal', amount: 3000, pipelineStage: { name: 'Won' }, updatedAt: daysAgo(40), createdAt: daysAgo(50), contact: { firstName: 'Bob', lastName: 'Stone', email: 'bob@example.com' } },
    { id: 'dl_3', workspaceId: WS, title: 'Marketing Automation', amount: 10000, pipelineStage: { name: 'Proposal' }, updatedAt: daysAgo(2), createdAt: daysAgo(12), contact: { firstName: 'Alice', lastName: 'Freeman', email: 'alice@acmecorp.com' } },
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

    // d1 (5,000, won 10 days ago) is in the 30d window; d2 (3,000, won
    // 40 days ago) is in the previous window only.
    expect(m.revenue.current).toBe(5000);
    expect(m.revenue.trend.reduce((s: number, v: number) => s + v, 0)).toBe(5000);
    expect(m.revenue.changePct).toBe(67);
    expect(m.crm.revenueOverTime.reduce((s: number, b: any) => s + b.value, 0)).toBe(5000);

    // Contacts: 3 total, 2 created in the window, 1 in the previous window.
    expect(m.contacts.total).toBe(3);
    expect(m.contacts.trend.reduce((s: number, v: number) => s + v, 0)).toBe(2);
    expect(m.contacts.changePct).toBe(100);

    // Pipeline: only the open Proposal deal counts.
    expect(m.pipeline.value).toBe(10000);
    expect(m.pipeline_stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Won', count: 2, value: 8000 }),
        expect.objectContaining({ name: 'Proposal', count: 1, value: 10000 }),
      ]),
    );

    // Activity feed is built from the real rows only.
    expect(m.activityFeed.length).toBe(7);
    expect(m.activityFeed.some((e: any) => e.type === 'deal_won' && e.subtitle.includes('Q3 Enterprise License'))).toBe(true);
    expect(m.activityFeed.some((e: any) => e.type === 'contact_created' && e.subtitle.includes('Alice'))).toBe(true);

    // Today's appointment shows up; last week's does not count as upcoming.
    expect(m.calendar.upcomingAppointments).toHaveLength(1);
    expect(m.calendar.upcomingAppointments[0].title).toBe('Discovery call');
  });

  it('a won deal outside the period does not count as current revenue', async () => {
    seedWithData();
    const { from, to } = window7d();
    const m = await getBusinessMetrics(WS, from, to);

    // d1 was won 10 days ago: outside the 7d window, inside the previous one.
    expect(m.revenue.current).toBe(0);
    expect(m.revenue.trend.every((v: number) => v === 0)).toBe(true);
    expect(m.revenue.changePct).toBe(-100);

    // The 7d window still has real contacts: 2 created in it, 0 before it.
    expect(m.contacts.total).toBe(3);
    expect(m.contacts.trend.reduce((s: number, v: number) => s + v, 0)).toBe(2);
    expect(m.contacts.changePct).toBeNull();
  });
});
