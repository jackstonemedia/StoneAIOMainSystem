// Plan gate middleware — enforces tier access server-side.
// Reads the workspace plan (canonicalized via plans.ts) and rejects
// below-rank workspaces with 403 + PLAN_REQUIRED so the client can
// prompt an upgrade. Reads are never gated by this middleware; route
// files apply it to mutating routes (or to non-GET methods).
//
// Tier 2 fix 3: a workspace whose subscription is past_due,
// incomplete_expired, or unpaid is treated as Free for gating
// purposes. The stored plan stays until Stripe confirms
// subscription.deleted, but paid features stop. The denial names the
// billing status in plain words, in the same style as the
// token-budget gate message.
import type { Request, Response, NextFunction } from 'express';
import { db } from '../../infrastructure/database/client.js';
import { meetsPlan, normalizePlan, type CanonicalPlan } from '../services/billing/plans.js';

/** Subscription statuses that suspend paid access until resolved. */
const BLOCKED_SUBSCRIPTION_STATUSES = new Set(['past_due', 'incomplete_expired', 'unpaid']);

export function isBillingBlockedStatus(status: string | null | undefined): boolean {
  return !!status && BLOCKED_SUBSCRIPTION_STATUSES.has(status);
}

/** The plan gating sees: a blocked billing status reads as Free. */
export function effectivePlanForGating(
  plan: string | null | undefined,
  subscriptionStatus: string | null | undefined,
): CanonicalPlan {
  if (isBillingBlockedStatus(subscriptionStatus)) return 'free';
  return normalizePlan(plan);
}

function blockedStatusMessage(status: string): string {
  const label =
    status === 'past_due'
      ? 'past due'
      : status === 'incomplete_expired'
        ? 'incomplete'
        : 'unpaid';
  return `Your subscription is ${label}. Update your payment method to restore access to paid features.`;
}

export function requirePlan(required: CanonicalPlan) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspaceId = (req as any).workspaceId;
      if (!workspaceId) {
        return res.status(401).json({ error: 'Workspace context required' });
      }
      const ws = await (db as any).workspace.findUnique({
        where: { id: workspaceId },
        select: { plan: true, subscriptionStatus: true },
      });
      const effective = effectivePlanForGating(ws?.plan, ws?.subscriptionStatus);
      if (!meetsPlan(effective, required)) {
        const blocked = isBillingBlockedStatus(ws?.subscriptionStatus);
        const status = ws?.subscriptionStatus as string | undefined;
        return res.status(403).json({
          error: blocked && status
            ? blockedStatusMessage(status)
            : `This feature requires the ${required} plan or higher.`,
          code: 'PLAN_REQUIRED',
          requiredPlan: required,
          currentPlan: effective,
          ...(blocked && status ? { subscriptionStatus: status } : {}),
        });
      }
      return next();
    } catch (err: any) {
      console.error('[PlanGuard] Error:', err);
      return res.status(500).json({ error: err.message || 'Plan check failed.' });
    }
  };
}

/** Service-level equivalent for code paths without req/res (agent
 *  tools, cron jobs). Throws an Error with PLAN_REQUIRED in it. */
export async function assertPlan(workspaceId: string, required: CanonicalPlan): Promise<void> {
  const ws = await (db as any).workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true, subscriptionStatus: true },
  });
  const effective = effectivePlanForGating(ws?.plan, ws?.subscriptionStatus);
  if (!meetsPlan(effective, required)) {
    const blocked = isBillingBlockedStatus(ws?.subscriptionStatus);
    const status = ws?.subscriptionStatus as string | undefined;
    const message =
      blocked && status
        ? blockedStatusMessage(status)
        : `This feature requires the ${required} plan or higher.`;
    const err = new Error(`${message} (PLAN_REQUIRED)`);
    (err as any).code = 'PLAN_REQUIRED';
    throw err;
  }
}
