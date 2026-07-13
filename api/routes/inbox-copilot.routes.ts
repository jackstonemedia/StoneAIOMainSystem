import { Router } from 'express';
import { copilotService } from '../services/inbox/copilot.service.js';

const router = Router();

router.post('/draft', async (req, res) => {
  try {
    const { conversationId } = req.body;
    const workspaceId = req.workspaceId;
    
    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId is required' });
    }

    const draft = await copilotService.generateDraftReply(conversationId, workspaceId);
    res.json({ draft });
  } catch (err: any) {
    console.error('[InboxCopilot] draft error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

router.post('/summarize', async (req, res) => {
  try {
    const { conversationId } = req.body;
    const workspaceId = req.workspaceId;
    
    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId is required' });
    }

    const summary = await copilotService.summarizeConversation(conversationId, workspaceId);
    res.json({ summary });
  } catch (err: any) {
    console.error('[InboxCopilot] summarize error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

export default router;
