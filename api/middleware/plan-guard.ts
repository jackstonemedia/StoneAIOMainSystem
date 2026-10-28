// Plan gate middleware — enforces tier access server-side.
// Reads the workspace plan (canonicalized via plans.ts) and rejects
// below-rank workspaces with 403 + PLAN_REQUIRED so the client can
// prompt an upgrade. Reads are never gated by this middleware; route
// files apply it to mutating routes (or to non-GET methods).
import type { Request, Response, NextFunction } from 'express';
import { db } from '../../infrastructure/database/client.js';
import { meetsPlan, type CanonicalPlan } from '../services/billing/plans.js';

export function requirePlan(required: CanonicalPlan) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspaceId = (req as any).workspaceId;
      if (!workspaceId) {
        return res.status(401).json({ error: 'Workspace context required' });
      }
      const ws = await (db as any).workspace.findUnique({
        where: { id: workspaceId },
        select: { plan: true },
      });
      if (!meetsPlan(ws?.plan ?? 'free', required)) {
        return res.status(403).json({
          error: `This feature requires the ${required} plan or higher.`,
          code: 'PLAN_REQUIRED',
          requiredPlan: required,
          currentPlan: ws?.plan ?? 'free',
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
    select: { plan: true },
  });
  if (!meetsPlan(ws?.plan ?? 'free', required)) {
    const err = new Error(`This feature requires the ${required} plan or higher. (PLAN_REQUIRED)`);
    (err as any).code = 'PLAN_REQUIRED';
    throw err;
  }
}
