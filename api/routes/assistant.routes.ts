/**
 * Assistant Routes — Stone AIO
 * Spec Section 2.7
 */

import { Router, Request, Response, NextFunction } from 'express';
import { assistantRepo } from '../services/assistant/assistant.repo.js';
import { assistantOrchestrator } from '../services/assistant/orchestrator.js';
import { chatEngine } from '../../packages/ai/engine/chat-engine.js';
import { buildSystemPrompt } from '../../packages/ai/prompts/assistant.v1.js';
import { toolRegistry } from '../services/assistant/tools/registry.js';
import { hasMinimumRole, getEffectiveMode, type AccessMode } from '../services/assistant/modes.js';
import { sanitizeSecrets } from '../services/assistant/tools/sanitizer.js';
import { memoryService } from '../services/assistant/memory.service.js';
import { scheduledTaskService } from '../services/assistant/scheduled-task.service.js';
import { projectService } from '../services/assistant/project.service.js';
import { db } from '../../infrastructure/database/client.js';
import { checkAssistantBudget, recordUsage } from '../services/agent/metering.js';

const router = Router();

// ── GET /conversations — list caller's conversations ─────────────────────────
router.get('/conversations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const { cursor, q, projectId, limit } = req.query as {
      cursor?: string;
      q?: string;
      projectId?: string;
      limit?: string;
    };

    const result = await assistantRepo.listConversations(workspaceId, userId, {
      cursor,
      q,
      projectId,
      limit: limit ? parseInt(limit, 10) : 30,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── POST /conversations — create a new conversation ──────────────────────────
router.post('/conversations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const { title, projectId, mode, thinking } = req.body;

    const convo = await assistantRepo.createConversation(workspaceId, userId, {
      title,
      projectId,
      mode,
      thinking,
    });

    res.json(convo);
  } catch (err) {
    next(err);
  }
});

// ── GET /conversations/:id — read conversation with messages ─────────────────
router.get('/conversations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const convo = await assistantRepo.getConversation(workspaceId, userId, req.params.id);

    if (!convo) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(convo);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /conversations/:id — rename, pin, move, set mode/thinking ──────────
router.patch('/conversations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const { title, projectId, pinnedAt, mode, thinking } = req.body;

    if (mode && mode !== 'unset') {
      const wsSettings = await assistantRepo.getWorkspaceSettings(workspaceId);
      const effective = getEffectiveMode(mode as AccessMode, wsSettings.maxMode as AccessMode);
      if (effective !== mode) {
        return res.status(400).json({
          error: `Cannot set mode to "${mode}". Workspace ceiling is "${wsSettings.maxMode}".`,
        });
      }
    }

    const updated = await assistantRepo.updateConversation(workspaceId, userId, req.params.id, {
      title,
      projectId,
      pinnedAt: pinnedAt !== undefined ? (pinnedAt ? new Date(pinnedAt) : null) : undefined,
      mode,
      thinking,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /conversations/:id — hard delete conversation and messages ─────────
router.delete('/conversations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const deleted = await assistantRepo.deleteConversation(workspaceId, userId, req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── POST /conversations/:id/messages — send a message & stream SSE reply ─────
router.post('/conversations/:id/messages', async (req: Request, res: Response) => {
  const workspaceId = req.workspaceId!;
  const userId = req.userId!;
  const { content, attachments, thinking, mode, surface, entity } = req.body;

  const controller = new AbortController();
  req.on('close', () => {
    controller.abort();
  });

  await assistantOrchestrator.streamTurn({
    workspaceId,
    userId,
    userRole: (req as any).userRole || 'member',
    userName: (req as any).userName || 'User',
    conversationId: req.params.id,
    content,
    attachments,
    thinking,
    mode,
    surface,
    entity,
    res,
    signal: controller.signal,
  });
});

// ── POST /conversations/:id/regenerate — stream a new reply for the last turn ──
router.post('/conversations/:id/regenerate', async (req: Request, res: Response) => {
  const workspaceId = req.workspaceId!;
  const userId = req.userId!;

  const convo = await assistantRepo.getConversation(workspaceId, userId, req.params.id);
  if (!convo) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  // Remove last assistant message if one exists
  // Spending caps (slice 1): check the budget BEFORE deleting the last
  // assistant message, so a blocked regenerate doesn't destroy a reply
  // the user can still read.
  const budget = await checkAssistantBudget(db as any, workspaceId);
  if (!budget.allowed) {
    return res.status(402).json({ error: budget.message });
  }

  const lastAssistantMsg = await assistantRepo.getLastAssistantMessage(workspaceId, userId, req.params.id);
  if (lastAssistantMsg) {
    await assistantRepo.deleteMessage(workspaceId, userId, lastAssistantMsg.id);
  }

  // Find last user message
  const userMessages = (convo.messages || []).filter((m) => m.role === 'user');
  const lastUserMsg = userMessages[userMessages.length - 1];

  if (!lastUserMsg) {
    return res.status(400).json({ error: 'No user message to regenerate' });
  }

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  await assistantOrchestrator.streamTurn({
    workspaceId,
    userId,
    userRole: (req as any).userRole || 'member',
    conversationId: req.params.id,
    content: lastUserMsg.searchableText || '',
    res,
    signal: controller.signal,
  });
});

// ── POST /conversations/:id/messages/:messageId/edit — replace message & stream
router.post('/conversations/:id/messages/:messageId/edit', async (req: Request, res: Response) => {
  const workspaceId = req.workspaceId!;
  const userId = req.userId!;
  const { content } = req.body;

  if (!content?.trim()) {
    return res.status(400).json({ error: 'Content cannot be empty' });
  }

  const convo = await assistantRepo.getConversation(workspaceId, userId, req.params.id);
  if (!convo) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  // Truncate messages after this message
  // Spending caps (slice 1): check the budget BEFORE truncating and
  // deleting, so a blocked edit doesn't destroy messages the user can
  // still read.
  const editBudget = await checkAssistantBudget(db as any, workspaceId);
  if (!editBudget.allowed) {
    return res.status(402).json({ error: editBudget.message });
  }

  await assistantRepo.truncateMessagesAfter(workspaceId, userId, req.params.id, req.params.messageId);

  // Delete the edited message itself so we re-send it as new
  await assistantRepo.deleteMessage(workspaceId, userId, req.params.messageId);

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  await assistantOrchestrator.streamTurn({
    workspaceId,
    userId,
    userRole: (req as any).userRole || 'member',
    conversationId: req.params.id,
    content,
    res,
    signal: controller.signal,
  });
});

// ── POST /messages/:messageId/feedback — thumbs up/down ───────────────────────
router.post('/messages/:messageId/feedback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const { rating, comment } = req.body;

    const updated = await assistantRepo.updateMessageFeedback(workspaceId, userId, req.params.messageId, {
      rating,
      comment,
      updatedAt: new Date().toISOString(),
    });

    if (!updated) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({ success: true, feedback: updated.feedback });
  } catch (err) {
    next(err);
  }
});

// ── POST /temporary/messages — stateless temporary chat (stores nothing) ──────
router.post('/temporary/messages', async (req: Request, res: Response) => {
  const { messages, thinking } = req.body as {
    messages: Array<{ role: 'user' | 'assistant'; parts: Array<{ type: string; text?: string }> }>;
    thinking?: string;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  // Spending caps (slice 1): temporary chat is stateless but still burns
  // tokens — gate it like a normal turn, before any SSE headers.
  const tempWorkspaceId = (req as any).workspaceId as string | undefined;
  if (tempWorkspaceId) {
    const tempBudget = await checkAssistantBudget(db as any, tempWorkspaceId);
    if (!tempBudget.allowed) {
      return res.status(402).json({ error: tempBudget.message });
    }
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  const systemPrompt = buildSystemPrompt({
    userName: (req as any).userName || 'User',
    role: (req as any).userRole || 'member',
    workspaceName: 'Stone AIO',
    mode: 'Read-only',
    includeToolParagraph: false,
  });

  let tempInputTokens = 0;
  let tempOutputTokens = 0;

  try {
    const stream = chatEngine.stream(messages, {
      systemPrompt,
      thinking,
      signal: controller.signal,
    });

    for await (const event of stream) {
      if (controller.signal.aborted) break;
      if (event.type === 'done') {
        tempInputTokens += (event as any).inputTokens || 0;
        tempOutputTokens += (event as any).outputTokens || 0;
      }
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    }
  } catch {
    res.write(`event: error\ndata: ${JSON.stringify({ code: 'provider_error', message: 'Stream failed' })}\n\n`);
  } finally {
    // Spending caps (slice 1): temporary-chat tokens go straight into
    // the workspace monthly bucket (there is no conversation to attach
    // daily per-user usage to). A recording failure is logged, never
    // fatal to the response.
    if (tempWorkspaceId && (tempInputTokens > 0 || tempOutputTokens > 0)) {
      try {
        await recordUsage(db as any, tempWorkspaceId, {
          input: tempInputTokens,
          output: tempOutputTokens,
        });
      } catch (err) {
        console.error('[AssistantBudget] Failed to record temporary-chat usage:', (err as Error)?.message);
      }
    }
    if (!res.writableEnded) res.end();
  }
});

// ── GET /settings — get personal settings ────────────────────────────────────
router.get('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const settings = await assistantRepo.getSettings(workspaceId, userId);
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// ── PUT /settings — update personal settings ─────────────────────────────────
router.put('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const updated = await assistantRepo.updateSettings(workspaceId, userId, req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── GET /workspace-settings — get enterprise assistant governance (admin/owner)
router.get('/workspace-settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userRole = (req as any).userRole || 'member';

    if (!hasMinimumRole(userRole, 'admin')) {
      return res.status(403).json({
        error: 'Only workspace admins or owners may view assistant governance settings.',
      });
    }

    const settings = await assistantRepo.getWorkspaceSettings(workspaceId);
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// ── PUT /workspace-settings — update enterprise assistant governance (admin/owner)
router.put('/workspace-settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userRole = (req as any).userRole || 'member';

    if (!hasMinimumRole(userRole, 'admin')) {
      return res.status(403).json({
        error: 'Only workspace admins or owners may update assistant governance settings.',
      });
    }

    const updated = await assistantRepo.updateWorkspaceSettings(workspaceId, req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── GET /memories — list caller's memories ────────────────────────────────────
router.get('/memories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const scope = (req.query.scope as 'personal' | 'business' | 'all') || 'all';
    const memories = await memoryService.listMemories(workspaceId, userId, { scope });
    res.json(memories);
  } catch (err) {
    next(err);
  }
});

// ── POST /memories — save or update a memory ──────────────────────────────────
router.post('/memories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const userRole = (req as any).userRole || 'member';
    const { key, value, category } = req.body;

    if (!key || !value) {
      return res.status(400).json({ error: 'Memory key and value are required.' });
    }

    if (category === 'business' && !hasMinimumRole(userRole, 'admin')) {
      return res.status(403).json({ error: 'Only admins can add Business memory notes.' });
    }

    const memory = await memoryService.saveMemory(workspaceId, userId, { key, value, category });
    res.json(memory);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /memories/:id — update a memory note ─────────────────────────────────
router.patch('/memories/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const userRole = (req as any).userRole || 'member';
    const updated = await memoryService.updateMemory(workspaceId, userId, userRole, req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    if (err.message?.includes('Insufficient permissions')) {
      return res.status(403).json({ error: err.message });
    }
    if (err.message?.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

// ── DELETE /memories/:id — delete a memory ────────────────────────────────────
router.delete('/memories/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const userRole = (req as any).userRole || 'member';
    const deleted = await memoryService.deleteMemory(workspaceId, userId, req.params.id, userRole);

    if (!deleted) {
      return res.status(404).json({ error: 'Memory item not found.' });
    }

    res.json({ success: true });
  } catch (err: any) {
    if (err.message?.includes('Insufficient permissions')) {
      return res.status(403).json({ error: err.message });
    }
    next(err);
  }
});

// ── DELETE /memories — clear all memories ─────────────────────────────────────
router.delete('/memories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const userRole = (req as any).userRole || 'member';
    const scope = (req.query.scope as 'personal' | 'business') || 'personal';
    const count = await memoryService.clearAllMemories(workspaceId, userId, scope, userRole);
    res.json({ success: true, count });
  } catch (err: any) {
    if (err.message?.includes('Insufficient permissions')) {
      return res.status(403).json({ error: err.message });
    }
    next(err);
  }
});

// ── GET /search — search past conversations ───────────────────────────────────
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const query = (req.query.q as string) || '';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    const results = await memoryService.searchPastChats(workspaceId, userId, query, limit);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

// ── GET /tool-calls — list tool calls for approvals / audit log ─────────────
router.get('/tool-calls', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userRole = (req as any).userRole || 'member';
    const currentUserId = req.userId!;
    const { status, conversationId, limit } = req.query as {
      status?: string;
      userId?: string;
      conversationId?: string;
      limit?: string;
    };

    // Spec §1.14: Members see their own activity; admins and owners see everyone's actions in the workspace
    const effectiveUserId = hasMinimumRole(userRole, 'admin')
      ? (req.query.userId as string | undefined)
      : currentUserId;

    const toolCalls = await assistantRepo.listToolCalls(workspaceId, {
      status,
      userId: effectiveUserId,
      conversationId,
      limit: limit ? parseInt(limit, 10) : 100,
    });

    res.json(toolCalls);
  } catch (err) {
    next(err);
  }
});

// ── POST /tool-calls/:id/approve — approve & execute pending action ──────────
router.post('/tool-calls/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const userRole = (req as any).userRole || 'member';

    const toolCall = await assistantRepo.getToolCall(workspaceId, req.params.id);
    if (!toolCall) {
      return res.status(404).json({ error: 'Tool call not found' });
    }

    if (toolCall.status !== 'pending') {
      return res.status(400).json({ error: `Cannot approve tool call with status "${toolCall.status}"` });
    }

    const tool = toolRegistry.getTool(toolCall.toolName);
    if (!tool) {
      return res.status(400).json({ error: `Tool "${toolCall.toolName}" is not registered.` });
    }

    // Role check: approving user must have minimum role for this tool
    if (!hasMinimumRole(userRole, tool.minimumRole)) {
      return res.status(403).json({
        error: `Insufficient permissions. Approving this action requires ${tool.minimumRole} role.`,
      });
    }

    // Atomically claim the pending tool call so it cannot be double-executed
    const claimed = await assistantRepo.claimToolCall(workspaceId, toolCall.id, userId);
    if (!claimed) {
      return res.status(409).json({ error: 'Tool call has already been approved, rejected, or is executing.' });
    }

    // Allow user to supply modified args on approval (Edit & Run)
    const effectiveArgs = req.body.args
      ? sanitizeSecrets(req.body.args)
      : (toolCall.args as Record<string, unknown>);

    try {
      // Execute with approving user context
      const execResult = await toolRegistry.execute(toolCall.toolName, effectiveArgs, {
        workspaceId,
        userId,
        userRole,
        conversationId: toolCall.conversationId || undefined,
      });

      const updated = await assistantRepo.updateToolCall(workspaceId, toolCall.id, {
        status: execResult.error ? 'failed' : 'done',
        result: execResult.result,
        error: execResult.error,
        approvedByUserId: userId,
        decidedAt: new Date(),
        executedAt: new Date(),
      });

      res.json({ success: true, toolCall: updated });
    } catch (execErr: any) {
      await assistantRepo.updateToolCall(workspaceId, toolCall.id, {
        status: 'failed',
        error: execErr?.message || String(execErr),
        approvedByUserId: userId,
        decidedAt: new Date(),
        executedAt: new Date(),
      }).catch(() => {});
      throw execErr;
    }
  } catch (err) {
    next(err);
  }
});

// ── POST /tool-calls/:id/reject — reject a pending action ────────────────────
router.post('/tool-calls/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;

    const toolCall = await assistantRepo.getToolCall(workspaceId, req.params.id);
    if (!toolCall) {
      return res.status(404).json({ error: 'Tool call not found' });
    }

    if (toolCall.status !== 'pending') {
      return res.status(400).json({ error: `Cannot reject tool call with status "${toolCall.status}"` });
    }

    const updated = await assistantRepo.updateToolCall(workspaceId, toolCall.id, {
      status: 'rejected',
      approvedByUserId: userId,
      decidedAt: new Date(),
    });

    res.json({ success: true, toolCall: updated });
  } catch (err) {
    next(err);
  }
});

// ── GET /scheduled-tasks — list scheduled tasks ──────────────────────────────
router.get('/scheduled-tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const tasks = await scheduledTaskService.listTasks(workspaceId, userId);
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// ── POST /scheduled-tasks — create scheduled task ────────────────────────────
router.post('/scheduled-tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const { title, prompt, cron, mode } = req.body;

    if (!title || !prompt) {
      return res.status(400).json({ error: 'Title and prompt are required.' });
    }

    const task = await scheduledTaskService.createTask(workspaceId, userId, { title, prompt, cron, mode });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// ── GET /scheduled-tasks/:id — get single scheduled task & runs ─────────────────
router.get('/scheduled-tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const task = await scheduledTaskService.getTask(workspaceId, req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Scheduled task not found.' });
    }
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /scheduled-tasks/:id — update scheduled task ────────────────────────
router.patch('/scheduled-tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const updated = await scheduledTaskService.updateTask(workspaceId, userId, req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /scheduled-tasks/:id — delete scheduled task ───────────────────────
router.delete('/scheduled-tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const deleted = await scheduledTaskService.deleteTask(workspaceId, userId, req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: 'Scheduled task not found.' });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── POST /scheduled-tasks/:id/run — execute scheduled task immediately ────────
router.post('/scheduled-tasks/:id/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const run = await scheduledTaskService.executeTask(workspaceId, req.params.id);
    res.json(run);
  } catch (err) {
    next(err);
  }
});

// ── GET /scheduled-tasks/:id/runs — list run history ──────────────────────────
router.get('/scheduled-tasks/:id/runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const runs = await scheduledTaskService.listRuns(workspaceId, req.params.id);
    res.json(runs);
  } catch (err) {
    next(err);
  }
});

// ── GET /projects — list accessible projects ─────────────────────────────────
router.get('/projects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const { filter, search } = req.query as { filter?: any; search?: string };
    const projects = await projectService.listProjects(workspaceId, userId, { filter, search });
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

// ── POST /projects — create a new project ────────────────────────────────────
router.post('/projects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const project = await projectService.createProject(workspaceId, userId, req.body);
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

// ── GET /projects/:id — get project details ──────────────────────────────────
router.get('/projects/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const project = await projectService.getProject(workspaceId, userId, req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /projects/:id — update project ──────────────────────────────────────
router.patch('/projects/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const userRole = (req as any).userRole || 'member';
    const updated = await projectService.updateProject(workspaceId, userId, userRole, req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /projects/:id — delete project ────────────────────────────────────
router.delete('/projects/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const userRole = (req as any).userRole || 'member';
    const deleted = await projectService.deleteProject(workspaceId, userId, userRole, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── POST /projects/:id/files — add file to project ───────────────────────────
// The client uploads the file bytes as base64; text is extracted server-side.
// Client-supplied `extractedText`/`status` are stripped — the server decides
// both from the actual bytes, so a PDF can no longer upload "successfully"
// with no readable text.
router.post('/projects/:id/files', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const { contentBase64, fileName, mimeType, size, storageUrl } = req.body ?? {};
    if (typeof contentBase64 !== 'string' || !contentBase64) {
      return res.status(400).json({ error: 'Upload requires the file content.' });
    }
    const file = await projectService.addProjectFile(workspaceId, userId, req.params.id, {
      fileName,
      mimeType,
      size,
      storageUrl,
      contentBase64,
    });
    res.status(201).json(file);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /projects/:id/files/:fileId — delete project file ─────────────────
router.delete('/projects/:id/files/:fileId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const deleted = await projectService.deleteProjectFile(workspaceId, userId, req.params.id, req.params.fileId);
    if (!deleted) {
      return res.status(404).json({ error: 'Project file not found' });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── POST /projects/:id/links — link CRM entity to project ────────────────────
router.post('/projects/:id/links', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const link = await projectService.addProjectLink(workspaceId, userId, req.params.id, req.body);
    res.status(201).json(link);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /projects/:id/links/:linkId — remove CRM entity link ──────────────
router.delete('/projects/:id/links/:linkId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId!;
    const userId = req.userId!;
    const deleted = await projectService.deleteProjectLink(workspaceId, userId, req.params.id, req.params.linkId);
    if (!deleted) {
      return res.status(404).json({ error: 'Project link not found' });
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
