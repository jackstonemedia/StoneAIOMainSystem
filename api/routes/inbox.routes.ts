import { Router } from 'express';
import {
  provisionInbox, getProvisionStatus
} from '../services/inbox/inbox-provision.service.js';
import {
  listChannels, getChannel, createChannel, updateChannel, deleteChannel,
  listChannelAgents, addChannelAgent, removeChannelAgent, buildEmbedCode
} from '../services/inbox/inbox-channel.service.js';
import {
  listConversations, getConversation, createConversation, updateConversation, deleteConversation,
  addConversationLabel, removeConversationLabel
} from '../services/inbox/inbox-conversation.service.js';
import {
  createMessage, listMessages
} from '../services/inbox/inbox-message.service.js';
import {
  listLabels, createLabel, updateLabel, deleteLabel
} from '../services/inbox/inbox-label.service.js';
import {
  listTeams, createTeam, updateTeam, deleteTeam, listTeamMembers, addTeamMember, removeTeamMember
} from '../services/inbox/inbox-team.service.js';
import {
  listCannedResponses, createCannedResponse, updateCannedResponse, deleteCannedResponse
} from '../services/inbox/inbox-canned-response.service.js';
import {
  listContacts, getContact, createContact, updateContact
} from '../services/inbox/inbox-contact.service.js';
import {
  getOverviewStats, getAgentStats, getLabelStats, getConversationTrend
} from '../services/inbox/inbox-report.service.js';
import { subscribeToInbox, publishInboxEvent } from '../services/channels/realtime.service.js';
import { db } from '../../infrastructure/database/client.js';

const router = Router();

// Provision
router.post('/provision', async (req, res) => {
  await provisionInbox((req as any).workspaceId);
  res.json({ success: true });
});
router.get('/provision', async (req, res) => {
  res.json(await getProvisionStatus((req as any).workspaceId));
});

// Realtime SSE
router.get('/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const unsub = subscribeToInbox((req as any).workspaceId, (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  });

  req.on('close', () => unsub());
});

// Channels
router.get('/channels', async (req, res) => res.json(await listChannels((req as any).workspaceId)));
router.post('/channels', async (req, res) => res.json(await createChannel((req as any).workspaceId, req.body)));
router.get('/channels/:id', async (req, res) => res.json(await getChannel((req as any).workspaceId, req.params.id)));
router.patch('/channels/:id', async (req, res) => res.json(await updateChannel((req as any).workspaceId, req.params.id, req.body)));
router.delete('/channels/:id', async (req, res) => res.json(await deleteChannel((req as any).workspaceId, req.params.id)));
router.get('/channels/:id/embed', async (req, res) => {
  const channel = await getChannel((req as any).workspaceId, req.params.id);
  if (!channel) return res.status(404).json({ error: 'Not found' });
  res.json(buildEmbedCode(channel, process.env.VITE_APP_URL || 'http://localhost:5173'));
});

// Channel Agents
router.get('/channels/:id/agents', async (req, res) => res.json(await listChannelAgents(req.params.id)));
router.post('/channels/:id/agents', async (req, res) => res.json(await addChannelAgent(req.params.id, req.body.userId)));
router.delete('/channels/:id/agents/:userId', async (req, res) => res.json(await removeChannelAgent(req.params.id, req.params.userId)));

// Conversations
router.get('/conversations', async (req, res) => {
  const filters = { ...req.query, callerUserId: (req as any).userId };
  res.json(await listConversations((req as any).workspaceId, filters));
});
router.post('/conversations', async (req, res) => res.json(await createConversation((req as any).workspaceId, req.body)));
router.get('/conversations/:id', async (req, res) => res.json(await getConversation((req as any).workspaceId, req.params.id)));
router.patch('/conversations/:id', async (req, res) => res.json(await updateConversation((req as any).workspaceId, req.params.id, req.body)));
router.delete('/conversations/:id', async (req, res) => res.json(await deleteConversation((req as any).workspaceId, req.params.id)));

// Conversation Messages
router.get('/conversations/:id/messages', async (req, res) => res.json(await listMessages((req as any).workspaceId, req.params.id, Number(req.query.page || 1))));
router.post('/conversations/:id/messages', async (req, res) => {
  const data = { ...req.body, senderType: 'agent', senderId: (req as any).userId };
  res.json(await createMessage((req as any).workspaceId, req.params.id, data));
});

// Conversation Labels
router.post('/conversations/:id/labels', async (req, res) => res.json(await addConversationLabel((req as any).workspaceId, req.params.id, req.body.labelId)));
router.delete('/conversations/:id/labels/:labelId', async (req, res) => res.json(await removeConversationLabel((req as any).workspaceId, req.params.id, req.params.labelId)));

// Conversation Typing
router.post('/conversations/:id/typing', async (req, res) => {
  await publishInboxEvent((req as any).workspaceId, { type: 'agent.typing', workspaceId: (req as any).workspaceId, conversationId: req.params.id, payload: { userId: (req as any).userId } });
  res.json({ success: true });
});

// Labels
router.get('/labels', async (req, res) => res.json(await listLabels((req as any).workspaceId)));
router.post('/labels', async (req, res) => res.json(await createLabel((req as any).workspaceId, req.body)));
router.patch('/labels/:id', async (req, res) => res.json(await updateLabel((req as any).workspaceId, req.params.id, req.body)));
router.delete('/labels/:id', async (req, res) => res.json(await deleteLabel((req as any).workspaceId, req.params.id)));

// Teams
router.get('/teams', async (req, res) => res.json(await listTeams((req as any).workspaceId)));
router.post('/teams', async (req, res) => res.json(await createTeam((req as any).workspaceId, req.body)));
router.patch('/teams/:id', async (req, res) => res.json(await updateTeam((req as any).workspaceId, req.params.id, req.body)));
router.delete('/teams/:id', async (req, res) => res.json(await deleteTeam((req as any).workspaceId, req.params.id)));
router.get('/teams/:id/members', async (req, res) => res.json(await listTeamMembers(req.params.id)));
router.post('/teams/:id/members', async (req, res) => res.json(await addTeamMember(req.params.id, req.body.userId)));
router.delete('/teams/:id/members/:userId', async (req, res) => res.json(await removeTeamMember(req.params.id, req.params.userId)));

// Canned Responses
router.get('/canned-responses', async (req, res) => res.json(await listCannedResponses((req as any).workspaceId, req.query.q as string)));
router.post('/canned-responses', async (req, res) => res.json(await createCannedResponse((req as any).workspaceId, req.body)));
router.patch('/canned-responses/:id', async (req, res) => res.json(await updateCannedResponse((req as any).workspaceId, req.params.id, req.body)));
router.delete('/canned-responses/:id', async (req, res) => res.json(await deleteCannedResponse((req as any).workspaceId, req.params.id)));

// Contacts
router.get('/contacts', async (req, res) => res.json(await listContacts((req as any).workspaceId, req.query.q as string)));
router.post('/contacts', async (req, res) => res.json(await createContact((req as any).workspaceId, req.body)));
router.get('/contacts/:id', async (req, res) => res.json(await getContact((req as any).workspaceId, req.params.id)));
router.patch('/contacts/:id', async (req, res) => res.json(await updateContact((req as any).workspaceId, req.params.id, req.body)));

// Agents (Self)
router.get('/agents', async (req, res) => {
  const members = await db.workspaceMember.findMany({ where: { workspaceId: (req as any).workspaceId } });
  // MOCK: in real app, we'd join with User to get name/email.
  res.json(members.map((m: any) => ({ userId: m.userId, role: m.role })));
});

router.patch('/agents/me/availability', async (req, res) => {
  // Can be global or per-channel, simplified for now
  res.json({ success: true });
});

router.get('/agents/me/signature', async (req, res) => {
  const sig = await db.inboxAgentSignature.findUnique({
    where: { workspaceId_userId: { workspaceId: (req as any).workspaceId, userId: (req as any).userId } }
  });
  res.json(sig);
});

router.patch('/agents/me/signature', async (req, res) => {
  const sig = await db.inboxAgentSignature.upsert({
    where: { workspaceId_userId: { workspaceId: (req as any).workspaceId, userId: (req as any).userId } },
    create: { workspaceId: (req as any).workspaceId, userId: (req as any).userId, body: req.body.body },
    update: { body: req.body.body }
  });
  res.json(sig);
});

// Reports
router.get('/reports/overview', async (req, res) => {
  const start = new Date(req.query.startDate as string);
  const end = new Date(req.query.endDate as string);
  res.json(await getOverviewStats((req as any).workspaceId, start, end));
});
router.get('/reports/agents', async (req, res) => {
  const start = new Date(req.query.startDate as string);
  const end = new Date(req.query.endDate as string);
  res.json(await getAgentStats((req as any).workspaceId, start, end));
});
router.get('/reports/labels', async (req, res) => {
  const start = new Date(req.query.startDate as string);
  const end = new Date(req.query.endDate as string);
  res.json(await getLabelStats((req as any).workspaceId, start, end));
});
router.get('/reports/conversations', async (req, res) => {
  const start = new Date(req.query.startDate as string);
  const end = new Date(req.query.endDate as string);
  res.json(await getConversationTrend((req as any).workspaceId, start, end));
});

export default router;
