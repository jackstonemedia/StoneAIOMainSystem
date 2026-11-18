/**
 * Communication & Email Tools — Stone AIO Assistant
 * Spec Section 2.8 & Stage S3
 */

import { db } from '../../../../infrastructure/database/client.js';
import type { ToolDefinition } from './types.js';

export const communicationTools: ToolDefinition[] = [
  // 1. list_inbox_messages
  {
    name: 'list_inbox_messages',
    description: 'List recent conversations and messages from the workspace inbox (email/SMS threads). Pass conversationId to read one thread\'s messages. Returns each thread with its recent messages — use this when the person asks what was said in a conversation.',
    risk: 'read',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        channel: { type: 'string', description: 'Filter by channel: email, sms, etc.' },
        contactId: { type: 'string', description: 'Filter by contact ID.' },
        conversationId: { type: 'string', description: 'Read the messages of one conversation thread by its UUID.' },
        limit: { type: 'number', description: 'Maximum conversations to return (default 20).' },
      },
    },
    execute: async (args: { channel?: string; contactId?: string; conversationId?: string; limit?: number }, ctx) => {
      // Single-thread read: the thread's messages, oldest first.
      // (Previously only the latest message per thread was returned, so
      // earlier messages — e.g. "Is the retainer still open?" — were
      // invisible to the assistant. Eval p4-conv-02.)
      if (args.conversationId) {
        const convo = await db.conversation.findFirst({
          where: { id: args.conversationId, workspaceId: ctx.workspaceId },
          include: { contact: { select: { id: true, firstName: true, lastName: true } } },
        });
        if (!convo) throw new Error('Conversation not found.');
        const rows = await db.conversationMessage.findMany({
          where: { conversationId: convo.id },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });
        const messages = rows.reverse().map((m: any) => ({
          sender: m.sender,
          body: m.body,
          direction: m.direction,
          createdAt: m.createdAt,
        }));
        return {
          conversation: {
            id: convo.id,
            channel: convo.channel,
            status: convo.status,
            subject: convo.subject,
            contact: convo.contact ? `${convo.contact.firstName} ${convo.contact.lastName}`.trim() : null,
          },
          messages,
          total: messages.length,
        };
      }

      const take = Math.min(Math.max(args.limit || 20, 1), 50);
      const conversations = await db.conversation.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          ...(args.channel ? { channel: args.channel } : {}),
          ...(args.contactId ? { contactId: args.contactId } : {}),
        },
        include: {
          contact: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
        orderBy: { updatedAt: 'desc' },
        take,
      });

      return {
        conversations: conversations.map((c) => ({
          id: c.id,
          channel: c.channel,
          status: c.status,
          subject: c.subject,
          contact: c.contact ? `${c.contact.firstName} ${c.contact.lastName}`.trim() : null,
          lastMessage: c.messages[0]?.body || null,
          lastMessageAt: c.lastMessageAt,
          unreadCount: c.unreadCount,
          messages: [...c.messages].reverse().map((m: any) => ({
            sender: m.sender,
            body: m.body,
            direction: m.direction,
            createdAt: m.createdAt,
          })),
        })),
        total: conversations.length,
      };
    },
  },

  // 1b. list_inbox_conversations (eval-gap fix: the assistant could not see
  // the workspace inbox threads — they live in inboxConversation /
  // inboxMessage, which list_inbox_messages never read. Eval p4-inbox-01/02.)
  {
    name: 'list_inbox_conversations',
    description: 'List inbox conversation threads from the workspace inbox (subjects, status, contact, recent messages). Use this when the person asks to list or show inbox conversations or threads, or what came into the inbox.',
    risk: 'read',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status: open, resolved, etc.' },
        limit: { type: 'number', description: 'Maximum threads to return (default 20).' },
      },
    },
    execute: async (args: { status?: string; limit?: number }, ctx) => {
      const take = Math.min(Math.max(args.limit || 20, 1), 50);
      const threads = await db.inboxConversation.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          ...(args.status ? { status: args.status } : {}),
        },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
        orderBy: { lastActivityAt: 'desc' },
        take,
      });

      const contactIds = [...new Set(threads.map((t: any) => t.crmContactId).filter(Boolean))];
      const contacts = contactIds.length
        ? await db.contact.findMany({
            where: { id: { in: contactIds }, workspaceId: ctx.workspaceId },
            select: { id: true, firstName: true, lastName: true },
          })
        : [];
      const nameById = new Map(contacts.map((c: any) => [c.id, `${c.firstName} ${c.lastName}`.trim()]));

      return {
        conversations: threads.map((t: any) => ({
          id: t.id,
          subject: t.subject,
          status: t.status,
          contact: t.crmContactId ? (nameById.get(t.crmContactId) ?? null) : null,
          lastMessage: t.messages[0]?.content || null,
          lastMessageAt: t.lastActivityAt,
          unreadCount: t.unreadCount,
          messages: [...t.messages].reverse().map((m: any) => ({
            senderType: m.senderType,
            content: m.content,
            createdAt: m.createdAt,
          })),
        })),
        total: threads.length,
      };
    },
  },

  // 2. draft_email
  {
    name: 'draft_email',
    description: 'Create a draft email in the workspace inbox for review before sending. Use this only when the person asks to draft (not send) an email.',
    risk: 'write',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        recipientEmail: { type: 'string', description: 'Recipient email address.' },
        subject: { type: 'string', description: 'Email subject line.' },
        body: { type: 'string', description: 'Email body text or HTML.' },
        contactId: { type: 'string', description: 'Contact ID to attach conversation to.' },
      },
      required: ['recipientEmail', 'subject', 'body'],
    },
    execute: async (
      args: { recipientEmail: string; subject: string; body: string; contactId?: string },
      ctx
    ) => {
      // Create conversation as email draft
      const convo = await db.conversation.create({
        data: {
          workspaceId: ctx.workspaceId,
          contactId: args.contactId || null,
          channel: 'email',
          status: 'draft',
          subject: args.subject,
          assignedUserId: ctx.userId,
        },
      });

      const message = await db.conversationMessage.create({
        data: {
          conversationId: convo.id,
          sender: ctx.userId,
          body: args.body,
          direction: 'outbound',
          status: 'draft',
        },
      });

      return {
        conversationId: convo.id,
        messageId: message.id,
        subject: args.subject,
        recipientEmail: args.recipientEmail,
        status: 'draft_created',
        message: 'Draft email created successfully. Ready for review.',
      };
    },
  },

  // 3. send_email
  {
    name: 'send_email',
    description: 'Send an email to a recipient via the workspace email integration. Use this when the person asks to SEND an email — in draft mode it queues for approval and never sends without approval.',
    risk: 'send',
    capability: 'send_email',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        recipientEmail: { type: 'string', description: 'Recipient email address.' },
        subject: { type: 'string', description: 'Email subject line.' },
        body: { type: 'string', description: 'Email content.' },
        contactId: { type: 'string', description: 'Optional Contact ID.' },
      },
      required: ['recipientEmail', 'subject', 'body'],
    },
    execute: async (
      args: { recipientEmail: string; subject: string; body: string; contactId?: string },
      ctx
    ) => {
      // Real delivery first: the workspace's active Gmail connection.
      // No connection = honest error, and nothing is recorded.
      const gmailConn = await db.channelConnection.findFirst({
        where: { workspaceId: ctx.workspaceId, provider: 'gmail', isActive: true },
      });
      if (!gmailConn) {
        throw new Error(
          'No active Gmail connection found. Please connect your Gmail account in Settings > Integrations.'
        );
      }

      const { sendGmailMessage } = await import('../../channels/gmail.service.js');
      // Send before recording — the row is only marked 'sent' after Gmail
      // confirms. A failed send throws and leaves no trace.
      const sent = await sendGmailMessage(
        gmailConn.id,
        args.recipientEmail,
        args.subject,
        args.body
      );

      // Fresh conversation per send: reusing an old thread for a new subject
      // would mis-thread it. The Gmail thread id is stored so replies thread.
      const convo = await db.conversation.create({
        data: {
          workspaceId: ctx.workspaceId,
          contactId: args.contactId || null,
          channel: 'email',
          status: 'open',
          subject: args.subject,
          externalId: sent.threadId,
          channelConnectionId: gmailConn.id,
          assignedUserId: ctx.userId,
        },
      });

      const msg = await db.conversationMessage.create({
        data: {
          conversationId: convo.id,
          sender: ctx.userId,
          body: args.body,
          direction: 'outbound',
          status: 'sent',
          externalId: sent.messageId,
        },
      });

      await db.conversation.update({
        where: { id: convo.id },
        data: {
          lastMessageAt: new Date(),
          status: 'open',
        },
      });

      if (args.contactId && db.contactEvent && typeof db.contactEvent.create === 'function') {
        await db.contactEvent
          .create({
            data: {
              contactId: args.contactId,
              type: 'email',
              title: `Emailed: ${args.subject}`,
              content: args.body,
              metadataJson: JSON.stringify({
                createdByAssistant: true,
                createdForUserId: ctx.userId,
                createdForUserName: ctx.userName || 'User',
                source: 'assistant',
                messageId: msg.id,
              }),
            },
          })
          .catch(() => {});
      }

      return {
        messageId: msg.id,
        conversationId: convo.id,
        recipient: args.recipientEmail,
        subject: args.subject,
        status: 'sent',
        gmailMessageId: sent.messageId,
        message: `Email sent successfully to ${args.recipientEmail}.`,
      };
    },
  },

  // 4. reply_to_conversation
  {
    name: 'reply_to_conversation',
    description: 'Send a reply message in an open customer conversation thread.',
    risk: 'send',
    capability: 'send_email',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        conversationId: { type: 'string', description: 'The UUID of the conversation thread.' },
        body: { type: 'string', description: 'The reply message content.' },
      },
      required: ['conversationId', 'body'],
    },
    execute: async (args: { conversationId: string; body: string }, ctx) => {
      const convo = await db.conversation.findFirst({
        where: { id: args.conversationId, workspaceId: ctx.workspaceId },
      });

      if (!convo) {
        throw new Error(`Conversation ${args.conversationId} not found in workspace.`);
      }

      if (convo.channel !== 'email') {
        throw new Error(
          `Cannot reply to a ${convo.channel} conversation from the assistant. Email replies only.`
        );
      }

      // The reply goes to the conversation's contact.
      let recipientEmail: string | undefined;
      if (convo.contactId) {
        const contact = await db.contact.findFirst({
          where: { id: convo.contactId, workspaceId: ctx.workspaceId },
          select: { email: true },
        });
        recipientEmail = contact?.email || undefined;
      }
      if (!recipientEmail) {
        throw new Error('Cannot reply: this conversation has no contact email address.');
      }

      const gmailConn = await db.channelConnection.findFirst({
        where: { workspaceId: ctx.workspaceId, provider: 'gmail', isActive: true },
      });
      if (!gmailConn) {
        throw new Error(
          'No active Gmail connection found. Please connect your Gmail account in Settings > Integrations.'
        );
      }

      // Thread only when this conversation is actually a Gmail thread of the
      // connection we are sending from; otherwise send as a new message and
      // say so — never claim a threaded reply that did not happen.
      const threadId =
        convo.channelConnectionId === gmailConn.id && convo.externalId
          ? convo.externalId
          : undefined;

      const { sendGmailMessage } = await import('../../channels/gmail.service.js');
      const sent = await sendGmailMessage(
        gmailConn.id,
        recipientEmail,
        convo.subject || '(no subject)',
        args.body,
        threadId
      );

      const msg = await db.conversationMessage.create({
        data: {
          conversationId: convo.id,
          sender: ctx.userId,
          body: args.body,
          direction: 'outbound',
          status: 'sent',
          externalId: sent.messageId,
        },
      });

      await db.conversation.update({
        where: { id: convo.id },
        data: {
          lastMessageAt: new Date(),
          status: 'open',
          ...(threadId
            ? {}
            : { externalId: sent.threadId, channelConnectionId: gmailConn.id }),
        },
      });

      return {
        messageId: msg.id,
        conversationId: convo.id,
        status: 'sent',
        gmailMessageId: sent.messageId,
        message: threadId
          ? 'Reply sent successfully in conversation thread.'
          : 'Reply sent as a new email (no Gmail thread was linked to this conversation).',
      };
    },
  },

  // 5. send_sms
  {
    name: 'send_sms',
    description: 'Send an outbound SMS message to a contact phone number.',
    risk: 'send',
    capability: 'send_sms',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        phoneNumber: { type: 'string', description: 'Recipient phone number (E.164 format).' },
        message: { type: 'string', description: 'SMS message body text.' },
        contactId: { type: 'string', description: 'Optional Contact ID.' },
      },
      required: ['phoneNumber', 'message'],
    },
    execute: async (args: { phoneNumber: string; message: string; contactId?: string }, ctx) => {
      // If contactId provided, check DND
      if (args.contactId) {
        const contact = await db.contact.findFirst({
          where: { id: args.contactId, workspaceId: ctx.workspaceId },
        });
        if (contact && contact.dndEnabled) {
          throw new Error(`Cannot send SMS: Contact ${contact.firstName || ''} ${contact.lastName || ''} has DND enabled.`);
        }
      }

      // SMS sending is not set up — there is no Twilio dispatch anywhere in
      // the assistant. Fail honestly instead of recording a fake 'sent'.
      // (The DND check above still runs first: a DND refusal is the more
      // specific answer when it applies.)
      throw new Error('SMS sending is not set up. Connect a Twilio account to enable SMS sending.');
    },
  },
];
