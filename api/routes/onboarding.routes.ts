import { Router } from 'express';
import { db } from '../../infrastructure/database/client.js';

const router = Router();

// Complete-platform item 6 — onboarding.
// The server decides whether this login should see onboarding; the client
// (AppShell) just navigates on `shouldRedirect`. The rule is deliberately
// narrow: ONLY the workspace owner, and ONLY while the flag is unset.
// Invitees are members, never owners, so they are never redirected.
// "Fresh" is not a time condition — the flag is the only state. A
// pre-existing workspace with a null flag redirects once after this ships;
// Skip / completion ends it for good.
router.get('/status', async (req, res) => {
  try {
    const ws = await db.workspace.findUnique({ where: { id: req.workspaceId } });
    if (!ws) return res.json({ shouldRedirect: false, workspaceId: req.workspaceId, workspaceName: null });
    const shouldRedirect = ws.ownerId === (req as any).userId && ws.onboardingCompletedAt == null;
    res.json({ shouldRedirect, workspaceId: ws.id, workspaceName: ws.name });
  } catch (e) {
    console.error('[Onboarding status]', e);
    res.json({ shouldRedirect: false, workspaceId: req.workspaceId, workspaceName: null });
  }
});

// Mark onboarding done for the current workspace. Owner only — a non-owner
// who opens /onboarding directly must not be able to mark someone else's
// workspace complete. Skip and finish both land here.
router.post('/complete', async (req, res) => {
  try {
    const ws = await db.workspace.findUnique({ where: { id: req.workspaceId } });
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    if (ws.ownerId !== (req as any).userId) {
      return res.status(403).json({ error: 'Only the workspace owner can complete onboarding' });
    }
    const updated = await db.workspace.update({
      where: { id: req.workspaceId },
      data: { onboardingCompletedAt: new Date() },
    });
    res.json({ completed: true, onboardingCompletedAt: updated.onboardingCompletedAt });
  } catch (e) {
    console.error('[Onboarding complete]', e);
    res.status(500).json({ error: String(e) });
  }
});

export default router;
