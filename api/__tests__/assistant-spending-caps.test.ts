import { describe, it, expect, vi } from 'vitest';
import {
  getUsage,
  getAssistantUsage,
  checkBudget,
  checkAssistantBudget,
  monthKey,
} from '../services/agent/metering.js';

// Spending caps, slice 1: the monthly bridge between the new assistant's
// daily per-user table and the existing metering path. Each test builds a
// fake db with only the three reads the metering path makes.

function makeDb(opts: {
  plan?: string | null;
  agent?: { inputTokens: number; outputTokens: number; totalTokens: number } | null;
  assistantTokens?: number;
  throwOnAssistant?: boolean;
  throwOnWorkspace?: boolean;
}) {
  return {
    workspace: {
      findUnique: vi.fn().mockImplementation(async () => {
        if (opts.throwOnWorkspace) throw new Error('db down');
        return { plan: opts.plan ?? 'free' };
      }),
    },
    agentTokenUsage: {
      findUnique: vi.fn().mockResolvedValue(opts.agent ?? null),
    },
    assistantUsage: {
      aggregate: vi.fn().mockImplementation(async () => {
        if (opts.throwOnAssistant) throw new Error('relation "assistant_usage" does not exist');
        return { _sum: { tokens: opts.assistantTokens ?? 0 } };
      }),
    },
  } as any;
}

describe('spending caps — metering bridge (slice 1)', () => {
  it('getUsage sums the old monthly bucket and the assistant daily rollup', async () => {
    const db = makeDb({
      agent: { inputTokens: 1000, outputTokens: 2000, totalTokens: 3000 },
      assistantTokens: 500,
    });
    const usage = await getUsage(db, 'ws_1');
    expect(usage).toEqual({ input: 1000, output: 2000, total: 3500 });
    // The rollup is scoped to the current calendar month.
    expect(db.assistantUsage.aggregate).toHaveBeenCalledWith({
      _sum: { tokens: true },
      where: { workspaceId: 'ws_1', day: { startsWith: monthKey() } },
    });
  });

  it('getUsage counts assistant tokens even with no old-bucket row', async () => {
    const usage = await getUsage(makeDb({ assistantTokens: 700 }), 'ws_1');
    expect(usage).toEqual({ input: 0, output: 0, total: 700 });
  });

  it('getUsage is zero when both tables are empty', async () => {
    const usage = await getUsage(makeDb({}), 'ws_1');
    expect(usage).toEqual({ input: 0, output: 0, total: 0 });
  });

  it('getAssistantUsage returns 0 when the table does not exist yet', async () => {
    const tokens = await getAssistantUsage(makeDb({ throwOnAssistant: true }), 'ws_1');
    expect(tokens).toBe(0);
  });

  it('checkBudget blocks a free workspace at 100k assistant tokens', async () => {
    const check = await checkBudget(makeDb({ plan: 'free', assistantTokens: 100_000 }), 'ws_1');
    expect(check.allowed).toBe(false);
    expect(check.budget).toBe(100_000);
    expect(check.used).toBe(100_000);
  });

  it('checkBudget allows a complete workspace just under 10M', async () => {
    const check = await checkBudget(
      makeDb({ plan: 'complete', assistantTokens: 9_999_999 }),
      'ws_1',
    );
    expect(check.allowed).toBe(true);
    expect(check.budget).toBe(10_000_000);
  });

  it('checkAssistantBudget returns the plain-words block message', async () => {
    const gate = await checkAssistantBudget(
      makeDb({ plan: 'free', assistantTokens: 100_000 }),
      'ws_1',
    );
    expect(gate.allowed).toBe(false);
    expect(gate.message).toMatch(/token budget for this month is used up/);
  });

  it('checkAssistantBudget fails open when the budget cannot be read', async () => {
    const gate = await checkAssistantBudget(makeDb({ throwOnWorkspace: true }), 'ws_1');
    expect(gate.allowed).toBe(true);
  });
});
