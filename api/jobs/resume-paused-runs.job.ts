/**
 * Workflow Engine: resume paused runs (Slice 2 rewrite).
 *
 * The old version scheduled the resume through BullMQ with a `repeat`
 * rule — but on Redis-less deploys the queue is a MockQueue whose `add`
 * ignores `repeat` and fires ONCE via setTimeout(0). Paused runs were
 * revisited at most once per server boot, never on schedule. The server
 * now calls resumeDueWorkflowRuns() from its own 1-min cron instead
 * (same pattern as the snooze resumer and the automation runner).
 */
import { db } from '../../infrastructure/database/client.js';
import { logger } from '../utils/logger.js';

/**
 * Resume every PAUSED run whose resumeAt has passed. Returns the number
 * of runs that actually left the PAUSED state. A run whose resume fails
 * is logged and left PAUSED for the next tick — never thrown, so one bad
 * run cannot block the rest.
 */
export async function resumeDueWorkflowRuns(): Promise<number> {
  let resumed = 0;
  try {
    const { engineService } = await import('../services/workflow-engine/engine.service.js');
    const pausedRuns = await db.workflowRun.findMany({
      where: { status: 'PAUSED', resumeAt: { lte: new Date() } },
    });
    for (const run of pausedRuns) {
      try {
        await engineService.resumeRun(run.id);
        const after = await db.workflowRun.findUnique({ where: { id: run.id } });
        if (after?.status !== 'PAUSED') resumed += 1;
      } catch (err: unknown) {
        logger.error(`Failed to resume run ${run.id}:`, { error: err });
      }
    }
  } catch (err: unknown) {
    logger.error('Error in pause resume job', { error: err });
  }
  return resumed;
}
