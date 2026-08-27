/**
 * Sequence Scheduler & Reply Tracking Service — Email Marketing Module
 *
 * Automatically monitors multi-step cold/warm drip sequences.
 * Evaluates non-response timing, halts subsequent sends on reply (stop-on-reply),
 * and advances recipients to follow-up steps with deliverability rate pacing.
 */

import { db } from '../../../infrastructure/database/client.js';
import { CampaignStatus, EmailEventType } from '@prisma/client';
import { processEmailSendJobDirectly } from './email-send-worker.service.js';
import { isWithinSendingWindow } from '../../../src/lib/emailDeliverabilityUtils.js';

export interface SequenceStepStats {
  stepNumber: number;
  subject: string;
  delayDays: number;
  delayHours: number;
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  repliedCount: number;
  pendingNextStepCount: number;
}

export interface CampaignSequenceOverview {
  campaignId: string;
  totalEnrolled: number;
  activeInSequence: number;
  stoppedOnReply: number;
  completedSequence: number;
  steps: SequenceStepStats[];
  nonResponders: {
    contactId: string;
    name: string;
    email: string;
    currentStep: number;
    lastSentAt: string | null;
    daysSinceLastTouch: number;
    status: string;
  }[];
}

/**
 * Checks if a contact has replied to emails from this workspace/campaign
 */
export async function hasContactReplied(workspaceId: string, contactId: string, afterDate?: Date): Promise<boolean> {
  const contact = await db.contact.findFirst({
    where: { id: contactId, workspaceId },
    select: { email: true },
  });

  if (!contact?.email) return false;

  // Check if an inbound message exists in Inbox
  const inboundMessage = await db.inboxMessage.findFirst({
    where: {
      workspaceId,
      senderType: 'contact',
      ...(afterDate ? { createdAt: { gte: afterDate } } : {}),
      conversation: {
        crmContactId: contactId,
      },
    },
  });

  if (inboundMessage) return true;

  // Check manual reply tag or contact event
  const replyEvent = await db.contactEvent.findFirst({
    where: {
      contactId,
      type: 'email_reply',
      ...(afterDate ? { createdAt: { gte: afterDate } } : {}),
    },
  });

  return !!replyEvent;
}

/**
 * Manually or automatically mark a contact as replied
 */
export async function markContactReplied(
  workspaceId: string,
  campaignId: string,
  contactId: string
): Promise<{ success: boolean; message: string }> {
  // Update recipient row
  await db.campaignRecipient.updateMany({
    where: { campaignId, contactId },
    data: { status: 'REPLIED' },
  });

  // Log contact event
  await db.contactEvent.create({
    data: {
      contactId,
      type: 'email_reply',
      title: 'Replied to Campaign Email',
      content: `Contact replied to campaign ${campaignId}. Further sequence follow-ups halted.`,
      metadataJson: JSON.stringify({ campaignId, timestamp: new Date().toISOString() }),
    },
  }).catch(() => null);

  return { success: true, message: 'Contact marked as replied. Sequence halted for this contact.' };
}

/**
 * Core engine runner: advances non-responders to the next sequence step
 */
export async function processDripSequences(): Promise<{ processed: number; advanced: number; stoppedOnReply: number }> {
  const activeCampaigns = await db.campaign.findMany({
    where: {
      status: CampaignStatus.SENT,
    },
    include: {
      recipients: {
        include: {
          contact: true,
        },
      },
    },
  });

  let processed = 0;
  let advanced = 0;
  let stoppedOnReply = 0;

  const now = new Date();

  for (const campaign of activeCampaigns) {
    const bj = campaign.blockJson as any;
    const isDrip = bj?.campaignType === 'drip' && Array.isArray(bj?.dripSteps) && bj.dripSteps.length > 1;
    if (!isDrip) continue;

    const dripSteps = bj.dripSteps as any[];
    const deliverySettings = bj.deliverySettings || {};

    // Check sending window if enabled
    if (deliverySettings.sendingWindowEnabled) {
      const allowed = isWithinSendingWindow(
        now,
        deliverySettings.startHour ?? 8,
        deliverySettings.endHour ?? 18
      );
      if (!allowed) {
        continue; // skip sending outside allowed window
      }
    }

    for (const recipient of campaign.recipients) {
      processed++;
      if (recipient.status === 'REPLIED' || recipient.status === 'STOPPED_ON_REPLY') {
        continue;
      }

      const initialSentAt = recipient.sentAt ? new Date(recipient.sentAt) : null;
      if (!initialSentAt) continue;

      // Check if contact replied since last send
      const replied = await hasContactReplied(campaign.workspaceId, recipient.contactId, initialSentAt);
      if (replied) {
        await db.campaignRecipient.updateMany({
          where: { id: recipient.id },
          data: { status: 'STOPPED_ON_REPLY' },
        });
        stoppedOnReply++;
        continue;
      }

      // Check previous step events
      const events = await db.emailEvent.findMany({
        where: {
          campaignId: campaign.id,
          contactId: recipient.contactId,
        },
        orderBy: { occurredAt: 'desc' },
      });

      const sentEvents = events.filter(e => e.eventType === EmailEventType.SENT);
      const currentStepCompleted = sentEvents.length; // e.g. 1 after initial outreach

      if (currentStepCompleted >= dripSteps.length) {
        // All steps in sequence completed
        continue;
      }

      const nextStepIndex = currentStepCompleted;
      const nextStep = dripSteps[nextStepIndex];
      if (!nextStep) continue;

      // Calculate required wait time
      const delayDays = Number(nextStep.delayDays) || 0;
      const delayHours = Number(nextStep.delayHours) || 0;
      const requiredWaitMs = (delayDays * 24 * 60 * 60 * 1000) + (delayHours * 60 * 60 * 1000);

      const lastSentTime = sentEvents[0]?.occurredAt ? new Date(sentEvents[0].occurredAt).getTime() : initialSentAt.getTime();
      const timeElapsedMs = now.getTime() - lastSentTime;

      if (timeElapsedMs >= requiredWaitMs) {
        // Send next step follow-up email!
        console.log(`[SequenceScheduler] Sending Step ${nextStepIndex + 1} of campaign "${campaign.name}" to ${recipient.contact.email}`);

        const result = await processEmailSendJobDirectly({
          workspaceId: campaign.workspaceId,
          campaignId: campaign.id,
          campaignRecipientId: recipient.id,
          contactId: recipient.contactId,
          type: 'CAMPAIGN',
          subject: nextStep.subject || `Follow-up on ${campaign.subject}`,
        });

        if (result.ok) {
          advanced++;
          // Update contact touchpoint counter
          await db.contact.updateMany({
            where: { id: recipient.contactId, workspaceId: campaign.workspaceId },
            data: {
              lastContactedAt: new Date(),
            },
          });
        }
      }
    }
  }

  return { processed, advanced, stoppedOnReply };
}

/**
 * Returns comprehensive sequence analytics & funnel
 */
export async function getCampaignSequenceOverview(
  workspaceId: string,
  campaignId: string
): Promise<CampaignSequenceOverview> {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, workspaceId },
    include: {
      recipients: {
        include: {
          contact: true,
        },
      },
    },
  });

  if (!campaign) {
    throw new Error('Campaign not found');
  }

  const bj = campaign.blockJson as any;
  const dripSteps: any[] = Array.isArray(bj?.dripSteps) && bj.dripSteps.length > 0
    ? bj.dripSteps
    : [{ stepNumber: 1, subject: campaign.subject, delayDays: 0, delayHours: 0 }];

  const totalEnrolled = campaign.recipients.length;
  let stoppedOnReplyCount = 0;
  let completedCount = 0;
  let activeInSequenceCount = 0;

  const now = Date.now();
  const nonResponders: CampaignSequenceOverview['nonResponders'] = [];

  const allEvents = await db.emailEvent.findMany({
    where: { campaignId },
  });

  const stepStats: SequenceStepStats[] = dripSteps.map((step, idx) => {
    return {
      stepNumber: idx + 1,
      subject: step.subject || campaign.subject,
      delayDays: Number(step.delayDays) || 0,
      delayHours: Number(step.delayHours) || 0,
      sentCount: 0,
      openedCount: 0,
      clickedCount: 0,
      repliedCount: 0,
      pendingNextStepCount: 0,
    };
  });

  for (const r of campaign.recipients) {
    const isReplied = r.status === 'REPLIED' || r.status === 'STOPPED_ON_REPLY';
    if (isReplied) {
      stoppedOnReplyCount++;
    }

    const contactEvents = allEvents.filter(e => e.contactId === r.contactId);
    const sentCount = contactEvents.filter(e => e.eventType === EmailEventType.SENT).length;
    const openedCount = contactEvents.filter(e => e.eventType === EmailEventType.OPENED).length;
    const clickedCount = contactEvents.filter(e => e.eventType === EmailEventType.CLICKED).length;

    // Distribute stats to step cards
    for (let s = 0; s < sentCount && s < stepStats.length; s++) {
      stepStats[s].sentCount++;
      if (openedCount > 0) stepStats[s].openedCount++;
      if (clickedCount > 0) stepStats[s].clickedCount++;
    }

    if (sentCount >= dripSteps.length) {
      completedCount++;
    } else if (!isReplied && sentCount > 0) {
      activeInSequenceCount++;
      const currentStepIdx = Math.min(sentCount - 1, stepStats.length - 1);
      stepStats[currentStepIdx].pendingNextStepCount++;
    }

    if (!isReplied) {
      const lastSentTime = r.sentAt ? new Date(r.sentAt).getTime() : 0;
      const daysSince = lastSentTime > 0 ? Math.floor((now - lastSentTime) / (24 * 60 * 60 * 1000)) : 0;

      nonResponders.push({
        contactId: r.contactId,
        name: `${r.contact.firstName || ''} ${r.contact.lastName || ''}`.trim() || 'Anonymous',
        email: r.contact.email || '',
        currentStep: sentCount,
        lastSentAt: r.sentAt ? r.sentAt.toISOString() : null,
        daysSinceLastTouch: daysSince,
        status: r.status,
      });
    }
  }

  return {
    campaignId,
    totalEnrolled,
    activeInSequence: activeInSequenceCount,
    stoppedOnReply: stoppedOnReplyCount,
    completedSequence: completedCount,
    steps: stepStats,
    nonResponders,
  };
}
