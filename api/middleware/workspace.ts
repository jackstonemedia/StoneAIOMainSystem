import { Request, Response, NextFunction } from 'express';
import { db } from '../../infrastructure/database/client.js';

/**
 * Resolves the workspaceId for the incoming request.
 *
 * Dev mode  (no CLERK_SECRET_KEY): uses a hardcoded dev workspace so local
 *           development works without Clerk credentials.
 *
 * Prod mode: verifies the Clerk JWT from the Authorization header, extracts
 *            the userId, then looks up the user's workspace via WorkspaceMember.
 */
export async function resolveWorkspace(req: Request, res: Response, next: NextFunction) {
  try {
    // ── Dev bypass ────────────────────────────────────────────────────────────
    if (!process.env.CLERK_SECRET_KEY) {
      req.workspaceId = 'workspace_123';
      req.userId = 'user_123';
      return next();
    }

    // ── Validate Authorization header ─────────────────────────────────────────
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split(' ')[1];

    // ── Verify Clerk JWT server-side ──────────────────────────────────────────
    const { verifyToken } = await import('@clerk/express');

    let userId: string;
    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
      userId = payload.sub;
    } catch {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.userId = userId;

    // ── Look up workspace via WorkspaceMember ─────────────────────────────────
    const member = await db.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
    });

    if (!member) {
      return res.status(401).json({ error: 'User does not belong to any workspace' });
    }

    req.workspaceId = member.workspaceId;
    next();
  } catch (error) {
    console.error('[resolveWorkspace] Error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}
