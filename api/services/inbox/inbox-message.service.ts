import { db } from '../../../infrastructure/database/client.js';
import { publishInboxEvent, publishWidgetEvent } from '../channels/realtime.service.js';

export async function createMessage(workspaceId: string, conversationId: string, data: {
  senderType: 'agent' | 'contact' | 'bot' | 'system';
  senderId?: string | null;
  content: string;
  contentType?: string;
  contentAttributes?: any;
  private?: boolean;
}) {
  const message = await db.inboxMessage.create({
    data: {
      workspaceId,
      conversationId,
      senderType: data.senderType,
      senderId: data.senderId,
      content: data.content,
      contentType: data.contentType || 'text',
      contentAttributes: data.contentAttributes ? JSON.stringify(data.contentAttributes) : null,
      private: data.private || false,
    },
  });

  if (data.private && data.content.includes('@')) {
    // Basic mention extraction (e.g. @jack)
    const mentions = data.content.match(/@([\w-]+)/g);
    if (mentions) {
      // Create mention records (in a real app we'd map usernames to userIds)
      for (const mention of mentions) {
        const username = mention.substring(1);
        // We'll just store the username as mentionedId for now, 
        // normally we'd look up the userId for this workspace.
        await db.inboxMention.create({
          data: {
            messageId: message.id,
            mentionedId: username, // Stub: storing username instead of userId
          }
        });
      }
    }
  }

  // Automatically update conversation lastActivityAt and status if pending
  // AND dispatch outbound message if it's an email channel
  const convoUpdate: any = { lastActivityAt: new Date() };
  if (data.senderType === 'agent' && !data.private) {
    const convo = await db.inboxConversation.findUnique({
      where: { id: conversationId },
      include: { inboxChannel: true, inboxContact: true }
    });

    if (convo) {
      if (convo.status === 'pending') convoUpdate.status = 'open';
      if (!convo.firstReplyAt) convoUpdate.firstReplyAt = new Date();

      // Dispatch outbound email if channel is email/gmail
      if (convo.inboxChannel && (convo.inboxChannel.channelType === 'email' || convo.inboxChannel.channelType === 'gmail')) {
        const recipientEmail = convo.inboxContact?.email;
        const subject = convo.subject || '(no subject)';
        const body = data.content;
        const htmlBody = data.contentType === 'html' ? data.content : undefined;

        if (recipientEmail) {
          try {
            // Find the workspace's active Gmail channel connection
            let gmailConn = await db.channelConnection.findFirst({
              where: { workspaceId, provider: 'gmail', isActive: true },
            });
            if (!gmailConn) {
              gmailConn = await db.channelConnection.findFirst({
                where: { provider: 'gmail', isActive: true },
              });
            }

            if (gmailConn) {
              const { sendGmailMessage } = await import('../channels/gmail.service.js');
              let attrs: any = {};
              try { attrs = JSON.parse(convo.additionalAttributes || '{}'); } catch(e) {}

              const sent = await sendGmailMessage(
                gmailConn.id, recipientEmail, subject, body, attrs.threadId, htmlBody
              );

              if (sent && sent.threadId && !attrs.threadId) {
                attrs.threadId = sent.threadId;
                convoUpdate.additionalAttributes = JSON.stringify(attrs);
              }
            } else {
              console.warn('[Inbox Dispatch] No active Gmail connection found.');
              throw new Error('No active Gmail connection found. Please connect your Gmail account in Settings > Integrations.');
            }
          } catch (err: any) {
            console.error('[Inbox Dispatch] Failed to send outbound email:', err.message);
            throw err;
          }
        }
      }
    }
  }

  const updatedConvo = await db.inboxConversation.update({
    where: { id: conversationId },
    data: convoUpdate,
  });

  // Broadcast real-time events
  const eventType = data.private ? 'message.created.private' : 'message.created';
  await publishInboxEvent(workspaceId, { type: eventType, workspaceId, conversationId, payload: message });
  
  if (!data.private) {
    await publishWidgetEvent(conversationId, { type: 'message.created', workspaceId, conversationId, payload: message });
  }

  // Also publish conversation update so badges/sorting update on client
  if (Object.keys(convoUpdate).length > 1) { // more than just lastActivityAt
    await publishInboxEvent(workspaceId, { type: 'conversation.updated', workspaceId, conversationId, payload: updatedConvo });
  }

  return message;
}

export async function listMessages(workspaceId: string, conversationId: string, page: number = 1, pageSize: number = 50) {
  const messages = await db.inboxMessage.findMany({
    where: { workspaceId, conversationId },
    orderBy: { createdAt: 'asc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: { mentions: true },
  });

  const total = await db.inboxMessage.count({ where: { workspaceId, conversationId } });

  return {
    messages,
    hasMore: (page * pageSize) < total,
  };
}
