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
  console.log(`[resolveWorkspace] Processing request for ${req.path}`);
  try {
    // ── Dev bypass ────────────────────────────────────────────────────────────
    if (!process.env.CLERK_SECRET_KEY) {
      console.log(`[resolveWorkspace] ⚠️ WARNING: CLERK_SECRET_KEY is MISSING. Using dev bypass.`);
      req.userId = 'test_user_new';
      // We fall through to check for workspace membership even in dev mode
      // so we can test the auto-provisioning logic.
    } else {
      console.log(`[resolveWorkspace] 🔒 CLERK_SECRET_KEY is present. Verifying token...`);
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
        console.log(`[resolveWorkspace] ✅ Token verified. Clerk User ID (sub): ${userId}`);
      } catch (err: any) {
        console.error(`[resolveWorkspace] ❌ Token verification failed:`, err.message);
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      req.userId = userId;
    }

    const userId = req.userId!;

    // ── Look up workspace via WorkspaceMember ─────────────────────────────────
    const member = await db.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
    });

    if (!member) {
      console.log(`[resolveWorkspace] New user detected (${userId}). Initializing workspace and n8n...`);

      try {
        // ── Atomic initialization of User, Workspace, and Membership ───────────
        const result = await db.$transaction(async (tx) => {
          // 1. Ensure User record exists
          await tx.user.upsert({
            where: { clerkId: userId },
            update: {},
            create: { clerkId: userId },
          });

          // 2. Create default workspace for the user
          const workspace = await tx.workspace.create({
            data: {
              name: 'My Stone AIO Workspace',
              ownerId: userId,
              plan: 'pro',
            },
          });

          // 3. Establish membership as admin
          await tx.workspaceMember.create({
            data: {
              workspaceId: workspace.id,
              userId: userId,
              role: 'admin',
            },
          });

          return { workspaceId: workspace.id };
        });


        req.workspaceId = result.workspaceId;
        return next();
      } catch (err: any) {
        console.error('[resolveWorkspace] Initialization failed:', err.message);
        return res.status(500).json({ error: 'Failed to initialize user workspace' });
      }
    }

    req.workspaceId = member.workspaceId;
    console.log(`[resolveWorkspace] Resolved: ${userId} -> ${member.workspaceId} (${req.path})`);
    next();
  } catch (error) {
    console.error('[resolveWorkspace] Error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}
