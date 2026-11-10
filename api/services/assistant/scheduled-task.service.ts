/**
 * Assistant Scheduled Tasks & Background Runner — Stone AIO
 * Spec Section 2.8 & Stage S6
 */

import cronParser from 'cron-parser';
import { withTenant } from './rls.js';
import { chatEngine } from '../../../packages/ai/engine/chat-engine.js';
import { toolRegistry } from './tools/registry.js';
import { buildSystemPrompt } from '../../../packages/ai/prompts/assistant.v1.js';
import { db } from '../../../infrastructure/database/client.js';
import { checkAssistantBudget, recordUsage } from '../agent/metering.js';
import type { AssistantScheduledTask, AssistantTaskRun } from '@prisma/client';

/**
 * Next occurrence of a cron expression after `from`, or null when the
 * expression is invalid. The expression is interpreted in the server's
 * local timezone (cron-parser with no `tz` option; on Render that is UTC),
 * matching how node-cron schedules the runner tick itself. There is no
 * per-task timezone in the schema, so a user's "9am" is the server's 9am.
 */
export function nextRunAfter(cronExpr: string, from: Date): Date | null {
  // cron-parser treats an empty string as all-wildcards (every minute) —
  // guard it, or a blank cron would run a task 1,440 times a day.
  if (!cronExpr || !cronExpr.trim()) return null;
  try {
    return cronParser.parseExpression(cronExpr, { currentDate: from }).next().toDate();
  } catch {
    return null;
  }
}

export class AssistantScheduledTaskService {
  /**
   * List scheduled tasks for a user in the workspace.
   */
  async listTasks(workspaceId: string, userId: string): Promise<AssistantScheduledTask[]> {
    return await withTenant(workspaceId, async (tx) => {
      return await tx.assistantScheduledTask.findMany({
        where: { workspaceId, userId },
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  /**
   * Get a single scheduled task with run history.
   */
  async getTask(workspaceId: string, taskId: string): Promise<(AssistantScheduledTask & { runs: AssistantTaskRun[] }) | null> {
    return await withTenant(workspaceId, async (tx) => {
      return await tx.assistantScheduledTask.findFirst({
        where: { id: taskId, workspaceId },
        include: {
          runs: {
            orderBy: { startedAt: 'desc' },
            take: 50,
          },
        },
      });
    });
  }

  /**
   * Create a new scheduled task.
   */
  async createTask(
    workspaceId: string,
    userId: string,
    data: {
      title: string;
      prompt: string;
      cron?: string;
      mode?: string;
    }
  ): Promise<AssistantScheduledTask> {
    const cron = data.cron || '0 9 * * *';
    // First run follows the cron expression, not a flat +24h (the old code
    // ignored the expression here). Invalid expression -> +24h fallback.
    const now = new Date();
    const parsed = nextRunAfter(cron, now);
    const nextRunAt = parsed ?? new Date(now.getTime() + 24 * 60 * 60 * 1000);
    if (!parsed) {
      console.error(`[AssistantScheduledTask] Invalid cron expression ${JSON.stringify(cron)} — first run in 24h.`);
    }
    return await withTenant(workspaceId, async (tx) => {
      return await tx.assistantScheduledTask.create({
        data: {
          workspaceId,
          userId,
          title: data.title,
          prompt: data.prompt,
          cron,
          mode: data.mode || 'read_only',
          status: 'active',
          nextRunAt,
        },
      });
    });
  }

  /**
   * Update a scheduled task.
   */
  async updateTask(
    workspaceId: string,
    userId: string,
    id: string,
    data: {
      title?: string;
      prompt?: string;
      cron?: string;
      mode?: string;
      status?: string;
    }
  ): Promise<AssistantScheduledTask> {
    return await withTenant(workspaceId, async (tx) => {
      const existing = await tx.assistantScheduledTask.findFirst({
        where: { id, workspaceId, userId },
      });

      if (!existing) {
        throw new Error(`Scheduled task ${id} not found in workspace.`);
      }

      // Changing the cron re-times the next run from the new expression
      // (from now). Other updates leave nextRunAt alone.
      let nextRunAt: Date | undefined;
      if (data.cron !== undefined) {
        const parsed = nextRunAfter(data.cron, new Date());
        nextRunAt = parsed ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
        if (!parsed) {
          console.error(`[AssistantScheduledTask] Invalid cron expression ${JSON.stringify(data.cron)} — next run in 24h.`);
        }
      }

      return await tx.assistantScheduledTask.update({
        where: { id },
        data: {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.prompt !== undefined ? { prompt: data.prompt } : {}),
          ...(data.cron !== undefined ? { cron: data.cron } : {}),
          ...(data.mode !== undefined ? { mode: data.mode } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(nextRunAt !== undefined ? { nextRunAt } : {}),
        },
      });
    });
  }

  /**
   * Delete a scheduled task.
   */
  async deleteTask(workspaceId: string, userId: string, id: string): Promise<boolean> {
    return await withTenant(workspaceId, async (tx) => {
      const existing = await tx.assistantScheduledTask.findFirst({
        where: { id, workspaceId, userId },
      });

      if (!existing) return false;

      await tx.assistantScheduledTask.delete({ where: { id } });
      return true;
    });
  }

  /**
   * List run history for a scheduled task.
   */
  async listRuns(workspaceId: string, taskId: string): Promise<AssistantTaskRun[]> {
    return await withTenant(workspaceId, async (tx) => {
      return await tx.assistantTaskRun.findMany({
        where: { workspaceId, taskId },
        orderBy: { startedAt: 'desc' },
        take: 50,
      });
    });
  }

  /**
   * Execute a scheduled task in the background.
   */
  async executeTask(workspaceId: string, taskId: string): Promise<AssistantTaskRun> {
    const task = await withTenant(workspaceId, async (tx) => {
      return await tx.assistantScheduledTask.findFirst({
        where: { id: taskId, workspaceId },
      });
    });

    if (!task) {
      throw new Error(`Scheduled task ${taskId} not found in workspace.`);
    }

    // 1. Create run record
    const run = await withTenant(workspaceId, async (tx) => {
      return await tx.assistantTaskRun.create({
        data: {
          workspaceId,
          taskId: task.id,
          status: 'running',
        },
      });
    });

    // Spending caps (slice 1): never run a scheduled task when the
    // workspace has used its monthly plan budget. Records the block as
    // a failed run (same shape as any other run failure) instead of
    // throwing, so the run history shows why it didn't run.
    const budget = await checkAssistantBudget(db as any, workspaceId);
    if (!budget.allowed) {
      return await withTenant(workspaceId, async (tx) => {
        return await tx.assistantTaskRun.update({
          where: { id: run.id },
          data: { status: 'failed', error: budget.message, completedAt: new Date() },
        });
      });
    }

    try {
      const toolDeclarations = toolRegistry.getGeminiFunctionDeclarations();
      const toolsConfig = toolDeclarations.length > 0 ? [{ functionDeclarations: toolDeclarations }] : undefined;

      const systemPrompt = buildSystemPrompt({
        userName: 'Automation Runner',
        role: 'member',
        workspaceName: 'Stone AIO',
        mode: task.mode,
        includeToolParagraph: true,
      });

      let fullText = '';
      let inputTokens = 0;
      let outputTokens = 0;

      const stream = chatEngine.stream(
        [{ role: 'user', parts: [{ type: 'text', text: task.prompt }] }],
        {
          systemPrompt,
          tools: toolsConfig,
        }
      );

      for await (const event of stream) {
        if (event.type === 'delta') {
          fullText += event.text;
        } else if (event.type === 'done') {
          inputTokens = event.inputTokens;
          outputTokens = event.outputTokens;
        }
      }

      // 2. Complete run record
      const completedRun = await withTenant(workspaceId, async (tx) => {
        await tx.assistantScheduledTask.update({
          where: { id: task.id },
          data: { lastRunAt: new Date() },
        });

        return await tx.assistantTaskRun.update({
          where: { id: run.id },
          data: {
            status: 'completed',
            resultText: fullText,
            inputTokens,
            outputTokens,
            completedAt: new Date(),
          },
        });
      });

      // Spending caps (slice 1): scheduled-task tokens go into the
      // workspace monthly bucket. A recording failure is logged, never
      // fatal to the run record.
      if (inputTokens > 0 || outputTokens > 0) {
        try {
          await recordUsage(db as any, workspaceId, { input: inputTokens, output: outputTokens });
        } catch (err) {
          console.error('[AssistantBudget] Failed to record scheduled-task usage:', (err as Error)?.message);
        }
      }

      return completedRun;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return await withTenant(workspaceId, async (tx) => {
        return await tx.assistantTaskRun.update({
          where: { id: run.id },
          data: {
            status: 'failed',
            error: errorMsg,
            completedAt: new Date(),
          },
        });
      });
    }
  }
}

export const scheduledTaskService = new AssistantScheduledTaskService();
