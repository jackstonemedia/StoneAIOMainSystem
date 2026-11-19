/**
 * Channel auto-reply — Tier 3 Tranche A, Fix 12.
 *
 * The Conversations channel settings form offered an auto-reply toggle and
 * message, but the PATCH route dropped them and nothing ever sent a reply.
 * Called (non-fatally) from the Gmail poller and the Outlook webhook right
 * after an inbound message is stored.
 *
 * Rule: reply exactly once per conversation — when an inbound message
 * arrives and no outbound message exists in that conversation yet. That is
 * the operational meaning of the form's "when no one is available": once
 * anyone (agent or a previous auto-reply) has answered, later inbound
 * messages get no auto-reply. The send counts toward the mailbox's daily
 * total, like any other send from the connection.
 */
import { db } from '../../../infrastructure/database/client.js';

export async function maybeSendAutoReply({
  connectionId,
  conversationId,
  senderEmail,
  subject,
  threadId,
}: {
  connectionId: string;
  conversationId: string;
  senderEmail: string;
  subject: string;
  threadId?: string;
}): Promise<boolean> {
  const conn = await db.channelConnection.findUnique({ where: { id: connectionId } });
  if (!conn?.autoReply || !conn.autoReplyText?.trim()) return false;

  const alreadyReplied = await db.conversationMessage.findFirst({
    where: { conversationId, direction: 'outbound' },
    select: { id: true },
  });
  if (alreadyReplied) return false;

  const text = conn.autoReplyText.trim();
  const replySubject = subject ? `Re: ${subject}` : 'Re: your message';
  try {
    if (conn.provider === 'outlook') {
      const { sendOutlookMessage } = await import('./outlook.service.js');
      const sent = await sendOutlookMessage(
        conn.id,
        senderEmail,
        replySubject,
        text.replace(/\n/g, '<br/>'),
        threadId,
      );
      await db.conversationMessage.create({
        data: {
          conversationId,
          sender: conn.email ?? 'Stone AIO',
          body: text,
          direction: 'outbound',
          channel: 'email',
          status: 'delivered',
          externalId: sent.conversationId ?? undefined,
        },
      });
    } else {
      const { sendGmailMessage } = await import('./gmail.service.js');
      const sent = await sendGmailMessage(conn.id, senderEmail, replySubject, text, threadId);
      await db.conversationMessage.create({
        data: {
          conversationId,
          sender: conn.email ?? 'Stone AIO',
          body: text,
          direction: 'outbound',
          channel: 'email',
          status: 'delivered',
          externalId: sent.messageId,
        },
      });
    }
    const { recordSendSuccess } = await import('../email-marketing/mailbox-pool.service.js');
    await recordSendSuccess(conn.id).catch(() => null);
    return true;
  } catch (err) {
    console.warn('[AutoReply] Failed to send auto-reply (non-fatal):', (err as Error).message);
    return false;
  }
}
