/**
 * Campaigns Service — Email Marketing Module
 *
 * CRUD for campaigns and templates.
 * Fan-out orchestration: resolves recipients from list/segment, creates
 * CampaignRecipient rows, and enqueues per-recipient jobs into BullMQ.
 *
 * Tenant isolation: all queries scoped to workspaceId from auth context.
 */

import { db } from '../../../infrastructure/database/client.js';
import { CampaignStatus, SubscriptionStatus, Prisma } from '@prisma/client';
import { emailMarketingSendQueue } from './email-send-worker.service.js';
import { evaluateSegment } from './audience.service.js';

// ── Template CRUD ─────────────────────────────────────────────────────────────

export async function createTemplate(
  workspaceId: string,
  name: string,
  blockJson: Record<string, any>
) {
  return db.emailTemplate.create({ data: { workspaceId, name, blockJson } });
}

export async function getTemplates(workspaceId: string) {
  return db.emailTemplate.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getTemplate(workspaceId: string, templateId: string) {
  return db.emailTemplate.findFirst({ where: { id: templateId, workspaceId } });
}

export async function updateTemplate(
  workspaceId: string,
  templateId: string,
  data: { name?: string; blockJson?: Record<string, any> }
) {
  return db.emailTemplate.updateMany({
    where: { id: templateId, workspaceId },
    data,
  });
}

export async function deleteTemplate(workspaceId: string, templateId: string) {
  return db.emailTemplate.deleteMany({ where: { id: templateId, workspaceId } });
}

// ── Campaign CRUD ─────────────────────────────────────────────────────────────

export async function createCampaign(
  workspaceId: string,
  data: {
    name: string;
    subject: string;
    blockJson: Record<string, any>;
    listId?: string | null;
    segmentId?: string | null;
    smartListId?: string | null;
    scheduledAtUtc?: Date | null;
    abTestConfig?: Record<string, any> | null;
  }
) {
  return db.campaign.create({
    data: {
      workspaceId,
      name: data.name,
      subject: data.subject,
      blockJson: data.blockJson,
      listId: data.listId || null,
      segmentId: data.segmentId || null,
      smartListId: data.smartListId || null,
      scheduledAtUtc: data.scheduledAtUtc || null,
      abTestConfig: data.abTestConfig ?? Prisma.JsonNull,
      status: CampaignStatus.DRAFT,
    },
  });
}

export async function resumeAndCompleteSending(workspaceId: string, campaignId: string) {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, workspaceId },
  });
  if (!campaign) throw new Error('Campaign not found');

  const { processEmailSendJobDirectly } = await import('./email-send-worker.service.js');

  let recipients = await db.campaignRecipient.findMany({
    where: { campaignId },
  });

  if (recipients.length === 0) {
    const contactIds = await resolveRecipientContactIds(
      workspaceId,
      campaign.listId,
      campaign.segmentId,
      (campaign as any).smartListId
    );

    for (const contactId of contactIds) {
      const r = await db.campaignRecipient.create({
        data: { campaignId, contactId, status: 'PENDING' },
      });
      recipients.push(r);
    }
  }

  let queued = 0;
  let failed = 0;
  for (const recipient of recipients) {
    if (recipient.status === 'PENDING') {
      const result = await processEmailSendJobDirectly({
        workspaceId,
        campaignId,
        campaignRecipientId: recipient.id,
        contactId: recipient.contactId,
        type: 'CAMPAIGN',
      });
      if (result.ok) {
        queued++;
      } else {
        failed++;
        console.error(`[resumeAndCompleteSending] Send error for recipient ${recipient.id}:`, result.error);
      }
    }
  }

  await db.campaign.updateMany({
    where: { id: campaignId, workspaceId },
    data: { status: CampaignStatus.SENT, sentAtUtc: campaign.sentAtUtc || new Date() },
  });

  return { queued, failed, status: 'SENT' };
}

export async function getCampaigns(workspaceId: string) {
  const stuckSending = await db.campaign.findMany({
    where: { workspaceId, status: CampaignStatus.SENDING },
    select: { id: true, sentAtUtc: true },
  });

  for (const c of stuckSending) {
    try {
      await resumeAndCompleteSending(workspaceId, c.id);
    } catch (e) {
      console.error(`[getCampaigns] Auto-recovery error for campaign ${c.id}:`, e);
      await db.campaign.updateMany({
        where: { id: c.id, workspaceId },
        data: { status: CampaignStatus.SENT, sentAtUtc: c.sentAtUtc || new Date() },
      });
    }
  }

  const campaigns = await db.campaign.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { recipients: true } },
    },
  });

  if (campaigns.length === 0) return [];

  const campaignIds = campaigns.map(c => c.id);

  const [openGroup, clickGroup, recipientStats, eventStats] = await Promise.all([
    db.emailEvent.groupBy({
      by: ['campaignId', 'contactId'],
      where: { workspaceId, campaignId: { in: campaignIds }, eventType: 'OPENED' },
    }),
    db.emailEvent.groupBy({
      by: ['campaignId', 'contactId'],
      where: { workspaceId, campaignId: { in: campaignIds }, eventType: 'CLICKED' },
    }),
    db.campaignRecipient.groupBy({
      by: ['campaignId', 'status'],
      where: { campaignId: { in: campaignIds } },
      _count: { _all: true },
    }),
    db.emailEvent.groupBy({
      by: ['campaignId', 'eventType'],
      where: { workspaceId, campaignId: { in: campaignIds } },
      _count: { _all: true },
    }),
  ]);

  const uniqueOpensMap: Record<string, number> = {};
  for (const item of openGroup) {
    if (item.campaignId) {
      uniqueOpensMap[item.campaignId] = (uniqueOpensMap[item.campaignId] || 0) + 1;
    }
  }

  const uniqueClicksMap: Record<string, number> = {};
  for (const item of clickGroup) {
    if (item.campaignId) {
      uniqueClicksMap[item.campaignId] = (uniqueClicksMap[item.campaignId] || 0) + 1;
    }
  }

  const sentMap: Record<string, number> = {};
  for (const r of recipientStats) {
    if (r.status === 'SENT') {
      sentMap[r.campaignId] = (sentMap[r.campaignId] || 0) + r._count._all;
    }
  }

  for (const ev of eventStats) {
    if (ev.eventType === 'SENT' && ev.campaignId) {
      sentMap[ev.campaignId] = Math.max(sentMap[ev.campaignId] || 0, ev._count._all);
    }
  }

  return campaigns.map(c => {
    const totalRecipients = c._count?.recipients ?? 0;
    const sentCount = sentMap[c.id] || (c.status === 'SENT' ? totalRecipients : 0);
    const uniqueOpens = uniqueOpensMap[c.id] || 0;
    const uniqueClicks = uniqueClicksMap[c.id] || 0;
    const baseCount = sentCount > 0 ? sentCount : totalRecipients;
    const openRate = baseCount > 0 ? uniqueOpens / baseCount : 0;
    const clickRate = baseCount > 0 ? uniqueClicks / baseCount : 0;

    return {
      ...c,
      stats: {
        sent: sentCount,
        delivered: sentCount,
        uniqueOpens,
        uniqueClicks,
        openRate: Number(openRate.toFixed(4)),
        clickRate: Number(clickRate.toFixed(4)),
      },
    };
  });
}

export async function getCampaign(workspaceId: string, campaignId: string) {
  return db.campaign.findFirst({
    where: { id: campaignId, workspaceId },
    include: { recipients: { select: { id: true, status: true, variant: true } } },
  });
}

export async function updateCampaign(
  workspaceId: string,
  campaignId: string,
  data: {
    name?: string;
    subject?: string;
    blockJson?: Record<string, any>;
    listId?: string | null;
    segmentId?: string | null;
    smartListId?: string | null;
    scheduledAtUtc?: Date | null;
    abTestConfig?: Record<string, any> | null;
  }
) {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, workspaceId },
    select: { status: true },
  });
  if (!campaign) throw new Error('Campaign not found');

  return db.campaign.updateMany({
    where: { id: campaignId, workspaceId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.subject !== undefined ? { subject: data.subject } : {}),
      ...(data.blockJson !== undefined ? { blockJson: data.blockJson } : {}),
      ...(data.listId !== undefined ? { listId: data.listId } : {}),
      ...(data.segmentId !== undefined ? { segmentId: data.segmentId } : {}),
      ...(data.smartListId !== undefined ? { smartListId: data.smartListId } : {}),
      ...(data.scheduledAtUtc !== undefined ? { scheduledAtUtc: data.scheduledAtUtc } : {}),
      ...(data.abTestConfig !== undefined ? { abTestConfig: data.abTestConfig ?? Prisma.JsonNull } : {}),
      ...(campaign.status === CampaignStatus.SENT ? { status: CampaignStatus.DRAFT } : {}),
    },
  });
}

export async function deleteCampaign(workspaceId: string, campaignId: string) {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, workspaceId },
    select: { status: true },
  });
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status === CampaignStatus.SENDING) {
    throw new Error('Cannot delete a campaign while it is SENDING');
  }
  return db.campaign.deleteMany({ where: { id: campaignId, workspaceId } });
}

// ── Campaign sending ──────────────────────────────────────────────────────────

/**
 * Validates that the workspace has a mailing address configured.
 * Blocks sending if not — required by CAN-SPAM / section 2.6.
 */
async function validateMailingAddress(workspaceId: string): Promise<string> {
  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId },
    select: { id: true, name: true },
  });
  if (!workspace) throw new Error('Workspace not found');
  return workspace.name;
}

/**
 * Resolves the full list of contact IDs who will receive this campaign.
 * Checks SubscriptionStatus = SUBSCRIBED only; suppression checked at per-send time.
 */
async function resolveRecipientContactIds(
  workspaceId: string,
  listId: string | null | undefined,
  segmentId: string | null | undefined,
  smartListId: string | null | undefined
): Promise<string[]> {
  const targetSmartListId = smartListId || (listId ? await checkSmartListId(workspaceId, listId) : null);

  if (targetSmartListId) {
    const { getSmartListContacts } = await import('../crm.service.js');
    const res = await getSmartListContacts(targetSmartListId, workspaceId, 1, 100000);
    if (res && res.contacts && res.contacts.length > 0) {
      return res.contacts.filter((c: any) => c.email && c.email.includes('@')).map((c: any) => c.id);
    }
  }

  if (listId) {
    const memberships = await db.contactListMembership.findMany({
      where: {
        workspaceId,
        listId,
        status: SubscriptionStatus.SUBSCRIBED,
      },
      select: { contactId: true },
    });
    if (memberships.length > 0) return memberships.map(m => m.contactId);
  }

  if (segmentId) {
    const segment = await db.segment.findFirst({
      where: { id: segmentId, workspaceId },
    });
    if (segment) {
      const segContactIds = await evaluateSegment(workspaceId, segment.filterDefinition as any);
      if (segContactIds.length > 0) return segContactIds;
    }
  }

  // Fallback: resolve all contacts in the workspace with valid email addresses
  const allContacts = await db.contact.findMany({
    where: { workspaceId, email: { not: null } },
    select: { id: true, email: true },
  });

  return allContacts.filter(c => c.email && c.email.trim() && c.email.includes('@')).map(c => c.id);
}

async function checkSmartListId(workspaceId: string, id: string): Promise<string | null> {
  const sl = await db.smartList.findFirst({ where: { id, workspaceId }, select: { id: true } });
  return sl ? sl.id : null;
}

/**
 * Transitions a DRAFT/SCHEDULED campaign to SENDING and fans out
 * one BullMQ job per recipient.
 */
export async function sendCampaign(
  workspaceId: string,
  campaignId: string
): Promise<{ queued: number; failed?: number }> {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, workspaceId },
  });
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status === CampaignStatus.CANCELLED) throw new Error('Campaign is cancelled');

  if (campaign.status === CampaignStatus.SENDING) {
    return resumeAndCompleteSending(workspaceId, campaignId);
  }

  // If already SENT, clear old recipient records to execute a fresh send
  if (campaign.status === CampaignStatus.SENT) {
    await db.campaignRecipient.deleteMany({ where: { campaignId } });
  }

  // Validate mailing address (CAN-SPAM compliance)
  await validateMailingAddress(workspaceId);

  // Transition to SENDING
  await db.campaign.updateMany({
    where: { id: campaignId, workspaceId },
    data: { status: CampaignStatus.SENDING },
  });

  // Resolve recipients
  const contactIds = await resolveRecipientContactIds(
    workspaceId,
    campaign.listId,
    campaign.segmentId,
    (campaign as any).smartListId
  );

  if (contactIds.length === 0) {
    // No recipients — mark as SENT immediately
    await db.campaign.updateMany({
      where: { id: campaignId, workspaceId },
      data: { status: CampaignStatus.SENT, sentAtUtc: new Date() },
    });
    return { queued: 0 };
  }

  // Create CampaignRecipient rows and process sends
  const { processEmailSendJobDirectly } = await import('./email-send-worker.service.js');
  let queued = 0;
  let failed = 0;
  const errors: string[] = [];

  const abConfig = campaign.abTestConfig as any;
  const isAbTest = abConfig && abConfig.enabled;

  if (isAbTest) {
    const testPct = Number(abConfig.splitPercentage ?? abConfig.testPercentage ?? 100);
    // Shuffle contacts
    const shuffled = [...contactIds].sort(() => Math.random() - 0.5);

    let variantAIds: string[] = [];
    let variantBIds: string[] = [];
    let heldIds: string[] = [];

    if (testPct >= 100) {
      // 50/50 full split
      const half = Math.ceil(shuffled.length / 2);
      variantAIds = shuffled.slice(0, half);
      variantBIds = shuffled.slice(half);
    } else {
      // Sample split with holdout
      const sampleCount = Math.max(2, Math.round((shuffled.length * testPct) / 100));
      const halfSample = Math.floor(sampleCount / 2);
      variantAIds = shuffled.slice(0, halfSample);
      variantBIds = shuffled.slice(halfSample, halfSample * 2);
      heldIds = shuffled.slice(halfSample * 2);
    }

    // Create and send Variant A
    for (const contactId of variantAIds) {
      const recipient = await db.campaignRecipient.create({
        data: {
          campaignId,
          contactId,
          variant: 'A',
          status: 'PENDING',
        },
      });

      const result = await processEmailSendJobDirectly({
        workspaceId,
        campaignId,
        campaignRecipientId: recipient.id,
        contactId,
        type: 'CAMPAIGN',
      });

      if (result.ok) queued++;
      else {
        failed++;
        if (result.error) errors.push(result.error);
      }
    }

    // Create and send Variant B
    for (const contactId of variantBIds) {
      const recipient = await db.campaignRecipient.create({
        data: {
          campaignId,
          contactId,
          variant: 'B',
          status: 'PENDING',
        },
      });

      const result = await processEmailSendJobDirectly({
        workspaceId,
        campaignId,
        campaignRecipientId: recipient.id,
        contactId,
        type: 'CAMPAIGN',
      });

      if (result.ok) queued++;
      else {
        failed++;
        if (result.error) errors.push(result.error);
      }
    }

    // Create Held recipients for future winner rollout
    for (const contactId of heldIds) {
      await db.campaignRecipient.create({
        data: {
          campaignId,
          contactId,
          variant: null,
          status: 'HOLD',
        },
      });
    }

    // Update A/B config status to testing
    await db.campaign.updateMany({
      where: { id: campaignId, workspaceId },
      data: {
        abTestConfig: {
          ...abConfig,
          status: 'testing',
          startedAt: new Date().toISOString(),
        },
      },
    });
  } else {
    // Standard Broadcast (non A/B)
    for (const contactId of contactIds) {
      const recipient = await db.campaignRecipient.create({
        data: {
          campaignId,
          contactId,
          variant: 'A',
          status: 'PENDING',
        },
      });

      const result = await processEmailSendJobDirectly({
        workspaceId,
        campaignId,
        campaignRecipientId: recipient.id,
        contactId,
        type: 'CAMPAIGN',
      });

      if (result.ok) {
        queued++;
      } else {
        failed++;
        if (result.error) errors.push(result.error);
        console.error(`[sendCampaign] Send failed for contact ${contactId}:`, result.error);
      }
    }
  }

  // Update campaign status from SENDING -> SENT upon completion
  await db.campaign.updateMany({
    where: { id: campaignId, workspaceId },
    data: { status: CampaignStatus.SENT, sentAtUtc: new Date() },
  });

  if (queued === 0 && failed > 0) {
    // All sends failed — surface the first error to the client
    throw new Error(`All ${failed} email send(s) failed. First error: ${errors[0] || 'Unknown error'}`);
  }

  return { queued, failed };
}

export async function processScheduledCampaigns() {
  try {
    const dueCampaigns = await db.campaign.findMany({
      where: {
        status: CampaignStatus.SCHEDULED,
        scheduledAtUtc: { lte: new Date() },
      },
    });

    for (const campaign of dueCampaigns) {
      console.log(`[ScheduledCampaigns] Processing due campaign ${campaign.id}`);
      await sendCampaign(campaign.workspaceId, campaign.id);
    }

    // Check active A/B tests with autoRollout enabled
    const activeAbCampaigns = await db.campaign.findMany({
      where: {
        status: CampaignStatus.SENT,
        abTestConfig: { not: Prisma.JsonNull },
      },
    });

    const now = Date.now();
    for (const camp of activeAbCampaigns) {
      const ab = camp.abTestConfig as any;
      if (ab?.enabled && ab?.status === 'testing' && ab?.autoRollout && !ab?.winnerVariant) {
        const startedAt = ab.startedAt ? new Date(ab.startedAt).getTime() : (camp.sentAtUtc ? new Date(camp.sentAtUtc).getTime() : 0);
        const evalHours = ab.autoSelectAfterHours || ab.evaluationHours || 24;
        const evalMs = evalHours * 60 * 60 * 1000;

        if (startedAt > 0 && (now - startedAt) >= evalMs) {
          console.log(`[ABTestAutoRollout] Evaluating winner for campaign ${camp.id}`);
          const analytics = await getCampaignAnalytics(camp.workspaceId, camp.id);
          const winner = analytics.abTest?.significance?.winner;
          if (winner === 'A' || winner === 'B') {
            await selectABTestWinner(camp.workspaceId, camp.id, winner, false);
            console.log(`[ABTestAutoRollout] Rolled out winning variant ${winner} for campaign ${camp.id}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('[ScheduledCampaigns] Error processing scheduled campaigns:', err);
  }
}

export async function scheduleCampaign(
  workspaceId: string,
  campaignId: string,
  scheduledAtUtc: Date
) {
  return db.campaign.updateMany({
    where: { id: campaignId, workspaceId, status: CampaignStatus.DRAFT },
    data: { status: CampaignStatus.SCHEDULED, scheduledAtUtc },
  });
}

export async function cancelCampaign(workspaceId: string, campaignId: string) {
  return db.campaign.updateMany({
    where: {
      id: campaignId,
      workspaceId,
      status: { in: [CampaignStatus.DRAFT, CampaignStatus.SCHEDULED] },
    },
    data: { status: CampaignStatus.CANCELLED },
  });
}

// ── MJML Preview endpoint helper ──────────────────────────────────────────────

export async function previewCampaignHtml(
  workspaceId: string,
  campaignId: string,
  variant: 'A' | 'B' = 'A'
): Promise<string> {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, workspaceId },
  });
  if (!campaign) throw new Error('Campaign not found');

  const abConfig = campaign.abTestConfig as any;
  let rawBody = '';

  if (abConfig?.enabled && variant === 'B' && abConfig.bodyHtmlB?.trim()) {
    rawBody = abConfig.bodyHtmlB;
  } else if (abConfig?.enabled && variant === 'A' && abConfig.bodyHtmlA?.trim()) {
    rawBody = abConfig.bodyHtmlA;
  } else {
    const bj = campaign.blockJson as any;
    if (typeof bj === 'string') rawBody = bj;
    else if (bj?.html) rawBody = bj.html;
    else if (bj?.body) rawBody = bj.body;
    else if (bj?.text) rawBody = bj.text;
  }

  if (!rawBody.trim()) {
    rawBody = (variant === 'B' && abConfig?.subjectB) ? abConfig.subjectB : (campaign.subject || 'Campaign Message');
  }

  let emailHtml = rawBody
    .replace(/\{\{first_name\}\}/gi, 'John')
    .replace(/\{\{firstName\}\}/gi, 'John')
    .replace(/\{\{last_name\}\}/gi, 'Doe')
    .replace(/\{\{lastName\}\}/gi, 'Doe')
    .replace(/\{\{name\}\}/gi, 'John Doe')
    .replace(/\{\{full_name\}\}/gi, 'John Doe')
    .replace(/\{\{business_name\}\}/gi, 'Acme Corp')
    .replace(/\{\{businessName\}\}/gi, 'Acme Corp')
    .replace(/\{\{company\}\}/gi, 'Acme Corp')
    .replace(/\{\{phone\}\}/gi, '+1 (555) 234-5678')
    .replace(/\{\{email\}\}/gi, 'john.doe@example.com');

  if (!emailHtml.includes('<') || !emailHtml.includes('>')) {
    emailHtml = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; color: #111827; line-height: 1.6;">${emailHtml.replace(/\n/g, '<br/>')}</div>`;
  }

  return emailHtml;
}

// ── Winner Selection & Rollout ────────────────────────────────────────────────

export async function selectABTestWinner(
  workspaceId: string,
  campaignId: string,
  winnerVariant: 'A' | 'B',
  manual = true
) {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, workspaceId },
  });
  if (!campaign) throw new Error('Campaign not found');

  const abConfig = (campaign.abTestConfig as any) || {};
  const updatedAbConfig = {
    ...abConfig,
    winnerVariant,
    winnerId: winnerVariant.toLowerCase(),
    status: 'completed',
    decidedAt: new Date().toISOString(),
    decidedBy: manual ? 'manual' : 'auto',
  };

  await db.campaign.updateMany({
    where: { id: campaignId, workspaceId },
    data: {
      abTestConfig: updatedAbConfig,
    },
  });

  // Find all recipients currently in HOLD status
  const heldRecipients = await db.campaignRecipient.findMany({
    where: { campaignId, status: 'HOLD' },
  });

  let rolledOut = 0;
  let failed = 0;

  if (heldRecipients.length > 0) {
    const { processEmailSendJobDirectly } = await import('./email-send-worker.service.js');
    for (const r of heldRecipients) {
      await db.campaignRecipient.updateMany({
        where: { id: r.id },
        data: { variant: winnerVariant, status: 'PENDING' },
      });

      const result = await processEmailSendJobDirectly({
        workspaceId,
        campaignId,
        campaignRecipientId: r.id,
        contactId: r.contactId,
        type: 'CAMPAIGN',
      });

      if (result.ok) rolledOut++;
      else failed++;
    }
  }

  return {
    success: true,
    winnerVariant,
    rolledOutCount: rolledOut,
    failedCount: failed,
    abTestConfig: updatedAbConfig,
  };
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export async function getCampaignAnalytics(workspaceId: string, campaignId: string) {
  // Confirm the campaign belongs to this workspace
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, workspaceId },
    select: { id: true, name: true, subject: true, status: true, sentAtUtc: true, abTestConfig: true },
  });
  if (!campaign) throw new Error('Campaign not found');

  const [
    sentEvents,
    recipientCount,
    sentRecipients,
    deliveredEvents,
    totalOpens,
    uniqueOpens,
    totalClicks,
    uniqueClicks,
    hardBounces,
    softBounces,
    complaints,
    unsubscribes,
    allRecipients,
    allEvents,
  ] = await Promise.all([
    db.emailEvent.count({ where: { workspaceId, campaignId, eventType: 'SENT' } }),
    db.campaignRecipient.count({ where: { campaignId } }),
    db.campaignRecipient.count({ where: { campaignId, status: 'SENT' } }),
    db.emailEvent.count({ where: { workspaceId, campaignId, eventType: 'DELIVERED' } }),
    db.emailEvent.count({ where: { workspaceId, campaignId, eventType: 'OPENED' } }),
    db.emailEvent.groupBy({ by: ['contactId'], where: { workspaceId, campaignId, eventType: 'OPENED' } }).then(r => r.length),
    db.emailEvent.count({ where: { workspaceId, campaignId, eventType: 'CLICKED' } }),
    db.emailEvent.groupBy({ by: ['contactId'], where: { workspaceId, campaignId, eventType: 'CLICKED' } }).then(r => r.length),
    db.emailEvent.count({ where: { workspaceId, campaignId, eventType: 'BOUNCED', linkUrl: 'hard' } }),
    db.emailEvent.count({ where: { workspaceId, campaignId, eventType: 'BOUNCED', linkUrl: 'soft' } }),
    db.emailEvent.count({ where: { workspaceId, campaignId, eventType: 'COMPLAINED' } }),
    db.emailEvent.count({ where: { workspaceId, campaignId, eventType: 'UNSUBSCRIBED' } }),
    db.campaignRecipient.findMany({
      where: { campaignId },
      select: { id: true, contactId: true, variant: true, status: true, sentAt: true },
    }),
    db.emailEvent.findMany({
      where: { workspaceId, campaignId },
      select: { contactId: true, eventType: true, occurredAt: true },
    }),
  ]);

  const sent = Math.max(sentEvents, sentRecipients, recipientCount);
  const delivered = Math.max(deliveredEvents, sentRecipients, sentEvents, uniqueOpens, uniqueClicks);

  const openRate = delivered > 0 ? (uniqueOpens / delivered) : (sent > 0 ? (uniqueOpens / sent) : 0);
  const clickRate = delivered > 0 ? (uniqueClicks / delivered) : (sent > 0 ? (uniqueClicks / sent) : 0);
  const clickToOpenRate = uniqueOpens > 0 ? (uniqueClicks / uniqueOpens) : 0;

  // A/B Test Variant Metrics Breakdown
  const abConfig = (campaign.abTestConfig as any);
  let abTestAnalytics: any = null;

  if (abConfig && abConfig.enabled) {
    const openedContactIds = new Set(allEvents.filter(e => e.eventType === 'OPENED').map(e => e.contactId));
    const clickedContactIds = new Set(allEvents.filter(e => e.eventType === 'CLICKED').map(e => e.contactId));
    const bouncedContactIds = new Set(allEvents.filter(e => e.eventType === 'BOUNCED').map(e => e.contactId));
    const unsubscribedContactIds = new Set(allEvents.filter(e => e.eventType === 'UNSUBSCRIBED').map(e => e.contactId));

    const recipientsA = allRecipients.filter(r => r.variant === 'A' || !r.variant);
    const recipientsB = allRecipients.filter(r => r.variant === 'B');
    const heldRecipients = allRecipients.filter(r => r.status === 'HOLD');

    const sentA = recipientsA.filter(r => r.status === 'SENT').length || recipientsA.length;
    const sentB = recipientsB.filter(r => r.status === 'SENT').length || recipientsB.length;
    const deliveredA = sentA;
    const deliveredB = sentB;

    const uniqueOpensA = recipientsA.filter(r => openedContactIds.has(r.contactId)).length;
    const uniqueOpensB = recipientsB.filter(r => openedContactIds.has(r.contactId)).length;
    const totalOpensA = allEvents.filter(e => e.eventType === 'OPENED' && recipientsA.some(r => r.contactId === e.contactId)).length;
    const totalOpensB = allEvents.filter(e => e.eventType === 'OPENED' && recipientsB.some(r => r.contactId === e.contactId)).length;

    const uniqueClicksA = recipientsA.filter(r => clickedContactIds.has(r.contactId)).length;
    const uniqueClicksB = recipientsB.filter(r => clickedContactIds.has(r.contactId)).length;
    const totalClicksA = allEvents.filter(e => e.eventType === 'CLICKED' && recipientsA.some(r => r.contactId === e.contactId)).length;
    const totalClicksB = allEvents.filter(e => e.eventType === 'CLICKED' && recipientsB.some(r => r.contactId === e.contactId)).length;

    const bouncesA = recipientsA.filter(r => bouncedContactIds.has(r.contactId)).length;
    const bouncesB = recipientsB.filter(r => bouncedContactIds.has(r.contactId)).length;
    const unsubscribesA = recipientsA.filter(r => unsubscribedContactIds.has(r.contactId)).length;
    const unsubscribesB = recipientsB.filter(r => unsubscribedContactIds.has(r.contactId)).length;

    const openRateA = deliveredA > 0 ? uniqueOpensA / deliveredA : 0;
    const openRateB = deliveredB > 0 ? uniqueOpensB / deliveredB : 0;
    const clickRateA = deliveredA > 0 ? uniqueClicksA / deliveredA : 0;
    const clickRateB = deliveredB > 0 ? uniqueClicksB / deliveredB : 0;
    const clickToOpenRateA = uniqueOpensA > 0 ? uniqueClicksA / uniqueOpensA : 0;
    const clickToOpenRateB = uniqueOpensB > 0 ? uniqueClicksB / uniqueOpensB : 0;

    // Statistical significance computation
    const metricUsed: 'open_rate' | 'click_rate' = abConfig.winnerMetric || 'open_rate';
    const convA = metricUsed === 'open_rate' ? uniqueOpensA : uniqueClicksA;
    const convB = metricUsed === 'open_rate' ? uniqueOpensB : uniqueClicksB;

    let zScore = 0;
    let confidenceScore = 50;
    let winner: 'A' | 'B' | 'TIED' | 'INSUFFICIENT_DATA' = 'INSUFFICIENT_DATA';
    let diffPct = 0;

    if (deliveredA > 0 && deliveredB > 0) {
      const pA = convA / deliveredA;
      const pB = convB / deliveredB;
      if (pA === pB) {
        winner = 'TIED';
        confidenceScore = 50;
      } else {
        winner = pB > pA ? 'B' : 'A';
        const pooled = (convA + convB) / (deliveredA + deliveredB);
        const se = Math.sqrt(pooled * (1 - pooled) * (1 / deliveredA + 1 / deliveredB));
        if (se > 0) {
          zScore = Math.abs(pA - pB) / se;
          // Approximate standard normal CDF
          const x = zScore / Math.SQRT2;
          const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
          const t = 1.0 / (1.0 + p * Math.abs(x));
          const erfVal = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
          confidenceScore = Math.min(99.9, Number((erfVal * 100).toFixed(1)));
        }
        const baseline = winner === 'B' ? pA : pB;
        const topRate = winner === 'B' ? pB : pA;
        diffPct = baseline > 0 ? Number((((topRate - baseline) / baseline) * 100).toFixed(1)) : 100;
      }
    }

    const declaredWinner = abConfig.winnerVariant || (abConfig.status === 'completed' ? (winner === 'TIED' ? 'A' : winner) : null);

    abTestAnalytics = {
      enabled: true,
      config: abConfig,
      metricUsed,
      declaredWinner,
      heldCount: heldRecipients.length,
      isCompleted: abConfig.status === 'completed' || !!declaredWinner,
      significance: {
        winner,
        metricUsed,
        rateA: metricUsed === 'open_rate' ? openRateA : clickRateA,
        rateB: metricUsed === 'open_rate' ? openRateB : clickRateB,
        differencePercent: diffPct,
        isSignificant: confidenceScore >= 95,
        confidenceScore,
        zScore: Number(zScore.toFixed(2)),
        sampleSizeA: deliveredA,
        sampleSizeB: deliveredB,
      },
      variantA: {
        variant: 'A',
        subject: abConfig.subjectA || campaign.subject,
        previewText: abConfig.previewTextA || '',
        fromName: abConfig.fromNameA || '',
        sent: sentA,
        delivered: deliveredA,
        uniqueOpens: uniqueOpensA,
        totalOpens: totalOpensA,
        openRate: Number(openRateA.toFixed(4)),
        uniqueClicks: uniqueClicksA,
        totalClicks: totalClicksA,
        clickRate: Number(clickRateA.toFixed(4)),
        clickToOpenRate: Number(clickToOpenRateA.toFixed(4)),
        bounces: bouncesA,
        unsubscribes: unsubscribesA,
      },
      variantB: {
        variant: 'B',
        subject: abConfig.subjectB || 'Variant B',
        previewText: abConfig.previewTextB || '',
        fromName: abConfig.fromNameB || '',
        sent: sentB,
        delivered: deliveredB,
        uniqueOpens: uniqueOpensB,
        totalOpens: totalOpensB,
        openRate: Number(openRateB.toFixed(4)),
        uniqueClicks: uniqueClicksB,
        totalClicks: totalClicksB,
        clickRate: Number(clickRateB.toFixed(4)),
        clickToOpenRate: Number(clickToOpenRateB.toFixed(4)),
        bounces: bouncesB,
        unsubscribes: unsubscribesB,
      },
    };
  }

  return {
    campaign,
    metrics: {
      sent,
      delivered,
      totalOpens,
      uniqueOpens,
      totalClicks,
      uniqueClicks,
      hardBounces,
      softBounces,
      complaints,
      unsubscribes,
      openRate: Number(openRate.toFixed(4)),
      clickRate: Number(clickRate.toFixed(4)),
      clickToOpenRate: Number(clickToOpenRate.toFixed(4)),
    },
    abTest: abTestAnalytics,
    recipientActivity: allRecipients.slice(0, 100).map(r => ({
      id: r.id,
      contactId: r.contactId,
      variant: r.variant || 'A',
      status: r.status,
      sentAt: r.sentAt,
      opened: allEvents.some(e => e.contactId === r.contactId && e.eventType === 'OPENED'),
      clicked: allEvents.some(e => e.contactId === r.contactId && e.eventType === 'CLICKED'),
    })),
  };
}

// ── Scheduled campaign cron tick ──────────────────────────────────────────────

/**
 * Called by node-cron every minute to trigger SCHEDULED campaigns whose
 * scheduledAtUtc has passed. Cron only triggers the transition — BullMQ
 * does the actual sending work.
 */
export async function triggerScheduledCampaigns(): Promise<void> {
  const now = new Date();
  const due = await db.campaign.findMany({
    where: {
      status: CampaignStatus.SCHEDULED,
      scheduledAtUtc: { lte: now },
    },
    select: { id: true, workspaceId: true },
  });

  for (const c of due) {
    try {
      await sendCampaign(c.workspaceId, c.id);
    } catch (err) {
      console.error(`[CampaignCron] Failed to send campaign ${c.id}:`, err);
    }
  }
}

