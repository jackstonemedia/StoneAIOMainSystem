/**
 * Stop-on-Reply Service — Native Outreach Engine
 *
 * When an inbound message/reply is received from a lead in Gmail or Conversations:
 * 1. Matches lead by email address within the specific workspace.
 * 2. Updates contact's engagement counters (lastEmailRepliedAt, totalReplies).
 * 3. Immediately stops any pending outreach campaign recipients for that contact.
 * 4. Exits active automation enrollments with exitReason = 'REPLIED'.
 * 5. Emits an EmailEvent of type REPLIED so campaign analytics reflect the conversion.
 * 6. Logs a ContactEvent to the CRM timeline.
 */

import { db } from '../../../infrastructure/database/client.js';
import { EmailEventType, EnrollmentExitReason } from '@prisma/client';

export interface InboundReplyPayload {
  workspaceId: string;
  senderEmail: string;
  subject?: string;
  bodySnippet?: string;
  messageId?: string;
  threadId?: string;
  receivedAt?: Date;
}

export interface StopOnReplyResult {
  handled: boolean;
  contactId?: string;
  cancelledRecipientsCount: number;
  cancelledEnrollmentsCount: number;
  reason?: string;
}

/**
 * Processes an inbound email from a lead and halts pending outreach steps.
 */
export async function handleInboundLeadReply(payload: InboundReplyPayload): Promise<StopOnReplyResult> {
  const {
    workspaceId,
    senderEmail,
    subject = '(no subject)',
    bodySnippet = '',
    messageId,
    threadId,
    receivedAt = new Date(),
  } = payload;

  if (!senderEmail || !senderEmail.includes('@')) {
    return { handled: false, cancelledRecipientsCount: 0, cancelledEnrollmentsCount: 0, reason: 'invalid_email' };
  }

  const cleanEmail = senderEmail.trim().toLowerCase();

  // 1. Locate contact in workspace
  const contact = await db.contact.findFirst({
    where: {
      workspaceId,
      email: {
        equals: cleanEmail,
        mode: 'insensitive',
      },
    },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!contact) {
    return { handled: false, cancelledRecipientsCount: 0, cancelledEnrollmentsCount: 0, reason: 'contact_not_found' };
  }

  // 2. Update contact reply tracking
  await db.contact.update({
    where: { id: contact.id },
    data: {
      lastEmailRepliedAt: receivedAt,
      totalReplies: { increment: 1 },
      lastContactedAt: receivedAt,
    },
  });

  // 3. Find and halt pending campaign recipients
  const pendingRecipients = await db.campaignRecipient.findMany({
    where: {
      contactId: contact.id,
      status: 'PENDING',
    },
    select: { id: true, campaignId: true },
  });

  let cancelledRecipientsCount = 0;
  for (const r of pendingRecipients) {
    await db.campaignRecipient.update({
      where: { id: r.id },
      data: {
        status: 'REPLIED',
        repliedAt: receivedAt,
      },
    });

    // Emit REPLIED EmailEvent for each campaign that was stopped
    await db.emailEvent.create({
      data: {
        workspaceId,
        contactId: contact.id,
        campaignId: r.campaignId,
        eventType: EmailEventType.REPLIED,
      },
    });

    cancelledRecipientsCount++;
  }

  // 4. Halt active automation sequence enrollments for this contact
  const activeEnrollments = await db.automationEnrollment.findMany({
    where: {
      workspaceId,
      contactId: contact.id,
      exitedAt: null,
    },
    select: { id: true, automationId: true },
  });

  let cancelledEnrollmentsCount = 0;
  for (const enrollment of activeEnrollments) {
    await db.automationEnrollment.update({
      where: { id: enrollment.id },
      data: {
        exitReason: EnrollmentExitReason.REPLIED,
        exitedAt: receivedAt,
      },
    });
    cancelledEnrollmentsCount++;
  }

  // 5. Create ContactEvent for the CRM timeline
  try {
    await db.contactEvent.create({
      data: {
        contactId: contact.id,
        type: 'email_reply',
        title: `Reply received: ${subject.slice(0, 100)}`,
        content: bodySnippet.slice(0, 500),
        metadataJson: JSON.stringify({
          provider: 'gmail',
          messageId: messageId || null,
          threadId: threadId || null,
          cancelledCampaigns: cancelledRecipientsCount,
          cancelledSequences: cancelledEnrollmentsCount,
        }),
      },
    });
  } catch (err) {
    console.warn('[StopOnReply] Could not record contactEvent (non-fatal):', err);
  }

  return {
    handled: true,
    contactId: contact.id,
    cancelledRecipientsCount,
    cancelledEnrollmentsCount,
  };
}
