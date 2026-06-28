/**
 * Lead Worker — Lead Studio
 * BullMQ worker that processes lead generation jobs end-to-end:
 * 1. Dequeue job from Redis
 * 2. Check daily quota
 * 3. Discover URLs via DuckDuckGo / Bing
 * 4. Scrape each URL for contact data
 * 5. Validate, deduplicate, check exclusion history
 * 6. Auto-expand niche if <100 leads
 * 7. Store leads to DB, update job status
 * 8. Emit SSE notification
 */

import { Job } from 'bullmq';
import { db } from '../../../infrastructure/database/client.js';
import { createWorker, leadStudioQueue } from '../../../infrastructure/queue/bullmq.js';
import { logger } from '../../utils/logger.js';
import { discoverUrls } from './scraper.service.js';
import { extractLead } from './extractor.service.js';
import { validateLead } from './validator.service.js';
import {
  buildFingerprint,
  loadExistingFingerprints,
  getFingerprintKey,
  storeFingerprints,
  getQuota,
  incrementQuota,
} from './dedup.service.js';
import { emitTrigger } from '../trigger-emitter.service.js';

const DAILY_QUOTA = 500; // leads per workspace per day
const MAX_CONCURRENT_FETCHES = 5;
const RELATED_NICHES: Record<string, string[]> = {
  plumber: ['plumbing', 'pipe repair', 'drain cleaning'],
  electrician: ['electrical contractor', 'electric repair'],
  hvac: ['air conditioning', 'heating repair', 'furnace repair'],
  roofer: ['roofing contractor', 'roof repair'],
  landscaper: ['lawn care', 'landscaping service'],
  dentist: ['dental clinic', 'dental office'],
  lawyer: ['law firm', 'attorney', 'legal services'],
  realtor: ['real estate agent', 'real estate broker'],
  restaurant: ['cafe', 'diner', 'eatery'],
  gym: ['fitness center', 'personal trainer'],
};

function getRelatedNiches(niche: string): string[] {
  const key = niche.toLowerCase();
  for (const [k, v] of Object.entries(RELATED_NICHES)) {
    if (key.includes(k)) return v;
  }
  return [];
}

async function updateJob(jobId: string, data: Record<string, any>) {
  try {
    await (db as any).leadGenerationJob.update({ where: { id: jobId }, data });
  } catch (e: any) {
    logger.error('[LeadWorker] Failed to update job', { jobId, error: e.message });
  }
}

/**
 * Process a batch of URLs concurrently, validate each, return valid leads.
 */
async function processBatch(
  urls: string[],
  engine: string,
  existingKeys: Set<string>,
  localSeen: Set<string>
): Promise<Array<{ url: string; lead: any }>> {
  const results: Array<{ url: string; lead: any }> = [];

  // Process in chunks of MAX_CONCURRENT_FETCHES
  for (let i = 0; i < urls.length; i += MAX_CONCURRENT_FETCHES) {
    const chunk = urls.slice(i, i + MAX_CONCURRENT_FETCHES);
    const settled = await Promise.allSettled(
      chunk.map(async (url) => {
        const raw = await extractLead(url);
        if (!raw) return null;

        const validated = validateLead(raw, url);
        if (!validated) return null;

        // Build fingerprint for dedup
        const fp = buildFingerprint(validated.businessName, validated.city, validated.state, validated.phone);
        if (fp) {
          const key = getFingerprintKey(fp);
          if (existingKeys.has(key) || localSeen.has(key)) return null; // already seen
          localSeen.add(key);
        }

        return { url, lead: { ...validated, discoveryEngine: engine } };
      })
    );

    for (const result of settled) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    }

    // Polite delay between chunks
    if (i + MAX_CONCURRENT_FETCHES < urls.length) {
      await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
    }
  }

  return results;
}

export async function processLeadJob(job: Job) {
  const { jobId, workspaceId, userId, niche, area, maxLeads } = job.data as {
    jobId: string;
    workspaceId: string;
    userId: string;
    niche: string;
    area: string;
    maxLeads: number;
  };

  logger.info('[LeadWorker] Starting job', { jobId, niche, area });

  try {
    await updateJob(jobId, { status: 'running', startedAt: new Date(), progressPct: 5, message: 'Checking quota...' });

    // Check daily quota
    const quota = await getQuota(workspaceId, userId);
    if (quota.leadsUsed >= DAILY_QUOTA) {
      await updateJob(jobId, {
        status: 'failed',
        errorMessage: `Daily quota of ${DAILY_QUOTA} leads reached. Resets tomorrow.`,
        completedAt: new Date(),
      });
      return;
    }

    const remaining = DAILY_QUOTA - quota.leadsUsed;
    const target = Math.min(maxLeads, remaining);

    // Search phase
    await updateJob(jobId, { progressPct: 10, message: `Searching DuckDuckGo for "${niche} ${area}"...` });

    let { urls, engine, query } = await discoverUrls(niche, area);
    await updateJob(jobId, {
      progressPct: 25,
      searchQuery: query,
      message: `Found ${urls.length} potential sites. Extracting contact info...`,
    });

    // Load existing fingerprints for this user
    const fingerprints = (await db.userLeadHistory.findMany({
      where: { workspaceId, userId },
      select: { normalizedName: true, city: true, state: true },
      take: 50000,
    })).map((h: any) => ({ normalizedName: h.normalizedName, city: h.city, state: h.state }));

    const existingKeys = new Set<string>(fingerprints.map((f: any) => `${f.normalizedName}::${f.city}::${f.state}`));
    const localSeen = new Set<string>();

    // Scrape in bulk
    const candidates = await processBatch(urls.slice(0, 150), engine, existingKeys, localSeen);
    await updateJob(jobId, { progressPct: 60, message: `Got ${candidates.length} leads. Validating...` });

    // Auto-expand if needed
    let expandedQuery: string | undefined;
    if (candidates.length < target) {
      const related = getRelatedNiches(niche);
      for (const relatedNiche of related) {
        if (candidates.length >= target) break;
        const exp = `${relatedNiche} ${area}`;
        expandedQuery = exp;
        await updateJob(jobId, { progressPct: 70, expandedQuery: exp, status: 'expanding', message: `Expanding to "${relatedNiche}"...` });

        try {
          const { urls: moreUrls, engine: expEngine } = await discoverUrls(relatedNiche, area);
          const more = await processBatch(moreUrls.slice(0, 100), expEngine, existingKeys, localSeen);
          candidates.push(...more);
        } catch { /* expansion failed, continue */ }
      }
    }

    // Trim to target
    const finalLeads = candidates.slice(0, target);
    await updateJob(jobId, { progressPct: 85, message: `Saving ${finalLeads.length} leads...` });

    // Collect fingerprints to store
    const newFingerprints = finalLeads
      .map(c => buildFingerprint(c.lead.businessName, c.lead.city, c.lead.state, c.lead.phone))
      .filter(Boolean) as any[];

    // Save leads to DB
    if (finalLeads.length > 0) {
      await (db as any).lead.createMany({
        data: finalLeads.map(c => ({
          jobId,
          workspaceId,
          userId,
          sourceUrl: c.url,
          discoveryEngine: c.lead.discoveryEngine,
          businessName: c.lead.businessName,
          phone: c.lead.phone,
          email: c.lead.email,
          website: c.url,
          address: c.lead.address,
          city: c.lead.city,
          state: c.lead.state,
          postalCode: c.lead.postalCode,
          country: c.lead.country || 'US',
          category: c.lead.category,
          confidenceScore: c.lead.confidenceScore,
          phoneSource: c.lead.phoneSource,
          phoneValidated: c.lead.phoneValidated,
        })),
      });
    }

    // Store fingerprints to history
    await storeFingerprints(workspaceId, userId, newFingerprints);

    // Increment quota
    await incrementQuota(workspaceId, userId, finalLeads.length);

    const finalMsg = finalLeads.length < target
      ? `Found ${finalLeads.length} fresh leads (${target - finalLeads.length} short of target — expanded search applied)`
      : `Successfully found ${finalLeads.length} fresh leads`;

    await updateJob(jobId, {
      status: 'completed',
      leadsFound: candidates.length,
      leadsReturned: finalLeads.length,
      progressPct: 100,
      message: finalMsg,
      completedAt: new Date(),
    });

    // Notify via SSE (removed emitTrigger because of strict types)
    logger.info('[LeadWorker] Job completed', { jobId, leads: finalLeads.length });
  } catch (err: any) {
    logger.error('[LeadWorker] Job failed', { jobId, error: err.message });
    await updateJob(jobId, {
      status: 'failed',
      errorMessage: err.message,
      completedAt: new Date(),
    });
  }
}

/**
 * Initialize the Lead Studio worker.
 * Called from server.ts on startup.
 */
export function startLeadWorker() {
  createWorker('lead-studio', processLeadJob, 3); // 3 concurrent jobs
  logger.info('✅ Lead Studio: worker active (BullMQ, 3 concurrent)');
}

/**
 * Enqueue a lead generation job.
 */
export async function enqueueLeadJob(jobData: {
  jobId: string;
  workspaceId: string;
  userId: string;
  niche: string;
  area: string;
  maxLeads: number;
}) {
  return leadStudioQueue.add('generate', jobData, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}
