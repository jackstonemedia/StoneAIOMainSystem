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

const router = Router();

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

    const result = await executeTool(workspaceId, action.toolName, action.args, userId);

    const updated = await (db as any).aIAction.update({
      where: { id },
      data: { status: 'approved', result },
    });

    // Phase 2: audit every approved execution, and grant the tool when
    // the workspace is in Autonomy mode (sends/publishing never grant).
    // Non-fatal: an audit/grant failure must never undo the approval.
    try {
      const ws = await db.workspace.findUnique({
        where: { id: workspaceId },
        select: { agentMode: true },
      });
      const mode =
        ws?.agentMode === 'autonomy'
          ? 'autonomy'
          : ws?.agentMode === 'read-only'
            ? 'read-only'
            : 'approve';
      await db.agentAuditLog.create({
        data: {
          workspaceId,
          userId,
          toolName: action.toolName,
          args: (action.args ?? {}) as object,
          result:
            result === undefined || result === null
              ? undefined
              : JSON.parse(JSON.stringify(result)),
          mode,
          granted: false,
        },
      });
      if (mode === 'autonomy') {
        const { grantTool } = await import('../services/agent/modes.js');
        await grantTool(db, workspaceId, action.toolName, userId);
      }
    } catch (auditErr: any) {
      console.error('[AI Actions] audit/grant error (non-fatal):', auditErr.message);
    }

    return res.json({ action: updated, result });
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
