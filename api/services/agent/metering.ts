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

/** Current month's usage for a workspace (zeros when no bucket yet).
 * The total is the sum of the OLD agent's monthly bucket
 * (`agent_token_usage`) and the NEW assistant's daily per-user table
 * (`assistant_usage`, rolled up by month) — the two tables are the two
 * write paths for the same workspace budget, and each turn writes to
 * exactly one of them, so the sum never double-counts. The input/output
 * split comes from the old bucket only: `assistant_usage` stores a
 * single `tokens` figure with no split. */
export async function getUsage(
  db: PrismaClient,
  workspaceId: string,
  month: string = monthKey(),
): Promise<UsageTotal> {
  const row = await (db as any).agentTokenUsage.findUnique({
    where: { workspaceId_month: { workspaceId, month } },
  });
  const agent = row
    ? { input: row.inputTokens, output: row.outputTokens, total: row.totalTokens }
    : { input: 0, output: 0, total: 0 };
  const assistantTokens = await getAssistantUsage(db, workspaceId, month);
  return { input: agent.input, output: agent.output, total: agent.total + assistantTokens };
}

/**
 * Monthly rollup of the NEW assistant's daily per-user usage
 * (`assistant_usage.tokens`, one row per workspace+user+day).
 * Defensive by design: if the table does not exist yet (the Assistant*
 * tables have no production migration — launch gap C.1), return 0
 * instead of breaking this shared path, which the old agent's
 * `checkBudget` also reads. A missing table means the assistant is
 * unmetered (its current state), never a crash in the old agent.
 */
export async function getAssistantUsage(
  db: PrismaClient,
  workspaceId: string,
  month: string = monthKey(),
): Promise<number> {
  try {
    const agg = await (db as any).assistantUsage.aggregate({
      _sum: { tokens: true },
      where: { workspaceId, day: { startsWith: month } },
    });
    return agg?._sum?.tokens ?? 0;
  } catch (err) {
    console.warn(
      '[Metering] assistant_usage rollup unavailable, counting 0:',
      (err as Error)?.message,
    );
    return 0;
  }
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

/**
 * Budget gate for the NEW assistant paths (chat turns, temporary chat,
 * scheduled tasks, regenerate/edit). Returns the plain-words block
 * message when the workspace has used its monthly plan budget.
 * Never throws: a metering read failure logs loudly and allows the
 * request, so a metering outage can't take the assistant down. The
 * post-turn usage recording still runs, so usage is not silently lost.
 * (The orchestrator does not use this helper — it needs the raw
 * BudgetCheck numbers for the 80% warning — but follows the same
 * fail-open-on-read-error rule.)
 */
export async function checkAssistantBudget(
  db: PrismaClient,
  workspaceId: string,
): Promise<{ allowed: boolean; message?: string }> {
  try {
    const check = await checkBudget(db, workspaceId);
    if (check.allowed) return { allowed: true };
    return { allowed: false, message: budgetExhaustedMessage(check) };
  } catch (err) {
    console.error(
      '[AssistantBudget] Budget check failed (allowing request):',
      (err as Error)?.message,
    );
    return { allowed: true };
  }
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
