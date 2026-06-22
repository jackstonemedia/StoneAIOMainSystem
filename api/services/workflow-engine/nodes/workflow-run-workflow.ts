'use strict';
import type { NodeImplementation, NodeExecuteResult } from '../node-runner.js';
import type { NodeConfigField, WorkflowItem, ExecutionContext } from '../../../../src/types/automation.js';

export const workflowRunWorkflow: NodeImplementation = {
  type: 'workflow.run_workflow',
  category: 'integration',
  displayName: 'Run Workflow',
  description: 'Trigger another workflow as a sub-workflow.',
  iconName: 'play-circle',
  color: '#0EA5E9',
  outputHandles: [{ id: 'default', label: 'Triggered', color: '#0EA5E9' }],
  configSchema: [
    { key: 'workflowId', label: 'Target Workflow ID', type: 'text', required: true },
    { key: 'triggerData', label: 'Trigger Data (JSON)', type: 'json' },
  ] as NodeConfigField[],

  async execute(config: Record<string, unknown>, _items: WorkflowItem[], context: ExecutionContext): Promise<NodeExecuteResult> {
    const targetWorkflowId = config.workflowId as string;
    if (!targetWorkflowId) throw new Error('Target workflow ID is required.');

    let triggerData: Record<string, unknown> = {};
    if (config.triggerData && typeof config.triggerData === 'string') {
      try { triggerData = JSON.parse(config.triggerData); } catch { triggerData = {}; }
    } else if (typeof config.triggerData === 'object' && config.triggerData !== null) {
      triggerData = config.triggerData as Record<string, unknown>;
    }

    // Lazy-import to avoid circular dependency
    const { queueService } = await import('../queue.service.js');
    const result = await queueService.enqueue({
      workspaceId: context.workspaceId,
      workflowId: targetWorkflowId,
      triggerData: { ...triggerData, parentRunId: context.runId },
      mode: 'production',
    });

    return { output: [{ json: { targetWorkflowId, runId: result.runId } }] };
  },
};
