/**
 * Ad Lead Service — lead ingestion from Facebook webhook and Google polling,
 * CRM sync with email deduplication, workflow engine event emission.
 */

import { db } from '../../../infrastructure/database/client.js';
import { emitTrigger } from '../trigger-emitter.service.js';
import type { FacebookLeadSubmission } from './facebook-ads.service.js';
import type { GoogleLeadFormSubmission } from './google-ads.service.js';

// ─── Ingest from Facebook webhook ────────────────────────────────────────────

export async function ingestFacebookLead(
  submission: FacebookLeadSubmission,
  workspaceId: string,
): Promise<void> {
  // Find campaign by platformCampaignId
  const campaign = await db.adCampaign.findFirst({
    where: { workspaceId, platformCampaignId: submission.campaignId },
  });
  if (!campaign) {
    console.warn(`[AdLeadService] No campaign found for FB campaignId=${submission.campaignId}`);
    return;
  }

  // Idempotent upsert
  await db.adLead.upsert({
    where: { platform_platformLeadId: { platform: 'FACEBOOK', platformLeadId: submission.leadId } },
    create: {
      workspaceId,
      campaignId: campaign.id,
      platform: 'FACEBOOK',
      platformLeadId: submission.leadId,
      facebookFormId: submission.adId,
      leadName: submission.name,
      leadEmail: submission.email,
      leadPhone: submission.phone,
      rawDataJson: JSON.stringify(submission.rawFields),
      syncStatus: 'PENDING',
      capturedAt: new Date(submission.createdAt),
    },
    update: {}, // already exists, skip
  });

  await syncLeadToCrm(workspaceId, campaign.id, 'FACEBOOK', submission.leadId, {
    name: submission.name,
    email: submission.email,
    phone: submission.phone,
    campaignName: campaign.name,
  });
}

// ─── Ingest from Google poll ──────────────────────────────────────────────────

export async function ingestGoogleLead(
  submission: GoogleLeadFormSubmission,
  workspaceId: string,
): Promise<void> {
  const campaign = await db.adCampaign.findFirst({
    where: { workspaceId, platformCampaignId: submission.campaignId },
  });
  if (!campaign) return;

  await db.adLead.upsert({
    where: { platform_platformLeadId: { platform: 'GOOGLE', platformLeadId: submission.leadId } },
    create: {
      workspaceId,
      campaignId: campaign.id,
      platform: 'GOOGLE',
      platformLeadId: submission.leadId,
      leadName: submission.name,
      leadEmail: submission.email,
      leadPhone: submission.phone,
      rawDataJson: JSON.stringify(submission.rawFields),
      syncStatus: 'PENDING',
      capturedAt: new Date(submission.submittedAt),
    },
    update: {},
  });

  await syncLeadToCrm(workspaceId, campaign.id, 'GOOGLE', submission.leadId, {
    name: submission.name,
    email: submission.email,
    phone: submission.phone,
    campaignName: campaign.name,
  });
}

// ─── CRM Sync ─────────────────────────────────────────────────────────────────

async function syncLeadToCrm(
  workspaceId: string,
  campaignId: string,
  platform: 'GOOGLE' | 'FACEBOOK',
  platformLeadId: string,
  lead: { name: string | null; email: string | null; phone: string | null; campaignName: string },
) {
  const adLead = await db.adLead.findFirst({
    where: { platform, platformLeadId, workspaceId },
  });
  if (!adLead) return;

  try {
    // Check if contact already exists with this adLeadId
    const existingContact = await db.contact.findFirst({ where: { adLeadId: adLead.id } });
    if (existingContact) {
      await db.adLead.update({ where: { id: adLead.id }, data: { syncStatus: 'SYNCED', syncedAt: new Date() } });
      return;
    }

    // Email deduplication
    if (lead.email) {
      const emailMatch = await db.contact.findFirst({ where: { workspaceId, email: lead.email } });
      if (emailMatch) {
        // Update existing contact with ad lead attribution
        await db.contact.update({
          where: { id: emailMatch.id },
          data: {
            source: platform === 'GOOGLE' ? 'GOOGLE_ADS' : 'FACEBOOK_ADS',
            adLeadId: adLead.id,
          },
        });
        await db.adLead.update({ where: { id: adLead.id }, data: { syncStatus: 'SYNCED', syncedAt: new Date() } });
        await notifyNewLead(workspaceId, emailMatch.id, lead.campaignName, campaignId);
        await emitAdLeadEvent(workspaceId, emailMatch.id, campaignId, platform);
        return;
      }
    }

    // Parse name
    const nameParts = (lead.name ?? '').trim().split(' ');
    const firstName = nameParts[0] || 'Unknown';
    const lastName = nameParts.slice(1).join(' ') || '';

    const contact = await db.contact.create({
      data: {
        workspaceId,
        firstName,
        lastName,
        email: lead.email ?? undefined,
        phone: lead.phone ?? undefined,
        source: platform === 'GOOGLE' ? 'GOOGLE_ADS' : 'FACEBOOK_ADS',
        status: 'Lead',
        adLeadId: adLead.id,
      },
    });

    await db.adLead.update({ where: { id: adLead.id }, data: { syncStatus: 'SYNCED', syncedAt: new Date() } });
    await notifyNewLead(workspaceId, contact.id, lead.campaignName, campaignId);
    await emitAdLeadEvent(workspaceId, contact.id, campaignId, platform);
  } catch (err: any) {
    console.error('[AdLeadService] CRM sync failed:', err);
    await db.adLead.update({
      where: { id: adLead.id },
      data: {
        syncStatus: 'FAILED',
        syncError: err.message,
        syncAttempts: { increment: 1 },
      },
    });
  }
}

// ─── Retry failed sync ────────────────────────────────────────────────────────

export async function retryLeadSync(leadId: string, workspaceId: string) {
  const adLead = await db.adLead.findFirst({ where: { id: leadId, workspaceId } });
  if (!adLead) throw new Error('Lead not found');

  const campaign = await db.adCampaign.findFirst({ where: { id: adLead.campaignId } });
  await syncLeadToCrm(workspaceId, adLead.campaignId, adLead.platform as 'GOOGLE' | 'FACEBOOK', adLead.platformLeadId, {
    name: adLead.leadName,
    email: adLead.leadEmail,
    phone: adLead.leadPhone,
    campaignName: campaign?.name ?? '',
  });
}

// ─── List Leads ───────────────────────────────────────────────────────────────

export async function listLeads(
  workspaceId: string,
  filters: {
    campaignId?: string;
    platform?: string;
    syncStatus?: string;
    page: number;
    pageSize: number;
  }
) {
  const where: any = { workspaceId };
  if (filters.campaignId) where.campaignId = filters.campaignId;
  if (filters.platform && filters.platform !== 'ALL') where.platform = filters.platform;
  if (filters.syncStatus && filters.syncStatus !== 'ALL') where.syncStatus = filters.syncStatus;

  const [data, total] = await Promise.all([
    db.adLead.findMany({
      where,
      orderBy: { capturedAt: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      include: {
        campaign: { select: { name: true, platform: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    db.adLead.count({ where }),
  ]);

  return { data, total, page: filters.page, pageSize: filters.pageSize };
}

// ─── Notifications ────────────────────────────────────────────────────────────

async function notifyNewLead(workspaceId: string, contactId: string, campaignName: string, campaignId: string) {
  try {
    await db.notification.create({
      data: {
        workspaceId,
        title: `New lead from ${campaignName}`,
        body: 'A new contact was added from your ad campaign.',
        type: 'ad_lead',
        link: `/ads/campaigns/${campaignId}?tab=leads`,
        read: false,
      },
    });
  } catch (e) {
    console.error('[AdLeadService] Failed to create notification:', e);
  }
}

// ─── Workflow Engine Event ────────────────────────────────────────────────────

async function emitAdLeadEvent(
  workspaceId: string,
  contactId: string,
  campaignId: string,
  platform: string,
) {
  try {
    triggerEmitter.emit('crm:event', {
      workspaceId,
      entityType: 'contact',
      eventType: 'ad_lead_captured',
      entityId: contactId,
      data: { campaignId, platform },
    });
  } catch (e) {
    console.error('[AdLeadService] Failed to emit workflow event:', e);
  }
}
