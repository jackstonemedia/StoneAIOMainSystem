/**
 * GDPR — complete-platform item 5.
 *
 * - GET  /api/gdpr/export            workspace data export (admin+), one JSON download
 * - POST /api/gdpr/workspace/delete  delete the workspace + its data (owner only, typed-name confirm)
 * - POST /api/gdpr/account/delete    delete the person's account + personal data (typed DELETE)
 *
 * Nothing here pretends: a missing confirm, a wrong role, or a missing
 * account fails with a plain-words error and deletes nothing.
 */
import { Router } from 'express';
import { requireRole } from '../middleware/requireRole.js';
import { buildWorkspaceExport } from '../services/gdpr/export.service.js';
import { deleteWorkspaceWithCounts, deleteAccount } from '../services/gdpr/delete.service.js';

const router = Router();

// ── Workspace export — one JSON download, all modules ───────────────────────
router.get('/export', requireRole('admin', 'owner'), async (req, res) => {
  try {
    const exported = await buildWorkspaceExport(req.workspaceId!);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="stone-aio-export-${exported.workspace.id}-${stamp}.json"`,
    );
    res.send(JSON.stringify(exported, null, 2));
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'Export failed' });
  }
});

// ── Workspace delete — owner only, type the name exactly ────────────────────
router.post('/workspace/delete', async (req, res) => {
  try {
    const result = await deleteWorkspaceWithCounts(
      req.workspaceId!,
      req.userId!,
      typeof req.body?.confirmName === 'string' ? req.body.confirmName : '',
    );
    res.json(result);
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e?.message ?? 'Workspace deletion failed' });
  }
});

// ── Account delete — the caller themself, type DELETE ───────────────────────
router.post('/account/delete', async (req, res) => {
  try {
    if (req.body?.confirm !== 'DELETE') {
      return res.status(400).json({ error: 'Type DELETE exactly to confirm account deletion' });
    }
    const deleteClerkUser = process.env.CLERK_SECRET_KEY
      ? async (clerkId: string) => {
          const { clerkClient } = await import('@clerk/express');
          await clerkClient.users.deleteUser(clerkId);
        }
      : undefined;
    const result = await deleteAccount(req.userId!, deleteClerkUser);
    res.json(result);
  } catch (e: any) {
    res.status(e?.status ?? 500).json({ error: e?.message ?? 'Account deletion failed' });
  }
});

export default router;
