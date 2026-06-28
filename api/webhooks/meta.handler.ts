import { Request, Response } from 'express';
import { db } from '../../infrastructure/database/client.js';

export const metaWebhookVerify = (req: Request, res: Response): void => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    console.log('[Meta Webhook] Verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
};

export const metaWebhookPost = async (req: Request, res: Response): Promise<void> => {
  res.status(200).send('EVENT_RECEIVED'); // Must respond quickly — Meta retries on timeout
  const body = req.body;
  if (body.object !== 'page' && body.object !== 'instagram') return;
  try {
    for (const entry of body.entry ?? []) {
      // entry.id is the Facebook Page ID or Instagram account ID
      const pageId = entry.id as string | undefined;
      const webhookEvent = entry.messaging?.[0];
      if (!webhookEvent?.message) continue;
      const senderId: string = webhookEvent.sender.id;
      const msgText: string = webhookEvent.message.text ?? '';
      const provider = body.object === 'instagram' ? 'instagram' : 'facebook';
      
      // Resolve workspace by matching the specific page/account ID
      const whereClause: any = { provider };
      if (pageId) whereClause.accountId = pageId;
      
      const integration = await db.integration.findFirst({
        where: whereClause,
        select: { workspaceId: true },
      });
      if (!integration) continue;
      const { workspaceId } = integration;
      let convo = await db.conversation.findFirst({
        where: { workspaceId, externalId: senderId, channel: provider as any },
      });
      if (!convo) {
        convo = await db.conversation.create({
          data: {
            workspaceId,
            channel: provider as any,
            externalId: senderId,
            status: 'open',
            lastMessageAt: new Date(),
            unreadCount: 1,
          },
        });
      }
      await db.conversationMessage.create({
        data: {
          conversationId: convo.id,
          sender: senderId,
          direction: 'inbound',
          body: msgText,
          channel: provider,
        },
      });
      await db.conversation.update({
        where: { id: convo.id },
        data: { unreadCount: { increment: 1 }, lastMessageAt: new Date(), updatedAt: new Date() },
      });
    }
  } catch (err: any) {
    console.error('[Meta Webhook] error processing event', err);
  }
};
