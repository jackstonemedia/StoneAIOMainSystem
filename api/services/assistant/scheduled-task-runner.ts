/**
 * Assistant Scheduled Tasks — background runner (Blueprint 3 Phase 1).
 *
 * The Scheduled page had routes, a service with `executeTask`, and a manual
 * Run button — but nothing ever called `executeTask` on a schedule, so a
 * task's `nextRunAt` passed and nothing happened. This runner closes that
 * gap: a 1-minute poller (wired in server.ts, gated on FEATURES.assistant)
 * finds due tasks, claims each one atomically, and executes it.
 *
 * Claiming: nextRunAt is advanced to the next cron occurrence BEFORE the
 * run, with an `updateMany` whose where-clause pins the old nextRunAt
 * value. If another server (or a previous tick) already claimed it, the
 * update touches 0 rows and the task is skipped — so a task never runs
 * twice even with two servers polling.
 *
 * Cron expressions are interpreted in the server's local timezone (see
 * `nextRunAfter` in scheduled-task.service.ts); on Render that is UTC.
 * An invalid expression still runs once when due, then retries in 24h
 * with a loud log line, instead of spinning the poller every minute.
 */

import { db } from '../../../infrastructure/database/client.js';
import { nextRunAfter, scheduledTaskService } from './scheduled-task.service.js';

const FALLBACK_DELAY_MS = 24 * 60 * 60 * 1000;

let tickRunning = false;

export async function runDueScheduledTasks(
  client: any = db
): Promise<{ checked: number; executed: number; failed: number }> {
  if (tickRunning) {
    console.log('[AssistantScheduler] Previous tick still running, skipping this minute.');
    return { checked: 0, executed: 0, failed: 0 };
  }
  tickRunning = true;
  try {
    const now = new Date();
    const due = await client.assistantScheduledTask.findMany({
      where: {
        status: 'active',
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
      },
      select: { id: true, workspaceId: true, cron: true, nextRunAt: true },
    });

    let executed = 0;
    let failed = 0;
    for (const task of due) {
      const parsed = nextRunAfter(task.cron, now);
      const next = parsed ?? new Date(now.getTime() + FALLBACK_DELAY_MS);
      if (!parsed) {
        console.error(
          `[AssistantScheduler] Task ${task.id} has an invalid cron expression ${JSON.stringify(task.cron)} — running once now, next attempt in 24h.`
        );
      }

      const claimed = await client.assistantScheduledTask.updateMany({
        where: { id: task.id, nextRunAt: task.nextRunAt },
        data: { nextRunAt: next },
      });
      if (claimed.count === 0) continue; // another runner claimed it

      try {
        await scheduledTaskService.executeTask(task.workspaceId, task.id);
        executed++;
      } catch (err) {
        failed++;
        console.error(`[AssistantScheduler] Task ${task.id} failed:`, err);
      }
    }

    if (due.length > 0) {
      console.log(
        `[AssistantScheduler] Tick: ${due.length} due, ${executed} executed, ${failed} failed.`
      );
    }
    return { checked: due.length, executed, failed };
  } finally {
    tickRunning = false;
  }
}
