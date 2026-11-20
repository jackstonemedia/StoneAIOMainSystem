import { describe, it, expect, vi, beforeEach } from 'vitest';

// Slice 2: workflow waits must actually pause a run, and the resumer must
// pick it up AFTER the wait node — never re-execute the wait itself.

const ctl = vi.hoisted(() => ({
  executed: [] as string[],
  waitRuns: 0,
  recordInputs: [] as any[][],
}));

const registry = vi.hoisted(() => new Map<string, any>());

const fakeDb = vi.hoisted(() => {
  const workflows: any[] = [];
  const runs: any[] = [];
  let seq = 0;
  const nextId = () => `run-${++seq}`;
  const match = (row: any, where: any): boolean => {
    if (!where) return true;
    return Object.entries(where).every(([k, v]) => {
      if (v !== null && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)) {
        if ('lte' in (v as any)) {
          return row[k] != null && new Date(row[k]).getTime() <= new Date((v as any).lte).getTime();
        }
        return false;
      }
      return row[k] === v;
    });
  };
  const db = {
    // Slice 3: the engine plan-gates every execution; the fake
    // workspace is Complete so the resume tests exercise resume logic.
    workspace: {
      findUnique: async () => ({ plan: 'complete', subscriptionStatus: 'active' }),
    },
    workflow: {
      findUnique: async ({ where }: any) =>
        workflows.find((w) => w.id === where.id) ?? null,
    },
    workflowRun: {
      findUnique: async ({ where }: any) => runs.find((r) => r.id === where.id) ?? null,
      findMany: async ({ where }: any = {}) => runs.filter((r) => match(r, where)),
      create: async ({ data }: any) => {
        const row = {
          id: nextId(), status: 'RUNNING', startedAt: new Date(), finishedAt: null,
          durationMs: null, stepCount: 0, errorMessage: null, resumeAt: null,
          waitingNodeId: null, runData: '{}', ...data,
        };
        runs.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = runs.find((r) => r.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      },
    },
  };
  return { db, workflows, runs };
});

vi.mock('../../infrastructure/database/client.js', () => ({ db: fakeDb.db }));
vi.mock('../services/workflow-engine/node-runner.js', () => ({
  nodeRegistry: { get: (t: string) => registry.get(t) },
}));
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { engineService } from '../services/workflow-engine/engine.service';
import { logicWait } from '../services/workflow-engine/nodes/logic-wait.js';
import { resumeDueWorkflowRuns } from '../jobs/resume-paused-runs.job';

// Raw React Flow node shapes, as the canvas actually stores them — this is
// what proves resumeRun normalizes (without it the registry lookup for
// 'nativeStep' throws and the trigger fallback never matches).
function rawWorkflow(nodes: any[], edges: any[]) {
  return {
    id: 'wf1', workspaceId: 'ws1', status: 'published', settingsJson: '{}',
    nativeDefinition: { nodesJson: JSON.stringify(nodes), edgesJson: JSON.stringify(edges) },
  };
}
const triggerNode = {
  id: 't1', type: 'triggerStep',
  data: { node: { type: 'trigger.webhook', label: 'Trigger' } },
};
const transformNode = {
  id: 'x1', type: 'nativeStep',
  data: { node: { type: 'test.transform', label: 'Transform' } },
};
const waitNode = (id: string, seconds = 5) => ({
  id, type: 'nativeStep',
  data: { node: { type: 'logic.wait', label: 'Wait', config: { waitUnit: 'seconds', waitAmount: seconds } } },
});
const recordNode = (id: string) => ({
  id, type: 'nativeStep',
  data: { node: { type: 'test.record', label: 'After wait' } },
});

describe('workflow waits pause + resume (complete-platform item 1, Slice 2)', () => {
  beforeEach(() => {
    fakeDb.workflows.splice(0);
    fakeDb.runs.splice(0);
    ctl.executed.splice(0);
    ctl.waitRuns = 0;
    ctl.recordInputs.splice(0);
    registry.clear();
    registry.set('trigger.webhook', {
      type: 'trigger.webhook',
      execute: async (_c: any, items: any[]) => {
        ctl.executed.push('trigger.webhook');
        return { output: items };
      },
    });
    registry.set('test.transform', {
      type: 'test.transform',
      execute: async (_c: any, items: any[]) => {
        ctl.executed.push('test.transform');
        return { output: items.map((i: any) => ({ json: { ...i.json, transformed: true } })) };
      },
    });
    registry.set('test.record', {
      type: 'test.record',
      execute: async (_c: any, items: any[]) => {
        ctl.executed.push('test.record');
        ctl.recordInputs.push(items);
        return { output: items };
      },
    });
    registry.set('logic.wait', {
      ...logicWait,
      execute: async (...args: any[]) => {
        ctl.waitRuns += 1;
        return (logicWait as any).execute(...args);
      },
    });
  });

  function seedWorkflow() {
    fakeDb.workflows.push(
      rawWorkflow(
        [triggerNode, transformNode, waitNode('w1'), recordNode('a1')],
        [
          { source: 't1', target: 'x1' },
          { source: 'x1', target: 'w1' },
          { source: 'w1', target: 'a1' },
        ],
      ),
    );
  }

  it('executeWorkflow pauses at the wait and persists runData', async () => {
    seedWorkflow();
    const { runId, status } = await engineService.executeWorkflow({
      workspaceId: 'ws1', workflowId: 'wf1',
      triggerData: { hello: 'world' }, mode: 'production',
    });
    expect(status).toBe('PAUSED');
    const run = fakeDb.runs.find((r) => r.id === runId);
    expect(run.status).toBe('PAUSED');
    expect(run.waitingNodeId).toBe('w1');
    expect(new Date(run.resumeAt).getTime() - Date.now()).toBeGreaterThan(3000);
    // The wait node's output (the TRANSFORMED items) was persisted at
    // pause time — not left as '{}'.
    const saved = JSON.parse(run.runData);
    expect(saved['w1'][0].json.transformed).toBe(true);
    expect(saved['w1'][0].json.hello).toBe('world');
    // Nothing after the wait ran.
    expect(ctl.executed).toEqual(['trigger.webhook', 'test.transform']);
    expect(ctl.waitRuns).toBe(1);
  });

  it('resumeRun runs the successors once, never the wait again, with the wait output', async () => {
    seedWorkflow();
    const { runId } = await engineService.executeWorkflow({
      workspaceId: 'ws1', workflowId: 'wf1',
      triggerData: { hello: 'world' }, mode: 'production',
    });
    await engineService.resumeRun(runId);
    const run = fakeDb.runs.find((r) => r.id === runId);
    expect(run.status).toBe('SUCCEEDED');
    expect(ctl.waitRuns).toBe(1); // the wait did NOT re-execute
    expect(ctl.executed).toEqual(['trigger.webhook', 'test.transform', 'test.record']);
    // The successor received the wait node's saved (transformed) output,
    // not the raw trigger data.
    expect(ctl.recordInputs).toHaveLength(1);
    expect(ctl.recordInputs[0][0].json.transformed).toBe(true);
    expect(ctl.recordInputs[0][0].json.hello).toBe('world');
  });

  it('resumeRun completes a run whose wait is the last node', async () => {
    fakeDb.workflows.push(
      rawWorkflow(
        [triggerNode, waitNode('w1')],
        [{ source: 't1', target: 'w1' }],
      ),
    );
    const { runId, status } = await engineService.executeWorkflow({
      workspaceId: 'ws1', workflowId: 'wf1',
      triggerData: { hello: 'world' }, mode: 'production',
    });
    expect(status).toBe('PAUSED');
    await engineService.resumeRun(runId);
    const run = fakeDb.runs.find((r) => r.id === runId);
    expect(run.status).toBe('SUCCEEDED');
    expect(ctl.waitRuns).toBe(1);
  });

  it('resumeRun is a no-op for a run that is not PAUSED', async () => {
    seedWorkflow();
    const { runId } = await engineService.executeWorkflow({
      workspaceId: 'ws1', workflowId: 'wf1',
      triggerData: { hello: 'world' }, mode: 'production',
    });
    await engineService.resumeRun(runId);
    const before = [...ctl.executed];
    await engineService.resumeRun(runId); // now SUCCEEDED — nothing happens
    expect(ctl.executed).toEqual(before);
  });

  it('a second wait in the chain pauses again instead of succeeding', async () => {
    fakeDb.workflows.push(
      rawWorkflow(
        [triggerNode, waitNode('w1', 1), recordNode('a1'), waitNode('w2', 1), recordNode('a2')],
        [
          { source: 't1', target: 'w1' },
          { source: 'w1', target: 'a1' },
          { source: 'a1', target: 'w2' },
          { source: 'w2', target: 'a2' },
        ],
      ),
    );
    const { runId, status } = await engineService.executeWorkflow({
      workspaceId: 'ws1', workflowId: 'wf1',
      triggerData: { hello: 'world' }, mode: 'production',
    });
    expect(status).toBe('PAUSED');
    await engineService.resumeRun(runId);
    let run = fakeDb.runs.find((r) => r.id === runId);
    expect(run.status).toBe('PAUSED'); // paused again at w2, NOT succeeded
    expect(run.waitingNodeId).toBe('w2');
    expect(ctl.waitRuns).toBe(2);
    await engineService.resumeRun(runId);
    run = fakeDb.runs.find((r) => r.id === runId);
    expect(run.status).toBe('SUCCEEDED');
    expect(ctl.executed.filter((t) => t === 'test.record')).toHaveLength(2);
  });

  it('resumeDueWorkflowRuns resumes due runs and skips not-due ones', async () => {
    seedWorkflow();
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    const waitOutput = JSON.stringify({ w1: [{ json: { hello: 'world', transformed: true } }] });
    fakeDb.runs.push(
      {
        id: 'run-due', workspaceId: 'ws1', workflowId: 'wf1', status: 'PAUSED',
        startedAt: new Date(), finishedAt: null, resumeAt: past, waitingNodeId: 'w1',
        triggerData: JSON.stringify({ hello: 'world' }), runData: waitOutput,
      },
      {
        id: 'run-future', workspaceId: 'ws1', workflowId: 'wf1', status: 'PAUSED',
        startedAt: new Date(), finishedAt: null, resumeAt: future, waitingNodeId: 'w1',
        triggerData: JSON.stringify({ hello: 'world' }), runData: waitOutput,
      },
    );
    const resumed = await resumeDueWorkflowRuns();
    expect(resumed).toBe(1);
    expect(fakeDb.runs.find((r) => r.id === 'run-due')?.status).toBe('SUCCEEDED');
    expect(fakeDb.runs.find((r) => r.id === 'run-future')?.status).toBe('PAUSED');
    expect(ctl.executed).toEqual(['test.record']);
  });
});
