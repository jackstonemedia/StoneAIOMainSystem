/**
 * Business Hub Routes — thin HTTP controller layer.
 * All business logic lives in api/services/business.service.ts.
 */
import { Router } from 'express';
import * as biz from '../services/business.service.js';

import { emitTrigger } from '../services/trigger-emitter.service.js';
import { db } from '../../infrastructure/database/client.js';
import { getAIClient, DEFAULT_MODEL } from '../../packages/ai/client.js';
import { stripQuotedReply } from '../utils/email-cleaner.js';

const router = Router();

const err500 = (res: any, e: unknown) => {
  console.error('[Business]', e);
  res.status(500).json({ error: String(e) });
};

// ── Metrics ───────────────────────────────────────────────────────────────────
router.get('/metrics', async (req, res) => {
  try {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    res.json(await biz.getBusinessMetrics(req.workspaceId, from, to));
  } catch (e) { err500(res, e); }
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

// ── Outbound Dispatch Helper ──────────────────────────────────────────────────
async function dispatchOutboundMessage({
  workspaceId,
  conversationId,
  messageId,
  channel,
  toEmail,
  subject,
  body,
  htmlBody,
  channelConnectionId,
}: {
  workspaceId: string;
  conversationId: string;
  messageId: string;
  channel?: string;
  toEmail?: string;
  subject?: string | null;
  body: string;
  htmlBody?: string | null;
  channelConnectionId?: string | null;
}) {
  const convo = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { contact: true },
  });
  const activeChannel = channel ?? convo?.channel;

  if (activeChannel === 'email' || activeChannel === 'gmail' || activeChannel === 'outlook') {
    let conn = (channelConnectionId || convo?.channelConnectionId)
      ? await db.channelConnection.findFirst({
          where: { id: channelConnectionId || convo?.channelConnectionId!, workspaceId, isActive: true },
        })
      : null;

    if (!conn) {
      conn = await db.channelConnection.findFirst({
        where: {
          workspaceId,
          provider: { in: ['gmail', 'outlook'] },
          isActive: true,
        },
      });
    }

    let recipientEmail = toEmail || convo?.contact?.email;
    if (!recipientEmail && convo) {
      const lastInbound = await db.conversationMessage.findFirst({
        where: { conversationId, direction: 'inbound' },
        orderBy: { createdAt: 'desc' },
      });
      if (lastInbound) {
        if (lastInbound.attachments) {
          try {
            const meta = typeof lastInbound.attachments === 'string' ? JSON.parse(lastInbound.attachments) : lastInbound.attachments;
            const fromStr = meta.fromEmail || meta.from || '';
            recipientEmail = fromStr.match(/<([^>]+)>/)?.[1] || (fromStr.includes('@') ? fromStr.trim() : '');
          } catch {}
        }
        if (!recipientEmail && lastInbound.sender) {
          recipientEmail = lastInbound.sender.match(/<([^>]+)>/)?.[1] || (lastInbound.sender.includes('@') ? lastInbound.sender.trim() : '');
        }
      }
    }

    if (recipientEmail && !convo?.contactId) {
      let contact = await db.contact.findFirst({
        where: { workspaceId, email: recipientEmail },
      });
      if (!contact) {
        contact = await db.contact.create({
          data: {
            workspaceId,
            email: recipientEmail,
            firstName: recipientEmail.split('@')[0],
            lastName: '',
            status: 'Lead',
          },
        }).catch(() => null);
      }
      if (contact) {
        await db.conversation.update({
          where: { id: conversationId },
          data: { contactId: contact.id },
        }).catch(() => null);
      }
    }

    const emailSubject = subject || convo?.subject || '(no subject)';

    if (!conn) {
      await db.conversationMessage.update({
        where: { id: messageId },
        data: { status: 'failed', errorMsg: 'No active Gmail or Outlook connection found. Please connect your inbox in Settings.' },
      }).catch(() => null);
      throw new Error('No active Gmail or Outlook account connected. Please connect an inbox in Settings > Email Outreach.');
    }

    if (!recipientEmail) {
      await db.conversationMessage.update({
        where: { id: messageId },
        data: { status: 'failed', errorMsg: 'Recipient has no valid email address.' },
      }).catch(() => null);
      throw new Error('Recipient has no valid email address.');
    }

    if (subject && subject !== convo?.subject) {
      await db.conversation.update({ where: { id: conversationId }, data: { subject } }).catch(() => null);
    }
    const now = new Date().toUTCString();
    await db.conversationMessage.update({
      where: { id: messageId },
      data: { attachments: JSON.stringify({ toEmail: recipientEmail, subject: emailSubject, date: now, htmlBody: htmlBody ?? null }) },
    }).catch(() => null);

    try {
      if (conn.provider === 'outlook') {
        const { sendOutlookMessage } = await import('../services/channels/outlook.service.js');
        const sent = await sendOutlookMessage(
          conn.id,
          recipientEmail,
          emailSubject,
          htmlBody ?? body.replace(/\n/g, '<br/>'),
          convo?.externalId ?? undefined,
        );
        if (sent) {
          await db.conversationMessage.update({
            where: { id: messageId },
            data: { status: 'delivered', externalId: sent.conversationId || undefined },
          }).catch(() => null);
          if (!convo?.externalId && sent.conversationId) {
            await db.conversation.update({ where: { id: conversationId }, data: { externalId: sent.conversationId } }).catch(() => null);
          }
        }
      } else {
        const { sendGmailMessage } = await import('../services/channels/gmail.service.js');
        const sent = await sendGmailMessage(
          conn.id, recipientEmail, emailSubject, body,
          convo?.externalId ?? undefined, htmlBody ?? undefined,
        );
        if (sent) {
          await db.conversationMessage.update({
            where: { id: messageId },
            data: { status: 'delivered', externalId: sent.messageId },
          }).catch(() => null);
          if (!convo?.externalId && sent.threadId) {
            await db.conversation.update({ where: { id: conversationId }, data: { externalId: sent.threadId } }).catch(() => null);
          }
        }
      }
    } catch (err: any) {
      console.error(`[Outbound Email via ${conn.provider}] ❌ Failed to send:`, err.message);
      await db.conversationMessage.update({
        where: { id: messageId },
        data: { status: 'failed', errorMsg: err.message },
      }).catch(() => null);
      throw new Error(`Email sending failed: ${err.message}`);
    }
  } else if (activeChannel === 'sms') {
    const conn = await db.channelConnection.findFirst({
      where: { workspaceId, provider: 'twilio', isActive: true },
    });
    if (conn && convo?.contact?.phone) {
      const { decryptJson } = await import('../services/channels/encryption.js');
      const creds = decryptJson(conn.credentialsJson as string) as { accountSid: string; authToken: string };
      const twilio = (await import('twilio')).default;
      const client = twilio(creds.accountSid, creds.authToken);
      await client.messages.create({
        body,
        from: conn.twilioPhoneNumber!,
        to: convo.contact.phone,
      }).catch(console.error);
      if (!convo?.externalId) {
        await db.conversation.update({ where: { id: conversationId }, data: { externalId: convo.contact.phone } }).catch(() => null);
      }
    }
  }
}

router.post('/conversations', async (req, res) => {
  try {
    const { contactId, channel, subject, body, to, fromChannelId } = req.body;
    if (!channel) return res.status(400).json({ error: 'channel is required' });

    let resolvedContactId = contactId ?? null;
    if (!resolvedContactId && to) {
      const isEmail = to.includes('@');
      let existingContact = await db.contact.findFirst({
        where: {
          workspaceId: req.workspaceId,
          OR: [
            isEmail ? { email: to } : { phone: to },
          ],
        },
      });
      if (!existingContact && isEmail) {
        existingContact = await db.contact.create({
          data: {
            workspaceId: req.workspaceId,
            email: to,
            firstName: to.split('@')[0],
            lastName: '',
            status: 'Lead',
          },
        });
      }
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
      const msg = await biz.sendConversationMessage(convo.id, body.trim(), req.userId ?? 'agent', 'outbound');
      try {
        await dispatchOutboundMessage({
          workspaceId: req.workspaceId,
          conversationId: convo.id,
          messageId: msg.id,
          channel: convo.channel,
          toEmail: to,
          subject: convo.subject,
          body: body.trim(),
          channelConnectionId: fromChannelId,
        });
      } catch (dispatchErr: any) {
        console.error('[New Conversation Dispatch Error]:', dispatchErr.message);
      }
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

    if (direction === 'outbound') {
      try {
        await dispatchOutboundMessage({
          workspaceId: req.workspaceId,
          conversationId: req.params.id,
          messageId: msg.id,
          channel: msgChannel,
          toEmail: msgTo,
          subject: msgSubject,
          body: msgBody,
          htmlBody: msgHtmlBody,
        });
      } catch (dispatchErr: any) {
        console.error('[Outbound dispatch] Channel dispatch error:', dispatchErr.message);
        return res.status(400).json({ error: dispatchErr.message });
      }
    }

    res.json(msg);
  } catch (e) { err500(res, e); }
});

router.patch('/conversations/:id', async (req, res) => {
  try {
    const existing = await db.conversation.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const { status, starred, assignedUserId, subject } = req.body;
    const data: Record<string, unknown> = {};
    if (status !== undefined) data.status = status;
    if (starred !== undefined) data.starred = starred;
    if (assignedUserId !== undefined) data.assignedUserId = assignedUserId;
    if (subject !== undefined) data.subject = subject;
    const updated = await db.conversation.update({
      where: { id: req.params.id },
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
    await db.conversationMessage.deleteMany({ where: { conversationId: req.params.id } });
    await db.conversation.deleteMany({ where: { id: req.params.id, workspaceId: req.workspaceId } });
    res.json({ success: true });
  } catch (e) { err500(res, e); }
});

router.post('/conversations/:id/read-receipts', async (req, res) => {
  try {
    await db.conversation.updateMany({ where: { id: req.params.id, workspaceId: req.workspaceId }, data: { unreadCount: 0 } });
    res.json({ success: true });
  } catch (e) { err500(res, e); }
});

router.post('/conversations/:id/mark-unread', async (req, res) => {
  try {
    await db.conversation.updateMany({ where: { id: req.params.id, workspaceId: req.workspaceId }, data: { unreadCount: 1 } });
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
      await db.conversationMessage.deleteMany({ where: { conversationId: { in: conversationIds } } });
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

// ── AI Copilot Conversation Reply Draft ──────────────────────────────────────
router.post('/conversations/:id/ai-reply', async (req, res) => {
  try {
    const { prompt: userInstruction } = req.body as { prompt?: string };
    const conversationId = req.params.id;
    const workspaceId = req.workspaceId;

    const convo = await db.conversation.findUnique({
      where: { id: conversationId, workspaceId },
      include: {
        contact: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 30,
        },
      },
    });

    if (!convo) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const contactName = convo.contact
      ? `${convo.contact.firstName || ''} ${convo.contact.lastName || ''}`.trim() || convo.contact.email
      : 'Customer';
    const contactEmail = convo.contact?.email || '';

    // Clean all messages to strip quoted email reply headers/history
    const cleanHistory = convo.messages.map((m) => {
      const isOut = m.direction === 'outbound';
      const sender = isOut ? 'You (Stone AIO Team)' : `${contactName}`;
      const cleanBody = stripQuotedReply(m.body || '');
      return `[${sender}]: ${cleanBody}`;
    });

    // Find the latest inbound message
    const inboundMessages = convo.messages.filter((m) => m.direction === 'inbound');
    const latestInbound = inboundMessages[inboundMessages.length - 1];
    const latestMessageText = latestInbound
      ? stripQuotedReply(latestInbound.body || '')
      : (convo.messages[convo.messages.length - 1]?.body || '');

    const ai = getAIClient();

    const systemInstruction = `You are an elite, highly professional AI email assistant for the Stone AIO business platform.
Your job is to read the conversation thread and craft a natural, accurate, intelligent, and contextually appropriate email reply to the customer.
Read the conversation carefully. The customer's latest message is the focus of your reply.
Follow these rules:
1. Address the customer's specific question or statement accurately and directly. Do NOT generate generic or placeholder replies.
2. If the user provided a specific guidance instruction, follow it precisely while maintaining professional business tone.
3. If they ask about platform access or getting started, provide a clear, warm next step (e.g., logging in with their registered account, sending over onboarding credentials, or setting up a walkthrough).
4. Tone should be professional, polite, helpful, and concise. No robotic filler.
5. Do NOT include email headers, "From:", "To:", or quoted thread history in your drafted response.
6. Return valid JSON only with keys:
   - "draft": The complete email body to send (including polite greeting and sign-off).
   - "explanation": A concise, 1-sentence summary of what you addressed in this reply.`;

    const userPrompt = `Conversation Subject: ${convo.subject || 'Direct Inquiry'}
Customer Name: ${contactName}
Customer Email: ${contactEmail}

Full Conversation Thread:
${cleanHistory.join('\n\n')}

Latest Customer Message:
"${latestMessageText}"

${userInstruction?.trim() ? `User specific instruction: "${userInstruction.trim()}"` : 'Please draft the best appropriate response to the customer\'s latest message.'}

Return JSON:
{
  "draft": "...",
  "explanation": "..."
}`;

    const aiRes = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        temperature: 0.7,
        responseMimeType: 'application/json',
      } as any,
    });

    let draft = '';
    let explanation = '';
    try {
      const parsed = JSON.parse(aiRes.text || '{}');
      draft = parsed.draft || '';
      explanation = parsed.explanation || '';
    } catch {
      draft = aiRes.text || '';
      explanation = 'Generated response based on your email thread.';
    }

    if (!draft) {
      draft = `Hi ${convo.contact?.firstName || 'there'},\n\nThank you for reaching out. We have received your message regarding "${latestMessageText}" and are glad to help. Please let us know if you need anything else!\n\nBest regards,\nStone AIO Team`;
      explanation = 'Drafted response acknowledging the customer inquiry.';
    }

    res.json({ draft, explanation });
  } catch (e: any) {
    err500(res, e);
  }
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
