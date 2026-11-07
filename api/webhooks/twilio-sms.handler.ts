import { Request, Response } from 'express';
import twilio from 'twilio';
import { db } from '../../infrastructure/database/client.js';
import { claimWebhookEvent } from '../../infrastructure/database/idempotency.js';

/**
 * Reconstructs the exact URL Twilio called, for signature validation.
 * Twilio signs the full URL + sorted POST params, so any mismatch (wrong host,
 * wrong scheme, stray port) fails validation. PUBLIC_APP_URL is the server's
 * canonical public URL; VITE_APP_URL is the legacy fallback; the request
 * itself is the last resort (correct only with `trust proxy` set, since
 * Render/Railway terminate TLS in front of the app).
 */
export function buildTwilioRequestUrl(req: Request): string {
  const path = req.originalUrl || req.url || '/api/hooks/twilio-sms';
  const base = (process.env.PUBLIC_APP_URL || process.env.VITE_APP_URL || '').replace(/\/$/, '');
  if (base) return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const protocol = req.protocol || 'https';
  const host = req.get('host') || 'localhost';
  return `${protocol}://${host}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function twilioSmsHandler(req: Request, res: Response): Promise<void> {
  // Twilio POSTs application/x-www-form-urlencoded — parsed by the urlencoded middleware
  // that must be applied to this route specifically (not globally).
  const toNumber: string = req.body?.To ?? '';
  const fromNumber: string = req.body?.From ?? '';
  const bodyText: string = req.body?.Body ?? '';
  const numMedia = Number(req.body?.NumMedia || 0);

  if (!toNumber) { res.status(400).send('Missing To field'); return; }

  // Delivery receipts and status callbacks carry no Body and no media — ack
  // and ignore them instead of storing an empty message row.
  if (!bodyText && numMedia === 0) {
    res.status(200).type('text/xml').send('<Response></Response>');
    return;
  }

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

  // Validate Twilio signature in production.
  // BUG FIX (2026-11-07): the URL used to be built from VITE_APP_URL alone.
  // That is a frontend build-time var — render.yaml sets only NODE_ENV in
  // prod, so the URL became "undefined/api/hooks/twilio-sms" and every
  // inbound SMS failed validation with a 403. Reconstruct from
  // PUBLIC_APP_URL first (see buildTwilioRequestUrl).
  if (process.env.NODE_ENV === 'production' && authToken) {
    const sig = (req.headers['x-twilio-signature'] as string) ?? '';
    const url = buildTwilioRequestUrl(req);
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

  // P1.2: Check idempotency to prevent duplicate message storage on retried webhooks
  const messageSid: string = req.body?.MessageSid ?? '';
  if (messageSid) {
    const isNew = await claimWebhookEvent('twilio', messageSid, { from: fromNumber, to: toNumber });
    if (!isNew) {
      console.log(`[Twilio] Duplicate MessageSid ${messageSid} ignored.`);
      return;
    }
  }

  try {
    // Find conversation: first by externalId (fast path), then by contact phone (fallback
    // for conversations started via the UI compose modal before externalId was set)
    let convo = await db.conversation.findFirst({
      where: { workspaceId, channel: 'sms', externalId: fromNumber },
    });

    if (!convo) {
      let contact = await db.contact.findFirst({
        where: { workspaceId, phone: fromNumber },
      });
      // No CRM record for this number yet — create one so the sender becomes
      // a lead, mirroring the Gmail inbound path (find-or-create by address).
      if (!contact) {
        contact = await db.contact
          .create({
            data: {
              workspaceId,
              phone: fromNumber,
              firstName: fromNumber,
              lastName: '',
              status: 'Lead',
              source: 'sms',
            },
          })
          .catch(() => null);
      }
      // Check if there's an existing open SMS conversation for this contact
      if (contact) {
        convo = await db.conversation.findFirst({
          where: { workspaceId, channel: 'sms', contactId: contact.id, status: 'open' },
          orderBy: { updatedAt: 'desc' },
        });
      }
      if (convo && !convo.externalId) {
        // Stamp the externalId now so future lookups hit the fast path
        await db.conversation.update({
          where: { id: convo.id },
          data: { externalId: fromNumber },
        }).catch(() => null);
      }
      if (!convo) {
        convo = await db.conversation.create({
          data: {
            workspaceId,
            contactId: contact?.id ?? null,
            channel: 'sms',
            status: 'open',
            externalId: fromNumber,
            channelConnectionId: connection?.id ?? null,
            lastMessageAt: new Date(),
            unreadCount: 0, // first message lands at 1 via the increment below (was 1 + increment = 2)
          },
        });
      }
    }

    const mediaUrls: string[] = [];
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = req.body?.[`MediaUrl${i}`];
      if (mediaUrl) mediaUrls.push(mediaUrl);
    }

    await db.conversationMessage.create({
      data: {
        conversationId: convo.id,
        sender: fromNumber,
        body: bodyText,
        direction: 'inbound',
        channel: 'sms',
        status: 'delivered',
        attachments: mediaUrls.length > 0 ? JSON.stringify({ mediaUrls }) : null,
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
