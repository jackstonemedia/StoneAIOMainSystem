import { Request, Response, NextFunction } from 'express';
import { db } from '../../infrastructure/database/client.js';

/**
 * 2FA enforcement at sign-in — Tier 3 Tranche A, Fix 17.
 *
 * The TOTP machinery existed (UserTwoFactor + setup/verify endpoints) but
 * nothing ever consulted it at sign-in: enabling 2FA changed nothing.
 * This middleware runs after resolveWorkspace on every authenticated API
 * route (server.ts) and blocks the request until the current sign-in
 * session has passed the TOTP challenge:
 *
 * - Workspace requires 2FA (`requireTwoFactor`) and the user has none
 *   configured → 403 { error: '2FA_SETUP_REQUIRED' }.
 * - User has 2FA enabled and this session has no fresh verification row
 *   → 403 { error: '2FA_REQUIRED' }.
 * - Otherwise (no 2FA, or a verified session) → next().
 *
 * The frontend's TwoFactorGate shows the challenge / setup screen on those
 * 403s. A verification row is fresh for 12h; a fresh sign-in gets a fresh
 * Clerk session id, so it must pass the challenge again regardless.
 *
 * Exemptions (this must never lock the user out of verifying):
 * - The /settings/2fa/* endpoints themselves (status/setup/verify/challenge).
 * - The public widget (/widget/*): token-authenticated, no user session.
 * - Requests with no resolved user (OAuth callbacks, form capture, dev seed).
 */

// A verification stays valid for 12h within a long-lived session.
export const TWO_FACTOR_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** The Clerk JWT `sid` for this request, or the dev-bypass stand-in. */
export function getSessionId(req: Request): string | null {
  const auth = req.headers?.authorization;
  const token = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
      if (typeof payload.sid === 'string' && payload.sid) return payload.sid;
    } catch { /* not a parseable JWT — fall through to the dev stand-in */ }
  }
  // Dev-bypass mode (no Clerk token, non-production): one local session per
  // user. Production always has a token here, so this never fires there.
  if (process.env.NODE_ENV !== 'production' && (req as any).userId) {
    return `dev:${(req as any).userId}`;
  }
  return null;
}

export async function isSessionTwoFactorVerified(req: Request): Promise<boolean> {
  const userId = (req as any).userId as string | undefined;
  const sessionId = getSessionId(req);
  if (!userId || !sessionId) return false;
  const row = await db.twoFactorSession.findUnique({ where: { sessionId } });
  if (!row || row.userId !== userId) return false;
  return Date.now() - new Date(row.verifiedAt).getTime() < TWO_FACTOR_SESSION_TTL_MS;
}

export async function requireTwoFactorVerified(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).userId as string | undefined;
  const workspaceId = (req as any).workspaceId as string | undefined;
  // No resolved user (OAuth callbacks, public form capture, dev seed) — the
  // gate has nobody to check. Those paths authenticate another way.
  if (!userId || !workspaceId) return next();
  // The 2FA endpoints must stay reachable or nobody can ever verify.
  // req.path here is the path after the /api mount point.
  if (req.path.startsWith('/settings/2fa/')) return next();
  // The public widget is token-authenticated for website visitors, not a
  // user session — it never goes through the sign-in gate.
  if (req.path.startsWith('/widget/')) return next();

  try {
    const [twoFactor, workspace] = await Promise.all([
      db.userTwoFactor.findUnique({ where: { userId } }),
      db.workspace.findUnique({ where: { id: workspaceId }, select: { requireTwoFactor: true } }),
    ]);
    if (workspace?.requireTwoFactor && !twoFactor?.enabled) {
      return res.status(403).json({ error: '2FA_SETUP_REQUIRED' });
    }
    if (twoFactor?.enabled && !(await isSessionTwoFactorVerified(req))) {
      return res.status(403).json({ error: '2FA_REQUIRED' });
    }
    return next();
  } catch (e) {
    console.error('[requireTwoFactor]', e);
    return res.status(500).json({ error: 'Failed to check two-factor status' });
  }
}
