// Phase 5 metering — unit tests (pure logic + stubbed db, no key).
import { describe, it, expect } from 'vitest';
import {
  budgetForPlan,
  trialBudgetForPlan,
  isTrialingWorkspace,
  budgetForWorkspace,
  TRIAL_BUDGET_FLOOR,
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

describe('trialBudgetForPlan (Blueprint 3 Phase 3, D1)', () => {
  it('pro-rates the plan budget over the 7-day trial with a 500k floor', () => {
    // Basic 500k × 7/30 = 116,666 → the floor binds.
    expect(trialBudgetForPlan('basic')).toBe(500_000);
    expect(trialBudgetForPlan('free')).toBe(500_000);
    // Plus 2.5M × 7/30 = 583,333.33 → floored, never above pro-rata.
    expect(trialBudgetForPlan('plus')).toBe(583_333);
    expect(trialBudgetForPlan('pro')).toBe(583_333);
    // Complete 10M × 7/30 = 2,333,333.33 → floored.
    expect(trialBudgetForPlan('complete')).toBe(2_333_333);
    expect(trialBudgetForPlan('ultra')).toBe(2_333_333);
  });

  it('floors at 500k even for unknown plans', () => {
    expect(trialBudgetForPlan('enterprise')).toBe(500_000);
    expect(trialBudgetForPlan(null)).toBe(500_000);
  });

  it('scales with an explicit trial length', () => {
    // A 14-day trial doubles the pro-rata share: Complete 10M × 14/30.
    expect(trialBudgetForPlan('complete', 14)).toBe(4_666_666);
    // Basic still hits the floor at 14 days (500k × 14/30 = 233,333).
    expect(trialBudgetForPlan('basic', 14)).toBe(500_000);
  });

  it('exposes the 500k floor', () => {
    expect(TRIAL_BUDGET_FLOOR).toBe(500_000);
  });
});

describe('isTrialingWorkspace', () => {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000);

  it('is true only for trialing status with a future trial end', () => {
    expect(isTrialingWorkspace({ plan: 'complete', subscriptionStatus: 'trialing', trialEndsAt: future })).toBe(true);
    // Prisma returns Date objects; ISO strings are accepted too.
    expect(isTrialingWorkspace({ plan: 'complete', subscriptionStatus: 'trialing', trialEndsAt: future.toISOString() })).toBe(true);
  });

  it('is false when the trial already ended, even with a stale trialing status', () => {
    expect(isTrialingWorkspace({ plan: 'complete', subscriptionStatus: 'trialing', trialEndsAt: past })).toBe(false);
  });

  it('is false for paid, inactive, and missing workspaces', () => {
    expect(isTrialingWorkspace({ plan: 'complete', subscriptionStatus: 'active', trialEndsAt: future })).toBe(false);
    expect(isTrialingWorkspace({ plan: 'complete', subscriptionStatus: 'inactive', trialEndsAt: future })).toBe(false);
    expect(isTrialingWorkspace({ plan: 'complete', subscriptionStatus: 'trialing', trialEndsAt: null })).toBe(false);
    expect(isTrialingWorkspace({ plan: 'complete' })).toBe(false);
    expect(isTrialingWorkspace(null)).toBe(false);
    expect(isTrialingWorkspace(undefined)).toBe(false);
  });
});

describe('budgetForWorkspace', () => {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000);

  it('returns the trial budget while trialing', () => {
    expect(budgetForWorkspace({ plan: 'complete', subscriptionStatus: 'trialing', trialEndsAt: future })).toBe(2_333_333);
    expect(budgetForWorkspace({ plan: 'basic', subscriptionStatus: 'trialing', trialEndsAt: future })).toBe(500_000);
  });

  it('returns the full plan budget once the trial is over or never trialed', () => {
    expect(budgetForWorkspace({ plan: 'complete', subscriptionStatus: 'trialing', trialEndsAt: past })).toBe(10_000_000);
    expect(budgetForWorkspace({ plan: 'complete', subscriptionStatus: 'active', trialEndsAt: future })).toBe(10_000_000);
    expect(budgetForWorkspace({ plan: 'plus', subscriptionStatus: 'inactive' })).toBe(2_500_000);
    expect(budgetForWorkspace(null)).toBe(100_000);
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

  it('checkBudget enforces the trial budget for a trialing workspace', async () => {
    const now = monthKey();
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const trialWs = { plan: 'complete', subscriptionStatus: 'trialing', trialEndsAt: future };
    const trialStubDb = (ws: any, rows: Record<string, { inputTokens: number; outputTokens: number; totalTokens: number }>) => {
      const store: Record<string, { inputTokens: number; outputTokens: number; totalTokens: number }> = { ...rows };
      return {
        workspace: { findUnique: async () => ws },
        agentTokenUsage: {
          findUnique: async ({ where }: any) => store[`${where.workspaceId_month.workspaceId}|${where.workspaceId_month.month}`] ?? null,
        },
      } as any;
    };
    const under = trialStubDb(trialWs, { [`ws_1|${now}`]: { inputTokens: 1_000_000, outputTokens: 500_000, totalTokens: 1_500_000 } });
    const ok = await checkBudget(under, 'ws_1');
    expect(ok.allowed).toBe(true);
    expect(ok.budget).toBe(2_333_333);
    expect(ok.used).toBe(1_500_000);
    // 1,500,000 / 2,333,333 = 64% — under the 80% warning line.
    expect(ok.pct).toBe(64);

    const over = trialStubDb(trialWs, { [`ws_1|${now}`]: { inputTokens: 1_800_000, outputTokens: 533_333, totalTokens: 2_333_333 } });
    const blocked = await checkBudget(over, 'ws_1');
    expect(blocked.allowed).toBe(false);
    expect(blocked.budget).toBe(2_333_333);
    expect(budgetExhaustedMessage(blocked)).toMatch(/2,333,333/);

    // The 80% warning fires against the trial budget (1,866,666), not 10M.
    expect(crossedWarningThreshold(1_800_000, 1_900_000, 2_333_333)).toBe(true);
    expect(crossedWarningThreshold(1_800_000, 1_900_000, 10_000_000)).toBe(false);
  });

  it('checkBudget falls back to the full plan budget when the trial expired', async () => {
    const now = monthKey();
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const expiredWs = { plan: 'complete', subscriptionStatus: 'trialing', trialEndsAt: past };
    const db = {
      workspace: { findUnique: async () => expiredWs },
      agentTokenUsage: {
        findUnique: async () => ({ inputTokens: 3_000_000, outputTokens: 2_000_000, totalTokens: 5_000_000 }),
      },
    } as any;
    const check = await checkBudget(db, 'ws_1');
    expect(check.allowed).toBe(true);
    expect(check.budget).toBe(10_000_000);
  });
});
