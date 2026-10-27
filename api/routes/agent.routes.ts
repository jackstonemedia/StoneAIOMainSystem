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

  try {
    await runAgentTurn(
      { workspaceId, userId, message, route, history, conversationId },
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

export default router;
