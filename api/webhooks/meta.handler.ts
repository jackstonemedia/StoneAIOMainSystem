import { Request, Response } from 'express';
import crypto from 'node:crypto';
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

let metaSecretWarned = false;

/**
 * Verifies Meta's X-Hub-Signature-256 (HMAC-SHA256 over the raw request body,
 * keyed by the Meta App Secret). The POST route mounts express.raw() so the
 * raw bytes are available on (req as any).rawBody.
 *
 * Returns true when the payload is verified — or when no META_APP_SECRET is
 * configured, in which case a loud warning is logged once and the payload is
 * accepted (dev parity with the previous accept-everything behavior).
 */
export function verifyMetaSignature(req: Request): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret) {
    if (!metaSecretWarned) {
      metaSecretWarned = true;
      console.warn(
        '[Meta Webhook] META_APP_SECRET is not set — accepting unverified payloads. ' +
          'Set it in production so forged messages are rejected.',
      );
    }
    return true;
  }
  const signature = req.headers['x-hub-signature-256'];
  const rawBody: Buffer | undefined = (req as any).rawBody;
  if (typeof signature !== 'string' || !rawBody) return false;
  const expected =
    'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

export const metaWebhookPost = async (req: Request, res: Response): Promise<void> => {
  // Parse from the raw body when the route mounted express.raw(); fall back
  // to the already-parsed body (unit tests, or a mount without raw parsing).
  let body: any = req.body;
  const rawBody: Buffer | undefined = (req as any).rawBody;
  if (rawBody) {
    try {
      body = JSON.parse(rawBody.toString('utf8'));
    } catch {
      res.sendStatus(400);
      return;
    }
  }

  // Verify BEFORE acking — a bad signature must not get a 200.
  if (!verifyMetaSignature(req)) {
    console.warn('[Meta Webhook] Bad or missing X-Hub-Signature-256; rejecting.');
    res.sendStatus(403);
    return;
  }

  res.status(200).send('EVENT_RECEIVED'); // Must respond quickly — Meta retries on timeout
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
