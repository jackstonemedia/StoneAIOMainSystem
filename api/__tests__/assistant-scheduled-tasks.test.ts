/**
 * Stage S6: Scheduled Tasks & Background Runner Tests
 * Spec Section 2.8 & Stage S6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

interface FixtureTask {
  id: string;
  workspaceId: string;
  userId: string;
  title: string;
  prompt: string;
  cron: string;
  mode: string;
  status: string;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FixtureRun {
  id: string;
  workspaceId: string;
  taskId: string;
  status: string;
  resultText?: string | null;
  error?: string | null;
  inputTokens: number;
  outputTokens: number;
  startedAt: Date;
  completedAt?: Date | null;
}

const mockTasks: Record<string, FixtureTask> = {};
const mockRuns: Record<string, FixtureRun> = {};

vi.mock('../../infrastructure/database/client.js', () => ({
  db: {
    $transaction: vi.fn().mockImplementation(async (callback) => {
      const txMock = {
        $executeRaw: vi.fn().mockResolvedValue(1),
        assistantScheduledTask: {
          findMany: vi.fn().mockImplementation(({ where }) => {
            return Promise.resolve(
              Object.values(mockTasks).filter(
                (t) => t.workspaceId === where.workspaceId && t.userId === where.userId
              )
            );
          }),
          findFirst: vi.fn().mockImplementation(({ where }) => {
            return Promise.resolve(
              Object.values(mockTasks).find((t) => {
                if (where.id && t.id !== where.id) return false;
                if (where.workspaceId && t.workspaceId !== where.workspaceId) return false;
                if (where.userId && t.userId !== where.userId) return false;
                return true;
              }) || null
            );
          }),
          create: vi.fn().mockImplementation(({ data }) => {
            const id = `task-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const item: FixtureTask = {
              id,
              ...data,
              lastRunAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockTasks[id] = item;
            return Promise.resolve(item);
          }),
          update: vi.fn().mockImplementation(({ where, data }) => {
            const item = mockTasks[where.id];
            if (item) {
              Object.assign(item, data, { updatedAt: new Date() });
              return Promise.resolve(item);
            }
            return Promise.reject(new Error('Task not found'));
          }),
          delete: vi.fn().mockImplementation(({ where }) => {
            delete mockTasks[where.id];
            return Promise.resolve({ id: where.id });
          }),
        },
        assistantTaskRun: {
          findMany: vi.fn().mockImplementation(({ where }) => {
            return Promise.resolve(
              Object.values(mockRuns).filter(
                (r) => r.workspaceId === where.workspaceId && r.taskId === where.taskId
              )
            );
          }),
          create: vi.fn().mockImplementation(({ data }) => {
            const id = `run-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const item: FixtureRun = {
              id,
              ...data,
              inputTokens: 0,
              outputTokens: 0,
              startedAt: new Date(),
            };
            mockRuns[id] = item;
            return Promise.resolve(item);
          }),
          update: vi.fn().mockImplementation(({ where, data }) => {
            const item = mockRuns[where.id];
            if (item) {
              Object.assign(item, data);
              return Promise.resolve(item);
            }
            return Promise.reject(new Error('Run not found'));
          }),
        },
      };

      return callback(txMock);
    }),
  },
}));

vi.mock('../../packages/ai/engine/chat-engine.js', () => ({
  chatEngine: {
    stream: vi.fn().mockImplementation(async function* () {
      yield { type: 'delta', text: 'Daily pipeline briefing summary: 4 deals closing this week.' };
      yield { type: 'done', inputTokens: 50, outputTokens: 25 };
    }),
  },
}));

import { scheduledTaskService } from '../services/assistant/scheduled-task.service.js';

describe('Assistant Scheduled Tasks Service', () => {
  const ws1 = 'ws-sched-1';
  const ws2 = 'ws-sched-2';
  const user1 = 'u-sched-1';

  beforeEach(() => {
    for (const key of Object.keys(mockTasks)) delete mockTasks[key];
    for (const key of Object.keys(mockRuns)) delete mockRuns[key];
  });

  it('creates and lists scheduled tasks scoped to workspace and user', async () => {
    const task = await scheduledTaskService.createTask(ws1, user1, {
      title: 'Daily Pipeline Audit',
      prompt: 'Check stale deals and report deals closing soon.',
      cron: '0 9 * * 1-5',
      mode: 'read_only',
    });

    expect(task.id).toBeDefined();
    expect(task.title).toBe('Daily Pipeline Audit');
    expect(task.status).toBe('active');

    const tasks = await scheduledTaskService.listTasks(ws1, user1);
    expect(tasks.length).toBe(1);

    // Tenant isolation
    const otherTasks = await scheduledTaskService.listTasks(ws2, user1);
    expect(otherTasks.length).toBe(0);
  });

  it('updates task fields and toggles status', async () => {
    const task = await scheduledTaskService.createTask(ws1, user1, {
      title: 'Weekly SDR Review',
      prompt: 'Check replies and reply classification rates.',
    });

    const updated = await scheduledTaskService.updateTask(ws1, user1, task.id, {
      title: 'Weekly SDR Review (Updated)',
      status: 'paused',
    });

    expect(updated.title).toBe('Weekly SDR Review (Updated)');
    expect(updated.status).toBe('paused');
  });

  it('executes scheduled task, creates run record and records generated text', async () => {
    const task = await scheduledTaskService.createTask(ws1, user1, {
      title: 'Morning Briefing',
      prompt: 'Summarize today meetings and tasks.',
      mode: 'read_only',
    });

    const run = await scheduledTaskService.executeTask(ws1, task.id);

    expect(run.status).toBe('completed');
    expect(run.resultText).toContain('Daily pipeline briefing summary');
    expect(run.inputTokens).toBe(50);
    expect(run.outputTokens).toBe(25);
    expect(run.completedAt).toBeDefined();

    const runs = await scheduledTaskService.listRuns(ws1, task.id);
    expect(runs.length).toBe(1);
    expect(runs[0].id).toBe(run.id);
  });

  it('deletes scheduled task and verifies removal', async () => {
    const task = await scheduledTaskService.createTask(ws1, user1, {
      title: 'Temporary Audit',
      prompt: 'Audit run.',
    });

    const deleted = await scheduledTaskService.deleteTask(ws1, user1, task.id);
    expect(deleted).toBe(true);

    const tasks = await scheduledTaskService.listTasks(ws1, user1);
    expect(tasks.length).toBe(0);
  });
});
