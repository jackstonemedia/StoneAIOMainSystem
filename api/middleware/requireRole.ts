/**
 * requireRole middleware
 *
 * Checks the authenticated user's role within the current workspace.
 * Must run AFTER the resolveWorkspace middleware (which sets req.workspaceId and req.userId).
 *
 * Usage:
 *   router.delete('/pipelines/:id', requireRole('admin'), handler);
 *   router.post('/members', requireRole('admin', 'owner'), handler);
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../../infrastructure/database/client.js';

export function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const workspaceId = (req as any).workspaceId as string | undefined;
    const userId      = (req as any).userId as string | undefined;

    if (!workspaceId || !userId) {
      res.status(401).json({ error: 'Unauthorized — workspace context missing' });
      return;
    }

    const member = await db.workspaceMember.findFirst({
      where: { workspaceId, userId },
      select: { role: true },
    });

    if (!member) {
      res.status(403).json({ error: 'Forbidden — not a member of this workspace' });
      return;
    }

    if (!roles.includes(member.role)) {
      res.status(403).json({
        error: 'Forbidden — insufficient permissions',
        required: roles,
        current: member.role,
      });
      return;
    }

    next();
  };
}
