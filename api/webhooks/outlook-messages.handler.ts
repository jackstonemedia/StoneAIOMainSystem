import { Request, Response } from 'express';
import axios from 'axios';
import { db } from '../../infrastructure/database/client.js';

export async function outlookWebhookHandler(req: Request, res: Response): Promise<void> {
  // GET = Microsoft subscription validation challenge
  if (req.method === 'GET' && req.query.validationToken) {
    res.status(200).type('text/plain').send(req.query.validationToken as string);
    return;
  }

  // Respond 202 immediately — Microsoft requires a response in under 30 seconds
  res.status(202).send();

  const notifications: any[] = req.body?.value ?? [];

  for (const notification of notifications) {
    const connectionId: string = notification.clientState ?? '';
    if (!connectionId) continue;

    try {
      const conn = await db.channelConnection.findUnique({ where: { id: connectionId } });
      if (!conn?.isActive) continue;

      const { decryptJson } = await import('../services/channels/encryption.js');
      const creds = decryptJson<{ access_token: string; refresh_token: string; expires_at: number }>(
        conn.credentialsJson
      );

      const msgRes = await axios.get(
        `https://graph.microsoft.com/v1.0/me/messages/${notification.resourceData?.id}`,
        { headers: { Authorization: `Bearer ${creds.access_token}` } }
      ).catch(() => null);

      if (!msgRes) continue;
      const msg = msgRes.data;

      // Skip outbound messages
      if (msg.isDraft || msg.sentDateTime) continue;

      const externalId: string = msg.id;
      const threadId: string = msg.conversationId;
      const from: string = msg.from?.emailAddress?.address ?? '';
      const subject: string = msg.subject ?? '(no subject)';
      const body: string = msg.body?.content ?? '';

      // Deduplication
      const exists = await db.conversationMessage.findFirst({ where: { externalId } });
      if (exists) continue;

      let convo = await db.conversation.findFirst({
        where: { workspaceId: conn.workspaceId, externalId: threadId },
      });

      if (!convo) {
        const contact = await db.contact.findFirst({
          where: { workspaceId: conn.workspaceId, email: from },
        });
        convo = await db.conversation.create({
          data: {
            workspaceId: conn.workspaceId,
            contactId: contact?.id ?? null,
            channel: 'email',
            status: 'open',
            subject,
            externalId: threadId,
            channelConnectionId: conn.id,
            lastMessageAt: new Date(),
            unreadCount: 1,
          },
        });
      }

      await db.conversationMessage.create({
        data: { conversationId: convo.id, sender: from, body, direction: 'inbound', externalId, channel: 'email' },
      });

      await db.conversation.update({
        where: { id: convo.id },
        data: { unreadCount: { increment: 1 }, lastMessageAt: new Date(), updatedAt: new Date() },
      });

      const { publishConversationEvent } = await import('../services/channels/realtime.service.js');
      await publishConversationEvent(conn.workspaceId, { type: 'new_message', conversationId: convo.id });
    } catch (err) {
      console.error('[Outlook Webhook] Error:', err);
    }
  }
}
