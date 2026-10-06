/**
 * Tenant Guard & Role Authorization Middleware — Stone AIO
 *
 * Implements strict tenant-scoped queries and role-based authorization to prevent:
 * - Cross-tenant IDOR access (C1, C3, C5)
 * - Privilege escalation on workspace settings, team members, and billing (C8)
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../../infrastructure/database/client.js';
import { AppError } from './error.js';

/**
 * Scoped query helper ensuring that any record lookup is strictly bounded by workspaceId.
 * If the record does not exist or belongs to another tenant, throws an AppError with statusCode 404.
 */
export async function scopedFindOrThrow<T = any>(
  model: { findFirst: (args: any) => Promise<T | null> },
  idOrWhere: string | Record<string, any>,
  workspaceId: string,
  options?: {
    select?: any;
    include?: any;
    errorMessage?: string;
  }
): Promise<T> {
  if (!idOrWhere || !workspaceId) {
    throw new AppError(404, options?.errorMessage || 'Resource not found', 'NOT_FOUND');
  }

  const where = typeof idOrWhere === 'string'
    ? { id: idOrWhere, workspaceId }
    : { ...idOrWhere, workspaceId };

  const record = await model.findFirst({
    where,
    ...(options?.select ? { select: options.select } : {}),
    ...(options?.include ? { include: options.include } : {}),
  });

  if (!record) {
    throw new AppError(404, options?.errorMessage || 'Resource not found', 'NOT_FOUND');
  }

  return record;
}

/**
 * Specifically finds a PipelineStage verified against the caller's workspaceId
 * via its parent Pipeline relation.
 */
export async function findScopedStageOrThrow(
  stageId: string,
  workspaceId: string,
  options?: { include?: any; select?: any; errorMessage?: string }
) {
  if (!stageId || !workspaceId) {
    throw new AppError(404, options?.errorMessage || 'Pipeline stage not found', 'NOT_FOUND');
  }

  const stage = await db.pipelineStage.findFirst({
    where: {
      id: stageId,
      pipeline: { workspaceId },
    },
    ...(options?.select ? { select: options.select } : {}),
    ...(options?.include ? { include: options.include } : {}),
  });

  if (!stage) {
    throw new AppError(404, options?.errorMessage || 'Pipeline stage not found', 'NOT_FOUND');
  }

  return stage;
}

/**
 * Role-based authorization middleware.
 * Ensures the authenticated user holds one of the specified roles in the current workspace.
 * 'owner' role always satisfies 'admin' requirement.
 */
export function requireRole(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const workspaceId = (req as any).workspaceId as string | undefined;
    const userId      = (req as any).userId as string | undefined;

    if (!workspaceId || !userId) {
      res.status(401).json({ error: 'Unauthorized — workspace context missing' });
      return;
    }

    let effectiveRole = (req as any).userRole as string | undefined;

    if (!effectiveRole) {
      const member = await db.workspaceMember?.findFirst?.({
        where: { workspaceId, userId },
        select: { role: true },
      });
      effectiveRole = member?.role;
    }

    // Fallback: check if user is the direct workspace owner
    if (!effectiveRole) {
      const ws = await db.workspace?.findUnique?.({
        where: { id: workspaceId },
        select: { ownerId: true },
      });
      if (ws && ws.ownerId === userId) {
        effectiveRole = 'owner';
      }
    }

    if (!effectiveRole) {
      res.status(403).json({ error: 'Forbidden — not a member of this workspace' });
      return;
    }

    // 'owner' always satisfies 'admin' role requirement
    const matches = allowedRoles.includes(effectiveRole) || (effectiveRole === 'owner' && allowedRoles.includes('admin'));

    if (!matches) {
      res.status(403).json({
        error: 'Forbidden — insufficient permissions',
        required: allowedRoles,
        current: effectiveRole,
      });
      return;
    }

    (req as any).userRole = effectiveRole;
    next();
  };
}
