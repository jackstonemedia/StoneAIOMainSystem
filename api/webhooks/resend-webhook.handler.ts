/**
 * Resend Webhook Handler — Email Marketing Module
 *
 * Receives Resend delivery event webhooks at POST /api/webhooks/resend.
 *
 * Security:
 *   - Verifies Resend webhook signature using svix (Resend's signing library).
 *   - Resolves workspaceId from the stored CampaignRecipient.resendMessageId —
 *     NEVER from any value in the incoming payload (not a trusted tenant source).
 *   - Rejects unverified payloads with 401.
 *
 * Event mapping: Resend event types → EmailEventType enum.
 * Hard bounce: adds to SuppressionEntry + sets subscription status to BOUNCED.
 * Complaint: adds to SuppressionEntry + sets subscription status to COMPLAINED.
 * Unsubscribe: instantly unsubscribes contact from all lists.
 */

import type { Request, Response } from 'express';
import { db } from '../../infrastructure/database/client.js';
import { env } from '../../infrastructure/config/env.js';
import { EmailEventType, SubscriptionStatus } from '@prisma/client';
import { addToSuppressionList, unsubscribeByEmail } from '../services/email-marketing/audience.service.js';
import crypto from 'crypto';

// ── Resend event type mapping ─────────────────────────────────────────────────

const RESEND_EVENT_MAP: Record<string, EmailEventType | null> = {
  'email.sent': EmailEventType.SENT,
  'email.delivered': EmailEventType.DELIVERED,
  'email.delivery_delayed': EmailEventType.DELIVERY_DELAYED,
  'email.opened': EmailEventType.OPENED,
  'email.clicked': EmailEventType.CLICKED,
  'email.bounced': EmailEventType.BOUNCED,
  'email.complained': EmailEventType.COMPLAINED,
  'email.unsubscribed': EmailEventType.UNSUBSCRIBED,
};

// ── Signature verification ────────────────────────────────────────────────────

/**
 * Verifies the Resend webhook signature.
 * Resend sends a svix-based signature in headers: svix-id, svix-timestamp, svix-signature.
 * See: https://resend.com/docs/dashboard/webhooks/introduction#verify-webhook-signature
 */
function verifyResendSignature(req: Request): boolean {
  const webhookSecret = env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // If no secret is configured, skip in dev mode only
    if (env.NODE_ENV !== 'production') {
      console.warn('[ResendWebhook] RESEND_WEBHOOK_SECRET not set — skipping verification in dev mode');
      return true;
    }
    console.error('[ResendWebhook] RESEND_WEBHOOK_SECRET not set in production — rejecting webhook');
    return false;
  }

  const svixId = req.headers['svix-id'] as string;
  const svixTimestamp = req.headers['svix-timestamp'] as string;
  const svixSignature = req.headers['svix-signature'] as string;

  if (!svixId || !svixTimestamp || !svixSignature) {
    return false;
  }

  // Replay attack guard: reject if timestamp is >5 minutes old
  const timestampMs = parseInt(svixTimestamp, 10) * 1000;
  if (Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    console.warn('[ResendWebhook] Webhook timestamp too old — possible replay attack');
    return false;
  }

  // Compute expected signature: HMAC-SHA256(svix-id.svix-timestamp.rawBody)
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;

  const secretBytes = Buffer.from(webhookSecret.replace(/^whsec_/, ''), 'base64');
  const computedMac = crypto
    .createHmac('sha256', secretBytes)
    .update(signedContent)
    .digest('base64');

  // svix-signature header can have multiple signatures: "v1,<sig1> v1,<sig2>"
  const signatures = svixSignature.split(' ').map(s => s.replace(/^v1,/, ''));
  const isValid = signatures.some(sig => {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(computedMac, 'base64'),
        Buffer.from(sig, 'base64')
      );
    } catch {
      return false;
    }
  });

  return isValid;
}

// ── Webhook handler ───────────────────────────────────────────────────────────

export async function resendWebhookHandler(req: Request, res: Response): Promise<void> {
  // Always respond 200 quickly to Resend to avoid retries,
  // then process asynchronously. But we must validate first.

  if (!verifyResendSignature(req)) {
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  // Acknowledge immediately
  res.status(200).json({ received: true });

  // Process asynchronously so the response is already sent
  setImmediate(async () => {
    try {
      await processResendEvent(req.body);
    } catch (err) {
      console.error('[ResendWebhook] Error processing event:', err);
    }
  });
}

async function processResendEvent(payload: any): Promise<void> {
  const resendEventType: string = payload?.type;
  const emailId: string = payload?.data?.email_id;
  const toEmail: string = payload?.data?.to?.[0] || payload?.data?.to;

  if (!resendEventType || !emailId) {
    console.warn('[ResendWebhook] Missing type or email_id in payload');
    return;
  }

  const internalEventType = RESEND_EVENT_MAP[resendEventType];
  if (internalEventType === undefined) {
    console.warn(`[ResendWebhook] Unmapped event type: ${resendEventType}`);
    return;
  }
  if (internalEventType === null) {
    return; // Intentionally ignored event
  }

  // ── Resolve workspaceId from stored send record ───────────────────────────
  // We look up by resendMessageId — NEVER trust tenant identity from the webhook payload.
  const recipient = await db.campaignRecipient.findFirst({
    where: { resendMessageId: emailId },
    include: {
      campaign: { select: { workspaceId: true } },
      contact: { select: { id: true, email: true, workspaceId: true } },
    },
  });

  if (!recipient) {
    // Could be an automation-triggered email or a legacy transactional email
    // For automation emails we'd need a separate lookup (future phase)
    console.warn(`[ResendWebhook] No recipient found for message ID: ${emailId}`);
    return;
  }

  const workspaceId = recipient.campaign.workspaceId;
  const contactId = recipient.contactId;
  const campaignId = recipient.campaignId;

  // ── Record EmailEvent ─────────────────────────────────────────────────────
  const linkUrl = payload?.data?.click?.link || null;
  await db.emailEvent.create({
    data: {
      workspaceId,
      contactId,
      campaignId,
      eventType: internalEventType,
      linkUrl: linkUrl || null,
    },
  });

  // ── Handle bounce ─────────────────────────────────────────────────────────
  if (internalEventType === EmailEventType.BOUNCED) {
    const bounceType: string = payload?.data?.bounce?.type || 'soft';

    if (bounceType === 'hard' || bounceType === 'permanent') {
      // Hard bounce: suppress and mark subscription as BOUNCED
      await addToSuppressionList(workspaceId, toEmail, 'hard_bounce');
      await db.contactListMembership.updateMany({
        where: { workspaceId, contactId },
        data: { status: SubscriptionStatus.BOUNCED },
      });
      console.log(`[ResendWebhook] Hard bounce — suppressed ${toEmail} in workspace ${workspaceId}`);
    } else {
      // Soft bounce: log only — no suppression
      console.log(`[ResendWebhook] Soft bounce for ${toEmail} — not suppressing`);
    }
  }

  // ── Handle complaint (spam report) ────────────────────────────────────────
  if (internalEventType === EmailEventType.COMPLAINED) {
    await addToSuppressionList(workspaceId, toEmail, 'spam_complaint');
    await db.contactListMembership.updateMany({
      where: { workspaceId, contactId },
      data: { status: SubscriptionStatus.COMPLAINED },
    });
    console.log(`[ResendWebhook] Spam complaint — suppressed ${toEmail} in workspace ${workspaceId}`);
  }

  // ── Handle unsubscribe ────────────────────────────────────────────────────
  if (internalEventType === EmailEventType.UNSUBSCRIBED) {
    await unsubscribeByEmail(workspaceId, toEmail);
    console.log(`[ResendWebhook] Unsubscribed ${toEmail} in workspace ${workspaceId}`);
  }

  // ── Update contact engagement fields for opens and clicks ─────────────────
  if (internalEventType === EmailEventType.OPENED) {
    await db.contact.updateMany({
      where: { id: contactId, workspaceId },
      data: {
        lastEmailOpenedAt: new Date(),
        totalOpens: { increment: 1 },
      },
    });
  }

  if (internalEventType === EmailEventType.CLICKED) {
    await db.contact.updateMany({
      where: { id: contactId, workspaceId },
      data: { lastEmailClickedAt: new Date() },
    });
  }

  // ── Update campaign recipient delivery status ─────────────────────────────
  if (internalEventType === EmailEventType.DELIVERED) {
    await db.campaignRecipient.updateMany({
      where: { id: recipient.id },
      data: { status: 'DELIVERED' },
    });
  }
}
