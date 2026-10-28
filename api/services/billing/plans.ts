// Billing Core — canonical plan definitions (single source of truth).
// Settled launch pricing (Jack, 2026-10-16): $19 / $49 / $99 with a
// 1-week free trial. Legacy plan strings from earlier code are kept
// as aliases and normalized to canonical on write, so existing
// workspaces and old links keep working.

export type CanonicalPlan = 'free' | 'basic' | 'plus' | 'complete';

export interface PlanConfig {
  name: string;
  /** Monthly price in cents. */
  amount: number;
  /** Legacy credits limit (display compat only — nothing consumes
   *  credits; the enforced meter is the token budget). */
  creditsLimit: number;
  /** Monthly agent token budget (Phase 5 metering). */
  tokenBudget: number;
}

export const PLAN_CONFIGS: Record<CanonicalPlan, PlanConfig> = {
  free: { name: 'Free Plan', amount: 0, creditsLimit: 500, tokenBudget: 100_000 },
  basic: { name: 'Basic Plan', amount: 1900, creditsLimit: 5000, tokenBudget: 500_000 },
  plus: { name: 'Plus Plan', amount: 4900, creditsLimit: 25000, tokenBudget: 2_500_000 },
  complete: { name: 'Complete Plan', amount: 9900, creditsLimit: 100000, tokenBudget: 10_000_000 },
};

/** Legacy plan strings → canonical. Unknown strings fall back to free. */
const PLAN_ALIASES: Record<string, CanonicalPlan> = {
  free: 'free',
  basic: 'basic',
  starter: 'basic',
  plus: 'plus',
  pro: 'plus',
  complete: 'complete',
  ultra: 'complete',
  team: 'complete',
};

export function normalizePlan(plan: string | null | undefined): CanonicalPlan {
  if (!plan) return 'free';
  return PLAN_ALIASES[plan.toLowerCase()] ?? 'free';
}

/** True for canonical plans and legacy aliases (not for garbage). */
export function isKnownPlan(plan: string | null | undefined): boolean {
  if (!plan) return false;
  return plan.toLowerCase() in PLAN_ALIASES;
}

export function planConfig(plan: string | null | undefined): PlanConfig {
  return PLAN_CONFIGS[normalizePlan(plan)];
}

/** Tier rank for gating: free 0 < basic 1 < plus 2 < complete 3. */
export const PLAN_RANKS: Record<CanonicalPlan, number> = {
  free: 0,
  basic: 1,
  plus: 2,
  complete: 3,
};

export function planRank(plan: string | null | undefined): number {
  return PLAN_RANKS[normalizePlan(plan)];
}

/** Email marketing (campaigns) and automations (workflows) require
 *  Complete. Reads stay open; only creating/sending/running is gated. */
export const EMAIL_AND_AUTOMATION_PLAN: CanonicalPlan = 'complete';

export function meetsPlan(plan: string | null | undefined, required: CanonicalPlan): boolean {
  return planRank(plan) >= PLAN_RANKS[required];
}

/** A workspace qualifies for a first-time 1-week trial when it has
 *  never trialed and never held a subscription. */
export function qualifiesForTrial(workspace: {
  trialEndsAt?: Date | null;
  stripeSubscriptionId?: string | null;
}): boolean {
  return workspace.trialEndsAt == null && workspace.stripeSubscriptionId == null;
}

export const TRIAL_DAYS = 7;
