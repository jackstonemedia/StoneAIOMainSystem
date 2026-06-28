/**
 * Ad Metrics Service — dashboard aggregates, per-campaign time series, platform sync.
 */

import { db } from '../../../infrastructure/database/client.js';
import { maybeRefreshGoogleToken, getDecryptedTokens } from './ads-account.service.js';
import { fetchGoogleMetrics } from './google-ads.service.js';
import { fetchFacebookMetrics } from './facebook-ads.service.js';
import type { DashboardMetrics, DailyMetricPoint } from '../../../src/types/ads.js';

// ─── Date Range Helpers ───────────────────────────────────────────────────────

function getDateRange(preset: string, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'TODAY':
      return { start: today, end: now };
    case 'LAST_7':
      return { start: new Date(today.getTime() - 6 * 86_400_000), end: now };
    case 'LAST_30':
      return { start: new Date(today.getTime() - 29 * 86_400_000), end: now };
    case 'THIS_MONTH': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start, end: now };
    }
    case 'LAST_MONTH': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
      return { start, end };
    }
    case 'CUSTOM':
      if (customStart && customEnd) {
        return { start: new Date(customStart), end: new Date(customEnd) };
      }
      return { start: new Date(today.getTime() - 29 * 86_400_000), end: now };
    default:
      return { start: new Date(today.getTime() - 29 * 86_400_000), end: now };
  }
}

function toYMD(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ─── Dashboard Metrics ────────────────────────────────────────────────────────

export async function getDashboardMetrics(
  workspaceId: string,
  preset: string = 'LAST_30',
  platformFilter: string = 'ALL',
  customStart?: string,
  customEnd?: string,
): Promise<DashboardMetrics> {
  const { start, end } = getDateRange(preset, customStart, customEnd);

  const whereClause: any = {
    campaign: { workspaceId, ...(platformFilter !== 'ALL' ? { platform: platformFilter } : {}) },
    date: { gte: start, lte: end },
  };

  const snapshots = await db.adMetricSnapshot.findMany({ where: whereClause });

  const totalSpendCents = snapshots.reduce((s, r) => s + r.spendCents, 0);
  const totalLeads = snapshots.reduce((s, r) => s + r.leads, 0);
  const costPerLeadCents = totalLeads > 0 ? Math.round(totalSpendCents / totalLeads) : null;

  const activeCampaigns = await db.adCampaign.count({
    where: {
      workspaceId,
      status: 'ACTIVE',
      ...(platformFilter !== 'ALL' ? { platform: platformFilter as any } : {}),
    },
  });

  // Prior period for delta
  const periodLen = end.getTime() - start.getTime();
  const priorEnd = new Date(start.getTime() - 1);
  const priorStart = new Date(priorEnd.getTime() - periodLen);
  const priorSnapshots = await db.adMetricSnapshot.findMany({
    where: {
      campaign: { workspaceId, ...(platformFilter !== 'ALL' ? { platform: platformFilter as any } : {}) },
      date: { gte: priorStart, lte: priorEnd },
    },
  });
  const priorSpend = priorSnapshots.reduce((s, r) => s + r.spendCents, 0);
  const priorLeads = priorSnapshots.reduce((s, r) => s + r.leads, 0);

  const spendDeltaPct = priorSpend > 0 ? ((totalSpendCents - priorSpend) / priorSpend) * 100 : null;
  const leadsDeltaPct = priorLeads > 0 ? ((totalLeads - priorLeads) / priorLeads) * 100 : null;

  return { totalSpendCents, totalLeads, costPerLeadCents, activeCampaigns, spendDeltaPct, leadsDeltaPct };
}

// ─── Daily Chart Data ─────────────────────────────────────────────────────────

export async function getDailyChartData(
  workspaceId: string,
  preset: string = 'LAST_30',
  platformFilter: string = 'ALL',
  customStart?: string,
  customEnd?: string,
): Promise<DailyMetricPoint[]> {
  const { start, end } = getDateRange(preset, customStart, customEnd);

  const campaigns = await db.adCampaign.findMany({
    where: { workspaceId, ...(platformFilter !== 'ALL' ? { platform: platformFilter as any } : {}) },
    select: { id: true, platform: true },
  });

  const snapshots = await db.adMetricSnapshot.findMany({
    where: {
      campaignId: { in: campaigns.map(c => c.id) },
      date: { gte: start, lte: end },
    },
    include: { campaign: { select: { platform: true } } },
    orderBy: { date: 'asc' },
  });

  // Group by date
  const byDate = new Map<string, DailyMetricPoint>();
  for (const snap of snapshots) {
    const dateStr = toYMD(snap.date);
    if (!byDate.has(dateStr)) {
      byDate.set(dateStr, { date: dateStr, googleSpendCents: 0, facebookSpendCents: 0, googleLeads: 0, facebookLeads: 0 });
    }
    const pt = byDate.get(dateStr)!;
    if (snap.campaign.platform === 'GOOGLE') {
      pt.googleSpendCents += snap.spendCents;
      pt.googleLeads += snap.leads;
    } else {
      pt.facebookSpendCents += snap.spendCents;
      pt.facebookLeads += snap.leads;
    }
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Campaign-level metrics ───────────────────────────────────────────────────

export async function getCampaignMetrics(
  campaignId: string,
  workspaceId: string,
  preset: string = 'LAST_30',
  customStart?: string,
  customEnd?: string,
) {
  const { start, end } = getDateRange(preset, customStart, customEnd);
  const campaign = await db.adCampaign.findFirst({ where: { id: campaignId, workspaceId } });
  if (!campaign) throw new Error('Campaign not found');

  const snapshots = await db.adMetricSnapshot.findMany({
    where: { campaignId, date: { gte: start, lte: end } },
    orderBy: { date: 'asc' },
  });

  const totalSpend = snapshots.reduce((s, r) => s + r.spendCents, 0);
  const totalLeads = snapshots.reduce((s, r) => s + r.leads, 0);
  const totalClicks = snapshots.reduce((s, r) => s + r.clicks, 0);
  const totalImpressions = snapshots.reduce((s, r) => s + r.impressions, 0);
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;

  return {
    campaign,
    summary: {
      spendCents: totalSpend,
      leads: totalLeads,
      clicks: totalClicks,
      impressions: totalImpressions,
      ctr: avgCtr,
      costPerLeadCents: totalLeads > 0 ? Math.round(totalSpend / totalLeads) : null,
    },
    daily: snapshots.map(s => ({
      date: toYMD(s.date),
      spendCents: s.spendCents,
      leads: s.leads,
      clicks: s.clicks,
      impressions: s.impressions,
      ctr: s.ctr,
    })),
  };
}

// ─── Platform Sync (called by background job) ─────────────────────────────────

export async function syncMetricsForCampaign(
  campaign: {
    id: string;
    workspaceId: string;
    platform: string;
    platformCampaignId: string | null;
  },
  startDate: string,
  endDate: string,
) {
  if (!campaign.platformCampaignId) return;

  try {
    if (campaign.platform === 'GOOGLE') {
      const accessToken = await maybeRefreshGoogleToken(campaign.workspaceId);
      if (!accessToken) return;

      const account = await db.adAccount.findUnique({ where: { workspaceId_platform: { workspaceId: campaign.workspaceId, platform: 'GOOGLE' } } });
      if (!account) return;

      const metrics = await fetchGoogleMetrics(accessToken, account.externalAccountId, campaign.platformCampaignId, startDate, endDate);

      for (const day of metrics) {
        const date = new Date(day.date);
        const spendCents = Math.round(day.spendMicros / 10_000);
        await db.adMetricSnapshot.upsert({
          where: { campaignId_date: { campaignId: campaign.id, date } },
          create: {
            campaignId: campaign.id,
            date,
            spendCents,
            impressions: day.impressions,
            clicks: day.clicks,
            leads: day.leads,
            ctr: day.ctr,
            costPerLeadCents: day.leads > 0 ? Math.round(spendCents / day.leads) : null,
          },
          update: {
            spendCents,
            impressions: day.impressions,
            clicks: day.clicks,
            leads: day.leads,
            ctr: day.ctr,
            costPerLeadCents: day.leads > 0 ? Math.round(spendCents / day.leads) : null,
            syncedAt: new Date(),
          },
        });
      }
    } else {
      // FACEBOOK
      const tokens = await getDecryptedTokens(campaign.workspaceId, 'FACEBOOK');
      if (!tokens) return;

      const metrics = await fetchFacebookMetrics(tokens.accessToken, campaign.platformCampaignId, startDate, endDate);

      for (const day of metrics) {
        const date = new Date(day.date_start);
        const spendCents = Math.round(day.spend * 100);
        await db.adMetricSnapshot.upsert({
          where: { campaignId_date: { campaignId: campaign.id, date } },
          create: {
            campaignId: campaign.id,
            date,
            spendCents,
            impressions: day.impressions,
            clicks: day.clicks,
            leads: day.leads,
            ctr: day.ctr,
            costPerLeadCents: day.leads > 0 ? Math.round(spendCents / day.leads) : null,
          },
          update: {
            spendCents,
            impressions: day.impressions,
            clicks: day.clicks,
            leads: day.leads,
            ctr: day.ctr,
            costPerLeadCents: day.leads > 0 ? Math.round(spendCents / day.leads) : null,
            syncedAt: new Date(),
          },
        });
      }
    }

    // Update cached metrics on campaign row
    const last30Start = new Date(Date.now() - 29 * 86_400_000);
    const recent = await db.adMetricSnapshot.findMany({
      where: { campaignId: campaign.id, date: { gte: last30Start } },
    });
    const totalSpend30d = recent.reduce((s, r) => s + r.spendCents, 0);
    const totalLeads30d = recent.reduce((s, r) => s + r.leads, 0);
    const totalImpressions30d = recent.reduce((s, r) => s + r.impressions, 0);
    const totalClicks30d = recent.reduce((s, r) => s + r.clicks, 0);
    const avgCtr30d = totalImpressions30d > 0 ? totalClicks30d / totalImpressions30d : 0;

    await db.adCampaign.update({
      where: { id: campaign.id },
      data: {
        cachedSpend30dCents: totalSpend30d,
        cachedLeads30d: totalLeads30d,
        cachedCtr30d: avgCtr30d,
        metricsCachedAt: new Date(),
        lastSyncAt: new Date(),
      } as any,
    });
  } catch (e) {
    console.error(`[AdMetricsService] Sync failed for campaign ${campaign.id}:`, e);
  }
}

export async function syncAllMetrics(workspaceId?: string) {
  const where: any = { status: 'ACTIVE' };
  if (workspaceId) where.workspaceId = workspaceId;

  const campaigns = await db.adCampaign.findMany({ where, select: { id: true, workspaceId: true, platform: true, platformCampaignId: true } });
  const end = new Date().toISOString().split('T')[0];
  const start = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0];

  await Promise.allSettled(campaigns.map(c => syncMetricsForCampaign(c, start, end)));
}
