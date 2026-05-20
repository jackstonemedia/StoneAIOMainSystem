import * as cron from 'node-cron';
import { db } from '../../../infrastructure/database/client.js';
import { queueService } from './queue.service';

export class SchedulerService {
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  
  async initialize(): Promise<void> {
    const schedules = await db.workflowSchedule.findMany({
      where: { active: true },
    });

    for (const schedule of schedules) {
      this.scheduleWorkflow({
        scheduleId: schedule.id,
        workspaceId: schedule.workspaceId,
        workflowId: schedule.workflowId,
        nodeId: schedule.nodeId,
        cronExpr: schedule.cronExpr,
        timezone: schedule.timezone,
      });
    }
    console.log(`Workflow Engine: Scheduled ${schedules.length} cron triggers`);
  }
  
  scheduleWorkflow(params: {
    scheduleId: string;
    workspaceId: string;
    workflowId: string;
    nodeId: string;
    cronExpr: string;
    timezone: string;
  }): void {
    const { scheduleId, workspaceId, workflowId, cronExpr, timezone } = params;

    // Remove existing if any
    this.unscheduleWorkflow(scheduleId);

    const isValid = cron.validate(cronExpr);
    if (!isValid) {
      console.error(`Invalid cron expression for schedule ${scheduleId}: ${cronExpr}`);
      return;
    }

    const task = cron.schedule(cronExpr, async () => {
      try {
        await queueService.enqueue({
          workspaceId,
          workflowId,
          triggerData: { scheduledAt: new Date().toISOString() },
          mode: 'production'
        });

        await db.workflowSchedule.update({
          where: { id: scheduleId },
          data: { lastRunAt: new Date() }
        });
      } catch (err) {
        console.error(`Failed to execute scheduled workflow ${workflowId}:`, err);
      }
    }, {
      timezone
    });

    this.jobs.set(scheduleId, task);
  }
  
  unscheduleWorkflow(scheduleId: string): void {
    const existing = this.jobs.get(scheduleId);
    if (existing) {
      existing.stop();
      this.jobs.delete(scheduleId);
    }
  }
  
  async reloadAll(): Promise<void> {
    for (const task of this.jobs.values()) {
      task.stop();
    }
    this.jobs.clear();
    await this.initialize();
  }
}

export const schedulerService = new SchedulerService();
