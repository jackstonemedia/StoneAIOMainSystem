/**
 * Ads Metrics Sync Background Job.
 * Runs every 30 minutes — syncs metrics for all active campaigns across all workspaces.
 * Called from server.ts on startup.
 */

import cron from 'node-cron';
import { syncAllMetrics } from '../services/ads/ads-metrics.service.js';

export function startAdsMetricsSyncJob() {
  // Run every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    console.log('[AdsMetricsSync] Starting scheduled metrics sync...');
    const start = Date.now();
    try {
      await syncAllMetrics();
      console.log(`[AdsMetricsSync] Completed in ${Date.now() - start}ms`);
    } catch (err) {
      console.error('[AdsMetricsSync] Failed:', err);
    }
  });

  console.log('✅ Ad Manager: metrics sync job active (30-min interval)');
}
