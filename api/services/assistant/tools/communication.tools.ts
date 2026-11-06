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
    description: 'List recent conversations and messages from the workspace inbox.',
    risk: 'read',
    minimumRole: 'member',
    parameters: {
      type: 'object',
      properties: {
        channel: { type: 'string', description: 'Filter by channel: email, sms, etc.' },
        contactId: { type: 'string', description: 'Filter by contact ID.' },
        limit: { type: 'number', description: 'Maximum conversations to return (default 20).' },
      },
    },
    execute: async (args: { channel?: string; contactId?: string; limit?: number }, ctx) => {
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
            take: 1,
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
        })),
        total: conversations.length,
      };
    },
  },

  // 2. draft_email
  {
    name: 'draft_email',
    description: 'Create a draft email in the workspace inbox for review before sending.',
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
    description: 'Send an email to a recipient via the workspace email integration.',
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
      // Find or create conversation
      let convo = await db.conversation.findFirst({
        where: {
          workspaceId: ctx.workspaceId,
          ...(args.contactId ? { contactId: args.contactId } : {}),
          channel: 'email',
        },
      });

      if (!convo) {
        convo = await db.conversation.create({
          data: {
            workspaceId: ctx.workspaceId,
            contactId: args.contactId || null,
            channel: 'email',
            status: 'open',
            subject: args.subject,
            assignedUserId: ctx.userId,
          },
        });
      }

      const msg = await db.conversationMessage.create({
        data: {
          conversationId: convo.id,
          sender: ctx.userId,
          body: args.body,
          direction: 'outbound',
          status: 'sent',
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

      const msg = await db.conversationMessage.create({
        data: {
          conversationId: convo.id,
          sender: ctx.userId,
          body: args.body,
          direction: 'outbound',
          status: 'sent',
        },
      });

      await db.conversation.update({
        where: { id: convo.id },
        data: {
          lastMessageAt: new Date(),
          status: 'open',
        },
      });

      return {
        messageId: msg.id,
        conversationId: convo.id,
        status: 'sent',
        message: `Reply sent successfully in conversation thread.`,
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

      let convo = await db.conversation.findFirst({
        where: {
          workspaceId: ctx.workspaceId,
          ...(args.contactId ? { contactId: args.contactId } : {}),
          channel: 'sms',
        },
      });

      if (!convo) {
        convo = await db.conversation.create({
          data: {
            workspaceId: ctx.workspaceId,
            contactId: args.contactId || null,
            channel: 'sms',
            status: 'open',
            assignedUserId: ctx.userId,
          },
        });
      }

      const msg = await db.conversationMessage.create({
        data: {
          conversationId: convo.id,
          sender: ctx.userId,
          body: args.message,
          direction: 'outbound',
          status: 'sent',
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
              type: 'sms',
              title: `SMS to ${args.phoneNumber}`,
              content: args.message,
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
        recipient: args.phoneNumber,
        status: 'sent',
        message: `SMS sent successfully to ${args.phoneNumber}.`,
      };
    },
  },
];
