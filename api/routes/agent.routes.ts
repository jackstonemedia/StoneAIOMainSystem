// Phase 2 (AI Agent) — agent service routes.
// POST /api/agent/chat streams the new service (same SSE contract as
// /api/ai/chat). The old route stays mounted and working; the panel
// switches to this one, and switching back is one line.
import { Router, Request, Response } from 'express';
import { db } from '../../infrastructure/database/client.js';
import { runAgentTurn } from '../services/agent/service.js';
import {
  getAgentSettings,
  setAgentSettings,
  listGrants,
  revokeGrant,
} from '../services/agent/modes.js';
import {
  listConversations,
  getConversationHistory,
} from '../services/agent/conversations.js';
import {
  listMemories,
  createMemory,
  updateMemory,
  deleteMemory,
} from '../services/agent/memories.js';
import {
  checkBudget,
  getUsage,
} from '../services/agent/metering.js';

const router = Router();

// POST /api/agent/chat — SSE streaming agent turn
router.post('/chat', async (req: Request, res: Response) => {
  const { message, route, history, conversationId } = req.body as {
    message?: string;
    route?: string;
    history?: { role: string; content: string }[];
    conversationId?: string;
  };
  const workspaceId = (req as any).workspaceId || '';
  const userId = (req as any).userId || 'system';

  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const writeChunk = (text: string) => {
    res.write(`data: ${JSON.stringify({ text })}\n\n`);
  };

  // Phase 5: the dev-only eval header matched exactly when it equals
  // the resolved workspace — and only outside production. The bypass
  // skips the budget BLOCK for eval turns; usage is still recorded.
  const meteringBypass =
    process.env.NODE_ENV !== 'production' &&
    req.headers['x-eval-workspace'] === workspaceId;

  try {
    await runAgentTurn(
      { workspaceId, userId, message, route, history, conversationId, meteringBypass },
      {
        onText: writeChunk,
        onProposal: (action) => res.write(`data: ${JSON.stringify({ action_proposal: action })}\n\n`),
        onConversation: (id) => res.write(`data: ${JSON.stringify({ conversation_id: id })}\n\n`),
      },
    );
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    console.error('[Agent Chat Error]', err);
    res.write(`data: ${JSON.stringify({ error: err.message || 'AI error' })}\n\n`);
    res.end();
  }
});

// GET /api/agent/conversations — persisted conversations for this user
router.get('/conversations', async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId || '';
  const userId = (req as any).userId || 'system';
  try {
    const conversations = await listConversations(db, workspaceId, userId);
    return res.json({ conversations });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/conversations — create a conversation (panel flow:
// create first, then chat with its id so turns persist)
router.post('/conversations', async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId || '';
  const userId = (req as any).userId || 'system';
  try {
    const conversation = await db.agentConversation.create({
      data: { workspaceId, userId },
    });
    return res.json({ conversation });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/conversations/:id — history (empty when missing/foreign)
router.get('/conversations/:id', async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId || '';
  try {
    const messages = await getConversationHistory(db, workspaceId, req.params.id);
    return res.json({ messages });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/settings — mode + display name
router.get('/settings', async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId || '';
  try {
    return res.json(await getAgentSettings(db, workspaceId));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/agent/settings — mode and/or display name
router.patch('/settings', async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId || '';
  try {
    const settings = await setAgentSettings(db, workspaceId, {
      mode: req.body.mode,
      name: req.body.name,
    });
    return res.json(settings);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// GET /api/agent/usage — Phase 5: this month's token usage + budget
router.get('/usage', async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId || '';
  try {
    const check = await checkBudget(db, workspaceId);
    const usage = await getUsage(db, workspaceId, check.month);
    return res.json({
      month: check.month,
      plan: check.plan,
      budget: check.budget,
      used: check.used,
      input: usage.input,
      output: usage.output,
      remaining: Math.max(0, check.budget - check.used),
      pct: check.pct,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/agent/grants — live autonomy grants
router.get('/grants', async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId || '';
  try {
    return res.json({ grants: await listGrants(db, workspaceId) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/agent/grants/:id — revoke a grant
router.delete('/grants/:id', async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId || '';
  try {
    const revoked = await revokeGrant(db, workspaceId, req.params.id);
    if (!revoked) return res.status(404).json({ error: 'Grant not found' });
    return res.json({ revoked: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Phase 3: memories — workspace-scoped, user-attributed. No endpoint
// serves a memory outside its workspace (404 for foreign ids).

// GET /api/agent/memories — list, newest first
router.get('/memories', async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId || '';
  try {
    return res.json({ memories: await listMemories(db, workspaceId) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/memories — create ({ content, kind? })
router.post('/memories', async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId || '';
  const userId = (req as any).userId || 'system';
  try {
    const memory = await createMemory(db, workspaceId, userId, req.body.kind ?? 'fact', req.body.content ?? '');
    return res.json({ memory });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// PATCH /api/agent/memories/:id — edit content and/or kind
router.patch('/memories/:id', async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId || '';
  try {
    const memory = await updateMemory(db, workspaceId, req.params.id, {
      content: req.body.content,
      kind: req.body.kind,
    });
    if (!memory) return res.status(404).json({ error: 'Memory not found' });
    return res.json({ memory });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// DELETE /api/agent/memories/:id — delete by id (no fuzzy chat delete)
router.delete('/memories/:id', async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId || '';
  try {
    const deleted = await deleteMemory(db, workspaceId, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Memory not found' });
    return res.json({ deleted: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
