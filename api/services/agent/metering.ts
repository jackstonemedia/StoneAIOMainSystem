// Phase 5 token metering — the agent's Gemini choke point.
// Every agent LLM path checks the workspace's monthly budget before
// calling and records usage after. Counts prefer the API's
// usageMetadata when present and fall back to a chars/4 estimate,
// which is always an estimate, never presented as exact.
//
// Budgets are PROVISIONAL (Blueprint 1): Billing Core still owes the
// settled tier names and prices. Unknown plans fall back to the
// lowest tier, never higher.
import type { PrismaClient } from '@prisma/client';

/** Monthly token budgets by workspace plan string. */
export const MONTHLY_BUDGETS: Record<string, number> = {
  free: 100_000,
  starter: 500_000,
  basic: 500_000,
  pro: 2_500_000,
  plus: 2_500_000,
  team: 10_000_000,
  ultra: 10_000_000,
  complete: 10_000_000,
};

export const DEFAULT_BUDGET = 100_000;

export function budgetForPlan(plan: string | null | undefined): number {
  if (!plan) return DEFAULT_BUDGET;
  return MONTHLY_BUDGETS[plan.toLowerCase()] ?? DEFAULT_BUDGET;
}

/** Calendar month bucket key, UTC. A new month is a new bucket. */
export function monthKey(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** First day of next month (UTC), for the reset message. */
export function nextResetLabel(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const next = m === 12 ? new Date(Date.UTC(y + 1, 0, 1)) : new Date(Date.UTC(y, m, 1));
  return next.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** Rough token estimate: ~4 chars per token. Estimates only. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export interface TokenUsage {
  input: number;
  output: number;
}

/**
 * Usage for one LLM call. Prefers usageMetadata when the response
 * carries it; otherwise estimates from the prompt/response text.
 */
export function extractUsage(
  res: any,
  promptText: string,
  responseText: string,
): TokenUsage {
  const meta = res?.usageMetadata;
  if (meta && typeof meta.promptTokenCount === 'number' && typeof meta.candidatesTokenCount === 'number') {
    return { input: meta.promptTokenCount, output: meta.candidatesTokenCount };
  }
  return { input: estimateTokens(promptText), output: estimateTokens(responseText) };
}

export interface UsageTotal extends TokenUsage {
  total: number;
}

/** Current month's usage for a workspace (zeros when no bucket yet). */
export async function getUsage(
  db: PrismaClient,
  workspaceId: string,
  month: string = monthKey(),
): Promise<UsageTotal> {
  const row = await (db as any).agentTokenUsage.findUnique({
    where: { workspaceId_month: { workspaceId, month } },
  });
  if (!row) return { input: 0, output: 0, total: 0 };
  return { input: row.inputTokens, output: row.outputTokens, total: row.totalTokens };
}

/** Add one call's usage to the month's bucket (upsert-increment). */
export async function recordUsage(
  db: PrismaClient,
  workspaceId: string,
  usage: TokenUsage,
  month: string = monthKey(),
): Promise<void> {
  await (db as any).agentTokenUsage.upsert({
    where: { workspaceId_month: { workspaceId, month } },
    update: {
      inputTokens: { increment: usage.input },
      outputTokens: { increment: usage.output },
      totalTokens: { increment: usage.input + usage.output },
    },
    create: {
      workspaceId,
      month,
      inputTokens: usage.input,
      outputTokens: usage.output,
      totalTokens: usage.input + usage.output,
    },
  });
}

export interface BudgetCheck {
  allowed: boolean;
  used: number;
  budget: number;
  pct: number;
  month: string;
  plan: string | null;
}

/**
 * Whether the workspace may make another LLM call. Bypass skips the
 * block only (usage is still recorded); it exists for the dev-only
 * eval workspace and must never be true in production.
 */
export async function checkBudget(
  db: PrismaClient,
  workspaceId: string,
  opts: { bypass?: boolean } = {},
): Promise<BudgetCheck> {
  const month = monthKey();
  const ws = await (db as any).workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true },
  });
  const plan = ws?.plan ?? null;
  const budget = budgetForPlan(plan);
  const used = (await getUsage(db, workspaceId, month)).total;
  return {
    allowed: opts.bypass === true || used < budget,
    used,
    budget,
    pct: budget > 0 ? Math.round((used / budget) * 100) : 0,
    month,
    plan,
  };
}

/** True only when this recording crosses the 80% line (warn once). */
export function crossedWarningThreshold(usedBefore: number, usedAfter: number, budget: number): boolean {
  return usedBefore < budget * 0.8 && usedAfter >= budget * 0.8;
}

export function budgetExhaustedMessage(check: BudgetCheck): string {
  return (
    `Your AI Agent token budget for this month is used up (${check.used.toLocaleString()} of ` +
    `${check.budget.toLocaleString()} tokens). It resets on ${nextResetLabel()}. ` +
    `Contact support if you need a higher limit.`
  );
}

export function budgetWarningMessage(used: number, budget: number): string {
  const pct = Math.round((used / budget) * 100);
  return (
    `Heads up: you have used ${pct}% of this month's AI Agent token budget ` +
    `(${used.toLocaleString()} of ${budget.toLocaleString()} tokens).`
  );
}
