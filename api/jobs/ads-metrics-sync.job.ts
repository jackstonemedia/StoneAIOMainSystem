/**
 * Ads Metrics Sync Background Job (BullMQ).
 * Processes queued jobs to sync metrics for active campaigns.
 */

import { Job } from 'bullmq';
import { syncAllMetrics } from '../services/ads/ads-metrics.service.js';
import { createWorker, adsMetricsQueue } from '../../infrastructure/queue/bullmq.js';
import { logger } from '../utils/logger.js';

/**
 * The processor handles jobs added to the queue.
 */
export async function processAdsMetricsJob(job: Job) {
  logger.info(`[AdsMetricsSync] Processing job ${job.id}`);
  const start = Date.now();
  await syncAllMetrics();
  logger.info(`[AdsMetricsSync] Completed job ${job.id} in ${Date.now() - start}ms`);
}

/**
 * Initializes the worker and schedules the recurring job.
 * Called from server.ts on startup.
 */
export function startAdsMetricsSyncJob() {
  createWorker('ads-metrics', processAdsMetricsJob);

  // Add the recurring job. Repeat every 30 minutes.
  adsMetricsQueue.add('sync-all', {}, {
    repeat: { pattern: '*/30 * * * *' },
    jobId: 'recurring-ads-metrics-sync'
  }).catch((err: any) => logger.error('[AdsMetricsSync] Failed to schedule recurring job', { error: err }));

  logger.info('✅ Ad Manager: metrics sync worker active (BullMQ)');
}
