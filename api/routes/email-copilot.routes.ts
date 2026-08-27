/**
 * AI Campaign Copilot Routes — Email Marketing Module
 */

import { Router, Request, Response } from 'express';
import {
  runCampaignCopilotInterview,
  getWorkspaceHistoricalPerformance,
} from '../services/email-marketing/ai-copilot.service.js';

const router = Router();

// ── POST /api/email-marketing/ai-copilot/chat ─────────────────────────────────
router.post('/chat', async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId || 'default-workspace';
  const { message, chatHistory, currentDraft } = req.body as {
    message?: string;
    chatHistory?: Array<{ role: 'user' | 'model'; content: string }>;
    currentDraft?: any;
  };

  if (!message?.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const result = await runCampaignCopilotInterview(
      workspaceId,
      message,
      chatHistory || [],
      currentDraft
    );

    return res.json(result);
  } catch (err: any) {
    console.error('[AI Campaign Copilot Error]', err);
    const errMsg = String(err?.message || '').toLowerCase();
    const isOverloaded =
      errMsg.includes('overload') ||
      errMsg.includes('rate') ||
      errMsg.includes('quota') ||
      errMsg.includes('503') ||
      errMsg.includes('429');

    if (isOverloaded) {
      return res.status(503).json({
        error: 'The AI engine is briefly overloaded. Please retry in a few seconds.',
        retryable: true,
      });
    }
    return res.status(500).json({ error: err.message || 'Copilot failed to process request' });
  }
});


// ── GET /api/email-marketing/ai-copilot/insights ──────────────────────────────
router.get('/insights', async (req: Request, res: Response) => {
  const workspaceId = (req as any).workspaceId || 'default-workspace';
  try {
    const performance = await getWorkspaceHistoricalPerformance(workspaceId);
    return res.json(performance);
  } catch (err: any) {
    console.error('[AI Insights Error]', err);
    return res.status(500).json({ error: err.message || 'Failed to get insights' });
  }
});

export default router;
