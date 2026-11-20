'use strict';

import type { NodeImplementation, NodeExecuteResult } from '../node-runner.js';
import type { NodeConfigField, WorkflowItem, ExecutionContext } from '../../../../src/types/automation.js';

/**
 * Manual trigger node.
 *
 * Entry point for hand-run workflows: the Run now button in the
 * Workflow Builder, or the AI assistant's trigger_workflow tool.
 * Passes the incoming trigger data through as its output — the data
 * carries who ran it ({ manual: true, triggeredBy, contactId, ... }).
 *
 * No config: a manual trigger has nothing to subscribe to and nothing
 * to schedule. The definition-save route already maps trigger.manual
 * to workflow.triggerType 'manual' and creates no schedule,
 * subscription, or webhook for it.
 */
export const triggerManual: NodeImplementation = {
  type: 'trigger.manual',
  category: 'trigger',
  displayName: 'Manual',
  description: 'Run this workflow by hand — from the Run now button or the AI assistant.',
  iconName: 'play',
  color: '#F59E0B',
  outputHandles: [{ id: 'default', label: 'Triggered', color: '#F59E0B' }],
  configSchema: [] as NodeConfigField[],

  async execute(_config: Record<string, unknown>, _items: WorkflowItem[], context: ExecutionContext): Promise<NodeExecuteResult> {
    return {
      output: [{ json: context.triggerData as Record<string, unknown> }],
    };
  },
};
