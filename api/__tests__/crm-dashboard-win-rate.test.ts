/**
 * Legacy CRM dashboard win rate — Tier 3 Tranche A, Fix 2.
 *
 * `getDashboard` (crm.service.ts) counted wins by stage NAME ('Won')
 * and losses by name ('Lost'), so a default-template workspace — whose
 * won stage is named 'Closed' with isWon:true — showed a 0% win rate
 * and counted every closed-won deal as lost (or, in this function's
 * open-deals filter, as still open). It now uses the codebase's flag
 * rule: status 'won'/'lost' OR a flagged won/lost stage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.CHANNEL_ENCRYPTION_KEY = 'ab'.repeat(32);

const DAY = 86_400_000;
const NOW = new Date();
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);

const state = vi.hoisted(() => ({
  contacts: [] as any[],
  deals: [] as any[],
  pipelines: [] as any[],
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
        [...state.contacts]
          .filter((c: any) => c.workspaceId === where.workspaceId)
          .sort((a: any, b: any) => (b.leadScore ?? 0) - (a.leadScore ?? 0)),
      ),
    },
    deal: {
      findMany: vi.fn(async ({ where }: any) => {
        let rows = state.deals.filter((d: any) => d.workspaceId === where.workspaceId);
        if (where?.OR) {
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
        return rows;
      }),
    },
    activity: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
    task: {
      count: vi.fn(async () => 0),
    },
    pipeline: {
      findMany: vi.fn(async ({ where }: any) =>
        state.pipelines.filter((p: any) => p.workspaceId === where.workspaceId),
      ),
    },
  },
}));

import { getDashboard } from '../services/crm.service.js';

const WS = 'ws_test';

function seed() {
  state.contacts = [
    { id: 'ct_1', workspaceId: WS, firstName: 'Alice', lastName: 'Freeman', email: 'alice@acmecorp.com', leadScore: 90, createdAt: daysAgo(2), company: null },
    { id: 'ct_2', workspaceId: WS, firstName: 'Bob', lastName: 'Stone', email: 'bob@example.com', leadScore: 50, createdAt: daysAgo(5), company: null },
    { id: 'ct_3', workspaceId: WS, firstName: 'Carol', lastName: 'Old', email: 'carol@example.com', leadScore: 10, createdAt: daysAgo(40), company: null },
  ];
  state.deals = [
    { id: 'dl_1', workspaceId: WS, title: 'Q3 Enterprise License', amount: 5000, status: 'open', pipelineStageId: 'ps_won', pipelineStage: { id: 'ps_won', name: 'Won', isWon: true }, updatedAt: daysAgo(10), createdAt: daysAgo(20) },
    { id: 'dl_2', workspaceId: WS, title: 'Old Won Deal', amount: 3000, status: 'open', pipelineStageId: 'ps_won', pipelineStage: { id: 'ps_won', name: 'Won', isWon: true }, updatedAt: daysAgo(40), createdAt: daysAgo(50) },
    { id: 'dl_3', workspaceId: WS, title: 'Marketing Automation', amount: 10000, status: 'open', pipelineStageId: 'ps_proposal', pipelineStage: { id: 'ps_proposal', name: 'Proposal' }, updatedAt: daysAgo(2), createdAt: daysAgo(12) },
    { id: 'dl_4', workspaceId: WS, title: 'Closed Won Deal', amount: 7000, status: 'open', pipelineStageId: 'ps_closed', pipelineStage: { id: 'ps_closed', name: 'Closed', isWon: true }, updatedAt: daysAgo(3), createdAt: daysAgo(15) },
    { id: 'dl_5', workspaceId: WS, title: 'Name Only Deal', amount: 1000, status: 'open', pipelineStageId: 'ps_won_unflagged', pipelineStage: { id: 'ps_won_unflagged', name: 'Won', isWon: false }, updatedAt: daysAgo(1), createdAt: daysAgo(6) },
    { id: 'dl_6', workspaceId: WS, title: 'Lost Deal', amount: 2000, status: 'open', pipelineStageId: 'ps_lost', pipelineStage: { id: 'ps_lost', name: 'Lost', isLost: true }, updatedAt: daysAgo(4), createdAt: daysAgo(9) },
    { id: 'dl_7', workspaceId: WS, title: 'Status Won Deal', amount: 4000, status: 'won', pipelineStageId: 'ps_negotiation', pipelineStage: { id: 'ps_negotiation', name: 'Negotiation' }, updatedAt: daysAgo(2), createdAt: daysAgo(11) },
  ];
  state.pipelines = [
    {
      id: 'pl_1', workspaceId: WS, name: 'Standard Sales',
      stages: [
        { id: 'ps_lead', name: 'Lead', order: 0 },
        { id: 'ps_qualified', name: 'Qualified', order: 1 },
        { id: 'ps_proposal', name: 'Proposal', order: 2 },
        { id: 'ps_negotiation', name: 'Negotiation', order: 3 },
        { id: 'ps_won', name: 'Won', order: 4 },
        { id: 'ps_closed', name: 'Closed', order: 5 },
        { id: 'ps_lost', name: 'Lost', order: 6 },
        // The name-only deal's stage is not on this pipeline — it is a
        // stray stage, so it must not appear in dealsByStage at all.
      ],
    },
  ];
}

describe('getDashboard — Fix 2 (win rate by flag)', () => {
  beforeEach(() => {
    seed();
  });

  it('counts wins by flag: closed-won is won, name-only is not, lost is lost', async () => {
    const d = await getDashboard(WS);

    // Open deals: d3 (Proposal) + d5 (name-only). The closed-won deal
    // is not open, not lost.
    expect(d.stats.openDeals).toBe(2);
    expect(d.stats.openDealsValue).toBe('$11k');
    // Won in the last 30d by flag: d1, d4, d7.
    expect(d.stats.wonDeals).toBe(3);
    expect(d.stats.wonDealsValue).toBe('$16k');
    // Conversion: 4 won (d1, d2, d4, d7) / 5 decided (4 won + d6 lost).
    expect(d.conversionRate).toBe(80);
    // dealsByStage is built from the real pipeline stages.
    expect(d.dealsByStage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stageName: 'Closed', count: 1, value: 7000 }),
        expect.objectContaining({ stageName: 'Won', count: 2, value: 8000 }),
      ]),
    );
  });

  it('empty workspace: zero deals, zero conversion', async () => {
    state.contacts = [];
    state.deals = [];
    state.pipelines = [];
    const d = await getDashboard(WS);
    expect(d.stats.openDeals).toBe(0);
    expect(d.stats.wonDeals).toBe(0);
    expect(d.conversionRate).toBe(0);
    expect(d.dealsByStage).toEqual([]);
  });
});
