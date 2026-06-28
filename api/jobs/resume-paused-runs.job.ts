/**
 * Workflow Engine: Resume Paused Runs Background Job (BullMQ).
 * Processes queued jobs to resume paused workflow runs.
 */

import { Job } from 'bullmq';
import { db } from '../../infrastructure/database/client.js';
import { createWorker, campaignEngineQueue } from '../../infrastructure/queue/bullmq.js';
import { logger } from '../utils/logger.js';

export async function processResumePausedRunsJob(job: Job) {
  logger.info(`[WorkflowEngine] Processing resume runs job ${job.id}`);
  try {
    const { engineService } = await import('../services/workflow-engine/engine.service.js');
    const pausedRuns = await db.workflowRun.findMany({
      where: { status: 'PAUSED', resumeAt: { lte: new Date() } }
    });
    for (const run of pausedRuns) {
      await engineService.resumeRun(run.id).catch((err: unknown) => 
        logger.error(`Failed to resume run ${run.id}:`, { error: err })
      );
    }
  } catch (err: any) {
    logger.error('Error in pause resume background job', { error: err });
  }
}

/**
 * Initializes the worker and schedules the recurring job.
 * Called from server.ts on startup.
 */
export function startResumePausedRunsJob() {
  createWorker('campaign-engine', processResumePausedRunsJob);

  // Add the recurring job. Repeat every 1 minute.
  campaignEngineQueue.add('resume-paused', {}, {
    repeat: { pattern: '* * * * *' },
    jobId: 'recurring-resume-paused-runs'
  }).catch((err: any) => logger.error('[WorkflowEngine] Failed to schedule recurring job', { error: err }));

  logger.info('✅ Workflow Engine: pause resume worker active (BullMQ, 1-min interval)');
}
