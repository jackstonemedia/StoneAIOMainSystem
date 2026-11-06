/**
 * AI Actions queue routes — Stone AIO
 *
 * Allows the AI assistant to propose actions that require human approval
 * before executing in the CRM.
 *
 * Routes:
 *   GET  /api/ai/actions              — List pending (and recent) AI actions
 *   POST /api/ai/actions/:id/approve  — Approve and execute a pending action
 *   POST /api/ai/actions/:id/reject   — Reject / discard a pending action
 */

import { Router, Request, Response } from 'express';
import { db } from '../../infrastructure/database/client.js';
import { executeTool } from './ai-executor.js';

import { trackLegacyAi } from '../services/legacy-ai-tracker.service.js';

const router = Router();
router.use(trackLegacyAi('legacy_ai_actions'));

// GET /api/ai/actions — list recent AI actions for this workspace
router.get('/', async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId || '';
  const status = (req.query.status as string) || undefined;

  try {
    const actions = await (db as any).aIAction.findMany({
      where: {
        workspaceId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json({ actions });
  } catch (err: any) {
    console.error('[AI Actions] list error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/actions/:id/approve — execute the action
router.post('/:id/approve', async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId || '';
  const userId = (req as any).userId || 'system';
  const { id } = req.params;

  try {
    const action = await (db as any).aIAction.findFirst({ where: { id, workspaceId } });
    if (!action) return res.status(404).json({ error: 'Action not found' });
    if (action.status !== 'pending') return res.status(400).json({ error: `Action is already ${action.status}` });

    // Atomically claim the row to prevent concurrent double-execution
    const claimRes = await (db as any).aIAction.updateMany({
      where: { id, workspaceId, status: 'pending' },
      data: { status: 'executing' },
    });
    if (claimRes.count === 0) {
      return res.status(409).json({ error: 'Action has already been approved, rejected, or is executing.' });
    }

    try {
      const result = await executeTool(workspaceId, action.toolName, action.args, userId);

      const updated = await (db as any).aIAction.update({
        where: { id },
        data: { status: 'approved', result },
      });

      return res.json({ action: updated, result });
    } catch (execErr: any) {
      await (db as any).aIAction.update({
        where: { id },
        data: { status: 'failed', result: { error: execErr.message } },
      }).catch(() => {});
      throw execErr;
    }
  } catch (err: any) {
    console.error('[AI Actions] approve error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/actions/:id/reject — discard without executing
router.post('/:id/reject', async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId || '';
  const { id } = req.params;

  try {
    const action = await (db as any).aIAction.findFirst({ where: { id, workspaceId } });
    if (!action) return res.status(404).json({ error: 'Action not found' });

    const updated = await (db as any).aIAction.update({
      where: { id },
      data: { status: 'rejected' },
    });

    return res.json({ action: updated });
  } catch (err: any) {
    console.error('[AI Actions] reject error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
