import { Router } from 'express';
import { resolveInboxChannel } from '../middleware/resolveInboxChannel.js';
import { resolveWidgetContact } from '../services/inbox/inbox-contact.service.js';
import { createConversation, getConversation } from '../services/inbox/inbox-conversation.service.js';
import { createMessage, listMessages } from '../services/inbox/inbox-message.service.js';
import { subscribeToWidget } from '../services/channels/realtime.service.js';
import { db } from '../../infrastructure/database/client.js';

const router = Router();
// Note: no Clerk authentication here. Protected by inbox token.
router.use(resolveInboxChannel);

// 1. Get channel config
router.get('/channels/current', (req, res) => {
  const channel = (req as any).inboxChannel;
  res.json({
    id: channel.id,
    name: channel.name,
    avatarUrl: channel.avatarUrl,
    welcomeMessage: channel.welcomeMessage,
    awayMessage: channel.awayMessage,
    widgetColor: channel.widgetColor
  });
});

// 2. Resolve Contact
router.post('/contacts', async (req, res) => {
  const { externalId, name, email } = req.body;
  if (!externalId) return res.status(400).json({ error: 'externalId required' });
  const contact = await resolveWidgetContact((req as any).workspaceId, externalId, { name, email });
  res.json(contact);
});

// 3. Conversations
router.post('/conversations', async (req, res) => {
  const { contactId } = req.body;
  const conversation = await createConversation((req as any).workspaceId, {
    inboxChannelId: (req as any).inboxChannel.id,
    inboxContactId: contactId,
  });
  res.json(conversation);
});

// 4. Messages
router.get('/conversations/:id/messages', async (req, res) => {
  // Check if conversation belongs to this channel
  const conv = await db.inboxConversation.findUnique({ where: { id: req.params.id }});
  if (conv?.inboxChannelId !== (req as any).inboxChannel.id) return res.status(403).json({ error: 'Forbidden' });
  
  res.json(await listMessages((req as any).workspaceId, req.params.id, 1, 100));
});

router.post('/conversations/:id/messages', async (req, res) => {
  const conv = await db.inboxConversation.findUnique({ where: { id: req.params.id }});
  if (conv?.inboxChannelId !== (req as any).inboxChannel.id) return res.status(403).json({ error: 'Forbidden' });

  const { content, contactId } = req.body;
  const message = await createMessage((req as any).workspaceId, req.params.id, {
    senderType: 'contact',
    senderId: contactId,
    content
  });
  res.json(message);
});

// 5. SSE
router.get('/conversations/:id/sse', async (req, res) => {
  const conv = await db.inboxConversation.findUnique({ where: { id: req.params.id }});
  if (conv?.inboxChannelId !== (req as any).inboxChannel.id) return res.status(403).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const unsub = subscribeToWidget(req.params.id, (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  });

  req.on('close', () => unsub());
});

export default router;
