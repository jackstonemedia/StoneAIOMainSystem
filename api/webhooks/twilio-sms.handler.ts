import { Request, Response } from 'express';
import twilio from 'twilio';
import { db } from '../../infrastructure/database/client.js';

export async function twilioSmsHandler(req: Request, res: Response): Promise<void> {
  // Twilio POSTs application/x-www-form-urlencoded — parsed by the urlencoded middleware
  // that must be applied to this route specifically (not globally).
  const toNumber: string = req.body?.To ?? '';
  const fromNumber: string = req.body?.From ?? '';
  const bodyText: string = req.body?.Body ?? '';

  if (!toNumber) { res.status(400).send('Missing To field'); return; }

  // PASS 1 — Look up the connection by To number (before signature validation)
  const connection = await db.channelConnection.findFirst({
    where: { twilioPhoneNumber: toNumber, isActive: true },
  }).catch(() => null);

  // PASS 2 — Determine which auth token to validate against
  let authToken: string | null = null;

  if (process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER === toNumber) {
    // Platform-level Twilio account (env vars)
    authToken = process.env.TWILIO_AUTH_TOKEN;
  } else if (connection) {
    // Per-user connection with encrypted credentials
    try {
      const { decryptJson } = await import('../services/channels/encryption.js');
      const creds = decryptJson<{ authToken: string }>(connection.credentialsJson);
      authToken = creds.authToken;
    } catch {}
  }

  // Validate Twilio signature in production
  if (process.env.NODE_ENV === 'production' && authToken) {
    const sig = (req.headers['x-twilio-signature'] as string) ?? '';
    const url = `${process.env.VITE_APP_URL}/api/hooks/twilio-sms`;
    const isValid = twilio.validateRequest(authToken, sig, url, req.body);
    if (!isValid) { res.status(403).send('Invalid Twilio signature'); return; }
  }

  // Acknowledge Twilio immediately — must respond within 5 seconds
  res.status(200).type('text/xml').send('<Response></Response>');

  // Resolve workspace
  const workspaceId: string | null = connection?.workspaceId ?? null;
  if (!workspaceId) {
    console.warn(`[Twilio] Received SMS to unknown number ${toNumber} — no matching connection`);
    return;
  }

  try {
    // Find or create conversation keyed by the sender's phone number + channel
    let convo = await db.conversation.findFirst({
      where: { workspaceId, externalId: fromNumber, channel: 'sms' },
    });

    if (!convo) {
      const contact = await db.contact.findFirst({
        where: { workspaceId, phone: fromNumber },
      });
      convo = await db.conversation.create({
        data: {
          workspaceId,
          contactId: contact?.id ?? null,
          channel: 'sms',
          status: 'open',
          externalId: fromNumber,
          channelConnectionId: connection?.id ?? null,
          lastMessageAt: new Date(),
          unreadCount: 1,
        },
      });
    }

    await db.conversationMessage.create({
      data: {
        conversationId: convo.id,
        sender: fromNumber,
        body: bodyText,
        direction: 'inbound',
        channel: 'sms',
        status: 'delivered',
      },
    });

    await db.conversation.update({
      where: { id: convo.id },
      data: { unreadCount: { increment: 1 }, lastMessageAt: new Date(), updatedAt: new Date() },
    });

    const { publishConversationEvent } = await import('../services/channels/realtime.service.js');
    await publishConversationEvent(workspaceId, { type: 'new_message', conversationId: convo.id });
  } catch (err) {
    console.error('[Twilio] Error processing inbound SMS:', err);
  }
}
