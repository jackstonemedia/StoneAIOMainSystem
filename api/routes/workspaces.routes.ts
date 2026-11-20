/**
 * Workspace switching — complete-platform item 4.
 *
 * Before this, resolveWorkspace pinned the user to whichever membership
 * findFirst returned: a user joining a second workspace (invite accept)
 * silently landed in the wrong one, and there was no way to create or pick
 * a workspace. These routes list the user's workspaces and create new ones;
 * the selection itself travels as an `x-workspace-id` header (see
 * api/middleware/workspace.ts) and is stored client-side in localStorage.
 */
import { Router } from 'express';
import { db } from '../../infrastructure/database/client.js';

const router = Router();

// ── List the user's workspaces ──────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const memberships = await db.workspaceMember.findMany({
      where: { userId: req.userId },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(
      memberships.map((m: any) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        plan: m.workspace.plan,
        role: m.role,
        isCurrent: m.workspaceId === req.workspaceId,
        createdAt: m.workspace.createdAt,
      })),
    );
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Create a workspace ──────────────────────────────────────────────────────
// The creator is owner + admin. Plan starts 'free', like auto-provisioning.
// The client selects the new workspace (and reloads) after a 201.
router.post('/', async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) return res.status(400).json({ error: 'Workspace name is required' });
    if (name.length > 100) return res.status(400).json({ error: 'Workspace name must be 100 characters or fewer' });

    const userId = req.userId!;
    const workspace = await db.$transaction(async (tx: any) => {
      const ws = await tx.workspace.create({
        data: { name, ownerId: userId, plan: 'free' },
      });
      await tx.workspaceMember.create({
        data: { workspaceId: ws.id, userId, role: 'admin' },
      });
      return ws;
    });

    res.status(201).json({ id: workspace.id, name: workspace.name, plan: workspace.plan, role: 'admin', isCurrent: false });
  } catch (e) {
    console.error('[Workspaces] Create error:', e);
    res.status(500).json({ error: 'Could not create workspace' });
  }
});

export default router;
