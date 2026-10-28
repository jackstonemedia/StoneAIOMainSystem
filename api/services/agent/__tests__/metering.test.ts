// Phase 5 metering — unit tests (pure logic + stubbed db, no key).
import { describe, it, expect } from 'vitest';
import {
  budgetForPlan,
  monthKey,
  estimateTokens,
  extractUsage,
  getUsage,
  recordUsage,
  checkBudget,
  crossedWarningThreshold,
  budgetExhaustedMessage,
} from '../metering.js';

describe('budgetForPlan', () => {
  it('maps every known plan', () => {
    expect(budgetForPlan('free')).toBe(100_000);
    expect(budgetForPlan('starter')).toBe(500_000);
    expect(budgetForPlan('basic')).toBe(500_000);
    expect(budgetForPlan('pro')).toBe(2_500_000);
    expect(budgetForPlan('plus')).toBe(2_500_000);
    expect(budgetForPlan('team')).toBe(10_000_000);
    expect(budgetForPlan('ultra')).toBe(10_000_000);
    expect(budgetForPlan('complete')).toBe(10_000_000);
  });

  it('falls back to the lowest tier for unknown or missing plans', () => {
    expect(budgetForPlan('enterprise')).toBe(100_000);
    expect(budgetForPlan(null)).toBe(100_000);
    expect(budgetForPlan(undefined)).toBe(100_000);
    expect(budgetForPlan('PRO')).toBe(2_500_000);
  });
});

describe('monthKey', () => {
  it('formats UTC YYYY-MM', () => {
    expect(monthKey(new Date('2026-10-27T23:30:00.000Z'))).toBe('2026-10');
    expect(monthKey(new Date('2027-01-01T00:00:00.000Z'))).toBe('2027-01');
  });
});

describe('estimateTokens', () => {
  it('estimates ~4 chars per token', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });
});

describe('extractUsage', () => {
  it('prefers usageMetadata when present', () => {
    expect(extractUsage(
      { usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 80 } },
      'prompt text here',
      'response text here',
    )).toEqual({ input: 120, output: 80 });
  });

  it('falls back to estimates without metadata', () => {
    expect(extractUsage(null, 'abcd', 'abcdefgh')).toEqual({ input: 1, output: 2 });
    expect(extractUsage({}, 'abcd', 'abcdefgh')).toEqual({ input: 1, output: 2 });
  });
});

describe('crossedWarningThreshold', () => {
  it('warns only on the crossing turn', () => {
    expect(crossedWarningThreshold(79_000, 81_000, 100_000)).toBe(true);
    expect(crossedWarningThreshold(81_000, 82_000, 100_000)).toBe(false);
    expect(crossedWarningThreshold(10_000, 20_000, 100_000)).toBe(false);
    expect(crossedWarningThreshold(0, 80_000, 100_000)).toBe(true);
  });
});

describe('usage buckets with a stubbed db', () => {
  const stubDb = (plan: string | null, rows: Record<string, { inputTokens: number; outputTokens: number; totalTokens: number }>) => {
    const store: Record<string, { inputTokens: number; outputTokens: number; totalTokens: number }> = { ...rows };
    return {
      db: {
        workspace: { findUnique: async () => (plan === null ? null : { plan }) },
        agentTokenUsage: {
          findUnique: async ({ where }: any) => store[`${where.workspaceId_month.workspaceId}|${where.workspaceId_month.month}`] ?? null,
          upsert: async ({ where, update, create }: any) => {
            const key = `${where.workspaceId_month.workspaceId}|${where.workspaceId_month.month}`;
            const prev = store[key] ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
            store[key] = {
              inputTokens: prev.inputTokens + (update.inputTokens.increment ?? 0),
              outputTokens: prev.outputTokens + (update.outputTokens.increment ?? 0),
              totalTokens: prev.totalTokens + (update.totalTokens.increment ?? 0),
            };
            return store[key];
          },
        },
      } as any,
      store,
    };
  };

  it('getUsage returns zeros with no bucket', async () => {
    const { db } = stubDb('pro', {});
    expect(await getUsage(db, 'ws_1', '2026-10')).toEqual({ input: 0, output: 0, total: 0 });
  });

  it('recordUsage accumulates into the bucket', async () => {
    const { db } = stubDb('pro', {});
    await recordUsage(db, 'ws_1', { input: 100, output: 50 }, '2026-10');
    await recordUsage(db, 'ws_1', { input: 10, output: 5 }, '2026-10');
    expect(await getUsage(db, 'ws_1', '2026-10')).toEqual({ input: 110, output: 55, total: 165 });
  });

  it('checkBudget allows under budget and blocks at/over it', async () => {
    // monthKey uses the real current month, so seed that key.
    const now = monthKey();
    const underNow = stubDb('free', { [`ws_1|${now}`]: { inputTokens: 50_000, outputTokens: 10_000, totalTokens: 60_000 } });
    const overNow = stubDb('free', { [`ws_1|${now}`]: { inputTokens: 90_000, outputTokens: 10_000, totalTokens: 100_000 } });
    const ok = await checkBudget(underNow.db, 'ws_1');
    expect(ok.allowed).toBe(true);
    expect(ok.budget).toBe(100_000);
    expect(ok.used).toBe(60_000);
    expect(ok.pct).toBe(60);
    const blocked = await checkBudget(overNow.db, 'ws_1');
    expect(blocked.allowed).toBe(false);
    expect(budgetExhaustedMessage(blocked)).toMatch(/used up/);
    expect(budgetExhaustedMessage(blocked)).toMatch(/resets on/);
  });

  it('bypass skips the block but checkBudget still reports usage', async () => {
    const now = monthKey();
    const { db } = stubDb('free', { [`ws_1|${now}`]: { inputTokens: 100_000, outputTokens: 50_000, totalTokens: 150_000 } });
    const check = await checkBudget(db, 'ws_1', { bypass: true });
    expect(check.allowed).toBe(true);
    expect(check.used).toBe(150_000);
  });
});
