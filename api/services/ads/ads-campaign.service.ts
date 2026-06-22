/**
 * Ad Campaign Service — full lifecycle management.
 * Handles draft → live campaign creation with platform rollback on failure.
 */

import { db } from '../../../infrastructure/database/client.js';
import { getDecryptedTokens, maybeRefreshGoogleToken } from './ads-account.service.js';
import {
  createGoogleCampaign, pauseGoogleCampaign, resumeGoogleCampaign, deleteGoogleCampaign,
  GoogleAdsError,
} from './google-ads.service.js';
import {
  createFacebookCampaign, pauseFacebookCampaign, resumeFacebookCampaign, deleteFacebookCampaign,
  FacebookAdsError,
} from './facebook-ads.service.js';
import type { CreateCampaignInput, UpdateCampaignInput } from '../../schemas/ads.schemas.js';

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createCampaignDraft(
  workspaceId: string,
  userId: string,
  platform: 'GOOGLE' | 'FACEBOOK',
  input: CreateCampaignInput,
) {
  const adAccount = await db.adAccount.findUnique({
    where: { workspaceId_platform: { workspaceId, platform } },
  });
  if (!adAccount || adAccount.status === 'DISCONNECTED') {
    throw new Error(`No connected ${platform} account for this workspace`);
  }

  return db.adCampaign.create({
    data: {
      workspaceId,
      adAccountId: adAccount.id,
      platform,
      adType: input.adType,
      name: input.name,
      objective: input.objective,
      status: 'DRAFT',
      budgetType: input.budgetType,
      budgetAmountCents: input.budgetAmountCents,
      scheduleType: input.scheduleType,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      bidStrategy: input.bidStrategy ?? null,
      targetCpaCents: input.targetCpaCents ?? null,
      targetingJson: JSON.stringify(input.targeting),
      creativeJson: JSON.stringify(input.creative),
      createdByUserId: userId,
      lastEditedByUserId: userId,
    },
  });
}

export async function updateCampaign(
  campaignId: string,
  workspaceId: string,
  userId: string,
  input: UpdateCampaignInput,
) {
  const campaign = await db.adCampaign.findFirst({ where: { id: campaignId, workspaceId } });
  if (!campaign) throw new Error('Campaign not found');

  const updateData: Parameters<typeof db.adCampaign.update>[0]['data'] = {
    lastEditedByUserId: userId,
    updatedAt: new Date(),
  };
  if (input.name !== undefined) updateData.name = input.name;
  if (input.objective !== undefined) updateData.objective = input.objective;
  if (input.budgetType !== undefined) updateData.budgetType = input.budgetType;
  if (input.budgetAmountCents !== undefined) updateData.budgetAmountCents = input.budgetAmountCents;
  if (input.scheduleType !== undefined) updateData.scheduleType = input.scheduleType;
  if (input.startDate !== undefined) updateData.startDate = input.startDate ? new Date(input.startDate) : null;
  if (input.endDate !== undefined) updateData.endDate = input.endDate ? new Date(input.endDate) : null;
  if (input.bidStrategy !== undefined) updateData.bidStrategy = input.bidStrategy;
  if (input.targetCpaCents !== undefined) updateData.targetCpaCents = input.targetCpaCents;
  if (input.targeting !== undefined) updateData.targetingJson = JSON.stringify(input.targeting);
  if (input.creative !== undefined) updateData.creativeJson = JSON.stringify(input.creative);

  return db.adCampaign.update({ where: { id: campaignId }, data: updateData });
}

// ─── Launch ───────────────────────────────────────────────────────────────────

export async function launchCampaign(
  campaignId: string,
  workspaceId: string,
  userId: string,
): Promise<{ success: true } | { success: false; reason: string }> {
  const campaign = await db.adCampaign.findFirst({
    where: { id: campaignId, workspaceId },
    include: { adAccount: true },
  });
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status !== 'DRAFT' && campaign.status !== 'REJECTED') {
    throw new Error(`Cannot launch a campaign in ${campaign.status} status`);
  }

  const targeting = JSON.parse(campaign.targetingJson);
  const creative = JSON.parse(campaign.creativeJson);

  try {
    if (campaign.platform === 'GOOGLE') {
      const accessToken = await maybeRefreshGoogleToken(workspaceId);
      if (!accessToken) throw new GoogleAdsError('No valid Google token', 'TOKEN_MISSING');

      const result = await createGoogleCampaign(
        accessToken,
        campaign.adAccount.externalAccountId,
        {
          name: campaign.name,
          objective: campaign.objective,
          budgetType: campaign.budgetType as 'DAILY' | 'LIFETIME',
          budgetAmountMicros: campaign.budgetAmountCents * 10_000,
          bidStrategy: campaign.bidStrategy ?? 'MAXIMIZE_CONVERSIONS',
          targetCpaMicros: campaign.targetCpaCents ? campaign.targetCpaCents * 10_000 : undefined,
          startDate: campaign.startDate?.toISOString().split('T')[0],
          endDate: campaign.endDate?.toISOString().split('T')[0],
          keywords: targeting.keywords ?? [],
          headlines: creative.headlines ?? [],
          descriptions: creative.descriptions ?? [],
          finalUrl: creative.finalUrl,
          locations: targeting.locations ?? [],
        }
      );

      await db.adCampaign.update({
        where: { id: campaignId },
        data: {
          status: 'ACTIVE',
          platformCampaignId: result.campaignId,
          platformAdGroupId: result.adGroupId,
          platformAdId: result.adId,
          launchedAt: new Date(),
          lastEditedByUserId: userId,
        },
      });
    } else {
      // FACEBOOK
      const tokens = await getDecryptedTokens(workspaceId, 'FACEBOOK');
      if (!tokens) throw new FacebookAdsError('No valid Facebook token', 'TOKEN_MISSING');

      let fbPageId = creative.facebookPageId || '';
      if (!fbPageId) {
        try {
          const res = await fetch(`https://graph.facebook.com/v19.0/me/accounts?fields=id&access_token=${tokens.accessToken}`);
          const data = await res.json() as any;
          if (data.data && data.data.length > 0) {
            fbPageId = data.data[0].id;
          } else {
            throw new Error('No Facebook Page found on your account.');
          }
        } catch (e: any) {
          throw new FacebookAdsError(`Failed to fetch Facebook Page: ${e.message}`, 'NO_PAGE');
        }
      }
      
      const isLead = campaign.adType === 'FACEBOOK_LEAD';
      const defaultLeadFields = [
        { type: 'FULL_NAME', label: 'Full Name', required: true },
        { type: 'EMAIL', label: 'Email', required: true },
        { type: 'PHONE', label: 'Phone Number', required: true }
      ];
      const leadFormFields = creative.leadFormFields?.length ? creative.leadFormFields : (isLead ? defaultLeadFields : undefined);

      const result = await createFacebookCampaign(
        tokens.accessToken,
        campaign.adAccount.externalAccountId,
        {
          name: campaign.name,
          objective: campaign.objective,
          budgetType: campaign.budgetType as 'DAILY' | 'LIFETIME',
          budgetAmountCents: campaign.budgetAmountCents,
          startTime: campaign.startDate?.toISOString(),
          endTime: campaign.endDate?.toISOString(),
          adType: campaign.adType as 'FACEBOOK_FEED' | 'FACEBOOK_LEAD',
          locations: targeting.locations ?? [],
          ageMin: targeting.ageMin,
          ageMax: targeting.ageMax,
          genders: targeting.genders?.map((g: string) => g === 'MALE' ? 1 : g === 'FEMALE' ? 2 : undefined).filter(Boolean),
          interests: targeting.interests?.map((i: string) => ({ id: i, name: i })),
          pageId: fbPageId,
          headlines: creative.headlines ?? [],
          descriptions: creative.descriptions ?? [],
          imageUrls: creative.imageUrls,
          primaryText: creative.primaryText,
          callToAction: creative.callToAction,
          finalUrl: creative.finalUrl,
          leadFormFields,
        }
      );

      await db.adCampaign.update({
        where: { id: campaignId },
        data: {
          status: 'ACTIVE',
          platformCampaignId: result.campaignId,
          platformAdSetId: result.adSetId,
          platformAdId: result.adId,
          launchedAt: new Date(),
          lastEditedByUserId: userId,
        },
      });
    }

    return { success: true };
  } catch (err: any) {
    // Save as REJECTED with reason so work isn't lost
    const reason = err?.message ?? 'Unknown error';
    await db.adCampaign.update({
      where: { id: campaignId },
      data: { status: 'REJECTED', rejectionReason: reason, lastEditedByUserId: userId },
    });
    return { success: false, reason };
  }
}

// ─── Pause / Resume / Delete ──────────────────────────────────────────────────

export async function pauseCampaign(campaignId: string, workspaceId: string, userId: string) {
  const campaign = await db.adCampaign.findFirst({ where: { id: campaignId, workspaceId }, include: { adAccount: true } });
  if (!campaign) throw new Error('Campaign not found');

  if (campaign.platformCampaignId) {
    if (campaign.platform === 'GOOGLE') {
      const accessToken = await maybeRefreshGoogleToken(workspaceId);
      if (accessToken) await pauseGoogleCampaign(accessToken, campaign.adAccount.externalAccountId, campaign.platformCampaignId);
    } else {
      const tokens = await getDecryptedTokens(workspaceId, 'FACEBOOK');
      if (tokens) await pauseFacebookCampaign(tokens.accessToken, campaign.platformCampaignId);
    }
  }
  return db.adCampaign.update({ where: { id: campaignId }, data: { status: 'PAUSED', lastEditedByUserId: userId } });
}

export async function resumeCampaign(campaignId: string, workspaceId: string, userId: string) {
  const campaign = await db.adCampaign.findFirst({ where: { id: campaignId, workspaceId }, include: { adAccount: true } });
  if (!campaign) throw new Error('Campaign not found');

  if (campaign.platformCampaignId) {
    if (campaign.platform === 'GOOGLE') {
      const accessToken = await maybeRefreshGoogleToken(workspaceId);
      if (accessToken) await resumeGoogleCampaign(accessToken, campaign.adAccount.externalAccountId, campaign.platformCampaignId);
    } else {
      const tokens = await getDecryptedTokens(workspaceId, 'FACEBOOK');
      if (tokens) await resumeFacebookCampaign(tokens.accessToken, campaign.platformCampaignId);
    }
  }
  return db.adCampaign.update({ where: { id: campaignId }, data: { status: 'ACTIVE', lastEditedByUserId: userId } });
}

export async function deleteCampaign(campaignId: string, workspaceId: string) {
  const campaign = await db.adCampaign.findFirst({ where: { id: campaignId, workspaceId }, include: { adAccount: true } });
  if (!campaign) throw new Error('Campaign not found');

  if (campaign.platformCampaignId) {
    try {
      if (campaign.platform === 'GOOGLE') {
        const accessToken = await maybeRefreshGoogleToken(workspaceId);
        if (accessToken) await deleteGoogleCampaign(accessToken, campaign.adAccount.externalAccountId, campaign.platformCampaignId);
      } else {
        const tokens = await getDecryptedTokens(workspaceId, 'FACEBOOK');
        if (tokens) await deleteFacebookCampaign(tokens.accessToken, campaign.platformCampaignId);
      }
    } catch (e) {
      console.warn('[AdCampaignService] Platform delete failed, deleting locally anyway:', e);
    }
  }
  await db.adCampaign.delete({ where: { id: campaignId } });
}

export async function duplicateCampaign(campaignId: string, workspaceId: string, userId: string) {
  const campaign = await db.adCampaign.findFirst({ where: { id: campaignId, workspaceId } });
  if (!campaign) throw new Error('Campaign not found');

  return db.adCampaign.create({
    data: {
      workspaceId: campaign.workspaceId,
      adAccountId: campaign.adAccountId,
      platform: campaign.platform,
      adType: campaign.adType,
      name: `${campaign.name} (Copy)`,
      objective: campaign.objective,
      status: 'DRAFT',
      budgetType: campaign.budgetType,
      budgetAmountCents: campaign.budgetAmountCents,
      scheduleType: campaign.scheduleType,
      startDate: null,
      endDate: null,
      bidStrategy: campaign.bidStrategy,
      targetCpaCents: campaign.targetCpaCents,
      targetingJson: campaign.targetingJson,
      creativeJson: campaign.creativeJson,
      createdByUserId: userId,
      lastEditedByUserId: userId,
    },
  });
}

// ─── Bulk Operations ──────────────────────────────────────────────────────────

export async function bulkPauseCampaigns(campaignIds: string[], workspaceId: string, userId: string) {
  await Promise.all(campaignIds.map(id => pauseCampaign(id, workspaceId, userId).catch(() => {})));
}

export async function bulkResumeCampaigns(campaignIds: string[], workspaceId: string, userId: string) {
  await Promise.all(campaignIds.map(id => resumeCampaign(id, workspaceId, userId).catch(() => {})));
}

export async function bulkDeleteCampaigns(campaignIds: string[], workspaceId: string) {
  await Promise.all(campaignIds.map(id => deleteCampaign(id, workspaceId).catch(() => {})));
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listCampaigns(
  workspaceId: string,
  filters?: { platform?: string; status?: string; search?: string },
) {
  return db.adCampaign.findMany({
    where: {
      workspaceId,
      ...(filters?.platform && filters.platform !== 'ALL' ? { platform: filters.platform as any } : {}),
      ...(filters?.status && filters.status !== 'ALL' ? { status: filters.status as any } : {}),
      ...(filters?.search ? { name: { contains: filters.search } } : {}),
    },
    orderBy: { cachedSpend30dCents: 'desc' },
  });
}

export async function getCampaign(campaignId: string, workspaceId: string) {
  return db.adCampaign.findFirst({ where: { id: campaignId, workspaceId } });
}

// ─── Pause All Active ─────────────────────────────────────────────────────────

export async function pauseAllActiveCampaigns(workspaceId: string, userId: string) {
  const active = await db.adCampaign.findMany({ where: { workspaceId, status: 'ACTIVE' } });
  await Promise.all(active.map(c => pauseCampaign(c.id, workspaceId, userId).catch(() => {})));
  return active.length;
}
