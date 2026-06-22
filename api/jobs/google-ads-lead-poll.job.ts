/**
 * Google Ads Lead Poll Background Job.
 * Runs every 15 minutes — polls Google lead form submissions for active Google campaigns.
 * Called from server.ts on startup.
 */

import cron from 'node-cron';
import { db } from '../../infrastructure/database/client.js';
import { maybeRefreshGoogleToken } from '../services/ads/ads-account.service.js';
import { fetchGoogleLeadFormSubmissions } from '../services/ads/google-ads.service.js';
import { ingestGoogleLead } from '../services/ads/ads-lead.service.js';

export function startGoogleLeadPollJob() {
  if (!process.env.GOOGLE_ADS_CLIENT_ID) {
    console.log('ℹ️  Ad Manager: Google Lead poll job skipped (GOOGLE_ADS_CLIENT_ID not set)');
    return;
  }

  cron.schedule('*/15 * * * *', async () => {
    try {
      // Find all active Google campaigns with Leads objective
      const campaigns = await db.adCampaign.findMany({
        where: {
          platform: 'GOOGLE',
          status: 'ACTIVE',
          objective: { in: ['LEADS', 'Leads'] },
          platformCampaignId: { not: null },
        },
        include: { adAccount: { select: { workspaceId: true, externalAccountId: true } } },
      });

      for (const campaign of campaigns) {
        try {
          const accessToken = await maybeRefreshGoogleToken(campaign.adAccount.workspaceId);
          if (!accessToken) continue;

          // Poll since last poll time, or last 24 hours
          const since = campaign.adAccount.lastPollAt?.toISOString() ??
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

          const submissions = await fetchGoogleLeadFormSubmissions(
            accessToken,
            campaign.adAccount.externalAccountId,
            campaign.platformCampaignId!,
            since,
          );

          for (const sub of submissions) {
            await ingestGoogleLead(sub, campaign.adAccount.workspaceId);
          }

          // Update lastPollAt
          await db.adAccount.update({
            where: { id: campaign.adAccountId },
            data: { lastPollAt: new Date() },
          });
        } catch (err) {
          console.error(`[GoogleLeadPoll] Error polling campaign ${campaign.id}:`, err);
        }
      }
    } catch (err) {
      console.error('[GoogleLeadPoll] Job error:', err);
    }
  });

  console.log('✅ Ad Manager: Google lead poll job active (15-min interval)');
}
