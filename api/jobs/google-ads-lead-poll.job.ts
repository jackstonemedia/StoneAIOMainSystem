/**
 * Google Ads Lead Poll Background Job (BullMQ).
 * Processes queued jobs to poll Google lead form submissions.
 */

import { Job } from 'bullmq';
import { db } from '../../infrastructure/database/client.js';
import { maybeRefreshGoogleToken } from '../services/ads/ads-account.service.js';
import { fetchGoogleLeadFormSubmissions } from '../services/ads/google-ads.service.js';
import { ingestGoogleLead } from '../services/ads/ads-lead.service.js';
import { createWorker, googleLeadsQueue } from '../../infrastructure/queue/bullmq.js';
import { logger } from '../utils/logger.js';

export async function processGoogleLeadPollJob(job: Job) {
  if (!process.env.GOOGLE_ADS_CLIENT_ID) {
    logger.warn('ℹ️  Ad Manager: Google Lead poll job skipped (GOOGLE_ADS_CLIENT_ID not set)');
    return;
  }

  logger.info(`[GoogleLeadPoll] Processing job ${job.id}`);
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
        const since = (campaign.adAccount as any).lastPollAt?.toISOString() ??
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
          data: { lastPollAt: new Date() } as any,
        });
      } catch (err: any) {
        logger.error(`[GoogleLeadPoll] Error polling campaign ${campaign.id}:`, { error: err });
      }
    }
  } catch (err) {
    logger.error('[GoogleLeadPoll] Job error:', { error: err });
  }
}

/**
 * Initializes the worker and schedules the recurring job.
 * Called from server.ts on startup.
 */
export function startGoogleLeadPollJob() {
  if (!process.env.GOOGLE_ADS_CLIENT_ID) {
    logger.info('ℹ️  Ad Manager: Google Lead poll worker skipped (no credentials)');
    return;
  }

  createWorker('google-leads', processGoogleLeadPollJob);

  // Add the recurring job. Repeat every 15 minutes.
  googleLeadsQueue.add('poll-all', {}, {
    repeat: { pattern: '*/15 * * * *' },
    jobId: 'recurring-google-lead-poll'
  }).catch((err: any) => logger.error('[GoogleLeadPoll] Failed to schedule recurring job', { error: err }));

  logger.info('✅ Ad Manager: Google lead poll worker active (BullMQ)');
}
