/**
 * Workspace invite accept flow — Tier 1 Fix 9.
 *
 * Two routers from one file, mounted at the same path in server.ts:
 * - publicInvitesRouter is mounted BEFORE resolveWorkspace (like the public
 *   booking router): GET /:token only reveals the workspace name, the
 *   invited email and the role for a valid token — the invitee may not have
 *   an account yet, so this lookup must work unauthenticated.
 * - invitesRouter is mounted AFTER resolveWorkspace: POST /:token/accept
 *   needs the accepter's Clerk user id (req.userId) and creates the real
 *   WorkspaceMember in the invite's workspace.
 *
 * The token is the credential (32 random chars via nanoid). No email match
 * is enforced: whoever holds the link can join, the same as Slack/Notion
 * invite links.
 */
import { Router, Request, Response } from 'express';
import { db } from '../../infrastructure/database/client.js';

async function findLiveInvite(token: string) {
  const invite = await db.workspaceInvite.findUnique({ where: { token } });
  if (!invite) return { invite: null, error: { status: 404, message: 'This invite link is not valid.' } };
  if (invite.acceptedAt) return { invite: null, error: { status: 409, message: 'This invite has already been accepted.' } };
  if (invite.expiresAt <= new Date()) return { invite: null, error: { status: 410, message: 'This invite has expired. Ask a workspace admin to send a new one.' } };
  return { invite, error: null };
}

// ── Public: invite lookup (no auth) ──────────────────────────────────────────
export const publicInvitesRouter = Router();

publicInvitesRouter.get('/:token', async (req: Request, res: Response) => {
  try {
    const { invite, error } = await findLiveInvite(req.params.token);
    if (error || !invite) return res.status(error?.status ?? 404).json({ error: error?.message ?? 'Invite not found' });
    const ws = await db.workspace.findUnique({ where: { id: invite.workspaceId }, select: { name: true } });
    res.json({
      email: invite.email,
      role: invite.role,
      workspaceName: ws?.name || 'Stone AIO',
      expiresAt: invite.expiresAt,
    });
  } catch (e) {
    console.error('[Invites] Lookup error:', e);
    res.status(500).json({ error: 'Could not look up this invite.' });
  }
});

// ── Authed: accept (resolveWorkspace supplies req.userId) ────────────────────
export const invitesRouter = Router();

invitesRouter.post('/:token/accept', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Sign in to accept this invite.' });
    const { invite, error } = await findLiveInvite(req.params.token);
    if (error || !invite) return res.status(error?.status ?? 404).json({ error: error?.message ?? 'Invite not found' });

    const existing = await db.workspaceMember.findFirst({
      where: { workspaceId: invite.workspaceId, userId },
    });
    if (existing) {
      return res.status(409).json({ error: 'You are already a member of this workspace.', workspaceId: invite.workspaceId });
    }

    await db.workspaceMember.create({
      data: { workspaceId: invite.workspaceId, userId, role: invite.role },
    });
    await db.workspaceInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
    res.json({ success: true, workspaceId: invite.workspaceId, role: invite.role });
  } catch (e) {
    console.error('[Invites] Accept error:', e);
    res.status(500).json({ error: 'Could not accept this invite.' });
  }
});

export default invitesRouter;
