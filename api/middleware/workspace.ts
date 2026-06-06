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
  if (process.env.NODE_ENV !== 'production') console.log(`[resolveWorkspace] Processing request for ${req.path}`);
  try {
    // ── OAuth callback bypass — browser redirects from Google/Microsoft ────────
    // These don't carry JWT tokens; they authenticate via the signed state param.
    if (req.path.match(/\/channels\/(gmail|outlook)\/callback/)) {
      if (process.env.NODE_ENV !== 'production') console.log(`[resolveWorkspace] Skipping JWT for OAuth callback: ${req.path}`);
      return next();
    }

    // ── Dev bypass ────────────────────────────────────────────────────────────
    if (!process.env.CLERK_SECRET_KEY) {
      if (process.env.NODE_ENV !== 'production') console.log(`[resolveWorkspace] ⚠️ WARNING: CLERK_SECRET_KEY is MISSING. Using dev bypass.`);
      req.userId = 'test_user_new';
      // We fall through to check for workspace membership even in dev mode
      // so we can test the auto-provisioning logic.
    } else {
      if (process.env.NODE_ENV !== 'production') console.log(`[resolveWorkspace] 🔒 CLERK_SECRET_KEY is present. Verifying token...`);
      // ── Validate Authorization header (or ?token= query param for SSE) ──────
      // EventSource cannot set custom headers, so SSE clients pass the JWT as a
      // query param. Accept it as a fallback only — never for mutating requests.
      const authHeader = req.headers.authorization;
      const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
      const rawToken = authHeader?.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : queryToken;

      if (!rawToken) {
        // In non-production, fall back to dev bypass even if CLERK_SECRET_KEY is set.
        if (process.env.NODE_ENV !== 'production') {
          console.log('[resolveWorkspace] Dev mode & no token. Falling back to dev bypass user.');
          req.userId = 'test_user_new';
        } else {
          return res.status(401).json({ error: 'Missing or invalid Authorization header' });
        }
      } else {
        const token = rawToken;

        // ── Verify Clerk JWT server-side ──────────────────────────────────────
        const { verifyToken } = await import('@clerk/express');

        let userId: string;
        try {
          const payload = await verifyToken(token, {
            secretKey: process.env.CLERK_SECRET_KEY,
          });
          userId = payload.sub;
          if (process.env.NODE_ENV !== 'production') console.log(`[resolveWorkspace] ✅ Token verified. Clerk User ID (sub): ${userId}`);
        } catch (err: any) {
          console.error(`[resolveWorkspace] ❌ Token verification failed:`, err.message);
          return res.status(401).json({ error: 'Invalid or expired token' });
        }

        req.userId = userId;
      }
    }

    const userId = req.userId!;

    // ── Look up workspace via WorkspaceMember ─────────────────────────────────
    const member = await db.workspaceMember.findFirst({
      where: { userId },
      select: { workspaceId: true },
    });

    if (!member) {
      if (process.env.NODE_ENV !== 'production') console.log(`[resolveWorkspace] New user detected (${userId}). Initializing workspace...`);

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
    if (process.env.NODE_ENV !== 'production') console.log(`[resolveWorkspace] Resolved: ${userId} -> ${member.workspaceId} (${req.path})`);
    next();
  } catch (error) {
    console.error('[resolveWorkspace] Error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}
