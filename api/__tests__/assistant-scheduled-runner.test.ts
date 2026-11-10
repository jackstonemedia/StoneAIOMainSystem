import { describe, it, expect, vi, beforeEach } from 'vitest';

// Blueprint 3 Phase 1: the scheduled-tasks runner. The mock keeps the real
// nextRunAfter (pure cron math) and stubs only executeTask (the AI run).
const executeTaskMock = vi.hoisted(() => vi.fn());

vi.mock('../services/assistant/scheduled-task.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/assistant/scheduled-task.service.js')>();
  return { ...actual, scheduledTaskService: { executeTask: executeTaskMock } };
});

import { nextRunAfter } from '../services/assistant/scheduled-task.service.js';
import { runDueScheduledTasks } from '../services/assistant/scheduled-task-runner.js';

function makeDb(opts: {
  due?: Array<{ id: string; workspaceId: string; cron: string; nextRunAt: Date | null }>;
  claimCount?: number;
}) {
  return {
    assistantScheduledTask: {
      findMany: vi.fn().mockResolvedValue(opts.due ?? []),
      updateMany: vi.fn().mockResolvedValue({ count: opts.claimCount ?? 1 }),
    },
  } as any;
}

describe('nextRunAfter — cron math', () => {
  it('returns the next 9am the same day when before it (local time)', () => {
    const from = new Date(2026, 10, 10, 8, 0, 0); // local 08:00
    expect(nextRunAfter('0 9 * * *', from)).toEqual(new Date(2026, 10, 10, 9, 0, 0));
  });

  it('returns 9am the next day when after it', () => {
    const from = new Date(2026, 10, 10, 10, 0, 0); // local 10:00
    expect(nextRunAfter('0 9 * * *', from)).toEqual(new Date(2026, 10, 11, 9, 0, 0));
  });

  it('handles step expressions', () => {
    const from = new Date(2026, 10, 10, 10, 7, 0);
    expect(nextRunAfter('*/15 * * * *', from)).toEqual(new Date(2026, 10, 10, 10, 15, 0));
  });

  it('returns null for an invalid expression', () => {
    expect(nextRunAfter('not-a-cron', new Date())).toBeNull();
    expect(nextRunAfter('', new Date())).toBeNull();
  });
});

describe('runDueScheduledTasks — runner', () => {
  beforeEach(() => {
    executeTaskMock.mockReset();
    executeTaskMock.mockResolvedValue({ id: 'run_1', status: 'completed' });
  });

  it('executes a due task and advances its nextRunAt from the cron', async () => {
    const now = new Date();
    const due = [
      { id: 'task_1', workspaceId: 'ws_1', cron: '0 9 * * *', nextRunAt: new Date(now.getTime() - 60_000) },
    ];
    const db = makeDb({ due });
    const result = await runDueScheduledTasks(db);

    expect(result).toEqual({ checked: 1, executed: 1, failed: 0 });
    expect(executeTaskMock).toHaveBeenCalledTimes(1);
    expect(executeTaskMock).toHaveBeenCalledWith('ws_1', 'task_1');
    const claim = db.assistantScheduledTask.updateMany.mock.calls[0][0];
    expect(claim.where).toEqual({ id: 'task_1', nextRunAt: due[0].nextRunAt });
    const next = claim.data.nextRunAt as Date;
    expect(next.getTime()).toBeGreaterThan(now.getTime());
    expect(next.getHours()).toBe(9);
  });

  it('asks only for active tasks whose nextRunAt has passed', async () => {
    const db = makeDb({ due: [] });
    await runDueScheduledTasks(db);
    const where = db.assistantScheduledTask.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('active');
    expect(JSON.stringify(where)).toContain('nextRunAt');
  });

  it('skips a task another runner already claimed (updateMany count 0)', async () => {
    const db = makeDb({
      due: [{ id: 'task_1', workspaceId: 'ws_1', cron: '0 9 * * *', nextRunAt: new Date(Date.now() - 60_000) }],
      claimCount: 0,
    });
    const result = await runDueScheduledTasks(db);
    expect(executeTaskMock).not.toHaveBeenCalled();
    expect(result).toEqual({ checked: 1, executed: 0, failed: 0 });
  });

  it('still runs a task with an invalid cron, falling back to +24h', async () => {
    const now = new Date();
    const db = makeDb({
      due: [{ id: 'task_bad', workspaceId: 'ws_1', cron: 'bogus', nextRunAt: new Date(now.getTime() - 60_000) }],
    });
    const result = await runDueScheduledTasks(db);
    expect(executeTaskMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ checked: 1, executed: 1, failed: 0 });
    const next = db.assistantScheduledTask.updateMany.mock.calls[0][0].data.nextRunAt as Date;
    expect(next.getTime() - now.getTime()).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(next.getTime() - now.getTime()).toBeLessThan(25 * 60 * 60 * 1000);
  });

  it('records a failure and keeps going when executeTask throws', async () => {
    executeTaskMock.mockRejectedValueOnce(new Error('LLM down'));
    const db = makeDb({
      due: [{ id: 'task_1', workspaceId: 'ws_1', cron: '0 9 * * *', nextRunAt: new Date(Date.now() - 60_000) }],
    });
    const result = await runDueScheduledTasks(db);
    expect(result).toEqual({ checked: 1, executed: 0, failed: 1 });
  });
});
