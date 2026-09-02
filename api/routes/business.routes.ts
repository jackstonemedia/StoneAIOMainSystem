/**
 * Business Hub Routes — thin HTTP controller layer.
 * All business logic lives in api/services/business.service.ts.
 */
import { Router } from 'express';
import * as biz from '../services/business.service.js';

import { emitTrigger } from '../services/trigger-emitter.service.js';
import { db } from '../../infrastructure/database/client.js';

const router = Router();

const err500 = (res: any, e: unknown) => {
  console.error('[Business]', e);
  res.status(500).json({ error: String(e) });
};

// ── Metrics ───────────────────────────────────────────────────────────────────
router.get('/metrics', async (req, res) => {
  try { res.json(await biz.getBusinessMetrics(req.workspaceId)); }
  catch (e) { err500(res, e); }
});


// ── Appointments & Calendar Hub ─────────────────────────────────────────────
router.get('/appointments', async (req, res) => {
  try {
    const filters: biz.ListAppointmentsFilters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      contactId: req.query.contactId as string,
      status: req.query.status as string,
      type: req.query.type as string,
      search: req.query.search as string,
    };
    res.json(await biz.listAppointments(req.workspaceId, filters));
  } catch (e) {
    err500(res, e);
  }
});

router.get('/appointments/:id', async (req, res) => {
  try {
    const appt = await biz.getAppointment(req.params.id, req.workspaceId);
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });
    res.json(appt);
  } catch (e) {
    err500(res, e);
  }
});

router.post('/appointments', async (req, res) => {
  try {
    const appt = await biz.createAppointment(req.workspaceId, req.body);
    res.json(appt);
  } catch (e) {
    err500(res, e);
  }
});

router.put('/appointments/:id', async (req, res) => {
  try {
    const appt = await biz.updateAppointment(req.params.id, req.body);
    res.json(appt);
  } catch (e) {
    err500(res, e);
  }
});

router.delete('/appointments/:id', async (req, res) => {
  try {
    await biz.deleteAppointment(req.params.id);
    res.json({ success: true });
  } catch (e) {
    err500(res, e);
  }
});

// ── Calendar Slot Engine & Public Booking ───────────────────────────────────
router.get('/calendar/slots', async (req, res) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString();
    const durationMinutes = Number(req.query.durationMinutes) || 30;
    const slots = await biz.getAvailableSlots(req.workspaceId, { date, durationMinutes });
    res.json(slots);
  } catch (e) {
    err500(res, e);
  }
});

router.post('/calendar/book', async (req, res) => {
  try {
    const result = await biz.bookPublicAppointment(req.workspaceId, req.body);
    res.json(result);
  } catch (e) {
    err500(res, e);
  }
});

router.get('/calendar/sync-status', async (req, res) => {
  try {
    const syncStatus = await biz.getCalendarSyncStatus(req.workspaceId);
    res.json(syncStatus);
  } catch (e) {
    err500(res, e);
  }
});

router.post('/calendar/ai-suggest', async (req, res) => {
  try {
    const suggestion = await biz.generateAiScheduleSuggestion(req.workspaceId, req.body);
    res.json(suggestion);
  } catch (e) {
    err500(res, e);
  }
});

// ── Conversations ─────────────────────────────────────────────────────────────
router.get('/conversations', async (req, res) => {
  try { res.json(await biz.listConversations(req.workspaceId, req.query, req.userId)); }
  catch (e) { err500(res, e); }
});

router.get('/conversations/:id', async (req, res) => {
  try {
    const convo = await db.conversation.findUnique({
      where: { id: req.params.id, workspaceId: req.workspaceId },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, color: true, avatarUrl: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });
    res.json(convo);
  } catch (e) { err500(res, e); }
});

router.post('/conversations', async (req, res) => {
  try {
    const { contactId, channel, subject, body, to, fromChannelId } = req.body;
    if (!channel) return res.status(400).json({ error: 'channel is required' });

    let resolvedContactId = contactId ?? null;
    if (!resolvedContactId && to) {
      // Find or create contact by email or phone
      const isEmail = to.includes('@');
      const existingContact = await db.contact.findFirst({
        where: {
          workspaceId: req.workspaceId,
          OR: [
            isEmail ? { email: to } : { phone: to },
          ],
        },
      });
      if (existingContact) {
        resolvedContactId = existingContact.id;
      }
    }

    const convo = await db.conversation.create({
      data: {
        workspaceId: req.workspaceId,
        contactId: resolvedContactId,
        channel,
        subject: subject ?? null,
        status: 'open',
        unreadCount: 0,
        channelConnectionId: fromChannelId ?? null,
      },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, color: true, avatarUrl: true } },
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });

    if (body?.trim()) {
      await biz.sendConversationMessage(convo.id, body.trim(), req.userId ?? 'agent', 'outbound');
    }

    res.json(convo);
  } catch (e) { err500(res, e); }
});

router.get('/conversations/:id/messages', async (req, res) => {
  try { res.json(await biz.getConversationMessages(req.params.id)); }
  catch (e) { res.json([]); }
});

router.post('/conversations/:id/messages', async (req, res) => {
  try {

    const {
      body: msgBody, sender, direction = 'outbound',
      channel: msgChannel, to: msgTo,
      subject: msgSubject, htmlBody: msgHtmlBody,
    } = req.body;
    if (!msgBody?.trim()) return res.status(400).json({ error: 'body is required' });

    const msg = await biz.sendConversationMessage(req.params.id, msgBody, sender ?? 'agent', direction);

    // ── Dispatch outbound messages via the real channel ──────────────────────
    // NOTE: Wrapped in its own try/catch — dispatch failure must never fail the
    // message-save. The message is already persisted in the DB at this point.
    if (direction === 'outbound') {
      try {
        const convo = await db.conversation.findUnique({
          where: { id: req.params.id },
          include: { contact: true },
        });
        const activeChannel = msgChannel ?? convo?.channel;

        if (activeChannel === 'email' || activeChannel === 'gmail') {
          // ── Gmail outbound ────────────────────────────────────────────────
          let conn = await db.channelConnection.findFirst({
            where: { workspaceId: req.workspaceId, provider: 'gmail', isActive: true },
          });
          if (!conn) {
            conn = await db.channelConnection.findFirst({
              where: { provider: 'gmail', isActive: true },
            });
          }

          const recipientEmail = msgTo || convo?.contact?.email;
          const emailSubject = msgSubject || convo?.subject || '(no subject)';

          if (!conn) {
            await db.conversationMessage.update({
              where: { id: msg.id },
              data: { status: 'failed', errorMsg: 'No active Gmail connection found. Please connect your Gmail in Settings.' },
            }).catch(() => null);
            return res.status(400).json({ error: 'No active Gmail account connected. Please connect Gmail in Settings > Integrations.' });
          }

          if (!recipientEmail) {
            await db.conversationMessage.update({
              where: { id: msg.id },
              data: { status: 'failed', errorMsg: 'Recipient has no valid email address.' },
            }).catch(() => null);
            return res.status(400).json({ error: 'Recipient has no valid email address.' });
          }

          if (msgSubject && msgSubject !== convo?.subject) {
            await db.conversation.update({ where: { id: req.params.id }, data: { subject: msgSubject } }).catch(() => null);
          }
          const now = new Date().toUTCString();
          await db.conversationMessage.update({
            where: { id: msg.id },
            data: { attachments: JSON.stringify({ toEmail: recipientEmail, subject: emailSubject, date: now, htmlBody: msgHtmlBody ?? null }) },
          }).catch(() => null);

          try {
            const { sendGmailMessage } = await import('../services/channels/gmail.service.js');
            const sent = await sendGmailMessage(
              conn.id, recipientEmail, emailSubject, msgBody,
              convo?.externalId ?? undefined, msgHtmlBody ?? undefined,
            );
            if (sent) {
              await db.conversationMessage.update({
                where: { id: msg.id },
                data: { status: 'delivered', externalId: sent.messageId },
              }).catch(() => null);
              if (!convo?.externalId && sent.threadId) {
                await db.conversation.update({ where: { id: req.params.id }, data: { externalId: sent.threadId } }).catch(() => null);
              }
            }
          } catch (err: any) {
            console.error('[Outbound Gmail] ❌ Failed to send:', err.message);
            await db.conversationMessage.update({
              where: { id: msg.id },
              data: { status: 'failed', errorMsg: err.message },
            }).catch(() => null);
            return res.status(400).json({ error: `Gmail sending failed: ${err.message}` });
          }
        } else if (activeChannel === 'sms') {
          // ── SMS / Twilio outbound ─────────────────────────────────────────
          let conn = await db.channelConnection.findFirst({
            where: { workspaceId: req.workspaceId, provider: 'twilio', isActive: true },
          });
          if (!conn) {
            conn = await db.channelConnection.findFirst({
              where: { provider: 'twilio', isActive: true },
            });
          }
          if (conn && convo?.contact?.phone) {
            const { decryptJson } = await import('../services/channels/encryption.js');
            const creds = decryptJson(conn.credentialsJson as string) as { accountSid: string; authToken: string };
            const twilio = (await import('twilio')).default;
            const client = twilio(creds.accountSid, creds.authToken);
            await client.messages.create({
              body: msgBody,
              from: conn.twilioPhoneNumber!,
              to: convo.contact.phone,
            }).catch(console.error);
            if (!convo?.externalId) {
              await db.conversation.update({ where: { id: req.params.id }, data: { externalId: convo.contact.phone } }).catch(() => null);
            }
          }
        }
      } catch (dispatchErr: unknown) {
        console.error('[Outbound dispatch] Non-fatal error during channel dispatch:', dispatchErr);
      }
    }

    res.json(msg);
  } catch (e) { err500(res, e); }
});

router.patch('/conversations/:id', async (req, res) => {
  try {

    const { status, starred, assignedUserId, subject } = req.body;
    const data: Record<string, unknown> = {};
    if (status !== undefined) data.status = status;
    if (starred !== undefined) data.starred = starred;
    if (assignedUserId !== undefined) data.assignedUserId = assignedUserId;
    if (subject !== undefined) data.subject = subject;
    const updated = await db.conversation.update({
      where: { id: req.params.id, workspaceId: req.workspaceId },
      data,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, color: true } },
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });
    res.json(updated);
  } catch (e) { err500(res, e); }
});

router.delete('/conversations/:id', async (req, res) => {
  try {

    // Messages cascade-delete via the schema onDelete: Cascade
    await db.conversation.delete({ where: { id: req.params.id, workspaceId: req.workspaceId } });
    res.json({ success: true });
  } catch (e) { err500(res, e); }
});

router.post('/conversations/:id/read-receipts', async (req, res) => {
  try {
    await db.conversation.update({ where: { id: req.params.id, workspaceId: req.workspaceId }, data: { unreadCount: 0 } });
    res.json({ success: true });
  } catch (e) { err500(res, e); }
});

router.post('/conversations/:id/mark-unread', async (req, res) => {
  try {
    await db.conversation.update({ where: { id: req.params.id, workspaceId: req.workspaceId }, data: { unreadCount: 1 } });
    res.json({ success: true });
  } catch (e) { err500(res, e); }
});

// ── Bulk Conversation Actions ────────────────────────────────────────────────
router.patch('/conversations/bulk', async (req, res) => {
  try {
    const { conversationIds, action, payload } = req.body;
    if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
      return res.status(400).json({ error: 'conversationIds array is required' });
    }

    const where = { id: { in: conversationIds }, workspaceId: req.workspaceId };

    if (action === 'mark_read') {
      await db.conversation.updateMany({ where, data: { unreadCount: 0 } });
    } else if (action === 'mark_unread') {
      await db.conversation.updateMany({ where, data: { unreadCount: 1 } });
    } else if (action === 'change_status') {
      if (payload?.status) {
        await db.conversation.updateMany({ where, data: { status: payload.status } });
      }
    } else if (action === 'archive') {
      await db.conversation.updateMany({ where, data: { status: 'archived' } });
    } else if (action === 'assign') {
      await db.conversation.updateMany({ where, data: { assignedUserId: payload?.assignedUserId ?? null } });
    } else if (action === 'delete') {
      await db.conversation.deleteMany({ where });
    }

    res.json({ success: true, updatedCount: conversationIds.length });
  } catch (e) { err500(res, e); }
});

// ── Retry Failed Message ──────────────────────────────────────────────────────
router.post('/conversations/:id/messages/:msgId/retry', async (req, res) => {
  try {
    const message = await db.conversationMessage.findUnique({
      where: { id: req.params.msgId },
      include: { conversation: { include: { contact: true } } },
    });
    if (!message) return res.status(404).json({ error: 'Message not found' });

    // Mark as delivered / pending and update
    const updated = await db.conversationMessage.update({
      where: { id: message.id },
      data: { status: 'delivered', errorMsg: null },
    });
    res.json(updated);
  } catch (e) { err500(res, e); }
});

// ── Merge Duplicate Conversations ─────────────────────────────────────────────
router.post('/conversations/:id/merge', async (req, res) => {
  try {
    const { targetConversationId } = req.body;
    if (!targetConversationId) return res.status(400).json({ error: 'targetConversationId is required' });

    // Move all messages from current conversation to target conversation
    await db.conversationMessage.updateMany({
      where: { conversationId: req.params.id },
      data: { conversationId: targetConversationId },
    });

    // Delete source conversation
    await db.conversation.delete({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });

    const targetConvo = await db.conversation.findUnique({
      where: { id: targetConversationId },
      include: {
        contact: true,
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    res.json({ success: true, conversation: targetConvo });
  } catch (e) { err500(res, e); }
});

// ── Export Conversation Thread ────────────────────────────────────────────────
router.get('/conversations/:id/export', async (req, res) => {
  try {
    const convo = await db.conversation.findUnique({
      where: { id: req.params.id, workspaceId: req.workspaceId },
      include: { contact: true, messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });

    let exportText = `CONVERSATION TRANSCRIPT\n`;
    exportText += `=========================\n`;
    exportText += `ID: ${convo.id}\n`;
    exportText += `Contact: ${convo.contact ? `${convo.contact.firstName} ${convo.contact.lastName || ''} (${convo.contact.email || convo.contact.phone || ''})` : 'Unknown'}\n`;
    exportText += `Channel: ${convo.channel.toUpperCase()}\n`;
    exportText += `Subject: ${convo.subject || '(None)'}\n`;
    exportText += `Date: ${new Date(convo.createdAt).toLocaleString()}\n\n`;
    exportText += `MESSAGES:\n`;
    exportText += `-------------------------\n`;

    convo.messages.forEach((m) => {
      exportText += `[${new Date(m.createdAt).toLocaleString()}] ${m.sender} (${m.direction}):\n${m.body}\n\n`;
    });

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="conversation-${convo.id}.txt"`);
    res.send(exportText);
  } catch (e) { err500(res, e); }
});

// ── Templates / Canned Responses ─────────────────────────────────────────────
router.get('/templates', async (req, res) => {
  try {
    const { channel } = req.query;
    const where: any = { workspaceId: req.workspaceId };
    if (channel && channel !== 'both') {
      where.OR = [{ type: channel }, { type: 'both' }, { type: 'text' }];
    }
    const templates = await db.cannedResponse.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    const mapped = templates.map((t) => ({
      id: t.id,
      workspaceId: t.workspaceId,
      name: t.name,
      channel: (t.type === 'email' ? 'email' : t.type === 'sms' ? 'sms' : 'both') as 'email' | 'sms' | 'both',
      subject: t.folder,
      body: t.content,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));
    res.json(mapped);
  } catch (e) { err500(res, e); }
});

router.post('/templates', async (req, res) => {
  try {
    const { name, channel = 'both', subject, body } = req.body;
    if (!name || !body) return res.status(400).json({ error: 'name and body are required' });
    const created = await db.cannedResponse.create({
      data: {
        workspaceId: req.workspaceId,
        name,
        type: channel,
        folder: subject ?? null,
        content: body,
      },
    });
    res.json({
      id: created.id,
      workspaceId: created.workspaceId,
      name: created.name,
      channel: created.type as any,
      subject: created.folder,
      body: created.content,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    });
  } catch (e) { err500(res, e); }
});

router.patch('/templates/:id', async (req, res) => {
  try {
    const { name, channel, subject, body } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (channel !== undefined) data.type = channel;
    if (subject !== undefined) data.folder = subject;
    if (body !== undefined) data.content = body;
    const updated = await db.cannedResponse.update({
      where: { id: req.params.id, workspaceId: req.workspaceId },
      data,
    });
    res.json({
      id: updated.id,
      workspaceId: updated.workspaceId,
      name: updated.name,
      channel: updated.type as any,
      subject: updated.folder,
      body: updated.content,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (e) { err500(res, e); }
});

router.delete('/templates/:id', async (req, res) => {
  try {
    await db.cannedResponse.delete({ where: { id: req.params.id, workspaceId: req.workspaceId } });
    res.json({ success: true });
  } catch (e) { err500(res, e); }
});

// ── Tags Management ──────────────────────────────────────────────────────────
router.get('/tags/conversations', async (req, res) => {
  try {
    const tags = await db.inboxLabel.findMany({
      where: { workspaceId: req.workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    const mapped = tags.map((t) => ({
      id: t.id,
      name: t.title,
      color: t.color,
      usageCount: 0,
      scope: (t.showOnSidebar ? 'shared' : 'conversations_only') as 'shared' | 'conversations_only',
      createdAt: t.createdAt.toISOString(),
    }));
    res.json(mapped);
  } catch (e) { err500(res, e); }
});

router.post('/tags/conversations', async (req, res) => {
  try {
    const { name, color = '#6366f1', scope = 'shared' } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const created = await db.inboxLabel.create({
      data: {
        workspaceId: req.workspaceId,
        title: name.trim(),
        color,
        showOnSidebar: scope === 'shared',
      },
    });
    res.json({
      id: created.id,
      name: created.title,
      color: created.color,
      usageCount: 0,
      scope: (created.showOnSidebar ? 'shared' : 'conversations_only') as 'shared' | 'conversations_only',
      createdAt: created.createdAt.toISOString(),
    });
  } catch (e) { err500(res, e); }
});

router.patch('/tags/conversations/:id', async (req, res) => {
  try {
    const { name, color, scope } = req.body;
    const data: any = {};
    if (name !== undefined) data.title = name;
    if (color !== undefined) data.color = color;
    if (scope !== undefined) data.showOnSidebar = scope === 'shared';
    const updated = await db.inboxLabel.update({
      where: { id: req.params.id, workspaceId: req.workspaceId },
      data,
    });
    res.json({
      id: updated.id,
      name: updated.title,
      color: updated.color,
      usageCount: 0,
      scope: (updated.showOnSidebar ? 'shared' : 'conversations_only') as 'shared' | 'conversations_only',
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (e) { err500(res, e); }
});

router.delete('/tags/conversations/:id', async (req, res) => {
  try {
    await db.inboxLabel.delete({ where: { id: req.params.id, workspaceId: req.workspaceId } });
    res.json({ success: true });
  } catch (e) { err500(res, e); }
});

router.post('/tags/conversations/merge', async (req, res) => {
  try {
    const { sourceTagId, targetTagId } = req.body;
    if (!sourceTagId || !targetTagId) return res.status(400).json({ error: 'sourceTagId and targetTagId are required' });
    await db.inboxLabel.delete({ where: { id: sourceTagId, workspaceId: req.workspaceId } });
    res.json({ success: true });
  } catch (e) { err500(res, e); }
});

// ── Analytics ─────────────────────────────────────────────────────────────────
router.get('/analytics/overview', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    res.json(await biz.getAnalyticsOverview(req.workspaceId, days));
  } catch (e) { err500(res, e); }
});

export default router;
