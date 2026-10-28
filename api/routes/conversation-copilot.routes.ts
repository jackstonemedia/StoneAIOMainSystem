import { Router } from 'express';
import { conversationCopilotService } from '../services/conversation-copilot.service.js';

const router = Router();

router.post('/draft', async (req, res) => {
  try {
    const { conversationId } = req.body;
    const workspaceId = req.workspaceId;

    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId is required' });
    }

    const draft = await conversationCopilotService.generateDraftReply(conversationId, workspaceId);
    res.json({ draft });
  } catch (err: any) {
    console.error('[ConversationCopilot] draft error:', err);
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

    const summary = await conversationCopilotService.summarizeConversation(conversationId, workspaceId);
    res.json({ summary });
  } catch (err: any) {
    console.error('[ConversationCopilot] summarize error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

router.post('/action-items', async (req, res) => {
  try {
    const { conversationId } = req.body;
    const workspaceId = req.workspaceId;

    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId is required' });
    }

    const actionItems = await conversationCopilotService.extractActionItems(conversationId, workspaceId);
    res.json({ actionItems });
  } catch (err: any) {
    console.error('[ConversationCopilot] action-items error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

export default router;
