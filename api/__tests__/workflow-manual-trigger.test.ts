import { describe, it, expect, vi, beforeEach } from 'vitest';

// Slice 3: manual trigger node + trigger_workflow actually runs + the
// engine refuses below Complete.

const ctl = vi.hoisted(() => ({
  plan: 'complete' as string,
  executed: [] as string[],
}));

const registry = vi.hoisted(() => {
  const map = new Map<string, any>();
  return {
    map,
    get: (t: string) => map.get(t),
    register: (impl: any) => map.set(impl.type, impl),
    getAll: () => [...map.values()],
  };
});

const queueCtl = vi.hoisted(() => ({
  enqueue: vi.fn(async (..._args: any[]): Promise<{ runId: string; status?: string }> => ({ runId: 'run-tool-1' })),
}));

const fakeDb = vi.hoisted(() => {
  const workflows: any[] = [];
  const runs: any[] = [];
  let seq = 0;
  const db = {
    workspace: {
      findUnique: async () => ({ plan: ctl.plan, subscriptionStatus: 'active' }),
    },
    workflow: {
      findUnique: async ({ where }: any) =>
        workflows.find((w) => w.id === where.id && (!where.workspaceId || w.workspaceId === where.workspaceId)) ?? null,
      findFirst: async ({ where }: any) =>
        workflows.find((w) => w.id === where.id && w.workspaceId === where.workspaceId) ?? null,
      update: async ({ where, data }: any) => {
        const row = workflows.find((w) => w.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      },
    },
    workflowRun: {
      findUnique: async ({ where }: any) => runs.find((r) => r.id === where.id) ?? null,
      findMany: async ({ where }: any = {}) =>
        runs.filter((r) => Object.entries(where ?? {}).every(([k, v]) => (r as any)[k] === v)),
      create: async ({ data }: any) => {
        const row = {
          id: `run-${++seq}`, status: 'RUNNING', startedAt: new Date(), finishedAt: null,
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
vi.mock('../services/workflow-engine/node-runner.js', () => ({ nodeRegistry: registry }));
vi.mock('../services/workflow-engine/queue.service.js', () => ({ queueService: queueCtl }));
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { registerAllNodes } from '../services/workflow-engine/nodes/index.js';
import { engineService } from '../services/workflow-engine/engine.service';
import { workflowTools } from '../services/assistant/tools/workflow.tools';

const ctx = { workspaceId: 'ws1', userId: 'u1', userRole: 'admin' };

function rawWorkflow(nodes: any[], edges: any[]) {
  return {
    id: 'wf1', workspaceId: 'ws1', status: 'draft', settingsJson: '{}',
    nativeDefinition: { nodesJson: JSON.stringify(nodes), edgesJson: JSON.stringify(edges) },
  };
}

describe('manual trigger + real trigger_workflow + engine plan gate (Slice 3)', () => {
  beforeEach(() => {
    fakeDb.workflows.splice(0);
    fakeDb.runs.splice(0);
    ctl.executed.splice(0);
    ctl.plan = 'complete';
    registry.map.clear();
    queueCtl.enqueue.mockClear();
    registerAllNodes();
    registry.register({
      type: 'test.record',
      execute: async (_c: any, items: any[]) => {
        ctl.executed.push('test.record');
        return { output: items };
      },
    });
  });

  it('registerAllNodes registers trigger.manual, which passes triggerData through', async () => {
    const impl = registry.get('trigger.manual');
    expect(impl).toBeDefined();
    expect(impl.displayName).toBe('Manual');
    expect(impl.category).toBe('trigger');
    const out = await impl.execute({}, [], { triggerData: { manual: true, contactId: 'ct_1' } } as any);
    expect(out.output[0].json).toEqual({ manual: true, contactId: 'ct_1' });
    // And it shows up in the catalog list the builder reads.
    expect(registry.getAll().map((n: any) => n.type)).toContain('trigger.manual');
  });

  it('trigger_workflow enqueues a real manual run instead of faking it', async () => {
    fakeDb.workflows.push({ id: 'wf1', workspaceId: 'ws1', name: 'Tag VIPs', status: 'draft' });
    const tool = workflowTools.find((t) => t.name === 'trigger_workflow')!;
    const res = await tool.execute({ workflowId: 'wf1', contactId: 'ct_alice' }, ctx);
    expect(queueCtl.enqueue).toHaveBeenCalledTimes(1);
    const args = queueCtl.enqueue.mock.calls[0][0];
    expect(args.mode).toBe('manual');
    expect(args.workflowId).toBe('wf1');
    expect(args.workspaceId).toBe('ws1');
    expect(args.triggerData.manual).toBe(true);
    expect(args.triggerData.contactId).toBe('ct_alice');
    expect(res.runId).toBe('run-tool-1');
    expect(res.status).toBe('triggered');
  });

  it('trigger_workflow throws when the run itself FAILED instead of reporting success', async () => {
    fakeDb.workflows.push({ id: 'wf1', workspaceId: 'ws1', name: 'Tag VIPs', status: 'draft' });
    queueCtl.enqueue.mockResolvedValueOnce({ runId: 'run-tool-2', status: 'FAILED' });
    const tool = workflowTools.find((t) => t.name === 'trigger_workflow')!;
    await expect(tool.execute({ workflowId: 'wf1' }, ctx)).rejects.toThrow(/failed to run \(run run-tool-2\)/);
  });

  it('trigger_workflow throws when the workflow is not in the workspace', async () => {
    const tool = workflowTools.find((t) => t.name === 'trigger_workflow')!;
    await expect(tool.execute({ workflowId: 'nope' }, ctx)).rejects.toThrow(/not found/);
    expect(queueCtl.enqueue).not.toHaveBeenCalled();
  });

  it('engine refuses to execute below Complete and runs nothing', async () => {
    fakeDb.workflows.push(
      rawWorkflow(
        [
          { id: 't1', type: 'triggerStep', data: { node: { type: 'trigger.manual', label: 'Manual' } } },
          { id: 'a1', type: 'nativeStep', data: { node: { type: 'test.record', label: 'Record' } } },
        ],
        [{ source: 't1', target: 'a1' }],
      ),
    );
    ctl.plan = 'pro';
    await expect(
      engineService.executeWorkflow({
        workspaceId: 'ws1', workflowId: 'wf1',
        triggerData: { manual: true }, mode: 'manual',
      }),
    ).rejects.toThrow(/PLAN_REQUIRED/);
    expect(fakeDb.runs).toHaveLength(0);
    expect(ctl.executed).toEqual([]);
  });

  it('engine runs a manual-trigger workflow end to end on Complete', async () => {
    fakeDb.workflows.push(
      rawWorkflow(
        [
          { id: 't1', type: 'triggerStep', data: { node: { type: 'trigger.manual', label: 'Manual' } } },
          { id: 'a1', type: 'nativeStep', data: { node: { type: 'test.record', label: 'Record' } } },
        ],
        [{ source: 't1', target: 'a1' }],
      ),
    );
    ctl.plan = 'complete';
    const { status } = await engineService.executeWorkflow({
      workspaceId: 'ws1', workflowId: 'wf1',
      triggerData: { manual: true, contactId: 'ct_alice' }, mode: 'manual',
    });
    expect(status).toBe('SUCCEEDED');
    expect(ctl.executed).toEqual(['test.record']);
    expect(fakeDb.runs).toHaveLength(1);
  });
});
